import React from 'react';

export default function Logo({ className = "", isDark = false }) {
  // Vert Feuille for light mode, Gold for dark mode (as specified in the design system showcase)
  const strokeColor = isDark ? "#C98A2E" : "#1F4D3D";
  const textColorClass = isDark ? "text-white" : "text-green-900";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="shrink-0">
        <path 
          d="M20 3L35 11V29L20 37L5 29V11L20 3Z" 
          stroke={strokeColor} 
          strokeWidth="2.2"
        />
        <circle cx="20" cy="20" r="6" fill="#C98A2E"/>
      </svg>
      <span className={`font-display font-bold text-xl tracking-tight ${textColorClass}`}>
        Isoko Hub
      </span>
    </div>
  );
}
