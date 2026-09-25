import React, { useEffect, useState } from 'react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

export default function ManageMaintenance() {
  const { canCreate, canUpdate, can } = useHotelPerm();
  const canAdd = canCreate('maintenance');
  const canEdit = canUpdate('maintenance');
  const canResolve = can('hotel.maintenance.resolve') || canEdit;
  const [tickets, setTickets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ room: '', description: '', priority: 'NORMAL', blocks_room: true });
  const [err, setErr] = useState('');

  const load = async () => {
    const [t, r] = await Promise.all([hotelService.maintenance(), hotelService.rooms()]);
    setTickets(listOf(t));
    setRooms(listOf(r));
  };
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!canAdd) {
      setErr('Droit insuffisant pour ouvrir un ticket.');
      return;
    }
    try {
      await hotelService.createTicket({ ...form, room: form.room || null });
      setForm({ room: '', description: '', priority: 'NORMAL', blocks_room: true });
      load();
    } catch (ex) { setErr(ex.message); }
  };

  return (
    <HotelPage
      title="Maintenance"
      subtitle={canAdd || canResolve
        ? 'Tickets et chambres bloquées'
        : 'Consultation des tickets (lecture seule)'}
    >
      <div className="grid lg:grid-cols-2 gap-4">
        {canAdd && (
          <Panel>
            {err && <p className="text-alert text-sm font-bold mb-2">{err}</p>}
            <form onSubmit={submit} className="space-y-3">
              <select className={fieldClass} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
                <option value="">Chambre (optionnel)…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
              </select>
              <textarea required className={fieldClass} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <select className={fieldClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="LOW">Basse</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input type="checkbox" checked={form.blocks_room} onChange={(e) => setForm({ ...form, blocks_room: e.target.checked })} />
                Bloquer la chambre (hors dispo)
              </label>
              <button className={btnPrimary} type="submit">Ouvrir ticket</button>
            </form>
          </Panel>
        )}
        <Panel className={!canAdd ? 'lg:col-span-2' : undefined}>
          {!canAdd && err && <p className="text-alert text-sm font-bold mb-2">{err}</p>}
          {!tickets.length ? <Empty>Aucun ticket</Empty> : tickets.map((t) => (
            <div key={t.id} className="py-3 border-b border-accent/15 flex justify-between gap-2">
              <div>
                <p className="font-bold text-ink">{t.room_number || 'Général'} · {t.priority}</p>
                <p className="text-sm text-ink-muted">{t.description}</p>
                <p className="text-xs font-bold mt-1">{t.status}</p>
              </div>
              {canResolve && !['RESOLVED', 'CLOSED'].includes(t.status) && (
                <button type="button" className={btnGhost} onClick={() => hotelService.resolveTicket(t.id).then(load)}>Résoudre</button>
              )}
              {!canResolve && !canAdd && (
                <span className="text-[11px] font-bold text-ink-muted shrink-0">Lecture seule</span>
              )}
            </div>
          ))}
        </Panel>
      </div>
    </HotelPage>
  );
}
