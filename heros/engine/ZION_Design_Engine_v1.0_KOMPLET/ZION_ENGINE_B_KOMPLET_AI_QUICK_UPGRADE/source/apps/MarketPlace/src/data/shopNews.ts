/**
 * Novinky na homepage — co se právě děje v marketu.
 *
 * Nahradilo „varovný“ pruh „Marketplace je ve výstavbě“ (`public/status.json`),
 * který visel nad celým obchodem a říkal jen to, že se něco dodělává. Novinky
 * říkají totéž pozitivně a konkrétně: obchod je otevřený, co se prodává a jaká
 * je vánoční kampaň.
 *
 * Proč data v souboru a ne v `translations.ts`: novinky se mění častěji než
 * UI a mají vlastní životní cyklus (kampaň skončí, produkt se přidá). Tady je
 * jedno místo, kde se to edituje — a když je prázdné pole, sekce se nevykreslí.
 *
 * **Kampaň:** sazba i termín musí odpovídat `ShopSetting campaign:*` v DB
 * (`campaign:book-001` = 31 104 ZION za 216 Kč, `endsAt 2026-12-24`). Bonusy
 * níž se počítají ze sazby, aby se nemohly rozejít s cenou.
 */

export interface ShopNewsText {
  cs: string;
  en: string;
}

export interface ShopNewsProduct {
  externalId: string;
  name: ShopNewsText;
  priceCzk: number;
  href: string;
  /** Obrázek produktu — stejný, jaký má karta v e-shopu (ne ilustrace „od oka“). */
  image: string;
  imageAlt: ShopNewsText;
  /** false = produkt ještě není v prodeji (tlačítko/odkaz se neaktivuje) */
  buyable: boolean;
  note?: ShopNewsText;
}

/** 1 Kč = 144 ZION — vánoční kampaň (běžné zboží má 10 ZION/Kč). */
export const ZION_PER_CZK = 144;

/** Konec vánoční kampaně (shoduje se s `endsAt` v DB). */
export const CAMPAIGN_ENDS_AT = '2026-12-24T23:59:59+01:00';

/** Tři vánoční kusy — pořadí je záměrné: vstup, kniha, výrobek. */
export const CHRISTMAS_EDITION_PRODUCTS: ShopNewsProduct[] = [
  {
    externalId: 'zion-pass-001',
    name: { cs: 'ZION Pass', en: 'ZION Pass' },
    priceCzk: 108,
    href: '/vanoce/zion-pass',
    image: '/shop/img/products/zion-pass-001_zion-pass.webp?v=engine-v1',
    imageAlt: { cs: 'ZION Pass — zlatá karta do Nirvany a Archivu', en: 'ZION Pass — the golden card into Nirvana and the Archive' },
    buyable: true,
  },
  {
    externalId: 'book-001',
    name: { cs: 'Království srdce — kniha', en: 'Kingdom of Hearts — book' },
    priceCzk: 216,
    href: '/vanoce/kniha-kralovstvi-srdce',
    image: '/shop/img/products/book-001_kralovstvi-srdce.webp?v=engine-v1',
    imageAlt: { cs: 'Kniha Království srdce — obálka s lodí', en: 'Kingdom of Hearts book — cover with the ship' },
    buyable: true,
  },
  {
    externalId: 'lamp-001',
    name: { cs: 'Druhá lucerna', en: 'Second lantern' },
    priceCzk: 490,
    href: '/vanoce/lampion',
    image: '/shop/img/products/lamp-001_lumi-2.webp?v=engine-v1',
    imageAlt: { cs: 'Druhá lucerna — Lumi 2 z 3mm překližky, rozsvícená', en: 'The second lantern — Lumi 2 in 3 mm plywood, lit' },
    buyable: true,
  },
];

/** Obrázky doprovodných karet — skutečné assety z e-shopu, ne ilustrace. */
export const SHOP_NEWS_IMAGES = {
  market: {
    src: '/hero-kolekce-2027.webp?v=engine-v1',
    alt: {
      cs: 'Zimní trh Království srdce — archa, strom a lucerny',
      en: 'The Kingdom of Hearts winter market — the ark, the tree and lanterns',
    },
  },
  campaign: {
    src: '/vanoce/hero/lampion-wide.webp?v=engine-v1',
    alt: {
      cs: 'Lampion Lumi 2 na tesařském stole s knihou a ZION Passem',
      en: 'The Lumi 2 lantern on the carpenter’s table with the book and the ZION Pass',
    },
  },
} as const;

export const SHOP_NEWS = {
  kicker: { cs: 'Novinky', en: 'What’s new' },
  until: { cs: 'Vánoční edice 2026 · do 24. 12.', en: 'Christmas edition 2026 · until 24 Dec' },
  allProducts: { cs: 'Všechno zboží', en: 'All products' },

  openTitle: { cs: 'Market je otevřený', en: 'The market is open' },
  openBody: {
    cs: 'Objednávky běží — platba kartou, bankovním převodem, ZION i krypto. Digitální zboží (kniha, ZION Pass) dorazí e-mailem hned po zaplacení, fyzické kusy posíláme Zásilkovnou.',
    en: 'Orders are live — pay by card, bank transfer, ZION or crypto. Digital goods (the book, the ZION Pass) arrive by e-mail right after payment; physical pieces ship via Zásilkovna.',
  },
  openCta: { cs: 'Do e-shopu', en: 'Browse the shop' },

  productsTitle: { cs: 'Tři vánoční kusy', en: 'Three Christmas pieces' },
  productsBody: {
    cs: 'Pass otevírá svět, kniha nese příběh, lampion přijde rozložený — světlo si zapálíš sám.',
    en: 'The Pass opens a world, the book carries the story, the lantern arrives flat — you light it yourself.',
  },

  campaignTitle: { cs: 'Kampaň do Vánoc', en: 'Christmas campaign' },
  campaignLead: {
    cs: 'Za každou korunu',
    en: 'For every crown',
  },
  campaignUnit: { cs: 'ZION', en: 'ZION' },
  campaignBody: {
    cs: 'Bonus se připíše na ZION peněženku, kterou dostanete k objednávce — použijete ji v celém ekosystému ZION.',
    en: 'The bonus lands in the ZION wallet that comes with your order — usable across the whole ZION ecosystem.',
  },
  editionCta: { cs: 'Celá edice', en: 'The whole edition' },
  shopCta: { cs: 'Nakoupit s bonusem', en: 'Shop with the bonus' },
} as const;

/** Bonus v ZIONech pro danou cenu (zaokrouhleno na celé ZIONy). */
export function bonusFor(priceCzk: number): number {
  return Math.round(priceCzk * ZION_PER_CZK);
}
