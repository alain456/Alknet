/** Normalize a business website URL for storage and <a href>. */
export function normalizeWebsiteUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function websiteHref(raw) {
  return normalizeWebsiteUrl(raw);
}
