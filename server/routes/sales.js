import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkClosedDate, requireRole } from '../middleware/rbac.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// List Sales (Kategorisiz Satış Listesi)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { business_id, startDate, endDate, payment_type, search, limit = 200 } = req.query;

    let query = `
      SELECT 
        s.*,
        u.full_name as creator_name
      FROM sales s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.is_cancelled = 0
    `;
    const params = [];

    if (business_id && business_id !== 'ALL') {
      query += ` AND s.business_id = ?`;
      params.push(business_id);
    }
    if (startDate) {
      query += ` AND s.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND s.date <= ?`;
      params.push(endDate);
    }
    if (payment_type) {
      query += ` AND s.payment_type = ?`;
      params.push(payment_type);
    }
    if (search) {
      query += ` AND s.description LIKE ?`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY s.date DESC, s.id DESC LIMIT ?`;
    params.push(Number(limit));

    const sales = db.prepare(query).all(...params);

    return res.json({ success: true, sales });
  } catch (err) {
    console.error('Sales fetch error:', err);
    return res.status(500).json({ success: false, message: 'Satışlar listelenirken hata oluştu.' });
  }
});

// Sales Tracking Breakdown (Günlük, Haftalık, Aylık Nakit & KK Takibi)
router.get('/tracking', authenticateToken, (req, res) => {
  try {
    const period = req.query.period || 'gunluk'; // 'gunluk', 'haftalik', 'aylik'
    const targetDate = req.query.date || '2026-10-08';

    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const shortDayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    // Helper: calculate sales for a specific date
    const getSalesForDate = (dateStr) => {
      const rows = db.prepare(`
        SELECT business_id, payment_type, SUM(amount) as total
        FROM sales
        WHERE date = ? AND is_cancelled = 0
        GROUP BY business_id, payment_type
      `).all(dateStr);

      let dk_nakit = 0, dk_kart = 0;
      let palm_nakit = 0, palm_kart = 0;

      rows.forEach(r => {
        if (r.business_id === 'DK') {
          if (r.payment_type === 'NAKIT') dk_nakit = r.total || 0;
          if (r.payment_type === 'KART') dk_kart = r.total || 0;
        } else if (r.business_id === 'PALM') {
          if (r.payment_type === 'NAKIT') palm_nakit = r.total || 0;
          if (r.payment_type === 'KART') palm_kart = r.total || 0;
        }
      });

      const commRows = db.prepare(`
        SELECT business_id, commission_amount
        FROM daily_card_settlements
        WHERE date = ?
      `).all(dateStr);

      let dk_komisyon = 0, palm_komisyon = 0;
      commRows.forEach(c => {
        if (c.business_id === 'DK') dk_komisyon = c.commission_amount || 0;
        if (c.business_id === 'PALM') palm_komisyon = c.commission_amount || 0;
      });

      const dk_total = dk_nakit + dk_kart;
      const palm_total = palm_nakit + palm_kart;
      const total_nakit = dk_nakit + palm_nakit;
      const total_kart = dk_kart + palm_kart;
      const total_komisyon = dk_komisyon + palm_komisyon;
      const net_kart = Math.max(0, total_kart - total_komisyon);
      const grand_total = dk_total + palm_total;

      return {
        date: dateStr,
        dk_nakit,
        dk_kart,
        dk_komisyon,
        dk_net_kart: Math.max(0, dk_kart - dk_komisyon),
        dk_total,
        palm_nakit,
        palm_kart,
        palm_komisyon,
        palm_net_kart: Math.max(0, palm_kart - palm_komisyon),
        palm_total,
        total_nakit,
        total_kart,
        total_komisyon,
        net_kart,
        grand_total
      };
    };

    if (period === 'gunluk') {
      const dailySales = getSalesForDate(targetDate);
      const items = db.prepare(`
        SELECT s.*, u.full_name as creator_name
        FROM sales s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.date = ? AND s.is_cancelled = 0
        ORDER BY s.id DESC
      `).all(targetDate);

      return res.json({
        success: true,
        period: 'gunluk',
        date: targetDate,
        summary: dailySales,
        items,
        sales: items
      });
    }

    if (period === 'haftalik') {
      // Find Monday of the current week
      const current = new Date(targetDate);
      const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monday = new Date(current);
      monday.setDate(current.getDate() + diffToMonday);

      const days = [];
      let total_dk_nakit = 0, total_dk_kart = 0, total_dk = 0;
      let total_palm_nakit = 0, total_palm_kart = 0, total_palm = 0;
      let grand_nakit = 0, grand_kart = 0, grand_total = 0;

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dayData = getSalesForDate(dateStr);
        const dayIdx = d.getDay();

        dayData.dayName = dayNames[dayIdx];
        dayData.isWeekend = dayIdx === 0 || dayIdx === 6;
        dayData.isTargetDate = dateStr === targetDate;
        days.push(dayData);

        total_dk_nakit += dayData.dk_nakit;
        total_dk_kart += dayData.dk_kart;
        total_dk += dayData.dk_total;
        total_palm_nakit += dayData.palm_nakit;
        total_palm_kart += dayData.palm_kart;
        total_palm += dayData.palm_total;
        grand_nakit += dayData.total_nakit;
        grand_kart += dayData.total_kart;
        grand_total += dayData.grand_total;
      }

      return res.json({
        success: true,
        period: 'haftalik',
        startDate: days[0].date,
        endDate: days[6].date,
        days,
        summary: {
          total_dk_nakit,
          total_dk_kart,
          total_dk,
          total_palm_nakit,
          total_palm_kart,
          total_palm,
          grand_nakit,
          grand_kart,
          grand_total
        }
      });
    }

    if (period === 'aylik') {
      const parts = targetDate.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10); // 1-12

      const daysInMonth = new Date(year, month, 0).getDate();
      const days = [];

      let total_dk_nakit = 0, total_dk_kart = 0, total_dk = 0;
      let total_palm_nakit = 0, total_palm_kart = 0, total_palm = 0;
      let grand_nakit = 0, grand_kart = 0, grand_total = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;

        const dayDate = new Date(year, month - 1, day);
        const dayIdx = dayDate.getDay();

        const dayData = getSalesForDate(dateStr);
        dayData.dayNumber = day;
        dayData.dayName = shortDayNames[dayIdx];
        dayData.isWeekend = dayIdx === 0 || dayIdx === 6;
        dayData.isTargetDate = dateStr === targetDate;
        days.push(dayData);

        total_dk_nakit += dayData.dk_nakit;
        total_dk_kart += dayData.dk_kart;
        total_dk += dayData.dk_total;
        total_palm_nakit += dayData.palm_nakit;
        total_palm_kart += dayData.palm_kart;
        total_palm += dayData.palm_total;
        grand_nakit += dayData.total_nakit;
        grand_kart += dayData.total_kart;
        grand_total += dayData.grand_total;
      }

      return res.json({
        success: true,
        period: 'aylik',
        year,
        month,
        daysInMonth,
        days,
        summary: {
          total_dk_nakit,
          total_dk_kart,
          total_dk,
          total_palm_nakit,
          total_palm_kart,
          total_palm,
          grand_nakit,
          grand_kart,
          grand_total
        }
      });
    }

    return res.status(400).json({ success: false, message: 'Geçersiz takip periyodu.' });
  } catch (err) {
    console.error('Sales tracking error:', err);
    return res.status(500).json({ success: false, message: 'Satış takip verileri alınırken hata oluştu.' });
  }
});

// Fast Daily Sales Entry (Hızlı Günlük Satış Girişi)
// Destekler:
// 1) { date, dk: { nakit, kart, description }, palm: { nakit, kart, description } }
// 2) { business_id: 'DK'|'PALM', date, nakit, kart, description }
// 3) { business_id: 'DK'|'PALM', date, items: [{ nakit, kart, description }] }
router.post(
  '/matrix',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'finance'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const { business_id, date, nakit, kart, dk, palm, items, description = 'Hızlı Günlük Satış' } = req.body;

      if (!date) {
        return res.status(400).json({ success: false, message: 'Tarih seçimi zorunludur.' });
      }

      const insertSale = db.prepare(`
        INSERT INTO sales (business_id, date, payment_type, amount, description, source, created_by)
        VALUES (?, ?, ?, ?, ?, 'MANUEL', ?)
      `);

      let totalInserted = 0;
      let totalAmount = 0;

      // 1. Dual Entry (DK ve Palm tek seferde)
      if (dk || palm) {
        if (dk) {
          const dkNakit = parseFloat(dk.nakit) || 0;
          const dkKart = parseFloat(dk.kart) || 0;
          const dkKomisyon = parseFloat(dk.komisyon ?? dk.commission_amount) || 0;
          const dkDesc = dk.description || 'DK Günlük Satış Hasılatı';
          if (dkNakit > 0) {
            insertSale.run('DK', date, 'NAKIT', dkNakit, dkDesc, req.user.id);
            totalInserted++;
            totalAmount += dkNakit;
          }
          if (dkKart > 0) {
            insertSale.run('DK', date, 'KART', dkKart, dkDesc, req.user.id);
            totalInserted++;
            totalAmount += dkKart;
          }
          if (dkKomisyon > 0 || dkKart > 0) {
            db.prepare(`
              INSERT INTO daily_card_settlements (business_id, date, commission_rate, rate_difference, commission_amount, notes, created_by, updated_at)
              VALUES ('DK', ?, 0, 0, ?, 'Hızlı Satış Komisyon Tutarı', ?, CURRENT_TIMESTAMP)
              ON CONFLICT(business_id, date) DO UPDATE SET
                commission_amount = excluded.commission_amount,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
            `).run(date, dkKomisyon, req.user.id);
          }
        }
        if (palm) {
          const palmNakit = parseFloat(palm.nakit) || 0;
          const palmKart = parseFloat(palm.kart) || 0;
          const palmKomisyon = parseFloat(palm.komisyon ?? palm.commission_amount) || 0;
          const palmDesc = palm.description || 'Palm Günlük Satış Hasılatı';
          if (palmNakit > 0) {
            insertSale.run('PALM', date, 'NAKIT', palmNakit, palmDesc, req.user.id);
            totalInserted++;
            totalAmount += palmNakit;
          }
          if (palmKart > 0) {
            insertSale.run('PALM', date, 'KART', palmKart, palmDesc, req.user.id);
            totalInserted++;
            totalAmount += palmKart;
          }
          if (palmKomisyon > 0 || palmKart > 0) {
            db.prepare(`
              INSERT INTO daily_card_settlements (business_id, date, commission_rate, rate_difference, commission_amount, notes, created_by, updated_at)
              VALUES ('PALM', ?, 0, 0, ?, 'Hızlı Satış Komisyon Tutarı', ?, CURRENT_TIMESTAMP)
              ON CONFLICT(business_id, date) DO UPDATE SET
                commission_amount = excluded.commission_amount,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
            `).run(date, palmKomisyon, req.user.id);
          }
        }
      } 
      // 2. Direct single business nakit/kart
      else if (business_id && (nakit !== undefined || kart !== undefined)) {
        const nakitVal = parseFloat(nakit) || 0;
        const kartVal = parseFloat(kart) || 0;
        if (nakitVal > 0) {
          insertSale.run(business_id, date, 'NAKIT', nakitVal, description, req.user.id);
          totalInserted++;
          totalAmount += nakitVal;
        }
        if (kartVal > 0) {
          insertSale.run(business_id, date, 'KART', kartVal, description, req.user.id);
          totalInserted++;
          totalAmount += kartVal;
        }
      }
      // 3. Array of items
      else if (business_id && Array.isArray(items)) {
        for (const item of items) {
          const nakitVal = parseFloat(item.nakit) || 0;
          const kartVal = parseFloat(item.kart) || 0;
          const itemDesc = item.description || description;
          if (nakitVal > 0) {
            insertSale.run(business_id, date, 'NAKIT', nakitVal, itemDesc, req.user.id);
            totalInserted++;
            totalAmount += nakitVal;
          }
          if (kartVal > 0) {
            insertSale.run(business_id, date, 'KART', kartVal, itemDesc, req.user.id);
            totalInserted++;
            totalAmount += kartVal;
          }
        }
      } else {
        return res.status(400).json({ success: false, message: 'Geçersiz satış girişi verisi.' });
      }

      if (totalInserted === 0) {
        return res.status(400).json({ success: false, message: 'Lütfen en az bir geçerli satış tutarı (nakit veya kart) giriniz.' });
      }

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'SALE_MATRIX_INPUT',
        entityType: 'SALES',
        entityId: business_id || 'DUAL',
        newValues: { business_id: business_id || 'DUAL', date, totalInserted, totalAmount },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: `${totalInserted} adet satış kalemi (Toplam: ${totalAmount.toLocaleString('tr-TR')} TL) başarıyla kaydedildi.`,
        totalInserted,
        totalAmount
      });
    } catch (err) {
      console.error('Sales matrix insert error:', err);
      return res.status(500).json({ success: false, message: 'Satışlar kaydedilirken hata oluştu.' });
    }
  }
);

// Add Single Sale (Tekil Satış Kaydı)
router.post(
  '/',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'finance'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const { business_id, date, payment_type, amount, description = '', source = 'MANUEL' } = req.body;

      if (!business_id || !date || !payment_type || !amount) {
        return res.status(400).json({ success: false, message: 'İşletme, tarih, ödeme tipi ve tutar zorunludur.' });
      }

      const stmt = db.prepare(`
        INSERT INTO sales (business_id, date, payment_type, amount, description, source, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(business_id, date, payment_type, parseFloat(amount), description, source, req.user.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'SALE_CREATE',
        entityType: 'SALES',
        entityId: result.lastInsertRowid,
        newValues: { business_id, date, payment_type, amount, description },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      return res.json({ success: true, message: 'Satış kaydı oluşturuldu.', id: result.lastInsertRowid });
    } catch (err) {
      console.error('Sale create error:', err);
      return res.status(500).json({ success: false, message: 'Satış oluşturulurken hata meydana geldi.' });
    }
  }
);

// Cancel / Soft Delete Sale
router.delete(
  '/:id',
  authenticateToken,
  requireRole('super_admin', 'business_admin'),
  (req, res, next) => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: 'Satış kaydı bulunamadı.' });
    req.targetSale = sale;
    checkClosedDate(() => sale.date)(req, res, next);
  },
  (req, res) => {
    try {
      const sale = req.targetSale;
      db.prepare('UPDATE sales SET is_cancelled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sale.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'SALE_CANCEL',
        entityType: 'SALES',
        entityId: sale.id,
        oldValues: sale,
        changeReason: req.changeReason || req.body.change_reason || 'İptal edildi',
        ipAddress: req.ip
      });

      return res.json({ success: true, message: 'Satış kaydı iptal edildi.' });
    } catch (err) {
      console.error('Sale delete error:', err);
      return res.status(500).json({ success: false, message: 'Satış iptal edilirken hata oluştu.' });
    }
  }
);

// Backward Compatibility Endpoint: Satış kategorileri kaldırıldığı için boş döner
router.get('/categories', authenticateToken, (req, res) => {
  return res.json({ success: true, categories: [] });
});

export default router;
