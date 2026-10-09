import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = express.Router();

router.get('/', authenticateToken, requireRole('super_admin', 'business_admin'), (req, res) => {
  try {
    const { action, entityType, userId, search, limit = 100 } = req.query;

    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];

    if (action) {
      query += ` AND action = ?`;
      params.push(action);
    }
    if (entityType) {
      query += ` AND entity_type = ?`;
      params.push(entityType);
    }
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    if (search) {
      query += ` AND (action LIKE ? OR user_name LIKE ? OR change_reason LIKE ? OR new_values LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(Number(limit));

    const logs = db.prepare(query).all(...params);
    return res.json({ success: true, logs });
  } catch (err) {
    console.error('Audit fetch error:', err);
    return res.status(500).json({ success: false, message: 'İşlem geçmişi yüklenemedi.' });
  }
});

export default router;
