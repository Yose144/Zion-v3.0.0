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
  /** Čísla/výčty pro pruh faktů na detailu i na homepage */
  facts?: XmasFact[];
  /** Konkrétní ukázky z knihy — reálné odstavce z rukopisu */
  samples?: XmasSample[];
  /** Ediční řada (kniha má osm edic téhož příběhu) */
  editions?: XmasEdition[];
  /** Kratší, konkrétnější text pro kartu na homepage */
  home?: { lead: XmasText; bullets: XmasText[] };
  /** Široký obrázek pro kartu na homepage (1672×941) */
  hero?: string;
  /** Ultraširoký banner pro hero na detailu (1983×793 ≈ 21:9) */
  heroWide?: string;
  /** Cesta k 3D modelu (glb) — slot na detailu; když soubor chybí, ukáže se „připravujeme" */
  model3d?: string;
  /**
   * Jak výrobek složit (jen u fyzických kusů). Bezpečnostní blok se
   * nepíše sem — ten drží `lib/fire-safety.ts`, aby pokladna, detail
   * i e-mail mluvily stejně.
   */
  guide?: {
    title: XmasText;
    intro: XmasText;
    steps: { title: XmasText; body: XmasText }[];
  };
  /** Doplňkové snímky do galerie na detailu */
  gallery?: { src: string; alt: XmasText }[];
  /**
   * Příběhová vsuvka k výrobku — ne prodejní text. Vykresluje se mezi
   * detailem a návodem na složení (serif, bez odrážek), protože vysvětluje,
   * *proč* je výrobek udělaný tak, jak je. Nesmí slibovat účinek ani
   * nahrazovat bezpečnostní blok (`lib/fire-safety.ts`).
   */
  story?: {
    kicker: XmasText;
    title: XmasText;
    lead?: XmasText;
    paragraphs: XmasText[];
    /** Vzkaz, který k výrobku patří — dvě věty, ne návod. */
    message?: { speaker: XmasText; text: XmasText; source?: XmasText }[];
    closing?: XmasText;
    /** Šest stěn — krátké kapitoly k mandalám, v pořadí cesty. */
    facesTitle?: XmasText;
    faces?: { tag: XmasText; name: XmasText; line: XmasText }[];
  };
}

export interface XmasFact {
  label: XmasText;
  value: XmasText;
  hint?: XmasText;
}

export interface XmasSample {
  /** „Ukázka · Prolog" */
  label: XmasText;
  /** název kapitoly */
  title: XmasText;
  /** odstavec (nebo dva) skutečného textu, cs + en */
  paragraphs: XmasText[];
  /** odkud text je */
  source: XmasText;
  /** ilustrace z knihy, která patří k této pasáži */
  image?: string;
}

export interface XmasEdition {
  slug: string;
  name: XmasText;
  line: XmasText;
  cover: string;
  /** počet slov v českém a anglickém rukopisu (z EDITION/00-STAV.md) */
  words: { cz: number; en: number };
  flagship?: boolean;
}

export const christmasProducts: XmasProduct[] = [
  {
    slug: 'zion-pass',
    externalId: 'zion-pass-001',
    image: '/vanoce-pass.webp?v=engine-v1',
    hero: '/vanoce/home/01_zion_pass.webp?v=engine-v1',
    heroWide: '/vanoce/hero/zion-pass-wide.webp?v=engine-v1',
    gallery: [
      {
        src: '/vanoce/galerie/zion-pass/02_nirvana_a_archiv.webp?v=engine-v1',
        alt: { cs: 'Nirvana a ZION Archiv za jednou branou', en: 'Nirvana and the ZION Archive behind one gate' },
      },
      {
        src: '/vanoce/galerie/zion-pass/03_digitalni_darek.webp?v=engine-v1',
        alt: { cs: 'ZION Pass jako digitální dárek do e-mailu', en: 'The ZION Pass as a digital gift in your inbox' },
      },
    ],
    imageAlt: {
      cs: 'ZION Pass — zlatá brána do Království srdce',
      en: 'ZION Pass — golden gate into the Kingdom of Hearts',
    },
    priceCzk: 108,
    bonus: 15552,
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
        cs: 'Vánoční edice navíc nese bonus: **15 552 ZION** na vaši ZION peněženku — sto čtyřicet čtyři ZION za každou korunu.',
        en: 'The Christmas edition carries a bonus: **15,552 ZION** sent to your ZION wallet — a hundred and forty-four ZION for every crown.',
      },
      {
        cs: '**Co je uvnitř:** v Nirvaně pět herních světů — aréna na Marsu, závod na Venuši, souboj na Merkuru, pouť u Jupitera a MOBA o Zemi — k tomu 200 avatarů a společný chat. V Archivu na vás čekají kanonické texty, Kroniky a edice, ze kterých ty světy vycházejí.',
        en: '**What is inside:** Nirvana holds five game worlds — the Mars arena, the Venus race, the Mercury duel, the Jupiter fairground and the Earth MOBA — plus 200 avatars and a shared chat. The Archive holds the canonical texts, Chronicles and editions the worlds grow from.',
      },
      {
        cs: '**Kód nemá expiraci.** Jakmile ho jednou uplatníte, zůstává váš — a protože se váže na průkaz, ne na osobu, dá se i přeposlat jako dárek.',
        en: '**The code does not expire.** Once redeemed it stays yours — and because it binds to the credential rather than a person, it can be forwarded as a gift.',
      },
    ],
    inBox: {
      cs: [
        'Jedinečný kód ZAP-… doručený e-mailem',
        'Vstup do Nirvany — hry, světy, chat',
        'Vstup do ZION Archivu — Kroniky a edice',
        'Bonus 15 552 ZION na peněženku',
      ],
      en: [
        'Unique ZAP-… code delivered by e-mail',
        'Nirvana access — games, worlds, chat',
        'ZION Archive access — Chronicles & editions',
        '15,552 ZION bonus to your wallet',
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
        'E-mailem ti dorazí i **ZION peněženka** (adresa + seed phrase) s bonusem **15 552 ZION**.',
        'Peněženku pak jednoduše **naimportuješ do ZIS** a dalších ZION aplikací.',
      ],
      en: [
        'Buy the ZION Pass in the shop for 108 CZK.',
        'A unique **ZAP-…** code — your credential — arrives by e-mail instantly.',
        'Redeem it on **nirvana.zionterranova.com** → the games, worlds and chat of the Kingdom of Hearts open.',
        'The same code unlocks the **ZION Archive** — canonical texts, Chronicles and editions.',
        'Your **ZION wallet** (address + seed phrase) also arrives by e-mail carrying the **15,552 ZION** bonus.',
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
    home: {
      lead: {
        cs: 'Jeden kód otevírá dva světy: **Nirvanu** — 3D svět Království srdce s pěti herními planetami a dvěma sty avatary — a **ZION Archiv** s kanonickými texty a Kronikami. Vánoční edice k tomu přidává 15 552 ZION.',
        en: 'One code opens two worlds: **Nirvana** — the 3D Kingdom of Hearts world with five game planets and two hundred avatars — and the **ZION Archive** with canonical texts and Chronicles. The Christmas edition adds 15,552 ZION on top.',
      },
      bullets: [
        {
          cs: 'Aréna na Marsu, závod na Venuši, souboj na Merkuru, pouť u Jupitera, MOBA na Zemi',
          en: 'Arena on Mars, race on Venus, duel on Mercury, fairground by Jupiter, MOBA on Earth',
        },
        {
          cs: '200 avatarů a společný chat — v prohlížeči, bez instalace',
          en: '200 avatars and a shared chat — in the browser, nothing to install',
        },
        {
          cs: 'ZION Archiv: kanonické texty, Kroniky a edice',
          en: 'ZION Archive: canonical texts, Chronicles and editions',
        },
        {
          cs: 'Bonus 15 552 ZION a peněženka e-mailem',
          en: '15,552 ZION bonus and a wallet by e-mail',
        },
      ],
    },
    facts: [
      {
        label: { cs: 'Kód', en: 'Code' },
        value: { cs: '1', en: '1' },
        hint: { cs: 'ZAP-… platí v Nirvaně i v Archivu', en: 'ZAP-… works in Nirvana and the Archive' },
      },
      {
        label: { cs: 'Světů', en: 'Worlds' },
        value: { cs: '5', en: '5' },
        hint: { cs: 'Mars · Venuše · Merkur · Jupiter · Země', en: 'Mars · Venus · Mercury · Jupiter · Earth' },
      },
      {
        label: { cs: 'Avatarů', en: 'Avatars' },
        value: { cs: '200', en: '200' },
        hint: { cs: 'z OASIS rosteru, vybíráš v profilu', en: 'from the OASIS roster, picked in your profile' },
      },
      {
        label: { cs: 'Bonus', en: 'Bonus' },
        value: { cs: '15 552 ZION', en: '15,552 ZION' },
        hint: { cs: 'sto čtyřicet čtyři ZION za každou korunu', en: 'a hundred and forty-four ZION for every crown' },
      },
    ],
  },
  {
    slug: 'kniha-kralovstvi-srdce',
    externalId: 'book-001',
    image: '/shop/img/books/kralovstvi-srdce-wide.webp?v=engine-v1',
    hero: '/vanoce/home/02_kralovstvi_srdce.webp?v=engine-v1',
    heroWide: '/vanoce/hero/kralovstvi-srdce-wide.webp?v=engine-v1',
    gallery: [
      {
        src: '/vanoce/galerie/kralovstvi-srdce/02_edicni_sada.webp?v=engine-v1',
        alt: { cs: 'Osmička edic Království srdce v jedné sadě', en: 'The eight editions of Kingdom of Hearts in one set' },
      },
      {
        src: '/vanoce/galerie/kralovstvi-srdce/03_cteni.webp?v=engine-v1',
        alt: { cs: 'Čtení Království srdce v PDF i EPUB', en: 'Reading Kingdom of Hearts in PDF and EPUB' },
      },
    ],
    imageAlt: {
      cs: 'Kniha Království srdce — obálka ilustrované edice',
      en: 'Kingdom of Hearts book — illustrated edition cover',
    },
    priceCzk: 216,
    bonus: 31104,
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
        cs: 'Kompletní ediční sada: **osm samostatných edic** téhož příběhu, každá v **pěti jazycích** (čeština, angličtina, španělština, francouzština, portugalština) — celkem **40 knih**, **3 252 stran** a **619 498 slov**, ve formátech PDF i EPUB.',
        en: 'The complete edition set: **eight distinct editions** of the same story, each in **five languages** (Czech, English, Spanish, French, Portuguese) — **40 books** in total, **3,252 pages** and **619,498 words**, in PDF and EPUB.',
      },
      {
        cs: 'Každá edice nese u kapitol tabulku **„Kotva pravdy"** — poctivě rozlišuje, co je Písmo, tradice, historie, legenda a co je literární obraz. Příběh se neprohlašuje za fakt; slibuje upřímnost.',
        en: 'Every edition carries a **“Truth Anchor”** table by its chapters — honestly distinguishing what is Scripture, tradition, history, legend, and what is literary image. The story claims no facts; it promises honesty.',
      },
      {
        cs: 'Ke knize dostanete **ZION Archive Pass** — vstup do ZION Archivu. A ve vánoční edici bonus **31 104 ZION** na vaši peněženku (Genesis vstup pro Guardians ekosystému ZION).',
        en: 'The book includes a **ZION Archive Pass** — entry into the ZION Archive. And in the Christmas edition, a **31,104 ZION** bonus to your wallet (Genesis entry for the ZION Guardians).',
      },
      {
        cs: '**Jak číst:** EPUB je pro čtečky a telefony — velikost písma si řídíte sami. PDF je pro tablet a počítač, kde drží sazbu i ilustrace. V sadě máte obě verze u každé z osmi edic, takže si vyberete podle zařízení, ne podle obsahu.',
        en: '**How to read:** EPUB is for e-readers and phones — you control the type size. PDF is for tablets and computers, where it keeps the typesetting and illustrations. Every one of the eight editions comes in both, so you choose by device, not by content.',
      },
      {
        cs: '**Kde začít:** ilustrovanou Novou plavbou. Je to vlajková verze s 24 kapitolami. Pak se vraťte ke Klasické edici — je nejkratší a ukazuje, z čeho ostatní edice vycházejí. Kdo chce experiment, otevře Knihu Kýlu vyprávěnou dřevem.',
        en: '**Where to start:** with the illustrated New Voyage — the flagship, 24 chapters. Then come back to the Classical Edition: it is the shortest and shows what the other editions grow from. If you want the experiment, open the Book of the Keel, told by the wood itself.',
      },
    ],
    inBox: {
      cs: [
        '40 knih — 8 edic × 5 jazyků (PDF i EPUB)',
        'Ilustrovaná vlajková edice',
        'Tabulky „Kotva pravdy" u kapitol',
        'ZION Archive Pass v ceně',
        'Bonus 31 104 ZION na peněženku',
      ],
      en: [
        '40 books — 8 editions × 5 languages (PDF & EPUB)',
        'Illustrated flagship edition',
        '“Truth Anchor” tables by chapter',
        'ZION Archive Pass included',
        '31,104 ZION bonus to your wallet',
      ],
    },
    features: [
      { cs: 'Okamžité stažení po objednávce', en: 'Instant download after ordering' },
      { cs: '5 jazyků, 8 edic, 3 252 stran', en: '5 languages, 8 editions, 3,252 pages' },
      { cs: 'PDF + EPUB', en: 'PDF + EPUB' },
    ],
    steps: {
      cs: [
        'Koupíš knihu v obchodě za 216 Kč.',
        'Na e-mail ti přijde potvrzení s **odkazem ke stažení** — ZIP balíček kompletní sady.',
        'Rozbalíš ho a vybereš edici i jazyk — **40 knih** (8 edic × 5 jazyků) ve formátech PDF i EPUB.',
        'Čteš v čtečce, tabletu nebo počítači — EPUB na čtečky, PDF všude.',
        'E-mailem ti dorazí i **ZION peněženka** (adresa + seed phrase) s bonusem **31 104 ZION**.',
        'Peněženku **naimportuješ do ZIS** a dalších ZION aplikací — a **ZION Archive Pass** ti otevře Archiv.',
      ],
      en: [
        'Buy the book in the shop for 216 CZK.',
        'An order confirmation e-mail arrives with the **download link** — a ZIP of the complete set.',
        'Unpack it and pick your edition and language — **40 books** (8 editions × 5 languages) in PDF and EPUB.',
        'Read on an e-reader, tablet or computer — EPUB for readers, PDF everywhere.',
        'Your **ZION wallet** (address + seed phrase) also arrives by e-mail carrying the **31,104 ZION** bonus.',
        '**Import the wallet into ZIS** and other ZION apps — and your **ZION Archive Pass** opens the Archive.',
      ],
    },
    faq: [
      {
        q: { cs: 'Co přesně dostanu za 216 Kč?', en: 'What exactly do I get for 216 CZK?' },
        a: {
          cs: 'Kompletní ediční sadu: 8 samostatných edic příběhu Království srdce, každou v 5 jazycích — 40 souborů (PDF i EPUB), 3 252 stran a 619 498 slov. Plus ZION Archive Pass a bonus 31 104 ZION.',
          en: 'The complete edition set: 8 distinct editions of the Kingdom of Hearts story, each in 5 languages — 40 files (PDF & EPUB), 3,252 pages and 619,498 words. Plus a ZION Archive Pass and a 31,104 ZION bonus.',
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
          cs: 'Po dokončení objednávky ti na e-mail dorazí ZION peněženka — adresa, seed phrase a privátní klíč, s připsaných 31 104 ZION. Seed ulož offline. Pak ji jedním importem přeneseš do ZIS a ZION aplikací.',
          en: 'After the order completes, your ZION wallet arrives by e-mail — address, seed phrase and private key, carrying 31,104 ZION. Store the seed offline. Then import it into ZIS and the ZION apps in one step.',
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
    home: {
      lead: {
        cs: 'Kompletní korpus jednoho příběhu: **8 edic**, každá v **5 jazycích** — 40 knih, **3 252 stran**, **619 498 slov**. Vlajková ilustrovaná edice vypráví o lodi, kterou tesař postavil pro moře, jež není na žádné mapě; ostatní edice táhnou tentýž příběh jinam — od klasického midraše po Knihu Kýlu vyprávěnou dřevem.',
        en: 'The complete corpus of one story: **8 editions**, each in **5 languages** — 40 books, **3,252 pages**, **619,498 words**. The illustrated flagship tells of the boat a carpenter built for a sea found on no map; the other editions pull the same story elsewhere — from a classical midrash to the Book of the Keel told by wood itself.',
      },
      bullets: [
        {
          cs: '8 edic × 5 jazyků = 40 knih ve formátu PDF i EPUB',
          en: '8 editions × 5 languages = 40 books in PDF and EPUB',
        },
        {
          cs: '3 252 stran a 619 498 slov — spočítáno ze sazby, ne odhad',
          en: '3,252 pages and 619,498 words — counted from the typeset files, not estimated',
        },
        {
          cs: 'Každá kapitola s tabulkou „Kotva pravdy“',
          en: 'Every chapter carries a “Truth Anchor” table',
        },
        {
          cs: 'Ukázky čtete přímo na stránce — Prolog, 7. kapitola, Epilog',
          en: 'Read the samples right here — Prologue, Chapter 7, Epilogue',
        },
        {
          cs: 'ZION Archive Pass a bonus 31 104 ZION',
          en: 'ZION Archive Pass and a 31,104 ZION bonus',
        },
      ],
    },
    facts: [
      {
        label: { cs: 'Edic', en: 'Editions' },
        value: { cs: '8', en: '8' },
        hint: { cs: 'od klasického midraše po Knihu Kýlu', en: 'from classical midrash to the Book of the Keel' },
      },
      {
        label: { cs: 'Jazyků', en: 'Languages' },
        value: { cs: '5', en: '5' },
        hint: { cs: 'čeština, angličtina, španělština, francouzština, portugalština', en: 'Czech, English, Spanish, French, Portuguese' },
      },
      {
        label: { cs: 'Stran', en: 'Pages' },
        value: { cs: '3 252', en: '3,252' },
        hint: { cs: '40 PDF souborů dohromady', en: '40 PDF files combined' },
      },
      {
        label: { cs: 'Slov', en: 'Words' },
        value: { cs: '619 498', en: '619,498' },
        hint: { cs: 'součet všech edic ve všech jazycích', en: 'sum of every edition in every language' },
      },
    ],
    editions: [
      {
        slug: 'nova-plavba',
        name: { cs: 'Nová plavba', en: 'New Voyage' },
        line: {
          cs: 'Ilustrovaná vlajková edice — 24 kapitol ve čtyřech částech a epilog.',
          en: 'The illustrated flagship — 24 chapters in four parts plus an epilogue.',
        },
        cover: '/shop/img/books/editions/nova-plavba.jpg',
        words: { cz: 13880, en: 17995 },
        flagship: true,
      },
      {
        slug: 'klasicka',
        name: { cs: 'Klasická edice', en: 'Classical Edition' },
        line: {
          cs: 'Původní midraš o deseti zastaveních — nejkratší a nejstarší linie příběhu.',
          en: 'The original midrash of ten stations — the shortest and oldest line of the story.',
        },
        cover: '/shop/img/books/editions/klasicka.jpg',
        words: { cz: 5220, en: 6745 },
      },
      {
        slug: 'cloude',
        name: { cs: 'Cedrový kýl', en: 'The Cedar Keel' },
        line: {
          cs: 'Literární rozšíření — táž loď, ale víc prostoru pro dílnu, dřevo a lidi kolem ní.',
          en: 'A literary expansion — the same boat, with more room for the workshop, the wood and the people around it.',
        },
        cover: '/shop/img/books/editions/cloude.jpg',
        words: { cz: 15338, en: 19804 },
      },
      {
        slug: 'gemini',
        name: { cs: 'Svorník korpusu', en: 'The Keystone' },
        line: {
          cs: 'Nejrozsáhlejší edice — čtyřiadvacet kapitol jako svorník celého korpusu.',
          en: 'The most extensive edition — twenty-four chapters acting as the keystone of the whole corpus.',
        },
        cover: '/shop/img/books/editions/gemini.jpg',
        words: { cz: 24863, en: 32932 },
      },
      {
        slug: 'gpt',
        name: { cs: 'Tesař, který zůstává u práce', en: 'The Carpenter Who Stays at the Work' },
        line: {
          cs: 'Kapitoly 10–24: příběh se soustředí na řemeslo a na to, co zůstává po ruce.',
          en: 'Chapters 10–24: the story turns to the craft itself and to what remains of the hand’s work.',
        },
        cover: '/shop/img/books/editions/gpt.jpg',
        words: { cz: 6435, en: 8450 },
      },
      {
        slug: 'groq',
        name: { cs: 'Loď, která se ptá', en: 'The Boat That Asks' },
        line: {
          cs: 'Otázky místo odpovědí — edice, která nechává čtenáře domýšlet.',
          en: 'Questions instead of answers — an edition that leaves the reader to finish the thought.',
        },
        cover: '/shop/img/books/editions/groq.jpg',
        words: { cz: 7441, en: 9977 },
      },
      {
        slug: 'quen',
        name: { cs: 'Účetnice', en: 'The Bookkeeper' },
        line: {
          cs: 'Loď, která nemá uzavřený účet — pohled na příběh očima toho, kdo počítá.',
          en: 'A boat with no closed account — the story seen by the one who keeps the books.',
        },
        cover: '/shop/img/books/editions/quen.jpg',
        words: { cz: 5903, en: 7500 },
      },
      {
        slug: 'deepseek',
        name: { cs: 'Kniha Kýlu', en: 'The Book of the Keel' },
        line: {
          cs: 'Vyprávěno dřevem — příběh z perspektivy materiálu, z něhož je loď udělaná.',
          en: 'Told by the wood itself — the story from the perspective of the material the boat is made of.',
        },
        cover: '/shop/img/books/editions/deepseek.jpg',
        words: { cz: 22986, en: 28075 },
      },
    ],
    samples: [
      {
        label: { cs: 'Ukázka · Prolog', en: 'Sample · Prologue' },
        title: { cs: 'Světlo před svítáním', en: 'Light Before Dawn' },
        image: '/vanoce/pribeh/05_svetla_u_brany.webp?v=engine-v1',
        paragraphs: [
          {
            cs: "U brány hořela dvě světla. Jedno v kamenném ohništi, kde Rádha pekla chléb. Druhé za střepem skla v malé cedrové lucerně. Plamen se nehýbal s větrem. Když však z mlhy zazněly kroky, sklonil se ke stezce. Elizabeth jej sledovala. Na rukávu měla záplatu, kterou už nikdo z přicházejících neuměl ušít. Její země ležela tak daleko v budoucnosti, že z měst tohoto pobřeží nezůstala ani jména. Zůstalo v ní cosi jiného: při večeři se pokaždé prostíralo jedno místo navíc. Kdysi se zeptala proč. Odpověděli jí, že to pochází od jisté lodi. A tak se vydala hledat její začátek.",
            en: "Two lights burned by the gate. One was in the stone hearth where Radha was baking bread. The other shone behind a piece of glass in a small cedar lantern. Its flame did not move with the wind. Yet when footsteps sounded in the mist, it leaned towards the path. Elizabeth watched it. On her sleeve was a patch that none of those approaching would have known how to sew. Her country lay so far in the future that not even the names of the cities along this coast remained. Something else had survived there: at supper, they always laid one extra place. Once she had asked why. They told her it came from a certain boat. So she had set out to find its beginning.",
          },
        ],
        source: { cs: 'Království srdce — ilustrovaná edice', en: 'Kingdom of Hearts — illustrated edition' },
      },
      {
        label: { cs: 'Ukázka · 7. kapitola', en: 'Sample · Chapter 7' },
        title: { cs: 'Království je uvnitř vás', en: 'The Kingdom Is Within You' },
        image: '/vanoce/pribeh/04_jmeno_lodi.webp?v=engine-v1',
        paragraphs: [
          {
            cs: "Když v Kafarnaum uvázali loď u břehu, přišli k nim farizeové — muži, kteří měřili příchod Mesiáše podle znamení na obloze a svitků s letopočty. Postavili se nad loď a zeptali se tesaře zpříma: „Kdy přijde království Boží?“",
            en: "When they moored at Capernaum, the Pharisees came—men who measured the Messiah's coming by signs in the sky and scrolls full of dates. They stood above the boat and asked the carpenter directly: “When will the kingdom of God come?”",
          },
          {
            cs: "Tesař se podíval na jejich svitky, pak na dvanáct veslařů, kteří ještě před chvílí soupeřili o přední místa, a nakonec na tichou hladinu jezera. „Království Boží nepřichází tak, aby se dalo vyhlížet z věží,“ odpověděl jim. „Nikdo neřekne: ‚Hle, je tady!‘ anebo ‚Hle, je tamhle!‘ Neboť hle — království Boží je uvnitř vás. A je mezi vámi pokaždé, když spolu sedíte v jedné lodi a nikdo nechce být nad druhým.“",
            en: "The carpenter looked at their scrolls, then at the twelve rowers who had just been competing for the foremost places, and finally at the quiet lake. “The kingdom of God does not come in a way you can watch for from towers,” he answered. “No one will say, ‘Look, here it is!’ or ‘Look, there it is!’ For behold—the kingdom of God is within you. And it is among you whenever you sit together in one boat and no one wishes to be above another.”",
          },
        ],
        source: { cs: 'Království srdce — ilustrovaná edice', en: 'Kingdom of Hearts — illustrated edition' },
      },
      {
        label: { cs: 'Ukázka · Epilog', en: 'Sample · Epilogue' },
        title: { cs: 'První prkno', en: 'The First Plank' },
        image: '/vanoce/pribeh/06_misto_navic.webp?v=engine-v1',
        paragraphs: [
          {
            cs: "Z mlhy před branou vystoupil člověk, kterého žádný z nich neznal. Měl kabát převázaný provazem, na rameni nesl spící dítě a druhou rukou svíral boty. Zastavil se tak daleko od ohně, aby nemusel být vyzván k odchodu. Poutník se zvedl. Nohy měl ztuhlé a v dlaních jej zabolely staré rány.",
            en: "Out of the mist before the gate came someone none of them knew. His coat was tied with rope; he carried a sleeping child on his shoulder and clutched a pair of shoes in his other hand. He stopped far enough from the fire that no one would have to ask him to leave. The Pilgrim rose. His legs were stiff, and old wounds ached in his palms.",
          },
          {
            cs: "Elizabeth vstala, aby přinesla přikrývku. Lumi zvedla lucernu a šla napřed. U prahu se světlo obou lamp setkalo. Na okamžik bylo vidět ruce dítěte a ženy přes sebe, jako když se v mělké vodě překrývají dva břehy.",
            en: "Elizabeth rose to fetch a blanket. Lumi lifted the lantern and went ahead. At the threshold the light of the two lamps met. For a moment the child’s hands and the woman’s could be seen overlapping, like two shores reflected together in shallow water.",
          },
        ],
        source: { cs: 'Království srdce — ilustrovaná edice', en: 'Kingdom of Hearts — illustrated edition' },
      },
    ],
  },
  {
    slug: 'lampion',
    externalId: 'lamp-001',
    image: '/vanoce-lampion.webp?v=engine-v1',
    hero: '/vanoce/home/03_lampion_tesar_deti_v4.webp?v=engine-v1',
    heroWide: '/vanoce/hero/lampion-wide.webp?v=engine-v1',
    model3d: '/models/lumi-2.glb',
    guide: {
      title: { cs: 'Složení lampionu — šest kroků', en: 'Assembling the lantern — six steps' },
      intro: {
        cs: 'Lampion přijde jako ploché díly z 3mm překližky: šest stěn, zdobený vršek a dno. Skládá se bez nářadí, stačí dřevěné lepidlo a půl hodiny času. Návod je psaný tak, aby ho zvládl i ten, kdo nikdy nic neskládal.',
        en: 'The lantern arrives as flat 3 mm plywood parts: six walls, the carved crown and the base. No tools needed — wood glue and half an hour is enough. The instructions are written so that someone who has never assembled anything can follow them.',
      },
      steps: [
        {
          title: { cs: 'Vybalte a nic nelepte', en: 'Unpack and glue nothing yet' },
          body: {
            cs: 'Vyndejte všech osm dílů a položte je na stůl. Nic nelepte, dokud sestava nedrží nasucho. Díly jsou z překližky, takže se snadno poškodí rohem stolu — pracujte na měkkém podkladu.',
            en: 'Take out all eight parts and lay them on the table. Do not glue anything until the dry fit holds. The parts are plywood and a table corner damages them easily — work on a soft surface.',
          },
        },
        {
          title: { cs: 'Sestavte nasucho', en: 'Dry-fit first' },
          body: {
            cs: 'Šest stěn zasuňte do drážek dna — **gravírovanou stranou ven** a malým emblémem nahoru. Pak nasaďte zdobený vršek na jazýčky. Když stěna nejde, je otočená: drážky mají jednu správnou orientaci.',
            en: 'Slide the six walls into the base slots — **engraved side out**, small emblem up. Then set the carved crown onto the tabs. If a wall will not go in, it is reversed: the slots have one correct orientation.',
          },
        },
        {
          title: { cs: 'Zkontrolujte vzory', en: 'Check the patterns' },
          body: {
            cs: 'Projděte pohledem všech šest stěn. Každá nese jinou mandalu z knihy (lotos, strom života, srdcová mandala, loď Království srdce, Hiranjagarbha, květ života) a mají být ve správném pořadí jako v příběhu. Když některá nesedí, vyměňte ji ještě před lepením.',
            en: 'Look over all six walls. Each carries a different mandala from the book (lotus, tree of life, heart mandala, the ship of the Kingdom of Hearts, Hiranyagarbha, flower of life) and they should follow the order of the story. If one is wrong, swap it before gluing.',
          },
        },
        {
          title: { cs: 'Lepte jen spoje', en: 'Glue only the joints' },
          body: {
            cs: 'Trochou dřevěného lepidla do drážek dna a na jazýčky vršku. Stačí tenká vrstva — přebytek vytlačený ven setřete hadříkem. Přidržte 30 sekund, nechte 30 minut zaschnout. Lepidlo nedávejte na výřezy, jen do spojů.',
            en: 'A little wood glue into the base slots and onto the crown tabs. A thin layer is enough — wipe off the excess with a cloth. Hold for 30 seconds, let it set for 30 minutes. Never put glue on the cut-outs, only in the joints.',
          },
        },
        {
          title: { cs: 'Svíčku do sklenice', en: 'Candle into a glass' },
          body: {
            cs: 'Vezměte čajovou svíčku a postavte ji **do sklenice — ideálně od malé Nutelly nebo od zavařeniny**. Sklo zachytí vosk i případný plamen a lampion tak stojí na skle, ne na dřevě. Sklenici postavte doprostřed dna.',
            en: 'Take a tea light and place it **in a glass — a small Nutella jar or a jam jar is perfect**. The glass catches the wax and any flame, so the lantern stands on glass, not wood. Put the glass in the middle of the base.',
          },
        },
        {
          title: { cs: 'Rozsviťte (a zase zhasněte)', en: 'Light it (and put it out)' },
          body: {
            cs: 'Zapalte svíčku, zavřete vršek a nechte světlo projít výřezy. Než odejdete z místnosti nebo jdete spát, **zhasněte**. Kde jsou děti nebo zvířata, použijte raději LED čajovou svíčku — svítí skoro stejně a nic nehoří.',
            en: 'Light the candle, close the crown and let the light pass through the cut-outs. Before you leave the room or go to sleep, **blow it out**. Where there are children or pets, use an LED tea light instead — it glows almost the same and nothing burns.',
          },
        },
      ],
    },
    gallery: [
      {
        src: '/vanoce/galerie/lampion/01_balicek_v4.webp?v=engine-v1',
        alt: { cs: 'Lampion Království srdce jako vánoční balíček', en: 'The Kingdom of Hearts lantern as a Christmas parcel' },
      },
      {
        src: '/vanoce/galerie/lampion/02_konstrukce_v4.webp?v=engine-v1',
        alt: { cs: 'Šestihranné tělo lampionu a mandalové výřezy', en: 'Hexagonal lantern body and mandala cut-outs' },
      },
      {
        src: '/vanoce/galerie/lampion/03_vecerni_svetlo_v4.webp?v=engine-v1',
        alt: { cs: 'Lampion ve večerním světle', en: 'The lantern in evening light' },
      },
    ],
    imageAlt: {
      cs: 'Lampion Království srdce — gravírovaný výrobek z dílny tesaře',
      en: 'Kingdom of Hearts lantern — engraved craft from the carpenter\u2019s workshop',
    },
    priceCzk: 490,
    bonus: 70560,
    buyable: true,
    kicker: { cs: 'Vánoční edice 2026 · číslovaná', en: 'Christmas edition 2026 · numbered' },
    title: { cs: 'Druhá lucerna', en: 'The second lantern' },
    subtitle: {
      cs: 'Jeden konec prkna držel tesař. Druhý zůstal volný.',
      en: 'The carpenter held one end of the board. The other stayed free.',
    },
    intro: {
      cs: 'Lampion Lumi 2 přijde rozložený — osm dílů z 3mm březové překližky, půl hodiny a dřevěné lepidlo. Svíčku si zapálíš sám. To je celé tajemství.',
      en: 'The Lumi 2 lantern arrives flat — eight parts in 3 mm birch plywood, half an hour and wood glue. You light the candle yourself. That is the whole secret.',
    },
    details: [
      {
        cs: '**Dílna řeže, ty lepíš.** Jeden kus je 20,9 m řezných drah, 614 obrysů a čtyři hodiny laseru na 3mm březové překližce. Edice je číslovaná a jde v malých dávkách.',
        en: '**The workshop cuts, you glue.** One piece is 20.9 m of cutting paths, 614 outlines and four hours of laser time in 3 mm birch plywood. The edition is numbered and made in small batches.',
      },
      {
        cs: '**Přijde rozložený.** Osm dílů, půl hodiny, dřevěné lepidlo. Sestavený by byl obraz; rozložený se musí vzít do ruky. Svíčku dáš do sklenice a zapálíš sám.',
        en: '**It arrives flat.** Eight parts, half an hour, wood glue. Assembled, it would be an image; flat, it has to be taken in hand. You put the candle in a glass and light it yourself.',
      },
      {
        cs: '**Šest stěn, šest kapitol.** Vzory nejsou dekorace — jsou to mandaly z knihy, v pořadí příběhu.',
        en: '**Six walls, six chapters.** The patterns are not decoration — they are the mandalas from the book, in the order of the story.',
      },
      {
        cs: '**Co přijde hned:** digitální kniha v plné sadě (40 knih, 5 jazyků) a ZION Pass. Na ty se nečeká — přijdou e-mailem. Dřevo má vlastní termín: ze dílny odchází jako ploché díly, Zásilkovnou, zabalené jako dárek.',
        en: '**What arrives immediately:** the full digital book set (40 books, 5 languages) and the ZION Pass. No waiting on those — they come by e-mail. The wood has its own timing: it leaves the workshop as flat parts, via Zásilkovna, wrapped as a gift.',
      },
    ],
    story: {
      kicker: { cs: 'Příběh, který k němu patří', en: 'The story that belongs to it' },
      title: { cs: 'Druhá lucerna', en: 'The second lantern' },
      lead: {
        cs: 'V epilogu knihy Království srdce zůstane po scéně u brány krátké prkno a dítě, které ho drží. Tohle je to, co z něj vzniklo.',
        en: 'In the epilogue of Kingdom of Hearts, a short board and a child holding it are what remains of the scene at the gate. This is what came of it.',
      },
      paragraphs: [
        {
          cs: 'Tesař sedí za domem a opravuje rukojeť dláta. Vedle něj leží krátké prkno — ne odřezek, který padá z ponku, ale prkno vybrané: rovné, bez suku, s léty tak blízko sebe, že vypadají jako řádky. Přijde k němu dítě s lucernou, přisedne si do hoblin a chvíli nic neříká. Pak tesař položí prkno mezi sebe a ně. Jeden konec drží on. Druhý zůstane volný.',
          en: 'The carpenter sits behind the house mending a tool handle. Beside him lies a short board — not a scrap falling off the bench, but a chosen one: straight, knot-free, its grain so close together it looks like ruled lines. A child with a lantern comes, sits down in the shavings and says nothing for a while. Then the carpenter lays the board between himself and her. He holds one end. The other stays free.',
        },
        {
          cs: 'Dítě ho vezme. A teprve potom začne řezat.',
          en: 'The child takes it. And only then does he begin to cut.',
        },
        {
          cs: 'Lampion, který držíš v ruce, je z toho prkna. Tesař ho neořezal podle své ruky: míra, kterou drží ruka, umře s tou rukou, kdežto míra, kterou drží světlo, se dá zopakovat kdekoli, kde je někdo, kdo umí držet prkno a nespěchat. Proto je tělo šestihranné — šest stěn udrží nejvíc světla s nejmenším dřevem a šest jich ještě unesou dětské ruce. A proto přišel rozložený. Sestavený by byl obraz; rozložený se musí vzít do ruky.',
          en: 'The lantern in your hand comes from that board. He did not cut it to the measure of his hand: a measure held by a hand dies with the hand, while a measure held by light can be repeated wherever someone knows how to hold a board and not hurry. That is why the body is six-sided — six walls hold the most light with the least wood, and six are still light enough for a child’s hands. And that is why it arrives flat. Assembled, it would be an image; flat, it has to be taken in hand.',
        },
        {
          cs: 'A proto v něm není žádný zázrak. Světlo se nepředává hořící — to by muselo být kouzlo, a kouzlo se dá ukrást nebo obdivovat. Předává se jako míra: tvar, který se dá zopakovat, a věta, která se dá říct znovu. Svíčku si zapálíš sám. To je celé tajemství.',
          en: 'And that is why there is no miracle inside. Light is not passed on burning — that would have to be magic, and magic can be stolen or merely admired. It is passed on as a measure: a shape that can be repeated, and a sentence that can be said again. You light the candle yourself. That is the whole secret.',
        },
      ],
      message: [
        {
          speaker: { cs: 'Tesař z Nazareta', en: 'The carpenter of Nazareth' },
          text: {
            cs: '„Ještě krátký čas je světlo mezi vámi. Choďte, dokud máte světlo, aby vás nezachvátila tma; kdo chodí ve tmě, neví, kam jde.“',
            en: '“For a little while longer the light is among you. Walk while you have the light, so that darkness does not overtake you; one who walks in the dark does not know where he is going.”',
          },
          source: { cs: 'Jan 12,35, volně', en: 'John 12:35, freely rendered' },
        },
        {
          speaker: { cs: 'Lumi', en: 'Lumi' },
          text: {
            cs: '„Nehledej jiné světlo. To, které máš, stačí na jeden krok. Jdi — a pak ho předej.“',
            en: '“Do not look for another light. The one you have is enough for one step. Go — and then pass it on.”',
          },
        },
      ],
      closing: {
        cs: 'Vzkaz není pro tebe. Je to vzkaz, který máš předat.',
        en: 'The message is not for you. It is a message you are meant to pass on.',
      },
      facesTitle: { cs: 'Šest stěn, šest kapitol', en: 'Six walls, six chapters' },
      faces: [
        {
          tag: { cs: 'I · voda', en: 'I · water' },
          name: { cs: 'Lotos', en: 'Lotus' },
          line: {
            cs: 'Nejdřív byla voda a v ní loď, o kterou nikdo nežádal. Kdyby z celého příběhu zbylo jediné, je to tohle: začátek nemusí být velký, musí být ověřitelný. Každý si může přepočítat řetěz od prvního bloku po dnešní a přesvědčit se sám. Lotos roste z bahna a nic si o tom nemyslí.',
            en: 'First there was water, and in it a boat no one had ordered. If only one thing survived the whole story, it would be this: a beginning does not have to be large, it has to be checkable. Anyone can recount the chain from the first block to today and see for themselves. The lotus grows out of mud and thinks nothing of it.',
          },
        },
        {
          tag: { cs: 'II · země', en: 'II · earth' },
          name: { cs: 'Strom života', en: 'Tree of life' },
          line: {
            cs: 'Z každého bloku jde díl stranou: pět ze sta zemi, pět nebi. Ne proto, že to někdo slíbil — protože to protokol udělá sám, při každém bloku, bez hlasování. Strom neroste z velkorysosti. Roste z toho, že se každý rok odloží semeno dřív, než se sní všechno ostatní.',
            en: 'A share of every block is set aside: five in a hundred for the earth, five for the sky. Not because someone promised it — because the protocol does it by itself, with every block, without a vote. A tree does not grow out of generosity. It grows because a seed is set aside each year before everything else is eaten.',
          },
        },
        {
          tag: { cs: 'III · srdce', en: 'III · heart' },
          name: { cs: 'Srdcová mandala', en: 'Heart mandala' },
          line: {
            cs: 'Loď neměla nést náklad, měla nést lidi — a proto se jí říkalo království. A protože kormidlo sedí tam, kde se člověk rozhoduje sám, říkalo se jí srdce. Království nepřichází tak, aby se dalo vyhlížet z věží. Je uvnitř, a poznáš ho podle jediného: nikdo v něm nechce být nad druhým.',
            en: 'The boat was not built to carry cargo but people — and that is why it was called a kingdom. And because the rudder sits where a person decides alone, it was called a heart. A kingdom does not come in a way you can watch for from towers. It is within; and you will know it by one thing: no one in it wishes to be above another.',
          },
        },
        {
          tag: { cs: 'IV · plavba', en: 'IV · voyage' },
          name: { cs: 'Loď Království srdce', en: 'The ship of the Kingdom of Hearts' },
          line: {
            cs: 'Přišly jiné lodě — tmavě vínové, s plachtami, do kterých byla vpletená světelná vlákna. Posádky se potkaly na vodě a poznaly se podle jediného znamení: na kýlu každé z nich stálo totéž jméno, vyryté jinou rukou. Každý věk má svou loď. Všechny plují do stejného přístavu.',
            en: 'Other boats came — dark wine-red, their sails woven through with threads of light. The crews met on the water and recognised one another by a single sign: the same name was carved on every keel, cut by a different hand. Every age has its boat. All of them sail to the same harbour.',
          },
        },
        {
          tag: { cs: 'V · nebe', en: 'V · sky' },
          name: { cs: 'Hiranyagarbha', en: 'Hiranyagarbha' },
          line: {
            cs: 'Zlaté lůno není motor. Je to otázka: co si zaslouží letět? V tom příběhu je hlas, který umí říct „nevím" a nikdy nedrží klíč — pomocník, ne autorita. A jsou tam kameny s lístky, na kterých je napsáno, co by je vyvrátilo. Kdo si nezapíše pohřeb své hypotézy, prodává naději, ne vědu.',
            en: 'The golden womb is not an engine. It is a question: what deserves to fly? In that story there is a voice that can say “I don’t know” and never holds a key — a helper, not an authority. And there are stones with slips of paper beside them, each stating what would disprove it. Whoever does not write the funeral of their hypothesis is selling hope, not science.',
          },
        },
        {
          tag: { cs: 'VI · předání', en: 'VI · passing on' },
          name: { cs: 'Květ života', en: 'Flower of life' },
          line: {
            cs: 'Šestá stěna je prázdná jako ta první. Světlo se nedědí — nese se. Kdo ho dostane, zapálí si vlastní svíčku, a přesto je to totéž světlo, protože je na stejném místě: tam, kde někdo potřebuje vidět. Až ji budeš zhasínat, neříkej, že končí. Předej ji.',
            en: 'The sixth wall is as empty as the first. Light is not inherited — it is carried. Whoever receives it lights their own candle, and still it is the same light, because it is in the same place: where someone needs to see. When you put it out, do not say it is ending. Pass it on.',
          },
        },
      ],
    },
    inBox: {
      cs: [
        'Lampion Lumi 2 — ploché díly z 3mm překližky, složíš ho ty',
        'Digitální kniha Království srdce (40 knih, 5 jazyků)',
        'ZION Pass — Nirvana + Archiv',
        'Bonus 70 560 ZION na peněženku',
      ],
      en: [
        'Lumi 2 lantern — flat 3 mm plywood parts, you assemble it',
        'Digital Kingdom of Hearts book (40 books, 5 languages)',
        'ZION Pass — Nirvana + Archive',
        '70,560 ZION bonus to your wallet',
      ],
    },
    features: [
      { cs: 'Složíš ho sám', en: 'You assemble it' },
      { cs: 'Číslovaná vánoční edice', en: 'Numbered Christmas edition' },
      { cs: 'Kniha a ZION Pass v ceně', en: 'Book and ZION Pass included' },
    ],
    steps: {
      cs: [
        '**Teď:** edice je v prodeji — kusy jsou vyřezané, očíslované a připravené k odeslání jako ploché díly.',
        'Digitální část přijde **e-mailem hned po objednávce**: kniha (40 knih, 5 jazyků) + ZION Pass kód.',
        'Zároveň ti dorazí **ZION peněženka** (adresa + seed phrase) s bonusem **70 560 ZION**.',
        'Dřevo odchází ze dílny **rozložené**. Čtyři hodiny laseru už jsou v překližce — složíš ho ty: osm dílů, půl hodiny, dřevěné lepidlo.',
        'Pošleme ho **Zásilkovnou**, zabalený jako dárek. Až bude stát, najdeš vzkaz pod dnem.',
        'Peněženku **naimportuješ do ZIS** a dalších ZION aplikací — bonus použiješ v ekosystému.',
      ],
      en: [
        '**Now:** the edition is on sale — the pieces are cut, numbered and ready to ship as flat parts.',
        'The digital part arrives **by e-mail right after ordering**: the book (40 books, 5 languages) + ZION Pass code.',
        'Your **ZION wallet** (address + seed phrase) also arrives carrying the **70,560 ZION** bonus.',
        'The wood leaves the workshop **flat**. The four hours of laser time are already in the plywood — you assemble it: eight parts, half an hour, wood glue.',
        'We ship it by **Zásilkovna**, wrapped as a gift. Once it stands, the message is under the base.',
        '**Import the wallet into ZIS** and other ZION apps — and use the bonus across the ecosystem.',
      ],
    },
    faq: [
      {
        q: { cs: 'Jak je to s dostupností?', en: 'How does availability work?' },
        a: {
          cs: 'Vyrábíme v malých dávkách: jeden lampion znamená čtyři hodiny laseru. Dílna ho řeže a čísluje, složíš ho ty. Edice je číslovaná — když se dávka vyprodá, další jde do výroby po Vánocích.',
          en: 'We build in small batches: one lantern means four hours of laser time. The workshop cuts and numbers it; you assemble it. The edition is numbered — when a batch sells out, the next one is made after Christmas.',
        },
      },
      {
        q: { cs: 'Co přesně je v ceně 490 Kč?', en: 'What exactly does the 490 CZK include?' },
        a: {
          cs: 'Tři věci: lampion Lumi 2 (fyzický výrobek), digitální knihu Království srdce v plné sadě a ZION Pass do Nirvany i Archivu. Plus bonus 70 560 ZION na peněženku.',
          en: 'Three things: the Lumi 2 lantern (a physical craft), the full digital Kingdom of Hearts book set, and a ZION Pass for Nirvana and the Archive. Plus a 70,560 ZION bonus to your wallet.',
        },
      },
      {
        q: { cs: 'Jak dostanu peněženku s bonusem?', en: 'How do I get the bonus wallet?' },
        a: {
          cs: 'E-mailem po dokončení objednávky — adresa, seed phrase a privátní klíč, s připsaných 70 560 ZION. Seed ulož offline. Pak ji jedním importem přeneseš do ZIS a ZION aplikací.',
          en: 'By e-mail once the order completes — address, seed phrase and private key, carrying 70,560 ZION. Store the seed offline. Then import it into ZIS and the ZION apps in one step.',
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
          cs: 'Ploché díly posíláme Zásilkovnou na výdejní místo nebo adresu, zabalené jako dárek. Složíš ho doma — osm dílů, půl hodiny, dřevěné lepidlo. Pod dnem je vzkaz, ne návod.',
          en: 'The flat parts ship via Zásilkovna to a pickup point or address, wrapped as a gift. You assemble it at home — eight parts, half an hour, wood glue. Under the base is a message, not the instructions.',
        },
      },
    ],
    note: {
      cs: 'Fotografie jsou ilustrační — dílna každý kus řeže a čísluje, složíš ho ty. Drobná odchylka v kresbě dřeva není vada. Dárek pro někoho, kdo si ho složí.',
      en: 'Photos are illustrative — the workshop cuts and numbers each piece; you assemble it. A slight variation in the wood grain is not a defect. A gift for someone who will put it together.',
    },
    home: {
      lead: {
        cs: 'Lampion Lumi 2 přijde rozložený — osm dílů z 3mm březové překližky, půl hodiny a dřevěné lepidlo. Svíčku si zapálíš sám. To je celé tajemství.',
        en: 'The Lumi 2 lantern arrives flat — eight parts in 3 mm birch plywood, half an hour and wood glue. You light the candle yourself. That is the whole secret.',
      },
      bullets: [
        {
          cs: 'Osm dílů, půl hodiny, dřevěné lepidlo',
          en: 'Eight parts, half an hour, wood glue',
        },
        {
          cs: '20,9 m řezu, čtyři hodiny laseru, číslovaná edice',
          en: '20.9 m of cuts, four hours of laser time, a numbered edition',
        },
        {
          cs: 'Kniha a ZION Pass v ceně — přijdou e-mailem hned',
          en: 'The book and a ZION Pass included — they arrive by e-mail at once',
        },
        {
          cs: 'Dárek pro někoho, kdo si ho složí',
          en: 'A gift for someone who will assemble it',
        },
      ],
    },
    facts: [
      {
        label: { cs: 'Výroba', en: 'Craft' },
        value: { cs: '20,9 m řezu', en: '20.9 m of cuts' },
        hint: { cs: 'šest mandal, 614 obrysů, 4 h laseru', en: 'six mandalas, 614 paths, 4 h of laser time' },
      },
      {
        label: { cs: 'Série', en: 'Run' },
        value: { cs: 'limitovaná', en: 'limited' },
        hint: { cs: 'vánoční edice, číslovaná', en: 'numbered Christmas edition' },
      },
      {
        label: { cs: 'V ceně', en: 'Included' },
        value: { cs: 'kniha + Pass', en: 'book + Pass' },
        hint: { cs: 'digitální sada 40 knih a vstup do Nirvany', en: '40-book digital set and Nirvana access' },
      },
      {
        label: { cs: 'Bonus', en: 'Bonus' },
        value: { cs: '70 560 ZION', en: '70,560 ZION' },
        hint: { cs: 'sto čtyřicet čtyři ZION za každou korunu', en: 'a hundred and forty-four ZION for every crown' },
      },
    ],
  },
];

/**
 * Společná cesta nákupem — platí pro všechny tři dary.
 * Vykresluje se pod kartami na homepage, aby člověk nemusel na detail,
 * aby zjistil, co se po zaplacení vlastně stane.
 */
export const christmasJourney: { cs: string[]; en: string[] } = {
  cs: [
    '**Vybereš dar.** Pass otevírá světy, kniha nese příběh, lampion k tomu přidává světlo na stůl. Každý z nich má vlastní ZION bonus.',
    '**Zaplatíš** převodem, kartou nebo v ZIONu. Cena je konečná — doprava u digitálních darů není, u lampionu ji spočítá pokladna.',
    '**Do minuty po zaplacení** přijde e-mail: kód **ZAP-…**, odkaz na knihy a **ZION peněženka** s bonusem (adresa + seed phrase).',
    '**Uplatníš kód** na nirvana.zionterranova.com i v ZION Archivu. Peněženku naimportuješ do ZIS a bonus máš na adrese.',
    '**U lampionu** navíc: digitální část přijde hned. Dřevo odchází ze dílny rozložené — osm dílů, složíš ho ty. Zásilkovna.',
  ],
  en: [
    '**You pick a gift.** The Pass opens worlds, the book carries the story, the lantern adds light for your table. Each carries its own ZION bonus.',
    '**You pay** by transfer, card or in ZION. The price is final — no shipping on digital gifts, the lantern’s shipping is calculated at checkout.',
    '**Within a minute of payment** an e-mail arrives: a **ZAP-…** code, a link to the books, and a **ZION wallet** with the bonus (address + seed phrase).',
    '**You redeem the code** on nirvana.zionterranova.com and in the ZION Archive. Import the wallet into ZIS and the bonus is yours.',
    '**With the lantern**, the digital part arrives immediately. The wood leaves the workshop flat — eight parts, and you assemble it. Zásilkovna.',
  ],
};

/** Společné otázky, které se ptají všichni bez ohledu na to, který dar si vybrali. */
export const christmasFaq: { q: XmasText; a: XmasText }[] = [
  {
    q: { cs: 'Kdy mi přijde e-mail s kódem a peněženkou?', en: 'When does the e-mail with the code and wallet arrive?' },
    a: {
      cs: 'U karty a ZIONu prakticky okamžitě — obvykle do minuty po zaplacení. U bankovního převodu ve chvíli, kdy platba dorazí na účet (to je jediné místo, kde rozhoduje vaše banka, ne my).',
      en: 'Card and ZION payments are effectively instant — usually within a minute. With a bank transfer it is the moment the payment lands in the account (that is the only place where your bank decides, not us).',
    },
  },
  {
    q: { cs: 'Má ZION bonus peněžní hodnotu?', en: 'Does the ZION bonus have monetary value?' },
    a: {
      cs: 'Ne. ZION je experimentální ekosystém, bonus nemá garantovanou peněžní hodnotu a nezakládá nárok na výnos. Kupujete dar a podporu světa — token je vstupenka do něj, ne investiční produkt.',
      en: 'No. ZION is an experimental ecosystem; the bonus has no guaranteed monetary value and creates no claim on returns. You are buying a gift and support for the world — the token is a way in, not an investment product.',
    },
  },
  {
    q: { cs: 'Co přesně je kód ZAP-…?', en: 'What exactly is the ZAP-… code?' },
    a: {
      cs: 'Váš průkaz (Zion Archive Pass). Jeden kód platí na obou místech — v Nirvaně i v Archivu — a váže se na průkaz, ne na osobu, takže ho můžete darovat.',
      en: 'Your credential (Zion Archive Pass). One code works in both places — Nirvana and the Archive — and it binds to the credential, not a person, so it can be gifted.',
    },
  },
  {
    q: { cs: 'Co udělám se seed phrase od peněženky?', en: 'What do I do with the wallet seed phrase?' },
    a: {
      cs: 'Uložte ji offline — papír nebo trezor, nikdy ne do cloudu, screenshotu ani poznámek v telefonu. Kdo má seed, má peněženku. Import do ZIS je pak otázka jednoho kroku.',
      en: 'Store it offline — paper or a safe, never in the cloud, a screenshot, or phone notes. Whoever has the seed has the wallet. Importing into ZIS is then a single step.',
    },
  },
  {
    q: { cs: 'Můžu dar koupit jako dárek pro někoho jiného?', en: 'Can I buy a gift for someone else?' },
    a: {
      cs: 'Ano — u digitálních darů stačí přeposlat e-mail s kódem a peněženkou. U lampionu zadejte v objednávce doručovací adresu obdarovaného a přidejte poznámku; balíme to rovnou jako dárek.',
      en: 'Yes — for digital gifts just forward the e-mail with the code and wallet. For the lantern, put the recipient’s address in the order and add a note; we wrap it as a gift.',
    },
  },
  {
    q: { cs: 'Jak je to s vrácením a reklamací?', en: 'What about returns and complaints?' },
    a: {
      cs: 'Digitální obsah (kód, knihy, peněženka) je doručen okamžitě, takže na něj se podle obchodních podmínek vztahuje výluka z práva na odstoupení. Lampion je zboží na zakázku — reklamaci řeší reklamační řád, vady opravíme nebo vyměníme.',
      en: 'Digital content (code, books, wallet) is delivered instantly, so under the terms it is excluded from the right of withdrawal. The lantern is made to order — complaints follow the complaints policy; we repair or replace defects.',
    },
  },
];

export function getXmasProduct(slug: string): XmasProduct | undefined {
  return christmasProducts.find((p) => p.slug === slug);
}
