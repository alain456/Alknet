import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ImageIcon, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import providerService, { OFFER_STATUS_LABELS } from './providerService';
import { readImageAsDataUrl } from '../shared/imageUpload';

const empty = {
  title: '',
  parent: '',
  description: '',
  modalities: '',
  availability: '',
  coverage_zone: '',
  image_url: '',
  status: 'ACTIVE',
  sub_items: [],
};

const fieldClass = 'w-full border border-border rounded-lg px-3 py-2';
const normalize = (data) => (Array.isArray(data) ? data : data?.results || []);
const emptyLine = () => ({ title: '', description: '' });
const photoOf = (row) => (row?.image_urls && row.image_urls[0]) || '';

function toForm(row = {}, parent = '') {
  return {
    ...empty,
    ...row,
    parent: parent || row.parent || '',
    image_url: photoOf(row),
    sub_items: (row.sub_items || []).length ? row.sub_items : [],
  };
}

export default function ProviderOffers() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [formKind, setFormKind] = useState('group');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const fileRef = useRef(null);

  const load = () => providerService.listOffers()
    .then((data) => setRows(normalize(data)))
    .catch((err) => setError(err.message || 'Catalogue indisponible'));

  useEffect(() => { load(); }, []);

  const childrenOf = (id) => rows
    .filter((row) => row.parent === id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title, 'fr'));

  const topLevel = useMemo(() => rows.filter((row) => !row.parent), [rows]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return topLevel;
    return topLevel.filter((row) => {
      const hay = [
        row.title,
        ...rows.filter((item) => item.parent === row.id).map((item) => item.title),
      ].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [topLevel, query, rows]);

  const parentTitle = form.parent
    ? (rows.find((row) => row.id === form.parent)?.title || '')
    : '';

  const openGroup = (row = null) => {
    setFormKind('group');
    setEditingId(row?.id || null);
    setForm(row ? toForm(row) : empty);
    setImageError('');
    setOpen(true);
  };

  const openChild = (parent, row = null) => {
    setFormKind('child');
    setEditingId(row?.id || null);
    setForm(row ? toForm(row, parent.id) : { ...empty, parent: parent.id, sub_items: [emptyLine()] });
    setImageError('');
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        title: form.title,
        description: form.description,
        modalities: form.modalities,
        availability: form.availability,
        coverage_zone: form.coverage_zone,
        status: form.status,
        parent: formKind === 'child' ? (form.parent || null) : null,
        image_urls: form.image_url?.trim() ? [form.image_url.trim()] : [],
      };
      if (formKind === 'child') {
        payload.sub_items = (form.sub_items || []).filter((item) => (item.title || '').trim());
        if (!editingId && form.parent) {
          payload.sort_order = childrenOf(form.parent).length + 1;
        }
      }
      await providerService.saveOffer(editingId, payload);
      setOpen(false);
      setEditingId(null);
      setForm(empty);
      await load();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible');
    }
  };

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    setUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file, { maxSize: 900, quality: 0.8 });
      setForm((current) => ({ ...current, image_url: dataUrl }));
    } catch (err) {
      setImageError(err.message || 'Image invalide');
    } finally {
      setUploading(false);
    }
  };

  const setLine = (index, patch) => {
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    }));
  };

  const removeOffer = async (row, { cascade = false } = {}) => {
    const message = cascade
      ? `Retirer « ${row.title} » et tous ses sous-services ?`
      : `Retirer le sous-service « ${row.title} » ?`;
    if (!window.confirm(message)) return;
    setBusyId(row.id);
    setError('');
    try {
      await providerService.deleteOffer(row.id);
      if (editingId === row.id) {
        setOpen(false);
        setEditingId(null);
        setForm(empty);
      }
      await load();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setBusyId(null);
    }
  };

  const moveChild = async (parent, index, direction) => {
    const kids = childrenOf(parent.id);
    const next = index + direction;
    if (next < 0 || next >= kids.length) return;
    setBusyId(parent.id);
    setError('');
    try {
      await providerService.saveOffer(kids[index].id, { sort_order: next });
      await providerService.saveOffer(kids[next].id, { sort_order: index });
      await load();
    } catch (err) {
      setError(err.message || 'Réordonnancement impossible');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Services</h1>
          <p className="text-sm text-ink-muted mt-1">
            Un service regroupe ses sous-services. Chaque sous-service a sa photo, sa description
            et s’affiche comme une fiche côté client.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openGroup()}
          className="px-4 py-2 bg-primary text-white rounded-xl font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Ajouter un service
        </button>
      </div>

      <div className="search-panel">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un service ou un sous-service…"
          className={fieldClass}
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {visible.length === 0 && !open && (
        <p className="text-sm text-ink-muted">
          {rows.length === 0
            ? 'Aucun service pour le moment. Ajoutez un service, puis ses sous-services avec photo.'
            : 'Aucun résultat pour cette recherche.'}
        </p>
      )}

      <div className="space-y-4">
        {visible.map((row) => {
          const kids = childrenOf(row.id);
          const locked = busyId === row.id || kids.some((child) => child.id === busyId);
          return (
            <article key={row.id} className="bg-white rounded-2xl p-4 space-y-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{row.title}</p>
                  <p className="text-xs text-ink-muted">
                    {OFFER_STATUS_LABELS[row.status] || row.status}
                    {' · '}
                    {kids.length > 1 ? `${kids.length} sous-services` : `${kids.length} sous-service`}
                  </p>
                  {row.description && (
                    <p className="text-sm text-ink-muted mt-1 whitespace-pre-line line-clamp-3">{row.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border border-border rounded-xl text-sm font-semibold inline-flex items-center gap-1"
                    onClick={() => openGroup(row)}
                  >
                    <Pencil className="w-4 h-4" /> Modifier
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    className="px-3 py-2 border border-border rounded-xl text-sm font-semibold text-error inline-flex items-center gap-1 disabled:opacity-40"
                    onClick={() => removeOffer(row, { cascade: true })}
                  >
                    <Trash2 className="w-4 h-4" /> Retirer
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sous-services</p>
                  <button
                    type="button"
                    onClick={() => openChild(row)}
                    className="text-sm font-semibold text-primary inline-flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Ajouter un sous-service
                  </button>
                </div>
                {kids.length === 0 && (
                  <p className="text-sm text-ink-muted">
                    Aucun sous-service. Ajoutez-en un avec une photo pour qu’il apparaisse côté client.
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  {kids.map((child, index) => (
                    <div key={child.id} className="rounded-xl bg-paper/60 p-3 space-y-2">
                      <div className="flex gap-3">
                        <div className="w-20 h-20 rounded-xl bg-white overflow-hidden shrink-0 flex items-center justify-center">
                          {photoOf(child) ? (
                            <img src={photoOf(child)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-ink-muted" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink leading-snug">{child.title}</p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            {OFFER_STATUS_LABELS[child.status] || child.status}
                          </p>
                          {child.description && (
                            <p className="text-xs text-ink-muted mt-1 line-clamp-2">{child.description}</p>
                          )}
                        </div>
                      </div>
                      {(child.sub_items || []).length > 0 && (
                        <ul className="text-xs text-ink pl-2 border-l-2 border-primary space-y-0.5">
                          {child.sub_items.map((item) => (
                            <li key={item.id || item.title}>{item.title}</li>
                          ))}
                        </ul>
                      )}
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          disabled={locked || index === 0}
                          onClick={() => moveChild(row, index, -1)}
                          className="p-1.5 rounded-lg border border-border disabled:opacity-40"
                          title="Monter"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={locked || index === kids.length - 1}
                          onClick={() => moveChild(row, index, 1)}
                          className="p-1.5 rounded-lg border border-border disabled:opacity-40"
                          title="Descendre"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1.5 rounded-lg border border-border text-xs font-semibold"
                          onClick={() => openChild(row, child)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={locked || busyId === child.id}
                          className="px-2 py-1.5 rounded-lg border border-border text-xs font-semibold text-error disabled:opacity-40"
                          onClick={() => removeOffer(child)}
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {open && (
        <form onSubmit={save} className="bg-white rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">
            {formKind === 'child'
              ? (editingId ? 'Modifier le sous-service' : 'Nouveau sous-service')
              : (editingId ? 'Modifier le service' : 'Nouveau service')}
          </h2>
          {formKind === 'child' && parentTitle && (
            <p className="text-sm text-ink-muted">Dans « {parentTitle} »</p>
          )}
          <label className="block text-sm space-y-1">
            <span className="font-medium">{formKind === 'child' ? 'Nom du sous-service *' : 'Nom du service *'}</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={fieldClass}
              placeholder={formKind === 'child' ? 'Ex. Garde d’enfants' : 'Ex. Service à domicile'}
            />
          </label>
          <label className="block text-sm space-y-1">
            <span className="font-medium">Description *</span>
            <textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass} />
          </label>
          <label className="block text-sm space-y-1">
            <span className="font-medium">Modalités</span>
            <textarea rows={2} value={form.modalities} onChange={(e) => setForm({ ...form, modalities: e.target.value })} className={fieldClass} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span className="font-medium">Disponibilités</span>
              <input value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} className={fieldClass} />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Zone d’intervention</span>
              <input value={form.coverage_zone} onChange={(e) => setForm({ ...form, coverage_zone: e.target.value })} className={fieldClass} />
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{formKind === 'child' ? 'Photo du sous-service' : 'Photo du service'}</p>
            <div className="flex gap-3 items-start">
              <div className="w-24 h-24 rounded-xl border border-dashed border-border bg-surface overflow-hidden flex items-center justify-center shrink-0">
                {form.image_url
                  ? <img src={form.image_url} alt="Aperçu" className="w-full h-full object-cover" />
                  : <ImageIcon className="w-8 h-8 text-ink-muted" />}
              </div>
              <div className="flex-1 space-y-2">
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
                  {uploading ? 'Compression…' : 'Téléverser une image'}
                </button>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, image_url: '' }))}
                    className="block text-xs text-error underline"
                  >
                    Retirer l&apos;image
                  </button>
                )}
                {imageError && <p className="text-xs text-error">{imageError}</p>}
              </div>
            </div>
          </div>
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Visibilité</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fieldClass}>
              <option value="ACTIVE">Publiée</option>
              <option value="DRAFT">Masquée</option>
              <option value="SUSPENDED">Retirée</option>
            </select>
          </label>
          {formKind === 'child' && (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">Précisions (facultatif)</p>
                <p className="text-xs text-ink-muted">Détails affichés sur la fiche, en plus de la photo et de la description.</p>
              </div>
              {(form.sub_items || []).map((item, index) => (
                <div key={index} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    placeholder="Titre"
                    value={item.title}
                    onChange={(event) => setLine(index, { title: event.target.value })}
                    className={fieldClass}
                  />
                  <input
                    placeholder="Précision"
                    value={item.description || ''}
                    onChange={(event) => setLine(index, { description: event.target.value })}
                    className={fieldClass}
                  />
                  <button
                    type="button"
                    className="px-3 py-2 border border-border rounded-lg text-sm font-semibold text-error"
                    onClick={() => setForm((current) => ({
                      ...current,
                      sub_items: current.sub_items.filter((_, at) => at !== index),
                    }))}
                  >
                    Retirer
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-semibold text-primary"
                onClick={() => setForm((current) => ({
                  ...current,
                  sub_items: [...(current.sub_items || []), emptyLine()],
                }))}
              >
                Ajouter une précision
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={uploading} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-60">Enregistrer</button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 border border-border rounded-xl font-semibold">Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}
