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

  const StatCard = ({ icon: Icon, title, value, subtitle, borderClass = 'border-accent' }) => (
    <div className={`bg-surface rounded-2xl border-2 ${borderClass} shadow-sm p-6 text-ink`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink mb-1">{title}</p>
          <p className="text-3xl font-extrabold text-ink">{value}</p>
          {subtitle && <p className="text-sm text-ink-muted mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-surface border-2 border-accent shrink-0">
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="p-8 text-ink font-semibold">Chargement du dashboard...</div>;

  return (
    <div className="space-y-6 pb-10 text-ink">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink flex items-center gap-2">
          <HeartPulse className="text-accent" />
          Dashboard Hôpital
        </h1>
        <p className="text-ink-muted text-base mt-1 font-medium">Vue d&apos;ensemble de l&apos;activité de votre établissement.</p>
      </div>

      {loadError && (
        <div className="rounded-xl border-2 border-alert bg-alert/10 text-ink px-4 py-3 text-sm font-medium">
          {loadError}
        </div>
      )}

      {!hospitalId && !loadError && (
        <div className="rounded-xl border-2 border-accent bg-primary/5 px-4 py-6 text-center text-ink font-medium">
          Aucun hôpital associé à votre compte.
        </div>
      )}

      {hospitalId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Stethoscope} title="Médecins" value={stats.totalDoctors} borderClass="border-accent" />
            <StatCard icon={Activity} title="Services" value={stats.totalServices} borderClass="border-alert" />
            <StatCard icon={Calendar} title="RDV aujourd'hui" value={stats.todayAppointments} borderClass="border-accent" />
            <StatCard icon={Clock} title="En attente" value={stats.pendingAppointments} borderClass="border-alert" />
            <StatCard icon={CheckCircle} title="Terminés (jour)" value={stats.completedAppointments} borderClass="border-accent" />
            <StatCard icon={Users} title="Patients (récents)" value={stats.totalPatients} borderClass="border-alert" />
            <StatCard icon={DollarSign} title="Revenus encaissés" value={formatCurrency(stats.totalRevenue)} borderClass="border-accent" />
            <StatCard icon={TrendingUp} title="Factures en attente" value={formatCurrency(stats.pendingRevenue)} borderClass="border-alert" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-2xl border-2 border-accent shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="font-extrabold text-ink text-lg">Rendez-vous récents</h2>
                <Link to="/hospital/appointments" className="text-sm font-bold text-primary hover:text-accent">
                  Voir tout
                </Link>
              </div>
              {recentAppointments.length === 0 ? (
                <p className="text-sm text-ink-muted font-medium">Aucun rendez-vous.</p>
              ) : (
                <ul className="space-y-3">
                  {recentAppointments.map((apt) => (
                    <li key={apt.id} className="flex items-start justify-between gap-3 text-sm border-b border-border pb-3 last:border-0">
                      <div>
                        <p className="font-bold text-ink text-base">{apt.patient_name || 'Patient'}</p>
                        <p className="text-ink-muted font-medium">{doctorLabel(apt)}</p>
                      </div>
                      <span className="text-xs font-bold text-ink whitespace-nowrap bg-primary/10 border border-accent px-2 py-1 rounded-lg">
                        {apt.status_display || apt.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface rounded-2xl border-2 border-alert shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="font-extrabold text-ink text-lg">Factures récentes</h2>
                <Link to="/hospital/invoices" className="text-sm font-bold text-primary hover:text-accent">
                  Voir tout
                </Link>
              </div>
              {recentInvoices.length === 0 ? (
                <p className="text-sm text-ink-muted font-medium">Aucune facture.</p>
              ) : (
                <ul className="space-y-3">
                  {recentInvoices.map((inv) => (
                    <li key={inv.id} className="flex items-start justify-between gap-3 text-sm border-b border-border pb-3 last:border-0">
                      <div>
                        <p className="font-bold text-ink text-base">{inv.patient_name || inv.invoice_number || 'Facture'}</p>
                        <p className="text-ink-muted font-medium">{inv.status}</p>
                      </div>
                      <span className="text-xs font-bold text-ink whitespace-nowrap">
                        {formatCurrency(inv.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-primary rounded-2xl p-6 text-surface border-2 border-accent">
            <h2 className="font-bold mb-3 text-surface text-lg">Accès rapide</h2>
            <div className="flex flex-wrap gap-3">
              <Link to="/hospital/appointments" className="flex items-center gap-2 bg-surface/15 hover:bg-surface/25 text-surface font-semibold p-3 rounded-xl transition border border-surface/40">
                <Calendar className="w-4 h-4" /> Rendez-vous
              </Link>
              <Link to="/hospital/doctors" className="flex items-center gap-2 bg-surface/15 hover:bg-surface/25 text-surface font-semibold p-3 rounded-xl transition border border-surface/40">
                <Stethoscope className="w-4 h-4" /> Médecins
              </Link>
              <Link to="/hospital/patients" className="flex items-center gap-2 bg-surface/15 hover:bg-surface/25 text-surface font-semibold p-3 rounded-xl transition border border-surface/40">
                <Users className="w-4 h-4" /> Patients
              </Link>
              <Link to="/hospital/services" className="flex items-center gap-2 bg-surface/15 hover:bg-surface/25 text-surface font-semibold p-3 rounded-xl transition border border-surface/40">
                <AlertCircle className="w-4 h-4" /> Services
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
