import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const READY_HK = ['READY', 'CLEAN'];

function emailNote(mail) {
  if (!mail) return '';
  if (mail.sent) return ` Email client envoyé${mail.recipient ? ` (${mail.recipient})` : ''}.`;
  return ` Email non envoyé : ${mail.error || mail.message || 'pas d’adresse client'}.`;
}

function hkNote(hk) {
  if (!hk) return ' Gouvernante : notification ménage en attente.';
  if (hk.ok || hk.sent || hk.in_app > 0) {
    const n = hk.recipients_count || (hk.emails || []).length || hk.in_app || 0;
    return ` Gouvernante notifiée (CLEANING_REQUIRED Ch. ${hk.room_number || '?'}${n ? `, ${n} destinataire(s)` : ''}).`;
  }
  return ` Gouvernante non notifiée : ${hk.error || 'aucun lead ménage'}.`;
}

export default function FrontDeskArrivals() {
  const { can, canUpdate, canView } = useHotelPerm();
  const allowFrontDesk = can('hotel.stays.check_in') || can('hotel.front_desk') || canView('reservations');
  const allowCheckIn = can('hotel.stays.check_in') || canUpdate('stays');
  const allowConfirm = can('hotel.reservations.confirm');
  const allowNoShow = can('hotel.reservations.cancel') || can('hotel.stays.check_in');
  const [list, setList] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomPick, setRoomPick] = useState({});
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [walkIn, setWalkIn] = useState({
    first_name: '', last_name: '', phone: '', email: '', room_id: '',
    check_in_date: today(), check_out_date: tomorrow(),
  });
  const day = today();

  const load = async () => {
    if (!allowFrontDesk) {
      setErr('Accès réception réservé au front desk (check-in). Utilisez Caisse / Folios pour encaisser.');
      return;
    }
    const [res, rms] = await Promise.all([
      hotelService.reservations({ date: day }),
      hotelService.rooms(),
    ]);
    setList(listOf(res).filter((r) => ['CONFIRMED', 'EXPECTED', 'PENDING'].includes(r.status)));
    setRooms(listOf(rms));
  };
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [allowFrontDesk]);

  const readyRooms = (reservation) => rooms.filter((x) => (
    (x.room_type === reservation.room_type || x.id === reservation.room)
    && x.operational_status === 'AVAILABLE'
    && READY_HK.includes(x.housekeeping_status)
  ));

  const statusAllowsCheckIn = (r) => ['CONFIRMED', 'EXPECTED'].includes(r.status);

  return (
    <HotelPage title="Arrivées du jour" subtitle={`${day} — après confirmation Réservations`}>
      {(err || msg) && (
        <p className={`text-sm font-bold whitespace-pre-wrap ${err ? 'text-alert' : 'text-primary'}`}>
          {err || msg}
        </p>
      )}
      {allowCheckIn && (
      <Panel className="mb-4">
        <h2 className="font-extrabold text-ink mb-3">Walk-in (sans réservation)</h2>
        <form
          className="grid sm:grid-cols-2 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            setMsg('');
            try {
              const stay = await hotelService.walkIn(walkIn);
              setWalkIn({
                first_name: '', last_name: '', phone: '', email: '', room_id: walkIn.room_id,
                check_in_date: today(), check_out_date: tomorrow(),
              });
              setMsg(`Walk-in enregistré — séjour ouvert.${emailNote(stay?.email_notification)}`);
              load();
            } catch (ex) { setErr(ex.message); }
          }}
        >
          <input required className={fieldClass} placeholder="Prénom" value={walkIn.first_name} onChange={(e) => setWalkIn({ ...walkIn, first_name: e.target.value })} />
          <input required className={fieldClass} placeholder="Nom" value={walkIn.last_name} onChange={(e) => setWalkIn({ ...walkIn, last_name: e.target.value })} />
          <input className={fieldClass} placeholder="Téléphone" value={walkIn.phone} onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })} />
          <input type="email" className={fieldClass} placeholder="Email (notif. check-in)" value={walkIn.email} onChange={(e) => setWalkIn({ ...walkIn, email: e.target.value })} />
          <select required className={fieldClass} value={walkIn.room_id} onChange={(e) => setWalkIn({ ...walkIn, room_id: e.target.value })}>
            <option value="">Chambre disponible…</option>
            {rooms.filter((r) => r.operational_status === 'AVAILABLE' && READY_HK.includes(r.housekeeping_status)).map((r) => (
              <option key={r.id} value={r.id}>{r.number} ({r.room_type_name})</option>
            ))}
          </select>
          <input type="date" className={fieldClass} value={walkIn.check_in_date} onChange={(e) => setWalkIn({ ...walkIn, check_in_date: e.target.value })} />
          <input type="date" className={fieldClass} value={walkIn.check_out_date} onChange={(e) => setWalkIn({ ...walkIn, check_out_date: e.target.value })} />
          <button type="submit" className={`${btnPrimary} sm:col-span-2`}>Check-in walk-in</button>
        </form>
      </Panel>
      )}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-extrabold text-ink">Réservations du jour</h2>
          <Link to="/hotel/reservations" className="text-xs font-bold text-accent hover:underline">
            → Menu Réservations (confirmer)
          </Link>
        </div>
        {!list.length ? <Empty>Aucune arrivée prévue</Empty> : list.map((r) => (
          <div key={r.id} className="py-3 border-b border-accent/15 flex flex-wrap gap-2 items-end justify-between">
            <div>
              <p className="font-bold text-ink">{r.guest_name}</p>
              <p className="text-xs text-ink-muted">
                {r.reference} · {r.room_type_name} · {r.status}
                {r.payment_status ? ` · paiement ${r.payment_status}` : ''}
              </p>
              {!statusAllowsCheckIn(r) && (
                <p className="text-[11px] text-amber-700 font-bold mt-1">
                  En attente de confirmation (Réservations) avant check-in.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {!statusAllowsCheckIn(r) ? (
                allowConfirm ? (
                <button
                  type="button"
                  className={btnGhost}
                  onClick={async () => {
                    setErr('');
                    setMsg('');
                    try {
                      await hotelService.confirmReservation(r.id);
                      setMsg(`${r.reference} confirmée — check-in possible.`);
                      load();
                    } catch (ex) { setErr(ex.message); }
                  }}
                >
                  Confirmer d&apos;abord
                </button>
                ) : (
                  <span className="text-[11px] font-bold text-ink-muted">En attente confirmation</span>
                )
              ) : allowCheckIn ? (
                <>
                  <select
                    className={fieldClass}
                    value={roomPick[r.id] || r.room || ''}
                    onChange={(e) => setRoomPick({ ...roomPick, [r.id]: e.target.value })}
                  >
                    <option value="">Chambre prête…</option>
                    {readyRooms(r).map((x) => (
                      <option key={x.id} value={x.id}>{x.number} ({x.housekeeping_status})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={async () => {
                      setErr('');
                      setMsg('');
                      try {
                        const stay = await hotelService.checkIn(r.id, roomPick[r.id] || r.room);
                        setMsg(`Check-in OK — ${r.guest_name}.${emailNote(stay?.email_notification)} Suite : Caisse / Séjours.`);
                        load();
                      } catch (ex) { setErr(ex.message); }
                    }}
                  >
                    Check-in
                  </button>
                  {allowNoShow && (
                    <button
                      type="button"
                      className={`${btnGhost} text-alert`}
                      title="Client non présenté"
                      onClick={async () => {
                        setErr('');
                        setMsg('');
                        const motif = window.prompt('Motif no-show :', 'Client non présenté');
                        if (motif === null) return;
                        if (String(motif).trim().length < 3) {
                          setErr('Motif no-show trop court.');
                          return;
                        }
                        try {
                          await hotelService.markNoShow(r.id, { note: String(motif).trim() });
                          setMsg(`No-show — ${r.guest_name}. Chambre libérée.`);
                          load();
                        } catch (ex) { setErr(ex.message); }
                      }}
                    >
                      No-show
                    </button>
                  )}
                </>
              ) : (
                <span className="text-[11px] font-bold text-ink-muted">Lecture seule</span>
              )}
            </div>
          </div>
        ))}
      </Panel>
    </HotelPage>
  );
}

export function FrontDeskDepartures() {
  const { can, canUpdate } = useHotelPerm();
  const allowCheckOut = can('hotel.stays.check_out') || canUpdate('stays');
  const allowForceOut = can('hotel.manage') || can('hotel.stays.check_out');
  const [stays, setStays] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const day = today();

  const load = () => hotelService.stays({ status: 'IN_HOUSE' }).then((d) => {
    setStays(listOf(d));
  });
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  return (
    <HotelPage title="Départs" subtitle={`${day} — solde à jour via Caisse avant check-out`}>
      {(err || msg) && <p className={`text-sm font-bold whitespace-pre-wrap ${err ? 'text-alert' : 'text-primary'}`}>{err || msg}</p>}
      <p className="text-xs text-ink-muted font-medium mb-2">
        Check-out normal : le solde du folio doit être à 0 (régler à la Caisse d&apos;abord).
        « Malgré solde » = départ autorisé par un manager même s&apos;il reste un impayé.
        Email client (Paramètres) + notification Gouvernante (CLEANING_REQUIRED) + tâche Housekeeping.
        {' '}
        <Link to="/hotel/housekeeping" className="text-accent font-bold hover:underline">Voir le ménage</Link>
        {' · '}
        <Link to="/hotel/folios" className="text-accent font-bold hover:underline">Caisse / folios</Link>
      </p>
      <Panel>
        {!stays.length ? <Empty>Aucun séjour en cours</Empty> : stays.map((s) => (
          <div key={s.id} className="py-3 border-b border-accent/10 flex flex-wrap justify-between gap-2 items-center">
            <div>
              <p className="font-bold text-ink">{s.guest_name} · Ch. {s.room_number}</p>
              <p className="text-xs text-ink-muted">
                Solde {s.folio ? Number(s.folio.balance).toLocaleString() : 0} BIF
                {s.reservation_ref ? ` · ${s.reservation_ref}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {allowCheckOut ? (
                <>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={async () => {
                      setErr('');
                      setMsg('');
                      try {
                        const inv = await hotelService.checkOut(s.id, false);
                        setMsg(
                          `Check-out OK — ${inv.number}.${emailNote(inv?.email_notification)}${hkNote(inv?.housekeeping_notification)}`,
                        );
                        load();
                      } catch (ex) { setErr(ex.message); }
                    }}
                  >
                    Check-out
                  </button>
                  {allowForceOut && (
                    <button
                      type="button"
                      className={btnGhost}
                      title="Autorise le départ même si le folio a encore un solde impayé (manager uniquement). Le client part, le solde reste à recouvrer."
                      onClick={async () => {
                        setErr('');
                        setMsg('');
                        try {
                          const inv = await hotelService.checkOut(s.id, true);
                          setMsg(
                            `Check-out malgré solde — ${inv.number}.${emailNote(inv?.email_notification)}${hkNote(inv?.housekeeping_notification)}`,
                          );
                          load();
                        } catch (ex) { setErr(ex.message); }
                      }}
                    >
                      Malgré solde (manager)
                    </button>
                  )}
                </>
              ) : (
                <span className="text-[11px] font-bold text-ink-muted">Lecture seule</span>
              )}
            </div>
          </div>
        ))}
      </Panel>
    </HotelPage>
  );
}
