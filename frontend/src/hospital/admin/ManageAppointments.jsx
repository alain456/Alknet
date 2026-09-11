import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Calendar, Clock, Stethoscope, Video, MapPin, Search, CheckCircle, XCircle, AlertCircle, Plus, Users, Layers, ChevronDown, ChevronUp, Eye, EyeOff, Mail, Phone, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospitalService';
import { useSmartPolling, appointmentsFingerprint } from '../../shared/useSmartPolling';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const getAppointmentSlotId = (apt) => apt?.slot || apt?.slot_details?.id;

/** Statuts où l'admin doit confirmer ou refuser la postulation */
const AWAITING_ADMIN_STATUSES = ['PENDING', 'REQUEST_SENT'];

const REJECT_REASON_PRESETS = [
  'Créneau complet — capacité maximale atteinte',
  'Médecin indisponible à cette date',
  'Informations patient incomplètes ou incorrectes',
  'Doublon de demande — une autre demande existe déjà',
  'Motif de consultation non pris en charge par le service',
];

const needsAdminReview = (apt) => AWAITING_ADMIN_STATUSES.includes(apt?.status);

const doctorLabel = (apt) => {
  if (apt?.doctor_name) return `Dr. ${apt.doctor_name}`;
  const d = apt?.doctor_details;
  if (!d) return 'votre médecin';
  if (d.full_name) return `Dr. ${d.full_name}`;
  const first = d.user_details?.first_name || '';
  const last = d.user_details?.last_name || '';
  const name = `${first} ${last}`.trim();
  return name ? `Dr. ${name}` : 'votre médecin';
};

const doctorSearchBlob = (apt) => {
  const parts = [
    apt?.doctor_name,
    apt?.doctor_details?.full_name,
    apt?.doctor_details?.user_details?.first_name,
    apt?.doctor_details?.user_details?.last_name,
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/** Date à laquelle le patient a soumis sa demande */
const formatBookingDate = (dateString) => formatDateTime(dateString);

/** Date prévue de la consultation */
const formatAppointmentDate = (dateString) => formatDateTime(dateString);

const buildDefaultConfirmMessage = (apt) => {
  const patient = apt.patient_name || 'Cher patient';
  const doctor = doctorLabel(apt);
  const date = formatAppointmentDate(apt.appointment_date);
  const booked = formatBookingDate(apt.created_at);
  return (
    `Bonjour ${patient},\n\n`
    + `Votre rendez-vous a été confirmé par notre administration.\n\n`
    + `Numéro de suivi : ${apt.reference_code || '—'}\n`
    + `Ordre de passage : #${apt.queue_number || '—'}\n`
    + `Médecin : ${doctor}\n`
    + `Date de votre demande : ${booked}\n`
    + `Date du rendez-vous : ${date}\n\n`
    + `Présentez votre numéro de suivi à l'accueil le jour de la consultation.\n\n`
    + `Cordialement,\nL'équipe médicale`
  );
};

export default function ManageAppointments() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('slots');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectPreset, setRejectPreset] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [anticipationTarget, setAnticipationTarget] = useState(null);
  const [anticipationNote, setAnticipationNote] = useState('');
  const [anticipationNewDate, setAnticipationNewDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [detailAppointment, setDetailAppointment] = useState(null);
  const [detailHistory, setDetailHistory] = useState([]);
  const appointmentsFpRef = useRef('');
  
  // Filters & Search
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterService, setFilterService] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSlotId, setExpandedSlotId] = useState(null);
  const [pollingEnabled, setPollingEnabled] = useState(true);

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    doctor: '',
    service: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    max_patients: 10,
    publish: false,
  });

  // Modal creation / édition slot
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState(null);
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
  const [editingSlotBookedCount, setEditingSlotBookedCount] = useState(0);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['slots', 'requests', 'appointments', 'queue'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        setPollingEnabled(false);
        setLoading(false);
        return;
      }
      setPollingEnabled(true);
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length > 0) {
          const hid = list[0].id;
          setHospitalId(hid);
          await Promise.all([
            fetchAppointments(hid),
            fetchSlots(hid),
            fetchDoctors(hid),
            fetchServices(hid),
            fetchQueue(hid),
            fetchStats(hid),
          ]);
        } else {
          setActionError('Aucune entreprise associée à votre compte. Reconnectez-vous avec le compte propriétaire / admin hôpital.');
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (err?.status === 401) {
          setPollingEnabled(false);
          setActionError('Session expirée. Veuillez vous reconnecter.');
        } else {
          setActionError(err?.message || 'Impossible de charger les rendez-vous.');
        }
        setLoading(false);
      }
    };
    init();
  }, [isAuthenticated]);

  const fetchAppointments = useCallback(async (hid) => {
    try {
      const data = await hospitalService.getAppointments({ hospital: hid });
      const list = normalizeList(data);
      appointmentsFpRef.current = appointmentsFingerprint(list);
      setAppointments(list);
      if (list.some((a) => needsAdminReview(a))) {
        setActiveTab('requests');
      }
    } catch (err) {
      console.error(err);
      if (err?.status === 401) setPollingEnabled(false);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSlots = useCallback(async (hid) => {
    try {
      const data = await hospitalService.getAdminAppointmentSlots({ hospital: hid });
      setSlots(normalizeList(data));
    } catch (err) {
      console.error(err);
      setSlots([]);
    }
  }, []);

  const fetchDoctors = async (hid) => {
    try {
      const data = await hospitalService.getDoctors({ hospital: hid });
      setDoctors(normalizeList(data));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServices = async (hid) => {
    try {
      const data = await hospitalService.getServices(hid, true);
      setServices(normalizeList(data));
    } catch (err) {
      console.error(err);
    }
  };

  const emptySlotForm = () => ({
    doctor: '',
    service: '',
    title: 'Consultation Générale',
    slot_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '12:00',
    consultation_type: 'IN_PERSON',
    max_patients: 10,
    notes: '',
  });

  const openCreateSlotModal = () => {
    setEditingSlotId(null);
    setEditingSlotBookedCount(0);
    setSlotFormData(emptySlotForm());
    setIsSlotModalOpen(true);
  };

  const openEditDraftSlot = (slot) => {
    if (slot.is_active) {
      alert('Dépubliez d’abord le créneau pour le modifier (brouillon non visible côté client).');
      return;
    }
    setEditingSlotId(slot.id);
    setEditingSlotBookedCount(Number(slot.booked_count) || 0);
    setSlotFormData({
      doctor: slot.doctor || '',
      service: slot.service || '',
      title: slot.title || 'Consultation Générale',
      slot_date: slot.slot_date || new Date().toISOString().split('T')[0],
      start_time: slot.start_time?.substring(0, 5) || '08:00',
      end_time: slot.end_time?.substring(0, 5) || '12:00',
      consultation_type: slot.consultation_type || 'IN_PERSON',
      max_patients: slot.max_patients || 10,
      notes: slot.notes || '',
    });
    setIsSlotModalOpen(true);
  };

  const closeSlotModal = () => {
    setIsSlotModalOpen(false);
    setEditingSlotId(null);
    setEditingSlotBookedCount(0);
    setSlotFormData(emptySlotForm());
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!slotFormData.service) {
      alert('Veuillez sélectionner le service médical (obligatoire pour que le patient choisisse par service).');
      return;
    }
    if (!slotFormData.doctor) {
      alert('Veuillez sélectionner un médecin');
      return;
    }
    if (editingSlotId && slotFormData.max_patients < editingSlotBookedCount) {
      alert(`La capacité ne peut pas être inférieure au nombre d’inscrits (${editingSlotBookedCount}).`);
      return;
    }
    setSubmittingSlot(true);
    try {
      const payload = {
        ...slotFormData,
        hospital: hospitalId,
        service: slotFormData.service,
      };
      if (editingSlotId) {
        await hospitalService.updateAppointmentSlot(editingSlotId, payload);
      } else {
        await hospitalService.createAppointmentSlot(payload);
      }
      closeSlotModal();
      fetchSlots(hospitalId);
    } catch (err) {
      console.error(err);
      alert(err.message || (editingSlotId ? 'Erreur lors de la modification' : 'Erreur lors de la création de la session'));
    } finally {
      setSubmittingSlot(false);
    }
  };

  const handleToggleSlotStatus = async (slotId, isCurrentlyActive) => {
    try {
      if (isCurrentlyActive) {
        await hospitalService.unpublishSlot(slotId);
      } else {
        await hospitalService.publishSlot(slotId);
      }
      fetchSlots(hospitalId);
    } catch (err) {
      alert(err.message || 'Erreur');
    }
  };

  const handleGenerateMonthly = async (e) => {
    e.preventDefault();
    if (!generateForm.service) {
      alert('Sélectionnez un service (obligatoire)');
      return;
    }
    if (!generateForm.doctor) {
      alert('Sélectionnez un médecin');
      return;
    }
    setGenerating(true);
    try {
      const result = await hospitalService.generateMonthlySlots({
        hospital: hospitalId,
        doctor: generateForm.doctor,
        service: generateForm.service,
        year: generateForm.year,
        month: generateForm.month,
        max_patients: generateForm.max_patients,
        publish: generateForm.publish,
      });
      alert(result.message || `${result.created_count} créneau(x) généré(s)`);
      setIsGenerateModalOpen(false);
      fetchSlots(hospitalId);
    } catch (err) {
      alert(err.message || 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  const silentRefresh = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const [apptData, statsData, queueData] = await Promise.all([
        hospitalService.getAppointments({ hospital: hospitalId }),
        hospitalService.getStats(hospitalId),
        hospitalService.getQueue(hospitalId),
      ]);
      const list = normalizeList(apptData);
      const fp = appointmentsFingerprint(list);
      if (fp !== appointmentsFpRef.current) {
        appointmentsFpRef.current = fp;
        setAppointments(list);
        if (list.some((a) => needsAdminReview(a)) && activeTab === 'slots') {
          setActiveTab('requests');
        }
      }
      setStats(statsData);
      setQueue(normalizeList(queueData));
    } catch (err) {
      if (err?.status === 401) setPollingEnabled(false);
    }
  }, [hospitalId, activeTab]);

  useSmartPolling(
    silentRefresh,
    30000,
    pollingEnabled
      && isAuthenticated
      && !!hospitalId
      && ['requests', 'appointments', 'queue'].includes(activeTab),
  );

  const handleConfirm = async (appointmentId) => {
    const message = confirmMessage.trim();
    if (!message) {
      setActionError('Le message de confirmation est obligatoire.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    setActionLoading(true);
    try {
      const result = await hospitalService.confirmAppointment(appointmentId, message);
      setConfirmTarget(null);
      setConfirmMessage('');
      const emailInfo = result?.email_notifications;
      if (emailInfo?.patient_email_sent) {
        setActionSuccess(`Rendez-vous confirmé — email envoyé à ${emailInfo.patient_email || 'le patient'}. Le médecin a été notifié.`);
      } else {
        setActionError(
          emailInfo?.patient_email_error
          || `RDV confirmé, mais l'email n'a pas été envoyé à ${emailInfo?.patient_email || 'le patient'}.`
        );
      }
      refreshAll(hospitalId);
    } catch (err) {
      setActionError(err.message || 'Impossible de confirmer');
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirmModal = (apt) => {
    setConfirmTarget(apt);
    setConfirmMessage(buildDefaultConfirmMessage(apt));
    setActionError('');
  };

  const openRejectModal = (apt) => {
    setRejectTarget(apt);
    setRejectReason('');
    setRejectPreset('');
    setActionError('');
  };

  const handleReject = async (e) => {
    e.preventDefault();
    const finalReason = (rejectPreset === 'CUSTOM' ? rejectReason : rejectPreset || rejectReason).trim();
    if (!rejectTarget || !finalReason) return;
    setActionError('');
    setActionSuccess('');
    setActionLoading(true);
    try {
      const withRefund = isPaidCollectible(rejectTarget);
      const result = await hospitalService.rejectAppointment(
        rejectTarget.id,
        finalReason,
        withRefund ? { refund: true } : {},
      );
      setRejectTarget(null);
      setRejectReason('');
      setRejectPreset('');
      const emailInfo = result?.email_notifications;
      const refundNote = withRefund || result?.payment_status === 'REFUNDED'
        ? ' Paiement remboursé.'
        : '';
      if (emailInfo?.patient_email_sent) {
        setActionSuccess(`Demande refusée — email envoyé à ${emailInfo.patient_email || 'le patient'}.${refundNote}`);
      } else {
        setActionError(
          emailInfo?.patient_email_error
          || `Demande refusée, mais l'email n'a pas été envoyé à ${emailInfo?.patient_email || 'le patient'}.${refundNote}`
        );
      }
      refreshAll(hospitalId);
    } catch (err) {
      setActionError(err.message || 'Impossible de refuser');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchQueue = useCallback(async (hid) => {
    try {
      const data = await hospitalService.getQueue(hid);
      setQueue(normalizeList(data));
    } catch {
      setQueue([]);
    }
  }, []);

  const fetchStats = useCallback(async (hid) => {
    try {
      const data = await hospitalService.getStats(hid);
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  const refreshAll = (hid) => {
    fetchAppointments(hid);
    fetchSlots(hid);
    fetchQueue(hid);
    fetchStats(hid);
  };

  const openDetail = async (apt) => {
    setDetailAppointment(apt);
    try {
      const history = await hospitalService.getAppointmentHistory(apt.id);
      setDetailHistory(Array.isArray(history) ? history : []);
    } catch {
      setDetailHistory(apt.events || []);
    }
  };

  const handleCheckIn = async (id) => {
    try {
      await hospitalService.checkInAppointment(id);
      refreshAll(hospitalId);
    } catch (err) { setActionError(err.message); }
  };

  const handleWaitingRoom = async (id) => {
    try {
      await hospitalService.waitingRoomAppointment(id);
      refreshAll(hospitalId);
    } catch (err) { setActionError(err.message); }
  };

  const handleStart = async (id) => {
    try {
      await hospitalService.startAppointment(id);
      refreshAll(hospitalId);
    } catch (err) { setActionError(err.message); }
  };

  const handleMarkNoShow = async (id) => {
    try {
      await hospitalService.markNoShow(id);
      refreshAll(hospitalId);
    } catch (err) { setActionError(err.message); }
  };

  const handleComplete = async (appointmentId) => {
    setActionError('');
    try {
      await hospitalService.completeAppointment(appointmentId);
      refreshAll(hospitalId);
    } catch (err) {
      setActionError(err.message || 'Impossible de clôturer');
    }
  };

  const STATUS_COLORS = {
    DRAFT: 'bg-gray-100 text-gray-700',
    REQUEST_SENT: 'bg-sky-100 text-sky-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    PATIENT_ARRIVED: 'bg-emerald-100 text-emerald-700',
    WAITING_ROOM: 'bg-purple-100 text-purple-700',
    PRESENT: 'bg-teal-100 text-teal-800',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-red-100 text-red-700',
    RESCHEDULED: 'bg-orange-100 text-orange-700',
    NO_SHOW: 'bg-gray-200 text-gray-700',
  };

  const getStatusBadge = (status) => {
    const label = APPOINTMENT_STATUS_LABELS[status] || status;
    const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
        {label}
      </span>
    );
  };

  const getPaymentBadge = (apt) => {
    const st = apt?.payment_status || 'UNPAID';
    const amount = Number(apt?.consultation_fee_amount || 0);
    const map = {
      PAID: 'bg-emerald-100 text-emerald-800',
      WAIVED: 'bg-sky-100 text-sky-800',
      AWAITING_PIN: 'bg-amber-100 text-amber-800',
      FAILED: 'bg-red-100 text-red-800',
      UNPAID: 'bg-gray-100 text-gray-700',
      REFUNDED: 'bg-violet-100 text-violet-800',
    };
    const labels = {
      PAID: 'Payé',
      WAIVED: 'Exonéré',
      AWAITING_PIN: 'PIN Lumicash',
      FAILED: 'Paiement échoué',
      UNPAID: amount > 0 ? 'Non payé' : 'Gratuit',
      REFUNDED: 'Remboursé',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${map[st] || map.UNPAID}`}>
        {labels[st] || st}
        {amount > 0 ? ` · ${amount.toLocaleString('fr-BI')} BIF` : ''}
      </span>
    );
  };

  const isPaidCollectible = (apt) =>
    apt?.payment_status === 'PAID'
    && Number(apt?.consultation_fee_amount || 0) > 0
    && apt?.payment_method !== 'FREE';

  const handleMarkPaid = async (apt, waive = false) => {
    setActionLoading(true);
    setActionError('');
    try {
      await hospitalService.markAppointmentPaid(apt.id, waive ? { waive: true } : { method: 'CASH' });
      await refreshAll(hospitalId);
      setActionSuccess(waive ? 'Consultation exonérée.' : 'Consultation marquée payée.');
    } catch (err) {
      setActionError(err.message || 'Impossible de marquer payé');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async (apt) => {
    if (!window.confirm(
      `Rembourser ${Number(apt.consultation_fee_amount || 0).toLocaleString('fr-BI')} BIF`
      + (apt.payer_phone ? ` vers ${apt.payer_phone}` : ' au patient')
      + ' ?\n\nEnsuite vous pourrez refuser ou annuler le rendez-vous.'
    )) return;
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await hospitalService.refundAppointmentPayment(apt.id, {
        note: 'Remboursement avant refus/annulation',
      });
      await refreshAll(hospitalId);
      setActionSuccess(res.message || 'Remboursement enregistré.');
    } catch (err) {
      setActionError(err.message || 'Échec remboursement');
    } finally {
      setActionLoading(false);
    }
  };

  const openAnticipationModal = (apt) => {
    setAnticipationTarget(apt);
    setAnticipationNote('');
    const preferred = apt.anticipation_preferred_at
      ? new Date(apt.anticipation_preferred_at)
      : null;
    if (preferred && !Number.isNaN(preferred.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      setAnticipationNewDate(
        `${preferred.getFullYear()}-${pad(preferred.getMonth() + 1)}-${pad(preferred.getDate())}T${pad(preferred.getHours())}:${pad(preferred.getMinutes())}`
      );
    } else {
      setAnticipationNewDate('');
    }
    setActionError('');
  };

  const handleRespondAnticipation = async (action) => {
    if (!anticipationTarget) return;
    if (action === 'accept' && !anticipationNewDate && !anticipationTarget.anticipation_preferred_at) {
      setActionError('Indiquez une nouvelle date pour accepter le déplacement.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const payload = {
        action,
        note: anticipationNote.trim(),
      };
      if (action === 'accept') {
        let iso = null;
        if (anticipationNewDate) {
          // datetime-local → Date locale → ISO UTC
          const parsed = new Date(anticipationNewDate);
          if (Number.isNaN(parsed.getTime())) {
            setActionError('Date invalide. Rechoisissez la nouvelle date.');
            setActionLoading(false);
            return;
          }
          iso = parsed.toISOString();
        } else if (anticipationTarget.anticipation_preferred_at) {
          iso = new Date(anticipationTarget.anticipation_preferred_at).toISOString();
        }
        if (!iso) {
          setActionError('Indiquez une nouvelle date pour accepter le déplacement.');
          setActionLoading(false);
          return;
        }
        payload.new_date = iso;
      }
      const res = await hospitalService.respondAppointmentAnticipation(
        anticipationTarget.id,
        payload,
      );
      setAnticipationTarget(null);
      setActionSuccess(res.message || (action === 'accept' ? 'Déplacement accepté.' : 'Demande refusée.'));
      await refreshAll(hospitalId);
    } catch (err) {
      setActionError(err.message || 'Impossible de traiter la demande');
    } finally {
      setActionLoading(false);
    }
  };

  const getAnticipationBadge = (apt) => {
    if (apt?.anticipation_status !== 'PENDING') return null;
    const preferred = apt.anticipation_preferred_at ? new Date(apt.anticipation_preferred_at) : null;
    const current = apt.appointment_date ? new Date(apt.appointment_date) : null;
    let kind = 'Déplacement';
    if (preferred && current && !Number.isNaN(preferred.getTime()) && !Number.isNaN(current.getTime())) {
      kind = preferred < current ? 'Anticipation' : preferred > current ? 'Report' : 'Déplacement';
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
        <Clock className="w-3 h-3" /> {kind} demandé
      </span>
    );
  };

  const renderWorkflowActions = (apt) => (
    <div className="flex items-center gap-1 flex-wrap">
      {renderAdminReviewActions(apt)}
      {apt.anticipation_status === 'PENDING' && (
        <button
          type="button"
          onClick={() => openAnticipationModal(apt)}
          disabled={actionLoading}
          className="px-2 py-1 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <Clock className="w-3.5 h-3.5" /> Déplacer
        </button>
      )}
      {!needsAdminReview(apt) && apt.status === 'CONFIRMED' && (
        <button onClick={() => handleCheckIn(apt.id)} className="px-2 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100" title="Enregistrer arrivée">Arrivée</button>
      )}
      {!needsAdminReview(apt) && apt.status === 'PATIENT_ARRIVED' && (
        <button onClick={() => handleWaitingRoom(apt.id)} className="px-2 py-1 text-xs font-semibold bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100" title="Salle d'attente">Salle attente</button>
      )}
      {!needsAdminReview(apt) && (apt.status === 'WAITING_ROOM' || apt.status === 'PATIENT_ARRIVED' || apt.status === 'CONFIRMED') && (
        <button onClick={() => handleStart(apt.id)} className="px-2 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100" title="Marquer présent / démarrer">Démarrer</button>
      )}
      {!needsAdminReview(apt) && (apt.status === 'PRESENT' || apt.status === 'IN_PROGRESS') && (
        <button onClick={() => handleComplete(apt.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Terminer"><CheckCircle className="w-4 h-4" /></button>
      )}
      {!needsAdminReview(apt) && ['CONFIRMED', 'PATIENT_ARRIVED', 'WAITING_ROOM'].includes(apt.status) && (
        <button onClick={() => handleMarkNoShow(apt.id)} className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200" title="Patient absent">Absent</button>
      )}
      <button onClick={() => openDetail(apt)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Historique"><Eye className="w-4 h-4" /></button>
    </div>
  );

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
    const matchesService = filterService === 'ALL'
      || String(apt.service) === String(filterService)
      || String(apt.slot_details?.service) === String(filterService);
    const matchesSearch = apt.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          apt.patient_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          apt.patient_phone?.includes(searchQuery) ||
                          apt.reference_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          apt.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doctorSearchBlob(apt).includes(searchQuery.toLowerCase());
    return matchesStatus && matchesType && matchesService && matchesSearch;
  });

  const pendingRequests = appointments
    .filter(needsAdminReview)
    .filter((apt) => filterService === 'ALL'
      || String(apt.service) === String(filterService)
      || String(apt.slot_details?.service) === String(filterService))
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

  const anticipationRequests = appointments
    .filter((apt) => apt.anticipation_status === 'PENDING')
    .sort((a, b) => new Date(b.anticipation_requested_at || b.updated_at || 0) - new Date(a.anticipation_requested_at || a.updated_at || 0));

  const renderReviewSummary = (apt) => (
    <div className="grid sm:grid-cols-2 gap-3 text-sm">
      <div className="space-y-1">
        <p><span className="text-gray-500">Patient :</span> <strong>{apt.patient_name || '—'}</strong></p>
        <p className="flex flex-wrap gap-3 text-xs text-gray-600">
          {apt.patient_phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{apt.patient_phone}</span>}
          {apt.patient_email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{apt.patient_email}</span>}
        </p>
        <p><span className="text-gray-500">Motif consultation :</span> {apt.reason || 'Non précisé'}</p>
        <p><span className="text-gray-500">Demande reçue le :</span> {formatBookingDate(apt.created_at)}</p>
      </div>
      <div className="space-y-1">
        <p><span className="text-gray-500">Médecin :</span> {doctorLabel(apt)}</p>
        <p><span className="text-gray-500">Service :</span> {apt.service_name || '—'}</p>
        <p><span className="text-gray-500">Date du rendez-vous :</span> {formatAppointmentDate(apt.appointment_date)}</p>
        {apt.slot_details && (
          <p><span className="text-gray-500">Session :</span> {apt.slot_details.title} ({apt.slot_details.start_time?.substring(0, 5)} – {apt.slot_details.end_time?.substring(0, 5)})</p>
        )}
        <p className="flex flex-wrap gap-2 items-center">
          <span className="font-mono text-indigo-700 font-bold text-xs bg-indigo-50 px-2 py-0.5 rounded">{apt.reference_code || '—'}</span>
          <span className="text-xs text-gray-500">Ordre #{apt.queue_number || '—'}</span>
          {getTypeBadge(apt.consultation_type)}
          {getPaymentBadge(apt)}
          {getAnticipationBadge(apt)}
        </p>
      </div>
    </div>
  );

  const renderAdminReviewActions = (apt, size = 'md') => {
    if (!needsAdminReview(apt)) return null;
    const btnClass = size === 'lg'
      ? 'px-4 py-2 text-sm font-semibold rounded-xl'
      : 'px-2 py-1 text-xs font-semibold rounded-lg';
    const unpaid = apt.consultation_fee_amount > 0 && !['PAID', 'WAIVED', 'REFUNDED'].includes(apt.payment_status);
    const paidLocked = isPaidCollectible(apt);
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {unpaid && (
          <>
            <button
              type="button"
              onClick={() => handleMarkPaid(apt, false)}
              disabled={actionLoading}
              className={`${btnClass} bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-50`}
            >
              Marquer payé
            </button>
            <button
              type="button"
              onClick={() => handleMarkPaid(apt, true)}
              disabled={actionLoading}
              className={`${btnClass} bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 disabled:opacity-50`}
            >
              Exonérer
            </button>
          </>
        )}
        {paidLocked && (
          <button
            type="button"
            onClick={() => handleRefund(apt)}
            disabled={actionLoading}
            className={`${btnClass} bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50`}
            title="Rembourser le patient avant de pouvoir refuser"
          >
            Rembourser
          </button>
        )}
        <button
          type="button"
          onClick={() => openConfirmModal(apt)}
          disabled={actionLoading || unpaid}
          title={unpaid ? 'Paiement consultation requis avant confirmation' : ''}
          className={`${btnClass} bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1`}
        >
          <CheckCircle className="w-4 h-4" /> Confirmer
        </button>
        <button
          type="button"
          onClick={() => openRejectModal(apt)}
          disabled={actionLoading || paidLocked}
          title={paidLocked ? 'Remboursez d\'abord le patient (bouton Rembourser)' : ''}
          className={`${btnClass} bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 flex items-center gap-1`}
        >
          <XCircle className="w-4 h-4" /> Refuser
        </button>
      </div>
    );
  };

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
          <div className="flex gap-2">
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="px-4 py-2.5 bg-white border border-teal-600 text-teal-700 font-semibold text-sm rounded-xl flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Générer le mois (horaires)
            </button>
            <button
              onClick={openCreateSlotModal}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Créer un créneau
            </button>
          </div>
        )}
      </div>

      {!hospitalId && (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
          Vous n'avez pas encore configuré votre hôpital.
        </div>
      )}

      {hospitalId && (
        <p className="text-xs text-gray-500">
          Paramètres RDV (références, emails) :{' '}
          <Link to="/hospital/settings" className="text-teal-600 font-semibold hover:underline">Paramètres hôpital</Link>
        </p>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-200 text-sm flex items-start gap-2">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          {actionSuccess}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'RDV du jour', value: stats.today_total, color: 'text-teal-700' },
            { label: 'En attente', value: stats.pending, color: 'text-yellow-600', tab: 'requests' },
            { label: 'Confirmés', value: stats.confirmed_today, color: 'text-blue-600' },
            { label: 'Salle attente', value: stats.in_waiting_room, color: 'text-purple-600' },
            { label: 'En consultation', value: stats.in_consultation, color: 'text-indigo-600' },
            { label: 'Terminés', value: stats.completed_today, color: 'text-green-600' },
            { label: 'Absents', value: stats.no_show_today, color: 'text-gray-600' },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => s.tab && setActiveTab(s.tab)}
              className={`bg-white rounded-xl border border-gray-200 p-3 text-center w-full ${s.tab ? 'hover:border-teal-400 cursor-pointer' : 'cursor-default'}`}
            >
              <p className={`text-xl font-extrabold ${s.color}`}>{s.value ?? 0}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {hospitalId && (
        <>
          {/* Navigation par Onglets */}
          <div className="flex border-b border-gray-200 gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === 'requests'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Demandes à traiter
              {(pendingRequests.length + anticipationRequests.length) > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingRequests.length + anticipationRequests.length}
                </span>
              )}
            </button>

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
              Liste Globale ({appointments.length})
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
                activeTab === 'queue'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              File d'attente ({queue.length})
            </button>
          </div>

          {/* TAB 0: DEMANDES À TRAITER (admin confirme / refuse) */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {anticipationRequests.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-950">
                    <p className="font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Demandes de déplacement ({anticipationRequests.length})
                    </p>
                    <p className="mt-1 text-orange-900/80 text-xs">
                      Le patient souhaite anticiper (plus tôt) ou reporter (plus tard) son rendez-vous.
                      Acceptez avec une nouvelle date, ou refusez en gardant le créneau initial.
                    </p>
                  </div>
                  {anticipationRequests.map((apt) => (
                    <div key={`ant-${apt.id}`} className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm overflow-hidden">
                      <div className="bg-orange-50 px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-orange-100">
                        <div className="flex items-center gap-3 flex-wrap">
                          {getStatusBadge(apt.status)}
                          {getAnticipationBadge(apt)}
                          <span className="text-xs text-gray-500">
                            Demandé le {formatBookingDate(apt.anticipation_requested_at || apt.updated_at)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAnticipationModal(apt)}
                          disabled={actionLoading}
                          className="px-4 py-2 text-sm font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <Clock className="w-4 h-4" /> Traiter
                        </button>
                      </div>
                      <div className="p-5 space-y-2 text-sm">
                        {renderReviewSummary(apt)}
                        <div className="mt-3 p-3 rounded-xl bg-orange-50/80 border border-orange-100 text-xs text-orange-950 space-y-1">
                          <p><span className="font-semibold">Motif patient :</span> {apt.anticipation_reason || '—'}</p>
                          <p>
                            <span className="font-semibold">Date souhaitée :</span>{' '}
                            {apt.anticipation_preferred_at
                              ? formatAppointmentDate(apt.anticipation_preferred_at)
                              : 'À convenir avec l\'hôpital'}
                          </p>
                          <p>
                            <span className="font-semibold">Créneau actuel :</span>{' '}
                            {formatAppointmentDate(apt.appointment_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
                <p className="font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Validation administrative des postulations
                </p>
                <p className="mt-1 text-amber-800/90">
                  Chaque demande patient doit être <strong>confirmée</strong> (message personnalisable) ou <strong>refusée avec un motif</strong>.
                  Le patient et le médecin concerné sont notifiés dans les deux cas.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold">Filtrer par service :</span>
                  <select
                    value={filterService}
                    onChange={(e) => setFilterService(e.target.value)}
                    className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="ALL">Tous les services</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-amber-700/80">{pendingRequests.length} demande(s)</span>
                </div>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700">Aucune demande en attente de validation.</p>
                  <p className="text-xs text-gray-400 mt-1">Les nouvelles postulations apparaîtront ici automatiquement.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((apt) => (
                    <div key={apt.id} className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
                      <div className="bg-amber-50 px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-amber-100">
                        <div className="flex items-center gap-3">
                          {getStatusBadge(apt.status)}
                          <span className="text-xs text-gray-500">
                            Demande reçue le {formatBookingDate(apt.created_at)}
                          </span>
                        </div>
                        {renderAdminReviewActions(apt, 'lg')}
                      </div>
                      <div className="p-5">
                        {renderReviewSummary(apt)}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                          <button type="button" onClick={() => openDetail(apt)} className="text-xs text-teal-700 font-semibold hover:underline flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Voir l'historique complet
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    const postulants = appointments.filter(
                      (a) => String(getAppointmentSlotId(a)) === String(slot.id)
                    );
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
                                slot.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-600 border border-gray-300'
                              }`}>
                                {slot.is_active ? 'Publié (visible client)' : 'Brouillon (non visible)'}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">{slot.title}</h3>
                            {slot.service_name && (
                              <p className="text-xs font-semibold text-teal-700 mt-0.5">
                                Service : {slot.service_name}
                              </p>
                            )}
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
                            {!slot.is_active && (
                              <button
                                type="button"
                                onClick={() => openEditDraftSlot(slot)}
                                className="px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100"
                                title="Modifier ce brouillon"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Modifier
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleSlotStatus(slot.id, slot.is_active)}
                              className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1 ${
                                slot.is_active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {slot.is_active ? <><EyeOff className="w-3.5 h-3.5" /> Dépublier</> : <><Eye className="w-3.5 h-3.5" /> Publier</>}
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
                                        <p className="font-bold text-gray-900">{apt.patient_name || 'Patient'}</p>
                                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 mt-0.5">
                                          {apt.patient_phone && (
                                            <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{apt.patient_phone}</span>
                                          )}
                                          {apt.patient_email && (
                                            <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{apt.patient_email}</span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-0.5">Motif: {apt.reason || 'Non précisé'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {getStatusBadge(apt.status)}
                                      {renderAdminReviewActions(apt)}
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
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                      <span className="text-sm font-medium text-gray-600">Statut:</span>
                      {['ALL', 'PENDING', 'REQUEST_SENT', 'CONFIRMED', 'REJECTED', 'PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(status => (
                        <button
                          key={status}
                          onClick={() => setFilterStatus(status)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                            filterStatus === status
                              ? 'bg-teal-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {status === 'ALL' ? 'Tous' : (APPOINTMENT_STATUS_LABELS[status] || status)}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full md:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Patient, médecin, service…"
                        className="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">Service:</span>
                    <select
                      value={filterService}
                      onChange={(e) => setFilterService(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 min-w-[220px]"
                    >
                      <option value="ALL">Tous les services</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <span className="text-sm font-medium text-gray-600">Type:</span>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50"
                    >
                      <option value="ALL">Tous</option>
                      <option value="IN_PERSON">Présentiel</option>
                      <option value="TELEMEDICINE">Téléconsultation</option>
                    </select>
                    <span className="text-xs text-gray-400 ml-auto">{filteredAppointments.length} rendez-vous</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">N° Suivi</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">N° Ordre</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Patient</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Service</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Médecin</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Demande reçue</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Date du RDV</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Type</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Statut</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="text-center py-8 text-gray-500">
                            Aucun rendez-vous trouvé.
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map(apt => (
                          <tr key={apt.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200 font-mono">
                                {apt.reference_code || '—'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs">
                                #{apt.queue_number || '—'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xs">
                                  {apt.patient_name?.[0] || 'P'}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900 text-sm">{apt.patient_name || 'Patient'}</p>
                                  <p className="text-[11px] text-gray-500">
                                    {[apt.patient_phone, apt.patient_email].filter(Boolean).join(' · ') || 'Coordonnées non renseignées'}
                                  </p>
                                  <p className="text-[11px] text-gray-400">{apt.reason || 'Pas de motif'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-100 px-2 py-1 rounded-lg">
                                {apt.service_name || '—'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm text-gray-900">
                                <Stethoscope className="w-4 h-4 text-teal-600" />
                                <span>
                                  {doctorLabel(apt)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs text-gray-600">
                                {formatBookingDate(apt.created_at)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Clock className="w-4 h-4 text-gray-400" />
                                {formatAppointmentDate(apt.appointment_date)}
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
                              {apt.status === 'REJECTED' && apt.cancellation_reason && (
                                <p className="text-[10px] text-red-600 mt-1 max-w-[180px]">Motif : {apt.cancellation_reason}</p>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {renderWorkflowActions(apt)}
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

          {/* TAB 3: FILE D'ATTENTE */}
          {activeTab === 'queue' && (
            <div className="space-y-3">
              {queue.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold">Aucun patient dans la file pour le moment.</p>
                </div>
              ) : (
                queue.map((apt, idx) => (
                  <div key={apt.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 rounded-full bg-teal-600 text-white font-extrabold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900">{apt.patient_name || 'Patient'}</p>
                        <p className="text-xs text-gray-500">
                          {doctorLabel(apt)}
                          {' · '}{formatDate(apt.appointment_date)}
                          {apt.slot_details?.start_time && ` · ${apt.slot_details.start_time.substring(0, 5)}`}
                        </p>
                        <p className="text-[11px] text-gray-400 font-mono">{apt.reference_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(apt.status)}
                      {renderWorkflowActions(apt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {detailAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Détail du rendez-vous</h3>
                <p className="text-sm font-mono text-indigo-600">{detailAppointment.reference_code}</p>
              </div>
              <button onClick={() => setDetailAppointment(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="text-gray-500">Patient :</span> <strong>{detailAppointment.patient_name}</strong></p>
              <p><span className="text-gray-500">Statut :</span> {getStatusBadge(detailAppointment.status)}</p>
              <p className="col-span-2"><span className="text-gray-500">Motif :</span> {detailAppointment.reason || '—'}</p>
              <p className="col-span-2"><span className="text-gray-500">Demande reçue le :</span> {formatBookingDate(detailAppointment.created_at)}</p>
              <p className="col-span-2"><span className="text-gray-500">Date du rendez-vous :</span> {formatAppointmentDate(detailAppointment.appointment_date)}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">Historique</h4>
              {detailHistory.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun événement enregistré.</p>
              ) : (
                <div className="space-y-2">
                  {detailHistory.map((ev) => (
                    <div key={ev.id} className="text-xs border-l-2 border-teal-400 pl-3 py-1">
                      <p className="font-semibold text-gray-800">{ev.event_type_display || ev.event_type}</p>
                      <p className="text-gray-500">
                        {ev.previous_status && ev.new_status && `${APPOINTMENT_STATUS_LABELS[ev.previous_status] || ev.previous_status} → ${APPOINTMENT_STATUS_LABELS[ev.new_status] || ev.new_status}`}
                        {ev.comment && ` — ${ev.comment}`}
                      </p>
                      <p className="text-[10px] text-gray-400">{ev.created_at && new Date(ev.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATION / EDITION CRENEAU BROUILLON */}
      {isSlotModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {editingSlotId ? <Pencil className="text-teal-600 w-5 h-5" /> : <Plus className="text-teal-600" />}
                {editingSlotId ? 'Modifier le créneau (brouillon)' : 'Créer une Session / Créneau de RDV'}
              </h3>
              <button
                type="button"
                onClick={closeSlotModal}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {editingSlotId && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Créneau en <strong>brouillon</strong> (non visible côté client).
                {editingSlotBookedCount > 0 && (
                  <> Déjà {editingSlotBookedCount} inscription(s) — capacité minimale : {editingSlotBookedCount}.</>
                )}
              </div>
            )}

            <form onSubmit={handleSaveSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Service médical *</label>
                <select
                  required
                  value={slotFormData.service}
                  onChange={e => setSlotFormData({
                    ...slotFormData,
                    service: e.target.value,
                    doctor: '',
                    title: e.target.value
                      ? (services.find((s) => String(s.id) === String(e.target.value))?.name || slotFormData.title)
                      : slotFormData.title,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">-- Choisir le service (obligatoire) --</option>
                  {services.map(srv => (
                    <option key={srv.id} value={srv.id}>{srv.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Le patient sélectionnera ce service avant de voir les créneaux disponibles.
                </p>
              </div>

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
                  disabled={!slotFormData.service}
                  value={slotFormData.doctor}
                  onChange={e => setSlotFormData({ ...slotFormData, doctor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-gray-100"
                >
                  <option value="">
                    {slotFormData.service ? '-- Sélectionner un médecin --' : '-- Choisissez d’abord un service --'}
                  </option>
                  {doctors
                    .filter((doc) => {
                      if (!slotFormData.service) return false;
                      const svcIds = (doc.services || []).map((s) => String(s.id || s));
                      const assigned = svcIds.includes(String(slotFormData.service));
                      const headOf = services.find((s) => String(s.id) === String(slotFormData.service));
                      const isHead = headOf && String(headOf.head_doctor) === String(doc.id);
                      const anyLinked = doctors.some((d) =>
                        (d.services || []).some((s) => String(s.id || s) === String(slotFormData.service))
                      );
                      const isCurrent = String(doc.id) === String(slotFormData.doctor);
                      return assigned || isHead || !anyLinked || isCurrent;
                    })
                    .map(doc => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.user_details?.first_name} {doc.user_details?.last_name} ({doc.staff_category_display || 'Médecin'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Capacité Max. (Nombre de Patients) *</label>
                <input
                  type="number"
                  min={Math.max(1, editingSlotBookedCount || 1)}
                  max="100"
                  required
                  value={slotFormData.max_patients}
                  onChange={e => setSlotFormData({ ...slotFormData, max_patients: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-teal-700 outline-none focus:ring-2 focus:ring-teal-600"
                />
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
                    disabled
                    title="Bientôt disponible"
                    className="p-2.5 rounded-xl border border-gray-200 text-xs font-semibold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                  >
                    <Video className="w-4 h-4 text-gray-400" /> Téléconsultation — bientôt
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeSlotModal}
                  className="px-4 py-2 text-gray-600 text-sm font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingSlot}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow transition cursor-pointer"
                >
                  {submittingSlot
                    ? (editingSlotId ? 'Enregistrement...' : 'Création...')
                    : (editingSlotId ? 'Enregistrer les modifications' : 'Créer en brouillon')}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 text-center">
                {editingSlotId
                  ? 'Les modifications restent en brouillon jusqu’à publication.'
                  : 'Le créneau sera invisible côté client jusqu\'à publication.'}
              </p>
            </form>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Confirmer la postulation
            </h3>
            <p className="text-sm text-gray-600">
              Personnalisez le message envoyé au patient. Le médecin assigné sera également notifié.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              {renderReviewSummary(confirmTarget)}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Message de confirmation au patient *</label>
              <p className="text-[11px] text-gray-500 mb-2">Ce texte sera envoyé par email et notification in-app au patient.</p>
              <textarea
                required
                rows={8}
                value={confirmMessage}
                onChange={(e) => setConfirmMessage(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-xl text-sm font-mono leading-relaxed"
                placeholder="Rédigez le message de confirmation..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setConfirmTarget(null); setConfirmMessage(''); }} disabled={actionLoading} className="px-4 py-2 text-sm">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleConfirm(confirmTarget.id)}
                disabled={actionLoading || !confirmMessage.trim()}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Confirmation...' : 'Confirmer et notifier patient + médecin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleReject} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Refuser la postulation
            </h3>
            <div className="bg-gray-50 rounded-xl p-3 text-sm border border-gray-100">
              <p><strong>{rejectTarget.patient_name}</strong></p>
              <p className="text-xs text-gray-500 font-mono mt-1">{rejectTarget.reference_code || '—'}</p>
              {rejectTarget.payment_status === 'REFUNDED' && (
                <p className="text-[11px] text-violet-700 mt-2 font-medium">
                  Consultation déjà remboursée — le refus peut être confirmé.
                </p>
              )}
              {isPaidCollectible(rejectTarget) && (
                <p className="text-[11px] text-amber-800 mt-2 font-medium">
                  Le paiement sera remboursé automatiquement au patient à la confirmation du refus.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Motif du refus *</label>
              <p className="text-[11px] text-gray-500 mb-2">Ce motif sera communiqué au patient et au médecin par email et notification.</p>
              <div className="space-y-2 mt-2">
                {REJECT_REASON_PRESETS.map((preset) => (
                  <label key={preset} className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer text-xs ${
                    rejectPreset === preset ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="rejectPreset"
                      value={preset}
                      checked={rejectPreset === preset}
                      onChange={() => { setRejectPreset(preset); setRejectReason(''); }}
                      className="mt-0.5"
                    />
                    {preset}
                  </label>
                ))}
                <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer text-xs ${
                  rejectPreset === 'CUSTOM' ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    name="rejectPreset"
                    value="CUSTOM"
                    checked={rejectPreset === 'CUSTOM'}
                    onChange={() => setRejectPreset('CUSTOM')}
                    className="mt-0.5"
                  />
                  Autre motif (préciser ci-dessous)
                </label>
              </div>
              {(rejectPreset === 'CUSTOM' || !rejectPreset) && (
                <textarea
                  required={rejectPreset === 'CUSTOM' || !rejectPreset}
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => { setRejectReason(e.target.value); if (!rejectPreset) setRejectPreset('CUSTOM'); }}
                  className="w-full mt-3 px-3 py-2 border rounded-xl text-sm"
                  placeholder="Décrivez la raison du refus..."
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectTarget(null)} disabled={actionLoading} className="px-4 py-2 text-sm">
                Annuler
              </button>
              <button
                type="submit"
                disabled={actionLoading || !(rejectPreset === 'CUSTOM' ? rejectReason.trim() : rejectPreset)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Envoi...' : 'Refuser et notifier patient + médecin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {anticipationTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Demande de déplacement
            </h3>
            <div className="bg-gray-50 rounded-xl p-3 text-sm border border-gray-100 space-y-1">
              <p><strong>{anticipationTarget.patient_name}</strong></p>
              <p className="text-xs text-gray-500 font-mono">{anticipationTarget.reference_code || '—'}</p>
              <p className="text-xs">Créneau actuel : <strong>{formatAppointmentDate(anticipationTarget.appointment_date)}</strong></p>
              <p className="text-xs">Motif : {anticipationTarget.anticipation_reason || '—'}</p>
              <p className="text-xs">
                Souhait patient :{' '}
                <strong>
                  {anticipationTarget.anticipation_preferred_at
                    ? formatAppointmentDate(anticipationTarget.anticipation_preferred_at)
                    : 'À convenir'}
                </strong>
                {anticipationTarget.anticipation_preferred_at && anticipationTarget.appointment_date && (
                  <span className="ml-1 text-amber-800">
                    (
                    {new Date(anticipationTarget.anticipation_preferred_at) < new Date(anticipationTarget.appointment_date)
                      ? 'anticiper'
                      : 'reporter'}
                    )
                  </span>
                )}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Nouvelle date (si acceptation) *</label>
              <input
                type="datetime-local"
                value={anticipationNewDate}
                onChange={(e) => setAnticipationNewDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700">Note au patient</label>
              <textarea
                rows={3}
                value={anticipationNote}
                onChange={(e) => setAnticipationNote(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"
                placeholder="Message visible par le patient…"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setAnticipationTarget(null)}
                className="px-4 py-2 text-sm"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleRespondAnticipation('refuse')}
                className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Refuser
              </button>
              <button
                type="button"
                disabled={actionLoading || (!anticipationNewDate && !anticipationTarget.anticipation_preferred_at)}
                onClick={() => handleRespondAnticipation('accept')}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Traitement…' : 'Accepter le déplacement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGenerateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Générer les créneaux du mois</h3>
            <p className="text-xs text-gray-500">À partir des horaires hebdomadaires configurés dans « Horaires ».</p>
            <form onSubmit={handleGenerateMonthly} className="space-y-3">
              <div>
                <label className="text-xs font-bold">Service *</label>
                <select
                  required
                  value={generateForm.service}
                  onChange={(e) => setGenerateForm({ ...generateForm, service: e.target.value, doctor: '' })}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm"
                >
                  <option value="">-- Choisir le service --</option>
                  {services.map((srv) => (
                    <option key={srv.id} value={srv.id}>{srv.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold">Médecin *</label>
                <select
                  required
                  disabled={!generateForm.service}
                  value={generateForm.doctor}
                  onChange={(e) => setGenerateForm({ ...generateForm, doctor: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm disabled:opacity-50"
                >
                  <option value="">
                    {generateForm.service ? '-- Choisir --' : '-- Choisissez d’abord un service --'}
                  </option>
                  {doctors
                    .filter((d) => {
                      if (!generateForm.service) return false;
                      const svcIds = (d.services || []).map((s) => String(s.id || s));
                      const assigned = svcIds.includes(String(generateForm.service));
                      const headOf = services.find((s) => String(s.id) === String(generateForm.service));
                      const isHead = headOf && String(headOf.head_doctor) === String(d.id);
                      return assigned || isHead;
                    })
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.user_details?.first_name} {d.user_details?.last_name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold">Année</label>
                  <input type="number" value={generateForm.year}
                    onChange={(e) => setGenerateForm({ ...generateForm, year: parseInt(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold">Mois</label>
                  <input type="number" min={1} max={12} value={generateForm.month}
                    onChange={(e) => setGenerateForm({ ...generateForm, month: parseInt(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold">Places max. par session</label>
                <input type="number" min={1} value={generateForm.max_patients}
                  onChange={(e) => setGenerateForm({ ...generateForm, max_patients: parseInt(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={generateForm.publish}
                  onChange={(e) => setGenerateForm({ ...generateForm, publish: e.target.checked })} />
                Publier immédiatement côté client
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsGenerateModalOpen(false)} className="px-4 py-2 text-sm">Annuler</button>
                <button type="submit" disabled={generating} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm">
                  {generating ? 'Génération...' : 'Générer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
