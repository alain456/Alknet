import React from 'react';

export default function AdminChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-[10px] p-6 flex flex-col w-full shadow-sm">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-green-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-[13px] text-ink-muted dark:text-green-100/70 mt-1">{subtitle}</p>
        )}
      </div>
      
      <div className="flex-1 w-full relative min-h-50">
        {children ? (
          children
        ) : (
          <div className="absolute inset-0 flex items-center justify-center border border-dashed border-border dark:border-white/20 rounded-md">
            <span className="text-[11px] text-ink-faint dark:text-green-100/40 font-mono font-medium uppercase tracking-[0.06em]">Chart visualization placeholder</span>
          </div>
        )}
      </div>
    </div>
  );
}
