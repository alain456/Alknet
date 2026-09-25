import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, RefreshCw } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { promptRequiredMotif } from '../promptMotif';
import { HotelPage, Panel, Empty, btnPrimary, btnGhost } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

function moveKind(r) {
  const cur = r.check_in_date;
  const pref = r.reschedule_preferred_check_in;
  if (!cur || !pref) return 'modification';
  if (pref < cur) return 'anticiper';
  if (pref > cur) return 'reporter';
  return 'modification';
}

export default function HotelClientReschedules() {
  const { can, canView, canUpdate } = useHotelPerm();
  const canSee = canView('reservations');
  const canDecide = can('hotel.reservations.confirm');
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setErr('');
    return hotelService.reservations({ reschedule: 'pending' })
      .then((d) => {
        setList(listOf(d));
        setErr('');
      })
      .catch((e) => setErr(e.message || 'Impossible de charger les demandes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canSee) return undefined;
    load();
    const id = setInterval(() => { load().catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, [canSee]);

  const respond = async (r, decision) => {
    const accept = decision === 'accept';
    let note = '';
    if (accept) {
      const raw = window.prompt('Note pour le client (optionnel) :', '');
      if (raw === null) return;
      note = raw;
    } else {
      note = promptRequiredMotif('Motif du refus (visible par le client) :');
      if (!note) return;
    }
    setBusyId(r.id);
    setErr('');
    try {
      const payload = accept
        ? {
          decision: 'accept',
          note,
          check_in_date: r.reschedule_preferred_check_in,
          check_out_date: r.reschedule_preferred_check_out,
        }
        : { decision: 'refuse', note };
      const res = await hotelService.respondReschedule(r.id, payload);
      const mail = res?.email_notification;
      setOk(
        `${r.reference} : ${accept ? 'nouvelles dates acceptées' : 'modification refusée'}.`
        + (mail?.sent ? ' Email envoyé au client.' : ''),
      );
      await load();
    } catch (ex) {
      setErr(ex.message || 'Action impossible');
    } finally {
      setBusyId(null);
    }
  };

  if (!canSee) {
    return (
      <HotelPage title="Anticiper / reporter">
        <Panel className="border-alert">
          <p className="text-sm text-alert font-bold">
            Droits insuffisants. Ajoutez « Voir réservations ».
          </p>
        </Panel>
      </HotelPage>
    );
  }

  return (
    <HotelPage
      title="Anticiper / reporter"
      subtitle="Demandes client pour avancer ou reporter les dates du séjour"
      actions={(
        <button
          type="button"
          className={`${btnGhost} text-sm inline-flex items-center gap-1.5`}
          onClick={() => load().catch((e) => setErr(e.message))}
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      )}
    >
      {err && (
        <Panel className="border-alert mb-4">
          <p className="text-sm text-alert font-bold whitespace-pre-wrap">{err}</p>
        </Panel>
      )}
      {ok && (
        <Panel className="mb-4">
          <p className="text-sm text-emerald-700 font-bold whitespace-pre-wrap">{ok}</p>
        </Panel>
      )}

      {loading && !list.length ? (
        <Empty>Chargement…</Empty>
      ) : !list.length ? (
        <Empty>
          Aucune demande d’anticipation / report en attente.
        </Empty>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const kind = moveKind(r);
            return (
              <Panel key={r.id} className="!p-4 border-2 border-amber-200 bg-amber-50/40">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                  <div className="min-w-0 space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-800 shrink-0" />
                      <p className="font-extrabold text-ink">
                        {r.reference || 'Réservation'}
                        {r.guest_name ? ` · ${r.guest_name}` : ''}
                      </p>
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-2 py-0.5 capitalize">
                        Demande client — {kind}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {[r.room_type_name, r.guest_phone].filter(Boolean).join(' · ')}
                    </p>
                    <div className="rounded-xl bg-white border border-amber-200 px-3 py-2.5 text-sm space-y-1">
                      <p>
                        <span className="font-bold text-ink-muted text-[10px] uppercase tracking-wide">Dates actuelles</span>
                        <br />
                        <span className="font-bold text-ink">{r.check_in_date} → {r.check_out_date}</span>
                      </p>
                      <p>
                        <span className="font-bold text-ink-muted text-[10px] uppercase tracking-wide">Dates souhaitées</span>
                        <br />
                        <span className="font-extrabold text-amber-950">
                          {r.reschedule_preferred_check_in} → {r.reschedule_preferred_check_out}
                        </span>
                      </p>
                      {r.reschedule_reason ? (
                        <p className="text-xs whitespace-pre-wrap pt-1 border-t border-amber-100">
                          <span className="font-bold">Motif : </span>
                          {r.reschedule_reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap lg:flex-col gap-2 shrink-0 lg:min-w-[11rem]">
                    {canDecide && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          className={`${btnPrimary} text-xs inline-flex items-center justify-center gap-1.5`}
                          onClick={() => respond(r, 'accept')}
                        >
                          Accepter les dates
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          className={`${btnGhost} text-xs inline-flex items-center justify-center`}
                          onClick={() => respond(r, 'refuse')}
                        >
                          Refuser
                        </button>
                      </>
                    )}
                    <Link
                      to="/hotel/reservations"
                      className={`${btnGhost} text-xs inline-flex items-center justify-center`}
                    >
                      Voir la réservation
                    </Link>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </HotelPage>
  );
}
