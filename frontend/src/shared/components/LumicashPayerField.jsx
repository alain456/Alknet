import React from 'react';

/**
 * Bloc paiement Lumicash (même style que la réservation RDV hôpital).
 */
export default function LumicashPayerField({
  value,
  onChange,
  amountLabel = '',
  required = true,
  hint = 'Saisissez votre numéro Lumicash pour payer maintenant. Validez ensuite le PIN pour finaliser.',
}) {
  return (
    <div className="rounded-xl border border-[#1a237e]/20 overflow-hidden bg-white">
      <div className="bg-[#FFD600] px-4 py-3 flex items-center justify-center">
        <img
          src="/lumicash.png"
          alt="Lumicash"
          className="h-14 w-auto object-contain"
        />
      </div>
      <div className="p-4 space-y-3">
        {amountLabel ? (
          <p className="text-center text-lg font-bold text-gray-900">{amountLabel}</p>
        ) : null}
        <p className="text-xs text-slate-600 text-center">{hint}</p>
        <input
          required={required}
          type="tel"
          aria-label="Numéro Lumicash"
          placeholder="79xxxxxx"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-[#1a237e]"
        />
      </div>
    </div>
  );
}
