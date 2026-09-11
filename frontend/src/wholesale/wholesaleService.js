import api from '../shared/api';

const wholesaleService = {
  getDashboard: () => api.get('wholesale/dashboard/', { auth: true }),
  getProfile: () => api.get('wholesale/profile/', { auth: true }),
  updateProfile: (data) => api.patch('wholesale/profile/me/', data, { auth: true }),
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const isPublic = ['1', 'true'].includes(String(params.public || '').toLowerCase());
    return api.get(`wholesale/products/${qs ? `?${qs}` : ''}`, { auth: !isPublic });
  },
  createProduct: (data) => api.post('wholesale/products/', data, { auth: true }),
  updateProduct: (id, data) => api.patch(`wholesale/products/${id}/`, data, { auth: true }),
  adjustStock: (id, data) => api.post(`wholesale/products/${id}/adjust_stock/`, data, { auth: true }),
  getLowStock: () => api.get('wholesale/products/low_stock/', { auth: true }),
  getStockMovements: () => api.get('wholesale/stock-movements/', { auth: true }),
  getOrders: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`wholesale/orders/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  getOrder: (id) => api.get(`wholesale/orders/${id}/`, { auth: true }),
  acceptOrder: (id) => api.post(`wholesale/orders/${id}/accept/`, {}, { auth: true }),
  rejectOrder: (id, data) => api.post(`wholesale/orders/${id}/reject/`, data, { auth: true }),
  markOrderPaid: (id, data = {}) => api.post(`wholesale/orders/${id}/mark-paid/`, data, { auth: true }),
  markOrderUnpaid: (id) => api.post(`wholesale/orders/${id}/mark-unpaid/`, {}, { auth: true }),
  getRefusalReasons: () => api.get('wholesale/orders/refusal_reasons/', { auth: true }),
  getClients: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`wholesale/clients/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  getClient: (clientKey) => api.get(`wholesale/clients/${encodeURIComponent(clientKey)}/`, { auth: true }),
  listPharmacies: () => api.get('wholesale/pharmacies/', { auth: true }),
  getProformas: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`wholesale/proformas/${qs ? `?${qs}` : ''}`, { auth: true });
  },
  getCart: (wholesaleId) => {
    const qs = wholesaleId ? `?wholesale=${wholesaleId}` : '';
    return api.get(`wholesale/cart/${qs}`, { auth: true });
  },
  addToCart: (data) => api.post('wholesale/cart/add_item/', data, { auth: true }),
  updateCartItem: (data) => api.post('wholesale/cart/update_item/', data, { auth: true }),
  removeCartItem: (data) => api.post('wholesale/cart/remove_item/', data, { auth: true }),
  clearCart: (data) => api.post('wholesale/cart/clear/', data, { auth: true }),
  checkout: (data) => api.post('wholesale/cart/checkout/', data, { auth: true }),
  payOrder: (id, payerPhone) => api.post(`wholesale/orders/${id}/pay/`, { payer_phone: payerPhone }),
  confirmOrderPayment: (id) => api.post(`wholesale/orders/${id}/confirm-payment/`, {}),
};

export default wholesaleService;

export const ORDER_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Envoyée',
  PROCESSING: 'En cours de traitement',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  CANCELLED: 'Annulée',
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Non payée',
  AWAITING_PIN: 'PIN Lumicash',
  PAID: 'Payée',
  FAILED: 'Échec paiement',
  REFUNDED: 'Remboursée',
};

export const PROFORMA_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  PENDING_VALIDATION: 'En attente de validation',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  REJECTED: 'Refusée',
};

/** @typedef {keyof typeof PROFORMA_STATUS_LABELS} ProformaStatus */

export const STOCK_STATUS_LABELS = {
  AVAILABLE: 'Disponible',
  LOW_STOCK: 'Stock faible',
  OUT_OF_STOCK: 'Rupture',
  RESERVED: 'Réservé',
  EXPIRED: 'Expiré',
  BLOCKED: 'Bloqué',
};
