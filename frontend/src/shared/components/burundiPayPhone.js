/** Validation numéro BurundiPay (alignée sur businesses/burundipay.normalize_phone). */

export function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function normalizeBurundiPayPhone(phone) {
  const digits = digitsOnly(phone);
  if (digits.startsWith('257') && digits.length >= 11) return digits;
  if (digits.length === 8) return `257${digits}`;
  return digits;
}

/** Accepte 8 chiffres locaux ou 257 + 8 chiffres. */
export function isValidBurundiPayPhone(phone) {
  const digits = digitsOnly(phone);
  if (digits.length === 8) return true;
  if (digits.startsWith('257') && digits.length === 11) return true;
  return false;
}
