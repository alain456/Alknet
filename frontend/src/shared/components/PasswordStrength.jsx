import React from 'react';

export default function PasswordStrength({ password }) {
  const getStrength = (pass) => {
    let score = 0;
    if (!pass) return score;
    if (pass.length > 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const score = getStrength(password);
  
  const getLabel = () => {
    if (score === 0) return 'Very weak';
    if (score === 1) return 'Weak';
    if (score === 2) return 'Fair';
    if (score === 3) return 'Good';
    return 'Strong';
  };

  const getColor = () => {
    if (score <= 1) return 'bg-red-500';
    if (score === 2) return 'bg-yellow-500';
    if (score === 3) return 'bg-primary';
    return 'bg-green-500';
  };

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">Password strength</span>
        <span className={`text-xs font-semibold ${score > 2 ? 'text-primary dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {password ? getLabel() : ''}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden flex gap-1">
        <div className={`h-full transition-all duration-300 w-1/4 ${score >= 1 ? getColor() : 'bg-transparent'}`}></div>
        <div className={`h-full transition-all duration-300 w-1/4 ${score >= 2 ? getColor() : 'bg-transparent'}`}></div>
        <div className={`h-full transition-all duration-300 w-1/4 ${score >= 3 ? getColor() : 'bg-transparent'}`}></div>
        <div className={`h-full transition-all duration-300 w-1/4 ${score >= 4 ? getColor() : 'bg-transparent'}`}></div>
      </div>
    </div>
  );
}
