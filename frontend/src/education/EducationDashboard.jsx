import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Save, Send, Plus, Pencil, Trash2, ExternalLink, EyeOff, Eye, Loader2, ImagePlus,
} from 'lucide-react';
import educationService from './educationService';
import SchoolSectionsEditor from './SchoolSectionsEditor';
import SchoolEcofoClassesEditor, { DEFAULT_ECOFO_CLASSES } from './SchoolEcofoClassesEditor';
import { EDUCATION_ENUM_FALLBACK, loadEducationEnums } from './educationEnums';
import { parseListField, EMPTY_ITEM } from './educationListFields';
import { readImageAsDataUrl } from '../shared/components/BusinessRegistrationForm';

const inputClass = 'w-full px-3 py-2 text-sm bg-surface border-2 border-accent rounded-xl text-ink outline-none focus:border-alert';

const EMPTY_PROGRAM = {
  title: '', domain: '', degree_awarded: '', duration_label: '',
  entry_level: '', exit_level: '', career_outlook: '',
  semester_organization: '', main_subjects: '', admission_conditions: '',
  internship_details: '', required_documents: [],
  unit: '', duration_years: '',
  level: 'OTHER', is_active: true, is_public: true, display_order: 0,
};

/** Champ liste éditable : une ligne = libellé + détail. */
function ListRows({ label, rows, onChange, placeholder }) {
  return (
    <div className="md:col-span-2">
      <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
        {label}
      </label>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2">
            <input
              value={row.label}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, label: e.target.value };
                onChange(next);
              }}
              placeholder={placeholder}
              className="sm:w-1/3 px-3 py-2 text-sm bg-surface border-2 border-accent rounded-xl text-ink outline-none focus:border-alert"
            />
            <input
              value={row.description}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, description: e.target.value };
                onChange(next);
              }}
              placeholder="Détail (facultatif)"
              className="flex-1 px-3 py-2 text-sm bg-surface border-2 border-accent rounded-xl text-ink outline-none focus:border-alert"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                className="px-2 rounded-xl border-2 border-alert text-alert shrink-0"
                title="Retirer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...rows, { ...EMPTY_ITEM }])}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
        </button>
      </div>
    </div>
  );
}

export default function EducationDashboard() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [units, setUnits] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
      const [p, list, unitList] = await Promise.all([
        educationService.getMyProfile(),
        educationService.listPrograms(),
        educationService.listUnits().catch(() => []),
      ]);
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
        ecofo_classes: Array.isArray(p.ecofo_classes) && p.ecofo_classes.length
          ? p.ecofo_classes
          : (p.offers_ecofo ? DEFAULT_ECOFO_CLASSES.map((row) => ({ ...row })) : []),
        post_fondamental_sections: Array.isArray(p.post_fondamental_sections) ? p.post_fondamental_sections : [],
      });
      setPrograms(Array.isArray(list) ? list : (list?.results || []));
      setUnits(Array.isArray(unitList) ? unitList : (unitList?.results || []));
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

  const saveProgram = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { required_documents, ...rest } = editing;
      const payload = {
        ...rest,
        required_documents: required_documents || [],
        unit: rest.unit || null,
        duration_years: rest.duration_years === '' ? null : rest.duration_years,
      };
      if (editing.id) {
        await educationService.updateProgram(editing.id, payload);
        setNotice('Formation mise à jour.');
      } else {
        await educationService.createProgram(payload);
        setNotice('Formation créée.');
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const removeProgram = async (id) => {
    if (!window.confirm('Supprimer cette formation ?')) return;
    setBusy(true);
    setError('');
    try {
      await educationService.deleteProgram(id);
      await load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement…</div>;
  if (error && !form) return <div className="p-8 text-red-600">{error}</div>;
  if (!form) return null;

  const status = profile?.publication_status;
  const statusLabel = (enums.publication_statuses || []).find((row) => row.value === status)?.label || status;
  const isSchool = profile?.business_detail?.category_slug === 'ecole';

  return (
    <div className="space-y-6 pb-10 text-ink">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border-duo bg-surface p-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-accent" />
            Tableau de bord
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{profile?.business_name}</p>
          <p className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-900 border-2 border-accent text-ink">
            {statusLabel}
          </p>
          {profile?.updated_at && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              Dernière mise à jour le {new Date(profile.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20"
            >
              <ExternalLink className="w-4 h-4" /> Voir la page publique
            </Link>
          )}
          {(status === 'DRAFT' || status === 'REJECTED') && (
            <button
              type="button"
              onClick={submitForReview}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Envoyer en validation
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border-2 border-alert bg-alert/10 text-ink px-4 py-3 text-sm font-medium">{error}</div>}
      {notice && <div className="rounded-xl border-2 border-accent bg-primary/5 text-ink px-4 py-3 text-sm font-medium">{notice}</div>}

      <form onSubmit={saveProfile} className="space-y-4 p-5 rounded-2xl border-2 border-accent bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="font-extrabold text-ink text-lg">Fiche de l&apos;établissement</h2>

        {profile?.business_detail?.category_slug === 'ecole' && (
          <div className="space-y-3 p-4 rounded-xl border-2 border-accent/40">
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
                  ecofo_classes: e.target.checked
                    ? ((form.ecofo_classes || []).length
                      ? form.ecofo_classes
                      : DEFAULT_ECOFO_CLASSES.map((row) => ({ ...row })))
                    : [],
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(enums.particularities || []).filter((tag) => !(profile?.business_detail?.category_slug === 'ecole' && tag.value === 'has_boarding')).map((tag) => (
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

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shadow-md shadow-teal-600/20 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la fiche
        </button>
      </form>

      {isSchool ? null : (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-ink text-lg">Formations ({programs.length})</h2>
          <button
            type="button"
            onClick={() => setEditing({ ...EMPTY_PROGRAM })}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shadow-md shadow-teal-600/20"
          >
            <Plus className="w-4 h-4" /> Nouvelle formation
          </button>
        </div>

        {editing && (
          <form onSubmit={saveProgram} className="space-y-4 p-5 rounded-2xl border-2 border-accent bg-white dark:bg-gray-900 shadow-sm">
            <h3 className="font-extrabold text-ink text-lg">
              {editing.id ? 'Modifier la formation' : 'Nouvelle formation'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Intitulé *</label>
                <input
                  required
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Domaine</label>
                <input
                  value={editing.domain}
                  onChange={(e) => setEditing({ ...editing, domain: e.target.value })}
                  placeholder="Ex: Sciences de l'informatique"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Diplôme délivré</label>
                <input
                  value={editing.degree_awarded}
                  onChange={(e) => setEditing({ ...editing, degree_awarded: e.target.value })}
                  className={inputClass}
                />
              </div>
              { (profile?.business_detail?.category_slug === 'universite') ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Faculté ou département</label>
                <select
                  value={editing.unit || ''}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Établissement</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.parent_name ? `${u.parent_name} / ${u.name}` : u.name}
                    </option>
                  ))}
                </select>
              </div>
              ) : (
              <details className="md:col-span-2 text-sm text-ink-muted">
                <summary className="cursor-pointer font-semibold text-ink">Faculté ou département, si vous en avez</summary>
                <select
                  value={editing.unit || ''}
                  onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">Établissement</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.parent_name ? `${u.parent_name} / ${u.name}` : u.name}
                    </option>
                  ))}
                </select>
              </details>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Nombre d'années</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editing.duration_years ?? ''}
                  onChange={(e) => setEditing({ ...editing, duration_years: e.target.value })}
                  className={inputClass}
                />
              </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Niveau</label>
            <select
              value={editing.level}
              onChange={(e) => setEditing({ ...editing, level: e.target.value })}
              className={inputClass}
            >
              {(enums.levels || []).map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Organisation en semestres
            </label>
            <input
              value={editing.semester_organization || ''}
              onChange={(e) => setEditing({ ...editing, semester_organization: e.target.value })}
              placeholder="Ex: 6 semestres, 2 ans"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Matières principales
            </label>
            <textarea
              rows={2}
              value={editing.main_subjects || ''}
              onChange={(e) => setEditing({ ...editing, main_subjects: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Conditions d'admission
            </label>
            <textarea
              rows={2}
              value={editing.admission_conditions || ''}
              onChange={(e) => setEditing({ ...editing, admission_conditions: e.target.value })}
              className={inputClass}
            />
          </div>
          <ListRows
            label="Pièces requises"
            rows={editing.required_documents || []}
            onChange={(rows) => setEditing({ ...editing, required_documents: rows })}
            placeholder="Relevés de notes, Photocopies…"
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">
              Modalités de stage
            </label>
            <textarea
              rows={2}
              value={editing.internship_details || ''}
              onChange={(e) => setEditing({ ...editing, internship_details: e.target.value })}
              className={inputClass}
            />
          </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Durée</label>
                <input
                  value={editing.duration_label}
                  onChange={(e) => setEditing({ ...editing, duration_label: e.target.value })}
                  placeholder="Ex: 3 ans"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Niveau d'entrée</label>
                <input
                  value={editing.entry_level}
                  onChange={(e) => setEditing({ ...editing, entry_level: e.target.value })}
                  placeholder="Ex: Baccalauréat"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Niveau de sortie</label>
                <input
                  value={editing.exit_level}
                  onChange={(e) => setEditing({ ...editing, exit_level: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Débouchés</label>
                <textarea
                  rows={2}
                  value={editing.career_outlook}
                  onChange={(e) => setEditing({ ...editing, career_outlook: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="rounded border-border text-green-700 focus:ring-green-700"
                />
                <span>Formation ouverte</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_public}
                  onChange={(e) => setEditing({ ...editing, is_public: e.target.checked })}
                  className="rounded border-border text-green-700 focus:ring-green-700"
                />
                <span>Visible publiquement</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shadow-md shadow-teal-600/20 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl border-2 border-border text-sm font-semibold text-ink"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {programs.length === 0 ? (
          <div className="p-6 rounded-2xl border-2 border-dashed border-accent text-center text-sm text-ink-muted space-y-2">
            <p>Aucune formation enregistrée.</p>
            <p>Publiez une formation, puis ouvrez la campagne de l&apos;année.</p>
            <Link to="/education/dashboard/admissions" className="inline-block text-primary font-bold">Admissions et frais</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {programs.map((p) => (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border-2 border-accent bg-white dark:bg-gray-900 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-ink truncate">{p.title}</h3>
                    {p.is_public ? (
                      <Eye className="w-3.5 h-3.5 text-primary" title="Visible publiquement" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-ink-muted" title="Masqué" />
                    )}
                    {!p.is_active && (
                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-primary/10 border border-accent text-ink">
                        Fermée
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted font-medium">
                    {[p.degree_awarded, p.domain, p.duration_label].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing({
                    ...EMPTY_PROGRAM,
                    ...p,
                    required_documents: parseListField(p.required_documents),
                  })}
                    className="p-2 rounded-xl border-2 border-accent text-ink"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProgram(p.id)}
                    disabled={busy}
                    className="p-2 rounded-xl border-2 border-alert text-alert disabled:opacity-50"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
