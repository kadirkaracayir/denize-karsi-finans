import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Database, 
  RotateCcw, 
  Trash2, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Server,
  Layers,
  RefreshCw,
  CreditCard,
  Percent,
  Save,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';

export default function Settings() {
  const { user } = useAuth();
  const { triggerRefresh } = useFilters();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Credit Card Commission Rates state
  const [rates, setRates] = useState({
    generalRate: '2.5',
    dkRate: '2.5',
    palmRate: '2.5'
  });
  const [savingRates, setSavingRates] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '', // 'RESET' or 'SEED'
    title: '',
    description: '',
  });

  useEffect(() => {
    loadInfo();
    loadRates();
  }, []);

  const loadRates = () => {
    api.get('/settings/rates')
      .then(res => {
        if (res.success) {
          setRates({
            generalRate: String(res.generalRate ?? 2.5),
            dkRate: String(res.dkRate ?? 2.5),
            palmRate: String(res.palmRate ?? 2.5)
          });
        }
      })
      .catch(console.error);
  };

  const handleSaveRates = async (e) => {
    e.preventDefault();
    setSavingRates(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.put('/settings/rates', {
        generalRate: parseFloat(rates.generalRate) || 0,
        dkRate: parseFloat(rates.dkRate) || 0,
        palmRate: parseFloat(rates.palmRate) || 0
      });
      if (res.success) {
        setMsg({ text: res.message || 'Kredi kartı komisyon oranları başarıyla güncellendi.', type: 'success' });
        triggerRefresh();
      }
    } catch (err) {
      setMsg({ text: err.message || 'Komisyon oranları kaydedilemedi.', type: 'error' });
    } finally {
      setSavingRates(false);
    }
  };

  const loadInfo = () => {
    setLoading(true);
    api.get('/settings/info')
      .then(res => {
        if (res.success) setInfo(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleActionConfirm = async () => {
    setActionLoading(true);
    setMsg({ text: '', type: '' });
    const actionType = confirmModal.type;
    setConfirmModal({ isOpen: false, type: '', title: '', description: '' });

    try {
      if (actionType === 'RESET') {
        const res = await api.post('/settings/demo/reset', { reason: 'Kullanıcı sıfırlama talebi' });
        setMsg({ text: res.message, type: 'success' });
      } else if (actionType === 'SEED') {
        const res = await api.post('/settings/demo/seed', { reason: 'Kullanıcı demo veri yeniden yükleme talebi' });
        setMsg({ text: res.message, type: 'success' });
      }
      loadInfo();
      triggerRefresh();
    } catch (err) {
      setMsg({ text: err.message || 'İşlem başarısız oldu.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    const token = localStorage.getItem('dk_auth_token');
    window.open(`/api/settings/backup/download?token=${token}`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Sistem Ayarları & Demo Yönetimi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Veritabanı yönetimi, yedekleme (backup) ve demo veri kümesini temizleme/yenileme işlemleri.
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

      {/* 0. SECTION: KREDİ KARTI VE POS KOMİSYON ORANLARI */}
      <div className="bg-white rounded-2xl p-6 border-2 border-blue-500/20 shadow-md space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">Kredi Kartı & POS Komisyon Oranı Ayarları</h3>
              <p className="text-xs text-slate-500">
                Kartlı satış hasılatından banka kesintisi yapılacak varsayılan komisyon yüzdesini belirleyin.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
            Otomatik Net Ciro Hesabı
          </span>
        </div>

        <form onSubmit={handleSaveRates} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Genel Komisyon Oranı */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Genel Komisyon Oranı</span>
                <span className="text-[10px] text-blue-600 font-semibold">% Oran</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rates.generalRate}
                  onChange={(e) => setRates({ ...rates, generalRate: e.target.value })}
                  placeholder="2.50"
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Tüm işletmeler için baz oran</span>
            </div>

            {/* DK POS Komisyon Oranı */}
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
              <label className="block text-[11px] font-bold text-blue-900 mb-1 flex items-center justify-between">
                <span>DK (Denize Karşı) POS</span>
                <span className="text-[10px] text-blue-700 font-semibold">% Oran</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rates.dkRate}
                  onChange={(e) => setRates({ ...rates, dkRate: e.target.value })}
                  placeholder="2.50"
                  className="w-full px-3 py-2 bg-white rounded-lg border border-blue-300 text-sm font-black text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-blue-400">%</span>
              </div>
              <span className="text-[10px] text-blue-600/70 mt-1 block">DK kartlı satış komisyonu</span>
            </div>

            {/* Palm POS Komisyon Oranı */}
            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200">
              <label className="block text-[11px] font-bold text-emerald-900 mb-1 flex items-center justify-between">
                <span>Palm Beach POS</span>
                <span className="text-[10px] text-emerald-700 font-semibold">% Oran</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={rates.palmRate}
                  onChange={(e) => setRates({ ...rates, palmRate: e.target.value })}
                  placeholder="2.50"
                  className="w-full px-3 py-2 bg-white rounded-lg border border-emerald-300 text-sm font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-emerald-400">%</span>
              </div>
              <span className="text-[10px] text-emerald-600/70 mt-1 block">Palm kartlı satış komisyonu</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-slate-500">
              * Bu oranlar güncellendiğinde tüm finans özetleri ve banka net kart girişleri yeni orana göre anında hesaplanır.
            </p>
            <button
              type="submit"
              disabled={savingRates}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingRates ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Komisyon Oranlarını Güncelle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 1. SECTION: DEMO VERİ YÖNETİMİ (Section 32) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900">Demo Veri Kümesi Kontrolleri</h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Uygulama ilk açıldığında gerçekçi 15 günlük DK ve Palm satış, gider, puantaj ve banka kayıtlarıyla birlikte gelir. Sistemi sıfırdan test etmek için demo verilerini temizleyebilir veya dilediğiniz zaman 15 günlük tam örnek veri setini yeniden yükleyebilirsiniz.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setConfirmModal({
              isOpen: true,
              type: 'RESET',
              title: 'Demo Verilerini Temizle',
              description: 'Tüm satış, gider, puantaj ve banka verileri silinecektir. Sistem temiz başlangıç durumuna dönecektir. Devam etmek istiyor musunuz?'
            })}
            className="w-full sm:w-auto px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>Demo Verilerini Temizle</span>
          </button>

          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setConfirmModal({
              isOpen: true,
              type: 'SEED',
              title: '15 Günlük Demo Verilerini Yeniden Oluştur',
              description: 'DK ve Palm için son 15 güne ait satışlar, giderler, puantaj ve banka hareketleri baştan oluşturulacaktır. Devam etmek istiyor musunuz?'
            })}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>15 Günlük Demo Verilerini Yeniden Oluştur</span>
          </button>
        </div>
      </div>

      {/* 2. SECTION: YEDEKLEME / BACKUP (Section 33) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Download className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-sm text-slate-900">Veritabanı Yedeği (SQLite Backup)</h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Tüm işletme verileri, satışlar, hakedişler ve audit logları tek bir ilişkisel SQLite veritabanı dosyasında (WAL modunda) saklanır. İstediğiniz an tek tıkla veritabanı dosyasının (.db) anlık yedeğini bilgisayarınıza indirebilirsiniz.
        </p>

        <div>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Veritabanı Yedek Dosyasını İndir (.db)</span>
          </button>
        </div>
      </div>

      {/* 3. SECTION: SİSTEM METRİKLERİ & TABLO SAYILARI */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-900">Sistem Bilgisi & Veritabanı Metrikleri</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block">Kayıtlı Satışlar</span>
            <span className="text-lg font-bold text-slate-900">{info?.tableCounts?.sales || 0}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block">Kayıtlı Giderler</span>
            <span className="text-lg font-bold text-slate-900">{info?.tableCounts?.expenses || 0}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block">Personel Puantajları</span>
            <span className="text-lg font-bold text-slate-900">{info?.tableCounts?.attendance || 0}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block">Audit Log Kayıtları</span>
            <span className="text-lg font-bold text-purple-700">{info?.tableCounts?.auditLogs || 0}</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.description}
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, type: '', title: '', description: '' })}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleActionConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
              >
                Evet, Onaylıyorum
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
