import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAudit } from '../middleware/audit.js';
import { getFinancialSummary } from '../utils/finance.js';

const router = express.Router();

// Get status and closing summary for a specific day
router.get('/status', authenticateToken, (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    const closing = db.prepare(`
      SELECT c.*, u.full_name as closed_by_name
      FROM daily_closings c
      LEFT JOIN users u ON c.closed_by = u.id
      WHERE c.date = ?
    `).get(targetDate);

    // Always fetch fresh summary for comparison
    const summary = getFinancialSummary(targetDate, targetDate);

    return res.json({
      success: true,
      date: targetDate,
      isClosed: !!(closing && closing.is_closed === 1),
      closingRecord: closing || null,
      summary
    });
  } catch (err) {
    console.error('Closing status error:', err);
    return res.status(500).json({ success: false, message: 'Kapanış durumu sorgulanamadı.' });
  }
});

// Close Day (GÜNÜ KAPAT)
router.post('/close', authenticateToken, requireRole('super_admin', 'business_admin', 'finance'), (req, res) => {
  try {
    const { date, notes = '' } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'Kapanış tarihi belirtilmelidir.' });

    // Snapshot current state
    const summary = getFinancialSummary(date, date);
    const snapshotJson = JSON.stringify(summary);

    const stmt = db.prepare(`
      INSERT INTO daily_closings (date, is_closed, closed_at, closed_by, snapshot_json, notes)
      VALUES (?, 1, CURRENT_TIMESTAMP, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        is_closed = 1,
        closed_at = CURRENT_TIMESTAMP,
        closed_by = excluded.closed_by,
        snapshot_json = excluded.snapshot_json,
        notes = excluded.notes
    `);

    stmt.run(date, req.user.id, snapshotJson, notes);

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'DAY_CLOSE',
      entityType: 'DAILY_CLOSING',
      entityId: date,
      newValues: { date, summary: summary.finansOzeti, notes },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `${date} tarihi başarıyla KAPATILDI 🔒`,
      summary
    });
  } catch (err) {
    console.error('Day close error:', err);
    return res.status(500).json({ success: false, message: 'Gün kapatılırken hata oluştu: ' + err.message });
  }
});

// Reopen / Unlock Day (Admin only)
router.post('/reopen', authenticateToken, requireRole('super_admin', 'business_admin'), (req, res) => {
  try {
    const { date, change_reason } = req.body;
    if (!date || !change_reason || change_reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Kapanışı açmak için geçerli bir değişiklik gerekçesi girmelisiniz.' });
    }

    const existing = db.prepare('SELECT * FROM daily_closings WHERE date = ?').get(date);
    if (!existing || existing.is_closed === 0) {
      return res.status(400).json({ success: false, message: 'Bu tarih zaten açık.' });
    }

    db.prepare('UPDATE daily_closings SET is_closed = 0 WHERE date = ?').run(date);

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'DAY_REOPEN',
      entityType: 'DAILY_CLOSING',
      entityId: date,
      oldValues: existing,
      changeReason: change_reason.trim(),
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `${date} tarihi düzenlemeler için yeniden açıldı.`
    });
  } catch (err) {
    console.error('Day reopen error:', err);
    return res.status(500).json({ success: false, message: 'Gün açılırken hata oluştu.' });
  }
});

export default router;
