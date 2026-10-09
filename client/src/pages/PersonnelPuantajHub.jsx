import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  Coins, 
  FileSpreadsheet, 
  Download, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Check, 
  Zap, 
  Edit3, 
  Edit2,
  Trash2,
  AlertCircle, 
  CheckCircle2, 
  DollarSign,
  Wallet,
  Building2,
  Phone,
  ArrowUpRight,
  CreditCard,
  Save,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatCurrencyShort, formatDateTR, formatDateLongTR } from '../utils/formatters';
import { api } from '../services/api';

const STATUS_CYCLE = [null, 'CALISTI', 'YARIM_GUN', 'IZINLI', 'RAPORLU', 'GELMEDI'];

const STATUS_META = {
  CALISTI: { code: 'Ç', label: 'Çalıştı', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  YARIM_GUN: { code: '½', label: 'Yarım Gün', bg: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  IZINLI: { code: 'İ', label: 'İzinli / Tatil', bg: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  RAPORLU: { code: 'R', label: 'Raporlu', bg: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
  GELMEDI: { code: 'X', label: 'Devamsız', bg: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' }
};

function calcLiveHours(inTime, outTime) {
  if (!inTime || !outTime) return 0;
  if (inTime === '00:00' && outTime === '00:00') return 0;
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;
  if (inH === outH && inM === outM) return 0;
  let inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60; // gece vardiyası sarkması
  }
  const diffMinutes = outMinutes - inMinutes;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

export default function PersonnelPuantajHub() {
  const { user } = useAuth();
  const { customEndDate } = useFilters();

  // Active Tab: 'hours' (🕒 Günlük Saat Girişi & Düzenleme) | 'matrix' (📅 Aylık 1-31 PDKS) | 'weekly' (💵 Haftalık Pazar Ödeme)
  const [activeTab, setActiveTab] = useState('hours');

  const defaultDate = '2026-10-08';
  const initialYear = 2026;
  const initialMonth = 10;

  // Selected date for daily time entry
  const [dailyDate, setDailyDate] = useState(defaultDate);

  // Selected year & month for monthly matrix
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  // Active dates with attendance entries in system
  const [activeDates, setActiveDates] = useState([]);
  const [matrixViewMode, setMatrixViewMode] = useState('times'); // 'times' | 'status'
  const [excelMatrixData, setExcelMatrixData] = useState(null);

  // State data
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyPeriodMode, setWeeklyPeriodMode] = useState('all'); // 'all' | 'week' | 'custom'
  const [weeklyCustomStartDate, setWeeklyCustomStartDate] = useState('2026-10-05');
  const [weeklyCustomEndDate, setWeeklyCustomEndDate] = useState('2026-10-08');
  const [weeklySearchQuery, setWeeklySearchQuery] = useState('');
  const [weeklyOnlyWorking, setWeeklyOnlyWorking] = useState(false);
  const [matrixData, setMatrixData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // In-line daily time form edits state: { [empId]: { check_in_time, check_out_time, status, hours_worked, accrual_amount, notes } }
  const [timeRowState, setTimeRowState] = useState({});
  const [savingRowId, setSavingRowId] = useState(null);

  // Modals state
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isAdvanceMode, setIsAdvanceMode] = useState(false); // true if entering Avans
  const [selectedEmpForPayment, setSelectedEmpForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState('DK_KASA');
  const [paymentDesc, setPaymentDesc] = useState('Personel Avansı');
  const [paymentDate, setPaymentDate] = useState(defaultDate);

  // New Employee Form state (Daima ORTAK Personel)
  const [empModalTab, setEmpModalTab] = useState('create'); // 'create' | 'manage'
  const [editingEmp, setEditingEmp] = useState(null);
  const [newEmp, setNewEmp] = useState({
    name: '',
    phone: '',
    business_id: 'ORTAK',
    role: 'Garson',
    department: 'Servis',
    accrual_type: 'SAATLIK',
    hourly_rate: '250',
    daily_rate: '2000',
    payment_period: 'HAFTALIK'
  });
  const [createEmpError, setCreateEmpError] = useState('');
  const [isCreatingEmp, setIsCreatingEmp] = useState(false);

  // Load Active Dates
  const loadActiveDates = useCallback(async () => {
    try {
      const res = await api.get('/employees/attendance/active-dates');
      if (res.success && res.dates && res.dates.length > 0) {
        setActiveDates(res.dates);
        const datesList = res.dates.map(d => d.date);
        if (!datesList.includes(dailyDate)) {
          setDailyDate(res.dates[0].date);
        }
      }
    } catch (err) {
      console.error('Active dates load error:', err);
    }
  }, [dailyDate]);

  // Load Excel Matrix (October 2026 - 4 Days)
  const loadExcelMatrix = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get('/employees/attendance/monthly-matrix', {
        year: 2026,
        month: 10
      });
      if (data.success) {
        setExcelMatrixData(data);
      }
    } catch (err) {
      console.error('Excel matrix load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load Daily Attendance
  const loadDailyAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/employees/attendance', { date: dailyDate });
      if (res.success && res.grid) {
        setDailyAttendance(res.grid);
        // Initialize editable time row states
        const initialStates = {};
        res.grid.forEach(emp => {
          const inT = emp.check_in_time || '00:00';
          const outT = emp.check_out_time || '00:00';
          const calculatedHours = emp.hours_worked ?? calcLiveHours(inT, outT);
          const hourlyRate = parseFloat(emp.hourly_rate) || 0;
          let calculatedAccrual = emp.accrual_amount;
          if (calculatedAccrual === undefined || calculatedAccrual === null) {
            calculatedAccrual = (emp.status === 'CALISTI' || emp.status === 'YARIM_GUN')
              ? Math.round(calculatedHours * hourlyRate * 100) / 100
              : 0;
          }

          initialStates[emp.employee_id] = {
            check_in_time: inT,
            check_out_time: outT,
            status: emp.status || '', // Boş başlar, kullanıcı kendisi işaretler (otomatik CALISTI gelmez)
            hours_worked: calculatedHours,
            accrual_amount: calculatedAccrual,
            notes: emp.notes || ''
          };
        });
        setTimeRowState(initialStates);
      }
    } catch (err) {
      console.error('Daily attendance load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dailyDate]);

  // Load Weekly Summary (Pazar günleri haftalık ödeme dökümü & Dönemsel Özet)
  const loadWeeklySummary = useCallback(async (customParams = null) => {
    try {
      setIsLoading(true);
      let params = {};
      if (customParams) {
        params = customParams;
      } else if (weeklyPeriodMode === 'all') {
        params = { period: 'all' };
      } else if (weeklyPeriodMode === 'custom' && weeklyCustomStartDate && weeklyCustomEndDate) {
        params = { startDate: weeklyCustomStartDate, endDate: weeklyCustomEndDate };
      } else {
        params = { date: dailyDate || '2026-09-08' };
      }

      const res = await api.get('/employees/attendance/weekly-summary', params);
      if (res.success) {
        setWeeklySummary(res);
      }
    } catch (err) {
      console.error('Weekly summary load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [weeklyPeriodMode, weeklyCustomStartDate, weeklyCustomEndDate, dailyDate]);

  // Load Monthly Matrix
  const loadMatrix = useCallback(async () => {
    try {
      const data = await api.get('/employees/attendance/monthly-matrix', {
        year: selectedYear,
        month: selectedMonth
      });
      if (data.success) {
        setMatrixData(data);
      }
    } catch (err) {
      console.error('Matrix load error:', err);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadActiveDates();
  }, [loadActiveDates]);

  useEffect(() => {
    if (activeTab === 'hours') {
      loadDailyAttendance();
    } else if (activeTab === 'weekly') {
      loadWeeklySummary();
    } else if (activeTab === 'matrix') {
      loadMatrix();
    }
  }, [activeTab, dailyDate, selectedYear, selectedMonth, loadDailyAttendance, loadWeeklySummary, loadMatrix]);

  // Live time changes calculation on row (SADECE Saatlik Ücret ile hesaplama)
  const handleTimeChange = (empId, field, value) => {
    setTimeRowState(prev => {
      const current = prev[empId] || {};
      const updated = { ...current, [field]: value };

      const inT = updated.check_in_time || '00:00';
      const outT = updated.check_out_time || '00:00';
      const calculatedHours = calcLiveHours(inT, outT);

      // SADECE Saatlik Ücret ile hesaplama
      const empInfo = dailyAttendance.find(e => e.employee_id === empId);
      const hourlyRate = parseFloat(empInfo?.hourly_rate) || 0;

      let calculatedAccrual = 0;
      if (updated.status === 'CALISTI' || updated.status === 'YARIM_GUN') {
        calculatedAccrual = Math.round(calculatedHours * hourlyRate * 100) / 100;
      } else {
        calculatedAccrual = 0;
      }

      updated.hours_worked = calculatedHours;
      updated.accrual_amount = calculatedAccrual;

      return {
        ...prev,
        [empId]: updated
      };
    });
  };

  // Save Single Employee's Time & Accrual
  const handleSaveEmployeeTime = async (empId) => {
    const row = timeRowState[empId];
    if (!row) return;

    if (!row.status) {
      alert('Lütfen personelin durumunu (Çalıştı, Yarım Gün, İzinli vb.) işaretleyiniz.');
      return;
    }

    setSavingRowId(empId);
    try {
      const res = await api.post('/employees/attendance/time-entry', {
        employee_id: empId,
        date: dailyDate,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        status: row.status,
        notes: row.notes || ''
      });

      if (res.success) {
        setToastMessage({ type: 'success', text: res.message });
        setTimeout(() => setToastMessage(null), 4000);
        loadDailyAttendance();
      } else {
        alert(res.message || 'Saat kaydedilemedi.');
      }
    } catch (err) {
      alert(err.message || 'Saat kaydedilirken hata oluştu.');
    } finally {
      setSavingRowId(null);
    }
  };

  const [isSavingAll, setIsSavingAll] = useState(false);

  // Save ALL Employees' Time & Accrual
  const handleSaveAllAttendance = async () => {
    const keys = Object.keys(timeRowState);
    if (keys.length === 0) return;

    setIsSavingAll(true);
    let successCount = 0;
    try {
      const promises = keys.map(empId => {
        const row = timeRowState[empId];
        if (!row || !row.status) return null;
        return api.post('/employees/attendance/time-entry', {
          employee_id: parseInt(empId, 10),
          date: dailyDate,
          check_in_time: row.check_in_time,
          check_out_time: row.check_out_time,
          status: row.status,
          notes: row.notes || ''
        }).then(res => {
          if (res.success) successCount++;
        }).catch(err => {
          console.error(`Puantaj kaydedilemedi (ID ${empId}):`, err);
        });
      }).filter(Boolean);

      if (promises.length === 0) {
        alert('Kaydedilecek personellerin durumunu (Çalıştı, İzinli vb.) işaretleyiniz.');
        setIsSavingAll(false);
        return;
      }

      await Promise.all(promises);

      setToastMessage({
        type: 'success',
        text: `Günün puantajı başarıyla kaydedildi! (${successCount} personel güncellendi)`
      });
      setTimeout(() => setToastMessage(null), 4000);
      loadDailyAttendance();
      loadWeeklySummary();
    } catch (err) {
      alert('Puantaj kaydedilirken hata oluştu: ' + (err.message || ''));
    } finally {
      setIsSavingAll(false);
    }
  };

  // PDF Export for Weekly Summary & Sunday Payouts (Haftalık & Pazar Ödeme Dökümü PDF)
  const handlePrintWeeklyPDF = () => {
    if (!weeklySummary) {
      alert('Haftalık özet verisi bulunamadı.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=700');
    if (!printWindow) {
      alert('Yazdırma penceresi açılamadı. Lütfen tarayıcı açılır pencerelerine izin veriniz.');
      return;
    }

    const employeesToPrint = (weeklySummary.employees || []).filter(e => !weeklyOnlyWorking || e.weekly_hours > 0 || e.weekly_accrual > 0);

    const rowsHtml = employeesToPrint.map((emp, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px 6px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 6px; font-weight: bold; color: #0f172a;">${emp.name}</td>
        <td style="padding: 8px 6px; color: #64748b;">${emp.role || 'Personel'}</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: bold; color: #1e40af;">${emp.weekly_hours} sa</td>
        <td style="padding: 8px 6px; text-align: right; color: #475569;">${emp.hourly_rate} TL / sa</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: bold; color: #0f172a;">${formatCurrency(emp.weekly_accrual)}</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: bold; color: #b45309;">${emp.weekly_advances > 0 ? `-${formatCurrency(emp.weekly_advances)}` : '₺0'}</td>
        <td style="padding: 8px 6px; text-align: right; color: #2563eb;">${emp.weekly_paid > 0 ? formatCurrency(emp.weekly_paid) : '₺0'}</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 900; color: #047857; background-color: #ecfdf5; font-size: 12px;">${formatCurrency(emp.pazar_remaining)}</td>
        <td style="padding: 8px 6px; width: 120px; border-bottom: 1px dashed #cbd5e1;"></td>
      </tr>
    `).join('');

    const displayPeriod = weeklySummary.periodTitle || `${weeklySummary.startDate} — ${weeklySummary.endDate}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Personel Hakediş ve Ödeme Dökümü (${displayPeriod})</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
          h1, h2, h3, p { margin: 0; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
          .sub { font-size: 12px; color: #475569; margin-top: 4px; }
          .badge { background: #0f172a; color: white; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
          .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; }
          .kpi-title { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; }
          .kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f5f9; padding: 9px 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; text-align: left; }
          tfoot tr td { padding: 10px 6px; font-size: 11px; font-weight: 900; background: #f8fafc; border-top: 2px solid #0f172a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
          .sig-box { width: 220px; text-align: center; border-top: 1px solid #0f172a; padding-top: 8px; font-size: 11px; color: #334155; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">DENİZE KARŞI & PALM BEACH</div>
            <div class="sub">HAFTALIK & DÖNEMSEL PERSONEL PUANTAJ & HAKEDİŞ ÖDEME DÖKÜMÜ</div>
          </div>
          <div>
            <span class="badge">${displayPeriod}</span>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Toplam Çalışılan Saat</div>
            <div class="kpi-val" style="color: #1e40af;">${weeklySummary?.totals?.totalWeeklyHours || 0} Saat</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Haftalık Toplam Hakediş</div>
            <div class="kpi-val">${formatCurrency(weeklySummary?.totals?.totalWeeklyAccrual || 0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Toplam Verilen Avans</div>
            <div class="kpi-val" style="color: #b45309;">-${formatCurrency(weeklySummary?.totals?.totalWeeklyAdvances || 0)}</div>
          </div>
          <div class="kpi-card" style="background: #ecfdf5; border-color: #a7f3d0;">
            <div class="kpi-title" style="color: #047857;">Pazar Kalan Net Ödeme Tutarı</div>
            <div class="kpi-val" style="color: #047857;">${formatCurrency(weeklySummary?.totals?.totalPazarRemaining || 0)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Personel Adı</th>
              <th>Görevi</th>
              <th style="text-align: right;">Çalışılan Saat</th>
              <th style="text-align: right;">Saatlik Ücret</th>
              <th style="text-align: right;">Haftalık Hakediş</th>
              <th style="text-align: right;">Alınan Avans</th>
              <th style="text-align: right;">Haftalık Ödenen</th>
              <th style="text-align: right; background: #ecfdf5; color: #065f46;">Pazar Ödenecek</th>
              <th style="text-align: center; width: 120px;">Personel İmzası</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">GENEL TOPLAM</td>
              <td style="text-align: right; color: #1e40af;">${weeklySummary?.totals?.totalWeeklyHours || 0} sa</td>
              <td style="text-align: right;">-</td>
              <td style="text-align: right;">${formatCurrency(weeklySummary?.totals?.totalWeeklyAccrual || 0)}</td>
              <td style="text-align: right; color: #b45309;">${formatCurrency(weeklySummary?.totals?.totalWeeklyAdvances || 0)}</td>
              <td style="text-align: right; color: #2563eb;">${formatCurrency(weeklySummary?.totals?.totalWeeklyPaid || 0)}</td>
              <td style="text-align: right; color: #047857; background-color: #d1fae5;">${formatCurrency(weeklySummary?.totals?.totalPazarRemaining || 0)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <strong>Hazırlayan (Kasa Sorumlusu)</strong><br/><br/><br/>
            İmza / Tarih
          </div>
          <div class="sig-box">
            <strong>Onaylayan (İşletme Yönetimi)</strong><br/><br/><br/>
            İmza / Tarih
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // PDF Export for Daily Attendance (Günlük Saat & Hakediş Dökümü PDF)
  const handlePrintDailyPDF = () => {
    if (!dailyAttendance || dailyAttendance.length === 0) {
      alert('Günlük puantaj verisi bulunamadı.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=950,height=700');
    if (!printWindow) {
      alert('Yazdırma penceresi açılamadı. Lütfen tarayıcı açılır pencerelerine izin veriniz.');
      return;
    }

    const rowsHtml = dailyAttendance.map((emp, idx) => {
      const row = timeRowState[emp.employee_id] || {
        check_in_time: emp.check_in_time || '00:00',
        check_out_time: emp.check_out_time || '00:00',
        status: emp.status || '',
        hours_worked: emp.hours_worked || 0,
        accrual_amount: emp.accrual_amount || 0
      };

      const statusLabel = STATUS_META[row.status]?.label || (row.status || 'İşaretsiz');

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px 6px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 8px 6px; font-weight: bold; color: #0f172a;">${emp.employee_name}</td>
          <td style="padding: 8px 6px; color: #64748b;">${emp.employee_role || 'Personel'}</td>
          <td style="padding: 8px 6px; text-align: center; font-weight: bold;">${statusLabel}</td>
          <td style="padding: 8px 6px; text-align: center;">${row.check_in_time}</td>
          <td style="padding: 8px 6px; text-align: center;">${row.check_out_time}</td>
          <td style="padding: 8px 6px; text-align: center; font-weight: bold; color: #1e40af;">${row.hours_worked} sa</td>
          <td style="padding: 8px 6px; text-align: right;">${emp.hourly_rate} TL / sa</td>
          <td style="padding: 8px 6px; text-align: right; font-weight: bold; color: #047857;">${formatCurrency(row.accrual_amount)}</td>
          <td style="padding: 8px 6px; text-align: right; color: #b45309;">${emp.today_advance > 0 ? `-${formatCurrency(emp.today_advance)}` : '₺0'}</td>
          <td style="padding: 8px 6px; width: 100px; border-bottom: 1px dashed #cbd5e1;"></td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Günlük Personel Puantaj Dökümü (${dailyDate})</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
          h1, h2, h3, p { margin: 0; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title { font-size: 18px; font-weight: 900; text-transform: uppercase; }
          .sub { font-size: 12px; color: #475569; margin-top: 4px; }
          .badge { background: #0f172a; color: white; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f5f9; padding: 8px 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; text-align: left; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { width: 220px; text-align: center; border-top: 1px solid #0f172a; padding-top: 8px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">DENİZE KARŞI & PALM BEACH</div>
            <div class="sub">GÜNLÜK PERSONEL PUANTAJ VE ÇALIŞMA SAATLERİ DÖKÜMÜ</div>
          </div>
          <div>
            <span class="badge">Tarih: ${dailyDate}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Personel Adı</th>
              <th>Görevi</th>
              <th style="text-align: center;">Durum</th>
              <th style="text-align: center;">Giriş Saati</th>
              <th style="text-align: center;">Çıkış Saati</th>
              <th style="text-align: center;">Çalışılan Saat</th>
              <th style="text-align: right;">Saatlik Ücret</th>
              <th style="text-align: right;">Günlük Hakediş</th>
              <th style="text-align: right;">Verilen Avans</th>
              <th style="text-align: center; width: 100px;">Personel İmzası</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="signatures">
          <div class="sig-box"><strong>Kasa / Puantaj Sorumlusu</strong><br/><br/><br/>İmza</div>
          <div class="sig-box"><strong>İşletme Yönetimi</strong><br/><br/><br/>İmza</div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Open Quick Advance Modal for Employee
  const handleOpenAdvanceModal = (emp) => {
    setSelectedEmpForPayment(emp);
    setIsAdvanceMode(true);
    setPaymentAmount('');
    setPaymentSource('DK_KASA');
    setPaymentDesc(`${emp.employee_name || emp.name} - Elden Avans`);
    setPaymentDate(dailyDate);
    setShowPaymentModal(true);
  };

  // Open Weekly Pazar Payment Modal
  const handleOpenPazarPaymentModal = (emp) => {
    setSelectedEmpForPayment(emp);
    setIsAdvanceMode(false);
    const suggestedAmount = emp.pazar_remaining ?? emp.current_debt ?? '';
    setPaymentAmount(suggestedAmount > 0 ? String(suggestedAmount) : '');
    setPaymentSource('DK_KASA');
    setPaymentDesc(`${emp.employee_name || emp.name} - Pazar Günü Haftalık Hakediş Kapanış Ödemesi`);
    setPaymentDate(dailyDate);
    setShowPaymentModal(true);
  };

  // Submit Payment / Advance
  const handleSavePaymentOrAdvance = async (e) => {
    e.preventDefault();
    if (!selectedEmpForPayment || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    try {
      const empId = selectedEmpForPayment.employee_id || selectedEmpForPayment.id;
      const res = await api.post('/employees/payments', {
        date: paymentDate,
        employee_id: empId,
        period_info: isAdvanceMode ? 'Avans' : 'Haftalık Pazar Ödemesi',
        amount: parseFloat(paymentAmount),
        payment_source: paymentSource,
        description: paymentDesc
      });

      if (res.success) {
        setShowPaymentModal(false);
        setToastMessage({
          type: 'success',
          text: isAdvanceMode
            ? `${formatCurrency(parseFloat(paymentAmount))} Avans başarıyla ödendi ve bakiyeden düşüldü!`
            : `Hakediş ödemesi başarıyla kaydedildi!`
        });
        setTimeout(() => setToastMessage(null), 4000);
        if (activeTab === 'hours') loadDailyAttendance();
        if (activeTab === 'weekly') loadWeeklySummary();
        if (activeTab === 'matrix') loadMatrix();
      } else {
        alert(res.message || 'İşlem kaydedilemedi.');
      }
    } catch (err) {
      alert(err.message || 'Ödeme sırasında hata meydana geldi.');
    }
  };

  // Month navigation
  const changeMonth = (delta) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  // Excel Export for Monthly Matrix
  const handleExportExcel = () => {
    const token = localStorage.getItem('dk_auth_token') || localStorage.getItem('token');
    window.location.href = `/api/employees/attendance/export-excel?year=${selectedYear}&month=${selectedMonth}&token=${token}`;
  };

  // Excel Export for Date Range (2 Tarih Arası Puantaj ve Ödeme Dökümü)
  const handleExportRangeExcel = () => {
    const token = localStorage.getItem('dk_auth_token') || localStorage.getItem('token');
    const s = weeklyCustomStartDate || weeklySummary?.startDate || '2026-10-05';
    const e = weeklyCustomEndDate || weeklySummary?.endDate || '2026-10-08';
    window.location.href = `/api/employees/attendance/export-excel?startDate=${s}&endDate=${e}&token=${token}`;
  };

  // Create Employee
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setCreateEmpError('');
    if (!newEmp.name || !newEmp.name.trim()) {
      setCreateEmpError('Lütfen ad soyad alanını doldurunuz.');
      return;
    }

    setIsCreatingEmp(true);
    try {
      const payload = {
        name: newEmp.name.trim(),
        phone: newEmp.phone ? newEmp.phone.trim() : null,
        business_id: 'ORTAK',
        role: (newEmp.role || 'Personel').trim(),
        department: (newEmp.department || 'Servis').trim(),
        accrual_type: newEmp.accrual_type || 'SAATLIK',
        hourly_rate: parseFloat(newEmp.hourly_rate) || 0,
        daily_rate: parseFloat(newEmp.daily_rate) || 0,
        payment_period: 'HAFTALIK'
      };

      const data = await api.post('/employees', payload);
      if (data.success) {
        setShowAddEmpModal(false);
        setToastMessage({ type: 'success', text: `${payload.name} ortak personel olarak eklendi!` });
        setTimeout(() => setToastMessage(null), 4000);
        setNewEmp({
          name: '',
          phone: '',
          business_id: 'ORTAK',
          role: 'Garson',
          department: 'Servis',
          accrual_type: 'SAATLIK',
          hourly_rate: '250',
          daily_rate: '2000',
          payment_period: 'HAFTALIK'
        });
        loadDailyAttendance();
        loadWeeklySummary();
        loadMatrix();
      } else {
        setCreateEmpError(data.message || 'Personel eklenemedi.');
      }
    } catch (err) {
      setCreateEmpError(err.message || 'Personel eklenirken hata oluştu.');
    } finally {
      setIsCreatingEmp(false);
    }
  };

  // Open Edit Employee
  const handleOpenEditEmp = (emp) => {
    setEditingEmp({
      id: emp.id || emp.employee_id,
      name: emp.name || emp.employee_name || '',
      phone: emp.phone || '',
      role: emp.role || emp.employee_role || 'Garson',
      department: emp.department || 'Servis',
      accrual_type: emp.accrual_type || 'SAATLIK',
      hourly_rate: String(emp.hourly_rate ?? 250),
      daily_rate: String(emp.daily_rate ?? 2000),
      payment_period: emp.payment_period || 'HAFTALIK'
    });
    setEmpModalTab('create');
    setShowAddEmpModal(true);
    setCreateEmpError('');
  };

  // Update Employee
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmp?.name || !editingEmp.name.trim()) {
      setCreateEmpError('Lütfen ad soyad alanını doldurunuz.');
      return;
    }
    setIsCreatingEmp(true);
    setCreateEmpError('');
    try {
      const payload = {
        name: editingEmp.name.trim(),
        phone: editingEmp.phone ? editingEmp.phone.trim() : null,
        business_id: 'ORTAK',
        role: (editingEmp.role || 'Personel').trim(),
        department: (editingEmp.department || 'Servis').trim(),
        accrual_type: editingEmp.accrual_type || 'SAATLIK',
        hourly_rate: parseFloat(editingEmp.hourly_rate) || 0,
        daily_rate: parseFloat(editingEmp.daily_rate) || 0,
        payment_period: 'HAFTALIK'
      };
      const res = await api.put(`/employees/${editingEmp.id}`, payload);
      if (res.success) {
        setToastMessage({ type: 'success', text: `${payload.name} bilgileri başarıyla güncellendi!` });
        setTimeout(() => setToastMessage(null), 4000);
        setShowAddEmpModal(false);
        setEditingEmp(null);
        loadDailyAttendance();
        loadWeeklySummary();
        loadMatrix();
      } else {
        setCreateEmpError(res.message || 'Personel güncellenemedi.');
      }
    } catch (err) {
      setCreateEmpError(err.message || 'Güncellenirken hata oluştu.');
    } finally {
      setIsCreatingEmp(false);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = async (emp) => {
    const id = emp.id || emp.employee_id;
    const name = emp.name || emp.employee_name;
    if (!window.confirm(`${name} adlı personeli ve ilişkili tüm puantaj kayıtlarını silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      const res = await api.delete(`/employees/${id}`);
      if (res.success) {
        setToastMessage({ type: 'success', text: res.message || `${name} başarıyla silindi.` });
        setTimeout(() => setToastMessage(null), 4000);
        if (editingEmp?.id === id) setEditingEmp(null);
        loadDailyAttendance();
        loadWeeklySummary();
        loadMatrix();
      } else {
        alert(res.message || 'Personel silinemedi.');
      }
    } catch (err) {
      alert(err.message || 'Personel silinirken hata oluştu.');
    }
  };

  const monthNames = [
    '', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center space-x-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Personel Puantaj & Hakediş Sistemi</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Giriş/çıkış saatleri ile anlık hakediş hesabı, elden avans verme ve Pazar günleri haftalık hakediş kapanışı.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {['super_admin', 'business_admin', 'hr'].includes(user?.roleId) && (
            <button
              onClick={() => setShowAddEmpModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Personel Ekle</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center space-x-1.5"
            title="Excel Formatında İndir"
          >
            <Download className="w-4 h-4" />
            <span>Excel İndir (.XLSX)</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('hours')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'hours'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>🕒 Günlük Saat Girişi & Düzenleme</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>📅 Aylık 1-31 PDKS Çizelgesi</span>
        </button>

        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'weekly'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>📅 2 Tarih Arası Puantaj & Hakediş Dökümü</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SAAT GİRİŞİ & ANLIK HAKEDİŞ HESAPLAMA (Örn: 08:30 - 16:00) */}
      {/* ========================================================= */}
      {activeTab === 'hours' && (
        <div className="space-y-4">
          {/* Quick Date Chips Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Kayıtlı Puantaj Günleri:</span>
            </span>
            {activeDates.map(d => {
              const isSelected = dailyDate === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setDailyDate(d.date)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400'
                      : 'bg-slate-50 hover:bg-blue-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDateTR(d.date)}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {d.worked_count} Kişi
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setDailyDate(new Date().toISOString().split('T')[0])}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ml-auto ${
                dailyDate === new Date().toISOString().split('T')[0]
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span>Bugün ({formatDateTR(new Date().toISOString().split('T')[0])})</span>
            </button>
          </div>

          {/* Date Picker Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-700">Seçili Gün:</span>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                {formatDateLongTR(dailyDate)}
              </span>
            </div>

            <div className="text-xs text-slate-500 flex items-center space-x-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Giriş ve çıkış saatleri değiştirildiğinde çalışma saati ve hakediş anında yeniden hesaplanır.</span>
            </div>
          </div>

          {/* Time Entry Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Günün Personel Çalışma Saatleri & Hakediş Dökümü
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  Toplam {dailyAttendance.length} Ortak Personel
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveAllAttendance}
                  disabled={isSavingAll || dailyAttendance.length === 0}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  title="Listelenen tüm personellerin saat ve hakedişlerini tek tıkla kaydeder"
                >
                  {isSavingAll ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>💾 Tüm Puantajı Kaydet</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handlePrintDailyPDF}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center space-x-1.5 self-start sm:self-auto shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>📄 PDF Döküm</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Personel</th>
                    <th className="py-3 px-3">Durum (İşaretle)</th>
                    <th className="py-3 px-3 text-center text-emerald-800 bg-emerald-50/60 font-black">🟢 Giriş Saati</th>
                    <th className="py-3 px-3 text-center text-rose-800 bg-rose-50/60 font-black">🔴 Çıkış Saati</th>
                    <th className="py-3 px-3 text-center text-blue-800 bg-blue-50/60 font-black">⏱️ Çalışılan Süre</th>
                    <th className="py-3 px-3 text-right">Saatlik Ücret</th>
                    <th className="py-3 px-3 text-right">Hesaplanan Hakediş</th>
                    <th className="py-3 px-3 text-right">Günün Avansı</th>
                    <th className="py-3 px-3 text-center">Hızlı İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyAttendance.map((emp) => {
                    const row = timeRowState[emp.employee_id] || {
                      check_in_time: emp.check_in_time || '00:00',
                      check_out_time: emp.check_out_time || '00:00',
                      status: emp.status || '',
                      hours_worked: emp.hours_worked || 0,
                      accrual_amount: emp.accrual_amount || 0
                    };

                    const isSaving = savingRowId === emp.employee_id;

                    return (
                      <tr key={emp.employee_id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Personel Info */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{emp.employee_name}</div>
                          <div className="text-[10px] text-slate-400">
                            {emp.employee_role || 'Ortak Personel'}
                          </div>
                        </td>

                        {/* Status Select: Otomatik Çalıştı gelmez, kullanıcı işaretler */}
                        <td className="py-3 px-3">
                          <select
                            value={row.status || ''}
                            onChange={(e) => handleTimeChange(emp.employee_id, 'status', e.target.value)}
                            className={`px-2 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                              row.status === 'CALISTI'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : row.status === 'YARIM_GUN'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : row.status === 'IZINLI'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : row.status === 'RAPORLU'
                                ? 'bg-purple-50 text-purple-800 border-purple-300'
                                : row.status === 'GELMEDI'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-slate-50 text-slate-500 border-slate-300'
                            }`}
                          >
                            <option value="">— İşaretsiz (Seçiniz) —</option>
                            <option value="CALISTI">✅ Çalıştı (Ç)</option>
                            <option value="YARIM_GUN">½ Yarım Gün</option>
                            <option value="IZINLI">🏖️ İzinli (İ)</option>
                            <option value="RAPORLU">🩺 Raporlu (R)</option>
                            <option value="GELMEDI">❌ Devamsız (X)</option>
                          </select>
                        </td>

                        {/* Check-in Time */}
                        <td className="py-3 px-3 text-center bg-emerald-50/20">
                          <input
                            type="time"
                            value={row.check_in_time || '00:00'}
                            onChange={(e) => handleTimeChange(emp.employee_id, 'check_in_time', e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-black text-center border w-24 focus:ring-2 focus:ring-emerald-500 ${
                              row.check_in_time && row.check_in_time !== '00:00'
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-1 ring-emerald-300 shadow-2xs'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          />
                        </td>

                        {/* Check-out Time */}
                        <td className="py-3 px-3 text-center bg-rose-50/20">
                          <input
                            type="time"
                            value={row.check_out_time || '00:00'}
                            onChange={(e) => handleTimeChange(emp.employee_id, 'check_out_time', e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-black text-center border w-24 focus:ring-2 focus:ring-rose-500 ${
                              row.check_out_time && row.check_out_time !== '00:00'
                                ? 'bg-rose-50 text-rose-950 border-rose-400 ring-1 ring-rose-300 shadow-2xs'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          />
                        </td>

                        {/* Hours Worked (Calculated live) */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black ${
                            row.hours_worked > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {row.hours_worked} Saat
                          </span>
                        </td>

                        {/* Hourly Rate (Sadece Saatlik Ücret) */}
                        <td className="py-3 px-3 text-right text-slate-700 font-bold">
                          {emp.hourly_rate} TL / sa
                        </td>

                        {/* Accrual Amount (Hours * Rate) */}
                        <td className="py-3 px-3 text-right font-black text-sm text-emerald-700">
                          {formatCurrency(row.accrual_amount)}
                        </td>

                        {/* Today's Advance */}
                        <td className="py-3 px-3 text-right">
                          {emp.today_advance > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              -{formatCurrency(emp.today_advance)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            {/* Save Time Button */}
                            <button
                              onClick={() => handleSaveEmployeeTime(emp.employee_id)}
                              disabled={isSaving}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1 shadow-2xs cursor-pointer"
                              title="Saat ve Hakedişi Kaydet"
                            >
                              {isSaving ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              <span>Kaydet</span>
                            </button>

                            {/* Give Advance Button (Aynı ekranda avans gir) */}
                            <button
                              onClick={() => handleOpenAdvanceModal(emp)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1 shadow-2xs cursor-pointer"
                              title="Personele Avans Ver"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Avans</span>
                            </button>

                            {/* Edit Employee Info Button */}
                            <button
                              onClick={() => handleOpenEditEmp(emp)}
                              className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-lg transition-colors cursor-pointer border border-slate-200"
                              title="Personel Bilgilerini Düzenle (Ücret, Rol vb.)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Employee Button */}
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-slate-200"
                              title="Personeli Sistemden Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Action & Summary Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-slate-600">
                  Toplam Personel: <strong className="text-slate-900">{dailyAttendance.length}</strong>
                </span>
                <span className="font-semibold text-slate-600">
                  Çalışan / İşaretlenen: <strong className="text-blue-700">{dailyAttendance.filter(e => {
                    const row = timeRowState[e.employee_id];
                    return (row?.status === 'CALISTI' || row?.status === 'YARIM_GUN');
                  }).length} Kişi</strong>
                </span>
                <span className="font-semibold text-slate-600">
                  Günün Toplam Hakedişi: <strong className="text-emerald-700 font-black">{formatCurrency(
                    Object.values(timeRowState).reduce((acc, curr) => acc + (curr?.accrual_amount || 0), 0)
                  )}</strong>
                </span>
              </div>
              <button
                onClick={handleSaveAllAttendance}
                disabled={isSavingAll || dailyAttendance.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSavingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>💾 Günün Tüm Puantajını Kaydet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: HAFTALIK & PAZAR ÖDEME DÖKÜMÜ (Pazar Günleri Haftalık Ödeme) */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* TAB 2: HAFTALIK & PAZAR ÖDEME DÖKÜMÜ (Pazar Günleri Haftalık Ödeme) */}
      {/* ========================================================= */}
      {activeTab === 'weekly' && (() => {
        const filteredWeeklyEmployees = (weeklySummary?.employees || []).filter(emp => {
          if (weeklyOnlyWorking && (emp.weekly_hours === 0 && emp.weekly_accrual === 0)) return false;
          if (weeklySearchQuery.trim()) {
            const q = weeklySearchQuery.toLowerCase();
            const nameMatch = emp.name?.toLowerCase().includes(q);
            const roleMatch = emp.role?.toLowerCase().includes(q);
            return nameMatch || roleMatch;
          }
          return true;
        });

        const sumFilteredHours = filteredWeeklyEmployees.reduce((acc, curr) => acc + (curr.weekly_hours || 0), 0);
        const sumFilteredAccrual = filteredWeeklyEmployees.reduce((acc, curr) => acc + (curr.weekly_accrual || 0), 0);
        const sumFilteredAdvances = filteredWeeklyEmployees.reduce((acc, curr) => acc + (curr.weekly_advances || 0), 0);
        const sumFilteredPaid = filteredWeeklyEmployees.reduce((acc, curr) => acc + (curr.weekly_paid || 0), 0);
        const sumFilteredRemaining = filteredWeeklyEmployees.reduce((acc, curr) => acc + (curr.pazar_remaining || 0), 0);

        return (
          <div className="space-y-4">
            {/* Quick Period & Week Switcher Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Puantaj ve Ödeme Dönemi Seçimi</h3>
                    <p className="text-[11px] text-slate-500">Pazar ödeme dökümünü tüm kayıtlı dönem veya haftalık bazda anında inceleyin.</p>
                  </div>
                </div>

                {/* Period Mode Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWeeklyPeriodMode('all');
                      loadWeeklySummary({ period: 'all' });
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
                      weeklyPeriodMode === 'all'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>🌟 Tüm Girilen Dönem (05-08 Ekim)</span>
                  </button>

                  {weeklySummary?.availableWeeks?.map(w => {
                    const isSelected = weeklyPeriodMode === 'week' && weeklySummary.startDate === w.startDate && weeklySummary.endDate === w.endDate;
                    return (
                      <button
                        key={w.startDate}
                        type="button"
                        onClick={() => {
                          setWeeklyPeriodMode('week');
                          loadWeeklySummary({ startDate: w.startDate, endDate: w.endDate });
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{w.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Range Picker */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>2 Tarih Arası Puantaj Seç:</span>
                </span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] text-slate-500 font-bold">Başlangıç:</span>
                  <input
                    type="date"
                    value={weeklyCustomStartDate || '2026-10-05'}
                    onChange={(e) => setWeeklyCustomStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-white text-slate-900 rounded-lg border border-slate-300 text-xs font-bold shadow-2xs focus:ring-2 focus:ring-emerald-500"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                </div>
                <span className="text-slate-400 font-bold">—</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] text-slate-500 font-bold">Bitiş:</span>
                  <input
                    type="date"
                    value={weeklyCustomEndDate || '2026-10-08'}
                    onChange={(e) => setWeeklyCustomEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-white text-slate-900 rounded-lg border border-slate-300 text-xs font-bold shadow-2xs focus:ring-2 focus:ring-emerald-500"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const s = weeklyCustomStartDate || '2026-10-05';
                    const e = weeklyCustomEndDate || '2026-10-08';
                    setWeeklyPeriodMode('custom');
                    loadWeeklySummary({ startDate: s, endDate: e });
                  }}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-black cursor-pointer shadow-xs transition-colors"
                >
                  📅 Puantajı Sorgula
                </button>
              </div>
            </div>

            {/* KPI Banner */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-300">
                  2 TARİH ARASI PERSONEL PUANTAJ & HAKEDİŞ DÖKÜMÜ
                </span>
                <h2 className="text-lg font-black text-white mt-1">
                  {weeklySummary?.periodTitle || `Dönem: ${weeklySummary?.startDate || weeklyCustomStartDate} — ${weeklySummary?.endDate || weeklyCustomEndDate}`}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Seçilen iki tarih arasındaki toplam çalışma saatleri, hakedişler, verilen avanslar ve ödenmesi gereken net rakamlar.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 p-3 rounded-xl border border-white/10 text-xs">
                <div>
                  <span className="text-slate-300 text-[10px] block">Toplam Çalışılan Saat</span>
                  <span className="text-base font-extrabold text-emerald-300">{weeklySummary?.totals?.totalWeeklyHours || 0} Saat</span>
                </div>
                <div>
                  <span className="text-slate-300 text-[10px] block">Dönem Toplam Hakediş</span>
                  <span className="text-base font-extrabold text-emerald-300">{formatCurrency(weeklySummary?.totals?.totalWeeklyAccrual || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-300 text-[10px] block">Verilen Avanslar</span>
                  <span className="text-base font-extrabold text-amber-300">-{formatCurrency(weeklySummary?.totals?.totalWeeklyAdvances || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-300 text-[10px] block">Ödememiz Gereken Tutar</span>
                  <span className="text-base font-black text-white">{formatCurrency(weeklySummary?.totals?.totalPazarRemaining || 0)}</span>
                </div>
              </div>
            </div>

            {/* Action Bar for Weekly PDF & Filter */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={weeklySearchQuery}
                  onChange={(e) => setWeeklySearchQuery(e.target.value)}
                  placeholder="🔍 Personel adı veya görevi ara..."
                  className="px-3 py-1.5 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 w-60 focus:ring-2 focus:ring-emerald-500"
                  style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                />
                <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={weeklyOnlyWorking}
                    onChange={(e) => setWeeklyOnlyWorking(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Sadece Çalışanları Listele ({weeklySummary?.employees?.filter(e => (e.weekly_hours > 0 || e.weekly_accrual > 0)).length || 0})</span>
                </label>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <button
                  onClick={handleExportRangeExcel}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="2 Tarih Arası Puantaj ve Ödeme Dökümünü Excel (.XLSX) olarak indir"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel İndir (.XLSX)</span>
                </button>

                <button
                  onClick={handlePrintWeeklyPDF}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>📄 PDF / Yazdır</span>
                </button>
              </div>
            </div>

            {/* Weekly Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Personel</th>
                      <th className="py-3 px-2 text-right">Dönem Saati</th>
                      <th className="py-3 px-3 text-right">Saat / Gün Ücreti</th>
                      <th className="py-3 px-3 text-right">Toplam Hakediş</th>
                      <th className="py-3 px-3 text-right">Alınan Avans</th>
                      <th className="py-3 px-3 text-right">Yapılan Ödeme</th>
                      <th className="py-3 px-3 text-right bg-emerald-50 text-emerald-900 font-black">Ödememiz Gereken Rakam</th>
                      <th className="py-3 px-3 text-right">Kümülatif Toplam Borç</th>
                      <th className="py-3 px-3 text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredWeeklyEmployees.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="py-8 text-center text-slate-400 font-semibold">
                          Seçilen dönemde veya arama kriterinde personel kaydı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filteredWeeklyEmployees.map((emp, idx) => (
                        <tr key={emp.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{emp.name}</div>
                            <div className="text-[10px] text-slate-400">{emp.role}</div>
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-blue-700">
                            {emp.weekly_hours} Saat
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600 font-medium">
                            {emp.accrual_type === 'SAATLIK' ? `${emp.hourly_rate} TL / sa` : `${emp.daily_rate} TL / gün`}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-slate-900">
                            {formatCurrency(emp.weekly_accrual)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-amber-700">
                            {emp.weekly_advances > 0 ? `-${formatCurrency(emp.weekly_advances)}` : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-blue-700">
                            {emp.weekly_paid > 0 ? formatCurrency(emp.weekly_paid) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-sm bg-emerald-50 text-emerald-800">
                            {formatCurrency(emp.pazar_remaining)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-700">
                            {formatCurrency(emp.overall_debt)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => handleOpenAdvanceModal(emp)}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                                title="Personele Avans Ver"
                              >
                                Avans
                              </button>
                              <button
                                onClick={() => handleOpenPazarPaymentModal(emp)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                                title="Pazar Hakedişini Öde"
                              >
                                Öde
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-black text-xs">
                    <tr>
                      <td colSpan="2" className="py-3 px-3">
                        GENEL TOPLAM ({filteredWeeklyEmployees.length} Personel)
                      </td>
                      <td className="py-3 px-2 text-right text-blue-300">
                        {Math.round(sumFilteredHours * 100) / 100} Saat
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">-</td>
                      <td className="py-3 px-3 text-right text-emerald-300">
                        {formatCurrency(sumFilteredAccrual)}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-300">
                        {sumFilteredAdvances > 0 ? `-${formatCurrency(sumFilteredAdvances)}` : '0 TL'}
                      </td>
                      <td className="py-3 px-3 text-right text-blue-300">
                        {formatCurrency(sumFilteredPaid)}
                      </td>
                      <td className="py-3 px-3 text-right bg-emerald-800 text-white text-sm">
                        {formatCurrency(sumFilteredRemaining)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">-</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* TAB 3: AYLIK 1-31 PDKS ÇİZELGESİ (Standart Excel Formatı) */}
      {/* ========================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Month selector bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-black text-sm text-slate-800">
                {monthNames[selectedMonth]} {selectedYear} Aylık Puantaj Çizelgesi
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => { setSelectedMonth(10); setSelectedYear(2026); }}
                className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedMonth === 10 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ekim 2026 (Kayıtlı Puantaj)
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-600">Görünüm:</span>
              <button
                type="button"
                onClick={() => setMatrixViewMode('times')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  matrixViewMode === 'times'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>🕒 Giriş / Çıkış Saatleri</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixViewMode('status')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  matrixViewMode === 'status'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>📋 Kodlar (Ç/İ)</span>
              </button>
            </div>
          </div>

          {/* 1-31 Grid Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="w-full text-xs text-center border-collapse">
                <thead className="bg-slate-900 text-white font-bold sticky top-0 z-20">
                  <tr>
                    <th className="py-2.5 px-3 text-left sticky left-0 z-30 bg-slate-900 w-36">Personel</th>
                    {matrixData?.daysHeader?.map((d) => (
                      <th
                        key={d.day}
                        className={`py-1.5 px-1 text-[10px] border-l border-slate-800 ${
                          matrixViewMode === 'times' ? 'min-w-[58px]' : 'min-w-[28px]'
                        } ${d.isWeekend ? 'bg-slate-800 text-amber-300' : ''}`}
                      >
                        <div>{d.day}</div>
                        <div className="text-[8px] opacity-75">{d.dayName}</div>
                      </th>
                    ))}
                    <th className="py-2.5 px-2 bg-slate-800 border-l border-slate-700">Gün</th>
                    <th className="py-2.5 px-2 bg-slate-800">Saat</th>
                    <th className="py-2.5 px-3 bg-emerald-950 text-emerald-300">Hakediş</th>
                    <th className="py-2.5 px-3 bg-blue-950 text-blue-300">Ödenen</th>
                    <th className="py-2.5 px-3 bg-rose-950 text-rose-300">Kalan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {matrixData?.employees?.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 text-left font-bold text-slate-900 sticky left-0 z-10 bg-white shadow-2xs whitespace-nowrap">
                        {emp.name}
                        <span className="block text-[9px] text-slate-400 font-normal">{emp.role}</span>
                      </td>

                      {/* 1..31 Day Cells */}
                      {matrixData?.daysHeader?.map((d) => {
                        const cell = emp.attendanceByDay?.[d.day];
                        const meta = STATUS_META[cell?.status];
                        const hasTimes = cell?.check_in_time && cell?.check_out_time && (cell.check_in_time !== '00:00' || cell.check_out_time !== '00:00');

                        return (
                          <td
                            key={d.day}
                            className={`py-1 px-0.5 border-l border-slate-100 text-[11px] font-black ${
                              d.isWeekend ? 'bg-slate-50/60' : ''
                            } ${matrixViewMode === 'times' ? 'min-w-[58px]' : 'min-w-[28px]'}`}
                          >
                            {meta ? (
                              matrixViewMode === 'times' && hasTimes ? (
                                <div
                                  className="flex flex-col items-center justify-center p-0.5 rounded bg-blue-50/70 border border-blue-200/80 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
                                  title={`${d.date}: ${emp.name}\nGiriş: ${cell.check_in_time}\nÇıkış: ${cell.check_out_time}\nSüre: ${cell.hours_worked} saat\nHakediş: ${formatCurrency(cell.accrual_amount)}`}
                                >
                                  <span className="text-[9px] font-black text-emerald-700 leading-tight">
                                    {cell.check_in_time}
                                  </span>
                                  <span className="text-[9px] font-black text-rose-700 leading-tight">
                                    {cell.check_out_time}
                                  </span>
                                  <span className="text-[8px] font-extrabold text-blue-600 bg-white px-1 rounded mt-0.5 border border-blue-100">
                                    {cell.hours_worked}s
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className={`inline-block w-6 h-6 leading-6 rounded text-center text-[10px] font-black ${meta.bg}`}
                                  title={`${d.date}: ${meta.label}${hasTimes ? ` (${cell.check_in_time} - ${cell.check_out_time})` : ''} (${cell.hours_worked} saat - ${cell.accrual_amount} TL)`}
                                >
                                  {meta.code}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Monthly Summaries */}
                      <td className="py-2 px-1 font-bold text-slate-800 border-l border-slate-200">
                        {emp.summary?.totalDaysWorked}
                      </td>
                      <td className="py-2 px-1 font-bold text-blue-700">
                        {emp.summary?.totalHoursWorked}
                      </td>
                      <td className="py-2 px-2 font-black text-emerald-700 bg-emerald-50/30">
                        {formatCurrency(emp.summary?.totalMonthAccrual)}
                      </td>
                      <td className="py-2 px-2 font-semibold text-blue-700 bg-blue-50/30">
                        {formatCurrency(emp.summary?.monthPaid)}
                      </td>
                      <td className="py-2 px-2 font-black text-rose-700 bg-rose-50/30">
                        {formatCurrency(emp.summary?.currentDebt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* QUICK AVANS & PAYMENT MODAL (Aynı ekranda avans gir) */}
      {/* ========================================================= */}
      {showPaymentModal && selectedEmpForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-xl ${isAdvanceMode ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isAdvanceMode ? <Zap className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {isAdvanceMode ? 'Personele Avans Ver' : 'Hakediş Ödemesi Yap'}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {selectedEmpForPayment.employee_name || selectedEmpForPayment.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePaymentOrAdvance} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {isAdvanceMode ? '⚡ Avans Tutarı (TL)' : 'Ödeme Tutarı (TL)'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tarih</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ödeme Kaynağı</label>
                  <select
                    value={paymentSource}
                    onChange={(e) => setPaymentSource(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  >
                    <option value="DK_KASA">💵 DK Nakit Kasa</option>
                    <option value="PALM_KASA">💵 Palm Nakit Kasa</option>
                    <option value="DK_BANKA">🏦 DK Banka</option>
                    <option value="PALM_BANKA">🏦 Palm Banka</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Açıklama</label>
                <input
                  type="text"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="Örn: Elden nakit avans verildi"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400"
                  style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white rounded-xl font-black shadow-md ${
                    isAdvanceMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isAdvanceMode ? '⚡ Avansı Kaydet' : 'Ödemeyi Tamamla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EMPLOYEE MODAL (Ortak Personel Ekleme, Düzenleme & Silme) */}
      {/* ========================================================= */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingEmp ? 'Personel Bilgilerini Düzenle' : 'Ortak Personel İşlemleri'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingEmp ? `${editingEmp.name} personelinin saatlik ücret ve bilgilerini güncelleyin veya silin.` : 'Yeni personel tanımlayın, mevcut personelleri düzenleyin veya silin.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddEmpModal(false);
                  setEditingEmp(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs when not directly editing a specific employee */}
            {!editingEmp && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setEmpModalTab('create')}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                    empModalTab === 'create' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>➕ Yeni Personel Ekle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmpModalTab('manage')}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                    empModalTab === 'manage' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>👥 Kayıtlı Personeller ({dailyAttendance.length})</span>
                </button>
              </div>
            )}

            {createEmpError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{createEmpError}</span>
              </div>
            )}

            {/* TAB 1: EDIT EXISTING EMPLOYEE */}
            {editingEmp && (
              <form onSubmit={handleUpdateEmployee} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ad Soyad *</label>
                  <input
                    type="text"
                    required
                    value={editingEmp.name}
                    onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Telefon</label>
                    <input
                      type="text"
                      value={editingEmp.phone}
                      onChange={(e) => setEditingEmp({ ...editingEmp, phone: e.target.value })}
                      placeholder="05XX XXX XX XX"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Görev / Rol</label>
                    <input
                      type="text"
                      value={editingEmp.role}
                      onChange={(e) => setEditingEmp({ ...editingEmp, role: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Hakediş Tipi</label>
                    <select
                      value={editingEmp.accrual_type}
                      onChange={(e) => setEditingEmp({ ...editingEmp, accrual_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    >
                      <option value="SAATLIK">Saatlik Ücret</option>
                      <option value="GUNLUK">Günlük Ücret</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {editingEmp.accrual_type === 'SAATLIK' ? 'Saatlik Ücret (TL)' : 'Günlük Ücret (TL)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editingEmp.accrual_type === 'SAATLIK' ? editingEmp.hourly_rate : editingEmp.daily_rate}
                      onChange={(e) => {
                        if (editingEmp.accrual_type === 'SAATLIK') {
                          setEditingEmp({ ...editingEmp, hourly_rate: e.target.value });
                        } else {
                          setEditingEmp({ ...editingEmp, daily_rate: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-blue-400 text-xs font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleDeleteEmployee(editingEmp)}
                    className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Personeli Sil</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditingEmp(null)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                    >
                      Geri
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingEmp}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-md flex items-center space-x-1 cursor-pointer"
                    >
                      {isCreatingEmp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Güncellemeleri Kaydet</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: CREATE NEW EMPLOYEE */}
            {!editingEmp && empModalTab === 'create' && (
              <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ad Soyad *</label>
                  <input
                    type="text"
                    required
                    value={newEmp.name}
                    onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                    placeholder="Örn: Mehmet Can"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Telefon</label>
                    <input
                      type="text"
                      value={newEmp.phone}
                      onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                      placeholder="05XX XXX XX XX"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Görev / Rol</label>
                    <input
                      type="text"
                      value={newEmp.role}
                      onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                      placeholder="Garson, Barmen, Aşçı"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Hakediş Tipi</label>
                    <select
                      value={newEmp.accrual_type}
                      onChange={(e) => setNewEmp({ ...newEmp, accrual_type: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    >
                      <option value="SAATLIK">Saatlik Ücret</option>
                      <option value="GUNLUK">Günlük Ücret</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {newEmp.accrual_type === 'SAATLIK' ? 'Saatlik Ücret (TL)' : 'Günlük Ücret (TL)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newEmp.accrual_type === 'SAATLIK' ? newEmp.hourly_rate : newEmp.daily_rate}
                      onChange={(e) => {
                        if (newEmp.accrual_type === 'SAATLIK') {
                          setNewEmp({ ...newEmp, hourly_rate: e.target.value });
                        } else {
                          setNewEmp({ ...newEmp, daily_rate: e.target.value });
                        }
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white rounded-xl border border-blue-400 text-xs font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between text-blue-900 font-bold">
                  <span>İşletme Statüsü:</span>
                  <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px]">
                    Ortak Personel (DK & Palm)
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEmpModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingEmp}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black shadow-md flex items-center space-x-1 cursor-pointer"
                  >
                    {isCreatingEmp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Personeli Kaydet</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: MANAGE / LIST REGISTERED EMPLOYEES (DÜZENLE & SİL) */}
            {!editingEmp && empModalTab === 'manage' && (
              <div className="space-y-3">
                {dailyAttendance.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Henüz kayıtlı personel bulunmuyor.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                    {dailyAttendance.map((emp) => (
                      <div
                        key={emp.employee_id}
                        className="py-2.5 px-3 flex items-center justify-between hover:bg-slate-50 rounded-xl transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{emp.employee_name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                            <span className="text-slate-600 font-semibold">{emp.employee_role || 'Personel'}</span>
                            <span>•</span>
                            <span className="text-blue-700 font-bold">{emp.hourly_rate} TL / sa</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditEmp(emp)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                            title="Bilgileri Düzenle"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Düzenle</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs transition-colors cursor-pointer"
                            title="Personeli Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddEmpModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
