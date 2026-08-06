'use client';

/**
 * useAuth — ZIS authentication hook for Web 2.9.
 *
 * Checks login status via the local same-origin proxy `/api/auth/me`
 * (which forwards to ZIS with the `zion_session` SSO cookie).
 *
 * Usage:
 *   const { user, loading, authenticated, logout, refresh } = useAuth();
 */

import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, logout as zisLogout, type ZisUser } from '@/lib/zis';

export interface UseAuthResult {
  user: ZisUser | null;
  loading: boolean;
  error: string | null;
  authenticated: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<ZisUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const u = await getCurrentUser();
      setUser(u);
      setError(null);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const doLogout = useCallback(async () => {
    await zisLogout();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    authenticated: user !== null,
    refresh: checkAuth,
    logout: doLogout,
  };
}
