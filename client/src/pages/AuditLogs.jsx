import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, AlertCircle, RefreshCw, Clock, User } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTimeTR } from '../utils/formatters';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/audit', { search, action: actionFilter, limit: 200 })
      .then(res => {
        if (res.success) setLogs(res.logs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, actionFilter]);

  const getActionBadge = (act) => {
    if (act.includes('LOGIN')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">GİRİŞ</span>;
    if (act.includes('LOGOUT')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">ÇIKIŞ</span>;
    if (act.includes('CANCEL')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">İPTAL / SİLME</span>;
    if (act.includes('CLOSE')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">GÜN KAPANIŞI</span>;
    if (act.includes('REOPEN')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">KAPANIŞI AÇMA</span>;
    if (act.includes('CREATE') || act.includes('INPUT') || act.includes('IMPORT')) return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">YENİ KAYIT</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">{act}</span>;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">İşlem Geçmişi & Denetim Günlüğü (Audit Log)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kimin, ne zaman, hangi değişikliği ve hangi gerekçeyle yaptığının ayrıntılı kayıtları.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Kullanıcı, eylem veya değişiklik gerekçesi ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-700"
        >
          <option value="">Tüm Eylemler</option>
          <option value="LOGIN">Kullanıcı Girişleri</option>
          <option value="SALE_CREATE">Satış Ekleme</option>
          <option value="SALE_MATRIX_INPUT">Hızlı Satış Matrisi</option>
          <option value="EXCEL_IMPORT">Excel Aktarımı</option>
          <option value="EXPENSE_CREATE">Gider Ekleme</option>
          <option value="DAY_CLOSE">Gün Kapanışı</option>
          <option value="DAY_REOPEN">Kapanışı Açma</option>
          <option value="SALE_CANCEL">Satış İptali</option>
          <option value="EXPENSE_CANCEL">Gider İptali</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Tarih / Saat</th>
                <th className="py-3 px-4">Kullanıcı</th>
                <th className="py-3 px-4">Eylem</th>
                <th className="py-3 px-4">Varlık</th>
                <th className="py-3 px-4">Değişiklik Gerekçesi</th>
                <th className="py-3 px-4">Yeni / Güncel Değerler</th>
                <th className="py-3 px-4">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Denetim kaydı bulunamadı.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                      {formatDateTimeTR(log.created_at)}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{log.user_name || 'Sistem'}</td>
                    <td className="py-2.5 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-700">
                      {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>
                    <td className="py-2.5 px-4">
                      {log.change_reason ? (
                        <span className="inline-block px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded font-medium text-[11px]">
                          {log.change_reason}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-[280px] truncate font-mono text-[11px]">
                      {log.new_values || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[10px]">{log.ip_address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
