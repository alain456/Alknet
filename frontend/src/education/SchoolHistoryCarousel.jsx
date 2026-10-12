import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Même principe que le carousel des chambres : un index, un défilement
 * automatique, pause au survol, flèches et pastilles.
 * `hero` occupe le haut de la page établissement, sans cadre arrondi.
 */
export default function SchoolHistoryCarousel({ images = [], name = 'École', hero = false }) {
  const photos = images.filter(Boolean);
  const count = photos.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sizes, setSizes] = useState({});

  const remember = (i, img) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    setSizes((prev) => (
      prev[i] ? prev : { ...prev, [i]: { w: img.naturalWidth, h: img.naturalHeight } }
    ));
  };

  const current = sizes[index];
  const ratio = current ? current.w / current.h : 16 / 9;

  const go = (i) => setIndex(((i % count) + count) % count);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, 5200);
    return () => clearInterval(timer);
  }, [count, paused]);

  if (!count) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className={`relative w-full overflow-hidden bg-[#123568] ${hero ? 'max-h-[70vh]' : 'max-h-96 rounded-2xl border border-border'}`}
        style={{ aspectRatio: ratio }}
      >
        {photos.map((src, i) => (
          <img
            key={`${i}-${src.slice(0, 32)}`}
            src={src}
            alt={`${name} — photo ${i + 1}`}
            onLoad={(e) => remember(i, e.currentTarget)}
            className={`absolute inset-0 m-auto max-w-full max-h-full w-auto h-auto object-contain transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            onClick={() => go(index - 1)}
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 text-ink shadow ${hero ? 'sm:left-6' : ''}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            onClick={() => go(index + 1)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 text-ink shadow ${hero ? 'sm:right-6' : ''}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className={`absolute left-0 right-0 flex justify-center gap-2 z-20 ${hero ? 'bottom-5' : 'relative mt-3'}`}>
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
