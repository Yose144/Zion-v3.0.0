import type { ShopProductData, CartItem, ShippingMethod, ShopOrderInput } from '@/types/shop';

export interface ShopProductsResponse {
  data: ShopProductData[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ShopProductsFilters {
  category?: string;
  sort?: 'recent' | 'price_low' | 'price_high';
  page?: number;
  pageSize?: number;
}

export async function getShopProducts(filters: ShopProductsFilters = {}): Promise<ShopProductsResponse | null> {
  const q = new URLSearchParams();
  if (filters.category) q.set('category', filters.category);
  if (filters.sort) q.set('sort', filters.sort);
  if (filters.page) q.set('page', String(filters.page));
  if (filters.pageSize) q.set('pageSize', String(filters.pageSize));

  try {
    const res = await fetch(`/api/shop/products?${q.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ShopProductsResponse;
  } catch {
    return null;
  }
}

export interface CreateOrderResult {
  success: boolean;
  data?: {
    order: {
      id: string;
      orderId: string;
      status: string;
      totalCzk: number;
      createdAt: string;
    };
    bank: {
      account: string;
      iban: string;
      bic: string;
      vs: string;
      amount: number;
      qrCode: string;
    };
  };
  error?: string;
}

export async function createShopOrder(input: ShopOrderInput): Promise<CreateOrderResult | null> {
  try {
    const res = await fetch('/api/shop/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return (await res.json()) as CreateOrderResult;
  } catch {
    return null;
  }
}

export function getTokens(product: ShopProductData): number {
  if (product.tokens > 0) return product.tokens;
  if (product.priceCzk > 0) return Math.max(1, Math.round(product.priceCzk / 100));
  return 0;
}

export function isVirtualOnlyCart(items: CartItem[]): boolean {
  if (!items.length) return false;
  return items.every((i) => i.digital || i.category === 'digital');
}
