import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Building2, Users, Package, ShoppingBag, 
  Calendar, Tag, FileText, UsersRound, 
  CreditCard, BarChart3, Crown, Settings,
  LayoutDashboard, Menu, X, Search, Bell, LogOut,
  Store
} from 'lucide-react';

export default function BusinessLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const mainNavItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/business' },
    { name: 'Business Profile', icon: Store, path: '/business/profile' },
    { name: 'Employees', icon: Users, path: '/business/employees' },
    { name: 'Services', icon: Building2, path: '/business/services' },
    { name: 'Products', icon: Package, path: '/business/products' },
  ];

  const operationsNavItems = [
    { name: 'Orders', icon: ShoppingBag, path: '/business/orders' },
    { name: 'Bookings', icon: Calendar, path: '/business/bookings' },
    { name: 'Offers', icon: Tag, path: '/business/offers' },
    { name: 'Applications', icon: FileText, path: '/business/applications' },
  ];

  const crmNavItems = [
    { name: 'Customers', icon: UsersRound, path: '/business/customers' },
    { name: 'Payments', icon: CreditCard, path: '/business/payments' },
    { name: 'Analytics', icon: BarChart3, path: '/business/analytics' },
  ];

  const bottomNavItems = [
    { name: 'Subscription', icon: Crown, path: '/business/subscription' },
    { name: 'Settings', icon: Settings, path: '/business/settings' },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  const NavGroup = ({ title, items }) => (
    <div className="mb-6">
      <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</div>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/business' && location.pathname.startsWith(item.path));
          return (
            <Link 
              key={item.name} 
              to={item.path}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition ${
                isActive 
                  ? 'bg-primary/10 text-primary dark:bg-teal-900/30 dark:text-teal-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed xl:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white font-bold">
              B
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">Business</span>
          </Link>
          <button onClick={closeSidebar} className="xl:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
          <NavGroup title="Main" items={mainNavItems} />
          <NavGroup title="Operations" items={operationsNavItems} />
          <NavGroup title="CRM & Data" items={crmNavItems} />
          <NavGroup title="System" items={bottomNavItems} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 shrink-0">
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer">
            <LogOut className="w-5 h-5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Location:</span>
              <select className="bg-gray-100 dark:bg-gray-800 border-transparent rounded-md text-sm font-semibold text-gray-900 dark:text-white py-1 px-3 focus:ring-2 focus:ring-primary outline-none cursor-pointer">
                <option>Hotel Club du Lac - Bujumbura</option>
                <option>Hotel Club du Lac - Gitega</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5 border border-transparent focus-within:border-primary transition w-64">
              <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input 
                type="text" 
                placeholder="Search orders, customers..." 
                className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white placeholder-gray-500"
              />
            </div>
            <button className="relative text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition cursor-pointer">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden cursor-pointer border-2 border-white dark:border-gray-800">
              <img src="https://ui-avatars.com/api/?name=Admin&background=0F766E&color=fff" alt="Admin" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
