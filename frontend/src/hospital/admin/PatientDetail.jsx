import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Phone, Mail, Calendar, ChevronLeft, FileText, AlertCircle } from 'lucide-react';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospitalService';
import PermissionGuard from '../../auth/PermissionGuard';
import { PERMISSIONS } from '../../lib/permissions';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function PatientDetail() {
  const { id } = useParams();
  const [hospitalId, setHospitalId] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length === 0) {
          setError('Aucun hôpital associé.');
          setLoading(false);
          return;
        }
        const hid = list[0].id;
        setHospitalId(hid);
        const data = await hospitalService.getAppointments({ hospital: hid });
        setAppointments(normalizeList(data).filter((a) => String(a.patient) === String(id)));
      } catch (err) {
        setError(err.message || 'Impossible de charger le patient.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  const profile = useMemo(() => {
    if (appointments.length === 0) return null;
    const latest = appointments[0];
    return {
      name: latest.patient_name || 'Patient',
      email: latest.patient_email || '',
      phone: latest.patient_phone || '',
    };
  }, [appointments]);

  return (
    <PermissionGuard
      anyPermissions={[
        PERMISSIONS.PATIENT_VIEW_LIMITED,
        PERMISSIONS.PATIENT_VIEW_ALL,
        PERMISSIONS.APPOINTMENT_VIEW_ALL,
      ]}
    >
      <div className="space-y-6 pb-10">
        <Link to="/hospital/patients" className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800">
          <ChevronLeft className="w-4 h-4" /> Retour aux patients
        </Link>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Chargement...</div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        ) : !profile ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
            <p className="font-semibold text-gray-700">Patient introuvable</p>
            <p className="text-sm text-gray-500 mt-1">Aucun rendez-vous associé à cet identifiant.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <User className="text-teal-600" /> {profile.name}
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {profile.email && (
                  <p className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4" />{profile.email}</p>
                )}
                {profile.phone && (
                  <p className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4" />{profile.phone}</p>
                )}
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border">
                Informations administratives uniquement — le dossier médical complet est accessible via l&apos;équipe clinique autorisée.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                <h2 className="font-bold text-gray-900">Historique des rendez-vous ({appointments.length})</h2>
              </div>
              <div className="divide-y">
                {appointments.map((apt) => (
                  <div key={apt.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-teal-700 font-bold">{apt.reference_code || '—'}</p>
                      <p className="text-sm text-gray-800">{formatDateTime(apt.appointment_date)}</p>
                      {apt.reason && (
                        <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                          <FileText className="w-3 h-3 mt-0.5 shrink-0" /> {apt.reason}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700 self-start">
                      {APPOINTMENT_STATUS_LABELS[apt.status] || apt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!hospitalId && !loading && !error && (
          <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-xl">Établissement non configuré.</p>
        )}
      </div>
    </PermissionGuard>
  );
}
