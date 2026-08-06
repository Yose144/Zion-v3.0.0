import type { ArtifactCardData } from '@/components/ItemCard';

export interface ItemDetailData extends ArtifactCardData {
  description: string;
  tokenId: string;
  contractAddress: string;
  supply: string;
  owner: string;
  listingId?: string;
  quantity?: number;
  properties: { trait: string; value: string }[];
  history: { event: string; price: string; from: string; time: string }[];
  externalUrl?: string;
}

export interface ApiItem {
  id: string;
  tokenId: string;
  contractAddress: string;
  category: string;
  name: string;
  description: string;
  rarity: string;
  source: string;
  imageUri: string;
  assetUri?: string;
  metadataUri: string;
  stats?: Record<string, unknown>;
  creator: string;
  totalSupply: number;
  circulatingSupply: number;
  createdAt: string;
  listings?: {
    id: string;
    saleType: string;
    price: string;
    quantity: number;
    status: string;
    highestBid?: string | null;
    bidCount?: number;
    expiresAt?: string | null;
  }[];
}

export interface ItemsResponse {
  data: ArtifactCardData[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ItemsFilters {
  category?: string;
  rarity?: string;
  source?: string;
  sort?: 'recent' | 'price_low' | 'price_high' | 'rarity';
  page?: number;
  pageSize?: number;
}

function getOasisUrl(item: ApiItem): string {
  const name = encodeURIComponent(item.name);
  switch (item.category) {
    case 'avatar':
      return `https://oasis.zionterranova.com/avatars?search=${name}`;
    case 'quest_item':
      return `https://oasis.zionterranova.com/quests?search=${name}`;
    case 'golden_egg':
      return `https://oasis.zionterranova.com/golden-egg`;
    case 'territory':
      return `https://oasis.zionterranova.com/territories?search=${name}`;
    default:
      return 'https://oasis.zionterranova.com';
  }
}

function toDetailData(item: ApiItem): ItemDetailData {
  const activeListing = item.listings?.find((l) => l.status === 'active');
  const listingType = activeListing
    ? (activeListing.saleType as 'fixed' | 'auction')
    : 'none';
  const price = activeListing?.price ? formatPrice(activeListing.price) : undefined;
  const bestBid = activeListing?.highestBid ? formatPrice(activeListing.highestBid) : undefined;
  const endsAt = activeListing?.expiresAt ? new Date(activeListing.expiresAt).getTime() : undefined;

  const properties: ItemDetailData['properties'] = [];
  if (item.stats && typeof item.stats === 'object') {
    for (const [trait, value] of Object.entries(item.stats)) {
      properties.push({
        trait: trait.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: String(value ?? '—'),
      });
    }
  }

  const history: ItemDetailData['history'] = [];
  const listed = activeListing
    ? [{ event: 'Listed', price: `${price} wZION`, from: item.creator, time: 'Recently' }]
    : [];
  history.push(...listed);
  history.push({ event: 'Minted', price: '—', from: item.creator, time: new Date(item.createdAt).toLocaleDateString() });

  return {
    id: item.id,
    name: item.name,
    image: item.imageUri ? ipfsToHttp(item.imageUri) : '',
    collection: item.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    category: item.category,
    rarity: normalizeRarity(item.rarity),
    price,
    bestBid,
    listingType,
    endsAt,
    description: item.description,
    tokenId: item.tokenId,
    contractAddress: item.contractAddress,
    supply: `${item.circulatingSupply} / ${item.totalSupply}`,
    owner: item.creator,
    listingId: activeListing?.id,
    quantity: activeListing?.quantity,
    properties,
    history,
    externalUrl: getOasisUrl(item),
  };
}

function toCardData(item: ApiItem): ArtifactCardData {
  const activeListing = item.listings?.find((l) => l.status === 'active');
  const listingType = activeListing
    ? (activeListing.saleType as 'fixed' | 'auction')
    : 'none';

  const price = activeListing?.price
    ? formatPrice(activeListing.price)
    : undefined;
  const bestBid = activeListing?.highestBid
    ? formatPrice(activeListing.highestBid)
    : undefined;

  const endsAt = activeListing?.expiresAt
    ? new Date(activeListing.expiresAt).getTime()
    : undefined;

  return {
    id: item.id,
    name: item.name,
    image: item.imageUri ? ipfsToHttp(item.imageUri) : '',
    collection: item.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    category: item.category,
    rarity: normalizeRarity(item.rarity),
    price,
    bestBid,
    listingType,
    endsAt,
  };
}

function normalizeRarity(r: string): ArtifactCardData['rarity'] {
  const valid = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'] as const;
  const lower = r.toLowerCase();
  return valid.find((v) => v === lower) ?? 'common';
}

function formatPrice(wei: string): string {
  try {
    const n = BigInt(wei);
    const divisor = 10n ** 18n;
    const whole = n / divisor;
    const fraction = (n % divisor).toString().padStart(18, '0').slice(0, 4);
    const frac = fraction.replace(/0+$/, '') || '0';
    const value = `${whole}.${frac}`;
    return parseFloat(value).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  } catch {
    return wei;
  }
}

function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}

export async function getItems(filters: ItemsFilters = {}): Promise<ItemsResponse | null> {
  const q = new URLSearchParams();
  if (filters.category) q.set('category', filters.category);
  if (filters.rarity) q.set('rarity', filters.rarity);
  if (filters.source) q.set('source', filters.source);
  if (filters.sort) q.set('sort', filters.sort);
  if (filters.page) q.set('page', String(filters.page));
  if (filters.pageSize) q.set('pageSize', String(filters.pageSize));

  try {
    const res = await fetch(`/api/items?${q.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: ApiItem[]; total: number; page: number; pageSize: number; hasMore: boolean };
    return {
      ...json,
      data: json.data.map(toCardData),
    };
  } catch {
    return null;
  }
}

export interface ProfileItemsResponse {
  created: ApiItem[];
  listed: { id: string; artifact: ApiItem; saleType: string; price: string; quantity: number; status: string }[];
  stats: { owned: number; listedCount: number; volume: string };
}

export interface ProfileActivity {
  id: string;
  type: 'Sale' | 'Purchase' | 'Bid' | 'Listed' | 'Minted';
  item: string;
  price: string;
  time: string;
  txHash?: string;
}

export async function getProfileItems(address: string): Promise<ProfileItemsResponse | null> {
  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(address)}/items`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ProfileItemsResponse };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function getProfileActivity(address: string): Promise<ProfileActivity[] | null> {
  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(address)}/activity`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ProfileActivity[] };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function getItem(id: string): Promise<ItemDetailData | null> {
  try {
    const res = await fetch(`/api/items/${id}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: ApiItem };
    return json.data ? toDetailData(json.data) : null;
  } catch {
    return null;
  }
}
