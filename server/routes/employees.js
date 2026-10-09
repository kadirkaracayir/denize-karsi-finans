import express from 'express';
import * as XLSX from 'xlsx';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkClosedDate, requireRole } from '../middleware/rbac.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

export function calculateWorkedHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  if (checkIn === '00:00' && checkOut === '00:00') return 0;
  const [inH, inM] = String(checkIn).split(':').map(Number);
  const [outH, outM] = String(checkOut).split(':').map(Number);
  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;
  if (inH === outH && inM === outM) return 0;
  let inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60; // gece sarkması, örn: 17:00 -> 01:00 (8 saat)
  }
  const diffMinutes = outMinutes - inMinutes;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

// List Employees with their current balances
router.get('/', authenticateToken, (req, res) => {
  try {
    const { business_id, is_active } = req.query;

    let query = `
      SELECT 
        e.*,
        s.name as default_shift_name
      FROM employees e
      LEFT JOIN shifts s ON e.default_shift_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (business_id && business_id !== 'ALL') {
      query += ` AND e.business_id = ?`;
      params.push(business_id);
    }
    if (is_active !== undefined) {
      query += ` AND e.is_active = ?`;
      params.push(Number(is_active));
    }

    query += ` ORDER BY e.name ASC`;
    const employees = db.prepare(query).all(...params);

    // Calculate balances for each employee
    const balanceStmt = db.prepare(`
      SELECT 
        COALESCE((SELECT SUM(accrual_amount) FROM attendance WHERE employee_id = ?), 0) as total_accrued,
        COALESCE((SELECT SUM(amount) FROM employee_payments WHERE employee_id = ? AND is_cancelled = 0), 0) as total_paid
    `);

    const result = employees.map(emp => {
      const b = balanceStmt.get(emp.id, emp.id);
      const totalAccrued = b.total_accrued;
      const totalPaid = b.total_paid;
      const balanceDebt = Math.max(0, totalAccrued - totalPaid);
      return {
        ...emp,
        totalAccrued,
        totalPaid,
        balanceDebt
      };
    });

    return res.json({ success: true, employees: result });
  } catch (err) {
    console.error('Employees fetch error:', err);
    return res.status(500).json({ success: false, message: 'Personeller listelenirken hata oluştu.' });
  }
});

// Create Employee (Tüm personeller daima ORTAK olarak kaydedilir)
router.post('/', authenticateToken, requireRole('super_admin', 'business_admin', 'hr'), (req, res) => {
  try {
    const {
      name,
      full_name,
      phone,
      business_id = 'ORTAK',
      role = 'Personel',
      department = 'Genel',
      hourly_rate = 0,
      daily_rate = 0,
      accrual_type = 'SAATLIK',
      payment_period = 'HAFTALIK',
      default_shift_id = 1
    } = req.body;

    const empName = (name || full_name || '').trim();

    if (!empName) {
      return res.status(400).json({ success: false, message: 'Personel ad soyadı zorunludur.' });
    }

    const assignedBiz = (business_id && ['DK', 'PALM', 'ORTAK'].includes(business_id)) ? business_id : 'ORTAK';
    const assignedAccrual = (accrual_type && ['SAATLIK', 'GUNLUK'].includes(accrual_type)) ? accrual_type : 'SAATLIK';
    const assignedPeriod = (payment_period && ['GUNLUK', 'HAFTALIK', 'AYLIK'].includes(payment_period)) ? payment_period : 'HAFTALIK';

    const stmt = db.prepare(`
      INSERT INTO employees 
      (name, phone, business_id, role, department, hourly_rate, daily_rate, accrual_type, payment_period, default_shift_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const r = stmt.run(
      empName,
      phone ? phone.trim() : null,
      assignedBiz,
      (role || 'Personel').trim(),
      (department || 'Genel').trim(),
      parseFloat(hourly_rate) || 0,
      parseFloat(daily_rate) || 0,
      assignedAccrual,
      assignedPeriod,
      default_shift_id || 1
    );

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'EMPLOYEE_CREATE',
      entityType: 'EMPLOYEE',
      entityId: r.lastInsertRowid,
      newValues: { name: empName, business_id: assignedBiz, role, accrual_type: assignedAccrual, payment_period: assignedPeriod },
      ipAddress: req.ip
    });

    return res.json({ 
      success: true, 
      message: 'Personel başarıyla kaydedildi.', 
      id: r.lastInsertRowid,
      employee: {
        id: r.lastInsertRowid,
        name: empName,
        full_name: empName,
        business_id: assignedBiz,
        role: (role || 'Personel').trim()
      }
    });
  } catch (err) {
    console.error('Create employee error:', err);
    return res.status(500).json({ success: false, message: 'Personel kaydedilemedi: ' + err.message });
  }
});

// Update Employee
router.put('/:id', authenticateToken, requireRole('super_admin', 'business_admin', 'hr'), (req, res) => {
  try {
    const {
      name,
      full_name,
      phone,
      business_id = 'ORTAK',
      role,
      department,
      hourly_rate,
      daily_rate,
      accrual_type,
      payment_period,
      default_shift_id,
      is_active
    } = req.body;

    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Personel bulunamadı.' });

    const empName = (name || full_name) ? (name || full_name).trim() : null;
    const assignedBiz = (business_id && ['DK', 'PALM', 'ORTAK'].includes(business_id)) ? business_id : (existing.business_id || 'ORTAK');
    const assignedAccrual = accrual_type || existing.accrual_type || 'SAATLIK';
    const assignedPeriod = payment_period || existing.payment_period || 'HAFTALIK';

    db.prepare(`
      UPDATE employees SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        business_id = ?,
        role = COALESCE(?, role),
        department = COALESCE(?, department),
        hourly_rate = COALESCE(?, hourly_rate),
        daily_rate = COALESCE(?, daily_rate),
        accrual_type = ?,
        payment_period = ?,
        default_shift_id = COALESCE(?, default_shift_id),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      empName,
      phone !== undefined ? (phone ? phone.trim() : null) : null,
      assignedBiz,
      role ? role.trim() : null,
      department ? department.trim() : null,
      hourly_rate !== undefined ? parseFloat(hourly_rate) : null,
      daily_rate !== undefined ? parseFloat(daily_rate) : null,
      assignedAccrual,
      assignedPeriod,
      default_shift_id || null,
      is_active !== undefined ? Number(is_active) : null,
      req.params.id
    );

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'EMPLOYEE_UPDATE',
      entityType: 'EMPLOYEE',
      entityId: req.params.id,
      oldValues: existing,
      newValues: req.body,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Personel bilgileri güncellendi.' });
  } catch (err) {
    console.error('Update employee error:', err);
    return res.status(500).json({ success: false, message: 'Personel güncellenemedi: ' + err.message });
  }
});

// Delete Employee
router.delete('/:id', authenticateToken, requireRole('super_admin', 'business_admin', 'hr'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Personel bulunamadı.' });
    }

    // Delete related records and employee
    db.prepare('DELETE FROM attendance WHERE employee_id = ?').run(req.params.id);
    db.prepare('DELETE FROM employee_payments WHERE employee_id = ?').run(req.params.id);
    db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);

    logAudit({
      userId: req.user.id,
      userName: req.user.full_name,
      action: 'EMPLOYEE_DELETE',
      entityType: 'EMPLOYEE',
      entityId: req.params.id,
      oldValues: existing,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: `${existing.name} adlı personel başarıyla silindi.` });
  } catch (err) {
    console.error('Delete employee error:', err);
    return res.status(500).json({ success: false, message: 'Personel silinirken hata oluştu: ' + err.message });
  }
});

// Shifts CRUD
router.get('/shifts', authenticateToken, (req, res) => {
  const shifts = db.prepare('SELECT * FROM shifts WHERE is_active = 1 ORDER BY id ASC').all();
  return res.json({ success: true, shifts });
});

router.post('/shifts', authenticateToken, requireRole('super_admin', 'business_admin'), (req, res) => {
  try {
    const { name, start_time, end_time } = req.body;
    const r = db.prepare('INSERT INTO shifts (name, start_time, end_time, is_active) VALUES (?, ?, ?, 1)')
      .run(name, start_time, end_time);
    return res.json({ success: true, id: r.lastInsertRowid, message: 'Vardiya eklendi.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Vardiya eklenemedi.' });
  }
});

// Daily Attendance Grid
router.get('/attendance', authenticateToken, (req, res) => {
  try {
    const targetDate = req.query.date || '2026-10-08';

    // Get all active employees
    const employees = db.prepare(`
      SELECT e.*, s.name as default_shift_name
      FROM employees e
      LEFT JOIN shifts s ON e.default_shift_id = s.id
      WHERE e.is_active = 1
      ORDER BY e.name ASC
    `).all();

    // Get existing attendance records for targetDate
    const existingAttendance = db.prepare(`
      SELECT a.*, s.name as shift_name
      FROM attendance a
      LEFT JOIN shifts s ON a.shift_id = s.id
      WHERE a.date = ?
    `).all(targetDate);

    const attMap = new Map();
    for (const a of existingAttendance) {
      attMap.set(a.employee_id, a);
    }

    const paymentStmt = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_paid,
        COALESCE(SUM(CASE WHEN period_info LIKE '%Avans%' OR description LIKE '%Avans%' OR description LIKE '%avans%' THEN amount ELSE 0 END), 0) as total_advance
      FROM employee_payments
      WHERE employee_id = ? AND date = ? AND is_cancelled = 0
    `);

    const cumulativeStmt = db.prepare(`
      SELECT 
        COALESCE((SELECT SUM(accrual_amount) FROM attendance WHERE employee_id = ?), 0) as total_accrued,
        COALESCE((SELECT SUM(amount) FROM employee_payments WHERE employee_id = ? AND is_cancelled = 0), 0) as total_paid
    `);

    const grid = employees.map(emp => {
      const record = attMap.get(emp.id);
      const payInfo = paymentStmt.get(emp.id, targetDate);
      const cumInfo = cumulativeStmt.get(emp.id, emp.id);
      const currentDebt = Math.max(0, cumInfo.total_accrued - cumInfo.total_paid);

      if (record) {
        return {
          employee_id: emp.id,
          employee_name: emp.name,
          employee_role: emp.role,
          business_id: record.business_id,
          base_business_id: emp.business_id,
          accrual_type: emp.accrual_type,
          hourly_rate: emp.hourly_rate,
          daily_rate: emp.daily_rate,
          shift_id: record.shift_id || emp.default_shift_id || 1,
          check_in_time: record.check_in_time || '00:00',
          check_out_time: record.check_out_time || '00:00',
          hours_worked: record.hours_worked || 0,
          status: record.status || '',
          accrual_amount: record.accrual_amount || 0,
          today_advance: payInfo.total_advance,
          today_paid: payInfo.total_paid,
          current_debt: currentDebt,
          notes: record.notes || '',
          id: record.id
        };
      } else {
        const defaultBiz = emp.business_id === 'ORTAK' ? 'DK' : emp.business_id;

        return {
          employee_id: emp.id,
          employee_name: emp.name,
          employee_role: emp.role,
          business_id: defaultBiz,
          base_business_id: emp.business_id,
          accrual_type: emp.accrual_type,
          hourly_rate: emp.hourly_rate,
          daily_rate: emp.daily_rate,
          shift_id: emp.default_shift_id || 1,
          check_in_time: '00:00',
          check_out_time: '00:00',
          hours_worked: 0,
          status: '', // Kullanıcı kendisi işaretleyecek (otomatik CALISTI gelmez)
          accrual_amount: 0,
          today_advance: payInfo.total_advance,
          today_paid: payInfo.total_paid,
          current_debt: currentDebt,
          notes: '',
          id: null
        };
      }
    });

    return res.json({ success: true, date: targetDate, isClosed: false, grid });
  } catch (err) {
    console.error('Attendance fetch error:', err);
    return res.status(500).json({ success: false, message: 'Puantaj listesi alınamadı.' });
  }
});

// Active Dates with attendance entries
router.get('/attendance/active-dates', authenticateToken, (req, res) => {
  try {
    const dates = db.prepare(`
      SELECT 
        date, 
        COUNT(CASE WHEN status IN ('CALISTI', 'YARIM_GUN') THEN 1 END) as worked_count,
        COUNT(*) as total_records,
        SUM(CASE WHEN status IN ('CALISTI', 'YARIM_GUN') THEN accrual_amount ELSE 0 END) as total_accrual,
        SUM(CASE WHEN status IN ('CALISTI', 'YARIM_GUN') THEN hours_worked ELSE 0 END) as total_hours
      FROM attendance
      WHERE hours_worked > 0 OR status IN ('CALISTI', 'YARIM_GUN')
      GROUP BY date
      ORDER BY date DESC
    `).all();

    return res.json({ success: true, dates });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Monthly Attendance Matrix (Personel Puantaj Formatı - Günler 1..31)
router.get('/attendance/monthly-matrix', authenticateToken, (req, res) => {
  try {
    const today = new Date();
    const year = parseInt(req.query.year || today.getFullYear(), 10);
    const month = parseInt(req.query.month || (today.getMonth() + 1), 10);

    const monthStr = String(month).padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    const shortDayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    // Days Header
    const daysHeader = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const d = new Date(year, month - 1, day);
      const dayIdx = d.getDay();
      daysHeader.push({
        day,
        date: dateStr,
        dayName: shortDayNames[dayIdx],
        isWeekend: dayIdx === 0 || dayIdx === 6
      });
    }

    // Get Active Employees
    const employees = db.prepare(`
      SELECT e.*, s.name as default_shift_name
      FROM employees e
      LEFT JOIN shifts s ON e.default_shift_id = s.id
      WHERE e.is_active = 1
      ORDER BY e.name ASC
    `).all();

    // Get all attendance records for this month
    const monthPattern = `${year}-${monthStr}-%`;
    const attendanceRecords = db.prepare(`
      SELECT * FROM attendance
      WHERE date LIKE ?
    `).all(monthPattern);

    // Group attendance by employee_id and day
    const attMap = new Map(); // key: `${empId}_${day}` -> record
    attendanceRecords.forEach(r => {
      const day = parseInt(r.date.split('-')[2], 10);
      attMap.set(`${r.employee_id}_${day}`, r);
    });

    // Check closed dates in this month
    const closedRows = db.prepare(`
      SELECT date, is_closed FROM daily_closings
      WHERE date LIKE ? AND is_closed = 1
    `).all(monthPattern);
    const closedDatesSet = new Set(closedRows.map(c => c.date));

    // Calculate matrices and summaries for each employee
    let totalCompanyAccrual = 0;
    let totalCompanyPaid = 0;
    let totalCompanyDebt = 0;

    const firstDayOfMonth = `${year}-${monthStr}-01`;
    const lastDayOfMonth = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    const employeeRows = employees.map(emp => {
      let totalDaysWorked = 0;
      let totalHoursWorked = 0;
      let totalMonthAccrual = 0;

      const attendanceByDay = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const key = `${emp.id}_${day}`;
        const rec = attMap.get(key);
        const dayHeader = daysHeader[day - 1];

        if (rec) {
          const status = rec.status;
          const hours = rec.hours_worked || 0;
          const accrual = rec.accrual_amount || 0;

          if (status === 'CALISTI') totalDaysWorked += 1;
          else if (status === 'YARIM_GUN') totalDaysWorked += 0.5;

          totalHoursWorked += hours;
          totalMonthAccrual += accrual;

          attendanceByDay[day] = {
            id: rec.id,
            date: rec.date,
            status,
            check_in_time: rec.check_in_time || '',
            check_out_time: rec.check_out_time || '',
            hours_worked: hours,
            accrual_amount: accrual,
            notes: rec.notes || '',
            isClosed: closedDatesSet.has(rec.date)
          };
        } else {
          attendanceByDay[day] = {
            id: null,
            date: dayHeader.date,
            status: null, // empty
            check_in_time: '',
            check_out_time: '',
            hours_worked: 0,
            accrual_amount: 0,
            notes: '',
            isClosed: closedDatesSet.has(dayHeader.date)
          };
        }
      }

      // Payments made in this month
      const monthPaid = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s
        FROM employee_payments
        WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
      `).get(emp.id, firstDayOfMonth, lastDayOfMonth).s;

      // Cumulative overall debt up to now
      const allAccrued = db.prepare('SELECT COALESCE(SUM(accrual_amount), 0) as s FROM attendance WHERE employee_id = ?').get(emp.id).s;
      const allPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM employee_payments WHERE employee_id = ? AND is_cancelled = 0').get(emp.id).s;
      const currentDebt = Math.max(0, allAccrued - allPaid);

      totalCompanyAccrual += totalMonthAccrual;
      totalCompanyPaid += monthPaid;
      totalCompanyDebt += currentDebt;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        department: emp.department,
        business_id: emp.business_id,
        accrual_type: emp.accrual_type,
        hourly_rate: emp.hourly_rate,
        daily_rate: emp.daily_rate,
        payment_period: emp.payment_period,
        attendanceByDay,
        summary: {
          totalDaysWorked,
          totalHoursWorked,
          totalMonthAccrual,
          monthPaid,
          currentDebt
        }
      };
    });

    return res.json({
      success: true,
      year,
      month,
      daysInMonth,
      daysHeader,
      employees: employeeRows,
      totals: {
        totalCompanyAccrual,
        totalCompanyPaid,
        totalCompanyDebt
      }
    });
  } catch (err) {
    console.error('Monthly matrix fetch error:', err);
    return res.status(500).json({ success: false, message: 'Aylık puantaj tablosu yüklenemedi: ' + err.message });
  }
});

// Single Cell Quick Update (Hızlı Puantaj Hücre Güncellemesi)
router.post(
  '/attendance/cell',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'hr'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const { employee_id, date, status, check_in_time, check_out_time, hours_worked, business_id, notes = '' } = req.body;

      if (!employee_id || !date) {
        return res.status(400).json({ success: false, message: 'Personel ve tarih seçimi zorunludur.' });
      }

      const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
      if (!emp) {
        return res.status(404).json({ success: false, message: 'Personel bulunamadı.' });
      }

      // If status is null or empty, delete record
      if (!status) {
        db.prepare('DELETE FROM attendance WHERE employee_id = ? AND date = ?').run(employee_id, date);
        return res.json({
          success: true,
          message: 'Puantaj hücresi temizlendi.',
          cell: { status: null, hours_worked: 0, accrual_amount: 0 }
        });
      }

      const inTime = check_in_time || '00:00';
      const outTime = check_out_time || '00:00';

      // Calculate accrual and hours
      let hours = parseFloat(hours_worked);
      if (check_in_time && check_out_time && (!hours || isNaN(hours))) {
        hours = calculateWorkedHours(inTime, outTime);
      } else if (!hours || isNaN(hours)) {
        hours = 0;
      }

      const hourlyRate = parseFloat(emp.hourly_rate) || 0;
      let accrual = 0;

      // SADECE Saatlik Ücret ile hesaplama:
      if (status === 'CALISTI' || status === 'YARIM_GUN') {
        accrual = Math.round(hours * hourlyRate * 100) / 100;
      } else {
        hours = 0;
        accrual = 0;
      }

      const targetBiz = business_id || (emp.business_id === 'ORTAK' ? 'DK' : emp.business_id);

      db.prepare(`
        INSERT INTO attendance 
        (date, employee_id, business_id, shift_id, check_in_time, check_out_time, hours_worked, status, accrual_amount, notes, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(date, employee_id) DO UPDATE SET
          business_id = excluded.business_id,
          check_in_time = excluded.check_in_time,
          check_out_time = excluded.check_out_time,
          hours_worked = excluded.hours_worked,
          status = excluded.status,
          accrual_amount = excluded.accrual_amount,
          notes = excluded.notes,
          created_by = excluded.created_by,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        date,
        emp.id,
        targetBiz,
        emp.default_shift_id || 1,
        inTime,
        outTime,
        hours,
        status,
        accrual,
        notes || null,
        req.user.id
      );

      return res.json({
        success: true,
        message: 'Puantaj güncellendi.',
        cell: {
          employee_id: emp.id,
          date,
          status,
          check_in_time: inTime,
          check_out_time: outTime,
          hours_worked: hours,
          hourly_rate: hourlyRate,
          accrual_amount: accrual,
          notes
        }
      });
    } catch (err) {
      console.error('Cell update error:', err);
      return res.status(500).json({ success: false, message: 'Puantaj güncellenirken hata oluştu: ' + err.message });
    }
  }
);

// Check-in / Check-out Time Entry with Instant Accrual (Giriş/Çıkış Saati ve Anlık Hakediş)
router.post(
  '/attendance/time-entry',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'hr'),
  (req, res) => {
    try {
      const {
        employee_id,
        date,
        check_in_time = '00:00',
        check_out_time = '00:00',
        status = '',
        business_id = 'ORTAK',
        notes = ''
      } = req.body;

      if (!employee_id || !date) {
        return res.status(400).json({ success: false, message: 'Personel ve tarih zorunludur.' });
      }

      const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
      if (!emp) {
        return res.status(404).json({ success: false, message: 'Personel bulunamadı.' });
      }

      const inTime = check_in_time || '00:00';
      const outTime = check_out_time || '00:00';
      let hours = calculateWorkedHours(inTime, outTime);

      const hourlyRate = parseFloat(emp.hourly_rate) || 0;
      let accrual = 0;

      // SADECE Saatlik Ücret ile hesaplama:
      if (status === 'CALISTI' || status === 'YARIM_GUN') {
        accrual = Math.round(hours * hourlyRate * 100) / 100;
      } else {
        hours = 0;
        accrual = 0;
      }

      const targetBiz = business_id || (emp.business_id === 'ORTAK' ? 'DK' : emp.business_id);

      db.prepare(`
        INSERT INTO attendance 
        (date, employee_id, business_id, shift_id, check_in_time, check_out_time, hours_worked, status, accrual_amount, notes, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(date, employee_id) DO UPDATE SET
          business_id = excluded.business_id,
          check_in_time = excluded.check_in_time,
          check_out_time = excluded.check_out_time,
          hours_worked = excluded.hours_worked,
          status = excluded.status,
          accrual_amount = excluded.accrual_amount,
          notes = excluded.notes,
          created_by = excluded.created_by,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        date,
        emp.id,
        targetBiz,
        emp.default_shift_id || 1,
        inTime,
        outTime,
        hours,
        status,
        accrual,
        notes || null,
        req.user.id
      );

      return res.json({
        success: true,
        message: `${emp.name} için ${inTime} - ${outTime} (${hours} saat) çalışma ve ${accrual.toLocaleString('tr-TR')} TL hakediş kaydedildi.`,
        entry: {
          employee_id: emp.id,
          employee_name: emp.name,
          date,
          check_in_time: inTime,
          check_out_time: outTime,
          hours_worked: hours,
          hourly_rate: hourlyRate,
          accrual_amount: accrual,
          status
        }
      });
    } catch (err) {
      console.error('Time entry save error:', err);
      return res.status(500).json({ success: false, message: 'Saat ve hakediş kaydedilemedi: ' + err.message });
    }
  }
);

// Weekly Summary with Sunday Payout Policy (Haftalık Puantaj & Pazar Ödeme Dökümü)
router.get('/attendance/weekly-summary', authenticateToken, (req, res) => {
  try {
    const formatLocalDate = (dt) => {
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    };

    // Determine min/max date with attendance in database
    const minMax = db.prepare('SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(*) as total_rows FROM attendance').get();
    
    // Find all distinct weeks that contain attendance records
    const distinctDates = db.prepare('SELECT DISTINCT date FROM attendance ORDER BY date ASC').all();
    
    const availableWeeksMap = new Map();
    for (const row of distinctDates) {
      const [y, m, d] = row.date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dayOfWeek = dt.getDay(); // 0 is Sunday
      const diffToMonday = dt.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      const mon = new Date(y, m - 1, diffToMonday);
      const sun = new Date(y, m - 1, diffToMonday + 6);
      const monStr = formatLocalDate(mon);
      const sunStr = formatLocalDate(sun);
      const key = `${monStr}_${sunStr}`;
      if (!availableWeeksMap.has(key)) {
        const monTR = monStr.split('-').reverse().join('.');
        const sunTR = sunStr.split('-').reverse().join('.');
        availableWeeksMap.set(key, {
          startDate: monStr,
          endDate: sunStr,
          pazarDate: sunStr,
          label: `${monTR} — ${sunTR} (Pazar Kapanışı)`
        });
      }
    }
    const availableWeeks = Array.from(availableWeeksMap.values());

    let sStr, eStr;
    let periodTitle = '';
    const requestedPeriod = req.query.period; // 'all' | 'week' | 'custom'

    if (requestedPeriod === 'all' || (!req.query.date && !req.query.startDate && !requestedPeriod)) {
      // Default to ALL entered period if no specific week requested, so user sees all data right away!
      sStr = minMax?.min_date || '2026-09-05';
      eStr = minMax?.max_date || '2026-09-08';
      periodTitle = `Tüm Kayıtlı Puantaj Dönemi (${sStr.split('-').reverse().join('.')} — ${eStr.split('-').reverse().join('.')})`;
    } else if (req.query.startDate && req.query.endDate) {
      sStr = req.query.startDate;
      eStr = req.query.endDate;
      periodTitle = `${sStr.split('-').reverse().join('.')} — ${eStr.split('-').reverse().join('.')}`;
    } else {
      let targetDate = req.query.date;
      if (!targetDate && minMax?.max_date) {
        targetDate = minMax.max_date;
      }
      targetDate = targetDate || '2026-09-08';

      const [y, m, d] = targetDate.split('-').map(Number);
      const curr = new Date(y, m - 1, d);
      const dayOfWeek = curr.getDay();
      const diffToMonday = curr.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      const monday = new Date(y, m - 1, diffToMonday);
      const sunday = new Date(y, m - 1, diffToMonday + 6);
      sStr = formatLocalDate(monday);
      eStr = formatLocalDate(sunday);
      periodTitle = `${sStr.split('-').reverse().join('.')} — ${eStr.split('-').reverse().join('.')} (Pazar Kapanışı)`;
    }

    const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC').all();

    const attStmt = db.prepare(`
      SELECT date, check_in_time, check_out_time, hours_worked, accrual_amount, status
      FROM attendance
      WHERE employee_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `);

    const advStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s
      FROM employee_payments
      WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
        AND (period_info LIKE '%Avans%' OR description LIKE '%Avans%' OR description LIKE '%avans%')
    `);

    const payStmt = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s
      FROM employee_payments
      WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
    `);

    const cumStmt = db.prepare(`
      SELECT 
        COALESCE((SELECT SUM(accrual_amount) FROM attendance WHERE employee_id = ?), 0) as total_accrued,
        COALESCE((SELECT SUM(amount) FROM employee_payments WHERE employee_id = ? AND is_cancelled = 0), 0) as total_paid
    `);

    let totalWeeklyHours = 0;
    let totalWeeklyAccrual = 0;
    let totalWeeklyAdvances = 0;
    let totalWeeklyPaid = 0;
    let totalPazarRemaining = 0;

    const list = employees.map(emp => {
      const records = attStmt.all(emp.id, sStr, eStr);
      let weeklyHours = 0;
      let weeklyAccrual = 0;
      const daysMap = {};

      records.forEach(r => {
        weeklyHours += r.hours_worked || 0;
        weeklyAccrual += r.accrual_amount || 0;
        daysMap[r.date] = r;
      });

      const weeklyAdvances = advStmt.get(emp.id, sStr, eStr).s;
      const weeklyPaid = payStmt.get(emp.id, sStr, eStr).s;
      const cum = cumStmt.get(emp.id, emp.id);
      const overallDebt = Math.max(0, cum.total_accrued - cum.total_paid);
      const pazarRemaining = Math.max(0, weeklyAccrual - weeklyPaid);

      totalWeeklyHours += weeklyHours;
      totalWeeklyAccrual += weeklyAccrual;
      totalWeeklyAdvances += weeklyAdvances;
      totalWeeklyPaid += weeklyPaid;
      totalPazarRemaining += pazarRemaining;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        hourly_rate: emp.hourly_rate,
        daily_rate: emp.daily_rate,
        accrual_type: emp.accrual_type,
        weekly_hours: Math.round(weeklyHours * 100) / 100,
        weekly_accrual: Math.round(weeklyAccrual * 100) / 100,
        weekly_advances: weeklyAdvances,
        weekly_paid: weeklyPaid,
        pazar_remaining: Math.round(pazarRemaining * 100) / 100,
        overall_debt: Math.round(overallDebt * 100) / 100,
        days: daysMap,
        record_count: records.length
      };
    });

    return res.json({
      success: true,
      startDate: sStr,
      endDate: eStr,
      pazarDate: eStr,
      periodTitle,
      periodMode: requestedPeriod || (sStr === minMax?.min_date && eStr === minMax?.max_date ? 'all' : 'week'),
      availableWeeks,
      minDate: minMax?.min_date,
      maxDate: minMax?.max_date,
      employees: list,
      totals: {
        totalWeeklyHours: Math.round(totalWeeklyHours * 100) / 100,
        totalWeeklyAccrual: Math.round(totalWeeklyAccrual * 100) / 100,
        totalWeeklyAdvances: Math.round(totalWeeklyAdvances * 100) / 100,
        totalWeeklyPaid: Math.round(totalWeeklyPaid * 100) / 100,
        totalPazarRemaining: Math.round(totalPazarRemaining * 100) / 100
      }
    });
  } catch (err) {
    console.error('Weekly summary error:', err);
    return res.status(500).json({ success: false, message: 'Haftalık puantaj özeti alınamadı: ' + err.message });
  }
});

// Bulk Fill Day (Günü Toplu Çalıştı Olarak Doldur)
router.post(
  '/attendance/bulk-fill-day',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'hr'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const { date, status = 'CALISTI' } = req.body;
      if (!date) return res.status(400).json({ success: false, message: 'Tarih zorunludur.' });

      const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1').all();

      const stmt = db.prepare(`
        INSERT INTO attendance 
        (date, employee_id, business_id, shift_id, check_in_time, check_out_time, hours_worked, status, accrual_amount, notes, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(date, employee_id) DO UPDATE SET
          business_id = excluded.business_id,
          hours_worked = excluded.hours_worked,
          status = excluded.status,
          accrual_amount = excluded.accrual_amount,
          created_by = excluded.created_by,
          updated_at = CURRENT_TIMESTAMP
      `);

      let totalAccrual = 0;
      for (const emp of employees) {
        const hours = emp.accrual_type === 'SAATLIK' ? 8 : 0;
        let accrual = 0;
        if (status === 'CALISTI') {
          accrual = emp.accrual_type === 'SAATLIK' ? (hours * emp.hourly_rate) : emp.daily_rate;
        } else if (status === 'YARIM_GUN') {
          accrual = emp.accrual_type === 'SAATLIK' ? (4 * emp.hourly_rate) : (emp.daily_rate / 2);
        }

        const biz = emp.business_id === 'ORTAK' ? 'DK' : emp.business_id;
        stmt.run(date, emp.id, biz, emp.default_shift_id || 1, '09:00', '17:00', hours, status, accrual, 'Toplu Doldurma', req.user.id);
        totalAccrual += accrual;
      }

      return res.json({
        success: true,
        message: `${date} için ${employees.length} personel '${status}' olarak dolduruldu. Toplam hakediş: ${totalAccrual.toLocaleString('tr-TR')} TL`,
        totalAccrual
      });
    } catch (err) {
      console.error('Bulk fill day error:', err);
      return res.status(500).json({ success: false, message: 'Toplu puantaj doldurulamadı: ' + err.message });
    }
  }
);

// Export Puantaj to Excel (XLSX) - Supports Monthly and Date Range (2 Tarih Arası)
router.get('/attendance/export-excel', authenticateToken, (req, res) => {
  try {
    const today = new Date();
    const { startDate, endDate, period } = req.query;

    // Check if Date Range or All Periods is requested
    const minMax = db.prepare('SELECT MIN(date) as min_date, MAX(date) as max_date FROM attendance').get();
    let sDate = startDate;
    let eDate = endDate;

    if (period === 'all') {
      sDate = minMax?.min_date || '2026-09-05';
      eDate = minMax?.max_date || '2026-09-08';
    }

    const isDateRange = Boolean(sDate && eDate);

    if (isDateRange) {
      // 1. DATE RANGE EXCEL EXPORT (2 Tarih Arası Puantaj & Hakediş Dökümü)
      const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC').all();
      const attStmt = db.prepare(`
        SELECT * FROM attendance
        WHERE employee_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC
      `);

      const advStmt = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s
        FROM employee_payments
        WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
          AND (period_info LIKE '%Avans%' OR description LIKE '%Avans%' OR description LIKE '%avans%')
      `);

      const payStmt = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s
        FROM employee_payments
        WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
      `);

      const cumStmt = db.prepare(`
        SELECT 
          COALESCE((SELECT SUM(accrual_amount) FROM attendance WHERE employee_id = ?), 0) as total_accrued,
          COALESCE((SELECT SUM(amount) FROM employee_payments WHERE employee_id = ? AND is_cancelled = 0), 0) as total_paid
      `);

      const rows = [
        ['DENİZE KARŞI & PALM BEACH - 2 TARİH ARASI PERSONEL PUANTAJ VE HAKEDİŞ DÖKÜMÜ'],
        [`Dönem: ${sDate} — ${eDate}  |  Rapor Alınma Tarihi: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`],
        [],
        [
          'No',
          'Personel Adı',
          'İşletme',
          'Görevi',
          'Saatlik Ücret (TL)',
          'Dönem Çalışılan Saat',
          'Toplam Hakediş (TL)',
          'Alınan Avans (TL)',
          'Yapılan Ödeme (TL)',
          'Ödememiz Gereken Net Tutar (TL)',
          'Kümülatif Toplam Borç (TL)'
        ]
      ];

      let sumHours = 0;
      let sumAccrual = 0;
      let sumAdvances = 0;
      let sumPaid = 0;
      let sumRemaining = 0;
      let sumDebt = 0;

      employees.forEach((emp, idx) => {
        const records = attStmt.all(emp.id, sDate, eDate);
        let empHours = 0;
        let empAccrual = 0;
        records.forEach(r => {
          empHours += r.hours_worked || 0;
          empAccrual += r.accrual_amount || 0;
        });

        const empAdv = advStmt.get(emp.id, sDate, eDate).s;
        const empPaid = payStmt.get(emp.id, sDate, eDate).s;
        const cum = cumStmt.get(emp.id, emp.id);
        const overallDebt = Math.max(0, cum.total_accrued - cum.total_paid);
        const pazarRemaining = Math.max(0, empAccrual - empPaid);

        sumHours += empHours;
        sumAccrual += empAccrual;
        sumAdvances += empAdv;
        sumPaid += empPaid;
        sumRemaining += pazarRemaining;
        sumDebt += overallDebt;

        rows.push([
          idx + 1,
          emp.name,
          emp.business_id,
          emp.role || 'Ortak Personel',
          emp.hourly_rate,
          Math.round(empHours * 100) / 100,
          Math.round(empAccrual * 100) / 100,
          empAdv,
          empPaid,
          Math.round(pazarRemaining * 100) / 100,
          Math.round(overallDebt * 100) / 100
        ]);
      });

      rows.push([]);
      rows.push([
        'GENEL TOPLAM',
        '',
        '',
        '',
        '',
        Math.round(sumHours * 100) / 100,
        Math.round(sumAccrual * 100) / 100,
        Math.round(sumAdvances * 100) / 100,
        Math.round(sumPaid * 100) / 100,
        Math.round(sumRemaining * 100) / 100,
        Math.round(sumDebt * 100) / 100
      ]);

      // Sheet 2: Günlük Giriş/Çıkış Saatleri Detayı
      const distinctDates = db.prepare(`
        SELECT DISTINCT date FROM attendance
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC
      `).all(sDate, eDate).map(d => d.date);

      const detailRows = [
        ['DENİZE KARŞI & PALM BEACH - GÜNLÜK ÇALIŞMA SAATLERİ (GİRİŞ - ÇIKIŞ) DETAYI'],
        [`Dönem: ${sDate} — ${eDate}`],
        []
      ];

      const detHeader = ['No', 'Personel Adı', 'Görevi'];
      distinctDates.forEach(dt => {
        detHeader.push(`${dt} (Giriş)`);
        detHeader.push(`${dt} (Çıkış)`);
        detHeader.push(`${dt} (Saat)`);
      });
      detHeader.push('Toplam Saat', 'Toplam Hakediş (TL)');
      detailRows.push(detHeader);

      employees.forEach((emp, idx) => {
        const empRecords = attStmt.all(emp.id, sDate, eDate);
        const map = new Map();
        let totalH = 0;
        let totalA = 0;
        empRecords.forEach(r => {
          map.set(r.date, r);
          totalH += r.hours_worked || 0;
          totalA += r.accrual_amount || 0;
        });

        const row = [idx + 1, emp.name, emp.role || 'Ortak Personel'];
        distinctDates.forEach(dt => {
          const r = map.get(dt);
          if (r) {
            row.push(r.check_in_time || '-');
            row.push(r.check_out_time || '-');
            row.push(r.hours_worked || 0);
          } else {
            row.push('-', '-', 0);
          }
        });
        row.push(Math.round(totalH * 100) / 100, Math.round(totalA * 100) / 100);
        detailRows.push(row);
      });

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Puantaj_ve_Hakedis');

      const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Giris_Cikis_Detayi');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Puantaj_${sDate}_${eDate}.xlsx"`);
      return res.send(buffer);
    }

    // 2. MONTHLY MATRIX EXPORT (Aylık 1-31 PDKS Çizelgesi)
    const year = parseInt(req.query.year || today.getFullYear(), 10);
    const month = parseInt(req.query.month || (today.getMonth() + 1), 10);

    const monthStr = String(month).padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();

    // Turkish status code mapper
    const getCode = (status) => {
      switch (status) {
        case 'CALISTI': return 'Ç';
        case 'YARIM_GUN': return '½';
        case 'IZINLI': return 'İ';
        case 'RAPORLU': return 'R';
        case 'GELMEDI': return 'X';
        default: return '-';
      }
    };

    const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC').all();
    const monthPattern = `${year}-${monthStr}-%`;
    const attendanceRecords = db.prepare('SELECT * FROM attendance WHERE date LIKE ?').all(monthPattern);

    const attMap = new Map();
    attendanceRecords.forEach(r => {
      const day = parseInt(r.date.split('-')[2], 10);
      attMap.set(`${r.employee_id}_${day}`, r);
    });

    const rows = [];

    // Title rows
    rows.push(['DENİZE KARŞI & PALM BEACH - AYLIK PERSONEL PUANTAJ ÇİZELGESİ']);
    rows.push([`Dönem: ${monthStr}/${year}  |  Rapor Alınma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`]);
    rows.push([]); // blank line

    // Header row
    const header = ['No', 'Adı Soyadı', 'İşletme', 'Görev', 'Ücret Tipi', 'Birim Ücret'];
    for (let day = 1; day <= daysInMonth; day++) {
      header.push(`${day}`);
    }
    header.push('Toplam Gün', 'Toplam Saat', 'Aylık Hakediş (TL)', 'Ödenen (TL)', 'Kalan Borç (TL)');
    rows.push(header);

    // Data rows
    let grandAccrual = 0;
    let grandPaid = 0;
    let grandDebt = 0;
    let grandDays = 0;

    employees.forEach((emp, idx) => {
      let daysWorked = 0;
      let hoursWorked = 0;
      let monthAccrual = 0;

      const row = [
        idx + 1,
        emp.name,
        emp.business_id,
        emp.role,
        emp.accrual_type === 'SAATLIK' ? 'Saatlik' : 'Günlük',
        emp.accrual_type === 'SAATLIK' ? `${emp.hourly_rate} TL` : `${emp.daily_rate} TL`
      ];

      for (let day = 1; day <= daysInMonth; day++) {
        const rec = attMap.get(`${emp.id}_${day}`);
        if (rec) {
          row.push(getCode(rec.status));
          if (rec.status === 'CALISTI') daysWorked += 1;
          else if (rec.status === 'YARIM_GUN') daysWorked += 0.5;
          hoursWorked += rec.hours_worked || 0;
          monthAccrual += rec.accrual_amount || 0;
        } else {
          row.push('-');
        }
      }

      // Payments in this month
      const firstDay = `${year}-${monthStr}-01`;
      const lastDay = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
      const monthPaid = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as s FROM employee_payments
        WHERE employee_id = ? AND date >= ? AND date <= ? AND is_cancelled = 0
      `).get(emp.id, firstDay, lastDay).s;

      // Cumulative balance
      const allAccrued = db.prepare('SELECT COALESCE(SUM(accrual_amount), 0) as s FROM attendance WHERE employee_id = ?').get(emp.id).s;
      const allPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM employee_payments WHERE employee_id = ? AND is_cancelled = 0').get(emp.id).s;
      const currentDebt = Math.max(0, allAccrued - allPaid);

      grandDays += daysWorked;
      grandAccrual += monthAccrual;
      grandPaid += monthPaid;
      grandDebt += currentDebt;

      row.push(daysWorked, hoursWorked, monthAccrual, monthPaid, currentDebt);
      rows.push(row);
    });

    // Summary bottom row
    rows.push([]);
    const summaryRow = ['GENEL TOPLAM', '', '', '', '', ''];
    for (let day = 1; day <= daysInMonth; day++) summaryRow.push('');
    summaryRow.push(grandDays, '', grandAccrual, grandPaid, grandDebt);
    rows.push(summaryRow);

    // Legend
    rows.push([]);
    rows.push(['KOD AÇIKLAMALARI:']);
    rows.push(['Ç: Tam Gün Çalıştı', '½: Yarım Gün', 'İ: İzinli / Hafta Tatili', 'R: Raporlu', 'X: Gelmedi / Devamsız', '-: Kayıt Yok']);

    // Build workbook
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Puantaj');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Puantaj_${year}_${monthStr}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    console.error('Excel export error:', err);
    return res.status(500).json({ success: false, message: 'Puantaj Excel dosyası oluşturulamadı: ' + err.message });
  }
});

// Save Daily Attendance Batch
router.post(
  '/attendance/batch',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'hr'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const { date, items } = req.body;

      if (!date || !Array.isArray(items)) {
        return res.status(400).json({ success: false, message: 'Geçersiz puantaj verisi.' });
      }

      const stmt = db.prepare(`
        INSERT INTO attendance 
        (date, employee_id, business_id, shift_id, check_in_time, check_out_time, hours_worked, status, accrual_amount, notes, created_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(date, employee_id) DO UPDATE SET
          business_id = excluded.business_id,
          shift_id = excluded.shift_id,
          check_in_time = excluded.check_in_time,
          check_out_time = excluded.check_out_time,
          hours_worked = excluded.hours_worked,
          status = excluded.status,
          accrual_amount = excluded.accrual_amount,
          notes = excluded.notes,
          created_by = excluded.created_by,
          updated_at = CURRENT_TIMESTAMP
      `);

      let totalAccrual = 0;

      for (const item of items) {
        // Automatic Accrual Calculation Engine (Section 10 & 13)
        let accrual = 0;
        const status = item.status || 'CALISTI';
        const hours = parseFloat(item.hours_worked) || 0;
        const hourlyRate = parseFloat(item.hourly_rate) || 0;
        const dailyRate = parseFloat(item.daily_rate) || 0;

        if (status === 'CALISTI') {
          if (item.accrual_type === 'SAATLIK') {
            accrual = hours * hourlyRate;
          } else {
            accrual = dailyRate;
          }
        } else if (status === 'YARIM_GUN') {
          if (item.accrual_type === 'SAATLIK') {
            accrual = hours * hourlyRate;
          } else {
            accrual = dailyRate / 2;
          }
        } else {
          // GELMEDI, IZINLI, RAPORLU
          accrual = 0;
        }

        stmt.run(
          date,
          item.employee_id,
          item.business_id || 'DK',
          item.shift_id || 1,
          item.check_in_time || null,
          item.check_out_time || null,
          hours,
          status,
          accrual,
          item.notes || null,
          req.user.id
        );

        totalAccrual += accrual;
      }

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'ATTENDANCE_BATCH_SAVE',
        entityType: 'ATTENDANCE',
        entityId: date,
        newValues: { date, count: items.length, totalAccrual },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: `${date} tarihli ${items.length} personel puantajı kaydedildi. Toplam Hakediş: ${totalAccrual.toLocaleString('tr-TR')} TL`,
        totalAccrual
      });
    } catch (err) {
      console.error('Batch attendance save error:', err);
      return res.status(500).json({ success: false, message: 'Puantaj kaydedilirken hata oluştu: ' + err.message });
    }
  }
);

// Employee Debt & Balances Summary (Section 15)
router.get('/debt-summary', authenticateToken, (req, res) => {
  try {
    const today = req.query.date || '2026-10-08';

    const employees = db.prepare('SELECT id, name, role, business_id, payment_period FROM employees WHERE is_active = 1 ORDER BY name ASC').all();

    const summaryList = employees.map(emp => {
      // Prior Debt up to yesterday
      const priorAccrued = db.prepare('SELECT COALESCE(SUM(accrual_amount), 0) as s FROM attendance WHERE employee_id = ? AND date < ?').get(emp.id, today).s;
      const priorPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM employee_payments WHERE employee_id = ? AND date < ? AND is_cancelled = 0').get(emp.id, today).s;
      const priorDebt = Math.max(0, priorAccrued - priorPaid);

      // Today's accrual
      const todayAccrual = db.prepare('SELECT COALESCE(SUM(accrual_amount), 0) as s FROM attendance WHERE employee_id = ? AND date = ?').get(emp.id, today).s;

      // Today's payment
      const todayPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM employee_payments WHERE employee_id = ? AND date = ? AND is_cancelled = 0').get(emp.id, today).s;

      // Current balance
      const currentDebt = Math.max(0, (priorDebt + todayAccrual) - todayPaid);

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        business_id: emp.business_id,
        payment_period: emp.payment_period,
        priorDebt,
        todayAccrual,
        todayPaid,
        currentDebt
      };
    });

    const totalCompanyDebt = summaryList.reduce((acc, curr) => acc + curr.currentDebt, 0);

    return res.json({
      success: true,
      date: today,
      totalCompanyDebt,
      employees: summaryList
    });
  } catch (err) {
    console.error('Debt summary error:', err);
    return res.status(500).json({ success: false, message: 'Personel borç tablosu yüklenemedi.' });
  }
});

// Employee Payments List (Section 16)
router.get('/payments', authenticateToken, (req, res) => {
  try {
    const { employee_id, startDate, endDate, limit = 100 } = req.query;

    let query = `
      SELECT 
        p.*,
        e.name as employee_name,
        e.role as employee_role,
        u.full_name as creator_name
      FROM employee_payments p
      JOIN employees e ON p.employee_id = e.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.is_cancelled = 0
    `;
    const params = [];

    if (employee_id) {
      query += ` AND p.employee_id = ?`;
      params.push(employee_id);
    }
    if (startDate) {
      query += ` AND p.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND p.date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY p.date DESC, p.id DESC LIMIT ?`;
    params.push(Number(limit));

    const payments = db.prepare(query).all(...params);
    return res.json({ success: true, payments });
  } catch (err) {
    console.error('Payments fetch error:', err);
    return res.status(500).json({ success: false, message: 'Personel ödemeleri listelenemedi.' });
  }
});

// Create Employee Payment (Section 16)
router.post(
  '/payments',
  authenticateToken,
  requireRole('super_admin', 'business_admin', 'hr', 'finance'),
  checkClosedDate(req => req.body.date),
  (req, res) => {
    try {
      const {
        date,
        employee_id,
        period_info = 'Günlük',
        amount,
        payment_source, // 'DK_KASA', 'PALM_KASA', 'DK_BANKA', 'PALM_BANKA'
        description = ''
      } = req.body;

      if (!date || !employee_id || !amount || !payment_source) {
        return res.status(400).json({ success: false, message: 'Zorunlu alanları doldurunuz.' });
      }

      const stmt = db.prepare(`
        INSERT INTO employee_payments 
        (date, employee_id, period_info, amount, payment_source, description, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const r = stmt.run(date, employee_id, period_info, parseFloat(amount), payment_source, description, req.user.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'EMPLOYEE_PAYMENT',
        entityType: 'PAYMENT',
        entityId: r.lastInsertRowid,
        newValues: { date, employee_id, amount, payment_source, period_info },
        changeReason: req.changeReason,
        ipAddress: req.ip
      });

      return res.json({ success: true, message: 'Personel ödemesi başarıyla kaydedildi.', id: r.lastInsertRowid });
    } catch (err) {
      console.error('Create payment error:', err);
      return res.status(500).json({ success: false, message: 'Ödeme kaydedilemedi.' });
    }
  }
);

// Cancel Employee Payment
router.delete(
  '/payments/:id',
  authenticateToken,
  requireRole('super_admin', 'business_admin'),
  (req, res, next) => {
    const p = db.prepare('SELECT * FROM employee_payments WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Ödeme kaydı bulunamadı.' });
    req.targetPayment = p;
    checkClosedDate(() => p.date)(req, res, next);
  },
  (req, res) => {
    try {
      db.prepare('UPDATE employee_payments SET is_cancelled = 1 WHERE id = ?').run(req.params.id);

      logAudit({
        userId: req.user.id,
        userName: req.user.full_name,
        action: 'PAYMENT_CANCEL',
        entityType: 'PAYMENT',
        entityId: req.params.id,
        oldValues: req.targetPayment,
        changeReason: req.changeReason || req.body.change_reason || 'İptal edildi',
        ipAddress: req.ip
      });

      return res.json({ success: true, message: 'Ödeme iptal edildi.' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'İptal edilemedi.' });
    }
  }
);

export default router;
