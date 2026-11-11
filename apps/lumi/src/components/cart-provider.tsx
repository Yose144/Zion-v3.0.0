'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  externalId: string;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (externalId: string, quantity?: number) => void;
  setQuantity: (externalId: string, quantity: number) => void;
  remove: (externalId: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'lumi_cart_v1';

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ externalId?: string; quantity?: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line) => typeof line.externalId === 'string' && Number.isInteger(line.quantity))
      .map((line) => ({
        externalId: String(line.externalId),
        quantity: Math.min(20, Math.max(1, Number(line.quantity))),
      }))
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* soukromý režim */
    }
  }, [lines, ready]);

  const add = useCallback((externalId: string, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.externalId === externalId);
      if (existing) {
        return current.map((line) =>
          line.externalId === externalId
            ? { ...line, quantity: Math.min(20, line.quantity + quantity) }
            : line,
        );
      }
      return [...current, { externalId, quantity: Math.min(20, Math.max(1, quantity)) }];
    });
  }, []);

  const setQuantity = useCallback((externalId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.externalId !== externalId)
        : current.map((line) =>
            line.externalId === externalId ? { ...line, quantity: Math.min(20, quantity) } : line,
          ),
    );
  }, []);

  const remove = useCallback((externalId: string) => {
    setLines((current) => current.filter((line) => line.externalId !== externalId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      ready,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart musí být uvnitř CartProvider');
  return context;
}
