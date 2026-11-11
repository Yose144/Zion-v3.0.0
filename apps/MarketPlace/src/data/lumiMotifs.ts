/**
 * Šest motivových sad lampionu Lumi 2 pro Market.
 *
 * Modely se staví z výpalových vektorů (ne z ilustrace) skriptem
 * `apps/lumi/scripts/build-lantern-models.mjs` a leží v `public/models/`.
 * Náhledy jsou rendery téhož modelu, takže co zákazník vidí, odpovídá řezu.
 *
 * Motiv není samostatná položka skladu — je to volba u jednoho produktu
 * (`lamp-001`). Vybraný motiv jde do objednávky v názvu řádku, aby dílna
 * věděla, co má vyříznout.
 */

export interface LumiMotif {
  /** Stabilní ID — používá se i v objednávce, neměnit. */
  slug: string;
  name: { cs: string; en: string };
  /** Šest stěn, v pořadí jak jdou po obvodu. */
  walls: { cs: string; en: string };
  /** GLB v metrech, Y-up (stejná konvence jako `lumi-2.glb`). */
  model: string;
  /** Produktový náhled z 3D modelu (světlé pozadí scény). */
  image: string;
  thumb: string;
  /** Ilustrace Engine B v2 — karta 900 px a zmenšenina pro přepínač. */
  card: string;
  cardSmall: string;
  /** Široký banner pro kampaň (1440 px + 960 px). */
  banner: string;
  bannerSmall: string;
  alt: { cs: string; en: string };
}

/**
 * Slugy v balíčku Engine B v2 se od produktových liší jen u přírodní
 * kolekce (`prirodni` vs `priroda`).
 */
const PACK_SLUGS: Record<string, string> = { priroda: 'prirodni', vanoce: 'vanocni' };
const packSlug = (slug: string) => PACK_SLUGS[slug] ?? slug;

const image = (slug: string, altCs: string, altEn: string) => ({
  image: `/images/motifs/${slug}/produkt-700.webp`,
  thumb: `/images/motifs/${slug}/produkt-200.webp`,
  card: `/images/design-v1/kolekce-v2/lumi-2-${packSlug(slug)}-karta-900.webp`,
  cardSmall: `/images/design-v1/kolekce-v2/lumi-2-${packSlug(slug)}-karta-320.webp`,
  banner: `/images/design-v1/kolekce-v2/lumi-2-${packSlug(slug)}-banner-1440.webp`,
  bannerSmall: `/images/design-v1/kolekce-v2/lumi-2-${packSlug(slug)}-banner-960.webp`,
  alt: { cs: altCs, en: altEn },
});

export const LUMI_MOTIFS: LumiMotif[] = [
  {
    slug: 'priroda',
    name: { cs: 'Příroda', en: 'Nature' },
    walls: {
      cs: 'Slunce, měsíc, holubice, dva stromy, hory s řekou a motýl.',
      en: 'Sun, moon, dove, two trees, mountains with a river, butterfly.',
    },
    model: '/models/lumi-2-priroda.glb',
    ...image('priroda', 'Lucerna Lumi 2, přírodní kolekce, ilustrace Engine B.', 'Lumi 2 lantern, natural collection, Engine B illustration.'),
  },
  {
    slug: 'svatebni',
    name: { cs: 'Svatební', en: 'Wedding' },
    walls: {
      cs: 'Dvě srdce, prsteny, holubice, strom lásky, květinové srdce a svatební pár.',
      en: 'Two hearts, rings, dove, tree of love, floral heart and a wedding couple.',
    },
    model: '/models/lumi-2-svatebni.glb',
    ...image('svatebni', 'Lucerna Lumi 2, svatební kolekce, ilustrace Engine B.', 'Lumi 2 lantern, wedding collection, Engine B illustration.'),
  },
  {
    slug: 'kvetinove',
    name: { cs: 'Květinové', en: 'Floral' },
    walls: {
      cs: 'Růže, slunečnice, kopretiny, vlčí máky, kosatce a rozkvetlá louka.',
      en: 'Roses, sunflowers, daisies, poppies, irises and a flowering meadow.',
    },
    model: '/models/lumi-2-kvetinove.glb',
    ...image('kvetinove', 'Lucerna Lumi 2, květinová kolekce, ilustrace Engine B.', 'Lumi 2 lantern, floral collection, Engine B illustration.'),
  },
  {
    slug: 'oceanske',
    name: { cs: 'Oceánské', en: 'Ocean' },
    walls: {
      cs: 'Delfín, mořská želva, mořský koník, velryba, nautilus a korálový útes.',
      en: 'Dolphin, sea turtle, seahorse, whale, nautilus and a coral reef.',
    },
    model: '/models/lumi-2-oceanske.glb',
    ...image('oceanske', 'Lucerna Lumi 2, oceánská kolekce, ilustrace Engine B.', 'Lumi 2 lantern, ocean collection, Engine B illustration.'),
  },
  {
    slug: 'vesmirne',
    name: { cs: 'Vesmírné', en: 'Cosmic' },
    walls: {
      cs: 'Saturn, galaxie, raketa, Země, kometa a slunce s měsícem.',
      en: 'Saturn, galaxy, rocket, Earth, comet and sun with moon.',
    },
    model: '/models/lumi-2-vesmirne.glb',
    ...image('vesmirne', 'Lucerna Lumi 2, vesmírná kolekce, ilustrace Engine B.', 'Lumi 2 lantern, cosmic collection, Engine B illustration.'),
  },
  {
    slug: 'vanoce',
    name: { cs: 'Vánoce', en: 'Christmas' },
    walls: {
      cs: 'Stromeček, betlém, zvonky, anděl, vánoční svíčka a ozdoby.',
      en: 'Christmas tree, nativity, bells, angel, Christmas candle and ornaments.',
    },
    model: '/models/lumi-2-vanoce.glb',
    ...image('vanoce', 'Vánoční lucerna Lumi 2 s betlémem na stole u zasněženého okna.', 'Christmas Lumi 2 lantern with a nativity on a table by a snowy window.'),
  },
];

export const DEFAULT_MOTIF = 'priroda';

export function motifBySlug(slug: string | null | undefined): LumiMotif | undefined {
  if (!slug) return undefined;
  return LUMI_MOTIFS.find((motif) => motif.slug === slug);
}

/** Motiv, ke kterému se smí vztahovat objednávka (`lamp-001`). */
export const MOTIF_PRODUCT_ID = 'lamp-001';
