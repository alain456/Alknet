import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Stethoscope, Users, Calendar, FileText, Clock, CheckCircle, AlertCircle, Search, Plus, Video, MapPin, Pill, User as UserIcon, Globe, Send, Trash2, Bell, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospitalService';
import { useSmartPolling, appointmentsFingerprint } from '../../shared/useSmartPolling';

const AWAITING_ADMIN = ['PENDING', 'REQUEST_SENT'];
const ACTIVE_STATUSES = ['CONFIRMED', 'PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS'];
const STATUS_PRIORITY = { PRESENT: 0, IN_PROGRESS: 0, WAITING_ROOM: 1, PATIENT_ARRIVED: 2, CONFIRMED: 3, PENDING: 4, REQUEST_SENT: 5 };

const getAppointmentSlotId = (apt) => apt?.slot || apt?.slot_details?.id;
const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function DoctorDashboard() {
  const { isAuthenticated, authFetch, token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  const [notifications, setNotifications] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [services, setServices] = useState([]);
  const [filterService, setFilterService] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const appointmentsRef = useRef([]);
  const appointmentsFpRef = useRef('');
  const notificationsFpRef = useRef('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingAppointments: 0,
    confirmedToday: 0,
    waitingNow: 0,
    inConsultation: 0,
    totalPatients: 0,
    completedAppointments: 0,
    activePrescriptions: 0,
  });

  const [prescriptionForm, setPrescriptionForm] = useState({
    prescription_type: 'MEDICATION',
    medication_name: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    exam_name: '',
    exam_reason: '',
    patient: ''
  });
  const [prescriptionError, setPrescriptionError] = useState('');
  const [prescriptionSaving, setPrescriptionSaving] = useState(false);

  const fetchSlots = async (hid) => {
    try {
      const data = await hospitalService.getAdminAppointmentSlots({ hospital: hid });
      setSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServices = async (hid) => {
    try {
      const data = await hospitalService.getServices(hid, true);
      setServices(normalizeList(data).filter((s) => s.is_active !== false));
    } catch (err) {
      console.error(err);
    }
  };

  const updateStats = useCallback((list, prescriptionCount) => {
    const today = new Date().toDateString();
    const todayList = list.filter((a) => new Date(a.appointment_date).toDateString() === today);
    setStats((prev) => ({
      todayAppointments: todayList.length,
      pendingAppointments: list.filter((a) => AWAITING_ADMIN.includes(a.status)).length,
      confirmedToday: todayList.filter((a) => a.status === 'CONFIRMED').length,
      waitingNow: list.filter((a) => ['PATIENT_ARRIVED', 'WAITING_ROOM'].includes(a.status)).length,
      inConsultation: list.filter((a) => ['PRESENT', 'IN_PROGRESS'].includes(a.status)).length,
      totalPatients: new Set(list.map((a) => a.patient)).size,
      completedAppointments: list.filter((a) => a.status === 'COMPLETED').length,
      activePrescriptions: prescriptionCount ?? prev.activePrescriptions,
    }));
  }, []);

  const fetchAppointments = useCallback(async (hid, { silent = false } = {}) => {
    if (!silent) setIsRefreshing(true);
    try {
      const data = await hospitalService.getAppointments({ hospital: hid });
      const list = normalizeList(data);
      const fp = appointmentsFingerprint(list);
      if (fp !== appointmentsFpRef.current || !silent) {
        appointmentsFpRef.current = fp;
        setAppointments(list);
        appointmentsRef.current = list;
        updateStats(list);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setIsRefreshing(false);
      setLoading(false);
    }
  }, [updateStats]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await hospitalService.getNotifications();
      const list = normalizeList(data);
      const fp = list.map((n) => `${n.id}:${n.is_read}`).join('|');
      if (fp !== notificationsFpRef.current) {
        notificationsFpRef.current = fp;
        setNotifications(list);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchMedicalRecords = async (hid) => {
    try {
      const res = await authFetch(`/api/v1/hospital/medical-records/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMedicalRecords(data);
        setStats(prev => ({
          ...prev,
          totalPatients: new Set(data.map(r => r.patient)).size
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPrescriptions = async (hid) => {
    try {
      const res = await authFetch(`/api/v1/hospital/prescriptions/?hospital=${hid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrescriptions(data);
        updateStats(appointmentsRef.current, data.filter((p) => p.is_active).length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length > 0) {
          const hid = list[0].id;
          setHospitalId(hid);
          await fetchAppointments(hid);
          fetchSlots(hid);
          fetchServices(hid);
          fetchMedicalRecords(hid);
          fetchPrescriptions(hid);
          fetchNotifications();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    init();
  }, [isAuthenticated, fetchAppointments, fetchNotifications]);

  useSmartPolling(
    () => {
      if (hospitalId) {
        fetchAppointments(hospitalId, { silent: true });
        fetchNotifications();
      }
    },
    30000,
    !!hospitalId,
  );

  const markNotificationRead = async (id) => {
    try {
      await hospitalService.markNotificationRead(id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    if (!prescriptionForm.patient) {
      setPrescriptionError('Sélectionnez un patient.');
      return;
    }
    setPrescriptionSaving(true);
    setPrescriptionError('');
    try {
      const payload = {
        patient: prescriptionForm.patient,
        hospital: hospitalId,
        prescription_type: prescriptionForm.prescription_type,
        medication_name: prescriptionForm.medication_name,
        dosage: prescriptionForm.dosage,
        frequency: prescriptionForm.frequency,
        duration: prescriptionForm.duration,
        instructions: prescriptionForm.instructions,
        exam_name: prescriptionForm.exam_name,
        exam_reason: prescriptionForm.exam_reason,
      };
      const res = await authFetch('/api/v1/hospital/prescriptions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = typeof data === 'object'
          ? (data.detail || data.error || Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | '))
          : 'Création impossible';
        setPrescriptionError(msg);
        return;
      }
      setIsModalOpen(false);
      setPrescriptionForm({
        prescription_type: 'MEDICATION',
        medication_name: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: '',
        exam_name: '',
        exam_reason: '',
        patient: ''
      });
      fetchPrescriptions(hospitalId);
    } catch (err) {
      console.error(err);
      setPrescriptionError(err.message || 'Erreur réseau');
    } finally {
      setPrescriptionSaving(false);
    }
  };

  const handleDeletePrescription = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette prescription ?')) return;
    try {
      const res = await authFetch(`/api/v1/hospital/prescriptions/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchPrescriptions(hospitalId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartConsultation = async (appointmentId) => {
    try {
      await hospitalService.startAppointment(appointmentId);
      fetchAppointments(hospitalId);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Impossible de démarrer la consultation');
    }
  };

  const handleCompleteConsultation = async (appointmentId) => {
    try {
      await hospitalService.completeAppointment(appointmentId);
      fetchAppointments(hospitalId);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Impossible de terminer la consultation');
    }
  };

  const getStatusBadge = (status) => {
    const label = APPOINTMENT_STATUS_LABELS[status] || status;
    const colorMap = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      CONFIRMED: 'bg-blue-100 text-blue-700',
      PATIENT_ARRIVED: 'bg-emerald-100 text-emerald-700',
      WAITING_ROOM: 'bg-purple-100 text-purple-700',
      PRESENT: 'bg-teal-100 text-teal-800',
      IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
      COMPLETED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-red-100 text-red-700',
      NO_SHOW: 'bg-gray-200 text-gray-700',
    };
    const color = colorMap[status] || 'bg-gray-100 text-gray-700';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
        {status === 'COMPLETED' && <CheckCircle className="w-3 h-3" />}
        {status === 'PENDING' && <Clock className="w-3 h-3" />}
        {status === 'CANCELLED' && <AlertCircle className="w-3 h-3" />}
        {label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non défini';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  const prescriptionPatients = (() => {
    const map = new Map();
    appointments.forEach((a) => {
      if (a.patient) {
        map.set(String(a.patient), {
          id: a.patient,
          name: a.patient_name || 'Patient',
          email: a.patient_email || '',
        });
      }
    });
    return Array.from(map.values());
  })();

  if (loading) return <div className="p-8">Chargement...</div>;

  const unreadNotifications = notifications.filter((n) => !n.is_read);
  const matchesTriage = (a) => {
    const serviceOk = filterService === 'ALL'
      || String(a.service) === String(filterService)
      || String(a.slot_details?.service) === String(filterService);
    const statusOk = filterStatus === 'ALL' || a.status === filterStatus;
    return serviceOk && statusOk;
  };
  const todayAppointments = appointments
    .filter((a) => new Date(a.appointment_date).toDateString() === new Date().toDateString())
    .filter((a) => !['CANCELLED', 'REJECTED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED'].includes(a.status))
    .filter(matchesTriage)
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      const sa = (a.service_name || '').localeCompare(b.service_name || '');
      if (sa !== 0) return sa;
      return (a.queue_number || 0) - (b.queue_number || 0);
    });

  const serviceOptions = (() => {
    const fromAppts = appointments
      .map((a) => ({ id: a.service || a.slot_details?.service, name: a.service_name }))
      .filter((s) => s.id && s.name);
    const map = new Map();
    [...services.map((s) => ({ id: s.id, name: s.name })), ...fromAppts].forEach((s) => {
      if (s.id) map.set(String(s.id), s.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  })();

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Stethoscope className="text-blue-600" />
            Espace Médecin
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Suivi en temps réel de vos rendez-vous et patients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { if (hospitalId) { fetchAppointments(hospitalId); fetchNotifications(); } }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
            title="Actualiser"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {lastRefresh ? `Màj ${lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Actualiser'}
          </button>
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sync auto (30s, onglet actif)
          </span>
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed flex items-center gap-1.5" title="Fonctionnalité post-MVP">
            <Globe className="w-3.5 h-3.5 text-gray-400" /> Télé-expertise — bientôt
          </span>
        </div>
      </div>

      {unreadNotifications.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {unreadNotifications.length} notification{unreadNotifications.length > 1 ? 's' : ''} non lue{unreadNotifications.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {unreadNotifications.slice(0, 5).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markNotificationRead(n.id)}
                className="w-full text-left bg-white rounded-xl p-3 border border-blue-100 hover:border-blue-300 text-xs"
              >
                <p className="font-semibold text-gray-900">{n.title}</p>
                <p className="text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">Cliquer pour marquer comme lu</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas accès à un hôpital.
        </div>
      )}

      {hospitalId && (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500">RDV aujourd'hui</p>
              <p className="text-2xl font-bold text-gray-900">{stats.todayAppointments}</p>
            </div>
            <div className="bg-white rounded-2xl border border-yellow-200 shadow-sm p-4">
              <p className="text-xs text-yellow-700">En attente admin</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pendingAppointments}</p>
            </div>
            <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4">
              <p className="text-xs text-blue-700">Confirmés</p>
              <p className="text-2xl font-bold text-blue-700">{stats.confirmedToday}</p>
            </div>
            <div className="bg-white rounded-2xl border border-purple-200 shadow-sm p-4">
              <p className="text-xs text-purple-700">En salle / arrivés</p>
              <p className="text-2xl font-bold text-purple-700">{stats.waitingNow}</p>
            </div>
            <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4">
              <p className="text-xs text-indigo-700">En consultation</p>
              <p className="text-2xl font-bold text-indigo-700">{stats.inConsultation}</p>
            </div>
            <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-4">
              <p className="text-xs text-green-700">Terminés</p>
              <p className="text-2xl font-bold text-green-700">{stats.completedAppointments}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              <button
                onClick={() => setActiveTab('slots')}
                className={`flex-1 px-6 py-4 font-medium transition whitespace-nowrap ${
                  activeTab === 'slots'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Mes Créneaux & Sessions ({slots.length})
              </button>
              <button
                onClick={() => setActiveTab('appointments')}
                className={`flex-1 px-6 py-4 font-medium transition whitespace-nowrap ${
                  activeTab === 'appointments'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Mes RDV du jour ({todayAppointments.length})
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`flex-1 px-6 py-4 font-medium transition whitespace-nowrap ${
                  activeTab === 'records'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Dossiers Médicaux
              </button>
              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`flex-1 px-6 py-4 font-medium transition whitespace-nowrap ${
                  activeTab === 'prescriptions'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Pill className="w-4 h-4 inline mr-2" />
                Prescriptions
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'slots' && (
                <div className="space-y-4">
                  {slots.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="font-semibold">Aucun créneau configuré pour vous.</p>
                      <p className="text-xs text-gray-400">L'administration définira vos sessions de consultation.</p>
                    </div>
                  ) : (
                    slots.map(slot => {
                      const postulants = appointments.filter(
                        (a) => String(getAppointmentSlotId(a)) === String(slot.id)
                      );
                      return (
                        <div key={slot.id} className="border border-gray-200 rounded-2xl p-5 hover:border-blue-300 transition space-y-3 bg-gray-50/50">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                  {slot.consultation_type === 'TELEMEDICINE' ? 'Téléconsultation' : 'Présentiel'}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  slot.remaining_slots === 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {slot.remaining_slots === 0 ? 'Complet' : `${slot.remaining_slots} places restantes`}
                                </span>
                              </div>
                              <h3 className="text-lg font-bold text-gray-900">{slot.title}</h3>
                              <p className="text-xs text-gray-500 flex items-center gap-3">
                                <span>📅 Date: {formatDate(slot.slot_date)}</span>
                                <span>⏰ Heures: {slot.start_time?.substring(0,5)} - {slot.end_time?.substring(0,5)}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-gray-500 block">Capacité du créneau</span>
                              <span className="text-xl font-extrabold text-blue-600">{slot.booked_count} / {slot.max_patients}</span>
                              <span className="text-xs text-gray-400 block">Patients inscrits</span>
                            </div>
                          </div>

                          {/* Liste des patients ayant postulé */}
                          <div>
                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                              Patients inscrits par ordre de réservation:
                            </h4>
                            {postulants.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Aucune candidature sur ce créneau.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {postulants.sort((a,b) => (a.queue_number || 0) - (b.queue_number || 0)).map(apt => (
                                  <div key={apt.id} className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold flex items-center justify-center text-xs">
                                        #{apt.queue_number || 1}
                                      </span>
                                      <div>
                                        <p className="text-xs font-bold text-gray-900">{apt.patient_name}</p>
                                        <p className="text-[10px] text-gray-500">{apt.reason || 'Consultation'}</p>
                                      </div>
                                    </div>
                                    <div>{getStatusBadge(apt.status)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {activeTab === 'appointments' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pb-2 border-b border-gray-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">Triage service</span>
                      <select
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="ALL">Tous les services</option>
                        {serviceOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="ALL">Tous les statuts</option>
                        {['CONFIRMED', 'PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS'].map((st) => (
                          <option key={st} value={st}>{APPOINTMENT_STATUS_LABELS[st] || st}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-gray-400">{todayAppointments.length} patient(s) affiché(s)</p>
                  </div>
                  {todayAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun rendez-vous actif aujourd'hui{filterService !== 'ALL' || filterStatus !== 'ALL' ? ' pour ce filtre' : ''}.
                    </div>
                  ) : (
                    todayAppointments.map((appointment) => (
                      <div key={appointment.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{appointment.patient_name || 'Patient'}</h3>
                              {getStatusBadge(appointment.status)}
                              {appointment.service_name && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-100">
                                  {appointment.service_name}
                                </span>
                              )}
                              {appointment.reference_code && (
                                <span className="text-[10px] font-mono text-indigo-600">{appointment.reference_code}</span>
                              )}
                              {appointment.queue_number != null && (
                                <span className="text-[10px] font-bold text-gray-500">#{appointment.queue_number}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(appointment.appointment_date)}
                              </span>
                              {appointment.slot_details?.start_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {appointment.slot_details.start_time.substring(0, 5)}
                                </span>
                              )}
                              {appointment.consultation_type === 'TELEMEDICINE' ? (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <Video className="w-4 h-4" />
                                  Téléconsultation
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-green-600">
                                  <MapPin className="w-4 h-4" />
                                  Présentiel
                                </span>
                              )}
                            </div>
                            {appointment.reason && (
                              <p className="text-xs text-gray-500 mt-2">Motif : {appointment.reason}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {['WAITING_ROOM', 'PATIENT_ARRIVED', 'CONFIRMED'].includes(appointment.status) && (
                              <button
                                onClick={() => handleStartConsultation(appointment.id)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg"
                              >
                                Démarrer consultation
                              </button>
                            )}
                            {['PRESENT', 'IN_PROGRESS'].includes(appointment.status) && (
                              <button
                                onClick={() => handleCompleteConsultation(appointment.id)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg"
                              >
                                Terminer
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'records' && (
                <div className="space-y-3">
                  {medicalRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun dossier médical trouvé.
                    </div>
                  ) : (
                    medicalRecords.map(record => (
                      <div key={record.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{record.patient_name || 'Patient'}</h3>
                              <span className="text-xs text-gray-500">
                                {formatDate(record.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Diagnostic:</span> {record.diagnosis}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notes:</span> {record.clinical_notes?.substring(0, 100)}...
                            </p>
                          </div>
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'prescriptions' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">Prescriptions Médicales</h3>
                    <button
                      onClick={() => {
                        setModalType('prescription');
                        setPrescriptionError('');
                        setIsModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Nouvelle Prescription
                    </button>
                  </div>
                  {prescriptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucune prescription trouvée.
                    </div>
                  ) : (
                    prescriptions.map(prescription => (
                      <div key={prescription.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                prescription.prescription_type === 'MEDICATION' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {prescription.prescription_type === 'MEDICATION' && <Pill className="w-3 h-3" />}
                                {prescription.prescription_type === 'EXAM' && <FileText className="w-3 h-3" />}
                                {prescription.prescription_type_display}
                              </span>
                              <h3 className="font-semibold text-gray-900">{prescription.patient_name}</h3>
                              <span className="text-xs text-gray-500">{formatDate(prescription.prescribed_at)}</span>
                            </div>
                            {prescription.prescription_type === 'MEDICATION' && (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-900 font-medium">{prescription.medication_name}</p>
                                <p className="text-xs text-gray-600">{prescription.dosage} - {prescription.frequency} - {prescription.duration}</p>
                              </div>
                            )}
                            {prescription.prescription_type === 'EXAM' && (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-900 font-medium">{prescription.exam_name}</p>
                                <p className="text-xs text-gray-600">{prescription.exam_reason}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeletePrescription(prescription.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal Prescription */}
          {isModalOpen && modalType === 'prescription' && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <Pill className="w-5 h-5 text-blue-600" />
                    Nouvelle Prescription
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 text-xl">&times;</button>
                </div>
                <form onSubmit={handleCreatePrescription} className="p-6 space-y-4">
                  {prescriptionError && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{prescriptionError}</div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                    <select
                      required
                      value={prescriptionForm.patient}
                      onChange={(e) => setPrescriptionForm({ ...prescriptionForm, patient: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="">Sélectionner un patient</option>
                      {prescriptionPatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.email ? ` (${p.email})` : ''}
                        </option>
                      ))}
                    </select>
                    {prescriptionPatients.length === 0 && (
                      <p className="text-xs text-amber-700 mt-1">Aucun patient lié à vos rendez-vous (compte utilisateur requis).</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de Prescription</label>
                    <select
                      value={prescriptionForm.prescription_type}
                      onChange={e => setPrescriptionForm({...prescriptionForm, prescription_type: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="MEDICATION">Médicament</option>
                      <option value="EXAM">Examen</option>
                      <option value="PROCEDURE">Procédure</option>
                    </select>
                  </div>

                  {prescriptionForm.prescription_type === 'MEDICATION' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du médicament</label>
                        <input
                          type="text"
                          required
                          value={prescriptionForm.medication_name}
                          onChange={e => setPrescriptionForm({...prescriptionForm, medication_name: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="ex: Paracétamol"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                          <input
                            type="text"
                            value={prescriptionForm.dosage}
                            onChange={e => setPrescriptionForm({...prescriptionForm, dosage: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="500mg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
                          <input
                            type="text"
                            value={prescriptionForm.frequency}
                            onChange={e => setPrescriptionForm({...prescriptionForm, frequency: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="3x/jour"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
                          <input
                            type="text"
                            value={prescriptionForm.duration}
                            onChange={e => setPrescriptionForm({...prescriptionForm, duration: e.target.value})}
                            className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                            placeholder="7 jours"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {prescriptionForm.prescription_type === 'EXAM' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;examen</label>
                        <input
                          type="text"
                          required
                          value={prescriptionForm.exam_name}
                          onChange={e => setPrescriptionForm({...prescriptionForm, exam_name: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="ex: Analyse sanguine"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Raison de l&apos;examen</label>
                        <textarea
                          value={prescriptionForm.exam_reason}
                          onChange={e => setPrescriptionForm({...prescriptionForm, exam_reason: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                          rows="2"
                          placeholder="Raison..."
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                    <textarea
                      value={prescriptionForm.instructions}
                      onChange={e => setPrescriptionForm({...prescriptionForm, instructions: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                      rows="2"
                      placeholder="Instructions spéciales..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
                    <button type="submit" disabled={prescriptionSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {prescriptionSaving ? 'Enregistrement…' : 'Prescrire'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
