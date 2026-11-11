'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Flame, Minus, Plus, ShoppingBag, Truck } from 'lucide-react';
import type { ProductDef } from '@/data/catalog';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { useProduct } from '@/lib/use-products';
import { useCart } from '@/components/cart-provider';
import { ProductPrice } from '@/components/price';

export default function BuyBox({ product }: { product: ProductDef }) {
  const { lang } = useLang();
  const router = useRouter();
  const live = useProduct(product.externalId);
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const max = Math.min(product.maxQty ?? 20, Math.max(1, live?.stock ?? 1));
  const soldOut = !live || live.stock <= 0 || !live.active;

  function handleAdd(goToCart = false) {
    if (soldOut) return;
    add(product.externalId, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
    if (goToCart) router.push('/kosik');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ProductPrice externalId={product.externalId} className="text-3xl" />
        <span
          className={
            soldOut
              ? 'rounded-full bg-ink/85 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-paper'
              : 'rounded-full bg-amber-500/15 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-amber-800'
          }
        >
          {soldOut
            ? pick({ cs: 'Vyprodáno', en: 'Sold out', de: 'Ausverkauft' }, lang)
            : live && live.stock <= 5
              ? `${pick({ cs: 'Poslední kusy', en: 'Last pieces', de: 'Letzte Stücke' }, lang)} (${live.stock})`
              : pick({ cs: 'Skladem', en: 'In stock', de: 'Auf Lager' }, lang)}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">{pick(product.description, lang)}</p>

      {!soldOut && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-line bg-white/70">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
              aria-label={pick({ cs: 'Snížit množství', en: 'Decrease quantity', de: 'Menge verringern' }, lang)}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(max, value + 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
              aria-label={pick({ cs: 'Zvýšit množství', en: 'Increase quantity', de: 'Menge erhöhen' }, lang)}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button type="button" onClick={() => handleAdd(false)} className="btn-primary flex-1 sm:flex-none">
            <ShoppingBag className="h-4 w-4" />
            {pick({ cs: 'Přidat do košíku', en: 'Add to cart', de: 'In den Warenkorb' }, lang)}
          </button>
          <button type="button" onClick={() => handleAdd(true)} className="btn-amber flex-1 sm:flex-none">
            {pick({ cs: 'Koupit hned', en: 'Buy now', de: 'Jetzt kaufen' }, lang)}
          </button>
        </div>
      )}

      {added && (
        <p className="inline-flex items-center gap-2 text-sm font-medium text-amber-800">
          <Check className="h-4 w-4" /> {pick({ cs: 'Přidáno do košíku', en: 'Added to cart', de: 'Zum Warenkorb hinzugefügt' }, lang)}
        </p>
      )}

      <div className="space-y-2.5 rounded-xl border border-line bg-white/50 p-4 text-sm text-ink-soft">
        <p className="flex items-start gap-2">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span>{pick(product.leadTime, lang)}</span>
        </p>
        <p className="flex items-start gap-2">
          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <span>
            {pick(
              {
                cs: 'Svíčka patří do sklenice, na nehořlavý podklad a pod dohled.',
                en: 'The candle belongs in a glass, on a non-flammable base, attended.',
                de: 'Die Kerze gehört ins Glas, auf eine nicht brennbare Unterlage, beaufsichtigt.',
              },
              lang,
            )}{' '}
            <a href="#bezpecnost" className="link-underline">
              {pick({ cs: 'Celé pokyny', en: 'Full instructions', de: 'Alle Hinweise' }, lang)}
            </a>
          </span>
        </p>
        {product.personalization ? (
          <p>
            {pick(
              {
                cs: 'Jména, datum nebo logo vypálíme do dřeva. Návrh posíláme k odsouhlasení.',
                en: 'We burn names, a date or a logo into the wood. We send a proof for approval.',
                de: 'Wir brennen Namen, Datum oder Logo ins Holz. Wir senden einen Entwurf zur Freigabe.',
              },
              lang,
            )}
          </p>
        ) : null}
        <p className="text-xs text-muted">
          {pick(
            {
              cs: 'Doprava zdarma od 1 500 Kč · Zásilkovna nebo osobní odběr',
              en: 'Free shipping from CZK 1,500 · Zásilkovna or pickup',
              de: 'Versandkostenfrei ab 1.500 CZK · Zásilkovna oder Abholung',
            },
            lang,
          )}
        </p>
      </div>

      <p className="text-xs text-muted">
        {pick({ cs: 'Potřebujete víc kusů nebo logo?', en: 'Need more pieces or a logo?', de: 'Mehr Stücke oder ein Logo?' }, lang)}{' '}
        <Link href="/firmy" className="link-underline text-ink">
          {pick({ cs: 'Napište nám poptávku', en: 'Send us an enquiry', de: 'Senden Sie uns eine Anfrage' }, lang)}
        </Link>
        .
      </p>
    </div>
  );
}
