import type { ShopProduct } from '@prisma/client';

export type ShopProductData = ShopProduct;

export interface CartItem {
  id: string;
  externalId: string;
  name: string;
  priceCzk: number;
  image: string;
  category: string;
  tokens: number;
  quantity: number;
  digital: boolean;
}

export interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  add: (product: ShopProductData, quantity?: number) => boolean;
  remove: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
}

export type ShippingMethod = 'zasilkovna' | 'zasilkovna-home' | 'virtualni-nakup' | 'virtualni-odber';

export const SHIPPING_PRICES: Record<ShippingMethod, number> = {
  zasilkovna: 69,
  'zasilkovna-home': 99,
  'virtualni-nakup': 0,
  'virtualni-odber': 0,
};

export interface ShopOrderInput {
  orderId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address?: {
      street: string;
      city: string;
      zip: string;
    } | null;
    newsletter: boolean;
  };
  shipping: {
    method: ShippingMethod;
    price: number;
    pickupPoint?: unknown;
  };
  payment: 'transfer' | 'card' | 'crypto';
  note: string;
  items: CartItem[];
  total: number;
  zionTokens: number;
  termsAccepted: boolean;
}
