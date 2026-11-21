import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getStoredToken, setStoredToken } from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  theme: 'light' | 'dark';
  density: 'compact' | 'comfortable';
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
    inviteToken?: string
  ) => Promise<void>;
  logout: () => void;
  updateUserLocal: (user: User) => void;
  setAppearance: (prefs: { theme?: 'light' | 'dark'; density?: 'compact' | 'comfortable' }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('trackly_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => {
    const saved = localStorage.getItem('trackly_density');
    return saved === 'comfortable' ? 'comfortable' : 'compact';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('trackly_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('trackly_density', density);
  }, [density]);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('trackly:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('trackly:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.auth
      .me()
      .then(({ user: fetched }) => {
        setUser(fetched);
        if (fetched.appearancePrefs?.theme) {
          setTheme(fetched.appearancePrefs.theme);
        }
        if (fetched.appearancePrefs?.density) {
          setDensity(fetched.appearancePrefs.density);
        }
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, remember = true) => {
    const { token, user: loggedUser } = await api.auth.login({ email, password });
    setStoredToken(token, remember);
    setUser(loggedUser);
    if (loggedUser.appearancePrefs?.theme) setTheme(loggedUser.appearancePrefs.theme);
    if (loggedUser.appearancePrefs?.density) setDensity(loggedUser.appearancePrefs.density);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
    inviteToken?: string
  ) => {
    const { token, user: newUser } = await api.auth.register({
      name,
      email,
      password,
      confirmPassword,
      inviteToken,
    });
    setStoredToken(token, true);
    setUser(newUser);
    if (newUser.appearancePrefs?.theme) setTheme(newUser.appearancePrefs.theme);
    if (newUser.appearancePrefs?.density) setDensity(newUser.appearancePrefs.density);
  };

  const updateUserLocal = (updated: User) => {
    setUser(updated);
  };

  const setAppearance = async (prefs: {
    theme?: 'light' | 'dark';
    density?: 'compact' | 'comfortable';
  }) => {
    const nextTheme = prefs.theme ?? theme;
    const nextDensity = prefs.density ?? density;
    setTheme(nextTheme);
    setDensity(nextDensity);
    if (user) {
      const { user: updated } = await api.auth.updateProfile({
        appearancePrefs: { theme: nextTheme, density: nextDensity },
      });
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        theme,
        density,
        login,
        register,
        logout,
        updateUserLocal,
        setAppearance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
