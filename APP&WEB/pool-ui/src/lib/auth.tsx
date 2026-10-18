'use client';

// AuthContext — ZIS-backed authentication for the pool UI.
//
// Session lives in the `zion_session` httpOnly cookie (domain
// `.zionterranova.com`) — shared SSO with the rest of the ecosystem.
// Two embedded login methods (no wallet app required): WebAuthn passkey
// and MetaMask SIWE. For Zion Wallet / Google sign-in users are forwarded
// to the hosted login on app.zionterranova.com.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getChallenge,
  getCurrentUser,
  getPasskeyLoginOptions,
  logout as zisLogout,
  verifyPasskeyLogin,
  verifySiwe,
  type ZisUser,
} from './zis';

interface AuthState {
  user: ZisUser | null;
  loading: boolean;
  authenticated: boolean;
  checkSession: () => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  loginWithSiwe: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultState: AuthState = {
  user: null,
  loading: true,
  authenticated: false,
  checkSession: async () => {},
  loginWithPasskey: async () => {},
  loginWithSiwe: async () => {},
  logout: async () => {},
};

const Ctx = createContext<AuthState>(defaultState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ZisUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      setUser(await getCurrentUser());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const loginWithPasskey = useCallback(async () => {
    // 1. Begin the ceremony on ZIS.
    const { ceremonyId, options } = await getPasskeyLoginOptions();
    // 2. Browser assertion (dynamic import keeps the static bundle small
    //    until the user actually signs in).
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const response = await startAuthentication(
      options as unknown as Parameters<typeof startAuthentication>[0],
    );
    // 3. Verify — sets the SSO cookie on success.
    await verifyPasskeyLogin({ ceremonyId, response });
    setUser(await getCurrentUser());
  }, []);

  const loginWithSiwe = useCallback(async () => {
    const ethereum = (
      typeof window !== 'undefined'
        ? (window as unknown as { ethereum?: {
              request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
            } })
        : undefined
    )?.ethereum;
    if (!ethereum) throw new Error('MetaMask not detected');

    const accounts = (await ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[];
    const address = accounts[0];
    if (!address) throw new Error('No EVM account selected');

    const { challenge } = await getChallenge(address, 'evm');
    const nonce = challenge.match(/nonce: ([^\n]+)/i)?.[1];
    if (!nonce) throw new Error('No nonce in challenge');

    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const message = [
      `${window.location.host} wants you to sign in with your Ethereum account:`,
      address,
      '',
      'Sign in to ZION Pool.',
      '',
      `URI: ${window.location.origin}`,
      'Version: 1',
      `Chain ID: ${parseInt((await ethereum.request({ method: 'eth_chainId' })) as string, 16)}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
      `Expiration Time: ${expirationTime}`,
    ].join('\n');

    const signature = (await ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string;
    if (!signature) throw new Error('Signature rejected');

    await verifySiwe(address, message, signature);
    setUser(await getCurrentUser());
  }, []);

  const logout = useCallback(async () => {
    await zisLogout();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        authenticated: !!user,
        checkSession,
        loginWithPasskey,
        loginWithSiwe,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
