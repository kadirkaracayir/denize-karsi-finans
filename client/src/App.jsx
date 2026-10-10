import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useFilters } from './context/FilterContext';
import { useRouter } from './utils/router';

// Layout
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import MobileNav from './components/layout/MobileNav';

// Modals
import QuickSaleModal from './components/modals/QuickSaleModal';
import QuickExpenseModal from './components/modals/QuickExpenseModal';
import CashTxModal from './components/modals/CashTxModal';
import DayCloseModal from './components/modals/DayCloseModal';

// Pages - Finans, Kasa & Personel Takip Sistemi
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DailyOperations from './pages/DailyOperations';
import SalesList from './pages/SalesList';
import FastSalesMatrix from './pages/FastSalesMatrix';
import CashManagement from './pages/CashManagement';
import BankManagement from './pages/BankManagement';
import CardPOSManagement from './pages/CardPOSManagement';
import Employees from './pages/Employees';
import PersonnelPuantajHub from './pages/PersonnelPuantajHub';
import EmployeePayments from './pages/EmployeePayments';
import Expenses from './pages/Expenses';
import Transfers from './pages/Transfers';
import DailyClosing from './pages/DailyClosing';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

export default function App() {
  const { path } = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { customEndDate } = useFilters();
  const [activeTab, setActiveTab] = useState('sales');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Quick Action Modals
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const [cashTxConfig, setCashTxConfig] = useState({ isOpen: false, type: 'IN' });
  const [dayCloseDate, setDayCloseDate] = useState(null);

  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Kullanıcı giriş yapmamışsa Finans Giriş Ekranı
  if (!isAuthenticated) {
    return <Login />;
  }

  // Finans ve Personel Takip Sekmeleri
  const renderActivePage = () => {
    switch (activeTab) {
      case 'sales':
      case 'fast-sales':
      case 'dashboard':
        return <FastSalesMatrix onNavigate={setActiveTab} />;
      case 'daily-ops':
        return (
          <DailyOperations
            onNavigate={setActiveTab}
            onOpenQuickSale={() => setShowQuickSale(true)}
            onOpenQuickExpense={() => setShowQuickExpense(true)}
            onOpenCashTx={(type = 'IN') => setCashTxConfig({ isOpen: true, type })}
            onOpenDayClose={(d = customEndDate) => setDayCloseDate(d || '2026-10-09')}
          />
        );
      case 'cash':
        return (
          <CashManagement
            onOpenCashTx={(type = 'IN') => setCashTxConfig({ isOpen: true, type })}
          />
        );
      case 'cards':
        return <CardPOSManagement />;
      case 'banks':
        return <BankManagement />;
      case 'employees':
        return <Employees onNavigate={setActiveTab} />;
      case 'attendance':
        return <PersonnelPuantajHub />;
      case 'employee-payments':
        return <EmployeePayments />;
      case 'expenses':
        return (
          <Expenses
            onOpenQuickExpense={() => setShowQuickExpense(true)}
          />
        );
      case 'transfers':
        return (
          <Transfers
            onOpenCashTx={(type = 'TRANSFER') => setCashTxConfig({ isOpen: true, type })}
          />
        );
      case 'closing':
        return (
          <DailyClosing
            onOpenDayClose={(d = customEndDate) => setDayCloseDate(d || '2026-10-09')}
          />
        );
      case 'reports':
        return <Reports />;
      case 'audit':
        return <AuditLogs />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <Dashboard
            onNavigate={setActiveTab}
            onOpenQuickSale={() => setShowQuickSale(true)}
            onOpenQuickExpense={() => setShowQuickExpense(true)}
            onOpenCashTx={(type = 'IN') => setCashTxConfig({ isOpen: true, type })}
            onOpenDayClose={(d = customEndDate) => setDayCloseDate(d || '2026-10-09')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Sol Menü (Sidebar) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Ana İçerik Alanı */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenQuickSale={() => setShowQuickSale(true)}
          onOpenQuickExpense={() => setShowQuickExpense(true)}
          onOpenCashTx={(type = 'IN') => setCashTxConfig({ isOpen: true, type })}
          onOpenDayClose={(d = customEndDate) => setDayCloseDate(d || '2026-10-09')}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full mb-16 lg:mb-0">
          {renderActivePage()}
        </main>
      </div>

      {/* Mobil Alt Bar */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Global Hızlı İşlem Pencereleri (Modallar) */}
      <QuickSaleModal
        isOpen={showQuickSale}
        onClose={() => setShowQuickSale(false)}
      />

      <QuickExpenseModal
        isOpen={showQuickExpense}
        onClose={() => setShowQuickExpense(false)}
      />

      <CashTxModal
        isOpen={cashTxConfig.isOpen}
        defaultType={cashTxConfig.type}
        onClose={() => setCashTxConfig({ isOpen: false, type: 'IN' })}
      />

      <DayCloseModal
        isOpen={!!dayCloseDate}
        date={dayCloseDate || '2026-10-09'}
        onClose={() => setDayCloseDate(null)}
      />
    </div>
  );
}
