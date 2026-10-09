import React from 'react';
import { LayoutDashboard, BadgePercent, Clock, Wallet, Menu } from 'lucide-react';

export default function MobileNav({ activeTab, onSelectTab, onOpenMobileMenu }) {
  const items = [
    { id: 'dashboard', label: 'Özet', icon: LayoutDashboard },
    { id: 'sales', label: 'Satış', icon: BadgePercent },
    { id: 'attendance', label: 'Puantaj', icon: Clock },
    { id: 'cash', label: 'Kasa', icon: Wallet },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 px-3 py-1 flex items-center justify-around shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center py-1.5 px-3 rounded-lg text-[11px] font-medium transition-colors ${
              isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="mt-0.5">{item.label}</span>
          </button>
        );
      })}

      <button
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center py-1.5 px-3 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-900"
      >
        <Menu className="w-5 h-5 text-slate-400" />
        <span className="mt-0.5">Menü</span>
      </button>
    </nav>
  );
}
