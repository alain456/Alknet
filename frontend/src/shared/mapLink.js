/** Coordonnées dans un lien Google Maps. Le repère !3d!4d prime sur la caméra @. */
export function extractMapCoordinates(text) {
  let raw = String(text || '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    raw = String(text || '');
  }
  const pin = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin && valid(pin[1], pin[2])) return { latitude: pin[1], longitude: pin[2] };
  const at = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at && valid(at[1], at[2])) return { latitude: at[1], longitude: at[2] };
  const query = raw.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:[,+\s]|%2C)+(-?\d+\.\d+)/i);
  if (query && valid(query[1], query[2])) return { latitude: query[1], longitude: query[2] };
  if (!/^https?:/i.test(raw.trim())) {
    const pair = raw.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
    if (pair && valid(pair[1], pair[2])) return { latitude: pair[1], longitude: pair[2] };
  }
  return null;
}

function valid(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

export function looksLikeMapsLink(text) {
  return /^https:\/\/(?:www\.google\.[^/]+\/maps|maps\.google\.[^/]+|maps\.app\.goo\.gl\/|goo\.gl\/maps)/i.test(String(text || '').trim());
}
