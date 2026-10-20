import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Search, ShoppingCart, X, Minus, Plus, Package, Trash2, History, ChevronLeft, ChevronRight,
  Phone, Mail, MapPin, Clock, Store,
} from 'lucide-react';
import api from '../shared/api';
import { websiteHref } from '../shared/websiteUrl';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import OrderPaymentSuccess from '../shared/components/OrderPaymentSuccess';
import commerceService from './commerceService';

const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;
const cartKey = (id) => `isoko_commerce_cart_${id}`;

function loadLocalCart(id) {
  try { return JSON.parse(localStorage.getItem(cartKey(id)) || '[]'); } catch { return []; }
}
function saveLocalCart(id, items) {
  localStorage.setItem(cartKey(id), JSON.stringify(items));
}

function stockMeta(p) {
  const available = Number(p.stock_available ?? p.stock ?? 0);
  const threshold = Number(p.low_stock_threshold ?? 5);
  if (available <= 0 || p.is_active === false) return { key: 'out', label: 'Rupture' };
  if (available <= threshold) return { key: 'low', label: 'Stock faible' };
  return { key: 'in', label: 'Disponible' };
}

function todayFr() {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function productImage(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls[0]) return p.image_urls[0];
  return p?.image_url || '';
}

function productPrice(p) {
  return Number(p?.effective_price ?? p?.price ?? 0);
}

/** Fusionne les doublons éventuels d'un même produit. */
function colorVariants(product) {
  return (product?.variant_rows || []).filter((row) => row.is_active !== false && String(row.color || '').trim());
}

function cartLineKey(item) {
  return `${item.product_id}:${item.variant_id || ''}`;
}

function normalizeCart(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = cartLineKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += Number(item.quantity) || 0;
    } else {
      map.set(key, { ...item, quantity: Number(item.quantity) || 0 });
    }
  }
  return Array.from(map.values());
}

function ColorProductCard({ product, onOpen, onAdd }) {
  const colors = colorVariants(product);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(() => (colors[0] ? [colors[0].id] : []));
  const current = colors[index] || null;
  const img = current?.image_url || productImage(product);
  const stock = current
    ? (Number(current.stock) <= 0 ? { key: 'out', label: 'Rupture' } : { key: 'in', label: 'Disponible' })
    : stockMeta(product);
  const available = stock.key !== 'out';

  const toggle = (colorId, at) => {
    setIndex(at);
    setPicked((prev) => (prev.includes(colorId) ? prev.filter((id) => id !== colorId) : [...prev, colorId]));
  };

  const addChosen = () => {
    if (!colors.length) {
      onAdd(product, 1, null);
      return;
    }
    const chosen = colors.filter((row) => picked.includes(row.id) && Number(row.stock) > 0);
    if (!chosen.length) return;
    chosen.forEach((row) => onAdd(product, 1, row));
  };

  return (
    <article className="rounded-3xl bg-white overflow-hidden flex flex-col">
      <div className="relative h-64 sm:h-72 bg-[#FFFFFF]">
        <button type="button" onClick={() => onOpen(product)} className="h-full w-full flex items-center justify-center overflow-hidden">
          {img ? (
            <img src={img} alt={product.name} className="h-full w-full object-cover object-center" />
          ) : (
            <Package className="w-16 h-16 text-primary/40" />
          )}
        </button>
        {colors.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Couleur précédente"
              onClick={() => setIndex((value) => (value - 1 + colors.length) % colors.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Couleur suivante"
              onClick={() => setIndex((value) => (value + 1) % colors.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {product.shop_category_name || 'Article'}
        </span>
        <button type="button" onClick={() => onOpen(product)} className="text-left font-semibold text-ink leading-snug">
          {product.name}
        </button>
        {colors.length > 1 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {colors.map((row, at) => {
              const on = picked.includes(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  aria-label={`Variante ${at + 1}`}
                  onClick={() => toggle(row.id, at)}
                  className={`w-3.5 h-3.5 rounded-full ${on ? 'bg-accent ring-2 ring-ink' : 'bg-primary/30'} ${Number(row.stock) <= 0 ? 'opacity-40' : ''}`}
                />
              );
            })}
          </div>
        )}
        {product.description ? <p className="text-xs text-ink-muted line-clamp-2">{product.description}</p> : null}
        <p className="text-sm font-semibold text-primary">{money(current?.unit_price ?? productPrice(product), product.currency)}</p>
        {stock.key === 'out' ? (
          <p className="text-xs font-semibold text-alert">Indisponible</p>
        ) : null}
        <button
          type="button"
          disabled={!available && !colors.some((row) => picked.includes(row.id) && Number(row.stock) > 0)}
          onClick={addChosen}
          className="mt-2 w-full rounded-full py-2 text-sm font-semibold bg-accent text-ink disabled:bg-surface disabled:text-alert"
        >
          {available || colors.some((row) => picked.includes(row.id) && Number(row.stock) > 0) ? 'Ajouter au panier' : 'Indisponible'}
        </button>
      </div>
    </article>
  );
}

export default function PublicShop() {
  const { id } = useParams();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [cart, setCart] = useState(() => normalizeCart(loadLocalCart(id)));
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [showProforma, setShowProforma] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [payerBurundiPay, setPayerBurundiPay] = useState('');
  const [notes, setNotes] = useState('');
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
      commerceService.publicProducts(id).catch(() => []),
    ])
      .then(([business, prods]) => {
        if (business) {
          const extras = business.extra_attributes && typeof business.extra_attributes === 'object'
            ? business.extra_attributes
            : {};
          const address = business.full_address
            || [business.avenue, business.quartier, business.zone, business.commune, business.province]
              .filter(Boolean)
              .join(', ');
          setShop({
            id: business.id,
            name: business.name,
            phone: String(business.phone || '').trim(),
            email: String(business.email || '').trim(),
            website: String(business.website || '').trim(),
            address: address && address !== 'Adresse non renseignée' ? address : '',
            openingHours: String(extras.opening_hours || '').trim(),
            pickupInfo: String(extras.pickup_info || '').trim(),
            logo: business.logo,
          });
        }
        const list = Array.isArray(prods) ? prods : prods?.results || [];
        setProducts(list.filter((p) => p.is_active !== false));
      })
      .catch((e) => setError(e.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [id]);

  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const key = (p.shop_category_name || p.category_name || 'Autres').trim() || 'Autres';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const hay = `${p.name} ${p.description || ''} ${p.sku || ''} ${p.shop_category_name || ''}`.toLowerCase();
      const matchQ = !q || hay.includes(q.toLowerCase());
      const cat = (p.shop_category_name || p.category_name || 'Autres').trim() || 'Autres';
      const matchCat = categoryFilter === 'ALL' || cat === categoryFilter;
      return matchQ && matchCat;
    });
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
  }, [products, q, categoryFilter]);

  const lines = useMemo(() => cart.map((item) => {
    const p = products.find((x) => x.id === item.product_id) || item.product || {};
    const variant = (p.variant_rows || []).find((row) => row.id === item.variant_id);
    const unit = Number(item.unit_price_snapshot ?? variant?.unit_price ?? productPrice(p));
    const stock = variant
      ? (Number(variant.stock) <= 0 ? { key: 'out', label: 'Rupture' } : { key: 'in', label: 'Disponible' })
      : stockMeta(p);
    const available = variant ? Number(variant.stock || 0) : Number(p.stock_available ?? p.stock ?? 0);
    let validation_error = null;
    if (p.is_active === false) validation_error = 'Produit inactif';
    else if (stock.key === 'out') validation_error = 'Produit en rupture';
    else if (item.quantity > available) {
      validation_error = `Stock insuffisant (dispo: ${available})`;
    }
    return {
      product_id: item.product_id,
      variant_id: item.variant_id || '',
      name: item.product_name_snapshot || p.name,
      color: item.color || variant?.color || '',
      description: p.description,
      sku: p.sku,
      unit_price: unit,
      quantity: item.quantity,
      line_total: unit * item.quantity,
      availability: stock.label,
      validation_error,
      image_url: item.image_url || variant?.image_url || productImage(p),
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

  const addToCart = (product, quantity = 1, variant = null) => {
    setError('');
    if (variant) {
      if (Number(variant.stock) <= 0) {
        setError(`${variant.color || 'Cette couleur'} est en rupture`);
        return;
      }
    } else if (stockMeta(product).key === 'out') {
      setError('Produit en rupture');
      return;
    }
    const addQty = Math.max(1, Number(quantity) || 1);
    const available = variant
      ? Number(variant.stock || 0)
      : Number(product.stock_available ?? product.stock ?? 0);

    persist((prev) => {
      const next = normalizeCart(prev);
      const idx = next.findIndex((i) => i.product_id === product.id && (i.variant_id || '') === (variant?.id || ''));
      const snapshot = {
        product,
        product_name_snapshot: product.name,
        color: variant?.color || '',
        variant_id: variant?.id || '',
        unit_price_snapshot: variant?.unit_price ?? productPrice(product),
        image_url: variant?.image_url || productImage(product),
      };
      if (idx >= 0) {
        let nextQty = next[idx].quantity + addQty;
        if (available >= 0) nextQty = Math.min(nextQty, available);
        next[idx] = { ...next[idx], ...snapshot, quantity: nextQty, unit_price_snapshot: next[idx].unit_price_snapshot ?? snapshot.unit_price_snapshot };
      } else {
        let nextQty = addQty;
        if (available >= 0) nextQty = Math.min(nextQty, Math.max(available, 1));
        next.push({ product_id: product.id, quantity: nextQty, ...snapshot });
      }
      return next;
    });
    setMessage(`${product.name} ajouté au panier`);
    setSelected(null);
    setTimeout(() => setMessage(''), 2500);
  };

  const sameLine = (item, productId, variantId) => item.product_id === productId && (item.variant_id || '') === (variantId || '');

  const updateQty = (productId, variantId, quantity) => {
    const qn = Number(quantity);
    persist((prev) => {
      const next = normalizeCart(prev);
      if (qn <= 0) return next.filter((i) => !sameLine(i, productId, variantId));
      return next.map((i) => {
        if (!sameLine(i, productId, variantId)) return i;
        const p = products.find((x) => x.id === productId) || i.product || {};
        const variant = (p.variant_rows || []).find((row) => row.id === variantId);
        const available = variant ? Number(variant.stock || 0) : Number(p.stock_available ?? p.stock ?? 0);
        let nextQty = qn;
        if (available >= 0) nextQty = Math.min(nextQty, available);
        return { ...i, quantity: Math.max(nextQty, 1) };
      });
    });
  };

  const removeLine = (productId, variantId) => {
    persist((prev) => prev.filter((i) => !sameLine(i, productId, variantId)));
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
    if (!guestName.trim() || !guestPhone.trim() || !guestEmail.trim()) {
      setError('Nom, e-mail et téléphone sont requis. L’e-mail sert à confirmer la commande.');
      return;
    }
    if (!payerBurundiPay.trim()) {
      setError('Indiquez votre numéro BurundiPay pour le paiement.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await commerceService.guestCheckout(id, {
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim(),
        payer_phone: payerBurundiPay.trim(),
        notes: notes.trim(),
        items: cart.map((i) => ({ product: i.product_id, variant: i.variant_id || undefined, quantity: i.quantity })),
      });
      persist([]);
      setConfirmOpen(false);
      setCartOpen(false);
      setPayerBurundiPay('');
      setSuccess(res.order || res);
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
      <div className="min-h-screen bg-surface p-4 sm:p-8">
        <div className="max-w-lg mx-auto space-y-4">
          <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: 'Fraunces, serif' }}>Commande créée</h1>
          <p className="text-sm text-ink-muted">
            Réf. <strong>{success.reference_code}</strong> · Retrait en magasin
          </p>
          <OrderPaymentSuccess
            order={success}
            onOrderUpdate={setSuccess}
            onDone={() => setSuccess(null)}
            confirmPayment={(oid, token) => commerceService.confirmPayment(oid, token)}
            retryPayment={(oid, phone, token) => commerceService.payOrder(oid, phone, token)}
            paidHint="Paiement validé. La boutique pourra accepter votre commande ; vous pourrez ensuite retirer vos articles en magasin."
            doneLabel="Continuer vos achats"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="search-panel p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/businesses?category=Commerce" className="text-ink shrink-0" title="Retour aux boutiques">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              {shop?.logo ? (
                <img src={shop.logo} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Boutique · retrait en magasin</p>
                <h1 className="text-xl sm:text-2xl font-semibold text-ink truncate">{shop?.name || 'Catalogue'}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/businesses/${id}/historique`}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold text-ink bg-surface"
              >
                <History className="w-3.5 h-3.5" />
                Historique
              </Link>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="bg-accent text-ink text-xs font-semibold px-3.5 py-2 rounded-full inline-flex items-center gap-2"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Panier · {cartCount}
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Contacter la boutique</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {shop?.phone ? (
                <a href={`tel:${shop.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 font-semibold text-ink">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  {shop.phone}
                </a>
              ) : null}
              {shop?.email ? (
                <a href={`mailto:${shop.email}`} className="flex items-center gap-2 font-semibold text-ink min-w-0">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{shop.email}</span>
                </a>
              ) : null}
              {shop?.address ? (
                <p className="flex items-start gap-2 text-ink sm:col-span-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{shop.address}</span>
                </p>
              ) : null}
              {shop?.openingHours ? (
                <p className="flex items-center gap-2 text-ink">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  {shop.openingHours}
                </p>
              ) : null}
              {shop?.pickupInfo ? (
                <p className="flex items-center gap-2 text-ink">
                  <Store className="w-4 h-4 text-primary shrink-0" />
                  {shop.pickupInfo}
                </p>
              ) : null}
              {shop?.website ? (
                <a href={websiteHref(shop.website)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary sm:col-span-2 truncate">
                  {shop.website}
                </a>
              ) : null}
              {shop && !shop.phone && !shop.email && !shop.address ? (
                <p className="text-ink-muted sm:col-span-2">Cette boutique n’a pas encore indiqué ses coordonnées.</p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-full bg-surface px-4 py-2.5">
            <Search className="w-4 h-4 text-primary shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un article…"
              className="w-full border-none bg-transparent outline-none text-sm text-ink shadow-none focus:border-none focus:outline-none"
            />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold ${categoryFilter === 'ALL' ? 'bg-accent text-ink' : 'bg-surface text-ink'}`}
            >
              Tout · {products.length}
            </button>
            {categories.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategoryFilter(name)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold ${categoryFilter === name ? 'bg-accent text-ink' : 'bg-surface text-ink'}`}
              >
                {name} · {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-10 pt-4">
          <div className="p-3 bg-green-50 border border-green-100 text-success rounded-xl text-sm">{message}</div>
        </div>
      )}
      {error && !confirmOpen && (
        <div className="max-w-[1180px] mx-auto px-5 sm:px-10 pt-4">
          <div className="p-3 bg-red-50 border border-red-100 text-error rounded-xl text-sm">{error}</div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div>
          <p className="mb-3 text-sm text-ink-muted">
            <strong className="text-ink">{filtered.length}</strong> produit{filtered.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ColorProductCard
                key={p.id}
                product={p}
                onOpen={(item) => { setSelected(item); setQty(1); }}
                onAdd={addToCart}
              />
            ))}
          </div>
          {filtered.length === 0 && <p className="text-center text-ink-muted py-16">Aucun produit trouvé.</p>}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="grid sm:grid-cols-2">
              <div className="bg-green-50 min-h-[220px] flex items-center justify-center overflow-hidden">
                {productImage(selected)
                  ? <img src={productImage(selected)} alt={selected.name} className="w-full h-full object-cover min-h-[220px]" />
                  : <Package className="w-16 h-16 text-primary/50" />}
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between gap-2">
                  <h3 className="text-xl font-bold text-primary" style={{ fontFamily: 'Fraunces, serif' }}>{selected.name}</h3>
                  <button type="button" onClick={() => setSelected(null)}><X className="w-5 h-5 text-ink-faint" /></button>
                </div>
                <div className="text-sm text-ink-muted space-y-1">
                  {selected.shop_category_name ? <p>Catégorie : {selected.shop_category_name}</p> : null}
                  <p>{stockMeta(selected).key === 'out' ? 'Indisponible' : 'Disponible'}</p>
                  {selected.description ? <p className="pt-1 whitespace-pre-line">{selected.description}</p> : null}
                </div>
                <p className="text-lg font-mono font-bold text-primary">{money(productPrice(selected), selected.currency)}</p>
                <div className="flex items-center gap-2">
                  <button type="button" className="icon-btn" onClick={() => setQty(Math.max(1, Number(qty) - 1))}><Minus className="w-4 h-4" /></button>
                  <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="w-16 border rounded-lg px-2 py-2 text-center" />
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
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-primary text-white">
              <div>
                <h3 className="font-bold">Panier</h3>
                <p className="text-[11px] text-green-100">{shop?.name}</p>
              </div>
              <button type="button" onClick={() => setCartOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {lines.length === 0 && (
                <div className="text-center py-10 space-y-3">
                  <p className="text-ink-muted text-sm">Votre panier est vide.</p>
                  <p className="text-xl font-bold">0 BIF</p>
                  <button type="button" onClick={() => setCartOpen(false)} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold">
                    Retourner au catalogue
                  </button>
                </div>
              )}

              {lines.map((line) => (
                <div key={`${line.product_id}-${line.variant_id}`} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-50 overflow-hidden shrink-0 flex items-center justify-center">
                      {line.image_url ? <img src={line.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-primary/50" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{line.name}{line.color ? ` · ${line.color}` : ''}</div>
                      {line.sku && <div className="text-xs text-ink-muted">SKU : {line.sku}</div>}
                      <div className="text-xs font-mono text-primary mt-0.5">{money(line.unit_price, line.currency)}</div>
                      {line.validation_error ? (
                        <div className="text-xs text-red-600 mt-1">{line.validation_error}</div>
                      ) : (
                        <div className="text-xs text-emerald-700 mt-1">{line.availability}</div>
                      )}
                    </div>
                    <button type="button" onClick={() => removeLine(line.product_id, line.variant_id)} className="text-red-600 p-1" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button type="button" className="icon-btn" onClick={() => updateQty(line.product_id, line.variant_id, line.quantity - 1)}><Minus className="w-3 h-3" /></button>
                      <input
                        type="number"
                        min={1}
                        className="w-14 border rounded px-1 py-1 text-center text-sm"
                        value={line.quantity}
                        onChange={(e) => updateQty(line.product_id, line.variant_id, e.target.value)}
                      />
                      <button type="button" className="icon-btn" onClick={() => updateQty(line.product_id, line.variant_id, line.quantity + 1)}><Plus className="w-3 h-3" /></button>
                    </div>
                    <span className="text-sm font-semibold">{money(line.line_total)}</span>
                  </div>
                </div>
              ))}

              {lines.length > 0 && showProforma && (
                <div className="border-2 border-dashed border-primary/30 rounded-xl p-4 bg-green-50/40 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Facture proforma</div>
                      <div className="font-bold text-primary">Facture</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                      Brouillon
                    </span>
                  </div>
                  <dl className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between gap-2"><dt>Boutique</dt><dd className="font-medium text-right">{shop?.name}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Date</dt><dd>{todayFr()}</dd></div>
                  </dl>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-slate-400 border-b">
                        <th className="py-1">Produit</th>
                        <th className="py-1 text-right">Qté</th>
                        <th className="py-1 text-right">Prix</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={`${l.product_id}-${l.variant_id}`} className="border-b border-white/60">
                          <td className="py-1.5 pr-1">{l.name}{l.color ? ` · ${l.color}` : ''}</td>
                          <td className="py-1.5 text-right">{l.quantity}</td>
                          <td className="py-1.5 text-right">{money(l.unit_price)}</td>
                          <td className="py-1.5 text-right font-medium">{money(l.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{money(subtotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t space-y-2 bg-white">
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="font-mono text-primary">{money(subtotal)}</span>
              </div>
              {lines.length > 0 && (
                <>
                  <button type="button" onClick={() => setShowProforma((v) => !v)} className="w-full px-3 py-2 border rounded-lg text-sm font-semibold">
                    {showProforma ? 'Masquer la facture' : 'Voir la facture'}
                  </button>
                  <button type="button" onClick={() => setClearOpen(true)} className="w-full px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm font-semibold">
                    Vider le panier
                  </button>
                  <button
                    type="button"
                    disabled={hasErrors}
                    onClick={openSend}
                    className="w-full py-2.5 bg-primary hover:bg-secondary text-white font-semibold rounded-lg disabled:opacity-40"
                  >
                    Envoyer la commande
                  </button>
                  {hasErrors && (
                    <p className="text-xs text-red-600">Corrigez les lignes en erreur avant l&apos;envoi.</p>
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
              <div className="flex justify-between"><dt className="text-ink-muted">Boutique</dt><dd className="font-medium">{shop?.name}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Retrait</dt><dd className="font-medium">En magasin</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Total</dt><dd className="font-bold">{money(subtotal)}</dd></div>
            </dl>
            <ul className="text-sm border-2 border-accent rounded-xl divide-y max-h-40 overflow-y-auto">
              {lines.map((l) => (
                <li key={`${l.product_id}-${l.variant_id}`} className="px-3 py-2 flex justify-between gap-2">
                  <span>
                    {l.name}{l.color ? ` · ${l.color}` : ''} × {l.quantity}
                    <span className="block text-xs text-ink-muted">{money(l.unit_price)}</span>
                  </span>
                  <span className="font-medium">{money(l.line_total)}</span>
                </li>
              ))}
            </ul>
            <label className="text-xs font-bold text-ink block space-y-1">
              <span>Nom complet *</span>
              <input required className="w-full border-2 border-accent rounded-xl px-3 py-2 bg-surface text-ink outline-none focus:border-alert" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Jean Ndayishimiye" />
            </label>
            <label className="text-xs font-bold text-ink block space-y-1">
              <span>E-mail *</span>
              <input required type="email" className="w-full border-2 border-accent rounded-xl px-3 py-2 bg-surface text-ink outline-none focus:border-alert" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Pour la confirmation de commande" />
            </label>
            <label className="text-xs font-bold text-ink block space-y-1">
              <span>Téléphone *</span>
              <input required className="w-full border-2 border-accent rounded-xl px-3 py-2 bg-surface text-ink outline-none focus:border-alert" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </label>
            <BurundiPayPayerField
              value={payerBurundiPay}
              onChange={setPayerBurundiPay}
              amountLabel={money(subtotal)}
            />
            <label className="text-xs font-bold text-ink block space-y-1">
              <span>Notes</span>
              <textarea className="w-full border-2 border-accent rounded-xl px-3 py-2 bg-surface text-ink outline-none focus:border-alert" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Indications pour le retrait…" />
            </label>
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
