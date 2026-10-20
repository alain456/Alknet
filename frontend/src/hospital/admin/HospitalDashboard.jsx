import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, DollarSign, Stethoscope, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';
import { ApiError } from '../../shared/api';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const SLICE_COLORS = ['#32667F', '#EA8B33', '#132F45', '#8AA8B8', '#F3B940', '#E1302A'];

function monthCounts(appointments, year) {
  const counts = Array(12).fill(0);
  appointments.forEach((apt) => {
    if (!apt.appointment_date) return;
    const date = new Date(apt.appointment_date);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return;
    counts[date.getMonth()] += 1;
  });
  return counts;
}

function serviceSlices(appointments) {
  const totals = new Map();
  appointments.forEach((apt) => {
    const name = apt.service_name || 'Sans service';
    totals.set(name, (totals.get(name) || 0) + 1);
  });
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((sum, [, count]) => sum + count, 0);
  const slices = top.map(([label, value], index) => ({
    label,
    value,
    color: SLICE_COLORS[index],
  }));
  if (rest > 0) slices.push({ label: 'Autres', value: rest, color: SLICE_COLORS[5] });
  return slices;
}

function ServiceDonut({ slices }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-40 h-40 shrink-0" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#F5F5F5" strokeWidth="16" />
        {total > 0 && slices.map((slice) => {
          const length = (slice.value / total) * circumference;
          const circle = (
            <circle
              key={slice.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += length;
          return circle;
        })}
        <circle cx="60" cy="60" r="28" fill="#FFFFFF" />
        <text x="60" y="64" textAnchor="middle" fill="#132F45" fontSize="16" fontWeight="700">{total}</text>
      </svg>
      <ul className="space-y-2 text-sm min-w-0">
        {slices.length === 0 && <li className="text-ink-muted">Aucun rendez-vous.</li>}
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-ink truncate">{slice.label}</span>
            <span className="text-ink-muted ml-auto pl-3">
              {slice.value} · {total ? Math.round((slice.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const [chartAppointments, setChartAppointments] = useState([]);
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
        hospitalService.getAppointments({ hospital: hid, ordering: '-appointment_date', limit: '200' }),
        hospitalService.getInvoices(hid),
        hospitalService.getMedicalRecords(hid),
      ]);

      const doctors = normalizeList(docsRaw);
      const services = normalizeList(svcRaw);
      const appointments = normalizeList(recentAptsRaw);
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
      setChartAppointments(appointments);
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

  const chartYear = new Date().getFullYear();
  const bars = useMemo(() => monthCounts(chartAppointments, chartYear), [chartAppointments, chartYear]);
  const slices = useMemo(() => serviceSlices(chartAppointments), [chartAppointments]);
  const barMax = Math.max(1, ...bars);

  const highlights = [
    { icon: Calendar, label: "RDV aujourd'hui", value: stats.todayAppointments },
    { icon: Clock, label: 'En attente', value: stats.pendingAppointments },
    { icon: Stethoscope, label: 'Médecins', value: stats.totalDoctors },
    { icon: DollarSign, label: 'Factures en attente', value: formatCurrency(stats.pendingRevenue) },
  ];
  const secondary = [
    { label: 'Services', value: stats.totalServices },
    { label: 'Terminés (jour)', value: stats.completedAppointments },
    { label: 'Patients', value: stats.totalPatients },
    { label: 'Revenus encaissés', value: formatCurrency(stats.totalRevenue) },
  ];

  if (loading) return <div className="p-8 text-ink font-semibold">Chargement du dashboard...</div>;

  return (
    <div className="space-y-8 pb-10 text-ink">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">Tableau de bord</h1>
          <p className="text-ink-muted text-sm mt-1">Vue d&apos;ensemble de l&apos;activité de votre établissement.</p>
        </div>
        {hospitalId && (
          <div className="flex flex-wrap gap-2">
            <Link to="/hospital/appointments" className="px-4 py-2 rounded-full bg-white border border-border text-sm font-bold text-ink">Rendez-vous</Link>
            <Link to="/hospital/doctors" className="px-4 py-2 rounded-full bg-white border border-border text-sm font-bold text-ink">Médecins</Link>
            <Link to="/hospital/patients" className="px-4 py-2 rounded-full bg-white border border-border text-sm font-bold text-ink">Patients</Link>
            <Link to="/hospital/services" className="px-4 py-2 rounded-full bg-white border border-border text-sm font-bold text-ink">Services</Link>
          </div>
        )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {highlights.map((item) => (
              <article key={item.label} className="rounded-3xl bg-white p-5 shadow-sm">
                <item.icon className="w-5 h-5 text-accent" />
                <p className="mt-4 text-sm text-ink-muted">{item.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-ink break-words">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="font-extrabold text-ink text-lg">Rendez-vous par mois</h2>
              <p className="text-xs text-ink-muted mt-1">{chartYear}</p>
              <div className="mt-6 flex items-end gap-2 h-40">
                {bars.map((count, index) => (
                  <div key={MONTHS[index]} className="flex-1 flex flex-col items-center gap-2 h-full">
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className="w-full rounded-t-md"
                        style={{
                          height: `${Math.max(count ? 8 : 0, (count / barMax) * 100)}%`,
                          backgroundColor: index === new Date().getMonth() ? '#EA8B33' : '#32667F',
                        }}
                        title={`${MONTHS[index]} : ${count}`}
                      />
                    </div>
                    <span className="text-[10px] text-ink-muted">{MONTHS[index]}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="font-extrabold text-ink text-lg">Rendez-vous par service</h2>
              <p className="text-xs text-ink-muted mt-1">Répartition des rendez-vous enregistrés</p>
              <div className="mt-6">
                <ServiceDonut slices={slices} />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {secondary.map((item) => (
              <div key={item.label} className="rounded-3xl bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-ink-muted">{item.label}</p>
                <p className="mt-1 text-lg font-extrabold text-ink break-words">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="font-extrabold text-ink text-lg">Rendez-vous récents</h2>
                <Link to="/hospital/appointments" className="text-sm font-bold text-ink underline underline-offset-2">
                  Voir tout
                </Link>
              </div>
              {recentAppointments.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucun rendez-vous.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentAppointments.map((apt) => (
                    <li key={apt.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{apt.patient_name || 'Patient'}</p>
                        <p className="text-ink-muted">{doctorLabel(apt)}</p>
                        {apt.appointment_date && (
                          <p className="text-xs text-ink-muted mt-0.5">{apt.appointment_date}</p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-ink whitespace-nowrap bg-surface px-2 py-1 rounded-full">
                        {apt.status_display || apt.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="font-extrabold text-ink text-lg">Factures récentes</h2>
                <Link to="/hospital/billing" className="text-sm font-bold text-ink underline underline-offset-2">
                  Voir tout
                </Link>
              </div>
              {recentInvoices.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucune facture.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentInvoices.map((inv) => (
                    <li key={inv.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{inv.patient_name || inv.invoice_number || 'Facture'}</p>
                        <p className="text-ink-muted">{inv.status_display || inv.status}</p>
                      </div>
                      <span className="text-sm font-bold text-ink whitespace-nowrap">
                        {formatCurrency(inv.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
