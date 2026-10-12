import React, { createContext, useContext, useState, useEffect } from 'react';
import api, {
  storageKeys,
  AUTH_EVENTS,
  clearAuthStorage,
  hasSessionHint,
  refreshAccessToken,
} from '../shared/api';
import { getHomePathForUser } from '../auth/roleAccess';

const AuthContext = createContext(null);

function purgeLegacyTokens() {
  ['alknet_token', 'alknet_refresh_token', 'alknet_user', storageKeys.token, storageKeys.refresh].forEach((key) => {
    localStorage.removeItem(key);
  });
}

purgeLegacyTokens();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(storageKeys.user);
      if (!savedUser) return null;
      return JSON.parse(savedUser);
    } catch {
      localStorage.removeItem(storageKeys.user);
      return null;
    }
  });
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    purgeLegacyTokens();
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(storageKeys.user, JSON.stringify(user));
    } else {
      localStorage.removeItem(storageKeys.user);
    }
  }, [user]);

  // Synchronise onglets : si un autre onglet change de compte, on aligne token + user
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === storageKeys.user) {
        try {
          setUser(event.newValue ? JSON.parse(event.newValue) : null);
          setToken(event.newValue ? 'session' : null);
        } catch {
          setUser(null);
          setToken(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Sync React state après refresh / logout déclenchés par api.ts
  useEffect(() => {
    const onTokenRefreshed = () => {
      setToken('session');
    };
    const onLogout = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener(AUTH_EVENTS.tokenRefreshed, onTokenRefreshed);
    window.addEventListener(AUTH_EVENTS.logout, onLogout);
    return () => {
      window.removeEventListener(AUTH_EVENTS.tokenRefreshed, onTokenRefreshed);
      window.removeEventListener(AUTH_EVENTS.logout, onLogout);
    };
  }, []);

  // Au chargement : rafraîchit un JWT expiré avant /profile/ (évite un 401 visible)
  useEffect(() => {
    // Visiteur non connecté : aucune requête. Sans ce garde, chaque premier
    // rendu partait sur /profile/ puis /refresh/, deux 401 pour rien.
    if (!hasSessionHint()) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const session = await refreshAccessToken();
        if (cancelled) return;
        if (!session) {
          setUser(null);
          setToken(null);
          return;
        }
        const profile = await api.get('accounts/profile/', { auth: true });
        if (cancelled) return;
        if (profile) {
          setUser(profile);
          setToken('session');
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await api.post('accounts/login/', { email, password });
      if (data?.two_factor_required) {
        setIsLoading(false);
        return data;
      }
      setToken('session');
      setUser(data.user);
      setIsLoading(false);
      return data.user;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const establishSession = async (user) => {
    setToken('session');
    if (user) setUser(user);
    return user;
  };

  const loginWithOAuthCode = async (code) => {
    const data = await api.post('accounts/oauth/exchange/', { code });
    return establishSession(data.user);
  };

  const refreshProfile = async () => {
    const profile = await api.get('accounts/profile/', { auth: true });
    setUser(profile);
    return profile;
  };

  const getRedirectPath = (userOrRole) => {
    if (typeof userOrRole === 'object' && userOrRole !== null) {
      return getHomePathForUser(userOrRole);
    }
    return '/dashboard';
  };

  const register = async (formData) => {
    setIsLoading(true);
    try {
      await api.post('accounts/register/', {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName || formData.first_name || '',
        last_name: formData.lastName || formData.last_name || '',
        phone_number: formData.phoneNumber || formData.phone_number || '',
      });
      return await login(formData.email, formData.password);
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const logout = () => {
    api.post('accounts/logout/', {}, { auth: true }).catch(() => {});
    setUser(null);
    setToken(null);
    clearAuthStorage();
  };

  const refreshSession = async () => {
    const ok = await refreshAccessToken();
    if (ok) setToken('session');
    else logout();
    return ok;
  };

  const authFetch = async (url, options = {}) => {
    const relativeUrl = url.startsWith('http://localhost:8000')
      ? url.replace('http://localhost:8000', '')
      : url;
    const headers = { ...options.headers };
    delete headers.Authorization;
    let response = await fetch(relativeUrl, { ...options, headers, credentials: 'same-origin' });
    if (response.status === 401) {
      const ok = await refreshAccessToken();
      if (ok) {
        response = await fetch(relativeUrl, { ...options, headers, credentials: 'same-origin' });
      }
    }
    return response;
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      establishSession,
      loginWithOAuthCode,
      register,
      logout,
      authFetch,
      refreshAccessToken: refreshSession,
      refreshProfile,
      getRedirectPath,
      updateUser: (next) => setUser((prev) => ({ ...prev, ...next })),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Évite un écran blanc si HMR / erreur parent démonte AuthProvider un instant
    if (import.meta.env.DEV) {
      console.warn('useAuth hors AuthProvider — rechargez la page (Ctrl+Shift+R).');
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        login: async () => { throw new Error('AuthProvider manquant — rechargez la page.'); },
        establishSession: async () => { throw new Error('AuthProvider manquant — rechargez la page.'); },
        loginWithOAuthCode: async () => { throw new Error('AuthProvider manquant — rechargez la page.'); },
        register: async () => { throw new Error('AuthProvider manquant — rechargez la page.'); },
        logout: () => {},
        authFetch: async () => new Response(null, { status: 401 }),
        refreshAccessToken: async () => null,
        refreshProfile: async () => null,
        getRedirectPath: () => '/login',
        updateUser: () => {},
      };
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
