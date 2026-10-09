import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('dk_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('dk_auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function verifyAuth() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
          localStorage.setItem('dk_auth_user', JSON.stringify(res.user));
        }
      } catch (err) {
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    verifyAuth();

    const handleAuthChange = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth_state_change', handleAuthChange);
    return () => window.removeEventListener('auth_state_change', handleAuthChange);
  }, [token]);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    if (res.success && res.token) {
      localStorage.setItem('dk_auth_token', res.token);
      localStorage.setItem('token', res.token);
      localStorage.setItem('dk_auth_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Giriş başarısız');
  };

  const logout = async () => {
    try {
      if (token) await api.post('/auth/logout', {});
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('dk_auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('dk_auth_user');
      setToken(null);
      setUser(null);
    }
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    if (user.roleId === 'super_admin') return true;
    return roles.includes(user.roleId);
  };

  const canEditClosedDay = () => {
    return hasRole('super_admin', 'business_admin');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
        canEditClosedDay,
      }}
    >
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
