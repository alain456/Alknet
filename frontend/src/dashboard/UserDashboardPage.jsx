import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Calendar, ShoppingBag, MessageSquare, Heart,
  MapPin, Star, ArrowRight, CheckCircle2, Clock,
  Compass, BedDouble, Stethoscope,
} from 'lucide-react';
import hospitalService from '../hospital/hospitalService';
import hotelService from '../hotel/hotelService';
import api from '../shared/api';

const normalize = (data) => (Array.isArray(data) ? data : (data?.results || []));

const ACTIVE_HOTEL = new Set(['PENDING', 'CONFIRMED', 'EXPECTED', 'CHECKED_IN']);
const ACTIVE_APPT = new Set([
  'PENDING', 'CONFIRMED', 'REQUEST_SENT', 'PATIENT_ARRIVED',
  'WAITING_ROOM', 'IN_PROGRESS', 'RESCHEDULED',
]);
const PENDING_ORDER = new Set(['PENDING', 'AWAITING_PIN', 'UNPAID', 'PROCESSING', 'CONFIRMED']);

function formatWhen(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 16);
  return d.toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function UserDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'Invité';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [appts, hotelRes, orderRes, bookingRes, notifs] = await Promise.all([
          hospitalService.getAppointments({}).catch(() => []),
          hotelService.myReservations().catch(() => []),
          api.get('orders/', { auth: true }).catch(() => []),
          api.get('bookings/', { auth: true }).catch(() => []),
          api.get('hospital/notifications/', { auth: true }).catch(() => []),
        ]);
        if (cancelled) return;
        setAppointments(normalize(appts));
        setHotels(normalize(hotelRes));
        setOrders(normalize(orderRes));
        setBookings(normalize(bookingRes));
        setUnread(normalize(notifs).filter((n) => !n.is_read).length);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Impossible de charger le tableau de bord.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const upcoming = useMemo(() => {
    const items = [];
    appointments.forEach((a) => {
      if (!ACTIVE_APPT.has(a.status)) return;
      items.push({
        id: `apt-${a.id}`,
        kind: 'hospital',
        title: a.service_name || a.doctor_name || 'Consultation',
        business: a.hospital_name || a.business_name || 'Hôpital',
        when: a.scheduled_date || a.appointment_date || a.created_at,
        status: a.status_display || a.status,
        location: a.hospital_name || '',
        href: '/dashboard/bookings',
      });
    });
    hotels.forEach((r) => {
      if (!ACTIVE_HOTEL.has(r.status)) return;
      items.push({
        id: `hot-${r.id}`,
        kind: 'hotel',
        title: r.room_type_name || r.reference || 'Réservation hôtel',
        business: r.hotel_name || 'Hôtel',
        when: r.check_in_date,
        status: r.status_display || r.status,
        location: r.hotel_city || '',
        href: r.hotel ? `/hotels/${r.hotel}` : '/dashboard/bookings',
      });
    });
    bookings.forEach((b) => {
      if (['CANCELLED', 'COMPLETED', 'REJECTED'].includes(b.status)) return;
      items.push({
        id: `bk-${b.id}`,
        kind: 'service',
        title: b.service_title || b.service_name || 'Réservation',
        business: b.business_name || '',
        when: b.scheduled_date || b.created_at,
        status: b.status_display || b.status,
        location: '',
        href: '/dashboard/bookings',
      });
    });
    items.sort((a, b) => new Date(a.when || 0) - new Date(b.when || 0));
    return items.slice(0, 6);
  }, [appointments, hotels, bookings]);

  const activeBookings = upcoming.length;
  const pendingOrders = orders.filter((o) => PENDING_ORDER.has(o.status)).length;

  const stats = [
    {
      label: 'Réservations actives',
      value: loading ? '…' : String(activeBookings),
      icon: Calendar,
      color: 'text-primary',
      bg: 'bg-primary/10',
      to: '/dashboard/bookings',
    },
    {
      label: 'Commandes en cours',
      value: loading ? '…' : String(pendingOrders),
      icon: ShoppingBag,
      color: 'text-accent',
      bg: 'bg-accent/10',
      to: '/dashboard/orders',
    },
    {
      label: 'Notifications',
      value: loading ? '…' : String(unread),
      icon: MessageSquare,
      color: 'text-alert',
      bg: 'bg-alert/10',
      to: '/dashboard/notifications',
    },
    {
      label: 'Favoris',
      value: '—',
      icon: Heart,
      color: 'text-rose-600',
      bg: 'bg-rose-100 dark:bg-rose-900/30',
      to: '/dashboard/favorites',
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="relative rounded-2xl bg-primary overflow-hidden shadow-lg border border-primary/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full mix-blend-overlay filter blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="relative z-10 px-8 py-10 md:py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-white text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              Bonjour, {firstName} !
            </h1>
            <p className="text-white/90 text-lg max-w-xl">
              Gérez vos réservations hôtel / santé, commandes et notifications sur Isoko Hub.
            </p>
          </div>
          <Link
            to="/services"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-95 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition"
          >
            <Compass className="w-5 h-5" />
            Explorer les services
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-alert/10 text-alert text-sm border border-alert/30">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow block"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</h3>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Prochaines réservations</h2>
            <Link to="/dashboard/bookings" className="text-sm font-semibold text-primary dark:text-teal-400 flex items-center gap-1">
              Tout voir <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : !upcoming.length ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-dashed border-gray-200 dark:border-gray-700 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Aucune réservation à venir.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/hotels" className="text-sm font-bold text-primary hover:underline">Hôtels</Link>
                <span className="text-gray-300">·</span>
                <Link to="/hospitals" className="text-sm font-bold text-primary hover:underline">Hôpitaux</Link>
                <span className="text-gray-300">·</span>
                <Link to="/services" className="text-sm font-bold text-primary hover:underline">Services</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcoming.map((booking) => (
                <Link
                  key={booking.id}
                  to={booking.href}
                  className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary/50 transition-colors block"
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 line-clamp-1 flex items-center gap-1.5">
                        {booking.kind === 'hotel' ? <BedDouble className="w-4 h-4 text-primary shrink-0" /> : null}
                        {booking.kind === 'hospital' ? <Stethoscope className="w-4 h-4 text-primary shrink-0" /> : null}
                        <span className="truncate">{booking.title}</span>
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-accent fill-accent shrink-0" />
                        {booking.business}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary dark:bg-primary/20 shrink-0">
                      {booking.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <p className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-ink-faint" />
                      {formatWhen(booking.when)}
                    </p>
                    {booking.location ? (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-ink-faint" />
                        {booking.location}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Accès rapide</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
            {[
              { to: '/dashboard/bookings', label: 'Mes réservations', icon: CheckCircle2 },
              { to: '/dashboard/lab-results', label: 'Résultats labo', icon: Stethoscope },
              { to: '/dashboard/orders', label: 'Mes commandes', icon: ShoppingBag },
              { to: '/dashboard/notifications', label: 'Notifications', icon: MessageSquare },
              { to: '/hotels', label: 'Réserver un hôtel', icon: BedDouble },
              { to: '/hospitals', label: 'Prendre RDV', icon: Stethoscope },
            ].map((row) => (
              <Link
                key={row.to}
                to={row.to}
                className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-ink hover:bg-primary/5 transition"
              >
                <row.icon className="w-4 h-4 text-primary" />
                <span className="flex-1">{row.label}</span>
                <ArrowRight className="w-4 h-4 text-ink-faint" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
