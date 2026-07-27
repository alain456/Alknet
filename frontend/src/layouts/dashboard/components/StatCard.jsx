import React from 'react';

export default function StatCard({ title, value, icon: Icon, trend, trendUp }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-primary dark:text-teal-400">
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${trendUp ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {trendUp ? '+' : '-'}{trend}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-gray-500 dark:text-gray-400 font-medium text-sm mb-1">{title}</h3>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      </div>
    </div>
  );
}
