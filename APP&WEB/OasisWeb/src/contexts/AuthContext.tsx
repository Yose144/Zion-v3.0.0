'use client';

/**
 * AuthContext — ZIS-backed authentication for OASIS Web.
 *
 * Uses the player's ZION wallet (12-word BIP39 mnemonic) to sign a ZIS
 * challenge and establish an SSO `zion_session` cookie for OASIS.
 *
 * The actual HTTP calls are routed through the same-origin nginx proxy
 * (`/api/auth/*`) so the httpOnly cookie can be set and sent without CORS.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  getChallenge,
  verifyEd25519,
  getCurrentUser,
  logout as zisLogout,
  type ZisUser,
} from '@/lib/zis';
import { deriveWalletFromMnemonic, signMessage } from '@/lib/zionWallet';

export interface AuthUser {
  id?: string;
  address: string;
  displayName: string | null;
  email?: string | null;
  avatar?: string | null;
  bio?: string | null;
  role?: string;
  createdAt?: number;
  lastLogin?: number;
  loginCount?: number;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
  /** Check session status (called on mount) */
  checkSession: () => Promise<void>;
  /** Log in with a 12-word BIP39 mnemonic */
  loginWithMnemonic: (mnemonic: string) => Promise<void>;
  /** Log out */
  logout: () => Promise<void>;
  /** Refresh the current user */
  refresh: () => Promise<void>;
}

const defaultState: AuthState = {
  user: null,
  loading: true,
  authenticated: false,
  checkSession: async () => {},
  loginWithMnemonic: async () => {},
  logout: async () => {},
  refresh: async () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

function zisToAuthUser(zisUser: ZisUser | null): AuthUser | null {
  if (!zisUser) return null;
  return {
    id: zisUser.id,
    address: zisUser.primaryAddress,
    displayName: zisUser.displayName ?? null,
    email: zisUser.email ?? null,
    avatar: zisUser.avatar ?? null,
    bio: zisUser.bio ?? null,
    role: zisUser.role,
    createdAt: zisUser.createdAt ? new Date(zisUser.createdAt).getTime() : undefined,
    lastLogin: zisUser.lastLogin ? new Date(zisUser.lastLogin).getTime() : undefined,
    loginCount: zisUser.loginCount,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const zisUser = await getCurrentUser();
      setUser(zisToAuthUser(zisUser));
    } catch (e) {
      setUser(null);
    }
  }, []);

  const checkSession = useCallback(async () => {
    setLoading(true);
    await refresh();
    setLoading(false);
  }, [refresh]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const loginWithMnemonic = useCallback(async (mnemonic: string) => {
    setLoading(true);
    try {
      // 1. Derive the ZION wallet from the mnemonic.
      const wallet = deriveWalletFromMnemonic(mnemonic.trim());

      // 2. Request a ZIS challenge for the ZION L1 address.
      const { challenge } = await getChallenge(wallet.address, 'zion-l1');

      // 3. Sign the challenge with the private key seed.
      const signature = signMessage(wallet.privateKeySeed, challenge);

      // 4. Verify with ZIS through the same-origin proxy.
      //    On success ZIS sets the `zion_session` SSO cookie.
      await verifyEd25519(wallet.address, wallet.publicKey, signature);

      // 5. Fetch the full user record (using the freshly set cookie).
      const fullUser = await getCurrentUser();
      setUser(zisToAuthUser(fullUser));
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await zisLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticated: !!user,
        checkSession,
        loginWithMnemonic,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
