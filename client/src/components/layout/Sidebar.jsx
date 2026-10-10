import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  BadgePercent,
  Zap,
  FileSpreadsheet,
  Wallet,
  CreditCard,
  Landmark,
  Users,
  Clock,
  Receipt,
  ArrowLeftRight,
  Lock,
  BarChart3,
  ShieldCheck,
  Settings,
  X,
  Coins
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ activeTab, onSelectTab, isMobileOpen, onCloseMobile }) {
  const { user } = useAuth();

  const menuItems = [
    { id: 'fast-sales', label: 'Hızlı Satış & Gelir', icon: BadgePercent, badge: 'Nakit/KK' },
    { id: 'sales', label: 'Satış Listesi', icon: FileSpreadsheet },
    { id: 'cash', label: 'Nakit Kasa', icon: Wallet },
    { id: 'attendance', label: 'Personel & Puantaj', icon: Clock, badge: 'Excel Format' },
    { id: 'employees', label: 'Personel Listesi', icon: Users },
    { id: 'expenses', label: 'Giderler', icon: Receipt },
    { id: 'reports', label: 'Raporlar', icon: BarChart3 },
    { id: 'settings', label: 'Ayarlar', icon: Settings, adminOnly: true },
  ];

  const filteredItems = menuItems.filter(item => {
    if (item.adminOnly && !['super_admin', 'business_admin'].includes(user?.roleId)) {
      return false;
    }
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-emerald-900/30">
            DK
          </div>
          <div>
            <h1 className="font-bold text-white text-sm tracking-tight leading-none">DENİZE KARŞI</h1>
            <span className="text-[11px] font-semibold text-emerald-400">& Palm Beach Finans</span>
          </div>
        </div>
        {isMobileOpen && (
          <button onClick={onCloseMobile} className="lg:hidden p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
          <span>v1.0.0 Prod</span>
          <span className="text-emerald-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Canlı
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0 z-20 shadow-xl">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
