import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeftRight, 
  Plus, 
  Trash2, 
  Calendar,
  Building2,
  RefreshCw,
  ArrowRight,
  Percent 
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function CashManagement({ onOpenCashTx, onNavigate }) {
  const { selectedBusiness, period, customEndDate, refreshKey, triggerRefresh } = useFilters();
  const todayStr = new Date().toISOString().split('T')[0];
  // Default to full month so monthly cash contributions and totals are visible immediately
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState(todayStr);
  // Default to showing all historical transactions so no past entry is hidden by date filter
  const [showAllDates, setShowAllDates] = useState(true);

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState(''); // 'IN', 'OUT', 'TRANSFER'

  // Cancellation
  const [targetCancelTx, setTargetCancelTx] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    setLoading(true);
    const txParams = {
      business_id: selectedBusiness,
      type: filterType,
    };
    if (!showAllDates) {
      txParams.startDate = startDate;
      txParams.endDate = endDate;
    }

    Promise.all([
      api.get('/cash/summary', { startDate, endDate }),
      api.get('/cash/transactions', txParams)
    ])
      .then(([sumRes, txRes]) => {
        if (sumRes.success) setSummary(sumRes.summary);
        if (txRes.success) setTransactions(txRes.transactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBusiness, startDate, endDate, showAllDates, filterType, refreshKey]);

  const handleCancelClick = (tx) => {
    setTargetCancelTx(tx);
    executeCancel(tx.id, null);
  };

  const executeCancel = async (txId, reason) => {
    try {
      const res = await api.delete(`/cash/transactions/${txId}`, reason ? { change_reason: reason } : {});
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        setTargetCancelTx(null);
        setShowReasonModal(false);
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setMsg({ text: err.message || 'İptal edilemedi.', type: 'error' });
      }
    }
  };

  const s = summary;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Kasa & Para Hareketleri</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            DK ve Palm nakit kasaları, kart POS toplamları ve kasa giriş/çıkış akışları.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onOpenCashTx('IN')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Para Girişi</span>
          </button>
          <button
            onClick={() => onOpenCashTx('OUT')}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>- Para Çıkışı</span>
          </button>
          <button
            onClick={() => onOpenCashTx('TRANSFER')}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>↕️ Transfer</span>
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`p-3 rounded-xl text-xs ${
          msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Kasa Dönemi:</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
            <span className="text-slate-400 font-bold">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAllDates(true);
            }}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              showAllDates
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
            }`}
          >
            🌐 Tüm Geçmiş (Filtresiz)
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate('2026-10-01');
              setEndDate(todayStr);
              setShowAllDates(false);
            }}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              !showAllDates && startDate === '2026-10-01' && endDate === todayStr
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
            }`}
          >
            📅 Tüm Ekim
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate(todayStr);
              setEndDate(todayStr);
              setShowAllDates(false);
            }}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              !showAllDates && startDate === todayStr && endDate === todayStr
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}
          >
            ⚡ Bugün
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate('2026-10-05');
              setEndDate('2026-10-08');
              setShowAllDates(false);
            }}
            className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              !showAllDates && startDate === '2026-10-05' && endDate === '2026-10-08'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
            }`}
          >
            🌟 05-08 Ekim
          </button>
        </div>

        <button
          onClick={triggerRefresh}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Verileri Yenile"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Single Unified Cash Register Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  TEK MERKEZİ NAKİT KASA (DK + PALM BİRLEŞİK)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                  Ortak Havuz
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                DK ve Palm nakit satışları tek bir merkezi kasada toplanır. (Seçili Dönem: <strong className="text-emerald-300 font-bold">{formatDateTR(startDate)} — {formatDateTR(endDate)}</strong>)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
          <div>
            <span className="text-xs text-slate-300 block uppercase font-semibold">Güncel Merkezi Nakit Bakiye</span>
            <span className="text-3xl font-black text-emerald-300">
              {formatCurrency(s?.tekNakitKasa?.toplamBakiye ?? s?.ortak?.toplamNakit)}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-300 block">Dönem DK Nakit Katkısı</span>
            <span className="text-lg font-bold text-white">
              {formatCurrency(s?.tekNakitKasa?.donemDkNakitKatki ?? s?.dk?.nakit)}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-300 block">Dönem Palm Nakit Katkısı</span>
            <span className="text-lg font-bold text-white">
              {formatCurrency(s?.tekNakitKasa?.donemPalmNakitKatki ?? s?.palm?.nakit)}
            </span>
          </div>
        </div>
      </div>

      {/* Kredi Kartı Kasaları Bölümü (İşletme Bazlı Bağımsız Ayrı Kasalar - Ortak Kasa Yok) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-800 tracking-wide uppercase">
                KREDİ KARTI KASALARI (BAĞIMSIZ AYRI KASALAR)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nakit kasa gibi ortak havuz mantığı yoktur. DK ve Palm kredi kartı pos tahsilatları ve komisyonları birbirinden tamamen bağımsız ayrı kasalardır.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DK KREDİ KARTI KASASI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div>
              <div className="flex items-center justify-between text-blue-700 font-bold text-xs uppercase mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="font-extrabold text-sm">DK Kredi Kartı Kasası</span>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 text-[11px] font-black border border-blue-200">
                  Bağımsız Ayrı Kasa
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1">
                  <span>Brüt Kart Satışı:</span>
                  <span className="font-bold text-slate-900 text-sm">{formatCurrency(s?.dkKart?.brut ?? s?.dk?.kart)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-amber-700 bg-amber-50/50 px-2 rounded-lg">
                  <span>Komisyon Tutarı:</span>
                  <span className="font-bold">-{formatCurrency(s?.dkKart?.komisyonTutari || 0)}</span>
                </div>
                {(s?.dkKart?.oranFarki !== 0 && s?.dkKart?.oranFarki !== undefined) && (
                  <div className="flex justify-between items-center py-1 text-slate-500 px-2">
                    <span>Gün Sonu Oran Farkı:</span>
                    <span>{formatCurrency(s?.dkKart?.oranFarki || 0)}</span>
                  </div>
                )}
                <div className="pt-2.5 mt-1 border-t border-slate-100 flex justify-between items-center font-black text-blue-700 text-base">
                  <span>Net Bankaya Düşen:</span>
                  <span>{formatCurrency(s?.dkKart?.netBankayaDusen ?? 0)}</span>
                </div>
              </div>
            </div>
            {onNavigate && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => onNavigate('sales')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                >
                  <span>Satış & Ciro Takibi</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* PALM KREDİ KARTI KASASI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div>
              <div className="flex items-center justify-between text-emerald-700 font-bold text-xs uppercase mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="font-extrabold text-sm">Palm Kredi Kartı Kasası</span>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-200">
                  Bağımsız Ayrı Kasa
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between items-center py-1">
                  <span>Brüt Kart Satışı:</span>
                  <span className="font-bold text-slate-900 text-sm">{formatCurrency(s?.palmKart?.brut ?? s?.palm?.kart)}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-amber-700 bg-amber-50/50 px-2 rounded-lg">
                  <span>Komisyon Tutarı:</span>
                  <span className="font-semibold">-{formatCurrency(s?.palmKart?.komisyonTutari || 0)}</span>
                </div>
                {(s?.palmKart?.oranFarki !== 0 && s?.palmKart?.oranFarki !== undefined) && (
                  <div className="flex justify-between items-center py-1 text-slate-500 px-2">
                    <span>Gün Sonu Oran Farkı:</span>
                    <span>{formatCurrency(s?.palmKart?.oranFarki || 0)}</span>
                  </div>
                )}
                <div className="pt-2.5 mt-1 border-t border-slate-100 flex justify-between items-center font-black text-emerald-700 text-base">
                  <span>Net Bankaya Düşen:</span>
                  <span>{formatCurrency(s?.palmKart?.netBankayaDusen ?? 0)}</span>
                </div>
              </div>
            </div>
            {onNavigate && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => onNavigate('sales')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
                >
                  <span>Satış & Ciro Takibi</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cash Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm text-slate-800">Para Giriş, Çıkış ve Transfer Kayıtları</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                {transactions.length} işlem
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {showAllDates
                ? '🌐 Tüm geçmiş ve güncel kayıtlar listeleniyor.'
                : `📅 ${formatDateTR(startDate)} — ${formatDateTR(endDate)} tarihleri arası listeleniyor.`}
            </p>
          </div>
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilterType('')}
              className={`px-2.5 py-1 rounded-lg font-medium ${filterType === '' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'}`}
            >
              Tümü
            </button>
            <button
              onClick={() => setFilterType('IN')}
              className={`px-2.5 py-1 rounded-lg font-medium ${filterType === 'IN' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-slate-600'}`}
            >
              + Girişler
            </button>
            <button
              onClick={() => setFilterType('OUT')}
              className={`px-2.5 py-1 rounded-lg font-medium ${filterType === 'OUT' ? 'bg-white shadow-xs text-rose-700 font-bold' : 'text-slate-600'}`}
            >
              - Çıkışlar
            </button>
            <button
              onClick={() => setFilterType('TRANSFER')}
              className={`px-2.5 py-1 rounded-lg font-medium ${filterType === 'TRANSFER' ? 'bg-white shadow-xs text-indigo-700 font-bold' : 'text-slate-600'}`}
            >
              ↕️ Transferler
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[850px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Tür</th>
                <th className="py-3 px-4">İşletme</th>
                <th className="py-3 px-4">Hareket Nedeni</th>
                <th className="py-3 px-4">Hesap / Yön</th>
                <th className="py-3 px-4">Açıklama</th>
                <th className="py-3 px-4 text-right">Tutar</th>
                <th className="py-3 px-4 text-center">İptal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Henüz para hareketi bulunmuyor.</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{formatDateTR(tx.date)}</td>
                    <td className="py-2.5 px-4">
                      {tx.type === 'IN' && (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                          + Giriş
                        </span>
                      )}
                      {tx.type === 'OUT' && (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800">
                          - Çıkış
                        </span>
                      )}
                      {tx.type === 'TRANSFER' && (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800">
                          ↕️ Transfer
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {tx.source_account === 'KASA' || tx.business_id === 'ORTAK' ? (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                          💵 Tek Kasa (Merkezi)
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          tx.business_id === 'DK' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          🏦 {tx.business_id} Banka
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{tx.sub_type}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {tx.type === 'TRANSFER' ? (
                        <span className="font-semibold text-slate-700">
                          {tx.source_account === 'KASA' ? 'Nakit Kasa' : `${tx.business_id} Banka`} ➔ {tx.target_account === 'KASA' ? 'Nakit Kasa' : `${tx.business_id} Banka`}
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-700">
                          {tx.source_account === 'KASA' ? 'Merkezi Nakit Kasa' : `${tx.business_id} Banka`}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-[200px]">{tx.description || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleCancelClick(tx)}
                        title="İptal Et"
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => {
          setShowReasonModal(false);
          setTargetCancelTx(null);
        }}
        onConfirm={(reason) => {
          if (targetCancelTx) {
            executeCancel(targetCancelTx.id, reason);
          }
        }}
        title="Kapanmış Gün Para Hareketini İptal Etme"
      />
    </div>
  );
}
