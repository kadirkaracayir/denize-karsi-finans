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

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = () => {
    setLoading(true);
    api.get('/settings/info')
      .then(res => {
        if (res.success) setInfo(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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
            <h2 className="text-lg font-bold text-slate-900">Sistem Ayarları</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Veritabanı yönetimi ve güvenli yedekleme (backup) işlemleri.
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

    </div>
  );
}
