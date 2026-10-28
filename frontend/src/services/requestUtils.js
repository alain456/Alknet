export const REQUEST_STATUS_LABELS = {
  NEW: 'Nouvelle',
  IN_PROGRESS: 'En cours',
  REPLIED: 'Répondue',
  CLOSED: 'Clôturée',
};

export const REPLY_TEMPLATES = [
  'Nous avons bien reçu votre demande. Nous vous contactons pour confirmer le créneau.',
  'Pouvez-vous préciser le jour, l’heure et le nombre de personnes ?',
  'Nous pouvons intervenir. Merci de confirmer par téléphone ou WhatsApp.',
];

export const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

export const waHref = (phone, text = '') => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 8) digits = `257${digits}`;
  if (digits.startsWith('0') && digits.length === 9) digits = `257${digits.slice(1)}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
};

export const formatRequestWhen = (raw) => {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return date.toLocaleString('fr-BI');
};
