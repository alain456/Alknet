import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, UserCircle, LayoutGrid, Briefcase,
  CreditCard, Settings, Menu, X, Search, Bell, LogOut, ChevronRight, MapPin,
  Activity, PanelsTopLeft, BarChart3,
} from 'lucide-react';
import Logo from '../shared/components/Logo';
import { useAuth } from '../context/AuthContext';
import { canAccessZone, ZONE_ACCESS } from '../auth/roleAccess';

const BREADCRUMB_LABELS = {
  admin: 'Tableau de bord',
  users: 'Utilisateurs',
  businesses: 'Entreprises',
  professionals: 'Professionnels',
  categories: 'Catégories',
  locations: 'Localisations',
  services: 'Services',
  payments: 'Abonnements',
  analytics: 'Analytique',
  cms: 'CMS',
  'audit-logs': 'Audit',
  settings: 'Paramètres',
};

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, getRedirectPath } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (user?.first_name || user?.last_name) {
      return `${(user.first_name[0] || '').toUpperCase()}${(user.last_name[0] || '').toUpperCase()}`;
    }
    return 'SA';
  };

  const navGroups = [
    {
      title: 'Pilotage',
      items: [
        { name: 'Tableau de bord', icon: LayoutDashboard, path: '/admin' },
        { name: 'Analytique', icon: BarChart3, path: '/admin/analytics' },
      ],
    },
    {
      title: 'Tenants',
      items: [
        { name: 'Utilisateurs', icon: Users, path: '/admin/users' },
        { name: 'Entreprises', icon: Building2, path: '/admin/businesses' },
        { name: 'Professionnels', icon: UserCircle, path: '/admin/professionals' },
      ],
    },
    {
      title: 'Référentiels',
      items: [
        { name: 'Catégories', icon: LayoutGrid, path: '/admin/categories' },
        { name: 'Localisations', icon: MapPin, path: '/admin/locations' },
        { name: 'Services', icon: Briefcase, path: '/admin/services' },
      ],
    },
    {
      title: 'Revenus',
      items: [
        { name: 'Abonnements', icon: CreditCard, path: '/admin/payments' },
      ],
    },
    {
      title: 'Contenu',
      items: [
        { name: 'CMS site', icon: PanelsTopLeft, path: '/admin/cms' },
      ],
    },
    {
      title: 'Système',
      items: [
        { name: 'Journaux d’audit', icon: Activity, path: '/admin/audit-logs' },
        { name: 'Paramètres', icon: Settings, path: '/admin/settings' },
      ],
    },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  if (user && !canAccessZone(user, ZONE_ACCESS.platformAdmin)) {
    return <Navigate to={getRedirectPath(user)} replace />;
  }

  const crumbKey = location.pathname === '/admin'
    ? 'admin'
    : location.pathname.split('/').filter(Boolean).pop();
  const crumbLabel = BREADCRUMB_LABELS[crumbKey] || crumbKey;

  const NavGroup = ({ title, items }) => (
    <div className="mb-7">
      <div className="px-3 mb-2 text-[10.5px] font-semibold text-ink-faint uppercase tracking-[0.08em]">{title}</div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = location.pathname === item.path
            || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
                isActive
                  ? 'bg-green-100 text-green-700 dark:bg-white/10 dark:text-white'
                  : 'text-ink-muted hover:text-green-900 dark:text-green-100/70 dark:hover:text-white hover:bg-green-50 dark:hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-green-700 dark:text-white' : 'text-ink-faint dark:text-green-100/50'}`} strokeWidth={1.8} />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper dark:bg-green-900 text-ink dark:text-white flex selection:bg-green-100 dark:selection:bg-green-700 transition-colors duration-200">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/50 dark:bg-black/60 backdrop-blur-sm z-40 xl:hidden"
          onClick={closeSidebar}
        />
      )}

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
          <button type="button" onClick={closeSidebar} className="xl:hidden text-ink-faint hover:text-ink dark:hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 custom-scrollbar">
          {navGroups.map((group) => (
            <NavGroup key={group.title} title={group.title} items={group.items} />
          ))}
        </div>

        <div className="p-4 border-t border-border dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-ink-muted dark:text-green-100/70">
            <div className="w-8 h-8 rounded-full bg-green-700 text-white flex items-center justify-center shrink-0 font-display font-semibold text-[13px]">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-green-900 dark:text-white truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Super Admin'}
              </p>
              <p className="text-[11px] text-ink-faint dark:text-green-100/50 truncate font-mono">
                {user?.email || 'admin@isokohub.com'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Déconnexion"
              className="text-clay-600 hover:text-clay-600/80 dark:text-clay-100 transition-colors cursor-pointer shrink-0 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-paper dark:bg-green-900">
        <header className="h-[72px] bg-surface/80 dark:bg-green-900/80 backdrop-blur-md border-b border-border dark:border-white/10 flex items-center justify-between px-6 lg:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-ink-faint hover:text-green-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-ink-muted dark:text-green-100/70">
              <Link to="/admin" className="hover:text-green-900 dark:hover:text-white transition-colors">Admin</Link>
              <ChevronRight className="w-3.5 h-3.5 text-border dark:text-white/20" strokeWidth={2} />
              <span className="text-green-900 dark:text-white font-semibold">{crumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center bg-paper dark:bg-black/20 border border-border dark:border-white/10 rounded-full px-4 py-2 transition-colors focus-within:border-green-700 dark:focus-within:border-gold-600 w-72">
              <Search className="w-4 h-4 text-ink-faint mr-2 shrink-0" strokeWidth={1.8} />
              <input
                type="text"
                placeholder="Rechercher…"
                className="bg-transparent border-none outline-none w-full text-[13px] text-ink dark:text-white placeholder-ink-faint"
              />
            </div>
            <button type="button" className="relative text-ink-muted hover:text-green-900 dark:text-green-100/70 dark:hover:text-white transition-colors cursor-pointer">
              <Bell className="w-5 h-5" strokeWidth={1.8} />
              <span className="absolute top-0 right-0.5 w-2 h-2 bg-clay-600 rounded-full border-[1.5px] border-surface dark:border-green-900" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
