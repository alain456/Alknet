import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, Stethoscope } from 'lucide-react';
import DataGrid from '../admin/components/DataGrid';
import api from '../shared/api';
import hospitalService from '../hospital/hospitalService';

const STATUS_MAP = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

export default function BusinessBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('hospital');

  useEffect(() => {
    loadBookings();
  }, [tab]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      if (tab === 'hospital') {
        const appts = await hospitalService.getAppointments({}, true);
        setBookings(
          (appts || []).map((a) => ({
            id: a.id,
            customer: a.patient_name,
            service: a.doctor_details?.specialties?.[0]?.name || 'Consultation',
            date: a.appointment_date?.split('T')[0],
            time: a.appointment_date?.split('T')[1]?.slice(0, 5),
            status: STATUS_MAP[a.status] || a.status,
            rawStatus: a.status,
          }))
        );
      } else {
        const data = await api.get('bookings/', { auth: true });
        setBookings(
          (data || []).map((b) => ({
            id: b.id,
            customer: b.customer_name,
            service: b.service_title || 'Service',
            date: b.scheduled_date?.split('T')[0],
            time: b.scheduled_date?.split('T')[1]?.slice(0, 5),
            status: STATUS_MAP[b.status] || b.status,
            rawStatus: b.status,
          }))
        );
      }
    } catch (err) {
      console.error(err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      if (tab === 'hospital') {
        await hospitalService.confirmAppointment(id);
      } else {
        await api.post(`bookings/${id}/confirm/`, {}, { auth: true });
      }
      loadBookings();
    } catch (err) {
      alert(err.message || 'Erreur');
    }
  };

  const columns = [
    {
      key: 'service',
      label: tab === 'hospital' ? 'Consultation' : 'Service',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{val}</div>
          <div className="text-xs text-gray-500">ID: {String(row.id).slice(0, 8)}</div>
        </div>
      ),
    },
    { key: 'customer', label: 'Patient / Client' },
    {
      key: 'date',
      label: 'Date & Heure',
      render: (val, row) => (
        <div>
          <div className="text-sm font-medium">{val}</div>
          <div className="text-xs text-gray-500">{row.time}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: (val) => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
          val === 'Confirmé' ? 'bg-green-100 text-green-700'
            : val === 'En attente' ? 'bg-orange-100 text-orange-700'
            : val === 'Terminé' ? 'bg-blue-100 text-blue-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) =>
        row.rawStatus === 'PENDING' ? (
          <button onClick={() => handleConfirm(row.id)}
            className="text-xs text-teal-600 font-semibold hover:underline">
            Confirmer
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Réservations</h1>
          <p className="text-gray-500 text-sm mt-1">Rendez-vous médicaux et réservations de services.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('hospital')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${tab === 'hospital' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          <Stethoscope className="w-4 h-4" /> Rendez-vous médicaux
        </button>
        <button onClick={() => setTab('services')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${tab === 'services' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          <Calendar className="w-4 h-4" /> Services
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : (
        <DataGrid columns={columns} data={bookings} emptyMessage="Aucune réservation." />
      )}
    </div>
  );
}
