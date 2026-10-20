import React, { useCallback, useEffect, useState } from 'react';
import { Building2, BookOpen, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import educationService from './educationService';
import { loadEducationEnums, programHeadline, universityCycles } from './educationEnums';

const inputClass = 'w-full px-3 py-2 text-sm bg-surface border-2 border-accent rounded-xl text-ink outline-none focus:border-alert';
const actionBtn = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-accent text-ink hover:opacity-95 disabled:opacity-50';
const FACULTY_YEARS = ['BAC I', 'BAC II', 'BAC III', 'Master I', 'Master II'];

function asTuition(raw) {
  if (Array.isArray(raw?.schedules)) {
    return { academic_year: raw.academic_year || '', schedules: raw.schedules };
  }
  if (Array.isArray(raw?.installments) && raw.installments.length) {
    return {
      academic_year: raw.academic_year || '',
      schedules: [{ year_label: '', option: '', installments: raw.installments }],
    };
  }
  return { academic_year: raw?.academic_year || '', schedules: [] };
}

function tuitionPayload(raw) {
  const tuition = asTuition(raw);
  return {
    academic_year: tuition.academic_year.trim(),
    schedules: tuition.schedules.map((row) => ({
      year_label: (row.year_label || '').trim(),
      option: (row.option || '').trim(),
      installments: (row.installments || []).map((item, index) => ({
        label: (item.label || `Tranche ${index + 1}`).trim(),
        amount_bif: Number(item.amount_bif) || 0,
        due_date: item.due_date || '',
      })),
    })),
  };
}

function suggestedYears(editing) {
  const custom = (editing.study_year_labels || []).map((name) => String(name).trim()).filter(Boolean);
  if (custom.length) return custom;
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const count = editing.level === 'MASTER' ? 2 : editing.level === 'DOCTORATE' ? 3 : 3;
  const prefix = editing.level === 'MASTER' ? 'Master' : editing.level === 'DOCTORATE' ? 'Doctorat' : 'BAC';
  return roman.slice(0, count).map((mark) => `${prefix} ${mark}`);
}

function TuitionEditor({ tuition, onChange, years, options, hint }) {
  const current = asTuition(tuition);
  const setTuition = (next) => onChange(next);
  const updateSchedule = (index, patch) => {
    const schedules = current.schedules.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setTuition({ ...current, schedules });
  };
  return (
    <div className="sm:col-span-2 space-y-3">
      <p className="text-xs font-semibold">Frais de scolarité</p>
      <p className="text-xs text-ink-muted">{hint}</p>
      <label className="block text-xs font-semibold">
        Année académique
        <input
          className={`${inputClass} mt-1`}
          value={current.academic_year}
          onChange={(e) => setTuition({ ...current, academic_year: e.target.value })}
          placeholder="2026-2027"
        />
      </label>
      {current.schedules.map((schedule, index) => (
        <div key={index} className="rounded-xl bg-surface p-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-xs font-semibold">
              Niveau
              <select
                className={`${inputClass} mt-1`}
                value={schedule.year_label || ''}
                onChange={(e) => updateSchedule(index, { year_label: e.target.value })}
              >
                <option value="">Tous les niveaux</option>
                {(years || []).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            {options ? (
              <label className="block text-xs font-semibold">
                Option
                <select
                  className={`${inputClass} mt-1`}
                  value={schedule.option || ''}
                  onChange={(e) => updateSchedule(index, { option: e.target.value })}
                >
                  <option value="">Toutes les options</option>
                  {options.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <ul className="space-y-2">
            {(schedule.installments || []).map((row, tranche) => (
              <li key={tranche} className="grid sm:grid-cols-[1fr_8rem_10rem_auto] gap-2 items-end">
                <label className="block text-xs font-semibold">
                  Libellé
                  <input
                    className={`${inputClass} mt-1`}
                    value={row.label || ''}
                    onChange={(e) => {
                      const installments = [...(schedule.installments || [])];
                      installments[tranche] = { ...row, label: e.target.value };
                      updateSchedule(index, { installments });
                    }}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Montant (BIF)
                  <input
                    type="number"
                    min="0"
                    className={`${inputClass} mt-1`}
                    value={row.amount_bif ?? ''}
                    onChange={(e) => {
                      const installments = [...(schedule.installments || [])];
                      installments[tranche] = { ...row, amount_bif: e.target.value };
                      updateSchedule(index, { installments });
                    }}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Date
                  <input
                    type="date"
                    className={`${inputClass} mt-1`}
                    value={row.due_date || ''}
                    onChange={(e) => {
                      const installments = [...(schedule.installments || [])];
                      installments[tranche] = { ...row, due_date: e.target.value };
                      updateSchedule(index, { installments });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs font-bold text-alert pb-2"
                  onClick={() => updateSchedule(index, {
                    installments: (schedule.installments || []).filter((_, i) => i !== tranche),
                  })}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="text-xs font-bold text-primary"
              onClick={() => updateSchedule(index, {
                installments: [...(schedule.installments || []), { label: `Tranche ${(schedule.installments || []).length + 1}`, amount_bif: '', due_date: '' }],
              })}
            >
              Ajouter une tranche
            </button>
            <button
              type="button"
              className="text-xs font-bold text-alert"
              onClick={() => setTuition({ ...current, schedules: current.schedules.filter((_, i) => i !== index) })}
            >
              Retirer ce barème
            </button>
            <span className="text-sm font-bold">
              {(schedule.installments || []).reduce((sum, row) => sum + (Number(row.amount_bif) || 0), 0).toLocaleString('fr-BI')} BIF
            </span>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="px-3 py-2 rounded-xl border-2 border-accent text-sm font-bold"
        onClick={() => setTuition({
          ...current,
          schedules: [...current.schedules, { year_label: '', option: '', installments: [{ label: 'Tranche 1', amount_bif: '', due_date: '' }] }],
        })}
      >
        Ajouter un barème
      </button>
    </div>
  );
}

export default function UniversityStructure({ mode = 'faculties' }) {
  const facultiesMode = mode === 'faculties';
  const [units, setUnits] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [editing, setEditing] = useState(null);
  const [optionDraft, setOptionDraft] = useState('');
  const [yearDraft, setYearDraft] = useState('');
  const [cycles, setCycles] = useState(() => universityCycles());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cycleFilter, setCycleFilter] = useState('LICENCE');

  const load = useCallback(async () => {
    try {
      const [unitList, programList] = await Promise.all([
        educationService.listUnits(),
        educationService.listPrograms(),
      ]);
      setUnits(Array.isArray(unitList) ? unitList : (unitList?.results || []));
      setPrograms(Array.isArray(programList) ? programList : (programList?.results || []));
      setError('');
    } catch (err) {
      setError(err.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    loadEducationEnums().then((data) => setCycles(universityCycles(data)));
  }, []);

  const cycleLabel = (value) => cycles.find((row) => row.value === value)?.label || value || 'Programme';
  const blankProgram = (level) => {
    if (level === 'MASTER') {
      return { title: '', domain: '', level: 'MASTER', duration_years: '2', duration_label: '2 ans', unit: '', options: [], study_year_labels: [], tuition: { academic_year: '', schedules: [] }, is_public: true };
    }
    if (level === 'LICENCE') {
      return { title: '', domain: '', level: 'LICENCE', duration_years: '3', duration_label: '3 ans', unit: '', options: [], study_year_labels: [], tuition: { academic_year: '', schedules: [] }, is_public: true };
    }
    return { title: '', domain: '', level: 'DOCTORATE', duration_years: '3', duration_label: '3 ans', unit: '', options: [], study_year_labels: [], tuition: { academic_year: '', schedules: [] }, is_public: true };
  };
  const visiblePrograms = programs.filter((program) => {
    if (cycleFilter === 'MASTER') return program.level === 'MASTER';
    if (cycleFilter === 'LICENCE') return program.level === 'LICENCE';
    return program.level !== 'LICENCE' && program.level !== 'MASTER';
  });

  const faculties = units.filter((row) => row.kind === 'FACULTY' || (!row.parent && row.kind !== 'DEPARTMENT'));
  const departments = units.filter((row) => row.kind === 'DEPARTMENT' && row.parent);

  const save = async (event) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (facultiesMode) {
        const payload = {
          name: editing.name,
          kind: editing.kind,
          parent: editing.parent || null,
          description: editing.description || '',
          tuition: tuitionPayload(editing.tuition),
          is_active: true,
        };
        if (editing.id) await educationService.updateUnit(editing.id, payload);
        else await educationService.createUnit(payload);
      } else {
        const payload = {
          title: editing.title,
          domain: editing.domain || '',
          level: editing.level,
          duration_years: editing.duration_years || null,
          duration_label: editing.duration_label || '',
          unit: editing.level === 'MASTER' ? null : (editing.unit || null),
          options: editing.level === 'MASTER' ? [] : (Array.isArray(editing.options) ? editing.options : []),
          study_year_labels: editing.level === 'MASTER' ? [] : (Array.isArray(editing.study_year_labels) ? editing.study_year_labels : []),
          tuition: tuitionPayload(editing.tuition),
          is_active: true,
          is_public: !!editing.is_public,
        };
        if (editing.id) await educationService.updateProgram(editing.id, payload);
        else await educationService.createProgram(payload);
      }
      setEditing(null);
      setOptionDraft('');
      setYearDraft('');
      setNotice('Enregistré.');
      await load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const removeUnit = async (row) => {
    if (!window.confirm(`Supprimer ${row.name} ?`)) return;
    setBusy(true);
    try {
      await educationService.deleteUnit(row.id);
      await load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  const removeProgram = async (row) => {
    if (!window.confirm(`Supprimer ${row.title} ?`)) return;
    setBusy(true);
    try {
      await educationService.deleteProgram(row.id);
      await load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-8 text-center text-ink-muted">Chargement…</p>;

  return (
    <div className="space-y-6 pb-10 text-ink">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 rounded-2xl bg-white ring-1 ring-border p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Université</p>
          <h1 className="mt-1 text-2xl font-extrabold flex items-center gap-2">
            {facultiesMode ? <Building2 className="w-7 h-7 text-accent" /> : <BookOpen className="w-7 h-7 text-accent" />}
            {facultiesMode ? 'Facultés' : 'Programmes'}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            {facultiesMode
              ? 'Les facultés et les départements organisent le baccalauréat. Un master s’y rattache, il se gère dans Programmes.'
              : 'Le baccalauréat se décrit par faculté, niveaux et options. Le master se décrit par mention, domaine et durée.'}
          </p>
        </div>
        <button
          type="button"
          className={actionBtn}
          onClick={() => {
            setNotice('');
            if (facultiesMode) {
              setEditing({ name: '', kind: 'FACULTY', parent: '', description: '' });
            } else {
              setEditing(blankProgram(cycleFilter));
              setOptionDraft('');
            }
          }}
        >
          <Plus className="w-4 h-4" /> {facultiesMode ? 'Nouvelle faculté' : (cycleFilter === 'MASTER' ? 'Nouveau master' : cycleFilter === 'LICENCE' ? 'Nouveau baccalauréat' : 'Nouveau programme')}
        </button>
      </div>

      {error && <p className="rounded-xl border-2 border-alert bg-alert/10 px-4 py-3 text-sm font-medium">{error}</p>}
      {notice && <p className="rounded-xl border-2 border-accent bg-primary/5 px-4 py-3 text-sm font-medium">{notice}</p>}

      {facultiesMode ? (
        faculties.length === 0 ? (
          <p className="rounded-2xl bg-surface ring-1 ring-border p-6 text-sm text-ink-muted">Aucune faculté pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {faculties.map((faculty) => {
              const children = departments.filter((row) => String(row.parent) === String(faculty.id));
              return (
                <article key={faculty.id} className="rounded-2xl bg-white ring-1 ring-border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-extrabold">{faculty.name}</h2>
                      {faculty.description && <p className="text-sm text-ink-muted mt-1">{faculty.description}</p>}
                      {asTuition(faculty.tuition).schedules.length > 0 && (
                        <p className="text-sm mt-1">
                          Scolarité {faculty.tuition.academic_year} · {asTuition(faculty.tuition).schedules.length} barème{asTuition(faculty.tuition).schedules.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="p-2 rounded-xl border-2 border-accent" title="Modifier" onClick={() => setEditing({ ...faculty, parent: faculty.parent || '' })}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" className="p-2 rounded-xl border-2 border-alert text-alert" title="Supprimer" onClick={() => removeUnit(faculty)} disabled={busy}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {children.length === 0 && <li className="text-sm text-ink-muted">Aucun département.</li>}
                    {children.map((dept) => (
                      <li key={dept.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2">
                        <span className="text-sm font-semibold">{dept.name}</span>
                        <span className="flex gap-2">
                          <button type="button" className="text-xs font-bold text-primary" onClick={() => setEditing({ ...dept, kind: 'DEPARTMENT' })}>Modifier</button>
                          <button type="button" className="text-xs font-bold text-alert" onClick={() => removeUnit(dept)}>Retirer</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-3 text-xs font-bold text-primary"
                    onClick={() => setEditing({ name: '', kind: 'DEPARTMENT', parent: faculty.id, description: '' })}
                  >
                    Ajouter un département
                  </button>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <>
        <div className="flex flex-wrap gap-2">
          {[
            ['LICENCE', 'Baccalauréats'],
            ['MASTER', 'Masters'],
            ['OTHER', 'Autres'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setCycleFilter(id); setEditing(null); }}
              className={`px-4 py-2 rounded-full text-sm font-bold ${cycleFilter === id ? 'bg-accent text-ink' : 'bg-white ring-1 ring-border text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {visiblePrograms.length === 0 ? (
          <p className="rounded-2xl bg-surface ring-1 ring-border p-6 text-sm text-ink-muted">
            {cycleFilter === 'MASTER' ? 'Aucun master pour le moment.' : cycleFilter === 'LICENCE' ? 'Aucun baccalauréat pour le moment.' : 'Aucun autre programme pour le moment.'}
          </p>
        ) : (
          <div className="space-y-3">
            {visiblePrograms.map((program) => (
              <article key={program.id} className="rounded-2xl bg-white ring-1 ring-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-extrabold truncate">{programHeadline(program.title, cycleLabel(program.level))}</h2>
                    <p className="text-sm text-ink-muted mt-1">
                      {program.level === 'MASTER'
                        ? [program.domain && `Domaine : ${program.domain}`, program.duration_label].filter(Boolean).join(' · ')
                        : [program.faculty_name || program.unit_name, program.duration_label].filter(Boolean).join(' · ') || 'Sans faculté'}
                      {program.is_public ? ' · visible' : ' · masqué'}
                    </p>
                    {program.level !== 'MASTER' && (program.study_year_labels || []).length > 0 && (
                      <p className="text-sm mt-1">Niveaux : {program.study_year_labels.join(' · ')}</p>
                    )}
                    {program.level !== 'MASTER' && (program.options || []).length > 0 && (
                      <p className="text-sm mt-2">Options : {program.options.join(' · ')}</p>
                    )}
                    {asTuition(program.tuition).schedules.length > 0 && (
                      <p className="text-sm mt-2">
                        Scolarité {program.tuition.academic_year} · {asTuition(program.tuition).schedules.length} barème{asTuition(program.tuition).schedules.length > 1 ? 's' : ''}
                      </p>
                    )}
                    {!asTuition(program.tuition).schedules.length && (program.tuition_display?.lines || []).length > 0 && (
                      <p className="text-sm mt-2">Scolarité reprise de la faculté {program.tuition_display.source}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="p-2 rounded-xl border-2 border-accent"
                      title="Modifier"
                      onClick={() => {
                        setEditing({
                          ...program,
                          unit: program.unit || '',
                          options: program.options || [],
                          study_year_labels: program.study_year_labels || [],
                          tuition: asTuition(program.tuition),
                        });
                        setOptionDraft('');
                        setYearDraft('');
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-2 rounded-xl border-2 border-alert text-alert" title="Supprimer" onClick={() => removeProgram(program)} disabled={busy}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        </>
      )}

      {editing && (
        <form onSubmit={save} className="space-y-4 rounded-2xl bg-white ring-1 ring-border p-5">
          <h2 className="font-extrabold">
            {facultiesMode
              ? (editing.kind === 'DEPARTMENT' ? 'Département' : 'Faculté')
              : (editing.id
                ? (editing.level === 'MASTER' ? 'Modifier le master' : editing.level === 'LICENCE' ? 'Modifier le baccalauréat' : 'Modifier le programme')
                : (editing.level === 'MASTER' ? 'Nouveau master' : editing.level === 'LICENCE' ? 'Nouveau baccalauréat' : 'Nouveau programme'))}
          </h2>
          {facultiesMode ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Nom</label>
                <input required className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              {editing.kind === 'DEPARTMENT' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Faculté</label>
                  <select className={inputClass} value={editing.parent || ''} onChange={(e) => setEditing({ ...editing, parent: e.target.value })} required>
                    <option value="">Choisir</option>
                    {faculties.filter((row) => row.id !== editing.id).map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea rows={2} className={inputClass} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <TuitionEditor
                tuition={editing.tuition}
                years={FACULTY_YEARS}
                onChange={(tuition) => setEditing({ ...editing, tuition })}
                hint={editing.kind === 'DEPARTMENT'
                  ? 'Ces frais s’appliquent aux programmes de ce département et remplacent ceux de la faculté. Vous pouvez les distinguer par niveau : BAC I, BAC II, BAC III.'
                  : 'Ces frais s’appliquent aux programmes de la faculté qui n’ont pas leur propre barème, ni celui d’un département. Vous pouvez les distinguer par niveau.'}
              />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">{editing.level === 'MASTER' ? 'Mention' : 'Intitulé'}</label>
                <input required className={inputClass} value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder={editing.level === 'MASTER' ? 'Droit' : 'Sciences et technologies'} />
              </div>
              {editing.level === 'MASTER' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Domaine</label>
                  <input className={inputClass} value={editing.domain ?? ''} onChange={(e) => setEditing({ ...editing, domain: e.target.value })} placeholder="Sciences juridiques" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">Cycle</label>
                <select
                  className={inputClass}
                  value={editing.level}
                  onChange={(e) => {
                    const level = e.target.value;
                    const defaults = level === 'MASTER'
                      ? { duration_years: '2', duration_label: '2 ans' }
                      : level === 'LICENCE'
                        ? { duration_years: '3', duration_label: '3 ans' }
                        : {};
                    setEditing({ ...editing, domain: editing.domain ?? '', title: editing.title ?? '', level, ...defaults });
                    setCycleFilter(level === 'MASTER' ? 'MASTER' : level === 'LICENCE' ? 'LICENCE' : 'OTHER');
                  }}
                >
                  {cycles.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Durée affichée</label>
                <input className={inputClass} value={editing.duration_label || ''} onChange={(e) => setEditing({ ...editing, duration_label: e.target.value })} placeholder={editing.level === 'MASTER' ? '2 ans' : '3 ans'} />
              </div>
              {editing.level !== 'MASTER' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Faculté ou département</label>
                <select className={inputClass} value={editing.unit || ''} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} required={editing.level === 'LICENCE'}>
                  <option value="">Choisir</option>
                  {units.map((row) => (
                    <option key={row.id} value={row.id}>{row.parent_name ? `${row.parent_name} / ${row.name}` : row.name}</option>
                  ))}
                </select>
              </div>
              )}
              {editing.level !== 'MASTER' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Niveaux d’inscription</label>
                <p className="text-xs text-ink-muted mb-2">Laissez vide pour proposer BAC I, BAC II et BAC III selon la durée. Sinon, indiquez les vôtres.</p>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={yearDraft}
                    onChange={(e) => setYearDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const name = yearDraft.trim();
                      const current = editing.study_year_labels || [];
                      if (!name || current.includes(name) || current.length >= 6) return;
                      setEditing({ ...editing, study_year_labels: [...current, name] });
                      setYearDraft('');
                    }}
                    placeholder="Ajouter un niveau"
                  />
                  <button
                    type="button"
                    className="shrink-0 px-3 rounded-xl border-2 border-accent text-sm font-bold"
                    onClick={() => {
                      const name = yearDraft.trim();
                      const current = editing.study_year_labels || [];
                      if (!name || current.includes(name) || current.length >= 6) return;
                      setEditing({ ...editing, study_year_labels: [...current, name] });
                      setYearDraft('');
                    }}
                  >
                    Ajouter
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {(editing.study_year_labels || []).length === 0 && (
                    <li className="text-sm text-ink-muted">Niveaux automatiques.</li>
                  )}
                  {(editing.study_year_labels || []).map((name) => (
                    <li key={name} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                      <span className="font-semibold">{name}</span>
                      <button
                        type="button"
                        className="text-xs font-bold text-alert"
                        onClick={() => setEditing({
                          ...editing,
                          study_year_labels: (editing.study_year_labels || []).filter((row) => row !== name),
                        })}
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              )}
              {editing.level !== 'MASTER' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1">Options</label>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const name = optionDraft.trim();
                      const current = editing.options || [];
                      if (!name || current.includes(name)) return;
                      setEditing({ ...editing, options: [...current, name] });
                      setOptionDraft('');
                    }}
                    placeholder="Ajouter une option"
                  />
                  <button
                    type="button"
                    className="shrink-0 px-3 rounded-xl border-2 border-accent text-sm font-bold"
                    onClick={() => {
                      const name = optionDraft.trim();
                      const current = editing.options || [];
                      if (!name || current.includes(name)) return;
                      setEditing({ ...editing, options: [...current, name] });
                      setOptionDraft('');
                    }}
                  >
                    Ajouter
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {(editing.options || []).length === 0 && (
                    <li className="text-sm text-ink-muted">Aucune option pour ce programme.</li>
                  )}
                  {(editing.options || []).map((name) => (
                    <li key={name} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2 text-sm">
                      <span className="font-semibold">{name}</span>
                      <button
                        type="button"
                        className="text-xs font-bold text-alert"
                        onClick={() => setEditing({
                          ...editing,
                          options: (editing.options || []).filter((row) => row !== name),
                        })}
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              )}
              <TuitionEditor
                tuition={editing.tuition}
                years={suggestedYears(editing)}
                options={editing.level === 'MASTER' ? null : (editing.options || [])}
                onChange={(tuition) => setEditing({ ...editing, tuition })}
                hint="Un barème peut viser tout le programme, un seul niveau (BAC I, BAC II, BAC III) ou une option. S’il est enregistré, il remplace le frais de la faculté."
              />
              <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={!!editing.is_public} onChange={(e) => setEditing({ ...editing, is_public: e.target.checked })} />
                Visible sur la page publique
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className={actionBtn} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enregistrer
            </button>
            <button type="button" className="px-4 py-2.5 rounded-xl border-2 border-border text-sm font-bold" onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
