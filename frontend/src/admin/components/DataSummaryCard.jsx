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
    <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-lg p-5 flex flex-col transition-all hover:border-gray-300 dark:hover:border-gray-700">
      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {value}
        </span>
        
        {trend && (
          <div className="flex items-center gap-1">
            <span className={`flex items-center text-xs font-medium ${
              isPositive ? 'text-emerald-600 dark:text-emerald-500' : 
              isNegative ? 'text-red-600 dark:text-red-500' : 
              'text-gray-500 dark:text-gray-400'
            }`}>
              {isPositive && <TrendingUp className="w-3 h-3 mr-1" />}
              {isNegative && <TrendingDown className="w-3 h-3 mr-1" />}
              {isNeutral && <Minus className="w-3 h-3 mr-1" />}
              {trendValue}
            </span>
          </div>
        )}
      </div>
      {trendLabel && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
          {trendLabel}
        </p>
      )}
    </div>
  );
}
