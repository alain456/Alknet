import React, { useEffect, useRef, useState } from 'react';
import { Plus, Upload, User } from 'lucide-react';
import { readImageAsDataUrl } from '../shared/imageUpload';
import providerService from './providerService';

const empty = {
  name: '',
  role_title: '',
  qualifications: '',
  experience: '',
  photo_url: '',
  is_public: true,
};
const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const fieldClass = 'w-full border border-border rounded-lg px-3 py-2 bg-white';

function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function Portrait({ src, name, size = 'md' }) {
  const box = size === 'lg' ? 'w-24 h-24 text-xl' : 'w-16 h-16 text-sm';
  const label = (name || '').trim() ? initials(name) : '';
  return (
    <div className={`${box} rounded-full overflow-hidden shrink-0 bg-surface flex items-center justify-center`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : label ? (
        <span className="font-bold text-primary">{label}</span>
      ) : (
        <User className="w-6 h-6 text-ink-muted" />
      )}
    </div>
  );
}

export default function ProviderTeam() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = () => providerService.listTeam()
    .then((data) => setRows(normalize(data)))
    .catch((err) => setError(err.message || 'Équipe indisponible'));

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setForm(empty);
    setEditingId(null);
    setImageError('');
    setError('');
    setOpen(true);
  };

  const startEdit = (row) => {
    setForm({
      name: row.name || '',
      role_title: row.role_title || '',
      qualifications: row.qualifications || '',
      experience: row.experience || '',
      photo_url: row.photo_url || '',
      is_public: row.is_public !== false,
    });
    setEditingId(row.id);
    setImageError('');
    setError('');
    setOpen(true);
  };

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    setUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, { maxSize: 480, quality: 0.82, square: true });
      setForm((current) => ({ ...current, photo_url: dataUrl }));
    } catch (err) {
      setImageError(err.message || 'Image invalide');
    } finally {
      setUploading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await providerService.saveTeam(editingId, form);
      setForm(empty);
      setEditingId(null);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Retirer ${row.name} de l’équipe ?`)) return;
    setError('');
    try {
      await providerService.deleteTeam(row.id);
      if (editingId === row.id) {
        setOpen(false);
        setEditingId(null);
        setForm(empty);
      }
      await load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Équipe</h1>
          <p className="text-sm text-ink-muted mt-1">
            Présentez les personnes qui interviennent : photo, rôle, qualifications et expérience.
            Seuls les profils publics apparaissent sur votre fiche.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="px-4 py-2 bg-primary text-white rounded-xl font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Ajouter une personne
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {open && (
        <form onSubmit={save} className="bg-white rounded-2xl p-5 space-y-4">
          <p className="font-semibold text-ink">
            {editingId ? 'Modifier la fiche' : 'Nouvelle personne'}
          </p>
          <div className="flex gap-4 items-start">
            <Portrait src={form.photo_url} name={form.name} size="lg" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Photo</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={pickImage}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Compression…' : 'Téléverser un portrait'}
              </button>
              {form.photo_url && (
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, photo_url: '' }))}
                  className="block text-xs text-error underline"
                >
                  Retirer la photo
                </button>
              )}
              {imageError && <p className="text-xs text-error">{imageError}</p>}
              <p className="text-xs text-ink-muted">JPG, PNG ou WebP. Le portrait est recadré en carré.</p>
            </div>
          </div>
          <input
            required
            placeholder="Nom"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={fieldClass}
          />
          <input
            placeholder="Rôle (ex. Auxiliaire de vie)"
            value={form.role_title}
            onChange={(e) => setForm({ ...form, role_title: e.target.value })}
            className={fieldClass}
          />
          <textarea
            placeholder="Qualifications et compétences"
            rows={3}
            value={form.qualifications}
            onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
            className={fieldClass}
          />
          <textarea
            placeholder="Expérience"
            rows={3}
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
            className={fieldClass}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
            />
            Visible publiquement
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || uploading} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-60">
              {saving ? 'Enregistrement…' : (editingId ? 'Mettre à jour' : 'Ajouter')}
            </button>
            <button
              type="button"
              className="px-4 py-2 border border-border rounded-xl font-semibold"
              onClick={() => { setOpen(false); setEditingId(null); setForm(empty); }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 && !open && (
        <p className="text-sm text-ink-muted bg-white rounded-2xl p-5">
          Aucune personne pour le moment. Ajoutez un portrait pour que les clients voient qui intervient.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="bg-white rounded-2xl p-4 flex items-start gap-4">
            <Portrait src={row.photo_url} name={row.name} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{row.name}</p>
              <p className="text-sm text-primary">{row.role_title || 'Rôle non renseigné'}</p>
              <p className="text-xs text-ink-muted mt-1">{row.is_public ? 'Public' : 'Privé'}</p>
              {row.qualifications ? (
                <p className="text-sm text-ink mt-2 line-clamp-2">{row.qualifications}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button type="button" className="text-sm font-semibold" onClick={() => startEdit(row)}>Modifier</button>
              <button type="button" className="text-sm font-semibold text-error" onClick={() => remove(row)}>Retirer</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
