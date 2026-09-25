/** Droits plateforme renvoyés par /accounts/profile/ (platform_permissions). */

export const PLATFORM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FINANCE: 'PLATFORM_FINANCE',
  MODERATION: 'PLATFORM_MODERATION',
  SUPPORT: 'PLATFORM_SUPPORT',
  CONTENT: 'PLATFORM_CONTENT',
};

export function userHasPlatformPerm(user, key) {
  if (!user || !key) return false;
  if (user.role === 'SUPER_ADMIN' || user.is_superuser) return true;
  const list = user.platform_permissions || [];
  return list.includes(key);
}

export function userHasAnyPlatformPerm(user, keys) {
  return (keys || []).some((key) => userHasPlatformPerm(user, key));
}

export function platformHomePath(user) {
  switch (user?.role) {
    case PLATFORM_ROLES.FINANCE:
      return '/admin/payments';
    case PLATFORM_ROLES.MODERATION:
      return '/admin/moderation';
    case PLATFORM_ROLES.SUPPORT:
      return '/admin/support';
    case PLATFORM_ROLES.CONTENT:
      return '/admin/cms';
    default:
      break;
  }
  // Fallback si le rôle n’est pas reconnu : premier espace réellement accessible.
  if (userHasPlatformPerm(user, 'platform.analytics.view')) return '/admin';
  if (userHasAnyPlatformPerm(user, ['platform.businesses.approve', 'platform.businesses.reject'])) {
    return '/admin/moderation';
  }
  if (userHasAnyPlatformPerm(user, ['platform.billing.view', 'platform.subscriptions.view'])) {
    return '/admin/payments';
  }
  if (userHasPlatformPerm(user, 'platform.cms.view')) return '/admin/cms';
  if (userHasAnyPlatformPerm(user, ['platform.users.view', 'platform.audit.view'])) {
    return '/admin/support';
  }
  if (userHasAnyPlatformPerm(user, [
    'platform.businesses.create',
    'platform.businesses.delete',
    'platform.businesses.suspend',
  ])) {
    return '/admin/businesses';
  }
  // Évite une boucle /admin ↔ redirect si aucun droit analytics.
  return '/';
}

export function platformRoleNameByCode(user, code, fallback = '') {
  const catalog = user?.platform_roles || [];
  const hit = catalog.find((row) => row.code === code);
  if (hit?.name) return hit.name;
  return fallback;
}

export function platformRoleLabel(roleOrUser) {
  if (!roleOrUser) return '';
  if (typeof roleOrUser === 'object') {
    if (roleOrUser.platform_role_name) return roleOrUser.platform_role_name;
    roleOrUser = roleOrUser.role;
  }
  switch (roleOrUser) {
    case PLATFORM_ROLES.SUPER_ADMIN:
      return 'Super admin';
    case PLATFORM_ROLES.FINANCE:
      return 'Finance plateforme';
    case PLATFORM_ROLES.MODERATION:
      return 'Modération';
    case PLATFORM_ROLES.SUPPORT:
      return 'Support';
    case PLATFORM_ROLES.CONTENT:
      return 'Contenu';
    default:
      return roleOrUser || '';
  }
}

/** Premier préfixe qui correspond gagne. */
export const PLATFORM_PATH_PERMS = [
  ['/admin/roles', ['platform.roles.view']],
  ['/admin/analytics', ['platform.analytics.view']],
  ['/admin/users', ['platform.users.view']],
  ['/admin/moderation', ['platform.businesses.approve', 'platform.businesses.reject', 'platform.businesses.view']],
  // Catalogue admin complet (lourd) : réservé à la création / gestion globale, pas à la seule modération.
  ['/admin/businesses', ['platform.businesses.create', 'platform.businesses.delete', 'platform.businesses.suspend']],
  ['/admin/hotels', ['platform.businesses.suspend', 'platform.businesses.view', 'platform.businesses.approve']],
  ['/admin/professionals', ['platform.professionals.view']],
  ['/admin/categories', ['platform.catalog.view']],
  ['/admin/locations', ['platform.catalog.view']],
  ['/admin/services', ['platform.catalog.view']],
  ['/admin/payments', ['platform.billing.view', 'platform.subscriptions.view']],
  ['/admin/cms', ['platform.cms.view']],
  ['/admin/audit-logs', ['platform.audit.view']],
  ['/admin/support', ['platform.cms.view', 'platform.users.view']],
  ['/admin/settings', ['platform.settings.view']],
];

export function canOpenPlatformPath(user, pathname) {
  if (!pathname) return true;
  // Tableau de bord global = analytics uniquement (évite 403 pour Finance / Modération / …).
  if (pathname === '/admin') {
    return userHasPlatformPerm(user, 'platform.analytics.view');
  }
  const rule = PLATFORM_PATH_PERMS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!rule) return user?.role === 'SUPER_ADMIN' || user?.is_superuser;
  return userHasAnyPlatformPerm(user, rule[1]);
}
