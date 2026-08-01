'use client';

import { useState } from 'react';
import { ShoppingCart, Box, Ruler, Coins } from 'lucide-react';
import type { ShopProductData } from '@/types/shop';
import { getTokens } from '@/lib/shop-api';
import { useCart } from './CartContext';

interface ShopProductCardProps {
  product: ShopProductData;
  onOpen: (product: ShopProductData) => void;
}

export default function ShopProductCard({ product, onOpen }: ShopProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const tokens = getTokens(product);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.inStock) return;
    if (add(product, 1)) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }
  };

  const isOut = !product.inStock;

  return (
    <div
      className="zion-rainbow-sub h-full p-4 cursor-pointer"
      style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
      onClick={() => onOpen(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(product);
        }
      }}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 artifact-placeholder">
        {imgError || !product.image ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl text-gradient font-black font-display">Z</span>
          </div>
        ) : (
          <img
            src={product.image}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        {product.badge && (
          <div className="absolute top-2 left-2 z-20">
            <span className="rarity-badge rarity-legendary">{product.badge}</span>
          </div>
        )}
        {product.modelUrl && (
          <div className="absolute top-2 right-2 z-20">
            <span className="rarity-badge rarity-unique inline-flex items-center gap-1">
              <Box className="w-3 h-3" /> 3D
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-oasis-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="text-xs text-gray-500 mb-0.5 capitalize">{product.category}</div>
        <h3 className="font-bold text-white text-sm leading-tight mb-2 line-clamp-1 hover:text-oasis-cyan transition-colors">
          {product.name}
        </h3>

        <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 mb-3">
          {product.size && (
            <span className="inline-flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
              <Ruler className="w-3 h-3" /> {product.size}
            </span>
          )}
          <span className="inline-flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded">
            <Box className="w-3 h-3" /> {product.inStock ? `${product.stock} ks` : 'Nedostupné'}
          </span>
          {tokens > 0 && (
            <span className="inline-flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded text-oasis-gold">
              <Coins className="w-3 h-3" /> +{tokens} ZION
            </span>
          )}
        </div>

        <div className="mt-auto pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div>
              {product.oldPriceCzk && (
                <span className="text-xs text-gray-600 line-through mr-2">{product.oldPriceCzk} Kč</span>
              )}
              <span className="font-mono text-sm text-gradient-gold font-bold">{product.priceCzk} Kč</span>
            </div>
            <button
              onClick={handleAdd}
              disabled={isOut}
              className={`zion-button-icon ${
                isOut ? 'opacity-50 cursor-not-allowed' : 'zion-button-ghost hover:bg-oasis-gold/20'
              }`}
              title={isOut ? 'Nedostupné' : 'Přidat do košíku'}
            >
              {added ? (
                <span className="text-oasis-emerald text-xs font-bold">Přidáno</span>
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
