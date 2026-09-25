import React from 'react';

export const fieldClass =
  'w-full px-3 py-2.5 text-sm bg-surface border-2 border-accent/50 rounded-xl text-ink font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export const btnPrimary =
  'px-4 py-2.5 text-sm font-bold bg-primary text-white rounded-xl border-2 border-accent hover:opacity-95 disabled:opacity-50 transition shadow-sm';

export const btnGhost =
  'px-3 py-2 text-sm font-bold text-ink rounded-xl border-2 border-accent/60 hover:bg-accent/10 hover:border-accent transition';

/** Bouton icône seul — bordure Accent squircle (voir .icon-btn dans index.css). */
export const btnIcon = 'icon-btn';

export const btnIconDanger = 'icon-btn icon-btn--danger';

export function HotelPage({ title, subtitle, actions, children }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="text-sm text-ink-muted mt-1 font-medium">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ children, className = '' }) {
  return (
    <div className={`bg-surface border-2 border-accent/40 rounded-2xl p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="bg-surface border-2 border-accent rounded-2xl p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-2xl font-extrabold text-primary mt-1">{value}</p>
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="text-sm text-ink-muted font-medium py-6 text-center">{children}</p>;
}
