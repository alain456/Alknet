import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  Building2, Users, Calendar, Settings,
  LayoutDashboard, Menu, X, Bell, LogOut, FileText,
  Store, HeartPulse, Stethoscope, Clock, Shield, Sparkles, UserCheck, FolderPlus,
  Package, Warehouse, ShoppingCart, History, User, FlaskConical, Crown, AlertTriangle,
  BedDouble, Wrench, CreditCard, Plus, Mail, MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  canAccessZone,
  ZONE_ACCESS,
  getBusinessCategoryKey,
  getHomePathForUser,
  canAccessCategoryPath,
  ROLES,
} from '../auth/roleAccess';
import { userHasPermission } from '../lib/permissions';
import ThemeToggle from '../shared/components/ThemeToggle';

const isSubscriptionPath = (pathname) => /\/subscription\/?$/.test(pathname || '');

export default function BusinessLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [business, setBusiness] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hotelHkAlert, setHotelHkAlert] = useState(0);
  const [hotelMsgAlert, setHotelMsgAlert] = useState(0);
  const [hotelRescheduleAlert, setHotelRescheduleAlert] = useState(0);
  const [planningAlert, setPlanningAlert] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout, user, authFetch, getRedirectPath } = useAuth();
  const isRetailClientPath = location.pathname.startsWith('/retail-pharmacy/client');
  const isHotelPath = location.pathname.startsWith('/hotel');

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

  // Alertes hôtel : ménage + messages clients + anticiper/reporter
  useEffect(() => {
    if (!token || !isHotelPath) {
      setHotelHkAlert(0);
      setHotelMsgAlert(0);
      setHotelRescheduleAlert(0);
      return undefined;
    }
    let cancelled = false;
    const tick = () => {
      authFetch('/api/v1/hotel/dashboard/')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          const n = Number(data.hk_cleaning_required || 0) + Number(data.hk_unassigned || 0);
          setHotelHkAlert(n > 0 ? Math.max(Number(data.hk_cleaning_required || 0), Number(data.hk_unassigned || 0)) : 0);
          setHotelMsgAlert(Number(data.client_messages_pending || 0));
          setHotelRescheduleAlert(Number(data.reschedule_pending || 0));
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 45000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, isHotelPath, authFetch]);

  const hospitalSpace = location.pathname.startsWith('/hospital')
    || /hopital|hôpital|hospital|clinique|cabinet|santé|sante/.test(
      `${business?.primary_category_name || ''} ${business?.category_name || ''}`.toLowerCase()
    );

  useEffect(() => {
    if (!token || !hospitalSpace || !business?.id) {
      setPlanningAlert(0);
      return undefined;
    }
    let cancelled = false;
    const tick = () => {
      authFetch(`/api/v1/hospital/schedules/planning_alerts/?hospital=${business.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          setPlanningAlert(Number(data.alert_count || 0));
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, hospitalSpace, business?.id, authFetch]);

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
    if (
      name.includes('hôtel')
      || name.includes('hotel')
      || name.includes('hôtellerie')
      || name.includes('hotellerie')
    ) return 'hotel';
    if (location.pathname.startsWith('/retail-pharmacy')) return 'retail_pharmacy';
    if (location.pathname.startsWith('/wholesale-pharmacy/client')) return 'retail_pharmacy';
    if (location.pathname.startsWith('/wholesale-pharmacy')) return 'wholesale';
    if (location.pathname.startsWith('/hospital')) return 'hospital';
    if (location.pathname.startsWith('/hotel')) return 'hotel';
    const commerceKeywords = ['commerce', 'boutique', 'mode', 'quincaillerie', 'supermarché', 'supermarche', 'électronique', 'electronique'];
    if (commerceKeywords.some((k) => name.includes(k))) return 'commerce';
    if (location.pathname.startsWith('/commerce')) return 'commerce';
    return 'business';
  })();

  const isHospital = categoryKey === 'hospital';
  const isHotel = categoryKey === 'hotel';
  const isWholesale = categoryKey === 'wholesale';
  const isRetailPharmacy = categoryKey === 'retail_pharmacy';
  const isCommerce = categoryKey === 'commerce';

  const hotelNavGroups = [
    {
      title: "Vue d'ensemble",
      items: [
        // Shell PMS : toujours visible si l’utilisateur accède à la zone hôtel
        { name: 'Tableau de bord', icon: LayoutDashboard, path: '/hotel/dashboard', alwaysShow: true },
      ],
    },
    {
      title: 'Référentiel',
      items: [
        { name: 'Mon hôtel', icon: Store, path: '/hotel/company', perm: 'hotel.company.view' },
        { name: 'Types de chambres', icon: BedDouble, path: '/hotel/room-types', perm: 'hotel.room_types.view' },
        { name: 'Chambres', icon: Building2, path: '/hotel/rooms', perm: 'hotel.rooms.view' },
        { name: 'Tarifs', icon: CreditCard, path: '/hotel/rates', perm: 'hotel.rates.view' },
        { name: 'Services', icon: Sparkles, path: '/hotel/services', perm: 'hotel.services.view' },
      ],
    },
    {
      title: 'Opérations',
      items: [
        { name: 'Réservations', icon: Calendar, path: '/hotel/reservations', perm: 'hotel.reservations.view' },
        { name: 'Nouvelle réservation', icon: Plus, path: '/hotel/reservations/new', perm: 'hotel.reservations.create' },
        {
          name: 'Messages clients',
          icon: MessageSquare,
          path: '/hotel/messages',
          anyPerm: ['hotel.reservations.view', 'hotel.reservations.reply'],
          badgeKey: 'clientMessages',
        },
        {
          name: 'Anticiper / reporter',
          icon: Clock,
          path: '/hotel/reschedules',
          anyPerm: ['hotel.reservations.view', 'hotel.reservations.confirm'],
          badgeKey: 'rescheduleRequests',
        },
        { name: 'Emails réservation', icon: Mail, path: '/hotel/reservation-settings', perm: 'hotel.reservations.update', hideForOwner: true },
        { name: 'Arrivées', icon: UserCheck, path: '/hotel/front-desk/arrivals', anyPerm: ['hotel.stays.check_in', 'hotel.front_desk'] },
        { name: 'Départs', icon: Users, path: '/hotel/front-desk/departures', anyPerm: ['hotel.stays.check_out', 'hotel.front_desk'] },
        { name: 'Calendrier', icon: Calendar, path: '/hotel/calendar', anyPerm: ['hotel.reservations.view', 'hotel.front_desk', 'hotel.stays.view'] },
        { name: 'Séjours', icon: BedDouble, path: '/hotel/stays', perm: 'hotel.stays.view' },
        { name: 'Clients', icon: Users, path: '/hotel/guests', perm: 'hotel.guests.view' },
      ],
    },
    {
      title: 'Support',
      items: [
        { name: 'Housekeeping', icon: Sparkles, path: '/hotel/housekeeping', perm: 'hotel.housekeeping.view' },
        { name: 'Maintenance', icon: Wrench, path: '/hotel/maintenance', perm: 'hotel.maintenance.view' },
        { name: 'Caisse', icon: CreditCard, path: '/hotel/cashier', perm: 'hotel.cashier.view' },
        { name: 'Folios & paiements', icon: CreditCard, path: '/hotel/folios', perm: 'hotel.cashier.view' },
        { name: 'Facturation', icon: CreditCard, path: '/hotel/invoices', perm: 'hotel.cashier.view' },
        { name: 'Rapports', icon: LayoutDashboard, path: '/hotel/reports', perm: 'hotel.reports.view' },
        { name: "Journal d'Audit", icon: FileText, path: '/hotel/audit', perm: 'hotel.audit.view' },
      ],
    },
    {
      title: 'Système',
      items: [
        { name: 'Rôles & Permissions', icon: Shield, path: '/hotel/users', anyPerm: ['hotel.roles.view', 'hotel.roles.create', 'hotel.roles.update'] },
        { name: 'Personnel', icon: Users, path: '/hotel/staff', perm: 'hotel.staff.view' },
        { name: 'Paramètres', icon: Settings, path: '/business/settings', perm: 'hotel.company.update' },
        // Plateforme : non attribuable via cases PMS — réservé au compte owner
        { name: 'Abonnement', icon: Crown, path: '/hotel/subscription', ownerOnly: true },
      ],
    },
  ];

  /** Filtre menus hôtel selon permissions (propriétaire = même règles que les employés) */
  const filterHotelNavForUser = (groups) => {
    const isOwner = user?.role === ROLES.BUSINESS_OWNER;
    const can = (code) => userHasPermission(user, code);
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.ownerOnly) return isOwner;
          if (item.hideForOwner && isOwner) return false;
          if (item.alwaysShow) return true;
          if (item.anyPerm?.length) return item.anyPerm.some((p) => can(p));
          if (item.perm) return can(item.perm);
          return true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  };

  /** Garde deep-link : pas d’accès URL si le menu correspondant est masqué */
  const hotelPathAllowed = (pathname) => {
    if (!pathname?.startsWith('/hotel')) return true;
    if (pathname === '/hotel' || pathname === '/hotel/' || pathname.startsWith('/hotel/dashboard')) {
      return true;
    }
    const flat = hotelNavGroups.flatMap((g) => g.items);
    const exact = flat.find((item) => item.path === pathname);
    const prefix = flat
      .filter((item) => (
        item.path
        && item.path !== '/hotel/dashboard'
        && pathname.startsWith(`${item.path}/`)
      ))
      .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
    const item = exact || prefix;
    if (!item) return true;
    if (item.ownerOnly) return user?.role === ROLES.BUSINESS_OWNER;
    if (item.hideForOwner && user?.role === ROLES.BUSINESS_OWNER) return false;
    if (item.alwaysShow) return true;
    if (item.anyPerm?.length) return item.anyPerm.some((p) => userHasPermission(user, p));
    if (item.perm) return userHasPermission(user, item.perm);
    return true;
  };

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
        { name: 'Planning & Horaires', icon: Clock, path: '/hospital/schedules', badgeKey: 'planningAlerts' },
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
        { name: 'Paramètres', icon: Settings, path: '/business/settings' },
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
        { name: "Journal d'Audit", icon: FileText, path: '/wholesale-pharmacy/audit' },
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
        { name: "Journal d'Audit", icon: FileText, path: '/retail-pharmacy/audit' },
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
        { name: "Journal d'Audit", icon: FileText, path: '/business/audit' },
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
        { name: "Journal d'Audit", icon: FileText, path: '/commerce/audit' },
        { name: 'Paramètres', icon: Settings, path: '/business/settings' },
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
        : isHotel
          ? '/hotel/subscription'
          : isCommerce
            ? '/commerce/subscription'
            : '/business/subscription';

  const subscriptionBlocked = Boolean(
    !isRetailClientPath && business?.subscription?.is_blocked
  );
  const subscriptionGrace = Boolean(
    !isRetailClientPath && business?.subscription?.in_grace && !subscriptionBlocked
  );
  const subscriptionExpiring = Boolean(
    !isRetailClientPath
    && !subscriptionBlocked
    && !subscriptionGrace
    && business?.subscription?.expiry_warning
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
            : isHotel
              ? filterHotelNavForUser(hotelNavGroups)
              : isCommerce
                ? commerceNavGroups
                : genericNavGroups;
    if (!subscriptionBlocked) return groups;
    // Seul le propriétaire gère l'abonnement plateforme
    if (isHotel && user?.role !== ROLES.BUSINESS_OWNER) {
      return [{
        title: 'Accès plateforme',
        items: [{ name: 'Tableau de bord', icon: LayoutDashboard, path: '/hotel/dashboard' }],
      }];
    }
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
        : isHotel
          ? 'Espace Hôtel'
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
          : isHotel
            ? '/hotel/dashboard'
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
    // Manager employé : pas de page abonnement — rester sur le dashboard
    if (isHotel && user?.role !== ROLES.BUSINESS_OWNER) {
      if (location.pathname !== '/hotel/dashboard') {
        return <Navigate to="/hotel/dashboard" replace />;
      }
    } else {
      return <Navigate to={subscriptionHome} replace />;
    }
  }

  // Manager hôtel (employé) : pas d'accès à l'abonnement plateforme
  if (
    isHotel
    && isSubscriptionPath(location.pathname)
    && user?.role !== ROLES.BUSINESS_OWNER
  ) {
    return <Navigate to="/hotel/dashboard" replace />;
  }

  // Staff / owner : URL hors droits CRUD → dashboard
  if (isHotel && user && !hotelPathAllowed(location.pathname)) {
    return <Navigate to="/hotel/dashboard" replace />;
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
        <div className="h-20 flex flex-col justify-center px-5 border-b border-border dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-800/30">
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
                  const exactOnlyPaths = [
                    '/business',
                    '/hospital/dashboard',
                    '/wholesale-pharmacy/dashboard',
                    '/wholesale-pharmacy/client/dashboard',
                    '/retail-pharmacy/dashboard',
                    '/retail-pharmacy/client/dashboard',
                    '/hotel/reservations',
                  ];
                  const isActive = location.pathname === basePath
                    || (item.path.includes('tab=queue') && location.pathname === '/hospital/appointments' && location.search.includes('tab=queue'))
                    || (
                      !exactOnlyPaths.includes(basePath)
                      && location.pathname.startsWith(`${basePath}/`)
                    );
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
                      <span className="truncate flex-1">{item.name}</span>
                      {item.badgeKey === 'clientMessages' && hotelMsgAlert > 0 && (
                        <span className={`shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-extrabold inline-flex items-center justify-center ${
                          isActive ? 'bg-white text-teal-700' : 'bg-teal-600 text-white'
                        }`}
                        >
                          {hotelMsgAlert > 9 ? '9+' : hotelMsgAlert}
                        </span>
                      )}
                      {item.badgeKey === 'rescheduleRequests' && hotelRescheduleAlert > 0 && (
                        <span className={`shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-extrabold inline-flex items-center justify-center ${
                          isActive ? 'bg-white text-amber-800' : 'bg-amber-500 text-white'
                        }`}
                        >
                          {hotelRescheduleAlert > 9 ? '9+' : hotelRescheduleAlert}
                        </span>
                      )}
                      {item.badgeKey === 'planningAlerts' && planningAlert > 0 && (
                        <span className={`shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-extrabold inline-flex items-center justify-center ${
                          isActive ? 'bg-white text-amber-800' : 'bg-amber-500 text-white'
                        }`}
                        >
                          {planningAlert > 9 ? '9+' : planningAlert}
                        </span>
                      )}
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
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Administrateur'}
              </div>
              <div className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold truncate">
                {user?.business_info?.role_name || spaceLabel}
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

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle variant="ghost" size="sm" />
            <button
              type="button"
              className="relative p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white transition cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
              title={
                isHotel && hotelRescheduleAlert > 0
                  ? `${hotelRescheduleAlert} demande(s) anticiper/reporter`
                  : (isHotel && hotelMsgAlert > 0
                    ? `${hotelMsgAlert} message(s) client`
                    : (isHotel && hotelHkAlert > 0
                      ? `${hotelHkAlert} chambre(s) à nettoyer`
                      : (planningAlert > 0
                        ? `${planningAlert} alerte(s) planning médecin`
                        : 'Notifications')))
              }
              onClick={() => {
                if (isHotel) {
                  if (hotelRescheduleAlert > 0) navigate('/hotel/reschedules');
                  else if (hotelMsgAlert > 0) navigate('/hotel/messages');
                  else navigate('/hotel/housekeeping');
                  return;
                }
                if (planningAlert > 0) navigate('/hospital/schedules');
              }}
            >
              <Bell className="w-5 h-5" />
              {(isHotel ? (hotelHkAlert > 0 || hotelMsgAlert > 0 || hotelRescheduleAlert > 0) : true) && (
                <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                  (isHotel && (hotelMsgAlert > 0 || hotelHkAlert > 0 || hotelRescheduleAlert > 0)) || planningAlert > 0
                    ? 'bg-amber-500'
                    : 'bg-teal-500'
                }`}
                />
              )}
              {isHotel && (hotelMsgAlert > 0 || hotelHkAlert > 0 || hotelRescheduleAlert > 0) && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                  {(hotelRescheduleAlert || hotelMsgAlert || hotelHkAlert) > 9
                    ? '9+'
                    : (hotelRescheduleAlert || hotelMsgAlert || hotelHkAlert)}
                </span>
              )}
              {!isHotel && planningAlert > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                  {planningAlert > 9 ? '9+' : planningAlert}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-gray-50/50 dark:bg-gray-950">
          {subscriptionExpiring && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Abonnement bientôt expiré</p>
                <p className="text-amber-900/80 dark:text-amber-100/80">
                  Il reste {business?.subscription?.paid_days_remaining} jour(s) avant l&apos;échéance.
                  Une période de grâce de {business?.subscription?.grace_period_days} jour(s) suivra.
                </p>
              </div>
            </div>
          )}
          {subscriptionGrace && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Période de grâce en cours</p>
                <p className="text-amber-900/80 dark:text-amber-100/80">
                  Jour {business?.subscription?.grace_days_elapsed} sur {business?.subscription?.grace_period_days}.
                  L&apos;accès reste ouvert jusqu&apos;au renouvellement.
                </p>
              </div>
            </div>
          )}
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
