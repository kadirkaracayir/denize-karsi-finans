import React from 'react';
import { 
  CalendarCheck, 
  Zap, 
  Clock, 
  Receipt, 
  Coins, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { formatDateTR } from '../utils/formatters';

export default function DailyOperations({ 
  onNavigate, 
  onOpenQuickSale, 
  onOpenQuickExpense, 
  onOpenCashTx, 
  onOpenDayClose 
}) {
  const { customEndDate } = useFilters();
  const today = customEndDate || '2026-10-08';

  const steps = [
    {
      step: 1,
      title: 'Bugünkü Satışları Gir',
      desc: 'DK ve Palm Beach günlük nakit/kart satış hasılatını hızlı panel ile tek tıkla kaydedin ve periyodik takip edin.',
      icon: Zap,
      color: 'bg-emerald-500 text-white',
      actions: [
        { label: 'Hızlı Satış & Gelir Girişi', onClick: () => onNavigate('sales'), primary: true },
      ]
    },
    {
      step: 2,
      title: 'Personel Puantajını Gir',
      desc: 'Aylık Excel formatındaki puantaj çizelgesinde personellerin çalışma durumlarını (Ç, ½, İ, R, X) işaretleyin, hakedişler anında hesaplansın.',
      icon: Clock,
      color: 'bg-blue-500 text-white',
      actions: [
        { label: 'Personel & Puantaj Merkezi', onClick: () => onNavigate('attendance'), primary: true },
      ]
    },
    {
      step: 3,
      title: 'Günün Giderlerini Kaydet',
      desc: 'Tedarikçi ödemesi, faturalar, sarf malzeme veya temizlik gibi gün içi kasadan/bankadan çıkan giderleri girin.',
      icon: Receipt,
      color: 'bg-rose-500 text-white',
      actions: [
        { label: '+ Yeni Gider Gir', onClick: onOpenQuickExpense, primary: true },
        { label: 'Gider Listesi', onClick: () => onNavigate('expenses') },
      ]
    },
    {
      step: 4,
      title: 'Personel Ödemesi Yap (Varsa)',
      desc: 'Personellere elden nakit veya bankadan yapılan hakediş ödemelerini kaydedin ve kalan borcu anında güncelleyin.',
      icon: Coins,
      color: 'bg-amber-500 text-white',
      actions: [
        { label: 'Personel & Ödeme Takibi', onClick: () => onNavigate('attendance'), primary: true },
      ]
    },
    {
      step: 5,
      title: 'Günü Kapat & Kasaları Kilitle',
      desc: 'Gün sonunda DK ve Palm nakit/kart/banka toplamlarını gözden geçirip günü kapatın, yetkisiz değişikliklere karşı kilitleyin.',
      icon: Lock,
      color: 'bg-slate-900 text-white',
      actions: [
        { label: 'Günü Kapat 🔒', onClick: () => onOpenDayClose(today), primary: true },
        { label: 'Kapanış Detayı', onClick: () => onNavigate('closing') },
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Günlük Rutin İşlemler ({formatDateTR(today)})</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            İşletmenin günlük finansal yönetimini 5 basit adımda eksiksiz tamamlayın.
          </p>
        </div>
      </div>

      {/* 5 Steps Grid */}
      <div className="space-y-4">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div 
              key={s.step} 
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start space-x-4">
                <div className={`w-11 h-11 rounded-2xl ${s.color} flex items-center justify-center flex-shrink-0 shadow-sm font-bold text-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Adım {s.step}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{s.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-center">
                {s.actions.map((act, i) => (
                  <button
                    key={i}
                    onClick={act.onClick}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      act.primary
                        ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
