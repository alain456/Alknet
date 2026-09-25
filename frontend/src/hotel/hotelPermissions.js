/** Catalogue permissions hôtel CRUD — aligné sur hotel/permission_catalog.py */

export const HOTEL_PERM_GROUPS = [
  {
    id: 'manage',
    label: 'Administration',
    masterKey: 'hotel.manage',
    masterLabel: 'Toutes les permissions PMS (Manager)',
    actions: [
      { key: 'hotel.owner', label: 'Marqueur Propriétaire' },
      { key: 'hotel.roles.view', label: 'Voir rôles' },
      { key: 'hotel.roles.create', label: 'Créer rôle' },
      { key: 'hotel.roles.update', label: 'Modifier rôle' },
      { key: 'hotel.roles.delete', label: 'Supprimer rôle' },
      { key: 'hotel.staff.view', label: 'Voir personnel' },
      { key: 'hotel.staff.create', label: 'Ajouter personnel' },
      { key: 'hotel.staff.update', label: 'Modifier personnel' },
      { key: 'hotel.staff.delete', label: 'Retirer personnel' },
      { key: 'hotel.company.view', label: 'Voir fiche hôtel' },
      { key: 'hotel.company.update', label: 'Modifier fiche hôtel' },
      { key: 'hotel.reports.view', label: 'Rapports' },
      { key: 'hotel.audit.view', label: 'Journal d’audit' },
    ],
  },
  {
    id: 'room_types',
    label: 'Types de chambres',
    actions: [
      { key: 'hotel.room_types.view', label: 'Voir' },
      { key: 'hotel.room_types.create', label: 'Créer' },
      { key: 'hotel.room_types.update', label: 'Modifier' },
      { key: 'hotel.room_types.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'rooms',
    label: 'Chambres',
    actions: [
      { key: 'hotel.rooms.view', label: 'Voir' },
      { key: 'hotel.rooms.create', label: 'Créer' },
      { key: 'hotel.rooms.update', label: 'Modifier' },
      { key: 'hotel.rooms.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'rates',
    label: 'Tarifs',
    actions: [
      { key: 'hotel.rates.view', label: 'Voir' },
      { key: 'hotel.rates.create', label: 'Créer' },
      { key: 'hotel.rates.update', label: 'Modifier' },
      { key: 'hotel.rates.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'services',
    label: 'Services hôtel',
    actions: [
      { key: 'hotel.services.view', label: 'Voir' },
      { key: 'hotel.services.create', label: 'Créer' },
      { key: 'hotel.services.update', label: 'Modifier' },
      { key: 'hotel.services.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'reservations',
    label: 'Réservations',
    actions: [
      { key: 'hotel.reservations.view', label: 'Voir' },
      { key: 'hotel.reservations.create', label: 'Créer' },
      { key: 'hotel.reservations.update', label: 'Modifier' },
      { key: 'hotel.reservations.delete', label: 'Supprimer' },
      { key: 'hotel.reservations.confirm', label: 'Confirmer' },
      { key: 'hotel.reservations.cancel', label: 'Refuser / annuler' },
      { key: 'hotel.reservations.reply', label: 'Répondre au client' },
    ],
  },
  {
    id: 'guests',
    label: 'Clients',
    actions: [
      { key: 'hotel.guests.view', label: 'Voir' },
      { key: 'hotel.guests.create', label: 'Créer' },
      { key: 'hotel.guests.update', label: 'Modifier' },
      { key: 'hotel.guests.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'stays',
    label: 'Réception / séjours',
    actions: [
      { key: 'hotel.stays.view', label: 'Voir' },
      { key: 'hotel.stays.update', label: 'Modifier' },
      { key: 'hotel.stays.check_in', label: 'Check-in' },
      { key: 'hotel.stays.check_out', label: 'Check-out' },
    ],
  },
  {
    id: 'housekeeping',
    label: 'Housekeeping',
    actions: [
      { key: 'hotel.housekeeping.view', label: 'Voir' },
      { key: 'hotel.housekeeping.update', label: 'Traiter tâches' },
      { key: 'hotel.housekeeping.assign', label: 'Assigner (gouvernante)' },
    ],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    actions: [
      { key: 'hotel.maintenance.view', label: 'Voir' },
      { key: 'hotel.maintenance.create', label: 'Créer ticket' },
      { key: 'hotel.maintenance.update', label: 'Modifier' },
      { key: 'hotel.maintenance.resolve', label: 'Résoudre' },
    ],
  },
  {
    id: 'cashier',
    label: 'Caisse',
    actions: [
      { key: 'hotel.cashier.view', label: 'Voir' },
      { key: 'hotel.cashier.create', label: 'Encaisser' },
      { key: 'hotel.cashier.update', label: 'Modifier' },
    ],
  },
];

const LEGACY_EXPAND = {
  'hotel.manage': ['hotel.manage', 'hotel.owner', ...HOTEL_PERM_GROUPS.flatMap((g) => g.actions.map((a) => a.key))],
  // Marqueur Propriétaire uniquement — ne réactive pas toutes les cases
  'hotel.owner': ['hotel.owner'],
  'hotel.front_desk': [
    'hotel.front_desk',
    'hotel.stays.view', 'hotel.stays.update', 'hotel.stays.check_in', 'hotel.stays.check_out',
    'hotel.guests.view', 'hotel.guests.create', 'hotel.guests.update', 'hotel.guests.delete',
    'hotel.reservations.view', 'hotel.reservations.create', 'hotel.reservations.update',
  ],
  'hotel.reservations': [
    'hotel.reservations',
    'hotel.reservations.view', 'hotel.reservations.create', 'hotel.reservations.update',
    'hotel.reservations.delete', 'hotel.reservations.confirm', 'hotel.reservations.cancel',
    'hotel.reservations.reply',
  ],
  'hotel.cashier': ['hotel.cashier', 'hotel.cashier.view', 'hotel.cashier.create', 'hotel.cashier.update'],
  'hotel.housekeeping': ['hotel.housekeeping', 'hotel.housekeeping.view', 'hotel.housekeeping.update'],
  'hotel.housekeeping.lead': [
    'hotel.housekeeping.lead', 'hotel.housekeeping',
    'hotel.housekeeping.view', 'hotel.housekeeping.update', 'hotel.housekeeping.assign',
  ],
  'hotel.maintenance': [
    'hotel.maintenance',
    'hotel.maintenance.view', 'hotel.maintenance.create', 'hotel.maintenance.update', 'hotel.maintenance.resolve',
  ],
};

export const ALL_HOTEL_PERM_KEYS = [
  'hotel.manage',
  'hotel.owner',
  'hotel.front_desk',
  'hotel.reservations',
  'hotel.cashier',
  'hotel.housekeeping',
  'hotel.housekeeping.lead',
  'hotel.maintenance',
  ...HOTEL_PERM_GROUPS.flatMap((g) => g.actions.map((a) => a.key)),
];

/** Clés affichées dans la matrice CRUD (hors marqueur owner) */
export const HOTEL_UI_PERM_KEYS = HOTEL_PERM_GROUPS.flatMap((g) => g.actions.map((a) => a.key))
  .filter((k) => k !== 'hotel.owner');

/** Masters legacy : ne doivent PAS rester en sélection sinon ils ré-expansent les cases */
export const HOTEL_LEGACY_MASTERS = [
  'hotel.front_desk',
  'hotel.reservations',
  'hotel.cashier',
  'hotel.housekeeping',
  'hotel.housekeeping.lead',
  'hotel.maintenance',
];

export function expandHotelPermissions(perms = []) {
  const out = new Set(perms);
  if (out.has('hotel.manage') || out.has('*')) {
    ALL_HOTEL_PERM_KEYS.forEach((k) => out.add(k));
    return [...out];
  }
  [...out].forEach((code) => {
    (LEGACY_EXPAND[code] || []).forEach((k) => out.add(k));
  });
  return [...out];
}

export function hotelPermLabel(key) {
  if (key === 'hotel.manage') return 'Admin PMS (tout)';
  if (key === 'hotel.owner') return 'Propriétaire';
  for (const g of HOTEL_PERM_GROUPS) {
    if (g.masterKey === key) return g.masterLabel;
    const found = g.actions.find((a) => a.key === key);
    if (found) return `${g.label} · ${found.label}`;
  }
  return key;
}

export const HOTEL_FRONT_DESK_PERMS = [
  'hotel.front_desk',
  'hotel.stays.view', 'hotel.stays.update', 'hotel.stays.check_in', 'hotel.stays.check_out',
  'hotel.guests.view', 'hotel.guests.create', 'hotel.guests.update',
  'hotel.reservations.view', 'hotel.reservations.create', 'hotel.reservations.update',
];

export const HOTEL_OWNER_PERMS = [
  'hotel.manage',
  'hotel.owner',
  ...HOTEL_PERM_GROUPS.flatMap((g) => g.actions.map((a) => a.key)),
];

export const HOTEL_PREDEFINED_ROLES = [
  {
    name: 'Propriétaire',
    perms: HOTEL_OWNER_PERMS,
    description: 'Compte propriétaire — droits PMS éditables (abonnement plateforme inchangé)',
    isOwner: true,
  },
  {
    name: 'Manager hôtel',
    perms: ['hotel.manage', ...HOTEL_PERM_GROUPS.flatMap((g) => g.actions.map((a) => a.key))],
    description: 'Admin PMS + Rôles & Permissions',
  },
  {
    name: 'Réceptionniste',
    perms: HOTEL_FRONT_DESK_PERMS,
    aliases: ['Réception / Front desk', 'Reception / Front desk', 'Front desk'],
    description: 'Check-in/out et clients',
  },
  {
    name: 'Agent réservations',
    perms: [
      'hotel.reservations',
      'hotel.reservations.view', 'hotel.reservations.create', 'hotel.reservations.update',
      'hotel.reservations.delete', 'hotel.reservations.confirm', 'hotel.reservations.cancel',
      'hotel.reservations.reply',
      'hotel.rates.view', 'hotel.room_types.view', 'hotel.rooms.view',
      'hotel.guests.view', 'hotel.guests.create', 'hotel.guests.update',
    ],
    description: 'CRUD réservations + confirmer / refuser / répondre',
  },
  {
    name: 'Gouvernante',
    perms: [
      'hotel.housekeeping.lead', 'hotel.housekeeping',
      'hotel.housekeeping.view', 'hotel.housekeeping.update', 'hotel.housekeeping.assign',
      'hotel.rooms.view', 'hotel.rooms.update',
    ],
    description: 'Superviser le ménage',
  },
  {
    name: 'Agent de ménage',
    perms: ['hotel.housekeeping', 'hotel.housekeeping.view', 'hotel.housekeeping.update', 'hotel.rooms.view'],
    description: 'Tâches de ménage',
  },
  {
    name: 'Caissier',
    perms: ['hotel.cashier', 'hotel.cashier.view', 'hotel.cashier.create', 'hotel.cashier.update', 'hotel.stays.view'],
    description: 'Folios et paiements',
  },
  {
    name: 'Maintenance',
    perms: [
      'hotel.maintenance',
      'hotel.maintenance.view', 'hotel.maintenance.create', 'hotel.maintenance.update', 'hotel.maintenance.resolve',
      'hotel.rooms.view', 'hotel.rooms.update',
    ],
    description: 'Tickets techniques',
  },
];
