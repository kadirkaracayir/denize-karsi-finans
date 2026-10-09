import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkClosedDate, requireRole } from '../middleware/rbac.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// List Expenses
router.get('/', authenticateToken, (req, res) => {
  try {
    const { business_id, startDate, endDate, category_id, payment_source, limit = 100 } = req.query;

    let query = `
      SELECT 
        e.*,
        c.name as category_name,
        u.full_name as creator_name
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.is_cancelled = 0
    `;
    const params = [];

    if (business_id && business_id !== 'ALL') {
      query += ` AND e.business_id = ?`;
      params.push(business_id);
    }
    if (startDate) {
      query += ` AND e.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND e.date <= ?`;
      params.push(endDate);
    }
    if (category_id) {
      query += ` AND e.category_id = ?`;
      params.push(category_id);
    }
    if (payment_source) {
      query += ` AND e.payment_source = ?`;
      params.push(payment_source);
    }

    query += ` ORDER BY e.date DESC, e.id DESC LIMIT ?`;
    params.push(Number(limit));

    const expenses = db.prepare(query).all(...params);
    return res.json({ success: true, expenses });
  } catch (err) {
    console.error('Expenses fetch error:', err);
    return res.status(500).json({ success: false, message: 'Giderler listelenemedi.' });
  }
});

// Create Expense
router.post(
  '/',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'finance'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const {
        business_id, // 'DK', 'PALM', 'ORTAK'
        date,
        category_id,
        amount,
        payment_source, // 'DK_KASA', 'PALM_KASA', 'DK_BANKA', 'PALM_BANKA'
        description = ''
      } = req.body;

      if (!business_id || !date || !category_id || !amount || !payment_source) {
        return res.status(400).json({ success: false, message: 'Tüm zorunlu alanları doldurunuz.' });
      }

      const stmt = db.prepare(`
        INSERT INTO expenses (business_id, date, category_id, amount, payment_source, description, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const r = stmt.run(business_id, date, category_id, parseFloat(amount), payment_source, description, req.user.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'EXPENSE_CREATE',
        entityType: 'EXPENSE',
        entityId: r.lastInsertRowid,
        newValues: { business_id, date, category_id, amount, payment_source, description },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      return res.json({ success: true, message: 'Gider kaydı başarıyla oluşturuldu.', id: r.lastInsertRowid });
    } catch (err) {
      console.error('Create expense error:', err);
      return res.status(500).json({ success: false, message: 'Gider oluşturulurken hata meydana geldi.' });
    }
  }
);

// Cancel Expense
router.delete(
  '/:id',
  authenticateToken,
  requireRole('super_admin', 'business_admin'),
  (req, res, next) => {
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Gider kaydı bulunamadı.' });
    req.targetExpense = expense;
    checkClosedDate(() => expense.date)(req, res, next);
  },
  (req, res) => {
    try {
      db.prepare('UPDATE expenses SET is_cancelled = 1 WHERE id = ?').run(req.params.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'EXPENSE_CANCEL',
        entityType: 'EXPENSE',
        entityId: req.params.id,
        oldValues: req.targetExpense,
        changeReason: req.changeReason || req.body.change_reason || 'İptal edildi',
        ipAddress: req.ip
      });

      return res.json({ success: true, message: 'Gider iptal edildi.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Gider iptal edilemedi.' });
    }
  }
);

// Expense Categories
router.get('/categories', authenticateToken, (req, res) => {
  const categories = db.prepare('SELECT * FROM expense_categories ORDER BY sort_order ASC, name ASC').all();
  return res.json({ success: true, categories });
});

router.post('/categories', authenticateToken, requireRole('super_admin', 'business_admin'), (req, res) => {
  try {
    const { name, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Kategori adı zorunludur.' });

    const r = db.prepare('INSERT INTO expense_categories (name, sort_order, is_active) VALUES (?, ?, 1)')
      .run(name.trim(), Number(sort_order));

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'EXPENSE_CATEGORY_CREATE',
      entityType: 'EXPENSE_CATEGORY',
      entityId: r.lastInsertRowid,
      newValues: { name },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Gider kategorisi eklendi.', id: r.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gider kategorisi eklenemedi.' });
  }
});

export default router;
