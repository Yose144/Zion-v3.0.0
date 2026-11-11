'use client';

import type { ProductDef } from '@/data/catalog';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { imageVariantExact } from '@/lib/images';

/**
 * Náhledy stěn motivu. Sekce se nekreslí, dokud produkt nemá `walls` —
 * takže katalog může motivy dostat až s podklady, bez prázdných děr.
 */
export default function ProductWalls({ product }: { product: ProductDef }) {
  const { lang } = useLang();
  const walls = product.walls ?? [];
  if (walls.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="motivy-sten">
      <div className="max-w-2xl">
        <p className="eyebrow">{pick({ cs: 'Motiv', en: 'Motif', de: 'Motiv' }, lang)}</p>
        <h2 id="motivy-sten" className="h3 mt-2">
          {pick({ cs: 'Šest stěn, šest obrazů', en: 'Six walls, six pictures', de: 'Sechs Wände, sechs Bilder' }, lang)}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {pick(
            {
              cs: 'Každá stěna lampionu má vlastní motiv. Večer se z nich stanou stíny na stole — a které uvidíte, záleží na tom, kam lampion postavíte.',
              en: 'Every wall carries its own motif. In the evening they turn into shadows on the table — which ones you see depends on where you place the lantern.',
              de: 'Jede Wand trägt ihr eigenes Motiv. Am Abend werden daraus Schatten auf dem Tisch — welche Sie sehen, hängt davon ab, wo die Laterne steht.',
            },
            lang,
          )}
        </p>
      </div>

      <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {walls.map((wall) => (
          <li key={wall.image} className="card-warm overflow-hidden">
            <div className="bg-parchment-deep p-2">
              <img
                src={imageVariantExact(wall.image, 200)}
                alt={pick(wall.label, lang)}
                width={200}
                height={380}
                loading="lazy"
                decoding="async"
                className="mx-auto aspect-[10/19] w-full object-contain"
              />
            </div>
            <p className="px-3 py-2.5 text-center text-[0.72rem] font-medium leading-snug text-ink-soft">
              {pick(wall.label, lang)}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {pick(
          {
            cs: 'Náhledy jsou ilustrační. Skutečný řez se může v drobných detailech lišit — rozhodující je fyzický kus.',
            en: 'The previews are illustrative. The real cut may differ in small details — the physical piece decides.',
            de: 'Die Vorschauen sind illustrativ. Der echte Schnitt kann in kleinen Details abweichen — entscheidend ist das physische Stück.',
          },
          lang,
        )}
      </p>
    </section>
  );
}
