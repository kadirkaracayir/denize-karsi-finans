import React, { useState, useEffect } from 'react';
import { 
  Landmark, 
  Save, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR, formatDateTimeTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function BankManagement() {
  const { customEndDate, refreshKey, triggerRefresh } = useFilters();
  const [targetDate, setTargetDate] = useState(customEndDate || '2026-10-08');
  const [bankData, setBankData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form inputs for today's entry
  const [dkBalance, setDkBalance] = useState('');
  const [dkNotes, setDkNotes] = useState('');
  const [palmBalance, setPalmBalance] = useState('');
  const [palmNotes, setPalmNotes] = useState('');

  const [savingBiz, setSavingBiz] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState(null);

  useEffect(() => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    api.get('/cash/bank-balances', { date: targetDate })
      .then(res => {
        if (res.success) {
          setBankData(res.bank);
          setHistory(res.history);
          setDkBalance(res.bank.dk.current || '');
          setDkNotes(res.bank.dk.notes || '');
          setPalmBalance(res.bank.palm.current || '');
          setPalmNotes(res.bank.palm.notes || '');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetDate, refreshKey]);

  const handleSave = async (business_id, balance, notes, changeReason = null) => {
    if (balance === '' || isNaN(balance)) {
      setMsg({ text: 'Lütfen geçerli bir bakiye tutarı giriniz.', type: 'error' });
      return;
    }

    setSavingBiz(business_id);
    setMsg({ text: '', type: '' });

    try {
      const payload = {
        business_id,
        date: targetDate,
        balance: parseFloat(balance),
        notes
      };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/cash/bank-balances', payload);
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setPendingSavePayload({ business_id, balance, notes });
        setShowReasonModal(true);
      } else {
        setMsg({ text: err.message || 'Banka bakiyesi kaydedilemedi.', type: 'error' });
      }
    } finally {
      setSavingBiz(null);
    }
  };

  const b = bankData;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Landmark className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Banka Bakiyeleri Yönetimi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Günlük gerçek banka bakiyelerini girin, dünkü bakiye ile değişim farkını inceleyin.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Tarih:</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="text-xs bg-transparent border-0 font-bold text-slate-800 focus:outline-none"
          />
        </div>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Ortak Banka Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            ORTAK BANKA BAKİYESİ (KONSOLİDE)
          </span>
          <div className="text-3xl font-black text-white">
            {formatCurrency(b?.ortak?.current)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            DK ({formatCurrency(b?.dk?.current)}) + Palm ({formatCurrency(b?.palm?.current)}) toplamıdır.
          </p>
        </div>

        <div className="bg-white/10 rounded-xl p-3.5 border border-white/10 text-right">
          <span className="text-[11px] text-slate-400 block">Düne Göre Net Değişim</span>
          <div className="flex items-center justify-end space-x-1.5 mt-0.5">
            {b?.ortak?.change >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
            <span className={`text-base font-bold ${b?.ortak?.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {b?.ortak?.change >= 0 ? '+' : ''}{formatCurrency(b?.ortak?.change)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Önceki Bakiye: {formatCurrency(b?.ortak?.previous)}
          </span>
        </div>
      </div>

      {/* Manual Entry Cards for DK and PALM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* DK Bank Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-extrabold text-blue-700 text-sm uppercase">DK Banka Hesabı</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700">İşletme 1</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Dünkü Bakiye:</span>
              <span className="font-semibold text-slate-700">{formatCurrency(b?.dk?.previous)}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Değişim:</span>
              <span className={`font-bold ${b?.dk?.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {b?.dk?.change >= 0 ? '+' : ''}{formatCurrency(b?.dk?.change)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Bugünkü Gerçek Bakiye (TL)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="215164.00"
                value={dkBalance}
                onChange={(e) => setDkBalance(e.target.value)}
                className="w-full px-3 py-2.5 pl-3 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="absolute right-3 top-2.5 font-bold text-slate-400">TL</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Ekstre / Hesap Notu
            </label>
            <input
              type="text"
              placeholder="Örn: Garanti BBVA Ticari Hesap Ekstresi"
              value={dkNotes}
              onChange={(e) => setDkNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSave('DK', dkBalance, dkNotes)}
            disabled={savingBiz === 'DK'}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingBiz === 'DK' ? 'Kaydediliyor...' : 'DK Banka Bakiyesini Kaydet'}</span>
          </button>
        </div>

        {/* PALM Bank Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-extrabold text-emerald-700 text-sm uppercase">Palm Banka Hesabı</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">İşletme 2</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Dünkü Bakiye:</span>
              <span className="font-semibold text-slate-700">{formatCurrency(b?.palm?.previous)}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Değişim:</span>
              <span className={`font-bold ${b?.palm?.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {b?.palm?.change >= 0 ? '+' : ''}{formatCurrency(b?.palm?.change)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Bugünkü Gerçek Bakiye (TL)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="50000.00"
                value={palmBalance}
                onChange={(e) => setPalmBalance(e.target.value)}
                className="w-full px-3 py-2.5 pl-3 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="absolute right-3 top-2.5 font-bold text-slate-400">TL</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Ekstre / Hesap Notu
            </label>
            <input
              type="text"
              placeholder="Örn: Akbank Şirket Hesabı"
              value={palmNotes}
              onChange={(e) => setPalmNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSave('PALM', palmBalance, palmNotes)}
            disabled={savingBiz === 'PALM'}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingBiz === 'PALM' ? 'Kaydediliyor...' : 'Palm Banka Bakiyesini Kaydet'}</span>
          </button>
        </div>
      </div>

      {/* History table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600">
            Geçmiş Banka Bakiye Girişleri
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                <th className="py-2.5 px-4">Tarih</th>
                <th className="py-2.5 px-4">İşletme</th>
                <th className="py-2.5 px-4">Bakiye</th>
                <th className="py-2.5 px-4">Açıklama / Not</th>
                <th className="py-2.5 px-4">Kaydeden</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-2 px-4 font-semibold text-slate-700">{formatDateTR(row.date)}</td>
                  <td className="py-2 px-4 font-bold">{row.business_id}</td>
                  <td className="py-2 px-4 font-bold text-slate-900">{formatCurrency(row.balance)}</td>
                  <td className="py-2 px-4 text-slate-500">{row.notes || '-'}</td>
                  <td className="py-2 px-4 text-slate-400">{row.created_by_name || 'Admin'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => {
          setShowReasonModal(false);
          setPendingSavePayload(null);
        }}
        onConfirm={(reason) => {
          if (pendingSavePayload) {
            handleSave(
              pendingSavePayload.business_id,
              pendingSavePayload.balance,
              pendingSavePayload.notes,
              reason
            );
          }
        }}
        title="Kapanmış Gün Banka Bakiyesi Düzenleme"
      />
    </div>
  );
}
