import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Building2, 
  Calendar, 
  Wallet, 
  CreditCard,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Search,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR, formatDateTimeTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function FastSalesMatrix({ onNavigate }) {
  const { user } = useAuth();
  const { customEndDate, refreshKey, triggerRefresh } = useFilters();
  const todayStr = new Date().toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(customEndDate || todayStr);

  useEffect(() => {
    if (customEndDate) {
      setTargetDate(customEndDate);
    }
  }, [customEndDate]);

  // DK Form State
  const [dkNakit, setDkNakit] = useState('');
  const [dkKart, setDkKart] = useState('');
  const [dkKomisyon, setDkKomisyon] = useState('');
  const [dkDesc, setDkDesc] = useState('DK Günlük Satış Hasılatı');

  // Palm Form State
  const [palmNakit, setPalmNakit] = useState('');
  const [palmKart, setPalmKart] = useState('');
  const [palmKomisyon, setPalmKomisyon] = useState('');
  const [palmDesc, setPalmDesc] = useState('Palm Günlük Satış Hasılatı');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  // Live List State for the selected date
  const [daySales, setDaySales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [targetCancelSale, setTargetCancelSale] = useState(null);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);

  // Fetch sales for targetDate
  const loadDaySales = () => {
    setSalesLoading(true);
    api.get('/sales', {
      startDate: targetDate,
      endDate: targetDate,
      limit: 200
    })
      .then(res => {
        if (res.success) {
          setDaySales(res.sales || []);
        }
      })
      .catch(err => console.error('Day sales fetch error:', err))
      .finally(() => setSalesLoading(false));
  };

  useEffect(() => {
    loadDaySales();
  }, [targetDate, refreshKey]);

  // Day navigation
  const handlePrevDay = () => {
    const [y, m, d] = targetDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const prevStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setTargetDate(prevStr);
  };

  const handleNextDay = () => {
    const [y, m, d] = targetDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 1);
    const nextStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    setTargetDate(nextStr);
  };

  // Computed Live Totals
  const dkNakitNum = parseFloat(dkNakit) || 0;
  const dkKartNum = parseFloat(dkKart) || 0;
  const dkKomisyonNum = parseFloat(dkKomisyon) || 0;
  const dkTotal = dkNakitNum + dkKartNum;

  const palmNakitNum = parseFloat(palmNakit) || 0;
  const palmKartNum = parseFloat(palmKart) || 0;
  const palmKomisyonNum = parseFloat(palmKomisyon) || 0;
  const palmTotal = palmNakitNum + palmKartNum;

  const totalNakit = dkNakitNum + palmNakitNum;
  const totalKart = dkKartNum + palmKartNum;
  const totalKomisyon = dkKomisyonNum + palmKomisyonNum;
  const netBankaKart = Math.max(0, totalKart - totalKomisyon);
  const grandTotal = dkTotal + palmTotal;

  // Day sales totals
  const daySalesNakit = daySales.filter(s => s.payment_type === 'NAKIT').reduce((acc, s) => acc + s.amount, 0);
  const daySalesKart = daySales.filter(s => s.payment_type === 'KART').reduce((acc, s) => acc + s.amount, 0);
  const daySalesTotal = daySalesNakit + daySalesKart;

  const handleSubmit = async (changeReason = null) => {
    if (grandTotal <= 0) {
      setErrorMsg('Lütfen en az bir işletme için geçerli bir satış tutarı (nakit veya kart) giriniz.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        date: targetDate,
        dk: (dkNakitNum > 0 || dkKartNum > 0) ? {
          nakit: dkNakitNum,
          kart: dkKartNum,
          komisyon: dkKomisyonNum,
          description: dkDesc
        } : null,
        palm: (palmNakitNum > 0 || palmKartNum > 0) ? {
          nakit: palmNakitNum,
          kart: palmKartNum,
          komisyon: palmKomisyonNum,
          description: palmDesc
        } : null,
        description: 'Hızlı Günlük Satış Girişi'
      };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/sales/matrix', payload);
      if (res.success) {
        setSuccessMsg(res.message);
        triggerRefresh();
        loadDaySales();
        // Clear inputs
        setDkNakit('');
        setDkKart('');
        setDkKomisyon('');
        setPalmNakit('');
        setPalmKart('');
        setPalmKomisyon('');
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setErrorMsg(err.message || 'Satışlar kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelClick = (sale) => {
    setTargetCancelSale(sale);
    setShowCancelReasonModal(true);
  };

  const executeCancel = async (reason = null) => {
    if (!targetCancelSale) return;
    try {
      const res = await api.delete(`/sales/${targetCancelSale.id}`, reason ? { change_reason: reason } : {});
      if (res.success) {
        setSuccessMsg(res.message);
        setTargetCancelSale(null);
        setShowCancelReasonModal(false);
        loadDaySales();
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowCancelReasonModal(true);
      } else {
        setErrorMsg(err.message || 'Satış iptal edilemedi.');
      }
    }
  };

  const canDelete = ['super_admin', 'business_admin'].includes(user?.roleId);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* 1. Header & Date Selection Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Hızlı Satış & Gelir Matrisi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Denize Karşı ve Palm Beach günlük nakit, kart ve net komisyon hasılatlarını tek ekranda girip yönetin.
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 cursor-pointer"
            title="Önceki Gün"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 cursor-pointer"
            title="Sonraki Gün"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setTargetDate(todayStr)}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            ⚡ Bugün
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 font-medium">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center space-x-2 font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Two Operation Cards Grid (DK & PALM) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* DK SATIŞ GİRİŞİ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h3 className="font-extrabold text-sm text-blue-900 uppercase">DK (Denize Karşı) Satışları</h3>
            </div>
            <span className="text-xs font-black text-blue-700">{formatCurrency(dkTotal)}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nakit Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={dkNakit}
                  onChange={(e) => { setDkNakit(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Kredi Kartı (POS) Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={dkKart}
                  onChange={(e) => { setDkKart(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-600 mb-1.5 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                <span>DK Kredi Kartı Komisyon Tutarı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={dkKomisyon}
                  onChange={(e) => { setDkKomisyon(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-rose-200 rounded-xl text-base font-bold text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50/30"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-rose-400">TL</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500 font-medium">
                <span>Banka Hesabına Net Düşen:</span>
                <span className="font-bold text-blue-700">{formatCurrency(Math.max(0, dkKartNum - dkKomisyonNum))}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Açıklama (Opsiyonel)</label>
              <input
                type="text"
                value={dkDesc}
                onChange={(e) => setDkDesc(e.target.value)}
                placeholder="Örn: Günlük Bar ve Salon Satışı"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* PALM SATIŞ GİRİŞİ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="font-extrabold text-sm text-emerald-900 uppercase">Palm Beach Satışları</h3>
            </div>
            <span className="text-xs font-black text-emerald-700">{formatCurrency(palmTotal)}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nakit Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={palmNakit}
                  onChange={(e) => { setPalmNakit(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Kredi Kartı (POS) Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={palmKart}
                  onChange={(e) => { setPalmKart(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-rose-600 mb-1.5 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-rose-600" />
                <span>Palm Kredi Kartı Komisyon Tutarı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={palmKomisyon}
                  onChange={(e) => { setPalmKomisyon(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-rose-200 rounded-xl text-base font-bold text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50/30"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-rose-400">TL</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500 font-medium">
                <span>Banka Hesabına Net Düşen:</span>
                <span className="font-bold text-emerald-700">{formatCurrency(Math.max(0, palmKartNum - palmKomisyonNum))}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Açıklama (Opsiyonel)</label>
              <input
                type="text"
                value={palmDesc}
                onChange={(e) => setPalmDesc(e.target.value)}
                placeholder="Örn: Günlük Palm Beach Hasılatı"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Consolidated Summary & Save Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Ortak Nakit</span>
            <span className="text-base font-black text-emerald-400">{formatCurrency(totalNakit)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Ortak Brüt Kart</span>
            <span className="text-base font-black text-blue-400">{formatCurrency(totalKart)}</span>
          </div>
          <div>
            <span className="text-[11px] text-rose-300 uppercase font-semibold block">Kart Komisyonu (-)</span>
            <span className="text-base font-black text-rose-400">-{formatCurrency(totalKomisyon)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Net Banka Kartı</span>
            <span className="text-base font-black text-indigo-300">{formatCurrency(netBankaKart)}</span>
          </div>
          <div>
            <span className="text-[11px] text-amber-300 uppercase font-semibold block">GÜNLÜK TOPLAM</span>
            <span className="text-lg font-black text-white">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={saving || grandTotal <= 0}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{saving ? 'Kaydediliyor...' : 'GÜNLÜK SATIŞLARI KAYDET'}</span>
        </button>
      </div>

      {/* 4. Live Table: Seçili Günün Kayıtlı Satış Hareketleri Dökümü */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              <span>{formatDateTR(targetDate)} — Günün Kayıtlı Satış Hareketleri</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Seçili günde sisteme girilmiş olan tüm nakit ve kart hasılatları.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-500 font-medium">Toplam Kayıt: <strong className="text-slate-900 font-bold">{daySales.length} adet</strong></span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Toplam Hasılat: <strong className="text-emerald-700 font-bold">{formatCurrency(daySalesTotal)}</strong></span>
            <button
              onClick={loadDaySales}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              title="Listeyi Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${salesLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                <th className="py-2.5 px-3">İşletme</th>
                <th className="py-2.5 px-3">Ödeme Tipi</th>
                <th className="py-2.5 px-3 text-right">Satış Tutarı</th>
                <th className="py-2.5 px-3">Açıklama</th>
                <th className="py-2.5 px-3">Kaydeden</th>
                {canDelete && <th className="py-2.5 px-3 text-center">İşlem</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daySales.length > 0 ? (
                daySales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        sale.business_id === 'DK'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {sale.business_id === 'DK' ? 'Denize Karşı' : 'Palm Beach'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${
                        sale.payment_type === 'NAKIT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {sale.payment_type === 'NAKIT' ? '💵 Nakit' : '💳 Kart (POS)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(sale.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      {sale.description || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {sale.creator_name || 'Sistem'}
                    </td>
                    {canDelete && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleCancelClick(sale)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Bu satışı iptal et"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="py-8 text-center text-slate-400">
                    <p className="font-semibold text-slate-500">Seçili tarihe ({formatDateTR(targetDate)}) ait satış kaydı bulunamadı.</p>
                    <p className="text-xs text-slate-400 mt-1">Yukarıdaki Denize Karşı ve Palm kutularından hasılat tutarlarını girerek 'Günlük Satışları Kaydet' butonuna basınız.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        onConfirm={(reason) => {
          setShowReasonModal(false);
          handleSubmit(reason);
        }}
      />

      <ReasonModal
        isOpen={showCancelReasonModal}
        onClose={() => setShowCancelReasonModal(false)}
        onConfirm={(reason) => {
          setShowCancelReasonModal(false);
          executeCancel(reason);
        }}
      />
    </div>
  );
}
