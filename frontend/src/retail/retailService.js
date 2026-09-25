import api, { getToken } from '../shared/api';

const query = (params = {}) => {
  const value = new URLSearchParams(params).toString();
  return value ? `?${value}` : '';
};

async function postForm(path, formData, { auth = false } = {}) {
  const url = path.startsWith('/api') ? path : `/api/v1/${path.replace(/^\//, '')}`;
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail || data.error || data.message || `Erreur HTTP ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}

function appendCheckoutFields(fd, data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (key === 'prescription_file' || key === 'file') return;
    if (key === 'items' && typeof value !== 'string') {
      fd.append('items', JSON.stringify(value));
      return;
    }
    fd.append(key, value);
  });
  const file = data.prescription_file || data.file;
  if (file instanceof File || file instanceof Blob) {
    fd.append('prescription_file', file, file.name || 'ordonnance');
  }
}

const retailService = {
  getDashboard: () => api.get('retail/dashboard/', { auth: true }),
  setOrdersOpen: (is_open_for_orders) =>
    api.patch('retail/profile/me/', { is_open_for_orders }, { auth: true }),
  getProfile: () => api.get('retail/profile/', { auth: true }),
  updateProfile: (data) => api.patch('retail/profile/me/', data, { auth: true }),
  getProducts: (params = {}) => api.get(`retail/products/${query(params)}`, {
    auth: !['1', 'true'].includes(String(params.public || '').toLowerCase()),
  }),
  createProduct: (data) => api.post('retail/products/', data, { auth: true }),
  updateProduct: (id, data) => api.patch(`retail/products/${id}/`, data, { auth: true }),
  deleteProduct: (id) => api.delete(`retail/products/${id}/`, { auth: true }),
  adjustStock: (id, data) => api.post(`retail/products/${id}/adjust_stock/`, data, { auth: true }),
  getLowStock: () => api.get('retail/products/low_stock/', { auth: true }),
  getStockMovements: () => api.get('retail/stock-movements/', { auth: true }),
  getOrders: (params = {}) => api.get(`retail/orders/${query(params)}`, { auth: true }),
  getOrder: (id) => api.get(`retail/orders/${id}/`, { auth: true }),
  acceptOrder: (id) => api.post(`retail/orders/${id}/accept/`, {}, { auth: true }),
  rejectOrder: (id, data) => api.post(`retail/orders/${id}/reject/`, data, { auth: true }),
  markOrderPaid: (id, data = {}) => api.post(`retail/orders/${id}/mark-paid/`, data, { auth: true }),
  markOrderUnpaid: (id) => api.post(`retail/orders/${id}/mark-unpaid/`, {}, { auth: true }),
  requestClarification: (id, comment) => api.post(
    `retail/orders/${id}/request-clarification/`, { comment }, { auth: true },
  ),
  cancelOrder: (id) => api.post(`retail/orders/${id}/cancel/`, {}, { auth: true }),
  getRefusalReasons: () => api.get('retail/orders/rejection_reasons/', { auth: true }),
  getPatients: (params = {}) => api.get(`retail/patients/${query(params)}`, { auth: true }),
  getProformas: (params = {}) => api.get(`retail/proformas/${query(params)}`, { auth: true }),
  getPrescriptions: () => api.get('retail/prescriptions/', { auth: true }),
  reviewPrescription: (id, data) => api.post(`retail/prescriptions/${id}/review/`, data, { auth: true }),
  createPrescription: (data) => {
    if (data?.prescription_file || data?.file) {
      const fd = new FormData();
      appendCheckoutFields(fd, data);
      return postForm('retail/prescriptions/', fd);
    }
    return api.post('retail/prescriptions/', data);
  },
  listPharmacies: () => api.get('retail/pharmacies/'),
  guestCheckout: (data) => {
    if (data?.prescription_file || data?.file) {
      const fd = new FormData();
      appendCheckoutFields(fd, data);
      return postForm('retail/guest-checkout/', fd);
    }
    return api.post('retail/guest-checkout/', data);
  },
  payOrder: (id, payerPhone) => api.post(`retail/orders/${id}/pay/`, { payer_phone: payerPhone }),
  confirmOrderPayment: (id) => api.post(`retail/orders/${id}/confirm-payment/`, {}),
  getCart: (pharmacy) => api.get(`retail/cart/${query(pharmacy ? { pharmacy } : {})}`, { auth: true }),
  addToCart: (data) => api.post('retail/cart/add_item/', data, { auth: true }),
  updateCartItem: (data) => api.post('retail/cart/update_item/', data, { auth: true }),
  removeCartItem: (data) => api.post('retail/cart/remove_item/', data, { auth: true }),
  clearCart: (data) => api.post('retail/cart/clear/', data, { auth: true }),
  checkout: (data) => {
    if (data?.prescription_file || data?.file) {
      const fd = new FormData();
      appendCheckoutFields(fd, data);
      return postForm('retail/cart/checkout/', fd, { auth: true });
    }
    return api.post('retail/cart/checkout/', data, { auth: true });
  },
};

export default retailService;

export const ORDER_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Envoyée',
  PROCESSING: 'En traitement',
  CLARIFICATION_REQUESTED: 'Précisions demandées',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  CANCELLED: 'Annulée',
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Non payée',
  AWAITING_PIN: 'PIN BurundiPay',
  PAID: 'Payée',
  FAILED: 'Échec paiement',
  REFUNDED: 'Remboursée',
};

export const STOCK_STATUS_LABELS = {
  AVAILABLE: 'Disponible',
  LOW_STOCK: 'Stock faible',
  OUT_OF_STOCK: 'Rupture',
  RESERVED: 'Réservé',
  EXPIRED: 'Expiré',
  BLOCKED: 'Bloqué',
};

export const PROFORMA_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  PENDING_VALIDATION: 'En attente de validation',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  REJECTED: 'Refusée',
};
