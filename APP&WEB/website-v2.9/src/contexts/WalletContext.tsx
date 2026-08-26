'use client';

/**
 * WalletContext — shared EVM wallet connection for DeFi pages.
 * Handles connect/disconnect, chain switching to Base Mainnet (8453),
 * EIP-6963 multi-provider discovery, and exposes account + provider/signer.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { ethers } from 'ethers';

// ─── Base Mainnet ──────────────────────────────────────────────────────────────

export const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_MAINNET_HEX = '0x2105';

const BASE_CHAIN_PARAMS = {
  chainId: BASE_MAINNET_HEX,
  chainName: 'Base Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WalletState {
  connected: boolean;
  connecting: boolean;
  account: string | null;
  chainId: number | null;
  isBaseMainnet: boolean;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  walletName: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBase: () => Promise<void>;
  error: string | null;
}

const defaultState: WalletState = {
  connected: false,
  connecting: false,
  account: null,
  chainId: null,
  isBaseMainnet: false,
  provider: null,
  signer: null,
  walletName: null,
  connect: async () => {},
  disconnect: () => {},
  switchToBase: async () => {},
  error: null,
};

const WalletContext = createContext<WalletState>(defaultState);

interface EthereumProvider extends ethers.providers.ExternalProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
  on(event: 'chainChanged', handler: (chainId: string) => void): void;
  removeListener(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
  removeListener(event: 'chainChanged', handler: (chainId: string) => void): void;
}

interface Eip6963ProviderInfo {
  name: string;
  icon?: string;
  rdns?: string;
  uuid: string;
}

interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
}

// ─── Provider discovery ────────────────────────────────────────────────────────

function isEthereumProvider(value: unknown): value is EthereumProvider {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EthereumProvider).request === 'function'
  );
}

function getLegacyProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & { ethereum?: unknown };
  if (isEthereumProvider(win.ethereum)) return win.ethereum;
  if (Array.isArray(win.ethereum)) {
    const mm = win.ethereum.find((p) => isEthereumProvider(p) && (p as any).isMetaMask);
    if (mm) return mm as EthereumProvider;
    const first = win.ethereum.find((p) => isEthereumProvider(p));
    if (first) return first as EthereumProvider;
  }
  return null;
}

function discoverEip6963Providers(timeout = 600): Promise<Eip6963ProviderDetail[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([]);
      return;
    }

    const providers: Eip6963ProviderDetail[] = [];

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (detail && isEthereumProvider(detail.provider)) {
        providers.push(detail);
      }
    };

    window.addEventListener('eip6963:announceProvider' as any, onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider' as any));

    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider' as any, onAnnounce);
      resolve(providers);
    }, timeout);
  });
}

const METAMASK_RDNS = [
  'io.metamask',
  'io.metamask.mobile',
  'io.metamask.flask',
];

function preferMetaMask(providers: Eip6963ProviderDetail[]): Eip6963ProviderDetail | null {
  const mm = providers.find((p) => p.info.rdns && METAMASK_RDNS.includes(p.info.rdns));
  if (mm) return mm;
  return providers[0] ?? null;
}

async function getProvider(preferMetaMaskWallet = true): Promise<{
  provider: EthereumProvider;
  name: string;
} | null> {
  if (typeof window === 'undefined') return null;

  const eip6963 = await discoverEip6963Providers();
  if (eip6963.length) {
    const chosen = preferMetaMaskWallet ? preferMetaMask(eip6963) : eip6963[0];
    if (chosen) return { provider: chosen.provider, name: chosen.info.name };
  }

  const legacy = getLegacyProvider();
  if (legacy) {
    const name = (legacy as any).isMetaMask ? 'MetaMask' : 'Injected Wallet';
    return { provider: legacy, name };
  }

  return null;
}

// ─── Provider component ────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<EthereumProvider | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);

  const connected = !!account;
  const isBaseMainnet = chainId === BASE_MAINNET_CHAIN_ID;

  const provider = useMemo(() => {
    if (!activeProvider) return null;
    return new ethers.providers.Web3Provider(activeProvider as ethers.providers.ExternalProvider, 'any');
  }, [activeProvider]);

  const signer = useMemo(() => {
    return provider ? provider.getSigner() : null;
  }, [provider]);

  // ─── switch chain ─────────────────────────────────────────────────────────────

  const switchToBase = useCallback(async () => {
    const eth = activeProvider;
    if (!eth) throw new Error('Wallet not connected');

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_MAINNET_HEX }],
      });
    } catch (e: unknown) {
      const code = (e as { code?: number }).code;
      if (code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [BASE_CHAIN_PARAMS],
        });
      } else {
        throw e;
      }
    }
  }, [activeProvider]);

  // ─── connect ──────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);

    try {
      const found = await getProvider();
      if (!found) {
        throw new Error('No Ethereum wallet found. Please install MetaMask or enable an injected wallet.');
      }

      const { provider: eth, name } = found;
      setActiveProvider(eth);
      setWalletName(name);

      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      if (!accounts[0]) throw new Error('No account selected');

      setAccount(accounts[0]);

      const chainHex = (await eth.request({ method: 'eth_chainId' })) as string;
      const currentChain = parseInt(chainHex, 16);
      setChainId(currentChain);

      if (currentChain !== BASE_MAINNET_CHAIN_ID) {
        await switchToBase();
        const newChainHex = (await eth.request({ method: 'eth_chainId' })) as string;
        setChainId(parseInt(newChainHex, 16));
      }
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('cancelled')) {
        setError('Connection rejected. Please approve the wallet request.');
      } else {
        setError(msg);
      }
    } finally {
      setConnecting(false);
    }
  }, [switchToBase]);

  // ─── disconnect ───────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (activeProvider) {
      // Best-effort revoke for MetaMask; ignore errors if not supported.
      activeProvider
        .request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        } as { method: string; params?: unknown[] })
        .catch(() => {});
    }

    setActiveProvider(null);
    setWalletName(null);
    setAccount(null);
    setChainId(null);
    setError(null);
  }, [activeProvider]);

  // ─── listeners + auto-connect ─────────────────────────────────────────────────

  const mounted = useRef(true);

  // Attach/detach event listeners whenever the active provider changes.
  // This runs only when a provider has been selected by the user or auto-detected.
  useEffect(() => {
    if (!activeProvider) return;
    const eth = activeProvider;

    const onAccounts = (accs: string[]) => {
      if (accs.length === 0) {
        setAccount(null);
        setChainId(null);
      } else {
        setAccount(accs[0]);
      }
    };

    const onChain = (hexId: string) => {
      setChainId(parseInt(hexId, 16));
    };

    // Some injected providers are EventEmitters with a low default listener limit.
    if (typeof (eth as any).setMaxListeners === 'function') {
      try {
        (eth as any).setMaxListeners(64);
      } catch {
        // ignore
      }
    }

    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);

    // Auto-detect current account/chain without prompting
    const sync = async () => {
      try {
        const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
        const chain = (await eth.request({ method: 'eth_chainId' })) as string;
        if (accounts[0]) setAccount(accounts[0]);
        setChainId(parseInt(chain, 16));
      } catch {
        // silent
      }
    };
    sync();

    return () => {
      try {
        eth.removeListener('accountsChanged', onAccounts);
        eth.removeListener('chainChanged', onChain);
      } catch {
        // provider may not support removal
      }
    };
  }, [activeProvider]);

  // Auto-connect on mount if a wallet is already authorized, but do not prompt.
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    const init = async () => {
      // Only auto-detect once on the client; no-op on SSR
      if (typeof window === 'undefined' || !mounted.current) return;
      const found = await getProvider();
      if (!found || cancelled || !mounted.current) return;

      const { provider: eth, name } = found;
      if (!cancelled && mounted.current) {
        setActiveProvider(eth);
        setWalletName(name);
      }
    };

    init().catch(() => {});

    return () => {
      mounted.current = false;
      cancelled = true;
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{
        connected,
        connecting,
        account,
        chainId,
        isBaseMainnet,
        provider,
        signer,
        walletName,
        connect,
        disconnect,
        switchToBase,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
