import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Search, ShoppingCart, X, Minus, Plus, Pill, Trash2, History,
} from 'lucide-react';
import api from '../shared/api';
import BurundiPayPayerField from '../shared/components/BurundiPayPayerField';
import OrderPaymentSuccess from '../shared/components/OrderPaymentSuccess';
import retailService, { PROFORMA_STATUS_LABELS } from './retailService';
const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;
const cartKey = (id) => `isoko_retail_cart_${id}`;

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

function formatExp(date) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('fr-FR');
  } catch {
    return date;
  }
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

export default function PublicRetailCatalog() {
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
  const [showProforma, setShowProforma] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [payerBurundiPay, setPayerBurundiPay] = useState('');
  const [prescriptionFile, setPrescriptionFile] = useState(null);
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
      retailService.getProducts({ pharmacy: id, public: true }).catch(() => []),
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
    if (sortBy === 'price') list = [...list].sort((a, b) => Number(a.retail_price) - Number(b.retail_price));
    else if (sortBy === 'stock') {
      const rank = { in: 0, low: 1, out: 2 };
      list = [...list].sort((a, b) => rank[stockMeta(a).key] - rank[stockMeta(b).key]);
    } else list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    return list;
  }, [products, q, categoryFilter, formFilter, mfrFilter, availFilter, sortBy]);

  const lines = useMemo(() => cart.map((item) => {
    const p = products.find((x) => x.id === item.product_id) || item.product || {};
    const unit = Number(item.unit_price_snapshot ?? p.retail_price ?? 0);
    const stock = stockMeta(p);
    let validation_error = null;
    if (p.status && p.status !== 'ACTIVE') validation_error = 'Produit inactif';
    else if (stock.key === 'out') validation_error = 'Produit en rupture';
    else if (p.quantity_available != null && item.quantity > p.quantity_available) {
      validation_error = `Stock insuffisant (dispo: ${p.quantity_available})`;
    }
    return {
      product_id: item.product_id,
      name: item.product_name_snapshot || p.name,
      active_ingredient: p.active_ingredient,
      packaging: item.packaging_snapshot || p.packaging,
      sales_unit: p.sales_unit,
      unit_price: unit,
      quantity: item.quantity,
      line_total: unit * item.quantity,
      availability: stock.label,
      validation_error,
      image_url: p.image_url,
      currency: p.currency || 'BIF',
      prescription_required: Boolean(p.prescription_required),
    };
  }), [cart, products]);

  const cartCount = lines.reduce((s, i) => s + i.quantity, 0);
  const subtotal = lines.reduce((s, i) => s + i.line_total, 0);
  const hasErrors = lines.some((l) => l.validation_error);
  const requiresPrescription = lines.some((l) => l.prescription_required);

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
    // 1 clic = +1 unité de vente (boîte…), jamais le contenu "20 comprimés"
    const addQty = Math.max(1, Number(quantity) || 1);
    const available = product.quantity_available;

    persist((prev) => {
      const next = normalizeCart(prev);
      const idx = next.findIndex((i) => i.product_id === product.id);
      if (idx >= 0) {
        let nextQty = next[idx].quantity + addQty;
        if (available != null && available >= 0) nextQty = Math.min(nextQty, available);
        next[idx] = {
          ...next[idx],
          quantity: nextQty,
          product,
          product_name_snapshot: product.name,
          packaging_snapshot: product.packaging,
          unit_price_snapshot: next[idx].unit_price_snapshot ?? product.retail_price,
        };
      } else {
        let nextQty = addQty;
        if (available != null && available >= 0) nextQty = Math.min(nextQty, Math.max(available, 1));
        next.push({
          product_id: product.id,
          quantity: nextQty,
          product,
          product_name_snapshot: product.name,
          packaging_snapshot: product.packaging,
          unit_price_snapshot: product.retail_price,
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
        let nextQty = qn;
        if (p.quantity_available != null && p.quantity_available >= 0) {
          nextQty = Math.min(nextQty, p.quantity_available);
        }
        return { ...i, quantity: Math.max(nextQty, 1) };
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

  const fileToUpload = (file) => {
    if (!file) {
      setPrescriptionFile(null);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Ordonnance trop volumineuse (max. 8 Mo).');
      return;
    }
    setError('');
    setPrescriptionFile(file);
  };

  const sendOrder = async () => {
    if (!confirmChecked) return;
    if (!patientName.trim() || !patientEmail.trim()) {
      setError('Nom et email du patient requis.');
      return;
    }
    if (!payerBurundiPay.trim()) {
      setError('Indiquez votre numéro BurundiPay pour le paiement.');
      return;
    }
    if (requiresPrescription && !prescriptionFile) {
      setError('Joignez le fichier de l’ordonnance (image ou PDF).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const order = await retailService.guestCheckout({
        pharmacy_id: id,
        patient_name: patientName.trim(),
        patient_email: patientEmail.trim(),
        patient_phone: patientPhone.trim(),
        payment_method: 'BURUNDIPAY',
        payer_phone: payerBurundiPay.trim(),
        prescription_file: prescriptionFile || undefined,
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      persist([]);
      setConfirmOpen(false);
      setCartOpen(false);
      setPrescriptionFile(null);
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
        confirmPayment={(id) => retailService.confirmOrderPayment(id)}
        retryPayment={(id, phone) => retailService.payOrder(id, phone)}
        paidHint="Paiement validé. La pharmacie pourra accepter votre commande ; vous pourrez ensuite récupérer vos médicaments."
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface text-ink" style={{ fontFamily: 'Inter, IBM Plex Sans, sans-serif' }}>
      <div className="bg-primary text-white px-5 sm:px-10 py-4">
        <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/businesses" className="text-green-100 hover:text-white shrink-0" title="Retour">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {pharmacy?.logo ? (
              <img src={pharmacy.logo} alt="" className="w-9 h-9 rounded-lg object-cover border border-white/30 bg-white" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg font-bold">+</div>
            )}
            <div className="min-w-0">
              <div className="font-display font-bold text-lg truncate" style={{ fontFamily: 'Fraunces, Zilla Slab, serif' }}>
                {pharmacy?.name || 'Pharmacie'}
              </div>
              <div className="text-[10px] tracking-widest uppercase text-green-200/80 font-mono">Catalogue en ligne</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/businesses/${id}/historique`}
              className="bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3.5 py-2 rounded-full font-mono inline-flex items-center gap-2"
            >
              <History className="w-3.5 h-3.5" />
              Historique
            </Link>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="bg-accent text-primary text-xs font-semibold px-3.5 py-2 rounded-full font-mono inline-flex items-center gap-2"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Panier · {cartCount} article{cartCount > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b-[3px] border-double border-primary/40 px-5 sm:px-10 py-6">
        <div className="max-w-[1180px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-widest text-accent font-semibold">
            Vente au détail · commande libre
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-primary mt-1.5 mb-4" style={{ fontFamily: 'Fraunces, serif' }}>
            Trouvez votre médicament
          </h1>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[240px] flex items-center gap-2.5 bg-green-50 border border-border rounded-lg px-4 py-2.5">
              <Search className="w-4 h-4 text-ink-faint shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, DCI / principe actif..."
                className="border-none bg-transparent outline-none text-sm flex-1 text-ink"
              />
            </div>
            <select value={formFilter} onChange={(e) => setFormFilter(e.target.value)} className="text-sm px-3.5 py-2.5 border border-border rounded-lg bg-white text-ink-muted">
              <option value="ALL">Toutes les formes</option>
              {forms.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={mfrFilter} onChange={(e) => setMfrFilter(e.target.value)} className="text-sm px-3.5 py-2.5 border border-border rounded-lg bg-white text-ink-muted">
              <option value="ALL">Tous fabricants</option>
              {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)} className="text-sm px-3.5 py-2.5 border border-border rounded-lg bg-white text-ink-muted">
              <option value="ALL">Toute dispo.</option>
              <option value="in">Disponible</option>
              <option value="low">Stock faible</option>
              <option value="out">Rupture</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-sm px-3.5 py-2.5 border border-border rounded-lg bg-white text-ink-muted">
              <option value="name">Trier : Nom</option>
              <option value="price">Prix croissant</option>
              <option value="stock">Disponibilité</option>
            </select>
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

      <div className="max-w-[1180px] mx-auto px-5 sm:px-10 py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <aside className="space-y-6">
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-primary mb-2.5">Catégorie</h3>
            <div className="space-y-1">
              <button type="button" onClick={() => setCategoryFilter('ALL')} className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[13.5px] ${categoryFilter === 'ALL' ? 'bg-green-100 text-primary font-semibold' : 'text-ink-muted hover:bg-green-50'}`}>
                Tous <span className="font-mono text-[11px] text-ink-faint">{products.length}</span>
              </button>
              {categories.map(([name, count]) => (
                <button key={name} type="button" onClick={() => setCategoryFilter(name)} className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[13.5px] ${categoryFilter === name ? 'bg-green-100 text-primary font-semibold' : 'text-ink-muted hover:bg-green-50'}`}>
                  {name} <span className="font-mono text-[11px] text-ink-faint">{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white border border-border rounded-[10px] p-3.5 text-xs text-ink-muted space-y-2">
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Disponible</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Stock faible</div>
            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-ink-faint" /> Rupture</div>
            <div className="flex items-center gap-2 pt-1 border-t border-border"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Ordonnance requise</div>
          </div>
        </aside>

        <div>
          <div className="mb-4 text-[13.5px] text-ink-muted">
            <strong className="text-ink">{filtered.length}</strong> médicament(s)
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
            {filtered.map((p) => {
              const stock = stockMeta(p);
              const available = stock.key !== 'out';
              return (
                <article
                  key={p.id}
                  className="relative rounded-2xl border border-border bg-surface p-4 pb-0 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
                >
                  <button type="button" onClick={() => { setSelected(p); setQty(1); }} className="w-full text-left">
                    <div className="bg-white border border-border rounded-xl h-40 sm:h-44 flex items-center justify-center overflow-hidden mb-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Pill className="w-12 h-12 text-primary/40" />
                      )}
                    </div>
                  </button>
                  <div className="bg-white border border-border border-t-0 rounded-b-xl px-4 pt-3.5 pb-4 -mt-px">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{p.therapeutic_class || p.manufacturer || 'Médicament'}</span>
                    <div className="font-display font-semibold text-[16.5px] text-primary mt-1 leading-snug" style={{ fontFamily: 'Fraunces, serif' }}>{p.name}</div>
                    <div className="text-[12.5px] text-ink-muted mt-1 space-y-0.5">
                      {p.dosage && <div>Dosage : {p.dosage}</div>}
                      {p.administration_route && <div>Voie : {p.administration_route}</div>}
                      <div>{p.packaging || p.sales_unit || 'Conditionnement'}</div>
                      {p.expiration_date && <div>Exp. {formatExp(p.expiration_date)}</div>}
                      <div className="font-mono font-semibold text-primary pt-1">{money(p.retail_price, p.currency)} / {(p.sales_unit || 'boîte').toLowerCase()}</div>
                      {p.prescription_required && (
                        <div className="text-amber-800 font-medium">Ordonnance obligatoire</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-border mt-2">
                      <span className={`font-mono text-[11px] inline-flex items-center gap-1.5 ${stock.key === 'in' ? 'text-success' : stock.key === 'low' ? 'text-accent' : 'text-ink-faint'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {stock.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToCart(p, 1);
                      }}
                      className={`w-full mt-3 rounded-md py-2 text-[13px] font-semibold ${available ? 'bg-primary hover:bg-secondary text-white' : 'bg-red-50 text-error cursor-default'}`}
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
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="grid sm:grid-cols-2">
              <div className="bg-green-50 min-h-[220px] flex items-center justify-center overflow-hidden">
                {selected.image_url ? <img src={selected.image_url} alt={selected.name} className="w-full h-full object-cover min-h-[220px]" /> : <Pill className="w-16 h-16 text-primary/50" />}
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between gap-2">
                  <h3 className="text-xl font-bold text-primary" style={{ fontFamily: 'Fraunces, serif' }}>{selected.name}</h3>
                  <button type="button" onClick={() => setSelected(null)}><X className="w-5 h-5 text-ink-faint" /></button>
                </div>
                <div className="text-sm text-ink-muted space-y-1">
                  <p>Classe : {selected.therapeutic_class || '—'}</p>
                  <p>Dosage : {selected.dosage || '—'}</p>
                  <p>Voie d&apos;administration : {selected.administration_route || '—'}</p>
                  <p>Unité de vente : {selected.sales_unit || '—'}</p>
                  <p>Date d&apos;expiration : {formatExp(selected.expiration_date) || '—'}</p>
                  <p>Disponibilité : {stockMeta(selected).label}</p>
                  {selected.prescription_required && <p className="text-amber-800 font-medium">Ordonnance obligatoire</p>}
                </div>
                <p className="text-lg font-mono font-bold text-primary">{money(selected.retail_price, selected.currency)}</p>
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
                <p className="text-[11px] text-green-100">{pharmacy?.name}</p>
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
                <div key={line.product_id} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-50 overflow-hidden shrink-0 flex items-center justify-center">
                      {line.image_url ? <img src={line.image_url} alt="" className="w-full h-full object-cover" /> : <Pill className="w-5 h-5 text-primary/50" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{line.name}</div>
                      <div className="text-xs text-ink-muted">
                        {line.active_ingredient && <>DCI : {line.active_ingredient} · </>}
                        {line.packaging}
                      </div>
                      <div className="text-xs font-mono text-primary mt-0.5">{money(line.unit_price, line.currency)}</div>
                      {line.prescription_required && (
                        <div className="text-xs text-amber-800 mt-1">Ordonnance obligatoire</div>
                      )}
                      {line.validation_error ? (
                        <div className="text-xs text-red-600 mt-1">{line.validation_error}</div>
                      ) : (
                        <div className="text-xs text-emerald-700 mt-1">{line.availability}</div>
                      )}
                    </div>
                    <button type="button" onClick={() => removeLine(line.product_id)} className="text-red-600 p-1" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button type="button" className="icon-btn" onClick={() => updateQty(line.product_id, line.quantity - 1)}><Minus className="w-3 h-3" /></button>
                      <input
                        type="number"
                        min={1}
                        className="w-14 border rounded px-1 py-1 text-center text-sm"
                        value={line.quantity}
                        onChange={(e) => updateQty(line.product_id, e.target.value)}
                      />
                      <button type="button" className="icon-btn" onClick={() => updateQty(line.product_id, line.quantity + 1)}><Plus className="w-3 h-3" /></button>
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
                      {PROFORMA_STATUS_LABELS.DRAFT}
                    </span>
                  </div>
                  <dl className="text-xs space-y-1 text-slate-600">
                    <div className="flex justify-between gap-2"><dt>Pharmacie de détail</dt><dd className="font-medium text-right">{pharmacy?.name}</dd></div>
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
                        <tr key={l.product_id} className="border-b border-white/60">
                          <td className="py-1.5 pr-1">{l.name}</td>
                          <td className="py-1.5 text-right">{l.quantity}</td>
                          <td className="py-1.5 text-right">{money(l.unit_price)}</td>
                          <td className="py-1.5 text-right font-medium">{money(l.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between text-sm pt-1">
                    <span>Sous-total</span>
                    <span>{money(subtotal)}</span>
                  </div>
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
            <h3 className="font-bold text-lg">Confirmer l&apos;envoi de la commande</h3>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-slate-500">Pharmacie de détail</dt><dd className="font-medium">{pharmacy?.name}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd className="font-bold">{money(subtotal)}</dd></div>
            </dl>
            <ul className="text-sm border rounded-xl divide-y max-h-40 overflow-y-auto">
              {lines.map((l) => (
                <li key={l.product_id} className="px-3 py-2 flex justify-between gap-2">
                  <span>
                    {l.name} × {l.quantity}
                    <span className="block text-xs text-slate-400">
                      {l.packaging} · {money(l.unit_price)}
                      {l.prescription_required ? ' · ordonnance' : ''}
                    </span>
                  </span>
                  <span className="font-medium">{money(l.line_total)}</span>
                </li>
              ))}
            </ul>
            <label className="text-sm block space-y-1">
              <span className="text-slate-500">Nom du patient *</span>
              <input required className="w-full border rounded-lg px-3 py-2" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Jean Ndayishimiye" />
            </label>
            <label className="text-sm block space-y-1">
              <span className="text-slate-500">Email *</span>
              <input type="email" required className="w-full border rounded-lg px-3 py-2" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />
            </label>
            <label className="text-sm block space-y-1">
              <span className="text-slate-500">Téléphone</span>
              <input className="w-full border rounded-lg px-3 py-2" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
            </label>
            <BurundiPayPayerField
              value={payerBurundiPay}
              onChange={setPayerBurundiPay}
              amountLabel={money(subtotal)}
            />
            {requiresPrescription && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
                <b className="text-sm text-amber-900">Ordonnance obligatoire</b>
                <p className="text-xs text-amber-800">Joignez une photo ou un PDF (max. 8 Mo).</p>
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => fileToUpload(e.target.files?.[0])}
                  className="block text-sm w-full"
                />
                {prescriptionFile && (
                  <p className="text-xs font-medium text-amber-900 truncate">
                    Fichier : {prescriptionFile.name}
                  </p>
                )}
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
              <span>J&apos;ai vérifié les produits, les quantités et le montant total.</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="px-4 py-2 border rounded-xl">Annuler</button>
              <button type="button" disabled={!confirmChecked || busy} onClick={sendOrder} className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50">
                {busy ? 'Envoi…' : 'Confirmer et envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
