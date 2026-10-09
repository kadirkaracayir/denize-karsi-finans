import React from 'react';
import { 
  Menu, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ onOpenMobileMenu }) {
  const { user, logout } = useAuth();

  const getRoleBadge = (roleId) => {
    switch (roleId) {
      case 'super_admin': return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Süper Admin</span>;
      case 'business_admin': return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">İşletme Admini</span>;
      case 'finance': return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Finans Yetkilisi</span>;
      case 'hr': return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Personel Yetkilisi</span>;
      case 'readonly': return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Salt Okuma</span>;
      default: return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle & Brand / Title */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            title="Menüyü Aç"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
              DENİZE KARŞI & PALM
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">
              Finans ve İşletme Yönetim Sistemi
            </span>
          </div>
        </div>

        {/* Right: User Profile & Logout */}
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-800 leading-tight">{user?.fullName}</div>
            <div className="flex justify-end mt-0.5">{getRoleBadge(user?.roleId)}</div>
          </div>
          <button
            onClick={logout}
            title="Çıkış Yap"
            className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-1.5 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </div>
      </div>
    </header>
  );
}
