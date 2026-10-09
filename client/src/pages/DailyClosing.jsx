import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatDateTR } from '../utils/formatters';

export default function DailyClosing({ onOpenDayClose }) {
  const { user, canEditClosedDay } = useAuth();
  const { customEndDate, refreshKey, triggerRefresh } = useFilters();
  const [targetDate, setTargetDate] = useState(customEndDate || '2026-10-08');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reopen states
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    setShowReopenInput(false);
    api.get('/closing/status', { date: targetDate })
      .then(res => {
        if (res.success) setData(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [targetDate, refreshKey]);

  const handleReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim() || reopenReason.trim().length < 3) {
      setMsg({ text: 'Lütfen günün açılması için geçerli bir gerekçe giriniz.', type: 'error' });
      return;
    }

    setReopening(true);
    setMsg({ text: '', type: '' });

    try {
      const res = await api.post('/closing/reopen', {
        date: targetDate,
        change_reason: reopenReason.trim()
      });
      if (res.success) {
        setMsg({ text: res.message, type: 'success' });
        setShowReopenInput(false);
        setReopenReason('');
        triggerRefresh();
      }
    } catch (err) {
      setMsg({ text: err.message || 'Gün açılamadı.', type: 'error' });
    } finally {
      setReopening(false);
    }
  };

  const f = data?.summary?.finansOzeti;
  const g = data?.summary?.gunlukOzet;
  const isClosed = data?.isClosed;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Gün Kapanışı & Kilit Yönetimi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Günün finansal hareketlerini özetleyin, kasaları kilitleyin ve audit log ile güvenceye alın.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="text-xs bg-transparent border-0 font-bold text-slate-800 focus:outline-none"
            />
          </div>

          {!isClosed ? (
            <button
              onClick={() => onOpenDayClose(targetDate)}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 flex items-center space-x-1.5 transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>GÜNÜ KAPAT</span>
            </button>
          ) : (
            canEditClosedDay() && (
              <button
                onClick={() => setShowReopenInput(!showReopenInput)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <Unlock className="w-4 h-4 text-amber-400" />
                <span>Kapanışı Aç (Yönetici)</span>
              </button>
            )
          )}
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

      {/* Status Alert Banner */}
      {isClosed ? (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase">BU GÜN KAPATILMIŞTIR 🔒</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Kapanış: {data?.closingRecord?.closed_at} ({data?.closingRecord?.closed_by_name || 'Admin'})
              </p>
              {data?.closingRecord?.notes && (
                <p className="text-xs italic text-amber-700 mt-1">Not: "{data.closingRecord.notes}"</p>
              )}
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-200/80 rounded-full text-xs font-bold text-amber-900 self-start sm:self-center">
            DÜZENLEMELER KİLİTLİ
          </span>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase">BU GÜN AÇIK</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Finansal ve personel kayıtları serbestçe eklenebilir ve güncellenebilir.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-200/80 rounded-full text-xs font-bold text-emerald-900">
            AÇIK
          </span>
        </div>
      )}

      {/* Admin Reopen Form */}
      {showReopenInput && (
        <form onSubmit={handleReopen} className="bg-white p-5 rounded-2xl border-2 border-amber-400 shadow-lg space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2 text-amber-800">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h4 className="font-bold text-sm">Kapalı Günü Yeniden Açma Gerekçesi</h4>
          </div>
          <p className="text-xs text-slate-500">
            Günü açarak yeni kayıt ekleme veya mevcut kayıtları düzeltme olanağı tanınır. Bu işlem kimlik ve zaman damgasıyla denetim günlüğüne kaydedilecektir.
          </p>
          <div>
            <textarea
              rows={2}
              required
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Örn: Akşam servisinden kalan eksik fişlerin girilmesi için gün açıldı."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowReopenInput(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={reopening}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
            >
              <span>{reopening ? 'Açılıyor...' : 'Günü Düzenlemeye Aç'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Financial Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DK */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-xs font-extrabold text-blue-700 uppercase">DK Kapanış Değerleri</span>
          <div className="text-xs space-y-2 text-slate-600">
            <div className="flex justify-between border-b pb-1">
              <span>Nakit Kasa:</span>
              <span className="font-bold text-slate-900">{formatCurrency(f?.dk?.nakit)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Kart Satış:</span>
              <span className="font-bold text-slate-900">{formatCurrency(f?.dk?.kart)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gerçek Banka:</span>
              <span className="font-bold text-slate-900">{formatCurrency(f?.dk?.banka)}</span>
            </div>
          </div>
        </div>

        {/* PALM */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-xs font-extrabold text-emerald-700 uppercase">Palm Kapanış Değerleri</span>
          <div className="text-xs space-y-2 text-slate-600">
            <div className="flex justify-between border-b pb-1">
              <span>Nakit Kasa:</span>
              <span className="font-bold text-slate-900">{formatCurrency(f?.palm?.nakit)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Kart Satış:</span>
              <span className="font-bold text-slate-900">{formatCurrency(f?.palm?.kart)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gerçek Banka:</span>
              <span className="font-bold text-slate-900">{formatCurrency(f?.palm?.banka)}</span>
            </div>
          </div>
        </div>

        {/* ORTAK */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-lg space-y-3">
          <span className="text-xs font-extrabold text-emerald-400 uppercase">Ortak Konsolide Toplam</span>
          <div className="text-xs space-y-2 text-slate-300">
            <div className="flex justify-between border-b border-slate-700 pb-1">
              <span>Ortak Toplam Nakit:</span>
              <span className="font-bold text-white">{formatCurrency(f?.ortak?.toplamNakit)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-700 pb-1">
              <span>Ortak Toplam Kart:</span>
              <span className="font-bold text-white">{formatCurrency(f?.ortak?.toplamKart)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ortak Toplam Banka:</span>
              <span className="font-bold text-emerald-400">{formatCurrency(f?.ortak?.toplamBanka)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gün Sonu Akış Tablosu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
          {formatDateTR(targetDate)} Gün Sonu Akış Göstergeleri
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 block">Toplam Satış</span>
            <span className="font-bold text-slate-900 text-base">{formatCurrency(g?.toplamSatis)}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 block">Toplam Gider</span>
            <span className="font-bold text-rose-700 text-base">{formatCurrency(g?.gider)}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 block">Personel Hakediş</span>
            <span className="font-bold text-amber-700 text-base">{formatCurrency(g?.personelHakedis)}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 block">Personel Ödemesi</span>
            <span className="font-bold text-blue-700 text-base">{formatCurrency(g?.personelOdemesi)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
