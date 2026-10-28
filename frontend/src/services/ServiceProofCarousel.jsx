import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function youtubeEmbed(url) {
  const match = String(url || '').match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/,
  );
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : '';
}

export function vimeoEmbed(url) {
  const match = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : '';
}

export function isCarouselProof(row) {
  return (row?.kind === 'ACTIVITY' || row?.kind === 'TESTIMONY') && Boolean(row?.file_url);
}

export const PAPER_KINDS = ['ATTESTATION', 'CERTIFICATE'];
export const REALIZATION_KINDS = ['ACTIVITY', 'TESTIMONY'];

export function isPaperImage(row) {
  return (row?.kind === 'ATTESTATION' || row?.kind === 'CERTIFICATE') && Boolean(row?.file_url);
}

export function isImageUrl(url) {
  const value = String(url || '');
  return value.startsWith('data:image/') || value.startsWith('/media/') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(value);
}

const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

export function TestimonyPlayer({ src, title, onPlay, className = '' }) {
  const videoRef = useRef(null);
  const yt = youtubeEmbed(src);
  const vimeo = vimeoEmbed(src);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    el.muted = false;
    el.defaultMuted = false;
    el.volume = 1;
    return () => {
      el.pause();
    };
  }, [src]);

  if (yt) {
    return (
      <iframe
        title={title || 'Témoignage'}
        src={`${yt}?rel=0&modestbranding=1&playsinline=1`}
        className={className || 'absolute inset-0 w-full h-full'}
        allow={IFRAME_ALLOW}
        allowFullScreen
      />
    );
  }
  if (vimeo) {
    return (
      <iframe
        title={title || 'Témoignage'}
        src={`${vimeo}?playsinline=1`}
        className={className || 'absolute inset-0 w-full h-full'}
        allow={IFRAME_ALLOW}
        allowFullScreen
      />
    );
  }
  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      onPlay={(event) => {
        event.currentTarget.muted = false;
        event.currentTarget.volume = 1;
        onPlay?.();
      }}
      className={className || 'absolute inset-0 w-full h-full object-contain bg-[#132F45]'}
    >
      Votre navigateur ne lit pas cette vidéo.
    </video>
  );
}

function SlideMedia({ item, active, onPlay }) {
  const src = item.file_url || '';
  const [broken, setBroken] = useState(false);
  if (item.kind === 'TESTIMONY') {
    if (!active) return null;
    return <TestimonyPlayer src={src} title={item.title} onPlay={onPlay} />;
  }
  if (broken) {
    return (
      <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/80">
        Image indisponible
      </p>
    );
  }
  return (
    <img
      src={src}
      alt={item.title || item.description || 'Document'}
      className="block w-full h-full object-contain p-4"
      onError={() => setBroken(true)}
    />
  );
}

export default function ServiceProofCarousel({ items = [], kinds }) {
  const slides = (items || []).filter((row) => {
    if (!row?.file_url) return false;
    if (Array.isArray(kinds) && kinds.length) return kinds.includes(row.kind);
    return isCarouselProof(row) || isPaperImage(row);
  });
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides[index] || null;
  const isVideo = current?.kind === 'TESTIMONY';

  const go = (next) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2 || paused || isVideo) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, 5200);
    return () => clearInterval(timer);
  }, [count, paused, isVideo]);

  if (!count) return null;

  return (
    <div
      className="bg-white rounded-2xl p-4 space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative w-full overflow-hidden rounded-xl bg-[#132F45] aspect-video">
        {slides.map((item, i) => (
          <div
            key={item.id || `${item.kind}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}
          >
            <SlideMedia item={item} active={i === index} onPlay={() => setPaused(true)} />
          </div>
        ))}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Élément précédent"
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 text-ink shadow"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Élément suivant"
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 text-ink shadow"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {current?.title ? <p className="font-semibold text-ink">{current.title}</p> : null}
      {current?.description ? (
        <p className="text-sm text-ink-muted whitespace-pre-line">{current.description}</p>
      ) : null}
      {isVideo ? (
        <p className="text-xs text-ink-muted">Le son est activé. Utilisez le haut-parleur du lecteur si besoin.</p>
      ) : null}
      {count > 1 && (
        <div className="flex justify-center gap-2">
          {slides.map((item, i) => (
            <button
              key={item.id || i}
              type="button"
              aria-label={`Élément ${i + 1}`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-2 bg-border'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
