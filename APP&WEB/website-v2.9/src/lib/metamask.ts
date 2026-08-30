/**
 * Minimal MetaMask / EIP-1193 helpers for ZION Web 2.9.
 *
 * Handles account access, Base mainnet network switching, and ERC-20
 * `transfer` calls so users can deposit tokens from their own EVM wallet
 * into their ZIS multichain deposit address.
 */

import { ethers } from 'ethers';
import { CONTRACTS } from './defi-contracts';

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

const BASE_CHAIN_ID = 8453;
const BASE_HEX = `0x${BASE_CHAIN_ID.toString(16)}`;

const BASE_CHAIN_PARAMS = {
  chainId: BASE_HEX,
  chainName: 'Base Mainnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

export function getEthereumProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

export async function requestAccount(provider: EthereumProvider): Promise<string> {
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error('No MetaMask account selected');
  }
  return ethers.utils.getAddress(accounts[0]);
}

export async function ensureBaseNetwork(provider: EthereumProvider): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_HEX }],
    });
  } catch (switchError: any) {
    // 4902 = chain not added
    if (switchError?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [BASE_CHAIN_PARAMS],
      });
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_HEX }],
      });
    } else {
      throw switchError;
    }
  }
}

/** Minimal ERC-20 transfer data builder (transfer(address,uint256)). */
export function buildErc20TransferData(recipient: string, amountAtomic: string): string {
  const to = recipient.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const value = ethers.utils.hexZeroPad(ethers.BigNumber.from(amountAtomic).toHexString(), 32)
    .replace(/^0x/, '');
  return `0xa9059cbb${to}${value}`;
}

export async function sendErc20Token(
  provider: EthereumProvider,
  from: string,
  tokenContract: string,
  to: string,
  amountHuman: string,
  decimals: number,
): Promise<string> {
  const value = ethers.utils.parseUnits(amountHuman, decimals);
  const data = buildErc20TransferData(to, value.toHexString());

  return (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: tokenContract,
        data,
        value: '0x0',
      },
    ],
  })) as string;
}

export async function sendNativeEth(
  provider: EthereumProvider,
  from: string,
  to: string,
  amountHuman: string,
): Promise<string> {
  const value = ethers.utils.parseEther(amountHuman);
  return (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to,
        value: value.toHexString(),
      },
    ],
  })) as string;
}

/** Map a token symbol to the canonical Base mainnet contract address. */
export function baseTokenContract(symbol: string): string | undefined {
  const upper = symbol.toUpperCase();
  switch (upper) {
    case 'WZION':
      return CONTRACTS.wZION;
    case 'USDT':
      return CONTRACTS.USDT;
    case 'USDC':
      return CONTRACTS.USDC;
    case 'WETH':
      return CONTRACTS.WETH;
    default:
      return undefined;
  }
}
