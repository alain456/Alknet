/** Rôles plateforme — séparation stricte des espaces */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
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

export function getStaffHomePath(user) {
  if (!user || user.role !== ROLES.PROFESSIONAL) return '/dashboard';
  const accessLevel = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  const category = (user.staff_category || '').toUpperCase();

  if (accessLevel === ACCESS_LEVELS.RECEPTIONIST || isReceptionist(user)) {
    return '/hospital/staff/receptionist';
  }
  if (accessLevel === ACCESS_LEVELS.LAB || category === 'LAB' || category === 'LABORANTIN') {
    return '/hospital/staff/lab-technician';
  }
  if (accessLevel === ACCESS_LEVELS.CASHIER || category === 'CASHIER' || category === 'CAISSE') {
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

export function getHomePathForUser(user) {
  if (!user) return '/login';

  if (user.role === ROLES.SUPER_ADMIN || user.is_superuser) {
    return '/admin';
  }

  if (user.role === ROLES.BUSINESS_OWNER) {
    const key = getBusinessCategoryKey(user);
    if (key === 'wholesale') return '/wholesale-pharmacy/dashboard';
    if (key === 'retail_pharmacy') return '/retail-pharmacy/dashboard';
    if (key === 'hospital') return '/hospital/dashboard';
    if (key === 'commerce') return '/commerce/dashboard';
    return '/business';
  }

  if (user.role === ROLES.PROFESSIONAL) {
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
    { key: 'cashier', name: 'Caisse & Reçus', path: '/hospital/staff/cashier', roles: ['cashier', 'admin'] },
  ];

  const accessLevel = (user?.system_access_level || user?.business_info?.system_access_level || '').toUpperCase();
  const category = (user?.staff_category || '').toUpperCase();

  const staffType = (() => {
    if (isReceptionist(user)) return 'receptionist';
    if (accessLevel === ACCESS_LEVELS.LAB || category === 'LAB') return 'lab';
    if (accessLevel === ACCESS_LEVELS.CASHIER || category === 'CASHIER') return 'cashier';
    if (category === 'NURSE' || category === 'INFIRMIER') return 'nurse';
    if (accessLevel === ACCESS_LEVELS.MEDICAL || category === 'DOCTOR') return 'doctor';
    return 'doctor';
  })();

  return all.filter((item) => item.roles.includes(staffType));
}

/** Vérifie l'accès à une zone protégée */
export function canAccessZone(user, { allowedRoles = [], forbiddenRoles = [] } = {}) {
  if (!user?.role) return false;
  if (forbiddenRoles.includes(user.role)) return false;
  if (user.is_superuser && user.role !== ROLES.SUPER_ADMIN) {
    return false;
  }
  if (allowedRoles.length > 0) {
    return allowedRoles.includes(user.role);
  }
  return true;
}

export const ZONE_ACCESS = {
  platformAdmin: {
    allowedRoles: [ROLES.SUPER_ADMIN],
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
  receptionistStaff: {
    allowedRoles: [ROLES.PROFESSIONAL],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.BUSINESS_OWNER, ROLES.CUSTOMER],
  },
  customerDashboard: {
    allowedRoles: [ROLES.CUSTOMER, ROLES.PROFESSIONAL],
    forbiddenRoles: [ROLES.SUPER_ADMIN, ROLES.BUSINESS_OWNER],
  },
};
