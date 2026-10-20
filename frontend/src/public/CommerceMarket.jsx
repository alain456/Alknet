import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, Search, Store } from 'lucide-react';
import api from '../shared/api';

const money = (n, c = 'BIF') => `${Number(n || 0).toLocaleString('fr-BI')} ${c}`;

function stockMeta(p) {
  const available = Number(p.stock_available ?? p.stock ?? 0);
  const threshold = Number(p.low_stock_threshold ?? 5);
  if (available <= 0 || p.is_active === false) return { key: 'out', label: 'Rupture' };
  if (available <= threshold) return { key: 'low', label: 'Stock faible' };
  return { key: 'in', label: 'Disponible' };
}

function colorSlides(product) {
  const rows = (product?.variant_rows || []).filter((row) => row.is_active !== false && String(row.color || '').trim());
  if (!rows.length) return [{ color: '', image: productImage(product) }];
  return rows.map((row) => ({ color: row.color, image: row.image_url || productImage(product) }));
}

function productImage(p) {
  if (Array.isArray(p?.image_urls) && p.image_urls[0]) return p.image_urls[0];
  return p?.image_url || '';
}

function productPrice(p) {
  return Number(p?.effective_price ?? p?.price ?? 0);
}

function MarketSlides({ slides }) {
  const [index, setIndex] = useState(0);
  const current = slides[index] || slides[0];
  const several = slides.length > 1;
  return (
    <div className="relative h-64 sm:h-72 bg-[#FFFFFF]">
      {current?.image ? (
        <img src={current.image} alt="" className="h-full w-full object-cover object-center" />
      ) : (
        <div className="h-full flex items-center justify-center">
          <Package className="w-16 h-16 text-primary/40" />
        </div>
      )}
      {several && (
        <>
          <button
            type="button"
            aria-label="Couleur précédente"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((value) => (value - 1 + slides.length) % slides.length);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Couleur suivante"
            onClick={(event) => {
              event.stopPropagation();
              setIndex((value) => (value + 1) % slides.length);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-ink flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
      {several ? (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {slides.map((slide, at) => (
            <button
              key={`${slide.image}-${at}`}
              type="button"
              aria-label={`Photo ${at + 1}`}
              onClick={(event) => {
                event.stopPropagation();
                setIndex(at);
              }}
              className={`w-2 h-2 rounded-full ${at === index ? 'bg-accent' : 'bg-white/80'}`}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}

export default function CommerceMarket({ shops }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const [avail, setAvail] = useState('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const shopIds = (shops || []).map((shop) => shop.id).join(',');

  useEffect(() => {
    let cancelled = false;
    const list = shops || [];
    if (!list.length) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    Promise.all(list.map((shop) => (
      api.get(`products/?business=${shop.id}`)
        .then((data) => {
          const rows = Array.isArray(data) ? data : data?.results || [];
          return rows
            .filter((p) => p.is_active !== false)
            .map((p) => ({ ...p, shopName: shop.name, shopId: shop.id }));
        })
        .catch(() => [])
    )))
      .then((groups) => {
        if (!cancelled) setProducts(groups.flat());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [shopIds]);

  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const key = (p.shop_category_name || 'Autres').trim() || 'Autres';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [products]);

  const filtered = useMemo(() => {
    const min = minPrice === '' ? null : Number(minPrice);
    const max = maxPrice === '' ? null : Number(maxPrice);
    return products.filter((p) => {
      const hay = `${p.name} ${p.description || ''} ${p.shopName || ''} ${p.shop_category_name || ''}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      const cat = (p.shop_category_name || 'Autres').trim() || 'Autres';
      if (category !== 'ALL' && cat !== category) return false;
      const stock = stockMeta(p);
      if (avail !== 'ALL' && stock.key !== avail) return false;
      const price = productPrice(p);
      if (min != null && !Number.isNaN(min) && price < min) return false;
      if (max != null && !Number.isNaN(max) && price > max) return false;
      return true;
    });
  }, [products, q, category, avail, minPrice, maxPrice]);

  return (
    <div className="space-y-4">
      <div className="search-panel p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Commerce</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Boutiques et articles</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {shops.length} boutique{shops.length > 1 ? 's' : ''} · choisissez un article pour ouvrir le catalogue
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-full bg-surface px-4 py-2.5">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Article, boutique, catégorie…"
            className="w-full border-none bg-transparent outline-none text-sm text-ink shadow-none focus:border-none focus:outline-none"
          />
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategory('ALL')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold ${category === 'ALL' ? 'bg-accent text-ink' : 'bg-surface text-ink'}`}
          >
            Tout · {products.length}
          </button>
          {categories.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold ${category === name ? 'bg-accent text-ink' : 'bg-surface text-ink'}`}
            >
              {name} · {count}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <div className="rounded-3xl bg-white p-4 h-fit space-y-5">
          <div>
            <p className="text-sm font-semibold text-ink">Prix (BIF)</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none"
              />
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none"
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Disponibilité</p>
            <div className="mt-2 space-y-1">
              {[
                ['ALL', 'Tous'],
                ['in', 'Disponible'],
                ['low', 'Stock faible'],
                ['out', 'Rupture'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAvail(key)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm ${avail === key ? 'bg-accent text-ink font-semibold' : 'text-ink'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm text-ink-muted">
            {loading ? 'Chargement…' : `${filtered.length} article${filtered.length > 1 ? 's' : ''}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const stock = stockMeta(p);
              const slides = colorSlides(p);
              return (
                <article
                  key={`${p.shopId}-${p.id}`}
                  className="rounded-3xl bg-white text-left overflow-hidden flex flex-col"
                >
                  <MarketSlides slides={slides} />
                  <button
                    type="button"
                    onClick={() => navigate(`/businesses/${p.shopId}/shop`)}
                    className="text-left flex flex-col flex-1"
                  >
                  <div className="p-4 flex flex-col gap-1 flex-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {p.shop_category_name || 'Article'}
                    </span>
                    <span className="font-semibold text-ink leading-snug">{p.name}</span>
                    <span className="text-sm font-semibold text-primary">{money(productPrice(p), p.currency)}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted">
                      <Store className="w-3.5 h-3.5" /> {p.shopName}
                    </span>
                    <span className={`mt-auto pt-2 text-xs font-semibold ${stock.key === 'out' ? 'text-alert' : 'text-primary'}`}>
                      {stock.label}
                    </span>
                  </div>
                  </button>
                </article>
              );
            })}
          </div>
          {!loading && filtered.length === 0 && (
            <p className="text-center text-ink-muted py-16">Aucun article pour ces filtres.</p>
          )}
        </div>
      </div>
    </div>
  );
}
