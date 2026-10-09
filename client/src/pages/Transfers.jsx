import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Trash2, 
  Building2, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function Transfers({ onOpenCashTx }) {
  const { selectedBusiness, customStartDate, customEndDate, refreshKey, triggerRefresh } = useFilters();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    setLoading(true);
    api.get('/cash/transactions', {
      business_id: selectedBusiness,
      startDate: customStartDate,
      endDate: customEndDate,
    })
      .then(res => {
        if (res.success) setTransfers(res.transactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBusiness, customStartDate, customEndDate, refreshKey]);

  const handleCancelClick = (tx) => {
    setCancelTarget(tx);
    executeCancel(tx.id, null);
  };

  const executeCancel = async (id, reason) => {
    try {
      const res = await api.delete(`/cash/transactions/${id}`, reason ? { change_reason: reason } : {});
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        setCancelTarget(null);
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Para Giriş/Çıkış & Transferler</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kasa ile banka arası aktarımlar ve gider dışı para giriş-çıkışları.
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
            <span>↕️ Yeni Transfer</span>
          </button>
        </div>
      </div>

      {/* Info Notice about Transfers not being expenses */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start space-x-3 text-indigo-900 text-xs">
        <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Önemli Muhasebe Kuralı:</span>
          <p className="text-indigo-800 mt-0.5">
            Kasa ve banka arasındaki para transferleri gider veya gelir olarak kabul edilmez. Sadece hesaplar arası fon kaydırmadır ve işletmenin toplam net varlığını değiştirmez.
          </p>
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">İşlem Türü</th>
                <th className="py-3 px-4">İşletme</th>
                <th className="py-3 px-4">Hareket Detayı</th>
                <th className="py-3 px-4">Hesap Yönü</th>
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
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Kayıt bulunamadı.</td>
                </tr>
              ) : (
                transfers.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{formatDateTR(tx.date)}</td>
                    <td className="py-2.5 px-4">
                      {tx.type === 'IN' && (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                          + Para Girişi
                        </span>
                      )}
                      {tx.type === 'OUT' && (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800">
                          - Para Çıkışı
                        </span>
                      )}
                      {tx.type === 'TRANSFER' && (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800">
                          ↕️ Hesap Transferi
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
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{tx.sub_type}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-600">
                      {tx.type === 'TRANSFER' ? (
                        <span className="text-indigo-700 font-bold">
                          {tx.source_account === 'KASA' ? 'Nakit Kasa' : `${tx.business_id} Banka`} ➔ {tx.target_account === 'KASA' ? 'Nakit Kasa' : `${tx.business_id} Banka`}
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-700">
                          {tx.source_account === 'KASA' ? 'Merkezi Nakit Kasa' : `${tx.business_id} Banka`}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-[200px]">{tx.description || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleCancelClick(tx)}
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
          setCancelTarget(null);
        }}
        onConfirm={(reason) => {
          if (cancelTarget) {
            executeCancel(cancelTarget.id, reason);
          }
        }}
        title="Kapanmış Gün Transferini İptal Etme"
      />
    </div>
  );
}
