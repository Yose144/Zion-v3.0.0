'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ShopProductData } from '@/types/shop';
import type { CartItem, CartContextValue } from '@/types/shop';

const CART_KEY = 'zion_shop_cart';

const CartContext = createContext<CartContextValue | null>(null);

function toCartItem(product: ShopProductData, quantity: number): CartItem {
  return {
    id: product.id,
    externalId: product.externalId,
    name: product.name,
    priceCzk: product.priceCzk,
    image: product.image,
    category: product.category,
    tokens: product.tokens,
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

  const add = useCallback((product: ShopProductData, quantity = 1) => {
    if (!product.inStock) return false;
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: Math.min(99, i.quantity + quantity) } : i
        );
      }
      return [...prev, toCartItem(product, Math.min(99, Math.max(1, quantity)))];
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
