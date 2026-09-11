import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, CheckCircle2, XCircle, ChevronRight, Search, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospital/hospitalService';
import api from '../shared/api';

const STATUS_LABELS = APPOINTMENT_STATUS_LABELS;

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
};

export default function UserBookingsPage() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [appointments, setAppointments] = useState([]);
  const [serviceBookings, setServiceBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const [appts, bookings] = await Promise.all([
        hospitalService.getAppointments({}, true),
        api.get('bookings/', { auth: true }).catch(() => []),
      ]);
      setAppointments(Array.isArray(appts) ? appts : []);
      setServiceBookings(Array.isArray(bookings) ? bookings : []);
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
  const allItems = [
    ...appointments.map((a) => ({
      id: a.id,
      type: 'appointment',
      title: a.doctor_details?.user_details
        ? `${a.doctor_details.user_details.first_name} ${a.doctor_details.user_details.last_name}`
        : 'Consultation médicale',
      business: a.hospital_name,
      date: new Date(a.appointment_date),
      bookedAt: a.created_at ? new Date(a.created_at) : null,
      status: a.status,
      statusLabel: a.status_display || STATUS_LABELS[a.status],
      reason: a.reason,
      referenceCode: a.reference_code,
      queueNumber: a.queue_number,
      consultationType: a.consultation_type_display,
    })),
    ...serviceBookings.map((b) => ({
      id: b.id,
      type: 'booking',
      title: b.service_title || 'Réservation service',
      business: b.business_name,
      date: new Date(b.scheduled_date),
      status: b.status,
      statusLabel: b.status_display || b.status,
      reason: b.notes,
    })),
  ].sort((a, b) => b.date - a.date);

  const filtered = allItems.filter((item) => {
    const isUpcoming = item.date >= now && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(item.status);
    const isPast = item.date < now || ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(item.status);
    if (activeTab === 'upcoming' && !isUpcoming) return false;
    if (activeTab === 'past' && !isPast) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q) || (item.business || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mes rendez-vous</h1>
          <p className="text-gray-500 mt-1">Consultations médicales et réservations de services.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full md:w-64" />
          </div>
          <Link to="/hospital/book-appointment"
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg whitespace-nowrap">
            Nouveau RDV
          </Link>
        </div>
      </div>

      <div className="flex gap-4 border-b">
        {['upcoming', 'past', 'all'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium capitalize ${activeTab === tab ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-500'}`}>
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
            <div key={`${item.type}-${item.id}`}
              className="bg-white dark:bg-gray-800 border rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-4">
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                {item.type === 'appointment' ? <Stethoscope className="w-6 h-6 text-teal-600" /> : <Calendar className="w-6 h-6 text-teal-600" />}
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
                    <span>
                      <span className="text-gray-500">RDV : </span>
                      {item.date.toLocaleDateString('fr-FR')} à {item.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {item.bookedAt && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>
                        <span className="text-gray-500">Demande : </span>
                        {item.bookedAt.toLocaleDateString('fr-FR')} à {item.bookedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
                {item.reason && <p className="text-xs text-gray-500 mt-2">{item.reason}</p>}
                {item.referenceCode && (
                  <p className="text-xs font-mono text-teal-700 mt-2 font-semibold">
                    N° suivi : {item.referenceCode}
                    {item.queueNumber ? ` · Ordre #${item.queueNumber}` : ''}
                  </p>
                )}
                {item.type === 'appointment' && ['PENDING', 'CONFIRMED'].includes(item.status) && item.date >= now && (
                  <div className="mt-4 pt-4 border-t">
                    <button onClick={() => handleCancelAppointment(item.id)}
                      className="text-sm text-red-600 hover:underline">
                      Annuler le rendez-vous
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">Aucun rendez-vous</h3>
          <p className="text-gray-500 mb-4">Prenez votre premier rendez-vous médical.</p>
          <Link to="/hospital/book-appointment" className="text-teal-600 font-semibold hover:underline">
            Réserver maintenant →
          </Link>
        </div>
      )}
    </div>
  );
}
