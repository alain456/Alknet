import React from 'react';
import { btnGhost, btnPrimary } from '../ui';

/**
 * Reçu imprimable — overlay + @media print.
 */
export default function PaymentReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const currency = receipt.folio?.currency || 'BIF';
  const money = (n) => `${Number(n || 0).toLocaleString()} ${currency}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 print:static print:bg-white print:p-0">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-xl border border-accent/20 overflow-hidden max-h-[95vh] overflow-y-auto print:shadow-none print:border-0 print:max-w-none print:rounded-none">
        <div className="px-5 py-3 border-b border-accent/10 flex items-center justify-between gap-2 print:hidden">
          <p className="font-extrabold text-ink">Reçu de paiement</p>
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} onClick={() => window.print()}>
              Imprimer
            </button>
            <button type="button" className={btnGhost} onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>

        <div className="p-6 text-ink space-y-4 receipt-print-area">
          <div className="text-center space-y-1">
            <p className="text-xl font-extrabold">{receipt.hotel?.name}</p>
            {(receipt.hotel?.phone || receipt.hotel?.email) && (
              <p className="text-xs text-ink-muted">
                {[receipt.hotel.phone, receipt.hotel.email].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="text-sm font-bold mt-2">REÇU {receipt.receipt_number}</p>
            <p className="text-xs text-ink-muted">
              {receipt.payment?.paid_at
                ? new Date(receipt.payment.paid_at).toLocaleString('fr-FR')
                : ''}
            </p>
          </div>

          <div className="text-sm space-y-1 border-t border-b border-dashed border-accent/40 py-3">
            <p><span className="font-bold">Client :</span> {receipt.guest?.name || '—'}</p>
            {receipt.guest?.phone ? <p><span className="font-bold">Tél :</span> {receipt.guest.phone}</p> : null}
            {receipt.stay?.reservation_ref ? (
              <p><span className="font-bold">Réservation :</span> {receipt.stay.reservation_ref}</p>
            ) : null}
            {receipt.stay?.room_number ? (
              <p><span className="font-bold">Chambre :</span> {receipt.stay.room_number}</p>
            ) : null}
            {receipt.stay?.check_in && receipt.stay?.check_out ? (
              <p>
                <span className="font-bold">Séjour :</span>
                {' '}
                {receipt.stay.check_in} → {receipt.stay.check_out}
              </p>
            ) : null}
          </div>

          {(receipt.folio?.items || []).length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-accent/30">
                  <th className="py-1 font-bold">Désignation</th>
                  <th className="py-1 font-bold text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {receipt.folio.items.map((i, idx) => (
                  <tr key={idx} className="border-b border-accent/10">
                    <td className="py-1.5">
                      {i.description}
                      {Number(i.quantity) !== 1 ? ` × ${i.quantity}` : ''}
                    </td>
                    <td className="py-1.5 text-right">{money(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Total folio</span>
              <span className="font-bold">{money(receipt.folio?.total)}</span>
            </div>
            <div className="flex justify-between text-primary font-extrabold text-base border-t border-accent/30 pt-2">
              <span>Ce paiement ({receipt.payment?.method_label})</span>
              <span>{money(receipt.payment?.amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-muted">
              <span>Solde restant</span>
              <span>{money(receipt.folio?.balance)}</span>
            </div>
            {receipt.payment?.reference ? (
              <p className="text-xs text-ink-muted pt-1">Réf. paiement : {receipt.payment.reference}</p>
            ) : null}
          </div>

          <p className="text-center text-[10px] text-ink-muted pt-4">
            Merci de votre séjour — Isoko Hub
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
          .receipt-print-area {
            position: absolute !important;
            left: 0; top: 0; width: 100%;
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
