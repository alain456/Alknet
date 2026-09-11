import React, { createContext, useContext, useState, useEffect } from 'react';
import api, {
  storageKeys,
  AUTH_EVENTS,
  setToken as storeToken,
  setRefreshToken,
  clearAuthStorage,
  getToken,
  getRefreshToken,
} from '../shared/api';
import { getHomePathForUser } from '../auth/roleAccess';

const AuthContext = createContext(null);

/** Migration des anciennes clés AlkNet vers Isoko Hub */
function migrateLegacyStorage() {
  const legacyMap = [
    ['alknet_token', storageKeys.token],
    ['alknet_refresh_token', storageKeys.refresh],
    ['alknet_user', storageKeys.user],
  ];
  legacyMap.forEach(([oldKey, newKey]) => {
    const val = localStorage.getItem(oldKey);
    if (val && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, val);
    }
    localStorage.removeItem(oldKey);
  });
}

migrateLegacyStorage();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem(storageKeys.user);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => getToken());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    storeToken(token);
  }, [token]);

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
      if (!event.key) return;
      if (event.key === storageKeys.token) {
        setToken(event.newValue);
      }
      if (event.key === storageKeys.user) {
        try {
          setUser(event.newValue ? JSON.parse(event.newValue) : null);
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Sync React state après refresh / logout déclenchés par api.ts
  useEffect(() => {
    const onTokenRefreshed = (event) => {
      const access = event?.detail?.access;
      if (access) setToken(access);
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

  // Au chargement : resynchronise le profil avec le JWT (évite user local ≠ token)
  useEffect(() => {
    const access = getToken();
    if (!access) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const profile = await api.get('accounts/profile/', { auth: true });
        if (cancelled) return;
        // Aligner le state React si le refresh a mis à jour localStorage
        const latest = getToken();
        if (latest) setToken(latest);
        if (profile) setUser(profile);
      } catch {
        if (!cancelled && !getToken()) {
          setUser(null);
          setToken(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await api.post('accounts/login/', { email, password });
      setToken(data.access);
      if (data.refresh) setRefreshToken(data.refresh);
      setUser(data.user);
      setIsLoading(false);
      return data.user;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const loginWithTokens = async ({ access, refresh }) => {
    setToken(access);
    storeToken(access);
    if (refresh) setRefreshToken(refresh);
    const profile = await api.get('accounts/profile/', { auth: true });
    setUser(profile);
    return profile;
  };

  const getRedirectPath = (userOrRole) => {
    if (typeof userOrRole === 'object' && userOrRole !== null) {
      return getHomePathForUser(userOrRole);
    }
    switch (userOrRole) {
      case 'SUPER_ADMIN': return '/admin';
      case 'BUSINESS_OWNER': return '/hospital/admin';
      case 'PROFESSIONAL': return '/hospital/staff/doctor';
      case 'CUSTOMER': return '/dashboard';
      default: return '/dashboard';
    }
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
    setUser(null);
    setToken(null);
    clearAuthStorage();
  };

  const refreshAccessToken = async () => {
    const refresh = getRefreshToken();
    if (!refresh) return null;
    try {
      const data = await api.post('accounts/refresh/', { refresh }, { skipRefresh: true });
      setToken(data.access);
      if (data.refresh) setRefreshToken(data.refresh);
      return data.access;
    } catch {
      logout();
      return null;
    }
  };

  const authFetch = async (url, options = {}) => {
    // Toujours lire localStorage (pas le state React, souvent périmé après refresh)
    const currentToken = getToken();
    const relativeUrl = url.startsWith('http://localhost:8000')
      ? url.replace('http://localhost:8000', '')
      : url;
    const headers = {
      ...options.headers,
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    };
    let response = await fetch(relativeUrl, { ...options, headers });
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await fetch(relativeUrl, {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
        });
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
      loginWithTokens,
      register,
      logout,
      authFetch,
      refreshAccessToken,
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
