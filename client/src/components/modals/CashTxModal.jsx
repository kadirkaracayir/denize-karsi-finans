import React, { useState } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Check, Wallet, Building2, Info } from 'lucide-react';
import { api } from '../../services/api';
import { useFilters } from '../../context/FilterContext';
import ReasonModal from './ReasonModal';

export default function CashTxModal({ isOpen, onClose, defaultType = 'IN', onSuccess }) {
  const { triggerRefresh } = useFilters();
  const [txType, setTxType] = useState(defaultType); // 'IN', 'OUT', 'TRANSFER'
  
  // Selected Account for IN/OUT: 'KASA' | 'DK_BANKA' | 'PALM_BANKA'
  const [selectedAccount, setSelectedAccount] = useState('KASA');

  // Accounts for TRANSFER:
  const [transferFrom, setTransferFrom] = useState('DK_BANKA');
  const [transferTo, setTransferTo] = useState('KASA');

  const [date, setDate] = useState('2026-10-08');
  const [subType, setSubType] = useState('Sermaye');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  if (!isOpen) return null;

  const inSubTypes = ['Sermaye', 'Tahsilat', 'Borç Alınan Para', 'Diğer Gelir', 'Diğer'];
  const outSubTypes = [
    'İşletme Ortağı Cengiz',
    'İşletme Ortağı Sinan',
    'İşletme Sahibi Çekimi',
    'Avans',
    'Kişisel Çekim',
    'Diğer'
  ];

  const handleTypeChange = (type) => {
    setTxType(type);
    setError('');
    if (type === 'IN') {
      setSubType('Sermaye');
      setSelectedAccount('KASA');
    } else if (type === 'OUT') {
      setSubType('İşletme Ortağı Cengiz');
      setSelectedAccount('KASA');
    } else if (type === 'TRANSFER') {
      setTransferFrom('DK_BANKA');
      setTransferTo('KASA');
    }
  };

  const handleSubmit = async (changeReason = null) => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Lütfen geçerli bir tutar giriniz.');
      return;
    }

    if (txType === 'TRANSFER' && transferFrom === transferTo) {
      setError('Çıkan hesap ile giren hesap aynı olamaz.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let payload = {
        type: txType,
        date,
        amount: numAmount,
        description,
      };

      if (txType === 'IN' || txType === 'OUT') {
        payload.sub_type = subType;
        if (selectedAccount === 'KASA') {
          // Nakit Kasa Giriş/Çıkışlarında Kasa tektir (DK ve Palm ayrı tutulmaz)
          payload.business_id = 'ORTAK';
          payload.source_account = 'KASA';
          payload.target_account = null;
        } else if (selectedAccount === 'DK_BANKA') {
          payload.business_id = 'DK';
          payload.source_account = 'BANKA';
          payload.target_account = null;
        } else if (selectedAccount === 'PALM_BANKA') {
          payload.business_id = 'PALM';
          payload.source_account = 'BANKA';
          payload.target_account = null;
        }
      } else if (txType === 'TRANSFER') {
        // Transfer mapping
        let transferSubType = 'Transfer';
        let bId = 'ORTAK';
        let srcAcc = 'KASA';
        let tgtAcc = 'KASA';

        if (transferFrom === 'KASA') {
          srcAcc = 'KASA';
          tgtAcc = 'BANKA';
          transferSubType = 'Kasa to Banka Yatırma';
          bId = transferTo === 'DK_BANKA' ? 'DK' : 'PALM';
        } else if (transferTo === 'KASA') {
          srcAcc = 'BANKA';
          tgtAcc = 'KASA';
          transferSubType = 'Banka to Kasa Nakit Çekme';
          bId = transferFrom === 'DK_BANKA' ? 'DK' : 'PALM';
        } else {
          // Bank to Bank Virman
          srcAcc = 'BANKA';
          tgtAcc = 'BANKA';
          transferSubType = 'Banka Virman';
          bId = 'ORTAK';
        }

        payload.sub_type = transferSubType;
        payload.business_id = bId;
        payload.source_account = srcAcc;
        payload.target_account = tgtAcc;
      }

      if (changeReason) payload.change_reason = changeReason;

      const res = await api.post('/cash/transactions', payload);
      if (res.success) {
        triggerRefresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      if (err.data && err.data.requiresReason) {
        setShowReasonModal(true);
      } else {
        setError(err.message || 'Para hareketi kaydedilemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-lg">Para Hareketi / Transfer</h3>
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

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange('IN')}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  txType === 'IN' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Para Girişi</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('OUT')}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  txType === 'OUT' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>- Para Çıkışı</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('TRANSFER')}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  txType === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>↕️ Transfer</span>
              </button>
            </div>

            {/* Account selection for IN and OUT */}
            {(txType === 'IN' || txType === 'OUT') && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase text-slate-500">
                  {txType === 'IN' ? 'Giriş Yapılan Kasa / Hesap' : 'Çıkış Yapılan Kasa / Hesap'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAccount('KASA')}
                    className={`py-2 px-2 text-center rounded-xl font-bold text-xs border transition-all ${
                      selectedAccount === 'KASA'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    💵 Nakit Kasa
                    <span className="block text-[10px] font-normal text-slate-500">(Tek Kasa)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAccount('DK_BANKA')}
                    className={`py-2 px-2 text-center rounded-xl font-bold text-xs border transition-all ${
                      selectedAccount === 'DK_BANKA'
                        ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🏦 DK Banka
                    <span className="block text-[10px] font-normal text-slate-500">(Ayrı Hesap)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAccount('PALM_BANKA')}
                    className={`py-2 px-2 text-center rounded-xl font-bold text-xs border transition-all ${
                      selectedAccount === 'PALM_BANKA'
                        ? 'bg-purple-50 border-purple-600 text-purple-800 shadow-xs ring-1 ring-purple-500'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🏦 Palm Banka
                    <span className="block text-[10px] font-normal text-slate-500">(Ayrı Hesap)</span>
                  </button>
                </div>

                {selectedAccount === 'KASA' && (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start space-x-2 text-emerald-800 text-[11px]">
                    <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Tek Nakit Kasa:</strong> Palm ve DK nakit kasa girişleri ayrılmadan tek bir merkezi kasada toplanır.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Transfer account selectors */}
            {txType === 'TRANSFER' && (
              <div className="grid grid-cols-2 gap-3 bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl">
                <div>
                  <label className="block text-xs font-bold uppercase text-indigo-800 mb-1">Çıkan Hesap</label>
                  <select
                    value={transferFrom}
                    onChange={(e) => setTransferFrom(e.target.value)}
                    className="w-full px-2.5 py-2 border border-indigo-200 rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="DK_BANKA">🏦 DK Bankası</option>
                    <option value="PALM_BANKA">🏦 Palm Bankası</option>
                    <option value="KASA">💵 Merkezi Nakit Kasa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-indigo-800 mb-1">Giren Hesap</label>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full px-2.5 py-2 border border-indigo-200 rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="KASA">💵 Merkezi Nakit Kasa</option>
                    <option value="DK_BANKA">🏦 DK Bankası</option>
                    <option value="PALM_BANKA">🏦 Palm Bankası</option>
                  </select>
                </div>
              </div>
            )}

            {/* Date and Sub Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tarih</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {(txType === 'IN' || txType === 'OUT') && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Hareket Nedeni</label>
                  <select
                    value={subType}
                    onChange={(e) => setSubType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    {txType === 'IN' && inSubTypes.map(st => <option key={st} value={st}>{st}</option>)}
                    {txType === 'OUT' && outSubTypes.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              )}

              {txType === 'TRANSFER' && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Transfer Tipi</label>
                  <div className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-indigo-700 font-bold bg-indigo-50/50">
                    {transferFrom === 'KASA' ? 'Kasa to Banka Yatırma' : transferTo === 'KASA' ? 'Banka to Kasa Nakit Çekme' : 'Banka Virman'}
                  </div>
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tutar (TL)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 pl-3 pr-10 border border-slate-300 rounded-lg font-bold text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 font-bold text-slate-400">TL</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Açıklama</label>
              <input
                type="text"
                placeholder={txType === 'IN' ? 'Örn: Nakit sermaye girişi' : txType === 'OUT' ? 'Örn: Şirket ortağı nakit çekimi' : 'Örn: Gün sonu bankaya yatırılan nakit'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Actions */}
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
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Kaydediliyor...' : 'Hareketi Kaydet'}</span>
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
