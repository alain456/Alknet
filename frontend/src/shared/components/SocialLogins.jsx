import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';

const PROVIDERS = [
  {
    key: 'google',
    label: 'Google',
    icon: (
      <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" className="h-5 w-5" />
    ),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: (
      <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="" className="h-5 w-5" />
    ),
  },
  {
    key: 'github',
    label: 'GitHub',
    icon: (
      <svg className="h-5 w-5 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function SocialLogins({ nextPath }) {
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('accounts/oauth/providers/');
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const resolveNext = () => {
    if (nextPath && nextPath.startsWith('/')) return nextPath;
    const from = location.state?.from;
    if (typeof from === 'string' && from.startsWith('/')) return from;
    if (location.pathname === '/register') return '/dashboard';
    return '/dashboard';
  };

  const startOAuth = (providerKey) => {
    setError('');
    const configured = status?.[providerKey]?.configured;
    if (status && !configured) {
      setError(
        `${providerKey.charAt(0).toUpperCase() + providerKey.slice(1)} n'est pas configuré. `
        + 'Ajoutez les clés OAuth dans le fichier .env du serveur.',
      );
      return;
    }
    setBusy(providerKey);
    const next = encodeURIComponent(resolveNext());
    // Redirection directe vers le backend (callback OAuth doit être sur BACKEND_URL)
    const backend = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '') || '';
    const startPath = `/api/v1/accounts/oauth/${providerKey}/start/?next=${next}`;
    window.location.href = backend ? `${backend}${startPath}` : startPath;
  };

  return (
    <div>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            Or continue with
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 text-xs rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const configured = !status || status[p.key]?.configured;
          return (
            <button
              key={p.key}
              type="button"
              disabled={!!busy}
              onClick={() => startOAuth(p.key)}
              title={configured ? `Continuer avec ${p.label}` : `${p.label} non configuré`}
              aria-label={`Continuer avec ${p.label}`}
              className={
                'flex justify-center items-center p-2 border rounded-md transition cursor-pointer '
                + (configured
                  ? 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-60')
                + (busy === p.key ? ' opacity-70' : '')
              }
            >
              {p.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
