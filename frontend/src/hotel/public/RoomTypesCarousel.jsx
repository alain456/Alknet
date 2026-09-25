import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BedDouble, ImageOff } from 'lucide-react';

function roomTypeSpecs(t) {
  const parts = [];
  if (t.capacity_adults != null) parts.push(`${t.capacity_adults} adulte(s)`);
  if (t.capacity_children) parts.push(`${t.capacity_children} enfant(s)`);
  if (t.bed_configuration) parts.push(t.bed_configuration);
  if (t.surface_m2) parts.push(`${Number(t.surface_m2).toFixed(2)} m²`);
  if (t.rooms_count != null) parts.push(`${t.rooms_count} chambre(s)`);
  return parts.join(' · ');
}

function priceLabel(t, minRate, currency) {
  if (minRate) {
    return `Dès ${Number(minRate.price_per_night).toLocaleString('fr-FR')} ${minRate.currency || currency}/nuit`;
  }
  const base = Number(t.base_price) || 0;
  if (base > 0) {
    return `Dès ${base.toLocaleString('fr-FR')} ${currency}/nuit`;
  }
  return 'Tarif sur demande';
}

/**
 * Carousel public des types de chambres (images + détails gérés par le manager).
 */
export default function RoomTypesCarousel({
  roomTypes = [],
  currency = 'BIF',
  minRateForType,
  onBook,
}) {
  const scrollerRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = roomTypes.length;

  const scrollTo = (i) => {
    const el = scrollerRef.current;
    if (!el || !count) return;
    const next = ((i % count) + count) % count;
    setIndex(next);
    const child = el.children[next];
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % count;
        const el = scrollerRef.current;
        const child = el?.children[next];
        if (child) {
          child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        return next;
      });
    }, 5200);
    return () => clearInterval(timer);
  }, [count, paused]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const children = [...el.children];
      if (!children.length) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      children.forEach((child, i) => {
        const center = child.offsetLeft + child.offsetWidth / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setIndex(best);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [count]);

  if (!count) {
    return <p className="text-sm text-ink-muted">Aucun type de chambre publié.</p>;
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1 custom-scrollbar"
        style={{ scrollbarWidth: 'thin' }}
      >
        {roomTypes.map((t) => {
          const photos = Array.isArray(t.photos) ? t.photos.filter(Boolean) : [];
          const cover = photos[0] || '';
          const rate = typeof minRateForType === 'function' ? minRateForType(t.id) : null;
          const category = (t.category || (Array.isArray(t.amenities) && t.amenities[0]) || '').trim();
          const specs = roomTypeSpecs(t);

          return (
            <article
              key={t.id}
              className="relative shrink-0 w-[min(100%,320px)] sm:w-[340px] aspect-[4/5] snap-center rounded-2xl overflow-hidden border-2 border-accent shadow-md group"
            >
              {cover ? (
                <img
                  src={cover}
                  alt={t.name}
                  className="absolute inset-0 w-full h-full object-cover transition duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#4a1512] via-[#3d2418] to-[#1a0c0b] flex items-center justify-center">
                  <ImageOff className="w-12 h-12 text-white/30" />
                </div>
              )}

              {/* Atmosphere overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(20,12,8,0.15) 0%, rgba(20,12,8,0.35) 40%, rgba(12,8,5,0.92) 100%)',
                }}
              />

              {/* Extra photos strip */}
              {photos.length > 1 && (
                <div className="absolute top-3 right-3 flex gap-1 z-10">
                  {photos.slice(0, 4).map((src, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-lg overflow-hidden border border-white/40 shadow"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 p-5 z-10 space-y-2 text-white">
                <div className="flex items-center gap-2 text-[#8fd4a8]">
                  <BedDouble className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Type de chambre</span>
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight leading-tight drop-shadow">
                  {t.name}
                </h3>
                {specs ? (
                  <p className="text-sm font-medium text-white/90 leading-snug">
                    {specs}
                  </p>
                ) : null}
                {category ? (
                  <p className="text-sm font-bold text-[#8fd4a8] capitalize">{category}</p>
                ) : null}
                {t.description ? (
                  <p className="text-xs text-white/75 line-clamp-2 font-medium">{t.description}</p>
                ) : null}
                <div className="flex items-end justify-between gap-3 pt-2">
                  <p className="text-base font-extrabold text-white">
                    {priceLabel(t, rate, currency)}
                  </p>
                  {onBook && (
                    <button
                      type="button"
                      onClick={() => onBook(t)}
                      className="shrink-0 px-3.5 py-2 rounded-xl bg-[#1E8B4A] hover:opacity-95 text-white text-xs font-extrabold border border-[#8fd4a8]/60 transition"
                    >
                      Réserver
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Précédent"
            onClick={() => scrollTo(index - 1)}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-20 w-10 h-10 items-center justify-center rounded-full bg-surface/90 border-2 border-accent text-ink shadow-md hover:bg-surface"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Suivant"
            onClick={() => scrollTo(index + 1)}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-20 w-10 h-10 items-center justify-center rounded-full bg-surface/90 border-2 border-accent text-ink shadow-md hover:bg-surface"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex justify-center gap-2 mt-4">
            {roomTypes.map((t, i) => (
              <button
                key={t.id}
                type="button"
                aria-label={`Aller à ${t.name}`}
                onClick={() => scrollTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-primary' : 'w-2 bg-accent/40 hover:bg-accent/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
