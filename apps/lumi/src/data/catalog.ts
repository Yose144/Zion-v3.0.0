import type { Localized } from '@/lib/i18n';

/**
 * Katalog je **obsah**, ne ceny. Cenu, sklad a aktivitu drží databáze
 * (model `Product`), aby je šlo měnit z administrace bez deploye. Nový
 * produkt = přidat sem + spustit seed (`POST /api/seed`).
 *
 * Fotky: `public/images/**`. Model: `public/models/lumi-2.glb` (meshopt).
 */
export interface ProductSpec {
  label: Localized;
  value: Localized;
}

export interface ProductDef {
  externalId: string;
  slug: string;
  category: 'lampiony' | 'doplnky';
  name: Localized;
  short: Localized;
  description: Localized;
  priceCzk: number;
  oldPriceCzk?: number;
  /** Výchozí sklad při prvním seedu; dál se mění v administraci. */
  stock: number;
  maxQty?: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
  /** Menší varianta pro karty a košík (šetří data na mobilu). */
  imageSmall?: string;
  gallery: string[];
  /** Poctivá poznámka, když je obrázek ilustrační nebo ukázkový. */
  disclaimer?: Localized;
  badge?: Localized;
  specs: ProductSpec[];
  includes: Localized[];
  fireRisk: boolean;
  personalization?: boolean;
  leadTime: Localized;
  model3d?: string;
  sortOrder: number;
  active: boolean;
  seo: { title: Localized; description: Localized };
}

const LEAD_TIME: Localized = {
  cs: 'Vyrábíme na zakázku. Odesíláme do 5 pracovních dnů.',
  en: 'Made to order. We ship within 5 working days.',
  de: 'Auf Bestellung gefertigt. Versand innerhalb von 5 Werktagen.',
};

const FIRE_NOTE: Localized = {
  cs: 'Svíčku vždy do sklenice, na nehořlavý podklad a pod dohledem.',
  en: 'Always use the candle in a glass, on a non-flammable base and attended.',
  de: 'Kerze immer im Glas, auf nicht brennbarer Unterlage und beaufsichtigt verwenden.',
};

export const PRODUCTS: ProductDef[] = [
  {
    externalId: 'lumi-2',
    slug: 'lumi-2',
    category: 'lampiony',
    name: {
      cs: 'Lumi 2 — dřevěný lampion',
      en: 'Lumi 2 — wooden lantern',
      de: 'Lumi 2 — Holzlaterne',
    },
    short: {
      cs: 'Hlavní lampion. Osm dílů, vyřezávané mandaly a teplé světlo svíčky.',
      en: 'The main lantern. Eight parts, cut mandalas and the warm light of a candle.',
      de: 'Die Hauptlaterne. Acht Teile, geschnittene Mandalas und das warme Licht einer Kerze.',
    },
    description: {
      cs: 'Druhá lucerna z dílny Omnity.One. Přijde rozložená — osm dílů z 3mm březové překližky, vyřezávané mandaly na šesti stěnách, zdobený vršek a dno. Složíte ji za půl hodiny a večer se rozsvítí na stole. Číslovaná edice, řez 20,9 metru, čtyři hodiny laseru.',
      en: 'The second lantern from the Omnity.One workshop. It arrives flat: eight parts of 3 mm birch plywood, cut mandalas on six walls, a carved crown and a base. You assemble it in half an hour and it lights up on the table in the evening. Numbered edition, 20.9 metres of cutting, four hours of laser time.',
      de: 'Die zweite Laterne aus der Omnity.One-Werkstatt. Sie kommt flach: acht Teile aus 3 mm Birkensperrholz, geschnittene Mandalas auf sechs Wänden, eine verzierte Krone und ein Boden. In einer halben Stunde zusammengebaut, brennt sie abends auf dem Tisch. Nummerierte Edition, 20,9 Meter Schnitt, vier Stunden Laser.',
    },
    priceCzk: 790,
    stock: 12,
    image: '/images/lumi-b/lumi-2-produkt.webp',
    imageWidth: 900,
    imageHeight: 900,
    imageSmall: '/images/lumi-b/lumi-2-produkt-700.webp',
    gallery: [
      '/images/lumi-b/3d-konstrukce.webp',
      '/images/lumi-b/domu-hero.webp',
      '/images/lumi-b/brana.webp',
    ],
    badge: { cs: 'Hlavní řada', en: 'Signature', de: 'Hauptserie' },
    specs: [
      {
        label: { cs: 'Rozměry', en: 'Dimensions', de: 'Maße' },
        value: { cs: '140 × 126 × 121 mm', en: '140 × 126 × 121 mm', de: '140 × 126 × 121 mm' },
      },
      {
        label: { cs: 'Materiál', en: 'Material', de: 'Material' },
        value: {
          cs: '3mm březová překližka, dřevěné lepidlo D3',
          en: '3 mm birch plywood, D3 wood glue',
          de: '3 mm Birkensperrholz, D3-Holzleim',
        },
      },
      {
        label: { cs: 'Hmotnost', en: 'Weight', de: 'Gewicht' },
        value: { cs: 'cca 180 g', en: 'approx. 180 g', de: 'ca. 180 g' },
      },
      {
        label: { cs: 'Sestavení', en: 'Assembly', de: 'Aufbau' },
        value: { cs: '30 minut, bez nářadí', en: '30 minutes, no tools', de: '30 Minuten, ohne Werkzeug' },
      },
      {
        label: { cs: 'Světlo', en: 'Light', de: 'Licht' },
        value: {
          cs: 'Čajová svíčka ve sklenici (není součástí)',
          en: 'Tea light in a glass (not included)',
          de: 'Teelicht im Glas (nicht enthalten)',
        },
      },
    ],
    includes: [
      { cs: '8 vyřezaných dílů z březové překližky', en: '8 cut birch plywood parts', de: '8 geschnittene Birkensperrholzteile' },
      { cs: 'Tištěný návod na složení', en: 'Printed assembly guide', de: 'Gedruckte Aufbauanleitung' },
      { cs: 'Brutý papír na začistění hran', en: 'Sandpaper for the edges', de: 'Schleifpapier für die Kanten' },
      { cs: 'Zkušební proužek na zkoušku řezu', en: 'Test strip to try the fit', de: 'Teststreifen für die Passprobe' },
    ],
    fireRisk: true,
    leadTime: LEAD_TIME,
    model3d: '/models/lumi-2.glb',
    sortOrder: 10,
    active: true,
    seo: {
      title: {
        cs: 'Lumi 2 — dřevěný lampion z březové překližky',
        en: 'Lumi 2 — wooden birch plywood lantern',
        de: 'Lumi 2 — Holzlaterne aus Birkensperrholz',
      },
      description: {
        cs: 'Ručně řezaný dřevěný lampion Lumi 2. Osm dílů, vyřezávané mandaly, číslovaná edice. Sestavíte za 30 minut.',
        en: 'Hand-cut wooden lantern Lumi 2. Eight parts, cut mandalas, numbered edition. Assemble it in 30 minutes.',
        de: 'Handgeschnittene Holzlaterne Lumi 2. Acht Teile, geschnittene Mandalas, nummerierte Edition. In 30 Minuten aufgebaut.',
      },
    },
  },
  {
    externalId: 'lumi-mini',
    slug: 'lumi-mini',
    category: 'lampiony',
    name: { cs: 'Lumi Mini — dvě lucerny', en: 'Lumi Mini — two lanterns', de: 'Lumi Mini — zwei Laternen' },
    short: {
      cs: 'Menší sestra Lumi. Dvě lucerny z jedné desky A3 — na výslužku, stůl nebo dárek.',
      en: 'The smaller sister of Lumi. Two lanterns from one A3 sheet — for favours, tables or gifts.',
      de: 'Die kleine Schwester von Lumi. Zwei Laternen aus einem A3-Bogen — für Gastgeschenke, Tische oder als Mitbringsel.',
    },
    description: {
      cs: 'Mini je stejný princip v menším měřítku. Z jedné desky A3 vyjdou dvě lucerny, takže se hodí tam, kde potřebujete víc kusů: svatební výslužka, dekorace na stůl, dárek pro hosty nebo pro kolegy. Sestavení zvládne i ten, kdo nikdy nic neskládal.',
      en: 'Mini is the same idea at a smaller scale. One A3 sheet makes two lanterns, which makes it the right choice when you need more than one: wedding favours, table decoration, gifts for guests or colleagues. Anyone can assemble it, even without experience.',
      de: 'Mini ist dasselbe Prinzip im kleineren Maßstab. Aus einem A3-Bogen entstehen zwei Laternen — ideal, wenn Sie mehrere brauchen: Gastgeschenke zur Hochzeit, Tischdekoration, Geschenke für Gäste oder Kollegen. Auch ohne Erfahrung leicht aufzubauen.',
    },
    priceCzk: 350,
    stock: 20,
    image: '/images/lumi-b/mini.webp',
    imageWidth: 1400,
    imageHeight: 1050,
    imageSmall: '/images/lumi-b/mini-700.webp',
    gallery: ['/images/lumi-b/domu-hero.webp'],
    disclaimer: {
      cs: 'Ilustrační zobrazení Lumi Mini. Přesná fotografie nebo ověřený výrobní render má přednost při další aktualizaci.',
      en: 'Illustrative view of Lumi Mini. An exact photograph or verified production render takes precedence in the next update.',
      de: 'Illustrative Ansicht von Lumi Mini. Ein genaues Foto oder ein verifizierter Fertigungsrender hat bei der nächsten Aktualisierung Vorrang.',
    },
    badge: { cs: 'Pro více kusů', en: 'For multiples', de: 'Für mehrere' },
    specs: [
      {
        label: { cs: 'Rozměry', en: 'Dimensions', de: 'Maße' },
        value: { cs: '90 × 82 × 78 mm', en: '90 × 82 × 78 mm', de: '90 × 82 × 78 mm' },
      },
      {
        label: { cs: 'Obsah', en: 'Contents', de: 'Inhalt' },
        value: { cs: '2 lucerny z 1 desky A3', en: '2 lanterns from 1 A3 sheet', de: '2 Laternen aus 1 A3-Bogen' },
      },
      {
        label: { cs: 'Sestavení', en: 'Assembly', de: 'Aufbau' },
        value: { cs: '20 minut na kus', en: '20 minutes each', de: '20 Minuten pro Stück' },
      },
      {
        label: { cs: 'Světlo', en: 'Light', de: 'Licht' },
        value: {
          cs: 'Čajová svíčka ve sklenici (není součástí)',
          en: 'Tea light in a glass (not included)',
          de: 'Teelicht im Glas (nicht enthalten)',
        },
      },
    ],
    includes: [
      { cs: 'Díly na dvě lucerny', en: 'Parts for two lanterns', de: 'Teile für zwei Laternen' },
      { cs: 'Návod na složení', en: 'Assembly guide', de: 'Aufbauanleitung' },
      { cs: 'Brutý papír', en: 'Sandpaper', de: 'Schleifpapier' },
    ],
    fireRisk: true,
    leadTime: LEAD_TIME,
    sortOrder: 20,
    active: true,
    seo: {
      title: {
        cs: 'Lumi Mini — dvě dřevěné lucerny na stůl',
        en: 'Lumi Mini — two wooden lanterns for the table',
        de: 'Lumi Mini — zwei Holzlaternen für den Tisch',
      },
      description: {
        cs: 'Dvě malé dřevěné lucerny z jedné desky A3. Pro svatební výslužku, dekoraci a dárky.',
        en: 'Two small wooden lanterns from one A3 sheet. For wedding favours, decoration and gifts.',
        de: 'Zwei kleine Holzlaternen aus einem A3-Bogen. Für Gastgeschenke, Dekoration und Mitbringsel.',
      },
    },
  },
  {
    externalId: 'lumi-kit',
    slug: 'lumi-kit',
    category: 'lampiony',
    name: { cs: 'Lumi Kit — stavebnice', en: 'Lumi Kit — flat-pack', de: 'Lumi Kit — Bausatz' },
    short: {
      cs: 'Plochá stavebnice k slepení. Pro workshopy, školy a týmy, které chtějí tvořit spolu.',
      en: 'A flat kit to glue together. For workshops, schools and teams who want to make something together.',
      de: 'Ein flacher Bausatz zum Kleben. Für Workshops, Schulen und Teams, die gemeinsam etwas schaffen wollen.',
    },
    description: {
      cs: 'Stejný lampion, ale nedokončený. Vyřezané díly, návod a smirkový papír — lepení a broušení necháváme na vás. Skvělý dárek pro toho, kdo rád tvoří, a dobrý program na workshop nebo týmový večer. Lepidlo není součástí, doporučujeme D3.',
      en: 'The same lantern, unfinished. Cut parts, a guide and sandpaper — the gluing and sanding are up to you. A great gift for someone who likes making things, and a good programme for a workshop or team evening. Glue is not included; we recommend D3.',
      de: 'Dieselbe Laterne, aber unfertig. Geschnittene Teile, Anleitung und Schleifpapier — Kleben und Schleifen überlassen wir Ihnen. Ein gutes Geschenk für Menschen, die gern machen, und ein schönes Programm für Workshop oder Teamabend. Leim ist nicht enthalten; wir empfehlen D3.',
    },
    priceCzk: 490,
    stock: 25,
    image: '/images/lumi-b/3d-konstrukce.webp',
    imageWidth: 900,
    imageHeight: 900,
    imageSmall: '/images/lumi-b/3d-konstrukce-700.webp',
    gallery: ['/images/lumi-b/domu-hero.webp'],
    badge: { cs: 'Na tvoření', en: 'Make it yourself', de: 'Zum Selbermachen' },
    specs: [
      {
        label: { cs: 'Obsah', en: 'Contents', de: 'Inhalt' },
        value: {
          cs: 'Plochá deska A3 s vyřezanými díly',
          en: 'Flat A3 sheet with cut parts',
          de: 'Flacher A3-Bogen mit geschnittenen Teilen',
        },
      },
      {
        label: { cs: 'Potřebujete', en: 'You need', de: 'Sie brauchen' },
        value: {
          cs: 'Dřevěné lepidlo D3 a 30 minut',
          en: 'D3 wood glue and 30 minutes',
          de: 'D3-Holzleim und 30 Minuten',
        },
      },
      {
        label: { cs: 'Vhodné pro', en: 'Suitable for', de: 'Geeignet für' },
        value: { cs: 'Workshopy, školy, týmy', en: 'Workshops, schools, teams', de: 'Workshops, Schulen, Teams' },
      },
    ],
    includes: [
      { cs: 'Vyřezané díly lampionu Lumi', en: 'Cut parts for the Lumi lantern', de: 'Geschnittene Teile der Lumi-Laterne' },
      { cs: 'Tištěný návod', en: 'Printed guide', de: 'Gedruckte Anleitung' },
      { cs: 'Smirkový papír', en: 'Sandpaper', de: 'Schleifpapier' },
    ],
    fireRisk: true,
    leadTime: LEAD_TIME,
    sortOrder: 30,
    active: true,
    seo: {
      title: {
        cs: 'Lumi Kit — stavebnice dřevěného lampionu',
        en: 'Lumi Kit — wooden lantern flat-pack',
        de: 'Lumi Kit — Bausatz einer Holzlaterne',
      },
      description: {
        cs: 'Plochá stavebnice lampionu Lumi. Vyřezané díly, návod a smirkový papír. Pro workshopy a školy.',
        en: 'Flat-pack wooden lantern kit. Cut parts, guide and sandpaper. For workshops and schools.',
        de: 'Flacher Bausatz der Lumi-Laterne. Geschnittene Teile, Anleitung und Schleifpapier. Für Workshops und Schulen.',
      },
    },
  },
  {
    externalId: 'lumi-set-3',
    slug: 'lumi-set-3',
    category: 'lampiony',
    name: { cs: 'Sada tří lampionů', en: 'Set of three lanterns', de: 'Set aus drei Laternen' },
    short: {
      cs: 'Tři Lumi pro jeden stůl. Množstevní cena pro svatby a večery.',
      en: 'Three Lumi for one table. A set price for weddings and dinners.',
      de: 'Drei Lumi für einen Tisch. Ein Setpreis für Hochzeiten und Abendessen.',
    },
    description: {
      cs: 'Tři lampiony Lumi 2 v jedné sadě. Na svatební stůl, do okna, na recepci. Sada je o 11 % levnější než tři samostatné kusy a přichází v jedné krabici — vhodné i jako firemní dárek pro tři kolegy.',
      en: 'Three Lumi 2 lanterns in one set. For a wedding table, a window or a reception desk. The set is 11% cheaper than three separate pieces and arrives in one box — also a good corporate gift for three colleagues.',
      de: 'Drei Lumi 2 Laternen in einem Set. Für den Hochzeitstisch, das Fenster oder den Empfang. Das Set ist 11 % günstiger als drei einzelne Laternen und kommt in einer Box — auch ein gutes Firmengeschenk für drei Kollegen.',
    },
    priceCzk: 2100,
    stock: 6,
    image: '/images/lumi-b/set-3.webp',
    imageWidth: 1050,
    imageHeight: 1050,
    imageSmall: '/images/lumi-b/set-3-700.webp',
    gallery: ['/images/lumi-b/3d-konstrukce.webp', '/images/lumi-b/domu-hero.webp'],
    badge: { cs: 'Pro stůl', en: 'For the table', de: 'Für den Tisch' },
    specs: [
      {
        label: { cs: 'Obsah', en: 'Contents', de: 'Inhalt' },
        value: { cs: '3× lampion Lumi 2', en: '3× Lumi 2 lantern', de: '3× Lumi 2 Laterne' },
      },
      {
        label: { cs: 'Cena', en: 'Price', de: 'Preis' },
        value: {
          cs: 'o 11 % méně než tři samostatné kusy',
          en: '11% less than three separate lanterns',
          de: '11 % weniger als drei einzelne Laternen',
        },
      },
      {
        label: { cs: 'Sestavení', en: 'Assembly', de: 'Aufbau' },
        value: { cs: '3× 30 minut', en: '3× 30 minutes', de: '3× 30 Minuten' },
      },
    ],
    includes: [
      { cs: '3× sada dílů Lumi 2', en: '3× set of Lumi 2 parts', de: '3× Bausatz Lumi 2' },
      { cs: '3× tištěný návod', en: '3× printed guide', de: '3× gedruckte Anleitung' },
      { cs: 'Brutý papír', en: 'Sandpaper', de: 'Schleifpapier' },
    ],
    fireRisk: true,
    leadTime: LEAD_TIME,
    sortOrder: 40,
    active: true,
    seo: {
      title: {
        cs: 'Sada tří lampionů Lumi — pro svatební stůl',
        en: 'Set of three Lumi lanterns — for the wedding table',
        de: 'Set aus drei Lumi-Laternen — für den Hochzeitstisch',
      },
      description: {
        cs: 'Tři dřevěné lampiony Lumi 2 v jedné sadě. Množstevní cena pro svatby, eventy a firemní dárky.',
        en: 'Three Lumi 2 wooden lanterns in one set. A set price for weddings, events and corporate gifts.',
        de: 'Drei Holzlaternen Lumi 2 im Set. Ein Setpreis für Hochzeiten, Events und Firmengeschenke.',
      },
    },
  },
  {
    externalId: 'lumi-personalizace',
    slug: 'personalizace',
    category: 'doplnky',
    name: { cs: 'Personalizace — jména, datum, logo', en: 'Personalisation — names, date, logo', de: 'Personalisierung — Namen, Datum, Logo' },
    short: {
      cs: 'Vypálíme jména, datum nebo logo přímo do dřeva. Cena za jeden lampion.',
      en: 'We burn names, a date or a logo straight into the wood. Price per lantern.',
      de: 'Wir brennen Namen, Datum oder Logo direkt ins Holz. Preis pro Laterne.',
    },
    description: {
      cs: 'Ke každému lampionu můžeme vypálit jména novomanželů, datum, krátký nápis nebo firemní logo. Nápis je součástí jedné ze stěn, takže zůstane vidět i po rozsvícení. Logo potřebujeme v křivkách (SVG, AI nebo PDF). Personalizace se objednává spolu s lampionem.',
      en: 'For each lantern we can burn the couple’s names, a date, a short line or a company logo. The text becomes part of one wall, so it stays visible when the lantern is lit. For a logo we need vector artwork (SVG, AI or PDF). Personalisation is ordered together with a lantern.',
      de: 'Auf jede Laterne können wir Namen, ein Datum, einen kurzen Text oder ein Firmenlogo brennen. Der Text ist Teil einer Wand und bleibt auch im beleuchteten Zustand sichtbar. Für ein Logo brauchen wir Vektordaten (SVG, AI oder PDF). Die Personalisierung wird zusammen mit der Laterne bestellt.',
    },
    priceCzk: 200,
    stock: 999,
    maxQty: 50,
    image: '/images/lumi-b/personalizace.webp',
    imageWidth: 1400,
    imageHeight: 1050,
    imageSmall: '/images/lumi-b/personalizace-700.webp',
    gallery: ['/images/lumi-b/lumi-2-produkt.webp'],
    disclaimer: {
      cs: 'Ukázka motivu na dřevěném vzorku. Konkrétní jména, datum nebo logo vždy potvrzujeme náhledem před výrobou.',
      en: 'A sample motif on a wooden swatch. We always confirm names, dates or logos with a proof before production.',
      de: 'Ein Beispielmotiv auf einem Holzmuster. Namen, Daten oder Logos bestätigen wir immer vor der Fertigung mit einem Entwurf.',
    },
    badge: { cs: 'Na míru', en: 'Made for you', de: 'Nach Maß' },
    specs: [
      {
        label: { cs: 'Co jde vypálit', en: 'What we can burn', de: 'Was wir brennen können' },
        value: {
          cs: 'Jména, datum, krátký nápis, logo',
          en: 'Names, date, a short line, a logo',
          de: 'Namen, Datum, kurzer Text, Logo',
        },
      },
      {
        label: { cs: 'Podklad pro logo', en: 'Logo artwork', de: 'Logo-Daten' },
        value: { cs: 'SVG, AI nebo PDF v křivkách', en: 'SVG, AI or PDF in vectors', de: 'SVG, AI oder PDF als Vektoren' },
      },
      {
        label: { cs: 'Doba', en: 'Lead time', de: 'Lieferzeit' },
        value: {
          cs: 'Přidává 2–3 pracovní dny k výrobě',
          en: 'Adds 2–3 working days to production',
          de: 'Verlängert die Produktion um 2–3 Werktage',
        },
      },
    ],
    includes: [
      { cs: 'Návrh náhledu před výrobou', en: 'A proof before production', de: 'Ein Entwurf vor der Produktion' },
      { cs: 'Vypálení do dřeva', en: 'Burning into the wood', de: 'Brennen ins Holz' },
    ],
    fireRisk: false,
    personalization: true,
    leadTime: {
      cs: 'Přidává 2–3 pracovní dny k výrobě lampionu.',
      en: 'Adds 2–3 working days to the lantern production.',
      de: 'Verlängert die Produktion der Laterne um 2–3 Werktage.',
    },
    sortOrder: 50,
    active: true,
    seo: {
      title: {
        cs: 'Personalizace lampionu — jména, datum nebo logo',
        en: 'Lantern personalisation — names, date or logo',
        de: 'Personalisierung der Laterne — Namen, Datum oder Logo',
      },
      description: {
        cs: 'Vypálíme jména, datum nebo logo do dřevěného lampionu Lumi. Ideální pro svatby a firemní dárky.',
        en: 'We burn names, a date or a logo into the Lumi wooden lantern. Ideal for weddings and corporate gifts.',
        de: 'Wir brennen Namen, Datum oder Logo in die Lumi-Holzlaterne. Ideal für Hochzeiten und Firmengeschenke.',
      },
    },
  },
  {
    externalId: 'lumi-darkovani',
    slug: 'darkove-baleni',
    category: 'doplnky',
    name: { cs: 'Dárkové balení', en: 'Gift wrapping', de: 'Geschenkverpackung' },
    short: {
      cs: 'Kraftová krabice, hedvábný papír a ručně psaná kartička.',
      en: 'A kraft box, tissue paper and a handwritten card.',
      de: 'Eine Kraftbox, Seidenpapier und eine handgeschriebene Karte.',
    },
    description: {
      cs: 'Lampion zabalíme do kraftové krabice s hedvábným papírem a přiložíme ručně psanou kartičku s vaším vzkazem. Vhodné, když posíláte lampion jako dárek přímo obdarovanému — adresu nám napište do poznámky v objednávce.',
      en: 'We pack the lantern in a kraft box with tissue paper and add a handwritten card with your message. Ideal when the lantern is a gift sent directly to the recipient — put their address in the order note.',
      de: 'Wir verpacken die Laterne in einer Kraftbox mit Seidenpapier und legen eine handgeschriebene Karte mit Ihrer Nachricht bei. Ideal, wenn die Laterne direkt an den Beschenkten geht — die Adresse bitte in die Bestellnotiz schreiben.',
    },
    priceCzk: 90,
    stock: 999,
    image: '/images/lumi-b/darkove-baleni.webp',
    imageWidth: 1400,
    imageHeight: 1050,
    imageSmall: '/images/lumi-b/darkove-baleni-700.webp',
    gallery: ['/images/lumi-b/lumi-2-produkt.webp'],
    disclaimer: {
      cs: 'Dárkové balení je doplněk k lampionu, ne samostatná sada s lampionem.',
      en: 'Gift wrapping is an add-on for a lantern, not a set that includes one.',
      de: 'Die Geschenkverpackung ist ein Zusatz zur Laterne, kein Set mit Laterne.',
    },
    specs: [
      {
        label: { cs: 'Obsah', en: 'Contents', de: 'Inhalt' },
        value: { cs: 'Krabice, výplň, kartička', en: 'Box, filling, card', de: 'Box, Füllmaterial, Karte' },
      },
      {
        label: { cs: 'Vzkaz', en: 'Message', de: 'Nachricht' },
        value: {
          cs: 'Napište ho do poznámky v objednávce',
          en: 'Write it in the order note',
          de: 'In die Bestellnotiz schreiben',
        },
      },
    ],
    includes: [
      { cs: 'Kraftová krabice', en: 'Kraft box', de: 'Kraftbox' },
      { cs: 'Ručně psaná kartička', en: 'Handwritten card', de: 'Handgeschriebene Karte' },
    ],
    fireRisk: false,
    leadTime: LEAD_TIME,
    sortOrder: 60,
    active: true,
    seo: {
      title: {
        cs: 'Dárkové balení lampionu Lumi',
        en: 'Lumi lantern gift wrapping',
        de: 'Geschenkverpackung für die Lumi-Laterne',
      },
      description: {
        cs: 'Kraftová krabice, hedvábný papír a ručně psaná kartička k lampionu Lumi.',
        en: 'A kraft box, tissue paper and a handwritten card for the Lumi lantern.',
        de: 'Eine Kraftbox, Seidenpapier und eine handgeschriebene Karte für die Lumi-Laterne.',
      },
    },
  },
];

export function productBySlug(slug: string): ProductDef | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function productById(externalId: string): ProductDef | undefined {
  return PRODUCTS.find((product) => product.externalId === externalId);
}

/** Množstevní slevy pro B2B (svatby, firmy). */
export const VOLUME_DISCOUNTS = [
  { from: 10, percent: 10 },
  { from: 30, percent: 15 },
];

export function volumeDiscount(quantity: number): number {
  return VOLUME_DISCOUNTS.reduce((best, tier) => (quantity >= tier.from ? tier.percent : best), 0);
}

/** Rychlé odkazy pro hlavní stránku. */
export const FEATURED_PRODUCTS = ['lumi-2', 'lumi-mini', 'lumi-kit'];
