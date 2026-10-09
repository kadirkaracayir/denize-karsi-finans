import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAudit } from '../middleware/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Reset demo data (Clean)
router.post('/demo/reset', authenticateToken, requireRole('super_admin'), (req, res) => {
  try {
    seedDatabase(true); // force clean & re-initialize schema with empty tables
    // Keep only the super_admin
    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'DEMO_DATA_RESET',
      entityType: 'SYSTEM',
      entityId: 'DATABASE',
      newValues: { message: 'Demo verileri sıfırlandı ve temizlendi.' },
      changeReason: req.body.reason || 'Kullanıcı talebiyle demo verileri temizlendi.',
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Demo verileri başarıyla temizlendi.' });
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ success: false, message: 'Sıfırlama sırasında hata oluştu: ' + err.message });
  }
});

// Re-seed demo data
router.post('/demo/seed', authenticateToken, requireRole('super_admin'), (req, res) => {
  try {
    seedDatabase(true); // seeds 15 days of rich data
    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'DEMO_DATA_SEED',
      entityType: 'SYSTEM',
      entityId: 'DATABASE',
      newValues: { message: 'Demo verileri yeniden yüklendi.' },
      changeReason: req.body.reason || 'Demo veri seti yeniden oluşturuldu.',
      ipAddress: req.ip
    });

    return res.json({ success: true, message: '15 günlük gerçekçi demo veri seti başarıyla yeniden oluşturuldu.' });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ success: false, message: 'Veri yükleme sırasında hata oluştu: ' + err.message });
  }
});

// Download SQLite Database Backup File
router.get('/backup/download', authenticateToken, requireRole('super_admin'), (req, res) => {
  try {
    const dbPath = path.resolve(__dirname, '../../data/denize_karsi.db');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ success: false, message: 'Veritabanı dosyası bulunamadı.' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `denize_karsi_backup_${timestamp}.db`;

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'DATABASE_BACKUP_DOWNLOAD',
      entityType: 'BACKUP',
      entityId: filename,
      ipAddress: req.ip
    });

    res.download(dbPath, filename);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Yedek dosyası indirilemedi.' });
  }
});

// Get System Info & Stats
router.get('/info', authenticateToken, (req, res) => {
  const tableCounts = {
    sales: db.prepare('SELECT COUNT(*) as c FROM sales').get().c,
    expenses: db.prepare('SELECT COUNT(*) as c FROM expenses').get().c,
    employees: db.prepare('SELECT COUNT(*) as c FROM employees').get().c,
    attendance: db.prepare('SELECT COUNT(*) as c FROM attendance').get().c,
    payments: db.prepare('SELECT COUNT(*) as c FROM employee_payments').get().c,
    auditLogs: db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c,
    dailyClosings: db.prepare('SELECT COUNT(*) as c FROM daily_closings').get().c
  };

  return res.json({
    success: true,
    version: '1.0.0-production-ready',
    environment: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString(),
    tableCounts
  });
});

// Get Credit Card Commission Rates
router.get('/rates', authenticateToken, (req, res) => {
  try {
    const getSetting = db.prepare('SELECT value FROM system_settings WHERE key = ?');
    const generalRateRow = getSetting.get('card_commission_rate');
    const dkRateRow = getSetting.get('dk_card_commission_rate');
    const palmRateRow = getSetting.get('palm_card_commission_rate');

    const generalRate = generalRateRow ? parseFloat(generalRateRow.value) : 2.5;
    const dkRate = dkRateRow ? parseFloat(dkRateRow.value) : generalRate;
    const palmRate = palmRateRow ? parseFloat(palmRateRow.value) : generalRate;

    return res.json({
      success: true,
      generalRate,
      dkRate,
      palmRate
    });
  } catch (err) {
    console.error('Get rates error:', err);
    return res.status(500).json({ success: false, message: 'Komisyon oranları alınamadı.' });
  }
});

// Update Credit Card Commission Rates
router.put('/rates', authenticateToken, requireRole('super_admin', 'business_admin', 'finance'), (req, res) => {
  try {
    const { generalRate, dkRate, palmRate } = req.body;

    const upsertSetting = db.prepare(`
      INSERT INTO system_settings (key, value, description, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    if (generalRate !== undefined && !isNaN(parseFloat(generalRate))) {
      upsertSetting.run('card_commission_rate', String(parseFloat(generalRate)), 'Genel Kredi Kartı Komisyon Oranı (%)');
    }
    if (dkRate !== undefined && !isNaN(parseFloat(dkRate))) {
      upsertSetting.run('dk_card_commission_rate', String(parseFloat(dkRate)), 'DK POS Komisyon Oranı (%)');
    }
    if (palmRate !== undefined && !isNaN(parseFloat(palmRate))) {
      upsertSetting.run('palm_card_commission_rate', String(parseFloat(palmRate)), 'Palm POS Komisyon Oranı (%)');
    }

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'COMMISSION_RATES_UPDATE',
      entityType: 'SETTINGS',
      entityId: 'CARD_RATES',
      newValues: { generalRate, dkRate, palmRate },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Kredi kartı komisyon oranları başarıyla güncellendi.'
    });
  } catch (err) {
    console.error('Update rates error:', err);
    return res.status(500).json({ success: false, message: 'Komisyon oranları kaydedilemedi: ' + err.message });
  }
});

export default router;
