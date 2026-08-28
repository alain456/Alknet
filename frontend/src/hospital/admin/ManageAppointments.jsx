import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Stethoscope, Video, MapPin, Filter, Search, CheckCircle, XCircle, AlertCircle, Plus, Users, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ManageAppointments() {
  const { token, authFetch } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('slots'); // 'slots' or 'appointments'
  
  // Filters & Search
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSlotId, setExpandedSlotId] = useState(null);

  // Modal creation slot
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [submittingSlot, setSubmittingSlot] = useState(false);
  const [slotFormData, setSlotFormData] = useState({
    doctor: '',
    service: '',
    title: 'Consultation Générale',
    slot_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '12:00',
    consultation_type: 'IN_PERSON',
    max_patients: 10,
    notes: ''
  });

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
            fetchSlots(hid);
            fetchDoctors(hid);
            fetchServices(hid);
          } else {
            const allBusRes = await authFetch('http://localhost:8000/api/v1/businesses/');
            if (allBusRes.ok) {
              const allBus = await allBusRes.json();
              const list = Array.isArray(allBus) ? allBus : (allBus.results || []);
              if (list.length > 0) {
                const hid = list[0].id;
                setHospitalId(hid);
                fetchAppointments(hid);
                fetchSlots(hid);
                fetchDoctors(hid);
                fetchServices(hid);
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

  const fetchSlots = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/appointment-slots/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSlots(await res.json());
      }
    } catch (err) {
      console.error(err);
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

  const fetchServices = async (hid) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/services/?hospital=${hid}`);
      if (res.ok) {
        setServices(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!slotFormData.doctor) {
      alert('Veuillez sélectionner un médecin');
      return;
    }
    setSubmittingSlot(true);
    try {
      const payload = {
        ...slotFormData,
        hospital: hospitalId,
        service: slotFormData.service || null
      };
      const res = await authFetch('http://localhost:8000/api/v1/hospital/appointment-slots/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsSlotModalOpen(false);
        fetchSlots(hospitalId);
        setSlotFormData({
          doctor: '',
          service: '',
          title: 'Consultation Générale',
          slot_date: new Date().toISOString().split('T')[0],
          start_time: '08:00',
          end_time: '12:00',
          consultation_type: 'IN_PERSON',
          max_patients: 10,
          notes: ''
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Erreur de création: ${JSON.stringify(errData)}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la création de la session');
    } finally {
      setSubmittingSlot(false);
    }
  };

  const handleToggleSlotStatus = async (slotId, currentStatus) => {
    try {
      const res = await authFetch(`http://localhost:8000/api/v1/hospital/appointment-slots/${slotId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        fetchSlots(hospitalId);
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
        fetchSlots(hospitalId);
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
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (loading) return <div className="p-8 flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
  </div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-teal-600" />
            Gestion des Rendez-vous & Capacités
          </h1>
          <p className="text-gray-500 text-sm mt-1">Définissez les créneaux, limites de places et suivez les postulations en temps réel.</p>
        </div>

        {hospitalId && (
          <button
            onClick={() => setIsSlotModalOpen(true)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow border border-teal-500 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Créer un Créneau / Session
          </button>
        )}
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          {/* Navigation par Onglets */}
          <div className="flex border-b border-gray-200 gap-6">
            <button
              onClick={() => setActiveTab('slots')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
                activeTab === 'slots'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers className="w-4 h-4" />
              Sessions & Capacités de RDV ({slots.length})
            </button>

            <button
              onClick={() => setActiveTab('appointments')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
                activeTab === 'appointments'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Liste Globale des Postulants ({appointments.length})
            </button>
          </div>

          {/* TAB 1: CRENEAUX & SESSIONS */}
          {activeTab === 'slots' && (
            <div className="space-y-4">
              {slots.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700">Aucun créneau de rendez-vous défini pour le moment.</p>
                  <p className="text-xs text-gray-400 mt-1">Cliquez sur "Créer un Créneau / Session" pour offrir des plages d'inscription aux patients.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {slots.map(slot => {
                    const postulants = appointments.filter(a => a.slot === slot.id);
                    const isExpanded = expandedSlotId === slot.id;
                    const percentBooked = Math.min(100, Math.round((slot.booked_count / slot.max_patients) * 100));

                    return (
                      <div key={slot.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:border-teal-300 transition">
                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                {slot.consultation_type === 'TELEMEDICINE' ? 'Téléconsultation' : 'Présentiel'}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                slot.remaining_slots === 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {slot.remaining_slots === 0 ? 'Complet' : `${slot.remaining_slots} places restantes`}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{slot.title}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                              <span className="flex items-center gap-1 font-medium text-teal-700">
                                <Stethoscope className="w-3.5 h-3.5" />
                                Dr. {slot.doctor_name} ({slot.doctor_title || 'Médecin'})
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                {formatDate(slot.slot_date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                {slot.start_time?.substring(0,5)} - {slot.end_time?.substring(0,5)}
                              </span>
                            </div>
                          </div>

                          {/* Capacité & Jauge */}
                          <div className="md:w-64 bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <div className="flex justify-between items-center text-xs font-bold mb-1">
                              <span className="text-gray-600">Capacité définie:</span>
                              <span className="text-teal-700">{slot.booked_count} / {slot.max_patients} Patients</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  percentBooked >= 100 ? 'bg-red-500' : percentBooked >= 80 ? 'bg-yellow-500' : 'bg-teal-600'
                                }`}
                                style={{ width: `${percentBooked}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                              <span>Inscrits: {slot.booked_count}</span>
                              <span>Reste: {slot.remaining_slots}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start md:self-center">
                            <button
                              onClick={() => handleToggleSlotStatus(slot.id, slot.is_active)}
                              className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition cursor-pointer ${
                                slot.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title="Activer/Désactiver la visibilité côté patient"
                            >
                              {slot.is_active ? 'Actif' : 'Inactif'}
                            </button>
                            <button
                              onClick={() => setExpandedSlotId(isExpanded ? null : slot.id)}
                              className="px-3 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {isExpanded ? 'Masquer postulants' : `Voir postulants (${postulants.length})`}
                            </button>
                          </div>
                        </div>

                        {/* Liste déroulante des postulants dans l'ordre d'arrivée */}
                        {isExpanded && (
                          <div className="bg-gray-50 border-t border-gray-200 p-4 space-y-3">
                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                              Ordre d'arrivée des postulants pour cette session:
                            </h4>
                            {postulants.length === 0 ? (
                              <p className="text-xs text-gray-500 italic">Aucun patient n'a encore postulé à ce créneau.</p>
                            ) : (
                              <div className="space-y-2">
                                {postulants.sort((a,b) => (a.queue_number || 0) - (b.queue_number || 0)).map((apt) => (
                                  <div key={apt.id} className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                      <span className="w-7 h-7 rounded-full bg-teal-600 text-white font-extrabold flex items-center justify-center text-xs shadow-sm">
                                        #{apt.queue_number || '?'}
                                      </span>
                                      <div>
                                        <p className="font-bold text-gray-900">{apt.patient_name}</p>
                                        <p className="text-[11px] text-gray-400">Motif: {apt.reason || 'Non précisé'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {getStatusBadge(apt.status)}
                                      <div className="flex items-center gap-1">
                                        {apt.status === 'PENDING' && (
                                          <button
                                            onClick={() => handleStatusChange(apt.id, 'CONFIRMED')}
                                            className="px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded font-semibold transition"
                                          >
                                            Confirmer
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TOUS LES RENDEZ-VOUS */}
          {activeTab === 'appointments' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                    <span className="text-sm font-medium text-gray-600">Statut:</span>
                    {['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(status => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                          filterStatus === status
                            ? 'bg-teal-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'ALL' ? 'Tous' : status === 'PENDING' ? 'En attente' : status === 'CONFIRMED' ? 'Confirmé' : status === 'COMPLETED' ? 'Terminé' : 'Annulé'}
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
                      className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">N° Ordre</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Médecin</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Date & Session</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Type</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Statut</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-8 text-gray-500">
                            Aucun rendez-vous trouvé.
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map(apt => (
                          <tr key={apt.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-extrabold text-xs border border-teal-200">
                                #{apt.queue_number || 1}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xs">
                                  {apt.patient_name?.[0] || 'P'}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900 text-sm">{apt.patient_name}</p>
                                  <p className="text-[11px] text-gray-400">{apt.reason || 'Pas de motif'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm text-gray-900">
                                <Stethoscope className="w-4 h-4 text-teal-600" />
                                <span>
                                  Dr. {apt.doctor_details?.user_details?.first_name} {apt.doctor_details?.user_details?.last_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Clock className="w-4 h-4 text-gray-400" />
                                {formatDate(apt.appointment_date)}
                              </div>
                              {apt.slot_details && (
                                <p className="text-[11px] text-teal-600 font-semibold mt-0.5">Session: {apt.slot_details.title}</p>
                              )}
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
                                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition cursor-pointer"
                                      title="Confirmer"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(apt.id, 'CANCELLED')}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                      title="Annuler"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                {apt.status === 'CONFIRMED' && (
                                  <button
                                    onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition cursor-pointer"
                                    title="Marquer terminé"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
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
            </div>
          )}
        </>
      )}

      {/* MODAL DE CREATION D'UN CRENEAU / SESSION */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus className="text-teal-600" />
                Créer une Session / Créneau de RDV
              </h3>
              <button
                onClick={() => setIsSlotModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Titre de la session / consultation</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Consultation Pédiatrie Générale"
                  value={slotFormData.title}
                  onChange={e => setSlotFormData({ ...slotFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Médecin affecté *</label>
                <select
                  required
                  value={slotFormData.doctor}
                  onChange={e => setSlotFormData({ ...slotFormData, doctor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">-- Sélectionner un médecin --</option>
                  {doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.user_details?.first_name} {doc.user_details?.last_name} ({doc.staff_category_display || 'Médecin'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Service Médical (optionnel)</label>
                  <select
                    value={slotFormData.service}
                    onChange={e => setSlotFormData({ ...slotFormData, service: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="">-- Aucun service spécifique --</option>
                    {services.map(srv => (
                      <option key={srv.id} value={srv.id}>{srv.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Capacité Max. (Nombre de Patients) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={slotFormData.max_patients}
                    onChange={e => setSlotFormData({ ...slotFormData, max_patients: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-teal-700 outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={slotFormData.slot_date}
                    onChange={e => setSlotFormData({ ...slotFormData, slot_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Heure Début</label>
                  <input
                    type="time"
                    required
                    value={slotFormData.start_time}
                    onChange={e => setSlotFormData({ ...slotFormData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Heure Fin</label>
                  <input
                    type="time"
                    required
                    value={slotFormData.end_time}
                    onChange={e => setSlotFormData({ ...slotFormData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mode de Consultation</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSlotFormData({ ...slotFormData, consultation_type: 'IN_PERSON' })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                      slotFormData.consultation_type === 'IN_PERSON'
                        ? 'border-teal-600 bg-teal-50 text-teal-800'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-teal-600" /> Présentiel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotFormData({ ...slotFormData, consultation_type: 'TELEMEDICINE' })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                      slotFormData.consultation_type === 'TELEMEDICINE'
                        ? 'border-teal-600 bg-teal-50 text-teal-800'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Video className="w-4 h-4 text-teal-600" /> Téléconsultation
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsSlotModalOpen(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingSlot}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow transition cursor-pointer"
                >
                  {submittingSlot ? 'Création...' : 'Publier le créneau'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
