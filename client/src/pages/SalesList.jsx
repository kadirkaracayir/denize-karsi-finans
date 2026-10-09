import React, { useState, useEffect } from 'react';
import { 
  BadgePercent, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Zap, 
  Calendar,
  Building2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR, formatDateTimeTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function SalesList({ onNavigate, onOpenQuickSale }) {
  const { user, canEditClosedDay } = useAuth();
  const { selectedBusiness, period, customStartDate, customEndDate, refreshKey, triggerRefresh } = useFilters();

  const [sales, setSales] = useState([]);
  const [paymentType, setPaymentType] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Cancellation state
  const [targetCancelSale, setTargetCancelSale] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    setErrorMsg('');
    api.get('/sales', {
      business_id: selectedBusiness,
      startDate: customStartDate,
      endDate: customEndDate,
      payment_type: paymentType,
      search,
      limit: 200
    })
      .then(res => {
        if (res.success) {
          setSales(res.sales);
        }
      })
      .catch(err => {
        setErrorMsg(err.message || 'Satışlar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [selectedBusiness, customStartDate, customEndDate, paymentType, search, refreshKey]);

  const handleCancelClick = (sale) => {
    setTargetCancelSale(sale);
    // Try to delete; if closed day, server will prompt requiresReason
    executeCancel(sale.id, null);
  };

  const executeCancel = async (saleId, reason) => {
    try {
      const res = await api.delete(`/sales/${saleId}`, reason ? { change_reason: reason } : {});
      if (res.success) {
        setSuccessMsg(res.message);
        setTargetCancelSale(null);
        setShowReasonModal(false);
        triggerRefresh();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setErrorMsg(err.message || 'Satış iptal edilemedi.');
      }
    }
  };

  const totalNakit = sales.filter(s => s.payment_type === 'NAKIT').reduce((acc, s) => acc + s.amount, 0);
  const totalKart = sales.filter(s => s.payment_type === 'KART').reduce((acc, s) => acc + s.amount, 0);
  const totalAmount = totalNakit + totalKart;

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <BadgePercent className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Günlük Satışlar</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            İşletme bazlı filtreli satış hareketleri ve ödeme dökümü.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('fast-sales')}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors border border-amber-300"
          >
            <Zap className="w-4 h-4 text-amber-600" />
            <span>Hızlı Satış Matrisi</span>
          </button>
          <button
            onClick={() => onNavigate('excel-import')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Excel Aktar</span>
          </button>
          <button
            onClick={onOpenQuickSale}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Satış Ekle</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Açıklama veya kategori ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
          className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-700"
        >
          <option value="">Tüm Ödeme Tipleri</option>
          <option value="NAKIT">💵 Nakit</option>
          <option value="KART">💳 Kredi Kartı</option>
        </select>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">İşletme</th>
                <th className="py-3 px-4">Ödeme Tipi</th>
                <th className="py-3 px-4">Açıklama</th>
                <th className="py-3 px-4">Kaynak</th>
                <th className="py-3 px-4 text-right">Tutar (TL)</th>
                <th className="py-3 px-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Satışlar yükleniyor...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Filtrelere uygun satış kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{formatDateTR(s.date)}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        s.business_id === 'DK' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {s.business_id}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] ${
                        s.payment_type === 'NAKIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {s.payment_type === 'NAKIT' ? '💵 Nakit' : '💳 Kart'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-[200px]">{s.description || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-[10px]">{s.source}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">{formatCurrency(s.amount)}</td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleCancelClick(s)}
                        title="Satışı İptal Et"
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold text-xs">
                <td colSpan={4} className="py-3 px-4">
                  TOPLAM ({sales.length} Kayıt)
                </td>
                <td colSpan={2} className="py-3 px-4 text-slate-400">
                  Nakit: <span className="text-emerald-400">{formatCurrency(totalNakit)}</span> | Kart: <span className="text-blue-400">{formatCurrency(totalKart)}</span>
                </td>
                <td className="py-3 px-4 text-right text-sm text-white">
                  {formatCurrency(totalAmount)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => {
          setShowReasonModal(false);
          setTargetCancelSale(null);
        }}
        onConfirm={(reason) => {
          if (targetCancelSale) {
            executeCancel(targetCancelSale.id, reason);
          }
        }}
        title="Kapanmış Gün Satışını İptal Etme"
      />
    </div>
  );
}
