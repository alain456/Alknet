import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Building2, UserCircle, LayoutGrid, Briefcase, 
  Package, ShoppingBag, Calendar, CreditCard, BarChart3, Settings, 
  Menu, X, Search, Bell, LogOut, ChevronRight,
  Activity, Zap, Repeat, MonitorPlay, FileText, Database
} from 'lucide-react';
import Logo from '../shared/components/Logo';

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const platformNavItems = [
    { name: 'Overview', icon: LayoutDashboard, path: '/admin' },
    { name: 'Users', icon: Users, path: '/admin/users' },
    { name: 'Businesses', icon: Building2, path: '/admin/businesses' },
    { name: 'Professionals', icon: UserCircle, path: '/admin/professionals' },
    { name: 'Categories', icon: LayoutGrid, path: '/admin/categories' },
    { name: 'Services', icon: Briefcase, path: '/admin/services' },
    { name: 'Products', icon: Package, path: '/admin/products' },
  ];

  const commerceNavItems = [
    { name: 'Orders', icon: ShoppingBag, path: '/admin/orders' },
    { name: 'Bookings', icon: Calendar, path: '/admin/bookings' },
    { name: 'Subscriptions', icon: Repeat, path: '/admin/subscriptions' },
    { name: 'Advertisements', icon: MonitorPlay, path: '/admin/advertisements' },
  ];

  const financeNavItems = [
    { name: 'Payments', icon: CreditCard, path: '/admin/payments' },
    { name: 'Reports', icon: FileText, path: '/admin/reports' },
    { name: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  ];

  const systemNavItems = [
    { name: 'AI Management', icon: Zap, path: '/admin/ai' },
    { name: 'Audit Logs', icon: Activity, path: '/admin/audit-logs' },
    { name: 'Database', icon: Database, path: '/admin/database' },
    { name: 'Settings', icon: Settings, path: '/admin/settings' },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  const NavGroup = ({ title, items }) => (
    <div className="mb-8">
      <div className="px-3 mb-2 text-[10.5px] font-semibold text-ink-faint uppercase tracking-[0.08em]">{title}</div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          return (
            <Link 
              key={item.name} 
              to={item.path}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
                isActive 
                  ? 'bg-green-100 text-green-700 dark:bg-white/10 dark:text-white' 
                  : 'text-ink-muted hover:text-green-900 dark:text-green-100/70 dark:hover:text-white hover:bg-green-50 dark:hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-green-700 dark:text-white' : 'text-ink-faint dark:text-green-100/50'}`} strokeWidth={1.8} />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper dark:bg-green-900 text-ink dark:text-white flex selection:bg-green-100 dark:selection:bg-green-700 transition-colors duration-200">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-ink/50 dark:bg-black/60 backdrop-blur-sm z-40 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed xl:sticky top-0 left-0 z-50 h-screen w-64 bg-surface dark:bg-green-900 border-r border-border dark:border-white/10 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        <div className="h-[72px] flex items-center justify-between px-5 border-b border-border dark:border-white/10 shrink-0">
          <Link to="/admin" className="flex items-center gap-2">
            <Logo isDark={false} className="dark:hidden" />
            <Logo isDark={true} className="hidden dark:flex" />
          </Link>
          <button onClick={closeSidebar} className="xl:hidden text-ink-faint hover:text-ink dark:hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 custom-scrollbar">
          <NavGroup title="Platform" items={platformNavItems} />
          <NavGroup title="Commerce" items={commerceNavItems} />
          <NavGroup title="Finances" items={financeNavItems} />
          <NavGroup title="System" items={systemNavItems} />
        </div>

        <div className="p-4 border-t border-border dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-ink-muted dark:text-green-100/70">
            <div className="w-8 h-8 rounded-full bg-green-700 text-white flex items-center justify-center shrink-0 font-display font-semibold text-[13px]">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-green-900 dark:text-white truncate">Super Admin</p>
              <p className="text-[11px] text-ink-faint dark:text-green-100/50 truncate font-mono">admin@Ndangira.com</p>
            </div>
            <button className="text-clay-600 hover:text-clay-600/80 dark:text-clay-100 transition-colors cursor-pointer shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-paper dark:bg-green-900">
        {/* Topbar */}
        <header className="h-[72px] bg-surface/80 dark:bg-green-900/80 backdrop-blur-md border-b border-border dark:border-white/10 flex items-center justify-between px-6 lg:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-ink-faint hover:text-green-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Breadcrumbs */}
            <div className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-ink-muted dark:text-green-100/70">
              <Link to="/admin" className="hover:text-green-900 dark:hover:text-white transition-colors">Admin</Link>
              <ChevronRight className="w-3.5 h-3.5 text-border dark:text-white/20" strokeWidth={2} />
              <span className="text-green-900 dark:text-white font-semibold">
                {location.pathname === '/admin' ? 'Overview' : location.pathname.split('/').pop().replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-full px-4 py-2 transition-colors focus-within:border-green-700 dark:focus-within:border-gold-600 w-72">
              <Search className="w-4 h-4 text-ink-faint mr-2 shrink-0" strokeWidth={1.8} />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                className="bg-transparent border-none outline-none w-full text-[13px] text-ink dark:text-white placeholder-ink-faint"
              />
              <div className="flex items-center gap-1 ml-2">
                <kbd className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-ink-faint bg-surface dark:bg-green-900 rounded border border-border dark:border-white/10">⌘K</kbd>
              </div>
            </div>
            
            <button className="relative text-ink-muted hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors cursor-pointer">
              <Bell className="w-5 h-5" strokeWidth={1.8} />
              <span className="absolute top-0 right-0.5 w-2 h-2 bg-clay-600 rounded-full border-[1.5px] border-surface dark:border-green-900"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
