import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Download,
  Building2,
  RefreshCw,
  Users,
  Wallet,
  Clock,
  Layers,
  FileText,
  CreditCard,
  Banknote
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency, formatCurrencyShort, formatDateTR } from '../utils/formatters';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [viewScope, setViewScope] = useState('all'); // 'all' (Gelir & Gider), 'income' (Sadece Gelir), 'expenses' (Sadece Gider), 'personnel' (Personel & Avans)
  
  const [targetDate, setTargetDate] = useState('2026-10-08');
  const [targetMonth, setTargetMonth] = useState('10');
  const [targetYear, setTargetYear] = useState('2026');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let fetchPromise;

    if (activeTab === 'daily') {
      fetchPromise = api.get('/reports/daily', { date: targetDate });
    } else if (activeTab === 'weekly') {
      const d = new Date(targetDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      const sStr = monday.toISOString().split('T')[0];
      const eStr = sunday.toISOString().split('T')[0];
      fetchPromise = api.get('/reports/weekly', { startDate: sStr, endDate: eStr });
    } else if (activeTab === 'monthly') {
      fetchPromise = api.get('/reports/monthly', { year: targetYear, month: targetMonth });
    } else if (activeTab === 'yearly') {
      fetchPromise = api.get('/reports/yearly', { year: targetYear });
    }

    if (fetchPromise) {
      fetchPromise
        .then(res => res.success && setReportData(res))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [activeTab, targetDate, targetMonth, targetYear]);

  // Helpers
  const summary = reportData?.summary?.donemOzet || reportData?.summary?.gunlukOzet || reportData?.totals;
  const totalSales = summary?.toplamSatis ?? summary?.totalSales ?? 0;
  const totalExpenses = summary?.gider ?? summary?.totalExpenses ?? 0;
  const totalPersonnel = summary?.personelHakedis ?? summary?.totalPersonnel ?? 0;
  const netProfit = summary?.faaliyetKari ?? (totalSales - (totalExpenses + totalPersonnel));

  const personnelReport = reportData?.personnelReport;
  const expensesReport = reportData?.expensesReport;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Period Tabs */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Finansal Raporlar & Analizler</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gelir, gider ve personel hakediş raporlarını birlikte veya ayrı ayrı inceleyin.
          </p>
        </div>

        {/* Period Switcher */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'daily', label: 'Günlük' },
            { id: 'weekly', label: 'Haftalık' },
            { id: 'monthly', label: 'Aylık' },
            { id: 'yearly', label: 'Yıllık' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setActiveTab(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === p.id ? 'bg-white shadow-xs text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Filter Bar: Period Selector & Print Button */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Rapor Tarihi:</span>

          {activeTab === 'daily' && (
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-lg text-xs font-bold"
            />
          )}

          {activeTab === 'weekly' && (
            <div className="flex items-center space-x-2">
              <span className="text-slate-500">Hafta seçimi için gün:</span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="px-3 py-1 border border-slate-300 rounded-lg text-xs font-bold"
              />
              {reportData?.startDate && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                  {formatDateTR(reportData.startDate)} - {formatDateTR(reportData.endDate)}
                </span>
              )}
            </div>
          )}

          {activeTab === 'monthly' && (
            <div className="flex items-center space-x-2">
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="px-3 py-1 border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="01">Ocak</option>
                <option value="02">Şubat</option>
                <option value="03">Mart</option>
                <option value="04">Nisan</option>
                <option value="05">Mayıs</option>
                <option value="06">Haziran</option>
                <option value="07">Temmuz</option>
                <option value="08">Ağustos</option>
                <option value="09">Eylül</option>
                <option value="10">Ekim</option>
                <option value="11">Kasım</option>
                <option value="12">Aralık</option>
              </select>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="px-3 py-1 border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          )}

          {activeTab === 'yearly' && (
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-lg text-xs font-bold"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          )}
        </div>

        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Yazdır / PDF</span>
        </button>
      </div>

      {/* 3. View Mode Scope Switcher (Birlikte / Sadece Gelir / Sadece Gider / Personel) */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-1.5">
        <button
          onClick={() => setViewScope('all')}
          className={`flex-1 min-w-[150px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            viewScope === 'all'
              ? 'bg-white shadow-xs text-blue-700 border border-blue-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Layers className="w-4 h-4 text-blue-600" />
          <span>📊 Gelir & Gider (Birlikte)</span>
        </button>

        <button
          onClick={() => setViewScope('income')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            viewScope === 'income'
              ? 'bg-white shadow-xs text-emerald-700 border border-emerald-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>📈 Sadece Gelirler</span>
        </button>

        <button
          onClick={() => setViewScope('expenses')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            viewScope === 'expenses'
              ? 'bg-white shadow-xs text-rose-700 border border-rose-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <TrendingDown className="w-4 h-4 text-rose-600" />
          <span>📉 Sadece Giderler</span>
        </button>

        <button
          onClick={() => setViewScope('personnel')}
          className={`flex-1 min-w-[160px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
            viewScope === 'personnel'
              ? 'bg-white shadow-xs text-amber-700 border border-amber-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Users className="w-4 h-4 text-amber-600" />
          <span>👥 Personel & Avans Raporu</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Rapor verileri hazırlanıyor...</div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* GÖRÜNÜM 1: GELİR & GİDER BİRLİKTE (KONSOLİDE FAALİYET) */}
          {/* ======================================================== */}
          {viewScope === 'all' && (
            <div className="space-y-6">
              {/* 4 Ana Konsolide Kart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-emerald-700 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Toplam Gelir</span>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">{formatCurrency(totalSales)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Nakit: {formatCurrency(summary?.nakitSatis ?? 0)} | Kart: {formatCurrency(summary?.kartSatis ?? 0)}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-rose-700 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">İşletme Giderleri</span>
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-rose-700">{formatCurrency(totalExpenses)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Fatura & Mal Alımı & Genel Giderler
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-amber-700 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Personel Hakedişi</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black text-amber-700">{formatCurrency(totalPersonnel)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Saatlik/Günlük Çalışma Hakedişleri
                  </div>
                </div>

                <div className={`p-5 rounded-2xl shadow-md border ${
                  netProfit >= 0 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50/70 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Net Faaliyet Sonucu</span>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatCurrency(netProfit)}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Gelir - (Gider + Personel Maliyeti)
                  </div>
                </div>
              </div>

              {/* Gelir ve Gider Karşılaştırma Özeti */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="font-bold text-sm text-slate-800 mb-4 flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>Dönemsel Gelir & Gider Dağılım Özeti</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Sol: Gelir Kalemleri */}
                  <div className="space-y-3 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
                    <div className="font-bold text-emerald-900 text-sm flex items-center justify-between">
                      <span>Gelir Kaynakları</span>
                      <span>{formatCurrency(totalSales)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-emerald-100">
                      <span className="text-slate-600">DK Satışları:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(summary?.dkSatis ?? 0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-emerald-100">
                      <span className="text-slate-600">Palm Satışları:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(summary?.palmSatis ?? 0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-emerald-100">
                      <span className="text-slate-600">Nakit Tahsilat:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(summary?.nakitSatis ?? 0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-600">Kredi Kartı Tahsilat:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(summary?.kartSatis ?? 0)}</span>
                    </div>
                  </div>

                  {/* Sağ: Gider Kalemleri */}
                  <div className="space-y-3 bg-rose-50/40 p-4 rounded-xl border border-rose-100">
                    <div className="font-bold text-rose-900 text-sm flex items-center justify-between">
                      <span>Gider ve Yükümlülükler</span>
                      <span>{formatCurrency(totalExpenses + totalPersonnel)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-rose-100">
                      <span className="text-slate-600">DK İşletme Giderleri:</span>
                      <span className="font-bold text-rose-700">{formatCurrency(summary?.dkGider ?? 0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-rose-100">
                      <span className="text-slate-600">Palm İşletme Giderleri:</span>
                      <span className="font-bold text-rose-700">{formatCurrency(summary?.palmGider ?? 0)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-rose-100">
                      <span className="text-slate-600">Personel Çalışma Hakedişi:</span>
                      <span className="font-bold text-amber-700">{formatCurrency(totalPersonnel)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-600">Personele Fiilen Ödenen (Avans Dahil):</span>
                      <span className="font-bold text-blue-700">{formatCurrency(personnelReport?.totals?.total_paid ?? 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personel Hakediş ve Kalan Borç Kısa Özeti */}
              {personnelReport?.employees?.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span>Personel Hakediş & Avans Hızlı Özeti</span>
                    </h4>
                    <button
                      onClick={() => setViewScope('personnel')}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                    >
                      Tüm Detayları Gör →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-4">Personel</th>
                          <th className="py-2.5 px-4 text-center">Çalışılan Saat</th>
                          <th className="py-2.5 px-4 text-right">Dönem Hakedişi</th>
                          <th className="py-2.5 px-4 text-right">Alınan Avans</th>
                          <th className="py-2.5 px-4 text-right">Ödenen Tutar</th>
                          <th className="py-2.5 px-4 text-right">Kalan Şirket Borcu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {personnelReport.employees.slice(0, 5).map(emp => (
                          <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-bold text-slate-800">{emp.name}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-blue-700">{emp.total_hours} sa</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{formatCurrency(emp.total_accrual)}</td>
                            <td className="py-2.5 px-4 text-right text-amber-700 font-medium">{formatCurrency(emp.total_advance)}</td>
                            <td className="py-2.5 px-4 text-right text-emerald-700 font-medium">{formatCurrency(emp.total_paid)}</td>
                            <td className="py-2.5 px-4 text-right font-black text-rose-700">{formatCurrency(emp.current_balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* GÖRÜNÜM 2: SADECE GELİRLER RAPORU                        */}
          {/* ======================================================== */}
          {viewScope === 'income' && (
            <div className="space-y-6">
              {/* Gelir Kartları */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Toplam Gelir</span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(totalSales)}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Konsolide Tüm Satışlar</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-blue-600 uppercase">DK Satışları</span>
                  <div className="text-2xl font-black text-blue-900 mt-1">{formatCurrency(summary?.dkSatis ?? 0)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Pay: {totalSales > 0 ? ((summary?.dkSatis / totalSales) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-emerald-600 uppercase">Palm Satışları</span>
                  <div className="text-2xl font-black text-emerald-900 mt-1">{formatCurrency(summary?.palmSatis ?? 0)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Pay: {totalSales > 0 ? ((summary?.palmSatis / totalSales) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-indigo-600 uppercase">Ödeme Tipi Dağılımı</span>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    💵 Nakit: {formatCurrency(summary?.nakitSatis ?? 0)}
                  </div>
                  <div className="text-sm font-bold text-blue-700 mt-0.5">
                    💳 Kart: {formatCurrency(summary?.kartSatis ?? 0)}
                  </div>
                </div>
              </div>

              {/* Günlük Satış Kırılımı Tablosu */}
              {activeTab === 'daily' && reportData?.salesBreakdown && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-800 mb-3">Günün Satış Detayları (İşletme & Ödeme Tipi)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-4">İşletme</th>
                          <th className="py-2.5 px-4">Ödeme Yöntemi</th>
                          <th className="py-2.5 px-4 text-center">İşlem Adedi</th>
                          <th className="py-2.5 px-4 text-right">Toplam Satış Tutarı</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.salesBreakdown.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.business_id === 'DK' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {item.business_id}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-700">
                              {item.payment_type === 'NAKIT' ? '💵 Nakit Kasa' : '💳 Kredi Kartı (POS)'}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{item.count}</td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Haftalık Satış Kırılımı */}
              {activeTab === 'weekly' && reportData?.dailyBreakdown && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-800 mb-3">Haftalık Gün Gün Satış Tablosu</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-4">Tarih</th>
                          <th className="py-2.5 px-4">İşletme</th>
                          <th className="py-2.5 px-4 text-right">Nakit Satış</th>
                          <th className="py-2.5 px-4 text-right">Kart Satış</th>
                          <th className="py-2.5 px-4 text-right">Toplam Satış</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.dailyBreakdown.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-4 font-semibold text-slate-700">{formatDateTR(row.date)}</td>
                            <td className="py-2 px-4 font-bold">{row.business_id}</td>
                            <td className="py-2 px-4 text-right text-emerald-700 font-semibold">{formatCurrency(row.nakit)}</td>
                            <td className="py-2 px-4 text-right text-blue-700 font-semibold">{formatCurrency(row.kart)}</td>
                            <td className="py-2 px-4 text-right font-black text-slate-900">{formatCurrency(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Aylık Satış Kırılımı */}
              {activeTab === 'monthly' && reportData?.dailySales && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-800 mb-3">Ay Boyunca Günlük Satış Akışı</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-4">Tarih</th>
                          <th className="py-2.5 px-4 text-right">DK Satış</th>
                          <th className="py-2.5 px-4 text-right">Palm Satış</th>
                          <th className="py-2.5 px-4 text-right">Günlük Toplam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.dailySales.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-4 font-semibold text-slate-700">{formatDateTR(row.date)}</td>
                            <td className="py-2 px-4 text-right text-blue-700 font-medium">{formatCurrency(row.dk_total)}</td>
                            <td className="py-2 px-4 text-right text-emerald-700 font-medium">{formatCurrency(row.palm_total)}</td>
                            <td className="py-2 px-4 text-right font-black text-slate-900">{formatCurrency(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Yıllık Satış Kırılımı */}
              {activeTab === 'yearly' && reportData?.monthlySales && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-800 mb-3">Aylara Göre Yıllık Satış Dökümü</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-4">Ay</th>
                          <th className="py-2.5 px-4 text-right">DK Satış</th>
                          <th className="py-2.5 px-4 text-right">Palm Satış</th>
                          <th className="py-2.5 px-4 text-right">Nakit Toplam</th>
                          <th className="py-2.5 px-4 text-right">Kart Toplam</th>
                          <th className="py-2.5 px-4 text-right">Aylık Toplam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.monthlySales.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-bold text-slate-800">{row.month}. Ay</td>
                            <td className="py-2.5 px-4 text-right text-blue-700">{formatCurrency(row.dk_sales)}</td>
                            <td className="py-2.5 px-4 text-right text-emerald-700">{formatCurrency(row.palm_sales)}</td>
                            <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(row.nakit_sales)}</td>
                            <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(row.kart_sales)}</td>
                            <td className="py-2.5 px-4 text-right font-black text-slate-900">{formatCurrency(row.total_sales)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* GÖRÜNÜM 3: SADECE GİDERLER RAPORU                        */}
          {/* ======================================================== */}
          {viewScope === 'expenses' && (
            <div className="space-y-6">
              {/* Gider Kartları */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Toplam Harcama</span>
                  <div className="text-2xl font-black text-rose-700 mt-1">{formatCurrency(totalExpenses)}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Seçili Dönem Toplam Gideri</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-blue-600 uppercase">DK Giderleri</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(summary?.dkGider ?? 0)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Pay: {totalExpenses > 0 ? (((summary?.dkGider ?? 0) / totalExpenses) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs font-bold text-emerald-600 uppercase">Palm Giderleri</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(summary?.palmGider ?? 0)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Pay: {totalExpenses > 0 ? (((summary?.palmGider ?? 0) / totalExpenses) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              {/* Kategori Bazlı Gider Tablosu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center space-x-2">
                    <PieChart className="w-4 h-4 text-rose-600" />
                    <span>Gider Kategorisi Dağılımı</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-4">Kategori</th>
                          <th className="py-2.5 px-4 text-center">İşlem Adedi</th>
                          <th className="py-2.5 px-4 text-right">Tutar</th>
                          <th className="py-2.5 px-4 text-right">Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expensesReport?.byCategory?.length > 0 ? (
                          expensesReport.byCategory.map((cat, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-bold text-slate-800">{cat.category_name}</td>
                              <td className="py-2.5 px-4 text-center text-slate-500">{cat.count || 1}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-rose-700">{formatCurrency(cat.total_amount)}</td>
                              <td className="py-2.5 px-4 text-right text-slate-500">
                                {totalExpenses > 0 ? ((cat.total_amount / totalExpenses) * 100).toFixed(1) : 0}%
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-4 text-center text-slate-400">Bu dönemde gider kaydı bulunmuyor.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ödeme Kaynağı (Kasa / Banka) Dağılımı */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center space-x-2">
                    <Wallet className="w-4 h-4 text-indigo-600" />
                    <span>Ödeme Kaynağı Dağılımı</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                          <th className="py-2.5 px-4">Ödeme Kaynağı</th>
                          <th className="py-2.5 px-4 text-right">Çıkış Tutarı</th>
                          <th className="py-2.5 px-4 text-right">Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expensesReport?.bySource?.length > 0 ? (
                          expensesReport.bySource.map((src, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-bold text-slate-800">
                                {src.payment_source === 'DK_KASA' && '💵 DK Nakit Kasa'}
                                {src.payment_source === 'PALM_KASA' && '💵 Palm Nakit Kasa'}
                                {src.payment_source === 'DK_BANKA' && '🏦 DK Banka Hesabı'}
                                {src.payment_source === 'PALM_BANKA' && '🏦 Palm Banka Hesabı'}
                                {!['DK_KASA','PALM_KASA','DK_BANKA','PALM_BANKA'].includes(src.payment_source) && src.payment_source}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-900">{formatCurrency(src.total_amount)}</td>
                              <td className="py-2.5 px-4 text-right text-slate-500">
                                {totalExpenses > 0 ? ((src.total_amount / totalExpenses) * 100).toFixed(1) : 0}%
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="py-4 text-center text-slate-400">Kaynak kaydı bulunmuyor.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* GÖRÜNÜM 4: PERSONEL HAKEDİŞ, TOPLAM SAAT & AVANS RAPORU   */}
          {/* ======================================================== */}
          {viewScope === 'personnel' && (
            <div className="space-y-6">
              {/* Personel KPI Kartları */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-blue-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Toplam Çalışma</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {personnelReport?.totals?.total_hours ?? 0} <span className="text-sm font-semibold text-slate-400">sa</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Dönem içi saat girişi</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-amber-600 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Toplam Hakediş</span>
                  </div>
                  <div className="text-2xl font-black text-amber-700">
                    {formatCurrency(personnelReport?.totals?.total_accrual ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Saatlik ücret çarpanı ile</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-rose-600 mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Verilen Avanslar</span>
                  </div>
                  <div className="text-2xl font-black text-rose-700">
                    {formatCurrency(personnelReport?.totals?.total_advance ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Dönem içi avans çıkışları</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-emerald-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Toplam Ödenen</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700">
                    {formatCurrency(personnelReport?.totals?.total_paid ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Maaş & Pazar ödemeleri</div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-lg">
                  <div className="flex items-center space-x-2 text-amber-400 mb-1">
                    <Building2 className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Kalan Şirket Borcu</span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    {formatCurrency(personnelReport?.totals?.total_balance ?? 0)}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">Ödenecek güncel bakiye</div>
                </div>
              </div>

              {/* Detaylı Personel Hakediş, Saat, Avans Tablosu */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>Personel Hakediş, Saat, Avans & Ödeme Dökümü</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Giriş-çıkış saatleri ile hesaplanan hakedişler, çekilen avanslar ve personele kalan net bakiye.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                        <th className="py-2.5 px-4">Personel Adı</th>
                        <th className="py-2.5 px-4">Görevi</th>
                        <th className="py-2.5 px-4 text-center">Saat Ücreti</th>
                        <th className="py-2.5 px-4 text-center">Çalışılan Saat</th>
                        <th className="py-2.5 px-4 text-center">Gün</th>
                        <th className="py-2.5 px-4 text-right">Dönem Hakedişi</th>
                        <th className="py-2.5 px-4 text-right text-rose-700">Alınan Avans</th>
                        <th className="py-2.5 px-4 text-right text-emerald-700">Toplam Ödenen</th>
                        <th className="py-2.5 px-4 text-right">Dönem Kalanı</th>
                        <th className="py-2.5 px-4 text-right font-black text-rose-800">Toplam Borç (Bakiye)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {personnelReport?.employees?.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{emp.name}</td>
                          <td className="py-2.5 px-4 text-slate-500">{emp.role || 'Ortak Personel'}</td>
                          <td className="py-2.5 px-4 text-center font-medium text-slate-600">
                            {formatCurrency(emp.hourly_rate)} / sa
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-black">
                              {emp.total_hours} sa
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-600 font-medium">
                            {emp.days_worked} gün
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-slate-900">
                            {formatCurrency(emp.total_accrual)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-rose-700">
                            {emp.total_advance > 0 ? `-${formatCurrency(emp.total_advance)}` : '₺0'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                            {formatCurrency(emp.total_paid)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-slate-800">
                            {formatCurrency(emp.net_period_balance)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-rose-700 bg-rose-50/30">
                            {formatCurrency(emp.current_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100/80 font-black border-t-2 border-slate-300 text-slate-900">
                        <td className="py-3 px-4" colSpan="3">GENEL TOPLAM</td>
                        <td className="py-3 px-4 text-center text-blue-800">
                          {personnelReport?.totals?.total_hours ?? 0} sa
                        </td>
                        <td className="py-3 px-4 text-center">-</td>
                        <td className="py-3 px-4 text-right text-slate-900">
                          {formatCurrency(personnelReport?.totals?.total_accrual ?? 0)}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-700">
                          {formatCurrency(personnelReport?.totals?.total_advance ?? 0)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700">
                          {formatCurrency(personnelReport?.totals?.total_paid ?? 0)}
                        </td>
                        <td className="py-3 px-4 text-right">-</td>
                        <td className="py-3 px-4 text-right text-rose-800 font-black">
                          {formatCurrency(personnelReport?.totals?.total_balance ?? 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
