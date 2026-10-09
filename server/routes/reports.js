import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { getFinancialSummary } from '../utils/finance.js';

const router = express.Router();

// Helper: Personel Hakediş, Toplam Saat, Avans ve Ödeme Raporu
function getPersonnelReport(startDate, endDate) {
  const employees = db.prepare(`
    SELECT id, name, role, business_id, hourly_rate, daily_rate, accrual_type
    FROM employees
    WHERE is_active = 1
    ORDER BY name ASC
  `).all();

  const attSummaryStmt = db.prepare(`
    SELECT 
      COALESCE(SUM(hours_worked), 0) as total_hours,
      COALESCE(SUM(accrual_amount), 0) as total_accrual,
      COUNT(DISTINCT CASE WHEN status IN ('CALISTI', 'YARIM_GUN') THEN date END) as days_worked
    FROM attendance
    WHERE employee_id = ? AND date >= ? AND date <= ?
  `);

  const advanceStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_advance
    FROM employee_payments
    WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
      AND (period_info LIKE '%Avans%' OR description LIKE '%Avans%' OR description LIKE '%avans%')
  `);

  const paymentStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM employee_payments
    WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
  `);

  const cumulativeDebtStmt = db.prepare(`
    SELECT 
      COALESCE((SELECT SUM(accrual_amount) FROM attendance WHERE employee_id = ?), 0) as total_accrued,
      COALESCE((SELECT SUM(amount) FROM employee_payments WHERE employee_id = ? AND is_cancelled = 0), 0) as total_paid
  `);

  let grandHours = 0;
  let grandAccrual = 0;
  let grandAdvance = 0;
  let grandPaid = 0;
  let grandBalance = 0;

  const list = employees.map(emp => {
    const att = attSummaryStmt.get(emp.id, startDate, endDate);
    const adv = advanceStmt.get(emp.id, startDate, endDate).total_advance;
    const pay = paymentStmt.get(emp.id, startDate, endDate).total_paid;
    const cum = cumulativeDebtStmt.get(emp.id, emp.id);
    const balance = Math.max(0, cum.total_accrued - cum.total_paid);

    grandHours += att.total_hours;
    grandAccrual += att.total_accrual;
    grandAdvance += adv;
    grandPaid += pay;
    grandBalance += balance;

    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      hourly_rate: emp.hourly_rate,
      daily_rate: emp.daily_rate,
      accrual_type: emp.accrual_type,
      total_hours: Math.round(att.total_hours * 100) / 100,
      days_worked: att.days_worked,
      total_accrual: att.total_accrual,
      total_advance: adv,
      total_paid: pay,
      net_period_balance: Math.max(0, att.total_accrual - pay),
      current_balance: balance
    };
  });

  return {
    employees: list,
    totals: {
      total_hours: Math.round(grandHours * 100) / 100,
      total_accrual: grandAccrual,
      total_advance: grandAdvance,
      total_paid: grandPaid,
      total_balance: grandBalance
    }
  };
}

// Helper: Giderler Raporu (Kategori, Kaynak ve İşletme Bazlı)
function getExpensesReport(startDate, endDate) {
  const byCategory = db.prepare(`
    SELECT 
      ec.name as category_name,
      COALESCE(SUM(e.amount), 0) as total_amount,
      COUNT(e.id) as count
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.date >= ? AND e.date <= ? AND e.is_cancelled = 0
    GROUP BY ec.name
    ORDER BY total_amount DESC
  `).all(startDate, endDate);

  const bySource = db.prepare(`
    SELECT 
      payment_source,
      COALESCE(SUM(amount), 0) as total_amount
    FROM expenses
    WHERE date >= ? AND date <= ? AND is_cancelled = 0
    GROUP BY payment_source
  `).all(startDate, endDate);

  const byBusiness = db.prepare(`
    SELECT 
      business_id,
      COALESCE(SUM(amount), 0) as total_amount
    FROM expenses
    WHERE date >= ? AND date <= ? AND is_cancelled = 0
    GROUP BY business_id
  `).all(startDate, endDate);

  const totalExpense = byCategory.reduce((acc, c) => acc + c.total_amount, 0);

  return {
    byCategory,
    bySource,
    byBusiness,
    totalExpense
  };
}

// 1. Günlük Rapor
router.get('/daily', authenticateToken, (req, res) => {
  try {
    const targetDate = req.query.date || '2026-10-08';
    const summary = getFinancialSummary(targetDate, targetDate);

    // Günlük Satış Kırılımı (İşletme ve Ödeme Tipi Bazında)
    const salesBreakdown = db.prepare(`
      SELECT 
        s.business_id,
        s.payment_type,
        SUM(s.amount) as total,
        COUNT(*) as count
      FROM sales s
      WHERE s.date = ? AND s.is_cancelled = 0
      GROUP BY s.business_id, s.payment_type
    `).all(targetDate);

    // Günlük Puantaj Sayıları
    const attendance = db.prepare(`
      SELECT 
        business_id,
        status,
        COUNT(*) as count,
        SUM(accrual_amount) as total_accrual
      FROM attendance
      WHERE date = ?
      GROUP BY business_id, status
    `).all(targetDate);

    const personnelReport = getPersonnelReport(targetDate, targetDate);
    const expensesReport = getExpensesReport(targetDate, targetDate);

    return res.json({
      success: true,
      date: targetDate,
      summary,
      salesBreakdown,
      categories: [],
      attendance,
      personnelReport,
      expensesReport
    });
  } catch (err) {
    console.error('Daily report error:', err);
    return res.status(500).json({ success: false, message: 'Günlük rapor oluşturulamadı.' });
  }
});

// 2. Haftalık Rapor
router.get('/weekly', authenticateToken, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Başlangıç ve bitiş tarihi gereklidir.' });
    }

    const summary = getFinancialSummary(startDate, endDate);

    // Haftalık Günlük Dağılım
    const dailyBreakdown = db.prepare(`
      SELECT 
        s.date,
        s.business_id,
        SUM(CASE WHEN s.payment_type = 'NAKIT' THEN s.amount ELSE 0 END) as nakit,
        SUM(CASE WHEN s.payment_type = 'KART' THEN s.amount ELSE 0 END) as kart,
        SUM(s.amount) as total
      FROM sales s
      WHERE s.date >= ? AND s.date <= ? AND s.is_cancelled = 0
      GROUP BY s.date, s.business_id
      ORDER BY s.date ASC
    `).all(startDate, endDate);

    // Haftalık İşletme ve Ödeme Tipi Kırılımı
    const salesByBusinessAndType = db.prepare(`
      SELECT 
        s.business_id,
        s.payment_type,
        SUM(s.amount) as total
      FROM sales s
      WHERE s.date >= ? AND s.date <= ? AND s.is_cancelled = 0
      GROUP BY s.business_id, s.payment_type
    `).all(startDate, endDate);

    const personnelReport = getPersonnelReport(startDate, endDate);
    const expensesReport = getExpensesReport(startDate, endDate);

    return res.json({
      success: true,
      startDate,
      endDate,
      summary,
      dailyBreakdown,
      salesByBusinessAndType,
      categories: [],
      personnelReport,
      expensesReport
    });
  } catch (err) {
    console.error('Weekly report error:', err);
    return res.status(500).json({ success: false, message: 'Haftalık rapor oluşturulamadı.' });
  }
});

// 3. Aylık Rapor
router.get('/monthly', authenticateToken, (req, res) => {
  try {
    const year = req.query.year || '2026';
    const month = String(req.query.month || '10').padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const summary = getFinancialSummary(startDate, endDate);

    // Aylık Günlük Satış Trendi
    const dailySales = db.prepare(`
      SELECT 
        date,
        SUM(CASE WHEN business_id = 'DK' THEN amount ELSE 0 END) as dk_total,
        SUM(CASE WHEN business_id = 'PALM' THEN amount ELSE 0 END) as palm_total,
        SUM(amount) as total
      FROM sales
      WHERE date >= ? AND date <= ? AND is_cancelled = 0
      GROUP BY date
      ORDER BY date ASC
    `).all(startDate, endDate);

    // Aylık İşletme ve Ödeme Kırılımı
    const salesByBusinessAndType = db.prepare(`
      SELECT 
        s.business_id,
        s.payment_type,
        SUM(s.amount) as total
      FROM sales s
      WHERE s.date >= ? AND s.date <= ? AND s.is_cancelled = 0
      GROUP BY s.business_id, s.payment_type
    `).all(startDate, endDate);

    // Aylık Gider Kategorileri
    const expensesByCategory = db.prepare(`
      SELECT 
        ec.name as category_name,
        SUM(e.amount) as total_amount
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.date >= ? AND e.date <= ? AND e.is_cancelled = 0
      GROUP BY ec.name
      ORDER BY total_amount DESC
    `).all(startDate, endDate);

    const personnelReport = getPersonnelReport(startDate, endDate);
    const expensesReport = getExpensesReport(startDate, endDate);

    return res.json({
      success: true,
      year,
      month,
      startDate,
      endDate,
      summary,
      dailySales,
      salesByBusinessAndType,
      categories: [],
      expensesByCategory,
      personnelReport,
      expensesReport
    });
  } catch (err) {
    console.error('Monthly report error:', err);
    return res.status(500).json({ success: false, message: 'Aylık rapor oluşturulamadı.' });
  }
});

// 4. Yıllık Rapor
router.get('/yearly', authenticateToken, (req, res) => {
  try {
    const year = req.query.year || '2026';
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Aylık Satış Toplamları
    const monthlySales = db.prepare(`
      SELECT 
        substr(date, 6, 2) as month,
        SUM(CASE WHEN business_id = 'DK' THEN amount ELSE 0 END) as dk_sales,
        SUM(CASE WHEN business_id = 'PALM' THEN amount ELSE 0 END) as palm_sales,
        SUM(CASE WHEN payment_type = 'NAKIT' THEN amount ELSE 0 END) as nakit_sales,
        SUM(CASE WHEN payment_type = 'KART' THEN amount ELSE 0 END) as kart_sales,
        SUM(amount) as total_sales
      FROM sales
      WHERE date >= ? AND date <= ? AND is_cancelled = 0
      GROUP BY substr(date, 6, 2)
      ORDER BY month ASC
    `).all(startDate, endDate);

    // Aylık Gider Toplamları
    const monthlyExpenses = db.prepare(`
      SELECT 
        substr(date, 6, 2) as month,
        SUM(CASE WHEN business_id = 'DK' THEN amount ELSE 0 END) as dk_expenses,
        SUM(CASE WHEN business_id = 'PALM' THEN amount ELSE 0 END) as palm_expenses,
        SUM(amount) as total_expenses
      FROM expenses
      WHERE date >= ? AND date <= ? AND is_cancelled = 0
      GROUP BY substr(date, 6, 2)
      ORDER BY month ASC
    `).all(startDate, endDate);

    // Aylık Personel Hakedişleri
    const monthlyPersonnel = db.prepare(`
      SELECT 
        substr(date, 6, 2) as month,
        SUM(accrual_amount) as total_accrual
      FROM attendance
      WHERE date >= ? AND date <= ?
      GROUP BY substr(date, 6, 2)
      ORDER BY month ASC
    `).all(startDate, endDate);

    // Yıllık İşletme Bazlı Satış Kırılımı
    const yearlyBusinessSales = db.prepare(`
      SELECT 
        business_id,
        payment_type,
        SUM(amount) as total_amount
      FROM sales
      WHERE date >= ? AND date <= ? AND is_cancelled = 0
      GROUP BY business_id, payment_type
    `).all(startDate, endDate);

    const totalSales = monthlySales.reduce((acc, curr) => acc + curr.total_sales, 0);
    const totalExpenses = monthlyExpenses.reduce((acc, curr) => acc + curr.total_expenses, 0);
    const totalPersonnel = monthlyPersonnel.reduce((acc, curr) => acc + curr.total_accrual, 0);

    const personnelReport = getPersonnelReport(startDate, endDate);
    const expensesReport = getExpensesReport(startDate, endDate);

    return res.json({
      success: true,
      year,
      monthlySales,
      monthlyExpenses,
      monthlyPersonnel,
      yearlyBusinessSales,
      yearlyCategories: [],
      personnelReport,
      expensesReport,
      totals: {
        totalSales,
        totalExpenses,
        totalPersonnel,
        estimatedProfit: totalSales - (totalExpenses + totalPersonnel)
      }
    });
  } catch (err) {
    console.error('Yearly report error:', err);
    return res.status(500).json({ success: false, message: 'Yıllık rapor oluşturulamadı.' });
  }
});

export default router;
