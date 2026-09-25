/** Catalogue permissions hôpital en CRUD — cases de Rôles & Permissions. */

export const HOSPITAL_PERM_GROUPS = [
  {
    id: 'admin',
    label: 'Administration',
    actions: [
      { key: 'hospital.roles.view', label: 'Voir rôles' },
      { key: 'hospital.roles.create', label: 'Créer rôle' },
      { key: 'hospital.roles.update', label: 'Modifier rôle' },
      { key: 'hospital.roles.delete', label: 'Supprimer rôle' },
      { key: 'hospital.staff.view', label: 'Voir personnel' },
      { key: 'hospital.staff.create', label: 'Ajouter personnel' },
      { key: 'hospital.staff.update', label: 'Modifier personnel' },
      { key: 'hospital.staff.delete', label: 'Retirer personnel' },
      { key: 'hospital.settings.view', label: 'Voir réglages' },
      { key: 'hospital.settings.update', label: 'Modifier réglages' },
      { key: 'hospital.reports.view', label: 'Rapports' },
      { key: 'hospital.audit.view', label: 'Journal' },
    ],
  },
  {
    id: 'doctors',
    label: 'Médecins',
    actions: [
      { key: 'hospital.doctors.view', label: 'Voir' },
      { key: 'hospital.doctors.create', label: 'Créer' },
      { key: 'hospital.doctors.update', label: 'Modifier' },
      { key: 'hospital.doctors.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    actions: [
      { key: 'hospital.services.view', label: 'Voir' },
      { key: 'hospital.services.create', label: 'Créer' },
      { key: 'hospital.services.update', label: 'Modifier' },
      { key: 'hospital.services.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'exams',
    label: 'Examens',
    actions: [
      { key: 'hospital.exams.view', label: 'Voir' },
      { key: 'hospital.exams.create', label: 'Créer' },
      { key: 'hospital.exams.update', label: 'Modifier' },
      { key: 'hospital.exams.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'schedules',
    label: 'Planning',
    actions: [
      { key: 'hospital.schedules.view', label: 'Voir' },
      { key: 'hospital.schedules.create', label: 'Créer' },
      { key: 'hospital.schedules.update', label: 'Modifier' },
      { key: 'hospital.schedules.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'appointments',
    label: 'Rendez-vous',
    actions: [
      { key: 'hospital.appointments.view', label: 'Voir' },
      { key: 'hospital.appointments.create', label: 'Créer' },
      { key: 'hospital.appointments.update', label: 'Modifier' },
      { key: 'hospital.appointments.delete', label: 'Supprimer' },
      { key: 'hospital.appointments.confirm', label: 'Confirmer' },
      { key: 'hospital.appointments.reject', label: 'Refuser' },
      { key: 'hospital.appointments.check_in', label: 'Arrivée' },
    ],
  },
  {
    id: 'patients',
    label: 'Patients',
    actions: [
      { key: 'hospital.patients.view', label: 'Voir' },
      { key: 'hospital.patients.update', label: 'Modifier' },
    ],
  },
  {
    id: 'records',
    label: 'Dossiers médicaux',
    actions: [
      { key: 'hospital.records.view', label: 'Voir' },
      { key: 'hospital.records.create', label: 'Créer' },
      { key: 'hospital.records.update', label: 'Modifier' },
      { key: 'hospital.records.delete', label: 'Supprimer' },
    ],
  },
  {
    id: 'prescriptions',
    label: 'Prescriptions',
    actions: [
      { key: 'hospital.prescriptions.view', label: 'Voir' },
      { key: 'hospital.prescriptions.create', label: 'Créer' },
      { key: 'hospital.prescriptions.update', label: 'Modifier' },
    ],
  },
  {
    id: 'lab',
    label: 'Laboratoire',
    actions: [
      { key: 'hospital.lab.view', label: 'Voir' },
      { key: 'hospital.lab.create', label: 'Créer' },
      { key: 'hospital.lab.update', label: 'Modifier' },
      { key: 'hospital.lab.validate', label: 'Valider' },
    ],
  },
  {
    id: 'billing',
    label: 'Comptabilité',
    actions: [
      { key: 'hospital.billing.view', label: 'Voir' },
      { key: 'hospital.billing.create', label: 'Créer' },
      { key: 'hospital.billing.update', label: 'Modifier' },
      { key: 'hospital.billing.delete', label: 'Supprimer' },
      { key: 'hospital.billing.close', label: 'Clôturer' },
    ],
  },
];

export const HOSPITAL_UI_PERM_KEYS = HOSPITAL_PERM_GROUPS.flatMap((g) => g.actions.map((a) => a.key));

export const HOSPITAL_LEGACY_MASTERS = [
  'can_manage_hospital',
  'can_view_medical_records',
  'can_edit_medical_records',
  'can_manage_lab_results',
  'can_manage_invoices',
  'appointment.view_confirmed',
  'appointment.check_in',
  'appointment.view_audit',
];

const BILLING = [
  'hospital.billing.view',
  'hospital.billing.create',
  'hospital.billing.update',
  'hospital.billing.delete',
  'hospital.billing.close',
  'hospital.reports.view',
];
const RECORDS_VIEW = ['hospital.records.view', 'hospital.patients.view', 'hospital.prescriptions.view'];
const RECORDS_EDIT = [
  ...RECORDS_VIEW,
  'hospital.records.create',
  'hospital.records.update',
  'hospital.prescriptions.create',
  'hospital.prescriptions.update',
];
const LAB = [
  'hospital.lab.view',
  'hospital.lab.create',
  'hospital.lab.update',
  'hospital.lab.validate',
  'hospital.exams.view',
];
const RECEPTION = [
  'hospital.appointments.view',
  'hospital.appointments.check_in',
  'hospital.patients.view',
];

function addAll(out, keys) {
  keys.forEach((k) => out.add(k));
}

export function expandHospitalPermissions(permissions) {
  const raw = Array.isArray(permissions) ? permissions : [];
  const out = new Set(raw);
  if (out.has('*') || out.has('hospital.manage') || out.has('can_manage_hospital')) {
    addAll(out, HOSPITAL_UI_PERM_KEYS);
    out.add('hospital.manage');
    out.add('can_manage_hospital');
    return [...out];
  }
  if (out.has('can_manage_invoices')) addAll(out, BILLING);
  if (out.has('can_edit_medical_records')) addAll(out, RECORDS_EDIT);
  else if (out.has('can_view_medical_records')) addAll(out, RECORDS_VIEW);
  if (out.has('can_manage_lab_results')) addAll(out, LAB);
  if (out.has('appointment.view_confirmed') || out.has('appointment.view_audit')) {
    out.add('hospital.appointments.view');
  }
  if (out.has('appointment.check_in')) {
    out.add('hospital.appointments.view');
    out.add('hospital.appointments.check_in');
  }
  return [...out];
}

export function buildHospitalPermissionsPayload(selected) {
  let permissions = (selected || []).filter(
    (k) => k === 'hospital.manage' || HOSPITAL_UI_PERM_KEYS.includes(k),
  );
  const allOn = HOSPITAL_UI_PERM_KEYS.every((k) => permissions.includes(k));
  if (permissions.includes('hospital.manage') && !allOn) {
    permissions = permissions.filter((p) => p !== 'hospital.manage');
  }
  if (allOn || permissions.includes('hospital.manage')) {
    return ['hospital.manage', 'can_manage_hospital', ...HOSPITAL_UI_PERM_KEYS];
  }
  const has = (k) => permissions.includes(k);
  if (['hospital.billing.view', 'hospital.billing.create', 'hospital.billing.update', 'hospital.billing.delete', 'hospital.billing.close'].some(has)) {
    permissions.push('can_manage_invoices');
  }
  if (has('hospital.records.view')) permissions.push('can_view_medical_records');
  if (has('hospital.records.create') || has('hospital.records.update') || has('hospital.prescriptions.create')) {
    permissions.push('can_edit_medical_records');
  }
  if (['hospital.lab.view', 'hospital.lab.create', 'hospital.lab.update', 'hospital.lab.validate'].some(has)) {
    permissions.push('can_manage_lab_results');
  }
  if (has('hospital.appointments.view')) {
    permissions.push('appointment.view_confirmed', 'appointment.view_audit');
  }
  if (has('hospital.appointments.check_in')) permissions.push('appointment.check_in');
  return [...new Set(permissions)];
}

export const HOSPITAL_RECEPTION_PERMS = RECEPTION;
export const HOSPITAL_ACCOUNTING_PERMS = BILLING;

export function hospitalPermLabel(key) {
  for (const group of HOSPITAL_PERM_GROUPS) {
    const action = group.actions.find((a) => a.key === key);
    if (action) return `${group.label} · ${action.label}`;
  }
  if (key === 'hospital.manage' || key === 'can_manage_hospital') return 'Administration (tout)';
  return key;
}
