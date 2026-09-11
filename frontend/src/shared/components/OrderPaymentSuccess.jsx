import React, { useState } from 'react';

const PAY_LABELS = {
  PAID: 'Payé',
  AWAITING_PIN: 'En attente validation PIN Lumicash',
  UNPAID: 'Non payé',
  FAILED: 'Échoué',
  REFUNDED: 'Remboursé',
};

/**
 * Écran post-commande : confirmer le PIN Lumicash (comme RDV hôpital).
 */
export default function OrderPaymentSuccess({
  order,
  onOrderUpdate,
  onDone,
  confirmPayment,
  retryPayment,
  doneLabel = 'Retourner au catalogue',
  paidHint = 'Paiement validé. La pharmacie pourra accepter votre commande ; vous pourrez ensuite récupérer vos médicaments.',
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(order?.payment_initiation?.message || '');
  const [current, setCurrent] = useState(order);

  const status = current?.payment_status;
  const paid = status === 'PAID';

  const runConfirm = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await confirmPayment(current.id);
      const next = res?.order || res;
      setCurrent(next);
      onOrderUpdate?.(next);
      setMsg(res?.message || 'Paiement confirmé.');
    } catch (e) {
      setMsg(e.message || 'Échec confirmation paiement');
    } finally {
      setBusy(false);
    }
  };

  const runRetry = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await retryPayment(current.id, current.payer_phone);
      const next = res?.order || res;
      setCurrent(next);
      onOrderUpdate?.(next);
      setMsg(res?.message || 'Paiement relancé.');
    } catch (e) {
      setMsg(e.message || 'Échec relance paiement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F6] flex items-center justify-center p-6">
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 max-w-lg text-center space-y-4 shadow-sm w-full">
        <h1 className="text-2xl font-bold text-emerald-800">Commande envoyée</h1>
        <p className="text-slate-700">
          Votre commande <strong>{current?.reference}</strong> a été enregistrée.
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
          {current?.payer_phone && (
            <p className="text-xs mt-1">Lumicash : {current.payer_phone}</p>
          )}
          {msg && <p className="text-xs mt-2">{msg}</p>}
          {paid ? (
            <p className="text-xs mt-2 font-medium">{paidHint}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {(status === 'AWAITING_PIN' || status === 'UNPAID') && (
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
          )}
        </div>
        {!paid && (
          <p className="text-sm text-amber-800">
            Validez le paiement Lumicash avant de vous présenter à la pharmacie. L&apos;admin n&apos;acceptera la commande qu&apos;après paiement.
          </p>
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
