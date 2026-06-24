'use client';

/**
 * AuthContext — manages user authentication state.
 *
 * Uses Zion Wallet for sign-in (Ed25519 signature challenge).
 * Session is stored in an httpOnly cookie (JWT).
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface AuthUser {
  id?: string;
  address: string;
  displayName: string | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
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
    password: string,
    exportPrivateKey: (id: string, pw: string) => Promise<string>,
    walletId: string,
  ) => {
    // 1. Get private key (decrypts with password)
    const privateKeyHex = await exportPrivateKey(walletId, password);
    const privateKeyBytes = new Uint8Array(
      privateKeyHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)),
    );

    // 2. Derive public key
    const { default: ed } = await import('@noble/ed25519');
    const publicKeyBytes = await ed.getPublicKey(privateKeyBytes);
    const publicKeyHex = Array.from(publicKeyBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 3. Get nonce from server
    const nonceRes = await fetch(`/api/auth/nonce?address=${address}`);
    if (!nonceRes.ok) throw new Error('Failed to get nonce');
    const { nonce } = await nonceRes.json();

    // 4. Sign the nonce
    const nonceBytes = new Uint8Array(
      nonce.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)),
    );
    const signatureBytes = await ed.sign(nonceBytes, privateKeyBytes);
    const signatureHex = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 5. Submit to server
    const authRes = await fetch('/api/auth/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, publicKey: publicKeyHex, signature: signatureHex, nonce }),
    });

    if (!authRes.ok) {
      const err = await authRes.json();
      throw new Error(err.error || 'Authentication failed');
    }

    const data = await authRes.json();
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (displayName: string) => {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const data = await res.json();
    if (data.user) setUser(data.user);
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
