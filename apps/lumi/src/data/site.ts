import type { Localized } from '@/lib/i18n';

/**
 * Texty webu. Drží se tady, ne v komponentách — díky tomu jde stránku
 * přeložit nebo přepsat bez zásahu do logiky a stejný text používá
 * hlavička, patička i e-maily.
 */
export interface NavItem {
  href: string;
  label: Localized;
}

export const NAV: NavItem[] = [
  { href: '/kolekce', label: { cs: 'Kolekce', en: 'Collection', de: 'Kollektion' } },
  { href: '/svatby', label: { cs: 'Svatby a eventy', en: 'Weddings & events', de: 'Hochzeiten & Events' } },
  { href: '/firmy', label: { cs: 'Pro firmy', en: 'For companies', de: 'Für Unternehmen' } },
  { href: '/pribeh', label: { cs: 'Příběh', en: 'Story', de: 'Geschichte' } },
  { href: '/pruvodce', label: { cs: 'Jak se skládá', en: 'How to assemble', de: 'Aufbau' } },
  { href: '/faq', label: { cs: 'Otázky', en: 'FAQ', de: 'Fragen' } },
  { href: '/kontakt', label: { cs: 'Kontakt', en: 'Contact', de: 'Kontakt' } },
];

export const SITE = {
  brand: 'Lumi',
  tagline: {
    cs: 'Dřevěné lampiony z březové překližky',
    en: 'Wooden lanterns in birch plywood',
    de: 'Holzlaternen aus Birkensperrholz',
  } satisfies Localized,
  announcement: {
    cs: 'Vánoční edice 2026 · objednávky do 10. 12. stíháme doručit před Vánoci · doprava zdarma od 1 500 Kč',
    en: 'Christmas edition 2026 · order by 10 December for delivery before Christmas · free shipping from CZK 1,500',
    de: 'Weihnachtsedition 2026 · Bestellungen bis 10. Dezember kommen vor Weihnachten an · versandkostenfrei ab 1.500 CZK',
  } satisfies Localized,
  hero: {
    kicker: {
      cs: 'Ručně řezané a broušené',
      en: 'Hand-cut and sanded',
      de: 'Handgeschnitten und geschliffen',
    } satisfies Localized,
    title: {
      cs: 'Světlo, které se rozsvítí na vašem stole',
      en: 'A light that comes alive on your table',
      de: 'Ein Licht, das auf Ihrem Tisch erwacht',
    } satisfies Localized,
    lead: {
      cs: 'Lumi je malý dřevěný lampion z březové překližky. Šest stěn, vyřezávané mandaly a teplé světlo svíčky. Přijde rozložený — složíte ho za půl hodiny a stane se z něj místo, ke kterému se večer vracíte.',
      en: 'Lumi is a small wooden lantern made of birch plywood. Six walls, cut mandalas and the warm light of a candle. It arrives flat — you put it together in half an hour, and it becomes the place you return to in the evening.',
      de: 'Lumi ist eine kleine Holzlaterne aus Birkensperrholz. Sechs Wände, geschnittene Mandalas und das warme Licht einer Kerze. Sie kommt flach an — in einer halben Stunde aufgebaut, wird sie zum Ort, an den Sie abends zurückkehren.',
    } satisfies Localized,
    priceFrom: { cs: 'od 350 Kč', en: 'from CZK 350', de: 'ab 350 CZK' } satisfies Localized,
    ctaPrimary: { cs: 'Koupit lampion', en: 'Buy the lantern', de: 'Laterne kaufen' } satisfies Localized,
    ctaSecondary: { cs: 'Otočit ve 3D', en: 'Spin it in 3D', de: 'In 3D drehen' } satisfies Localized,
    ctaStory: { cs: 'Jak se vyrábí', en: 'How it is made', de: 'Wie sie entsteht' } satisfies Localized,
    bullets: [
      { cs: 'Ručně řezané a broušené', en: 'Hand-cut and sanded', de: 'Handgeschnitten und geschliffen' },
      { cs: 'Březová překližka 3 mm', en: '3 mm birch plywood', de: '3 mm Birkensperrholz' },
      { cs: 'Sestavíte za 30 minut', en: 'Assembled in 30 minutes', de: 'In 30 Minuten aufgebaut' },
      { cs: 'Číslovaná edice', en: 'Numbered edition', de: 'Nummerierte Edition' },
    ],
  },
  trust: [
    {
      title: { cs: 'Z naší dílny', en: 'From our workshop', de: 'Aus unserer Werkstatt' },
      text: {
        cs: 'Každý kus řežeme a brousíme u nás v malé sérii.',
        en: 'Every piece is cut and sanded by us in small batches.',
        de: 'Jedes Stück wird von uns in kleinen Serien geschnitten und geschliffen.',
      },
    },
    {
      title: { cs: 'Odesíláme do 5 dnů', en: 'Shipped within 5 days', de: 'Versand in 5 Tagen' },
      text: {
        cs: 'Vyrábíme na zakázku, ne ze skladu. Termín potvrdíme e-mailem.',
        en: 'Made to order, not from a warehouse. We confirm the date by e-mail.',
        de: 'Auf Bestellung gefertigt, nicht ab Lager. Den Termin bestätigen wir per E-Mail.',
      },
    },
    {
      title: { cs: 'Bezpečná svíčka', en: 'Safe candle use', de: 'Sichere Kerze' },
      text: {
        cs: 'Svíčka patří do sklenice. Návod a bezpečnostní body jsou u každé objednávky.',
        en: 'The candle belongs in a glass. Instructions and safety points come with every order.',
        de: 'Die Kerze gehört ins Glas. Anleitung und Sicherheitshinweise liegen jeder Bestellung bei.',
      },
    },
    {
      title: { cs: 'Dárek i pro firmu', en: 'A gift or a company order', de: 'Geschenk oder Firmenbestellung' },
      text: {
        cs: 'Personalizace jmen, data i loga. Množstevní ceny od 10 kusů.',
        en: 'Personalisation with names, dates or logos. Volume pricing from 10 pieces.',
        de: 'Personalisierung mit Namen, Datum oder Logo. Staffelpreise ab 10 Stück.',
      },
    },
  ],
  productsSection: {
    kicker: { cs: 'Kolekce', en: 'Collection', de: 'Kollektion' } satisfies Localized,
    title: {
      cs: 'Tři velikosti pro tři druhy večerů',
      en: 'Three sizes for three kinds of evening',
      de: 'Drei Größen für drei Arten von Abenden',
    } satisfies Localized,
    lead: {
      cs: 'Hlavní lampion pro stůl, menší Mini pro výslužku a stavebnice pro ty, kdo chtějí tvořit. Všechny z jedné desky, všechny se svíčkou ve sklenici.',
      en: 'The main lantern for the table, a smaller Mini for favours and a kit for those who want to make it themselves. All from one sheet, all with a candle in a glass.',
      de: 'Die Hauptlaterne für den Tisch, eine kleinere Mini für Gastgeschenke und ein Bausatz für alle, die selbst gestalten wollen. Alle aus einem Bogen, alle mit einer Kerze im Glas.',
    } satisfies Localized,
    cta: { cs: 'Zobrazit celou kolekci', en: 'See the full collection', de: 'Die ganze Kollektion' } satisfies Localized,
  },
  collections: {
    kicker: { cs: 'Šest motivů', en: 'Six motifs', de: 'Sechs Motive' } satisfies Localized,
    title: {
      cs: 'Jedno světlo. Šest kolekcí.',
      en: 'One light. Six collections.',
      de: 'Ein Licht. Sechs Kollektionen.',
    } satisfies Localized,
    lead: {
      cs: 'Stejná lucerna, jiných šest stěn. Vyberte motiv podle toho, k čemu se večer vracíte — přírodu, svatbu, květiny, oceán, vesmír nebo Vánoce.',
      en: 'The same lantern with a different set of six walls. Pick the motif for the evening you return to — nature, wedding, flowers, ocean, cosmos or Christmas.',
      de: 'Dieselbe Laterne, andere sechs Wände. Wählen Sie das Motiv für den Abend, zu dem Sie zurückkehren — Natur, Hochzeit, Blumen, Ozean, Weltraum oder Weihnachten.',
    } satisfies Localized,
    note: {
      cs: 'Kolekce jsou motivy, ne nové velikosti. Ilustrace jsou výtvarné — přesný tvar řezu ukáže 3D náhled u každého motivu.',
      en: 'Collections are motifs, not new sizes. The illustrations are artistic — the 3D preview on each motif shows the exact cut.',
      de: 'Kollektionen sind Motive, keine neuen Größen. Die Illustrationen sind künstlerisch — die 3D-Vorschau zeigt den genauen Schnitt.',
    } satisfies Localized,
    cta: { cs: 'Prohlédnout motiv ve 3D', en: 'See the motif in 3D', de: 'Motiv in 3D ansehen' } satisfies Localized,
  },
  occasions: {
    kicker: { cs: 'Pro jaké chvíle', en: 'For which moments', de: 'Für welche Momente' } satisfies Localized,
    title: {
      cs: 'Svíčka na stole řekne víc než dekorace',
      en: 'A candle on the table says more than decoration',
      de: 'Eine Kerze auf dem Tisch sagt mehr als Dekoration',
    } satisfies Localized,
    items: [
      {
        href: '/svatby',
        image: '/images/lumi-b/svatba-hero-4x3-640.webp',
        title: { cs: 'Svatební stoly', en: 'Wedding tables', de: 'Hochzeitstische' },
        text: {
          cs: 'Sada na stůl, výslužka pro hosty a jména novomanželů ve dřevě.',
          en: 'A set for the table, favours for guests and the couple’s names in wood.',
          de: 'Ein Set für den Tisch, Gastgeschenke und die Namen des Paares im Holz.',
        },
      },
      {
        href: '/firmy',
        image: '/images/lumi-b/firmy-4x3-640.webp',
        title: { cs: 'Firemní dárky', en: 'Corporate gifts', de: 'Firmengeschenke' },
        text: {
          cs: 'Lampion s logem pro klienty, partnery a vánoční večírky.',
          en: 'A lantern with your logo for clients, partners and Christmas parties.',
          de: 'Eine Laterne mit Logo für Kunden, Partner und Weihnachtsfeiern.',
        },
      },
      {
        href: '/kolekce/lumi-2',
        image: '/images/lumi-b/domu-hero-4x3-640.webp',
        title: { cs: 'Večery doma', en: 'Evenings at home', de: 'Abende zu Hause' },
        text: {
          cs: 'Jeden kus na stůl, kde se čte, mluví a zůstává o chvíli déle.',
          en: 'One piece for the table where you read, talk and stay a little longer.',
          de: 'Ein Stück für den Tisch, an dem man liest, spricht und länger bleibt.',
        },
      },
      {
        href: '/firmy',
        image: '/images/lumi-b/penzion-4x3-640.webp',
        title: { cs: 'Pro hosty a penziony', en: 'For guests and guesthouses', de: 'Für Gäste und Pensionen' },
        text: {
          cs: 'Motiv na míru pro penzion, zámek nebo vinařství. Suvenýr, který si host odveze.',
          en: 'A bespoke motif for a guesthouse, château or winery. A souvenir your guest takes home.',
          de: 'Ein Motiv nach Maß für Pension, Schloss oder Weingut. Ein Souvenir, das der Gast mitnimmt.',
        },
      },
    ],
  },
  craft: {
    kicker: { cs: 'Dílna', en: 'The workshop', de: 'Die Werkstatt' } satisfies Localized,
    title: { cs: 'Druhá lucerna', en: 'The second lantern', de: 'Die zweite Laterne' } satisfies Localized,
    paragraphs: [
      {
        cs: 'První lucerna byla zkouška. Druhá je odpověď na to, co se u ní lidé ptali: ať je menší, ať se dá složit, ať je z jedné desky. Lumi 2 je osm dílů, které drží jen díky přesnému řezu a trpělivosti.',
        en: 'The first lantern was a test. The second is the answer to what people asked about it: make it smaller, make it possible to assemble, make it from one sheet. Lumi 2 is eight parts that hold together only because of a precise cut and patience.',
        de: 'Die erste Laterne war ein Versuch. Die zweite ist die Antwort auf die Fragen der Menschen: kleiner, zum Zusammenbauen, aus einem Bogen. Lumi 2 sind acht Teile, die nur durch präzisen Schnitt und Geduld zusammenhalten.',
      },
      {
        cs: 'Řežeme na laseru, brousíme ručně a každý kus projde zkouškou lícování. Když něco nesedí, nejde to do krabice — jde to zpátky na stůl.',
        en: 'We cut on a laser, sand by hand and test the fit of every piece. If something does not fit, it does not go into the box — it goes back to the bench.',
        de: 'Wir schneiden mit dem Laser, schleifen von Hand und prüfen die Passung jedes Teils. Passt etwas nicht, kommt es nicht in die Box — sondern zurück auf die Werkbank.',
      },
    ],
    facts: [
      { value: '8', label: { cs: 'dílů', en: 'parts', de: 'Teile' } },
      { value: '20,9 m', label: { cs: 'řezu', en: 'of cutting', de: 'Schnitt' } },
      { value: '3 mm', label: { cs: 'bříza', en: 'birch', de: 'Birke' } },
      { value: '30 min', label: { cs: 'sestavení', en: 'to assemble', de: 'Aufbau' } },
    ],
    cta: { cs: 'Přečíst příběh', en: 'Read the story', de: 'Die Geschichte lesen' } satisfies Localized,
  },
  viewer: {
    kicker: { cs: 'Naše eso', en: 'Our ace', de: 'Unser Ass' } satisfies Localized,
    title: { cs: 'Otočte si lampion ve 3D', en: 'Turn the lantern in 3D', de: 'Drehen Sie die Laterne in 3D' },
    text: {
      cs: 'Skutečný model z výrobní dokumentace. Táhněte pro otočení, kolečkem přiblížíte. Uvidíte, kudy prochází světlo, kde sedí dno a jak vypadá řez zblízka.',
      en: 'The real model from the production drawings. Drag to rotate, scroll to zoom. See where the light comes through, how the base fits and what the cut looks like up close.',
      de: 'Das echte Modell aus den Fertigungszeichnungen. Ziehen zum Drehen, scrollen zum Zoomen. Sie sehen, wo das Licht durchfällt, wie der Boden sitzt und wie der Schnitt aus der Nähe aussieht.',
    } as Localized,
    note: {
      cs: 'Vizualizační model, ne výrobní podklad. Fyzické lícování a bezpečnost svíčky ověřuje dílna.',
      en: 'A visualisation model, not production data. Physical fit and candle safety are verified by the workshop.',
      de: 'Ein Visualisierungsmodell, keine Fertigungsdaten. Passung und Kerzensicherheit prüft die Werkstatt.',
    } satisfies Localized,
  },
  gallery: {
    kicker: { cs: 'Z dílny a ze stolů', en: 'From the workshop and the tables', de: 'Aus der Werkstatt und von den Tischen' },
    title: { cs: 'Jak to vypadá, když se rozsvítí', en: 'What it looks like when it lights up', de: 'So sieht es aus, wenn es leuchtet' },
    note: {
      cs: 'Fotografie jsou zatím ilustrační. Reálné snímky z dílny, z výroby a od zákazníků doplníme v dalším kole — místo na ně je připravené.',
      en: 'These photographs are placeholders for now. Real shots from the workshop, production and customers will follow in the next round — the space is ready.',
      de: 'Die Fotos sind vorerst Platzhalter. Echte Aufnahmen aus Werkstatt, Fertigung und von Kunden folgen im nächsten Schritt — der Platz ist vorbereitet.',
    } satisfies Localized,
    placeholder: {
      cs: 'Místo pro reálnou fotku',
      en: 'Space for a real photo',
      de: 'Platz für ein echtes Foto',
    } satisfies Localized,
    items: [
      { src: '/images/lumi-b/domu-hero-4x3-640.webp', fit: 'cover', caption: { cs: 'Večerní světlo', en: 'Evening light', de: 'Abendlicht' } },
      {
        src: '/images/lumi-b/3d-konstrukce-700.webp',
        fit: 'contain',
        caption: { cs: 'Konstrukce', en: 'Construction', de: 'Konstruktion' },
      },
      { src: '/images/lumi-b/darkove-baleni-700.webp', fit: 'cover', caption: { cs: 'Dárkové balení', en: 'Gift wrapping', de: 'Geschenkverpackung' } },
      { src: '/images/lumi-b/brana-4x3-640.webp', fit: 'cover', caption: { cs: 'Světlo u brány', en: 'Light at the gate', de: 'Licht am Tor' } },
    ],
  },
  quote: {
    text: {
      cs: 'Světlo nemá být na ozdobu. Má být důvod, proč se u stolu zůstane o chvíli déle.',
      en: 'Light is not there to decorate. It is the reason to stay at the table a little longer.',
      de: 'Licht ist nicht zum Dekorieren da. Es ist der Grund, am Tisch noch etwas länger zu bleiben.',
    } satisfies Localized,
    source: { cs: 'Poznámka z dílny', en: 'A note from the workshop', de: 'Eine Notiz aus der Werkstatt' } satisfies Localized,
  },
  b2b: {
    kicker: { cs: 'Pro firmy a místa', en: 'For companies and venues', de: 'Für Unternehmen und Orte' } satisfies Localized,
    title: {
      cs: 'Svatby, hotely, firmy. Jeden vzorek řekne víc než katalog.',
      en: 'Weddings, hotels, companies. One sample says more than a catalogue.',
      de: 'Hochzeiten, Hotels, Firmen. Ein Muster sagt mehr als ein Katalog.',
    } satisfies Localized,
    text: {
      cs: 'Pošleme vám vzorek na vyzkoušení do vaší výzdoby. Když se hodí, připravíme nabídku na celou akci — s množstevní cenou a personalizací.',
      en: 'We will send you a sample to try in your own setting. If it fits, we prepare a quote for the whole event — with volume pricing and personalisation.',
      de: 'Wir senden Ihnen ein Muster für Ihre eigene Dekoration. Passt es, erstellen wir ein Angebot für die ganze Veranstaltung — mit Staffelpreis und Personalisierung.',
    } satisfies Localized,
    ctaWeddings: { cs: 'Pro svatby a eventy', en: 'For weddings & events', de: 'Für Hochzeiten & Events' } satisfies Localized,
    ctaCompanies: { cs: 'Pro firmy', en: 'For companies', de: 'Für Unternehmen' } satisfies Localized,
  },
  newsletter: {
    title: { cs: 'Jeden e-mail za sezónu', en: 'One e-mail per season', de: 'Eine E-Mail pro Saison' },
    text: {
      cs: 'Nové motivy, termíny před Vánoci a pár fotek z dílny. Nic víc, žádné nabídky každý týden.',
      en: 'New motifs, Christmas deadlines and a few photos from the workshop. Nothing more, no weekly offers.',
      de: 'Neue Motive, Weihnachtstermine und ein paar Fotos aus der Werkstatt. Nichts weiter, keine Wochenangebote.',
    } satisfies Localized,
    placeholder: { cs: 'váš@email.cz', en: 'you@email.com', de: 'ihre@email.de' } satisfies Localized,
    button: { cs: 'Chci vědět', en: 'Keep me posted', de: 'Ich möchte es wissen' } satisfies Localized,
    success: {
      cs: 'Děkujeme. Ozveme se, až bude co ukázat.',
      en: 'Thank you. We will write when there is something to show.',
      de: 'Danke. Wir melden uns, wenn es etwas zu zeigen gibt.',
    } satisfies Localized,
    consent: {
      cs: 'Odběr můžete kdykoli zrušit. E-mail používáme jen na novinky Lumi.',
      en: 'You can unsubscribe at any time. We use your e-mail only for Lumi news.',
      de: 'Sie können sich jederzeit abmelden. Wir nutzen die E-Mail nur für Lumi-Neuigkeiten.',
    } satisfies Localized,
  },
  footer: {
    about: {
      cs: 'Lumi je značka Omnity.One s.r.o. Dřevěné lampiony z březové překližky v malých sériích.',
      en: 'Lumi is a brand of Omnity.One s.r.o. Wooden lanterns in birch plywood, made in small batches.',
      de: 'Lumi ist eine Marke der Omnity.One s.r.o. Holzlaternen aus Birkensperrholz in kleinen Serien.',
    } satisfies Localized,
    columns: [
      {
        title: { cs: 'Kolekce', en: 'Collection', de: 'Kollektion' },
        links: [
          { href: '/kolekce/lumi-2', label: { cs: 'Lumi 2', en: 'Lumi 2', de: 'Lumi 2' } },
          { href: '/kolekce/lumi-mini', label: { cs: 'Lumi Mini', en: 'Lumi Mini', de: 'Lumi Mini' } },
          { href: '/kolekce/lumi-kit', label: { cs: 'Lumi Kit', en: 'Lumi Kit', de: 'Lumi Kit' } },
          { href: '/kolekce/lumi-set-3', label: { cs: 'Sada tří', en: 'Set of three', de: 'Set aus drei' } },
        ],
      },
      {
        title: { cs: 'Pro firmy', en: 'For companies', de: 'Für Unternehmen' },
        links: [
          { href: '/svatby', label: { cs: 'Svatby a eventy', en: 'Weddings & events', de: 'Hochzeiten & Events' } },
          { href: '/firmy', label: { cs: 'Firemní dárky', en: 'Corporate gifts', de: 'Firmengeschenke' } },
          { href: '/kolekce/personalizace', label: { cs: 'Personalizace', en: 'Personalisation', de: 'Personalisierung' } },
          { href: '/kontakt', label: { cs: 'Poptávka', en: 'Enquiry', de: 'Anfrage' } },
        ],
      },
      {
        title: { cs: 'Informace', en: 'Information', de: 'Informationen' },
        links: [
          { href: '/pribeh', label: { cs: 'Příběh', en: 'Story', de: 'Geschichte' } },
          { href: '/pruvodce', label: { cs: 'Jak se skládá', en: 'How to assemble', de: 'Aufbau' } },
          { href: '/nakupni-rad', label: { cs: 'Jak nakupovat', en: 'How to order', de: 'So bestellen Sie' } },
          { href: '/doprava', label: { cs: 'Doprava a vrácení', en: 'Shipping & returns', de: 'Versand & Rückgabe' } },
          { href: '/faq', label: { cs: 'Časté otázky', en: 'FAQ', de: 'Häufige Fragen' } },
        ],
      },
      {
        title: { cs: 'Právní', en: 'Legal', de: 'Rechtliches' },
        links: [
          { href: '/obchodni-podminky', label: { cs: 'Obchodní podmínky', en: 'Terms', de: 'AGB' } },
          { href: '/ochrana-osobnich-udaju', label: { cs: 'Ochrana údajů', en: 'Privacy', de: 'Datenschutz' } },
          { href: '/cookies', label: { cs: 'Cookies', en: 'Cookies', de: 'Cookies' } },
          { href: '/odstoupeni-od-smlouvy', label: { cs: 'Odstoupení', en: 'Withdrawal', de: 'Widerruf' } },
          { href: '/bezpecnost-produktu', label: { cs: 'Bezpečnost produktu', en: 'Product safety', de: 'Produktsicherheit' } },
          { href: '/reklamace', label: { cs: 'Reklamace', en: 'Claims', de: 'Reklamation' } },
          { href: '/pristupnost', label: { cs: 'Přístupnost', en: 'Accessibility', de: 'Barrierefreiheit' } },
        ],
      },
    ],
    rights: {
      cs: 'Všechna práva vyhrazena.',
      en: 'All rights reserved.',
      de: 'Alle Rechte vorbehalten.',
    } satisfies Localized,
    madeIn: {
      cs: 'Ruční práce · malá série',
      en: 'Handmade · small batch',
      de: 'Handarbeit · kleine Serie',
    } satisfies Localized,
  },
} as const;
