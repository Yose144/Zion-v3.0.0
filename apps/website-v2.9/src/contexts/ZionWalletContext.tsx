'use client';

/**
 * ZionWalletContext — ZION L1 wallet operations via zion-wallet-sdk.
 * Create, import, balance, send. Uses localStorage for persistence.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Lazy-load SDK only in browser
let sdk: any = null;
async function getSDK() {
  if (!sdk) {
    const mod = await import('zion-wallet-sdk');
    sdk = mod;
  }
  return sdk;
}

interface ZionWalletState {
  initialized: boolean;
  wallets: Array<{ id: string; name: string; address: string; keyType: string }>;
  activeWallet: { id: string; name: string; address: string; keyType: string } | null;
  balance: number | null;
  loading: boolean;
  error: string | null;
  createWallet: (name: string, password: string) => Promise<void>;
  importFromMnemonic: (mnemonic: string, name: string, password: string) => Promise<void>;
  importFromPrivateKey: (privateKeyHex: string, name: string, password: string) => Promise<void>;
  importFromTrezor: (name?: string) => Promise<void>;
  importFromLedger: (name?: string) => Promise<void>;
  setActiveWallet: (id: string) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
  send: (toAddress: string, amountZion: number, password: string, memo?: string) => Promise<string>;
  exportMnemonic: (walletId: string, password: string) => Promise<string>;
  exportPrivateKey: (walletId: string, password: string) => Promise<string>;
  disconnect: () => void;
  /** True if active wallet is a hardware wallet (watch-only, cannot sign TX). */
  isHardwareWallet: boolean;
}

const defaultState: ZionWalletState = {
  initialized: false,
  wallets: [],
  activeWallet: null,
  balance: null,
  loading: false,
  error: null,
  createWallet: async () => {},
  importFromMnemonic: async () => {},
  importFromPrivateKey: async () => {},
  importFromTrezor: async () => {},
  importFromLedger: async () => {},
  setActiveWallet: async () => {},
  deleteWallet: async () => {},
  refreshBalance: async () => {},
  send: async () => '',
  exportMnemonic: async () => '',
  exportPrivateKey: async () => '',
  disconnect: () => {},
  isHardwareWallet: false,
};

const ZionWalletContext = createContext<ZionWalletState>(defaultState);

const RELEVANT_PATHS = ['/wallet', '/login', '/dashboard', '/guardian', '/account'];

function isRelevantPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return RELEVANT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function ZionWalletProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [manager, setManager] = useState<any>(null);
  const [wallets, setWallets] = useState<ZionWalletState['wallets']>([]);
  const [activeWallet, setActiveWallet] = useState<ZionWalletState['activeWallet']>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const refreshWallets = useCallback((m: any) => {
    const list = m.listWallets();
    setWallets(list);
    const active = m.getActiveWallet();
    setActiveWallet(active);
    if (active) {
      m.getBalance(active.address).then((b: number) => setBalance(b)).catch(() => setBalance(null));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isRelevantPath(pathname)) return;

    let cancelled = false;
    getSDK().then(async (SDK: any) => {
      const storage = new SDK.WebStorage();
      const m = new SDK.WalletManager(storage, {
        nodes: [
          'https://rpc.zionterranova.com',
          ...(process.env.NEXT_PUBLIC_ZION_RPC_EXTRA_NODES
            ? process.env.NEXT_PUBLIC_ZION_RPC_EXTRA_NODES.split(',').map((s) => s.trim())
            : []),
        ],
      });
      await m.initialize();
      if (!cancelled) {
        setManager(m);
        refreshWallets(m);
        setInitialized(true);
      }
    }).catch((e: any) => {
      if (!cancelled) {
        setError(e?.message || 'Wallet SDK failed to initialize');
        setInitialized(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, refreshWallets]);

  const createWallet = useCallback(async (name: string, password: string) => {
    if (!manager) throw new Error('Wallet manager not initialized');
    setLoading(true);
    setError(null);
    try {
      await manager.createWallet({ name, password });
      refreshWallets(manager);
    } catch (e: any) {
      setError(e.message || 'Failed to create wallet');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [manager, refreshWallets]);

  const importFromMnemonic = useCallback(async (mnemonic: string, name: string, password: string) => {
    if (!manager) throw new Error('Wallet manager not initialized');
    setLoading(true);
    setError(null);
    try {
      await manager.importFromMnemonic({ mnemonic, name, password });
      refreshWallets(manager);
    } catch (e: any) {
      setError(e.message || 'Failed to import wallet');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [manager, refreshWallets]);

  const importFromPrivateKey = useCallback(async (privateKeyHex: string, name: string, password: string) => {
    if (!manager) throw new Error('Wallet manager not initialized');
    setLoading(true);
    setError(null);
    try {
      await manager.importFromPrivateKey({ privateKeyHex, name, password });
      refreshWallets(manager);
    } catch (e: any) {
      setError(e.message || 'Failed to import wallet');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [manager, refreshWallets]);

  const importFromTrezor = useCallback(async (name?: string) => {
    if (!manager) throw new Error('Wallet manager not initialized');
    setLoading(true);
    setError(null);
    try {
      await manager.importFromTrezor({ name });
      refreshWallets(manager);
    } catch (e: any) {
      setError(e.message || 'Failed to connect Trezor');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [manager, refreshWallets]);

  const importFromLedger = useCallback(async (name?: string) => {
    if (!manager) throw new Error('Wallet manager not initialized');
    setLoading(true);
    setError(null);
    try {
      await manager.importFromLedger({ name });
      refreshWallets(manager);
    } catch (e: any) {
      setError(e.message || 'Failed to connect Ledger');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [manager, refreshWallets]);

  const setActiveWalletCb = useCallback(async (id: string) => {
    if (!manager) return;
    await manager.setActiveWallet(id);
    refreshWallets(manager);
  }, [manager, refreshWallets]);

  const deleteWallet = useCallback(async (id: string) => {
    if (!manager) return;
    await manager.deleteWallet(id);
    refreshWallets(manager);
  }, [manager, refreshWallets]);

  const refreshBalance = useCallback(async () => {
    if (!manager || !activeWallet) return;
    setLoading(true);
    try {
      const b = await manager.getBalance(activeWallet.address);
      setBalance(b);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [manager, activeWallet]);

  const send = useCallback(async (toAddress: string, amountZion: number, password: string, memo?: string) => {
    if (!manager || !activeWallet) throw new Error('No active wallet');
    setLoading(true);
    setError(null);
    try {
      const txid = await manager.send({
        walletId: activeWallet.id,
        toAddress,
        amountZion,
        password,
        memo,
      });
      await refreshBalance();
      return txid;
    } catch (e: any) {
      setError(e.message || 'Transaction failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [manager, activeWallet, refreshBalance]);

  const exportMnemonic = useCallback(async (walletId: string, password: string) => {
    if (!manager) throw new Error('Wallet manager not initialized');
    return manager.exportMnemonic(walletId, password);
  }, [manager]);

  const exportPrivateKey = useCallback(async (walletId: string, password: string) => {
    if (!manager) throw new Error('Wallet manager not initialized');
    return manager.exportPrivateKey(walletId, password);
  }, [manager]);

  const disconnect = useCallback(() => {
    setActiveWallet(null);
    setBalance(null);
  }, []);

  return (
    <ZionWalletContext.Provider
      value={{
        initialized,
        wallets,
        activeWallet,
        balance,
        loading,
        error,
        createWallet,
        importFromMnemonic,
        importFromPrivateKey,
        importFromTrezor,
        importFromLedger,
        setActiveWallet: setActiveWalletCb,
        deleteWallet,
        refreshBalance,
        send,
        exportMnemonic,
        exportPrivateKey,
        disconnect,
        isHardwareWallet: activeWallet ? ['trezor', 'ledger', 'hid'].includes(activeWallet.keyType) : false,
      }}
    >
      {children}
    </ZionWalletContext.Provider>
  );
}

export function useZionWallet() {
  return useContext(ZionWalletContext);
}
