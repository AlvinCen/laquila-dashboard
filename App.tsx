import React, { useState, useMemo, useEffect } from 'react';
import MasterData from './components/MasterData';
import SalesOrderPage from './components/SalesPage';
import SettlementPage from './components/PlatformTable';
import TransactionsPage from './components/EkspedisiTable';
import GrowthInsightPage from './components/ReportsPage';
import UserManagementPage from './components/UserTable';
import LoginPage from './components/LoginPage';
import OrderAnalyticPage from './components/OrderAnalyticPage';
import { useToast } from './contexts/ToastContext';
import { useAuth } from './contexts/AuthContext';
import { Toast } from './components/ui/Toast';
import { UsersIcon } from './components/icons/UsersIcon';
import { LogOutIcon } from './components/icons/LogOutIcon';
import { Card, CardHeader, CardContent } from './components/ui/Card';
import { Module } from './types';

// --- ICONS ---
const ArchiveIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="5" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line><path d="M4 10v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10"></path><path d="M10 15h4"></path>
  </svg>
);
const ClipboardListIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path>
  </svg>
);
const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => ( 
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
);
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);
const TrendingUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
);
const BarChartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);


const ToastContainer = () => {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed top-4 right-4 z-[100] w-full max-w-xs space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

type Page = 'master-data' | 'sales-order' | 'settlement' | 'cash-flow' | 'growth-insight' | 'user-management' | 'order-analytic';

const navItems: { id: Page; label: string; icon: React.FC<any>; adminOnly?: boolean }[] = [
    { id: 'master-data', label: 'Master Data', icon: ArchiveIcon },
    { id: 'sales-order', label: 'Sales Order', icon: ClipboardListIcon },
    { id: 'settlement', label: 'Settlement', icon: CheckCircleIcon },
    { id: 'cash-flow', label: 'Transaksi', icon: DollarSignIcon },
    { id: 'order-analytic', label: 'Order Analytic', icon: BarChartIcon },
    { id: 'growth-insight', label: 'Growth Insight', icon: TrendingUpIcon },
    { id: 'user-management', label: 'Manajemen User', icon: UsersIcon, adminOnly: true },
];

interface NavLinkProps {
  item: { id: Page; label: string; icon: React.FC<any> };
  isActive: boolean;
  onClick: (page: Page) => void;
}

const AccessDeniedComponent = () => (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <h2 className="text-xl font-semibold">Akses Ditolak</h2>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses halaman ini. Silakan hubungi administrator Anda.</p>
            </CardContent>
        </Card>
    </div>
);


function App() {
  const { isAuthenticated, currentUser, logout, hasPermission } = useAuth();
  const [activePage, setActivePage] = useState<Page>('settlement');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const availableNavItems = useMemo(() => {
    if (!currentUser) return [];
    return navItems.filter(item => {
        if (item.adminOnly) return currentUser.role === 'admin';
        // For other items, check if the user has 'read' permission for the corresponding module.
        return hasPermission(item.id as Module, 'read');
    });
  }, [currentUser, hasPermission]);
  
  useEffect(() => {
    // If the current user cannot access the active page, redirect to the first available page.
    const canAccessCurrentPage = availableNavItems.some(item => item.id === activePage);
    if (isAuthenticated && !canAccessCurrentPage) {
      const firstAvailablePage = availableNavItems[0]?.id;
      if (firstAvailablePage) {
        setActivePage(firstAvailablePage);
      }
    }
  }, [activePage, availableNavItems, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'master-data': 
        return hasPermission('master-data', 'read') ? <MasterData /> : <AccessDeniedComponent />;
      case 'sales-order': 
        return hasPermission('sales-order', 'read') ? <SalesOrderPage /> : <AccessDeniedComponent />;
      case 'settlement': 
        return hasPermission('settlement', 'read') ? <SettlementPage /> : <AccessDeniedComponent />;
      case 'cash-flow': 
        return hasPermission('cash-flow', 'read') ? <TransactionsPage /> : <AccessDeniedComponent />;
      case 'order-analytic':
        return hasPermission('order-analytic', 'read') ? <OrderAnalyticPage /> : <AccessDeniedComponent />;
      case 'growth-insight': 
        return hasPermission('growth-insight', 'read') ? <GrowthInsightPage /> : <AccessDeniedComponent />;
      case 'user-management': 
        return currentUser?.role === 'admin' ? <UserManagementPage /> : <AccessDeniedComponent />;
      default: 
        return <AccessDeniedComponent />;
    }
  };
  
  const NavLink: React.FC<NavLinkProps> = ({ item, isActive, onClick }) => (
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onClick(item.id); }}
        className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            isActive ? 'bg-primary text-primary-foreground' : 'text-gray-700 hover:bg-gray-200'
        }`}
    >
        <item.icon className="w-5 h-5 mr-3" />
        {item.label}
    </a>
  );

  const SidebarContent = () => (
      <div className="flex flex-col h-full">
          <div className="p-4 border-b">
              <h1 className="text-xl font-bold text-gray-900">Laquila Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {currentUser?.username}</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
              {availableNavItems.map(item => (
                  <NavLink
                      key={item.id}
                      item={item}
                      isActive={activePage === item.id}
                      onClick={(page) => {
                        setActivePage(page);
                        setSidebarOpen(false);
                      }}
                  />
                )
              )}
          </nav>
          <div className="p-4 border-t">
            <a
                href="#"
                onClick={(e) => { e.preventDefault(); logout(); }}
                className="flex items-center px-4 py-2.5 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-200"
            >
                <LogOutIcon className="w-5 h-5 mr-3" />
                Logout
            </a>
          </div>
      </div>
  )

  return (
    <div className="min-h-screen bg-secondary flex">
      <aside className="hidden lg:block w-64 bg-white border-r border-border">
          <SidebarContent />
      </aside>

      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20" onClick={() => setSidebarOpen(false)}>
            <aside className="fixed top-0 left-0 w-64 h-full bg-white z-30">
                <SidebarContent />
            </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <header className="lg:hidden bg-white shadow-sm flex items-center justify-between p-4">
            <h1 className="text-xl font-bold text-gray-900">Laquila Dashboard</h1>
            <button onClick={() => setSidebarOpen(true)}>
                <MenuIcon className="h-6 w-6 text-gray-700" />
            </button>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {renderPage()}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;