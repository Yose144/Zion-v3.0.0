import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format bigint token amount to display string */
export function formatTokenAmount(wei: bigint, decimals = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = wei / divisor;
  const fraction = wei % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
  return `${whole}.${fractionStr}`;
}

/** Shorten wallet address: 0x1234...abcd */
export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** Rarity to color class */
export function rarityColor(rarity: string): string {
  const map: Record<string, string> = {
    common: 'text-zinc-400 border-zinc-600',
    uncommon: 'text-green-400 border-green-600',
    rare: 'text-blue-400 border-blue-600',
    epic: 'text-red-400 border-red-600',
    legendary: 'text-amber-400 border-amber-600',
    mythic: 'text-rose-400 border-rose-600',
    unique: 'text-cyan-400 border-cyan-600',
  };
  return map[rarity] ?? map.common;
}

/** Category to icon name (lucide) */
export function categoryIcon(category: string): string {
  const map: Record<string, string> = {
    avatar: 'User',
    ship: 'Rocket',
    ship_skin: 'Palette',
    quest_item: 'Scroll',
    consumable: 'FlaskConical',
    territory: 'Map',
    golden_egg: 'Egg',
    badge: 'Award',
    music: 'Music',
    art: 'Image',
  };
  return map[category] ?? 'Package';
}

/** IPFS URI to HTTP gateway URL */
export function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    const hash = uri.slice(7);
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return uri;
}
