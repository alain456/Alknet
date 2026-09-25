import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Champ mot de passe avec bascule afficher / masquer.
 * Accepte les mêmes props qu'un <input>, plus className.
 */
export default function PasswordInput({
  className = '',
  toggleClassName = '',
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`w-full pr-10 text-ink bg-surface ${className}`.trim()}
        autoComplete={props.autoComplete || 'current-password'}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        title={visible ? 'Masquer' : 'Afficher'}
        className={
          toggleClassName
          || 'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition cursor-pointer'
        }
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
