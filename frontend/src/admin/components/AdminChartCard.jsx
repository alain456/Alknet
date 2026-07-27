import React from 'react';

export default function AdminChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-lg p-5 flex flex-col w-full">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
      
      <div className="flex-1 w-full relative min-h-[200px]">
        {children ? (
          children
        ) : (
          <div className="absolute inset-0 flex items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded">
            <span className="text-xs text-gray-400 dark:text-gray-600 font-medium">Chart visualization placeholder</span>
          </div>
        )}
      </div>
    </div>
  );
}
