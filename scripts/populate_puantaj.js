import XLSX from 'xlsx';
import db from '../server/db/database.js';
import { initializeSchema } from '../server/db/schema.js';
import { clearAllDemoData } from '../server/db/seed.js';

initializeSchema();

// 1. Wipe all old demo data (keep master businesses, roles, users, categories, shifts)
console.log('--- 1. Eski demo verileri temizleniyor ---');
clearAllDemoData();

const adminUser = db.prepare('SELECT id FROM users LIMIT 1').get();
const adminId = adminUser ? adminUser.id : null;
console.log('Admin User ID:', adminId);

// 2. Read Excel
console.log('--- 2. puantaj.xlsx okunuyor ---');
const wb = XLSX.readFile('puantaj.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];

function numToTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.includes(':')) return s;
    const n = parseFloat(s);
    if (!isNaN(n)) v = n;
    else return null;
  }
  let totalMinutes = Math.round(v * 24 * 60);
  let hrs = Math.floor(totalMinutes / 60) % 24;
  let mins = totalMinutes % 60;
  return String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

function getTimeString(sheet, cellAddr) {
  const cell = sheet[cellAddr];
  if (!cell || cell.v == null || cell.v === '') return null;
  if (cell.w && cell.w.trim() && cell.w.includes(':')) {
    return cell.w.trim();
  }
  return numToTime(cell.v);
}

function calculateWorkedHours(inTime, outTime) {
  if (!inTime || !outTime) return 0;
  if (inTime === '00:00' && outTime === '00:00') return 0;
  const [inH, inM] = String(inTime).split(':').map(Number);
  const [outH, outM] = String(outTime).split(':').map(Number);
  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;
  if (inH === outH && inM === outM) return 0;
  let inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }
  const diffMinutes = outMinutes - inMinutes;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

// Prepare statements
const insertEmpStmt = db.prepare(`
  INSERT INTO employees 
  (name, phone, business_id, role, department, hourly_rate, daily_rate, accrual_type, payment_period, default_shift_id, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

const insertAttStmt = db.prepare(`
  INSERT INTO attendance 
  (date, employee_id, business_id, shift_id, check_in_time, check_out_time, hours_worked, status, accrual_amount, notes, created_by, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

const days = [
  { date: '2026-09-05', inCol: 'B', outCol: 'C' },
  { date: '2026-09-06', inCol: 'D', outCol: 'E' },
  { date: '2026-09-07', inCol: 'F', outCol: 'G' },
  { date: '2026-09-08', inCol: 'H', outCol: 'I' }
];

let createdEmployees = 0;
let createdAttendance = 0;
let totalCalculatedAccrual = 0;
let totalExcelAccrual = 0;

console.log('--- 3. Personeller ve Puantajlar Kaydediliyor ---');

for (let r = 3; r <= 38; r++) {
  const nameCell = sheet['A' + r];
  if (!nameCell || !nameCell.v) continue;

  const empName = String(nameCell.v).trim();
  const hourlyRate = parseFloat(sheet['P' + r]?.v) || 0;
  const excelTotal = parseFloat(sheet['S' + r]?.v) || 0;
  totalExcelAccrual += excelTotal;

  // Insert employee
  const empRes = insertEmpStmt.run(
    empName,
    null,           // phone
    'ORTAK',        // business_id
    'Personel',     // role
    'Genel',        // department
    hourlyRate,     // hourly_rate
    0,              // daily_rate
    'SAATLIK',      // accrual_type
    'HAFTALIK',     // payment_period
    1               // default_shift_id (Sabah)
  );

  const empId = empRes.lastInsertRowid;
  createdEmployees++;

  let empTotalHours = 0;
  let empTotalAccrual = 0;

  for (const day of days) {
    const inTime = getTimeString(sheet, day.inCol + r);
    const outTime = getTimeString(sheet, day.outCol + r);

    let status = 'IZINLI';
    let hoursWorked = 0;
    let accrual = 0;

    if (inTime && outTime) {
      status = 'CALISTI';
      // In Excel İsmail Akar: 09:30 to 00:00 -> 14.5 hours.
      // In Excel formula: (((C3-B3)+(C3<B3))*24) * P3
      const inVal = sheet[day.inCol + r]?.v;
      const outVal = sheet[day.outCol + r]?.v;
      if (inVal != null && outVal != null) {
        let diff = outVal - inVal;
        if (outVal < inVal) diff += 1;
        hoursWorked = Math.round(diff * 24 * 100) / 100;
      } else {
        hoursWorked = calculateWorkedHours(inTime, outTime);
      }
      accrual = Math.round(hoursWorked * hourlyRate * 100) / 100;
    }

    empTotalHours += hoursWorked;
    empTotalAccrual += accrual;

    insertAttStmt.run(
      day.date,
      empId,
      'ORTAK',
      1,
      inTime,
      outTime,
      hoursWorked,
      status,
      accrual,
      status === 'CALISTI' ? `${day.date} mesaisi (${hoursWorked} saat)` : `${day.date} izinli/çalışmadı`,
      adminId
    );
    createdAttendance++;
  }

  totalCalculatedAccrual += empTotalAccrual;
  console.log(`[#${empId}] ${empName.padEnd(22)} | Saatlik: ${hourlyRate.toString().padStart(3)} TL | Saat: ${empTotalHours.toFixed(2).padStart(5)} | Hakediş: ${empTotalAccrual.toFixed(2).padStart(8)} TL | Excel: ${excelTotal.toFixed(2).padStart(8)} TL`);
}

console.log('--- 4. Kontrol ve Doğrulama Raporu ---');
console.log(`Toplam Oluşturulan Personel: ${createdEmployees} (Beklenen: 36)`);
console.log(`Toplam Puantaj Kaydı: ${createdAttendance} (Beklenen: 144)`);
console.log(`Toplam Hesaplanan Hakediş: ${totalCalculatedAccrual.toFixed(2)} TL`);
console.log(`Toplam Excel Hakediş: ${totalExcelAccrual.toFixed(2)} TL`);

const diff = Math.abs(totalCalculatedAccrual - totalExcelAccrual);
if (diff < 0.1) {
  console.log('✅ MÜKEMMEL EŞLEŞME: Excel ile veritabanı birebir kuruşu kuruşuna eşleşti!');
} else {
  console.log(`⚠️ Fark tespit edildi: ${diff.toFixed(2)} TL`);
}
