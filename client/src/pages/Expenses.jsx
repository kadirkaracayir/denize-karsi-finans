import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Filter, 
  Building2, 
  Calendar, 
  RefreshCw,
  FolderPlus,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function Expenses({ onOpenQuickExpense }) {
  const { selectedBusiness, customStartDate, customEndDate, refreshKey, triggerRefresh } = useFilters();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [loading, setLoading] = useState(true);

  // New Category
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Cancel Expense
  const [cancelTarget, setCancelTarget] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    api.get('/expenses/categories')
      .then(res => res.success && setCategories(res.categories))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/expenses', {
      business_id: selectedBusiness,
      startDate: customStartDate,
      endDate: customEndDate,
      category_id: selectedCat,
      payment_source: selectedSource,
      limit: 200
    })
      .then(res => {
        if (res.success) setExpenses(res.expenses);
      })
      .catch(err => {
        setMsg({ text: err.message || 'Giderler yüklenemedi.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [selectedBusiness, customStartDate, customEndDate, selectedCat, selectedSource, refreshKey]);

  const handleCancelClick = (exp) => {
    setCancelTarget(exp);
    executeCancel(exp.id, null);
  };

  const executeCancel = async (id, reason) => {
    try {
      const res = await api.delete(`/expenses/${id}`, reason ? { change_reason: reason } : {});
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

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await api.post('/expenses/categories', { name: newCatName.trim() });
      if (res.success) {
        setNewCatName('');
        setShowCatModal(false);
        const refreshed = await api.get('/expenses/categories');
        if (refreshed.success) setCategories(refreshed.categories);
      }
    } catch (err) {
      alert(err.message || 'Kategori eklenemedi.');
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Gider Yönetimi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            DK, Palm ve Ortak işletme harcamaları ve tedarikçi ödemeleri.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCatModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-slate-500" />
            <span>+ Kategori Ekle</span>
          </button>
          <button
            onClick={onOpenQuickExpense}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Gider Ekle</span>
          </button>
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

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-700"
        >
          <option value="">Tüm Gider Kategorileri</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-700"
        >
          <option value="">Tüm Ödeme Kaynakları</option>
          <option value="KASA">💵 Merkezi Nakit Kasa (Tek Kasa)</option>
          <option value="DK_BANKA">🏦 DK Banka Hesabı</option>
          <option value="PALM_BANKA">🏦 Palm Banka Hesabı</option>
        </select>

        <div className="ml-auto text-xs font-bold text-slate-700">
          Toplam Gider: <span className="text-rose-700 text-sm ml-1">{formatCurrency(totalExpense)}</span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">İşletme</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Ödeme Kaynağı</th>
                <th className="py-3 px-4">Açıklama</th>
                <th className="py-3 px-4 text-right">Tutar (TL)</th>
                <th className="py-3 px-4 text-center">İptal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Gider kaydı bulunamadı.</td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{formatDateTR(e.date)}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        e.business_id === 'DK' ? 'bg-blue-100 text-blue-800' :
                        e.business_id === 'PALM' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {e.business_id}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{e.category_name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {e.payment_source === 'KASA' || e.payment_source.includes('KASA') ? '💵 Nakit Kasa' : `🏦 ${e.payment_source}`}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-[220px]">{e.description || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-black text-rose-700 text-sm">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleCancelClick(e)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
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
                <td colSpan={5} className="py-3 px-4">
                  DÖNEM TOPLAM GİDER ({expenses.length} Kayıt)
                </td>
                <td className="py-3 px-4 text-right text-sm text-rose-400">
                  {formatCurrency(totalExpense)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* New Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Yeni Gider Kategorisi Ekle</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Kategori Adı
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Güvenlik Hizmeti"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        title="Kapanmış Gün Giderini İptal Etme"
      />
    </div>
  );
}
