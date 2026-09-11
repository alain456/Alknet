/** Clés de permissions métier — alignées sur le modèle MVP Isoko Hub */

export const PERMISSIONS = {
  HOSPITAL_VIEW: 'hospital.view',
  HOSPITAL_UPDATE: 'hospital.update',
  SERVICE_VIEW: 'service.view',
  SERVICE_CREATE: 'service.create',
  SERVICE_UPDATE: 'service.update',
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  APPOINTMENT_VIEW_OWN: 'appointment.view_own',
  APPOINTMENT_VIEW_SERVICE: 'appointment.view_service',
  APPOINTMENT_VIEW_ALL: 'appointment.view_all',
  APPOINTMENT_VIEW_CONFIRMED: 'appointment.view_confirmed',
  APPOINTMENT_CREATE: 'appointment.create',
  APPOINTMENT_CONFIRM: 'appointment.confirm',
  APPOINTMENT_CHECK_IN: 'appointment.check_in',
  PATIENT_VIEW_LIMITED: 'patient.view_limited',
  PATIENT_VIEW_ALL: 'patient.view_all',
  MEDICAL_RECORD_VIEW: 'medical_record.view',
  MEDICAL_RECORD_CREATE: 'medical_record.create_note',
  PRESCRIPTION_CREATE: 'prescription.create',
  VITALS_CREATE: 'vitals.create',
  LAB_REQUEST_VIEW: 'lab_request.view',
  LAB_RESULT_CREATE: 'lab_result.create',
  LAB_RESULT_VALIDATE: 'lab_result.validate',
  INVOICE_VIEW: 'invoice.view',
  PAYMENT_CREATE: 'payment.create',
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',
};

/** Alias vers les clés réellement stockées dans BusinessRole.permissions */
export const PERMISSION_ALIASES = {
  [PERMISSIONS.HOSPITAL_VIEW]: ['can_manage_hospital'],
  [PERMISSIONS.HOSPITAL_UPDATE]: ['can_manage_hospital'],
  [PERMISSIONS.MEDICAL_RECORD_VIEW]: ['can_view_medical_records', 'can_edit_medical_records'],
  [PERMISSIONS.MEDICAL_RECORD_CREATE]: ['can_edit_medical_records'],
  [PERMISSIONS.LAB_REQUEST_VIEW]: ['can_manage_lab_results'],
  [PERMISSIONS.LAB_RESULT_CREATE]: ['can_manage_lab_results'],
  [PERMISSIONS.LAB_RESULT_VALIDATE]: ['can_manage_lab_results'],
  [PERMISSIONS.INVOICE_VIEW]: ['can_manage_invoices'],
  [PERMISSIONS.PAYMENT_CREATE]: ['can_manage_invoices'],
  [PERMISSIONS.REPORT_VIEW]: ['can_manage_hospital'],
  [PERMISSIONS.AUDIT_VIEW]: ['can_manage_hospital'],
  [PERMISSIONS.APPOINTMENT_VIEW_ALL]: ['can_manage_hospital'],
  [PERMISSIONS.APPOINTMENT_CONFIRM]: ['can_manage_hospital'],
  [PERMISSIONS.PATIENT_VIEW_LIMITED]: ['appointment.view_confirmed'],
  [PERMISSIONS.PATIENT_VIEW_ALL]: ['can_manage_hospital'],
};

/** Niveau d'accès système suffisant pour une permission MVP */
export const ACCESS_LEVEL_FOR_PERMISSION = {
  [PERMISSIONS.MEDICAL_RECORD_VIEW]: 'MEDICAL_ACCESS',
  [PERMISSIONS.MEDICAL_RECORD_CREATE]: 'MEDICAL_ACCESS',
  [PERMISSIONS.LAB_REQUEST_VIEW]: 'LAB_ACCESS',
  [PERMISSIONS.LAB_RESULT_CREATE]: 'LAB_ACCESS',
  [PERMISSIONS.INVOICE_VIEW]: 'CASHIER_ACCESS',
  [PERMISSIONS.PAYMENT_CREATE]: 'CASHIER_ACCESS',
  [PERMISSIONS.APPOINTMENT_CHECK_IN]: 'RECEPTIONIST_ACCESS',
  [PERMISSIONS.APPOINTMENT_VIEW_CONFIRMED]: 'RECEPTIONIST_ACCESS',
};

export const ACCESS_DENIED_MESSAGE = 'Accès non autorisé pour votre rôle.';

export function userHasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'BUSINESS_OWNER') return true;
  const userPerms = user.business_info?.permissions || [];
  if (userPerms.includes('*')) return true;
  if (userPerms.includes(permission)) return true;
  const aliases = PERMISSION_ALIASES[permission] || [];
  if (aliases.some((a) => userPerms.includes(a))) return true;
  const level = (user.system_access_level || user.business_info?.system_access_level || '').toUpperCase();
  const requiredLevel = ACCESS_LEVEL_FOR_PERMISSION[permission];
  if (requiredLevel && level === requiredLevel) return true;
  return false;
}

export function userHasAnyPermission(user, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((p) => userHasPermission(user, p));
}
