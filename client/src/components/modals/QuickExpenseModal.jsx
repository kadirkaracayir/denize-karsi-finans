import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useFilters } from '../../context/FilterContext';
import ReasonModal from './ReasonModal';

export default function QuickExpenseModal({ isOpen, onClose, onSuccess }) {
  const { selectedBusiness, triggerRefresh } = useFilters();
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    business_id: selectedBusiness === 'ALL' ? 'DK' : selectedBusiness,
    date: '2026-10-08',
    category_id: '',
    amount: '',
    payment_source: 'DK_KASA',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/expenses/categories')
        .then(res => {
          if (res.success && res.categories.length > 0) {
            setCategories(res.categories);
            setFormData(prev => ({
              ...prev,
              business_id: selectedBusiness === 'ALL' ? 'DK' : selectedBusiness,
              category_id: prev.category_id || res.categories[0].id,
              payment_source: 'KASA',
            }));
          }
        })
        .catch(console.error);
    }
  }, [isOpen, selectedBusiness]);

  if (!isOpen) return null;

  const handleSubmit = async (changeReason = null) => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Lütfen geçerli bir gider tutarı giriniz.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const payload = { ...formData, amount: parseFloat(formData.amount) };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/expenses', payload);
      if (res.success) {
        triggerRefresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setError(err.message || 'Gider kaydedilemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
              <h3 className="font-semibold text-lg">+ Gider Kaydı Ekle</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">İşletme</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, business_id: 'DK' })}
                  className={`py-2 px-3 text-center rounded-lg font-medium text-xs border transition-all ${
                    formData.business_id === 'DK'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  DK
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, business_id: 'PALM' })}
                  className={`py-2 px-3 text-center rounded-lg font-medium text-xs border transition-all ${
                    formData.business_id === 'PALM'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Palm Beach
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, business_id: 'ORTAK' })}
                  className={`py-2 px-3 text-center rounded-lg font-medium text-xs border transition-all ${
                    formData.business_id === 'ORTAK'
                      ? 'bg-purple-50 border-purple-600 text-purple-700 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Ortak Gider
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tarih</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Ödeme Kaynağı</label>
                <select
                  value={formData.payment_source}
                  onChange={(e) => setFormData({ ...formData, payment_source: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="KASA">💵 Merkezi Nakit Kasa (Tek Kasa)</option>
                  <option value="DK_BANKA">🏦 DK Banka Hesabı</option>
                  <option value="PALM_BANKA">🏦 Palm Banka Hesabı</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Gider Kategorisi</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tutar (TL)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2.5 pl-3 pr-10 border border-slate-300 rounded-lg font-semibold text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-rose-500"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Açıklama</label>
              <input
                type="text"
                placeholder="Örn: Toptancı Meşrubat Faturası veya Kira"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={loading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Kaydediliyor...' : 'Gideri Kaydet'}</span>
              </button>
            </div>
          </div>
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
    </>
  );
}
