import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Building2, UserCircle, LayoutGrid, Briefcase, 
  Package, ShoppingBag, Calendar, CreditCard, BarChart3, Settings, 
  Menu, X, Search, Bell, LogOut, ChevronRight, ShieldAlert,
  Activity, Zap, Repeat, MonitorPlay, FileText, Database
} from 'lucide-react';

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
      <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{title}</div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          return (
            <Link 
              key={item.name} 
              to={item.path}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'}`} />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 flex selection:bg-gray-200 dark:selection:bg-gray-800 transition-colors duration-200 font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-40 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed xl:sticky top-0 left-0 z-50 h-screen w-64 bg-gray-50 dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black dark:bg-white rounded flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5 text-white dark:text-black" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-black dark:text-white">AlkNet Admin</span>
          </Link>
          <button onClick={closeSidebar} className="xl:hidden text-gray-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 custom-scrollbar">
          <NavGroup title="Platform" items={platformNavItems} />
          <NavGroup title="Commerce" items={commerceNavItems} />
          <NavGroup title="Finances" items={financeNavItems} />
          <NavGroup title="System" items={systemNavItems} />
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">SA</span>
            </div>
            <div className="flex-1 truncate">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">Super Admin</p>
              <p className="text-[10px] text-gray-500">admin@alknet.com</p>
            </div>
            <button className="text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-black">
        {/* Topbar */}
        <header className="h-14 bg-white/50 dark:bg-black/50 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-gray-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            
            {/* Breadcrumbs */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Link to="/admin" className="hover:text-black dark:hover:text-white transition-colors">Admin</Link>
              <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-700" />
              <span className="text-gray-900 dark:text-gray-200">
                {location.pathname === '/admin' ? 'Overview' : location.pathname.split('/').pop().replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-2.5 py-1.5 transition-colors focus-within:border-gray-400 dark:focus-within:border-gray-600 w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="bg-transparent border-none outline-none w-full text-xs text-black dark:text-white placeholder-gray-500"
              />
              <div className="flex items-center gap-1 ml-2">
                <kbd className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">⌘</kbd>
                <kbd className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">K</kbd>
              </div>
            </div>
            
            <button className="relative text-gray-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
              <Bell className="w-4 h-4" />
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white dark:border-black"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
