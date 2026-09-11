import { Navigate, useParams } from 'react-router-dom';

/** Redirige /hospital/admin/:section vers /hospital/:section (compatibilité) */
const ADMIN_SECTION_MAP = {
  services: 'services',
  'service-categories': 'service-categories',
  doctors: 'doctors',
  schedules: 'schedules',
  appointments: 'appointments',
  'medical-records': 'medical-records',
  invoices: 'billing',
  'lab-results': 'laboratory',
  roles: 'users',
  staff: 'staff',
  reports: 'reports',
  audit: 'audit',
};

export default function LegacyHospitalAdminRedirect() {
  const { section } = useParams();
  const target = ADMIN_SECTION_MAP[section || ''] || 'dashboard';
  return <Navigate to={`/hospital/${target}`} replace />;
}
