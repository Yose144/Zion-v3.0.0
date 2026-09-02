'use client';

/**
 * AuthContext — ZIS-backed authentication for the ZION MarketPlace.
 *
 * Uses SIWE (Sign-In with Ethereum) via the connected wagmi wallet.
 * The session is stored in an httpOnly SSO cookie (`zion_session`) issued
 * by ZIS and scoped to `.zionterranova.com` — shared with app/oasis/dashboard.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import {
  getChallenge,
  verifySiwe,
  getCurrentUser as zisGetCurrentUser,
  logout as zisLogout,
  updateProfile as zisUpdateProfile,
  type ZisUser,
} from '@/lib/zis-client';

export interface MarketAuthUser {
  id: string;
  address: string;
  displayName: string | null;
  email?: string | null;
  avatar?: string | null;
  role?: string;
  loginCount?: number;
  lastLogin?: string | null;
}

interface AuthState {
  user: MarketAuthUser | null;
  loading: boolean;
  authenticated: boolean;
  /** Check session status (called on mount) */
  checkSession: () => Promise<void>;
  /** Login with SIWE using the connected wagmi wallet */
  loginWithSiwe: () => Promise<void>;
  /** Logout from ZIS (also disconnects wagmi) */
  logout: () => Promise<void>;
  /** Update display name */
  updateProfile: (displayName: string) => Promise<void>;
}

const defaultState: AuthState = {
  user: null,
  loading: true,
  authenticated: false,
  checkSession: async () => {},
  loginWithSiwe: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

function zisToAuthUser(zisUser: ZisUser | null): MarketAuthUser | null {
  if (!zisUser) return null;
  return {
    id: zisUser.id,
    address: zisUser.primaryAddress,
    displayName: zisUser.displayName ?? null,
    email: zisUser.email ?? null,
    avatar: zisUser.avatar ?? null,
    role: zisUser.role,
    loginCount: zisUser.loginCount,
    lastLogin: zisUser.lastLogin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MarketAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const checkSession = useCallback(async () => {
    try {
      const zisUser = await zisGetCurrentUser();
      setUser(zisToAuthUser(zisUser));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const loginWithSiwe = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error('Wallet not connected');
    }

    // 1. Get ZIS challenge for the EVM address.
    const { challenge } = await getChallenge(address, 'evm');
    const nonceMatch = challenge.match(/nonce: ([^\n]+)/i);
    const nonce = nonceMatch?.[1];
    if (!nonce) throw new Error('No nonce in challenge');

    // 2. Build a SIWE message (EIP-4361).
    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const host = typeof window !== 'undefined' ? window.location.host : 'market.zionterranova.com';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://market.zionterranova.com';
    const message = [
      `${host} wants you to sign in with your Ethereum account:`,
      address,
      '',
      'Sign in to ZION Market.',
      '',
      `URI: ${origin}`,
      'Version: 1',
      'Chain ID: 8453',
      `Nonce: ${nonce}`,
      'Issued At: ' + issuedAt,
      'Expiration Time: ' + expirationTime,
    ].join('\n');

    // 3. Sign with the connected wallet via wagmi.
    const signature = await signMessageAsync({ message });

    // 4. Submit to ZIS through the local proxy.
    await verifySiwe(address, message, signature);

    // 5. Fetch full user record.
    const fullUser = await zisGetCurrentUser();
    setUser(zisToAuthUser(fullUser));
  }, [address, isConnected, signMessageAsync]);

  const logout = useCallback(async () => {
    await zisLogout();
    setUser(null);
    disconnect();
  }, [disconnect]);

  const updateProfile = useCallback(async (displayName: string) => {
    const updated = await zisUpdateProfile({ displayName });
    setUser(zisToAuthUser(updated));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticated: !!user,
        checkSession,
        loginWithSiwe,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
