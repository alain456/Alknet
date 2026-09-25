import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, CheckCircle2, XCircle, ChevronRight, Search, Stethoscope, BedDouble } from 'lucide-react';
import { Link } from 'react-router-dom';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospital/hospitalService';
import hotelService from '../hotel/hotelService';
import api from '../shared/api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = APPOINTMENT_STATUS_LABELS;

const HOTEL_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  EXPECTED: 'Arrivée prévue',
  CHECKED_IN: 'En séjour',
  CHECKED_OUT: 'Terminée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'No-show',
  EXPIRED: 'Expirée',
};

const STATUS_STYLE = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-orange-100 text-orange-700',
  REQUEST_SENT: 'bg-sky-100 text-sky-700',
  PATIENT_ARRIVED: 'bg-emerald-100 text-emerald-700',
  WAITING_ROOM: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-gray-100 text-gray-700',
  RESCHEDULED: 'bg-orange-100 text-orange-700',
  EXPECTED: 'bg-sky-100 text-sky-700',
  CHECKED_IN: 'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-gray-100 text-gray-700',
};

export default function UserBookingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [appointments, setAppointments] = useState([]);
  const [serviceBookings, setServiceBookings] = useState([]);
  const [hotelReservations, setHotelReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const normalize = (data) => (Array.isArray(data) ? data : (data?.results || []));
      const [appts, bookings, orders, hotels] = await Promise.all([
        hospitalService.getAppointments({}).catch(() => []),
        api.get('bookings/', { auth: true }).catch(() => []),
        api.get('orders/', { auth: true }).catch(() => []),
        hotelService.myReservations().catch(() => []),
      ]);
      setAppointments(normalize(appts));
      setHotelReservations(normalize(hotels));
      setServiceBookings([
        ...normalize(bookings).map((b) => ({ ...b, _kind: 'booking' })),
        ...normalize(orders).map((o) => ({
          id: o.id,
          _kind: 'order',
          service_title: o.reference_code || o.reference || 'Commande',
          business_name: o.business_name || '',
          business: o.business,
          scheduled_date: o.created_at,
          status: o.status,
          status_display: o.status_display || o.status,
          notes: o.guest_name || o.contact_phone || '',
        })),
      ]);
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Annuler ce rendez-vous ?')) return;
    try {
      await hospitalService.cancelAppointment(id);
      await loadBookings();
    } catch (err) {
      alert(err.message || 'Impossible d\'annuler');
    }
  };

  const now = new Date();
  const hotelPastStatuses = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'EXPIRED'];
  const allItems = [
    ...appointments.map((a) => ({
      id: a.id,
      type: 'appointment',
      title: a.doctor_details?.user_details
        ? `${a.doctor_details.user_details.first_name} ${a.doctor_details.user_details.last_name}`
        : (a.service_name || 'Consultation médicale'),
      business: a.hospital_name,
      historyHref: a.hospital ? `/hospitals/${a.hospital}/historique` : null,
      date: new Date(a.appointment_date),
      status: a.status,
      statusLabel: a.status_display || STATUS_LABELS[a.status],
      reason: a.reason,
      referenceCode: a.reference_code,
    })),
    ...hotelReservations.map((r) => ({
      id: r.id,
      type: 'hotel',
      title: `${r.room_type_name || 'Chambre'} · ${r.reference}`,
      business: r.hotel_name,
      historyHref: r.hotel_id ? `/hotels/${r.hotel_id}/historique` : '/businesses',
      date: new Date(r.check_in_date),
      endDate: r.check_out_date,
      status: r.status,
      statusLabel: HOTEL_STATUS_LABELS[r.status] || r.status,
      reason: r.special_requests,
      referenceCode: r.reference,
      totalAmount: r.total_amount,
      nights: r.nights,
    })),
    ...serviceBookings.map((b) => ({
      id: b.id,
      type: b._kind === 'order' ? 'order' : 'booking',
      title: b.service_title || 'Réservation service',
      business: b.business_name,
      historyHref: b.business ? `/businesses/${b.business}/historique` : null,
      date: new Date(b.scheduled_date),
      status: b.status,
      statusLabel: b.status_display || b.status,
      reason: b.notes,
    })),
  ].sort((a, b) => b.date - a.date);

  const filtered = allItems.filter((item) => {
    const hotelPast = item.type === 'hotel' && hotelPastStatuses.includes(item.status);
    const genericPast = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(item.status);
    const isPast = item.date < now || genericPast || hotelPast;
    const isUpcoming = !isPast;
    if (activeTab === 'upcoming' && !isUpcoming) return false;
    if (activeTab === 'past' && !isPast) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q)
        || (item.business || '').toLowerCase().includes(q)
        || (item.referenceCode || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon historique</h1>
          <p className="text-gray-500 mt-1">Rendez-vous, hôtels, réservations et commandes.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full md:w-64"
            />
          </div>
          <Link
            to="/businesses"
            className="px-4 py-2 bg-primary text-surface text-sm font-bold rounded-lg border-2 border-accent whitespace-nowrap"
          >
            Voir les établissements
          </Link>
          <Link
            to="/hospital/book-appointment"
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg whitespace-nowrap"
          >
            Nouveau RDV
          </Link>
        </div>
      </div>

      <div className="flex gap-4 border-b">
        {['upcoming', 'past', 'all'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium capitalize ${activeTab === tab ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500'}`}
          >
            {tab === 'upcoming' ? 'À venir' : tab === 'past' ? 'Passés' : 'Tous'}
          </button>
        ))}
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-20 text-gray-500">Chargement...</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-white dark:bg-gray-800 border rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-4"
            >
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                {item.type === 'appointment' ? (
                  <Stethoscope className="w-6 h-6 text-teal-600" />
                ) : item.type === 'hotel' ? (
                  <BedDouble className="w-6 h-6 text-primary" />
                ) : (
                  <Calendar className="w-6 h-6 text-teal-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-lg font-bold">{item.title}</h2>
                    <p className="text-sm text-gray-500">{item.business}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-600'}`}>
                    {item.statusLabel}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0" />
                    {item.type === 'hotel'
                      ? `Arrivée ${item.date.toLocaleDateString('fr-FR')}${item.endDate ? ` → ${new Date(item.endDate).toLocaleDateString('fr-FR')}` : ''}`
                      : item.date.toLocaleString('fr-FR')}
                  </div>
                  {item.referenceCode && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Réf. {item.referenceCode}
                    </div>
                  )}
                  {item.type === 'hotel' && item.totalAmount && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      {item.nights || 1} nuit(s) · {Number(item.totalAmount).toLocaleString()} BIF
                    </div>
                  )}
                  {item.reason && (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {item.reason}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.historyHref && (
                    <Link to={item.historyHref} className="text-sm font-bold text-primary inline-flex items-center gap-1">
                      {item.type === 'hotel' ? "Voir l'hôtel" : 'Détails'} <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                  {item.type === 'appointment' && ['PENDING', 'CONFIRMED', 'REQUEST_SENT'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => handleCancelAppointment(item.id)}
                      className="text-sm font-bold text-red-600 inline-flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" /> Annuler
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500 space-y-3">
          <p>Aucune réservation pour le moment.</p>
          {user && (
            <Link to="/businesses" className="inline-block text-primary font-bold">
              Parcourir les entreprises →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
