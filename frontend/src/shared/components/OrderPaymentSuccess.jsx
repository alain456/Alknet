import React, { useState } from 'react';
import BurundiPayPayerField from './BurundiPayPayerField';
import { isValidBurundiPayPhone } from './burundiPayPhone';

const PAY_LABELS = {
  PAID: 'Payé',
  AWAITING_PIN: 'En attente validation PIN BurundiPay',
  UNPAID: 'Non payé',
  FAILED: 'Échoué',
  REFUNDED: 'Remboursé',
  WAIVED: 'Exonéré',
};

function pickEntity(res, current) {
  return res?.reservation || res?.appointment || res?.order || res || current;
}

/**
 * Écran post-paiement BurundiPay (commande / RDV / réservation hôtel).
 */
export default function OrderPaymentSuccess({
  order,
  onOrderUpdate,
  onDone,
  confirmPayment,
  retryPayment,
  title = 'Commande envoyée',
  referenceLabel = 'Votre commande',
  doneLabel = 'Retourner au catalogue',
  paidHint = 'Paiement validé. La pharmacie pourra accepter votre commande ; vous pourrez ensuite récupérer vos médicaments.',
  unpaidHint = "Validez le paiement BurundiPay avant de vous présenter. L'établissement n'acceptera la demande qu'après paiement.",
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(order?.payment_initiation?.message || '');
  const [current, setCurrent] = useState(order);
  const [payerPhone, setPayerPhone] = useState(order?.payer_phone || '');

  const status = current?.payment_status;
  const paid = status === 'PAID' || status === 'WAIVED';
  const canConfirmPin = status === 'AWAITING_PIN' || status === 'UNPAID';

  const runConfirm = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await confirmPayment(current.id);
      const next = pickEntity(res, current);
      setCurrent({ ...current, ...next });
      onOrderUpdate?.(next);
      setMsg(res?.message || 'Paiement confirmé.');
    } catch (e) {
      setMsg(e?.data?.message || e.message || 'Échec confirmation paiement');
    } finally {
      setBusy(false);
    }
  };

  const runRetry = async () => {
    const phone = String(payerPhone || current?.payer_phone || '').trim();
    if (!isValidBurundiPayPhone(phone)) {
      setMsg('Numéro BurundiPay invalide. Utilisez 8 chiffres (ex. 79xxxxxx) ou 257XXXXXXXX.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await retryPayment(current.id, phone);
      const next = pickEntity(res, current);
      const merged = { ...current, ...next, payer_phone: next?.payer_phone || phone };
      setCurrent(merged);
      setPayerPhone(merged.payer_phone || phone);
      onOrderUpdate?.(merged);
      setMsg(res?.message || 'Paiement relancé.');
    } catch (e) {
      setMsg(e?.data?.message || e.message || 'Échec relance paiement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 max-w-lg text-center space-y-4 shadow-sm w-full">
        <h1 className="text-2xl font-bold text-emerald-800">{title}</h1>
        <p className="text-slate-700">
          {referenceLabel} <strong>{current?.reference}</strong> a été enregistrée.
        </p>
        <div
          className={`p-4 rounded-xl text-sm text-left border ${
            paid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <p className="font-semibold">
            Paiement : {PAY_LABELS[status] || status || '—'}
          </p>
          <p className="text-xs mt-1">
            Montant : {Number(current?.total_amount || 0).toLocaleString('fr-BI')} {current?.currency || 'BIF'}
            {current?.payment_merchant_account
              ? ` → marchand ${current.payment_merchant_account}`
              : ''}
          </p>
          {msg && (
            <p className={`text-xs mt-2 font-medium ${status === 'FAILED' ? 'text-red-700' : ''}`}>
              {msg}
            </p>
          )}
          {paid ? (
            <p className="text-xs mt-2 font-medium">{paidHint}</p>
          ) : (
            <div className="mt-3 space-y-3">
              <BurundiPayPayerField
                value={payerPhone}
                onChange={setPayerPhone}
                required
                hint="Corrigez le numéro si besoin (8 chiffres, ex. 79xxxxxx), puis relancez."
              />
              <div className="flex flex-wrap gap-2">
                {canConfirmPin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={runConfirm}
                    className="px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    Confirmer le PIN (simulation)
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={runRetry}
                  className="px-3 py-2 rounded-lg bg-white border text-xs font-semibold disabled:opacity-50"
                >
                  Relancer le paiement
                </button>
              </div>
            </div>
          )}
        </div>
        {!paid && (
          <p className="text-sm text-amber-800">{unpaidHint}</p>
        )}
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 bg-primary text-white rounded-xl font-semibold"
        >
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
