import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  GraduationCap, Save, Send, ExternalLink, Loader2, ImagePlus,
  Wallet,
} from 'lucide-react';
import { api } from '../shared/api';
import educationService from './educationService';
import SchoolSectionsEditor from './SchoolSectionsEditor';
import SchoolEcofoClassesEditor from './SchoolEcofoClassesEditor';
import { EDUCATION_ENUM_FALLBACK, loadEducationEnums } from './educationEnums';
import { readImageAsDataUrl } from '../shared/components/BusinessRegistrationForm';
import MerchantAccountCard from '../business/MerchantAccountCard';

const inputClass = 'w-full px-3 py-2 text-sm bg-surface border-2 border-accent rounded-xl text-ink outline-none focus:border-alert';
const actionBtn = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-accent text-ink hover:opacity-95 disabled:opacity-50';

const WAITING = ['LISTE_ATTENTE', 'ENVOYEE', 'EN_INSTRUCTION', 'COMPLEMENT_DEMANDE'];
const ACCEPTED = ['ACCEPTEE', 'CONFIRMEE'];

export default function EducationDashboard() {
  const location = useLocation();
  const schoolFiche = location.pathname.endsWith('/ecole');
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [applications, setApplications] = useState([]);
  const [enums, setEnums] = useState({
    establishment_types: [],
    levels: [],
    ecofo_cycles: EDUCATION_ENUM_FALLBACK.ecofo_cycles,
    post_orientations: EDUCATION_ENUM_FALLBACK.post_orientations,
    post_filieres: EDUCATION_ENUM_FALLBACK.post_filieres,
  });
  const formRef = useRef(null);
  const trackSave = useRef(Promise.resolve());
  formRef.current = form;

  useEffect(() => { loadEducationEnums().then(setEnums); }, []);

  const load = useCallback(async () => {
    try {
      const p = await educationService.getMyProfile();
      setProfile(p);
      setForm({
        operational_status: p.operational_status || 'ACTIVE',
        official_name: p.official_name || '',
        short_description: p.short_description || '',
        description: p.description || '',
        teaching_languages: p.teaching_languages || '',
        website: p.website || '',
        institutional_email: p.institutional_email || '',
        accreditation_number: p.accreditation_number || '',
        accreditation_body: p.accreditation_body || '',
        accreditation_valid_until: p.accreditation_valid_until || '',
        gallery: (p.gallery || []).map(String).filter(Boolean),
        library_hours: p.library_hours || '',
        library_access: p.library_access || '',
        library_contact: p.library_contact || '',
        internship_required: !!p.internship_required,
        internship_duration: p.internship_duration || '',
        internship_period: p.internship_period || '',
        internship_contact: p.internship_contact || '',
        student_services: Array.isArray(p.student_services) ? p.student_services : [],
        year_start: p.year_start || '',
        year_break_start: p.year_break_start || '',
        year_break_end: p.year_break_end || '',
        year_exam_start: p.year_exam_start || '',
        year_deliberation: p.year_deliberation || '',
        has_scholarships: !!p.has_scholarships,
        has_boarding: !!p.has_boarding,
        boarding_regime: p.boarding_regime || (p.has_boarding ? 'INTERNAT' : ''),
        has_campus: !!p.has_campus,
        has_evening_courses: !!p.has_evening_courses,
        has_distance_learning: !!p.has_distance_learning,
        offers_prescolaire: !!p.offers_prescolaire,
        offers_ecofo: !!p.offers_ecofo,
        offers_post_fondamental: !!p.offers_post_fondamental,
        ecofo_cycles: Array.isArray(p.ecofo_cycles) ? p.ecofo_cycles : [],
        ecofo_classes: Array.isArray(p.ecofo_classes) ? p.ecofo_classes : [],
        post_fondamental_sections: Array.isArray(p.post_fondamental_sections) ? p.post_fondamental_sections : [],
      });
      const slug = p?.business_detail?.category_slug;
      const kind = p?.establishment_type;
      if (slug === 'ecole' || slug === 'universite' || kind === 'SCHOOL' || kind === 'UNIVERSITY') {
        const [campaignData, applicationData] = await Promise.all([
          api.get('education/campaigns/?mine=1', { auth: true }).catch(() => []),
          api.get('education/applications/', { auth: true }).catch(() => []),
        ]);
        const asList = (data) => (Array.isArray(data) ? data : (data?.results || []));
        setCampaigns(asList(campaignData));
        setApplications(asList(applicationData));
      }
      setError('');
    } catch (e) {
      setError(e.message || 'Impossible de charger votre fiche');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const trackPayload = (next) => {
    const sections = (next.post_fondamental_sections || [])
      .map((section) => {
        const name = (section.name || '').trim();
        if (!name) return null;
        const classes = (section.classes || section.years || [])
          .map((item) => {
            if (item && typeof item === 'object') {
              const value = String(item.value || '').trim();
              const label = String(item.label || '').trim() || value;
              return value ? { value, label } : null;
            }
            const value = String(item || '').trim();
            return value ? { value, label: value } : null;
          })
          .filter(Boolean);
        return {
          orientation: section.orientation || 'GENERAL',
          name,
          classes,
          years: classes.map((row) => row.value),
        };
      })
      .filter(Boolean);
    const ecofo_classes = next.offers_ecofo
      ? (next.ecofo_classes || [])
        .map((row) => ({
          value: String(row.value || '').trim(),
          label: String(row.label || '').trim() || String(row.value || '').trim(),
        }))
        .filter((row) => row.value)
      : [];
    return {
      offers_prescolaire: !!next.offers_prescolaire,
      offers_ecofo: !!next.offers_ecofo,
      offers_post_fondamental: !!next.offers_post_fondamental,
      ecofo_cycles: next.offers_ecofo ? [...(next.ecofo_cycles || [])] : [],
      ecofo_classes,
      post_fondamental_sections: next.offers_post_fondamental ? sections : [],
    };
  };

  const persistTracks = (next) => {
    const run = trackSave.current.catch(() => {}).then(() => educationService.updateMyProfile(trackPayload(next)));
    trackSave.current = run.then((saved) => {
      setProfile(saved);
      setNotice('Parcours enregistré. La page publique le montre.');
      setError('');
      return saved;
    }).catch((err) => {
      setNotice('');
      setError(err.message || 'Le parcours n’a pas été enregistré');
      throw err;
    });
    return trackSave.current;
  };

  const applyTracks = (patch) => {
    const next = { ...(formRef.current || {}), ...patch };
    formRef.current = next;
    setForm(next);
    return persistTracks(next).catch(() => {});
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = { ...form, accreditation_valid_until: form.accreditation_valid_until || null };
      ['year_start', 'year_break_start', 'year_break_end', 'year_exam_start', 'year_deliberation'].forEach((key) => {
        if (!payload[key]) payload[key] = null;
      });
      delete payload.website;
      Object.assign(payload, trackPayload(payload));
      await persistTracks(payload);
      const saved = await educationService.updateMyProfile(payload);
      setProfile(saved);
      setForm((prev) => ({
        ...prev,
        offers_prescolaire: !!saved.offers_prescolaire,
        offers_ecofo: !!saved.offers_ecofo,
        offers_post_fondamental: !!saved.offers_post_fondamental,
        ecofo_cycles: Array.isArray(saved.ecofo_cycles) ? saved.ecofo_cycles : [],
        ecofo_classes: Array.isArray(saved.ecofo_classes) ? saved.ecofo_classes : [],
        post_fondamental_sections: Array.isArray(saved.post_fondamental_sections) ? saved.post_fondamental_sections : [],
      }));
      setNotice('Fiche enregistrée.');
      await load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const submitForReview = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await educationService.submitForReview();
      setNotice('Fiche envoyée en validation.');
      await load();
    } catch (err) {
      setError(err.message || 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement…</div>;
  if (error && !form) return <div className="p-8 text-red-600">{error}</div>;
  if (!form) return null;

  const status = profile?.publication_status;
  const statusLabel = (enums.publication_statuses || []).find((row) => row.value === status)?.label || status;
  const isSchool = profile?.business_detail?.category_slug === 'ecole'
    || profile?.establishment_type === 'SCHOOL';
  const isUniversity = profile?.business_detail?.category_slug === 'universite'
    || profile?.establishment_type === 'UNIVERSITY';
  const tracks = [
    profile?.offers_prescolaire && 'Préscolaire',
    profile?.offers_ecofo && 'Fondamental',
    profile?.offers_post_fondamental && 'Post-fondamental',
  ].filter(Boolean);
  const openCampaigns = campaigns.filter((row) => row.open_today);
  const waiting = applications.filter((row) => WAITING.includes(row.status));
  const accepted = applications.filter((row) => ACCEPTED.includes(row.status));
  const programCount = new Set(campaigns.map((row) => row.program).filter(Boolean)).size;
  const showOverview = isSchool || isUniversity;

  const unpaid = applications.filter((row) => row.payment_status === 'UNPAID' || row.payment_status === 'AWAITING_PIN').length;
  const paid = applications.filter((row) => row.payment_status === 'PAID').length;
  const feeBase = paid + unpaid;
  const paidShare = feeBase ? Math.round((paid / feeBase) * 100) : 0;
  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const queuePath = '/education/dashboard/admissions';
  const statCards = [
    { label: 'En attente', value: String(waiting.length), hint: isUniversity ? 'Candidats à instruire' : 'Dossiers à instruire', tone: 'bg-[#FFF4EA]' },
    { label: 'Acceptés', value: String(accepted.length), hint: 'Inscriptions confirmées ou acceptées', tone: 'bg-[#E7F0F4]' },
    { label: 'Inscriptions ouvertes', value: String(openCampaigns.length), hint: isUniversity ? `${programCount} programme${programCount > 1 ? 's' : ''}` : (tracks.join(' · ') || 'Parcours non indiqué'), tone: 'bg-white' },
    { label: 'Paiements en attente', value: String(unpaid), hint: paid ? `${paid} déjà payé${paid > 1 ? 's' : ''}` : 'Aucun paiement confirmé', tone: 'bg-white' },
  ];

  return (
    <div className="space-y-6 pb-10 text-ink">
      {showOverview && !schoolFiche && (
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="text-sm text-ink-muted capitalize">{todayLabel}</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-ink">{profile?.business_name || 'Tableau de bord'}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                {isUniversity ? 'Université' : 'École'} · {statusLabel}
              </p>
              {profile?.moderation_note && status === 'REJECTED' && (
                <p className="mt-2 text-sm font-medium text-alert">Motif du rejet : {profile.moderation_note}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={queuePath} className={actionBtn}>
                <GraduationCap className="w-4 h-4" /> {isUniversity ? 'Candidatures' : 'Admissions'}
              </Link>
              {isSchool && (
                <Link to="/education/dashboard/ecole" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-border text-ink bg-white">
                  Mon école
                </Link>
              )}
              <Link to="/education/accounting" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-surface">
                <Wallet className="w-4 h-4" /> Comptabilité
              </Link>
              {status === 'PUBLISHED' && (
                <Link
                  to={`/education/establishment/${profile?.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-border text-ink bg-white"
                >
                  <ExternalLink className="w-4 h-4" /> Page publique
                </Link>
              )}
              {(status === 'DRAFT' || status === 'REJECTED') && (
                <button type="button" onClick={submitForReview} disabled={busy} className={actionBtn}>
                  <Send className="w-4 h-4" /> Envoyer en validation
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {statCards.map((item) => (
              <div key={item.label} className={`rounded-2xl ring-1 ring-border px-5 py-4 ${item.tone}`}>
                <p className="text-xs font-semibold text-ink-muted">{item.label}</p>
                <p className="mt-2 text-3xl font-extrabold text-ink">{item.value}</p>
                <p className="mt-1 text-xs text-ink-muted truncate">{item.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="xl:col-span-2 rounded-2xl bg-white ring-1 ring-border px-5 py-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-extrabold text-ink">Dossiers à traiter</h2>
                <Link to={queuePath} className="text-xs font-bold text-primary">Voir la file</Link>
              </div>
              {waiting.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucun dossier en attente.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-ink-muted">
                        <th className="py-2 pr-3">Nom</th>
                        <th className="py-2 pr-3">{isUniversity ? 'Programme' : 'Parcours'}</th>
                        <th className="py-2 pr-3">Année</th>
                        <th className="py-2">Paiement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waiting.slice(0, 6).map((row) => (
                        <tr key={row.id} className="border-t border-border">
                          <td className="py-2.5 pr-3 font-bold text-ink">{row.student_name || 'Dossier'}</td>
                          <td className="py-2.5 pr-3 text-ink-muted">{row.program_title || row.track_label || '—'}</td>
                          <td className="py-2.5 pr-3 text-ink-muted">{row.academic_year || '—'}</td>
                          <td className="py-2.5 text-ink">{row.payment_status === 'PAID' ? 'Payé' : row.payment_status === 'WAIVED' ? 'Gratuit' : 'À suivre'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-white ring-1 ring-border px-5 py-4">
                <h2 className="text-sm font-extrabold text-ink">Frais d’inscription</h2>
                <p className="mt-3 text-3xl font-extrabold text-ink">{paidShare}%</p>
                <p className="text-xs text-ink-muted">des dossiers payants déjà réglés</p>
                <div className="mt-3 h-2 rounded-full bg-surface overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${paidShare}%` }} />
                </div>
                <p className="mt-3 text-sm text-ink">{paid} payé{paid > 1 ? 's' : ''} · {unpaid} en attente</p>
                <Link to="/education/accounting" className="mt-3 inline-flex text-xs font-bold text-primary">Ouvrir la comptabilité</Link>
              </div>
              <div className="rounded-2xl bg-white ring-1 ring-border px-5 py-4">
                <h2 className="text-sm font-extrabold text-ink">Inscriptions en cours</h2>
                {openCampaigns.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">Aucune inscription ouverte aujourd’hui.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {openCampaigns.slice(0, 4).map((row) => (
                      <li key={row.id}>
                        <p className="text-sm font-bold text-ink">{row.program_title || row.academic_year}</p>
                        <p className="text-xs text-ink-muted">{row.opens_on} → {row.closes_on}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      {!showOverview && !schoolFiche && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white ring-1 ring-border p-5">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-accent" />
            Tableau de bord
          </h1>
          <p className="text-ink-muted text-sm mt-1">{profile?.business_name}</p>
          <p className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold bg-white border border-border text-ink">
            {statusLabel}
          </p>
          {profile?.moderation_note && status === 'REJECTED' && (
            <p className="mt-3 text-sm text-alert font-medium">
              Motif du rejet : {profile.moderation_note}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'PUBLISHED' && (
            <Link
              to={`/education/establishment/${profile?.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-surface"
            >
              <ExternalLink className="w-4 h-4" /> Voir la page publique
            </Link>
          )}
          {(status === 'DRAFT' || status === 'REJECTED') && (
            <button
              type="button"
              onClick={submitForReview}
              disabled={busy}
              className={actionBtn}
            >
              <Send className="w-4 h-4" /> Envoyer en validation
            </button>
          )}
        </div>
      </div>
      )}

      {error && <div className="rounded-xl border-2 border-alert bg-alert/10 text-ink px-4 py-3 text-sm font-medium">{error}</div>}
      {notice && <div className="rounded-xl border-2 border-accent bg-primary/5 text-ink px-4 py-3 text-sm font-medium">{notice}</div>}

      {((isSchool && schoolFiche) || isUniversity) && (
        <MerchantAccountCard hint="Ce compte reçoit les frais d’inscription. Il est distinct de l’abonnement Isoko Hub." />
      )}
      {( !isSchool || schoolFiche) && (
      <form onSubmit={saveProfile} className={`space-y-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-gray-900 shadow-sm ${isSchool ? 'ring-1 ring-border' : 'border-2 border-accent'}`}>
        <div>
          <h2 className="font-extrabold text-ink text-lg">{isSchool ? 'Mon école' : 'Fiche de l’établissement'}</h2>
          {isSchool && (
            <p className="text-sm text-ink-muted mt-1">Ce que les familles voient sur la page publique de l&apos;école.</p>
          )}
        </div>

        {profile?.business_detail?.category_slug === 'ecole' && (
          <div className="space-y-3 p-4 rounded-xl bg-surface ring-1 ring-border">
            <p className="text-sm font-bold text-ink">Cette école est *</p>
            <p className="text-xs text-ink-muted">Le choix s&apos;enregistre dès que vous le cochez. Il apparaît ensuite sur la page publique.</p>
            {(() => {
              const stored = [
                profile?.offers_prescolaire && 'Enseignement préscolaire',
                profile?.offers_ecofo && 'École fondamentale (ECOFO)',
                profile?.offers_post_fondamental && 'Post-fondamental',
              ].filter(Boolean);
              return (
                <p className="text-xs font-semibold text-ink">
                  {stored.length
                    ? `Les visiteurs voient : ${stored.join(' · ')}`
                    : 'Les visiteurs ne voient encore aucun parcours.'}
                </p>
              );
            })()}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!form.offers_prescolaire} onChange={(e) => applyTracks({ offers_prescolaire: e.target.checked })} />
              Enseignement préscolaire
            </label>
            {form.offers_prescolaire && (
              <p className="pl-6 text-xs text-ink-muted">
                Premier palier, non obligatoire. Il prépare l&apos;enfant à entrer dans l&apos;enseignement fondamental.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={!!form.offers_ecofo}
                onChange={(e) => applyTracks({
                  offers_ecofo: e.target.checked,
                  ecofo_classes: e.target.checked ? (form.ecofo_classes || []) : [],
                })}
              />
              École fondamentale (ECOFO)
            </label>
            {form.offers_ecofo && (
              <div className="pl-6">
                <SchoolEcofoClassesEditor
                  classes={form.ecofo_classes || []}
                  inputClass={inputClass}
                  onChange={(ecofo_classes) => applyTracks({ ecofo_classes, offers_ecofo: true })}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!form.offers_post_fondamental} onChange={(e) => applyTracks({ offers_post_fondamental: e.target.checked })} />
              Post-fondamental
            </label>
            {form.offers_post_fondamental && (
              <div className="pl-6">
                <SchoolSectionsEditor
                  sections={form.post_fondamental_sections || []}
                  catalog={enums.post_filieres}
                  inputClass={inputClass}
                  onChange={(post_fondamental_sections) => applyTracks({ post_fondamental_sections })}
                />
              </div>
            )}
          </div>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Catégorie
            </label>
            <p className={`${inputClass} bg-transparent`}>
              {profile?.business_detail?.category_name || '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Statut de l'établissement
            </label>
            <select
              value={form.operational_status}
              onChange={(e) => setField('operational_status', e.target.value)}
              className={inputClass}
            >
              {(enums.operational_statuses || []).map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Langues d'enseignement
            </label>
            <input
              value={form.teaching_languages}
              onChange={(e) => setField('teaching_languages', e.target.value)}
              placeholder="Kirundi, Français, Anglais"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Email de contact public
            </label>
            <input
              type="email"
              value={form.institutional_email}
              onChange={(e) => setField('institutional_email', e.target.value)}
              placeholder="Si différent de l'e-mail dans Paramètres"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Site web
            </label>
            <p className={`${inputClass} bg-transparent`}>
              {profile?.business_detail?.website || 'Non renseigné'}
            </p>
            <Link to="/business/settings" className="mt-1 inline-block text-xs font-semibold text-primary">
              Modifier dans Paramètres
            </Link>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Numéro d'agrément
            </label>
            <input
              value={form.accreditation_number}
              onChange={(e) => setField('accreditation_number', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Organisme certificateur
            </label>
            <input
              value={form.accreditation_body}
              onChange={(e) => setField('accreditation_body', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Validité de l'agrément
            </label>
            <input
              type="date"
              value={form.accreditation_valid_until}
              onChange={(e) => setField('accreditation_valid_until', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Nom officiel
            </label>
            <input
              value={form.official_name}
              onChange={(e) => setField('official_name', e.target.value)}
              placeholder="Dénomination légale, si différente du nom commercial"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Présentation courte
            </label>
            <textarea
              rows={3}
              value={form.short_description}
              onChange={(e) => setField('short_description', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Description détaillée
            </label>
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Historique
            </label>
            <p className="text-xs text-ink-muted mb-2">
              Ajoutez les photos de l&apos;école. Elles défilent toutes seules sur la page publique. Huit au maximum.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.gallery || []).map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    title="Retirer"
                    onClick={() => setField('gallery', form.gallery.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-alert text-white text-xs font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {(form.gallery || []).length < 8 && (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs font-bold text-ink cursor-pointer">
                <ImagePlus className="w-4 h-4 text-primary" />
                Ajouter une photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const dataUrl = await readImageAsDataUrl(file, { maxSide: 1400, quality: 0.78 });
                      setField('gallery', [...(form.gallery || []), dataUrl].slice(0, 8));
                      setError('');
                    } catch (ex) {
                      setError(ex.message || 'Image invalide');
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {profile?.business_detail?.category_slug === 'ecole' && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-ink">Régime de l&apos;école</p>
          <p className="text-xs text-ink-muted">Indiquez si les élèves sont internes, externes, les deux, ou si ce n&apos;est pas le cas.</p>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="radio" name="boarding_regime" className="mt-1" checked={!form.boarding_regime} onChange={() => setField('boarding_regime', '')} />
            <span><span className="font-semibold">Non précisé</span> — l&apos;école n&apos;a pas ce régime, ou ne l&apos;a pas encore indiqué.</span>
          </label>
          {(enums.boarding_regimes || EDUCATION_ENUM_FALLBACK.boarding_regimes || []).map((item) => (
            <label key={item.value} className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="boarding_regime"
                className="mt-1"
                checked={form.boarding_regime === item.value}
                onChange={() => setField('boarding_regime', item.value)}
              />
              <span>
                <span className="font-semibold">{item.label.split(' — ')[0]}</span>
                {item.label.includes(' — ') ? ` — ${item.label.split(' — ').slice(1).join(' — ')}` : ''}
              </span>
            </label>
          ))}
        </div>
        )}

        {!isSchool && !isUniversity && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(enums.particularities || []).map((tag) => (
            <label key={tag.value} className="flex items-center gap-2 text-sm text-ink dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={form[tag.value]}
                onChange={(e) => setField(tag.value, e.target.checked)}
                className="rounded border-border text-green-700 focus:ring-green-700"
              />
              <span>{tag.label}</span>
            </label>
          ))}
        </div>
        )}

        {profile?.business_detail?.category_slug === 'universite' && (
          <div className="md:col-span-2 space-y-3 rounded-2xl ring-1 ring-border p-4">
            <p className="text-sm font-bold text-ink">Vie du campus</p>
            <p className="text-xs text-ink-muted">Ces textes sont publiés tels quels. Ce n’est pas un outil de gestion.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold">Rentrée<input type="date" className={`${inputClass} mt-1`} value={form.year_start || ''} onChange={(e) => setField('year_start', e.target.value)} /></label>
              <label className="text-xs font-semibold">Début des examens<input type="date" className={`${inputClass} mt-1`} value={form.year_exam_start || ''} onChange={(e) => setField('year_exam_start', e.target.value)} /></label>
              <label className="text-xs font-semibold">Début de pause<input type="date" className={`${inputClass} mt-1`} value={form.year_break_start || ''} onChange={(e) => setField('year_break_start', e.target.value)} /></label>
              <label className="text-xs font-semibold">Fin de pause<input type="date" className={`${inputClass} mt-1`} value={form.year_break_end || ''} onChange={(e) => setField('year_break_end', e.target.value)} /></label>
              <label className="text-xs font-semibold sm:col-span-2">Date de délibération<input type="date" className={`${inputClass} mt-1`} value={form.year_deliberation || ''} onChange={(e) => setField('year_deliberation', e.target.value)} /></label>
              <label className="text-xs font-semibold sm:col-span-2">Bibliothèque — horaires<input className={`${inputClass} mt-1`} value={form.library_hours || ''} onChange={(e) => setField('library_hours', e.target.value)} placeholder="Lun–ven, 8h–18h" /></label>
              <label className="text-xs font-semibold">Accès<input className={`${inputClass} mt-1`} value={form.library_access || ''} onChange={(e) => setField('library_access', e.target.value)} placeholder="Carte étudiante" /></label>
              <label className="text-xs font-semibold">Contact bibliothèque<input className={`${inputClass} mt-1`} value={form.library_contact || ''} onChange={(e) => setField('library_contact', e.target.value)} /></label>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={!!form.internship_required} onChange={(e) => setField('internship_required', e.target.checked)} />
                Stage obligatoire
              </label>
              <label className="text-xs font-semibold">Durée du stage<input className={`${inputClass} mt-1`} value={form.internship_duration || ''} onChange={(e) => setField('internship_duration', e.target.value)} placeholder="3 mois" /></label>
              <label className="text-xs font-semibold">Période<input className={`${inputClass} mt-1`} value={form.internship_period || ''} onChange={(e) => setField('internship_period', e.target.value)} placeholder="Second semestre" /></label>
              <label className="text-xs font-semibold sm:col-span-2">Contact du service des stages<input className={`${inputClass} mt-1`} value={form.internship_contact || ''} onChange={(e) => setField('internship_contact', e.target.value)} /></label>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold">Services étudiants</p>
              {(form.student_services || []).map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input className={inputClass} value={row.label || ''} placeholder="Internat, infirmerie, restauration…" onChange={(e) => {
                    const next = [...form.student_services];
                    next[index] = { ...row, label: e.target.value };
                    setField('student_services', next);
                  }} />
                  <input className={inputClass} value={row.description || ''} placeholder="Contact ou précision" onChange={(e) => {
                    const next = [...form.student_services];
                    next[index] = { ...row, description: e.target.value };
                    setField('student_services', next);
                  }} />
                  <button type="button" className="text-xs font-bold text-alert" onClick={() => setField('student_services', form.student_services.filter((_, i) => i !== index))}>Retirer</button>
                </div>
              ))}
              <button type="button" className="text-xs font-bold text-primary" onClick={() => setField('student_services', [...(form.student_services || []), { label: '', description: '' }])}>Ajouter un service</button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className={actionBtn}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la fiche
        </button>
      </form>
      )}

    </div>
  );
}
