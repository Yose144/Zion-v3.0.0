'use client';

/**
 * AuthContext — ZIS-backed authentication for Web 2.9.
 *
 * Uses Zion Wallet for sign-in (Ed25519 signature over ZIS challenge).
 * Session is stored in an httpOnly SSO cookie (zion_session) issued by ZIS
 * and scoped to .zionterranova.com.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  getChallenge,
  verifyEd25519 as zisVerifyEd25519,
  getCurrentUser,
  logout as zisLogout,
  updateProfile as zisUpdateProfile,
  type ZisUser,
} from '@/lib/zis';

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
  /** Login with Zion Wallet signature */
  loginWithWallet: (address: string, password: string, exportPrivateKey: (id: string, pw: string) => Promise<string>, walletId: string) => Promise<void>;
  /** Logout */
  logout: () => Promise<void>;
  /** Update display name */
  updateProfile: (displayName: string) => Promise<void>;
}

const defaultState: AuthState = {
  user: null,
  loading: true,
  authenticated: false,
  checkSession: async () => {},
  loginWithWallet: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
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

  const checkSession = useCallback(async () => {
    try {
      const zisUser = await getCurrentUser();
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

  const loginWithWallet = useCallback(async (
    address: string,
    _password: string,
    exportPrivateKey: (id: string, pw: string) => Promise<string>,
    walletId: string,
  ) => {
    // 1. Get private key (decrypts with password)
    const privateKeyHex = await exportPrivateKey(walletId, _password);
    const privateKeyBytes = new Uint8Array(
      privateKeyHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)),
    );

    // 2. Derive public key
    const ed = await import('@noble/ed25519');
    const publicKeyBytes = await ed.getPublicKey(privateKeyBytes);
    const publicKeyHex = Array.from(publicKeyBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 3. Request ZIS challenge
    const { challenge } = await getChallenge(address, 'zion-l1');

    // 4. Sign the challenge bytes (UTF-8)
    const challengeBytes = new TextEncoder().encode(challenge);
    const signatureBytes = await ed.sign(challengeBytes, privateKeyBytes);
    const signatureHex = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 5. Submit to ZIS through local proxy — the proxy passes the SSO cookie.
    await zisVerifyEd25519(address, publicKeyHex, signatureHex);

    // 6. Fetch full user record from ZIS using the freshly set cookie.
    const fullUser = await getCurrentUser();
    setUser(zisToAuthUser(fullUser));
  }, []);

  const logout = useCallback(async () => {
    await zisLogout();
    setUser(null);
  }, []);

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
        loginWithWallet,
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
