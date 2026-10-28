import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';

function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function MemberPortrait({ member }) {
  const [broken, setBroken] = useState(false);
  const src = member?.photo_url || '';
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={member.name || 'Membre de l’équipe'}
        className="block w-full h-full object-contain p-4"
        onError={() => setBroken(true)}
      />
    );
  }
  const label = initials(member?.name);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {label ? (
        <span className="text-4xl font-bold text-white/90">{label}</span>
      ) : (
        <User className="w-16 h-16 text-white/80" />
      )}
    </div>
  );
}

export default function ServiceTeamCarousel({ members = [] }) {
  const slides = (members || []).filter((row) => row?.name);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides[index] || null;

  const go = (next) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

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
      className="bg-white rounded-2xl p-4 space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative w-full overflow-hidden rounded-xl bg-[#132F45] aspect-[4/3]">
        {slides.map((member, i) => (
          <div
            key={member.id || `${member.name}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'}`}
          >
            <MemberPortrait member={member} />
          </div>
        ))}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Membre précédent"
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 text-ink"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Membre suivant"
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 text-ink"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {current?.name ? <p className="font-semibold text-ink">{current.name}</p> : null}
      {current?.role_title ? <p className="text-sm text-primary">{current.role_title}</p> : null}
      {current?.qualifications ? (
        <p className="text-sm text-ink whitespace-pre-line">{current.qualifications}</p>
      ) : null}
      {current?.experience ? (
        <p className="text-sm text-ink-muted whitespace-pre-line">{current.experience}</p>
      ) : null}
      {count > 1 && (
        <div className="flex justify-center gap-2">
          {slides.map((member, i) => (
            <button
              key={member.id || i}
              type="button"
              aria-label={`Membre ${i + 1}`}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-2 bg-border'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
