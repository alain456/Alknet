import React, { useEffect, useState } from 'react';
import { Eye, Pencil, Power, Trash2, X, RefreshCw } from 'lucide-react';
import api from '../shared/api';
import { userHasPlatformPerm } from '../auth/platformPermissions';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../shared/components/PasswordInput';

const EMPTY_FORM = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone_number: '',
  role_code: 'finance',
  is_active: true,
};

export default function AdminPlatformRolesPage() {
  const { user, refreshProfile } = useAuth();
  const canEdit = userHasPlatformPerm(user, 'platform.roles.update');
  const canViewUser = userHasPlatformPerm(user, 'platform.users.view')
    || userHasPlatformPerm(user, 'platform.roles.view');
  const canCreate = userHasPlatformPerm(user, 'platform.users.create');
  const canUpdateUser = userHasPlatformPerm(user, 'platform.users.update');
  const canDeleteUser = userHasPlatformPerm(user, 'platform.users.delete');

  const [groups, setGroups] = useState([]);
  const [roles, setRoles] = useState([]);
  const [actors, setActors] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [metaDrafts, setMetaDrafts] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [selectedActor, setSelectedActor] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [modalBusy, setModalBusy] = useState(false);

  const loadRoles = async () => {
    const data = await api.get('accounts/admin/platform-roles/', { auth: true });
    const list = data?.results || [];
    setGroups(data?.groups || []);
    setRoles(list);
    const next = {};
    const meta = {};
    list.forEach((role) => {
      next[role.code] = new Set(role.permissions || []);
      meta[role.code] = {
        name: role.name || '',
        description: role.description || '',
      };
    });
    setDrafts(next);
    setMetaDrafts(meta);
  };

  const loadActors = async () => {
    const data = await api.get('accounts/admin/platform-actors/', { auth: true });
    setActors(data?.results || []);
  };

  const load = async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setError('');
    try {
      await Promise.all([loadRoles(), loadActors()]);
    } catch (err) {
      setError(err.message || 'Impossible de charger les rôles');
    } finally {
      if (!soft) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (code, key, locked) => {
    if (locked || !canEdit) return;
    setDrafts((prev) => {
      const set = new Set(prev[code] || []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, [code]: set };
    });
  };

  const toggleGroup = (code, keys, locked) => {
    if (locked || !canEdit) return;
    setDrafts((prev) => {
      const set = new Set(prev[code] || []);
      const allOn = keys.every((key) => set.has(key));
      keys.forEach((key) => {
        if (allOn) set.delete(key);
        else set.add(key);
      });
      return { ...prev, [code]: set };
    });
  };

  const save = async (code) => {
    setSaving(code);
    setMessage('');
    setError('');
    try {
      const meta = metaDrafts[code] || {};
      const role = roles.find((row) => row.code === code);
      const body = {
        name: meta.name,
        description: meta.description,
      };
      if (!role?.is_locked) {
        body.permissions = Array.from(drafts[code] || []);
      }
      await api.patch(
        `accounts/admin/platform-roles/${code}/`,
        body,
        { auth: true },
      );
      setMessage('Nom et droits enregistrés.');
      await loadRoles();
      await loadActors();
      if (typeof refreshProfile === 'function') {
        try { await refreshProfile(); } catch (_) { /* ignore */ }
      }
    } catch (err) {
      setError(err.message || 'Échec enregistrement');
    } finally {
      setSaving('');
    }
  };

  const createActor = async (event) => {
    event.preventDefault();
    setCreating(true);
    setMessage('');
    setError('');
    try {
      await api.post('accounts/admin/platform-actors/', form, { auth: true });
      setForm(EMPTY_FORM);
      setMessage('Acteur créé et rôle attribué.');
      await loadActors();
    } catch (err) {
      setError(err.message || 'Échec création de l’acteur');
    } finally {
      setCreating(false);
    }
  };

  const openView = async (actor) => {
    setError('');
    setMessage('');
    setBusyId(actor.id);
    try {
      const detail = await api.get(`accounts/admin/platform-actors/${actor.id}/`, { auth: true });
      setSelectedActor(detail);
      setModalMode('view');
    } catch (err) {
      setError(err.message || 'Impossible d’ouvrir l’acteur');
    } finally {
      setBusyId('');
    }
  };

  const openEdit = async (actor) => {
    setError('');
    setMessage('');
    setBusyId(actor.id);
    try {
      const detail = await api.get(`accounts/admin/platform-actors/${actor.id}/`, { auth: true });
      setSelectedActor(detail);
      setEditForm({
        email: detail.email || '',
        password: '',
        first_name: detail.first_name || '',
        last_name: detail.last_name || '',
        phone_number: detail.phone_number || '',
        role_code: detail.role_code || 'finance',
        is_active: Boolean(detail.is_active),
      });
      setModalMode('edit');
    } catch (err) {
      setError(err.message || 'Impossible d’ouvrir l’acteur');
    } finally {
      setBusyId('');
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedActor(null);
    setEditForm(EMPTY_FORM);
  };

  const saveActor = async (event) => {
    event.preventDefault();
    if (!selectedActor) return;
    setModalBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        email: editForm.email,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone_number: editForm.phone_number,
        role_code: editForm.role_code,
        is_active: editForm.is_active,
      };
      if (editForm.password) payload.password = editForm.password;
      await api.patch(`accounts/admin/platform-actors/${selectedActor.id}/`, payload, { auth: true });
      setMessage('Acteur mis à jour.');
      closeModal();
      await loadActors();
    } catch (err) {
      setError(err.message || 'Échec modification');
    } finally {
      setModalBusy(false);
    }
  };

  const toggleActive = async (actor) => {
    if (actor.id === user?.id) return;
    setBusyId(actor.id);
    setError('');
    try {
      await api.patch(
        `accounts/admin/platform-actors/${actor.id}/`,
        { is_active: !actor.is_active },
        { auth: true },
      );
      setMessage(actor.is_active ? 'Acteur désactivé.' : 'Acteur activé.');
      await loadActors();
    } catch (err) {
      setError(err.message || 'Échec mise à jour');
    } finally {
      setBusyId('');
    }
  };

  const removeActor = async (actor) => {
    if (actor.id === user?.id) return;
    if (!window.confirm(`Supprimer l’acteur « ${actor.email} » ?`)) return;
    setBusyId(actor.id);
    setError('');
    try {
      await api.delete(`accounts/admin/platform-actors/${actor.id}/`, { auth: true });
      setMessage(`Acteur « ${actor.email} » supprimé.`);
      if (selectedActor?.id === actor.id) closeModal();
      await loadActors();
    } catch (err) {
      setError(err.message || 'Échec suppression');
    } finally {
      setBusyId('');
    }
  };

  const fieldClass = 'mt-1 w-full px-3 py-2.5 text-sm bg-surface border-2 border-accent rounded-xl text-ink font-medium outline-none focus:border-alert';
  const actionBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border text-ink-muted hover:bg-surface disabled:opacity-40';
  const primaryBtn = 'px-4 py-2 rounded-xl bg-[#132F45] text-[#F5F5F5] text-sm font-semibold disabled:opacity-50';

  if (loading) {
    return <div className="py-16 text-center text-sm text-ink-muted">Chargement des rôles plateforme…</div>;
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Rôles & permissions plateforme</h1>
          <p className="text-sm text-ink-muted max-w-2xl">
            Droits alignés sur le menu admin actuel : file « À traiter », recherche globale,
            modération, abonnements, services et messages contact.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ soft: true })}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </header>
      {error && <div className="p-3 rounded-xl bg-alert/10 text-alert text-sm">{error}</div>}
      {message && <div className="p-3 rounded-xl bg-primary/10 text-primary text-sm">{message}</div>}

      {canCreate && (
        <section className="rounded-3xl bg-white p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-ink">Créer un acteur</h2>
            <p className="text-sm text-ink-muted">
              Le compte se connecte immédiatement avec le rôle choisi.
            </p>
          </div>
          <form onSubmit={createActor} className="grid md:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink-muted">
              Prénom
              <input
                className={fieldClass}
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Nom
              <input
                className={fieldClass}
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted md:col-span-2">
              Email *
              <input
                type="email"
                required
                className={fieldClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Mot de passe *
              <PasswordInput
                required
                autoComplete="new-password"
                className={fieldClass}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 caractères"
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Téléphone
              <input
                className={fieldClass}
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted md:col-span-2">
              Rôle à attribuer *
              <select
                required
                className={fieldClass}
                value={form.role_code}
                onChange={(e) => setForm({ ...form, role_code: e.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className={primaryBtn}
              >
                {creating ? 'Création…' : 'Créer et attribuer le rôle'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-3xl bg-white overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="font-semibold text-ink">Acteurs plateforme</h2>
          <p className="text-sm text-ink-muted">
            {actors.length} compte(s) · Actions : Voir · Modifier · Activer · Supprimer
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Acteur</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {actors.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">
                    Aucun acteur plateforme pour le moment.
                  </td>
                </tr>
              )}
              {actors.map((actor) => {
                const isSelf = actor.id === user?.id;
                return (
                  <tr key={actor.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">
                        {actor.first_name || actor.last_name
                          ? `${actor.first_name} ${actor.last_name}`.trim()
                          : actor.email}
                      </div>
                      <div className="text-xs text-ink-muted">{actor.email}</div>
                    </td>
                    <td className="px-4 py-3">{actor.role_name || actor.role}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        actor.is_active ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {actor.is_active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {canViewUser && (
                          <button
                            type="button"
                            title="Voir"
                            disabled={busyId === actor.id}
                            onClick={() => openView(actor)}
                            className={actionBtn}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {canUpdateUser && (
                          <button
                            type="button"
                            title="Modifier"
                            disabled={busyId === actor.id}
                            onClick={() => openEdit(actor)}
                            className={actionBtn}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canUpdateUser && !isSelf && (
                          <button
                            type="button"
                            title={actor.is_active ? 'Désactiver' : 'Activer'}
                            disabled={busyId === actor.id}
                            onClick={() => toggleActive(actor)}
                            className={actionBtn}
                          >
                            <Power className={`w-4 h-4 ${actor.is_active ? 'text-amber-700' : 'text-teal-700'}`} />
                          </button>
                        )}
                        {canDeleteUser && !isSelf && (
                          <button
                            type="button"
                            title="Supprimer"
                            disabled={busyId === actor.id}
                            onClick={() => removeActor(actor)}
                            className={`${actionBtn} text-red-700 border-red-200 hover:bg-red-50`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {roles.map((role) => {
        const selected = drafts[role.code] || new Set();
        const meta = metaDrafts[role.code] || { name: role.name, description: role.description };
        const selectedCount = selected.size;
        return (
          <section key={role.code} className="rounded-3xl bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-[220px] space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {role.is_locked ? (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-accent text-ink">Tous les droits</span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-surface text-ink-muted">
                      {selectedCount} droit{selectedCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <label className="block text-xs font-semibold text-ink-muted">
                  Nom du rôle
                  <input
                    className={fieldClass}
                    value={meta.name || ''}
                    disabled={!canEdit}
                    onChange={(e) => setMetaDrafts((prev) => ({
                      ...prev,
                      [role.code]: { ...prev[role.code], name: e.target.value },
                    }))}
                  />
                </label>
                <label className="block text-xs font-semibold text-ink-muted">
                  Description
                  <textarea
                    rows={2}
                    className={fieldClass}
                    value={meta.description || ''}
                    disabled={!canEdit}
                    onChange={(e) => setMetaDrafts((prev) => ({
                      ...prev,
                      [role.code]: { ...prev[role.code], description: e.target.value },
                    }))}
                  />
                </label>
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={saving === role.code}
                  onClick={() => save(role.code)}
                  className={primaryBtn}
                >
                  {saving === role.code ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              )}
            </div>
            <div className="space-y-4">
              {groups.map((group) => {
                const keys = (group.actions || []).map((action) => action.key);
                const allOn = keys.every((key) => selected.has(key));
                const groupOn = keys.filter((key) => selected.has(key)).length;
                return (
                  <div key={group.id}>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h3 className="text-sm font-semibold text-ink">
                        {group.label}
                        <span className="ml-2 text-[11px] font-medium text-ink-muted">{groupOn}/{keys.length}</span>
                      </h3>
                      {!role.is_locked && canEdit && (
                        <button
                          type="button"
                          onClick={() => toggleGroup(role.code, keys, role.is_locked)}
                          className="text-xs font-semibold text-primary"
                        >
                          {allOn ? 'Tout retirer' : 'Tout cocher'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(group.actions || []).map((action) => {
                        const on = selected.has(action.key);
                        return (
                          <label
                            key={action.key}
                            title={action.hint || action.key}
                            className={`inline-flex flex-col items-start gap-0.5 px-3 py-1.5 rounded-2xl border text-xs font-semibold ${
                              on
                                ? 'bg-accent text-ink border-accent'
                                : 'bg-surface border-border text-ink-muted'
                            } ${role.is_locked ? 'opacity-80' : 'cursor-pointer'}`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={role.is_locked || !canEdit}
                                onChange={() => toggle(role.code, action.key, role.is_locked)}
                              />
                              {action.label}
                            </span>
                            {action.hint ? (
                              <span className={`pl-6 text-[10px] font-medium ${on ? 'text-ink' : 'text-ink-muted'}`}>
                                {action.hint}
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {modalMode && selectedActor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="font-semibold text-ink">
                {modalMode === 'view' ? 'Détail de l’acteur' : 'Modifier l’acteur'}
              </h3>
              <button type="button" onClick={closeModal} className="text-ink-muted hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMode === 'view' ? (
              <div className="p-5 space-y-3 text-sm">
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-ink-muted">Nom</span>
                  <span className="font-semibold text-ink">
                    {`${selectedActor.first_name || ''} ${selectedActor.last_name || ''}`.trim() || '—'}
                  </span>
                  <span className="text-ink-muted">Email</span>
                  <span>{selectedActor.email}</span>
                  <span className="text-ink-muted">Téléphone</span>
                  <span>{selectedActor.phone_number || '—'}</span>
                  <span className="text-ink-muted">Rôle</span>
                  <span>{selectedActor.role_name || selectedActor.role}</span>
                  <span className="text-ink-muted">Statut</span>
                  <span>{selectedActor.is_active ? 'Actif' : 'Désactivé'}</span>
                  <span className="text-ink-muted">Créé le</span>
                  <span>
                    {selectedActor.created_at
                      ? new Date(selectedActor.created_at).toLocaleString('fr-FR')
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  {canUpdateUser && (
                    <button
                      type="button"
                      onClick={() => openEdit(selectedActor)}
                      className={primaryBtn}
                    >
                      Modifier
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3 py-2 rounded-xl border border-border text-sm font-semibold"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={saveActor} className="p-5 grid gap-3">
                <label className="text-xs font-semibold text-ink-muted">
                  Prénom
                  <input
                    className={fieldClass}
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold text-ink-muted">
                  Nom
                  <input
                    className={fieldClass}
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold text-ink-muted">
                  Email *
                  <input
                    type="email"
                    required
                    className={fieldClass}
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold text-ink-muted">
                  Téléphone
                  <input
                    className={fieldClass}
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold text-ink-muted">
                  Rôle *
                  <select
                    required
                    disabled={selectedActor.id === user?.id}
                    className={fieldClass}
                    value={editForm.role_code}
                    onChange={(e) => setEditForm({ ...editForm, role_code: e.target.value })}
                  >
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink-muted">
                  Nouveau mot de passe
                  <PasswordInput
                    autoComplete="new-password"
                    className={fieldClass}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Laisser vide pour ne pas changer"
                  />
                </label>
                {selectedActor.id !== user?.id && (
                  <label className="inline-flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    />
                    Compte actif
                  </label>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3 py-2 rounded-xl border border-border text-sm font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={modalBusy}
                    className={primaryBtn}
                  >
                    {modalBusy ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
