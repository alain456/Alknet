/** Rôles plateforme — séparation stricte des espaces */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_FINANCE: 'PLATFORM_FINANCE',
  PLATFORM_MODERATION: 'PLATFORM_MODERATION',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  PLATFORM_CONTENT: 'PLATFORM_CONTENT',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  PROFESSIONAL: 'PROFESSIONAL',
  CUSTOMER: 'CUSTOMER',
};

export const ACCESS_LEVELS = {
  ADMIN: 'ADMIN_ACCESS',
  MEDICAL: 'MEDICAL_ACCESS',
  RECEPTIONIST: 'RECEPTIONIST_ACCESS',
  LAB: 'LAB_ACCESS',
  CASHIER: 'CASHIER_ACCESS',
  STAFF: 'STAFF_ACCESS',
};

/** Permissions agent d'accueil (affichage admin) */
export const RECEPTIONIST_PERMISSIONS = [
  { key: 'appointment.view_confirmed', label: 'Voir les RDV confirmés par l\'admin' },
  { key: 'appointment.check_in', label: 'Enregistrer l\'arrivée (RDV confirmé)' },
  { key: 'appointment.view_audit', label: 'Consulter l\'historique d\'un RDV' },
];

export function isComptable(user) {
  if (!user) return false;
  const category = (user.staff_category || '').toUpperCase();
  const roleName = (user.business_info?.role_name || '').toLowerCase();
  const position = (user.business_info?.position || '').toLowerCase();
  return (
    category === 'ACCOUNTANT'
    || category === 'COMPTABLE'
    || roleName.includes('comptable')
    || roleName.includes('comptab')
    || position.includes('comptable')
    || position.includes('comptab')
  );
}

export function isCashierOrAccountant(user) {
  if (!user) return false;
  const accessLevel = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  const category = (user.staff_category || '').toUpperCase();
  const roleName = (user.business_info?.role_name || '').toLowerCase();
  const perms = user.business_info?.permissions || [];
  const clinical = [
    'can_manage_hospital',
    'can_view_medical_records',
    'can_edit_medical_records',
    'can_manage_lab_results',
  ];
  const invoiceOnly = perms.includes('can_manage_invoices') && !clinical.some((key) => perms.includes(key));
  return (
    isComptable(user)
    || accessLevel === ACCESS_LEVELS.CASHIER
    || category === 'CASHIER'
    || category === 'CAISSE'
    || roleName.includes('caissier')
    || roleName.includes('caisse')
    || invoiceOnly
  );
}

export function isReceptionist(user) {
  if (!user) return false;
  const accessLevel = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  const category = (user.staff_category || '').toUpperCase();
  const roleName = (user.business_info?.role_name || '').toLowerCase();
  const perms = user.business_info?.permissions || [];
  return (
    accessLevel === ACCESS_LEVELS.RECEPTIONIST
    || category === 'RECEPTIONIST'
    || category === 'ACCUEIL'
    || roleName.includes('accueil')
    || roleName.includes('réception')
    || roleName.includes('reception')
    || perms.includes('appointment.view_confirmed')
  );
}

export function isHotelBusinessUser(user) {
  return getBusinessCategoryKey(user) === 'hotel';
}

export function isHotelHousekeepingLead(user) {
  if (!user) return false;
  const perms = user.business_info?.permissions || [];
  // Même règle pour propriétaire et employés
  if (perms.includes('*') || perms.includes('hotel.manage')) return true;
  if (perms.includes('hotel.housekeeping.lead') || perms.includes('hotel.housekeeping.assign')) return true;
  const accessLevel = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  if (accessLevel === ACCESS_LEVELS.ADMIN && user.role !== ROLES.BUSINESS_OWNER) return true;
  const roleName = (user.business_info?.role_name || '').toLowerCase();
  const position = (user.business_info?.position || '').toLowerCase();
  return (
    roleName.includes('gouvern')
    || (roleName.includes('responsable') && (roleName.includes('ménage') || roleName.includes('menage') || roleName.includes('house')))
    || position.includes('gouvern')
  );
}

export function isHotelReservationsOnly(user) {
  if (!user || user.role !== ROLES.PROFESSIONAL) return false;
  const roleName = (user.business_info?.role_name || '').toLowerCase();
  const perms = user.business_info?.permissions || [];
  const position = (user.business_info?.position || '').toLowerCase();
  const accessLevel = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  const isFront =
    accessLevel === ACCESS_LEVELS.RECEPTIONIST
    || perms.includes('hotel.front_desk')
    || roleName.includes('réception')
    || roleName.includes('reception')
    || position.includes('reception');
  if (isFront) return false;
  return (
    perms.includes('hotel.reservations')
    || roleName.includes('réserv')
    || roleName.includes('reserv')
    || position.includes('reserv')
  );
}

/**
 * Accueil PMS hôtel — un seul shell (/hotel/*) filtré par permissions CRUD.
 * Les anciens chemins /hotel/staff/* redirigent vers ces pages.
 */
export function getHotelStaffHomePath(_user) {
  return '/hotel/dashboard';
}

/** Alias legacy → routes PMS (menus = BusinessLayout + droits). */
export const HOTEL_STAFF_PATH_REDIRECTS = {
  '/hotel/staff/front-desk': '/hotel/dashboard',
  '/hotel/staff/front-desk/arrivals': '/hotel/front-desk/arrivals',
  '/hotel/staff/front-desk/departures': '/hotel/front-desk/departures',
  '/hotel/staff/front-desk/stays': '/hotel/stays',
  '/hotel/staff/front-desk/reservations': '/hotel/reservations',
  '/hotel/staff/front-desk/reservations/new': '/hotel/reservations/new',
  '/hotel/staff/front-desk/settings': '/hotel/reservation-settings',
  '/hotel/staff/reservations': '/hotel/dashboard',
  '/hotel/staff/reservations/list': '/hotel/reservations',
  '/hotel/staff/reservations/new': '/hotel/reservations/new',
  '/hotel/staff/reservations/settings': '/hotel/reservation-settings',
  '/hotel/staff/housekeeping': '/hotel/housekeeping',
  '/hotel/staff/housekeeping/tasks': '/hotel/housekeeping',
  '/hotel/staff/cashier': '/hotel/cashier',
  '/hotel/staff/cashier/folios': '/hotel/folios',
  '/hotel/staff/cashier/invoices': '/hotel/invoices',
  '/hotel/staff/maintenance': '/hotel/maintenance',
  '/hotel/staff/maintenance/tickets': '/hotel/maintenance',
};

export function resolveHotelStaffRedirect(pathname) {
  if (!pathname) return '/hotel/dashboard';
  if (HOTEL_STAFF_PATH_REDIRECTS[pathname]) return HOTEL_STAFF_PATH_REDIRECTS[pathname];
  // Ancien portail staff (sauf /hotel/staff = page Personnel PMS)
  if (pathname.startsWith('/hotel/staff/')) return '/hotel/dashboard';
  return null;
}

/**
 * @deprecated Menus staff = BusinessLayout (filterHotelNavForUser). Conservé pour compat.
 */
export function getHotelStaffNav(_user) {
  return [
    { name: 'Tableau de bord', path: '/hotel/dashboard', key: 'pms-home' },
  ];
}

export function getStaffHomePath(user) {
  if (!user || user.role !== ROLES.PROFESSIONAL) return '/dashboard';

  if (isHotelBusinessUser(user)) {
    return getHotelStaffHomePath(user);
  }

  const accessLevel = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  const category = (user.staff_category || '').toUpperCase();

  if (accessLevel === ACCESS_LEVELS.RECEPTIONIST || isReceptionist(user)) {
    return '/hospital/staff/receptionist';
  }
  if (accessLevel === ACCESS_LEVELS.LAB || category === 'LAB' || category === 'LABORANTIN') {
    return '/hospital/staff/lab-technician';
  }
  if (isCashierOrAccountant(user)) {
    return '/hospital/staff/cashier';
  }
  if (category === 'NURSE' || category === 'INFIRMIER') {
    return '/hospital/staff/nurse';
  }
  return '/hospital/staff/doctor';
}

/** Chemin d'accueil unique par rôle (aucun chevauchement) */
export function getBusinessCategoryKey(user) {
  const name = (user?.business_info?.category_name || '').toLowerCase();
  const slug = (user?.business_info?.category_slug || '').toLowerCase();
  if (name.includes('pharmacie de gros') || (name.includes('pharmac') && name.includes('gros'))) {
    return 'wholesale';
  }
  if (
    name.includes('pharmacie de détail')
    || name.includes('pharmacie de detail')
    || (name.includes('pharmac') && (name.includes('détail') || name.includes('detail') || name.includes('officine')))
    || name.trim() === 'pharmacie'
  ) {
    return 'retail_pharmacy';
  }
  if (
    name.includes('sant')
    || name.includes('hôpital')
    || name.includes('hopital')
    || name.includes('hospital')
    || name.includes('clinique')
    || name.includes('cabinet')
  ) {
    return 'hospital';
  }
  if (
    name.includes('hôtel')
    || name.includes('hotel')
    || name.includes('hôtellerie')
    || name.includes('hotellerie')
    || slug.includes('hotel')
  ) {
    return 'hotel';
  }
  // Secteur Commerce (parent ou enfants : Boutique, Mode, Quincaillerie, …)
  const commerceKeywords = [
    'commerce', 'boutique', 'mode', 'quincaillerie',
    'supermarché', 'supermarche', 'électronique', 'electronique',
  ];
  if (commerceKeywords.some((k) => name.includes(k) || slug.includes(k))) {
    return 'commerce';
  }
  return 'business';
}

export function isHotelManagerUser(user) {
  if (!user) return false;
  if (user.role === ROLES.BUSINESS_OWNER && getBusinessCategoryKey(user) === 'hotel') return true;
  if (user.role !== ROLES.PROFESSIONAL || getBusinessCategoryKey(user) !== 'hotel') return false;
  const perms = user.business_info?.permissions || [];
  const access = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  return (
    perms.includes('hotel.manage')
    || perms.includes('*')
    || access === ACCESS_LEVELS.ADMIN
  );
}

export function getHomePathForUser(user) {
  if (!user) return '/login';

  if (user.role === ROLES.SUPER_ADMIN || user.is_superuser) {
    return '/admin';
  }
  if (user.role === ROLES.PLATFORM_FINANCE) return '/admin/payments';
  if (user.role === ROLES.PLATFORM_MODERATION) return '/admin/moderation';
  if (user.role === ROLES.PLATFORM_SUPPORT) return '/admin/support';
  if (user.role === ROLES.PLATFORM_CONTENT) return '/admin/cms';

  if (user.role === ROLES.BUSINESS_OWNER) {
    const key = getBusinessCategoryKey(user);
    if (key === 'wholesale') return '/wholesale-pharmacy/dashboard';
    if (key === 'retail_pharmacy') return '/retail-pharmacy/dashboard';
    if (key === 'hospital') return '/hospital/dashboard';
    if (key === 'hotel') return '/hotel/dashboard';
    if (key === 'commerce') return '/commerce/dashboard';
    return '/business';
  }

  if (user.role === ROLES.PROFESSIONAL) {
    // Tout le personnel hôtel → PMS unique (menus selon droits CRUD du rôle)
    if (isHotelBusinessUser(user)) return '/hotel/dashboard';
    return getStaffHomePath(user);
  }

  return '/dashboard';
}

/**
 * Vérifie qu'un propriétaire d'entreprise n'entre pas dans un espace
 * d'une autre catégorie (gros / détail / hôpital / générique).
 */
export function canAccessCategoryPath(categoryKey, pathname, { role } = {}) {
  const path = pathname || '';

  if (path.startsWith('/retail-pharmacy/client')) {
    return role === ROLES.CUSTOMER || categoryKey === 'retail_pharmacy';
  }

  if (path.startsWith('/wholesale-pharmacy/client')) {
    // Espace acheteur B2B désactivé pour l’admin pharmacie de détail
    return false;
  }

  if (path.startsWith('/wholesale-pharmacy')) {
    return categoryKey === 'wholesale';
  }

  if (path.startsWith('/retail-pharmacy')) {
    return categoryKey === 'retail_pharmacy';
  }

  if (path.startsWith('/hospital')) {
    return categoryKey === 'hospital';
  }

  if (path.startsWith('/hotel')) {
    return categoryKey === 'hotel';
  }

  if (path.startsWith('/commerce')) {
    return categoryKey === 'commerce';
  }

  if (path.startsWith('/business')) {
    // Pharmacies ont leur propre espace (pas /business)
    if (categoryKey === 'wholesale' || categoryKey === 'retail_pharmacy') {
      return false;
    }
    // Commerce / hôpital : profil, paramètres, employés partagés sous /business/*
    return true;
  }

  return true;
}

/** Navigation staff filtrée selon le poste */
export function getStaffNavItems(user) {
  const all = [
    { key: 'receptionist', name: 'Accueil & Admissions', path: '/hospital/staff/receptionist', roles: ['receptionist', 'admin'] },
    { key: 'doctor', name: 'Médecins', path: '/hospital/staff/doctor', roles: ['doctor', 'admin'] },
    { key: 'nurse', name: 'Infirmiers / Soins', path: '/hospital/staff/nurse', roles: ['nurse', 'admin'] },
    { key: 'lab', name: 'Laboratoire', path: '/hospital/staff/lab-technician', roles: ['lab', 'admin'] },
    { key: 'cashier', name: isComptable(user) ? 'Comptabilité' : 'Caisse & Reçus', path: '/hospital/staff/cashier', roles: ['cashier', 'admin'] },
  ];

  const accessLevel = (user?.system_access_level || user?.business_info?.system_access_level || '').toUpperCase();
  const category = (user?.staff_category || '').toUpperCase();

  const staffType = (() => {
    if (isReceptionist(user)) return 'receptionist';
    if (accessLevel === ACCESS_LEVELS.LAB || category === 'LAB') return 'lab';
    if (isCashierOrAccountant(user)) return 'cashier';
    if (category === 'NURSE' || category === 'INFIRMIER') return 'nurse';
    if (accessLevel === ACCESS_LEVELS.MEDICAL || category === 'DOCTOR') return 'doctor';
    return 'doctor';
  })();

  return all.filter((item) => item.roles.includes(staffType));
}

/** Vérifie l'accès à une zone protégée */
export function canAccessZone(user, { allowedRoles = [], forbiddenRoles = [] } = {}) {
  if (!user?.role) return false;
  if (user.is_superuser && user.role !== ROLES.SUPER_ADMIN) {
    return false;
  }

  // Personnel hôtel (manager, agent résa, réception…) → même shell PMS que le propriétaire
  // (les menus / pages sont filtrés par hotel.*.* via userHasPermission)
  if (
    user.role === ROLES.PROFESSIONAL
    && getBusinessCategoryKey(user) === 'hotel'
    && allowedRoles.includes(ROLES.BUSINESS_OWNER)
  ) {
    return true;
  }

  if (forbiddenRoles.includes(user.role)) return false;
  if (allowedRoles.length > 0) {
    return allowedRoles.includes(user.role);
  }
  return true;
}

export const ZONE_ACCESS = {
  platformAdmin: {
    allowedRoles: [
      ROLES.SUPER_ADMIN,
      ROLES.PLATFORM_FINANCE,
      ROLES.PLATFORM_MODERATION,
      ROLES.PLATFORM_SUPPORT,
      ROLES.PLATFORM_CONTENT,
    ],
    forbiddenRoles: [ROLES.BUSINESS_OWNER, ROLES.PROFESSIONAL, ROLES.CUSTOMER],
  },
  businessAdmin: {
    allowedRoles: [ROLES.BUSINESS_OWNER],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.CUSTOMER],
  },
  hospitalStaff: {
    allowedRoles: [ROLES.PROFESSIONAL],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.BUSINESS_OWNER, ROLES.CUSTOMER],
  },
  hotelStaff: {
    allowedRoles: [ROLES.PROFESSIONAL],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.BUSINESS_OWNER, ROLES.CUSTOMER],
  },
  receptionistStaff: {
    allowedRoles: [ROLES.PROFESSIONAL],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.BUSINESS_OWNER, ROLES.CUSTOMER],
  },
  customerDashboard: {
    allowedRoles: [ROLES.CUSTOMER, ROLES.PROFESSIONAL],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.BUSINESS_OWNER],
  },
};
