import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, btnIcon, btnIconDanger, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

export default function ManageGuests() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  useEffect(() => {
    hotelService.guests(q).then((d) => setItems(listOf(d))).catch(() => {});
  }, [q]);

  return (
    <HotelPage title="Clients" subtitle="Fiches voyageurs de l'hôtel">
      <Panel>
        <input className={`${fieldClass} mb-4`} placeholder="Rechercher nom, téléphone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        {!items.length ? <Empty>Aucun client</Empty> : (
          <ul className="divide-y divide-accent/20">
            {items.map((g) => (
              <li key={g.id} className="py-3">
                <p className="font-bold text-ink">{g.first_name} {g.last_name}</p>
                <p className="text-xs text-ink-muted">{g.phone || '—'} · {g.email || '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </HotelPage>
  );
}

const emptyServiceForm = { name: '', unit_price: '', unit: 'unité' };

export function ManageHotelServices() {
  const { canCreate, canUpdate, canDelete } = useHotelPerm();
  const canAdd = canCreate('services');
  const canEdit = canUpdate('services');
  const canRemove = canDelete('services');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyServiceForm);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = () => hotelService.services().then((d) => setItems(listOf(d)));
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyServiceForm);
  };

  const startEdit = (s) => {
    if (!canEdit) return;
    setEditingId(s.id);
    setForm({
      name: s.name || '',
      unit_price: s.unit_price ?? '',
      unit: s.unit || 'unité',
    });
    setErr('');
    setOk('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (editingId ? !canEdit : !canAdd) {
      setErr('Droit insuffisant pour cette action.');
      return;
    }
    try {
      const payload = {
        name: String(form.name || '').trim(),
        unit_price: form.unit_price || 0,
        unit: form.unit || 'unité',
      };
      if (editingId) {
        await hotelService.updateService(editingId, payload);
        setOk('Service mis à jour.');
      } else {
        await hotelService.createService(payload);
        setOk('Service créé.');
      }
      resetForm();
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const remove = async (s) => {
    if (!canRemove) return;
    if (!window.confirm(`Supprimer le service « ${s.name} » ?`)) return;
    try {
      await hotelService.deleteService(s.id);
      setOk('Service supprimé.');
      if (editingId === s.id) resetForm();
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <HotelPage
      title="Services"
      subtitle={canAdd || canEdit || canRemove
        ? 'Petit-déj, blanchisserie, parking…'
        : 'Consultation des services (lecture seule)'}
    >
      <div className="grid lg:grid-cols-2 gap-4">
        {(canAdd || canEdit) && (
          <Panel>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-extrabold text-ink">
                {editingId ? 'Modifier le service' : 'Nouveau service'}
              </h2>
              {editingId && (
                <button type="button" className={btnIcon} onClick={resetForm} title="Annuler">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {err && <p className="text-alert text-sm font-bold mb-2">{err}</p>}
            {ok && <p className="text-emerald-700 text-sm font-bold mb-2">{ok}</p>}
            <form onSubmit={submit} className="space-y-3">
              <input
                required
                className={fieldClass}
                placeholder="Nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                required
                type="number"
                min="0"
                className={fieldClass}
                placeholder="Prix"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
              <input
                className={fieldClass}
                placeholder="Unité"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className={btnPrimary}
                  type="submit"
                  disabled={editingId ? !canEdit : !canAdd}
                >
                  {editingId ? 'Enregistrer' : 'Créer'}
                </button>
                {editingId && (
                  <button type="button" className={btnGhost} onClick={resetForm}>Annuler</button>
                )}
              </div>
            </form>
          </Panel>
        )}
        <Panel className={!(canAdd || canEdit) ? 'lg:col-span-2' : undefined}>
          {!(canAdd || canEdit) && err && <p className="text-alert text-sm font-bold mb-2">{err}</p>}
          {!(canAdd || canEdit) && ok && <p className="text-emerald-700 text-sm font-bold mb-2">{ok}</p>}
          {!items.length ? (
            <Empty>Aucun service</Empty>
          ) : items.map((s) => (
            <div key={s.id} className="flex justify-between items-center gap-2 py-2 border-b border-accent/10 text-ink font-medium">
              <span>{s.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span>{Number(s.unit_price).toLocaleString()} BIF</span>
                {canEdit && (
                  <button type="button" className={btnIcon} title="Modifier" onClick={() => startEdit(s)}>
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {canRemove && (
                  <button type="button" className={btnIconDanger} title="Supprimer" onClick={() => remove(s)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {!canEdit && !canRemove && (
                  <span className="text-[11px] font-bold text-ink-muted">Lecture seule</span>
                )}
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </HotelPage>
  );
}
