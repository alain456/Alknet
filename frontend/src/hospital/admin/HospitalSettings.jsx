import React from 'react';
import { Settings } from 'lucide-react';
import HospitalReferenceSettings from './HospitalReferenceSettings';
import HospitalEmailSettings from './HospitalEmailSettings';
import PermissionGuard from '../../auth/PermissionGuard';
import { PERMISSIONS } from '../../lib/permissions';

export default function HospitalSettings() {
  return (
    <PermissionGuard
      anyPermissions={[PERMISSIONS.HOSPITAL_UPDATE, PERMISSIONS.HOSPITAL_VIEW]}
    >
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="text-teal-600" />
            Paramètres hôpital
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Numéros de suivi, emails patients et configuration opérationnelle.
          </p>
        </div>
        <HospitalReferenceSettings />
        <HospitalEmailSettings />
      </div>
    </PermissionGuard>
  );
}
