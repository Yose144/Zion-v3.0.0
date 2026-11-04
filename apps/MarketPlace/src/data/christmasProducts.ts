// Vánoční edice 2026 — detailní stránky produktů (/vanoce/[slug])
// Prezentační data: obsah stránek, ne DB záznamy. Prodej řeší ShopProduct (zion-pass-001, book-001, lamp-001).

export interface XmasText {
  cs: string;
  en: string;
}

export interface XmasQuote {
  cs: string;
  en: string;
  source: XmasText;
}

export interface XmasProduct {
  slug: string;
  /** externalId produktu v e-shopu (pro nákupní CTA) */
  externalId: string;
  image: string;
  imageAlt: XmasText;
  priceCzk: number;
  bonus: number;
  /** true = lze koupit (CTA → /shop); false = Připravujeme */
  buyable: boolean;
  kicker: XmasText;
  title: XmasText;
  subtitle: XmasText;
  intro: XmasText;
  details: XmasText[];
  /** „V ceně" / „What you get" — odrážky */
  inBox: { cs: string[]; en: string[] };
  features: XmasText[];
  quotes?: XmasQuote[];
  /** Volitelná poznámka pod CTA (např. „fotografie jsou ilustrační") */
  note?: XmasText;
}

export const christmasProducts: XmasProduct[] = [
  {
    slug: 'zion-pass',
    externalId: 'zion-pass-001',
    image: '/vanoce-pass.webp',
    imageAlt: {
      cs: 'ZION Pass — zlatá brána do Království srdce',
      en: 'ZION Pass — golden gate into the Kingdom of Hearts',
    },
    priceCzk: 108,
    bonus: 108000,
    buyable: true,
    kicker: { cs: 'Vánoční edice 2026 · Digitální průkaz', en: 'Christmas Edition 2026 · Digital pass' },
    title: { cs: 'ZION Pass', en: 'ZION Pass' },
    subtitle: {
      cs: 'Jeden kód — dva světy. Vstup do Nirvany i ZION Archivu.',
      en: 'One code — two worlds. Access to Nirvana and the ZION Archive.',
    },
    intro: {
      cs: 'ZION Pass je digitální průkaz do světa ZION — vánoční vstupenka, která otevírá bránu do Nirvany i do ZION Archivu.',
      en: 'The ZION Pass is a digital credential into the ZION world — a Christmas ticket that opens the gate to Nirvana and the ZION Archive.',
    },
    details: [
      {
        cs: 'S jedním kódem ZAP-… vstoupíte do **Nirvany** — 3D portálu Království srdce, kde žijí hry, světy a společný chat. Tentýž kód otevírá **ZION Archiv** — knihovnu kanonických textů, Kronik a edic, které drží příběh pohromadě.',
        en: 'A single ZAP-… code opens **Nirvana** — the 3D Kingdom of Hearts portal with its games, worlds and shared chat. The same code unlocks the **ZION Archive** — the library of canonical texts, Chronicles, and editions that keep the story together.',
      },
      {
        cs: 'Po zaplacení přijde jedinečný kód na váš e-mail. Uplatníte ho na nirvana.zionterranova.com i v ZION Archivu — bez čekání, bez dopravy, doručení je okamžité.',
        en: 'After payment, a unique code arrives by e-mail. Redeem it on nirvana.zionterranova.com and in the ZION Archive — no waiting, no shipping, delivery is instant.',
      },
      {
        cs: 'Vánoční edice navíc nese bonus: **108 000 ZION** na vaši ZION peněženku — tisíc ZION za každou korunu.',
        en: 'The Christmas edition carries a bonus: **108,000 ZION** sent to your ZION wallet — a thousand ZION for every crown.',
      },
    ],
    inBox: {
      cs: [
        'Jedinečný kód ZAP-… doručený e-mailem',
        'Vstup do Nirvany — hry, světy, chat',
        'Vstup do ZION Archivu — Kroniky a edice',
        'Bonus 108 000 ZION na peněženku',
      ],
      en: [
        'Unique ZAP-… code delivered by e-mail',
        'Nirvana access — games, worlds, chat',
        'ZION Archive access — Chronicles & editions',
        '108,000 ZION bonus to your wallet',
      ],
    },
    features: [
      { cs: 'Okamžité digitální doručení', en: 'Instant digital delivery' },
      { cs: 'Bez dopravy — kód e-mailem', en: 'No shipping — code by e-mail' },
      { cs: 'Funguje jako dárek', en: 'Works as a gift' },
    ],
  },
  {
    slug: 'kniha-kralovstvi-srdce',
    externalId: 'book-001',
    image: '/shop/img/books/kralovstvi-srdce-wide.webp',
    imageAlt: {
      cs: 'Kniha Království srdce — obálka ilustrované edice',
      en: 'Kingdom of Hearts book — illustrated edition cover',
    },
    priceCzk: 216,
    bonus: 216000,
    buyable: true,
    kicker: { cs: 'Vánoční edice 2026 · Digitální kniha', en: 'Christmas Edition 2026 · Digital book' },
    title: { cs: 'Království srdce', en: 'Kingdom of Hearts' },
    subtitle: {
      cs: 'Příběh lodi, kterou postavil tesař — pro moře, jež není na žádné mapě.',
      en: 'The story of the ship a carpenter built — for a sea found on no map.',
    },
    intro: {
      cs: 'Duchovní legenda o tesaři z Nazareta, který v dílně svého otce stavěl loď pro vody dovnitř člověka — a vyryl jí jméno do kýlu, ne na bok pro chloubu v přístavu.',
      en: 'A spiritual legend about the carpenter of Nazareth who, in his father\u2019s workshop, built a ship for the inward waters of a person — and carved her name into the keel, not on her side to boast in the harbour.',
    },
    details: [
      {
        cs: 'Kompletní ediční sada: **osm samostatných edic** téhož příběhu, každá v **pěti jazycích** (čeština, angličtina, španělština, francouzština, portugalština) — celkem **40 knih**, přes 3 200 stran, ve formátech PDF i EPUB.',
        en: 'The complete edition set: **eight distinct editions** of the same story, each in **five languages** (Czech, English, Spanish, French, Portuguese) — **40 books** in total, over 3,200 pages, in PDF and EPUB.',
      },
      {
        cs: 'Každá edice nese u kapitol tabulku **„Kotva pravdy"** — poctivě rozlišuje, co je Písmo, tradice, historie, legenda a co je literární obraz. Příběh se neprohlašuje za fakt; slibuje upřímnost.',
        en: 'Every edition carries a **“Truth Anchor”** table by its chapters — honestly distinguishing what is Scripture, tradition, history, legend, and what is literary image. The story claims no facts; it promises honesty.',
      },
      {
        cs: 'Ke knize dostanete **ZION Archive Pass** — vstup do ZION Archivu. A ve vánoční edici bonus **216 000 ZION** na vaši peněženku (Genesis vstup pro Guardians ekosystému ZION).',
        en: 'The book includes a **ZION Archive Pass** — entry into the ZION Archive. And in the Christmas edition, a **216,000 ZION** bonus to your wallet (Genesis entry for the ZION Guardians).',
      },
    ],
    inBox: {
      cs: [
        '40 knih — 8 edic × 5 jazyků (PDF i EPUB)',
        'Ilustrovaná vlajková edice',
        'Tabulky „Kotva pravdy" u kapitol',
        'ZION Archive Pass v ceně',
        'Bonus 216 000 ZION na peněženku',
      ],
      en: [
        '40 books — 8 editions × 5 languages (PDF & EPUB)',
        'Illustrated flagship edition',
        '“Truth Anchor” tables by chapter',
        'ZION Archive Pass included',
        '216,000 ZION bonus to your wallet',
      ],
    },
    features: [
      { cs: 'Okamžité stažení po objednávce', en: 'Instant download after ordering' },
      { cs: '5 jazyků, 8 edic, 3 200+ stran', en: '5 languages, 8 editions, 3,200+ pages' },
      { cs: 'PDF + EPUB', en: 'PDF + EPUB' },
    ],
    quotes: [
      {
        cs: '„Ale některá jména musí člověk slyšet znovu, aby jim porozuměl.“',
        en: '“But there are names you have to hear again before you understand them.”',
        source: { cs: 'Prolog · Světlo před svítáním', en: 'Prologue · Light before dawn' },
      },
      {
        cs: '„Říká se jí Království, protože v ní nikdy nikdo nepluje sám. A říká se jí Srdce, protože tam je jediné kormidlo, které neselže, když zhasnou hvězdy.“',
        en: '“She is called Kingdom because no one ever sails in her alone. And she is called Heart because there lies the only rudder that will not fail when the stars go out.”',
        source: { cs: 'Kapitola 7 · Království je uvnitř vás', en: 'Chapter 7 · The Kingdom is within you' },
      },
      {
        cs: '„Plnou nádobu ti může král nebo zloděj ukrást. Vyprázdněnou nádobu už ti nikdo nevezme — protože to, co bylo odevzdáno, nelze zabavit.“',
        en: '“A king or a thief can steal a full vessel from you. No one can take an emptied vessel away — for what has been given cannot be confiscated.”',
        source: { cs: 'Kapitola 8 · Alabastrová nádobka', en: 'Chapter 8 · The alabaster jar' },
      },
      {
        cs: '„U nás prostíráme jedno místo navíc. Dnes jsem poznala, komu patří. Až na to zase zapomeneme, někdo nám bude muset vyprávět o lodi.“',
        en: '“Where I come from, we lay one extra place. Today I learned whom it belongs to. When we forget again, someone will have to tell us about a boat.”',
        source: { cs: 'Epilog · První prkno', en: 'Epilogue · The first plank' },
      },
    ],
  },
  {
    slug: 'lampion',
    externalId: 'lamp-001',
    image: '/vanoce-lampion.webp',
    imageAlt: {
      cs: 'Lampion Království srdce — gravírovaný výrobek z dílny tesaře',
      en: 'Kingdom of Hearts lantern — engraved craft from the carpenter\u2019s workshop',
    },
    priceCzk: 432,
    bonus: 432000,
    buyable: false,
    kicker: { cs: 'Vánoční edice 2026 · Ruční výroba', en: 'Christmas Edition 2026 · Handmade' },
    title: { cs: 'Lampion – Království srdce', en: 'Lantern – Kingdom of Hearts' },
    subtitle: {
      cs: 'Světlo srdce pro novou zemi — z tesařské dílny příběhu.',
      en: 'Light of the heart for a new land — from the carpenter\u2019s workshop of the story.',
    },
    intro: {
      cs: 'Ručně gravírovaný lampion se vzorem Srdce Království — světlo, jaké nesla Lumi u brány, a jaké viselo nad tesařovým hoblíkem v Nazaretě.',
      en: 'A hand-engraved lantern bearing the Heart of the Kingdom pattern — the light Lumi carried at the gate, the one that hung above the carpenter\u2019s plane in Nazareth.',
    },
    details: [
      {
        cs: 'Vánoční edice: ke každému lampionu **digitální kniha Království srdce** a **ZION Pass** v ceně — celý příběh i vstup do světa, ze kterého lampion vychází.',
        en: 'Christmas edition: every lantern includes the **digital Kingdom of Hearts book** and a **ZION Pass** — the whole story and entry into the world the lantern comes from.',
      },
      {
        cs: 'Bonus **432 000 ZION** na vaši peněženku — tisíc ZION za každou korunu.',
        en: 'A **432,000 ZION** bonus to your wallet — a thousand ZION for every crown.',
      },
      {
        cs: 'Lampion vyrábíme ručně — prodej zahájíme, jakmile bude výrobek hotový. Číslo vánoční edice bude omezené.',
        en: 'The lantern is made by hand — sales open once the craft is ready. The Christmas edition run will be limited.',
      },
    ],
    inBox: {
      cs: [
        'Ručně gravírovaný lampion — vzor Srdce Království',
        'Digitální kniha Království srdce (40 knih, 5 jazyků)',
        'ZION Pass — Nirvana + Archiv',
        'Bonus 432 000 ZION na peněženku',
      ],
      en: [
        'Hand-engraved lantern — Heart of the Kingdom pattern',
        'Digital Kingdom of Hearts book (40 books, 5 languages)',
        'ZION Pass — Nirvana + Archive',
        '432,000 ZION bonus to your wallet',
      ],
    },
    features: [
      { cs: 'Ruční gravírování', en: 'Hand-engraved' },
      { cs: 'Omezená vánoční série', en: 'Limited Christmas run' },
      { cs: 'Kniha a ZION Pass v ceně', en: 'Book and ZION Pass included' },
    ],
    note: {
      cs: 'Fotografie jsou ilustrační — ruční výroba se může v detailu lišit. Zboží na zakázku.',
      en: 'Photos are illustrative — handmade craft may vary in detail. Made-to-order goods.',
    },
  },
];

export function getXmasProduct(slug: string): XmasProduct | undefined {
  return christmasProducts.find((p) => p.slug === slug);
}
