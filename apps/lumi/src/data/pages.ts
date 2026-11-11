import type { Localized } from '@/lib/i18n';

export const WEDDINGS = {
  kicker: { cs: 'Svatby a eventy', en: 'Weddings & events', de: 'Hochzeiten & Events' } satisfies Localized,
  title: {
    cs: 'Svíčka na svatebním stole. A jména ve dřevě.',
    en: 'A candle on the wedding table. And names in wood.',
    de: 'Eine Kerze auf dem Hochzeitstisch. Und Namen im Holz.',
  } satisfies Localized,
  lead: {
    cs: 'Pro svatební místa, koordinátory a cateringy připravujeme sady na stoly, výslužku pro hosty a personalizované kusy se jmény novomanželů. Vzorek vám pošleme na vyzkoušení do vaší výzdoby.',
    en: 'For venues, planners and caterers we prepare table sets, guest favours and personalised pieces with the couple’s names. We will send a sample to try in your own setting.',
    de: 'Für Veranstaltungsorte, Planer und Caterer fertigen wir Tischsets, Gastgeschenke und personalisierte Stücke mit den Namen des Paares. Wir senden Ihnen ein Muster für Ihre eigene Dekoration.',
  } satisfies Localized,
  image: { cs: '/images/lumi-b/svatba-hero-4x3.webp', en: '/images/lumi-b/svatba-hero-4x3.webp', de: '/images/lumi-b/svatba-hero-4x3.webp' },
  offersTitle: { cs: 'Tři způsoby, jak to použít', en: 'Three ways to use it', de: 'Drei Einsatzmöglichkeiten' } satisfies Localized,
  offers: [
    {
      title: { cs: 'Sada na stůl', en: 'Table set', de: 'Tischset' },
      text: {
        cs: 'Tři lampiony doprostřed stolu. Když se rozsvítí, hosté je vidí z celé místnosti.',
        en: 'Three lanterns in the middle of the table. When they light up, guests see them across the room.',
        de: 'Drei Laternen in der Tischmitte. Wenn sie leuchten, sehen die Gäste sie im ganzen Raum.',
      },
      price: { cs: '2 100 Kč / stůl', en: 'CZK 2,100 / table', de: '2.100 CZK / Tisch' },
    },
    {
      title: { cs: 'Výslužka pro hosty', en: 'Guest favours', de: 'Gastgeschenke' },
      text: {
        cs: 'Mini pro každého hosta. Dvě lucerny z jedné desky, jméno nebo datum na přání.',
        en: 'A Mini for every guest. Two lanterns from one sheet, with a name or date if you wish.',
        de: 'Eine Mini für jeden Gast. Zwei Laternen aus einem Bogen, auf Wunsch mit Name oder Datum.',
      },
      price: { cs: 'od 350 Kč / kus', en: 'from CZK 350 / piece', de: 'ab 350 CZK / Stück' },
    },
    {
      title: { cs: 'Personalizace', en: 'Personalisation', de: 'Personalisierung' },
      text: {
        cs: 'Jména novomanželů, datum svatby nebo krátký nápis vypálený do jedné stěny.',
        en: 'The couple’s names, the wedding date or a short line burned into one wall.',
        de: 'Namen des Paares, Hochzeitsdatum oder ein kurzer Text, in eine Wand gebrannt.',
      },
      price: { cs: '+200 Kč / kus', en: '+CZK 200 / piece', de: '+200 CZK / Stück' },
    },
  ],
  volumeTitle: { cs: 'Množstevní ceny', en: 'Volume pricing', de: 'Staffelpreise' } satisfies Localized,
  volumeText: {
    cs: 'Ceny jsou orientační, bez dopravy. Od 10 kusů sleva 10 %, od 30 kusů 15 %. Vždy s zálohou 50 % a potvrzeným termínem.',
    en: 'Indicative prices, excluding shipping. From 10 pieces 10% off, from 30 pieces 15%. Always with a 50% deposit and a confirmed date.',
    de: 'Richtpreise, ohne Versand. Ab 10 Stück 10 %, ab 30 Stück 15 %. Immer mit 50 % Anzahlung und bestätigtem Termin.',
  } satisfies Localized,
  processTitle: { cs: 'Jak to probíhá', en: 'How it works', de: 'So läuft es ab' } satisfies Localized,
  process: [
    {
      title: { cs: 'Vzorek', en: 'A sample', de: 'Ein Muster' },
      text: {
        cs: 'Pošleme jeden kus na vyzkoušení. Ukážete ho na místě, my vidíme, jak sedí k vaší výzdobě.',
        en: 'We send one piece to try. You show it at the venue, we see how it fits your setting.',
        de: 'Wir senden ein Stück zum Ausprobieren. Sie zeigen es am Ort, wir sehen, wie es zu Ihrer Dekoration passt.',
      },
    },
    {
      title: { cs: 'Nabídka', en: 'A quote', de: 'Ein Angebot' },
      text: {
        cs: 'Podle počtu stolů a hostů připravíme nabídku s množstevní cenou a termínem.',
        en: 'Based on the number of tables and guests we prepare a quote with volume pricing and a date.',
        de: 'Nach Tischanzahl und Gästezahl erstellen wir ein Angebot mit Staffelpreis und Termin.',
      },
    },
    {
      title: { cs: 'Výroba', en: 'Production', de: 'Produktion' },
      text: {
        cs: 'Potvrdíte zálohu, my vyrobíme a před odesláním zkontrolujeme lícování každého kusu.',
        en: 'You confirm the deposit, we produce and check the fit of every piece before shipping.',
        de: 'Sie bestätigen die Anzahlung, wir fertigen und prüfen die Passung jedes Stücks vor dem Versand.',
      },
    },
    {
      title: { cs: 'Doručení', en: 'Delivery', de: 'Lieferung' },
      text: {
        cs: 'Doručíme na místo nebo k vám. Zbývá jen složit a rozsvítit.',
        en: 'We deliver to the venue or to you. All that is left is to assemble and light them.',
        de: 'Wir liefern an den Ort oder zu Ihnen. Es bleibt nur das Aufbauen und Anzünden.',
      },
    },
  ],
  faqTitle: { cs: 'Časté otázky k svatbám', en: 'Wedding questions', de: 'Fragen zu Hochzeiten' } satisfies Localized,
  faq: [
    {
      q: { cs: 'Kolik kusů stihnete do svatby?', en: 'How many pieces can you make before the wedding?', de: 'Wie viele Stücke schaffen Sie bis zur Hochzeit?' },
      a: {
        cs: 'Běžně 20–60 kusů podle termínu a složitosti motivu. U větších zakázek část řežeme externě, aby termín držel. Napište nám datum co nejdřív.',
        en: 'Usually 20–60 pieces depending on the date and the complexity of the motif. For larger orders we cut part of the run externally so the date holds. Tell us the date as early as you can.',
        de: 'Üblicherweise 20–60 Stück je nach Termin und Motiv. Bei größeren Bestellungen lassen wir einen Teil extern schneiden, damit der Termin hält. Nennen Sie uns das Datum so früh wie möglich.',
      },
    },
    {
      q: { cs: 'Můžeme mít na lampionu logo místa?', en: 'Can the lantern carry the venue’s logo?', de: 'Kann die Laterne das Logo des Ortes tragen?' },
      a: {
        cs: 'Ano. Potřebujeme logo v křivkách (SVG, AI nebo PDF). Návrh vám před výrobou pošleme k odsouhlasení.',
        en: 'Yes. We need the logo as vector artwork (SVG, AI or PDF). We send a proof before production.',
        de: 'Ja. Wir brauchen das Logo als Vektordatei (SVG, AI oder PDF). Vor der Produktion senden wir einen Entwurf zur Freigabe.',
      },
    },
    {
      q: { cs: 'Jak se lampion čistí a skladuje?', en: 'How is the lantern cleaned and stored?', de: 'Wie wird die Laterne gereinigt und gelagert?' },
      a: {
        cs: 'Foukáním a měkkým štětcem, nikdy mokrým hadrem. Skladujte rozložený nebo v suchu; dřevo nemá rád vlhko.',
        en: 'Dust it with a soft brush, never a wet cloth. Store it flat or in a dry place; wood does not like damp.',
        de: 'Mit einem weichen Pinsel abstauben, nie mit einem feuchten Tuch. Flach oder trocken lagern; Holz mag keine Feuchtigkeit.',
      },
    },
  ],
} as const;

export const COMPANIES = {
  kicker: { cs: 'Pro firmy', en: 'For companies', de: 'Für Unternehmen' } satisfies Localized,
  title: {
    cs: 'Dárek, který nezůstane v šuplíku',
    en: 'A gift that does not end up in a drawer',
    de: 'Ein Geschenk, das nicht in der Schublade landet',
  } satisfies Localized,
  lead: {
    cs: 'Lampion s firemním logem nebo jménem pro klienty, partnery a vánoční večírky. Vyrábíme v malých sériích, takže každý kus je skutečně váš — ne skladová dekorace.',
    en: 'A lantern with your logo or a client’s name for clients, partners and Christmas parties. We produce in small runs, so every piece is genuinely yours — not warehouse decoration.',
    de: 'Eine Laterne mit Ihrem Logo oder einem Kundennamen für Kunden, Partner und Weihnachtsfeiern. Wir fertigen in kleinen Serien — jedes Stück ist wirklich Ihres, keine Lagerdekoration.',
  } satisfies Localized,
  image: '/images/lumi-b/firmy-4x3.webp',
  useTitle: { cs: 'Komu to dává smysl', en: 'Who it makes sense for', de: 'Für wen es sinnvoll ist' } satisfies Localized,
  useCases: [
    {
      title: { cs: 'Klienti a partneři', en: 'Clients and partners', de: 'Kunden und Partner' },
      text: {
        cs: 'Vánoční dárek, který se rozsvítí na stole. S logem nebo bez, v dárkovém balení.',
        en: 'A Christmas gift that lights up on the table. With or without your logo, gift-wrapped.',
        de: 'Ein Weihnachtsgeschenk, das auf dem Tisch leuchtet. Mit oder ohne Logo, geschenkverpackt.',
      },
    },
    {
      title: { cs: 'Zaměstnanci', en: 'Employees', de: 'Mitarbeiter' },
      text: {
        cs: 'Pro menší týmy a osobnější dárek. Jméno na stěně udělá z firemního dárku osobní věc.',
        en: 'For smaller teams and a more personal gift. A name on the wall turns a company gift into a personal one.',
        de: 'Für kleinere Teams und ein persönlicheres Geschenk. Ein Name an der Wand macht aus einem Firmengeschenk etwas Persönliches.',
      },
    },
    {
      title: { cs: 'Hotely a penziony', en: 'Hotels and guesthouses', de: 'Hotels und Pensionen' },
      text: {
        cs: 'Motiv na míru pro recepci a pokoje. Host si ho může koupit jako suvenýr.',
        en: 'A bespoke motif for reception and rooms. Guests can buy it as a souvenir.',
        de: 'Ein Motiv nach Maß für Empfang und Zimmer. Gäste können es als Souvenir kaufen.',
      },
    },
    {
      title: { cs: 'Akce a večírky', en: 'Events and parties', de: 'Events und Feiern' },
      text: {
        cs: 'Dekorace na stoly, která přežije večer a jde domů s hosty.',
        en: 'Table decoration that survives the evening and goes home with the guests.',
        de: 'Tischdekoration, die den Abend übersteht und mit den Gästen nach Hause geht.',
      },
    },
  ],
  volumeTitle: { cs: 'Množstevní ceny', en: 'Volume pricing', de: 'Staffelpreise' } satisfies Localized,
  volumeRows: [
    { range: { cs: '1–9 kusů', en: '1–9 pieces', de: '1–9 Stück' }, discount: { cs: 'základní cena', en: 'standard price', de: 'Standardpreis' } },
    { range: { cs: '10–29 kusů', en: '10–29 pieces', de: '10–29 Stück' }, discount: { cs: '−10 %', en: '−10%', de: '−10 %' } },
    { range: { cs: '30 a více', en: '30 and more', de: '30 und mehr' }, discount: { cs: '−15 %', en: '−15%', de: '−15 %' } },
  ],
  terms: {
    cs: 'Ceny bez dopravy. Zakázka vždy se zálohou 50 % a potvrzeným termínem. Logo potřebujeme v křivkách; návrh vám pošleme k odsouhlasení.',
    en: 'Prices exclude shipping. Every order with a 50% deposit and a confirmed date. We need vector artwork for the logo and send a proof for approval.',
    de: 'Preise ohne Versand. Jede Bestellung mit 50 % Anzahlung und bestätigtem Termin. Für das Logo brauchen wir Vektordaten; wir senden einen Entwurf zur Freigabe.',
  } satisfies Localized,
} as const;

export const STORY = {
  kicker: { cs: 'Příběh', en: 'The story', de: 'Die Geschichte' } satisfies Localized,
  title: {
    cs: 'Nejdřív to byla zkouška. Pak se z ní stala lucerna.',
    en: 'First it was a test. Then it became a lantern.',
    de: 'Zuerst war es ein Versuch. Dann wurde daraus eine Laterne.',
  } satisfies Localized,
  lead: {
    cs: 'Lumi vznikla v naší malé dílně. Ne jako produkt na první pohled, ale jako odpověď na otázku: dá se z jedné desky postavit něco, co bude chtít člověk nechat na stole?',
    en: 'Lumi was born in our small workshop. Not as a product at first glance, but as an answer to a question: can one sheet become something you want to keep on your table?',
    de: 'Lumi entstand in unserer kleinen Werkstatt. Nicht als Produkt auf den ersten Blick, sondern als Antwort auf die Frage: Kann aus einem Bogen etwas werden, das man auf dem Tisch behalten möchte?',
  } satisfies Localized,
  image: '/images/lumi-b/dilna-4x3.webp',
  note: {
    cs: 'Scéna je ilustrace, ne fotografie dílny. Reálné snímky doplníme.',
    en: 'The scene is an illustration, not a photograph of the workshop. Real photos will follow.',
    de: 'Die Szene ist eine Illustration, kein Foto der Werkstatt. Echte Aufnahmen folgen.',
  } satisfies Localized,
  chapters: [
    {
      title: { cs: 'První lucerna', en: 'The first lantern', de: 'Die erste Laterne' },
      text: {
        cs: 'První pokus byl velký, těžký a špatně se skládal. Lidé si ho oblíbili, ale ptali se na dvě věci: ať je menší a ať se dá složit doma.',
        en: 'The first attempt was large, heavy and hard to assemble. People liked it, but asked for two things: make it smaller, and make it something they could put together at home.',
        de: 'Der erste Versuch war groß, schwer und ließ sich schlecht aufbauen. Die Menschen mochten ihn, fragten aber nach zwei Dingen: kleiner und zu Hause zusammenbaubar.',
      },
    },
    {
      title: { cs: 'Druhá lucerna', en: 'The second lantern', de: 'Die zweite Laterne' },
      text: {
        cs: 'Lumi 2 je odpověď. Osm dílů, které do sebe zapadají bez nářadí. Řez 20,9 metru, čtyři hodiny laseru a půl hodiny vašeho času.',
        en: 'Lumi 2 is the answer. Eight parts that fit together without tools. 20.9 metres of cutting, four hours of laser and half an hour of your time.',
        de: 'Lumi 2 ist die Antwort. Acht Teile, die ohne Werkzeug zusammenpassen. 20,9 Meter Schnitt, vier Stunden Laser und eine halbe Stunde Ihrer Zeit.',
      },
    },
    {
      title: { cs: 'Materiál', en: 'Material', de: 'Material' },
      text: {
        cs: 'Březová překližka 3 mm. Světlá, pevná a bez povrchové úpravy — když ji necháte přírodní, stárne pomalu a hezky. Lepidlo D3 drží i v suchém prostředí.',
        en: '3 mm birch plywood. Light, strong and unfinished — left natural, it ages slowly and well. D3 glue holds even in dry interiors.',
        de: '3 mm Birkensperrholz. Hell, fest und unbehandelt — naturbelassen altert es langsam und schön. D3-Leim hält auch in trockenen Räumen.',
      },
    },
    {
      title: { cs: 'Dílna', en: 'The workshop', de: 'Die Werkstatt' },
      text: {
        cs: 'Řežeme, brousíme a kontrolujeme v malé dílně. Není to továrna — a to je důvod, proč každý kus vypadá trochu jinak. Číslujeme je, abyste věděli, který je váš.',
        en: 'We cut, sand and check in a small workshop. It is not a factory — and that is why every piece looks slightly different. We number them so you know which one is yours.',
        de: 'Wir schneiden, schleifen und prüfen in einer kleinen Werkstatt. Es ist keine Fabrik — deshalb sieht jedes Stück etwas anders aus. Wir nummerieren sie, damit Sie wissen, welches Ihres ist.',
      },
    },
  ],
  valuesTitle: { cs: 'Na čem si dáváme záležet', en: 'What we care about', de: 'Worauf wir achten' } satisfies Localized,
  values: [
    {
      title: { cs: 'Materiál z blízka', en: 'Local material', de: 'Material aus der Nähe' },
      text: {
        cs: 'Březová překližka z českých a slovenských dodavatelů. Žádné exotické dřevo, žádná folie.',
        en: 'Birch plywood from Czech and Slovak suppliers. No exotic wood, no plastic film.',
        de: 'Birkensperrholz von tschechischen und slowakischen Lieferanten. Kein Exotenhölz, keine Folie.',
      },
    },
    {
      title: { cs: 'Malé série', en: 'Small runs', de: 'Kleine Serien' },
      text: {
        cs: 'Nevyrábíme na sklad. Každá zakázka je malá série, kterou projdeme rukama.',
        en: 'We do not produce for stock. Every order is a small run that passes through our hands.',
        de: 'Wir produzieren nicht auf Lager. Jede Bestellung ist eine kleine Serie, die durch unsere Hände geht.',
      },
    },
    {
      title: { cs: 'Bez zbytečností', en: 'Nothing unnecessary', de: 'Nichts Überflüssiges' },
      text: {
        cs: 'Krabice, návod, smirkový papír. Žádné plastové výplně ani vrstvy, které skončí v koši.',
        en: 'A box, a guide, sandpaper. No plastic filling or layers that end up in the bin.',
        de: 'Eine Box, eine Anleitung, Schleifpapier. Keine Plastikfüllung und keine Schichten, die im Müll landen.',
      },
    },
  ],
  closing: {
    cs: 'Když si lampion odnesete, odnášíte si kus dílny. Když ho rozsvítíte, dílna si to nepamatuje — ale vy ano.',
    en: 'When you take a lantern home, you take a piece of the workshop with you. When you light it, the workshop does not remember — but you do.',
    de: 'Wenn Sie eine Laterne mitnehmen, nehmen Sie ein Stück Werkstatt mit. Wenn Sie sie anzünden, erinnert sich die Werkstatt nicht — Sie schon.',
  } satisfies Localized,
} as const;

export const GUIDE = {
  kicker: { cs: 'Sestavení', en: 'Assembly', de: 'Aufbau' } satisfies Localized,
  title: { cs: 'Šest kroků a půl hodiny', en: 'Six steps and half an hour', de: 'Sechs Schritte und eine halbe Stunde' },
  lead: {
    cs: 'Lampion přijde rozložený. Není to skládačka na celý večer — je to půl hodiny u stolu. Nářadí nepotřebujete, jen rovnou plochu, dřevěné lepidlo D3 a trpělivost na první dvě stěny.',
    en: 'The lantern arrives flat. It is not an all-evening puzzle — it is half an hour at the table. No tools needed, just a flat surface, D3 wood glue and patience for the first two walls.',
    de: 'Die Laterne kommt flach an. Kein Puzzle für einen ganzen Abend — eine halbe Stunde am Tisch. Kein Werkzeug nötig, nur eine ebene Fläche, D3-Holzleim und Geduld für die ersten zwei Wände.',
  } satisfies Localized,
  steps: [
    {
      title: { cs: 'Připravte si plochu', en: 'Prepare your surface', de: 'Fläche vorbereiten' },
      text: {
        cs: 'Stůl přikryjte novinami nebo starým ubrusem. Lepidlo vytéká, ale jde setřít vlhkým hadrem, dokud je čerstvé.',
        en: 'Cover the table with newspaper or an old cloth. Glue squeezes out, but it wipes off with a damp cloth while fresh.',
        de: 'Tisch mit Zeitung oder einem alten Tuch abdecken. Leim quillt heraus, lässt sich aber frisch mit einem feuchten Tuch abwischen.',
      },
    },
    {
      title: { cs: 'Sestavte nasucho', en: 'Dry-fit first', de: 'Zuerst trocken zusammenstecken' },
      text: {
        cs: 'Vyzkoušejte všech osm dílů bez lepidla. Zjistíte, která stěna kam patří a kde je motor. Teprve pak lepte.',
        en: 'Try all eight parts without glue. You will learn which wall goes where and where the pattern is. Only then start gluing.',
        de: 'Alle acht Teile ohne Leim probieren. So sehen Sie, welche Wand wohin gehört und wo das Muster ist. Erst dann kleben.',
      },
    },
    {
      title: { cs: 'Zkontrolujte vzory', en: 'Check the patterns', de: 'Muster prüfen' },
      text: {
        cs: 'Mandaly na stěnách na sebe navazují. Když je stěna obráceně, řez je vidět zvenku a vzor se přeruší.',
        en: 'The mandalas on the walls connect. If a wall is reversed, the cut shows on the outside and the pattern breaks.',
        de: 'Die Mandalas der Wände verbinden sich. Ist eine Wand umgekehrt, sieht man den Schnitt außen und das Muster bricht.',
      },
    },
    {
      title: { cs: 'Lepení jen ve spojích', en: 'Glue only the joints', de: 'Nur die Verbindungen leimen' },
      text: {
        cs: 'Tenká vrstva lepidla do drážek. Méně je více — vytékající lepidlo na pohledové ploše se špatně brousí.',
        en: 'A thin layer of glue in the grooves. Less is more — glue on a visible face is hard to sand off.',
        de: 'Eine dünne Schicht Leim in die Nuten. Weniger ist mehr — Leim auf einer sichtbaren Fläche lässt sich schlecht abschleifen.',
      },
    },
    {
      title: { cs: 'Svíčka do sklenice', en: 'Candle into a glass', de: 'Kerze ins Glas' },
      text: {
        cs: 'Čajovou svíčku postavte do sklenice od malé Nutelly nebo od zavařeniny. Sklo zachytí vosk i případný plamen a lampion pak stojí na skle.',
        en: 'Put a tea light inside a small jam jar. The glass catches the wax and any flame, and the lantern stands on glass.',
        de: 'Ein Teelicht in ein kleines Marmeladenglas stellen. Das Glas fängt Wachs und eine eventuelle Flamme auf, die Laterne steht auf Glas.',
      },
    },
    {
      title: { cs: 'Rozsviťte a zhasněte', en: 'Light it and blow it out', de: 'Anzünden und löschen' },
      text: {
        cs: 'Zapalte jen na dobu, kdy jste u stolu. Než odejdete z místnosti nebo jdete spát, zhasněte. Nikdy nenechávejte bez dozoru.',
        en: 'Light it only while you are at the table. Blow it out before leaving the room or going to sleep. Never leave it unattended.',
        de: 'Nur anzünden, solange Sie am Tisch sind. Vor dem Verlassen des Raums oder dem Schlafengehen löschen. Nie unbeaufsichtigt lassen.',
      },
    },
  ],
  safetyTitle: { cs: 'Bezpečnost především', en: 'Safety first', de: 'Sicherheit zuerst' } satisfies Localized,
  download: { cs: 'Stáhnout návod (PDF)', en: 'Download the guide (PDF)', de: 'Anleitung herunterladen (PDF)' } satisfies Localized,
  downloadHref: '/downloads/navod-lumi-2.pdf',
  image: '/images/lumi-b/3d-konstrukce.webp',
  note: {
    cs: 'Ilustrace sestavení, ne fotografie. Reálné snímky doplníme.',
    en: 'An illustration of the assembly, not a photograph. Real photos will follow.',
    de: 'Eine Illustration des Aufbaus, kein Foto. Echte Aufnahmen folgen.',
  } satisfies Localized,
} as const;

export const CONTACT = {
  kicker: { cs: 'Kontakt', en: 'Contact', de: 'Kontakt' } satisfies Localized,
  title: { cs: 'Napište nám', en: 'Write to us', de: 'Schreiben Sie uns' },
  lead: {
    cs: 'Odpovídáme obvykle do jednoho pracovního dne. U objednávek prosím uveďte číslo objednávky, u poptávek termín a přibližný počet kusů.',
    en: 'We usually reply within one working day. For orders please include the order number; for enquiries, the date and approximate quantity.',
    de: 'Wir antworten in der Regel innerhalb eines Werktags. Bei Bestellungen bitte die Bestellnummer angeben, bei Anfragen Termin und ungefähre Stückzahl.',
  } satisfies Localized,
  emailLabel: { cs: 'E-mail', en: 'E-mail', de: 'E-Mail' },
  phoneLabel: { cs: 'Telefon', en: 'Phone', de: 'Telefon' },
  addressLabel: { cs: 'Dílna a adresa', en: 'Workshop and address', de: 'Werkstatt und Adresse' },
  hoursLabel: { cs: 'Osobní odběr', en: 'Pickup', de: 'Abholung' },
  hours: {
    cs: 'Po domluvě, obvykle pondělí–pátek 9–17 h.',
    en: 'By appointment, usually Monday–Friday 9 am–5 pm.',
    de: 'Nach Vereinbarung, meist Montag–Freitag 9–17 Uhr.',
  } satisfies Localized,
  formTitle: { cs: 'Formulář', en: 'Form', de: 'Formular' } satisfies Localized,
  form: {
    name: { cs: 'Jméno', en: 'Name', de: 'Name' },
    email: { cs: 'E-mail', en: 'E-mail', de: 'E-Mail' },
    phone: { cs: 'Telefon (nepovinné)', en: 'Phone (optional)', de: 'Telefon (optional)' },
    subject: { cs: 'Téma', en: 'Subject', de: 'Betreff' },
    subjectOptions: [
      { value: 'objednavka', label: { cs: 'Objednávka', en: 'Order', de: 'Bestellung' } },
      { value: 'svatba', label: { cs: 'Svatba nebo event', en: 'Wedding or event', de: 'Hochzeit oder Event' } },
      { value: 'firma', label: { cs: 'Firemní dárky', en: 'Corporate gifts', de: 'Firmengeschenke' } },
      { value: 'jine', label: { cs: 'Jiné', en: 'Other', de: 'Sonstiges' } },
    ],
    message: { cs: 'Zpráva', en: 'Message', de: 'Nachricht' },
    submit: { cs: 'Odeslat zprávu', en: 'Send message', de: 'Nachricht senden' },
    success: {
      cs: 'Děkujeme, zpráva dorazila. Ozveme se co nejdřív.',
      en: 'Thank you, your message has arrived. We will get back to you soon.',
      de: 'Danke, Ihre Nachricht ist angekommen. Wir melden uns bald.',
    } satisfies Localized,
    error: {
      cs: 'Zprávu se nepodařilo odeslat. Napište nám prosím přímo na e-mail.',
      en: 'The message could not be sent. Please write to us directly by e-mail.',
      de: 'Die Nachricht konnte nicht gesendet werden. Bitte schreiben Sie uns direkt per E-Mail.',
    } satisfies Localized,
  },
  inquiryTitle: { cs: 'Poptávka pro svatbu nebo firmu', en: 'Enquiry for a wedding or company', de: 'Anfrage für Hochzeit oder Firma' } satisfies Localized,
  inquiryForm: {
    name: { cs: 'Jméno a příjmení', en: 'Full name', de: 'Vor- und Nachname' },
    email: { cs: 'E-mail', en: 'E-mail', de: 'E-Mail' },
    phone: { cs: 'Telefon', en: 'Phone', de: 'Telefon' },
    company: { cs: 'Firma nebo místo (nepovinné)', en: 'Company or venue (optional)', de: 'Firma oder Ort (optional)' },
    eventDate: { cs: 'Datum akce', en: 'Event date', de: 'Veranstaltungsdatum' },
    quantity: { cs: 'Přibližný počet kusů', en: 'Approximate quantity', de: 'Ungefähre Stückzahl' },
    message: { cs: 'Co plánujete?', en: 'What are you planning?', de: 'Was planen Sie?' },
    submit: { cs: 'Odeslat poptávku', en: 'Send enquiry', de: 'Anfrage senden' },
    success: {
      cs: 'Děkujeme. Ozveme se do jednoho pracovního dne s dalším krokem a možnostmi vzorku.',
      en: 'Thank you. We will get back to you within one working day with next steps and sample options.',
      de: 'Danke. Wir melden uns innerhalb eines Werktags mit den nächsten Schritten und Mustermöglichkeiten.',
    } satisfies Localized,
    error: {
      cs: 'Poptávku se nepodařilo odeslat. Napište nám prosím přímo na e-mail.',
      en: 'The enquiry could not be sent. Please write to us directly by e-mail.',
      de: 'Die Anfrage konnte nicht gesendet werden. Bitte schreiben Sie uns direkt per E-Mail.',
    } satisfies Localized,
  },
} as const;

export const FAQ_ITEMS = [
  {
    category: { cs: 'Produkt', en: 'Product', de: 'Produkt' },
    q: { cs: 'Z čeho je lampion vyrobený?', en: 'What is the lantern made of?', de: 'Woraus besteht die Laterne?' },
    a: {
      cs: 'Z 3mm březové překližky. Je nelakovaná, takže vynikne kresba dřeva a opálená hrana řezu. Lepidlo doporučujeme D3.',
      en: '3 mm birch plywood. It is unfinished, so the grain and the scorched cut edge show. We recommend D3 glue.',
      de: 'Aus 3 mm Birkensperrholz. Unbehandelt, damit die Maserung und die gebrannte Schnittkante sichtbar bleiben. Wir empfehlen D3-Leim.',
    },
  },
  {
    category: { cs: 'Produkt', en: 'Product', de: 'Produkt' },
    q: { cs: 'Jak dlouho trvá složení?', en: 'How long does assembly take?', de: 'Wie lange dauert der Aufbau?' },
    a: {
      cs: 'U Lumi 2 přibližně 30 minut, u Mini 20 minut. Nářadí nepotřebujete, jen rovnou plochu a lepidlo.',
      en: 'About 30 minutes for Lumi 2 and 20 minutes for Mini. No tools, just a flat surface and glue.',
      de: 'Etwa 30 Minuten bei Lumi 2 und 20 Minuten bei Mini. Kein Werkzeug, nur eine ebene Fläche und Leim.',
    },
  },
  {
    category: { cs: 'Produkt', en: 'Product', de: 'Produkt' },
    q: { cs: 'Je svíčka součástí balení?', en: 'Is the candle included?', de: 'Ist die Kerze enthalten?' },
    a: {
      cs: 'Není. Doporučujeme obyčejnou čajovou svíčku ve sklenici od malé Nutelly nebo od zavařeniny — sklo zachytí vosk i případný plamen.',
      en: 'No. We recommend an ordinary tea light in a small jam jar — the glass catches the wax and any flame.',
      de: 'Nein. Wir empfehlen ein normales Teelicht in einem kleinen Marmeladenglas — das Glas fängt Wachs und eine eventuelle Flamme auf.',
    },
  },
  {
    category: { cs: 'Doprava', en: 'Shipping', de: 'Versand' },
    q: { cs: 'Kdy mi lampion přijde?', en: 'When will my lantern arrive?', de: 'Wann kommt meine Laterne an?' },
    a: {
      cs: 'Vyrábíme na zakázku, obvykle odesíláme do 5 pracovních dnů. Personalizace přidává 2–3 dny. Přesný termín potvrdíme e-mailem.',
      en: 'We make to order and usually ship within 5 working days. Personalisation adds 2–3 days. We confirm the exact date by e-mail.',
      de: 'Wir fertigen auf Bestellung und versenden meist innerhalb von 5 Werktagen. Personalisierung verlängert um 2–3 Tage. Den genauen Termin bestätigen wir per E-Mail.',
    },
  },
  {
    category: { cs: 'Doprava', en: 'Shipping', de: 'Versand' },
    q: { cs: 'Posíláte do zahraničí?', en: 'Do you ship abroad?', de: 'Versenden Sie ins Ausland?' },
    a: {
      cs: 'Zatím posíláme po České republice a na Slovensko. Do Německa a Rakouska rádi připravíme nabídku — napište nám kvůli dopravě a celním pravidlům.',
      en: 'For now we ship within the Czech Republic and to Slovakia. For Germany and Austria we are happy to prepare a quote — write to us about shipping and customs rules.',
      de: 'Derzeit liefern wir innerhalb Tschechiens und in die Slowakei. Für Deutschland und Österreich erstellen wir gern ein Angebot — schreiben Sie uns zu Versand und Zoll.',
    },
  },
  {
    category: { cs: 'Doprava', en: 'Shipping', de: 'Versand' },
    q: { cs: 'Můžu si lampion vyzvednout osobně?', en: 'Can I collect the lantern in person?', de: 'Kann ich die Laterne persönlich abholen?' },
    a: {
      cs: 'Ano, po domluvě. Rádi vám ukážeme, jak se řeže a skládá.',
      en: 'Yes, by appointment. We are happy to show you how it is cut and assembled.',
      de: 'Ja, nach Vereinbarung. Wir zeigen Ihnen gern, wie geschnitten und aufgebaut wird.',
    },
  },
  {
    category: { cs: 'Personalizace', en: 'Personalisation', de: 'Personalisierung' },
    q: { cs: 'Co všechno můžete vypálit?', en: 'What can you burn into the wood?', de: 'Was können Sie ins Holz brennen?' },
    a: {
      cs: 'Jména, datum, krátký nápis nebo logo. Logo potřebujeme v křivkách (SVG, AI nebo PDF). Návrh posíláme k odsouhlasení.',
      en: 'Names, a date, a short line or a logo. We need the logo as vector artwork (SVG, AI or PDF). We send a proof for approval.',
      de: 'Namen, Datum, kurzen Text oder Logo. Für das Logo brauchen wir Vektordaten (SVG, AI oder PDF). Wir senden einen Entwurf zur Freigabe.',
    },
  },
  {
    category: { cs: 'Personalizace', en: 'Personalisation', de: 'Personalisierung' },
    q: { cs: 'Kolik znaků se vejde?', en: 'How many characters fit?', de: 'Wie viele Zeichen passen?' },
    a: {
      cs: 'Obvykle dvě jména a datum, nebo krátká věta do 12 slov. Když je text delší, navrhneme jiné místo nebo jinou stěnu.',
      en: 'Usually two names and a date, or a short sentence of up to 12 words. If the text is longer we suggest another placement or wall.',
      de: 'Meist zwei Namen und ein Datum oder ein kurzer Satz bis 12 Wörter. Ist der Text länger, schlagen wir eine andere Stelle oder Wand vor.',
    },
  },
  {
    category: { cs: 'Bezpečnost', en: 'Safety', de: 'Sicherheit' },
    q: { cs: 'Není dřevěný lampion nebezpečný?', en: 'Is a wooden lantern not dangerous?', de: 'Ist eine Holzlaterne nicht gefährlich?' },
    a: {
      cs: 'Dřevo hoří, proto má každý lampion pět bezpečnostních bodů: svíčka ve sklenici, nehořlavý podklad, dohled, odstup 30 cm a LED jako bezpečnější varianta. Celý text je u každého produktu a v pokladně ho podepisujete.',
      en: 'Wood burns, which is why every lantern comes with five safety points: candle in a glass, non-flammable base, supervision, 30 cm distance and LED as the safer option. The full text is on every product and you sign it at checkout.',
      de: 'Holz brennt — deshalb hat jede Laterne fünf Sicherheitspunkte: Kerze im Glas, nicht brennbare Unterlage, Aufsicht, 30 cm Abstand und LED als sicherere Variante. Der ganze Text steht bei jedem Produkt, bei der Bestellung unterschreiben Sie ihn.',
    },
  },
  {
    category: { cs: 'Bezpečnost', en: 'Safety', de: 'Sicherheit' },
    q: { cs: 'Můžu použít LED svíčku?', en: 'Can I use an LED candle?', de: 'Kann ich eine LED-Kerze verwenden?' },
    a: {
      cs: 'Ano a doporučujeme ji tam, kde jsou děti, zvířata nebo lidé, kteří na svíčku zapomenou. Svítí skoro stejně a nic nehoří.',
      en: 'Yes, and we recommend it wherever there are children, pets or people who forget candles. It glows almost the same and nothing burns.',
      de: 'Ja, und wir empfehlen sie überall dort, wo Kinder, Tiere oder vergessliche Menschen sind. Sie leuchtet fast genauso und nichts brennt.',
    },
  },
  {
    category: { cs: 'Firmy', en: 'Companies', de: 'Firmen' },
    q: { cs: 'Jaké jsou množstevní ceny?', en: 'What are the volume prices?', de: 'Wie sind die Staffelpreise?' },
    a: {
      cs: 'Od 10 kusů sleva 10 %, od 30 kusů 15 %. Zakázka vždy se zálohou 50 % a potvrzeným termínem. Napište nám poptávku s počtem a datem.',
      en: 'From 10 pieces 10% off, from 30 pieces 15%. Every order with a 50% deposit and a confirmed date. Send us an enquiry with quantity and date.',
      de: 'Ab 10 Stück 10 %, ab 30 Stück 15 %. Jede Bestellung mit 50 % Anzahlung und bestätigtem Termin. Senden Sie uns eine Anfrage mit Stückzahl und Datum.',
    },
  },
  {
    category: { cs: 'Firmy', en: 'Companies', de: 'Firmen' },
    q: { cs: 'Dostaneme vzorek?', en: 'Can we get a sample?', de: 'Bekommen wir ein Muster?' },
    a: {
      cs: 'Ano. U svateb a firemních zakázek posíláme jeden kus na vyzkoušení. Když se hodí, připravíme nabídku na celou akci.',
      en: 'Yes. For weddings and corporate orders we send one piece to try. If it fits, we prepare a quote for the whole event.',
      de: 'Ja. Für Hochzeiten und Firmenbestellungen senden wir ein Stück zum Ausprobieren. Passt es, erstellen wir ein Angebot für die ganze Veranstaltung.',
    },
  },
] as const;

export const SHIPPING_PAGE = {
  kicker: { cs: 'Doprava a vrácení', en: 'Shipping & returns', de: 'Versand & Rückgabe' } satisfies Localized,
  title: { cs: 'Jak to k vám dojde', en: 'How it gets to you', de: 'Wie es zu Ihnen kommt' },
  lead: {
    cs: 'Vyrábíme na zakázku, takže lampion neleží na skladě. Odesíláme obvykle do 5 pracovních dnů, personalizace přidává 2–3 dny.',
    en: 'We make to order, so the lantern is not sitting in a warehouse. We usually ship within 5 working days; personalisation adds 2–3 days.',
    de: 'Wir fertigen auf Bestellung, die Laterne liegt also nicht auf Lager. Wir versenden meist innerhalb von 5 Werktagen; Personalisierung verlängert um 2–3 Tage.',
  } satisfies Localized,
  methodsTitle: { cs: 'Možnosti dopravy', en: 'Shipping options', de: 'Versandoptionen' } satisfies Localized,
  methods: [
    { name: { cs: 'Zásilkovna — výdejní místo', en: 'Zásilkovna pickup point', de: 'Zásilkovna Abholstelle' }, price: { cs: '79 Kč', en: 'CZK 79', de: '79 CZK' }, time: { cs: '1–2 dny', en: '1–2 days', de: '1–2 Tage' } },
    { name: { cs: 'Zásilkovna — na adresu', en: 'Zásilkovna to address', de: 'Zásilkovna an Adresse' }, price: { cs: '99 Kč', en: 'CZK 99', de: '99 CZK' }, time: { cs: '1–2 dny', en: '1–2 days', de: '1–2 Tage' } },
    { name: { cs: 'Osobní odběr', en: 'Personal pickup', de: 'Persönliche Abholung' }, price: { cs: 'zdarma', en: 'free', de: 'kostenlos' }, time: { cs: 'po domluvě', en: 'by appointment', de: 'nach Vereinbarung' } },
  ],
  freeNote: {
    cs: 'Doprava zdarma při objednávce nad 1 500 Kč (platí pro Zásilkovnu).',
    en: 'Free shipping on orders over CZK 1,500 (Zásilkovna).',
    de: 'Versandkostenfrei ab 1.500 CZK (Zásilkovna).',
  } satisfies Localized,
  returnsTitle: { cs: 'Vrácení a reklamace', en: 'Returns and claims', de: 'Rückgabe und Reklamation' } satisfies Localized,
  returnsText: {
    cs: 'Zboží můžete vrátit do 14 dnů od převzetí, pokud je nepoužité a v původním obalu. Personalizované kusy (jména, datum, logo) vrátit nelze, pokud nejsou vadné. Reklamaci vyřídíme do 30 dnů; vadný kus vyměníme nebo vrátíme peníze.',
    en: 'You can return goods within 14 days of receipt if unused and in the original packaging. Personalised pieces (names, date, logo) cannot be returned unless faulty. We handle claims within 30 days; a faulty piece is replaced or refunded.',
    de: 'Sie können Waren innerhalb von 14 Tagen nach Erhalt zurückgeben, sofern unbenutzt und in der Originalverpackung. Personalisierte Stücke (Namen, Datum, Logo) sind vom Umtausch ausgeschlossen, sofern nicht fehlerhaft. Reklamationen bearbeiten wir innerhalb von 30 Tagen; fehlerhafte Stücke werden ersetzt oder erstattet.',
  } satisfies Localized,
  addressTitle: { cs: 'Kam poslat vrácení', en: 'Where to send a return', de: 'Wohin die Rücksendung' } satisfies Localized,
  addressText: {
    cs: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná. Před odesláním nám prosím napište e-mail s číslem objednávky.',
    en: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Czech Republic. Please e-mail us the order number before sending.',
    de: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Tschechien. Bitte senden Sie uns vorab eine E-Mail mit der Bestellnummer.',
  } satisfies Localized,
} as const;
