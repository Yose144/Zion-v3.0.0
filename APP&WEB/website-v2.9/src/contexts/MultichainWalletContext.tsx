'use client';

/**
 * MultichainWalletContext — ZION multichain custodial wallet state.
 *
 * Mirrors the user's on-server multichain wallet: addresses, ledger balances,
 * deposits, withdrawals and DEX orders. Requires ZIS authentication (the
 * session cookie is forwarded through the local proxy).
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMultichainWallet,
  requestMultichainWithdraw,
  deriveMultichainAddress,
  type MultichainWalletSnapshot,
  type MultichainWithdrawInput,
  type MultichainAddressResult,
} from '@/lib/multichain-api';

export const MULTICHAIN_DECIMALS = 1_000_000;

interface MultichainWalletState {
  snapshot: MultichainWalletSnapshot | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
  withdraw: (input: MultichainWithdrawInput) => Promise<{ withdrawal_id?: string; error?: string }>;
  deriveAddress: (chain: string, account?: number, index?: number) => Promise<MultichainAddressResult | null>;
  clearError: () => void;
}

const defaultState: MultichainWalletState = {
  snapshot: null,
  loading: true,
  error: null,
  refreshing: false,
  refresh: async () => {},
  withdraw: async () => ({ error: 'Not initialized' }),
  deriveAddress: async () => null,
  clearError: () => {},
};

const MultichainWalletContext = createContext<MultichainWalletState>(defaultState);

/** Format an on-chain atomic amount as a human-readable decimal string. */
export function formatMultichainAmount(raw: string | number, decimals = 6): string {
  try {
    const value = BigInt(String(raw));
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const frac = value % divisor;
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    if (fracStr.length === 0) return whole.toString();
    return `${whole}.${fracStr}`;
  } catch {
    return String(raw);
  }
}

export function MultichainWalletProvider({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const [snapshot, setSnapshot] = useState<MultichainWalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    try {
      setRefreshing(true);
      const data = await getMultichainWallet();
      if (data) {
        setSnapshot(data);
        setError(null);
      } else {
        setSnapshot(null);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load multichain wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const withdraw = useCallback(async (input: MultichainWithdrawInput) => {
    setError(null);
    const result = await requestMultichainWithdraw(input);
    if ('error' in result) {
      setError(result.error);
      return { error: result.error };
    }
    await refresh();
    return { withdrawal_id: result.withdrawal_id };
  }, [refresh]);

  const deriveAddress = useCallback(async (chain: string, account = 0, index = 0) => {
    setError(null);
    const addr = await deriveMultichainAddress({ chain, account, index });
    if (addr) await refresh();
    return addr;
  }, [refresh]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <MultichainWalletContext.Provider
      value={{
        snapshot,
        loading,
        error,
        refreshing,
        refresh,
        withdraw,
        deriveAddress,
        clearError,
      }}
    >
      {children}
    </MultichainWalletContext.Provider>
  );
}

export function useMultichainWallet() {
  return useContext(MultichainWalletContext);
}
