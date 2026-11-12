'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Flame, Package, ShoppingCart, Sparkles } from 'lucide-react';
import type { ShopProductData } from '@/types/shop';
import { LUMI_MOTIFS, DEFAULT_MOTIF, type LumiMotif } from '@/data/lumiMotifs';
import { useCart } from '@/components/shop/CartContext';
import { useLangT } from '@/lib/useTranslation';
import Lantern3D from '@/components/xmas/Lantern3D';

/**
 * Lumi 2 v marketu: jeden produkt, šest motivů.
 *
 * Motiv není samostatná položka skladu — je to volba u `lamp-001`. Vybraný
 * motiv jde do košíku (a odtud do objednávky v názvu řádku), takže dílna
 * ví, které stěny má vyříznout. Model se načítá až po kliknutí a při změně
 * motivu se remountuje (`key`), protože prohlížeč drží GLB v paměti.
 */
export default function LumiConfigurator({
  product,
  initialMotif,
}: {
  product: ShopProductData | null;
  initialMotif?: string;
}) {
  const { lang, t } = useLangT();
  const cs = lang === 'cs';
  const { add } = useCart();
  const [slug, setSlug] = useState(initialMotif && LUMI_MOTIFS.some((m) => m.slug === initialMotif) ? initialMotif : DEFAULT_MOTIF);
  const [added, setAdded] = useState(false);

  const motif = LUMI_MOTIFS.find((entry) => entry.slug === slug) ?? LUMI_MOTIFS[0];
  const price = product?.priceCzk ?? 0;
  const sellable = Boolean(product?.inStock);

  function handleAdd(goToCart = false) {
    if (!product) return;
    if (add(product, 1, motif.slug)) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2400);
      if (goToCart) window.location.href = '/cart';
    }
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        {/* 3D + náhledy motivů */}
        <div className="space-y-4">
          <Lantern3D
            key={motif.slug}
            modelUrl={motif.model}
            poster={motif.bannerSmall}
            posterAlt={cs ? motif.name.cs : motif.name.en}
          />

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {LUMI_MOTIFS.map((entry) => (
              <MotifThumb
                key={entry.slug}
                motif={entry}
                active={entry.slug === motif.slug}
                onClick={() => setSlug(entry.slug)}
                label={cs ? entry.name.cs : entry.name.en}
              />
            ))}
          </div>
        </div>

        {/* Výběr a nákup */}
        <div className="min-w-0">
          <div className="zion-kicker mb-3 inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {t('lumi.kicker')}
          </div>
          <h1 className="text-3xl md:text-4xl font-black font-display mb-2">
            <span className="text-gradient-gold">{t('lumi.title')}</span>
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">{t('lumi.lead')}</p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-rasta-gold/80">
                  {t('lumi.selectedMotif')}
                </div>
                <div className="text-xl font-bold text-white">{cs ? motif.name.cs : motif.name.en}</div>
              </div>
              <div className="font-mono text-2xl font-black text-rasta-gold">
                {price > 0 ? `${price} ${t('common.kcSymbol')}` : '—'}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">{cs ? motif.walls.cs : motif.walls.en}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleAdd(false)}
              disabled={!sellable}
              className="zion-button-primary flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-4 h-4" />
              {sellable ? t('lumi.addToCart') : t('lumi.notAvailable')}
            </button>
            <button
              type="button"
              onClick={() => handleAdd(true)}
              disabled={!sellable}
              className="zion-button-secondary flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('lumi.buyNow')}
            </button>
          </div>

          {added && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-rasta-green">
              <Check className="w-4 h-4" /> {t('lumi.added')}
            </p>
          )}

          <ul className="mt-6 space-y-2 text-sm text-gray-300">
            {[t('lumi.inBox1'), t('lumi.inBox2'), t('lumi.inBox3')].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Package className="mt-0.5 w-4 h-4 shrink-0 text-rasta-gold" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-rasta-red/30 bg-rasta-red/5 p-4 text-sm text-gray-300">
            <div className="mb-1 flex items-center gap-2 font-bold uppercase tracking-wider text-rasta-gold text-xs">
              <Flame className="w-4 h-4" /> {t('lumi.fireTitle')}
            </div>
            <p className="leading-relaxed">{t('lumi.fireNote')}</p>
          </div>

          <p className="mt-5 text-xs text-gray-500 leading-relaxed">{t('lumi.note')}</p>

          <Link href="/shop?category=woodart" className="mt-4 inline-block text-sm text-rasta-gold hover:underline">
            {t('lumi.otherProducts')} →
          </Link>
        </div>
      </div>
    </div>
  );
}

function MotifThumb({
  motif,
  active,
  onClick,
  label,
}: {
  motif: LumiMotif;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`group overflow-hidden rounded-xl border text-left transition-all ${
        active
          ? 'border-rasta-gold/70 ring-2 ring-rasta-gold/30'
          : 'border-white/10 hover:border-white/30'
      }`}
    >
      <span className="block bg-black/40">
        <img
          src={motif.cardSmall}
          alt=""
          width={320}
          height={320}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </span>
      <span
        className={`block truncate px-2 py-1.5 text-[11px] font-semibold ${
          active ? 'text-rasta-gold' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
