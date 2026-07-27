import React from 'react';

export default function MetricCard({ title, value, prefix, suffix, trend, trendUp, data }) {
  // Simple sparkline representation
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-gray-500 dark:text-gray-400 font-medium text-sm">{title}</h3>
        {trend && (
          <div className={`flex items-center text-xs font-semibold ${trendUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trendUp ? (
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
            ) : (
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
            )}
            {trend}
          </div>
        )}
      </div>
      
      <div className="flex items-baseline mb-6">
        {prefix && <span className="text-gray-500 dark:text-gray-400 font-semibold mr-1">{prefix}</span>}
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
        {suffix && <span className="text-gray-500 dark:text-gray-400 font-medium ml-1 text-sm">{suffix}</span>}
      </div>

      <div className="h-10 flex items-end gap-1 w-full opacity-70">
        {data.map((val, i) => {
          const height = `${((val - min) / range) * 100}%`;
          return (
            <div 
              key={i} 
              className={`w-full rounded-t-sm ${trendUp ? 'bg-primary dark:bg-teal-500' : 'bg-accent dark:bg-yellow-500'}`} 
              style={{ height: height === '0%' ? '10%' : height }}
            ></div>
          );
        })}
      </div>
    </div>
  );
}
