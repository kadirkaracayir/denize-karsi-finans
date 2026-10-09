import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Percent, 
  Save, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Landmark, 
  ArrowRight,
  TrendingDown,
  Info,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function CardPOSManagement() {
  const { customEndDate, refreshKey, triggerRefresh } = useFilters();
  const [targetDate, setTargetDate] = useState(customEndDate || '2026-10-08');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states for DK
  const [dkRate, setDkRate] = useState('2.5');
  const [dkRateDiff, setDkRateDiff] = useState('0');
  const [dkNotes, setDkNotes] = useState('');

  // Form states for Palm
  const [palmRate, setPalmRate] = useState('2.5');
  const [palmRateDiff, setPalmRateDiff] = useState('0');
  const [palmNotes, setPalmNotes] = useState('');

  const [savingBiz, setSavingBiz] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  useEffect(() => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    api.get('/cash/pos-settlement', { date: targetDate })
      .then(res => {
        if (res.success) {
          setData(res);
          const s = res.settlement;
          if (s.dk) {
            setDkRate(String(s.dk.komisyonOrani));
            setDkRateDiff(String(s.dk.oranFarki));
            setDkNotes(s.dk.notes || '');
          }
          if (s.palm) {
            setPalmRate(String(s.palm.komisyonOrani));
            setPalmRateDiff(String(s.palm.oranFarki));
            setPalmNotes(s.palm.notes || '');
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetDate, refreshKey]);

  const handleSave = async (business_id, commission_rate, rate_difference, notes, changeReason = null) => {
    setSavingBiz(business_id);
    setMsg({ text: '', type: '' });

    try {
      const payload = {
        business_id,
        date: targetDate,
        commission_rate: parseFloat(commission_rate) || 0,
        rate_difference: parseFloat(rate_difference) || 0,
        notes
      };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/cash/pos-settlement', payload);
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setPendingPayload({ business_id, commission_rate, rate_difference, notes });
        setShowReasonModal(true);
      } else {
        setMsg({ text: err.message || 'Kredi kartı oranları kaydedilemedi.', type: 'error' });
      }
    } finally {
      setSavingBiz(null);
    }
  };

  const s = data?.settlement;

  // Live client preview calculation for DK
  const dkGross = s?.dk?.brut || 0;
  const dkCalcComm = Math.round((dkGross * (parseFloat(dkRate) || 0) / 100) * 100) / 100;
  const dkCalcNet = Math.round((dkGross - dkCalcComm - (parseFloat(dkRateDiff) || 0)) * 100) / 100;

  // Live client preview calculation for Palm
  const palmGross = s?.palm?.brut || 0;
  const palmCalcComm = Math.round((palmGross * (parseFloat(palmRate) || 0) / 100) * 100) / 100;
  const palmCalcNet = Math.round((palmGross - palmCalcComm - (parseFloat(palmRateDiff) || 0)) * 100) / 100;

  const totalGross = dkGross + palmGross;
  const totalComm = dkCalcComm + palmCalcComm;
  const totalDiff = (parseFloat(dkRateDiff) || 0) + (parseFloat(palmRateDiff) || 0);
  const totalNet = dkCalcNet + palmCalcNet;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Kredi Kartları & POS Komisyon Yönetimi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            DK ve Palm kredi kartı kasalarını ayrı takip edin, komisyon oranlarını ve gün sonu oran farklarını yönetin.
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

      {/* Info Notice about Cash vs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start space-x-3 text-emerald-900 text-xs">
          <Wallet className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Nakit Kasa Kuralı:</span>
            <p className="text-emerald-800 mt-0.5">
              DK ve Palm nakitleri <strong>TEK BİR NAKİT KASADA</strong> toplanır. Güncel Tek Nakit Kasa Bakiyesi:{' '}
              <strong className="underline text-emerald-950 font-black">{formatCurrency(data?.tekNakitKasa?.toplamBakiye)}</strong>
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start space-x-3 text-blue-900 text-xs">
          <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Kredi Kartları Kuralı:</span>
            <p className="text-blue-800 mt-0.5">
              Kredi kartları <strong>AYRI KASALARDA</strong> toplanır. Her işletmenin POS komisyon oranı ve gün sonu oran farkı bağımsız hesaplanarak net tutar bankaya aktarılır.
            </p>
          </div>
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

      {/* Ortak Kredi Kartı Konsolide Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            ORTAK KREDİ KARTI KONSOLİDE TOPLAMI ({formatDateTR(targetDate)})
          </span>
          <div className="text-3xl font-black text-white">
            {formatCurrency(totalNet)}
          </div>
          <span className="text-xs text-slate-300 mt-1 block">
            Net Bankaya Düşecek Toplam (Komisyonlar ve Oran Farkları Düşülmüş)
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center w-full md:w-auto">
          <div className="p-3 bg-white/10 rounded-xl">
            <span className="text-[10px] text-slate-400 block uppercase">Brüt Satış</span>
            <span className="text-sm font-bold text-white">{formatCurrency(totalGross)}</span>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <span className="text-[10px] text-rose-300 block uppercase">Toplam Komisyon</span>
            <span className="text-sm font-bold text-rose-400">-{formatCurrency(totalComm)}</span>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <span className="text-[10px] text-amber-300 block uppercase">Oran Farkı</span>
            <span className="text-sm font-bold text-amber-400">
              {totalDiff >= 0 ? '-' : '+'}{formatCurrency(Math.abs(totalDiff))}
            </span>
          </div>
        </div>
      </div>

      {/* 2 AYRI KASA: DK KREDİ KARTI & PALM KREDİ KARTI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DK Kredi Kartı Kasası */}
        <div className="bg-white rounded-2xl p-6 border-2 border-blue-200 shadow-xs space-y-4 relative">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="font-extrabold text-blue-700 text-sm uppercase block">DK Kredi Kartı Kasası</span>
              <span className="text-[11px] text-slate-400">Denize Karşı POS Terminali</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Ayrı Kasa 1</span>
          </div>

          {/* Brüt Hasılat */}
          <div className="bg-slate-50 p-3.5 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Günün Brüt Kart Hasılatı:</span>
            <span className="text-base font-black text-slate-900">{formatCurrency(dkGross)}</span>
          </div>

          {/* Komisyon Oranı Girişi */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase text-slate-600">
                Manuel Komisyon Oranı (%)
              </label>
              <span className="text-xs font-bold text-rose-600">
                Kesinti: -{formatCurrency(dkCalcComm)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="2.5"
                value={dkRate}
                onChange={(e) => setDkRate(e.target.value)}
                className="w-full px-3 py-2 pl-3 pr-10 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="absolute right-3 top-2 font-bold text-slate-400">%</span>
            </div>
          </div>

          {/* Gün Sonu Oran / Komisyon Farkı Girişi */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase text-slate-600">
                Gün Sonu Oran / Komisyon Farkı (TL)
              </label>
              <span className="text-[11px] text-slate-400">Fark / Blokaj Kesintisi</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={dkRateDiff}
                onChange={(e) => setDkRateDiff(e.target.value)}
                className="w-full px-3 py-2 pl-3 pr-10 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <span className="absolute right-3 top-2 font-bold text-slate-400">TL</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              * Bankanın uyguladığı ek oran dilimi veya puan farkı varsa buraya giriniz (+ kesinti, - iade).
            </span>
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Hesap Notu</label>
            <input
              type="text"
              placeholder="Örn: Garanti POS ertesi gün valörü"
              value={dkNotes}
              onChange={(e) => setDkNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Net Bankaya Düşen Tutar Kutusu */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-900 block">NET BANKAYA DÜŞEN:</span>
              <span className="text-[10px] text-blue-700">Brüt - Komisyon - Oran Farkı</span>
            </div>
            <span className="text-lg font-black text-blue-900">{formatCurrency(dkCalcNet)}</span>
          </div>

          <button
            type="button"
            onClick={() => handleSave('DK', dkRate, dkRateDiff, dkNotes)}
            disabled={savingBiz === 'DK'}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingBiz === 'DK' ? 'Kaydediliyor...' : 'DK Oran ve Farkını Kaydet'}</span>
          </button>
        </div>

        {/* Palm Kredi Kartı Kasası */}
        <div className="bg-white rounded-2xl p-6 border-2 border-emerald-200 shadow-xs space-y-4 relative">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="font-extrabold text-emerald-700 text-sm uppercase block">Palm Kredi Kartı Kasası</span>
              <span className="text-[11px] text-slate-400">Palm Beach POS Terminali</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Ayrı Kasa 2</span>
          </div>

          {/* Brüt Hasılat */}
          <div className="bg-slate-50 p-3.5 rounded-xl flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Günün Brüt Kart Hasılatı:</span>
            <span className="text-base font-black text-slate-900">{formatCurrency(palmGross)}</span>
          </div>

          {/* Komisyon Oranı Girişi */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase text-slate-600">
                Manuel Komisyon Oranı (%)
              </label>
              <span className="text-xs font-bold text-rose-600">
                Kesinti: -{formatCurrency(palmCalcComm)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="2.5"
                value={palmRate}
                onChange={(e) => setPalmRate(e.target.value)}
                className="w-full px-3 py-2 pl-3 pr-10 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="absolute right-3 top-2 font-bold text-slate-400">%</span>
            </div>
          </div>

          {/* Gün Sonu Oran / Komisyon Farkı Girişi */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase text-slate-600">
                Gün Sonu Oran / Komisyon Farkı (TL)
              </label>
              <span className="text-[11px] text-slate-400">Fark / Blokaj Kesintisi</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={palmRateDiff}
                onChange={(e) => setPalmRateDiff(e.target.value)}
                className="w-full px-3 py-2 pl-3 pr-10 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="absolute right-3 top-2 font-bold text-slate-400">TL</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              * Bankanın uyguladığı ek oran dilimi veya puan farkı varsa buraya giriniz (+ kesinti, - iade).
            </span>
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Hesap Notu</label>
            <input
              type="text"
              placeholder="Örn: Akbank POS gün sonu mutabakatı"
              value={palmNotes}
              onChange={(e) => setPalmNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Net Bankaya Düşen Tutar Kutusu */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-900 block">NET BANKAYA DÜŞEN:</span>
              <span className="text-[10px] text-emerald-700">Brüt - Komisyon - Oran Farkı</span>
            </div>
            <span className="text-lg font-black text-emerald-900">{formatCurrency(palmCalcNet)}</span>
          </div>

          <button
            type="button"
            onClick={() => handleSave('PALM', palmRate, palmRateDiff, palmNotes)}
            disabled={savingBiz === 'PALM'}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingBiz === 'PALM' ? 'Kaydediliyor...' : 'Palm Oran ve Farkını Kaydet'}</span>
          </button>
        </div>
      </div>

      {/* History table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600">
            Geçmiş POS Oran ve Oran Farkı Kayıtları
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                <th className="py-2.5 px-4">Tarih</th>
                <th className="py-2.5 px-4">İşletme</th>
                <th className="py-2.5 px-4">Komisyon Oranı</th>
                <th className="py-2.5 px-4">Oran Farkı</th>
                <th className="py-2.5 px-4">Not / Açıklama</th>
                <th className="py-2.5 px-4">Kaydeden</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.history?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">Henüz geçmiş POS mutabakat kaydı yok.</td>
                </tr>
              ) : data?.history?.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="py-2 px-4 font-semibold text-slate-700">{formatDateTR(h.date)}</td>
                  <td className="py-2 px-4 font-bold">{h.business_id}</td>
                  <td className="py-2 px-4 font-bold text-slate-800">%{h.commission_rate}</td>
                  <td className="py-2 px-4 font-bold text-amber-700">{formatCurrency(h.rate_difference)}</td>
                  <td className="py-2 px-4 text-slate-500">{h.notes || '-'}</td>
                  <td className="py-2 px-4 text-slate-400">{h.created_by_name || 'Admin'}</td>
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
          setPendingPayload(null);
        }}
        onConfirm={(reason) => {
          if (pendingPayload) {
            handleSave(
              pendingPayload.business_id,
              pendingPayload.commission_rate,
              pendingPayload.rate_difference,
              pendingPayload.notes,
              reason
            );
          }
        }}
        title="Kapanmış Gün Kredi Kartı Oranlarını Düzenleme"
      />
    </div>
  );
}
