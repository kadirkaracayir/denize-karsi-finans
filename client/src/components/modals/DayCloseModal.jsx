import React, { useState, useEffect } from 'react';
import { X, Lock, Unlock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useFilters } from '../../context/FilterContext';
import { formatCurrency, formatDateTR } from '../../utils/formatters';

export default function DayCloseModal({ isOpen, onClose, date = '2026-10-08', onSuccess }) {
  const { triggerRefresh } = useFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [notes, setNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError('');
      setReopenReason('');
      setNotes('');
      api.get('/closing/status', { date })
        .then(res => {
          if (res.success) {
            setData(res);
          }
        })
        .catch(err => {
          setError(err.message || 'Kapanış durumu alınamadı.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, date]);

  if (!isOpen) return null;

  const handleCloseDay = async () => {
    setClosing(true);
    setError('');
    try {
      const res = await api.post('/closing/close', { date, notes });
      if (res.success) {
        triggerRefresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Gün kapatılırken hata oluştu.');
    } finally {
      setClosing(false);
    }
  };

  const handleReopenDay = async () => {
    if (!reopenReason.trim() || reopenReason.trim().length < 3) {
      setError('Lütfen günü açmak için en az 3 karakterli geçerli bir gerekçe giriniz.');
      return;
    }

    setReopening(true);
    setError('');
    try {
      const res = await api.post('/closing/reopen', {
        date,
        change_reason: reopenReason.trim()
      });
      if (res.success) {
        triggerRefresh();
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Gün açılırken hata oluştu.');
    } finally {
      setReopening(false);
    }
  };

  const f = data?.summary?.finansOzeti;
  const g = data?.summary?.gunlukOzet;
  const isClosed = !!data?.isClosed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isClosed ? (
              <Lock className="w-5 h-5 text-amber-400" />
            ) : (
              <Unlock className="w-5 h-5 text-emerald-400" />
            )}
            <h3 className="font-semibold text-lg">
              {formatDateTR(date)} Tarihli Gün {isClosed ? 'Kapanış Detayı' : 'Kapanışı'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {isClosed ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-amber-900 text-sm">
              <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-950">Bu gün şu anda KAPATILMIŞTIR 🔒</span>
                <p className="text-amber-800 text-xs">
                  Kapanış Zamanı: {data?.closingRecord?.closed_at} ({data?.closingRecord?.closed_by_name || 'Admin'})
                </p>
                {data?.closingRecord?.notes && (
                  <p className="text-xs italic bg-white/70 p-2 rounded border border-amber-200">
                    Not: "{data.closingRecord.notes}"
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center space-x-2 text-emerald-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Gün kapatıldığında bu tarihe ait kayıtlar kilitlenir. Dilediğiniz zaman gerekçe belirterek günü tekrar açabilirsiniz.
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Finansal veriler özetleniyor...</div>
          ) : f && g ? (
            <div className="space-y-4">
              {/* Tek Nakit Kasa Banner */}
              <div className="bg-emerald-900 text-white rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-300 block">
                    TEK NAKİT KASA (DK + PALM BİRLEŞİK MERKEZİ KASA)
                  </span>
                  <span className="text-xs text-slate-300">
                    DK Katkı: {formatCurrency(f?.tekNakitKasa?.donemDkNakitKatki ?? f?.dk?.nakit)} | Palm Katkı: {formatCurrency(f?.tekNakitKasa?.donemPalmNakitKatki ?? f?.palm?.nakit)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-300 block uppercase font-bold">Kasa Bakiyesi</span>
                  <span className="text-xl font-black text-emerald-300">
                    {formatCurrency(f?.tekNakitKasa?.toplamBakiye ?? f?.ortak?.toplamNakit)}
                  </span>
                </div>
              </div>

              {/* Financial snapshot grid: DK Kart, Palm Kart, Ortak Konsolide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* DK KART & BANKA */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">DK Kredi Kartı & Banka</span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Ayrı Kasa</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Brüt Kart Satış:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(f?.dkKart?.brut ?? f?.dk?.kart)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>Komisyon (%{f?.dkKart?.komisyonOrani ?? 2.5}):</span>
                      <span className="font-semibold">-{formatCurrency(f?.dkKart?.komisyonTutari || 0)}</span>
                    </div>
                    {(f?.dkKart?.oranFarki !== 0) && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Oran Farkı:</span>
                        <span className="font-semibold">{formatCurrency(f?.dkKart?.oranFarki || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-blue-700">
                      <span>Net Bankaya Düşen:</span>
                      <span>{formatCurrency(f?.dkKart?.netBankayaDusen ?? 0)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span>DK Banka Bakiyesi:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(f?.banka?.dk?.current ?? f?.dk?.banka)}</span>
                    </div>
                  </div>
                </div>

                {/* PALM KART & BANKA */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Palm Kredi Kartı & Banka</span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Ayrı Kasa</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Brüt Kart Satış:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(f?.palmKart?.brut ?? f?.palm?.kart)}</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>Komisyon (%{f?.palmKart?.komisyonOrani ?? 2.5}):</span>
                      <span className="font-semibold">-{formatCurrency(f?.palmKart?.komisyonTutari || 0)}</span>
                    </div>
                    {(f?.palmKart?.oranFarki !== 0) && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Oran Farkı:</span>
                        <span className="font-semibold">{formatCurrency(f?.palmKart?.oranFarki || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-emerald-700">
                      <span>Net Bankaya Düşen:</span>
                      <span>{formatCurrency(f?.palmKart?.netBankayaDusen ?? 0)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span>Palm Banka Bakiyesi:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(f?.banka?.palm?.current ?? f?.palm?.banka)}</span>
                    </div>
                  </div>
                </div>

                {/* ORTAK KONSOLİDE */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Ortak Konsolide</span>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">DK + Palm</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Toplam Satış:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(f?.ortak?.toplamSatis ?? g?.toplamSatis)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Toplam Net Kart:</span>
                      <span className="font-semibold text-purple-700">{formatCurrency(f?.ortakKart?.netBankayaDusen ?? f?.ortak?.toplamKart)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Toplam Banka:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(f?.banka?.ortak?.current ?? f?.ortak?.toplamBanka)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-emerald-700">
                      <span>Merkezi Nakit Kasa:</span>
                      <span>{formatCurrency(f?.tekNakitKasa?.toplamBakiye ?? f?.ortak?.toplamNakit)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Günlük Finansal Özet Tablosu */}
              <div className="border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wide block">Günün Finansal Akış Özeti</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block">Toplam Satış</span>
                    <span className="font-bold text-slate-900 text-sm">{formatCurrency(g.toplamSatis)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block">Toplam Gider</span>
                    <span className="font-bold text-rose-700 text-sm">{formatCurrency(g.gider)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block">Personel Hakediş</span>
                    <span className="font-bold text-amber-700 text-sm">{formatCurrency(g.personelHakedis)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-500 block">Personel Ödemesi</span>
                    <span className="font-bold text-blue-700 text-sm">{formatCurrency(g.personelOdemesi)}</span>
                  </div>
                </div>
              </div>

              {/* Günü Açma Formu (Eğer Gün Kapalıysa) */}
              {isClosed ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center space-x-2 text-amber-950 font-bold text-xs">
                    <Unlock className="w-4 h-4 text-amber-600" />
                    <span>Günü Tekrar Açma (Kilit Kaldırma)</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Kapalı günü açmak tüm işlemlerin tekrar düzenlenebilmesini sağlar. Audit log için açılış sebebi zorunludur.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                      Açılış Değişiklik Gerekçesi *
                    </label>
                    <input
                      type="text"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      placeholder="Örn: Akşam eksik fiş girişi / mutabakat düzeltmesi"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              ) : (
                /* Kapanış Notu (Eğer Gün Açıksa) */
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Kapanış Notu (Opsiyonel)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Örn: Gün sorunsuz kapatıldı, kasa sayımı mutabık."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          >
            Vazgeç
          </button>
          {isClosed ? (
            <button
              type="button"
              onClick={handleReopenDay}
              disabled={reopening || !reopenReason.trim()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-xs flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>{reopening ? 'Açılıyor...' : 'GÜNÜ TEKRAR AÇ 🔓'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCloseDay}
              disabled={closing}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-xs flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{closing ? 'Kapatılıyor...' : 'GÜNÜ KAPAT 🔒'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
