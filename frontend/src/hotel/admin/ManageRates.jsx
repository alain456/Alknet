import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Power, Search, X } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, btnIcon, btnIconDanger, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

const RATE_KINDS = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'WEEKEND', label: 'Week-end' },
  { value: 'HIGH_SEASON', label: 'Haute saison' },
  { value: 'LOW_SEASON', label: 'Basse saison' },
  { value: 'LONG_STAY', label: 'Longue durée' },
  { value: 'GROUP', label: 'Groupe' },
  { value: 'CORPORATE', label: 'Entreprise' },
  { value: 'BREAKFAST', label: 'Petit-déjeuner inclus' },
];

const emptyForm = {
  name: 'Standard',
  room_type: '',
  rate_kind: 'STANDARD',
  price_per_night: '',
  currency: 'BIF',
  min_nights: 1,
  valid_from: '',
  valid_to: '',
  includes_breakfast: false,
  taxes_included: false,
  cancellation_policy: '',
  is_active: true,
};

function formFromItem(item) {
  return {
    name: item.name || 'Standard',
    room_type: item.room_type || '',
    rate_kind: item.rate_kind || 'STANDARD',
    price_per_night: item.price_per_night ?? '',
    currency: item.currency || 'BIF',
    min_nights: item.min_nights ?? 1,
    valid_from: item.valid_from || '',
    valid_to: item.valid_to || '',
    includes_breakfast: Boolean(item.includes_breakfast),
    taxes_included: Boolean(item.taxes_included),
    cancellation_policy: item.cancellation_policy || '',
    is_active: item.is_active !== false,
  };
}

function payloadFromForm(form) {
  return {
    name: String(form.name || '').trim() || 'Standard',
    room_type: form.room_type,
    rate_kind: form.rate_kind || 'STANDARD',
    price_per_night: Number(form.price_per_night) || 0,
    currency: form.currency || 'BIF',
    min_nights: Number(form.min_nights) || 1,
    valid_from: form.valid_from || null,
    valid_to: form.valid_to || null,
    includes_breakfast: Boolean(form.includes_breakfast),
    taxes_included: Boolean(form.taxes_included),
    cancellation_policy: String(form.cancellation_policy || '').trim(),
    is_active: Boolean(form.is_active),
  };
}

function kindLabel(k) {
  return RATE_KINDS.find((x) => x.value === k)?.label || k || 'Standard';
}

export default function ManageRates() {
  const { canCreate, canUpdate, canDelete } = useHotelPerm();
  const canAdd = canCreate('rates');
  const canEdit = canUpdate('rates');
  const canRemove = canDelete('rates');
  const [rates, setRates] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, t] = await Promise.all([hotelService.rates(), hotelService.roomTypes()]);
      const activeTypes = listOf(t).filter((x) => x.is_active !== false);
      setRates(listOf(r));
      setTypes(activeTypes);
      setForm((prev) => (prev.room_type ? prev : { ...prev, room_type: activeTypes[0]?.id || '' }));
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
    return rates.filter((r) => {
      if (!showInactive && r.is_active === false) return false;
      if (filterType && String(r.room_type) !== String(filterType)) return false;
      if (!q) return true;
      const hay = `${r.name || ''} ${r.room_type_name || ''} ${r.rate_kind || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rates, search, filterType, showInactive]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      room_type: types[0]?.id || '',
    });
    setErr('');
  };

  const startEdit = (item) => {
    if (!canEdit) return;
    setEditingId(item.id);
    setForm(formFromItem(item));
    setErr('');
    setOk('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');
    if (editingId ? !canEdit : !canAdd) {
      setErr('Droit insuffisant pour cette action.');
      return;
    }
    if (!form.room_type) {
      setErr('Sélectionnez un type de chambre.');
      return;
    }
    if (Number(form.price_per_night) < 0) {
      setErr('Prix invalide.');
      return;
    }
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (editingId) {
        await hotelService.updateRate(editingId, payload);
        setOk('Tarif mis à jour.');
      } else {
        await hotelService.createRate(payload);
        setOk('Tarif créé.');
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
    if (!canEdit) return;
    setErr('');
    setOk('');
    try {
      await hotelService.updateRate(item.id, { is_active: item.is_active === false });
      setOk(item.is_active === false ? 'Tarif réactivé.' : 'Tarif désactivé.');
      if (editingId === item.id) resetForm();
      await load();
    } catch (ex) {
      setErr(ex.message || 'Action impossible');
    }
  };

  const remove = async (item) => {
    if (!canRemove) return;
    if (!window.confirm(`Supprimer le tarif « ${item.name} » (${item.room_type_name}) ?`)) return;
    setErr('');
    setOk('');
    try {
      await hotelService.deleteRate(item.id);
      setOk('Tarif supprimé.');
      if (editingId === item.id) resetForm();
      await load();
    } catch (ex) {
      // Soft-disable if linked
      try {
        if (!canEdit) throw ex;
        await hotelService.updateRate(item.id, { is_active: false });
        setOk('Tarif lié à des réservations — désactivé à la place.');
        if (editingId === item.id) resetForm();
        await load();
      } catch (ex2) {
        setErr(ex.message || ex2.message || 'Suppression impossible');
      }
    }
  };

  return (
    <HotelPage
      title="Tarifs"
      subtitle={canAdd || canEdit || canRemove
        ? 'Prix par type de chambre (saison, week-end, groupes…)'
        : 'Consultation des tarifs (lecture seule)'}
      actions={canAdd ? (
        <button type="button" className={btnPrimary} onClick={resetForm}>
          <span className="inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau tarif
          </span>
        </button>
      ) : null}
    >
      <div className="grid lg:grid-cols-5 gap-4">
        {(canAdd || canEdit) && (
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-extrabold text-ink">
              {editingId ? 'Modifier le tarif' : 'Nouveau tarif'}
            </h2>
            {editingId && (
              <button type="button" className={btnIcon} onClick={resetForm} title="Annuler">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {err && <p className="text-sm text-alert font-bold mb-2 whitespace-pre-wrap">{err}</p>}
          {ok && <p className="text-sm text-emerald-700 font-bold mb-2">{ok}</p>}

          {!types.length && (
            <p className="text-xs text-amber-700 font-bold mb-3">
              Créez d&apos;abord un type de chambre, puis définissez ses tarifs ici.
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Nom *</label>
              <input
                required
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex. Standard, Week-end…"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Type de chambre *</label>
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
              <label className="block text-xs font-bold text-ink-muted mb-1">Catégorie</label>
              <select
                className={fieldClass}
                value={form.rate_kind}
                onChange={(e) => setForm({ ...form, rate_kind: e.target.value })}
              >
                {RATE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Prix / nuit *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  className={fieldClass}
                  value={form.price_per_night}
                  onChange={(e) => setForm({ ...form, price_per_night: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Devise</label>
                <select
                  className={fieldClass}
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="BIF">BIF</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Nuits minimum</label>
              <input
                type="number"
                min="1"
                className={fieldClass}
                value={form.min_nights}
                onChange={(e) => setForm({ ...form, min_nights: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Valide du</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-muted mb-1">Valide au</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={form.valid_to}
                  onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={form.includes_breakfast}
                onChange={(e) => setForm({ ...form, includes_breakfast: e.target.checked })}
              />
              Petit-déjeuner inclus
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={form.taxes_included}
                onChange={(e) => setForm({ ...form, taxes_included: e.target.checked })}
              />
              Taxes incluses
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Tarif actif
            </label>
            <div>
              <label className="block text-xs font-bold text-ink-muted mb-1">Politique d&apos;annulation</label>
              <textarea
                className={fieldClass}
                rows={2}
                value={form.cancellation_policy}
                onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })}
                placeholder="Optionnel"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || !types.length || (editingId ? !canEdit : !canAdd)}
                className={btnPrimary}
              >
                {saving ? 'Enregistrement…' : (editingId ? 'Enregistrer' : 'Créer le tarif')}
              </button>
              {editingId && (
                <button type="button" className={btnGhost} onClick={resetForm}>Annuler</button>
              )}
            </div>
          </form>
        </Panel>
        )}

        <Panel className={(canAdd || canEdit) ? 'lg:col-span-3' : 'lg:col-span-5'}>
          {!(canAdd || canEdit) && err && (
            <p className="text-sm text-alert font-bold mb-2 whitespace-pre-wrap">{err}</p>
          )}
          {!(canAdd || canEdit) && ok && (
            <p className="text-sm text-emerald-700 font-bold mb-2">{ok}</p>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[10rem]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                className={`${fieldClass} pl-9`}
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className={fieldClass}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Tous les types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-bold text-ink px-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Inactifs
            </label>
          </div>

          {loading ? (
            <p className="text-sm text-ink-muted font-medium py-6 text-center">Chargement…</p>
          ) : !filtered.length ? (
            <Empty>Aucun tarif{canAdd ? '. Créez-en un pour chaque type de chambre.' : '.'}</Empty>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className={`flex flex-wrap items-start justify-between gap-3 py-3 px-3 rounded-xl border-2 ${
                    r.is_active === false ? 'border-accent/20 opacity-60' : 'border-accent/30'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink">
                      {r.name}
                      {r.is_active === false ? ' (inactif)' : ''}
                    </p>
                    <p className="text-xs text-ink-muted font-medium mt-0.5">
                      {r.room_type_name} · {kindLabel(r.rate_kind)}
                    </p>
                    <p className="text-sm font-bold text-primary mt-1">
                      {Number(r.price_per_night).toLocaleString()} {r.currency}/nuit
                      {r.min_nights > 1 ? ` · min. ${r.min_nights} nuits` : ''}
                      {r.includes_breakfast ? ' · PDJ' : ''}
                      {r.taxes_included ? ' · taxes incl.' : ''}
                    </p>
                    {(r.valid_from || r.valid_to) && (
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Validité : {r.valid_from || '…'} → {r.valid_to || '…'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <button type="button" className={btnIcon} title="Modifier" onClick={() => startEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        className={btnIcon}
                        title={r.is_active === false ? 'Réactiver' : 'Désactiver'}
                        onClick={() => toggleActive(r)}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    )}
                    {canRemove && (
                      <button type="button" className={btnIconDanger} title="Supprimer" onClick={() => remove(r)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {!canEdit && !canRemove && (
                      <span className="text-[11px] font-bold text-ink-muted px-2">Lecture seule</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </HotelPage>
  );
}
