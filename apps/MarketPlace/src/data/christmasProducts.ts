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
    image: '/vanoce-pass.webp',
    hero: '/vanoce/home/01_zion_pass.webp',
    heroWide: '/vanoce/hero/zion-pass-wide.webp',
    gallery: [
      {
        src: '/vanoce/galerie/zion-pass/02_nirvana_a_archiv.webp',
        alt: { cs: 'Nirvana a ZION Archiv za jednou branou', en: 'Nirvana and the ZION Archive behind one gate' },
      },
      {
        src: '/vanoce/galerie/zion-pass/03_digitalni_darek.webp',
        alt: { cs: 'ZION Pass jako digitální dárek do e-mailu', en: 'The ZION Pass as a digital gift in your inbox' },
      },
    ],
    imageAlt: {
      cs: 'ZION Pass — zlatá brána do Království srdce',
      en: 'ZION Pass — golden gate into the Kingdom of Hearts',
    },
    priceCzk: 108,
    bonus: 10800,
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
        cs: 'Vánoční edice navíc nese bonus: **10 800 ZION** na vaši ZION peněženku — sto ZION za každou korunu.',
        en: 'The Christmas edition carries a bonus: **10,800 ZION** sent to your ZION wallet — a hundred ZION for every crown.',
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
        'Bonus 10 800 ZION na peněženku',
      ],
      en: [
        'Unique ZAP-… code delivered by e-mail',
        'Nirvana access — games, worlds, chat',
        'ZION Archive access — Chronicles & editions',
        '10,800 ZION bonus to your wallet',
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
        'E-mailem ti dorazí i **ZION peněženka** (adresa + seed phrase) s bonusem **10 800 ZION**.',
        'Peněženku pak jednoduše **naimportuješ do ZIS** a dalších ZION aplikací.',
      ],
      en: [
        'Buy the ZION Pass in the shop for 108 CZK.',
        'A unique **ZAP-…** code — your credential — arrives by e-mail instantly.',
        'Redeem it on **nirvana.zionterranova.com** → the games, worlds and chat of the Kingdom of Hearts open.',
        'The same code unlocks the **ZION Archive** — canonical texts, Chronicles and editions.',
        'Your **ZION wallet** (address + seed phrase) also arrives by e-mail carrying the **10,800 ZION** bonus.',
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
        cs: 'Jeden kód otevírá dva světy: **Nirvanu** — 3D svět Království srdce s pěti herními planetami a dvěma sty avatary — a **ZION Archiv** s kanonickými texty a Kronikami. Vánoční edice k tomu přidává 10 800 ZION.',
        en: 'One code opens two worlds: **Nirvana** — the 3D Kingdom of Hearts world with five game planets and two hundred avatars — and the **ZION Archive** with canonical texts and Chronicles. The Christmas edition adds 10,800 ZION on top.',
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
          cs: 'Bonus 10 800 ZION a peněženka e-mailem',
          en: '10,800 ZION bonus and a wallet by e-mail',
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
        value: { cs: '10 800 ZION', en: '10,800 ZION' },
        hint: { cs: 'sto ZION za každou korunu', en: 'a hundred ZION for every crown' },
      },
    ],
  },
  {
    slug: 'kniha-kralovstvi-srdce',
    externalId: 'book-001',
    image: '/shop/img/books/kralovstvi-srdce-wide.webp',
    hero: '/vanoce/home/02_kralovstvi_srdce.webp',
    heroWide: '/vanoce/hero/kralovstvi-srdce-wide.webp',
    gallery: [
      {
        src: '/vanoce/galerie/kralovstvi-srdce/02_edicni_sada.webp',
        alt: { cs: 'Osmička edic Království srdce v jedné sadě', en: 'The eight editions of Kingdom of Hearts in one set' },
      },
      {
        src: '/vanoce/galerie/kralovstvi-srdce/03_cteni.webp',
        alt: { cs: 'Čtení Království srdce v PDF i EPUB', en: 'Reading Kingdom of Hearts in PDF and EPUB' },
      },
    ],
    imageAlt: {
      cs: 'Kniha Království srdce — obálka ilustrované edice',
      en: 'Kingdom of Hearts book — illustrated edition cover',
    },
    priceCzk: 216,
    bonus: 21600,
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
        cs: 'Ke knize dostanete **ZION Archive Pass** — vstup do ZION Archivu. A ve vánoční edici bonus **21 600 ZION** na vaši peněženku (Genesis vstup pro Guardians ekosystému ZION).',
        en: 'The book includes a **ZION Archive Pass** — entry into the ZION Archive. And in the Christmas edition, a **21,600 ZION** bonus to your wallet (Genesis entry for the ZION Guardians).',
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
        'Bonus 21 600 ZION na peněženku',
      ],
      en: [
        '40 books — 8 editions × 5 languages (PDF & EPUB)',
        'Illustrated flagship edition',
        '“Truth Anchor” tables by chapter',
        'ZION Archive Pass included',
        '21,600 ZION bonus to your wallet',
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
        'E-mailem ti dorazí i **ZION peněženka** (adresa + seed phrase) s bonusem **21 600 ZION**.',
        'Peněženku **naimportuješ do ZIS** a dalších ZION aplikací — a **ZION Archive Pass** ti otevře Archiv.',
      ],
      en: [
        'Buy the book in the shop for 216 CZK.',
        'An order confirmation e-mail arrives with the **download link** — a ZIP of the complete set.',
        'Unpack it and pick your edition and language — **40 books** (8 editions × 5 languages) in PDF and EPUB.',
        'Read on an e-reader, tablet or computer — EPUB for readers, PDF everywhere.',
        'Your **ZION wallet** (address + seed phrase) also arrives by e-mail carrying the **21,600 ZION** bonus.',
        '**Import the wallet into ZIS** and other ZION apps — and your **ZION Archive Pass** opens the Archive.',
      ],
    },
    faq: [
      {
        q: { cs: 'Co přesně dostanu za 216 Kč?', en: 'What exactly do I get for 216 CZK?' },
        a: {
          cs: 'Kompletní ediční sadu: 8 samostatných edic příběhu Království srdce, každou v 5 jazycích — 40 souborů (PDF i EPUB), 3 252 stran a 619 498 slov. Plus ZION Archive Pass a bonus 21 600 ZION.',
          en: 'The complete edition set: 8 distinct editions of the Kingdom of Hearts story, each in 5 languages — 40 files (PDF & EPUB), 3,252 pages and 619,498 words. Plus a ZION Archive Pass and a 21,600 ZION bonus.',
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
          cs: 'Po dokončení objednávky ti na e-mail dorazí ZION peněženka — adresa, seed phrase a privátní klíč, s připsaných 21 600 ZION. Seed ulož offline. Pak ji jedním importem přeneseš do ZIS a ZION aplikací.',
          en: 'After the order completes, your ZION wallet arrives by e-mail — address, seed phrase and private key, carrying 21,600 ZION. Store the seed offline. Then import it into ZIS and the ZION apps in one step.',
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
          cs: 'ZION Archive Pass a bonus 21 600 ZION',
          en: 'ZION Archive Pass and a 21,600 ZION bonus',
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
        image: '/vanoce/pribeh/05_svetla_u_brany.webp?v=6',
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
        image: '/vanoce/pribeh/04_jmeno_lodi.webp',
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
        image: '/vanoce/pribeh/06_misto_navic.webp?v=6',
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
    image: '/vanoce-lampion.webp?v=6',
    hero: '/vanoce/home/03_lampion_tesar_deti_v4.webp?v=6',
    heroWide: '/vanoce/hero/lampion-wide.webp?v=6',
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
        src: '/vanoce/galerie/lampion/01_balicek_v4.webp?v=6',
        alt: { cs: 'Lampion Království srdce jako vánoční balíček', en: 'The Kingdom of Hearts lantern as a Christmas parcel' },
      },
      {
        src: '/vanoce/galerie/lampion/02_konstrukce_v4.webp?v=6',
        alt: { cs: 'Šestihranné tělo lampionu a mandalové výřezy', en: 'Hexagonal lantern body and mandala cut-outs' },
      },
      {
        src: '/vanoce/galerie/lampion/03_vecerni_svetlo_v4.webp?v=6',
        alt: { cs: 'Lampion ve večerním světle', en: 'The lantern in evening light' },
      },
    ],
    imageAlt: {
      cs: 'Lampion Království srdce — gravírovaný výrobek z dílny tesaře',
      en: 'Kingdom of Hearts lantern — engraved craft from the carpenter\u2019s workshop',
    },
    priceCzk: 432,
    bonus: 43200,
    buyable: false,
    kicker: { cs: 'Vánoční edice 2026 · Ruční výroba', en: 'Christmas Edition 2026 · Handmade' },
    title: { cs: 'Lampion – Království srdce', en: 'Lantern – Kingdom of Hearts' },
    subtitle: {
      cs: 'Světlo srdce pro novou zemi — z tesařské dílny příběhu.',
      en: 'Light of the heart for a new land — from the carpenter\u2019s workshop of the story.',
    },
    intro: {
      cs: 'Lampion Lumi 2 — šestihranná lucerna vyřezávaná a gravírovaná laserem z 3mm březové překližky. Světlo, jaké nesla Lumi u brány a jaké viselo nad tesařovým hoblíkem v Nazaretě.',
      en: 'The Lumi 2 lantern — a hexagonal lamp laser-cut and engraved from 3 mm birch plywood. The light Lumi carried at the gate, the one that hung above the carpenter\u2019s plane in Nazareth.',
    },
    details: [
      {
        cs: 'Vánoční edice: ke každému lampionu **digitální kniha Království srdce** a **ZION Pass** v ceně — celý příběh i vstup do světa, ze kterého lampion vychází.',
        en: 'Christmas edition: every lantern includes the **digital Kingdom of Hearts book** and a **ZION Pass** — the whole story and entry into the world the lantern comes from.',
      },
      {
        cs: 'Bonus **43 200 ZION** na vaši peněženku — sto ZION za každou korunu.',
        en: 'A **43,200 ZION** bonus to your wallet — a hundred ZION for every crown.',
      },
      {
        cs: 'Každý kus sestavujeme ručně — prodej zahájíme, jakmile bude výrobek hotový. Číslo vánoční edice bude omezené.',
        en: 'Each piece is assembled by hand — sales open once the craft is ready. The Christmas edition run will be limited.',
      },
      {
        cs: '**Co dostanete hned:** digitální knihu v plné sadě (40 knih, 5 jazyků) a ZION Pass. Na ty se nečeká — přijdou e-mailem. Fyzický lampion jde ze dílny samostatně, proto má vlastní termín.',
        en: '**What arrives immediately:** the full digital book set (40 books, 5 languages) and the ZION Pass. No waiting on those — they come by e-mail. The crafted lantern ships separately from the workshop, which is why it has its own timing.',
      },
      {
        cs: '**Světlo je součást příběhu.** Lampion vychází ze scény, kde Lumi nese lampu k bráně a kde se obě světla na prahu setkají. Vzory na těle nejsou dekorace — jsou to mandaly z knihy.',
        en: '**The light belongs to the story.** The lantern comes from the scene where Lumi carries her lamp to the gate and two lights meet on the threshold. The patterns on its body are not decoration — they are the mandalas from the book.',
      },
    ],
    inBox: {
      cs: [
        'Lampion Lumi 2 z 3mm překližky — vzor Srdce Království',
        'Digitální kniha Království srdce (40 knih, 5 jazyků)',
        'ZION Pass — Nirvana + Archiv',
        'Bonus 43 200 ZION na peněženku',
      ],
      en: [
        'Lumi 2 lantern in 3 mm plywood — Heart of the Kingdom pattern',
        'Digital Kingdom of Hearts book (40 books, 5 languages)',
        'ZION Pass — Nirvana + Archive',
        '43,200 ZION bonus to your wallet',
      ],
    },
    features: [
      { cs: 'Laserové vyřezávání', en: 'Laser-cut' },
      { cs: 'Omezená vánoční série', en: 'Limited Christmas run' },
      { cs: 'Kniha a ZION Pass v ceně', en: 'Book and ZION Pass included' },
    ],
    steps: {
      cs: [
        '**Teď:** produkt se připravuje — prodej spustíme, jakmile bude výrobek hotový.',
        'Digitální část přijde **e-mailem hned po objednávce**: kniha (40 knih, 5 jazyků) + ZION Pass kód.',
        'Zároveň ti dorazí **ZION peněženka** (adresa + seed phrase) s bonusem **43 200 ZION**.',
        'Lampion mezitím vzniká v dílně — vyřezávání a gravírování vzoru Srdce Království.',
        'Hotový výrobek pošleme **Zásilkovnou** — dorazí zabalený jako dárek.',
        'Peněženku **naimportuješ do ZIS** a dalších ZION aplikací — bonus použiješ v ekosystému.',
      ],
      en: [
        '**Now:** the product is in preparation — sales open once the craft is ready.',
        'The digital part arrives **by e-mail right after ordering**: the book (40 books, 5 languages) + ZION Pass code.',
        'Your **ZION wallet** (address + seed phrase) also arrives carrying the **43,200 ZION** bonus.',
        'Meanwhile the lantern is made in the workshop — the Heart of the Kingdom pattern cut and engraved.',
        'The finished craft ships by **Zásilkovna** — arriving wrapped like a gift.',
        '**Import the wallet into ZIS** and other ZION apps — and use the bonus across the ecosystem.',
      ],
    },
    faq: [
      {
        q: { cs: 'Kdy bude lampion k prodeji?', en: 'When will the lantern be on sale?' },
        a: {
          cs: 'Jakmile bude výrobek hotový — jde o malou sérii, ne skladový kus. Sledujte stránku; vánoční série bude číselně omezená.',
          en: 'Once the craft is ready — this is a small run, not a stocked item. Watch this page; the Christmas run will be numerically limited.',
        },
      },
      {
        q: { cs: 'Co přesně je v ceně 432 Kč?', en: 'What exactly does the 432 CZK include?' },
        a: {
          cs: 'Tři věci: lampion Lumi 2 (fyzický výrobek), digitální knihu Království srdce v plné sadě a ZION Pass do Nirvany i Archivu. Plus bonus 43 200 ZION na peněženku.',
          en: 'Three things: the Lumi 2 lantern (a physical craft), the full digital Kingdom of Hearts book set, and a ZION Pass for Nirvana and the Archive. Plus a 43,200 ZION bonus to your wallet.',
        },
      },
      {
        q: { cs: 'Jak dostanu peněženku s bonusem?', en: 'How do I get the bonus wallet?' },
        a: {
          cs: 'E-mailem po dokončení objednávky — adresa, seed phrase a privátní klíč, s připsaných 43 200 ZION. Seed ulož offline. Pak ji jedním importem přeneseš do ZIS a ZION aplikací.',
          en: 'By e-mail once the order completes — address, seed phrase and private key, carrying 43,200 ZION. Store the seed offline. Then import it into ZIS and the ZION apps in one step.',
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
    home: {
      lead: {
        cs: 'Ručně gravírovaný lampion se vzorem Srdce Království — světlo, které v příběhu nesla Lumi u brány a které viselo nad tesařovým hoblíkem v Nazaretě. K lampionu patří celá digitální kniha (40 knih, 5 jazyků), ZION Pass a bonus 43 200 ZION.',
        en: 'A hand-engraved lantern bearing the Heart of the Kingdom pattern — the light Lumi carried at the gate, the one that hung above the carpenter’s plane in Nazareth. The lantern comes with the complete digital book (40 books, 5 languages), a ZION Pass and a 43,200 ZION bonus.',
      },
      bullets: [
        {
          cs: 'Ruční gravírování, limitovaná vánoční série',
          en: 'Hand-engraved, a limited Christmas run',
        },
        {
          cs: 'Digitální kniha v plné sadě a ZION Pass v ceně',
          en: 'The full digital book set and a ZION Pass included',
        },
        {
          cs: 'Bonus 43 200 ZION na peněženku',
          en: 'A 43,200 ZION bonus to your wallet',
        },
        {
          cs: 'Prodej zahájíme, jakmile bude výrobek hotový',
          en: 'Sales open once the craft is ready',
        },
      ],
    },
    facts: [
      {
        label: { cs: 'Výroba', en: 'Craft' },
        value: { cs: 'ruční', en: 'handmade' },
        hint: { cs: 'gravírování vzoru Srdce Království', en: 'engraved Heart of the Kingdom pattern' },
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
        value: { cs: '43 200 ZION', en: '43,200 ZION' },
        hint: { cs: 'sto ZION za každou korunu', en: 'a hundred ZION for every crown' },
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
    '**U lampionu** navíc: digitální část přijde hned, samotný výrobek odejde ze dílny, až bude hotový — Zásilkovnou.',
  ],
  en: [
    '**You pick a gift.** The Pass opens worlds, the book carries the story, the lantern adds light for your table. Each carries its own ZION bonus.',
    '**You pay** by transfer, card or in ZION. The price is final — no shipping on digital gifts, the lantern’s shipping is calculated at checkout.',
    '**Within a minute of payment** an e-mail arrives: a **ZAP-…** code, a link to the books, and a **ZION wallet** with the bonus (address + seed phrase).',
    '**You redeem the code** on nirvana.zionterranova.com and in the ZION Archive. Import the wallet into ZIS and the bonus is yours.',
    '**With the lantern**, the digital part arrives immediately; the crafted piece ships from the workshop once it is finished — via Zásilkovna.',
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
