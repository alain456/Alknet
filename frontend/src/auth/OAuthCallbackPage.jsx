import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getRedirectPath, loginWithTokens } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const oauthError = searchParams.get('error');
    const access = searchParams.get('access');
    const refresh = searchParams.get('refresh');
    const next = searchParams.get('next') || '';

    if (oauthError) {
      setError(oauthError);
      return;
    }
    if (!access) {
      setError('Connexion sociale incomplète. Réessayez.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profile = await loginWithTokens({ access, refresh });
        if (cancelled) return;
        const dest = (next.startsWith('/') && !next.startsWith('//'))
          ? next
          : getRedirectPath(profile);
        navigate(dest, { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Impossible de finaliser la connexion sociale.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [searchParams, navigate, getRedirectPath, loginWithTokens]);

  if (error) {
    return (
      <div className="w-full text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Connexion sociale échouée</h2>
        <p className="text-sm text-red-600 dark:text-red-400 mb-6 max-w-md mx-auto">{error}</p>
        <Link
          to="/login"
          className="inline-block w-full bg-primary hover:bg-secondary text-white font-semibold py-2.5 rounded-md shadow-sm transition"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full text-center py-12">
      <svg className="animate-spin h-10 w-10 text-primary mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="text-gray-600 dark:text-gray-400">Finalisation de la connexion…</p>
    </div>
  );
}
