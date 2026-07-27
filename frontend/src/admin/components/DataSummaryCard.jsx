import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function DataSummaryCard({ 
  title, 
  value, 
  trend, 
  trendValue, 
  trendLabel = "vs last month" 
}) {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';
  const isNeutral = trend === 'neutral';

  return (
    <div className="bg-surface dark:bg-[#1A2E25] border border-border dark:border-white/10 rounded-[10px] p-5 flex flex-col transition-all hover:shadow-md dark:hover:border-gold-600/30">
      <h3 className="text-[13px] font-semibold text-ink-muted dark:text-green-100/70 mb-1">{title}</h3>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-2xl font-mono font-medium tracking-tight text-green-900 dark:text-white">
          {value}
        </span>
        
        {trend && (
          <div className="flex items-center gap-1">
            <span className={`flex items-center text-[12px] font-medium ${
              isPositive ? 'text-success dark:text-[#3E9F6A]' : 
              isNegative ? 'text-error dark:text-[#E56353]' : 
              'text-ink-faint dark:text-green-100/50'
            }`}>
              {isPositive && <TrendingUp className="w-3.5 h-3.5 mr-1" strokeWidth={2} />}
              {isNegative && <TrendingDown className="w-3.5 h-3.5 mr-1" strokeWidth={2} />}
              {isNeutral && <Minus className="w-3.5 h-3.5 mr-1" strokeWidth={2} />}
              {trendValue}
            </span>
          </div>
        )}
      </div>
      {trendLabel && (
        <p className="text-[11.5px] text-ink-faint dark:text-green-100/40 mt-2">
          {trendLabel}
        </p>
      )}
    </div>
  );
}
