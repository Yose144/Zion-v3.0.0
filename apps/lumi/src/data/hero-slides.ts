import type { Localized } from '@/lib/i18n';
import { COLLECTIONS } from '@/data/kolekce';
import { SITE } from '@/data/site';

/**
 * Snímky promo slideru na homepage.
 *
 * Všech sedm snímků pochází z **jednoho záběru** (stůl, hrnek, okno, lampion
 * na stejné pozici) — sada `Engine B v2` v `heros/Lumi`. Drží se to proto,
 * že slider rotuje: kdyby každý snímek měl jinou kompozici (makro detail,
 * detail, celek), skákala by při každém přechodu velikost i pozice lampionu.
 *
 * Snímky se 16:9 seříznou skriptem `scripts/make-slide-images.mjs`
 * (vstup = 4:3 originály z balíčku, výstup = `slide-<key>.webp` + `-1280`
 * a `-640` varianty pro `srcset`). Nikdy je nepřepisuj ručně jinou
 * kompozicí — rozbilo by to jednotnost slideru.
 */
export interface HeroSlide {
  image: string;
  /** Přirozená velikost obrázku — pro `srcset` descriptor a width/height. */
  width: number;
  height: number;
  alt: Localized;
  kicker: Localized;
  title: Localized;
  lead?: Localized;
  href: string;
  cta: Localized;
}

const SLIDE_WIDTH = 1440;
const SLIDE_HEIGHT = 810;

/** Kolekce se snímkem — `image` je `slide-<slug>.webp` v lumi-b. */
const COLLECTION_SLIDES: ReadonlyArray<string> = [
  'vanocni',
  'svatebni',
  'kvetinove',
  'prirodni',
  'oceanske',
  'vesmirne',
];

const collectionSlides: HeroSlide[] = COLLECTION_SLIDES.map((slug) => {
  const collection = COLLECTIONS.find((entry) => entry.slug === slug);
  if (!collection) throw new Error(`hero-slides: neznámá kolekce „${slug}“`);
  return {
    image: `/images/lumi-b/slide-${slug}.webp`,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    alt: collection.alt,
    kicker: { cs: 'Kolekce', en: 'Collection', de: 'Kollektion' },
    title: collection.name,
    lead: collection.note,
    href: `/kolekce/${collection.productSlug}`,
    cta: { cs: 'Zobrazit kolekci', en: 'View the collection', de: 'Kollektion ansehen' },
  };
});

export const HERO_SLIDES: HeroSlide[] = [
  {
    image: '/images/lumi-b/slide-lumi-2.webp',
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    alt: {
      cs: 'Lucerna Lumi 2 na stole',
      en: 'The Lumi 2 lantern on a table',
      de: 'Die Lumi-2-Laterne auf einem Tisch',
    },
    kicker: { cs: 'Lumi 2', en: 'Lumi 2', de: 'Lumi 2' },
    title: {
      cs: 'Osm dílů. Jeden řez. Polovina hodiny.',
      en: 'Eight parts. One cut. Half an hour.',
      de: 'Acht Teile. Ein Schnitt. Eine halbe Stunde.',
    },
    lead: {
      cs: 'Březová překližka 3 mm, vyřezávané mandaly a teplé světlo svíčky — lampion, který vzniká v naší dílně.',
      en: '3 mm birch plywood, cut mandalas and the warm light of a candle — a lantern made in our workshop.',
      de: '3 mm Birkensperrholz, geschnittene Mandalas und warmes Kerzenlicht — eine Laterne aus unserer Werkstatt.',
    },
    href: '/kolekce/lumi-2',
    cta: SITE.hero.ctaPrimary,
  },
  ...collectionSlides,
];
