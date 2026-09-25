import React, { useState, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import { Stethoscope, Users, Calendar, FileText, Clock, CheckCircle, AlertCircle, Search, Plus, Video, MapPin, Pill, User as UserIcon, Globe, Send, Trash2, Bell, RefreshCw, Filter, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospitalService';
import { useSmartPolling, appointmentsFingerprint } from '../../shared/useSmartPolling';

const AWAITING_ADMIN = ['PENDING', 'REQUEST_SENT'];
/** Après orientation accueil — le médecin peut démarrer la consultation */
const READY_TO_START = ['PATIENT_ARRIVED', 'WAITING_ROOM'];
const IN_PROGRESS_STATUSES = ['PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS'];
const CLOSED_STATUSES = ['CANCELLED', 'REJECTED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED'];

/** Ordre d'arrivée : n° de file, puis date de réservation. */
const byArrivalOrder = (a, b) => {
  const qa = a.queue_number ?? Number.MAX_SAFE_INTEGER;
  const qb = b.queue_number ?? Number.MAX_SAFE_INTEGER;
  if (qa !== qb) return qa - qb;
  const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
  const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (ca !== cb) return ca - cb;
  return String(a.id).localeCompare(String(b.id));
};

const byConfirmedFirst = (a, b) => {
  const ac = a.status === 'CONFIRMED' ? 0 : 1;
  const bc = b.status === 'CONFIRMED' ? 0 : 1;
  if (ac !== bc) return ac - bc;
  return byArrivalOrder(a, b);
};

const matchesAppointmentSearch = (apt, query) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    apt.patient_name,
    apt.patient_email,
    apt.patient_phone,
    apt.reference_code,
    apt.service_name,
    apt.reason,
    apt.notes,
    apt.queue_number != null ? String(apt.queue_number) : '',
    apt.queue_number != null ? `#${apt.queue_number}` : '',
    apt.status,
    APPOINTMENT_STATUS_LABELS[apt.status],
    apt.consultation_type === 'TELEMEDICINE' ? 'teleconsultation telemedecine' : 'presentiel',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q) || q.split(/\s+/).every((token) => haystack.includes(token));
};

const isSameDay = (dateValue, ref = new Date()) => {
  if (!dateValue) return false;
  return new Date(dateValue).toDateString() === ref.toDateString();
};

const isUpcomingOrToday = (dateValue) => {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return d >= start;
};

const getAppointmentSlotId = (apt) => apt?.slot || apt?.slot_details?.id;
const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default function DoctorDashboard() {
  const { isAuthenticated, authFetch, token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [schedules, setSchedules] = useState([]);
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
  const [filterDay, setFilterDay] = useState('TODAY'); // TODAY | UPCOMING | ALL
  const [filterType, setFilterType] = useState('ALL'); // ALL | IN_PERSON | TELEMEDICINE
  const [sortMode, setSortMode] = useState('ARRIVAL'); // ARRIVAL | CONFIRMED_FIRST
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
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
    hospital_exam: '',
    patient: ''
  });
  const [hospitalExams, setHospitalExams] = useState([]);
  const [pendingLabValidations, setPendingLabValidations] = useState([]);
  const [prescriptionError, setPrescriptionError] = useState('');
  const [prescriptionSaving, setPrescriptionSaving] = useState(false);

  const fetchSlots = async (hid) => {
    try {
      const data = await hospitalService.getAdminAppointmentSlots({ hospital: hid });
      setSlots(normalizeList(data));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchedules = async (hid) => {
    try {
      const data = await hospitalService.getSchedules({ hospital: hid });
      setSchedules(normalizeList(data).filter((row) => row.is_available !== false));
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
      const data = await hospitalService.getAppointments({ hospital: hid, ordering: 'queue_number' });
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

  const fetchHospitalExams = async (hid) => {
    try {
      const data = await hospitalService.getExams(hid, true);
      setHospitalExams(normalizeList(data).filter((e) => e.is_active !== false));
    } catch {
      setHospitalExams([]);
    }
  };

  const fetchPendingLabValidations = async (hid) => {
    try {
      const data = await hospitalService.getLabResults(hid);
      const list = normalizeList(data).filter((r) => r.status === 'RESULT_AVAILABLE');
      setPendingLabValidations(list);
    } catch {
      setPendingLabValidations([]);
    }
  };

  const handleValidateLab = async (labId) => {
    try {
      await hospitalService.updateLabResultStatus(labId, { status: 'VALIDATED' });
      if (hospitalId) fetchPendingLabValidations(hospitalId);
      window.alert('Résultat validé. Le laborantin peut maintenant notifier le patient.');
    } catch (err) {
      setPrescriptionError(err.message || 'Validation impossible');
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
          fetchSchedules(hid);
          fetchServices(hid);
          fetchMedicalRecords(hid);
          fetchPrescriptions(hid);
          fetchHospitalExams(hid);
          fetchPendingLabValidations(hid);
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
        fetchSlots(hospitalId);
        fetchSchedules(hospitalId);
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
        hospital_exam: prescriptionForm.hospital_exam || null,
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
        hospital_exam: '',
        patient: ''
      });
      if (payload.prescription_type === 'EXAM') {
        setPrescriptionError('');
        window.alert(
          data.lab_result_id
            ? 'Prescription enregistrée. Une demande laboratoire a été créée automatiquement pour le laborantin.'
            : 'Prescription enregistrée.'
        );
      }
      fetchPrescriptions(hospitalId);
      fetchPendingLabValidations(hospitalId);
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

  const [startBusyId, setStartBusyId] = useState(null);

  const handleStartConsultation = async (appointmentId) => {
    if (startBusyId) return;
    setStartBusyId(appointmentId);
    try {
      await hospitalService.startAppointment(appointmentId);
      await fetchAppointments(hospitalId);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Impossible de démarrer la consultation');
      if (hospitalId) await fetchAppointments(hospitalId);
    } finally {
      setStartBusyId(null);
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
      REQUEST_SENT: 'bg-yellow-100 text-yellow-700',
      CONFIRMED: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
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
        {status === 'CONFIRMED' && <CheckCircle className="w-3 h-3" />}
        {AWAITING_ADMIN.includes(status) && <Clock className="w-3 h-3" />}
        {status === 'CANCELLED' && <AlertCircle className="w-3 h-3" />}
        {status === 'CONFIRMED' ? 'Confirmé admin' : label}
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

  const formatTime = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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

  const resetTriage = () => {
    setSearchQuery('');
    setFilterService('ALL');
    setFilterStatus('ALL');
    setFilterDay('TODAY');
    setFilterType('ALL');
    setSortMode('ARRIVAL');
  };

  const hasActiveTriage = Boolean(
    searchQuery.trim()
    || filterService !== 'ALL'
    || filterStatus !== 'ALL'
    || filterDay !== 'TODAY'
    || filterType !== 'ALL'
    || sortMode !== 'ARRIVAL',
  );

  const matchesTriage = (a) => {
    const serviceOk = filterService === 'ALL'
      || String(a.service) === String(filterService)
      || String(a.slot_details?.service) === String(filterService);

    let statusOk = filterStatus === 'ALL' || a.status === filterStatus;
    if (filterStatus === 'PENDING') {
      statusOk = AWAITING_ADMIN.includes(a.status);
    } else if (filterStatus === 'WAITING_ROOM') {
      statusOk = ['PATIENT_ARRIVED', 'WAITING_ROOM'].includes(a.status);
    } else if (filterStatus === 'IN_PROGRESS') {
      statusOk = ['PRESENT', 'IN_PROGRESS'].includes(a.status);
    }

    const typeOk = filterType === 'ALL' || a.consultation_type === filterType;

    let dayOk = true;
    if (filterDay === 'TODAY') dayOk = isSameDay(a.appointment_date);
    else if (filterDay === 'UPCOMING') dayOk = isUpcomingOrToday(a.appointment_date);

    const searchOk = matchesAppointmentSearch(a, deferredSearch);

    return serviceOk && statusOk && typeOk && dayOk && searchOk;
  };

  const sortAppointments = (list) => {
    const sorted = list.slice().sort(sortMode === 'CONFIRMED_FIRST' ? byConfirmedFirst : byArrivalOrder);
    return sorted;
  };

  const triagedAppointments = sortAppointments(
    appointments
      .filter((a) => !CLOSED_STATUSES.includes(a.status))
      .filter(matchesTriage),
  );

  const confirmedByAdmin = triagedAppointments.filter((a) => a.status === 'CONFIRMED');
  const inProgressQueue = triagedAppointments.filter((a) => IN_PROGRESS_STATUSES.includes(a.status));
  const awaitingAdmin = triagedAppointments.filter((a) => AWAITING_ADMIN.includes(a.status));

  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Bujumbura' }).format(new Date());
  const assignedSessions = slots
    .filter((slot) => !slot.slot_date || String(slot.slot_date).slice(0, 10) >= todayKey)
    .slice()
    .sort((a, b) => String(a.slot_date).localeCompare(String(b.slot_date)) || String(a.start_time).localeCompare(String(b.start_time)));

  const filteredSlots = assignedSessions.filter((slot) => {
    const q = deferredSearch.trim().toLowerCase();
    if (filterType !== 'ALL' && slot.consultation_type !== filterType) return false;
    if (filterService !== 'ALL' && String(slot.service) !== String(filterService) && String(slot.service_id) !== String(filterService)) return false;
    if (!q) return true;
    const blob = [slot.title, slot.service_name, slot.location_notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const postulants = appointments.filter((a) => String(getAppointmentSlotId(a)) === String(slot.id));
    return blob.includes(q) || postulants.some((a) => matchesAppointmentSearch(a, deferredSearch));
  });

  const filteredRecords = medicalRecords.filter((record) => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return true;
    return [record.patient_name, record.diagnosis, record.clinical_notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const filteredPrescriptions = prescriptions.filter((p) => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return true;
    return [p.patient_name, p.medication_name, p.exam_name, p.instructions, p.prescription_type_display]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const renderAppointmentCard = (appointment, { highlightConfirmed = false } = {}) => {
    const isConfirmed = appointment.status === 'CONFIRMED';
    const canStart = READY_TO_START.includes(appointment.status);
    const confirmedAt = formatTime(appointment.confirmed_at);
    const orientedAt = formatTime(appointment.checked_in_at);
    return (
      <div
        key={appointment.id}
        className={`rounded-xl p-4 transition ${
          canStart
            ? 'border-2 border-indigo-400 bg-indigo-50/50 shadow-sm'
            : isConfirmed || highlightConfirmed
              ? 'border-2 border-blue-400 bg-blue-50/60 shadow-sm'
              : 'border border-gray-200 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`w-8 h-8 rounded-full font-extrabold flex items-center justify-center text-sm shrink-0 ${
                canStart ? 'bg-indigo-600 text-white' : isConfirmed ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'
              }`}>
                #{appointment.queue_number || '—'}
              </span>
              <h3 className="font-semibold text-gray-900">{appointment.patient_name || 'Patient'}</h3>
              {getStatusBadge(appointment.status)}
              {isConfirmed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  <CheckCircle className="w-3 h-3" />
                  Validé par l&apos;admin
                </span>
              )}
              {canStart && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                  Orienté — prêt à démarrer
                </span>
              )}
              {appointment.service_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-100">
                  {appointment.service_name}
                </span>
              )}
              {appointment.reference_code && (
                <span className="text-[10px] font-mono text-indigo-600">{appointment.reference_code}</span>
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
            {isConfirmed && (
              <p className="text-xs text-blue-800 mt-2 font-medium">
                Confirmé
                {appointment.confirmed_by_name ? ` par ${appointment.confirmed_by_name}` : ' par l\'administration'}
                {confirmedAt ? ` à ${confirmedAt}` : ''}
                {' — en attente d\'orientation à l\'accueil'}
              </p>
            )}
            {canStart && (
              <p className="text-xs text-indigo-800 mt-2 font-medium">
                Orienté par l&apos;accueil
                {orientedAt ? ` à ${orientedAt}` : ''}
                {appointment.location_notes ? ` — ${appointment.location_notes}` : ''}
              </p>
            )}
            {appointment.reason && (
              <p className="text-xs text-gray-500 mt-2">Motif : {appointment.reason}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {canStart && (
              <button
                type="button"
                disabled={startBusyId === appointment.id}
                onClick={() => handleStartConsultation(appointment.id)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg whitespace-nowrap disabled:opacity-50"
              >
                {startBusyId === appointment.id ? 'Démarrage…' : 'Démarrer la consultation'}
              </button>
            )}
            {['PRESENT', 'IN_PROGRESS'].includes(appointment.status) && (
              <button
                type="button"
                onClick={() => handleCompleteConsultation(appointment.id)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg"
              >
                Terminer
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

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
                className="w-full text-left bg-surface rounded-xl p-3.5 border-2 border-accent hover:bg-primary/5 text-sm text-ink"
              >
                <p className="font-bold text-ink text-sm sm:text-base">{n.title}</p>
                <p className="text-ink font-medium mt-0.5 line-clamp-2 text-sm">{n.message}</p>
                <p className="text-xs text-ink-muted mt-1.5 font-semibold">Cliquer pour marquer comme lu</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingLabValidations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {pendingLabValidations.length} résultat{pendingLabValidations.length > 1 ? 's' : ''} labo à valider
          </p>
          <div className="space-y-2">
            {pendingLabValidations.slice(0, 5).map((lab) => (
              <div key={lab.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-amber-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{lab.test_name}</p>
                  <p className="text-xs text-slate-500 truncate">{lab.patient_name} · {lab.result_value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleValidateLab(lab.id)}
                  className="shrink-0 px-3 py-1.5 text-xs font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Valider
                </button>
              </div>
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
          {/* Triage & recherche */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-gray-900">Triage & recherche</h2>
                {hasActiveTriage && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    Filtres actifs
                  </span>
                )}
              </div>
              {hasActiveTriage && (
                <button
                  type="button"
                  onClick={resetTriage}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800"
                >
                  <X className="w-3.5 h-3.5" />
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab === 'slots' || activeTab === 'records' || activeTab === 'prescriptions') {
                    /* keep current tab */
                  } else {
                    setActiveTab('appointments');
                  }
                }}
                placeholder="Rechercher patient, téléphone, n° file (#3), référence, motif…"
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-ink uppercase tracking-wide px-2 py-1 rounded-lg bg-primary text-surface">Période</span>
              {[
                { id: 'TODAY', label: "Aujourd'hui" },
                { id: 'UPCOMING', label: 'À venir' },
                { id: 'ALL', label: 'Tous' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setFilterDay(opt.id); setActiveTab('appointments'); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                    filterDay === opt.id
                      ? 'bg-primary text-surface border-accent'
                      : 'bg-surface text-ink border-border hover:border-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              <span className="text-xs font-bold text-ink uppercase tracking-wide ml-1 px-2 py-1 rounded-lg bg-primary text-surface">Type</span>
              {[
                { id: 'ALL', label: 'Tous' },
                { id: 'IN_PERSON', label: 'Présentiel', icon: MapPin },
                { id: 'TELEMEDICINE', label: 'Téléconsult.', icon: Video },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setFilterType(opt.id); setActiveTab('appointments'); }}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                    filterType === opt.id
                      ? 'bg-primary text-surface border-accent'
                      : 'bg-surface text-ink border-border hover:border-accent'
                  }`}
                >
                  {opt.icon ? <opt.icon className="w-3.5 h-3.5" /> : null}
                  {opt.label}
                </button>
              ))}

              <select
                value={filterService}
                onChange={(e) => { setFilterService(e.target.value); setActiveTab('appointments'); }}
                className="text-sm border-2 border-accent rounded-lg px-2 py-1.5 bg-surface text-ink font-medium"
              >
                <option value="ALL">Tous les services</option>
                {serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="text-sm border-2 border-accent rounded-lg px-2 py-1.5 bg-surface text-ink font-medium"
              >
                <option value="ARRIVAL">Tri : ordre d&apos;arrivée</option>
                <option value="CONFIRMED_FIRST">Tri : confirmés admin d&apos;abord</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center pt-2 border-t-2 border-alert/20">
              <span className="text-xs font-bold text-ink uppercase tracking-wide mr-1 px-2 py-1 rounded-lg bg-primary text-surface">Statut</span>
              {[
                { id: 'ALL', label: 'Tous' },
                { id: 'CONFIRMED', label: 'Confirmés admin' },
                { id: 'WAITING_ROOM', label: 'Salle d\'attente' },
                { id: 'IN_PROGRESS', label: 'En consultation' },
                { id: 'PENDING', label: 'Attente admin' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => { setFilterStatus(chip.id); setActiveTab('appointments'); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                    filterStatus === chip.id
                      ? 'bg-primary text-surface border-accent'
                      : 'bg-surface text-ink border-border hover:border-accent'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-ink font-semibold">
                {triagedAppointments.length} résultat{triagedAppointments.length !== 1 ? 's' : ''}
                {deferredSearch.trim() ? ` pour « ${deferredSearch.trim()} »` : ''}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <button
              type="button"
              onClick={() => { setActiveTab('appointments'); setFilterDay('TODAY'); setFilterStatus('ALL'); }}
              className="text-left bg-surface rounded-2xl border-2 border-accent shadow-sm p-4 hover:bg-primary/5 transition"
            >
              <p className="text-sm font-bold text-ink">RDV aujourd&apos;hui</p>
              <p className="text-2xl font-extrabold text-ink mt-1">{stats.todayAppointments}</p>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('appointments'); setFilterDay('TODAY'); setFilterStatus('PENDING'); }}
              className="text-left bg-surface rounded-2xl border-2 border-accent shadow-sm p-4 hover:bg-accent/10 transition"
            >
              <p className="text-sm font-bold text-accent">En attente admin</p>
              <p className="text-2xl font-extrabold text-accent mt-1">{stats.pendingAppointments}</p>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('appointments'); setFilterDay('TODAY'); setFilterStatus('CONFIRMED'); }}
              className="text-left bg-surface rounded-2xl border-2 border-accent shadow-sm p-4 hover:bg-primary/5 transition"
            >
              <p className="text-sm font-bold text-ink">Confirmés admin</p>
              <p className="text-2xl font-extrabold text-ink mt-1">{stats.confirmedToday}</p>
              <p className="text-xs text-ink-muted mt-1 font-semibold">Cliquer pour filtrer</p>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('appointments'); setFilterDay('TODAY'); setFilterStatus('WAITING_ROOM'); }}
              className="text-left bg-surface rounded-2xl border-2 border-alert shadow-sm p-4 hover:bg-alert/5 transition"
            >
              <p className="text-sm font-bold text-ink">En salle / arrivés</p>
              <p className="text-2xl font-extrabold text-ink mt-1">{stats.waitingNow}</p>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('appointments'); setFilterDay('TODAY'); setFilterStatus('IN_PROGRESS'); }}
              className="text-left bg-surface rounded-2xl border-2 border-accent shadow-sm p-4 hover:bg-primary/5 transition"
            >
              <p className="text-sm font-bold text-ink">En consultation</p>
              <p className="text-2xl font-extrabold text-ink mt-1">{stats.inConsultation}</p>
            </button>
            <div className="bg-surface rounded-2xl border-2 border-alert shadow-sm p-4">
              <p className="text-sm font-bold text-alert">Terminés</p>
              <p className="text-2xl font-extrabold text-alert mt-1">{stats.completedAppointments}</p>
            </div>
          </div>

          {(schedules.length > 0 || assignedSessions.length > 0) && (
            <div className="bg-white rounded-2xl border border-teal-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-gray-900">Vos créneaux et sessions</h2>
                <button type="button" onClick={() => setActiveTab('slots')} className="text-sm font-semibold text-teal-700">
                  Voir le détail
                </button>
              </div>
              {schedules.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {schedules.map((row) => (
                    <span key={row.id} className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-800 text-xs font-semibold border border-teal-100">
                      {row.day_name || 'Jour'} · {String(row.start_time || '').slice(0, 5)}–{String(row.end_time || '').slice(0, 5)}
                      {row.schedule_date ? ` · ${row.schedule_date}` : ''}
                    </span>
                  ))}
                </div>
              )}
              {assignedSessions.length > 0 && (
                <ul className="text-sm divide-y">
                  {assignedSessions.slice(0, 4).map((slot) => (
                    <li key={slot.id} className="py-2 flex justify-between gap-3">
                      <span>
                        {slot.title} · {slot.slot_date} · {String(slot.start_time || '').slice(0, 5)}–{String(slot.end_time || '').slice(0, 5)}
                      </span>
                      <span className={`text-xs font-bold ${slot.is_active ? 'text-teal-700' : 'text-amber-700'}`}>
                        {slot.is_active ? 'Publiée' : 'Assignée'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
                Mes Créneaux & Sessions ({filteredSlots.length})
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
                Mes RDV ({triagedAppointments.length})
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
                Dossiers Médicaux{deferredSearch.trim() ? ` (${filteredRecords.length})` : ''}
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
                Prescriptions{deferredSearch.trim() ? ` (${filteredPrescriptions.length})` : ''}
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'slots' && (
                <div className="space-y-4">
                  {schedules.length > 0 && (
                    <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
                      <h3 className="text-sm font-bold text-teal-900 mb-2">Horaires programmés par l’administration</h3>
                      <div className="flex flex-wrap gap-2">
                        {schedules.map((row) => (
                          <span key={row.id} className="px-3 py-1.5 rounded-full bg-white text-teal-800 text-xs font-semibold border border-teal-100">
                            {row.day_name || 'Jour'}
                            {row.schedule_date ? ` ${row.schedule_date}` : ''}
                            {' · '}
                            {String(row.start_time || '').slice(0, 5)}–{String(row.end_time || '').slice(0, 5)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {filteredSlots.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="font-semibold">
                        {slots.length === 0 && schedules.length === 0 ? 'Aucun créneau configuré pour vous.' : 'Aucune session à venir.'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {slots.length === 0
                          ? "L'administration définira vos sessions de consultation."
                          : 'Modifiez les filtres ou effacez la recherche.'}
                      </p>
                    </div>
                  ) : (
                    filteredSlots.map(slot => {
                      const postulants = appointments
                        .filter((a) => String(getAppointmentSlotId(a)) === String(slot.id))
                        .filter((a) => matchesAppointmentSearch(a, deferredSearch))
                        .filter((a) => filterStatus === 'ALL' || (
                          filterStatus === 'PENDING' ? AWAITING_ADMIN.includes(a.status)
                            : filterStatus === 'WAITING_ROOM' ? ['PATIENT_ARRIVED', 'WAITING_ROOM'].includes(a.status)
                              : filterStatus === 'IN_PROGRESS' ? ['PRESENT', 'IN_PROGRESS'].includes(a.status)
                                : a.status === filterStatus
                        ))
                        .slice()
                        .sort(sortMode === 'CONFIRMED_FIRST' ? byConfirmedFirst : byArrivalOrder);
                      return (
                        <div key={slot.id} className="border border-gray-200 rounded-2xl p-5 hover:border-blue-300 transition space-y-3 bg-gray-50/50">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                  {slot.consultation_type === 'TELEMEDICINE' ? 'Téléconsultation' : 'Présentiel'}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  slot.is_active ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {slot.is_active ? 'Publiée aux patients' : 'Assignée — pas encore publiée'}
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
                              <p className="text-xs text-gray-400 italic">
                                Aucune candidature sur ce créneau{deferredSearch.trim() ? ' pour cette recherche' : ''}.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {postulants.map(apt => (
                                  <div key={apt.id} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                                    READY_TO_START.includes(apt.status)
                                      ? 'bg-indigo-50 border-indigo-300'
                                      : apt.status === 'CONFIRMED'
                                        ? 'bg-blue-50 border-blue-300'
                                        : 'bg-white border-gray-200'
                                  }`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-6 h-6 rounded-full font-extrabold flex items-center justify-center text-xs shrink-0 ${
                                        READY_TO_START.includes(apt.status)
                                          ? 'bg-indigo-600 text-white'
                                          : apt.status === 'CONFIRMED'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-white'
                                      }`}>
                                        #{apt.queue_number || 1}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 truncate">{apt.patient_name}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{apt.reason || 'Consultation'}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      {getStatusBadge(apt.status)}
                                      {READY_TO_START.includes(apt.status) && (
                                        <button
                                          type="button"
                                          disabled={startBusyId === apt.id}
                                          onClick={() => handleStartConsultation(apt.id)}
                                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg disabled:opacity-50"
                                        >
                                          {startBusyId === apt.id ? '…' : 'Démarrer la consultation'}
                                        </button>
                                      )}
                                      {['PRESENT', 'IN_PROGRESS'].includes(apt.status) && (
                                        <button
                                          type="button"
                                          onClick={() => handleCompleteConsultation(apt.id)}
                                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg"
                                        >
                                          Terminer
                                        </button>
                                      )}
                                    </div>
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
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <p className="text-xs text-gray-500">
                      {filterDay === 'TODAY' ? "RDV d'aujourd'hui" : filterDay === 'UPCOMING' ? 'RDV à venir' : 'Tous les RDV actifs'}
                      {' · '}
                      {sortMode === 'CONFIRMED_FIRST' ? 'confirmés admin en tête' : "ordre d'arrivée"}
                    </p>
                    <p className="text-[11px] text-gray-400">{triagedAppointments.length} patient(s)</p>
                  </div>

                  {triagedAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 space-y-2">
                      <p>Aucun rendez-vous ne correspond au triage / recherche.</p>
                      {hasActiveTriage && (
                        <button type="button" onClick={resetTriage} className="text-xs font-semibold text-blue-600 hover:underline">
                          Réinitialiser les filtres
                        </button>
                      )}
                    </div>
                  ) : (filterStatus !== 'ALL' || deferredSearch.trim() || filterType !== 'ALL' || filterService !== 'ALL' || sortMode === 'CONFIRMED_FIRST') ? (
                    <div className="space-y-3">
                      {triagedAppointments.map((a) => renderAppointmentCard(a, { highlightConfirmed: a.status === 'CONFIRMED' }))}
                    </div>
                  ) : (
                    <>
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Confirmés par l&apos;administration
                            <span className="text-xs font-semibold text-blue-600">({confirmedByAdmin.length})</span>
                          </h3>
                          <span className="text-[10px] text-blue-500 font-medium">Ordre d&apos;arrivée #1, #2…</span>
                        </div>
                        {confirmedByAdmin.length === 0 ? (
                          <p className="text-xs text-gray-400 italic bg-blue-50/50 border border-dashed border-blue-200 rounded-xl p-4">
                            Aucun RDV confirmé pour vous sur cette période. Dès que l&apos;admin valide, il apparaîtra ici.
                          </p>
                        ) : (
                          confirmedByAdmin.map((a) => renderAppointmentCard(a, { highlightConfirmed: true }))
                        )}
                      </section>

                      {inProgressQueue.length > 0 && (
                        <section className="space-y-3">
                          <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            File en cours (orientés / consultation)
                            <span className="text-xs font-semibold text-indigo-600">({inProgressQueue.length})</span>
                          </h3>
                          <p className="text-[11px] text-indigo-700">
                            Les patients orientés par l&apos;accueil affichent le bouton « Démarrer la consultation ».
                          </p>
                          {inProgressQueue.map((a) => renderAppointmentCard(a))}
                        </section>
                      )}

                      {awaitingAdmin.length > 0 && (
                        <section className="space-y-3">
                          <h3 className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            En attente de confirmation admin
                            <span className="text-xs font-semibold text-yellow-700">({awaitingAdmin.length})</span>
                          </h3>
                          <p className="text-[11px] text-yellow-700">Ces demandes ne sont pas encore validées — vous ne pouvez pas démarrer la consultation.</p>
                          {awaitingAdmin.map((a) => renderAppointmentCard(a))}
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'records' && (
                <div className="space-y-3">
                  {medicalRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun dossier médical trouvé.
                    </div>
                  ) : filteredRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucun dossier ne correspond à « {deferredSearch.trim()} ».
                    </div>
                  ) : (
                    filteredRecords.map(record => (
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
                  ) : filteredPrescriptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Aucune prescription ne correspond à « {deferredSearch.trim()} ».
                    </div>
                  ) : (
                    filteredPrescriptions.map(prescription => (
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
                                {prescription.lab_result_id ? (
                                  <p className="text-xs font-semibold text-teal-700 mt-1">
                                    Demande labo créée (en file laborantin)
                                  </p>
                                ) : (
                                  <p className="text-xs text-amber-700 mt-1">
                                    Aucune demande labo liée
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeletePrescription(prescription.id)}
                              className="icon-btn icon-btn--danger"
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Examen catalogue</label>
                        <select
                          value={prescriptionForm.hospital_exam}
                          onChange={(e) => {
                            const exam = hospitalExams.find((x) => String(x.id) === e.target.value);
                            setPrescriptionForm({
                              ...prescriptionForm,
                              hospital_exam: e.target.value,
                              exam_name: exam?.name || prescriptionForm.exam_name,
                            });
                          }}
                          className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="">Libre (saisie manuelle)</option>
                          {hospitalExams.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                              {exam.name}
                              {exam.loinc_code ? ` · LOINC ${exam.loinc_code}` : ''}
                              {exam.price != null ? ` · ${exam.price} ${exam.currency || 'BIF'}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
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
                      <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                        Une demande laboratoire (statut Demandé) sera créée automatiquement pour le laborantin.
                      </p>
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
