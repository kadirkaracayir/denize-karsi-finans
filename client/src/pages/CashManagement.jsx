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
  const { selectedBusiness, period, customStartDate, customEndDate, refreshKey, triggerRefresh } = useFilters();
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
    Promise.all([
      api.get('/cash/summary', { date: customEndDate }),
      api.get('/cash/transactions', {
        business_id: selectedBusiness,
        startDate: customStartDate,
        endDate: customEndDate,
        type: filterType,
      })
    ])
      .then(([sumRes, txRes]) => {
        if (sumRes.success) setSummary(sumRes.summary);
        if (txRes.success) setTransactions(txRes.transactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBusiness, customStartDate, customEndDate, filterType, refreshKey]);

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
                DK ve Palm nakit satışları tek bir fiziki/merkezi kasada toplanır ve harcamalar bu kasadan karşılanır.
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

      {/* Kredi Kartları Bilgi Kartları (Ayrı Kasalar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DK KART */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-blue-700 font-bold text-xs uppercase mb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4" />
                <span>DK Kredi Kartı Kasası</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800">Ayrı Kasa</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Brüt Kart Satışı:</span>
                <span className="font-bold text-slate-900">{formatCurrency(s?.dkKart?.brut ?? s?.dk?.kart)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Komisyon Tutarı:</span>
                <span className="font-semibold">-{formatCurrency(s?.dkKart?.komisyonTutari || 0)}</span>
              </div>
              {(s?.dkKart?.oranFarki !== 0 && s?.dkKart?.oranFarki !== undefined) && (
                <div className="flex justify-between text-slate-500">
                  <span>Gün Sonu Oran Farkı:</span>
                  <span>{formatCurrency(s?.dkKart?.oranFarki || 0)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-blue-700 text-sm">
                <span>Net Bankaya Düşen:</span>
                <span>{formatCurrency(s?.dkKart?.netBankayaDusen ?? 0)}</span>
              </div>
            </div>
          </div>
          {onNavigate && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
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

        {/* PALM KART */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-emerald-700 font-bold text-xs uppercase mb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4" />
                <span>Palm Kredi Kartı Kasası</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">Ayrı Kasa</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Brüt Kart Satışı:</span>
                <span className="font-bold text-slate-900">{formatCurrency(s?.palmKart?.brut ?? s?.palm?.kart)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Komisyon Tutarı:</span>
                <span className="font-semibold">-{formatCurrency(s?.palmKart?.komisyonTutari || 0)}</span>
              </div>
              {(s?.palmKart?.oranFarki !== 0 && s?.palmKart?.oranFarki !== undefined) && (
                <div className="flex justify-between text-slate-500">
                  <span>Gün Sonu Oran Farkı:</span>
                  <span>{formatCurrency(s?.palmKart?.oranFarki || 0)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-emerald-700 text-sm">
                <span>Net Bankaya Düşen:</span>
                <span>{formatCurrency(s?.palmKart?.netBankayaDusen ?? 0)}</span>
              </div>
            </div>
          </div>
          {onNavigate && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
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

      {/* Cash Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <h3 className="font-bold text-sm text-slate-800">Para Giriş, Çıkış ve Transfer Kayıtları</h3>
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
