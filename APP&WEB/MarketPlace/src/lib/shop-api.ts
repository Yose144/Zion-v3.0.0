import { getAdminKey } from './admin-auth';
import type { ShopProductData, CartItem, ShippingMethod, ShopOrderInput } from '@/types/shop';

function adminHeaders(): Record<string, string> {
  const key = getAdminKey();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) headers['X-API-Key'] = key;
  return headers;
}

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

export interface StripeCheckoutResult {
  success: boolean;
  data?: {
    sessionId: string;
    url: string;
  };
  error?: string;
}

export async function createStripeCheckoutSession(orderId: string, customerEmail?: string): Promise<StripeCheckoutResult | null> {
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, customerEmail }),
    });
    return (await res.json()) as StripeCheckoutResult;
  } catch {
    return null;
  }
}

export interface OrderStatusResult {
  success: boolean;
  data?: {
    id: string;
    orderId: string;
    status: string;
    paymentStatus: string;
    totalCzk: number;
    shippingCzk: number;
    customerName: string;
    customerEmail: string;
    shipping: string;
    payment: string;
    addressStreet: string | null;
    addressCity: string | null;
    addressZip: string | null;
    pickupPoint: unknown;
    note: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    paidAt: string | null;
    createdAt: string;
    items: { name: string; quantity: number; priceCzk: number }[];
    invoices: { id: string; invoiceNumber: string; status: string; html: string | null }[];
  };
  error?: string;
}

export async function getOrderStatus(orderId: string): Promise<OrderStatusResult | null> {
  try {
    const res = await fetch(`/api/shop/orders/${encodeURIComponent(orderId)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as OrderStatusResult;
  } catch {
    return null;
  }
}

export interface StripeVerifyResult {
  success: boolean;
  data?: {
    order: unknown;
    stripe: {
      status: string;
      paymentStatus: string;
      amountTotal: number;
      currency: string | null;
    };
  };
  error?: string;
}

export async function verifyStripeSession(sessionId: string): Promise<StripeVerifyResult | null> {
  try {
    const res = await fetch('/api/stripe/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return (await res.json()) as StripeVerifyResult;
  } catch {
    return null;
  }
}

export interface AdminOrdersListResult {
  success: boolean;
  data?: {
    orders: {
      id: string;
      orderId: string;
      status: string;
      paymentStatus: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      totalCzk: number;
      shippingCzk: number;
      shipping: string;
      payment: string;
      trackingNumber: string | null;
      zionTokens: number;
      items: unknown;
      addressStreet: string | null;
      addressCity: string | null;
      addressZip: string | null;
      note: string | null;
      newsletter: boolean;
      createdAt: string;
      updatedAt: string;
      invoices: { id: string; invoiceNumber: string; status: string; pdfUrl: string | null; totalCzk: number; issuedAt: string }[];
    }[];
    page: number;
    limit: number;
    total: number;
    pages: number;
    stats?: {
      totalOrders: number;
      totalRevenue: number;
      totalTokens: number;
      pendingPayment: number;
      paid: number;
      byStatus: Record<string, number>;
      byPayment: Record<string, number>;
    };
  };
  error?: string;
}

export async function listAdminOrders(params?: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminOrdersListResult | null> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.paymentStatus) q.set('paymentStatus', params.paymentStatus);
  if (params?.search) q.set('search', params.search);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));

  try {
    const res = await fetch(`/api/admin/orders?${q.toString()}`, {
      headers: adminHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return (await res.json()) as AdminOrdersListResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function updateOrderStatus(
  id: string,
  status: string
): Promise<{ success: boolean; error?: string } | null> {
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return (await res.json()) as { success: boolean; error?: string };
  } catch {
    return null;
  }
}

export async function updateTrackingNumber(
  id: string,
  trackingNumber: string
): Promise<{ success: boolean; error?: string } | null> {
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/shipping`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber }),
    });
    return (await res.json()) as { success: boolean; error?: string };
  } catch {
    return null;
  }
}

export async function sendInvoiceEmail(id: string): Promise<{ success: boolean; error?: string } | null> {
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/invoice/send`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    });
    return (await res.json()) as { success: boolean; error?: string };
  } catch {
    return null;
  }
}

export async function regenerateInvoice(
  id: string,
  dueDays?: number
): Promise<{ success: boolean; data?: unknown; error?: string } | null> {
  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}/invoice`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(dueDays ? { dueDays } : {}),
    });
    return (await res.json()) as { success: boolean; data?: unknown; error?: string };
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

// ── Trivi Accounting Integration ────────────────────────────────────

export interface TriviSyncResult {
  success: boolean;
  trivi_id?: string;
  document_number?: string;
  error?: string;
}

export async function syncOrderToTrivi(id: string): Promise<TriviSyncResult | null> {
  try {
    const res = await fetch(`/api/admin/trivi/sync/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    });
    return (await res.json()) as TriviSyncResult;
  } catch {
    return null;
  }
}

export interface TriviStatusResult {
  synced: boolean;
  status?: 'success' | 'failed' | 'pending';
  trivi_id?: string;
  document_number?: string;
  error_message?: string;
  can_retry?: boolean;
  created_at?: string;
}

export async function checkTriviStatus(id: string): Promise<TriviStatusResult | null> {
  try {
    const res = await fetch(`/api/admin/trivi/status/${encodeURIComponent(id)}`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as TriviStatusResult;
  } catch {
    return null;
  }
}

// ── Token Distribution ──────────────────────────────────────────────

export interface TokenDistributionResult {
  success: boolean;
  orderId?: string;
  tokens?: number;
  status?: string;
  txHash?: string;
  distributedAt?: string;
  error?: string;
}

export async function distributeTokens(
  id: string,
  txHash?: string
): Promise<TokenDistributionResult | null> {
  try {
    const res = await fetch(`/api/admin/tokens/distribute/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return (await res.json()) as TokenDistributionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export interface TokenStatusResult {
  found: boolean;
  tokens?: number;
  status?: 'pending' | 'distributed';
  txHash?: string;
  distributedAt?: string;
  error?: string;
}

export async function getTokenStatus(id: string): Promise<TokenStatusResult | null> {
  try {
    const res = await fetch(`/api/admin/tokens/distribute/${encodeURIComponent(id)}`, {
      headers: adminHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { found: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return (await res.json()) as TokenStatusResult;
  } catch (err) {
    return { found: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
