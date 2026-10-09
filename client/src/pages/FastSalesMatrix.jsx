import React, { useState } from 'react';
import { Zap, Check, ArrowRight, RefreshCw, AlertCircle, Building2, Calendar, Wallet, CreditCard } from 'lucide-react';
import { api } from '../services/api';
import { useFilters } from '../context/FilterContext';
import { formatCurrency } from '../utils/formatters';
import ReasonModal from '../components/modals/ReasonModal';

export default function FastSalesMatrix({ onNavigate }) {
  const { customEndDate, triggerRefresh } = useFilters();
  const [targetDate, setTargetDate] = useState(customEndDate || '2026-10-08');

  // DK Form State
  const [dkNakit, setDkNakit] = useState('');
  const [dkKart, setDkKart] = useState('');
  const [dkDesc, setDkDesc] = useState('DK Günlük Satış Hasılatı');

  // Palm Form State
  const [palmNakit, setPalmNakit] = useState('');
  const [palmKart, setPalmKart] = useState('');
  const [palmDesc, setPalmDesc] = useState('Palm Günlük Satış Hasılatı');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  // Computed Live Totals
  const dkNakitNum = parseFloat(dkNakit) || 0;
  const dkKartNum = parseFloat(dkKart) || 0;
  const dkTotal = dkNakitNum + dkKartNum;

  const palmNakitNum = parseFloat(palmNakit) || 0;
  const palmKartNum = parseFloat(palmKart) || 0;
  const palmTotal = palmNakitNum + palmKartNum;

  const totalNakit = dkNakitNum + palmNakitNum;
  const totalKart = dkKartNum + palmKartNum;
  const grandTotal = dkTotal + palmTotal;

  const handleSubmit = async (changeReason = null) => {
    if (grandTotal <= 0) {
      setErrorMsg('Lütfen en az bir işletme için geçerli bir satış tutarı (nakit veya kart) giriniz.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        date: targetDate,
        dk: (dkNakitNum > 0 || dkKartNum > 0) ? {
          nakit: dkNakitNum,
          kart: dkKartNum,
          description: dkDesc
        } : null,
        palm: (palmNakitNum > 0 || palmKartNum > 0) ? {
          nakit: palmNakitNum,
          kart: palmKartNum,
          description: palmDesc
        } : null,
        description: 'Hızlı Günlük Satış Girişi'
      };
      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/sales/matrix', payload);
      if (res.success) {
        setSuccessMsg(res.message);
        triggerRefresh();
        // Clear inputs
        setDkNakit('');
        setDkKart('');
        setPalmNakit('');
        setPalmKart('');
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setErrorMsg(err.message || 'Satışlar kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Hızlı Günlük Satış Girişi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Günün DK ve Palm nakit ve kredi kartı hasılatlarını tek ekranda hızlıca girip kaydedin.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('sales')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 flex items-center space-x-1"
            >
              <span>Satış Listesi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 font-medium">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center space-x-2 font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Two Operation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* DK SATIŞ GİRİŞİ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h3 className="font-extrabold text-sm text-blue-900 uppercase">DK (Denize Karşı) Satışları</h3>
            </div>
            <span className="text-xs font-black text-blue-700">{formatCurrency(dkTotal)}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nakit Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={dkNakit}
                  onChange={(e) => { setDkNakit(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Kredi Kartı (POS) Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={dkKart}
                  onChange={(e) => { setDkKart(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Açıklama (Opsiyonel)</label>
              <input
                type="text"
                value={dkDesc}
                onChange={(e) => setDkDesc(e.target.value)}
                placeholder="Örn: Günlük Bar ve Salon Satışı"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* PALM SATIŞ GİRİŞİ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="font-extrabold text-sm text-emerald-900 uppercase">Palm Beach Satışları</h3>
            </div>
            <span className="text-xs font-black text-emerald-700">{formatCurrency(palmTotal)}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nakit Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={palmNakit}
                  onChange={(e) => { setPalmNakit(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                <span>Kredi Kartı (POS) Satış Hasılatı (TL)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={palmKart}
                  onChange={(e) => { setPalmKart(e.target.value); setSuccessMsg(''); setErrorMsg(''); }}
                  className="w-full px-3.5 py-2.5 pl-3.5 pr-10 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/50"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">TL</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Açıklama (Opsiyonel)</label>
              <input
                type="text"
                value={palmDesc}
                onChange={(e) => setPalmDesc(e.target.value)}
                placeholder="Örn: Günlük Palm Beach Hasılatı"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live Consolidated Summary & Save Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Ortak Nakit Satış</span>
            <span className="text-lg font-black text-emerald-400">{formatCurrency(totalNakit)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">Ortak Kart Satış</span>
            <span className="text-lg font-black text-blue-400">{formatCurrency(totalKart)}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold block">GÜNLÜK TOPLAM</span>
            <span className="text-xl font-black text-white">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={saving || grandTotal <= 0}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{saving ? 'Kaydediliyor...' : 'GÜNLÜK SATIŞLARI KAYDET'}</span>
        </button>
      </div>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        onConfirm={(reason) => {
          setShowReasonModal(false);
          handleSubmit(reason);
        }}
      />
    </div>
  );
}
