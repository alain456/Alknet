import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Stethoscope, Video, MapPin, Filter, Search, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageAppointments() {
  const { token , authFetch} = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const busRes = await authFetch('http://localhost:8000/api/v1/businesses/me/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (busRes.ok) {
          const businesses = await busRes.json();
          if (businesses.length > 0) {
            const hid = businesses[0].id;
            setHospitalId(hid);
            fetchAppointments(hid);
            fetchDoctors(hid);
          } else {
            // Fallback for Super Admin or admin without direct ownership
            const allBusRes = await authFetch('http://localhost:8000/api/v1/businesses/');
            if (allBusRes.ok) {
              const allBus = await allBusRes.json();
              const list = Array.isArray(allBus) ? allBus : (allBus.results || []);
              if (list.length > 0) {
                const hid = list[0].id;
                setHospitalId(hid);
                fetchAppointments(hid);
                fetchDoctors(hid);
                return;
              }
            }
            setLoading(false);
          }
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    if (token) init();
  }, [token]);

  const fetchAppointments = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/appointments/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAppointments(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/doctors/?hospital=${hid}`);
      if (res.ok) {
        setDoctors(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/appointments/${appointmentId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchAppointments(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3" /> En attente</span>;
      case 'CONFIRMED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><CheckCircle className="w-3 h-3" /> Confirmé</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Terminé</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Annulé</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'IN_PERSON':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700"><MapPin className="w-3 h-3" /> Présentiel</span>;
      case 'TELEMEDICINE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700"><Video className="w-3 h-3" /> Téléconsultation</span>;
      default:
        return null;
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const matchesStatus = filterStatus === 'ALL' || apt.status === filterStatus;
    const matchesType = filterType === 'ALL' || apt.consultation_type === filterType;
    const matchesSearch = apt.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          apt.doctor_details?.user_details?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          apt.doctor_details?.user_details?.last_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-teal-600" />
            Gestion des Rendez-vous
          </h1>
          <p className="text-gray-500 text-sm mt-1">Consultez et gérez tous les rendez-vous de votre hôpital.</p>
        </div>
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                <span className="text-sm font-medium text-gray-600">Statut:</span>
                {['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      filterStatus === status
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'ALL' ? 'Tous' : status === 'PENDING' ? 'En attente' : status === 'CONFIRMED' ? 'Confirmé' : status === 'COMPLETED' ? 'Terminé' : 'Annulé'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                <span className="text-sm font-medium text-gray-600">Type:</span>
                {['ALL', 'IN_PERSON', 'TELEMEDICINE'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      filterType === type
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'ALL' ? 'Tous' : type === 'IN_PERSON' ? 'Présentiel' : 'Téléconsultation'}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher patient ou médecin..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Médecin</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Date & Heure</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Statut</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        Aucun rendez-vous trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map(apt => (
                      <tr key={apt.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
                              {apt.patient_name?.[0] || 'P'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{apt.patient_name}</p>
                              <p className="text-xs text-gray-500">ID: {apt.patient?.substring(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-teal-600" />
                            <span className="text-sm text-gray-900">
                              Dr. {apt.doctor_details?.user_details?.first_name} {apt.doctor_details?.user_details?.last_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {formatDate(apt.appointment_date)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getTypeBadge(apt.consultation_type)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(apt.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {apt.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(apt.id, 'CONFIRMED')}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                  title="Confirmer"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(apt.id, 'CANCELLED')}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Annuler"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {apt.status === 'CONFIRMED' && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                  title="Marquer terminé"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(apt.id, 'CANCELLED')}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Annuler"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
