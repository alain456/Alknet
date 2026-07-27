import React from 'react';
import { Star } from 'lucide-react';

export default function ReviewCard({ name, avatar, rating, date, content, service }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <img src={avatar} alt={name} className="w-10 h-10 rounded-full bg-gray-200" />
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{name}</h4>
            <div className="text-xs text-gray-500 dark:text-gray-400">{date}</div>
          </div>
        </div>
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-4 h-4 ${i < rating ? 'text-accent fill-accent' : 'text-gray-300 dark:text-gray-700'}`} />
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{content}</p>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
        Service: <span className="font-semibold text-gray-700 dark:text-gray-300">{service}</span>
      </div>
    </div>
  );
}
