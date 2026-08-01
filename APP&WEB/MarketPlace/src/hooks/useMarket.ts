'use client';

import { useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import {
  ZION_MARKETPLACE_ADDRESS,
  ZION_ARTIFACT_NFT_ADDRESS,
  WZION_ADDRESS,
  MARKETPLACE_ABI,
  ARTIFACT_NFT_ABI,
  WZION_ABI,
} from '@/lib/contracts';

const MARKET = ZION_MARKETPLACE_ADDRESS as `0x${string}`;
const NFT = ZION_ARTIFACT_NFT_ADDRESS as `0x${string}`;
const WZION = WZION_ADDRESS as `0x${string}`;

// ── Reads ─────────────────────────────────────────────────────────

export function useListing(listingId: bigint) {
  return useReadContract({
    address: MARKET,
    abi: MARKETPLACE_ABI,
    functionName: 'getListing',
    args: [listingId],
    query: { enabled: listingId > 0n && !!ZION_MARKETPLACE_ADDRESS },
  });
}

export function useAuction(listingId: bigint) {
  return useReadContract({
    address: MARKET,
    abi: MARKETPLACE_ABI,
    functionName: 'getAuction',
    args: [listingId],
    query: { enabled: listingId > 0n && !!ZION_MARKETPLACE_ADDRESS },
  });
}

export function useTokenBalance(address?: `0x${string}`, tokenId?: bigint) {
  return useReadContract({
    address: NFT,
    abi: ARTIFACT_NFT_ABI,
    functionName: 'balanceOf',
    args: address && tokenId !== undefined ? [address, tokenId] : undefined,
    query: { enabled: !!address && tokenId !== undefined && !!ZION_ARTIFACT_NFT_ADDRESS },
  });
}

export function useWZIONBalance(address?: `0x${string}`) {
  return useReadContract({
    address: WZION,
    abi: WZION_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useWZIONAllowance(owner?: `0x${string}`, spender = MARKET) {
  return useReadContract({
    address: WZION,
    abi: WZION_ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender },
  });
}

export function formatWZION(wei: bigint): string {
  return formatUnits(wei, 18);
}

export function priceToWei(price: string): bigint {
  try {
    return parseUnits(price.replace(/,/g, ''), 18);
  } catch {
    return 0n;
  }
}

// ── Writes ────────────────────────────────────────────────────────

export function useBuyFixed(listingId: bigint, quantity: bigint, price: string) {
  const { writeContract, isPending, error, data } = useWriteContract();
  const totalWei = priceToWei(price) * quantity;

  return {
    buy: async () => {
      if (!ZION_MARKETPLACE_ADDRESS) throw new Error('Marketplace not deployed');
      return writeContract({
        address: MARKET,
        abi: MARKETPLACE_ABI,
        functionName: 'buy',
        args: [listingId, quantity],
      });
    },
    isPending,
    error,
    hash: data,
    totalWei,
  };
}

export function useBid(listingId: bigint, amount: string) {
  const { writeContract, isPending, error, data } = useWriteContract();

  return {
    bid: async () => {
      if (!ZION_MARKETPLACE_ADDRESS) throw new Error('Marketplace not deployed');
      return writeContract({
        address: MARKET,
        abi: MARKETPLACE_ABI,
        functionName: 'bid',
        args: [listingId, priceToWei(amount)],
      });
    },
    isPending,
    error,
    hash: data,
  };
}

export function useCancelListing(listingId: bigint) {
  const { writeContract, isPending, error, data } = useWriteContract();

  return {
    cancel: async () => {
      if (!ZION_MARKETPLACE_ADDRESS) throw new Error('Marketplace not deployed');
      return writeContract({
        address: MARKET,
        abi: MARKETPLACE_ABI,
        functionName: 'cancelListing',
        args: [listingId],
      });
    },
    isPending,
    error,
    hash: data,
  };
}

export function useCreateListing() {
  const { writeContract, isPending, error, data } = useWriteContract();

  return {
    create: async (params: {
      tokenId: bigint;
      quantity: bigint;
      pricePerItem: string;
      expiryHours?: number;
    }) => {
      if (!ZION_MARKETPLACE_ADDRESS) throw new Error('Marketplace not deployed');
      const expiry = params.expiryHours
        ? BigInt(Math.floor(Date.now() / 1000) + params.expiryHours * 3600)
        : 0n;
      return writeContract({
        address: MARKET,
        abi: MARKETPLACE_ABI,
        functionName: 'createListing',
        args: [NFT, params.tokenId, params.quantity, priceToWei(params.pricePerItem), expiry],
      });
    },
    isPending,
    error,
    hash: data,
  };
}

export function useCreateAuction() {
  const { writeContract, isPending, error, data } = useWriteContract();

  return {
    create: async (params: {
      tokenId: bigint;
      quantity: bigint;
      startingPrice: string;
      durationHours: number;
    }) => {
      if (!ZION_MARKETPLACE_ADDRESS) throw new Error('Marketplace not deployed');
      const duration = BigInt(params.durationHours * 3600);
      return writeContract({
        address: MARKET,
        abi: MARKETPLACE_ABI,
        functionName: 'createAuction',
        args: [NFT, params.tokenId, params.quantity, priceToWei(params.startingPrice), duration],
      });
    },
    isPending,
    error,
    hash: data,
  };
}

export function useIsApprovedForAll(owner?: `0x${string}`, operator = MARKET) {
  return useReadContract({
    address: NFT,
    abi: ARTIFACT_NFT_ABI,
    functionName: 'isApprovedForAll',
    args: owner && operator ? [owner, operator] : undefined,
    query: { enabled: !!owner && !!operator && !!ZION_ARTIFACT_NFT_ADDRESS },
  });
}

export function useSetApprovalForAll() {
  const { writeContract, isPending, error, data } = useWriteContract();

  return {
    approve: async () => {
      if (!ZION_ARTIFACT_NFT_ADDRESS) throw new Error('NFT contract not deployed');
      return writeContract({
        address: NFT,
        abi: ARTIFACT_NFT_ABI,
        functionName: 'setApprovalForAll',
        args: [MARKET, true],
      });
    },
    isPending,
    error,
    hash: data,
  };
}

export function useMintArtifact() {
  const { writeContract, isPending, error, data } = useWriteContract();

  return {
    mint: async (params: {
      to: `0x${string}`;
      tokenId: bigint;
      amount: bigint;
      category: string;
      rarity: string;
    }) => {
      if (!ZION_ARTIFACT_NFT_ADDRESS) throw new Error('NFT contract not deployed');
      const category = toBytes32(params.category);
      const rarity = toBytes32(params.rarity);
      return writeContract({
        address: NFT,
        abi: ARTIFACT_NFT_ABI,
        functionName: 'mint',
        args: [params.to, params.tokenId, params.amount, category, rarity, '0x'],
      });
    },
    isPending,
    error,
    hash: data,
  };
}

function toBytes32(input: string): `0x${string}` {
  const text = input.trim().toLowerCase();
  if (text.startsWith('0x') && text.length === 66) return text as `0x${string}`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return `0x${Array.from(padded)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

export function useApproveWZION() {
  const { writeContract, isPending, error, data } = useWriteContract();

  return {
    approve: async (amount: bigint) => {
      return writeContract({
        address: WZION,
        abi: WZION_ABI,
        functionName: 'approve',
        args: [MARKET, amount],
      });
    },
    isPending,
    error,
    hash: data,
  };
}
