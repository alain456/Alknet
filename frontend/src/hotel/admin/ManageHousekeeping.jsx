import React, { useEffect, useMemo, useState } from 'react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

export default function ManageHousekeeping() {
  const { can, canUpdate } = useHotelPerm();
  const isLead = can('hotel.housekeeping.assign') || can('hotel.housekeeping.lead') || can('hotel.manage');
  const canWork = canUpdate('housekeeping') || isLead;
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [assignPick, setAssignPick] = useState({});
  const [issueText, setIssueText] = useState({});
  const [err, setErr] = useState('');

  const load = async () => {
    const params = isLead ? {} : { mine: '1' };
    const t = await hotelService.housekeeping(params);
    setTasks(listOf(t));
    if (isLead || can('hotel.rooms.view')) {
      try {
        setRooms(listOf(await hotelService.rooms()));
      } catch {
        setRooms([]);
      }
    }
    if (isLead) {
      try {
        setStaff(listOf(await hotelService.staffDirectory()));
      } catch {
        setStaff([]);
      }
    }
  };
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [isLead]);

  // Poll léger pour la gouvernante : nouvelles tâches post check-out
  useEffect(() => {
    if (!isLead) return undefined;
    const id = setInterval(() => {
      load().catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, [isLead]);

  const pendingAssign = useMemo(
    () => tasks.filter((t) => t.status === 'PENDING' && !t.assigned_to),
    [tasks],
  );
  const cleaningRooms = useMemo(
    () => rooms.filter((r) => r.housekeeping_status === 'CLEANING_REQUIRED'),
    [rooms],
  );

  return (
    <HotelPage
      title={isLead ? 'Housekeeping — Gouvernante' : 'Housekeeping'}
      subtitle={
        isLead
          ? 'Assigner, inspecter, déclarer prêtes'
          : (canWork ? 'Tâches ménage' : 'Consultation (lecture seule)')
      }
    >
      {err && <p className="text-alert font-bold text-sm">{err}</p>}
      {isLead && (pendingAssign.length > 0 || cleaningRooms.length > 0) && (
        <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-extrabold">
            CLEANING_REQUIRED — {pendingAssign.length || cleaningRooms.length} chambre(s) à traiter après check-out
          </p>
          <p className="mt-1 text-amber-900/90">
            Étapes : assigner un agent → suivre le nettoyage → inspecter → marquer Prête.
            {cleaningRooms.length > 0 && (
              <> Chambres : {cleaningRooms.map((r) => r.number).join(', ')}.</>
            )}
          </p>
        </div>
      )}
      {isLead && (
        <Panel className="mb-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!roomId) return;
              await hotelService.createHkTask({ room: roomId, task_type: 'CLEANING', priority: 'NORMAL' });
              setRoomId('');
              load();
            }}
          >
            <select className={fieldClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Chambre à nettoyer…</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.number} — {r.housekeeping_status}</option>)}
            </select>
            <button type="submit" className={btnPrimary}>Créer tâche</button>
          </form>
        </Panel>
      )}
      <Panel>
        {!tasks.length ? <Empty>Aucune tâche</Empty> : tasks.map((t) => (
          <div
            key={t.id}
            className={`py-3 border-b border-accent/15 space-y-2 ${
              t.status === 'PENDING' && !t.assigned_to ? 'bg-amber-50/60 -mx-2 px-2 rounded-lg' : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-ink">
                  Ch. {t.room_number} · {t.task_type}
                  {t.status === 'PENDING' && !t.assigned_to ? (
                    <span className="ml-2 text-[11px] font-extrabold uppercase text-amber-700">À assigner</span>
                  ) : null}
                </p>
                <p className="text-xs text-ink-muted">
                  {t.status} · {t.priority}
                  {t.assigned_to_email ? ` · ${t.assigned_to_email}` : ''}
                  {t.comment ? ` · ${t.comment}` : ''}
                </p>
              </div>
              {canWork && (
                <div className="flex flex-wrap gap-2">
                  {t.status !== 'IN_PROGRESS' && t.status !== 'DONE' && (
                    <button type="button" className={btnGhost} onClick={() => hotelService.startHk(t.id).then(load)}>Démarrer</button>
                  )}
                  {t.status !== 'DONE' && (
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => hotelService.completeHk(t.id, { mark_ready: isLead }).then(load)}
                    >
                      {isLead ? 'Terminer → Prête' : 'Terminer → Inspection'}
                    </button>
                  )}
                  {isLead && t.status === 'DONE' && String(rooms.find((r) => String(r.id) === String(t.room))?.housekeeping_status || '') === 'INSPECTION' && (
                    <button type="button" className={btnPrimary} onClick={() => hotelService.markRoomReady(t.room).then(load)}>Valider Prête</button>
                  )}
                </div>
              )}
            </div>
            {isLead && t.status !== 'DONE' && (
              <div className="flex flex-wrap gap-2">
                <select className={fieldClass} value={assignPick[t.id] || ''} onChange={(e) => setAssignPick({ ...assignPick, [t.id]: e.target.value })}>
                  <option value="">Assigner un agent…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => assignPick[t.id] && hotelService.assignHk(t.id, assignPick[t.id]).then(load)}
                >
                  Assigner
                </button>
              </div>
            )}
            {canWork && !isLead && (
              <div className="flex flex-wrap gap-2">
                <input
                  className={fieldClass}
                  placeholder="Signaler une anomalie…"
                  value={issueText[t.id] || ''}
                  onChange={(e) => setIssueText({ ...issueText, [t.id]: e.target.value })}
                />
                <button
                  type="button"
                  className={btnGhost}
                  onClick={async () => {
                    if (!issueText[t.id]) return;
                    await hotelService.reportHkIssue(t.id, { description: issueText[t.id], blocks_room: false });
                    setIssueText({ ...issueText, [t.id]: '' });
                    setErr('');
                    alert('Anomalie signalée à la maintenance.');
                  }}
                >
                  Signaler
                </button>
              </div>
            )}
          </div>
        ))}
      </Panel>
    </HotelPage>
  );
}
