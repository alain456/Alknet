import React from 'react';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';

export default function EnrollmentPaymentChoice({
  method,
  onMethod,
  payerPhone,
  onPhone,
  bordereauName,
  onBordereau,
  amountLabel,
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-ink">Règlement des frais d’inscription</p>
      <p className="text-sm text-ink-muted">{amountLabel}. Un seul mode suffit : BurundiPay ou un bordereau PDF.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {[
          ['BURUNDIPAY', 'BurundiPay'],
          ['BORDEREAU', 'Bordereau PDF'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onMethod(value)}
            className={`px-3 py-2.5 rounded-xl border-2 text-sm font-bold ${method === value ? 'bg-accent text-ink border-accent' : 'border-border text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {method === 'BURUNDIPAY' && (
        <BurundiPayPayerField value={payerPhone} onChange={onPhone} amountLabel={amountLabel} />
      )}
      {method === 'BORDEREAU' && (
        <label className="block text-xs font-bold text-ink">
          Bordereau (PDF)
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="mt-1 block w-full text-sm font-medium"
            onChange={(e) => onBordereau(e.target.files?.[0] || null)}
          />
          {bordereauName && <span className="mt-1 block font-medium text-ink-muted">{bordereauName}</span>}
        </label>
      )}
    </div>
  );
}
