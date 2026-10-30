'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getChallenge, getCurrentUser, logout as zisLogout, verifyEd25519, type ZisUser } from '@/lib/zis';
import { deriveWalletFromMnemonic, signMessage } from '@/lib/zionWallet';

interface AuthState {
  user: ZisUser | null;
  loading: boolean;
  authenticated: boolean;
  refresh: () => Promise<void>;
  login: (mnemonic: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ZisUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getCurrentUser();
    setUser(next);
  }, []);

  useEffect(() => {
    let live = true;
    getCurrentUser()
      .then((next) => {
        if (live) setUser(next);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const login = useCallback(async (mnemonic: string) => {
    const wallet = deriveWalletFromMnemonic(mnemonic);
    const challenge = await getChallenge(wallet.address);
    const signature = signMessage(wallet.privateKeySeed, challenge);
    await verifyEd25519(wallet.address, wallet.publicKey, signature);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await zisLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authenticated: user != null, refresh, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
