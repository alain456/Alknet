import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, BookOpen, Building2, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import educationService from './educationService';
import { loadEducationEnums } from './educationEnums';
import { userCanManageEducation, EDUCATION_PERMISSIONS } from './educationPermissions';

const inputClass = 'w-full px-3 py-2 text-sm bg-paper dark:bg-black/30 border border-border dark:border-white/10 rounded-lg text-ink dark:text-white focus:outline-none focus:border-green-600';

const EMPTY_PROGRAM = {
  title: '', domain: '', degree_awarded: '', duration_label: '',
  entry_level: '', exit_level: '', level: 'OTHER', is_active: true, is_public: false,
};
const EMPTY_UNIT = { __entity: 'unit', name: '', kind: 'DEPARTMENT', code: '', description: '', parent: '' };
const EMPTY_PROGRAM_ROW = { ...EMPTY_PROGRAM, __entity: 'program' };

export default function EducationStaff() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [units, setUnits] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [enums, setEnums] = useState({ unit_kinds: [] });

  const canPrograms = userCanManageEducation(user, EDUCATION_PERMISSIONS.PROGRAMS_MANAGE);
  const canStructure = userCanManageEducation(user, EDUCATION_PERMISSIONS.STRUCTURE_MANAGE);

  const load = useCallback(async () => {
    try {
      const [p, list] = await Promise.all([
        educationService.getMyProfile(),
        educationService.listPrograms(),
      ]);
      setProfile(p);
      setPrograms(Array.isArray(list) ? list : (list?.results || []));
      if (canStructure) {
        const u = await educationService.listUnits();
        setUnits(Array.isArray(u) ? u : (u?.results || []));
      }
      setError('');
    } catch (e) {
      setError(e.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canStructure]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadEducationEnums().then(setEnums); }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // `__entity` n'est qu'un marqueur d'UI : il ne part pas au serveur.
      const { __entity, ...payload } = editing;
      if (!payload.parent) payload.parent = null;
      if (!payload.unit) payload.unit = null;
      if (__entity === 'unit') {
        if (editing.id) await educationService.updateUnit(editing.id, payload);
        else await educationService.createUnit(payload);
      } else if (editing.id) {
        await educationService.updateProgram(editing.id, payload);
      } else {
        await educationService.createProgram(payload);
      }
      setEditing(null);
      setNotice('Enregistré.');
      await load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm('Supprimer ?')) return;
    setBusy(true);
    setError('');
    try {
      if (row.__unit) await educationService.deleteUnit(row.id);
      else await educationService.deleteProgram(row.id);
      await load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement…</div>;
  if (error && !profile) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary p-6 rounded-2xl text-white shadow-lg">
        <p className="text-xs font-semibold text-green-100 mb-1">Éducation — espace personnel</p>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="w-7 h-7" /> {profile?.business_name}
        </h1>
        <p className="text-green-100 text-sm mt-1">
          {profile?.business_detail?.category_name || 'Établissement d’enseignement'}
        </p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
      {notice && <div className="p-4 rounded-xl bg-green-50 text-green-800 text-sm">{notice}</div>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-ink dark:text-white">
            <BookOpen className="w-5 h-5 text-green-700 dark:text-green-300" />
            Formations ({programs.length})
          </h2>
          {canPrograms && (
            <button
              type="button"
              onClick={() => setEditing({ ...EMPTY_PROGRAM_ROW })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-ink text-sm font-bold"
            >
              <Plus className="w-4 h-4" /> Nouvelle
            </button>
          )}
        </div>

        {!canPrograms && (
          <p className="text-xs text-gray-500">
            Lecture seule : votre rôle ne comporte pas « Gérer les formations ».
          </p>
        )}

        {programs.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-border dark:border-white/10 text-center text-sm text-gray-500">
            Aucune formation enregistrée.
          </div>
        ) : (
          <div className="space-y-2">
            {programs.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-4 rounded-2xl border border-border dark:border-white/10 bg-white dark:bg-black/20">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-ink dark:text-white truncate">{p.title}</h3>
                  <p className="text-xs text-gray-500">
                    {[p.degree_awarded, p.domain, p.duration_label].filter(Boolean).join(' · ') || '—'}
                    {p.is_public ? ' · public' : ' · masquée'}
                  </p>
                </div>
                {canPrograms && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing({ ...EMPTY_PROGRAM_ROW, ...p })} className="p-2 rounded-lg border border-border dark:border-white/20" title="Modifier">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => remove(p)} disabled={busy} className="p-2 rounded-lg border border-red-500/40 text-red-600" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {canStructure && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-ink dark:text-white">
              <Building2 className="w-5 h-5 text-green-700 dark:text-green-300" />
              Structure ({units.length})
            </h2>
            <button
              type="button"
              onClick={() => setEditing({ ...EMPTY_UNIT })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-ink text-sm font-bold"
            >
              <Plus className="w-4 h-4" /> Nouvelle unité
            </button>
          </div>

          {units.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-border dark:border-white/10 text-center text-sm text-gray-500">
              Aucune faculté ni département enregistré.
            </div>
          ) : (
            <div className="space-y-2">
              {units.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-4 rounded-2xl border border-border dark:border-white/10 bg-white dark:bg-black/20">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-ink dark:text-white truncate">{u.name}</h3>
                    <p className="text-xs text-gray-500">{u.code || u.kind}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing({ ...EMPTY_UNIT, ...u })} className="p-2 rounded-lg border border-border dark:border-white/20" title="Modifier">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => remove({ ...u, __unit: true })} disabled={busy} className="p-2 rounded-lg border border-red-500/40 text-red-600" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {editing && (
        <form onSubmit={save} className="space-y-4 p-5 rounded-2xl border border-green-600/40 bg-green-600/5">
          <h3 className="font-bold text-ink dark:text-white">
            {editing.__entity === 'unit' ? 'Unité' : 'Formation'} — {editing.id ? 'modification' : 'création'}
          </h3>

          {editing.__entity === 'unit' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Nom *</label>
                <input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Type</label>
                <select
                  value={editing.kind || 'DEPARTMENT'}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value })}
                  className={inputClass}
                >
                  {(enums.unit_kinds || []).map((kind) => (
                    <option key={kind.value} value={kind.value}>{kind.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Rattachée à</label>
                <select value={editing.parent || ''} onChange={(e) => setEditing({ ...editing, parent: e.target.value })} className={inputClass}>
                  <option value="">Établissement (racine)</option>
                  {units.filter((u) => u.id !== editing.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.parent_name ? `${u.parent_name} / ${u.name}` : u.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Description</label>
                <textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Intitulé *</label>
                <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass} />
              </div>
              {(profile?.business_detail?.category_slug === 'universite') ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Faculté ou département</label>
                  <select value={editing.unit || ''} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className={inputClass}>
                    <option value="">Établissement</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.parent_name ? `${u.parent_name} / ${u.name}` : u.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
              <details className="md:col-span-2 text-sm">
                <summary className="cursor-pointer font-semibold text-ink">Faculté ou département, si vous en avez</summary>
                <select value={editing.unit || ''} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className={`${inputClass} mt-2`}>
                  <option value="">Établissement</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.parent_name ? `${u.parent_name} / ${u.name}` : u.name}</option>
                  ))}
                </select>
              </details>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Domaine</label>
                <input value={editing.domain || ''} onChange={(e) => setEditing({ ...editing, domain: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-white/70 mb-1">Diplôme délivré</label>
                <input value={editing.degree_awarded} onChange={(e) => setEditing({ ...editing, degree_awarded: e.target.value })} className={inputClass} />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-ink text-sm font-bold disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enregistrer
            </button>
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border border-border dark:border-white/20 text-sm font-semibold text-ink dark:text-white">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
