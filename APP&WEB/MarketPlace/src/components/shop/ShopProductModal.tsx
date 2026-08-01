'use client';

import { useState, useEffect } from 'react';
import { X, Minus, Plus, ShoppingCart, Ruler, Box, Coins, FileText, Flame } from 'lucide-react';
import type { ShopProductData } from '@/types/shop';
import { getTokens } from '@/lib/shop-api';
import { useCart } from './CartContext';

interface ShopProductModalProps {
  product: ShopProductData | null;
  onClose: () => void;
}

export default function ShopProductModal({ product, onClose }: ShopProductModalProps) {
  const [qty, setQty] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [added, setAdded] = useState(false);
  const { add } = useCart();

  useEffect(() => {
    setQty(1);
    setImgError(false);
    setAdded(false);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  if (!product) return null;

  const tokens = getTokens(product);
  const isOut = !product.inStock;

  const handleAdd = () => {
    if (isOut) return;
    if (add(product, qty)) {
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
        onClose();
      }, 800);
    }
  };

  const capabilities = [];
  if (product.modelUrl) capabilities.push({ icon: Box, label: '3D STL preview' });
  if (product.filesUrl) capabilities.push({ icon: Flame, label: 'Laser ready' });
  if (product.instructionsUrl) capabilities.push({ icon: FileText, label: 'PDF guide' });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="zion-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 zion-button-icon zion-button-ghost"
          aria-label="Zavřít"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid md:grid-cols-[1.2fr_1fr] gap-6 p-6">
          {/* Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/40">
            {imgError || !product.image ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-7xl text-gradient font-black font-display">Z</span>
              </div>
            ) : (
              <img
                src={product.image}
                alt={product.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            )}
            {product.badge && (
              <div className="absolute top-3 left-3">
                <span className="rarity-badge rarity-legendary">{product.badge}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="text-xs text-oasis-cyan font-bold uppercase tracking-wider mb-1">
              {product.category}
            </div>
            <h2 className="text-2xl font-black font-display mb-3">{product.name}</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{product.description}</p>

            <div className="flex flex-wrap gap-3 text-sm text-gray-300 mb-4">
              {product.size && (
                <span className="inline-flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg">
                  <Ruler className="w-4 h-4 text-oasis-cyan" /> {product.size}
                </span>
              )}
              <span className="inline-flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg">
                <Box className="w-4 h-4 text-oasis-cyan" />
                {product.inStock ? `${product.stock} ks skladem` : 'Nedostupné'}
              </span>
              {tokens > 0 && (
                <span className="inline-flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg text-oasis-gold">
                  <Coins className="w-4 h-4" /> +{tokens} ZION tokenů
                </span>
              )}
            </div>

            {capabilities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {capabilities.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 text-xs font-semibold bg-oasis-purple/10 text-oasis-purple px-3 py-1.5 rounded-full border border-oasis-purple/20"
                  >
                    <c.icon className="w-3 h-3" /> {c.label}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="flex items-baseline gap-3 mb-4">
                {product.oldPriceCzk && (
                  <span className="text-gray-500 line-through text-lg">{product.oldPriceCzk} Kč</span>
                )}
                <span className="text-3xl font-black text-gradient-gold">{product.priceCzk} Kč</span>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-gray-400">Množství:</span>
                <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={isOut}
                    className="zion-button-icon zion-button-ghost w-9 h-9"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-mono font-bold">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    disabled={isOut}
                    className="zion-button-icon zion-button-ghost w-9 h-9"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={isOut}
                className={`zion-button-primary w-full ${isOut ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isOut ? (
                  'Nedostupné'
                ) : added ? (
                  <span className="inline-flex items-center gap-2">Přidáno do košíku</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> Přidat do košíku
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
