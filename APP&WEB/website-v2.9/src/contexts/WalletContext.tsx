'use client';

/**
 * WalletContext — shared MetaMask wallet connection for DeFi pages.
 * Handles connect/disconnect, chain switching to Base Mainnet (8453),
 * and exposes account + provider to all children.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ethers } from 'ethers';

// ─── Base Mainnet ──────────────────────────────────────────────────────────────

export const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_MAINNET_HEX = '0x2105';

const BASE_CHAIN_PARAMS = {
  chainId: BASE_MAINNET_HEX,
  chainName: 'Base',
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

function getEthereum(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  return ((window as Window & { ethereum?: unknown }).ethereum as EthereumProvider | undefined) ?? null;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = !!account;
  const isBaseMainnet = chainId === BASE_MAINNET_CHAIN_ID;

  const getProviderAndSigner = useCallback(() => {
    const eth = getEthereum();
    if (!eth) return { provider: null, signer: null };
    const provider = new ethers.providers.Web3Provider(eth, 'any');
    const signer = account ? provider.getSigner() : null;
    return { provider, signer };
  }, [account]);

  const { provider, signer } = getProviderAndSigner();

  // ── switch chain ───────────────────────────────────────────────────────────

  const switchToBase = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) throw new Error('MetaMask not found');
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_MAINNET_HEX }],
      });
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [BASE_CHAIN_PARAMS],
        });
      } else {
        throw e;
      }
    }
  }, []);

  // ── connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      setError('MetaMask not installed');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      if (!accounts[0]) throw new Error('No account');
      await switchToBase();
      setAccount(accounts[0]);
      setChainId(BASE_MAINNET_CHAIN_ID);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setConnecting(false);
    }
  }, [switchToBase]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setError(null);
  }, []);

  // ── listeners ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    const onAccounts = (accs: string[]) => {
      if (accs.length === 0) {
        setAccount(null);
      } else {
        setAccount(accs[0]);
      }
    };
    const onChain = (hexId: string) => {
      setChainId(parseInt(hexId, 16));
    };

    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);

    // Check if already connected
    eth.request({ method: 'eth_accounts' }).then((accs) => {
      const accounts = accs as string[];
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        eth.request({ method: 'eth_chainId' }).then((chainId) => {
          const hex = chainId as string;
          setChainId(parseInt(hex, 16));
        });
      }
    }).catch(() => {});

    return () => {
      eth.removeListener('accountsChanged', onAccounts);
      eth.removeListener('chainChanged', onChain);
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
