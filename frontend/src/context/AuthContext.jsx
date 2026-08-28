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

  const getRedirectPath = (userOrRole) => {
    // Si un objet user est passé
    if (typeof userOrRole === 'object' && userOrRole !== null) {
      const { role, staff_category, system_access_level, email, business_info, is_superuser } = userOrRole;
      const userEmail = (email || '').toLowerCase();
      const category = (staff_category || '').toUpperCase();
      const accessLevel = (system_access_level || '').toUpperCase();
      const roleName = (business_info?.role_name || '').toLowerCase();

      // 1. Super Admin
      if (role === 'SUPER_ADMIN' || is_superuser) {
        return '/admin';
      }

      // 2. Hospital / Business Admin & Owner
      if (
        role === 'BUSINESS_OWNER' ||
        accessLevel.includes('ADMIN') ||
        accessLevel.includes('ALL') ||
        category === 'ADMIN' ||
        category === 'DIRECTION' ||
        category === 'GESTONNAIRE' ||
        roleName.includes('admin') ||
        roleName.includes('propriétaire') ||
        roleName.includes('directeur') ||
        userEmail.includes('admin')
      ) {
        return '/hospital/admin';
      }

      // 3. Hospital Staff Roles
      if (role === 'PROFESSIONAL' || category || accessLevel) {
        if (accessLevel === 'RECEPTIONIST_ACCESS' || category === 'RECEPTIONIST' || category === 'ACCUEIL' || userEmail.includes('accueil') || userEmail.includes('reception')) {
          return '/hospital/staff/receptionist';
        }
        if (accessLevel === 'LAB_ACCESS' || category === 'LAB' || category === 'LABORANTIN' || userEmail.includes('labo') || userEmail.includes('lab')) {
          return '/hospital/staff/lab-technician';
        }
        if (accessLevel === 'CASHIER_ACCESS' || category === 'CASHIER' || category === 'CAISSE' || userEmail.includes('caissier') || userEmail.includes('cashier')) {
          return '/hospital/staff/cashier';
        }
        if (category === 'NURSE' || category === 'INFIRMIER' || userEmail.includes('infirmier') || userEmail.includes('nurse')) {
          return '/hospital/staff/nurse';
        }
        if (category === 'DOCTOR' || category === 'SPECIALIST' || category === 'MEDECIN' || userEmail.includes('medecin') || userEmail.includes('doctor')) {
          return '/hospital/staff/doctor';
        }
        // Fallback for professionals: default to hospital admin dashboard if role is unknown
        return '/hospital/admin';
      }
      return '/dashboard';
    }

    // Si une string role est passée
    switch (userOrRole) {
      case 'SUPER_ADMIN':
        return '/admin';
      case 'BUSINESS_OWNER':
        return '/hospital/admin';
      case 'PROFESSIONAL':
        return '/hospital/admin';
      case 'CUSTOMER':
        return '/dashboard';
      default:
        return '/dashboard';
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

  // Variable globale pour éviter les requêtes de rafraîchissement multiples simultanées
  let refreshPromise = null;

  /**
   * Tente de renouveler l'access token via le refresh token.
   * Utilise une promesse partagée pour éviter les appels concurrents.
   * Retourne le nouvel access token ou null si échec.
   */
  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('alknet_refresh_token');
    if (!refreshToken) return null;

    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
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
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
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
      getRedirectPath,
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
