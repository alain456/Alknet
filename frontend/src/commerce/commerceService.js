import { api } from '../shared/api';

const CART_SESSION_KEY = 'isoko_commerce_cart_session';

export function getCartSession() {
  let key = localStorage.getItem(CART_SESSION_KEY);
  if (!key) {
    key = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(CART_SESSION_KEY, key);
  }
  return key;
}

const cartHeaders = () => ({ 'X-Cart-Session': getCartSession() });

const commerceService = {
  getDashboard: () => api.get('orders/commerce/dashboard/', { auth: true }),
  getShopStatus: () => api.get('orders/commerce/shop-status/', { auth: true }),
  setShopOpen: (is_open_for_orders) =>
    api.patch('orders/commerce/shop-status/', { is_open_for_orders }, { auth: true }),

  listProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`products/my-business/${q ? `?${q}` : ''}`, { auth: true });
  },

  publicProducts: (businessId, params = {}) => {
    const q = new URLSearchParams({ business: businessId, ...params }).toString();
    return api.get(`products/?${q}`);
  },

  createProduct: (body) => api.post('products/my-business/', body, { auth: true }),
  updateProduct: (id, body) => api.patch(`products/my-business/${id}/`, body, { auth: true }),
  deleteProduct: (id) => api.delete(`products/my-business/${id}/`, { auth: true }),

  listShopCategories: () => api.get('products/shop-categories/', { auth: true }),
  createShopCategory: (body) => api.post('products/shop-categories/', body, { auth: true }),

  listStockMovements: () => api.get('products/stock-movements/', { auth: true }),
  createStockMovement: (body) => api.post('products/stock-movements/', body, { auth: true }),

  listOrders: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`orders/${q ? `?${q}` : ''}`, { auth: true });
  },
  confirmOrder: (id) => api.post(`orders/${id}/confirm/`, {}, { auth: true }),
  rejectOrder: (id, reason) => api.post(`orders/${id}/reject/`, { reason }, { auth: true }),
  markReady: (id) => api.post(`orders/${id}/mark-ready/`, {}, { auth: true }),
  markCompleted: (id) => api.post(`orders/${id}/mark-completed/`, {}, { auth: true }),
  confirmPaymentManual: (id) => api.post(`orders/${id}/confirm-payment-manual/`, {}, { auth: true }),

  getCart: (businessId) =>
    api.get(`orders/commerce/${businessId}/cart/`, { headers: cartHeaders() }),
  addToCart: (businessId, body) =>
    api.post(`orders/commerce/${businessId}/cart/`, body, { headers: cartHeaders() }),
  removeCartItem: (businessId, itemId) =>
    api.delete(`orders/commerce/${businessId}/cart/?item=${itemId}`, { headers: cartHeaders() }),
  clearCart: (businessId) =>
    api.delete(`orders/commerce/${businessId}/cart/`, { headers: cartHeaders() }),
  checkout: (businessId, body) =>
    api.post(`orders/commerce/${businessId}/checkout/`, body, { headers: cartHeaders() }),

  /**
   * Parcours invité façon pharmacie : panier local → sync serveur → checkout.
   * body.items: [{ product, quantity }]
   */
  guestCheckout: async (businessId, body) => {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) throw new Error('Panier vide.');
    await api.delete(`orders/commerce/${businessId}/cart/`, { headers: cartHeaders() });
    for (const line of items) {
      await api.post(
        `orders/commerce/${businessId}/cart/`,
        { product: line.product || line.product_id, quantity: Number(line.quantity) || 1 },
        { headers: cartHeaders() },
      );
    }
    const { items: _omit, ...checkoutBody } = body;
    return api.post(`orders/commerce/${businessId}/checkout/`, checkoutBody, { headers: cartHeaders() });
  },

  payOrder: (orderId, payer_phone) =>
    api.post(`orders/${orderId}/pay/`, { payer_phone }),
  confirmPayment: (orderId) =>
    api.post(`orders/${orderId}/confirm-payment/`, {}),
};

export const ORDER_STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  READY: 'Prête au retrait',
  COMPLETED: 'Retirée',
  CANCELLED: 'Annulée',
  REJECTED: 'Refusée',
};

export const PAYMENT_STATUS_LABELS = {
  UNPAID: 'Non payée',
  AWAITING_PIN: 'PIN Lumicash',
  PAID: 'Payée',
  FAILED: 'Échec',
  REFUNDED: 'Remboursée',
};

export default commerceService;
