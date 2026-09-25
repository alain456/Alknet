import React from 'react';
import { isValidBurundiPayPhone } from './burundiPayPhone';

/**
 * Bloc paiement BurundiPay (banques + mobile money).
 * Couleurs : palette Isoko (primary / accent / surface).
 */
export default function BurundiPayPayerField({
  value,
  onChange,
  amountLabel = '',
  required = true,
  hint = 'Saisissez votre numéro (banque ou mobile money) pour payer via BurundiPay. Validez ensuite le PIN pour finaliser.',
}) {
  const showHint = value && !isValidBurundiPayPhone(value);

  return (
    <div className="rounded-xl border-2 border-accent overflow-hidden bg-surface">
      <div className="bg-primary/5 px-4 py-3 flex flex-col items-center justify-center gap-1 border-b-2 border-accent/40">
        <img
          src="/burundipay.png"
          alt="BurundiPay"
          className="h-16 w-auto object-contain"
        />
        <p className="text-[10px] font-semibold text-accent tracking-wide text-center">
          Riha, Ronka, Rungika amafaranga mu kanya isase
        </p>
      </div>
      <div className="p-4 space-y-3">
        {amountLabel ? (
          <p className="text-center text-lg font-bold text-ink">{amountLabel}</p>
        ) : null}
        <p className="text-xs text-ink-muted text-center font-medium">{hint}</p>
        <label className="block text-xs font-bold text-ink text-center mb-1">
          Numéro banque ou mobile money (BurundiPay)
        </label>
        <input
          required={required}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          minLength={8}
          maxLength={16}
          pattern="(\+?257)?[0-9]{8}"
          title="8 chiffres (ex. 79xxxxxx) ou 257XXXXXXXX"
          aria-label="Numéro BurundiPay"
          placeholder="79xxxxxx"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2.5 border-2 rounded-xl text-sm bg-surface text-ink outline-none focus:border-alert ${
            showHint ? 'border-alert' : 'border-accent'
          }`}
        />
        {showHint && (
          <p className="text-xs text-alert font-medium text-center">
            Numéro invalide : 8 chiffres requis (ex. 79xxxxxx).
          </p>
        )}
      </div>
    </div>
  );
}
