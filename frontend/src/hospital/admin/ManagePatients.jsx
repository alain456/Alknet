import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Phone, Mail, Calendar, ChevronRight, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import hospitalService from '../hospitalService';
import PermissionGuard from '../../auth/PermissionGuard';
import { PERMISSIONS } from '../../lib/permissions';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

function buildPatientIndex(appointments) {
  const map = new Map();
  normalizeList(appointments).forEach((apt) => {
    const key = apt.patient || apt.patient_email || apt.patient_name;
    if (!key) return;
    const existing = map.get(key) || {
      id: apt.patient,
      name: apt.patient_name || 'Patient',
      email: apt.patient_email || '',
      phone: apt.patient_phone || '',
      appointmentCount: 0,
      lastAppointmentDate: null,
      lastStatus: '',
    };
    existing.appointmentCount += 1;
    const aptDate = apt.appointment_date ? new Date(apt.appointment_date) : null;
    if (aptDate && (!existing.lastAppointmentDate || aptDate > existing.lastAppointmentDate)) {
      existing.lastAppointmentDate = aptDate;
      existing.lastStatus = apt.status;
    }
    map.set(key, existing);
  });
  return Array.from(map.values()).sort((a, b) => {
    const da = a.lastAppointmentDate?.getTime() || 0;
    const db = b.lastAppointmentDate?.getTime() || 0;
    return db - da;
  });
}

export default function ManagePatients() {
  const [hospitalId, setHospitalId] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
        setAppointments(normalizeList(data));
      } catch (err) {
        setError(err.message || 'Impossible de charger les patients.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const patients = useMemo(() => buildPatientIndex(appointments), [appointments]);

  const filtered = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q)
      || p.email.toLowerCase().includes(q)
      || p.phone.toLowerCase().includes(q)
    );
  });

  return (
    <PermissionGuard
      anyPermissions={[
        PERMISSIONS.PATIENT_VIEW_LIMITED,
        PERMISSIONS.PATIENT_VIEW_ALL,
        PERMISSIONS.APPOINTMENT_VIEW_ALL,
      ]}
    >
      <div className="space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="text-teal-600" />
              Patients
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Registre administratif dérivé des rendez-vous — {patients.length} patient(s) identifié(s).
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">{error}</div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Chargement des patients...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
            <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Aucun patient trouvé</p>
            <p className="text-sm text-gray-500 mt-1">Les patients apparaissent après une première demande de rendez-vous.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Patient</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">RDV</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Dernière visite</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((patient) => (
                  <tr key={patient.id || patient.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{patient.name}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5 text-xs text-gray-600">
                        {patient.email && (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{patient.email}</span>
                        )}
                        {patient.phone && (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{patient.phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold bg-teal-50 text-teal-700 px-2 py-1 rounded-full">
                        {patient.appointmentCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(patient.lastAppointmentDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {patient.id ? (
                        <Link
                          to={`/hospital/patients/${patient.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800"
                        >
                          Détails <ChevronRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!hospitalId && !loading && !error && (
          <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-xl">Configurez d&apos;abord votre établissement.</p>
        )}
      </div>
    </PermissionGuard>
  );
}
