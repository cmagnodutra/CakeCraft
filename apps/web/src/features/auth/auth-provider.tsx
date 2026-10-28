'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { fetchCurrentUser, logoutUser } from '@/lib/api/auth';
import type { AuthUser } from '@/lib/api/auth';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const DEFAULT_AUTH_CONTEXT: AuthContextValue = {
  user: null,
  isLoading: false,
  setUser: () => undefined,
  refreshUser: () => Promise.resolve(null),
  logout: () => Promise.resolve(),
};

const AuthContext = createContext<AuthContextValue>(DEFAULT_AUTH_CONTEXT);

/**
 * Estado global de sessao mantido EXCLUSIVAMENTE em memoria React (decisao de
 * seguranca do RFC: zero tokens ou dados de sessao em localStorage).
 * Ao montar, consulta GET /api/auth/me (que envia o cookie httpOnly).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Contador monotonico para descartar respostas atrasadas de /auth/me caso o
  // usuario faca login ou logout antes da hidratacao inicial terminar.
  const versionRef = useRef(0);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    versionRef.current += 1;
    setUserState(nextUser);
    setIsLoading(false);
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const requestVersion = ++versionRef.current;
    try {
      const current = await fetchCurrentUser();
      if (versionRef.current === requestVersion) {
        setUserState(current);
      }
      return current;
    } catch {
      if (versionRef.current === requestVersion) {
        setUserState(null);
      }
      return null;
    } finally {
      if (versionRef.current === requestVersion) {
        setIsLoading(false);
      }
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    versionRef.current += 1;
    try {
      await logoutUser();
    } catch {
      // Mesmo sem rede, limpamos a sessao local para nao prender o usuario.
    } finally {
      setUserState(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const requestVersion = ++versionRef.current;

    fetchCurrentUser()
      .then((current) => {
        if (active && versionRef.current === requestVersion) {
          setUserState(current);
        }
      })
      .catch(() => {
        if (active && versionRef.current === requestVersion) {
          setUserState(null);
        }
      })
      .finally(() => {
        if (active && versionRef.current === requestVersion) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, setUser, refreshUser, logout }),
    [user, isLoading, setUser, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
