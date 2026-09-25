import React, { useState, useEffect } from 'react';
import {
  Clock, Plus, Calendar, Trash2, Edit2, Stethoscope,
  Users, CalendarRange, Loader2, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import hospitalService from '../hospitalService';

const DAYS_OF_WEEK = [
  { id: 0, name: 'Lundi' },
  { id: 1, name: 'Mardi' },
  { id: 2, name: 'Mercredi' },
  { id: 3, name: 'Jeudi' },
  { id: 4, name: 'Vendredi' },
  { id: 5, name: 'Samedi' },
  { id: 6, name: 'Dimanche' },
];

const DEFAULT_TEMPLATE_DAYS = [0, 1, 2, 3, 4];

const fieldClass =
  'w-full px-3 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500';
const labelClass = 'block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

function doctorLabel(doc) {
  return `${doc.user_details?.first_name || ''} ${doc.user_details?.last_name || ''}`.trim()
    || doc.full_name
    || 'Médecin';
}

const HOSPITAL_TZ = 'Africa/Bujumbura';
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function hospitalParts(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: HOSPITAL_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    weekday: WEEKDAY_INDEX[bag.weekday] ?? 0,
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    minutes: Number(bag.hour) * 60 + Number(bag.minute),
  };
}

function parseClock(value) {
  const [hour, minute] = String(value || '00:00').slice(0, 5).split(':').map((n) => parseInt(n, 10));
  return (hour || 0) * 60 + (minute || 0);
}

function todayIso(now = new Date()) {
  const parts = hospitalParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function weekdayFromIso(iso) {
  if (!iso) return 0;
  const [year, month, day] = iso.split('-').map(Number);
  return hospitalParts(new Date(Date.UTC(year, month - 1, day, 10, 0, 0))).weekday;
}

function formatCivilDate(iso) {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: HOSPITAL_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, day, 10, 0, 0)));
}

function addDaysIso(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 10, 0, 0));
  const parts = hospitalParts(next);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function endMoment(scheduleDate, startTime, endTime) {
  if (!scheduleDate || !startTime || !endTime) return null;
  const overnight = parseClock(endTime) <= parseClock(startTime);
  const endDate = overnight ? addDaysIso(scheduleDate, 1) : scheduleDate;
  return {
    overnight,
    endDate,
    label: `${formatCivilDate(endDate)} à ${String(endTime).slice(0, 5)}`,
  };
}

function nextDateForWeekday(dayOfWeek, now = new Date()) {
  const parts = hospitalParts(now);
  const delta = (dayOfWeek - parts.weekday + 7) % 7;
  return addDaysIso(todayIso(now), delta);
}

function civilKey(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return year * 10000 + month * 100 + day;
}

function describeDatedWindow(scheduleDate, startTime, endTime, now = new Date()) {
  const end = endMoment(scheduleDate, startTime, endTime);
  const parts = hospitalParts(now);
  const nowKey = parts.year * 10000 + parts.month * 100 + parts.day;
  const startKey = civilKey(scheduleDate);
  const endKey = civilKey(end.endDate);
  const started = nowKey > startKey || (nowKey === startKey && parts.minutes >= parseClock(startTime));
  const finished = nowKey > endKey || (nowKey === endKey && parts.minutes >= parseClock(endTime));
  const nextDate = finished ? addDaysIso(scheduleDate, 7) : scheduleDate;
  return {
    status: finished ? 'elapsed' : (started ? 'in_progress' : 'upcoming'),
    nextLabel: formatCivilDate(nextDate),
    endLabel: end.label,
  };
}
function describeWindow(dayOfWeek, startTime, endTime, now = new Date()) {
  const parts = hospitalParts(now);
  const start = parseClock(startTime);
  const end = parseClock(endTime);
  let delta = (dayOfWeek - parts.weekday + 7) % 7;
  let status = 'upcoming';
  if (delta === 0 && parts.minutes >= end) {
    delta = 7;
    status = 'elapsed';
  } else if (delta === 0 && parts.minutes >= start) {
    status = 'in_progress';
  }
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta, 12, 0, 0));
  const nextLabel = new Intl.DateTimeFormat('fr-FR', {
    timeZone: HOSPITAL_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(next);
  return { status, nextLabel, endLabel: '' };
}

function formatHospitalClock(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: HOSPITAL_TZ,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export default function ManageSchedules() {
  const { isAuthenticated } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitalId, setHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [formData, setFormData] = useState({
    doctor: '',
    schedule_date: '',
    day_of_week: 0,
    start_time: '08:00',
    end_time: '16:00',
    is_available: true,
  });

  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    start_time: '08:00',
    end_time: '16:00',
    days: [...DEFAULT_TEMPLATE_DAYS],
    replace: true,
    doctor_ids: [],
  });

  const [planningAlerts, setPlanningAlerts] = useState(null);
  const [clock, setClock] = useState(() => new Date());
  const [monthGenerating, setMonthGenerating] = useState(false);
  const [monthResult, setMonthResult] = useState(null);
  const [monthForm, setMonthForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    max_patients: 10,
    publish: false,
  });

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      try {
        const businesses = await hospitalService.getMyHospital();
        const list = normalizeList(businesses);
        if (list.length > 0) {
          const hid = list[0].id;
          setHospitalId(hid);
          await Promise.all([fetchDoctors(hid), fetchSchedules(hid), fetchPlanningAlerts(hid)]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isAuthenticated]);

  const fetchDoctors = async (hid) => {
    try {
      const data = await hospitalService.getDoctors({ hospital: hid, is_active: 'true' });
      const list = normalizeList(data).filter(
        (d) => d.staff_category !== 'NURSE'
          && d.staff_category !== 'RECEPTIONIST'
          && d.staff_category !== 'ACCOUNTANT'
          && d.professional_title !== 'INFIRMIER'
      );
      setDoctors(list);
      if (list.length > 0) {
        setFormData((prev) => ({ ...prev, doctor: prev.doctor || list[0].id }));
      }
    } catch (err) {
      console.error(err);
      setDoctors([]);
    }
  };

  const fetchSchedules = async (hid, docId = '') => {
    try {
      setLoading(true);
      const filters = { hospital: hid };
      if (docId) filters.doctor = docId;
      const data = await hospitalService.getSchedules(filters);
      setSchedules(normalizeList(data));
    } catch (err) {
      console.error(err);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanningAlerts = async (hid) => {
    try {
      const data = await hospitalService.getPlanningAlerts(hid);
      setPlanningAlerts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hospitalId) return undefined;
    const id = setInterval(() => fetchPlanningAlerts(hospitalId), 60000);
    return () => clearInterval(id);
  }, [hospitalId]);

  const handleDoctorFilterChange = (docId) => {
    setSelectedDoctorId(docId);
    if (hospitalId) fetchSchedules(hospitalId, docId);
  };

  const openCreateModal = () => {
    const scheduleDate = todayIso();
    setEditingScheduleId(null);
    setFormData({
      doctor: doctors[0]?.id || '',
      schedule_date: scheduleDate,
      day_of_week: weekdayFromIso(scheduleDate),
      start_time: '08:00',
      end_time: '16:00',
      is_available: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (sch) => {
    const scheduleDate = sch.schedule_date || nextDateForWeekday(sch.day_of_week);
    setEditingScheduleId(sch.id);
    setFormData({
      doctor: sch.doctor,
      schedule_date: scheduleDate,
      day_of_week: weekdayFromIso(scheduleDate),
      start_time: sch.start_time?.slice(0, 5) || '08:00',
      end_time: sch.end_time?.slice(0, 5) || '16:00',
      is_available: sch.is_available,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce créneau d'horaire ?")) return;
    try {
      await hospitalService.deleteSchedule(id);
      fetchSchedules(hospitalId, selectedDoctorId);
      fetchPlanningAlerts(hospitalId);
    } catch (err) {
      if (err?.status === 404) {
        fetchSchedules(hospitalId, selectedDoctorId);
        fetchPlanningAlerts(hospitalId);
        alert("Ce créneau n'est plus là. La liste a été actualisée.");
        return;
      }
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.schedule_date) {
      alert("Indiquez la date du créneau pour déterminer l'heure de fin.");
      return;
    }
    if (formData.start_time === formData.end_time) {
      alert("L'heure de fin doit être différente de l'heure de début.");
      return;
    }
    try {
      const body = {
        ...formData,
        hospital: hospitalId,
        day_of_week: weekdayFromIso(formData.schedule_date),
      };
      if (editingScheduleId) {
        await hospitalService.updateSchedule(editingScheduleId, body);
      } else {
        await hospitalService.createSchedule(body);
      }
      setIsModalOpen(false);
      fetchSchedules(hospitalId, selectedDoctorId);
      fetchPlanningAlerts(hospitalId);
    } catch (err) {
      if (err?.status === 404) {
        setIsModalOpen(false);
        fetchSchedules(hospitalId, selectedDoctorId);
        fetchPlanningAlerts(hospitalId);
        alert("Ce créneau n'est plus là. La liste a été actualisée.");
        return;
      }
      alert(err.message || 'Erreur lors de la sauvegarde');
    }
  };

  const toggleTemplateDay = (dayId) => {
    setTemplateForm((prev) => {
      const days = prev.days.includes(dayId)
        ? prev.days.filter((d) => d !== dayId)
        : [...prev.days, dayId].sort((a, b) => a - b);
      return { ...prev, days };
    });
  };

  const toggleTemplateDoctor = (doctorId) => {
    setTemplateForm((prev) => {
      const doctor_ids = prev.doctor_ids.includes(doctorId)
        ? prev.doctor_ids.filter((id) => id !== doctorId)
        : [...prev.doctor_ids, doctorId];
      return { ...prev, doctor_ids };
    });
  };

  const handleApplyTemplate = async (e) => {
    e.preventDefault();
    if (templateForm.days.length === 0) {
      alert('Sélectionnez au moins un jour.');
      return;
    }
    const targetLabel = templateForm.doctor_ids.length
      ? `${templateForm.doctor_ids.length} médecin(s) sélectionné(s)`
      : 'tous les médecins';
    if (!window.confirm(
      templateForm.replace
        ? `Remplacer les horaires de ${targetLabel} par ce modèle ?`
        : `Appliquer ce modèle à ${targetLabel} ?`
    )) return;

    setTemplateSaving(true);
    try {
      const schedulesPayload = templateForm.days.map((day) => ({
        day_of_week: day,
        start_time: templateForm.start_time,
        end_time: templateForm.end_time,
        is_available: true,
      }));
      const result = await hospitalService.applyScheduleTemplate({
        hospital_id: hospitalId,
        schedules: schedulesPayload,
        replace: templateForm.replace,
        ...(templateForm.doctor_ids.length > 0 ? { doctor_ids: templateForm.doctor_ids } : {}),
      });
      alert(result.message || 'Modèle appliqué.');
      await fetchSchedules(hospitalId, selectedDoctorId);
      await fetchPlanningAlerts(hospitalId);
    } catch (err) {
      alert(err.message || 'Erreur lors de l’application du modèle');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleGenerateMonth = async (e) => {
    e.preventDefault();
    setMonthGenerating(true);
    setMonthResult(null);
    try {
      const result = await hospitalService.generateMonthlySlotsAll({
        hospital: hospitalId,
        year: monthForm.year,
        month: monthForm.month,
        max_patients: monthForm.max_patients,
        publish: monthForm.publish,
      });
      setMonthResult(result);
      fetchPlanningAlerts(hospitalId);
    } catch (err) {
      alert(err.message || 'Erreur lors de la génération');
    } finally {
      setMonthGenerating(false);
    }
  };

  const monthLabel = new Date(monthForm.year, monthForm.month - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const disabledBulk = !hospitalId || doctors.length === 0;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-2xl border-duo bg-surface p-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-7 h-7 text-accent" />
            Gestion des Horaires & Planning
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Les créneaux se réinitialisent dès que l&apos;heure de fin est passée. L&apos;admin est prévenu s&apos;il manque un créneau ou un rendez-vous.
          </p>
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mt-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Heure hôpital (Bujumbura) : {formatHospitalClock(clock)}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={disabledBulk}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-md shadow-teal-600/20 transition cursor-pointer disabled:opacity-50 text-sm"
        >
          <Plus className="w-4 h-4" /> Nouveau créneau
        </button>
      </div>

      {(planningAlerts?.alert_count > 0 || planningAlerts?.rolled_count > 0) && (
        <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="font-bold text-amber-950 dark:text-amber-100">
                Signalement planning
                {planningAlerts.alert_count > 0 ? ` · ${planningAlerts.alert_count}` : ''}
              </h2>
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                Un créneau dont le jour et l&apos;heure sont dépassés est fermé, puis repris à la prochaine occurrence avec la capacité au complet.
                {planningAlerts.rolled_count > 0
                  ? ` ${planningAlerts.rolled_count} créneau(x) vient d'être réinitialisé.`
                  : ''}
              </p>
            </div>
          </div>
          {(planningAlerts.missing_slots || []).length > 0 && (
            <ul className="text-sm space-y-1 text-amber-950 dark:text-amber-50">
              {planningAlerts.missing_slots.map((item) => (
                <li key={`slot-${item.doctor_id}-${item.next_date || 'none'}`}>
                  <span className="font-semibold">{item.doctor_name}</span>
                  {item.next_date ? ` — ${item.next_date}` : ''} — {item.reason}
                </li>
              ))}
            </ul>
          )}
          {(planningAlerts.missing_appointments || []).length > 0 && (
            <ul className="text-sm space-y-1 text-amber-950 dark:text-amber-50">
              {planningAlerts.missing_appointments.map((item) => (
                <li key={`rdv-${item.slot_id}`}>
                  <span className="font-semibold">{item.doctor_name}</span>
                  {' '}— {item.slot_date} {item.start_time}–{item.end_time} : {item.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Formulaires toujours visibles */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Modèle d'horaires pour tous */}
        <section className="rounded-2xl border-2 border-accent bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-primary text-white flex items-center gap-2 border-b-2 border-accent">
            <Users className="w-5 h-5" />
            <div>
              <h2 className="font-bold text-base">Modèle d’horaires pour tous</h2>
              <p className="text-teal-100 text-xs mt-0.5">Semaine type appliquée en une fois</p>
            </div>
          </div>
          <form onSubmit={handleApplyTemplate} className="p-5 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Définissez les jours et la plage horaire, puis appliquez-les à tous les médecins (ou une sélection).
            </p>

            <div>
              <label className={labelClass}>Jours travaillés</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => {
                  const active = templateForm.days.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleTemplateDay(d.id)}
                      className={`min-w-[3.25rem] px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        active
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-teal-400'
                      }`}
                    >
                      {d.name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Heure de début</label>
                <input
                  type="time"
                  required
                  value={templateForm.start_time}
                  onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Heure de fin</label>
                <input
                  type="time"
                  required
                  value={templateForm.end_time}
                  onChange={(e) => setTemplateForm({ ...templateForm, end_time: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  Médecins concernés
                </label>
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, doctor_ids: [] })}
                  className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                >
                  Tous les médecins
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/80 divide-y divide-gray-100 dark:divide-gray-700">
                {doctors.length === 0 ? (
                  <p className="p-3 text-xs text-gray-500">Aucun médecin disponible.</p>
                ) : (
                  doctors.map((doc) => {
                    const checked = templateForm.doctor_ids.length === 0
                      || templateForm.doctor_ids.includes(doc.id);
                    const isExplicit = templateForm.doctor_ids.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-900 dark:text-white cursor-pointer hover:bg-teal-50/80 dark:hover:bg-teal-950/40"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (templateForm.doctor_ids.length === 0) {
                              // Passer de « tous » à une sélection exclusive
                              setTemplateForm({
                                ...templateForm,
                                doctor_ids: doctors.map((d) => d.id).filter((id) => id !== doc.id),
                              });
                            } else {
                              toggleTemplateDoctor(doc.id);
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="font-medium">{doctorLabel(doc)}</span>
                        {!isExplicit && templateForm.doctor_ids.length === 0 && (
                          <span className="ml-auto text-[10px] text-teal-600 dark:text-teal-400 font-semibold">tous</span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                {templateForm.doctor_ids.length === 0
                  ? 'Tous les médecins seront mis à jour.'
                  : `${templateForm.doctor_ids.length} médecin(s) sélectionné(s).`}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={templateForm.replace}
                onChange={(e) => setTemplateForm({ ...templateForm, replace: e.target.checked })}
                className="w-4 h-4 rounded text-teal-600"
              />
              Remplacer les horaires existants
            </label>

            <button
              type="submit"
              disabled={disabledBulk || templateSaving}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {templateSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {templateSaving ? 'Application...' : 'Appliquer le modèle'}
            </button>
          </form>
        </section>

        {/* Planning mensuel — tous */}
        <section className="rounded-2xl border-2 border-alert bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-primary text-white flex items-center gap-2 border-b-2 border-alert">
            <CalendarRange className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-bold text-base">Planning mensuel — tous les médecins</h2>
              <p className="text-surface/80 text-xs mt-0.5">Génération des créneaux RDV du mois</p>
            </div>
          </div>
          <form onSubmit={handleGenerateMonth} className="p-5 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Crée les créneaux à partir des horaires hebdomadaires. Service = premier service associé à chaque médecin.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Année</label>
                <input
                  type="number"
                  required
                  value={monthForm.year}
                  onChange={(e) => setMonthForm({ ...monthForm, year: parseInt(e.target.value, 10) || monthForm.year })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Mois (1–12)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={monthForm.month}
                  onChange={(e) => setMonthForm({ ...monthForm, month: parseInt(e.target.value, 10) || 1 })}
                  className={fieldClass}
                />
              </div>
            </div>

            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 capitalize">
              {monthLabel}
            </p>

            <div>
              <label className={labelClass}>Places max. par session</label>
              <input
                type="number"
                min={1}
                value={monthForm.max_patients}
                onChange={(e) => setMonthForm({ ...monthForm, max_patients: parseInt(e.target.value, 10) || 1 })}
                className={fieldClass}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={monthForm.publish}
                onChange={(e) => setMonthForm({ ...monthForm, publish: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600"
              />
              Publier immédiatement côté client
            </label>

            {monthResult && (
              <div className="p-3 rounded-xl text-xs space-y-2 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 max-h-44 overflow-y-auto">
                <p className="font-semibold text-emerald-800 dark:text-emerald-200">{monthResult.message}</p>
                {(monthResult.doctors || []).map((d) => (
                  <p key={d.doctor_id} className="text-gray-700 dark:text-gray-300">
                    {d.doctor_name} — {d.service_name} : {d.created_count} créneau(x)
                  </p>
                ))}
                {(monthResult.skipped || []).length > 0 && (
                  <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                    <p className="font-semibold text-amber-700 dark:text-amber-300">Ignorés</p>
                    {monthResult.skipped.map((s) => (
                      <p key={s.doctor_id} className="text-amber-800 dark:text-amber-200/90">
                        {s.doctor_name} : {s.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={disabledBulk || monthGenerating}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {monthGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
              {monthGenerating ? 'Génération...' : 'Générer pour tous'}
            </button>
          </form>
        </section>
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-accent shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 whitespace-nowrap">
          <Stethoscope className="w-4 h-4 text-teal-600" />
          Filtrer la grille par médecin :
        </label>
        <select
          value={selectedDoctorId}
          onChange={(e) => handleDoctorFilterChange(e.target.value)}
          className={`${fieldClass} sm:w-72`}
        >
          <option value="">Tous les médecins de l&apos;hôpital</option>
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>{doctorLabel(doc)}</option>
          ))}
        </select>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-teal-600" />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {DAYS_OF_WEEK.map((day) => {
          const daySchedules = schedules.filter((s) => s.day_of_week === day.id);
          return (
            <div key={day.id} className={`bg-white dark:bg-gray-900 rounded-2xl border-2 overflow-hidden shadow-sm flex flex-col ${
              day.id % 2 === 0 ? 'border-accent' : 'border-alert'
            }`}>
              <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  {day.name}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                  {daySchedules.length} créneau(x)
                </span>
              </div>
              <div className="p-4 flex-1 space-y-3">
                {daySchedules.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">Aucun horaire configuré</p>
                ) : (
                  daySchedules.map((sch) => {
                    const windowInfo = sch.schedule_date
                      ? describeDatedWindow(sch.schedule_date, sch.start_time, sch.end_time, clock)
                      : describeWindow(sch.day_of_week, sch.start_time, sch.end_time, clock);
                    const statusLabel = windowInfo.status === 'in_progress'
                      ? `En cours jusqu'à ${sch.end_time?.slice(0, 5)}`
                      : windowInfo.status === 'elapsed'
                        ? `Terminé — reprise le ${windowInfo.nextLabel}`
                        : `Prochain créneau : ${windowInfo.nextLabel}`;
                    const statusClass = windowInfo.status === 'in_progress'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : windowInfo.status === 'elapsed'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-gray-500 dark:text-gray-400';
                    return (
                    <div key={sch.id} className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-gray-900 dark:text-white">{sch.doctor_name}</div>
                        {sch.schedule_date && (
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatCivilDate(sch.schedule_date)}
                            {windowInfo.endLabel ? ` · fin ${windowInfo.endLabel}` : ''}
                          </div>
                        )}
                        <div className="text-xs font-mono text-teal-600 dark:text-teal-400 font-bold mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {sch.start_time?.slice(0, 5)} - {sch.end_time?.slice(0, 5)}
                        </div>
                        <p className={`text-[11px] font-semibold mt-1 ${statusClass}`}>{statusLabel}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => openEditModal(sch)} className="icon-btn">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(sch.id)} className="icon-btn icon-btn--danger">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                {editingScheduleId ? 'Modifier le créneau' : 'Nouveau créneau'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Médecin</label>
                <select
                  required
                  value={formData.doctor}
                  onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                  className={fieldClass}
                >
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doctorLabel(doc)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Date du créneau</label>
                <input
                  type="date"
                  required
                  value={formData.schedule_date}
                  onChange={(e) => {
                    const scheduleDate = e.target.value;
                    setFormData({
                      ...formData,
                      schedule_date: scheduleDate,
                      day_of_week: weekdayFromIso(scheduleDate),
                    });
                  }}
                  className={fieldClass}
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Jour déduit : {DAYS_OF_WEEK.find((d) => d.id === formData.day_of_week)?.name || '—'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Début</label>
                  <input type="time" required value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Fin</label>
                  <input type="time" required value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className={fieldClass} />
                </div>
              </div>
              {formData.schedule_date && formData.start_time && formData.end_time && formData.start_time !== formData.end_time && (
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                  Heure de fin : {endMoment(formData.schedule_date, formData.start_time, formData.end_time)?.label}
                  {parseClock(formData.end_time) <= parseClock(formData.start_time) ? ' (lendemain)' : ''}
                </p>
              )}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded" />
                Disponible sur ce créneau
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Annuler</button>
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
                  {editingScheduleId ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
