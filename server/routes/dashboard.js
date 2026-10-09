import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { resolveDateRange } from '../utils/dates.js';
import { getFinancialSummary } from '../utils/finance.js';

const router = express.Router();

router.get('/stats', authenticateToken, (req, res) => {
  try {
    const { period = 'bugun', startDate: qStart, endDate: qEnd } = req.query;
    const { startDate, endDate, label } = resolveDateRange(period, qStart, qEnd);

    // 1. Core Financial Summary
    const summary = getFinancialSummary(startDate, endDate);

    // 2. Personnel Summary (for the anchor date / endDate)
    const activeDate = endDate;
    const todayAttendance = db.prepare(`
      SELECT 
        a.*,
        e.name as employee_name,
        e.role as employee_role,
        s.name as shift_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE a.date = ?
    `).all(activeDate);

    const workingCount = todayAttendance.filter(a => a.status === 'CALISTI' || a.status === 'YARIM_GUN').length;
    const morningCount = todayAttendance.filter(a => (a.status === 'CALISTI' || a.status === 'YARIM_GUN') && a.shift_id === 1).length;
    const eveningCount = todayAttendance.filter(a => (a.status === 'CALISTI' || a.status === 'YARIM_GUN') && a.shift_id === 2).length;
    
    const todayAccrualSum = todayAttendance.reduce((acc, curr) => acc + (curr.accrual_amount || 0), 0);

    // Total outstanding unpaid employee debt (cumulative across all active employees)
    const totalAccruedAllTime = db.prepare(`
      SELECT COALESCE(SUM(accrual_amount), 0) as s FROM attendance
    `).get().s;

    const totalPaidAllTime = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s FROM employee_payments WHERE is_cancelled = 0
    `).get().s;

    const totalUnpaidEmployeeDebt = Math.max(0, totalAccruedAllTime - totalPaidAllTime);

    // 3. Sales Breakdown by Business & Payment Type for period
    const salesBreakdown = db.prepare(`
      SELECT 
        s.business_id,
        s.payment_type,
        SUM(s.amount) as total_amount
      FROM sales s
      WHERE s.date >= ? AND s.date <= ? AND s.is_cancelled = 0
      GROUP BY s.business_id, s.payment_type
    `).all(startDate, endDate);

    const satisDagilimi = {
      dk: { nakit: 0, kart: 0, total: 0 },
      palm: { nakit: 0, kart: 0, total: 0 },
      ortak: { nakit: 0, kart: 0, total: 0 }
    };

    for (const row of salesBreakdown) {
      if (row.business_id === 'DK') {
        if (row.payment_type === 'NAKIT') satisDagilimi.dk.nakit += row.total_amount;
        if (row.payment_type === 'KART') satisDagilimi.dk.kart += row.total_amount;
        satisDagilimi.dk.total += row.total_amount;
      } else if (row.business_id === 'PALM') {
        if (row.payment_type === 'NAKIT') satisDagilimi.palm.nakit += row.total_amount;
        if (row.payment_type === 'KART') satisDagilimi.palm.kart += row.total_amount;
        satisDagilimi.palm.total += row.total_amount;
      }
    }
    satisDagilimi.ortak.nakit = satisDagilimi.dk.nakit + satisDagilimi.palm.nakit;
    satisDagilimi.ortak.kart = satisDagilimi.dk.kart + satisDagilimi.palm.kart;
    satisDagilimi.ortak.total = satisDagilimi.dk.total + satisDagilimi.palm.total;

    // 4. Daily Closing status for activeDate
    const closingRecord = db.prepare(`
      SELECT * FROM daily_closings WHERE date = ?
    `).get(activeDate);

    // 5. Recent 8 activities / transactions
    const recentActivities = db.prepare(`
      SELECT 'SATIŞ' as tip, s.business_id, s.amount, s.date, s.created_at, COALESCE(NULLIF(s.description, ''), s.payment_type || ' Satış') as detail, s.payment_type as sub
      FROM sales s
      WHERE s.is_cancelled = 0
      UNION ALL
      SELECT 'GİDER' as tip, e.business_id, e.amount, e.date, e.created_at, ec.name as detail, e.payment_source as sub
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.is_cancelled = 0
      ORDER BY created_at DESC
      LIMIT 8
    `).all();

    return res.json({
      success: true,
      data: {
        filter: { period, startDate, endDate, label },
        finansOzeti: summary.finansOzeti,
        gunlukOzet: summary.gunlukOzet,
        personelOzeti: {
          bugunkuCalisanSayisi: workingCount,
          sabahVardiyasi: morningCount,
          aksamVardiyasi: eveningCount,
          bugunkuPersonelHakedisi: todayAccrualSum,
          odenmemisPersonelBorcu: totalUnpaidEmployeeDebt
        },
        satisDagilimi,
        kategoriDagilimi: [],
        kapanisDurumu: {
          isClosed: !!(closingRecord && closingRecord.is_closed === 1),
          closedAt: closingRecord ? closingRecord.closed_at : null,
          closedBy: closingRecord ? closingRecord.closed_by : null
        },
        sonHareketler: recentActivities
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ success: false, message: 'İstatistikler hesaplanırken hata oluştu.' });
  }
});

export default router;
