import express from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Step 1: Upload and Preview Excel (Kategorisiz esnek aktarım)
router.post('/preview', authenticateToken, requireRole('super_admin', 'business_admin', 'finance'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Lütfen bir Excel (.xlsx, .xls) dosyası yükleyiniz.' });
    }

    const business_id = req.body.business_id || 'DK';
    const override_date = req.body.override_date || null;

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!rawData || rawData.length < 2) {
      return res.status(400).json({ success: false, message: 'Yüklenen Excel dosyası boş veya başlık satırı eksik.' });
    }

    const headerRow = rawData[0].map(h => String(h || '').trim().toLowerCase());
    let dateIdx = headerRow.findIndex(h => h.includes('tarih') || h.includes('date'));
    let descIdx = headerRow.findIndex(h => h.includes('aciklama') || h.includes('açıklama') || h.includes('kalem') || h.includes('ad') || h.includes('urun') || h.includes('ürün') || h.includes('kategori'));
    let nakitIdx = headerRow.findIndex(h => h.includes('nakit') || h.includes('cash'));
    let kartIdx = headerRow.findIndex(h => h.includes('kart') || h.includes('pos') || h.includes('kredi'));
    let totalIdx = headerRow.findIndex(h => h.includes('toplam') || h.includes('tutar') || h.includes('total'));

    if (descIdx === -1) descIdx = 0;
    if (nakitIdx === -1 && rawData[0].length >= 2) nakitIdx = 1;
    if (kartIdx === -1 && rawData[0].length >= 3) kartIdx = 2;

    const previewRows = [];
    let detectedDate = override_date || null;
    let totalNakit = 0;
    let totalKart = 0;
    let totalSum = 0;

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0 || !row.some(cell => String(cell).trim() !== '')) continue;

      let rowDate = detectedDate;
      if (dateIdx !== -1 && row[dateIdx]) {
        const val = row[dateIdx];
        if (typeof val === 'number') {
          const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
          rowDate = jsDate.toISOString().split('T')[0];
        } else {
          rowDate = String(val).trim();
          if (rowDate.includes('.')) {
            const parts = rowDate.split('.');
            if (parts.length === 3) {
              rowDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
        }
        if (!detectedDate) detectedDate = rowDate;
      }

      const itemDesc = descIdx !== -1 && row[descIdx] ? String(row[descIdx]).trim() : 'Yazar Kasa Satışı';
      let nakit = nakitIdx !== -1 && row[nakitIdx] ? parseFloat(String(row[nakitIdx]).replace(',', '.')) || 0 : 0;
      let kart = kartIdx !== -1 && row[kartIdx] ? parseFloat(String(row[kartIdx]).replace(',', '.')) || 0 : 0;
      
      if (nakit === 0 && kart === 0 && totalIdx !== -1 && row[totalIdx]) {
        nakit = parseFloat(String(row[totalIdx]).replace(',', '.')) || 0;
      }

      const rowTotal = nakit + kart;
      if (rowTotal > 0) {
        totalNakit += nakit;
        totalKart += kart;
        totalSum += rowTotal;

        previewRows.push({
          date: rowDate || override_date || new Date().toISOString().split('T')[0],
          description: itemDesc,
          nakit,
          kart,
          total: rowTotal
        });
      }
    }

    const finalTargetDate = detectedDate || override_date || new Date().toISOString().split('T')[0];

    const existingSales = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM sales
      WHERE business_id = ? AND date = ? AND is_cancelled = 0
    `).get(business_id, finalTargetDate);

    const isClosed = db.prepare('SELECT is_closed FROM daily_closings WHERE date = ?').get(finalTargetDate)?.is_closed === 1;

    return res.json({
      success: true,
      filename: req.file.originalname,
      business_id,
      target_date: finalTargetDate,
      rows: previewRows,
      summary: {
        totalNakit,
        totalKart,
        totalSum,
        rowCount: previewRows.length
      },
      has_conflict: existingSales.count > 0,
      conflict_info: existingSales.count > 0 ? {
        existingCount: existingSales.count,
        existingTotal: existingSales.total
      } : null,
      is_closed: isClosed
    });
  } catch (err) {
    console.error('Excel preview error:', err);
    return res.status(500).json({ success: false, message: 'Excel dosyası işlenirken hata oluştu: ' + err.message });
  }
});

// Step 2: Confirm and Commit Excel Data
router.post('/confirm', authenticateToken, requireRole('super_admin', 'business_admin', 'finance'), (req, res) => {
  try {
    const { business_id, target_date, rows, mode = 'APPEND', change_reason } = req.body;

    if (!business_id || !target_date || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Geçersiz aktarım parametreleri.' });
    }

    const isClosed = db.prepare('SELECT is_closed FROM daily_closings WHERE date = ?').get(target_date)?.is_closed === 1;
    if (isClosed && !change_reason) {
      return res.status(403).json({
        success: false,
        requiresReason: true,
        message: 'Bu gün kapatılmıştır. Excel aktarımı için değişiklik sebebi girmeniz zorunludur.'
      });
    }

    if (mode === 'OVERWRITE') {
      const existingSales = db.prepare(`
        SELECT id FROM sales WHERE business_id = ? AND date = ? AND is_cancelled = 0
      `).all(business_id, target_date);

      if (existingSales.length > 0) {
        db.prepare(`
          UPDATE sales SET is_cancelled = 1, updated_at = CURRENT_TIMESTAMP 
          WHERE business_id = ? AND date = ? AND is_cancelled = 0
        `).run(business_id, target_date);

        logAudit({
          userId: req.user.id,
          userName: req.user.full_name,
          action: 'SALE_OVERWRITE_BEFORE_EXCEL',
          entityType: 'SALES',
          entityId: business_id,
          newValues: { target_date, cancelledCount: existingSales.length },
          changeReason: isClosed ? change_reason : 'Excel üzerine yazma işlemi',
          ipAddress: req.ip
        });
      }
    }

    const insertSale = db.prepare(`
      INSERT INTO sales (business_id, date, payment_type, amount, description, source, created_by)
      VALUES (?, ?, ?, ?, ?, 'EXCEL', ?)
    `);

    let insertedRecords = 0;
    let totalImportedAmount = 0;

    for (const r of rows) {
      const nakit = parseFloat(r.nakit) || 0;
      const kart = parseFloat(r.kart) || 0;
      const desc = r.description ? `Excel: ${r.description}` : 'Excel Yazar Kasa Aktarımı';

      if (nakit > 0) {
        insertSale.run(business_id, target_date, 'NAKIT', nakit, desc, req.user.id);
        insertedRecords++;
        totalImportedAmount += nakit;
      }
      if (kart > 0) {
        insertSale.run(business_id, target_date, 'KART', kart, desc, req.user.id);
        insertedRecords++;
        totalImportedAmount += kart;
      }
    }

    db.prepare(`
      INSERT INTO imported_files (filename, target_date, business_id, record_count, total_amount, imported_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.body.filename || 'YazarKasa_Export.xlsx', target_date, business_id, insertedRecords, totalImportedAmount, req.user.id);

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'EXCEL_IMPORT',
      entityType: 'SALES',
      entityId: business_id,
      newValues: { business_id, target_date, insertedRecords, totalImportedAmount, mode },
      changeReason: isClosed ? change_reason : null,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `${target_date} tarihli ${insertedRecords} adet satış kaydı (${totalImportedAmount.toLocaleString('tr-TR')} TL) başarıyla sisteme aktarıldı.`,
      insertedRecords,
      totalImportedAmount
    });
  } catch (err) {
    console.error('Excel confirm error:', err);
    return res.status(500).json({ success: false, message: 'Veriler aktarılırken hata oluştu: ' + err.message });
  }
});

// Step 3: Download Sample Excel Template
router.get('/sample-template', (req, res) => {
  try {
    const sampleData = [
      { Tarih: '2026-10-08', Kalem_Aciklama: 'Günlük Bar Fiş Satışları', Nakit: 25000, Kart: 35000, Toplam: 60000 },
      { Tarih: '2026-10-08', Kalem_Aciklama: 'Mutfak & Yemek Satışları', Nakit: 18000, Kart: 22000, Toplam: 40000 },
      { Tarih: '2026-10-08', Kalem_Aciklama: 'Teras & Kahve Satışları', Nakit: 8500, Kart: 12500, Toplam: 21000 },
      { Tarih: '2026-10-08', Kalem_Aciklama: 'Nargile & Diğer Hizmetler', Nakit: 6000, Kart: 4500, Toplam: 10500 }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'YazarKasaSatis');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Yazar_Kasa_Satis_Sablonu.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Şablon oluşturulamadı.' });
  }
});

export default router;
