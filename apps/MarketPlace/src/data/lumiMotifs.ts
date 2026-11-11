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
  image: string;
  thumb: string;
}

const image = (slug: string) => ({
  image: `/images/motifs/${slug}/produkt-700.webp`,
  thumb: `/images/motifs/${slug}/produkt-200.webp`,
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
    ...image('priroda'),
  },
  {
    slug: 'svatebni',
    name: { cs: 'Svatební', en: 'Wedding' },
    walls: {
      cs: 'Dvě srdce, prsteny, holubice, strom lásky, květinové srdce a svatební pár.',
      en: 'Two hearts, rings, dove, tree of love, floral heart and a wedding couple.',
    },
    model: '/models/lumi-2-svatebni.glb',
    ...image('svatebni'),
  },
  {
    slug: 'kvetinove',
    name: { cs: 'Květinové', en: 'Floral' },
    walls: {
      cs: 'Růže, slunečnice, kopretiny, vlčí máky, kosatce a rozkvetlá louka.',
      en: 'Roses, sunflowers, daisies, poppies, irises and a flowering meadow.',
    },
    model: '/models/lumi-2-kvetinove.glb',
    ...image('kvetinove'),
  },
  {
    slug: 'oceanske',
    name: { cs: 'Oceánské', en: 'Ocean' },
    walls: {
      cs: 'Delfín, mořská želva, mořský koník, velryba, nautilus a korálový útes.',
      en: 'Dolphin, sea turtle, seahorse, whale, nautilus and a coral reef.',
    },
    model: '/models/lumi-2-oceanske.glb',
    ...image('oceanske'),
  },
  {
    slug: 'vesmirne',
    name: { cs: 'Vesmírné', en: 'Cosmic' },
    walls: {
      cs: 'Saturn, galaxie, raketa, Země, kometa a slunce s měsícem.',
      en: 'Saturn, galaxy, rocket, Earth, comet and sun with moon.',
    },
    model: '/models/lumi-2-vesmirne.glb',
    ...image('vesmirne'),
  },
  {
    slug: 'vanoce',
    name: { cs: 'Vánoce', en: 'Christmas' },
    walls: {
      cs: 'Stromeček, betlém, zvonky, anděl, vánoční svíčka a ozdoby.',
      en: 'Christmas tree, nativity, bells, angel, Christmas candle and ornaments.',
    },
    model: '/models/lumi-2-vanoce.glb',
    ...image('vanoce'),
  },
];

export const DEFAULT_MOTIF = 'priroda';

export function motifBySlug(slug: string | null | undefined): LumiMotif | undefined {
  if (!slug) return undefined;
  return LUMI_MOTIFS.find((motif) => motif.slug === slug);
}

/** Motiv, ke kterému se smí vztahovat objednávka (`lamp-001`). */
export const MOTIF_PRODUCT_ID = 'lamp-001';
