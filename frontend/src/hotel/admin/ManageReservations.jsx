import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, ClipboardCheck, CreditCard, MessageSquare, UserX } from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { promptRequiredMotif } from '../promptMotif';
import ReservationBookingForm, { emptyReservationForm } from '../ReservationBookingForm';
import ReservationValidationPanel from './ReservationValidationPanel';
import OrderPaymentSuccess from '../../shared/components/OrderPaymentSuccess';
import { HotelPage, Panel, fieldClass, btnPrimary, btnGhost, Empty } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

const PAY_LABELS = {
  PAID: 'Payé',
  AWAITING_PIN: 'PIN en attente',
  UNPAID: 'Non payé',
  FAILED: 'Échoué',
  WAIVED: 'Exonéré',
  REFUNDED: 'Remboursé',
};

const STATUS_LABELS = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  EXPECTED: 'Attendue',
  CHECKED_IN: 'Check-in',
  CHECKED_OUT: 'Check-out',
  CANCELLED: 'Annulée',
  NO_SHOW: 'No-show',
  EXPIRED: 'Expirée',
};

function payTone(status) {
  if (status === 'PAID' || status === 'WAIVED') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800';
  }
  if (status === 'REFUNDED') {
    return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800';
  }
  if (status === 'AWAITING_PIN') {
    return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800';
  }
  if (status === 'FAILED') {
    return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800';
  }
  return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
}

function statusTone(status) {
  if (status === 'CONFIRMED' || status === 'EXPECTED') {
    return 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800';
  }
  if (status === 'PENDING' || status === 'DRAFT') {
    return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800';
  }
  if (status === 'CHECKED_IN') {
    return 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-200 dark:border-primary/40';
  }
  if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'EXPIRED') {
    return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }
  return 'bg-surface text-ink border-accent/30 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
}

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border ${className}`}>
      {children}
    </span>
  );
}

/**
 * view: 'list' | 'create'
 * listBase / createBase: chemins selon espace admin ou staff
 */
export default function ManageReservations({
  view = 'list',
  listPath = '/hotel/reservations',
  createPath = '/hotel/reservations/new',
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate, canUpdate, can } = useHotelPerm();
  const canAdd = canCreate('reservations');
  // confirm/cancel = droits API dédiés (Réceptionniste a update mais pas confirm → sinon 403)
  const canReview = can('hotel.reservations.confirm') || can('hotel.reservations.cancel');
  const canRefund = can('hotel.reservations.cancel');
  const canNoShow = can('hotel.reservations.cancel') || can('hotel.stays.check_in');
  const canReply = can('hotel.reservations.reply');
  const [list, setList] = useState([]);
  const [types, setTypes] = useState([]);
  const [rates, setRates] = useState([]);
  const [available, setAvailable] = useState([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const initialFilter = searchParams.get('client_messages') ? 'MESSAGES' : 'ALL';
  const [filter, setFilter] = useState(initialFilter);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [form, setForm] = useState(emptyReservationForm({ payment_mode: 'BURUNDIPAY' }));
  const [reviewId, setReviewId] = useState(null);

  const load = () => {
    const params = {};
    if (filter === 'MESSAGES') params.client_messages = 'pending';
    return hotelService.reservations(params).then((d) => {
      setList(listOf(d));
      setErr('');
    });
  };

  const reviewReservation = useMemo(
    () => (reviewId ? list.find((x) => x.id === reviewId) : null),
    [list, reviewId],
  );

  useEffect(() => {
    if (view !== 'list') return undefined;
    load().catch((e) => setErr(e.message));
    return undefined;
  }, [view, filter]);

  useEffect(() => {
    if (view !== 'create') return undefined;
    Promise.all([
      hotelService.roomTypes().catch((e) => (e?.status === 403 ? [] : Promise.reject(e))),
      hotelService.rates().catch((e) => (e?.status === 403 ? [] : Promise.reject(e))),
    ])
      .then(([t, r]) => {
        setTypes(listOf(t).filter((x) => x.is_active !== false));
        setRates(listOf(r).filter((x) => x.is_active !== false));
        if (!listOf(t).length) {
          setErr('Impossible de charger les types de chambres (droits insuffisants). Ajoutez hotel.room_types.view au rôle.');
        }
      })
      .catch((e) => setErr(e.message));
    return undefined;
  }, [view]);

  useEffect(() => {
    if (view !== 'list') return;
    if (filter === 'MESSAGES') {
      if (searchParams.get('client_messages') !== 'pending') {
        setSearchParams({ client_messages: 'pending' }, { replace: true });
      }
    } else if (searchParams.has('client_messages')) {
      setSearchParams({}, { replace: true });
    }
  }, [view, filter, searchParams, setSearchParams]);  useEffect(() => {
    if (view !== 'create') return;
    if (!form.room_type || !form.check_in_date || !form.check_out_date) return;
    hotelService.availability({
      room_type: form.room_type,
      check_in: form.check_in_date,
      check_out: form.check_out_date,
    }).then((d) => setAvailable(listOf(d))).catch(() => setAvailable([]));
  }, [view, form.room_type, form.check_in_date, form.check_out_date]);

  const filtered = useMemo(() => {
    if (filter === 'ALL' || filter === 'MESSAGES') return list;
    if (filter === 'PENDING') return list.filter((r) => r.status === 'PENDING' || r.status === 'DRAFT');
    if (filter === 'CONFIRMED') return list.filter((r) => r.status === 'CONFIRMED' || r.status === 'EXPECTED');
    if (filter === 'PAY_ISSUE') {
      return list.filter((r) => ['FAILED', 'UNPAID', 'AWAITING_PIN'].includes(r.payment_status));
    }
    return list;
  }, [list, filter]);

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

  const canReplyOn = (r) => (
    canReply
    && r.has_client_message
    && !['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(r.status)
  );
  const resetGuestFields = () => {
    setForm((f) => emptyReservationForm({
      payment_mode: f.payment_mode || 'BURUNDIPAY',
      room_type: f.room_type,
      check_in_date: f.check_in_date,
      check_out_date: f.check_out_date,
    }));
  };

  const submit = async (payload) => {
    setErr('');
    setOk('');
    if (payload.estimated_total > 0 && !String(payload.payer_phone || '').trim()) {
      setErr('Indiquez le numéro BurundiPay du client.');
      return;
    }
    setSaving(true);
    try {
      const ratePlan = payload.rate_plan && !String(payload.rate_plan).startsWith('base:')
        ? payload.rate_plan
        : undefined;
      const created = await hotelService.createReservation({
        guest_data: {
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone: payload.phone,
          email: payload.email,
        },
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone,
        email: payload.email,
        room_type: payload.room_type,
        room: payload.room || null,
        ...(ratePlan ? { rate_plan: ratePlan } : {}),
        check_in_date: payload.check_in_date,
        check_out_date: payload.check_out_date,
        adults: Number(payload.adults) || 1,
        children: Number(payload.children) || 0,
        special_requests: payload.special_requests,
        status: payload.estimated_total > 0 ? 'PENDING' : 'CONFIRMED',
      });

      if (payload.estimated_total > 0) {
        const payRes = await hotelService.payReservation(created.id, String(payload.payer_phone).trim());
        const finalRes = payRes.reservation || created;
        setPaymentResult({
          ...finalRes,
          payment_initiation: {
            ok: payRes.ok,
            message: payRes.message,
            stub_mode: payRes.stub_mode,
          },
        });
        resetGuestFields();
        return;
      }

      setOk(`Réservation ${created.reference} créée.`);
      resetGuestFields();
      navigate(listPath);
    } catch (ex) {
      setErr(ex.message || JSON.stringify(ex.data || {}));
    } finally {
      setSaving(false);
    }
  };

  if (paymentResult) {
    return (
      <OrderPaymentSuccess
        order={paymentResult}
        title="Réservation créée"
        referenceLabel="La réservation"
        doneLabel="Voir les réservations"
        paidHint="Paiement validé. Confirmez ensuite la réservation dans la liste."
        unpaidHint="Faites valider le PIN BurundiPay du client."
        confirmPayment={(rid) => hotelService.confirmReservationPayment(rid)}
        retryPayment={(rid, phone) => hotelService.payReservation(rid, phone || paymentResult.payer_phone)}
        onOrderUpdate={(next) => setPaymentResult((prev) => ({ ...prev, ...next }))}
        onDone={() => {
          setPaymentResult(null);
          navigate(listPath);
        }}
      />
    );
  }

  if (view === 'create') {
    if (!canAdd) {
      return <Navigate to={listPath} replace />;
    }
    return (
      <HotelPage
        title="Nouvelle réservation"
        subtitle="Création + paiement BurundiPay — sans check-in"
        actions={(
          <Link to={listPath} className={`${btnGhost} text-sm`}>
            Voir la liste
          </Link>
        )}
      >
        <Panel className="max-w-2xl">
          {ok && <p className="text-sm text-emerald-700 font-bold mb-3">{ok}</p>}
          <ReservationBookingForm
            mode="admin"
            form={form}
            setForm={setForm}
            roomTypes={types}
            rates={rates}
            availableRooms={available}
            availability={form.room_type ? { available_count: available.length } : null}
            currency="BIF"
            fieldClass={fieldClass}
            err={err}
            saving={saving}
            submitLabel="Enregistrer la réservation"
            onSubmit={submit}
          />
        </Panel>
      </HotelPage>
    );
  }

  return (
    <HotelPage
      title="Réservations"
      subtitle="Examiner → paiement OK → confirmation → puis Réception (check-in)"
      actions={canAdd ? (
        <Link to={createPath} className={`${btnPrimary} inline-flex items-center gap-2 text-sm`}>
          <Plus className="w-4 h-4" />
          Nouvelle réservation
        </Link>
      ) : null}
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

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ['ALL', 'Toutes'],
          ['PENDING', 'En attente'],
          ['CONFIRMED', 'Confirmées'],
          ['PAY_ISSUE', 'Paiement à traiter'],
          ['MESSAGES', 'Messages clients'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${
              filter === key
                ? 'bg-primary text-surface border-accent'
                : 'bg-surface text-ink border-accent/40 hover:bg-primary/5'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`${btnGhost} text-xs inline-flex items-center gap-1.5 ml-auto`}
          onClick={() => load().catch((e) => setErr(e.message))}
          title="Actualiser"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {!filtered.length ? (
        <Panel>
          <Empty>
            Aucune réservation
            {filter !== 'ALL' ? ' pour ce filtre' : ''}.
            {canAdd ? (
              <>
                {' '}
                <Link to={createPath} className="text-accent font-bold hover:underline">Créer une réservation</Link>
              </>
            ) : null}
          </Empty>
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Panel key={r.id}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold text-primary text-sm sm:text-base tracking-tight">
                      {r.reference}
                    </p>
                    <Badge className={statusTone(r.status)}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                    <Badge className={payTone(r.payment_status)}>
                      {PAY_LABELS[r.payment_status] || r.payment_status || '—'}
                    </Badge>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Client</p>
                      <p className="font-bold text-ink">{r.guest_name || '—'}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {r.room_type_name || 'Type —'}
                        {r.room_number ? ` · Ch. ${r.room_number}` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Séjour</p>
                      <p className="font-bold text-ink">
                        {r.check_in_date} → {r.check_out_date}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {r.nights || 1} nuit{(r.nights || 1) > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Montant</p>
                      <p className="font-extrabold text-ink">
                        {Number(r.total_amount || 0).toLocaleString()} {r.currency || 'BIF'}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {r.payment_method || '—'}
                        {r.payer_phone ? ` · ${r.payer_phone}` : ''}
                      </p>
                    </div>
                  </div>

                  {r.reschedule_status === 'PENDING' && (
                    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 space-y-2">
                      <p className="font-extrabold text-xs uppercase tracking-wide">Demande client — anticiper / reporter</p>
                      <p className="font-bold">
                        Dates souhaitées : {r.reschedule_preferred_check_in} → {r.reschedule_preferred_check_out}
                      </p>
                      {r.reschedule_reason ? (
                        <p className="text-xs whitespace-pre-wrap">Motif : {r.reschedule_reason}</p>
                      ) : null}
                      {canReview && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            className={`${btnPrimary} text-xs`}
                            onClick={() => {
                              const note = window.prompt('Note pour le client (optionnel) :', '') || '';
                              hotelService.respondReschedule(r.id, {
                                decision: 'accept',
                                note,
                                check_in_date: r.reschedule_preferred_check_in,
                                check_out_date: r.reschedule_preferred_check_out,
                              })
                                .then((res) => {
                                  const mail = res?.email_notification;
                                  setOk(
                                    `${r.reference} : nouvelles dates acceptées.`
                                    + (mail?.sent ? ' Email envoyé au client.' : ''),
                                  );
                                  return load();
                                })
                                .catch((e) => setErr(e.message));
                            }}
                          >
                            Accepter les dates
                          </button>
                          <button
                            type="button"
                            className={`${btnGhost} text-xs`}
                            onClick={() => {
                              const note = promptRequiredMotif('Motif du refus (visible par le client) :');
                              if (!note) return;
                              hotelService.respondReschedule(r.id, { decision: 'refuse', note })
                                .then((res) => {
                                  const mail = res?.email_notification;
                                  setOk(
                                    `${r.reference} : modification refusée.`
                                    + (mail?.sent ? ' Email envoyé au client.' : ''),
                                  );
                                  return load();
                                })
                                .catch((e) => setErr(e.message));
                            }}
                          >
                            Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {r.special_requests ? (
                    <p className="text-xs text-ink-muted whitespace-pre-wrap border-t border-accent/10 pt-2">
                      <span className="font-bold text-ink">Échanges client / hôtel : </span>
                      {r.special_requests}
                    </p>
                  ) : null}
                  {r.client_message_pending ? (
                    <p className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message client en attente de réponse
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap lg:flex-col gap-2 lg:items-stretch shrink-0 lg:min-w-[12.5rem]">
                  {canReplyOn(r) && (
                    <button
                      type="button"
                      className={`${btnGhost} text-xs inline-flex items-center justify-center gap-1.5`}
                      onClick={() => {
                        setErr('');
                        setReplyTarget(r);
                        setReplyText('');
                      }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Répondre
                    </button>
                  )}
                  {canReview && ['PENDING', 'DRAFT'].includes(r.status) && (
                    <button
                      type="button"
                      className={`${btnPrimary} text-xs inline-flex items-center justify-center gap-1.5`}
                      onClick={() => { setErr(''); setReviewId(r.id); }}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Examiner & valider
                    </button>
                  )}
                  {canRefund && r.payment_status === 'PAID' && Number(r.total_amount || 0) > 0
                    && !['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(r.status) && (
                    <button
                      type="button"
                      className={`${btnGhost} text-xs inline-flex items-center justify-center gap-1.5`}
                      title="Obligatoire avant de refuser / no-show"
                      onClick={() => {
                        if (!window.confirm(
                          `Rembourser le paiement de ${r.reference} via BurundiPay ?\n`
                          + 'Requis avant de pouvoir refuser ou marquer no-show.',
                        )) return;
                        hotelService.refundReservation(r.id, { note: 'Remboursé avant refus / no-show' })
                          .then((res) => {
                            setOk(res?.message || `Paiement remboursé pour ${r.reference}.`);
                            return load();
                          })
                          .catch((e) => setErr(e.message));
                      }}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Rembourser
                    </button>
                  )}
                  {canNoShow && ['CONFIRMED', 'EXPECTED'].includes(r.status) && (
                    <button
                      type="button"
                      className={`${btnGhost} text-xs inline-flex items-center justify-center gap-1.5 text-alert`}
                      title="Client non présenté — libère la chambre"
                      onClick={async () => {
                        setErr('');
                        try {
                          const motif = await Promise.resolve(
                            promptRequiredMotif('Motif du no-show (historique client) :', 3),
                          );
                          if (!motif) return;
                          const res = await hotelService.markNoShow(r.id, { note: motif });
                          setOk(`No-show enregistré pour ${res?.reference || r.reference}. Chambre libérée.`);
                          return load();
                        } catch (e) {
                          setErr(e.message || 'No-show impossible.');
                        }
                      }}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      No-show
                    </button>
                  )}
                  {canUpdate('reservations') && ['AWAITING_PIN', 'UNPAID', 'FAILED'].includes(r.payment_status) && Number(r.total_amount || 0) > 0 && (
                    <button
                      type="button"
                      className={`${btnGhost} text-xs inline-flex items-center justify-center gap-1.5`}
                      title="Simulation PIN (stub) ou vérif. statut live BurundiPay"
                      onClick={() => hotelService.confirmReservationPayment(r.id)
                        .then((res) => {
                          setOk(res?.message || `Paiement mis à jour pour ${r.reference}.`);
                          return load();
                        })
                        .catch((e) => setErr(e.message))}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Confirmer / vérifier paiement
                    </button>
                  )}
                  {canUpdate('reservations') && ['FAILED', 'UNPAID'].includes(r.payment_status) && (
                    <button
                      type="button"
                      className={`${btnGhost} text-xs inline-flex items-center justify-center gap-1.5`}
                      onClick={() => hotelService.payReservation(r.id, r.payer_phone || '79556677')
                        .then(load)
                        .catch((e) => setErr(e.message))}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Relancer BurundiPay
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {reviewReservation && ['PENDING', 'DRAFT'].includes(reviewReservation.status) && (
        <ReservationValidationPanel
          reservation={reviewReservation}
          setErr={setErr}
          setOk={setOk}
          onClose={() => setReviewId(null)}
          onRefreshed={async () => {
            const data = await load();
            return data;
          }}
          onConfirmed={async () => {
            setReviewId(null);
            await load();
          }}
          onRejected={async () => {
            setReviewId(null);
            await load();
          }}
        />
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
