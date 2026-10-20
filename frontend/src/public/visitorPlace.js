const STORAGE_KEY = 'isoko-visitor-place';
const MAX_AGE_MS = 30 * 60 * 1000;

export function visitorPosition() {
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lng) && Date.now() - cached.at < MAX_AGE_MS) {
      return Promise.resolve(cached);
    }
  } catch {
    /* cache illisible */
  }
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 2500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(point));
        resolve(point);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: MAX_AGE_MS },
    );
  });
}
