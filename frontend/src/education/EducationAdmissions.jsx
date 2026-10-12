import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../shared/api';
import { EDUCATION_ENUM_FALLBACK } from './educationEnums';

const input = 'w-full px-3 py-2 text-sm bg-surface border-2 border-accent rounded-xl text-ink outline-none focus:border-alert';
const card = 'p-5 rounded-2xl border-2 border-accent bg-white dark:bg-gray-900 shadow-sm';
const tealBtn = 'bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2.5 font-medium shadow-md shadow-teal-600/20';

const STATUS_LABEL = {
  ENVOYEE: 'Envoyée',
  EN_INSTRUCTION: 'En instruction',
  COMPLEMENT_DEMANDE: 'Complément demandé',
  LISTE_ATTENTE: 'Liste d’attente',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  CONFIRMEE: 'Confirmée',
};

const NEXT_BY_STATUS = {
  ENVOYEE: [
    { value: 'EN_INSTRUCTION', label: 'Mettre en instruction' },
    { value: 'COMPLEMENT_DEMANDE', label: 'Demander un complément', needsNote: true },
    { value: 'ACCEPTEE', label: 'Accepter' },
    { value: 'REFUSEE', label: 'Refuser', needsNote: true },
  ],
  EN_INSTRUCTION: [
    { value: 'COMPLEMENT_DEMANDE', label: 'Demander un complément', needsNote: true },
    { value: 'ACCEPTEE', label: 'Accepter' },
    { value: 'REFUSEE', label: 'Refuser', needsNote: true },
  ],
  COMPLEMENT_DEMANDE: [
    { value: 'EN_INSTRUCTION', label: 'Reprendre l’instruction' },
    { value: 'ACCEPTEE', label: 'Accepter' },
    { value: 'REFUSEE', label: 'Refuser', needsNote: true },
  ],
  LISTE_ATTENTE: [
    { value: 'ACCEPTEE', label: 'Accepter' },
    { value: 'REFUSEE', label: 'Refuser', needsNote: true },
  ],
  ACCEPTEE: [
    { value: 'CONFIRMEE', label: 'Confirmer l’inscription' },
    { value: 'REFUSEE', label: 'Refuser', needsNote: true },
  ],
};

const SCHOOL_QUEUES = [
  { id: 'wait', label: 'Liste d’attente', statuses: ['LISTE_ATTENTE', 'ENVOYEE', 'EN_INSTRUCTION', 'COMPLEMENT_DEMANDE'] },
  { id: 'accepted', label: 'Acceptés', statuses: ['ACCEPTEE', 'CONFIRMEE'] },
  { id: 'refused', label: 'Refusés', statuses: ['REFUSEE'] },
];

const SCHOOL_ACTIONS = [
  { value: 'ACCEPTEE', label: 'Accepter' },
  { value: 'REFUSEE', label: 'Refuser' },
];

const QUEUES = [
  { id: 'todo', label: 'À traiter', statuses: ['ENVOYEE', 'EN_INSTRUCTION'] },
  { id: 'wait', label: 'Liste d’attente', statuses: ['LISTE_ATTENTE'] },
  { id: 'complement', label: 'Complément demandé', statuses: ['COMPLEMENT_DEMANDE'] },
  { id: 'accepted', label: 'Acceptés', statuses: ['ACCEPTEE', 'CONFIRMEE'] },
  { id: 'refused', label: 'Refusés', statuses: ['REFUSEE'] },
];

const PAY_LABEL = {
  PAID: 'Payé',
  UNPAID: 'Non payé',
  AWAITING_PIN: 'Paiement en cours',
  FAILED: 'Paiement échoué',
  WAIVED: 'Sans frais',
};

function mediaHref(file) {
  if (!file) return '';
  try {
    return new URL(file, window.location.origin).pathname;
  } catch {
    return file;
  }
}

const TRACK_META = {
  PRESCOLAIRE: 'Maternelle / Préscolaire',
  ECOFO: 'École fondamentale (ECOFO)',
  POST_FONDAMENTAL: 'Post-fondamental',
};

const EMPTY_CAMPAIGN = {
  program: '',
  academic_year: '',
  opens_on: '',
  closes_on: '',
  late_opens_on: '',
  late_closes_on: '',
  contest_name: '',
  contest_date: '',
  results_date: '',
  confirmation_start: '',
  confirmation_end: '',
  required_diploma: '',
  prerequisites: '',
  min_grade: '',
  extra_conditions: '',
  regulatory_requirements: '',
  required_documents: [{ label: '', description: '' }],
  extra_criteria: [],
  open_tracks: [],
};

const yearLabel = (year) => (Number(year) === 1 ? '1ère année' : `${year}ème année`);

function documentsPayload(rows) {
  return (rows || [])
    .map((row) => ({ label: (row.label || '').trim(), description: (row.description || '').trim() }))
    .filter((row) => row.label);
}

function offeredFromProfile(profile) {
  const tracks = [];
  if (profile?.offers_prescolaire) tracks.push('PRESCOLAIRE');
  if (profile?.offers_ecofo) tracks.push('ECOFO');
  if (profile?.offers_post_fondamental) tracks.push('POST_FONDAMENTAL');
  return tracks;
}

function ecofoYearsFromProfile(profile) {
  const fromClasses = (profile?.ecofo_classes || [])
    .map((row) => (row && typeof row === 'object' ? row : { value: String(row), label: String(row) }))
    .filter((row) => row.value);
  if (fromClasses.length) return fromClasses;
  return [];
}

function postSectionsFromProfile(profile) {
  return (profile?.post_fondamental_sections || [])
    .filter((row) => row && (row.name || '').trim())
    .map((row) => {
      const raw = row.classes || row.years || [1, 2, 3];
      const years = raw.map((item) => {
        if (item && typeof item === 'object') {
          return {
            value: String(item.value || '').trim(),
            label: String(item.label || item.value || '').trim(),
          };
        }
        const value = String(item);
        return { value, label: yearLabel(value) };
      }).filter((item) => item.value);
      return { name: row.name.trim(), years };
    });
}

function planKey(track, year = '', section = '') {
  return `${track}|${year}|${section}`;
}

function emptySchoolPlan(profile) {
  const seats = {};
  if (profile?.offers_prescolaire) {
    seats[planKey('PRESCOLAIRE')] = { enabled: true, seats: '40' };
  }
  ecofoYearsFromProfile(profile).forEach((year) => {
    seats[planKey('ECOFO', String(year.value))] = { enabled: true, seats: '40', label: year.label };
  });
  postSectionsFromProfile(profile).forEach((section) => {
    section.years.forEach((year) => {
      seats[planKey('POST_FONDAMENTAL', String(year.value), section.name)] = {
        enabled: true,
        seats: '30',
        label: year.label,
      };
    });
  });
  return seats;
}

function buildEnrollmentPlan(planState) {
  return Object.entries(planState || {})
    .filter(([, row]) => row.enabled)
    .map(([key, row]) => {
      const [track, year, section] = key.split('|');
      const seats = Number(row.seats);
      if (!Number.isFinite(seats) || seats < 1) return null;
      return {
        track,
        year: year || '',
        section: section || '',
        seats,
      };
    })
    .filter(Boolean);
}

export default function EducationAdmissions() {
  const [programs, setPrograms] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [applications, setApplications] = useState([]);
  const [refusal, setRefusal] = useState({});
  const [form, setForm] = useState(EMPTY_CAMPAIGN);
  const [planState, setPlanState] = useState({});
  const [feeLabel, setFeeLabel] = useState('Frais d’inscription');
  const [feeAmount, setFeeAmount] = useState('');
  const [queue, setQueue] = useState('wait');
  const [fee, setFee] = useState({ program: '', label: '', amount_bif: '', academic_year: '' });
  const [editingId, setEditingId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const isSchool = profile?.business_detail?.category_slug === 'ecole';
  const schoolTracks = useMemo(() => offeredFromProfile(profile), [profile]);
  const ecofoYears = useMemo(() => ecofoYearsFromProfile(profile), [profile]);
  const postSections = useMemo(() => postSectionsFromProfile(profile), [profile]);

  const load = () => {
    api.get('education/programs/', { auth: true }).then((data) => {
      setPrograms(Array.isArray(data) ? data : data?.results || []);
    }).catch((err) => setError(err.message));
    api.get('education/campaigns/?mine=1', { auth: true }).then((data) => {
      setCampaigns(Array.isArray(data) ? data : data?.results || []);
    }).catch(() => setCampaigns([]));
    api.get('education/profiles/my_profile/', { auth: true }).then(setProfile).catch(() => {});
    api.get('education/applications/', { auth: true }).then((data) => {
      setApplications(Array.isArray(data) ? data : data?.results || []);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isSchool || !profile) return;
    setPlanState((prev) => (Object.keys(prev).length ? prev : emptySchoolPlan(profile)));
  }, [isSchool, profile]);

  const setDoc = (index, key, value) => {
    const next = form.required_documents.map((row, i) => (
      i === index ? { ...row, [key]: value } : row
    ));
    setForm({ ...form, required_documents: next });
  };

  const setPlanRow = (key, patch) => {
    setPlanState((prev) => ({
      ...prev,
      [key]: { enabled: true, seats: '30', ...(prev[key] || {}), ...patch },
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_CAMPAIGN });
    setPlanState(isSchool ? emptySchoolPlan(profile) : {});
    setFeeLabel('Frais d’inscription');
    setFeeAmount('');
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setError('');
    setForm({
      ...EMPTY_CAMPAIGN,
      program: row.program || '',
      academic_year: row.academic_year || '',
      opens_on: row.opens_on || '',
      closes_on: row.closes_on || '',
      late_opens_on: row.late_opens_on || '',
      late_closes_on: row.late_closes_on || '',
      contest_name: row.contest_name || '',
      contest_date: row.contest_date || '',
      results_date: row.results_date || '',
      confirmation_start: row.confirmation_start || '',
      confirmation_end: row.confirmation_end || '',
      required_diploma: row.required_diploma || '',
      prerequisites: row.prerequisites || '',
      min_grade: row.min_grade || '',
      extra_conditions: row.extra_conditions || '',
      regulatory_requirements: row.regulatory_requirements || '',
      required_documents: (row.required_documents || []).length
        ? row.required_documents.map((doc) => ({
          label: doc.label || '',
          description: doc.description || '',
        }))
        : [{ label: '', description: '' }],
      extra_criteria: (row.extra_criteria || []).map((item) => ({
        kind: item.kind || 'TEST',
        label: item.label || '',
        date: item.date || '',
        place: item.place || '',
        details: item.details || '',
      })),
    });
    if (isSchool) {
      const base = emptySchoolPlan(profile);
      Object.keys(base).forEach((key) => {
        base[key] = { ...base[key], enabled: false };
      });
      (row.enrollment_plan || []).forEach((item) => {
        const key = planKey(item.track, item.year || '', item.section || '');
        base[key] = {
          ...(base[key] || {}),
          enabled: true,
          seats: String(item.seats),
        };
      });
      setPlanState(base);
      setFeeLabel(row.enrollment_fee?.label || 'Frais d’inscription');
      setFeeAmount(row.enrollment_fee ? String(row.enrollment_fee.amount_bif) : '0');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, required_documents: documentsPayload(form.required_documents) };
    if (isSchool) {
      payload.program = null;
      const enrollment_plan = buildEnrollmentPlan(planState);
      if (!enrollment_plan.length) {
        setError('Cochez au moins une année et indiquez le nombre de places.');
        return;
      }
      if (feeAmount === '' || Number.isNaN(Number(feeAmount)) || Number(feeAmount) < 0) {
        setError('Fixez le montant des frais d’inscription (0 = gratuit).');
        return;
      }
      payload.enrollment_plan = enrollment_plan;
      payload.open_tracks = [...new Set(enrollment_plan.map((row) => row.track))];
      payload.fee_label = feeLabel.trim() || 'Frais d’inscription';
      payload.fee_amount_bif = Number(feeAmount);
      payload.extra_criteria = (form.extra_criteria || [])
        .map((item) => ({
          kind: item.kind || 'OTHER',
          label: (item.label || '').trim(),
          date: item.date || '',
          place: (item.place || '').trim(),
          details: (item.details || '').trim(),
        }))
        .filter((item) => item.label || item.details);
    } else {
      payload.open_tracks = [];
      payload.enrollment_plan = [];
      if (!payload.program) {
        setError('Choisissez une formation.');
        return;
      }
    }
    ['late_opens_on', 'late_closes_on', 'contest_date', 'results_date', 'confirmation_start', 'confirmation_end']
      .forEach((key) => {
        if (!payload[key]) payload[key] = null;
      });
    try {
      if (editingId) {
        await api.patch(`education/campaigns/${editingId}/`, payload, { auth: true });
      } else {
        await api.post('education/campaigns/', payload, { auth: true });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleVisibility = async (row) => {
    setError('');
    try {
      await api.patch(`education/campaigns/${row.id}/`, { is_public: !row.is_public }, { auth: true });
      load();
    } catch (err) {
      setError(err.message || 'Impossible de changer la visibilité.');
    }
  };

  const removeCampaign = async (row) => {
    const label = isSchool ? `l’année scolaire ${row.academic_year}` : (row.program_title || row.academic_year);
    if (!window.confirm(`Supprimer ${label} ? Les candidatures liées seront aussi retirées.`)) return;
    setError('');
    try {
      await api.delete(`education/campaigns/${row.id}/`, { auth: true });
      if (editingId === row.id) resetForm();
      load();
    } catch (err) {
      setError(err.message || 'Suppression impossible.');
    }
  };

  const decide = async (id, status, needsNote) => {
    const note = (refusal[id] || '').trim();
    if (needsNote && !note) {
      setError(isSchool
        ? 'Le motif est obligatoire pour accepter ou refuser.'
        : (status === 'REFUSEE'
          ? 'Indiquez le motif du refus.'
          : 'Indiquez la pièce ou l’information demandée.'));
      return;
    }
    setError('');
    try {
      await api.post(`education/applications/${id}/decide/`, { status, note }, { auth: true });
      load();
    } catch (err) {
      setError(err.message || 'Action impossible sur ce dossier.');
      load();
    }
  };

  const createFee = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...fee,
      program: isSchool ? null : (fee.program || null),
      is_public: true,
    };
    try {
      await api.post('education/fees/', payload, { auth: true });
      setFee({ program: '', label: '', amount_bif: '', academic_year: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  const formatPlanSummary = (row) => {
    const plan = row.enrollment_plan || [];
    if (!plan.length) {
      return (row.open_tracks || []).map((code) => TRACK_META[code] || code).join(' · ');
    }
    return plan.map((item) => {
      const track = TRACK_META[item.track] || item.track;
      if (item.track === 'PRESCOLAIRE') return `${track} (${item.seats} places)`;
      if (item.track === 'ECOFO') return `${track} ${yearLabel(item.year)} (${item.seats})`;
      return `${item.section} · ${yearLabel(item.year)} (${item.seats})`;
    }).join(' · ');
  };

  const actionsFor = (row) => {
    if (!isSchool) return NEXT_BY_STATUS[row.status] || [];
    if (row.status === 'REFUSEE' || row.status === 'ACCEPTEE' || row.status === 'CONFIRMEE') return [];
    return SCHOOL_ACTIONS;
  };

  return (
    <div className="space-y-6 pb-10 text-ink">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border-duo bg-surface p-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-accent" /> {isSchool ? 'Admissions' : 'Admissions et frais'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {isSchool
              ? 'Ouvrez une année scolaire : dates, parcours, places et frais BurundiPay.'
              : 'Conditions, pièces et calendrier, par formation et par année académique.'}
          </p>
        </div>
      </div>
      {error && <div className="rounded-xl border-2 border-alert bg-alert/10 text-ink px-4 py-3 text-sm font-medium">{error}</div>}

      <form onSubmit={createCampaign} className={`${card} grid sm:grid-cols-2 gap-3`}>
        <h2 className="sm:col-span-2 font-extrabold text-ink text-lg">
          {editingId
            ? (isSchool ? 'Modifier l’année scolaire' : 'Modifier la campagne')
            : (isSchool ? 'Ouvrir les inscriptions' : 'Campagne d\'inscription')}
        </h2>
        {!isSchool && (
          <select className={input} value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} required>
            <option value="">Formation</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
        <input className={input} value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder={isSchool ? 'Année scolaire, ex. 2026-2027' : 'Année académique, ex. 2026-2027'} required />
        <label className="text-xs font-bold text-ink">
          Date d&apos;ouverture des inscriptions
          <input type="date" className={`${input} mt-1`} value={form.opens_on} onChange={(e) => setForm({ ...form, opens_on: e.target.value })} required />
        </label>
        <label className="text-xs font-bold text-ink">
          Date de fin des inscriptions
          <input type="date" className={`${input} mt-1`} value={form.closes_on} onChange={(e) => setForm({ ...form, closes_on: e.target.value })} required />
        </label>

        {!isSchool && (
          <>
            <label className="text-xs text-ink-muted">Inscription tardive, début
              <input type="date" className={`${input} mt-1`} value={form.late_opens_on} onChange={(e) => setForm({ ...form, late_opens_on: e.target.value })} />
            </label>
            <label className="text-xs text-ink-muted">Inscription tardive, fin
              <input type="date" className={`${input} mt-1`} value={form.late_closes_on} onChange={(e) => setForm({ ...form, late_closes_on: e.target.value })} />
            </label>
            <input className={input} value={form.contest_name} onChange={(e) => setForm({ ...form, contest_name: e.target.value })} placeholder="Concours ou test d'admission" />
            <label className="text-xs text-ink-muted">Date du concours
              <input type="date" className={`${input} mt-1`} value={form.contest_date} onChange={(e) => setForm({ ...form, contest_date: e.target.value })} />
            </label>
            <label className="text-xs text-ink-muted">Publication des résultats
              <input type="date" className={`${input} mt-1`} value={form.results_date} onChange={(e) => setForm({ ...form, results_date: e.target.value })} />
            </label>
            <label className="text-xs text-ink-muted">Confirmation, début
              <input type="date" className={`${input} mt-1`} value={form.confirmation_start} onChange={(e) => setForm({ ...form, confirmation_start: e.target.value })} />
            </label>
            <label className="text-xs text-ink-muted">Confirmation, fin
              <input type="date" className={`${input} mt-1`} value={form.confirmation_end} onChange={(e) => setForm({ ...form, confirmation_end: e.target.value })} />
            </label>
            <input className={input} value={form.required_diploma} onChange={(e) => setForm({ ...form, required_diploma: e.target.value })} placeholder="Diplôme ou niveau requis" />
            <input className={input} value={form.min_grade} onChange={(e) => setForm({ ...form, min_grade: e.target.value })} placeholder="Note minimale" />
            <textarea className={`${input} sm:col-span-2`} rows={2} value={form.prerequisites} onChange={(e) => setForm({ ...form, prerequisites: e.target.value })} placeholder="Matières ou prérequis" />
            <textarea className={`${input} sm:col-span-2`} rows={2} value={form.extra_conditions} onChange={(e) => setForm({ ...form, extra_conditions: e.target.value })} placeholder="Conditions particulières" />
            <textarea className={`${input} sm:col-span-2`} rows={2} value={form.regulatory_requirements} onChange={(e) => setForm({ ...form, regulatory_requirements: e.target.value })} placeholder="Exigences réglementaires ou institutionnelles" />
          </>
        )}

        {isSchool && (
          <div className="sm:col-span-2 space-y-4">
            <p className="text-sm font-extrabold text-ink">Parcours ouverts cette année</p>
            {schoolTracks.length === 0 ? (
              <p className="text-sm text-ink font-medium bg-alert/10 border-2 border-alert rounded-xl px-3 py-2">
                Enregistrez d&apos;abord les parcours de l&apos;école (préscolaire, ECOFO, post-fondamental) dans la fiche.
              </p>
            ) : (
              <>
                {schoolTracks.includes('PRESCOLAIRE') && (
                  <div className="rounded-xl border-2 border-accent/50 p-3 space-y-2">
                    <p className="text-sm font-bold text-ink">{TRACK_META.PRESCOLAIRE}</p>
                    <label className="flex flex-wrap items-center gap-3 text-sm text-ink">
                      <span className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!planState[planKey('PRESCOLAIRE')]?.enabled}
                          onChange={(e) => setPlanRow(planKey('PRESCOLAIRE'), { enabled: e.target.checked })}
                        />
                        Ouvert
                      </span>
                      <span className="inline-flex items-center gap-2">
                        Nombre d&apos;élèves
                        <input
                          type="number"
                          min="1"
                          className="w-24 px-2 py-1 border-2 border-accent rounded-lg"
                          value={planState[planKey('PRESCOLAIRE')]?.seats || ''}
                          onChange={(e) => setPlanRow(planKey('PRESCOLAIRE'), { seats: e.target.value, enabled: true })}
                        />
                      </span>
                    </label>
                  </div>
                )}

                {schoolTracks.includes('ECOFO') && (
                  <div className="rounded-xl border-2 border-accent/50 p-3 space-y-2">
                    <p className="text-sm font-bold text-ink">{TRACK_META.ECOFO}</p>
                    {ecofoYears.length === 0 ? (
                      <p className="text-xs text-alert">Ajoutez des classes ECOFO dans la fiche école.</p>
                    ) : ecofoYears.map((year) => {
                      const key = planKey('ECOFO', String(year.value));
                      return (
                        <label key={key} className="flex flex-wrap items-center gap-3 text-sm text-ink">
                          <span className="inline-flex items-center gap-2 min-w-[8rem]">
                            <input
                              type="checkbox"
                              checked={!!planState[key]?.enabled}
                              onChange={(e) => setPlanRow(key, { enabled: e.target.checked })}
                            />
                            {year.label || yearLabel(year.value)}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            Places
                            <input
                              type="number"
                              min="1"
                              className="w-24 px-2 py-1 border-2 border-accent rounded-lg"
                              value={planState[key]?.seats || ''}
                              onChange={(e) => setPlanRow(key, { seats: e.target.value, enabled: true })}
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {schoolTracks.includes('POST_FONDAMENTAL') && (
                  <div className="rounded-xl border-2 border-accent/50 p-3 space-y-3">
                    <p className="text-sm font-bold text-ink">{TRACK_META.POST_FONDAMENTAL}</p>
                    {postSections.length === 0 ? (
                      <p className="text-xs text-alert">Ajoutez des sections (avec classes) dans la fiche école.</p>
                    ) : postSections.map((section) => (
                      <div key={section.name} className="space-y-2 pl-1">
                        <p className="text-xs font-bold text-ink-muted uppercase tracking-wide">{section.name}</p>
                        {section.years.map((year) => {
                          const key = planKey('POST_FONDAMENTAL', String(year.value), section.name);
                          return (
                            <label key={key} className="flex flex-wrap items-center gap-3 text-sm text-ink">
                              <span className="inline-flex items-center gap-2 min-w-[8rem]">
                                <input
                                  type="checkbox"
                                  checked={!!planState[key]?.enabled}
                                  onChange={(e) => setPlanRow(key, { enabled: e.target.checked })}
                                />
                                {year.label || yearLabel(year.value)}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                Places
                                <input
                                  type="number"
                                  min="1"
                                  className="w-24 px-2 py-1 border-2 border-accent rounded-lg"
                                  value={planState[key]?.seats || ''}
                                  onChange={(e) => setPlanRow(key, { seats: e.target.value, enabled: true })}
                                />
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {isSchool && (
              <div className="rounded-xl border-2 border-accent p-3 space-y-3">
                <div>
                  <p className="text-sm font-extrabold text-ink">Critères supplémentaires (optionnel)</p>
                  <p className="text-xs text-ink-muted mt-1">
                    Test de sélection, entretien ou toute autre condition. L&apos;élève les voit et doit les accepter avant d&apos;envoyer sa candidature.
                  </p>
                </div>
                {(form.extra_criteria || []).map((item, index) => (
                  <div key={index} className="grid sm:grid-cols-2 gap-2 border-t border-accent/40 pt-3">
                    <label className="text-xs font-bold text-ink">
                      Type
                      <select
                        className={`${input} mt-1`}
                        value={item.kind}
                        onChange={(e) => {
                          const next = [...form.extra_criteria];
                          next[index] = { ...item, kind: e.target.value };
                          setForm({ ...form, extra_criteria: next });
                        }}
                      >
                        <option value="TEST">Test de sélection</option>
                        <option value="INTERVIEW">Entretien</option>
                        <option value="OTHER">Autre critère</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold text-ink">
                      Libellé
                      <input
                        className={`${input} mt-1`}
                        value={item.label}
                        onChange={(e) => {
                          const next = [...form.extra_criteria];
                          next[index] = { ...item, label: e.target.value };
                          setForm({ ...form, extra_criteria: next });
                        }}
                        placeholder="Test de français et de maths"
                      />
                    </label>
                    <label className="text-xs font-bold text-ink">
                      Date
                      <input
                        type="date"
                        className={`${input} mt-1`}
                        value={item.date || ''}
                        onChange={(e) => {
                          const next = [...form.extra_criteria];
                          next[index] = { ...item, date: e.target.value };
                          setForm({ ...form, extra_criteria: next });
                        }}
                      />
                    </label>
                    <label className="text-xs font-bold text-ink">
                      Lieu
                      <input
                        className={`${input} mt-1`}
                        value={item.place || ''}
                        onChange={(e) => {
                          const next = [...form.extra_criteria];
                          next[index] = { ...item, place: e.target.value };
                          setForm({ ...form, extra_criteria: next });
                        }}
                        placeholder="Salle 2, école"
                      />
                    </label>
                    <label className="sm:col-span-2 text-xs font-bold text-ink">
                      Précision
                      <input
                        className={`${input} mt-1`}
                        value={item.details || ''}
                        onChange={(e) => {
                          const next = [...form.extra_criteria];
                          next[index] = { ...item, details: e.target.value };
                          setForm({ ...form, extra_criteria: next });
                        }}
                        placeholder="Apporter un stylo. Résultat communiqué par e-mail."
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs font-bold text-red-600 text-left"
                      onClick={() => setForm({
                        ...form,
                        extra_criteria: form.extra_criteria.filter((_, i) => i !== index),
                      })}
                    >
                      Retirer ce critère
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  onClick={() => setForm({
                    ...form,
                    extra_criteria: [
                      ...(form.extra_criteria || []),
                      { kind: 'TEST', label: '', date: '', place: '', details: '' },
                    ],
                  })}
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter un critère
                </button>
              </div>
            )}

            <div className="rounded-xl border-2 border-alert/40 p-3 grid sm:grid-cols-2 gap-3">
              <p className="sm:col-span-2 text-sm font-extrabold text-ink">Frais d&apos;inscription (BurundiPay)</p>
              <label className="text-xs font-bold text-ink">
                Libellé
                <input className={`${input} mt-1`} value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} placeholder="Frais d’inscription" required />
              </label>
              <label className="text-xs font-bold text-ink">
                Montant (BIF)
                <input
                  className={`${input} mt-1`}
                  type="number"
                  min="0"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="Ex. 25000 (0 = gratuit)"
                  required
                />
              </label>
              <p className="sm:col-span-2 text-xs text-ink-muted font-medium">
                L&apos;élève paie via BurundiPay avant de finaliser le formulaire d&apos;inscription (comme pour un rendez-vous).
              </p>
            </div>
          </div>
        )}

        <div className="sm:col-span-2 space-y-2">
          <p className="text-xs font-semibold text-ink-muted">
            {isSchool
              ? 'Pièces locales en plus (optionnel) — photo, certificat médical…'
              : 'Pièces pour cette formation et cette année'}
          </p>
          {form.required_documents.map((row, index) => (
            <div key={index} className="flex gap-2">
              <input className={input} value={row.label} onChange={(e) => setDoc(index, 'label', e.target.value)} placeholder={isSchool ? 'Pièce locale' : 'Diplôme, relevés, pièce d\'identité…'} />
              <input className={input} value={row.description} onChange={(e) => setDoc(index, 'description', e.target.value)} placeholder="Précision" />
              {form.required_documents.length > 1 && (
                <button type="button" onClick={() => setForm({ ...form, required_documents: form.required_documents.filter((_, i) => i !== index) })} className="px-2 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, required_documents: [...form.required_documents, { label: '', description: '' }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <Plus className="w-3.5 h-3.5" /> Ajouter une pièce
          </button>
        </div>
        <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
          <button type="submit" className={`flex-1 ${tealBtn}`}>
            {editingId
              ? 'Enregistrer les modifications'
              : (isSchool ? 'Ouvrir les inscriptions' : 'Publier la campagne')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl border-2 border-border font-bold text-ink">
              Annuler
            </button>
          )}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-extrabold text-ink text-lg">{isSchool ? 'Années scolaires' : 'Campagnes publiées'}</h2>
        {campaigns.length === 0 && <p className="text-sm text-ink-muted font-medium">Aucune campagne pour le moment.</p>}
        {campaigns.map((row) => (
          <article key={row.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">{isSchool ? `Année scolaire ${row.academic_year}` : row.program_title}</p>
                <p className="text-sm text-ink-muted">{row.academic_year} · {row.opens_on} → {row.closes_on}</p>
                <p className={`mt-1 inline-flex text-xs font-bold px-2 py-0.5 rounded-lg border-2 ${
                  row.is_public ? 'border-accent text-ink bg-primary/10' : 'border-alert text-alert'
                }`}>
                  {row.is_public ? 'Visible côté client' : 'Masquée côté client'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleVisibility(row)}
                  className="p-2 rounded-xl border-2 border-accent text-ink"
                  title={row.is_public ? 'Désactiver (masquer)' : 'Activer (rendre visible)'}
                >
                  {row.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="p-2 rounded-xl border-2 border-accent text-ink"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeCampaign(row)}
                  className="p-2 rounded-xl border-2 border-alert text-alert"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {isSchool && (
              <p className="mt-1 text-sm text-ink">{formatPlanSummary(row)}</p>
            )}
            {isSchool && (row.extra_criteria || []).length > 0 && (
              <ul className="mt-2 text-sm text-ink space-y-1">
                {(row.extra_criteria || []).map((item, index) => (
                  <li key={index}>
                    {item.label}
                    {item.date ? ` · ${item.date}` : ''}
                    {item.place ? ` · ${item.place}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {row.enrollment_fee && (
              <p className="mt-1 text-sm font-semibold text-ink">
                Frais : {row.enrollment_fee.label} — {Number(row.enrollment_fee.amount_bif).toLocaleString('fr-BI')} BIF
              </p>
            )}
            {row.required_diploma && <p className="mt-1 text-sm text-ink">{row.required_diploma}</p>}
            {(row.required_documents || []).length > 0 && (
              <p className="mt-1 text-sm text-ink-muted">
                {(row.required_documents || []).map((doc) => doc.label).filter(Boolean).join(' · ')}
              </p>
            )}
          </article>
        ))}
      </section>

      {isSchool && (
        <section className="space-y-3">
          <h2 className="font-extrabold text-ink text-lg">Places</h2>
          {campaigns.every((row) => !(row.seat_summary || []).length) && (
            <p className="text-sm text-ink-muted font-medium">Aucune place publiée pour le moment.</p>
          )}
          {campaigns.map((row) => (row.seat_summary || []).length > 0 && (
            <article key={row.id} className={card}>
              <p className="font-bold text-ink">Année {row.academic_year}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {row.seat_summary.map((slot) => (
                  <li key={`${slot.track}-${slot.section}-${slot.year}`}>
                    {slot.label} · {slot.accepted} accepté{slot.accepted > 1 ? 's' : ''} · {slot.held} dossier{slot.held > 1 ? 's' : ''} · {slot.waiting || 0} en attente · {slot.remaining} restante{slot.remaining > 1 ? 's' : ''} / {slot.seats}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      {isSchool && (
        <section className="space-y-3">
          <h2 className="font-extrabold text-ink text-lg">Listes de classe</h2>
          <p className="text-sm text-ink-muted font-medium">Élèves dont l’inscription est confirmée.</p>
          {applications.filter((row) => row.status === 'ACCEPTEE' || row.status === 'CONFIRMEE').length === 0 && (
            <p className="text-sm text-ink-muted font-medium">Aucun élève confirmé pour le moment.</p>
          )}
          {Object.entries(applications.filter((row) => row.status === 'ACCEPTEE' || row.status === 'CONFIRMEE').reduce((groups, row) => {
            const key = row.program_title || 'Classe';
            return { ...groups, [key]: [...(groups[key] || []), row] };
          }, {})).map(([label, rows]) => (
            <article key={label} className={card}>
              <p className="font-bold text-ink">{label} · {rows.length}</p>
              <ul className="mt-2 space-y-2 text-sm text-ink">
                {rows.map((row) => (
                  <li key={row.id}>
                    <span className="font-semibold">{row.student_name}</span>
                    {row.birth_date ? ` · ${row.birth_date}` : ''}
                    {row.guardian_name ? ` · ${row.guardian_name}` : ''}
                    {row.guardian_phone ? ` · ${row.guardian_phone}` : ''}
                    {row.next_class ? ` · passage : ${row.next_class}` : ''}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-extrabold text-ink text-lg">Dossiers reçus</h2>
        <div className="flex flex-wrap gap-2">
          {(isSchool ? SCHOOL_QUEUES : QUEUES).map((item) => {
            const count = applications.filter((row) => item.statuses.includes(row.status)).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setQueue(item.id)}
                className={`px-3 py-1.5 text-xs rounded-xl border-2 font-bold ${
                  queue === item.id ? 'border-accent bg-primary/10 text-ink' : 'border-border text-ink-muted'
                }`}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>
        {applications.filter((row) => ((isSchool ? SCHOOL_QUEUES : QUEUES).find((item) => item.id === queue)?.statuses || []).includes(row.status)).length === 0 && (
          <p className="text-sm text-ink-muted font-medium">Aucun dossier dans cette file.</p>
        )}
        {applications
          .filter((row) => ((isSchool ? SCHOOL_QUEUES : QUEUES).find((item) => item.id === queue)?.statuses || []).includes(row.status))
          .map((row) => (
          <article key={row.id} className={`${card} space-y-2`}>
            <p className="font-bold text-ink">{row.student_name || row.program_title}</p>
            <p className="text-sm text-ink-muted">{row.applicant_email} · {row.program_title}</p>
            <p className="text-sm font-bold text-ink">{STATUS_LABEL[row.status] || row.status}</p>
            {row.birth_date && (
              <p className="text-sm text-ink">
                Né(e) le {row.birth_date}{row.gender === 'F' ? ' · Féminin' : row.gender === 'M' ? ' · Masculin' : ''}
              </p>
            )}
            {row.guardian_name && (
              <p className="text-sm text-ink">
                {row.guardian_link ? `${row.guardian_link} : ` : 'Parent : '}
                {row.guardian_name}{row.guardian_phone ? ` · ${row.guardian_phone}` : ''}
              </p>
            )}
            {row.previous_school && <p className="text-sm text-ink-muted">École précédente : {row.previous_school}</p>}
            {row.student_address && <p className="text-sm text-ink-muted">{row.student_address}</p>}
            <p className="text-sm text-ink">
              Paiement : {PAY_LABEL[row.payment_status] || row.payment_status || '—'}
            </p>
            {row.criteria_acknowledged && (
              <p className="text-sm text-ink">Critères supplémentaires acceptés</p>
            )}
            {row.decision_note && <p className="text-sm text-ink-muted">{row.decision_note}</p>}
            <div className="space-y-2">
              <p className="text-sm font-extrabold text-ink">Pièces du dossier</p>
              {(row.files || []).length === 0 && (
                <p className="text-sm text-ink-muted">Aucune pièce déposée.</p>
              )}
              {(row.files || []).map((doc) => {
                const href = mediaHref(doc.file);
                const isImage = /\.(png|jpe?g|gif|webp)$/i.test(href);
                return (
                  <div key={doc.id || doc.label} className="space-y-1">
                    <a href={href} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary">
                      {doc.label}
                    </a>
                    {isImage && href && (
                      <a href={href} target="_blank" rel="noreferrer" className="block">
                        <img src={href} alt={doc.label} className="max-h-48 rounded-xl border-2 border-accent" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            {actionsFor(row).length > 0 && (
              <>
                {!isSchool && (
                  <input
                    className={input}
                    placeholder="Message à l’élève (obligatoire pour un refus ou un complément)"
                    value={refusal[row.id] || ''}
                    onChange={(e) => setRefusal({ ...refusal, [row.id]: e.target.value })}
                  />
                )}
                {isSchool && (
                  <p className="text-xs text-gray-500">
                    Le message de confirmation ou de refus défini dans Paramètres est envoyé à l’élève.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {actionsFor(row).map((step) => (
                    <button
                      key={step.value}
                      type="button"
                      onClick={() => decide(row.id, step.value, step.needsNote)}
                      className="px-3 py-1.5 text-xs rounded-xl border-2 border-accent font-bold hover:bg-primary/5"
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </article>
        ))}
      </section>

      {!isSchool && (
        <form onSubmit={createFee} className={`${card} grid sm:grid-cols-2 gap-3`}>
          <h2 className="sm:col-span-2 font-extrabold text-ink text-lg">Frais publiés</h2>
          <select className={input} value={fee.program} onChange={(e) => setFee({ ...fee, program: e.target.value })}>
            <option value="">Sans formation liée</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <input className={input} value={fee.academic_year} onChange={(e) => setFee({ ...fee, academic_year: e.target.value })} placeholder="Année" />
          <input className={input} value={fee.label} onChange={(e) => setFee({ ...fee, label: e.target.value })} placeholder="Libellé" required />
          <input className={input} type="number" min="0" value={fee.amount_bif} onChange={(e) => setFee({ ...fee, amount_bif: e.target.value })} placeholder="Montant BIF" required />
          <button type="submit" className={`sm:col-span-2 ${tealBtn}`}>
            Publier le frais
          </button>
        </form>
      )}
    </div>
  );
}
