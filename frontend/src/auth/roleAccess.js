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

export function isLabTechnician(user) {
  if (!user) return false;
  const accessLevel = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  const category = (user.staff_category || '').toUpperCase();
  const roleName = (user.business_info?.role_name || '').toLowerCase();
  const position = (user.business_info?.position || '').toLowerCase();
  const perms = user.business_info?.permissions || [];
  // Rôle ou poste labo (même si un profil médecin/spécialiste existe aussi).
  // « laboratin » = faute fréquente de « laborantin ».
  if (accessLevel === ACCESS_LEVELS.LAB) return true;
  if (['LAB', 'LABORANTIN', 'LAB_TECHNICIAN'].includes(category)) return true;
  if (/laborat|laboratoire|\blabo\b/.test(roleName) || /laborat|laboratoire|\blabo\b/.test(position)) return true;
  if (position.includes('lab_technician')) return true;
  const isDoctor = ['DOCTOR', 'SPECIALIST'].includes(category) || accessLevel === ACCESS_LEVELS.MEDICAL;
  if (isDoctor) return false;
  return (
    perms.includes('can_manage_lab_results')
    || perms.includes('hospital.lab.create')
    || perms.includes('hospital.lab.update')
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

export function isEducationBusinessUser(user) {
  return getBusinessCategoryKey(user) === 'education';
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
  '/hotel/staff/cashier/folios': '/hotel/cashier?section=encaisser',
  '/hotel/staff/cashier/invoices': '/hotel/cashier?section=factures',
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
  if (isLabTechnician(user)) {
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

/**
 * Modules métier reconnus. Doivent rester synchronisés avec
 * `ModuleKey` (business_categories/models.py) : c'est la donnée qui décide,
 * cette liste ne sert que de garde-fou.
 */
export const MODULE_KEYS = [
  'business',
  'commerce',
  'hotel',
  'hospital',
  'retail_pharmacy',
  'wholesale',
  'education',
];

/**
 * Une seule lecture du secteur, partagée par l'espace entreprise et les fiches publiques.
 *
 * `module` (champ explicite de BusinessCategory) est la source de vérité.
 * Le matching par mots-clés n'est plus qu'un repli pour les catégories dont le
 * module n'a pas été renseigné : il teste des sous-chaînes, donc « Modélisation »
 * tombait dans « commerce » et « Commerce de santé » dans « hospital ».
 * L'ordre des tests ci-dessous est conservé tel quel : c'est lui qui définit
 * le résultat, et la migration 0003 l'a reproduit à l'identique.
 */
export function categoryKeyFromLabels(name = '', slug = '', module = '') {
  if (module && MODULE_KEYS.includes(module)) return module;

  const n = String(name || '').toLowerCase();
  const s = String(slug || '').toLowerCase();
  if (
    n.includes('pharmacie de gros')
    || (n.includes('pharmac') && n.includes('gros'))
    || s.includes('gros')
    || s.includes('wholesale')
  ) {
    return 'wholesale';
  }
  if (
    n.includes('pharmacie de détail')
    || n.includes('pharmacie de detail')
    || (n.includes('pharmac') && (n.includes('détail') || n.includes('detail') || n.includes('officine')))
    || n.trim() === 'pharmacie'
    || s.includes('detail')
    || s.includes('retail')
    || s.includes('officine')
  ) {
    return 'retail_pharmacy';
  }
  if (
    n.includes('sant')
    || n.includes('hôpital')
    || n.includes('hopital')
    || n.includes('hospital')
    || n.includes('clinique')
    || n.includes('cabinet')
    || n.includes('médical')
    || n.includes('medical')
    || n.includes('health')
    || s.includes('sant')
    || s.includes('hopital')
    || s.includes('hospital')
    || s.includes('clinique')
    || s.includes('medical')
    || s.includes('health')
  ) {
    return 'hospital';
  }
  if (
    n.includes('hôtel')
    || n.includes('hotel')
    || n.includes('hôtellerie')
    || n.includes('hotellerie')
    || s.includes('hotel')
    || s.includes('hotellerie')
  ) {
    return 'hotel';
  }
  if (
    n.includes('éducation')
    || n.includes('education')
    || n.includes('école')
    || n.includes('ecole')
    || n.includes('universit')
    || n.includes('centre de formation')
    || n.includes('centre-de-formation')
    || n.includes('formation')
    || n.includes('enseignement')
    || n.includes('scolarité')
    || n.includes('scolarite')
    || n.includes('académ')
    || n.includes('academ')
    || n.includes('cours du soir')
    || n.includes('cours particuliers')
    || s.includes('ecole')
    || s.includes('universite')
    || s.includes('formation')
    || s.includes('enseignement')
    || s.includes('education')
  ) {
    // Testé avant « commerce » : une « école de commerce » est un
    // établissement d'enseignement, pas une boutique.
    return 'education';
  }
  const commerceKeywords = [
    'commerce', 'boutique', 'mode', 'quincaillerie',
    'supermarché', 'supermarche', 'électronique', 'electronique',
  ];
  if (commerceKeywords.some((k) => n.includes(k) || s.includes(k))) {
    return 'commerce';
  }
  return 'business';
}

export function labelsFromBusiness(business) {
  return {
    name: (
      business?.primary_category_name
      || business?.category_name
      || business?.category?.name
      || business?.primary_category_detail?.name
      || ''
    ),
    slug: (
      business?.primary_category_slug
      || business?.category_slug
      || business?.category?.slug
      || business?.primary_category_detail?.slug
      || ''
    ),
    module: (
      business?.primary_category_module
      || business?.category_module
      || business?.category?.module
      || business?.primary_category_detail?.module
      || ''
    ),
  };
}

export function getBusinessRecordCategoryKey(business) {
  const { name, slug, module } = labelsFromBusiness(business);
  return categoryKeyFromLabels(name, slug, module);
}

/** Chemin d'accueil unique par rôle (aucun chevauchement) */
export function getBusinessCategoryKey(user) {
  return categoryKeyFromLabels(
    user?.business_info?.category_name || '',
    user?.business_info?.category_slug || '',
    user?.business_info?.category_module || '',
  );
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
    if (key === 'education') return '/education/dashboard';
    return '/business';
  }

  if (user.role === ROLES.PROFESSIONAL) {
    // Tout le personnel hôtel → PMS unique (menus selon droits CRUD du rôle)
    if (isHotelBusinessUser(user)) return '/hotel/dashboard';
    if (isEducationBusinessUser(user)) {
      const perms = user.business_info?.permissions || [];
      const roleName = (user.business_info?.role_name || '').toLowerCase();
      const feesOnly = roleName.includes('comptable') || (
        perms.includes('education.fees.manage')
        && !perms.includes('education.admissions.manage')
        && !perms.includes('education.programs.manage')
        && !perms.includes('education.structure.manage')
        && !perms.includes('education.profile.update')
        && !perms.includes('*')
        && !perms.includes('education.manage')
      );
      if (feesOnly) return '/education/accounting';
      return '/education/dashboard';
    }
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

  // L'annuaire public Éducation reste ouvert à tous ; seules les pages de
  // gestion sont réservées à l'établissement.
  if (
    path.startsWith('/education/dashboard')
    || path.startsWith('/education/staff')
    || path.startsWith('/education/accounting')
  ) {
    return categoryKey === 'education';
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
    if (isLabTechnician(user)) return 'lab';
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
  educationStaff: {
    allowedRoles: [ROLES.BUSINESS_OWNER, ROLES.PROFESSIONAL],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.CUSTOMER],
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
