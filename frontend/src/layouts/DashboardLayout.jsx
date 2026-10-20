import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Compass, MessageSquare, Heart, 
  Calendar, ShoppingBag, CreditCard, Bell, User, 
  Crown, Settings, Menu, X, Search, LogOut, FlaskConical, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessZone, ZONE_ACCESS } from '../auth/roleAccess';
import api from '../shared/api';
import ThemeToggle from '../shared/components/ThemeToggle';
import PersonAvatar from '../shared/components/PersonAvatar';
import SkipLink from '../shared/components/SkipLink';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, getRedirectPath } = useAuth();

  const loadUnread = useCallback(async () => {
    try {
      const data = await api.get('hospital/notifications/', { auth: true });
      const list = normalizeList(data);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    loadUnread();
    const id = window.setInterval(loadUnread, 60000);
    return () => window.clearInterval(id);
  }, [user, loadUnread, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (user && !canAccessZone(user, ZONE_ACCESS.customerDashboard)) {
    return <Navigate to={getRedirectPath(user)} replace />;
  }

  const navItems = [
    { name: 'Tableau de bord', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Explorer', icon: Compass, path: '/dashboard/explore' },
    { name: 'Messages', icon: MessageSquare, path: '/dashboard/messages' },
    { name: 'Favoris', icon: Heart, path: '/dashboard/favorites' },
    { name: 'Rendez-vous', icon: Calendar, path: '/dashboard/bookings' },
    { name: 'Inscriptions', icon: GraduationCap, path: '/dashboard/inscriptions' },
    { name: 'Résultats de labo', icon: FlaskConical, path: '/dashboard/lab-results' },
    { name: 'Commandes', icon: ShoppingBag, path: '/dashboard/orders' },
    { name: 'Paiements', icon: CreditCard, path: '/dashboard/payments' },
    { name: 'Notifications', icon: Bell, path: '/dashboard/notifications' },
  ];

  const bottomNavItems = [
    { name: 'Profil', icon: User, path: '/dashboard/profile' },
    { name: 'Abonnement', icon: Crown, path: '/dashboard/subscription' },
    { name: 'Paramètres', icon: Settings, path: '/dashboard/settings' },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  if (user && !canAccessZone(user, ZONE_ACCESS.customerDashboard)) {
    return <Navigate to={getRedirectPath(user)} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
      <SkipLink />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
            <span className="font-bold text-xl text-primary dark:text-white">Isoko Hub</span>
          </Link>
          <button onClick={closeSidebar} className="lg:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const showNotifBadge = item.path === '/dashboard/notifications' && unreadCount > 0;
            return (
              <Link 
                key={item.name} 
                to={item.path}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition ${
                  isActive 
                    ? 'bg-accent text-ink' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 truncate">{item.name}</span>
                {showNotifBadge && (
                  <span className="min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-accent text-ink text-[10px] font-bold flex items-center justify-center shrink-0">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="mt-8 mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Compte</div>
          
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.name} 
                to={item.path}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition ${
                  isActive 
                    ? 'bg-accent text-ink' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="sidebar-account p-4 border-t border-white/15">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md font-medium transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main id="contenu" className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center max-w-md w-full bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 border border-border focus-within:border-primary transition">
              <Search className="w-4 h-4 text-gray-400 mr-2" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white placeholder-gray-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle variant="ghost" size="sm" />
            <Link
              to="/dashboard/notifications"
              className="relative text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 rounded-full bg-accent text-ink text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <PersonAvatar
              src={user?.avatar}
              name={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email}
              className="h-8 w-8 text-sm border-2 border-white"
            />
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
