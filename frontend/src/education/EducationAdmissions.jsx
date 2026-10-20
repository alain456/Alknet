import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../shared/api';
import { downloadApplicationPdf } from './dossierPdf';
import { EDUCATION_ENUM_FALLBACK, universityLevelLabel } from './educationEnums';

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

const UNIVERSITY_QUEUES = [
  { id: 'wait', label: 'Liste d’attente', statuses: ['LISTE_ATTENTE', 'ENVOYEE', 'EN_INSTRUCTION'] },
  { id: 'complement', label: 'Complément demandé', statuses: ['COMPLEMENT_DEMANDE'] },
  { id: 'accepted', label: 'Acceptés', statuses: ['ACCEPTEE', 'CONFIRMEE'] },
  { id: 'refused', label: 'Refusés', statuses: ['REFUSEE'] },
];

const UNIVERSITY_ACTIONS = [
  { value: 'ACCEPTEE', label: 'Accepter' },
  { value: 'REFUSEE', label: 'Refuser' },
  { value: 'COMPLEMENT_DEMANDE', label: 'Demander un complément', needsNote: true },
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
  BORDEREAU_RECU: 'Bordereau reçu',
};

const PAY_METHOD = {
  BURUNDIPAY: 'BurundiPay',
  BORDEREAU: 'Bordereau',
};

function fact(label, value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return (
    <div key={label} className="grid sm:grid-cols-[11rem_1fr] gap-x-3 gap-y-0.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function UniversityCandidate({ row }) {
  const details = row.profile_details || {};
  const gender = row.gender === 'F' ? 'Féminin' : row.gender === 'M' ? 'Masculin' : '';
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="font-extrabold text-ink">Inscription</p>
        <dl className="mt-1 space-y-1">
          {fact('Programme', row.program_title)}
          {fact('Année académique', row.academic_year)}
          {fact('Niveau', details.study_year)}
          {fact('Option', details.program_option)}
        </dl>
      </div>
      <div>
        <p className="font-extrabold text-ink">Identité</p>
        <dl className="mt-1 space-y-1">
          {fact('Prénom', details.first_name)}
          {fact('Deuxième prénom', details.middle_name)}
          {fact('Nom', details.last_name)}
          {fact('Naissance', row.birth_date)}
          {fact('Sexe', gender)}
          {fact('Nationalité', details.nationality)}
          {fact('État civil', details.marital_status)}
          {fact('E-mail', row.student_email || row.applicant_email)}
          {fact('Téléphone', row.student_phone)}
          {fact('Avenue', details.avenue)}
          {fact('Zone', details.zone)}
          {fact('Commune', details.commune)}
          {fact('Province', details.province)}
          {fact('Pays', details.country)}
          {!details.avenue && fact('Adresse', row.student_address)}
        </dl>
      </div>
      <div>
        <p className="font-extrabold text-ink">Études antérieures</p>
        <dl className="mt-1 space-y-1">
          {fact('Établissement', row.previous_school)}
          {fact('Dernière année (%)', details.last_percent)}
          {fact('Examen d’État (%)', details.state_exam_percent)}
          {fact('Déjà fournies', details.studies_declared)}
        </dl>
      </div>
      <div>
        <p className="font-extrabold text-ink">Personne de contact</p>
        <dl className="mt-1 space-y-1">
          {fact('Lien', row.guardian_link)}
          {fact('Nom', row.guardian_name)}
          {fact('E-mail', details.guardian_email)}
          {fact('Téléphone', row.guardian_phone)}
          {fact('Adresse', details.guardian_address)}
        </dl>
      </div>
    </div>
  );
}

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
  year_start: '',
  year_break_start: '',
  year_break_end: '',
  year_exam_start: '',
  year_deliberation: '',
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
      const raw = row.classes || row.years || [];
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

function cleanClassDocuments(rows) {
  const seen = new Set();
  return (rows || []).map((row) => ({
    label: (row.label || '').trim(),
    description: (row.description || '').trim(),
  })).filter((row) => {
    if (!row.label || seen.has(row.label.toLowerCase())) return false;
    seen.add(row.label.toLowerCase());
    return true;
  });
}

function seatLine(row, campaigns) {
  const campaign = (campaigns || []).find((item) => item.id === row.campaign);
  const slot = (campaign?.seat_summary || []).find((item) => {
    if (item.track !== row.track) return false;
    if (row.track === 'POST_FONDAMENTAL') {
      return item.section === row.post_section && String(item.year) === String(row.post_year || '');
    }
    if (row.track === 'ECOFO') return String(item.year) === String(row.ecofo_year || '');
    return true;
  });
  if (!slot) return '';
  const left = Number(slot.remaining);
  return `${left} place${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} sur ${slot.seats}`;
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
        label: (row.label || '').trim(),
        documents: cleanClassDocuments(row.documents),
      };
    })
    .filter(Boolean);
}

function ClassDocuments({ documents, onChange }) {
  const rows = documents?.length ? documents : [{ label: '', description: '' }];
  const update = (index, key, value) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChange(next);
  };
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-surface p-3">
      <p className="text-xs font-bold text-ink">Documents demandés pour cette classe</p>
      <p className="text-xs text-ink-muted">Un dossier déjà envoyé garde la liste de son envoi. La modifier ici ne change que les prochains dossiers.</p>
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <input
            className="flex-1 px-2 py-1.5 text-sm border-2 border-accent rounded-lg"
            value={row.label}
            onChange={(e) => update(index, 'label', e.target.value)}
            placeholder="Nom du document"
          />
          <input
            className="flex-1 px-2 py-1.5 text-sm border-2 border-accent rounded-lg"
            value={row.description || ''}
            onChange={(e) => update(index, 'description', e.target.value)}
            placeholder="Précision"
          />
          {rows.length > 1 && (
            <button type="button" className="text-xs font-bold text-alert" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              Retirer
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-bold text-primary"
        onClick={() => onChange([...rows, { label: '', description: '' }])}
      >
        Ajouter un document
      </button>
    </div>
  );
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
  const [feeMode, setFeeMode] = useState('');
  const [inscriptionCycle, setInscriptionCycle] = useState('LICENCE');
  const [queue, setQueue] = useState('wait');
  const [fee, setFee] = useState({ program: '', label: '', amount_bif: '', academic_year: '' });
  const [editingId, setEditingId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [newClass, setNewClass] = useState({ value: '', label: '', section: '' });
  const location = useLocation();
  const isSchool = profile?.business_detail?.category_slug === 'ecole';
  const isUniversity = profile?.business_detail?.category_slug === 'universite';
  const simpleDossiers = isSchool || isUniversity;
  const dossiersOnly = !isSchool && !isUniversity && location.pathname.endsWith('/dossiers');
  const showCampaigns = isSchool || isUniversity || !dossiersOnly;
  const showDossiers = isSchool || isUniversity || dossiersOnly || !location.pathname.endsWith('/admissions') || profile == null;
  const schoolTracks = useMemo(() => offeredFromProfile(profile), [profile]);
  const ecofoYears = useMemo(() => {
    const rows = ecofoYearsFromProfile(profile);
    const seen = new Set(rows.map((row) => String(row.value)));
    Object.entries(planState).forEach(([key, row]) => {
      const [track, year] = key.split('|');
      if (track !== 'ECOFO' || !year || seen.has(year)) return;
      seen.add(year);
      rows.push({ value: year, label: row.label || year });
    });
    return rows;
  }, [profile, planState]);
  const postSections = useMemo(() => {
    const sections = postSectionsFromProfile(profile).map((section) => ({
      ...section,
      years: [...section.years],
    }));
    Object.entries(planState).forEach(([key, row]) => {
      const [track, year, section] = key.split('|');
      if (track !== 'POST_FONDAMENTAL' || !section || !year) return;
      let bucket = sections.find((item) => item.name === section);
      if (!bucket) {
        bucket = { name: section, years: [] };
        sections.push(bucket);
      }
      if (!bucket.years.some((item) => item.value === year)) {
        bucket.years.push({ value: year, label: row.label || year });
      }
    });
    return sections;
  }, [profile, planState]);

  const load = () => {
    api.get('education/programs/?mine=1', { auth: true }).then((data) => {
      setPrograms(Array.isArray(data) ? data : data?.results || []);
    }).catch((err) => setError(err.message));
    api.get('education/campaigns/?mine=1', { auth: true }).then((data) => {
      setCampaigns(Array.isArray(data) ? data : data?.results || []);
    }).catch(() => setCampaigns([]));
    api.get('education/profiles/my_profile/', { auth: true }).then(setProfile).catch(() => {});
    api.get('education/applications/', { auth: true }).then((data) => {
      setApplications(Array.isArray(data) ? data : data?.results || []);
    }).catch((err) => setError(err.message || 'Impossible de charger les candidatures.'));
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
    setFeeMode('');
    setInscriptionCycle('LICENCE');
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setError('');
    setInscriptionCycle(row.program_level === 'MASTER' ? 'MASTER' : 'LICENCE');
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
      year_start: row.year_start || '',
      year_break_start: row.year_break_start || '',
      year_break_end: row.year_break_end || '',
      year_exam_start: row.year_exam_start || '',
      year_deliberation: row.year_deliberation || '',
      extra_criteria: (row.extra_criteria || []).map((item) => ({
        kind: item.kind || 'TEST',
        label: item.label || '',
        date: item.date || '',
        place: item.place || '',
        details: item.details || '',
      })),
    });
    if (isSchool || isUniversity) {
      setFeeLabel(row.enrollment_fee?.label || 'Frais d’inscription');
      const amount = Number(row.enrollment_fee?.amount_bif || 0);
      setFeeMode(row.enrollment_fee?.fee_mode || row.fee_mode || (amount > 0 ? 'PAYANT' : 'GRATUIT'));
      setFeeAmount(amount > 0 ? String(amount) : '');
    }
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
          documents: Array.isArray(item.documents) && item.documents.length
            ? item.documents.map((doc) => ({ label: doc.label || '', description: doc.description || '' }))
            : [{ label: '', description: '' }],
          label: item.label || '',
        };
      });
      setPlanState(base);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, required_documents: documentsPayload(form.required_documents) };
    ['year_start', 'year_break_start', 'year_break_end', 'year_exam_start', 'year_deliberation'].forEach((key) => {
      if (!payload[key]) payload[key] = null;
    });
    if (isSchool || isUniversity) {
      if (!feeMode) {
        setError('Indiquez si l’inscription est payante ou gratuite.');
        return;
      }
      if (feeMode === 'PAYANT' && (!feeAmount || Number(feeAmount) <= 0)) {
        setError('Une inscription payante exige un montant supérieur à 0.');
        return;
      }
      payload.fee_mode = feeMode;
      payload.fee_label = feeMode === 'GRATUIT' ? 'Inscription gratuite' : (feeLabel.trim() || 'Frais d’inscription');
      payload.fee_amount_bif = feeMode === 'GRATUIT' ? 0 : Number(feeAmount);
    }
    if (isSchool) {
      payload.program = null;
      const enrollment_plan = buildEnrollmentPlan(planState);
      if (!enrollment_plan.length) {
        setError('Cochez au moins une année et indiquez le nombre de places.');
        return;
      }
      const missingDocs = enrollment_plan.find((row) => !(row.documents || []).length);
      if (missingDocs) {
        const place = [TRACK_META[missingDocs.track] || missingDocs.track, missingDocs.section, missingDocs.year].filter(Boolean).join(' · ');
        setError(`Indiquez au moins un document pour ${place}.`);
        return;
      }
      if (schoolTracks.includes('ECOFO') || schoolTracks.includes('POST_FONDAMENTAL')) {
        const classPayload = {};
        if (schoolTracks.includes('ECOFO')) {
          classPayload.offers_ecofo = true;
          classPayload.ecofo_classes = ecofoYears.map((row) => ({
            value: String(row.value),
            label: row.label || String(row.value),
          }));
        }
        if (schoolTracks.includes('POST_FONDAMENTAL')) {
          const existing = profile?.post_fondamental_sections || [];
          classPayload.offers_post_fondamental = true;
          classPayload.post_fondamental_sections = postSections
            .map((section) => {
              const previous = existing.find((row) => (row.name || '').trim() === section.name) || {};
              const classes = section.years.map((row) => ({
                value: String(row.value),
                label: row.label || String(row.value),
              }));
              return {
                orientation: previous.orientation || 'GENERAL',
                name: section.name,
                classes,
                years: classes.map((row) => row.value),
              };
            })
            .filter((section) => section.classes.length);
        }
        const saved = await api.patch('education/profiles/my_profile/', classPayload, { auth: true });
        setProfile(saved);
      }
      payload.enrollment_plan = enrollment_plan;
      payload.required_documents = [];
      payload.open_tracks = [...new Set(enrollment_plan.map((row) => row.track))];
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
        setError('Choisissez un programme.');
        return;
      }
      if (isUniversity && !payload.required_documents.length) {
        setError('Indiquez au moins un document à fournir.');
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
      const named = item.label || (Number.isFinite(Number(item.year)) && String(Number(item.year)) === String(item.year) ? yearLabel(item.year) : item.year);
      if (item.track === 'ECOFO') return `${track} ${named} (${item.seats})`;
      return `${item.section} · ${named} (${item.seats})`;
    }).join(' · ');
  };

  const actionsFor = (row) => {
    if (isUniversity) {
      if (['ACCEPTEE', 'CONFIRMEE', 'REFUSEE'].includes(row.status)) return [];
      if (row.status === 'COMPLEMENT_DEMANDE') {
        return UNIVERSITY_ACTIONS.filter((step) => step.value !== 'COMPLEMENT_DEMANDE');
      }
      return UNIVERSITY_ACTIONS;
    }
    if (!simpleDossiers) return NEXT_BY_STATUS[row.status] || [];
    if (row.status === 'REFUSEE' || row.status === 'ACCEPTEE' || row.status === 'CONFIRMEE') return [];
    return SCHOOL_ACTIONS;
  };

  const dossierQueues = isUniversity ? UNIVERSITY_QUEUES : (simpleDossiers ? SCHOOL_QUEUES : QUEUES);

  return (
    <div className="space-y-6 pb-10 text-ink">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border-duo bg-surface p-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-accent" /> {isUniversity ? 'Candidatures' : (isSchool ? 'Admissions' : (dossiersOnly ? 'Dossiers' : 'Inscriptions'))}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {isSchool
              ? 'Une même année peut avoir deux inscriptions ouvertes en même temps : une payante et une gratuite.'
              : (dossiersOnly
                ? 'Liste d’attente, dossiers acceptés et dossiers refusés.'
                : (isUniversity
                  ? 'Ouvrez une inscription en baccalauréat ou en master, pour une année académique.'
                  : 'Ouvrez une inscription pour un programme et une année académique.'))}
          </p>
          {applications.some((row) => row.status === 'ENVOYEE' || row.status === 'LISTE_ATTENTE') && (
            <p className="text-sm font-bold text-ink mt-2">
              À traiter : {applications.filter((row) => row.status === 'ENVOYEE' || row.status === 'LISTE_ATTENTE' || row.status === 'EN_INSTRUCTION').map((row) => row.student_name).filter(Boolean).join(', ')}.
            </p>
          )}
        </div>
      </div>
      {error && <div className="rounded-xl border-2 border-alert bg-alert/10 text-ink px-4 py-3 text-sm font-medium">{error}</div>}

      {showCampaigns && <form onSubmit={createCampaign} className={`${card} grid sm:grid-cols-2 gap-3`}>
        <h2 className="sm:col-span-2 font-extrabold text-ink text-lg">
          {editingId
            ? (isSchool ? 'Modifier l’année scolaire' : 'Modifier l’inscription')
            : (isSchool ? 'Ouvrir les inscriptions' : 'Ouvrir une inscription')}
        </h2>
        {isUniversity && (
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-ink">Cycle</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ['LICENCE', 'Baccalauréat'],
                ['MASTER', 'Master'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setInscriptionCycle(id);
                    setForm({ ...form, program: '' });
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-bold ${inscriptionCycle === id ? 'bg-accent text-ink' : 'bg-white ring-1 ring-border text-ink'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              {inscriptionCycle === 'MASTER'
                ? 'L’inscription porte sur une mention : domaine et durée, sans faculté ni parcours.'
                : 'L’inscription porte sur un baccalauréat de l’université, avec sa faculté et ses options.'}
            </p>
          </div>
        )}
        {!isSchool && (
          <label className="sm:col-span-2 text-xs font-bold text-ink">
            {isUniversity ? (inscriptionCycle === 'MASTER' ? 'Mention' : 'Baccalauréat') : 'Programme'}
            <select className={`${input} mt-1`} value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} required>
              <option value="">
                {isUniversity
                  ? (inscriptionCycle === 'MASTER' ? 'Choisir une mention' : 'Choisir un baccalauréat')
                  : 'Choisir un programme'}
              </option>
              {(isUniversity ? programs.filter((row) => row.level === inscriptionCycle) : programs).map((p) => (
                <option key={p.id} value={p.id}>
                  {isUniversity && inscriptionCycle === 'MASTER' && p.domain ? `${p.title} — ${p.domain}` : p.title}
                </option>
              ))}
            </select>
            {isUniversity && programs.filter((row) => row.level === inscriptionCycle).length === 0 && (
              <p className="mt-2 text-sm text-ink-muted">
                {inscriptionCycle === 'MASTER'
                  ? 'Aucune mention pour le moment. Créez-la dans Programmes, onglet Masters.'
                  : 'Aucun baccalauréat pour le moment. Créez-le dans Programmes, onglet Baccalauréats.'}
              </p>
            )}
            {isUniversity && inscriptionCycle === 'LICENCE' && (programs.find((row) => String(row.id) === String(form.program))?.options || []).length > 0 && (
              <p className="mt-2 text-sm font-medium">
                Options : {programs.find((row) => String(row.id) === String(form.program)).options.join(' · ')}
              </p>
            )}
          </label>
        )}
        <label className={`${isUniversity ? 'sm:col-span-2' : ''} text-xs font-bold text-ink`}>
          {isSchool ? 'Année scolaire' : 'Année académique'}
          <input className={`${input} mt-1`} value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="2026-2027" required />
        </label>
        <label className="text-xs font-bold text-ink">
          Date d&apos;ouverture des inscriptions
          <input type="date" className={`${input} mt-1`} value={form.opens_on} onChange={(e) => setForm({ ...form, opens_on: e.target.value })} required />
        </label>
        <label className="text-xs font-bold text-ink">
          Date de fin des inscriptions
          <input type="date" className={`${input} mt-1`} value={form.closes_on} onChange={(e) => setForm({ ...form, closes_on: e.target.value })} required />
        </label>

        {!isSchool && !isUniversity && (
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
                    {!!planState[planKey('PRESCOLAIRE')]?.enabled && (
                      <ClassDocuments
                        documents={planState[planKey('PRESCOLAIRE')]?.documents}
                        onChange={(documents) => setPlanRow(planKey('PRESCOLAIRE'), { documents, enabled: true })}
                      />
                    )}
                  </div>
                )}

                {schoolTracks.includes('ECOFO') && (
                  <div className="rounded-xl border-2 border-accent/50 p-3 space-y-2">
                    <p className="text-sm font-bold text-ink">{TRACK_META.ECOFO}</p>
                    {ecofoYears.length === 0 && (
                      <p className="text-xs text-ink-muted">Aucune classe pour le moment. Ajoutez-en une ci-dessous.</p>
                    )}
                    {ecofoYears.map((year) => {
                      const key = planKey('ECOFO', String(year.value));
                      return (
                        <div key={key}>
                          <label className="flex flex-wrap items-center gap-3 text-sm text-ink">
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
                          {!!planState[key]?.enabled && (
                            <ClassDocuments
                              documents={planState[key]?.documents}
                              onChange={(documents) => setPlanRow(key, { documents, enabled: true })}
                            />
                          )}
                        </div>
                      );
                    })}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        className="sm:w-24 px-2 py-1.5 text-sm border-2 border-accent rounded-lg"
                        value={newClass.section ? '' : newClass.value}
                        onChange={(e) => setNewClass({ section: '', value: e.target.value, label: newClass.section ? '' : newClass.label })}
                        placeholder="Code"
                      />
                      <input
                        className="flex-1 px-2 py-1.5 text-sm border-2 border-accent rounded-lg"
                        value={newClass.section ? '' : newClass.label}
                        onChange={(e) => setNewClass({ section: '', value: newClass.section ? '' : newClass.value, label: e.target.value })}
                        placeholder="Nom de la classe"
                      />
                      <button
                        type="button"
                        className="text-xs font-bold text-primary whitespace-nowrap"
                        onClick={() => {
                          if (newClass.section) return;
                          const value = newClass.value.trim();
                          const label = newClass.label.trim() || value;
                          if (!value) return;
                          setPlanRow(planKey('ECOFO', value), {
                            enabled: true,
                            seats: '40',
                            label,
                            documents: [{ label: '', description: '' }],
                          });
                          setNewClass({ value: '', label: '', section: '' });
                        }}
                      >
                        Ajouter une classe
                      </button>
                    </div>
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
                            <div key={key}>
                              <label className="flex flex-wrap items-center gap-3 text-sm text-ink">
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
                              {!!planState[key]?.enabled && (
                                <ClassDocuments
                                  documents={planState[key]?.documents}
                                  onChange={(documents) => setPlanRow(key, { documents, enabled: true })}
                                />
                              )}
                            </div>
                          );
                        })}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            className="sm:w-24 px-2 py-1.5 text-sm border-2 border-accent rounded-lg"
                            value={newClass.section === section.name ? newClass.value : ''}
                            onChange={(e) => setNewClass({ section: section.name, value: e.target.value, label: newClass.section === section.name ? newClass.label : '' })}
                            placeholder="Code"
                          />
                          <input
                            className="flex-1 px-2 py-1.5 text-sm border-2 border-accent rounded-lg"
                            value={newClass.section === section.name ? newClass.label : ''}
                            onChange={(e) => setNewClass({ section: section.name, value: newClass.section === section.name ? newClass.value : '', label: e.target.value })}
                            placeholder="Nom de la classe"
                          />
                          <button
                            type="button"
                            className="text-xs font-bold text-primary whitespace-nowrap"
                            onClick={() => {
                              if (newClass.section !== section.name) return;
                              const value = newClass.value.trim();
                              const label = newClass.label.trim() || value;
                              if (!value) return;
                              setPlanRow(planKey('POST_FONDAMENTAL', value, section.name), {
                                enabled: true,
                                seats: '30',
                                label,
                                documents: [{ label: '', description: '' }],
                              });
                              setNewClass({ value: '', label: '', section: '' });
                            }}
                          >
                            Ajouter une classe
                          </button>
                        </div>
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
          </div>
        )}

        {isSchool && (
          <div className="sm:col-span-2 rounded-xl border-2 border-accent p-3 space-y-3">
            <p className="text-sm font-extrabold text-ink">Calendrier de cette année</p>
            <p className="text-xs text-ink-muted">Ces dates restent sur cette inscription. Ouvrir une autre année ne remplace pas celles déjà enregistrées.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-ink">Rentrée
                <input type="date" className={`${input} mt-1`} value={form.year_start || ''} onChange={(e) => setForm({ ...form, year_start: e.target.value })} />
              </label>
              <label className="text-xs font-bold text-ink">Début des examens
                <input type="date" className={`${input} mt-1`} value={form.year_exam_start || ''} onChange={(e) => setForm({ ...form, year_exam_start: e.target.value })} />
              </label>
              <label className="text-xs font-bold text-ink">Début de pause
                <input type="date" className={`${input} mt-1`} value={form.year_break_start || ''} onChange={(e) => setForm({ ...form, year_break_start: e.target.value })} />
              </label>
              <label className="text-xs font-bold text-ink">Fin de pause
                <input type="date" className={`${input} mt-1`} value={form.year_break_end || ''} onChange={(e) => setForm({ ...form, year_break_end: e.target.value })} />
              </label>
              <label className="text-xs font-bold text-ink sm:col-span-2">Date de délibération
                <input type="date" className={`${input} mt-1`} value={form.year_deliberation || ''} onChange={(e) => setForm({ ...form, year_deliberation: e.target.value })} />
              </label>
            </div>
          </div>
        )}

        {(isSchool || isUniversity) && (
          <div className="sm:col-span-2 rounded-xl border-2 border-alert/40 p-3 space-y-3">
              <p className="text-sm font-extrabold text-ink">Mode de cette inscription</p>
              <p className="text-xs text-ink-muted">
                Payante et gratuite sont deux inscriptions distinctes. Les deux peuvent être ouvertes pour {isUniversity ? 'le même programme et la même année académique' : 'la même année scolaire'}.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFeeMode('PAYANT')}
                  className={`text-left rounded-xl border-2 p-3 ${feeMode === 'PAYANT' ? 'bg-accent text-ink border-accent' : 'border-border'}`}
                >
                  <p className="text-sm font-extrabold">Payante</p>
                  <p className="text-xs text-ink-muted mt-1">{isUniversity ? 'Le candidat' : 'L’élève'} règle les frais par BurundiPay ou par un bordereau PDF avant d&apos;envoyer le dossier.</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setFeeMode('GRATUIT'); setFeeAmount(''); }}
                  className={`text-left rounded-xl border-2 p-3 ${feeMode === 'GRATUIT' ? 'bg-accent text-ink border-accent' : 'border-border'}`}
                >
                  <p className="text-sm font-extrabold">Gratuite</p>
                  <p className="text-xs text-ink-muted mt-1">{isUniversity ? 'Le candidat' : 'L’élève'} envoie le dossier. Aucun paiement n&apos;est demandé.</p>
                </button>
              </div>
              {feeMode === 'PAYANT' && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-ink">
                    Libellé
                    <input className={`${input} mt-1`} value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} placeholder="Frais d’inscription" required />
                  </label>
                  <label className="text-xs font-bold text-ink">
                    Montant (BIF)
                    <input
                      className={`${input} mt-1`}
                      type="number"
                      min="1"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      placeholder="Ex. 25000"
                      required
                    />
                  </label>
                </div>
              )}
          </div>
        )}

        {!isSchool && <div className="sm:col-span-2 space-y-2">
          <p className="text-xs font-bold text-ink">Documents à fournir</p>
          {form.required_documents.map((row, index) => (
            <div key={index} className="flex gap-2">
              <input className={input} value={row.label} onChange={(e) => setDoc(index, 'label', e.target.value)} placeholder={isSchool ? 'Pièce locale' : 'Nom du document'} />
              <input className={input} value={row.description} onChange={(e) => setDoc(index, 'description', e.target.value)} placeholder="Précision" />
              {form.required_documents.length > 1 && (
                <button type="button" onClick={() => setForm({ ...form, required_documents: form.required_documents.filter((_, i) => i !== index) })} className="px-2 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, required_documents: [...form.required_documents, { label: '', description: '' }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <Plus className="w-3.5 h-3.5" /> Ajouter un document
          </button>
        </div>}
        <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
          <button type="submit" className={`flex-1 ${tealBtn}`}>
            {editingId
              ? 'Enregistrer les modifications'
              : (isSchool ? 'Ouvrir les inscriptions' : 'Ouvrir l’inscription')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl border-2 border-border font-bold text-ink">
              Annuler
            </button>
          )}
        </div>
      </form>}

      {showCampaigns && <section className="space-y-3">
        <h2 className="font-extrabold text-ink text-lg">{isSchool ? 'Années scolaires' : 'Inscriptions ouvertes'}</h2>
        {campaigns.length === 0 && <p className="text-sm text-ink-muted font-medium">Aucune campagne pour le moment.</p>}
        {campaigns.map((row) => (
          <article key={row.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">
                  {isUniversity && row.program_level && (
                    <span className="mr-2 text-xs font-bold uppercase tracking-wide text-primary">
                      {universityLevelLabel(row.program_level, row.program_level)}
                    </span>
                  )}
                  {isSchool
                    ? `Année scolaire ${row.academic_year}`
                    : row.program_title}
                  {(isSchool || isUniversity) && (row.fee_mode === 'GRATUIT' ? ' · Gratuite' : row.fee_mode === 'PAYANT' ? ' · Payante' : '')}
                </p>
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
                {Number(row.enrollment_fee.amount_bif) > 0
                  ? `Payante — ${row.enrollment_fee.label} — ${Number(row.enrollment_fee.amount_bif).toLocaleString('fr-BI')} BIF`
                  : 'Gratuite — aucun paiement'}
              </p>
            )}
            {row.required_diploma && <p className="mt-1 text-sm text-ink">{row.required_diploma}</p>}
            {(row.required_documents || []).length > 0 && (
              <p className="mt-1 text-sm text-ink">
                Documents : {(row.required_documents || []).map((doc) => doc.label).filter(Boolean).join(' · ')}
              </p>
            )}
          </article>
        ))}
      </section>}

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

      {showDossiers && <section className="space-y-3">
        <h2 className="font-extrabold text-ink text-lg">Dossiers reçus</h2>
        <div className="flex flex-wrap gap-2">
          {(dossierQueues).map((item) => {
            const count = applications.filter((row) => item.statuses.includes(row.status)).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setQueue(item.id)}
                className={`px-3 py-1.5 text-xs rounded-xl border-2 font-bold ${
                  queue === item.id ? 'bg-accent text-ink border-accent' : 'border-border text-ink-muted'
                }`}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>
        {applications.filter((row) => (dossierQueues.find((item) => item.id === queue)?.statuses || []).includes(row.status)).length === 0 && (
          <p className="text-sm text-ink-muted font-medium">Aucun dossier dans cette file.</p>
        )}
        {applications
          .filter((row) => (dossierQueues.find((item) => item.id === queue)?.statuses || []).includes(row.status))
          .map((row) => (
          <article key={row.id} className={`${card} space-y-2`}>
            <p className="font-bold text-ink">{row.student_name || row.program_title}</p>
            {!isUniversity && (
              <p className="text-sm text-ink-muted">{row.applicant_email} · {row.program_title}</p>
            )}
            <p className="text-sm font-bold text-ink">{STATUS_LABEL[row.status] || row.status}</p>
            {isUniversity && <UniversityCandidate row={row} />}
            {!isUniversity && row.birth_date && (
              <p className="text-sm text-ink">
                Né(e) le {row.birth_date}{row.gender === 'F' ? ' · Féminin' : row.gender === 'M' ? ' · Masculin' : ''}
              </p>
            )}
            {!isUniversity && row.guardian_name && (
              <p className="text-sm text-ink">
                {row.guardian_link ? `${row.guardian_link} : ` : 'Parent : '}
                {row.guardian_name}{row.guardian_phone ? ` · ${row.guardian_phone}` : ''}
              </p>
            )}
            {!isUniversity && row.previous_school && <p className="text-sm text-ink-muted">Établissement précédent : {row.previous_school}</p>}
            {!isUniversity && row.student_address && <p className="text-sm text-ink-muted">{row.student_address}</p>}
            <p className="text-sm text-ink">
              Paiement : {PAY_LABEL[row.payment_status] || row.payment_status || '—'}
              {row.payment_method ? ` · ${PAY_METHOD[row.payment_method] || row.payment_method}` : ''}
            </p>
            {row.payment_method === 'BORDEREAU' && (
              <button
                type="button"
                onClick={() => downloadApplicationPdf(`education/accounting/${row.id}/bordereau/`).catch((err) => setError(err.message))}
                className="text-xs font-bold text-primary"
              >
                Télécharger le bordereau
              </button>
            )}
            {isSchool && (
              <p className="text-sm font-bold text-ink">{seatLine(row, campaigns)}</p>
            )}
            {row.criteria_acknowledged && (
              <p className="text-sm text-ink">Critères supplémentaires acceptés</p>
            )}
            {row.decision_note && <p className="text-sm text-ink-muted">{row.decision_note}</p>}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => downloadApplicationPdf(`education/applications/${row.id}/dossier/`).catch((err) => setError(err.message))}
                className="px-3 py-1.5 text-xs rounded-xl bg-accent text-ink font-bold"
              >
                Télécharger le dossier complet (PDF)
              </button>
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
                {isUniversity && actionsFor(row).some((step) => step.needsNote) && (
                  <input
                    className={input}
                    placeholder="Pièce ou information à demander"
                    value={refusal[row.id] || ''}
                    onChange={(e) => setRefusal({ ...refusal, [row.id]: e.target.value })}
                  />
                )}
                {!isSchool && !isUniversity && (
                  <input
                    className={input}
                    placeholder="Message à l’élève (obligatoire pour un refus ou un complément)"
                    value={refusal[row.id] || ''}
                    onChange={(e) => setRefusal({ ...refusal, [row.id]: e.target.value })}
                  />
                )}
                {(isSchool || isUniversity) && (
                  <p className="text-xs text-gray-500">
                    Le message de confirmation ou de refus défini dans Paramètres est envoyé au {isUniversity ? 'candidat' : 'élève'}.
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
      </section>}

      {showCampaigns && !isSchool && !isUniversity && (
        <form onSubmit={createFee} className={`${card} grid sm:grid-cols-2 gap-3`}>
          <h2 className="sm:col-span-2 font-extrabold text-ink text-lg">Frais publiés</h2>
          <select className={input} value={fee.program} onChange={(e) => setFee({ ...fee, program: e.target.value })}>
            <option value="">Sans programme lié</option>
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
