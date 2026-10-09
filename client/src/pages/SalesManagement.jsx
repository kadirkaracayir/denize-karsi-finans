import React, { useState, useEffect, useCallback } from 'react';
import { 
  BadgePercent, 
  Zap, 
  Calendar, 
  CalendarRange, 
  BarChart3, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Wallet,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';
import { api } from '../services/api';

export default function SalesManagement() {
  const { user } = useAuth();
  const { customEndDate, setCustomEndDate } = useFilters();

  const activeDate = customEndDate || '2026-10-08';

  // Tracking Active Tab: 'gunluk' | 'haftalik' | 'aylik'
  const [activeTrackingTab, setActiveTrackingTab] = useState('gunluk');

  // Fast Sales Form State
  const [entryDate, setEntryDate] = useState(activeDate);
  const [dkNakit, setDkNakit] = useState('');
  const [dkKart, setDkKart] = useState('');
  const [palmNakit, setPalmNakit] = useState('');
  const [palmKart, setPalmKart] = useState('');
  const [description, setDescription] = useState('Günlük Satış Hasılatı');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  // Tracking Data State
  const [trackingData, setTrackingData] = useState(null);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);

  // Sync entryDate when activeDate changes
  useEffect(() => {
    setEntryDate(activeDate);
  }, [activeDate]);

  // Load Tracking Data
  const loadTracking = useCallback(async () => {
    setIsLoadingTracking(true);
    try {
      const data = await api.get('/sales/tracking', {
        period: activeTrackingTab,
        date: entryDate
      });
      if (data.success) {
        setTrackingData(data);
      }
    } catch (err) {
      console.error('Tracking fetch error:', err);
    } finally {
      setIsLoadingTracking(false);
    }
  }, [activeTrackingTab, entryDate]);

  useEffect(() => {
    loadTracking();
  }, [loadTracking]);

  // Calculations for live form totals
  const numDkNakit = parseFloat(dkNakit) || 0;
  const numDkKart = parseFloat(dkKart) || 0;
  const numDkTotal = numDkNakit + numDkKart;

  const numPalmNakit = parseFloat(palmNakit) || 0;
  const numPalmKart = parseFloat(palmKart) || 0;
  const numPalmTotal = numPalmNakit + numPalmKart;

  const combinedNakit = numDkNakit + numPalmNakit;
  const combinedKart = numDkKart + numPalmKart;
  const grandTotal = numDkTotal + numPalmTotal;

  // Handle Fast Sales Submission
  const handleSubmitFastSale = async (e) => {
    e.preventDefault();
    if (grandTotal <= 0) {
      setSubmitStatus({ type: 'error', message: 'Lütfen en az bir nakit veya kart tutarı giriniz.' });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const data = await api.post('/sales/matrix', {
        date: entryDate,
        dk: { nakit: numDkNakit, kart: numDkKart, description: `DK ${description}` },
        palm: { nakit: numPalmNakit, kart: numPalmKart, description: `Palm ${description}` },
        description
      });

      if (data.success) {
        setSubmitStatus({
          type: 'success',
          message: `${entryDate} tarihli hasılat başarıyla kaydedildi! (Toplam: ${formatCurrency(grandTotal)})`
        });
        // Clear fields
        setDkNakit('');
        setDkKart('');
        setPalmNakit('');
        setPalmKart('');
        // Reload tracking
        loadTracking();
      } else {
        setSubmitStatus({ type: 'error', message: data.message || 'Kayıt başarısız oldu.' });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message || 'Sunucu bağlantı hatası oluştu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Single Sale Delete / Cancel
  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Bu satış kaydını iptal etmek istediğinize emin misiniz?')) return;
    try {
      const data = await api.delete(`/sales/${saleId}`, {
        change_reason: 'Kullanıcı tarafından satış iptal edildi'
      });
      if (data.success) {
        loadTracking();
      } else {
        alert(data.message || 'Satış iptal edilemedi.');
      }
    } catch (err) {
      alert(err.message || 'İşlem sırasında hata meydana geldi.');
    }
  };

  // Date Shift Helper for Navigation
  const shiftDate = (days) => {
    const d = new Date(entryDate);
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split('T')[0];
    setEntryDate(newDateStr);
    setCustomEndDate(newDateStr);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <BadgePercent className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hızlı Satış & Gelir Takibi</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            DK ve Palm Beach günlük nakit & kart hasılatlarını anında girin, günlük, haftalık ve aylık periyotlarda konsolide takip edin.
          </p>
        </div>

        {/* Global Date Selector */}
        <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
            title="Önceki Gün"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => {
              setEntryDate(e.target.value);
              setCustomEndDate(e.target.value);
            }}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer px-2"
          />
          <button
            onClick={() => shiftDate(1)}
            className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
            title="Sonraki Gün"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const todayStr = '2026-10-08';
              setEntryDate(todayStr);
              setCustomEndDate(todayStr);
            }}
            className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Bugün
          </button>
        </div>
      </div>

      {/* TOP SECTION: Fast Sales Entry Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Hızlı Günlük Satış Girişi</h2>
              <span className="text-[11px] text-slate-400">Tarih: {formatDateTR(entryDate)}</span>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Kategorisiz Hızlı Mod
          </span>
        </div>

        <form onSubmit={handleSubmitFastSale} className="p-6 space-y-6">
          {submitStatus && (
            <div className={`p-4 rounded-xl text-xs flex items-center space-x-2 ${
              submitStatus.type === 'success' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {submitStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{submitStatus.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DENİZE KARŞI (DK) CARD */}
            <div className="bg-blue-50/40 rounded-2xl p-5 border border-blue-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                  <h3 className="text-sm font-bold text-slate-900">DENİZE KARŞI (DK)</h3>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg">
                  Toplam: {formatCurrency(numDkTotal)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-blue-600" /> DK Nakit Satış
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={dkNakit}
                      onChange={(e) => setDkNakit(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">₺</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" /> DK Kart Satış
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={dkKart}
                      onChange={(e) => setDkKart(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">₺</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PALM BEACH CARD */}
            <div className="bg-emerald-50/40 rounded-2xl p-5 border border-emerald-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                  <h3 className="text-sm font-bold text-slate-900">PALM BEACH</h3>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                  Toplam: {formatCurrency(numPalmTotal)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Palm Nakit Satış
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={palmNakit}
                      onChange={(e) => setPalmNakit(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">₺</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Palm Kart Satış
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={palmKart}
                      onChange={(e) => setPalmKart(e.target.value)}
                      className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">₺</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Action Bar */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-1/3">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Açıklama (Örn: Günlük Satış Hasılatı)"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Live Consolidated Preview Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-200/80 text-[11px] font-bold text-slate-700">
                Ortak Nakit: <span className="text-slate-900">{formatCurrency(combinedNakit)}</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-200/80 text-[11px] font-bold text-slate-700">
                Ortak Kart: <span className="text-slate-900">{formatCurrency(combinedKart)}</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-[11px] font-black text-emerald-800">
                Toplam Ciro: {formatCurrency(grandTotal)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || grandTotal <= 0}
              className={`w-full md:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center space-x-2 ${
                grandTotal > 0 && !isSubmitting
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/30'
                  : 'bg-slate-300 cursor-not-allowed text-slate-500'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{isSubmitting ? 'Kaydediliyor...' : 'Satışları Kaydet'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* BOTTOM SECTION: Sales Tracking Hub (Daily, Weekly, Monthly) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Satış Takip Paneli</h2>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTrackingTab('gunluk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTrackingTab === 'gunluk'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Günlük Takip</span>
            </button>

            <button
              onClick={() => setActiveTrackingTab('haftalik')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTrackingTab === 'haftalik'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Haftalık Takip</span>
            </button>

            <button
              onClick={() => setActiveTrackingTab('aylik')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTrackingTab === 'aylik'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Aylık Takip</span>
            </button>

            <button
              onClick={loadTracking}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors ml-1"
              title="Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTracking ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab 1: GÜNLÜK TAKİP */}
        {activeTrackingTab === 'gunluk' && (
          <div className="p-6 space-y-6">
            {/* KPI Cards */}
            {trackingData?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">DK Nakit</span>
                  <div className="text-base font-extrabold text-blue-600 mt-0.5">
                    {formatCurrency(trackingData.summary.dk_nakit)}
                  </div>
                  <span className="text-[10px] text-slate-400">Tek Kasaya Giriş</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">DK Kredi Kartı</span>
                  <div className="text-base font-extrabold text-blue-700 mt-0.5">
                    {formatCurrency(trackingData.summary.dk_kart)}
                  </div>
                  <span className="text-[10px] text-slate-400">DK POS Hesabı</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Palm Nakit</span>
                  <div className="text-base font-extrabold text-emerald-600 mt-0.5">
                    {formatCurrency(trackingData.summary.palm_nakit)}
                  </div>
                  <span className="text-[10px] text-slate-400">Tek Kasaya Giriş</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Palm Kredi Kartı</span>
                  <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                    {formatCurrency(trackingData.summary.palm_kart)}
                  </div>
                  <span className="text-[10px] text-slate-400">Palm POS Hesabı</span>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-xs">
                  <span className="text-[10px] font-bold text-slate-300 uppercase">Toplam Satış</span>
                  <div className="text-base font-black text-emerald-400 mt-0.5">
                    {formatCurrency(trackingData.summary.grand_total)}
                  </div>
                  <span className="text-[10px] text-slate-400">Konsolide Ciro</span>
                </div>
              </div>
            )}

            {/* List of today's sales */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Günün Satış Kayıtları ({formatDateTR(entryDate)})
                </h3>
                <span className="text-xs text-slate-500">
                  {trackingData?.items?.length || 0} kayıt listeleniyor
                </span>
              </div>

              {trackingData?.items && trackingData.items.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">İşletme</th>
                        <th className="py-2.5 px-4">Ödeme Tipi</th>
                        <th className="py-2.5 px-4">Tutar</th>
                        <th className="py-2.5 px-4">Açıklama</th>
                        <th className="py-2.5 px-4">Kaydeden</th>
                        <th className="py-2.5 px-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trackingData.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.business_id === 'DK' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.business_id === 'DK' ? 'Denize Karşı' : 'Palm Beach'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-700">
                            {item.payment_type === 'NAKIT' ? (
                              <span className="text-slate-900 flex items-center gap-1 font-bold">
                                <Wallet className="w-3.5 h-3.5 text-slate-500" /> Nakit
                              </span>
                            ) : (
                              <span className="text-blue-900 flex items-center gap-1 font-bold">
                                <CreditCard className="w-3.5 h-3.5 text-blue-500" /> Kredi Kartı
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-black text-slate-900">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 truncate max-w-xs">
                            {item.description || '-'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {item.creator_name || 'Admin'}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {['super_admin', 'business_admin'].includes(user?.roleId) && (
                              <button
                                onClick={() => handleDeleteSale(item.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="İptal Et"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Bu tarihe ait henüz satış kaydı girilmemiş.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: HAFTALIK TAKİP */}
        {activeTrackingTab === 'haftalik' && (
          <div className="p-6 space-y-6">
            {trackingData?.summary && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <CalendarRange className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Haftalık Dönem: {formatDateTR(trackingData.startDate)} — {formatDateTR(trackingData.endDate)}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-xs">
                    <span className="text-slate-500">Nakit Toplam: </span>
                    <span className="font-bold text-slate-900">{formatCurrency(trackingData.summary.grand_nakit)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Kart Toplam: </span>
                    <span className="font-bold text-blue-700">{formatCurrency(trackingData.summary.grand_kart)}</span>
                  </div>
                  <div className="text-xs bg-emerald-100 px-3 py-1 rounded-lg text-emerald-800 font-black">
                    Haftalık Ciro: {formatCurrency(trackingData.summary.grand_total)}
                  </div>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Gün / Tarih</th>
                    <th className="py-2.5 px-3 text-right bg-blue-50/50 text-blue-900">DK Nakit</th>
                    <th className="py-2.5 px-3 text-right bg-blue-50/50 text-blue-900">DK Kart</th>
                    <th className="py-2.5 px-3 text-right bg-blue-100/50 text-blue-950 font-black">DK Toplam</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-50/50 text-emerald-900">Palm Nakit</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-50/50 text-emerald-900">Palm Kart</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-100/50 text-emerald-950 font-black">Palm Toplam</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-800">Ortak Nakit</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-800">Ortak Kart</th>
                    <th className="py-2.5 px-4 text-right bg-slate-900 text-emerald-400 font-black">Genel Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trackingData?.days?.map((day) => (
                    <tr
                      key={day.date}
                      className={`hover:bg-blue-50/30 transition-colors ${
                        day.isTargetDate ? 'bg-amber-50/60 font-semibold' : (day.isWeekend ? 'bg-slate-50/50' : '')
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-2 h-2 rounded-full ${day.isWeekend ? 'bg-rose-400' : 'bg-slate-300'}`}></span>
                          <span>{day.dayName}</span>
                          <span className="text-[10px] text-slate-400">({formatDateTR(day.date).split(' ')[0]} {formatDateTR(day.date).split(' ')[1]})</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 bg-blue-50/20">{formatCurrency(day.dk_nakit)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700 bg-blue-50/20">{formatCurrency(day.dk_kart)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-900 bg-blue-100/30">{formatCurrency(day.dk_total)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700 bg-emerald-50/20">{formatCurrency(day.palm_nakit)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700 bg-emerald-50/20">{formatCurrency(day.palm_kart)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-900 bg-emerald-100/30">{formatCurrency(day.palm_total)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{formatCurrency(day.total_nakit)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{formatCurrency(day.total_kart)}</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900 bg-slate-100/40">
                        {formatCurrency(day.grand_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {trackingData?.summary && (
                  <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-800">
                    <tr>
                      <td className="py-3 px-3 uppercase text-[11px] tracking-wider text-slate-300">Haftalık Toplam</td>
                      <td className="py-3 px-3 text-right text-blue-300">{formatCurrency(trackingData.summary.total_dk_nakit)}</td>
                      <td className="py-3 px-3 text-right text-blue-300">{formatCurrency(trackingData.summary.total_dk_kart)}</td>
                      <td className="py-3 px-3 text-right text-blue-400 font-black">{formatCurrency(trackingData.summary.total_dk)}</td>
                      <td className="py-3 px-3 text-right text-emerald-300">{formatCurrency(trackingData.summary.total_palm_nakit)}</td>
                      <td className="py-3 px-3 text-right text-emerald-300">{formatCurrency(trackingData.summary.total_palm_kart)}</td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-black">{formatCurrency(trackingData.summary.total_palm)}</td>
                      <td className="py-3 px-3 text-right text-slate-200">{formatCurrency(trackingData.summary.grand_nakit)}</td>
                      <td className="py-3 px-3 text-right text-slate-200">{formatCurrency(trackingData.summary.grand_kart)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-black text-sm">{formatCurrency(trackingData.summary.grand_total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: AYLIK TAKİP */}
        {activeTrackingTab === 'aylik' && (
          <div className="p-6 space-y-6">
            {trackingData?.summary && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Dönem: {trackingData.year} / {String(trackingData.month).padStart(2, '0')} Ayı Toplamları
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-xs">
                    <span className="text-slate-500">Aylık Nakit: </span>
                    <span className="font-bold text-slate-900">{formatCurrency(trackingData.summary.grand_nakit)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500">Aylık Kart: </span>
                    <span className="font-bold text-blue-700">{formatCurrency(trackingData.summary.grand_kart)}</span>
                  </div>
                  <div className="text-xs bg-emerald-100 px-3 py-1 rounded-lg text-emerald-800 font-black">
                    Aylık Ciro: {formatCurrency(trackingData.summary.grand_total)}
                  </div>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs min-w-[750px] relative">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="py-2.5 px-3">Gün</th>
                    <th className="py-2.5 px-3 text-right bg-blue-50/70 text-blue-900">DK Nakit</th>
                    <th className="py-2.5 px-3 text-right bg-blue-50/70 text-blue-900">DK Kart</th>
                    <th className="py-2.5 px-3 text-right bg-blue-100/70 text-blue-950 font-black">DK Toplam</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-50/70 text-emerald-900">Palm Nakit</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-50/70 text-emerald-900">Palm Kart</th>
                    <th className="py-2.5 px-3 text-right bg-emerald-100/70 text-emerald-950 font-black">Palm Toplam</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-800">Ortak Nakit</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-800">Ortak Kart</th>
                    <th className="py-2.5 px-4 text-right bg-slate-900 text-emerald-400 font-black">Genel Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trackingData?.days?.map((day) => (
                    <tr
                      key={day.dayNumber}
                      className={`hover:bg-blue-50/30 transition-colors ${
                        day.isTargetDate ? 'bg-amber-50/70 font-semibold' : (day.isWeekend ? 'bg-slate-50/70' : '')
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                            day.isWeekend ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {day.dayNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">{day.dayName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 bg-blue-50/15">{day.dk_nakit > 0 ? formatCurrency(day.dk_nakit) : '-'}</td>
                      <td className="py-2 px-3 text-right text-slate-700 bg-blue-50/15">{day.dk_kart > 0 ? formatCurrency(day.dk_kart) : '-'}</td>
                      <td className="py-2 px-3 text-right font-bold text-blue-900 bg-blue-100/20">{day.dk_total > 0 ? formatCurrency(day.dk_total) : '-'}</td>
                      <td className="py-2 px-3 text-right text-slate-700 bg-emerald-50/15">{day.palm_nakit > 0 ? formatCurrency(day.palm_nakit) : '-'}</td>
                      <td className="py-2 px-3 text-right text-slate-700 bg-emerald-50/15">{day.palm_kart > 0 ? formatCurrency(day.palm_kart) : '-'}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-900 bg-emerald-100/20">{day.palm_total > 0 ? formatCurrency(day.palm_total) : '-'}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800">{day.total_nakit > 0 ? formatCurrency(day.total_nakit) : '-'}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800">{day.total_kart > 0 ? formatCurrency(day.total_kart) : '-'}</td>
                      <td className="py-2 px-4 text-right font-black text-slate-900 bg-slate-100/30">
                        {day.grand_total > 0 ? formatCurrency(day.grand_total) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {trackingData?.summary && (
                  <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-800 sticky bottom-0 z-10">
                    <tr>
                      <td className="py-3 px-3 uppercase text-[11px] tracking-wider text-slate-300">Aylık Toplam</td>
                      <td className="py-3 px-3 text-right text-blue-300">{formatCurrency(trackingData.summary.total_dk_nakit)}</td>
                      <td className="py-3 px-3 text-right text-blue-300">{formatCurrency(trackingData.summary.total_dk_kart)}</td>
                      <td className="py-3 px-3 text-right text-blue-400 font-black">{formatCurrency(trackingData.summary.total_dk)}</td>
                      <td className="py-3 px-3 text-right text-emerald-300">{formatCurrency(trackingData.summary.total_palm_nakit)}</td>
                      <td className="py-3 px-3 text-right text-emerald-300">{formatCurrency(trackingData.summary.total_palm_kart)}</td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-black">{formatCurrency(trackingData.summary.total_palm)}</td>
                      <td className="py-3 px-3 text-right text-slate-200">{formatCurrency(trackingData.summary.grand_nakit)}</td>
                      <td className="py-3 px-3 text-right text-slate-200">{formatCurrency(trackingData.summary.grand_kart)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-black text-sm">{formatCurrency(trackingData.summary.grand_total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
