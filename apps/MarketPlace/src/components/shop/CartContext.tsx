'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ShopProductData } from '@/types/shop';
import type { CartItem, CartContextValue } from '@/types/shop';
import { getTokens } from '@/lib/shop-api';

const CART_KEY = 'zion_shop_cart';

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Řádek košíku je jednoznačný kombinací produktu a motivu — stejný lampion
 * ve dvou motivech jsou dva řádky, ne přepisování jednoho.
 */
function lineKey(product: ShopProductData, motif?: string) {
  return motif ? `${product.id}::${motif}` : product.id;
}

function toCartItem(product: ShopProductData, quantity: number, motif?: string): CartItem {
  return {
    id: lineKey(product, motif),
    motif,
    externalId: product.externalId,
    name: product.name,
    priceCzk: product.priceCzk,
    image: product.image,
    category: product.category,
    tokens: getTokens(product),
    quantity,
    digital: product.digital,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(CART_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, hydrated]);

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.priceCzk * item.quantity, 0), [items]);

  const add = useCallback((product: ShopProductData, quantity = 1, motif?: string) => {
    if (!product.inStock) return false;
    const key = lineKey(product, motif);
    setItems((prev) => {
      const existing = prev.find((i) => i.id === key);
      if (existing) {
        return prev.map((i) =>
          i.id === key ? { ...i, quantity: Math.min(99, i.quantity + quantity) } : i
        );
      }
      return [...prev, toCartItem(product, Math.min(99, Math.max(1, quantity)), motif)];
    });
    return true;
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const qty = Math.min(99, Math.max(1, Math.round(quantity) || 1));
    setItems((prev) =>
      prev.map((i) => (i.id === productId ? { ...i, quantity: qty } : i))
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({ items, count, total, add, remove, updateQuantity, clear }),
    [items, count, total, add, remove, updateQuantity, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
