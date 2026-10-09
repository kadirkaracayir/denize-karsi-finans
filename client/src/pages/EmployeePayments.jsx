import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  CreditCard, 
  Plus, 
  Trash2, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Calendar, 
  RefreshCw,
  X,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function EmployeePayments() {
  const { customEndDate, refreshKey, triggerRefresh } = useFilters();
  const [debtSummary, setDebtSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Payment Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    date: '2026-10-08',
    employee_id: '',
    period_info: 'Haftalık',
    amount: '',
    payment_source: 'DK_KASA',
    description: '',
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/employees/debt-summary', { date: customEndDate }),
      api.get('/employees/payments')
    ])
      .then(([debtRes, payRes]) => {
        if (debtRes.success) setDebtSummary(debtRes);
        if (payRes.success) setPayments(payRes.payments);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customEndDate, refreshKey]);

  const handleOpenPaymentModal = (emp = null) => {
    setSelectedEmp(emp);
    setPaymentForm({
      date: customEndDate || '2026-10-08',
      employee_id: emp ? emp.id : (debtSummary?.employees[0]?.id || ''),
      period_info: emp?.payment_period || 'Haftalık',
      amount: emp ? (emp.currentDebt > 0 ? emp.currentDebt : '') : '',
      payment_source: 'KASA',
      description: emp ? `${emp.name} Personel Hakediş Ödemesi` : 'Personel Ödemesi',
    });
    setMsg({ text: '', type: '' });
    setShowModal(true);
  };

  const handleSubmitPayment = async (changeReason = null) => {
    if (!paymentForm.employee_id || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setMsg({ text: 'Lütfen geçerli personel ve ödeme tutarı giriniz.', type: 'error' });
      return;
    }

    setSaving(true);
    setMsg({ text: '', type: '' });

    try {
      const payload = {
        ...paymentForm,
        amount: parseFloat(paymentForm.amount)
      };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/employees/payments', payload);
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        setShowModal(false);
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setMsg({ text: err.message || 'Ödeme kaydedilemedi.', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPayment = async (pId, changeReason = null) => {
    try {
      const res = await api.delete(`/employees/payments/${pId}`, changeReason ? { change_reason: changeReason } : {});
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        setCancelTarget(null);
        setShowReasonModal(false);
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setCancelTarget(pId);
        setShowReasonModal(true);
      } else {
        setMsg({ text: err.message || 'İptal edilemedi.', type: 'error' });
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Coins className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Personel Borç & Ödeme Takibi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personel kümülatif alacak/borç dengesi, devirler ve kısmi/tam ödeme yönetimi.
          </p>
        </div>

        <button
          onClick={() => handleOpenPaymentModal()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>+ Personel Ödemesi Yap</span>
        </button>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 1. SECTION: PERSONEL BORÇ & DEVİR TABLOSU */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Personel Kümülatif Borç Dengesi (Devir Takibi)</h3>
            <span className="text-[11px] text-slate-500">
              Önceki Borç + Bugünkü Hakediş = Toplam - Ödeme = Kalan Borç (Sonraki güne devreder)
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block uppercase font-bold">Toplam Ödenmemiş Borç</span>
            <span className="text-lg font-black text-rose-700">
              {formatCurrency(debtSummary?.totalCompanyDebt)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Personel</th>
                <th className="py-3 px-4">İşletme</th>
                <th className="py-3 px-4">Periyot</th>
                <th className="py-3 px-4 text-right">Önceki Borç (Devir)</th>
                <th className="py-3 px-4 text-right">Bugünkü Hakediş</th>
                <th className="py-3 px-4 text-right">Bugün Ödenen</th>
                <th className="py-3 px-4 text-right font-black text-slate-800">Kalan Net Borç</th>
                <th className="py-3 px-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : debtSummary?.employees?.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block">{emp.name}</span>
                    <span className="text-slate-400 text-[11px]">{emp.role}</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{emp.business_id}</td>
                  <td className="py-3 px-4 text-slate-500">{emp.payment_period}</td>
                  <td className="py-3 px-4 text-right text-slate-600 font-medium">
                    {formatCurrency(emp.priorDebt)}
                  </td>
                  <td className="py-3 px-4 text-right text-amber-700 font-bold">
                    +{formatCurrency(emp.todayAccrual)}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-700 font-bold">
                    -{formatCurrency(emp.todayPaid)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-black text-sm ${emp.currentDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {formatCurrency(emp.currentDebt)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleOpenPaymentModal(emp)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] border border-emerald-200 transition-colors"
                    >
                      Ödeme Yap
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. SECTION: ÖDEME GEÇMİŞİ TABLOSU */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="font-bold text-sm text-slate-800">Personel Ödeme Hareketleri Geçmişi</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Personel</th>
                <th className="py-3 px-4">Dönem</th>
                <th className="py-3 px-4">Ödeme Kaynağı</th>
                <th className="py-3 px-4">Açıklama</th>
                <th className="py-3 px-4 text-right">Ödenen Tutar</th>
                <th className="py-3 px-4 text-center">İptal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Henüz personel ödemesi bulunmuyor.</td>
                </tr>
              ) : payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-700">{formatDateTR(p.date)}</td>
                  <td className="py-2.5 px-4 font-bold text-slate-900">{p.employee_name}</td>
                  <td className="py-2.5 px-4 text-slate-500">{p.period_info || '-'}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {p.payment_source === 'KASA' || p.payment_source.includes('KASA') ? '💵 Nakit Kasa' : `🏦 ${p.payment_source}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 truncate max-w-[200px]">{p.description || '-'}</td>
                  <td className="py-2.5 px-4 text-right font-black text-blue-700 text-sm">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      onClick={() => handleCancelPayment(p.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Personel Ödemesi Yap</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Personel Seç</label>
                <select
                  value={paymentForm.employee_id}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const found = debtSummary?.employees.find(emp => String(emp.id) === String(empId));
                    setSelectedEmp(found || null);
                    setPaymentForm(prev => ({
                      ...prev,
                      employee_id: empId,
                      amount: found?.currentDebt > 0 ? found.currentDebt : prev.amount
                    }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
                >
                  {debtSummary?.employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role} - Kalan Borç: {formatCurrency(emp.currentDebt)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedEmp && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex justify-between items-center text-amber-900">
                  <span>Güncel Bekleyen Borç / Alacak:</span>
                  <span className="font-black text-sm">{formatCurrency(selectedEmp.currentDebt)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Ödeme Tarihi</label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Dönem Bilgisi</label>
                  <input
                    type="text"
                    placeholder="Örn: 1-7 Ekim veya Günlük"
                    value={paymentForm.period_info}
                    onChange={(e) => setPaymentForm({ ...paymentForm, period_info: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Ödeme Kaynağı</label>
                <select
                  value={paymentForm.payment_source}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_source: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                >
                  <option value="KASA">💵 Merkezi Nakit Kasa (Tek Kasa)</option>
                  <option value="DK_BANKA">🏦 DK Banka Hesabı</option>
                  <option value="PALM_BANKA">🏦 Palm Banka Hesabı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Ödenecek Tutar (TL)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3 py-2.5 pl-3 pr-10 border border-slate-300 rounded-xl font-bold text-slate-900 text-base focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 font-bold text-slate-400">TL</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  * Kısmi ödeme yapabilirsiniz; kalan borç bir sonraki döneme otomatik devir eder.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Açıklama</label>
                <input
                  type="text"
                  placeholder="Örn: Elden nakit avans veya maaş ödemesi"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmitPayment()}
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Kaydediliyor...' : 'Ödemeyi Gerçekleştir'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        onConfirm={(reason) => {
          setShowReasonModal(false);
          if (cancelTarget) {
            handleCancelPayment(cancelTarget, reason);
          } else {
            handleSubmitPayment(reason);
          }
        }}
        title="Kapanmış Gün Personel Ödemesi"
      />
    </div>
  );
}
