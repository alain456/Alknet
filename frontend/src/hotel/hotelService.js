import api from '../shared/api';

const base = 'hotel';

const hotelService = {
  dashboard: () => api.get(`${base}/dashboard/`, { auth: true, noCache: true }),
  profile: () => api.get(`${base}/profile/me/`, { auth: true }),
  updateProfile: (data) => api.patch(`${base}/profile/me/`, data, { auth: true }),
  seedRoles: () => api.post(`${base}/profile/seed-roles/`, {}, { auth: true }),

  roomTypes: () => api.get(`${base}/room-types/`, { auth: true }),
  createRoomType: (data) => api.post(`${base}/room-types/`, data, { auth: true }),
  updateRoomType: (id, data) => api.patch(`${base}/room-types/${id}/`, data, { auth: true }),
  deleteRoomType: (id) => api.delete(`${base}/room-types/${id}/`, { auth: true }),

  rooms: () => api.get(`${base}/rooms/`, { auth: true }),
  createRoom: (data) => api.post(`${base}/rooms/`, data, { auth: true }),
  updateRoom: (id, data) => api.patch(`${base}/rooms/${id}/`, data, { auth: true }),
  deleteRoom: (id) => api.delete(`${base}/rooms/${id}/`, { auth: true }),
  markRoomReady: (id) => api.post(`${base}/rooms/${id}/mark-ready/`, {}, { auth: true }),

  rates: () => api.get(`${base}/rates/`, { auth: true }),
  createRate: (data) => api.post(`${base}/rates/`, data, { auth: true }),
  updateRate: (id, data) => api.patch(`${base}/rates/${id}/`, data, { auth: true }),
  deleteRate: (id) => api.delete(`${base}/rates/${id}/`, { auth: true }),

  guests: (q = '') => api.get(`${base}/guests/${q ? `?q=${encodeURIComponent(q)}` : ''}`, { auth: true }),
  createGuest: (data) => api.post(`${base}/guests/`, data, { auth: true }),
  updateGuest: (id, data) => api.patch(`${base}/guests/${id}/`, data, { auth: true }),

  reservations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`${base}/reservations/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  createReservation: (data) => api.post(`${base}/reservations/`, data, { auth: true }),
  updateReservation: (id, data) => api.patch(`${base}/reservations/${id}/`, data, { auth: true }),
  confirmReservation: (id) => api.post(`${base}/reservations/${id}/confirm/`, {}, { auth: true }),
  cancelReservation: (id, data = {}) => api.post(`${base}/reservations/${id}/cancel/`, data, { auth: true }),
  refundReservation: (id, data = {}) => api.post(`${base}/reservations/${id}/refund/`, data, { auth: true }),
  markNoShow: (id, data = {}) => api.post(`${base}/reservations/${id}/no-show/`, data, { auth: true }),
  checkIn: (id, room_id) => api.post(`${base}/reservations/${id}/check-in/`, { room_id }, { auth: true }),
  walkIn: (data) => api.post(`${base}/reservations/walk-in/`, data, { auth: true }),

  availability: ({ room_type, check_in, check_out }) =>
    api.get(
      `${base}/availability/?room_type=${room_type}&check_in=${check_in}&check_out=${check_out}`,
      { auth: true },
    ),

  stays: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`${base}/stays/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  addService: (stayId, service_id, quantity = 1) =>
    api.post(`${base}/stays/${stayId}/add-service/`, { service_id, quantity }, { auth: true }),
  changeRoom: (stayId, room_id) =>
    api.post(`${base}/stays/${stayId}/change-room/`, { room_id }, { auth: true }),
  checkOut: (stayId, allow_balance = false) =>
    api.post(`${base}/stays/${stayId}/check-out/`, { allow_balance }, { auth: true }),

  services: () => api.get(`${base}/services/`, { auth: true }),
  createService: (data) => api.post(`${base}/services/`, data, { auth: true }),
  updateService: (id, data) => api.patch(`${base}/services/${id}/`, data, { auth: true }),
  deleteService: (id) => api.delete(`${base}/services/${id}/`, { auth: true }),

  folios: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return api.get(`${base}/folios/${q ? `?${q}` : ''}`, { auth: true });
  },
  payments: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return api.get(`${base}/payments/${q ? `?${q}` : ''}`, { auth: true });
  },
  createPayment: (data) => api.post(`${base}/payments/`, data, { auth: true }),
  paymentReceipt: (id) => api.get(`${base}/payments/${id}/receipt/`, { auth: true }),
  folioPayBurundiPay: (id, data) =>
    api.post(`${base}/folios/${id}/pay-burundipay/`, data, { auth: true }),
  folioConfirmBurundiPay: (id, data = {}) =>
    api.post(`${base}/folios/${id}/confirm-burundipay/`, data, { auth: true }),
  invoices: () => api.get(`${base}/invoices/`, { auth: true }),
  cashierDashboard: () => api.get(`${base}/cashier-dashboard/`, { auth: true }),

  housekeeping: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`${base}/housekeeping/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  createHkTask: (data) => api.post(`${base}/housekeeping/`, data, { auth: true }),
  startHk: (id) => api.post(`${base}/housekeeping/${id}/start/`, {}, { auth: true }),
  completeHk: (id, data = {}) => api.post(`${base}/housekeeping/${id}/complete/`, data, { auth: true }),

  maintenance: () => api.get(`${base}/maintenance/`, { auth: true }),
  createTicket: (data) => api.post(`${base}/maintenance/`, data, { auth: true }),
  resolveTicket: (id, data = {}) => api.post(`${base}/maintenance/${id}/resolve/`, data, { auth: true }),

  audit: () => api.get(`${base}/audit/`, { auth: true }),
  cashClosings: () => api.get(`${base}/cash-closings/`, { auth: true }),
  closeCash: (data) => api.post(`${base}/cash-closings/`, data, { auth: true }),

  staffDirectory: () => api.get(`${base}/staff-directory/`, { auth: true }),
  assignHk: (id, assigned_to) => api.post(`${base}/housekeeping/${id}/assign/`, { assigned_to }, { auth: true }),
  reportHkIssue: (id, data) => api.post(`${base}/housekeeping/${id}/report-issue/`, data, { auth: true }),

  calendar: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return api.get(`${base}/calendar/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  reports: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return api.get(`${base}/reports/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  reportsCsvUrl: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries({ ...params, export: 'csv' }).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return `/api/v1/hotel/reports/?${qs}`;
  },

  platformHotels: () => api.get(`${base}/platform/hotels/`, { auth: true }),
  platformHotelStatus: (id, status) => api.post(`${base}/platform/hotels/${id}/status/`, { status }, { auth: true }),
  platformHotelVerifyClassification: (id, data = {}) =>
    api.post(`${base}/platform/hotels/${id}/verify-classification/`, data, { auth: true }),

  publicHotels: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return api.get(`${base}/public/hotels/${qs ? `?${qs}` : ''}`);
  },
  publicHotel: (id) => api.get(`${base}/public/hotels/${id}/`),
  publicAvailability: (id, params) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`${base}/public/hotels/${id}/availability/?${qs}`);
  },
  publicBook: (id, data, { auth = false } = {}) =>
    api.post(`${base}/public/hotels/${id}/book/`, data, { auth }),
  publicPayReservation: (id, payerPhone, { auth = false } = {}) =>
    api.post(`${base}/public/reservations/${id}/pay/`, { payer_phone: payerPhone }, { auth }),
  publicConfirmReservationPayment: (id, { auth = false } = {}) =>
    api.post(`${base}/public/reservations/${id}/confirm-payment/`, {}, { auth }),
  payReservation: (id, payerPhone) =>
    api.post(`${base}/reservations/${id}/pay/`, { payer_phone: payerPhone }, { auth: true }),
  confirmReservationPayment: (id) =>
    api.post(`${base}/reservations/${id}/confirm-payment/`, {}, { auth: true }),
  markReservationPaid: (id, data = {}) =>
    api.post(`${base}/reservations/${id}/mark-paid/`, data, { auth: true }),
  myReservations: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') q.set(k, v);
    });
    const qs = q.toString();
    return api.get(`${base}/public/my-reservations/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  sendReservationMessage: (id, message) =>
    api.post(`${base}/public/reservations/${id}/message/`, { message }, { auth: true }),
  replyReservationMessage: (id, message) =>
    api.post(`${base}/reservations/${id}/reply/`, { message }, { auth: true }),
  requestReschedule: (id, data) =>
    api.post(`${base}/public/reservations/${id}/request-reschedule/`, data, { auth: true }),
  respondReschedule: (id, data) =>
    api.post(`${base}/reservations/${id}/respond-reschedule/`, data, { auth: true }),
};

export const listOf = (data) => (Array.isArray(data) ? data : (data?.results || []));

export default hotelService;
