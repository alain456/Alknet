import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Users, Clock, CheckCircle, AlertCircle, Search, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospitalService';
import PermissionGuard from '../../auth/PermissionGuard';
import { PERMISSIONS } from '../../lib/permissions';
import { useSmartPolling } from '../../shared/useSmartPolling';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const ADMISSION_STATUSES = ['CONFIRMED', 'PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS', 'COMPLETED'];

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const isToday = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

export default function ManageAdmissions() {
  const [hospitalId, setHospitalId] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [checkingIn, setCheckingIn] = useState(null);

  const refresh = useCallback(async (hid) => {
    const [apptData, queueData] = await Promise.all([
      hospitalService.getAppointments({ hospital: hid }),
      hospitalService.getQueue(hid),
    ]);
    setAppointments(normalizeList(apptData));
    setQueue(normalizeList(queueData));
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length > 0) {
          setHospitalId(list[0].id);
          await refresh(list[0].id);
        }
      } catch (err) {
        setActionError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [refresh]);

  useSmartPolling(() => hospitalId && refresh(hospitalId), 30000, !!hospitalId);

  const todayAppointments = appointments.filter(
    (a) => isToday(a.appointment_date) && ADMISSION_STATUSES.includes(a.status),
  );

  const expected = todayAppointments.filter((a) => a.status === 'CONFIRMED');
  const arrived = todayAppointments.filter((a) => ['PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS'].includes(a.status));
  const completed = todayAppointments.filter((a) => a.status === 'COMPLETED');

  const filtered = expected.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.patient_name || '').toLowerCase().includes(q)
      || (a.reference_code || '').toLowerCase().includes(q)
    );
  });

  const handleCheckIn = async (aptId) => {
    setCheckingIn(aptId);
    setActionError('');
    setSuccessMsg('');
    try {
      await hospitalService.checkInAppointment(aptId);
      setSuccessMsg('Arrivée enregistrée avec succès.');
      if (hospitalId) await refresh(hospitalId);
    } catch (err) {
      setActionError(err.message || 'Impossible d\'enregistrer l\'arrivée');
    } finally {
      setCheckingIn(null);
    }
  };

  return (
    <PermissionGuard
      anyPermissions={[
        PERMISSIONS.APPOINTMENT_CHECK_IN,
        PERMISSIONS.APPOINTMENT_VIEW_ALL,
        PERMISSIONS.APPOINTMENT_VIEW_CONFIRMED,
        PERMISSIONS.PATIENT_VIEW_LIMITED,
      ]}
    >
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="text-teal-600" />
            Admissions & Arrivées
          </h1>
          <p className="text-gray-500 text-sm mt-1">Suivi administratif du jour — confirmations, arrivées et file d&apos;attente.</p>
        </div>

        {actionError && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" /> {actionError}
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-green-50 text-green-800 rounded-xl text-sm flex items-start gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" /> {successMsg}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Attendus aujourd\'hui', value: expected.length, color: 'text-blue-700' },
            { label: 'Arrivés / en cours', value: arrived.length, color: 'text-emerald-700' },
            { label: 'Terminés', value: completed.length, color: 'text-green-700' },
            { label: 'File active', value: queue.length, color: 'text-purple-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border p-4 text-center">
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Rechercher un patient confirmé..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <Link
            to="/hospital/appointments?tab=queue"
            className="text-sm font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1"
          >
            <Users className="w-4 h-4" /> Voir la file d&apos;attente complète
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Aucune admission en attente aujourd&apos;hui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((apt) => (
              <div key={apt.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900">{apt.patient_name}</p>
                  <p className="text-xs font-mono text-teal-700">{apt.reference_code}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDateTime(apt.appointment_date)}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                    {apt.patient_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{apt.patient_phone}</span>}
                    {apt.patient_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{apt.patient_email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                    {APPOINTMENT_STATUS_LABELS[apt.status] || apt.status}
                  </span>
                  <button
                    type="button"
                    disabled={checkingIn === apt.id}
                    onClick={() => handleCheckIn(apt.id)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                  >
                    {checkingIn === apt.id ? 'Enregistrement...' : 'Enregistrer l\'arrivée'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
