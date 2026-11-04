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
  /** „Jak to funguje" — číslované kroky */
  steps: { cs: string[]; en: string[] };
  /** FAQ — otázky a odpovědi */
  faq: { q: XmasText; a: XmasText }[];
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
    steps: {
      cs: [
        'Koupíš ZION Pass v obchodě za 108 Kč.',
        'Na e-mail ti okamžitě přijde jedinečný kód **ZAP-…** — tvůj průkaz.',
        'Kód uplatníš na **nirvana.zionterranova.com** → otevřou se hry, světy a chat Království srdce.',
        'Týž kód odemkne **ZION Archiv** — kanonické texty, Kroniky a edice.',
        'E-mailem ti dorazí i **ZION peněženka** (adresa + seed phrase) s bonusem **108 000 ZION**.',
        'Peněženku pak jednoduše **naimportuješ do ZIS** a dalších ZION aplikací.',
      ],
      en: [
        'Buy the ZION Pass in the shop for 108 CZK.',
        'A unique **ZAP-…** code — your credential — arrives by e-mail instantly.',
        'Redeem it on **nirvana.zionterranova.com** → the games, worlds and chat of the Kingdom of Hearts open.',
        'The same code unlocks the **ZION Archive** — canonical texts, Chronicles and editions.',
        'Your **ZION wallet** (address + seed phrase) also arrives by e-mail carrying the **108,000 ZION** bonus.',
        'Then simply **import the wallet into ZIS** and other ZION apps.',
      ],
    },
    faq: [
      {
        q: { cs: 'Co je to kód ZAP-…?', en: 'What is the ZAP-… code?' },
        a: {
          cs: 'Jedinečný identifikátor tvého průkazu (Zion Archive Pass). Jeden kód funguje na obou místech — v Nirvaně i v Archivu. Dorazí e-mailem po zaplacení.',
          en: 'A unique identifier of your pass (Zion Archive Pass). One code works in both places — Nirvana and the Archive. It arrives by e-mail after payment.',
        },
      },
      {
        q: { cs: 'Jak peněženku dostanu a co s ní?', en: 'How do I get the wallet and what do I do with it?' },
        a: {
          cs: 'Peněženka přijde e-mailem — adresa, seed phrase a privátní klíč, už s připsaným bonusem. Seed ulož offline (papír, ne cloud!). Pak ji jedním importem přeneseš do ZIS a do desktopových i mobilních ZION aplikací.',
          en: 'The wallet arrives by e-mail — address, seed phrase and private key, already carrying the bonus. Store the seed offline (paper, not cloud!). Then import it into ZIS and the ZION desktop & mobile apps in one step.',
        },
      },
      {
        q: { cs: 'Můžu Pass někomu darovat?', en: 'Can I gift the Pass to someone?' },
        a: {
          cs: 'Ano — stačí předat e-mail s kódem ZAP a peněženkou. Kód váže na průkaz, ne na osobu. Je to nejjednodušší vánoční dárek do světa ZION.',
          en: 'Yes — just pass on the e-mail with the ZAP code and wallet. The code binds to the credential, not a person. The easiest Christmas gift into the ZION world.',
        },
      },
      {
        q: { cs: 'Na čem Nirvana běží?', en: 'What does Nirvana run on?' },
        a: {
          cs: 'V prohlížeči — žádná instalace. Otevřeš nirvana.zionterranova.com, zadáš kód a jsi uvnitř.',
          en: 'In the browser — nothing to install. Open nirvana.zionterranova.com, enter the code, and you are in.',
        },
      },
      {
        q: { cs: 'Je to investice?', en: 'Is this an investment?' },
        a: {
          cs: 'Ne. ZION bonus nemá peněžní hodnotu a celý ekosystém je experimentální projekt. Kupuješ průkaz a podporu světa — ne nárok na výnos.',
          en: 'No. The ZION bonus has no monetary value and the whole ecosystem is an experimental project. You are buying a credential and supporting a world — not a claim on returns.',
        },
      },
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
    steps: {
      cs: [
        'Koupíš knihu v obchodě za 216 Kč.',
        'Na e-mail ti přijde potvrzení s **odkazem ke stažení** — ZIP balíček kompletní sady.',
        'Rozbalíš ho a vybereš edici i jazyk — **40 knih** (8 edic × 5 jazyků) ve formátech PDF i EPUB.',
        'Čteš v čtečce, tabletu nebo počítači — EPUB na čtečky, PDF všude.',
        'E-mailem ti dorazí i **ZION peněženka** (adresa + seed phrase) s bonusem **216 000 ZION**.',
        'Peněženku **naimportuješ do ZIS** a dalších ZION aplikací — a **ZION Archive Pass** ti otevře Archiv.',
      ],
      en: [
        'Buy the book in the shop for 216 CZK.',
        'An order confirmation e-mail arrives with the **download link** — a ZIP of the complete set.',
        'Unpack it and pick your edition and language — **40 books** (8 editions × 5 languages) in PDF and EPUB.',
        'Read on an e-reader, tablet or computer — EPUB for readers, PDF everywhere.',
        'Your **ZION wallet** (address + seed phrase) also arrives by e-mail carrying the **216,000 ZION** bonus.',
        '**Import the wallet into ZIS** and other ZION apps — and your **ZION Archive Pass** opens the Archive.',
      ],
    },
    faq: [
      {
        q: { cs: 'Co přesně dostanu za 216 Kč?', en: 'What exactly do I get for 216 CZK?' },
        a: {
          cs: 'Kompletní ediční sadu: 8 samostatných edic příběhu Království srdce, každou v 5 jazycích — 40 souborů (PDF i EPUB), přes 3 200 stran. Plus ZION Archive Pass a bonus 216 000 ZION.',
          en: 'The complete edition set: 8 distinct editions of the Kingdom of Hearts story, each in 5 languages — 40 files (PDF & EPUB), over 3,200 pages. Plus a ZION Archive Pass and a 216,000 ZION bonus.',
        },
      },
      {
        q: { cs: 'Co je „Kotva pravdy"?', en: 'What is the “Truth Anchor”?' },
        a: {
          cs: 'Tabulka u kapitol každé edice — poctivě říká, co je Písmo, tradice, historie, legenda a co literární obraz. Čteš příběh a zároveň víš, na čem stojí.',
          en: 'A table by the chapters of each edition — it honestly states what is Scripture, tradition, history, legend and what is literary imagery. You read the story and know what it stands on.',
        },
      },
      {
        q: { cs: 'Ve kterých jazycích je kniha?', en: 'Which languages is the book in?' },
        a: {
          cs: 'Čeština, angličtina, španělština, francouzština a portugalština — každá edice ve všech pěti jazycích. Ideální i jako dárek do zahraničí.',
          en: 'Czech, English, Spanish, French and Portuguese — every edition in all five languages. Ideal as a gift abroad too.',
        },
      },
      {
        q: { cs: 'Jak a kdy dostanu peněženku s bonusem?', en: 'How and when do I get the bonus wallet?' },
        a: {
          cs: 'Po dokončení objednávky ti na e-mail dorazí ZION peněženka — adresa, seed phrase a privátní klíč, s připsaných 216 000 ZION. Seed ulož offline. Pak ji jedním importem přeneseš do ZIS a ZION aplikací.',
          en: 'After the order completes, your ZION wallet arrives by e-mail — address, seed phrase and private key, carrying 216,000 ZION. Store the seed offline. Then import it into ZIS and the ZION apps in one step.',
        },
      },
      {
        q: { cs: 'Můžu knihu darovat nebo tisknout?', en: 'Can I gift or print the book?' },
        a: {
          cs: 'Pro osobní potřebu ano — předat soubory dál je jednoduché jako přeposlat e-mail. Pro tištěnou podobu pro cizí lidi doporučujeme počkat na tištěnou edici; podrobnosti licence jsou uvnitř každého souboru.',
          en: 'For personal use yes — gifting files is as simple as forwarding the e-mail. For printed copies for other people, we recommend waiting for the print edition; licence details are inside each file.',
        },
      },
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
    steps: {
      cs: [
        '**Teď:** produkt se připravuje — prodej spustíme, jakmile bude výrobek hotový.',
        'Digitální část přijde **e-mailem hned po objednávce**: kniha (40 knih, 5 jazyků) + ZION Pass kód.',
        'Zároveň ti dorazí **ZION peněženka** (adresa + seed phrase) s bonusem **432 000 ZION**.',
        'Lampion mezitím vzniká v dílně — ruční gravírování vzoru Srdce Království.',
        'Hotový výrobek pošleme **Zásilkovnou** — dorazí zabalený jako dárek.',
        'Peněženku **naimportuješ do ZIS** a dalších ZION aplikací — bonus použiješ v ekosystému.',
      ],
      en: [
        '**Now:** the product is in preparation — sales open once the craft is ready.',
        'The digital part arrives **by e-mail right after ordering**: the book (40 books, 5 languages) + ZION Pass code.',
        'Your **ZION wallet** (address + seed phrase) also arrives carrying the **432,000 ZION** bonus.',
        'Meanwhile the lantern is made in the workshop — hand-engraved Heart of the Kingdom pattern.',
        'The finished craft ships by **Zásilkovna** — arriving wrapped like a gift.',
        '**Import the wallet into ZIS** and other ZION apps — and use the bonus across the ecosystem.',
      ],
    },
    faq: [
      {
        q: { cs: 'Kdy bude lampion k prodeji?', en: 'When will the lantern be on sale?' },
        a: {
          cs: 'Jakmile bude výrobek hotový — jde o ruční výrobu, ne skladový kus. Sledujte stránku; vánoční série bude číselně omezená.',
          en: 'Once the craft is ready — this is handmade work, not a stocked item. Watch this page; the Christmas run will be numerically limited.',
        },
      },
      {
        q: { cs: 'Co přesně je v ceně 432 Kč?', en: 'What exactly does the 432 CZK include?' },
        a: {
          cs: 'Tři věci: ručně gravírovaný lampion (fyzický výrobek), digitální knihu Království srdce v plné sadě a ZION Pass do Nirvany i Archivu. Plus bonus 432 000 ZION na peněženku.',
          en: 'Three things: the hand-engraved lantern (a physical craft), the full digital Kingdom of Hearts book set, and a ZION Pass for Nirvana and the Archive. Plus a 432,000 ZION bonus to your wallet.',
        },
      },
      {
        q: { cs: 'Jak dostanu peněženku s bonusem?', en: 'How do I get the bonus wallet?' },
        a: {
          cs: 'E-mailem po dokončení objednávky — adresa, seed phrase a privátní klíč, s připsaných 432 000 ZION. Seed ulož offline. Pak ji jedním importem přeneseš do ZIS a ZION aplikací.',
          en: 'By e-mail once the order completes — address, seed phrase and private key, carrying 432,000 ZION. Store the seed offline. Then import it into ZIS and the ZION apps in one step.',
        },
      },
      {
        q: { cs: 'Můžu si přát vlastní gravírování?', en: 'Can I request custom engraving?' },
        a: {
          cs: 'Vánoční edice má pevný vzor Srdce Království. Zakázkové gravírování řeší naše služba Gravírování na zakázku — po spuštění prodeje můžeme domluvit varianty.',
          en: 'The Christmas edition carries the fixed Heart of the Kingdom pattern. Custom engraving is handled by our Engraving-on-order service — once sales open, we can discuss variants.',
        },
      },
      {
        q: { cs: 'Jak bude lampion doručen?', en: 'How will the lantern be delivered?' },
        a: {
          cs: 'Jako zboží na zakázku odesíláme Zásilkovnou na výdejní místo nebo adresu — zabalený tak, aby mohl sloužit přímo jako dárek pod stromeček.',
          en: 'As made-to-order goods we ship via Zásilkovna to a pickup point or address — packaged so it can serve directly as a gift under the tree.',
        },
      },
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
