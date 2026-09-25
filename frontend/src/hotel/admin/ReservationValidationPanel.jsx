import React, { useEffect, useMemo, useState } from 'react';
import {
  Check, X, AlertTriangle, CreditCard, RefreshCw, ClipboardCheck, Mail, Phone,
} from 'lucide-react';
import hotelService, { listOf } from '../hotelService';
import { promptRequiredMotif } from '../promptMotif';
import { Panel, btnPrimary, btnGhost } from '../ui';
import { useHotelPerm } from '../useHotelPerm';

const PAY_OK = new Set(['PAID', 'WAIVED']);

function CheckRow({ status, title, detail, action }) {
  const tone = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    warn: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    bad: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100',
    loading: 'border-accent/30 bg-surface text-ink-muted',
  }[status] || 'border-accent/30 bg-surface text-ink';

  const Icon = status === 'ok' ? Check : status === 'bad' ? X : AlertTriangle;

  return (
    <div className={`rounded-xl border-2 px-3 py-2.5 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold">{title}</p>
          {detail && <p className="text-[11px] font-medium mt-0.5 opacity-90 whitespace-pre-wrap">{detail}</p>}
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Aide à la validation — visible pour qui peut confirmer (PENDING / DRAFT).
 */
export default function ReservationValidationPanel({
  reservation,
  onClose,
  onConfirmed,
  onRejected,
  onRefreshed,
  setErr,
  setOk,
}) {
  const [localOverride, setLocalOverride] = useState(null);
  const r = localOverride ? { ...reservation, ...localOverride } : reservation;

  useEffect(() => {
    setLocalOverride(null);
  }, [reservation?.id]);

  useEffect(() => {
    // Sync si le parent a déjà rechargé (ex. payment_status REFUNDED)
    if (reservation?.payment_status && localOverride?.payment_status
      && reservation.payment_status === localOverride.payment_status) {
      setLocalOverride(null);
    }
  }, [reservation?.payment_status, localOverride?.payment_status]);

  const { can, canUpdate } = useHotelPerm();
  // Aligné sur l’API : confirm/cancel sont des verbes distincts (pas update)
  const canConfirm = can('hotel.reservations.confirm');
  const canReject = can('hotel.reservations.cancel');
  const [available, setAvailable] = useState([]);
  const [availLoading, setAvailLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAvailability = () => {
    if (!r?.room_type || !r?.check_in_date || !r?.check_out_date) {
      setAvailable([]);
      setAvailLoading(false);
      return;
    }
    setAvailLoading(true);
    hotelService.availability({
      room_type: r.room_type,
      check_in: r.check_in_date,
      check_out: r.check_out_date,
    })
      .then((d) => setAvailable(listOf(d)))
      .catch(() => setAvailable([]))
      .finally(() => setAvailLoading(false));
  };

  useEffect(() => {
    loadAvailability();
  }, [r?.id, r?.room_type, r?.check_in_date, r?.check_out_date]);

  const checks = useMemo(() => {
    const items = [];
    const amount = Number(r.total_amount || 0);
    const nights = Number(r.nights || 0);
    const adults = Number(r.adults || 0);
    const children = Number(r.children || 0);
    const capA = Number(r.room_type_capacity_adults || 0);
    const capC = Number(r.room_type_capacity_children || 0);

    // Dates
    const datesOk = Boolean(r.check_in_date && r.check_out_date && nights > 0);
    items.push({
      key: 'dates',
      status: datesOk ? 'ok' : 'bad',
      title: 'Dates du séjour',
      detail: datesOk
        ? `${r.check_in_date} → ${r.check_out_date} (${nights} nuit${nights > 1 ? 's' : ''})`
        : 'Dates invalides ou durée nulle.',
      blocking: !datesOk,
    });

    // Client contact
    const hasPhone = Boolean(String(r.guest_phone || '').trim());
    items.push({
      key: 'phone',
      status: hasPhone ? 'ok' : 'bad',
      title: 'Téléphone client',
      detail: hasPhone ? r.guest_phone : 'Aucun téléphone — difficile de joindre le client.',
      blocking: !hasPhone,
    });

    const hasEmail = Boolean(String(r.guest_email || '').trim());
    items.push({
      key: 'email',
      status: hasEmail ? 'ok' : 'warn',
      title: 'Email client (confirmation)',
      detail: hasEmail
        ? r.guest_email
        : 'Pas d’email : le message de confirmation prédéfini ne pourra pas être envoyé.',
      blocking: false,
    });

    // Capacité — bloquant à la confirmation si hors limites
    const overAdults = capA > 0 && adults > capA;
    const overChildren = children > capC;
    const capOk = !overAdults && !overChildren;
    items.push({
      key: 'capacity',
      status: capOk ? 'ok' : 'bad',
      title: 'Capacité du type de chambre',
      detail: capOk
        ? `${adults} adulte(s)${children ? ` + ${children} enfant(s)` : ''} · max ${capA || '—'} / ${capC || '—'}`
        : `Occupants hors capacité (max ${capA} ad. / ${capC} enf.) — refusez ou corrigez la réservation.`,
      blocking: !capOk,
    });

    // Disponibilité
    if (availLoading) {
      items.push({
        key: 'avail',
        status: 'loading',
        title: 'Disponibilité chambres',
        detail: 'Vérification en cours…',
        blocking: true,
      });
    } else {
      const count = available.length;
      const roomAssigned = Boolean(r.room_number);
      const okAvail = count > 0 || roomAssigned;
      items.push({
        key: 'avail',
        status: okAvail ? 'ok' : 'bad',
        title: 'Disponibilité chambres',
        detail: roomAssigned
          ? `Chambre déjà assignée : ${r.room_number}${count ? ` · ${count} autre(s) dispo` : ''}`
          : (count
            ? `${count} chambre(s) disponible(s) pour ces dates (${r.room_type_name || 'type'})`
            : 'Aucune chambre disponible — refusez ou changez les dates / le type.'),
        blocking: !okAvail,
      });
    }

    // Paiement
    if (amount <= 0) {
      items.push({
        key: 'pay',
        status: 'ok',
        title: 'Paiement',
        detail: 'Montant à 0 — pas de paiement requis.',
        blocking: false,
      });
    } else if (r.payment_status === 'REFUNDED') {
      items.push({
        key: 'pay',
        status: 'ok',
        title: 'Paiement remboursé',
        detail: `${amount.toLocaleString()} ${r.currency || 'BIF'} — vous pouvez refuser la réservation.`,
        blocking: false,
      });
    } else if (r.payment_status === 'PAID') {
      items.push({
        key: 'pay',
        status: 'warn',
        title: 'Paiement reçu — remboursement requis pour refuser',
        detail: `Payé · ${amount.toLocaleString()} ${r.currency || 'BIF'}${r.payer_phone ? ` · ${r.payer_phone}` : ''}. Remboursez le client avant de pouvoir refuser.`,
        blocking: false,
        refundAction: true,
      });
    } else if (PAY_OK.has(r.payment_status)) {
      items.push({
        key: 'pay',
        status: 'ok',
        title: 'Paiement',
        detail: `${r.payment_status === 'WAIVED' ? 'Exonéré' : 'Payé'} · ${amount.toLocaleString()} ${r.currency || 'BIF'}${r.payer_phone ? ` · ${r.payer_phone}` : ''}`,
        blocking: false,
      });
    } else {
      items.push({
        key: 'pay',
        status: 'bad',
        title: 'Paiement non validé',
        detail: `Statut : ${r.payment_status || '—'} · ${amount.toLocaleString()} ${r.currency || 'BIF'}. Réglez ou simulez le PIN avant de confirmer.`,
        blocking: true,
        payActions: true,
      });
    }

    // Demandes spéciales
    if (String(r.special_requests || '').trim()) {
      items.push({
        key: 'special',
        status: 'warn',
        title: 'Demandes spéciales à noter',
        detail: r.special_requests,
        blocking: false,
      });
    }

    return items;
  }, [r, available, availLoading]);

  const blocking = checks.some((c) => c.blocking);
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const needsRefundBeforeRefuse = Number(r.total_amount || 0) > 0 && r.payment_status === 'PAID';

  const confirm = async () => {
    if (blocking || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await hotelService.confirmReservation(r.id);
      const mail = res?.email_notification;
      const extra = mail?.sent
        ? ' Email de confirmation envoyé.'
        : (mail && !mail.sent ? ` Email non envoyé : ${mail.message || mail.error || '—'}.` : '');
      setOk(`${r.reference} confirmée.${res?.payment_simulated ? ' Paiement simulé.' : ''}${extra}`);
      onConfirmed?.(res);
    } catch (e) {
      const msg = e.message || 'Confirmation impossible.';
      const detail = e?.data?.detail || e?.data?.payment_status;
      setErr(
        e?.status === 403
          ? 'Droit insuffisant : il faut la permission « Confirmer » les réservations (pas seulement Modifier). Demandez au propriétaire d’activer ce droit pour votre rôle.'
          : (Array.isArray(detail) ? detail.join(' ') : (detail || msg)),
      );
    } finally {
      setBusy(false);
    }
  };

  const refundThenRefresh = async () => {
    if (busy) return;
    if (!window.confirm(
      `Marquer le paiement de ${r.reference} comme remboursé ?\n`
      + 'Requis avant de pouvoir refuser la réservation.',
    )) return;
    setBusy(true);
    setErr('');
    try {
      const res = await hotelService.refundReservation(r.id, { note: 'Remboursé avant refus' });
      setOk(res?.message || `Paiement remboursé pour ${r.reference}.`);
      // Mise à jour immédiate du panneau (débloque « Refuser »)
      setLocalOverride({
        payment_status: res?.payment_status || 'REFUNDED',
        payment_note: res?.payment_note || 'Remboursé avant refus',
      });
      await onRefreshed?.();
    } catch (e) {
      setErr(e.message || 'Remboursement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (busy) return;
    if (needsRefundBeforeRefuse) {
      setErr('Remboursez d’abord le client avant de refuser cette réservation.');
      return;
    }
    if (!window.confirm(
      `Refuser la demande ${r.reference} ?\nLe motif de refus sera visible par le client (historique + email).`,
    )) return;
    const reason = promptRequiredMotif('Motif du refus (visible par le client) :');
    if (!reason) return;
    setBusy(true);
    setErr('');
    try {
      const res = await hotelService.cancelReservation(r.id, { reason, note: reason, decision_note: reason });
      const mail = res?.email_notification;
      setOk(
        mail?.sent
          ? `${r.reference} refusée — email avec motif envoyé.`
          : `${r.reference} refusée.${mail && !mail.sent ? ` Email non envoyé : ${mail.message || mail.error || '—'}.` : ''}`,
      );
      onRejected?.(res);
    } catch (e) {
      setErr(e.message || 'Refus impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <Panel className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl border-2 border-accent">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border-2 border-accent flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Avant validation</p>
            <h2 className="text-lg font-extrabold text-ink truncate">{r.reference}</h2>
            <p className="text-sm font-bold text-ink mt-0.5">{r.guest_name || 'Client'}</p>
            <p className="text-xs text-ink-muted font-medium mt-0.5">
              {r.room_type_name || 'Type —'}
              {r.room_number ? ` · Ch. ${r.room_number}` : ''}
              {' · '}
              {Number(r.total_amount || 0).toLocaleString()} {r.currency || 'BIF'}
            </p>
          </div>
          <button type="button" className={btnGhost} onClick={onClose} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] font-bold mb-3">
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Phone className="w-3 h-3" /> {r.guest_phone || '—'}
          </span>
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Mail className="w-3 h-3" /> {r.guest_email || '—'}
          </span>
        </div>

        <p className="text-xs font-medium text-ink-muted mb-3">
          Checklist de contrôle — corrigez les points bloquants avant de confirmer.
          {warnCount > 0 ? ` ${warnCount} point(s) d’attention.` : ''}
        </p>

        <div className="space-y-2 mb-4">
          {checks.map((c) => (
            <CheckRow
              key={c.key}
              status={c.status}
              title={c.title}
              detail={c.detail}
              action={c.refundAction ? (
                <button
                  type="button"
                  disabled={busy}
                  className={`${btnGhost} text-[11px] inline-flex items-center gap-1 py-1.5`}
                  onClick={refundThenRefresh}
                >
                  <CreditCard className="w-3 h-3" /> Rembourser puis refuser
                </button>
              ) : c.payActions ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className={`${btnGhost} text-[11px] inline-flex items-center gap-1 py-1.5`}
                    onClick={() => {
                      setBusy(true);
                      hotelService.confirmReservationPayment(r.id)
                        .then(() => {
                          setOk(`Paiement simulé pour ${r.reference}.`);
                          return onRefreshed?.();
                        })
                        .catch((e) => setErr(e.message))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <CreditCard className="w-3 h-3" /> Simuler PIN
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={`${btnGhost} text-[11px] inline-flex items-center gap-1 py-1.5`}
                    onClick={() => {
                      setBusy(true);
                      hotelService.payReservation(r.id, r.payer_phone || '79556677')
                        .then(() => onRefreshed?.())
                        .catch((e) => setErr(e.message))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <RefreshCw className="w-3 h-3" /> Relancer BurundiPay
                  </button>
                </div>
              ) : c.key === 'avail' ? (
                <button
                  type="button"
                  className={`${btnGhost} text-[11px] inline-flex items-center gap-1 py-1.5`}
                  onClick={loadAvailability}
                >
                  <RefreshCw className="w-3 h-3" /> Revérifier
                </button>
              ) : null}
            />
          ))}
        </div>

        {blocking && (
          <p className="text-xs font-bold text-alert mb-3">
            Confirmation bloquée tant qu’un contrôle critique n’est pas OK.
          </p>
        )}
        {needsRefundBeforeRefuse && (
          <p className="text-xs font-bold text-amber-800 mb-3">
            Refus bloqué : remboursez d’abord le paiement reçu.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {canConfirm && (
            <button
              type="button"
              disabled={busy || blocking || availLoading || r.payment_status === 'REFUNDED'}
              className={`${btnPrimary} flex-1 inline-flex items-center justify-center gap-1.5 text-sm`}
              onClick={confirm}
              title={r.payment_status === 'REFUNDED' ? 'Paiement remboursé — confirmez uniquement si vous recréez un paiement' : undefined}
            >
              <Check className="w-4 h-4" />
              {busy ? 'Traitement…' : 'Confirmer la réservation'}
            </button>
          )}
          {canReject && (
            <button
              type="button"
              disabled={busy || needsRefundBeforeRefuse}
              className={`${btnGhost} flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-alert`}
              onClick={reject}
              title={needsRefundBeforeRefuse ? 'Remboursez d’abord le client' : undefined}
            >
              <X className="w-4 h-4" />
              Refuser
            </button>
          )}
          {!canConfirm && !canReject && (
            <p className="text-xs font-bold text-ink-muted">Lecture seule — pas de droit de confirmation / refus.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
