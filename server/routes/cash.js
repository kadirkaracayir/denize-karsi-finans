import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkClosedDate, requireRole } from '../middleware/rbac.js';
import { logAudit } from '../middleware/audit.js';
import { getFinancialSummary } from '../utils/finance.js';

const router = express.Router();

// Cash & Card Summary
router.get('/summary', authenticateToken, (req, res) => {
  try {
    const today = req.query.date || new Date().toISOString().split('T')[0];
    const summary = getFinancialSummary(today, today);
    return res.json({ success: true, summary: summary.finansOzeti });
  } catch (err) {
    console.error('Cash summary error:', err);
    return res.status(500).json({ success: false, message: 'Kasa özeti alınamadı.' });
  }
});

// POS Card Settlement: Manuel Komisyon Oranı ve Gün Sonu Oran Farkı Yönetimi
router.get('/pos-settlement', authenticateToken, (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const summary = getFinancialSummary(targetDate, targetDate);

    const history = db.prepare(`
      SELECT s.*, u.full_name as created_by_name
      FROM daily_card_settlements s
      LEFT JOIN users u ON s.created_by = u.id
      ORDER BY s.date DESC, s.business_id ASC
      LIMIT 60
    `).all();

    return res.json({
      success: true,
      targetDate,
      settlement: {
        dk: summary.finansOzeti.dkKart,
        palm: summary.finansOzeti.palmKart,
        ortak: summary.finansOzeti.ortakKart
      },
      tekNakitKasa: summary.finansOzeti.tekNakitKasa,
      history
    });
  } catch (err) {
    console.error('POS settlement fetch error:', err);
    return res.status(500).json({ success: false, message: 'POS mutabakat verileri alınamadı.' });
  }
});

// Save or Update POS Settlement (Manuel Komisyon Oranı & Gün Sonu Oran/Komisyon Farkı)
router.post(
  '/pos-settlement',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'finance'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const { business_id, date, commission_rate = 2.5, rate_difference = 0, notes = '' } = req.body;

      if (!business_id || !date) {
        return res.status(400).json({ success: false, message: 'İşletme ve tarih alanları zorunludur.' });
      }

      const existing = db.prepare('SELECT * FROM daily_card_settlements WHERE business_id = ? AND date = ?').get(business_id, date);

      const stmt = db.prepare(`
        INSERT INTO daily_card_settlements 
        (business_id, date, commission_rate, rate_difference, notes, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(business_id, date) DO UPDATE SET
          commission_rate = excluded.commission_rate,
          rate_difference = excluded.rate_difference,
          notes = excluded.notes,
          created_by = excluded.created_by,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(business_id, date, parseFloat(commission_rate) || 0, parseFloat(rate_difference) || 0, notes, req.user.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: existing ? 'POS_SETTLEMENT_UPDATE' : 'POS_SETTLEMENT_CREATE',
        entityType: 'POS_SETTLEMENT',
        entityId: `${business_id}_${date}`,
        oldValues: existing,
        newValues: { business_id, date, commission_rate, rate_difference, notes },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      // Recalculate summary with new rates
      const summary = getFinancialSummary(date, date);

      return res.json({
        success: true,
        message: `${business_id} kredi kartı komisyon oranı (%${commission_rate}) ve oran farkı (${rate_difference} TL) başarıyla kaydedildi.`,
        settlement: summary.finansOzeti
      });
    } catch (err) {
      console.error('POS settlement save error:', err);
      return res.status(500).json({ success: false, message: 'POS ayarları kaydedilemedi: ' + err.message });
    }
  }
);

// Bank Balances (manual entry and comparison vs yesterday)
router.get('/bank-balances', authenticateToken, (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    // DK
    const dkCurrent = db.prepare('SELECT * FROM bank_balances WHERE business_id = ? AND date = ?').get('DK', targetDate);
    const dkPrevious = db.prepare('SELECT * FROM bank_balances WHERE business_id = ? AND date < ? ORDER BY date DESC LIMIT 1').get('DK', targetDate);

    // Palm
    const palmCurrent = db.prepare('SELECT * FROM bank_balances WHERE business_id = ? AND date = ?').get('PALM', targetDate);
    const palmPrevious = db.prepare('SELECT * FROM bank_balances WHERE business_id = ? AND date < ? ORDER BY date DESC LIMIT 1').get('PALM', targetDate);

    const dkBal = dkCurrent ? dkCurrent.balance : (dkPrevious ? dkPrevious.balance : 0);
    const dkPrevBal = dkPrevious ? dkPrevious.balance : dkBal;
    const dkDiff = dkBal - dkPrevBal;

    const palmBal = palmCurrent ? palmCurrent.balance : (palmPrevious ? palmPrevious.balance : 0);
    const palmPrevBal = palmPrevious ? palmPrevious.balance : palmBal;
    const palmDiff = palmBal - palmPrevBal;

    const ortakBal = dkBal + palmBal;
    const ortakPrevBal = dkPrevBal + palmPrevBal;
    const ortakDiff = ortakBal - ortakPrevBal;

    // History of past 30 days bank balances
    const history = db.prepare(`
      SELECT b.*, u.full_name as created_by_name
      FROM bank_balances b
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.date DESC, b.business_id ASC
      LIMIT 60
    `).all();

    return res.json({
      success: true,
      targetDate,
      bank: {
        dk: {
          current: dkBal,
          previous: dkPrevBal,
          change: dkDiff,
          hasEnteredToday: !!dkCurrent,
          notes: dkCurrent?.notes || ''
        },
        palm: {
          current: palmBal,
          previous: palmPrevBal,
          change: palmDiff,
          hasEnteredToday: !!palmCurrent,
          notes: palmCurrent?.notes || ''
        },
        ortak: {
          current: ortakBal,
          previous: ortakPrevBal,
          change: ortakDiff
        }
      },
      history
    });
  } catch (err) {
    console.error('Bank balance error:', err);
    return res.status(500).json({ success: false, message: 'Banka bakiyeleri yüklenemedi.' });
  }
});

// Update or Enter Daily Bank Balance
router.post(
  '/bank-balances',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'finance'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const { business_id, date, balance, notes = '' } = req.body;

      if (!business_id || !date || balance === undefined || balance === null) {
        return res.status(400).json({ success: false, message: 'İşletme, tarih ve bakiye zorunludur.' });
      }

      const existing = db.prepare('SELECT * FROM bank_balances WHERE business_id = ? AND date = ?').get(business_id, date);

      const stmt = db.prepare(`
        INSERT INTO bank_balances (business_id, date, balance, notes, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(business_id, date) DO UPDATE SET
          balance = excluded.balance,
          notes = excluded.notes,
          created_by = excluded.created_by,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(business_id, date, parseFloat(balance), notes, req.user.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: existing ? 'BANK_BALANCE_UPDATE' : 'BANK_BALANCE_CREATE',
        entityType: 'BANK',
        entityId: `${business_id}_${date}`,
        oldValues: existing,
        newValues: { business_id, date, balance, notes },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      return res.json({ success: true, message: `${business_id} gerçek banka bakiyesi başarıyla kaydedildi.` });
    } catch (err) {
      console.error('Save bank balance error:', err);
      return res.status(500).json({ success: false, message: 'Banka bakiyesi kaydedilemedi.' });
    }
  }
);

// Cash Movements: Para Girişi, Para Çıkışı, Transferler
router.get('/transactions', authenticateToken, (req, res) => {
  try {
    const { type, business_id, startDate, endDate, limit = 100 } = req.query;

    let query = `
      SELECT t.*, u.full_name as creator_name
      FROM cash_transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.is_cancelled = 0
    `;
    const params = [];

    if (type) {
      query += ` AND t.type = ?`;
      params.push(type);
    }
    if (business_id && business_id !== 'ALL') {
      // Merkezi Kasa (ORTAK) nakit hareketleri her iki işletme için de ortaktır
      query += ` AND (t.business_id = ? OR t.business_id = 'ORTAK')`;
      params.push(business_id);
    }
    if (startDate) {
      query += ` AND t.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND t.date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY t.date DESC, t.id DESC LIMIT ?`;
    params.push(Number(limit));

    const transactions = db.prepare(query).all(...params);
    return res.json({ success: true, transactions });
  } catch (err) {
    console.error('Cash transactions error:', err);
    return res.status(500).json({ success: false, message: 'Para hareketleri yüklenemedi.' });
  }
});

// Create Para Girişi / Para Çıkışı / Transfer
router.post(
  '/transactions',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'finance'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      let {
        type, // 'IN' | 'OUT' | 'TRANSFER'
        business_id = 'ORTAK', // 'DK' | 'PALM' | 'ORTAK'
        date,
        sub_type, // 'Sermaye', 'Tahsilat', 'İşletme Sahibi Çekimi', 'Transfer', etc.
        amount,
        source_account = 'KASA',
        target_account = null,
        description = ''
      } = req.body;

      // Kural 5: Nakit kasa girişlerinde ve çıkışlarında Palm ve DK ayrı ayrı değil tek kasadan takip ediliyor
      if (source_account === 'KASA' && (type === 'IN' || type === 'OUT')) {
        business_id = 'ORTAK';
      }

      if (!type || !date || !amount || !sub_type) {
        return res.status(400).json({ success: false, message: 'Zorunlu alanları doldurunuz.' });
      }

      if (type === 'TRANSFER' && !target_account) {
        return res.status(400).json({ success: false, message: 'Transfer için hedef hesap seçilmelidir.' });
      }

      const stmt = db.prepare(`
        INSERT INTO cash_transactions 
        (business_id, date, type, sub_type, amount, source_account, target_account, description, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        business_id || 'ORTAK',
        date,
        type,
        sub_type,
        parseFloat(amount),
        source_account,
        target_account,
        description,
        req.user.id
      );

      const actionName = type === 'IN' ? 'CASH_IN' : (type === 'OUT' ? 'CASH_OUT' : 'CASH_TRANSFER');

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: actionName,
        entityType: 'CASH_TX',
        entityId: result.lastInsertRowid,
        newValues: { type, business_id, date, sub_type, amount, source_account, target_account },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: 'Para hareketi başarıyla kaydedildi.',
        id: result.lastInsertRowid
      });
    } catch (err) {
      console.error('Create cash tx error:', err);
      return res.status(500).json({ success: false, message: 'Para hareketi kaydedilemedi.' });
    }
  }
);

// Cancel Cash Transaction
router.delete(
  '/transactions/:id',
  authenticateToken,
  requireRole('super_admin', 'business_admin'),
  (req, res, next) => {
    const tx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    req.targetTx = tx;
    checkClosedDate(() => tx.date)(req, res, next);
  },
  (req, res) => {
    try {
      db.prepare('UPDATE cash_transactions SET is_cancelled = 1 WHERE id = ?').run(req.params.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'CASH_TX_CANCEL',
        entityType: 'CASH_TX',
        entityId: req.params.id,
        oldValues: req.targetTx,
        changeReason: req.changeReason || req.body.change_reason || 'İptal edildi',
        ipAddress: req.ip
      });

      return res.json({ success: true, message: 'Para hareketi iptal edildi.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'İptal edilirken hata oluştu.' });
    }
  }
);

export default router;
