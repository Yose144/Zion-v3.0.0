import type { Localized } from '@/lib/i18n';
import { COLLECTIONS } from '@/data/kolekce';
import { SITE } from '@/data/site';

/**
 * Snímky promo slideru nad 3D sekcí na homepage.
 *
 * Kolekční snímky jsou tematické hero ilustrace Engine B z
 * `Lumi_Engine_B_KOMPLET_v2` (1600×900) — každý sedí ke své kolekci.
 * Pro každý snímek existují `-640` a `-1280` webp varianty,
 * ze kterých komponenta skládá `srcset` přes `imageVariant`.
 * Pozor na jméno: base obrázek nesmí končit `-<číslo>.webp` —
 * `imageVariant` by ho považoval za hotovou variantu a srcset
 * by ukazoval všude na plnou verzi.
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

/** Kolekce se snímkem — `image` je `kolekce-<slug>-hero.webp` v lumi-b. */
const COLLECTION_SLIDES: ReadonlyArray<{ slug: string; image: string }> = [
  { slug: 'vanocni', image: '/images/lumi-b/kolekce-vanocni-hero.webp' },
  { slug: 'svatebni', image: '/images/lumi-b/kolekce-svatebni-hero.webp' },
  { slug: 'kvetinove', image: '/images/lumi-b/kolekce-kvetinove-hero.webp' },
  { slug: 'prirodni', image: '/images/lumi-b/kolekce-prirodni-hero.webp' },
  { slug: 'oceanske', image: '/images/lumi-b/kolekce-oceanske-hero.webp' },
  { slug: 'vesmirne', image: '/images/lumi-b/kolekce-vesmirne-hero.webp' },
];

const collectionSlides: HeroSlide[] = COLLECTION_SLIDES.map(({ slug, image }) => {
  const collection = COLLECTIONS.find((entry) => entry.slug === slug);
  if (!collection) throw new Error(`hero-slides: neznámá kolekce „${slug}“`);
  return {
    image,
    width: 1600,
    height: 900,
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
    image: '/images/lumi-b/hero-lumi.webp',
    width: 1672,
    height: 941,
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
