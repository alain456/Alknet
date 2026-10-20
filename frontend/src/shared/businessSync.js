export const BUSINESS_UPDATED = 'isoko:business-updated';

export function publishBusinessUpdate(business) {
  if (!business || typeof business !== 'object') return;
  window.dispatchEvent(new CustomEvent(BUSINESS_UPDATED, { detail: business }));
}

export function firstBusiness(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}
