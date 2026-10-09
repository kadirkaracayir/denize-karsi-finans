import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Sun, 
  Moon, 
  Save, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  RefreshCw,
  Building2
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function AttendancePuantaj() {
  const { customEndDate, refreshKey, triggerRefresh } = useFilters();
  const [targetDate, setTargetDate] = useState(customEndDate || '2026-10-08');
  const [grid, setGrid] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shiftFilter, setShiftFilter] = useState('ALL'); // 'ALL', 1 (Sabah), 2 (Akşam)
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showReasonModal, setShowReasonModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    Promise.all([
      api.get('/employees/attendance', { date: targetDate }),
      api.get('/employees/shifts')
    ])
      .then(([attRes, shiftRes]) => {
        if (attRes.success) {
          setGrid(attRes.grid);
          setIsClosed(attRes.isClosed);
        }
        if (shiftRes.success) {
          setShifts(shiftRes.shifts);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetDate, refreshKey]);

  const handleRowChange = (index, field, value) => {
    setGrid(prev => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };

      // Dynamic automatic recalculation of hours worked & accrual
      if (field === 'check_in_time' || field === 'check_out_time') {
        const inParts = (row.check_in_time || '09:00').split(':').map(Number);
        const outParts = (row.check_out_time || '17:00').split(':').map(Number);
        let diffHours = (outParts[0] + outParts[1] / 60) - (inParts[0] + inParts[1] / 60);
        if (diffHours < 0) diffHours += 24; // over midnight (e.g. 17:00 to 01:00 = 8h)
        row.hours_worked = Math.round(diffHours * 10) / 10;
      }

      // Compute accrual
      const status = row.status || 'CALISTI';
      const hours = parseFloat(row.hours_worked) || 0;
      const hourly = parseFloat(row.hourly_rate) || 0;
      const daily = parseFloat(row.daily_rate) || 0;

      if (status === 'CALISTI') {
        row.accrual_amount = row.accrual_type === 'SAATLIK' ? (hours * hourly) : daily;
      } else if (status === 'YARIM_GUN') {
        row.accrual_amount = row.accrual_type === 'SAATLIK' ? (hours * hourly) : (daily / 2);
      } else {
        // GELMEDI, IZINLI, RAPORLU
        row.accrual_amount = 0;
      }

      copy[index] = row;
      return copy;
    });
  };

  const handleSaveBatch = async (changeReason = null) => {
    setSaving(true);
    setMsg({ text: '', type: '' });

    try {
      const payload = {
        date: targetDate,
        items: grid
      };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/employees/attendance/batch', payload);
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setMsg({ text: err.message || 'Puantaj kaydedilemedi.', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredGrid = grid.filter(row => {
    if (shiftFilter === 'ALL') return true;
    return Number(row.shift_id) === Number(shiftFilter);
  });

  const totalCalculatedAccrual = grid.reduce((acc, r) => acc + (r.accrual_amount || 0), 0);
  const activeWorkingCount = grid.filter(r => r.status === 'CALISTI' || r.status === 'YARIM_GUN').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Günlük Personel Puantajı</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Giriş-çıkış saatlerini ve durumunu kaydedin, hakedişler otomatik hesaplansın.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="text-xs bg-transparent border-0 font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSaveBatch()}
            disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Kaydediliyor...' : 'Puantajı Onayla ve Kaydet'}</span>
          </button>
        </div>
      </div>

      {isClosed && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center space-x-3 text-amber-800 text-xs">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Bu gün kapatılmıştır 🔒</span>
            <p className="mt-0.5 text-amber-700">
              Puantaj kaydında değişiklik yapıldığında sistem zorunlu gerekçe isteyecektir.
            </p>
          </div>
        </div>
      )}

      {msg.text && (
        <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Summary KPI Cards & Shift Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Vardiya Tabs */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setShiftFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              shiftFilter === 'ALL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'
            }`}
          >
            Tüm Vardiyalar ({grid.length})
          </button>
          <button
            onClick={() => setShiftFilter(1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              shiftFilter === 1 ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>☀ Sabah Vardiyası</span>
          </button>
          <button
            onClick={() => setShiftFilter(2)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
              shiftFilter === 2 ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-700'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>🌙 Akşam Vardiyası</span>
          </button>
        </div>

        {/* Live calculated totals */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <span className="text-slate-400">Çalışan:</span>
            <span className="font-bold text-slate-800 ml-1.5">{activeWorkingCount} Personel</span>
          </div>
          <div className="bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <span className="text-slate-400">Günün Toplam Hakedişi:</span>
            <span className="font-bold text-emerald-700 ml-1.5">{formatCurrency(totalCalculatedAccrual)}</span>
          </div>
        </div>
      </div>

      {/* Attendance Grid Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Personel</th>
                <th className="py-3 px-4">İşletme (Hakediş Yeri)</th>
                <th className="py-3 px-4">Vardiya</th>
                <th className="py-3 px-3 w-24">Giriş Saati</th>
                <th className="py-3 px-3 w-24">Çıkış Saati</th>
                <th className="py-3 px-3 w-20 text-center">Saat</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4 text-right">Otomatik Hakediş</th>
                <th className="py-3 px-4">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Puantaj yükleniyor...</td>
                </tr>
              ) : filteredGrid.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Bu vardiyada personel bulunmuyor.</td>
                </tr>
              ) : (
                filteredGrid.map((row) => {
                  const actualIdx = grid.findIndex(g => g.employee_id === row.employee_id);
                  return (
                    <tr key={row.employee_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{row.employee_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {row.employee_role} • {row.accrual_type === 'SAATLIK' ? `${formatCurrency(row.hourly_rate)}/s` : `${formatCurrency(row.daily_rate)}/gün`}
                        </div>
                      </td>

                      {/* İşletme Ataması (Section 14: Ortak Personel DK veya Palm puantajına atanır!) */}
                      <td className="py-3 px-4">
                        <select
                          value={row.business_id}
                          onChange={(e) => handleRowChange(actualIdx, 'business_id', e.target.value)}
                          className={`px-2 py-1 border rounded-lg font-bold text-xs ${
                            row.business_id === 'DK' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="DK">DK (Denize Karşı)</option>
                          <option value="PALM">Palm Beach</option>
                        </select>
                        {row.base_business_id === 'ORTAK' && (
                          <span className="block text-[10px] text-purple-600 font-semibold mt-0.5">Ortak Personel</span>
                        )}
                      </td>

                      {/* Vardiya */}
                      <td className="py-3 px-4">
                        <select
                          value={row.shift_id}
                          onChange={(e) => handleRowChange(actualIdx, 'shift_id', Number(e.target.value))}
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white"
                        >
                          {shifts.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Giriş Saati */}
                      <td className="py-3 px-3">
                        <input
                          type="time"
                          value={row.check_in_time || '09:00'}
                          onChange={(e) => handleRowChange(actualIdx, 'check_in_time', e.target.value)}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded-md text-xs text-center font-medium bg-white"
                        />
                      </td>

                      {/* Çıkış Saati */}
                      <td className="py-3 px-3">
                        <input
                          type="time"
                          value={row.check_out_time || '17:00'}
                          onChange={(e) => handleRowChange(actualIdx, 'check_out_time', e.target.value)}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded-md text-xs text-center font-medium bg-white"
                        />
                      </td>

                      {/* Çalışılan Saat */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          step="0.5"
                          value={row.hours_worked || 0}
                          onChange={(e) => handleRowChange(actualIdx, 'hours_worked', e.target.value)}
                          className="w-14 px-1.5 py-1 border border-slate-200 rounded-md text-xs text-center font-bold text-slate-800 bg-slate-50"
                        />
                      </td>

                      {/* Durum */}
                      <td className="py-3 px-4">
                        <select
                          value={row.status}
                          onChange={(e) => handleRowChange(actualIdx, 'status', e.target.value)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                            row.status === 'CALISTI' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            row.status === 'YARIM_GUN' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            row.status === 'IZINLI' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                            row.status === 'RAPORLU' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                            'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          <option value="CALISTI">✓ Çalıştı</option>
                          <option value="YARIM_GUN">½ Yarım Gün</option>
                          <option value="IZINLI">🏖 İzinli</option>
                          <option value="RAPORLU">🏥 Raporlu</option>
                          <option value="GELMEDI">✗ Gelmedi</option>
                        </select>
                      </td>

                      {/* Otomatik Hakediş Tutarı */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(row.accrual_amount)}
                        </span>
                      </td>

                      {/* Not */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Açıklama..."
                          value={row.notes || ''}
                          onChange={(e) => handleRowChange(actualIdx, 'notes', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs">
                <td colSpan={7} className="py-3.5 px-4">
                  GÜNÜN HESAPLANAN TOPLAM PERSONEL HAKEDİŞİ ({filteredGrid.length} Personel)
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-400 text-sm">
                  {formatCurrency(totalCalculatedAccrual)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        onConfirm={(reason) => {
          setShowReasonModal(false);
          handleSaveBatch(reason);
        }}
        title="Kapanmış Gün Puantajı Düzenleme"
      />
    </div>
  );
}
