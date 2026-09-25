import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Power, Search, X, CheckCircle } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, btnIcon, btnIconDanger, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

const OPS = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'RESERVED', label: 'Réservée' },
  { value: 'OCCUPIED', label: 'Occupée' },
  { value: 'CLEANING', label: 'Nettoyage' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'BLOCKED', label: 'Bloquée' },
  { value: 'OUT_OF_SERVICE', label: 'Hors service' },
];

const HK = [
  { value: 'READY', label: 'Prête' },
  { value: 'CLEAN', label: 'Propre' },
  { value: 'DIRTY', label: 'Sale' },
  { value: 'CLEANING_REQUIRED', label: 'Nettoyage requis' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'OCCUPIED', label: 'Occupée' },
  { value: 'OUT_OF_SERVICE', label: 'Hors service' },
];

const emptyForm = {
  number: '',
  floor: '',
  room_type: '',
  operational_status: 'AVAILABLE',
  housekeeping_status: 'READY',
  maintenance_status: '',
  amenities_text: '',
  commissioned_at: '',
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
    number: item.number || '',
    floor: item.floor || '',
    room_type: item.room_type || '',
    operational_status: item.operational_status || 'AVAILABLE',
    housekeeping_status: item.housekeeping_status || 'READY',
    maintenance_status: item.maintenance_status || '',
    amenities_text: amenitiesToText(item.amenities),
    commissioned_at: item.commissioned_at || '',
    is_active: item.is_active !== false,
  };
}

function payloadFromForm(form) {
  return {
    number: String(form.number || '').trim(),
    floor: String(form.floor || '').trim(),
    room_type: form.room_type,
    operational_status: form.operational_status,
    housekeeping_status: form.housekeeping_status,
    maintenance_status: String(form.maintenance_status || '').trim(),
    amenities: textToAmenities(form.amenities_text),
    commissioned_at: form.commissioned_at || null,
    is_active: Boolean(form.is_active),
  };
}

function labelOf(list, value) {
  return list.find((x) => x.value === value)?.label || value || '—';
}

function opsTone(status) {
  if (status === 'AVAILABLE') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
  }
  if (status === 'OCCUPIED' || status === 'RESERVED') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  if (status === 'CLEANING') {
    return 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200';
  }
  if (status === 'MAINTENANCE' || status === 'BLOCKED' || status === 'OUT_OF_SERVICE') {
    return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
}

export default function ManageRooms() {
  const { canCreate, canUpdate, canDelete } = useHotelPerm();
  const canAdd = canCreate('rooms');
  const canEdit = canUpdate('rooms');
  const canRemove = canDelete('rooms');
  const [rooms, setRooms] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOps, setFilterOps] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await hotelService.rooms();
      setRooms(listOf(r));
      try {
        const t = await hotelService.roomTypes();
        const activeTypes = listOf(t).filter((x) => x.is_active !== false);
        setTypes(activeTypes);
        setForm((prev) => (
          prev.room_type
            ? prev
            : { ...prev, room_type: activeTypes[0]?.id || '' }
        ));
      } catch {
        setTypes([]);
      }
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
    return rooms.filter((r) => {
      if (!showInactive && r.is_active === false) return false;
      if (filterType && String(r.room_type) !== String(filterType)) return false;
      if (filterOps && r.operational_status !== filterOps) return false;
      if (!q) return true;
      const hay = `${r.number || ''} ${r.floor || ''} ${r.room_type_name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rooms, search, filterType, filterOps, showInactive]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      room_type: form.room_type || types[0]?.id || '',
    });
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
      if (!body.number) {
        setErr('Le numéro de chambre est obligatoire.');
        return;
      }
      if (!body.room_type) {
        setErr('Le type de chambre est obligatoire.');
        return;
      }
      if (editingId) {
        await hotelService.updateRoom(editingId, body);
        setOk(`Chambre ${body.number} mise à jour.`);
      } else {
        await hotelService.createRoom(body);
        setOk(`Chambre ${body.number} créée.`);
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
      await hotelService.updateRoom(item.id, { is_active: !item.is_active });
      setOk(item.is_active ? `Chambre ${item.number} désactivée.` : `Chambre ${item.number} réactivée.`);
      if (editingId === item.id) setForm((f) => ({ ...f, is_active: !item.is_active }));
      await load();
    } catch (ex) {
      setErr(ex.message || 'Mise à jour impossible');
    }
  };

  const markReady = async (item) => {
    setErr('');
    setOk('');
    try {
      await hotelService.markRoomReady(item.id);
      setOk(`Chambre ${item.number} marquée Prête.`);
      await load();
    } catch (ex) {
      setErr(ex.message || 'Action impossible');
    }
  };

  const remove = async (item) => {
    const msg = `Supprimer la chambre ${item.number} ? Si elle est liée à des séjours, elle sera désactivée.`;
    if (!window.confirm(msg)) return;
    setErr('');
    setOk('');
    try {
      const res = await hotelService.deleteRoom(item.id);
      if (res?.soft_deleted) {
        setOk(res.detail || `Chambre ${item.number} désactivée.`);
      } else {
        setOk(`Chambre ${item.number} supprimée.`);
      }
      if (editingId === item.id) resetForm();
      await load();
    } catch (ex) {
      setErr(ex.message || 'Suppression impossible');
    }
  };

  return (
    <HotelPage
      title="Chambres"
      subtitle={canAdd || canEdit || canRemove
        ? 'Inventaire physique, types, statuts opérationnels et housekeeping'
        : 'Consultation des chambres (lecture seule)'}
      actions={canAdd ? (
        <button type="button" className={btnPrimary} onClick={resetForm}>
          <span className="inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle chambre
          </span>
        </button>
      ) : null}
    >
      <div className="grid lg:grid-cols-5 gap-4">
        {(canAdd || canEdit) && (
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-extrabold text-ink">
              {editingId ? 'Modifier la chambre' : 'Nouvelle chambre'}
            </h2>
            {editingId && (
              <button type="button" className={btnIcon} onClick={resetForm} title="Annuler">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {err && <p className="text-sm text-alert font-bold mb-2">{err}</p>}
          {ok && <p className="text-sm text-emerald-700 font-bold mb-2">{ok}</p>}

          {!types.length && (
            <p className="text-xs text-amber-700 font-bold mb-3">
              Créez d&apos;abord un type de chambre dans « Types de chambres ».
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">N° chambre *</label>
                <input
                  required
                  className={fieldClass}
                  placeholder="ex. 101"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Étage</label>
                <input
                  className={fieldClass}
                  placeholder="ex. 1"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Type *</label>
              <select
                required
                className={fieldClass}
                value={form.room_type}
                onChange={(e) => setForm({ ...form, room_type: e.target.value })}
              >
                <option value="">Sélectionner…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Statut opérationnel</label>
              <select
                className={fieldClass}
                value={form.operational_status}
                onChange={(e) => setForm({ ...form, operational_status: e.target.value })}
              >
                {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Housekeeping</label>
              <select
                className={fieldClass}
                value={form.housekeeping_status}
                onChange={(e) => setForm({ ...form, housekeeping_status: e.target.value })}
              >
                {HK.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Note maintenance</label>
              <input
                className={fieldClass}
                placeholder="ex. Clim en panne"
                value={form.maintenance_status}
                onChange={(e) => setForm({ ...form, maintenance_status: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Équipements chambre</label>
              <input
                className={fieldClass}
                placeholder="TV, Coffre, Balcon…"
                value={form.amenities_text}
                onChange={(e) => setForm({ ...form, amenities_text: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Mise en service</label>
              <input
                type="date"
                className={fieldClass}
                value={form.commissioned_at || ''}
                onChange={(e) => setForm({ ...form, commissioned_at: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm font-bold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Chambre active (inventaire / réservation)
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button className={btnPrimary} type="submit" disabled={saving || !types.length || (editingId ? !canEdit : !canAdd)}>
                {saving ? 'Enregistrement…' : (editingId ? 'Mettre à jour' : 'Créer')}
              </button>
              {editingId && (
                <button type="button" className={btnGhost} onClick={resetForm}>Annuler</button>
              )}
            </div>
          </form>
        </Panel>
        )}

        <Panel className={(canAdd || canEdit) ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <div className="flex flex-col gap-2 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                className={`${fieldClass} pl-9`}
                placeholder="Rechercher n°, étage, type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className={`${fieldClass} sm:max-w-[180px]`}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Tous les types</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select
                className={`${fieldClass} sm:max-w-[180px]`}
                value={filterOps}
                onChange={(e) => setFilterOps(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs font-bold text-ink whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Afficher inactives
              </label>
            </div>
          </div>

          {loading ? (
            <Empty>Chargement…</Empty>
          ) : !filtered.length ? (
            <Empty>Aucune chambre</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted border-b-2 border-accent/30">
                    <th className="py-2 pr-2">N°</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Étage</th>
                    <th className="py-2 pr-2">Ops</th>
                    <th className="py-2 pr-2">HK</th>
                    <th className="py-2 pr-2">Actif</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-accent/10 text-ink ${editingId === r.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className="py-3 pr-2 font-extrabold">{r.number}</td>
                      <td className="py-3 pr-2 font-medium">{r.room_type_name || '—'}</td>
                      <td className="py-3 pr-2">{r.floor || '—'}</td>
                      <td className="py-3 pr-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold ${opsTone(r.operational_status)}`}>
                          {labelOf(OPS, r.operational_status)}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-xs font-bold">{labelOf(HK, r.housekeeping_status)}</td>
                      <td className="py-3 pr-2">
                        <span className={`text-[11px] font-bold ${r.is_active !== false ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {r.is_active !== false ? 'Oui' : 'Non'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && r.housekeeping_status !== 'READY' && (
                            <button
                              type="button"
                              className={btnIcon}
                              title="Marquer Prête"
                              onClick={() => markReady(r)}
                            >
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                            </button>
                          )}
                          {canEdit && (
                            <button type="button" className={btnIcon} title="Modifier" onClick={() => startEdit(r)}>
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              className={btnIcon}
                              title={r.is_active !== false ? 'Désactiver' : 'Activer'}
                              onClick={() => toggleActive(r)}
                            >
                              <Power className={`w-4 h-4 ${r.is_active !== false ? 'text-emerald-600' : 'text-gray-400'}`} />
                            </button>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              className={btnIconDanger}
                              title="Supprimer"
                              onClick={() => remove(r)}
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
