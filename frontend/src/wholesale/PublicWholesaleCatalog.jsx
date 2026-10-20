import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Search, ShoppingCart, X, Minus, Plus, Pill, Trash2, History,
} from 'lucide-react';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import OrderPaymentSuccess from '../shared/components/OrderPaymentSuccess';
import { PROFORMA_STATUS_LABELS } from './wholesaleService';
import wholesaleService from './wholesaleService';
import api from '../shared/api';

const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;
const cartKey = (id) => `isoko_wholesale_cart_${id}`;

function loadLocalCart(id) {
  try { return JSON.parse(localStorage.getItem(cartKey(id)) || '[]'); } catch { return []; }
}
function saveLocalCart(id, items) {
  localStorage.setItem(cartKey(id), JSON.stringify(items));
}

function stockMeta(p) {
  const status = p.stock_status || '';
  const avail = (p.availability || '').toLowerCase();
  if (status === 'OUT_OF_STOCK' || avail === 'rupture' || (p.quantity_available != null && p.quantity_available <= 0)) {
    return { key: 'out', label: 'Rupture' };
  }
  if (status === 'LOW_STOCK' || avail.includes('faible')) return { key: 'low', label: 'Stock faible' };
  return { key: 'in', label: 'Disponible' };
}

function todayFr() {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Fusionne les doublons éventuels d'un même produit. */
function normalizeCart(items) {
  const map = new Map();
  for (const item of items || []) {
    const existing = map.get(item.product_id);
    if (existing) {
      existing.quantity += Number(item.quantity) || 0;
    } else {
      map.set(item.product_id, { ...item, quantity: Number(item.quantity) || 0 });
    }
  }
  return Array.from(map.values());
}

export default function PublicWholesaleCatalog() {
  const { id } = useParams();
  const [pharmacy, setPharmacy] = useState(null);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [formFilter, setFormFilter] = useState('ALL');
  const [mfrFilter, setMfrFilter] = useState('ALL');
  const [availFilter, setAvailFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [cart, setCart] = useState(() => normalizeCart(loadLocalCart(id)));
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [payerBurundiPay, setPayerBurundiPay] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    setCart(normalizeCart(loadLocalCart(id)));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`businesses/${id}/`).catch(() => null),
      api.get(`wholesale/products/?wholesale=${id}&public=true`).catch(() => []),
    ])
      .then(([business, prods]) => {
        if (business) {
          setPharmacy({
            id: business.id,
            name: business.name,
            commune: business.commune,
            phone: business.phone,
            logo: business.logo,
          });
        }
        setProducts(Array.isArray(prods) ? prods : prods?.results || []);
      })
      .catch((e) => setError(e.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [id]);

  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const key = (p.therapeutic_class || 'Autres').trim() || 'Autres';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [products]);

  const forms = useMemo(() => {
    const set = new Set();
    products.forEach((p) => { if (p.pharmaceutical_form) set.add(p.pharmaceutical_form); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [products]);

  const manufacturers = useMemo(() => {
    const set = new Set();
    products.forEach((p) => { if (p.manufacturer) set.add(p.manufacturer); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (p.status && p.status !== 'ACTIVE') return false;
      const hay = `${p.name} ${p.active_ingredient} ${p.therapeutic_class} ${p.manufacturer}`.toLowerCase();
      const matchQ = !q || hay.includes(q.toLowerCase());
      const matchCat = categoryFilter === 'ALL' || (p.therapeutic_class || 'Autres') === categoryFilter;
      const matchForm = formFilter === 'ALL' || p.pharmaceutical_form === formFilter;
      const matchMfr = mfrFilter === 'ALL' || p.manufacturer === mfrFilter;
      const stock = stockMeta(p);
      const matchAvail = availFilter === 'ALL'
        || (availFilter === 'in' && stock.key === 'in')
        || (availFilter === 'low' && stock.key === 'low')
        || (availFilter === 'out' && stock.key === 'out');
      return matchQ && matchCat && matchForm && matchMfr && matchAvail;
    });
    if (sortBy === 'price') list = [...list].sort((a, b) => Number(a.wholesale_price) - Number(b.wholesale_price));
    else if (sortBy === 'stock') {
      const rank = { in: 0, low: 1, out: 2 };
      list = [...list].sort((a, b) => rank[stockMeta(a).key] - rank[stockMeta(b).key]);
    } else list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    return list;
  }, [products, q, categoryFilter, formFilter, mfrFilter, availFilter, sortBy]);

  const lines = useMemo(() => cart.map((item) => {
    const p = products.find((x) => x.id === item.product_id) || item.product || {};
    const unit = Number(item.unit_price_snapshot ?? p.wholesale_price ?? 0);
    const stock = stockMeta(p);
    let validation_error = null;
    if (p.status && p.status !== 'ACTIVE') validation_error = 'Produit inactif';
    else if (stock.key === 'out') validation_error = 'Produit en rupture';
    else if (item.quantity < (p.min_order_quantity || 1)) validation_error = `Minimum : ${p.min_order_quantity || 1}`;
    else if (p.quantity_available != null && item.quantity > p.quantity_available) {
      validation_error = `Stock insuffisant (dispo: ${p.quantity_available})`;
    }
    return {
      product_id: item.product_id,
      name: item.product_name_snapshot || p.name,
      active_ingredient: p.active_ingredient,
      packaging: item.packaging_snapshot || p.packaging,
      wholesale_unit: p.wholesale_unit,
      unit_price: unit,
      quantity: item.quantity,
      line_total: unit * item.quantity,
      availability: stock.label,
      validation_error,
      min_order_quantity: p.min_order_quantity || 1,
      image_url: p.image_url,
      currency: p.currency || 'BIF',
    };
  }), [cart, products]);

  const cartCount = lines.reduce((s, i) => s + i.quantity, 0);
  const subtotal = lines.reduce((s, i) => s + i.line_total, 0);
  const hasErrors = lines.some((l) => l.validation_error);

  const persist = (updater) => {
    setCart((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocalCart(id, next);
      return next;
    });
  };

  const addToCart = (product, quantity = 1) => {
    setError('');
    if (stockMeta(product).key === 'out') {
      setError('Produit en rupture');
      return;
    }
    // 1 clic = +1 conditionnement (boîte/carton…), jamais le contenu "20 comprimés"
    const addQty = Math.max(1, Number(quantity) || 1);
    const available = product.quantity_available;

    persist((prev) => {
      const next = normalizeCart(prev);
      const idx = next.findIndex((i) => i.product_id === product.id);
      if (idx >= 0) {
        let qty = next[idx].quantity + addQty;
        if (available != null && available >= 0) qty = Math.min(qty, available);
        next[idx] = {
          ...next[idx],
          quantity: qty,
          product,
          product_name_snapshot: product.name,
          packaging_snapshot: product.packaging,
          unit_price_snapshot: next[idx].unit_price_snapshot ?? product.wholesale_price,
        };
      } else {
        let qty = addQty;
        if (available != null && available >= 0) qty = Math.min(qty, Math.max(available, 1));
        next.push({
          product_id: product.id,
          quantity: qty,
          product,
          product_name_snapshot: product.name,
          packaging_snapshot: product.packaging,
          unit_price_snapshot: product.wholesale_price,
        });
      }
      return next;
    });
    setMessage(`${product.name} ajouté au panier`);
    setSelected(null);
  };

  const updateQty = (productId, quantity) => {
    const qn = Number(quantity);
    persist((prev) => {
      const next = normalizeCart(prev);
      if (qn <= 0) return next.filter((i) => i.product_id !== productId);
      return next.map((i) => {
        if (i.product_id !== productId) return i;
        const p = products.find((x) => x.id === productId) || i.product || {};
        let qty = qn;
        if (p.quantity_available != null && p.quantity_available >= 0) {
          qty = Math.min(qty, p.quantity_available);
        }
        return { ...i, quantity: Math.max(qty, 1) };
      });
    });
  };

  const removeLine = (productId) => {
    persist((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const doClear = () => {
    persist([]);
    setClearOpen(false);
  };

  const openSend = () => {
    setError('');
    if (hasErrors || !lines.length) {
      setError('Corrigez les erreurs du panier avant l\'envoi.');
      return;
    }
    setConfirmChecked(false);
    setPayerBurundiPay('');
    setConfirmOpen(true);
  };

  const sendOrder = async () => {
    if (!confirmChecked) return;
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setError('Nom de la pharmacie et email professionnels requis.');
      return;
    }
    if (!payerBurundiPay.trim()) {
      setError('Indiquez votre numéro BurundiPay pour le paiement.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const order = await api.post('wholesale/guest-checkout/', {
        wholesale_id: id,
        buyer_type: 'RETAIL_PHARMACY',
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        buyer_phone: buyerPhone.trim(),
        payment_method: 'BURUNDIPAY',
        payer_phone: payerBurundiPay.trim(),
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      persist([]);
      setConfirmOpen(false);
      setCartOpen(false);
      setPayerBurundiPay('');
      setSuccess(order);
    } catch (e) {
      setError(e.message || 'Échec envoi commande');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center text-ink-muted bg-surface">Chargement du catalogue...</div>;
  }

  if (success) {
    return (
      <OrderPaymentSuccess
        order={success}
        onOrderUpdate={setSuccess}
        onDone={() => setSuccess(null)}
        confirmPayment={(id, token) => wholesaleService.confirmOrderPayment(id, token)}
        retryPayment={(id, phone, token) => wholesaleService.payOrder(id, phone, token)}
        paidHint="Paiement validé. Le grossiste pourra accepter votre commande ; vous pourrez ensuite récupérer les produits."
      />
    );
  }

  const chip = (active) => `shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold ${active ? 'bg-accent text-ink' : 'bg-surface text-ink'}`;

  return (
    <div className="min-h-screen bg-surface text-ink pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="search-panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/businesses" className="w-10 h-10 rounded-full bg-white ring-1 ring-border text-ink flex items-center justify-center shrink-0" title="Retour">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-white ring-1 ring-border flex items-center justify-center overflow-hidden shrink-0">
              {pharmacy?.logo ? (
                <img src={pharmacy.logo} alt="" className="w-full h-full object-contain p-1" />
              ) : (
                <Pill className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted">Vente en gros</p>
              <p className="font-extrabold text-lg text-ink truncate">{pharmacy?.name || 'Grossiste'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/businesses/${id}/historique`}
              className="bg-white ring-1 ring-border text-ink text-sm font-bold px-4 py-2.5 rounded-full inline-flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Historique
            </Link>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="bg-accent text-ink text-sm font-bold px-4 py-2.5 rounded-full inline-flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Panier · {cartCount}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-full bg-surface px-4 py-2.5">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, principe actif…"
            className="w-full border-none bg-transparent outline-none text-sm text-ink shadow-none focus:border-none focus:outline-none"
          />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setCategoryFilter('ALL')} className={chip(categoryFilter === 'ALL')}>
            Tous · {products.length}
          </button>
          {categories.map(([name, count]) => (
            <button key={name} type="button" onClick={() => setCategoryFilter(name)} className={chip(categoryFilter === name)}>
              {name} · {count}
            </button>
          ))}
        </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <select value={formFilter} onChange={(e) => setFormFilter(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-white ring-1 ring-border text-ink">
            <option value="ALL">Toutes les formes</option>
            {forms.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={mfrFilter} onChange={(e) => setMfrFilter(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-white ring-1 ring-border text-ink">
            <option value="ALL">Tous fabricants</option>
            {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-white ring-1 ring-border text-ink">
            <option value="ALL">Toute disponibilité</option>
            <option value="in">Disponible</option>
            <option value="low">Stock faible</option>
            <option value="out">Rupture</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-sm px-3 py-2 rounded-xl bg-white ring-1 ring-border text-ink">
            <option value="name">Nom</option>
            <option value="price">Prix croissant</option>
            <option value="stock">Disponibilité</option>
          </select>
        </div>

        {message && <div className="mt-4 p-3 bg-white ring-1 ring-border text-ink rounded-xl text-sm">{message}</div>}
        {error && !confirmOpen && <div className="mt-4 p-3 bg-white ring-1 ring-alert text-alert rounded-xl text-sm">{error}</div>}

        <div className="mt-8 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-extrabold text-ink">Médicaments</h2>
          <p className="text-sm text-ink-muted">{filtered.length} produit{filtered.length > 1 ? 's' : ''}</p>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const stock = stockMeta(p);
            const available = stock.key !== 'out';
            return (
              <article key={p.id} className="rounded-3xl bg-white overflow-hidden flex flex-col">
                <button type="button" onClick={() => { setSelected(p); setQty(p.min_order_quantity || 1); }} className="h-64 sm:h-72 w-full bg-[#FFFFFF] flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover object-center" />
                  ) : (
                    <Pill className="w-16 h-16 text-primary/40" />
                  )}
                </button>
                <div className="p-4 flex flex-col gap-1 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {p.therapeutic_class || p.manufacturer || 'Médicament'}
                  </span>
                  <button type="button" onClick={() => { setSelected(p); setQty(p.min_order_quantity || 1); }} className="text-left font-semibold text-ink leading-snug">
                    {p.name}
                  </button>
                  <p className="text-xs text-ink-muted line-clamp-2">
                    {[p.packaging || p.wholesale_unit, p.min_order_quantity ? `Minimum ${p.min_order_quantity}` : ''].filter(Boolean).join(' · ') || 'Conditionnement non indiqué'}
                  </p>
                  <p className="text-sm font-semibold text-primary">{money(p.wholesale_price, p.currency)}</p>
                  <p className={`text-xs font-semibold ${stock.key === 'out' ? 'text-alert' : 'text-primary'}`}>{stock.label}</p>
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => addToCart(p, p.min_order_quantity || 1)}
                    className={`mt-2 w-full rounded-full py-2 text-sm font-semibold ${available ? 'bg-accent text-ink' : 'bg-surface text-alert'}`}
                  >
                    {available ? 'Ajouter au panier' : 'Rupture de stock'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {filtered.length === 0 && <p className="text-center text-ink-muted py-16">Aucun médicament trouvé.</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="grid sm:grid-cols-2">
              <div className="bg-surface min-h-[220px] flex items-center justify-center overflow-hidden p-6">
                {selected.image_url ? <img src={selected.image_url} alt="" className="max-h-64 max-w-full object-contain" /> : <Pill className="w-16 h-16 text-primary" />}
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between gap-2">
                  <h3 className="text-xl font-extrabold text-ink">{selected.name}</h3>
                  <button type="button" onClick={() => setSelected(null)}><X className="w-5 h-5 text-ink-faint" /></button>
                </div>
                <div className="text-sm text-ink-muted space-y-1">
                  <p>DCI : {selected.active_ingredient || '—'}</p>
                  <p>Conditionnement : {selected.packaging}</p>
                  <p>Unité de vente : {selected.wholesale_unit || '—'}</p>
                  <p>Minimum : {selected.min_order_quantity || 1}</p>
                  <p>Disponibilité : {stockMeta(selected).label}</p>
                </div>
                <p className="text-lg font-mono font-bold text-primary">{money(selected.wholesale_price, selected.currency)}</p>
                <div className="flex items-center gap-2">
                  <button type="button" className="icon-btn" onClick={() => setQty(Math.max(selected.min_order_quantity || 1, Number(qty) - 1))}><Minus className="w-4 h-4" /></button>
                  <input type="number" min={selected.min_order_quantity || 1} value={qty} onChange={(e) => setQty(e.target.value)} className="w-16 border rounded-lg px-2 py-2 text-center" />
                  <button type="button" className="icon-btn" onClick={() => setQty(Number(qty) + 1)}><Plus className="w-4 h-4" /></button>
                </div>
                <button
                  type="button"
                  disabled={stockMeta(selected).key === 'out'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addToCart(selected, Number(qty) || 1);
                  }}
                  className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg disabled:opacity-40"
                >
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex justify-end" onClick={() => setCartOpen(false)}>
          <div
            className="bg-white w-full max-w-md h-full shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-ink">Mon panier</h3>
                  <span className="min-w-6 h-6 px-1.5 rounded-full bg-accent text-ink text-xs font-bold inline-flex items-center justify-center">
                    {cartCount}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">{pharmacy?.name || 'Pharmacie de gros'}</p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="w-9 h-9 rounded-full bg-white border border-border text-ink flex items-center justify-center"
                aria-label="Fermer le panier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {lines.length === 0 && (
                <div className="text-center py-16 space-y-3">
                  <ShoppingCart className="w-10 h-10 text-ink-muted mx-auto" />
                  <p className="text-ink font-semibold">Votre panier est vide.</p>
                  <p className="text-sm text-ink-muted">0 BIF</p>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="px-4 py-2 bg-white border border-border text-ink rounded-full text-sm font-bold"
                  >
                    Retourner au catalogue
                  </button>
                </div>
              )}

              <div className="divide-y divide-border">
                {lines.map((line) => (
                  <div key={line.product_id} className="py-4 flex gap-3">
                    <div className="w-20 h-20 rounded-2xl bg-surface overflow-hidden shrink-0 flex items-center justify-center">
                      {line.image_url ? (
                        <img src={line.image_url} alt="" className="w-full h-full object-contain p-2" />
                      ) : (
                        <Pill className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-sm text-ink leading-snug">{line.name}</p>
                        <p className="text-sm font-bold text-ink shrink-0">{money(line.unit_price, line.currency)}</p>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {[
                          line.active_ingredient && `DCI : ${line.active_ingredient}`,
                          line.packaging || line.wholesale_unit,
                          `Minimum ${line.min_order_quantity || 1}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      {line.validation_error ? (
                        <p className="text-xs text-alert mt-1">{line.validation_error}</p>
                      ) : (
                        <p className="text-xs text-ink-muted mt-1">{line.availability}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-full ring-1 ring-border">
                          <button type="button" className="w-8 h-8 text-ink" onClick={() => updateQty(line.product_id, line.quantity - 1)} aria-label="Diminuer">
                            <Minus className="w-3 h-3 mx-auto" />
                          </button>
                          <input
                            type="number"
                            min={line.min_order_quantity || 1}
                            className="w-10 bg-transparent text-center text-sm font-bold text-ink outline-none"
                            value={line.quantity}
                            onChange={(e) => updateQty(line.product_id, e.target.value)}
                          />
                          <button type="button" className="w-8 h-8 text-ink" onClick={() => updateQty(line.product_id, line.quantity + 1)} aria-label="Augmenter">
                            <Plus className="w-3 h-3 mx-auto" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink">{money(line.line_total)}</span>
                          <button type="button" onClick={() => removeLine(line.product_id)} className="text-ink-muted p-1" title="Supprimer" aria-label="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {lines.length > 0 && showProforma && (
                <div className="mt-2 rounded-2xl bg-surface ring-1 ring-border p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-ink-muted">Facture proforma</p>
                      <p className="font-bold text-ink">Facture</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white ring-1 ring-border text-ink">
                      {PROFORMA_STATUS_LABELS.DRAFT}
                    </span>
                  </div>
                  <dl className="text-xs space-y-1 text-ink-muted">
                    <div className="flex justify-between gap-2"><dt>Pharmacie de gros</dt><dd className="font-medium text-ink text-right">{pharmacy?.name}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Date</dt><dd className="text-ink">{todayFr()}</dd></div>
                  </dl>
                  <table className="w-full text-[11px] text-ink">
                    <thead>
                      <tr className="text-left text-ink-muted border-b border-border">
                        <th className="py-1 font-medium">Produit</th>
                        <th className="py-1 text-right font-medium">Qté</th>
                        <th className="py-1 text-right font-medium">Prix</th>
                        <th className="py-1 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.product_id} className="border-b border-border">
                          <td className="py-1.5 pr-1">{l.name}</td>
                          <td className="py-1.5 text-right">{l.quantity}</td>
                          <td className="py-1.5 text-right">{money(l.unit_price)}</td>
                          <td className="py-1.5 text-right font-medium">{money(l.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between text-sm text-ink">
                    <span>Sous-total</span>
                    <span>{money(subtotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border bg-white space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-ink-muted">Total</span>
                <span className="text-xl font-extrabold text-ink">{money(subtotal)}</span>
              </div>
              {lines.length > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <button type="button" onClick={() => setShowProforma((v) => !v)} className="font-semibold text-ink underline underline-offset-2">
                      {showProforma ? 'Masquer la facture' : 'Voir la facture'}
                    </button>
                    <button type="button" onClick={() => setClearOpen(true)} className="font-semibold text-alert">
                      Vider le panier
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={hasErrors}
                    onClick={openSend}
                    className="w-full py-3 bg-accent text-ink font-bold rounded-full disabled:opacity-40"
                  >
                    Envoyer la commande
                  </button>
                  {hasErrors && (
                    <p className="text-xs text-alert">Corrigez les lignes en erreur avant l&apos;envoi.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {clearOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">Vider le panier ?</h3>
            <p className="text-sm text-slate-600">
              Tous les produits sélectionnés seront supprimés. Le total repassera à 0 BIF.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setClearOpen(false)} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button type="button" onClick={doClear} className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold">
                Vider le panier
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-lg space-y-4 my-8 border-2 border-accent shadow-md text-ink">
            <h3 className="font-extrabold text-lg text-ink">Confirmer l&apos;envoi de la commande</h3>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-ink-muted">Pharmacie de gros</dt><dd className="font-medium">{pharmacy?.name}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Total</dt><dd className="font-bold">{money(subtotal)}</dd></div>
            </dl>
            <ul className="text-sm border-2 border-accent rounded-xl divide-y max-h-40 overflow-y-auto">
              {lines.map((l) => (
                <li key={l.product_id} className="px-3 py-2 flex justify-between gap-2">
                  <span>
                    {l.name} × {l.quantity}
                    <span className="block text-xs text-ink-muted">{l.packaging} · {money(l.unit_price)}</span>
                  </span>
                  <span className="font-medium">{money(l.line_total)}</span>
                </li>
              ))}
            </ul>
            <label className="text-xs font-bold text-ink block space-y-1">
              <span>Nom de la pharmacie de détail *</span>
              <input required className="w-full border-2 border-accent rounded-xl px-3 py-2 bg-surface text-ink outline-none focus:border-alert" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Pharmacie Sainte-Marie" />
            </label>
            <label className="text-xs font-bold text-ink block space-y-1">
              <span>Email professionnel *</span>
              <input type="email" required className="w-full border-2 border-accent rounded-xl px-3 py-2 bg-surface text-ink outline-none focus:border-alert" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-ink block space-y-1">
              <span>Téléphone professionnel</span>
              <input className="w-full border-2 border-accent rounded-xl px-3 py-2 bg-surface text-ink outline-none focus:border-alert" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} />
            </label>
            <BurundiPayPayerField
              value={payerBurundiPay}
              onChange={setPayerBurundiPay}
              amountLabel={money(subtotal)}
            />
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
              <span>J&apos;ai vérifié les produits, les quantités et le montant total.</span>
            </label>
            {error && <p className="text-sm text-alert font-medium">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="px-4 py-2 border-2 border-border rounded-xl font-semibold">Annuler</button>
              <button type="button" disabled={!confirmChecked || busy} onClick={sendOrder} className="px-4 py-2 bg-primary text-surface rounded-xl font-bold border-2 border-accent disabled:opacity-50">
                {busy ? 'Envoi…' : 'Confirmer et envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
