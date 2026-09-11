import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  Building2, Users, Calendar, Settings,
  LayoutDashboard, Menu, X, Bell, LogOut, FileText,
  Store, HeartPulse, Stethoscope, Clock, Shield, Sparkles, UserCheck, FolderPlus,
  Package, Warehouse, ShoppingCart, History, User, FlaskConical, Crown, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  canAccessZone,
  ZONE_ACCESS,
  getBusinessCategoryKey,
  getHomePathForUser,
  canAccessCategoryPath,
} from '../auth/roleAccess';

const isSubscriptionPath = (pathname) => /\/subscription\/?$/.test(pathname || '');

export default function BusinessLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [business, setBusiness] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout, user, authFetch, getRedirectPath } = useAuth();
  const isRetailClientPath = location.pathname.startsWith('/retail-pharmacy/client');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (user && !canAccessZone(user, ZONE_ACCESS.businessAdmin) && !isRetailClientPath) {
      return;
    }

    if (isRetailClientPath && user?.role === 'CUSTOMER') {
      setBusiness(null);
      setLoading(false);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    authFetch('/api/v1/businesses/me/')
      .then(res => {
        if (res.status === 401) {
          logout();
          navigate('/login');
          return null;
        }
        return res.ok ? res.json() : [];
      })
      .then(data => {
        if (data && data.length > 0) {
          setBusiness(data[0]);
        } else {
          setBusiness(null);
          setLoadError('Aucune entreprise associée à votre compte.');
        }
      })
      .catch(() => setLoadError('Impossible de charger votre entreprise.'))
      .finally(() => setLoading(false));
  }, [token, user, isRetailClientPath]);

  if (user && !canAccessZone(user, ZONE_ACCESS.businessAdmin) && !isRetailClientPath) {
    return <Navigate to={getRedirectPath(user)} replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const categoryKey = (() => {
    const fromUser = getBusinessCategoryKey(user);
    if (fromUser !== 'business') return fromUser;
    const name = (business?.primary_category_name || business?.category_name || '').toLowerCase();
    if (name.includes('pharmacie de gros') || (name.includes('pharmac') && name.includes('gros'))) return 'wholesale';
    if (
      name.includes('pharmacie de détail')
      || name.includes('pharmacie de detail')
      || (name.includes('pharmac') && (name.includes('détail') || name.includes('detail') || name.includes('officine')))
      || name.trim() === 'pharmacie'
    ) return 'retail_pharmacy';
    if (
      name.includes('sant')
      || name.includes('hôpital')
      || name.includes('hopital')
      || name.includes('hospital')
      || name.includes('clinique')
      || name.includes('cabinet')
    ) return 'hospital';
    if (location.pathname.startsWith('/retail-pharmacy')) return 'retail_pharmacy';
    if (location.pathname.startsWith('/wholesale-pharmacy/client')) return 'retail_pharmacy';
    if (location.pathname.startsWith('/wholesale-pharmacy')) return 'wholesale';
    if (location.pathname.startsWith('/hospital')) return 'hospital';
    const commerceKeywords = ['commerce', 'boutique', 'mode', 'quincaillerie', 'supermarché', 'supermarche', 'électronique', 'electronique'];
    if (commerceKeywords.some((k) => name.includes(k))) return 'commerce';
    if (location.pathname.startsWith('/commerce')) return 'commerce';
    return 'business';
  })();

  const isHospital = categoryKey === 'hospital';
  const isWholesale = categoryKey === 'wholesale';
  const isRetailPharmacy = categoryKey === 'retail_pharmacy';
  const isCommerce = categoryKey === 'commerce';

  const hospitalNavGroups = [
    {
      title: "Vue d'ensemble",
      items: [
        { name: 'Tableau de Bord', icon: LayoutDashboard, path: '/hospital/dashboard' },
      ]
    },
    {
      title: "Gestion Hospitalière",
      items: [
        { name: 'Mon hôpital', icon: Store, path: '/hospital/profile' },
        { name: 'Catégories de Prestations', icon: FolderPlus, path: '/hospital/service-categories' },
        { name: 'Services & Paquets de Soins', icon: HeartPulse, path: '/hospital/services' },
        { name: 'Examens & tarifs', icon: FlaskConical, path: '/hospital/exams' },
        { name: 'Annuaire des Médecins', icon: Stethoscope, path: '/hospital/doctors' },
        { name: 'Planning & Horaires', icon: Clock, path: '/hospital/schedules' },
      ]
    },
    {
      title: "Activité Clinique & Patientèle",
      items: [
        { name: 'Patients', icon: UserCheck, path: '/hospital/patients' },
        { name: 'Admissions', icon: Users, path: '/hospital/admissions' },
        { name: 'Rendez-vous Médicaux', icon: Calendar, path: '/hospital/appointments' },
        { name: "File d'attente", icon: Users, path: '/hospital/appointments?tab=queue' },
        { name: 'Dossiers Médicaux', icon: FileText, path: '/hospital/medical-records' },
        { name: 'Laboratoire', icon: Sparkles, path: '/hospital/laboratory' },
        { name: 'Facturation & Caisse', icon: Building2, path: '/hospital/billing' },
      ]
    },
    {
      title: "Pilotage & Sécurité",
      items: [
        { name: 'Rôles & Permissions (RBAC)', icon: Shield, path: '/hospital/users' },
        { name: 'Gestion du Personnel', icon: Users, path: '/hospital/staff' },
        { name: 'Rapports & Analytics', icon: LayoutDashboard, path: '/hospital/reports' },
        { name: "Journal d'Audit", icon: FileText, path: '/hospital/audit' },
        { name: 'Paramètres', icon: Settings, path: '/hospital/settings' },
        { name: 'Abonnement', icon: Crown, path: '/hospital/subscription' },
      ]
    }
  ];

  const wholesaleNavGroups = [
    {
      title: "Vue d'ensemble",
      items: [
        { name: 'Tableau de bord', icon: LayoutDashboard, path: '/wholesale-pharmacy/dashboard' },
        { name: 'Mon entreprise', icon: Store, path: '/wholesale-pharmacy/company' },
      ]
    },
    {
      title: 'Catalogue & stock',
      items: [
        { name: 'Catalogue', icon: Package, path: '/wholesale-pharmacy/catalog' },
        { name: 'Stock', icon: Warehouse, path: '/wholesale-pharmacy/inventory' },
      ]
    },
    {
      title: 'Commandes B2B',
      items: [
        { name: 'Commandes reçues', icon: ShoppingCart, path: '/wholesale-pharmacy/orders' },
        { name: 'Pharmacies clientes', icon: Users, path: '/wholesale-pharmacy/clients' },
        { name: 'Historique', icon: History, path: '/wholesale-pharmacy/history' },
      ]
    },
    {
      title: 'Système',
      items: [
        { name: 'Paramètres', icon: Settings, path: '/wholesale-pharmacy/settings' },
        { name: 'Abonnement', icon: Crown, path: '/wholesale-pharmacy/subscription' },
      ]
    }
  ];

  const wholesaleBuyerNavGroups = [
    {
      title: "Vue d'ensemble",
      items: [
        { name: 'Tableau de bord', icon: LayoutDashboard, path: '/wholesale-pharmacy/client/dashboard' },
      ]
    },
    {
      title: 'Approvisionnement',
      items: [
        { name: 'Catalogue', icon: Package, path: '/wholesale-pharmacy/client/catalog' },
        { name: 'Panier', icon: ShoppingCart, path: '/wholesale-pharmacy/client/cart' },
        { name: 'Facture proforma', icon: FileText, path: '/wholesale-pharmacy/client/proforma' },
        { name: 'Mes commandes', icon: FileText, path: '/wholesale-pharmacy/client/orders' },
      ]
    },
    {
      title: 'Compte',
      items: [
        { name: 'Ma pharmacie de détail', icon: Store, path: '/wholesale-pharmacy/client/company' },
        { name: 'Notifications', icon: Bell, path: '/wholesale-pharmacy/client/notifications' },
        { name: 'Mon profil', icon: User, path: '/wholesale-pharmacy/client/profile' },
      ]
    }
  ];

  const retailAdminNavGroups = [
    {
      title: "Vue d'ensemble",
      items: [
        { name: 'Tableau de bord', icon: LayoutDashboard, path: '/retail-pharmacy/dashboard' },
        { name: 'Ma pharmacie', icon: Store, path: '/retail-pharmacy/company' },
      ]
    },
    {
      title: 'Catalogue & stock',
      items: [
        { name: 'Catalogue patient', icon: Package, path: '/retail-pharmacy/catalog' },
        { name: 'Stock', icon: Warehouse, path: '/retail-pharmacy/inventory' },
        { name: 'Ordonnances', icon: FileText, path: '/retail-pharmacy/prescriptions' },
      ]
    },
    {
      title: 'Commandes patients',
      items: [
        { name: 'Commandes reçues', icon: ShoppingCart, path: '/retail-pharmacy/orders' },
        { name: 'Patients', icon: Users, path: '/retail-pharmacy/patients' },
        { name: 'Historique', icon: History, path: '/retail-pharmacy/history' },
      ]
    },
    {
      title: 'Système',
      items: [
        { name: 'Paramètres', icon: Settings, path: '/retail-pharmacy/settings' },
        { name: 'Abonnement', icon: Crown, path: '/retail-pharmacy/subscription' },
      ]
    }
  ];

  const patientNavGroups = [
    {
      title: 'Espace patient',
      items: [
        { name: 'Tableau de bord', icon: LayoutDashboard, path: '/retail-pharmacy/client/dashboard' },
        { name: 'Catalogue', icon: Package, path: '/retail-pharmacy/client/catalog' },
        { name: 'Panier', icon: ShoppingCart, path: '/retail-pharmacy/client/cart' },
        { name: 'Factures', icon: FileText, path: '/retail-pharmacy/client/proforma' },
        { name: 'Mes commandes', icon: History, path: '/retail-pharmacy/client/orders' },
        { name: 'Mes ordonnances', icon: FileText, path: '/retail-pharmacy/client/prescriptions' },
      ]
    },
    {
      title: 'Compte',
      items: [
        { name: 'Notifications', icon: Bell, path: '/retail-pharmacy/client/notifications' },
        { name: 'Mon profil', icon: User, path: '/retail-pharmacy/client/profile' },
      ]
    }
  ];

  const genericNavGroups = [
    {
      title: 'Principal',
      items: [
        { name: 'Tableau de Bord', icon: LayoutDashboard, path: '/business' },
        { name: 'Profil Entreprise', icon: Store, path: '/business/profile' },
        { name: '..Employés', icon: Users, path: '/business/employees' },
        { name: 'Rôles & Permissions', icon: Shield, path: '/business/roles' },
      ]
    },
    {
      title: 'Opérations',
      items: [
        { name: 'Réservations', icon: Calendar, path: '/business/bookings' },
        { name: 'Services', icon: Building2, path: '/business/services' },
      ]
    },
    {
      title: 'Système',
      items: [
        { name: 'Paramètres', icon: Settings, path: '/business/settings' },
        { name: 'Abonnement', icon: Crown, path: '/business/subscription' },
      ]
    }
  ];

  const commerceNavGroups = [
    {
      title: 'Principal',
      items: [
        { name: 'Tableau de Bord', icon: LayoutDashboard, path: '/commerce/dashboard' },
        { name: 'Profil boutique', icon: Store, path: '/commerce/profile' },
        { name: 'Employés', icon: Users, path: '/commerce/employees' },
      ]
    },
    {
      title: 'Catalogue & stock',
      items: [
        { name: 'Catalogue', icon: Package, path: '/commerce/catalog' },
        { name: 'Stock', icon: Warehouse, path: '/commerce/inventory' },
      ]
    },
    {
      title: 'Ventes',
      items: [
        { name: 'Commandes', icon: ShoppingCart, path: '/commerce/orders' },
      ]
    },
    {
      title: 'Système',
      items: [
        { name: 'Paramètres', icon: Settings, path: '/commerce/settings' },
        { name: 'Abonnement', icon: Crown, path: '/commerce/subscription' },
      ]
    }
  ];

  const subscriptionHome = isWholesale
    ? '/wholesale-pharmacy/subscription'
    : isRetailPharmacy
      ? '/retail-pharmacy/subscription'
      : isHospital
        ? '/hospital/subscription'
        : isCommerce
          ? '/commerce/subscription'
          : '/business/subscription';

  const subscriptionBlocked = Boolean(
    !isRetailClientPath && business?.subscription?.is_blocked
  );

  const activeNavGroups = (() => {
    const groups = isRetailClientPath
      ? patientNavGroups
      : isWholesale
        ? wholesaleNavGroups
        : isRetailPharmacy
          ? retailAdminNavGroups
          : isHospital
            ? hospitalNavGroups
            : isCommerce
              ? commerceNavGroups
              : genericNavGroups;
    if (!subscriptionBlocked) return groups;
    return [{
      title: 'Accès plateforme',
      items: [{ name: 'Abonnement', icon: Crown, path: subscriptionHome }],
    }];
  })();

  const spaceLabel = isWholesale
    ? 'Pharmacie de gros'
    : isRetailPharmacy
      ? 'Pharmacie de détail'
      : isHospital
        ? 'Espace Hôpital'
        : isCommerce
          ? 'Espace Commerce'
          : 'Espace Business';

  const homeLink = isRetailClientPath
    ? '/retail-pharmacy/client/dashboard'
    : isWholesale
      ? '/wholesale-pharmacy/dashboard'
      : isRetailPharmacy
        ? '/retail-pharmacy/dashboard'
        : isHospital
          ? '/hospital/dashboard'
          : isCommerce
            ? '/commerce/dashboard'
            : '/business';

  const closeSidebar = () => setIsSidebarOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <span className="text-sm text-gray-500">Chargement de votre espace...</span>
      </div>
    );
  }

  // Isolation stricte des espaces admin par catégorie (pharmacies surtout)
  if (
    user
    && !isRetailClientPath
    && categoryKey
    && !canAccessCategoryPath(categoryKey, location.pathname, { role: user.role })
  ) {
    const fallback = getHomePathForUser({
      ...user,
      business_info: {
        ...(user.business_info || {}),
        category_name:
          user.business_info?.category_name
          || business?.primary_category_name
          || business?.category_name
          || '',
      },
    });
    return <Navigate to={fallback} replace />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-red-600 font-medium">{loadError}</p>
          <button
            onClick={() => navigate(getRedirectPath(user))}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold"
          >
            Retour à mon espace
          </button>
        </div>
      </div>
    );
  }

  if (subscriptionBlocked && !isSubscriptionPath(location.pathname)) {
    return <Navigate to={subscriptionHome} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed xl:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        <div className="h-20 flex flex-col justify-center px-5 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center justify-between">
            <Link to={homeLink} className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center text-white font-black shadow-md shadow-teal-600/20 shrink-0">
                {isHospital ? <HeartPulse className="w-5 h-5" /> : isWholesale || isRetailPharmacy ? <Package className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-sm text-gray-900 dark:text-white truncate block">
                  {business?.name || 'Mon entreprise'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                  <Sparkles className="w-2.5 h-2.5" />
                  {spaceLabel}
                </span>
              </div>
            </Link>
            <button onClick={closeSidebar} className="xl:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {activeNavGroups.map((group, idx) => (
            <div key={idx}>
              <div className="px-3 mb-2 text-[10.5px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const basePath = item.path.split('?')[0];
                  const isActive = location.pathname === basePath
                    || (item.path.includes('tab=queue') && location.pathname === '/hospital/appointments' && location.search.includes('tab=queue'))
                    || (basePath !== '/business'
                      && basePath !== '/hospital/dashboard'
                      && basePath !== '/wholesale-pharmacy/dashboard'
                      && basePath !== '/wholesale-pharmacy/client/dashboard'
                      && basePath !== '/retail-pharmacy/dashboard'
                      && basePath !== '/retail-pharmacy/client/dashboard'
                      && location.pathname.startsWith(basePath));
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={closeSidebar}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/30 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200 dark:border-teal-800">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Administrateur'}
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                {user?.email || 'admin@isoko.bi'}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-3 py-2 w-full rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-100 dark:border-red-900/30 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {business?.name || spaceLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white transition cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-gray-50/50 dark:bg-gray-950">
          {subscriptionBlocked && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Abonnement Isoko Hub inactif</p>
                <p className="text-amber-900/80 dark:text-amber-100/80">
                  Catalogue public masqué et opérations suspendues jusqu&apos;au renouvellement.
                </p>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
