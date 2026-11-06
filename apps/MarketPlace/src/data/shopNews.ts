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
 * (`campaign:book-001` = 21 600 ZION za 216 Kč, `endsAt 2026-12-24`). Bonusy
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
  /** false = produkt ještě není v prodeji (tlačítko/odkaz se neaktivuje) */
  buyable: boolean;
  note?: ShopNewsText;
}

/** 1 Kč = 100 ZION — stejná sazba jako `ShopSetting campaign:*`. */
export const ZION_PER_CZK = 100;

/** Konec vánoční kampaně (shoduje se s `endsAt` v DB). */
export const CAMPAIGN_ENDS_AT = '2026-12-24T23:59:59+01:00';

/** Tři vánoční kusy — pořadí je záměrné: vstup, kniha, výrobek. */
export const CHRISTMAS_EDITION_PRODUCTS: ShopNewsProduct[] = [
  {
    externalId: 'zion-pass-001',
    name: { cs: 'ZION Pass', en: 'ZION Pass' },
    priceCzk: 108,
    href: '/vanoce/zion-pass',
    buyable: true,
  },
  {
    externalId: 'book-001',
    name: { cs: 'Království srdce — kniha', en: 'Kingdom of Hearts — book' },
    priceCzk: 216,
    href: '/vanoce/kniha-kralovstvi-srdce',
    buyable: true,
  },
  {
    externalId: 'lamp-001',
    name: { cs: 'Lampion Lumi 2', en: 'Lumi 2 lantern' },
    priceCzk: 432,
    href: '/vanoce/lampion',
    buyable: false,
    note: { cs: 'Připravujeme', en: 'Coming soon' },
  },
];

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
    cs: 'Každý nese stejnou myšlenku: světlo, knihu a vstup do světa, ze kterého pochází.',
    en: 'Each carries the same idea: the light, the book, and entry into the world they come from.',
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
  campaignCta: { cs: 'Vánoční edice', en: 'Christmas edition' },
} as const;

/** Bonus v ZIONech pro danou cenu (zaokrouhleno na celé ZIONy). */
export function bonusFor(priceCzk: number): number {
  return Math.round(priceCzk * ZION_PER_CZK);
}
