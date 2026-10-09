import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Receipt,
  Users,
  Clock,
  Plus,
  ArrowRight,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ArrowDownRight,
  ArrowLeftRight,
  BarChart3,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatCurrencyShort, formatDateTR, formatDateLongTR } from '../utils/formatters';

export default function Dashboard({ onNavigate, onOpenQuickSale, onOpenQuickExpense, onOpenCashTx }) {
  const {
    selectedBusiness,
    period,
    customStartDate,
    customEndDate,
    setSingleDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    isToday,
    refreshKey,
    triggerRefresh
  } = useFilters();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Embedded Fast Sales States
  const [salesSubView, setSalesSubView] = useState('entry'); // 'entry' | 'history' | 'weekly'
  const [fastDkNakit, setFastDkNakit] = useState('');
  const [fastDkKart, setFastDkKart] = useState('');
  const [fastPalmNakit, setFastPalmNakit] = useState('');
  const [fastPalmKart, setFastPalmKart] = useState('');
  const [fastDesc, setFastDesc] = useState('Günlük Satış Hasılatı');
  const [isSubmittingFast, setIsSubmittingFast] = useState(false);
  const [fastToast, setFastToast] = useState(null);

  // Day's registered sales & weekly tracking state
  const [dayTracking, setDayTracking] = useState(null);
  const [weeklyTracking, setWeeklyTracking] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  const recordedSales = dayTracking?.items || dayTracking?.sales || [];

  // Fetch Dashboard Stats
  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/dashboard/stats', {
      period,
      startDate: customStartDate,
      endDate: customEndDate,
    })
      .then((res) => {
        if (res.success) {
          setData(res.data);
        }
      })
      .catch((err) => {
        setError(err.message || 'Veriler yüklenirken hata oluştu.');
      })
      .finally(() => setLoading(false));
  }, [period, customStartDate, customEndDate, refreshKey]);

  // Fetch Day's Recorded Sales & Tracking
  const loadDaySales = useCallback(async () => {
    setLoadingTracking(true);
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        api.get('/sales/tracking', { period: 'gunluk', date: customEndDate }),
        api.get('/sales/tracking', { period: 'haftalik', date: customEndDate })
      ]);
      if (dailyRes.success) setDayTracking(dailyRes);
      if (weeklyRes.success) setWeeklyTracking(weeklyRes);
    } catch (err) {
      console.error('Tracking fetch error on Dashboard:', err);
    } finally {
      setLoadingTracking(false);
    }
  }, [customEndDate]);

  useEffect(() => {
    loadDaySales();
  }, [loadDaySales, refreshKey]);

  // Fast Sales live calculations
  const numDkNakit = parseFloat(fastDkNakit) || 0;
  const numDkKart = parseFloat(fastDkKart) || 0;
  const numDkTotal = numDkNakit + numDkKart;

  const numPalmNakit = parseFloat(fastPalmNakit) || 0;
  const numPalmKart = parseFloat(fastPalmKart) || 0;
  const numPalmTotal = numPalmNakit + numPalmKart;

  const combinedNakit = numDkNakit + numPalmNakit;
  const combinedKart = numDkKart + numPalmKart;
  const grandTotal = numDkTotal + numPalmTotal;

  // Handle Submit Fast Sale from Dashboard
  const handleSaveFastSale = async (e) => {
    e.preventDefault();
    if (grandTotal <= 0) {
      setFastToast({ type: 'error', text: 'Lütfen en az bir nakit veya kredi kartı tutarı giriniz.' });
      return;
    }

    setIsSubmittingFast(true);
    setFastToast(null);

    try {
      const res = await api.post('/sales/matrix', {
        date: customEndDate,
        dk: { nakit: numDkNakit, kart: numDkKart, description: `DK ${fastDesc}` },
        palm: { nakit: numPalmNakit, kart: numPalmKart, description: `Palm ${fastDesc}` },
        description: fastDesc
      });

      if (res.success) {
        setFastToast({
          type: 'success',
          text: `${formatDateTR(customEndDate)} hasılatı başarıyla kaydedildi! (+${formatCurrency(grandTotal)})`
        });
        setFastDkNakit('');
        setFastDkKart('');
        setFastPalmNakit('');
        setFastPalmKart('');
        triggerRefresh();
        loadDaySales();
        setTimeout(() => setFastToast(null), 5000);
      } else {
        setFastToast({ type: 'error', text: res.message || 'Kayıt başarısız oldu.' });
      }
    } catch (err) {
      setFastToast({ type: 'error', text: err.message || 'Sunucu bağlantı hatası oluştu.' });
    } finally {
      setIsSubmittingFast(false);
    }
  };

  // Handle Cancel / Delete Sale
  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Bu satış kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const res = await api.delete(`/sales/${saleId}`, {
        change_reason: 'Kullanıcı dashboard üzerinden sildi'
      });
      if (res.success) {
        triggerRefresh();
        loadDaySales();
      } else {
        alert(res.message || 'Satış silinemedi.');
      }
    } catch (err) {
      alert(err.message || 'İşlem sırasında hata meydana geldi.');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Finansal göstergeler yükleniyor...</p>
      </div>
    );
  }

  const f = data?.finansOzeti;
  const g = data?.gunlukOzet;
  const p = data?.personelOzeti;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP HEADER: USER-FRIENDLY DATE SELECTOR & NAVIGATION (NO CLOSING RESTRICTION) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Selector with Previous/Next Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={goToPreviousDay}
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition-colors shadow-2xs"
              title="Önceki Gün"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Date display & input */}
            <div className="relative flex items-center px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs group cursor-pointer">
              <Calendar className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-black text-slate-800 tracking-tight whitespace-nowrap">
                {formatDateLongTR(customEndDate)}
              </span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Tarih Seç"
              />
            </div>

            <button
              onClick={goToNextDay}
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition-colors shadow-2xs"
              title="Sonraki Gün"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                onClick={goToToday}
                className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ml-1"
                title="Bugüne Dön"
              >
                Bugün
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500">
                Seçili Gün Özeti ve Düzenleme
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                Serbest Düzenleme Aktif
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              İstediğiniz günü seçip hasılat, kasa ve finans hareketlerini doğrudan inceleyebilir ve güncelleyebilirsiniz.
            </p>
          </div>
        </div>

        {/* Quick Action Triggers */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenQuickExpense}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>+ Gider Ekle</span>
          </button>
          <button
            onClick={() => onOpenCashTx('IN')}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Para Giriş/Çıkış</span>
          </button>
          <button
            onClick={() => onNavigate('sales')}
            className="hidden lg:flex px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs items-center space-x-1 transition-colors"
          >
            <span>Tüm Satış Takibi</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. PROMINENT SECTION: HIZLI SATIŞ VE GELİR EKRANI (DK & PALM) */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500/30 shadow-md p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500" />
        
        {/* Section Header & Sub-view Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-slate-900 text-base tracking-tight">
                  Hızlı Satış ve Gelir Ekranı
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  {formatDateTR(customEndDate)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Seçili günün nakit ve kredi kartı hasılatlarını doğrudan buradan girin, anında kasalara işlensin.
              </p>
            </div>
          </div>

          {/* Sub-view switcher tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSalesSubView('entry')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                salesSubView === 'entry' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ Hasılat Gir
            </button>
            <button
              onClick={() => setSalesSubView('history')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1 ${
                salesSubView === 'history' ? 'bg-white text-blue-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋 Günün Kayıtları</span>
              {recordedSales.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800">
                  {recordedSales.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSalesSubView('weekly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                salesSubView === 'weekly' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 7 Günlük Takip
            </button>
          </div>
        </div>

        {/* Toast / Notification Banner */}
        {fastToast && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              fastToast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {fastToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{fastToast.text}</span>
          </div>
        )}

        {/* SUB-VIEW 1: ENTRY FORM */}
        {salesSubView === 'entry' && (
          <form onSubmit={handleSaveFastSale} className="space-y-4">
            {/* Informational banner when day already has recorded sales */}
            {(dayTracking?.summary?.grand_total > 0 || recordedSales.length > 0) && (
              <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Seçili gün ({formatDateTR(customEndDate)}) için kayıtlı hasılat: <strong className="font-black text-emerald-900">{formatCurrency(dayTracking?.summary?.grand_total || 0)}</strong>
                    <span className="text-emerald-700 ml-2 hidden md:inline">
                      (Nakit: {formatCurrency(dayTracking?.summary?.total_nakit || 0)} | DK Kart: {formatCurrency(dayTracking?.summary?.dk_kart || 0)} | Palm Kart: {formatCurrency(dayTracking?.summary?.palm_kart || 0)})
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSalesSubView('history')}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300 shadow-2xs self-start sm:self-auto cursor-pointer"
                >
                  Kayıtları Gör ({recordedSales.length} Adet)
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DK SATIŞ KUTUSU */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-blue-900">
                      DK (Denize Karşı)
                    </span>
                  </div>
                  <span className="text-xs font-bold text-blue-700">
                    DK Toplam: {formatCurrency(numDkTotal)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      💵 DK Nakit Satış (TL)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fastDkNakit}
                      onChange={(e) => setFastDkNakit(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Tek ortak kasaya işlenir</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      💳 DK Kredi Kartı (TL)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fastDkKart}
                      onChange={(e) => setFastDkKart(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">DK POS kasasına işlenir</span>
                  </div>
                </div>
              </div>

              {/* PALM SATIŞ KUTUSU */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                      Palm Beach
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">
                    Palm Toplam: {formatCurrency(numPalmTotal)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      💵 Palm Nakit Satış (TL)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fastPalmNakit}
                      onChange={(e) => setFastPalmNakit(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Tek ortak kasaya işlenir</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      💳 Palm Kredi Kartı (TL)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={fastPalmKart}
                      onChange={(e) => setFastPalmKart(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Palm POS kasasına işlenir</span>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE CONSOLIDATED SUMMARY BAR */}
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Ortak Nakit Satış</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {formatCurrency(combinedNakit)}
                  </span>
                  <span className="text-[9px] text-slate-400 block">(Tek Kasaya)</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">DK Kart Satışı</span>
                  <span className="text-base font-extrabold text-blue-300">
                    {formatCurrency(numDkKart)}
                  </span>
                  <span className="text-[9px] text-slate-400 block">(Ayrı Kasaya)</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Palm Kart Satışı</span>
                  <span className="text-base font-extrabold text-emerald-300">
                    {formatCurrency(numPalmKart)}
                  </span>
                  <span className="text-[9px] text-slate-400 block">(Ayrı Kasaya)</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-400 block">Günlük Toplam Ciro</span>
                  <span className="text-lg font-black text-amber-300">
                    {formatCurrency(grandTotal)}
                  </span>
                  <span className="text-[9px] text-amber-200/70 block">Konsolide Hasılat</span>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center space-x-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
                <input
                  type="text"
                  value={fastDesc}
                  onChange={(e) => setFastDesc(e.target.value)}
                  placeholder="Hasılat Notu"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 w-36 sm:w-44"
                />
                <button
                  type="submit"
                  disabled={isSubmittingFast || grandTotal <= 0}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 shadow-md ${
                    grandTotal > 0 && !isSubmittingFast
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white cursor-pointer hover:scale-[1.02]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  {isSubmittingFast ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Hasılatı Kaydet</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* SUB-VIEW 2: DAY'S REGISTERED SALES LIST */}
        {salesSubView === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{formatDateLongTR(customEndDate)} gününde kaydedilmiş tüm satış hareketleri:</span>
              <span className="font-bold text-slate-800">
                Günün Cirosu: {formatCurrency(dayTracking?.summary?.grand_total || 0)}
              </span>
            </div>

            {loadingTracking ? (
              <div className="py-8 text-center text-xs text-slate-400">Yükleniyor...</div>
            ) : recordedSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">İşletme</th>
                      <th className="py-2.5 px-3">Ödeme Tipi</th>
                      <th className="py-2.5 px-3">Açıklama</th>
                      <th className="py-2.5 px-3">Saat</th>
                      <th className="py-2.5 px-3 text-right">Tutar</th>
                      <th className="py-2.5 px-3 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recordedSales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.business_id === 'DK'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {s.business_id === 'DK' ? 'DK' : 'Palm'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {s.payment_type === 'NAKIT' ? '💵 Nakit' : '💳 Kredi Kartı'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{s.description || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {s.created_at ? s.created_at.split(' ')[1]?.slice(0, 5) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {formatCurrency(s.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteSale(s.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Satışı İptal Et / Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Bu tarihe ({formatDateTR(customEndDate)}) ait henüz satış hasılatı kaydedilmemiştir.
                <button
                  onClick={() => setSalesSubView('entry')}
                  className="block mx-auto mt-2 text-xs font-bold text-emerald-600 hover:underline"
                >
                  + Hemen Hasılat Gir
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUB-VIEW 3: 7 DAYS WEEKLY TRACKING */}
        {salesSubView === 'weekly' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Haftalık Görünüm ({weeklyTracking?.startDate} - {weeklyTracking?.endDate}):
              </span>
              <span className="font-bold text-slate-800">
                Haftalık Toplam Ciro: {formatCurrency(weeklyTracking?.summary?.grand_total || 0)}
              </span>
            </div>

            {loadingTracking ? (
              <div className="py-8 text-center text-xs text-slate-400">Yükleniyor...</div>
            ) : weeklyTracking?.days?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-y border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Tarih</th>
                      <th className="py-2.5 px-3 text-right">DK Nakit</th>
                      <th className="py-2.5 px-3 text-right">DK Kart</th>
                      <th className="py-2.5 px-3 text-right">Palm Nakit</th>
                      <th className="py-2.5 px-3 text-right">Palm Kart</th>
                      <th className="py-2.5 px-3 text-right">Ortak Nakit</th>
                      <th className="py-2.5 px-3 text-right">Toplam Günlük Ciro</th>
                      <th className="py-2.5 px-3 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {weeklyTracking.days.map((d) => (
                      <tr
                        key={d.date}
                        className={`hover:bg-slate-50/80 ${
                          d.date === customEndDate ? 'bg-blue-50/50 font-bold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800">
                            {formatDateTR(d.date)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{d.dayName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-700">{formatCurrency(d.dk_nakit)}</td>
                        <td className="py-2.5 px-3 text-right text-blue-800">{formatCurrency(d.dk_kart)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700">{formatCurrency(d.palm_nakit)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800">{formatCurrency(d.palm_kart)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-teal-700">
                          {formatCurrency(d.ortak_nakit)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {formatCurrency(d.total_ciro)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => {
                              setSingleDate(d.date);
                              setSalesSubView('entry');
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-blue-100 hover:text-blue-800 text-slate-700 rounded transition-colors"
                          >
                            Seç & Düzenle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 3. SECTION: FİNANS ÖZETİ (Tek Nakit Kasa, Ayrı Kredi Kartı Kasaları & Bankalar) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Kasa ve Banka Durumu
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
            *Nakitler TEK Kasada, Kredi Kartları AYRI Kasalarda Takip Edilir
          </span>
        </div>

        {/* PROMINENT CARD: TEK ORTAK NAKİT KASA */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-6 pointer-events-none">
            <Wallet className="w-36 h-36" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  TEK NAKİT KASA (DK & PALM BİRLEŞİK NAKİT HAVUZU)
                </span>
                <p className="text-[11px] text-slate-300">
                  İki işletmenin tüm nakit satışları ve nakit harcamaları tek bir merkezi kasada toplanır.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onNavigate('cash')}
                className="px-3 py-1.5 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 border border-emerald-400/30 rounded-xl text-xs font-bold transition-all flex items-center space-x-1"
              >
                <span>Nakit Kasa Detayı</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-emerald-800/40">
            <div>
              <span className="text-xs text-slate-300 block">Toplam Nakit Satış</span>
              <span className="text-lg font-bold text-emerald-300">
                {formatCurrency(f?.nakitKasa?.toplamNakitSatis ?? f?.ortak?.toplamNakit)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                DK: {formatCurrencyShort(f?.nakitKasa?.dkNakitSatis || 0)} | Palm: {formatCurrencyShort(f?.nakitKasa?.palmNakitSatis || 0)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-300 block">Nakit Gider / Harcama</span>
              <span className="text-lg font-bold text-rose-300">
                -{formatCurrency(f?.nakitKasa?.toplamNakitGider || 0)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Kasa nakit ödemeleri</span>
            </div>
            <div>
              <span className="text-xs text-slate-300 block">Personel Nakit Ödemesi</span>
              <span className="text-lg font-bold text-amber-300">
                -{formatCurrency(f?.nakitKasa?.personelNakitOdeme || 0)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Elden nakit ödemeler</span>
            </div>
            <div className="bg-white/10 p-3 rounded-xl border border-white/10">
              <span className="text-xs text-emerald-200 block font-semibold">Net Nakit Kasa Mevcudu</span>
              <span className="text-xl font-black text-white block mt-0.5">
                {formatCurrency(f?.nakitKasa?.netKasaMevcudu ?? f?.ortak?.toplamNakit)}
              </span>
              <span className="text-[10px] text-emerald-300 block mt-0.5">Güncel fiziki para havuzu</span>
            </div>
          </div>
        </div>

        {/* 3 COLUMNS: DK KART (AYRI) | PALM KART (AYRI) | ORTAK KONSOLİDE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* DK KREDİ KARTI */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wide text-blue-700">
                    DK KREDİ KARTI KASASI
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">Ayrı Kasa</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Brüt Kart Satışı:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(f?.dkKart?.brut ?? f?.dk?.kart)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-amber-700 bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                  <div className="flex items-center space-x-1">
                    <span>Komisyon:</span>
                    <span className="text-[10px] text-slate-500">(%{f?.dkKart?.komisyonOrani ?? 2.5})</span>
                  </div>
                  <span className="font-bold">-{formatCurrency(f?.dkKart?.komisyonTutari || 0)}</span>
                </div>
                {f?.dkKart?.oranFarki !== 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Gün Sonu Oran Farkı:</span>
                    <span className={`font-semibold ${(f?.dkKart?.oranFarki || 0) < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {formatCurrency(f?.dkKart?.oranFarki || 0)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Net Bankaya Düşen:</span>
                  <span className="text-base font-extrabold text-blue-700">
                    {formatCurrency(f?.dkKart?.netBankayaDusen ?? 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Gerçek Banka Bakiyesi:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(f?.banka?.dk?.current ?? f?.dk?.banka)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">DK Satış & Hasılat</span>
              <button
                onClick={() => onNavigate('sales')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>Satış & Ciro Takibi</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* PALM KREDİ KARTI */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    PALM KREDİ KARTI KASASI
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Ayrı Kasa</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Brüt Kart Satışı:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(f?.palmKart?.brut ?? f?.palm?.kart)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-amber-700 bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                  <div className="flex items-center space-x-1">
                    <span>Komisyon:</span>
                    <span className="text-[10px] text-slate-500">(%{f?.palmKart?.komisyonOrani ?? 2.5})</span>
                  </div>
                  <span className="font-bold">-{formatCurrency(f?.palmKart?.komisyonTutari || 0)}</span>
                </div>
                {f?.palmKart?.oranFarki !== 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Gün Sonu Oran Farkı:</span>
                    <span className={`font-semibold ${(f?.palmKart?.oranFarki || 0) < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {formatCurrency(f?.palmKart?.oranFarki || 0)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Net Bankaya Düşen:</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    {formatCurrency(f?.palmKart?.netBankayaDusen ?? 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Gerçek Banka Bakiyesi:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(f?.banka?.palm?.current ?? f?.palm?.banka)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Palm Satış & Hasılat</span>
              <button
                onClick={() => onNavigate('sales')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
              >
                <span>Satış & Ciro Takibi</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* ORTAK KONSOLİDE TOPLAM */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg shadow-slate-900/10 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wide text-emerald-400">
                  ORTAK KONSOLİDE (KART & BANKA)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-emerald-300">DK + Palm</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Konsolide Brüt Kart:</span>
                  <span className="font-bold text-white text-sm">
                    {formatCurrency(f?.ortakKart?.brut ?? f?.ortak?.toplamKart)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-amber-300 bg-white/5 p-2 rounded-lg border border-white/10">
                  <span>Toplam Komisyon & Fark:</span>
                  <span className="font-bold">
                    -{formatCurrency(((f?.ortakKart?.komisyonTutari || 0) + (f?.ortakKart?.oranFarki || 0)))}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-700/60 flex justify-between items-center">
                  <span className="font-bold text-slate-200">Toplam Net Bankaya Düşen:</span>
                  <span className="text-base font-extrabold text-emerald-300">
                    {formatCurrency(f?.ortakKart?.netBankayaDusen ?? 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-700/60">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Ortak Toplam Banka:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {formatCurrency(f?.banka?.ortak?.current ?? f?.ortak?.toplamBanka)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-700/60 flex justify-between items-center text-[11px] text-slate-400">
              <span>Konsolide Değerler</span>
              <span className="text-emerald-400 font-semibold">Otomatik Hesaplanır</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECTION: GÜNLÜK ÖZET (Satış, Gider, Personel, Para Akışı) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Dönem / Günlük Akış Göstergeleri
          </h3>
          <button
            onClick={() => onNavigate('sales')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>Tüm Satışları Gör</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Toplam Satış */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-medium">Toplam Satış</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-slate-900">{formatCurrency(g?.toplamSatis)}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>Nakit: {formatCurrencyShort(g?.nakitSatis)}</span>
              <span>Kart: {formatCurrencyShort(g?.kartSatis)}</span>
            </div>
          </div>

          {/* Giderler */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-medium">Toplam Gider</span>
              <Receipt className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-lg font-bold text-rose-700">{formatCurrency(g?.gider)}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>DK: {formatCurrencyShort(g?.dkGider)}</span>
              <span>Palm: {formatCurrencyShort(g?.palmGider)}</span>
            </div>
          </div>

          {/* Personel Hakedişi */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-medium">Personel Hakedişi</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-amber-700">{formatCurrency(g?.personelHakedis)}</div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>Ödenen: {formatCurrencyShort(g?.personelOdemesi)}</span>
              <span className="text-blue-600 font-medium">Puantajdan</span>
            </div>
          </div>

          {/* Para Giriş / Çıkış (Gider Dışı) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-medium">Gider Dışı Para Akışı</span>
              <Wallet className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block">+ Giriş</span>
                <span className="text-xs font-bold text-emerald-700">{formatCurrencyShort(g?.paraGirisleri)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">- Çıkış</span>
                <span className="text-xs font-bold text-rose-700">{formatCurrencyShort(g?.paraCikislari)}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 truncate">
              Sermaye / Şahsi Çekim / Avans
            </div>
          </div>
        </div>
      </div>

      {/* 5. SECTION: PERSONEL DURUMU & SATIŞ DAĞILIMI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Personel Özeti Kartı */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h4 className="font-bold text-sm text-slate-800">Personel & Vardiya Durumu</h4>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Puantajı Aç
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-[11px] text-slate-500 block">Çalışan</span>
              <span className="text-lg font-bold text-slate-900">{p?.bugunkuCalisanSayisi || 0}</span>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-xl">
              <span className="text-[11px] text-amber-700 block">☀ Sabah</span>
              <span className="text-lg font-bold text-amber-800">{p?.sabahVardiyasi || 0}</span>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <span className="text-[11px] text-indigo-700 block">🌙 Akşam</span>
              <span className="text-lg font-bold text-indigo-800">{p?.aksamVardiyasi || 0}</span>
            </div>
          </div>

          <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
            <span className="text-xs text-red-700 block font-medium">Toplam Ödenmemiş Personel Borcu</span>
            <span className="text-xl font-black text-red-800 block mt-0.5">
              {formatCurrency(p?.odenmemisPersonelBorcu)}
            </span>
            <span className="text-[10px] text-red-600 block mt-0.5">
              Tüm ortak personellerin hakediş ve bakiye devir toplamı
            </span>
          </div>
        </div>

        {/* Satış ve Hasılat Dağılımı */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-bold text-sm text-slate-800">Satış ve Hasılat Dağılımı (DK & Palm)</h4>
              <p className="text-[11px] text-slate-400">İşletme bazında dönemlik nakit ve kredi kartı hasılat dengesi</p>
            </div>
            <button
              onClick={() => {
                setSalesSubView('entry');
                window.scrollTo({ top: 100, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors"
            >
              + Hızlı Satış Gir
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* DK Satış Özeti */}
            <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-blue-900 uppercase">DK (Denize Karşı) Satış</span>
                <span className="text-sm font-black text-blue-900">
                  {formatCurrency(data?.satisDagilimi?.dk?.total || g?.dkSatis || 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-blue-200/60">
                <span>💵 Nakit Satış:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(data?.satisDagilimi?.dk?.nakit || 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>💳 Kredi Kartı Satış:</span>
                <span className="font-bold text-blue-700">
                  {formatCurrency(data?.satisDagilimi?.dk?.kart || 0)}
                </span>
              </div>
            </div>

            {/* Palm Satış Özeti */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-900 uppercase">Palm Beach Satış</span>
                <span className="text-sm font-black text-emerald-900">
                  {formatCurrency(data?.satisDagilimi?.palm?.total || g?.palmSatis || 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-emerald-200/60">
                <span>💵 Nakit Satış:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(data?.satisDagilimi?.palm?.nakit || 0)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>💳 Kredi Kartı Satış:</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(data?.satisDagilimi?.palm?.kart || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Konsolide Satış Oran Çubuğu */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span className="font-bold text-slate-800">Konsolide İşletme Dağılımı:</span>
              <span>
                DK: <b className="text-blue-700">{formatCurrency(data?.satisDagilimi?.dk?.total || 0)}</b> | Palm: <b className="text-emerald-700">{formatCurrency(data?.satisDagilimi?.palm?.total || 0)}</b>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-blue-600 h-full transition-all"
                style={{
                  width: `${((data?.satisDagilimi?.dk?.total || 0) / ((data?.satisDagilimi?.ortak?.total || 1))) * 100}%`
                }}
                title={`DK: ${formatCurrency(data?.satisDagilimi?.dk?.total || 0)}`}
              />
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{
                  width: `${((data?.satisDagilimi?.palm?.total || 0) / ((data?.satisDagilimi?.ortak?.total || 1))) * 100}%`
                }}
                title={`Palm: ${formatCurrency(data?.satisDagilimi?.palm?.total || 0)}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 6. SECTION: SON HAREKETLER LİSTESİ */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h4 className="font-bold text-sm text-slate-800 mb-3">Son İşlemler</h4>
        <div className="divide-y divide-slate-100">
          {data?.sonHareketler?.length > 0 ? (
            data.sonHareketler.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    item.tip === 'SATIŞ' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {item.tip}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">{item.detail}</span>
                    <span className="text-slate-400 ml-2">({item.business_id} • {item.sub})</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-bold ${item.tip === 'SATIŞ' ? 'text-slate-900' : 'text-rose-700'}`}>
                    {item.tip === 'SATIŞ' ? '+' : '-'}{formatCurrency(item.amount)}
                  </span>
                  <span className="text-slate-400 text-[10px] block">{formatDateTR(item.date)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-3">Henüz işlem bulunmuyor.</p>
          )}
        </div>
      </div>
    </div>
  );
}
