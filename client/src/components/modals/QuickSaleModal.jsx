import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useFilters } from '../../context/FilterContext';
import ReasonModal from './ReasonModal';

export default function QuickSaleModal({ isOpen, onClose, onSuccess }) {
  const { selectedBusiness, triggerRefresh } = useFilters();
  const [formData, setFormData] = useState({
    business_id: selectedBusiness === 'ALL' ? 'DK' : selectedBusiness,
    date: '2026-10-08',
    payment_type: 'NAKIT',
    amount: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        business_id: selectedBusiness === 'ALL' ? 'DK' : selectedBusiness,
      }));
    }
  }, [isOpen, selectedBusiness]);

  if (!isOpen) return null;

  const handleSubmit = async (changeReason = null) => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Lütfen geçerli bir satış tutarı giriniz.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const payload = { ...formData, amount: parseFloat(formData.amount) };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/sales', payload);
      if (res.success) {
        triggerRefresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setError(err.message || 'Satış kaydedilemedi.');
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
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-lg">+ Satış Kaydı Ekle</h3>
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, business_id: 'DK' })}
                  className={`py-2 px-4 rounded-lg font-medium text-sm border transition-all ${
                    formData.business_id === 'DK'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  DK (Denize Karşı)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, business_id: 'PALM' })}
                  className={`py-2 px-4 rounded-lg font-medium text-sm border transition-all ${
                    formData.business_id === 'PALM'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Palm Beach
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
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Ödeme Tipi</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_type: 'NAKIT' })}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                      formData.payment_type === 'NAKIT' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    💵 Nakit
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_type: 'KART' })}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                      formData.payment_type === 'KART' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    💳 Kart
                  </button>
                </div>
              </div>
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
                  className="w-full px-3 py-2.5 pl-3 pr-10 border border-slate-300 rounded-lg font-semibold text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Açıklama (Opsiyonel)</label>
              <input
                type="text"
                placeholder="Örn: Günlük Salon Satışı veya Z Raporu"
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Kaydediliyor...' : 'Satışı Kaydet'}</span>
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
