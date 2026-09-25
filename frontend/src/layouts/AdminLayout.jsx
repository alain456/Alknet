import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, UserCircle, LayoutGrid, Briefcase,
  CreditCard, Settings, Menu, X, Search, Bell, LogOut, ChevronRight, MapPin,
  Activity, PanelsTopLeft, BarChart3, Shield, Mail,
} from 'lucide-react';
import Logo from '../shared/components/Logo';
import ThemeToggle from '../shared/components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import api from '../shared/api';
import { canAccessZone, ZONE_ACCESS } from '../auth/roleAccess';
import {
  canOpenPlatformPath,
  platformHomePath,
  platformRoleLabel,
  platformRoleNameByCode,
  userHasAnyPlatformPerm,
} from '../auth/platformPermissions';
import { CONTACT_UNREAD_EVENT } from '../admin/contactInbox';

/** Compat HMR / anciens imports : `import { CONTACT_UNREAD_EVENT } from '../layouts/AdminLayout'` */
export { CONTACT_UNREAD_EVENT };

const BREADCRUMB_LABELS = {
  admin: 'Tableau de bord',
  users: 'Utilisateurs',
  businesses: 'Entreprises',
  hotels: 'Hôtels',
  professionals: 'Professionnels',
  categories: 'Catégories',
  locations: 'Localisations',
  services: 'Services',
  payments: 'Abonnements',
  analytics: 'Analytique',
  cms: 'CMS',
  'audit-logs': 'Audit',
  roles: 'Rôles',
  moderation: 'Modération',
  support: 'Messages contact',
  settings: 'Paramètres',
};

function navItemIsActive(itemPath, location) {
  const [pathname, query = ''] = itemPath.split('?');
  if (pathname === '/admin') {
    return location.pathname === '/admin';
  }
  if (location.pathname !== pathname) {
    return location.pathname.startsWith(`${pathname}/`);
  }
  if (!query) {
    return !location.search || location.search === '?';
  }
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(location.search);
  return [...want.entries()].every(([key, value]) => have.get(key) === value);
}

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [contactUnread, setContactUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, getRedirectPath } = useAuth();

  const canSeeContactInbox = userHasAnyPlatformPerm(user, ['platform.cms.view', 'platform.users.view']);

  const refreshContactUnread = useCallback(async () => {
    if (!canSeeContactInbox) {
      setContactUnread(0);
      return;
    }
    try {
      const data = await api.get('cms/admin/contact-messages/', { auth: true, noCache: true });
      const list = Array.isArray(data) ? data : (data?.results || []);
      const count = Number(
        data?.unread_count ?? list.filter((m) => !m.is_read).length,
      );
      setContactUnread(Number.isFinite(count) ? count : 0);
    } catch {
      /* badge non bloquant */
    }
  }, [canSeeContactInbox]);

  useEffect(() => {
    refreshContactUnread();
    const onUnread = (e) => {
      if (typeof e?.detail === 'number') {
        setContactUnread(Math.max(0, e.detail));
        return;
      }
      refreshContactUnread();
    };
    window.addEventListener(CONTACT_UNREAD_EVENT, onUnread);
    const timer = window.setInterval(refreshContactUnread, 45000);
    return () => {
      window.removeEventListener(CONTACT_UNREAD_EVENT, onUnread);
      window.clearInterval(timer);
    };
  }, [refreshContactUnread]);

  useEffect(() => {
    // Sur l’inbox, la page gère le badge (évite une course qui le remet après marquage lu)
    if (location.pathname === '/admin/support') return;
    refreshContactUnread();
  }, [location.pathname, refreshContactUnread]);

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
        { name: 'Tableau de bord', icon: LayoutDashboard, path: '/admin', any: ['platform.analytics.view'] },
        { name: 'Analytique', icon: BarChart3, path: '/admin/analytics', any: ['platform.analytics.view'] },
      ],
    },
    {
      title: 'Tenants',
      items: [
        {
          name: 'Acteurs plateforme',
          icon: Shield,
          path: '/admin/users?scope=platform',
          any: ['platform.users.view'],
        },
        {
          name: 'Utilisateurs entreprises',
          icon: Users,
          path: '/admin/users?scope=business',
          any: ['platform.users.view'],
        },
        {
          name: 'Entreprises',
          icon: Building2,
          path: '/admin/businesses',
          any: ['platform.businesses.create', 'platform.businesses.delete', 'platform.businesses.suspend'],
        },
        {
          name: 'Hôtels',
          icon: Building2,
          path: '/admin/hotels',
          any: ['platform.businesses.suspend', 'platform.businesses.view', 'platform.businesses.approve'],
        },
        {
          name: 'Modération',
          icon: Building2,
          path: '/admin/moderation',
          any: ['platform.businesses.approve', 'platform.businesses.reject', 'platform.businesses.suspend'],
          roleCode: 'moderation',
        },        { name: 'Professionnels', icon: UserCircle, path: '/admin/professionals', any: ['platform.professionals.view'] },
      ],
    },
    {
      title: 'Référentiels',
      items: [
        { name: 'Catégories', icon: LayoutGrid, path: '/admin/categories', any: ['platform.catalog.view'] },
        { name: 'Localisations', icon: MapPin, path: '/admin/locations', any: ['platform.catalog.view'] },
        { name: 'Services', icon: Briefcase, path: '/admin/services', any: ['platform.catalog.view'] },
      ],
    },
    {
      title: 'Revenus',
      items: [
        { name: 'Abonnements', icon: CreditCard, path: '/admin/payments', any: ['platform.billing.view', 'platform.subscriptions.view'], roleCode: 'finance' },
      ],
    },
    {
      title: 'Contenu',
      items: [
        { name: 'CMS site', icon: PanelsTopLeft, path: '/admin/cms', any: ['platform.cms.view'], roleCode: 'content' },
        {
          name: 'Messages contact',
          icon: Mail,
          path: '/admin/support',
          any: ['platform.cms.view', 'platform.users.view'],
          roleCode: 'support',
          badgeKey: 'contactUnread',
        },
      ],
    },
    {
      title: 'Système',
      items: [
        { name: 'Rôles & permissions', icon: Settings, path: '/admin/roles', any: ['platform.roles.view'] },
        {
          name: 'Audit plateforme',
          icon: Activity,
          path: '/admin/audit-logs?scope=platform',
          any: ['platform.audit.view'],
        },
        {
          name: 'Audit entreprises',
          icon: Activity,
          path: '/admin/audit-logs?scope=business',
          any: ['platform.audit.view'],
        },
        { name: 'Paramètres', icon: Settings, path: '/admin/settings', any: ['platform.settings.view'] },
      ],
    },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  if (user && !canAccessZone(user, ZONE_ACCESS.platformAdmin)) {
    return <Navigate to={getRedirectPath(user)} replace />;
  }

  const home = platformHomePath(user);
  if (user && location.pathname === '/admin' && home !== '/admin') {
    return <Navigate to={home} replace />;
  }
  if (user && !canOpenPlatformPath(user, location.pathname)) {
    return <Navigate to={home} replace />;
  }

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.any?.length || userHasAnyPlatformPerm(user, item.any)),
    }))
    .filter((group) => group.items.length > 0);

  const crumbKey = location.pathname === '/admin'
    ? 'admin'
    : location.pathname.split('/').filter(Boolean).pop();
  const scopeParam = new URLSearchParams(location.search).get('scope');
  const crumbLabel = (() => {
    if (crumbKey === 'users') {
      return scopeParam === 'platform' ? 'Acteurs plateforme' : 'Utilisateurs entreprises';
    }
    if (crumbKey === 'audit-logs') {
      return scopeParam === 'business' ? 'Audit entreprises' : 'Audit plateforme';
    }
    if (crumbKey === 'moderation') return platformRoleNameByCode(user, 'moderation', BREADCRUMB_LABELS.moderation);
    if (crumbKey === 'payments') return platformRoleNameByCode(user, 'finance', BREADCRUMB_LABELS.payments);
    if (crumbKey === 'support') return platformRoleNameByCode(user, 'support', BREADCRUMB_LABELS.support);
    if (crumbKey === 'cms') return platformRoleNameByCode(user, 'content', BREADCRUMB_LABELS.cms);
    return BREADCRUMB_LABELS[crumbKey] || crumbKey;
  })();

  const NavGroup = ({ title, items }) => (
    <div className="mb-7">
      <div className="px-3 mb-2 text-[10.5px] font-semibold text-ink-faint uppercase tracking-[0.08em]">{title}</div>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = navItemIsActive(item.path, location);
          const label = item.roleCode
            ? platformRoleNameByCode(user, item.roleCode, item.name)
            : item.name;
          const showContactBadge = item.badgeKey === 'contactUnread' && contactUnread > 0;
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
              <span className="flex-1 truncate">{label}</span>
              {showContactBadge && (
                <span className="min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-alert text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {contactUnread > 9 ? '9+' : contactUnread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper text-ink flex selection:bg-primary/15 transition-colors duration-200">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/50 dark:bg-black/60 backdrop-blur-sm z-40 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed xl:sticky top-0 left-0 z-50 h-screen w-64 bg-surface border-r border-border flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        <div className="h-[72px] flex items-center justify-between px-5 border-b border-border shrink-0">
          <Link to="/admin" className="flex items-center gap-2">
            <Logo isDark={false} className="dark:hidden" />
            <Logo isDark={true} className="hidden dark:flex" />
          </Link>
          <button type="button" onClick={closeSidebar} className="xl:hidden text-ink-faint hover:text-ink transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 custom-scrollbar">
          {visibleGroups.map((group) => (
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
                {user?.first_name
                  ? `${user.first_name} ${user.last_name || ''}`.trim()
                  : (platformRoleLabel(user) || user?.email || 'Admin')}
              </p>
              <p className="text-[11px] text-ink-faint dark:text-green-100/50 truncate font-mono">
                {user?.platform_role_name || platformRoleLabel(user) || user?.email || ''}
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

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-paper">
        <header className="h-[72px] bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 lg:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-ink-faint hover:text-ink transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-ink-muted">
              <Link to="/admin" className="hover:text-ink transition-colors">Admin</Link>
              <ChevronRight className="w-3.5 h-3.5 text-border" strokeWidth={2} />
              <span className="text-ink font-semibold">{crumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-paper border border-border rounded-full px-4 py-2 transition-colors focus-within:border-primary w-72">
              <Search className="w-4 h-4 text-ink-faint mr-2 shrink-0" strokeWidth={1.8} />
              <input
                type="text"
                placeholder="Rechercher…"
                className="bg-transparent border-none outline-none w-full text-[13px] text-ink placeholder-ink-faint"
              />
            </div>
            <ThemeToggle variant="ghost" size="sm" />
            <button
              type="button"
              title={contactUnread > 0 ? `${contactUnread} message(s) contact` : 'Notifications'}
              onClick={() => {
                if (contactUnread > 0 || canSeeContactInbox) navigate('/admin/support');
              }}
              className="relative text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" strokeWidth={1.8} />
              {contactUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-alert text-white text-[9px] font-extrabold flex items-center justify-center border-[1.5px] border-surface">
                  {contactUnread > 9 ? '9+' : contactUnread}
                </span>
              )}
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
