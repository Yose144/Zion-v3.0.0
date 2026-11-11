import type { Localized } from '@/lib/i18n';

/**
 * Šest motivových kolekcí Lumi 2 — ilustrace ZION Design Engine B (sada v2).
 *
 * Obrázky jsou marketingové ilustrace, **ne technické rendery**: výřezy a stíny
 * jsou výtvarná interpretace. Skutečnou geometrii drží SVG/DXF a 3D model
 * (`public/models/lumi-2-*.glb`). Cesty mají vlastní složku `kolekce-v2/`,
 * aby se nepřepisovaly dřívější ilustrace webu.
 *
 * `productSlug` míří na produkt v katalogu (`/kolekce/<slug>`); slug
 * v balíčku se od produktu liší jen u přírodní kolekce (prirodni → priroda).
 */
export interface CollectionCard {
  /** Slug v balíčku — skládá cesty k obrázkům. */
  slug: string;
  /** Slug produktu v katalogu. */
  productSlug: string;
  name: Localized;
  note: Localized;
  alt: Localized;
}

const image = (slug: string) => ({
  image: `/images/lumi-b/kolekce-v2/lumi-2-${slug}-4x3-960.webp`,
  imageSmall: `/images/lumi-b/kolekce-v2/lumi-2-${slug}-4x3-640.webp`,
  productImage: `/images/lumi-b/kolekce-v2/lumi-2-${slug}-produkt-900.webp`,
});

export const COLLECTIONS: CollectionCard[] = [
  {
    slug: 'prirodni',
    productSlug: 'lumi-2-priroda',
    name: { cs: 'Přírodní', en: 'Natural', de: 'Natur' },
    note: {
      cs: 'Slunce, měsíc, dva stromy a hory s řekou.',
      en: 'Sun, moon, two trees and mountains with a river.',
      de: 'Sonne, Mond, zwei Bäume und Berge mit Fluss.',
    },
    alt: {
      cs: 'Lucerna Lumi 2, přírodní kolekce, ilustrace Engine B.',
      en: 'Lumi 2 lantern, natural collection, Engine B illustration.',
      de: 'Laterne Lumi 2, Natur-Kollektion, Engine-B-Illustration.',
    },
  },
  {
    slug: 'svatebni',
    productSlug: 'lumi-2-svatebni',
    name: { cs: 'Svatební', en: 'Wedding', de: 'Hochzeit' },
    note: {
      cs: 'Dvě srdce, prsteny, strom lásky a svatební pár.',
      en: 'Two hearts, rings, tree of love and a wedding couple.',
      de: 'Zwei Herzen, Ringe, Baum der Liebe und ein Hochzeitspaar.',
    },
    alt: {
      cs: 'Lucerna Lumi 2, svatební kolekce, ilustrace Engine B.',
      en: 'Lumi 2 lantern, wedding collection, Engine B illustration.',
      de: 'Laterne Lumi 2, Hochzeits-Kollektion, Engine-B-Illustration.',
    },
  },
  {
    slug: 'kvetinove',
    productSlug: 'lumi-2-kvetinove',
    name: { cs: 'Květinová', en: 'Floral', de: 'Blumen' },
    note: {
      cs: 'Růže, slunečnice, kopretiny a rozkvetlá louka.',
      en: 'Roses, sunflowers, daisies and a flowering meadow.',
      de: 'Rosen, Sonnenblumen, Gänseblümchen und eine blühende Wiese.',
    },
    alt: {
      cs: 'Lucerna Lumi 2, květinová kolekce, ilustrace Engine B.',
      en: 'Lumi 2 lantern, floral collection, Engine B illustration.',
      de: 'Laterne Lumi 2, Blumen-Kollektion, Engine-B-Illustration.',
    },
  },
  {
    slug: 'oceanske',
    productSlug: 'lumi-2-oceanske',
    name: { cs: 'Oceánská', en: 'Ocean', de: 'Ozean' },
    note: {
      cs: 'Delfín, mořská želva, velryba a korálový útes.',
      en: 'Dolphin, sea turtle, whale and a coral reef.',
      de: 'Delfin, Meeresschildkröte, Wal und ein Korallenriff.',
    },
    alt: {
      cs: 'Lucerna Lumi 2, oceánská kolekce, ilustrace Engine B.',
      en: 'Lumi 2 lantern, ocean collection, Engine B illustration.',
      de: 'Laterne Lumi 2, Ozean-Kollektion, Engine-B-Illustration.',
    },
  },
  {
    slug: 'vesmirne',
    productSlug: 'lumi-2-vesmirne',
    name: { cs: 'Vesmírná', en: 'Cosmic', de: 'Weltraum' },
    note: {
      cs: 'Saturn, galaxie, raketa, Země a kometa.',
      en: 'Saturn, galaxy, rocket, Earth and a comet.',
      de: 'Saturn, Galaxie, Rakete, Erde und ein Komet.',
    },
    alt: {
      cs: 'Lucerna Lumi 2, vesmírná kolekce, ilustrace Engine B.',
      en: 'Lumi 2 lantern, cosmic collection, Engine B illustration.',
      de: 'Laterne Lumi 2, Weltraum-Kollektion, Engine-B-Illustration.',
    },
  },
  {
    slug: 'vanocni',
    productSlug: 'lumi-2-vanoce',
    name: { cs: 'Vánoční', en: 'Christmas', de: 'Weihnachten' },
    note: {
      cs: 'Stromeček, betlém, zvonky a vánoční svíčka.',
      en: 'Christmas tree, nativity, bells and a Christmas candle.',
      de: 'Weihnachtsbaum, Krippe, Glocken und eine Weihnachtskerze.',
    },
    alt: {
      cs: 'Vánoční lucerna Lumi 2 s betlémem na stole u zasněženého okna.',
      en: 'Christmas Lumi 2 lantern with a nativity on a table by a snowy window.',
      de: 'Weihnachtslaterne Lumi 2 mit Krippe auf einem Tisch am verschneiten Fenster.',
    },
  },
];

export const collectionImage = image;

export function collectionByProductSlug(productSlug: string): CollectionCard | undefined {
  return COLLECTIONS.find((collection) => collection.productSlug === productSlug);
}
