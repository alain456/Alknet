import React from 'react';
import useSiteContent from '../useSiteContent';

/** Palette logo : bleu ISOKO, vert HUB */
const PRIMARY = '#1B4F9C';
const ACCENT = '#1E8B4A';

export default function Logo({ className = '', isDark = false, showText = true }) {
  const { settings } = useSiteContent();
  const brand = settings?.brand_name || 'Isoko Hub';
  const logo = settings?.platform_logo || '';
  const strokeColor = isDark ? ACCENT : PRIMARY;
  const textColorClass = isDark ? 'text-surface' : 'text-primary';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {logo ? (
        <img
          src={logo}
          alt={brand}
          className="h-8 w-8 object-contain rounded shrink-0"
        />
      ) : (
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="shrink-0">
          <path
            d="M20 3L35 11V29L20 37L5 29V11L20 3Z"
            stroke={strokeColor}
            strokeWidth="2.2"
          />
          <circle cx="20" cy="20" r="6" fill={ACCENT} />
        </svg>
      )}
      {showText && (
        <span className={`font-display font-bold text-xl tracking-tight ${textColorClass}`}>
          {brand}
        </span>
      )}
    </div>
  );
}
