/**
 * Catalogue permissions Éducation — doit rester aligné sur
 * `education/permission_catalog.py` (côté serveur, seul autoritaire).
 *
 * Même convention que l'hôtel et l'hôpital : un droit « manage » vaut pour
 * l'ensemble du CRUD du module, et `*` ouvre tout.
 */

export const EDUCATION_PERMISSIONS = {
  PROFILE_VIEW: 'education.profile.view',
  PROFILE_UPDATE: 'education.profile.update',
  STRUCTURE_MANAGE: 'education.structure.manage',
  PROGRAMS_MANAGE: 'education.programs.manage',
  ADMISSIONS_MANAGE: 'education.admissions.manage',
  FEES_MANAGE: 'education.fees.manage',
  SERVICES_MANAGE: 'education.services.manage',
};

const CRUD_OF = {
  [EDUCATION_PERMISSIONS.STRUCTURE_MANAGE]: ['education.units'],
  [EDUCATION_PERMISSIONS.PROGRAMS_MANAGE]: ['education.programs'],
  [EDUCATION_PERMISSIONS.ADMISSIONS_MANAGE]: ['education.applications', 'education.applications.workflow'],
  [EDUCATION_PERMISSIONS.FEES_MANAGE]: ['education.fees', 'education.payments'],
  [EDUCATION_PERMISSIONS.SERVICES_MANAGE]: ['education.services'],
};

const CRUD_ACTIONS = ['create', 'update', 'delete'];

/** Déplie `education.<x>.manage` en `education.<x>.{create,update,delete}`. */
export function expandEducationPermissions(permissions = []) {
  const granted = new Set(permissions);
  if (granted.has('*')) return ['*'];
  for (const perm of permissions) {
    for (const [master, roots] of Object.entries(CRUD_OF)) {
      if (perm !== master) continue;
      for (const root of roots) {
        for (const action of CRUD_ACTIONS) granted.add(`${root}.${action}`);
        granted.add(root);
      }
    }
  }
  return [...granted];
}

export function userCanManageEducation(user, master) {
  if (!user) return false;
  // Le propriétaire d'un établissement possède tous les droits de son module,
  // comme le serveur (`education_perm`).
  if (user.role === 'BUSINESS_OWNER') return true;
  const perms = user.business_info?.permissions || [];
  if (perms.includes('*') || perms.includes(master)) return true;
  return expandEducationPermissions(perms).includes(master);
}

export const EDUCATION_PERM_GROUPS = [
  {
    id: 'profile',
    label: 'Fiche établissement',
    actions: [
      { key: EDUCATION_PERMISSIONS.PROFILE_VIEW, label: 'Voir la fiche' },
      { key: EDUCATION_PERMISSIONS.PROFILE_UPDATE, label: 'Modifier la fiche' },
    ],
  },
  {
    id: 'structure',
    label: 'Structure (facultés, départements)',
    actions: [{ key: EDUCATION_PERMISSIONS.STRUCTURE_MANAGE, label: 'Gérer' }],
  },
  {
    id: 'programs',
    label: 'Formations',
    actions: [{ key: EDUCATION_PERMISSIONS.PROGRAMS_MANAGE, label: 'Gérer' }],
  },
  {
    id: 'admissions',
    label: 'Admissions & inscriptions',
    actions: [{ key: EDUCATION_PERMISSIONS.ADMISSIONS_MANAGE, label: 'Gérer' }],
  },
  {
    id: 'fees',
    label: 'Frais de scolarité',
    actions: [{ key: EDUCATION_PERMISSIONS.FEES_MANAGE, label: 'Gérer' }],
  },
  {
    id: 'services',
    label: 'Services aux étudiants',
    actions: [{ key: EDUCATION_PERMISSIONS.SERVICES_MANAGE, label: 'Gérer' }],
  },
];

export default EDUCATION_PERMISSIONS;
