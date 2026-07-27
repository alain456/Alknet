import React from 'react';
import { Star } from 'lucide-react';

export default function ServiceCard({ title, provider, rating, reviews, price, category, imagePlaceholder }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group cursor-pointer flex flex-col">
      <div className={`h-32 ${imagePlaceholder} relative`}>
        <div className="absolute top-3 left-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-md text-gray-700 dark:text-gray-300 shadow-sm">
          {category}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary transition">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{provider}</p>
        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-3">
          <Star className="w-3.5 h-3.5 text-accent fill-accent mr-1" />
          <span className="font-medium text-gray-800 dark:text-gray-200 mr-1">{rating}</span> ({reviews})
        </div>
        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">Starting at</span>
          <span className="font-bold text-gray-900 dark:text-white">{price}</span>
        </div>
      </div>
    </div>
  );
}
