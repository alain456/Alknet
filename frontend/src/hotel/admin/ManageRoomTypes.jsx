import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Power, Search, X, ImagePlus } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, btnIcon, btnIconDanger, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';
import { readImageAsDataUrl } from '../../shared/components/BusinessRegistrationForm';

const emptyForm = {
  name: '',
  description: '',
  category: '',
  capacity_adults: 2,
  capacity_children: 0,
  bed_configuration: '',
  surface_m2: '',
  amenities_text: '',
  photos: [],
  is_active: true,
};

function amenitiesToText(amenities) {
  if (Array.isArray(amenities)) return amenities.filter(Boolean).join(', ');
  if (typeof amenities === 'string') return amenities;
  return '';
}

function textToAmenities(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function formFromItem(item) {
  return {
    name: item.name || '',
    description: item.description || '',
    category: item.category || '',
    capacity_adults: item.capacity_adults ?? 2,
    capacity_children: item.capacity_children ?? 0,
    bed_configuration: item.bed_configuration || '',
    surface_m2: item.surface_m2 ?? '',
    amenities_text: amenitiesToText(item.amenities),
    photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : [],
    is_active: item.is_active !== false,
  };
}

function payloadFromForm(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    category: (form.category || '').trim(),
    capacity_adults: Number(form.capacity_adults) || 1,
    capacity_children: Number(form.capacity_children) || 0,
    bed_configuration: form.bed_configuration.trim(),
    surface_m2: form.surface_m2 === '' ? null : Number(form.surface_m2),
    amenities: textToAmenities(form.amenities_text),
    photos: Array.isArray(form.photos) ? form.photos.filter(Boolean) : [],
    // Prix gérés uniquement dans « Tarifs »
    is_active: Boolean(form.is_active),
  };
}

export default function ManageRoomTypes() {
  const { canCreate, canUpdate, canDelete } = useHotelPerm();
  const canAdd = canCreate('room_types');
  const canEdit = canUpdate('room_types');
  const canRemove = canDelete('room_types');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await hotelService.roomTypes();
      setItems(listOf(data));
      setErr('');
    } catch (e) {
      setErr(e.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((t) => {
      if (!showInactive && t.is_active === false) return false;
      if (!q) return true;
      const hay = `${t.name || ''} ${t.description || ''} ${t.bed_configuration || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, showInactive]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErr('');
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setErr('');
    setOk('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');
    setSaving(true);
    try {
      const body = payloadFromForm(form);
      if (!body.name) {
        setErr('Le nom du type est obligatoire.');
        return;
      }
      if (editingId) {
        await hotelService.updateRoomType(editingId, body);
        setOk(`Type « ${body.name} » mis à jour.`);
      } else {
        await hotelService.createRoomType(body);
        setOk(`Type « ${body.name} » créé.`);
      }
      resetForm();
      await load();
    } catch (ex) {
      setErr(ex.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item) => {
    setErr('');
    setOk('');
    try {
      await hotelService.updateRoomType(item.id, { is_active: !item.is_active });
      setOk(item.is_active ? `« ${item.name} » désactivé.` : `« ${item.name} » réactivé.`);
      if (editingId === item.id) {
        setForm((f) => ({ ...f, is_active: !item.is_active }));
      }
      await load();
    } catch (ex) {
      setErr(ex.message || 'Mise à jour impossible');
    }
  };

  const remove = async (item) => {
    const rooms = Number(item.rooms_count || 0);
    const msg = rooms > 0
      ? `« ${item.name} » est lié à ${rooms} chambre(s). Il sera désactivé (pas supprimé). Continuer ?`
      : `Supprimer définitivement le type « ${item.name} » ?`;
    if (!window.confirm(msg)) return;
    setErr('');
    setOk('');
    try {
      const res = await hotelService.deleteRoomType(item.id);
      if (res?.soft_deleted) {
        setOk(res.detail || `« ${item.name} » désactivé.`);
      } else {
        setOk(`« ${item.name} » supprimé.`);
      }
      if (editingId === item.id) resetForm();
      await load();
    } catch (ex) {
      setErr(ex.message || 'Suppression impossible');
    }
  };

  return (
    <HotelPage
      title="Types de chambres"
      subtitle="Photos, capacité et équipements — les prix se définissent dans Tarifs"
      actions={canAdd ? (
        <button
          type="button"
          className={btnPrimary}
          onClick={resetForm}
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau type
          </span>
        </button>
      ) : null}
    >
      <div className="grid lg:grid-cols-5 gap-4">
        {(canAdd || canEdit) && (
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-extrabold text-ink">
              {editingId ? 'Modifier le type' : 'Nouveau type'}
            </h2>
            {editingId && (
              <button type="button" className={btnIcon} onClick={resetForm} title="Annuler">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {err && <p className="text-sm text-alert font-bold mb-2">{err}</p>}
          {ok && <p className="text-sm text-emerald-700 font-bold mb-2">{ok}</p>}

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Nom *</label>
              <input
                required
                placeholder="ex. Double Standard"
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Catégorie / style</label>
              <input
                placeholder="ex. confort, luxe, suite"
                className={fieldClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <p className="text-[11px] text-ink-muted mt-1">Affiché sous les détails côté client (carousel).</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Confort, vue, superficie…"
                className={fieldClass}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1 flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5 text-accent" /> Photos (carousel client)
              </label>
              <p className="text-[11px] text-ink-muted mb-2">
                La 1ʳᵉ photo est la couverture. Max 6 images.
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(form.photos || []).map((src, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-accent">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      title="Retirer"
                      onClick={() => setForm((f) => ({
                        ...f,
                        photos: (f.photos || []).filter((_, idx) => idx !== i),
                      }))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-alert text-white text-xs font-bold leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {(form.photos || []).length < 6 && (
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-accent bg-primary/5 text-xs font-bold text-ink cursor-pointer hover:bg-primary/10">
                  <ImagePlus className="w-4 h-4 text-accent" />
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
                        const dataUrl = await readImageAsDataUrl(file, { maxSide: 1200, quality: 0.78 });
                        setForm((f) => ({
                          ...f,
                          photos: [...(f.photos || []), dataUrl].slice(0, 6),
                        }));
                        setErr('');
                      } catch (ex) {
                        setErr(ex.message || 'Image invalide');
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Adultes</label>
                <input
                  type="number"
                  min="1"
                  className={fieldClass}
                  value={form.capacity_adults}
                  onChange={(e) => setForm({ ...form, capacity_adults: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Enfants</label>
                <input
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={form.capacity_children}
                  onChange={(e) => setForm({ ...form, capacity_children: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Configuration lits</label>
              <input
                placeholder="ex. 2 lits"
                className={fieldClass}
                value={form.bed_configuration}
                onChange={(e) => setForm({ ...form, bed_configuration: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Superficie (m²)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className={fieldClass}
                value={form.surface_m2}
                onChange={(e) => setForm({ ...form, surface_m2: e.target.value })}
                placeholder="ex. 30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Équipements</label>
              <input
                placeholder="Wi-Fi, Clim, TV, Mini-bar (séparés par des virgules)"
                className={fieldClass}
                value={form.amenities_text}
                onChange={(e) => setForm({ ...form, amenities_text: e.target.value })}
              />
            </div>
            <p className="text-[11px] text-ink-muted font-medium rounded-xl border border-accent/30 bg-primary/5 px-3 py-2">
              Les prix se définissent dans le menu <strong>Tarifs</strong> (par type de chambre), pas ici.
            </p>
            <label className="flex items-center gap-2 text-sm font-bold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-accent"
              />
              Type actif (visible à la réservation)
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={btnPrimary} type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : (editingId ? 'Mettre à jour' : 'Créer')}
              </button>
              {editingId && (
                <button type="button" className={btnGhost} onClick={resetForm}>
                  Annuler
                </button>
              )}
            </div>
          </form>
        </Panel>
        )}

        <Panel className={(canAdd || canEdit) ? "lg:col-span-3" : "lg:col-span-5"}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                className={`${fieldClass} pl-9`}
                placeholder="Rechercher un type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-ink whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Afficher inactifs
            </label>
          </div>

          {loading ? (
            <Empty>Chargement…</Empty>
          ) : !filtered.length ? (
            <Empty>Aucun type de chambre</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted border-b-2 border-accent/30">
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Capacité</th>
                    <th className="py-2 pr-2">Chambres</th>
                    <th className="py-2 pr-2">Statut</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b border-accent/10 text-ink ${editingId === t.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className="py-3 pr-2">
                        <div className="flex items-start gap-2">
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-accent/40 bg-primary/5 shrink-0 flex items-center justify-center">
                            {Array.isArray(t.photos) && t.photos[0] ? (
                              <img src={t.photos[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImagePlus className="w-4 h-4 text-ink-muted" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold">{t.name}</p>
                            {t.category ? (
                              <p className="text-[11px] font-bold text-accent capitalize">{t.category}</p>
                            ) : null}
                            <p className="text-xs text-ink-muted line-clamp-1">
                              {t.bed_configuration || t.description || '—'}
                            </p>
                            {Array.isArray(t.amenities) && t.amenities.length > 0 && (
                              <p className="text-[11px] text-ink-muted mt-0.5">
                                {t.amenities.slice(0, 4).join(' · ')}
                                {t.amenities.length > 4 ? '…' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-2 font-medium whitespace-nowrap">
                        {t.capacity_adults} ad.
                        {t.capacity_children > 0 ? ` + ${t.capacity_children} enf.` : ''}
                      </td>
                      <td className="py-3 pr-2 font-medium">{t.rooms_count ?? '—'}</td>
                      <td className="py-3 pr-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                          t.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        >
                          {t.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                          <button
                            type="button"
                            className={btnIcon}
                            title="Modifier"
                            onClick={() => startEdit(t)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          )}
                          {canEdit && (
                          <button
                            type="button"
                            className={btnIcon}
                            title={t.is_active ? 'Désactiver' : 'Activer'}
                            onClick={() => toggleActive(t)}
                          >
                            <Power className={`w-4 h-4 ${t.is_active ? 'text-emerald-600' : 'text-gray-400'}`} />
                          </button>
                          )}
                          {canRemove && (
                          <button
                            type="button"
                            className={btnIconDanger}
                            title="Supprimer"
                            onClick={() => remove(t)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          )}
                          {!canEdit && !canRemove && (
                            <span className="text-[11px] text-ink-muted font-bold">Lecture seule</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </HotelPage>
  );
}
