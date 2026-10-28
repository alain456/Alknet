import api, { invalidateApiCache } from '../shared/api';

const qs = (params = {}) => {
  const value = new URLSearchParams(
    Object.entries(params).filter(([, item]) => item !== undefined && item !== null && item !== ''),
  ).toString();
  return value ? `?${value}` : '';
};

const providerService = {
  listProviders: (params = {}) => api.get(`services/providers/${qs(params)}`),
  getProvider: (id) => api.get(`services/providers/${id}/`),
  getOffer: (id) => api.get(`services/offers/${id}/`),
  contactProvider: (id, data) => api.post(`services/providers/${id}/contact/`, data),
  contactOffer: (id, data) => api.post(`services/offers/${id}/contact/`, data),
  dashboard: () => api.get('services/me/dashboard/', { auth: true, noCache: true }),
  getProfile: () => api.get('services/me/profile/', { auth: true }),
  saveProfile: (data) => api.patch('services/me/profile/', data, { auth: true }),
  listOffers: () => api.get('services/me/offers/', { auth: true, noCache: true }),
  saveOffer: (id, data) => (
    id
      ? api.patch(`services/me/offers/${id}/`, data, { auth: true })
      : api.post('services/me/offers/', data, { auth: true })
  ).then((result) => {
    invalidateApiCache('services/providers');
    invalidateApiCache('services/offers');
    return result;
  }),
  deleteOffer: (id) => api.delete(`services/me/offers/${id}/`, { auth: true }).then((result) => {
    invalidateApiCache('services/me/offers');
    invalidateApiCache('services/providers');
    invalidateApiCache('services/offers');
    return result;
  }),
  listTeam: () => api.get('services/me/team/', { auth: true }),
  saveTeam: (id, data) => (
    id
      ? api.patch(`services/me/team/${id}/`, data, { auth: true })
      : api.post('services/me/team/', data, { auth: true })
  ),
  deleteTeam: (id) => api.delete(`services/me/team/${id}/`, { auth: true }),
  listDocuments: () => api.get('services/me/documents/', { auth: true }),
  saveDocument: (id, data) => (
    id
      ? api.patch(`services/me/documents/${id}/`, data, { auth: true })
      : api.post('services/me/documents/', data, { auth: true })
  ),
  deleteDocument: (id) => api.delete(`services/me/documents/${id}/`, { auth: true }),
  listInbox: (params = {}) => api.get(`services/me/inbox/${qs(params)}`, { auth: true, noCache: true }),
  getInboxRequest: (id) => api.get(`services/me/inbox/${id}/`, { auth: true, noCache: true }),
  replyInboxRequest: (id, data) => api.post(
    `services/me/inbox/${id}/reply/`,
    data,
    { auth: true },
  ).then((result) => {
    invalidateApiCache('services/me/inbox');
    invalidateApiCache('services/me/dashboard');
    return result;
  }),
  setRequestStatus: (id, nextStatus) => api.patch(
    `services/me/inbox/${id}/set_status/`,
    { status: nextStatus },
    { auth: true },
  ).then((data) => {
    invalidateApiCache('services/me/inbox');
    invalidateApiCache('services/me/dashboard');
    return data;
  }),
  listMyRequests: (params = {}) => api.get(`services/me/requests/${qs(params)}`, { auth: true, noCache: true }),
  getMyRequest: (id) => api.get(`services/me/requests/${id}/`, { auth: true, noCache: true }),
  replyMyRequest: (id, body) => api.post(
    `services/me/requests/${id}/messages/`,
    { body },
    { auth: true },
  ),
  getPublicRequest: (token) => api.get(`services/requests/${token}/`, { noCache: true }),
  replyPublicRequest: (token, body) => api.post(`services/requests/${token}/messages/`, { body }),
};

export default providerService;

export { REQUEST_STATUS_LABELS } from './requestUtils';

export const OFFER_STATUS_LABELS = {
  DRAFT: 'Masquée',
  ACTIVE: 'Publiée',
  SUSPENDED: 'Retirée',
};
