import { api, invalidateApiCache } from '../shared/api';
import { serializeListField } from './educationListFields';

/**
 * `gallery` est une liste d'URL simples, pas d'objets : elle ne passe pas par
 * `serializeListField`. Les lignes vides sont retirées pour ne pas créer
 * d'images cassées.
 */
const encodeGallery = (rows) =>
  (rows || []).map((r) => String(r || '').trim()).filter(Boolean);

/** Les champs liste JSON voyagent en JSON, pas en texte. */
const encode = (body) => ({
  ...body,
  ...(body.gallery ? { gallery: encodeGallery(body.gallery) } : {}),
  ...(body.student_services ? { student_services: serializeListField(body.student_services) } : {}),
});

const encodeProgram = (body) => ({
  ...body,
  ...(body.required_documents ? { required_documents: serializeListField(body.required_documents) } : {}),
});

const qs = (params = {}) => {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return q ? `?${q}` : '';
};

const educationService = {
  // Annuaire public — jamais `auth: true`, l'annuaire reste ouvert.
  listEstablishments: (params = {}) => api.get(`education/profiles/${qs(params)}`, { noCache: true }),
  getEstablishment: (id) => api.get(`education/profiles/${id}/`, { noCache: true }),
  // Résolution depuis l'id Business : les autres catégories sont adressées
  // ainsi, la liste générale des entreprises ne peut donc pas ouvrir Éducation.
  getEstablishmentByBusiness: (businessId) => api.get(`education/profiles/by-business/${businessId}/`, { noCache: true }),
  enums: () => api.get('education/enum-choices/'),
  publicPrograms: (id) => api.get(`education/profiles/${id}/public_programs/`),
  distanceFrom: (fromLat, fromLng, toLat, toLng) => api.get(
    `education/distance/?from_lat=${encodeURIComponent(fromLat)}&from_lng=${encodeURIComponent(fromLng)}&to_lat=${encodeURIComponent(toLat)}&to_lng=${encodeURIComponent(toLng)}`,
  ),
  listPublicPrograms: (params = {}) => api.get(`education/programs/${qs(params)}`),
  programFacets: (params = {}) => api.get(`education/programs/facets/${qs(params)}`),
  listPublicCampaigns: (params = {}) => api.get(`education/campaigns/${qs(params)}`, { noCache: true }),
  listPublicUnits: (params = {}) => api.get(`education/units/${qs(params)}`),

  // Espace établissement — toujours authentifié.
  getMyProfile: () => api.get('education/profiles/my_profile/', { auth: true, noCache: true }),
  updateMyProfile: async (body) => {
    const saved = await api.patch('education/profiles/my_profile/', encode(body), { auth: true });
    invalidateApiCache('education/profiles');
    return saved;
  },
  submitForReview: () => api.post('education/profiles/submit-for-review/', {}, { auth: true }),

  listPrograms: () => api.get('education/programs/?mine=1', { auth: true }),
  createProgram: (body) => api.post('education/programs/', encodeProgram(body), { auth: true }),
  updateProgram: (id, body) => api.patch(`education/programs/${id}/`, encodeProgram(body), { auth: true }),
  deleteProgram: (id) => api.delete(`education/programs/${id}/`, { auth: true }),

  listUnits: () => api.get('education/units/?mine=1', { auth: true }),
  createUnit: (body) => api.post('education/units/', body, { auth: true }),
  updateUnit: (id, body) => api.patch(`education/units/${id}/`, body, { auth: true }),
  deleteUnit: (id) => api.delete(`education/units/${id}/`, { auth: true }),
};

export default educationService;
