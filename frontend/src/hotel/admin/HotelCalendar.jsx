import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import hotelService from '../hotelService';
import { HotelPage, Panel, Empty, btnGhost, btnPrimary } from '../ui';

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const STATUS_TONE = {
  PENDING: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800',
  CONFIRMED: 'bg-primary/15 text-primary border-primary/40 dark:bg-primary/25 dark:text-primary-200',
  EXPECTED: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800',
  CHECKED_IN: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-800',
  CHECKED_OUT: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

export default function HotelCalendar() {
  const [anchor, setAnchor] = useState(() => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    return t;
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const from = useMemo(() => iso(anchor), [anchor]);
  const to = useMemo(() => iso(addDays(anchor, 13)), [anchor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    hotelService.calendar({ from, to })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Erreur calendrier'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const days = data?.days || [];
  const rooms = data?.rooms || [];
  const eventsByRoom = useMemo(() => {
    const map = {};
    (data?.events || []).forEach((ev) => {
      const key = ev.room_id || '_unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [data]);

  const spansDay = (ev, day) => day >= ev.start && day < ev.end;

  return (
    <HotelPage
      title="Calendrier d’occupation"
      subtitle={`${from} → ${to}`}
      actions={(
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => setAnchor((d) => addDays(d, -7))}>
            <ChevronLeft className="w-4 h-4 inline" /> Semaine
          </button>
          <button type="button" className={btnPrimary} onClick={() => setAnchor(new Date())}>
            Aujourd’hui
          </button>
          <button type="button" className={btnGhost} onClick={() => setAnchor((d) => addDays(d, 7))}>
            Semaine <ChevronRight className="w-4 h-4 inline" />
          </button>
        </div>
      )}
    >
      {error && <div className="p-3 rounded-xl bg-alert/10 text-alert text-sm border border-alert/30">{error}</div>}
      <Panel className="overflow-x-auto">
        {loading ? <Empty>Chargement…</Empty> : !rooms.length ? (
          <Empty>Aucune chambre active</Empty>
        ) : (
          <table className="min-w-[900px] w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface text-left p-2 border-b border-accent/30 w-28">Chambre</th>
                {days.map((day) => (
                  <th key={day} className="p-2 border-b border-accent/20 font-bold text-ink-muted min-w-[64px]">
                    {day.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b border-accent/10">
                  <td className="sticky left-0 z-10 bg-surface p-2 font-bold text-ink">
                    {room.number}
                    <span className="block text-[10px] font-medium text-ink-muted">{room.room_type}</span>
                  </td>
                  {days.map((day) => {
                    const hits = (eventsByRoom[room.id] || []).filter((ev) => spansDay(ev, day));
                    const ev = hits[0];
                    return (
                      <td key={`${room.id}-${day}`} className="p-1 align-top">
                        {ev ? (
                          <div
                            className={`rounded-md border px-1 py-1 font-semibold leading-tight ${STATUS_TONE[ev.status] || 'bg-primary/10 text-primary border-primary/30'}`}
                            title={`${ev.guest_name || '—'} · ${ev.reference} · ${ev.status}`}
                          >
                            <span className="block truncate max-w-[72px]">{ev.guest_name || ev.reference || '—'}</span>
                          </div>
                        ) : (
                          <div className="h-8 rounded-md bg-primary/5" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {(eventsByRoom._unassigned || []).length > 0 && (
                <tr className="border-b border-accent/10">
                  <td className="sticky left-0 z-10 bg-surface p-2 font-bold text-alert">Sans chambre</td>
                  {days.map((day) => {
                    const hits = eventsByRoom._unassigned.filter((ev) => spansDay(ev, day));
                    return (
                      <td key={`u-${day}`} className="p-1 align-top">
                        {hits.map((ev) => (
                          <div
                            key={ev.id}
                            className={`mb-0.5 rounded-md border px-1 py-0.5 font-semibold ${STATUS_TONE[ev.status] || ''}`}
                            title={ev.guest_name}
                          >
                            <span className="block truncate max-w-[72px]">{ev.guest_name || ev.reference}</span>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Panel>
    </HotelPage>
  );
}
