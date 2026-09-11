import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse, Users, Calendar, DollarSign, TrendingUp,
  Stethoscope, Clock, CheckCircle, AlertCircle, Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';
import { ApiError } from '../../shared/api';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

function doctorLabel(apt) {
  if (apt?.doctor_name) return `Dr. ${apt.doctor_name}`;
  const d = apt?.doctor_details;
  if (!d) return '—';
  if (d.full_name) return `Dr. ${d.full_name}`;
  const first = d.user_details?.first_name || '';
  const last = d.user_details?.last_name || '';
  const name = `${first} ${last}`.trim();
  return name ? `Dr. ${name}` : '—';
}

export default function HospitalDashboard() {
  const { token, isAuthenticated } = useAuth();
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalServices: 0,
    todayAppointments: 0,
    pendingAppointments: 0,
    completedAppointments: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    totalPatients: 0,
    activeMedicalRecords: 0
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated || !token) {
        setLoading(false);
        return;
      }
      setLoadError('');
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length === 0) {
          setHospitalId(null);
          setLoading(false);
          return;
        }
        const hid = list[0].id;
        setHospitalId(hid);
        await fetchDashboardData(hid);
      } catch (err) {
        console.error(err);
        setLoadError(err?.message || 'Impossible de charger le dashboard');
        setLoading(false);
      }
    };
    init();
  }, [token, isAuthenticated]);

  const fetchDashboardData = async (hid) => {
    try {
      const [docsRaw, svcRaw, aptStats, recentAptsRaw, invRaw, recRaw] = await Promise.all([
        hospitalService.getDoctors({ hospital: hid }),
        hospitalService.getServices(hid, true),
        hospitalService.getStats(hid),
        hospitalService.getAppointments({ hospital: hid, ordering: '-appointment_date', limit: '8' }),
        hospitalService.getInvoices(hid),
        hospitalService.getMedicalRecords(hid),
      ]);

      const doctors = normalizeList(docsRaw);
      const services = normalizeList(svcRaw);
      const appointments = normalizeList(recentAptsRaw).slice(0, 8);
      const invoices = normalizeList(invRaw);
      const records = normalizeList(recRaw);

      const totalRevenue = invoices
        .filter((inv) => inv.status === 'PAID')
        .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

      const pendingRevenue = invoices
        .filter((inv) => inv.status === 'PENDING')
        .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

      setStats({
        totalDoctors: doctors.length,
        totalServices: services.length,
        todayAppointments: aptStats?.today_total ?? 0,
        pendingAppointments: aptStats?.pending ?? aptStats?.pending_confirmations ?? 0,
        completedAppointments: aptStats?.completed_today ?? 0,
        totalRevenue,
        pendingRevenue,
        totalPatients: aptStats?.unique_patients ?? [...new Set(appointments.map((a) => a.patient))].length,
        activeMedicalRecords: records.length,
      });

      setRecentAppointments(appointments.slice(0, 5));
      setRecentInvoices(invoices.slice(0, 5));
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError && err.status === 401) {
        setLoadError('Session expirée — reconnectez-vous.');
      } else {
        setLoadError(err?.message || 'Erreur de chargement');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('fr-FR') + ' BIF';
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color }) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="p-8">Chargement du dashboard...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HeartPulse className="text-teal-600" />
          Dashboard Hôpital
        </h1>
        <p className="text-gray-500 text-sm mt-1">Vue d'ensemble de l'activité de votre établissement.</p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          {loadError}
        </div>
      )}

      {!hospitalId && !loadError && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-gray-600">
          Aucun hôpital associé à votre compte.
        </div>
      )}

      {hospitalId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Stethoscope}
              title="Médecins"
              value={stats.totalDoctors}
              color="bg-teal-50 text-teal-600"
            />
            <StatCard
              icon={Activity}
              title="Services"
              value={stats.totalServices}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={Calendar}
              title="RDV aujourd'hui"
              value={stats.todayAppointments}
              color="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              icon={Clock}
              title="En attente"
              value={stats.pendingAppointments}
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              icon={CheckCircle}
              title="Terminés (jour)"
              value={stats.completedAppointments}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              icon={Users}
              title="Patients (récents)"
              value={stats.totalPatients}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              icon={DollarSign}
              title="Revenus encaissés"
              value={formatCurrency(stats.totalRevenue)}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={TrendingUp}
              title="Factures en attente"
              value={formatCurrency(stats.pendingRevenue)}
              color="bg-rose-50 text-rose-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Rendez-vous récents</h2>
                <Link to="/hospital/appointments" className="text-sm text-teal-600 hover:underline">
                  Voir tout
                </Link>
              </div>
              {recentAppointments.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun rendez-vous.</p>
              ) : (
                <ul className="space-y-3">
                  {recentAppointments.map((apt) => (
                    <li key={apt.id} className="flex items-start justify-between gap-3 text-sm border-b border-gray-50 pb-3 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{apt.patient_name || 'Patient'}</p>
                        <p className="text-gray-500">{doctorLabel(apt)}</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {apt.status_display || apt.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Factures récentes</h2>
                <Link to="/hospital/invoices" className="text-sm text-teal-600 hover:underline">
                  Voir tout
                </Link>
              </div>
              {recentInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune facture.</p>
              ) : (
                <ul className="space-y-3">
                  {recentInvoices.map((inv) => (
                    <li key={inv.id} className="flex items-start justify-between gap-3 text-sm border-b border-gray-50 pb-3 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{inv.patient_name || inv.invoice_number || 'Facture'}</p>
                        <p className="text-gray-500">{inv.status}</p>
                      </div>
                      <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                        {formatCurrency(inv.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-teal-700 to-teal-600 rounded-2xl p-6 text-white">
            <h2 className="font-semibold mb-3">Accès rapide</h2>
            <div className="flex flex-wrap gap-3">
              <Link to="/hospital/appointments" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition">
                <Calendar className="w-4 h-4" /> Rendez-vous
              </Link>
              <Link to="/hospital/doctors" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition">
                <Stethoscope className="w-4 h-4" /> Médecins
              </Link>
              <Link to="/hospital/patients" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition">
                <Users className="w-4 h-4" /> Patients
              </Link>
              <Link to="/hospital/services" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 p-3 rounded-xl transition">
                <AlertCircle className="w-4 h-4" /> Services
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
