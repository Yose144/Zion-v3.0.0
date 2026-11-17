'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/shop/CartContext';
import { getShopProducts } from '@/lib/shop-api';
import type { ShopProductData } from '@/types/shop';

/**
 * „Koupit" rovnou do pokladny — vezme produkt z veřejného API podle
 * `externalId`, hodí ho do košíku a pošle na `/cart`. Když produkt v API
 * nenajde (neaktivní / vyprodaný), spadne na obecný `/shop`, kde je
 * dostupnost vidět — nikdy neumožní objednávku neexistujícího zboží,
 * protože finální validace stejně běží na serveru.
 */
export default function BuyNowButton({
  externalId,
  className,
  disabled,
  children,
}: {
  externalId: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { add } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function findProduct(): Promise<ShopProductData | null> {
    // Katalog je malý, ale stránkujeme explicitně — ať to funguje i po
    // překročení pageSize a nemusí se sem sahat při každém novém produktu.
    for (let page = 1; page <= 5; page++) {
      const res = await getShopProducts({ page, pageSize: 100 });
      if (!res) return null;
      const hit = res.data.find((p) => p.externalId === externalId && p.active);
      if (hit) return hit;
      if (!res.hasMore) return null;
    }
    return null;
  }

  async function handleClick() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const product = await findProduct();
      if (product && add(product)) {
        router.push('/cart');
        return;
      }
    } finally {
      setBusy(false);
    }
    router.push('/shop');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className={className}
    >
      {busy ? <ShoppingCart className="w-4 h-4 animate-pulse" /> : null}
      {children}
    </button>
  );
}
