import api, { invalidateApiCache } from '../shared/api';

const base = 'restaurant';

function bustRestaurantCaches() {
  invalidateApiCache('restaurant/profile');
  invalidateApiCache('restaurant/public/venues');
  invalidateApiCache('restaurant/menu');
  invalidateApiCache('restaurant/bookings');
  invalidateApiCache('restaurant/dashboard');
}

const restaurantService = {
  dashboard: () => api.get(`${base}/dashboard/`, { auth: true, noCache: true }),
  profile: () => api.get(`${base}/profile/me/`, { auth: true, noCache: true }),
  updateProfile: async (data) => {
    const updated = await api.patch(`${base}/profile/me/`, data, { auth: true });
    bustRestaurantCaches();
    return updated;
  },
  menu: () => api.get(`${base}/menu/`, { auth: true, noCache: true }),
  createMenuItem: async (data) => {
    const created = await api.post(`${base}/menu/`, data, { auth: true });
    bustRestaurantCaches();
    return created;
  },
  updateMenuItem: async (id, data) => {
    const updated = await api.patch(`${base}/menu/${id}/`, data, { auth: true });
    bustRestaurantCaches();
    return updated;
  },
  deleteMenuItem: async (id) => {
    await api.delete(`${base}/menu/${id}/`, { auth: true });
    bustRestaurantCaches();
  },
  bookings: (status = '') => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return api.get(`${base}/bookings/${qs}`, { auth: true, noCache: true });
  },
  confirmBooking: async (id, data = {}) => {
    const updated = await api.post(`${base}/bookings/${id}/confirm/`, data, { auth: true });
    bustRestaurantCaches();
    return updated;
  },
  refuseBooking: async (id, data = {}) => {
    const updated = await api.post(`${base}/bookings/${id}/refuse/`, data, { auth: true });
    bustRestaurantCaches();
    return updated;
  },
  cancelBooking: async (id, data = {}) => {
    const updated = await api.post(`${base}/bookings/${id}/cancel/`, data, { auth: true });
    bustRestaurantCaches();
    return updated;
  },
  publicVenues: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, v);
    });
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get(`${base}/public/venues/${suffix}`, { noCache: true });
  },
  publicVenue: (id) => api.get(`${base}/public/venues/${id}/`, { noCache: true }),
  publicBook: (id, data) => api.post(`${base}/public/venues/${id}/book/`, data),
};

export function listOf(data) {
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  return [];
}

export default restaurantService;
