import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, RefreshCw } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { HotelPage, Panel, Empty, fieldClass, btnPrimary, btnGhost } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

export default function HotelClientMessages() {
  const { can, canView } = useHotelPerm();
  const canSee = canView('reservations') || can('hotel.reservations.reply');
  const canReply = can('hotel.reservations.reply');
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    return hotelService.reservations({ client_messages: 'pending' })
      .then((d) => {
        setList(listOf(d));
        setErr('');
      })
      .catch((e) => setErr(e.message || 'Impossible de charger les messages'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canSee) return undefined;
    load();
    const id = setInterval(() => { load().catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, [canSee]);

  const submitReply = async (e) => {
    e?.preventDefault?.();
    if (!replyTarget?.id) return;
    const text = replyText.trim();
    if (!text) {
      setErr('Écrivez une réponse pour le client.');
      return;
    }
    setReplyBusy(true);
    setErr('');
    try {
      const res = await hotelService.replyReservationMessage(replyTarget.id, text);
      const mail = res?.email_notification;
      setOk(
        (res?.message || 'Réponse envoyée au client.')
        + (mail?.sent ? ' Email envoyé.' : ''),
      );
      setReplyTarget(null);
      setReplyText('');
      await load();
    } catch (ex) {
      setErr(ex.message || 'Impossible d’envoyer la réponse');
    } finally {
      setReplyBusy(false);
    }
  };

  if (!canSee) {
    return (
      <HotelPage title="Messages clients">
        <Panel className="border-alert">
          <p className="text-sm text-alert font-bold">
            Droits insuffisants. Ajoutez « Voir réservations » ou « Répondre au client ».
          </p>
        </Panel>
      </HotelPage>
    );
  }

  return (
    <HotelPage
      title="Messages clients"
      subtitle="Messages reçus depuis l’historique client — répondre pour les faire apparaître côté client"
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
          Aucun message client en attente. Les nouveaux messages apparaîtront ici et sur le tableau de bord.
        </Empty>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Panel key={r.id} className="!p-4">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                <div className="min-w-0 space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-teal-700 shrink-0" />
                    <p className="font-extrabold text-ink">
                      {r.reference || 'Réservation'}
                      {r.guest_name ? ` · ${r.guest_name}` : ''}
                    </p>
                    <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2 py-0.5">
                      En attente de réponse
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {[r.room_type_name, r.check_in_date && r.check_out_date ? `${r.check_in_date} → ${r.check_out_date}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {r.special_requests ? (
                    <div className="rounded-xl bg-surface border border-accent/20 px-3 py-2.5 max-h-48 overflow-y-auto">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">Échanges</p>
                      <p className="text-xs whitespace-pre-wrap text-ink">{r.special_requests}</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                  {canReply && (
                    <button
                      type="button"
                      className={`${btnPrimary} text-xs inline-flex items-center justify-center gap-1.5`}
                      onClick={() => {
                        setErr('');
                        setOk('');
                        setReplyTarget(r);
                        setReplyText('');
                      }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Répondre
                    </button>
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
          ))}
        </div>
      )}

      {replyTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={submitReply}
            className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-xl border border-accent/20 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-accent/10 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Communication client</p>
                <h3 className="text-lg font-extrabold text-ink flex items-center gap-2 mt-0.5">
                  <MessageSquare className="w-5 h-5" />
                  Répondre
                </h3>
                <p className="text-sm text-ink-muted mt-1">
                  {replyTarget.reference}
                  {replyTarget.guest_name ? ` · ${replyTarget.guest_name}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={replyBusy}
                className={btnGhost}
                onClick={() => { setReplyTarget(null); setReplyText(''); }}
              >
                Fermer
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {replyTarget.special_requests ? (
                <div className="rounded-xl bg-surface border border-accent/15 px-3 py-2.5 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">Historique</p>
                  <p className="text-xs whitespace-pre-wrap text-ink">{replyTarget.special_requests}</p>
                </div>
              ) : null}
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-ink">Votre réponse (visible dans l’historique client)</span>
                <textarea
                  className={`${fieldClass} min-h-[110px]`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={2000}
                  placeholder="Écrivez votre message au client…"
                  autoFocus
                />
              </label>
              <div className="flex flex-wrap gap-2 justify-end pt-1">
                <button
                  type="button"
                  disabled={replyBusy}
                  className={btnGhost}
                  onClick={() => { setReplyTarget(null); setReplyText(''); }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={replyBusy || !replyText.trim()}
                  className={`${btnPrimary} inline-flex items-center gap-1.5`}
                >
                  <MessageSquare className="w-4 h-4" />
                  {replyBusy ? 'Envoi…' : 'Envoyer la réponse'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </HotelPage>
  );
}
