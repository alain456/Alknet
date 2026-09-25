import React from 'react';
import HospitalReferenceSettings from '../hospital/admin/HospitalReferenceSettings';
import HospitalEmailSettings from '../hospital/admin/HospitalEmailSettings';

/** Réglages opérationnels hôpital (sous Informations Générales). */
export default function HospitalOperationalSettings() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2">
        Paramètres métier (hôpital)
      </h2>
      <HospitalReferenceSettings />
      <HospitalEmailSettings />
    </div>
  );
}
