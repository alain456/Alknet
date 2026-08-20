import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('alknet_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('alknet_token') || null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('alknet_token', token);
    } else {
      localStorage.removeItem('alknet_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('alknet_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('alknet_user');
    }
  }, [user]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/accounts/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.non_field_errors?.[0] || 'Invalid credentials');
      }

      const data = await response.json();
      setToken(data.access);
      if (data.refresh) {
        localStorage.setItem('alknet_refresh_token', data.refresh);
      }
      setUser(data.user);
      setIsLoading(false);
      return data.user;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const register = async (formData) => {
    setIsLoading(true);
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName || formData.first_name || '',
        last_name: formData.lastName || formData.last_name || '',
        phone_number: formData.phoneNumber || formData.phone_number || '',
        role: formData.role || 'CUSTOMER',
      };

      const response = await fetch('/api/v1/accounts/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const firstErrorKey = Object.keys(errorData)[0];
        const errorMsg = Array.isArray(errorData[firstErrorKey])
          ? `${firstErrorKey}: ${errorData[firstErrorKey][0]}`
          : 'Registration failed';
        throw new Error(errorMsg);
      }

      // Automatically login after successful registration
      return await login(formData.email, formData.password);
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('alknet_token');
    localStorage.removeItem('alknet_refresh_token');
    localStorage.removeItem('alknet_user');
  };

  /**
   * Tente de renouveler l'access token via le refresh token.
   * Retourne le nouvel access token ou null si échec.
   */
  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('alknet_refresh_token');
    if (!refreshToken) return null;

    try {
      const res = await fetch('/api/v1/accounts/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        const newToken = data.access;
        setToken(newToken);
        localStorage.setItem('alknet_token', newToken);
        return newToken;
      } else {
        // Refresh token invalide ou expiré → déconnexion
        logout();
        return null;
      }
    } catch {
      logout();
      return null;
    }
  };

  /**
   * Fonction fetch avec gestion automatique du 401.
   * En cas de 401, tente un refresh du token puis réessaie la requête.
   * Usage : const res = await authFetch(url, options);
   */
  const authFetch = async (url, options = {}) => {
    const currentToken = localStorage.getItem('alknet_token');
    const headers = {
      ...options.headers,
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
    };

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      // Tentative de rafraîchissement du token
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Réessai avec le nouveau token
        response = await fetch(url, {
          ...options,
          headers: { ...options.headers, 'Authorization': `Bearer ${newToken}` },
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
      register,
      logout,
      authFetch,
      refreshAccessToken,
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
