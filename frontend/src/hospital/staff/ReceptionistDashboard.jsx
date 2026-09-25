import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, Users, Search, Building2, CheckCircle, AlertCircle,
  Calendar, Stethoscope, HeartPulse, Clock, History, Phone, Mail,
  MapPin, Navigation, Hash, FileText, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService, { APPOINTMENT_STATUS_LABELS } from '../hospitalService';

const normalizeList = (data) => (Array.isArray(data) ? data : (data?.results || []));

const STATUS_COLORS = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PATIENT_ARRIVED: 'bg-emerald-100 text-emerald-700',
  WAITING_ROOM: 'bg-purple-100 text-purple-700',
  PRESENT: 'bg-teal-100 text-teal-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

const ALREADY_ORIENTED = new Set([
  'PATIENT_ARRIVED', 'WAITING_ROOM', 'PRESENT', 'IN_PROGRESS', 'COMPLETED',
]);

function isAlreadyOriented(apt) {
  return ALREADY_ORIENTED.has(String(apt?.status || '').toUpperCase());
}

function doctorFullName(apt) {
  if (apt?.doctor_name) return apt.doctor_name;
  const d = apt?.doctor_details;
  if (!d) return '—';
  if (d.full_name) return d.full_name;
  const first = d.user_details?.first_name || '';
  const last = d.user_details?.last_name || '';
  return `${first} ${last}`.trim() || '—';
}

export default function ReceptionistDashboard() {
  const { isAuthenticated, user } = useAuth();
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmedList, setConfirmedList] = useState([]);
  const [queue, setQueue] = useState([]);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [arrivalSearch, setArrivalSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [orientationNotes, setOrientationNotes] = useState('');
  const [sendToWaitingRoom, setSendToWaitingRoom] = useState(true);
  const [orienting, setOrienting] = useState(false);

  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [filterService, setFilterService] = useState('ALL');

  const refresh = useCallback(async (hid) => {
    try {
      const [queueData, apptData, statsData, servicesData] = await Promise.all([
        hospitalService.getQueue(hid),
        hospitalService.getAppointments({ hospital: hid, status: 'CONFIRMED' }),
        hospitalService.getStats(hid),
        hospitalService.getServices(hid, true),
      ]);
      setQueue(normalizeList(queueData));
      setConfirmedList(normalizeList(apptData));
      setStats(statsData);
      setServices(normalizeList(servicesData).filter((s) => s.is_active !== false));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) { setLoading(false); return; }
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = Array.isArray(businesses) ? businesses : [];
        if (list.length > 0) {
          setHospitalId(list[0].id);
          await refresh(list[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    init();
  }, [isAuthenticated, refresh]);

  useEffect(() => {
    if (!hospitalId || arrivalSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await hospitalService.searchConfirmedAppointments(hospitalId, arrivalSearch.trim());
        const results = normalizeList(data);
        setSearchResults(results);
        if (results.length === 1) {
          selectAppointment(results[0]);
        } else if (results.length === 0) {
          setSelectedAppointment(null);
          setActionError('');
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [arrivalSearch, hospitalId]);

  const selectAppointment = (apt) => {
    setSelectedAppointment(apt);
    setOrientationNotes('');
    setActionError('');
    setSuccessMsg('');
    if (isAlreadyOriented(apt)) {
      const when = apt.checked_in_at
        ? new Date(apt.checked_in_at).toLocaleString('fr-FR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        : null;
      setActionError(
        `Ce rendez-vous a déjà été orienté`
        + (when ? ` le ${when}` : '')
        + ` — statut : ${APPOINTMENT_STATUS_LABELS[apt.status] || apt.status}.`
        + (apt.location_notes ? ` Orientation : ${apt.location_notes}` : '')
      );
    }
  };

  const handleOrientPatient = async () => {
    if (!selectedAppointment || selectedAppointment.status !== 'CONFIRMED') return;
    setOrienting(true);
    setActionError('');
    setSuccessMsg('');
    try {
      const result = await hospitalService.checkInAppointment(selectedAppointment.id, {
        orientation_notes: orientationNotes.trim(),
        send_to_waiting_room: sendToWaitingRoom,
      });
      const orient = result?.orientation || {};
      const doctorLabel = orient.doctor || doctorFullName(selectedAppointment);
      const serviceLabel = orient.service || selectedAppointment.service_name || '—';
      setSuccessMsg(
        `Patient orienté vers Dr. ${doctorLabel}`
        + (serviceLabel && serviceLabel !== '—' ? ` (${serviceLabel})` : '')
        + `. Statut : ${APPOINTMENT_STATUS_LABELS[result.status] || result.status}. Médecin notifié.`
      );
      setArrivalSearch('');
      setSearchResults([]);
      setSelectedAppointment(null);
      setOrientationNotes('');
      await refresh(hospitalId);
    } catch (err) {
      setActionError(err.message || 'Impossible d\'orienter le patient');
    } finally {
      setOrienting(false);
    }
  };

  const openHistory = async (apt) => {
    setHistoryTarget(apt);
    try {
      const events = await hospitalService.getAppointmentHistory(apt.id);
      setHistoryEvents(Array.isArray(events) ? events : []);
    } catch {
      setHistoryEvents([]);
    }
  };

  const getStatusBadge = (status) => {
    const label = APPOINTMENT_STATUS_LABELS[status] || status;
    const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>{label}</span>;
  };

  const formatTime = (apt) => {
    if (apt.slot_details?.start_time) return apt.slot_details.start_time.substring(0, 5);
    if (apt.appointment_date) {
      return new Date(apt.appointment_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return '—';
  };

  const formatDate = (apt) => {
    if (!apt.appointment_date) return '—';
    return new Date(apt.appointment_date).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const kpiCards = [
    { label: 'Patients attendus', value: stats?.expected_today ?? '—', icon: Calendar, color: 'text-teal-600' },
    { label: 'Arrivées du jour', value: stats?.arrivals_today ?? '—', icon: UserCheck, color: 'text-emerald-600' },
    { label: 'File d\'attente', value: stats?.in_waiting_room ?? '—', icon: Users, color: 'text-purple-600' },
    { label: 'RDV confirmés', value: confirmedList.length, icon: CheckCircle, color: 'text-blue-600' },
    { label: 'Consultations en retard', value: stats?.late_consultations ?? '—', icon: AlertCircle, color: 'text-red-600' },
    { label: 'Services disponibles', value: stats?.available_services ?? services.length, icon: HeartPulse, color: 'text-indigo-600' },
  ];

  const orientationPreview = selectedAppointment
    ? `Orienter vers Dr. ${doctorFullName(selectedAppointment)}`
      + (selectedAppointment.service_name ? ` — Service : ${selectedAppointment.service_name}` : '')
      + (selectedAppointment.slot_details?.title ? ` — Session : ${selectedAppointment.slot_details.title}` : '')
    : '';

  const matchesService = (apt) => {
    if (filterService === 'ALL') return true;
    return String(apt.service) === String(filterService)
      || String(apt.slot_details?.service) === String(filterService);
  };
  const filteredConfirmed = confirmedList.filter(matchesService);
  const filteredQueue = queue.filter(matchesService);

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-r from-teal-900 to-emerald-900 p-6 rounded-2xl text-white">
        <p className="text-xs text-teal-200 mb-1">{user?.business_info?.role_name || 'Agent d\'accueil'}</p>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="text-teal-400" /> Accueil & Orientation
        </h1>
        <p className="text-teal-100 text-sm mt-1">
          Rechercher le patient (nom ou N° RDV) → consulter le dossier → orienter vers le médecin / service → notification automatique
        </p>
      </div>

      {actionError && (
        <div
          className={`p-3 rounded-xl text-sm border ${
            selectedAppointment && isAlreadyOriented(selectedAppointment)
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-red-50 text-red-700 border-red-100'
          }`}
        >
          {actionError}
        </div>
      )}
      {successMsg && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-100">{successMsg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase">{label}</p>
              <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            </div>
            <Icon className={`w-8 h-8 ${color} opacity-80`} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
          <Stethoscope className="w-3.5 h-3.5" /> Triage par service
        </span>
        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 min-w-[200px]"
        >
          <option value="ALL">Tous les services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="text-[11px] text-gray-400">
          {filteredConfirmed.length} confirmé(s) · {filteredQueue.length} en file
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {/* Recherche + orientation */}
          <div className="bg-white rounded-2xl border-2 border-teal-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-teal-600" /> Arrivée patient & orientation
            </h2>
            <p className="text-xs text-gray-500">
              Saisissez le <strong>nom</strong> ou le <strong>numéro de rendez-vous</strong> (ex. RDV-BAHO-…).
              Le dossier complet s’affiche pour orienter le patient vers le médecin ou le service chargé.
            </p>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
              <input
                type="text"
                value={arrivalSearch}
                onChange={(e) => {
                  setArrivalSearch(e.target.value);
                  if (e.target.value.trim().length < 2) setSelectedAppointment(null);
                }}
                placeholder="Nom du patient ou N° RDV…"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-gray-50"
              />
            </div>

            {searching && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recherche…
              </p>
            )}
            {arrivalSearch.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                Aucun rendez-vous trouvé pour « {arrivalSearch} » (confirmé ou déjà orienté).
              </p>
            )}

            {searchResults.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">
                  {searchResults.length} rendez-vous — sélectionnez le bon :
                </p>
                {searchResults.map((apt) => (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => selectAppointment(apt)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                      selectedAppointment?.id === apt.id
                        ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-400'
                        : isAlreadyOriented(apt)
                          ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
                          : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <strong className="text-gray-900">{apt.patient_name}</strong>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-indigo-600">{apt.reference_code}</span>
                        {getStatusBadge(apt.status)}
                      </div>
                    </div>
                    <p className="text-gray-500 mt-0.5">
                      {formatDate(apt)} · {formatTime(apt)} · Dr. {doctorFullName(apt)}
                      {apt.service_name ? ` · ${apt.service_name}` : ''}
                    </p>
                    {isAlreadyOriented(apt) && (
                      <p className="text-amber-800 font-semibold mt-1">Déjà orienté</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Dossier complet + orientation */}
            {selectedAppointment && (
              <div className="rounded-2xl border border-teal-100 bg-teal-50/40 overflow-hidden">
                <div className="px-4 py-3 bg-teal-700 text-white flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-bold text-sm">Dossier rendez-vous</span>
                  </div>
                  {getStatusBadge(selectedAppointment.status)}
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="sm:col-span-2 flex items-start gap-2">
                    <Hash className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500">N° de suivi</p>
                      <p className="font-mono font-bold text-indigo-700 text-base">
                        {selectedAppointment.reference_code || '—'}
                      </p>
                      {selectedAppointment.queue_number != null && (
                        <p className="text-xs text-gray-600">Ordre de passage : #{selectedAppointment.queue_number}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500">Patient</p>
                    <p className="font-bold text-gray-900">{selectedAppointment.patient_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500">Date & heure</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      {formatDate(selectedAppointment)} · {formatTime(selectedAppointment)}
                    </p>
                  </div>

                  <div className="flex items-start gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500">Téléphone</p>
                      <p className="text-gray-800">{selectedAppointment.patient_phone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500">Email</p>
                      <p className="text-gray-800 break-all">{selectedAppointment.patient_email || '—'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-teal-100 p-3 sm:col-span-2">
                    <p className="text-[10px] uppercase font-bold text-teal-700 mb-2">Orientation selon le RDV</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <p className="flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4 text-teal-600" />
                        <span><strong>Médecin :</strong> Dr. {doctorFullName(selectedAppointment)}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <HeartPulse className="w-4 h-4 text-teal-600" />
                        <span><strong>Service :</strong> {selectedAppointment.service_name || selectedAppointment.slot_details?.service_name || '—'}</span>
                      </p>
                      {selectedAppointment.slot_details?.title && (
                        <p className="flex items-center gap-1.5 sm:col-span-2">
                          <Clock className="w-4 h-4 text-teal-600" />
                          <span><strong>Session :</strong> {selectedAppointment.slot_details.title}</span>
                        </p>
                      )}
                      {selectedAppointment.doctor_details?.staff_category_display && (
                        <p className="text-xs text-gray-500 sm:col-span-2">
                          {selectedAppointment.doctor_details.staff_category_display}
                          {selectedAppointment.doctor_details.professional_title_display
                            ? ` · ${selectedAppointment.doctor_details.professional_title_display}`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedAppointment.reason && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase font-bold text-gray-500">Motif</p>
                      <p className="text-gray-800">{selectedAppointment.reason}</p>
                    </div>
                  )}
                </div>

                {selectedAppointment.status === 'CONFIRMED' ? (
                  <div className="px-4 pb-4 space-y-3 border-t border-teal-100 pt-4 bg-white/60">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900">
                      <p className="font-bold flex items-center gap-1 mb-1">
                        <MapPin className="w-3.5 h-3.5" /> Destination d’orientation
                      </p>
                      <p>{orientationPreview}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Précisions d’orientation (salle, étage, consignes…)
                      </label>
                      <textarea
                        rows={2}
                        value={orientationNotes}
                        onChange={(e) => setOrientationNotes(e.target.value)}
                        placeholder="Ex. : Salle d’attente A, 1er étage — apporter carte d’identité"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendToWaitingRoom}
                        onChange={(e) => setSendToWaitingRoom(e.target.checked)}
                        className="w-4 h-4 rounded text-teal-600"
                      />
                      Placer en salle d’attente après orientation
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={orienting}
                        onClick={handleOrientPatient}
                        className="flex-1 min-w-[200px] py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {orienting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                        {orienting ? 'Orientation…' : 'Orienter le patient & notifier le médecin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistory(selectedAppointment)}
                        className="px-4 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl flex items-center gap-1"
                      >
                        <History className="w-4 h-4" /> Historique
                      </button>
                    </div>
                  </div>
                ) : isAlreadyOriented(selectedAppointment) ? (
                  <div className="px-4 pb-4 space-y-3 border-t border-amber-100 pt-4 bg-amber-50/80">
                    <div className="p-3 rounded-xl bg-amber-100 border border-amber-200 text-sm text-amber-950">
                      <p className="font-bold flex items-center gap-1.5 mb-1">
                        <UserCheck className="w-4 h-4" />
                        Ce rendez-vous a déjà été orienté
                      </p>
                      <p className="text-xs">
                        Statut actuel :{' '}
                        <strong>
                          {APPOINTMENT_STATUS_LABELS[selectedAppointment.status] || selectedAppointment.status}
                        </strong>
                        {selectedAppointment.checked_in_at && (
                          <>
                            {' '}
                            — arrivée enregistrée le{' '}
                            {new Date(selectedAppointment.checked_in_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </>
                        )}
                      </p>
                      {selectedAppointment.location_notes && (
                        <p className="text-xs mt-2">
                          <strong>Orientation :</strong> {selectedAppointment.location_notes}
                        </p>
                      )}
                      <p className="text-xs mt-2 text-amber-800">
                        Aucune nouvelle orientation n’est nécessaire.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openHistory(selectedAppointment)}
                      className="px-4 py-2.5 bg-white border border-amber-200 text-amber-900 text-sm font-semibold rounded-xl flex items-center gap-1"
                    >
                      <History className="w-4 h-4" /> Voir l’historique
                    </button>
                  </div>
                ) : (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
                      Ce rendez-vous n’est plus orientable ({APPOINTMENT_STATUS_LABELS[selectedAppointment.status] || selectedAppointment.status}).
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Liste confirmés */}
          <div className="bg-white rounded-2xl border p-5">
            <h2 className="font-bold text-sm flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-blue-600" /> Rendez-vous confirmés ({filteredConfirmed.length})
            </h2>
            {loading ? (
              <p className="text-sm text-gray-400">Chargement...</p>
            ) : filteredConfirmed.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun RDV confirmé en attente d&apos;arrivée.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredConfirmed.map((apt) => (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => {
                      selectAppointment(apt);
                      setArrivalSearch(apt.reference_code || apt.patient_name || '');
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      selectedAppointment?.id === apt.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-200 bg-white'
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <div>
                        <p className="font-bold text-sm text-gray-900">{apt.patient_name}</p>
                        <p className="text-[11px] font-mono text-indigo-600">{apt.reference_code}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Dr. {doctorFullName(apt)}
                          {apt.service_name ? ` · ${apt.service_name}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">{formatDate(apt)} · {formatTime(apt)}</p>
                      </div>
                      {getStatusBadge(apt.status)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* File */}
          <div className="bg-white rounded-2xl border p-5">
            <h2 className="font-bold text-sm flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-600" /> File d&apos;attente ({filteredQueue.length})
            </h2>
            {filteredQueue.length === 0 ? (
              <p className="text-sm text-gray-400">Personne en file pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {filteredQueue.map((apt, idx) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">{idx + 1}</span>
                      <div>
                        <p className="font-bold">{apt.patient_name}</p>
                        <p className="text-gray-500">
                          {formatTime(apt)} · Dr. {doctorFullName(apt)}
                          {apt.service_name ? ` · ${apt.service_name}` : ''}
                        </p>
                        {apt.location_notes && (
                          <p className="text-[10px] text-teal-700 mt-0.5">{apt.location_notes}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(apt.status)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-4 h-fit sticky top-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <HeartPulse className="w-4 h-4 text-indigo-600" /> Services disponibles
          </h3>
          {services.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun service actif.</p>
          ) : (
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id} className="text-xs p-2 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">{s.name}</span>
                  {s.head_doctor_name && (
                    <p className="text-gray-500 mt-0.5">Chef : {s.head_doctor_name}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {historyTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold mb-1">Historique — {historyTarget.patient_name}</h3>
            <p className="text-xs font-mono text-indigo-600 mb-4">{historyTarget.reference_code}</p>
            {historyEvents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun événement.</p>
            ) : (
              <div className="space-y-2">
                {historyEvents.map((ev) => (
                  <div key={ev.id} className="text-xs border-l-2 border-teal-400 pl-3 py-1">
                    <p className="font-semibold">{ev.event_type_display || ev.event_type}</p>
                    <p className="text-gray-500">
                      {ev.previous_status && ev.new_status && `${APPOINTMENT_STATUS_LABELS[ev.previous_status] || ev.previous_status} → ${APPOINTMENT_STATUS_LABELS[ev.new_status] || ev.new_status}`}
                    </p>
                    {ev.comment && <p className="text-teal-700 mt-0.5">{ev.comment}</p>}
                    <p className="text-[10px] text-gray-400">{ev.created_at && new Date(ev.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setHistoryTarget(null)} className="mt-4 w-full py-2 bg-gray-100 rounded-xl text-sm font-semibold">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
