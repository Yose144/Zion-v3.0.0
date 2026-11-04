'use client';

import type { XmasFact } from '@/data/christmasProducts';
import { useLangT } from '@/lib/useTranslation';

/**
 * Pruh čísel pod hero — kniha (8 edic / 5 jazyků / 3 252 stran / 619 498 slov),
 * pass (1 kód / 5 světů / 200 avatarů / bonus), lampion (ruční / limitovaná…).
 *
 * Čísla jsou v `data/christmasProducts.ts` a jsou reálná: u knihy jde o součet
 * ze sazby (`EDITION/00-STAV.md` + 40 PDF), ne o marketingový odhad.
 *
 * `compact` = karta na homepage, kde je obsahový sloupec jen ~250 px. Plná
 * velikost se tam lámala uprostřed slov („limitovan / á"), proto menší typ
 * a pevné dva sloupce.
 */
export default function FactsStrip({ facts, compact = false }: { facts: XmasFact[]; compact?: boolean }) {
  const { lang } = useLangT();
  return (
    <dl
      className={`grid gap-2 ${compact ? 'grid-cols-2 xl:grid-cols-4 mobile-keep-cols' : ''}`}
      // auto-fit drží rozumné sloupce i v úzkém kontejneru na detailu produktu
      style={compact ? undefined : { gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }}
    >
      {facts.map((fact, i) => (
        <div
          key={i}
          className={`zion-section ${compact ? '!p-3' : '!p-4'} flex flex-col gap-1 border-white/10 min-w-0`}
        >
          <dt
            className={`uppercase tracking-[0.18em] text-gray-500 ${
              compact ? 'text-[10px]' : 'text-[11px]'
            }`}
          >
            {lang === 'cs' ? fact.label.cs : fact.label.en}
          </dt>
          <dd
            className={`font-black text-gradient-gold leading-tight ${
              compact ? 'text-sm' : 'text-base md:text-xl'
            }`}
          >
            {lang === 'cs' ? fact.value.cs : fact.value.en}
          </dd>
          {fact.hint && (
            <p className={`leading-snug text-gray-500 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
              {lang === 'cs' ? fact.hint.cs : fact.hint.en}
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}
