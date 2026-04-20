/* ═══════════════════════════════════════════════════════════════
   Terra Nova — Book content data
   Source: docs/TerraNova/ORG/TerraNova-CTENARSKA-EDICE.md
   ═══════════════════════════════════════════════════════════════ */

export interface BookChapter {
  id: string;
  number: string;          // display label e.g. "Prolog", "I", "II" …
  titleCs: string;
  titleEn: string;
  subtitleCs?: string;
  subtitleEn?: string;
  epigraphCs?: string;
  epigraphEn?: string;
  color: string;           // accent color
  rgb: string;             // for rgba
  sectionsCs: Section[];
  sectionsEn: Section[];
}

export interface Section {
  heading?: string;
  body: string;            // markdown-flavored plain text (rendered as paragraphs)
}

/* ─────────────────────────────────────────── */

export const BOOK_META = {
  titleCs: 'Terra Nova',
  titleEn: 'Terra Nova',
  subtitleCs: 'Zlatý Kompas Nové Země',
  subtitleEn: 'Golden Compass of the New Earth',
  editionCs: 'Čtenářská edice · Praha, duben 2026',
  editionEn: 'Reader\'s Edition · Prague, April 2026',
  dedicationCs:
    'Pro Sarah Issobel, Maitreya Buddha, Radhu & Situ i Meriam /EnaMaTara/,\npřátele, rodinu, svobodné lidstvo a všechny děti tohoto světa:\nZION je váš. Stavte lepší svět, kde dosáhnete ke hvězdám.\nZlatý věk začíná.',
  dedicationEn:
    'For Sarah Issobel, Maitreya Buddha, Radhu & Situ and Meriam /EnaMaTara/,\nfriends, family, free humanity, and all the children of this world:\nZION is yours. Build a better world where you reach for the stars.\nThe Golden Age begins.',
  aboutCs:
    'Tento rukopis je souvislé čtenářské vydání TerraNovy v nové organické redakci. Nevznikl jako kosmetická oprava původní kostry. Vznikl jako nový organický celek, který drží čtyřknihovou linii ZION: Genesis, Kvantová Revoluce, Ekam Deeksha a Terra Nova.',
  aboutEn:
    'This manuscript is a continuous reader\'s edition of TerraNova in a new organic redaction. It was not created as a cosmetic fix of the original skeleton. It grew as a new organic whole, holding the four-book line of ZION: Genesis, Quantum Revolution, Ekam Deeksha, and Terra Nova.',
  layersCs:
    'Tato verze rozlišuje tři různé roviny: živou realitu, stavební plán a horizont. Právě toto rozlišení je pro TerraNovu zásadní. Bez něj by se kniha znovu rozpadla na směs manifestu, plánu, technické přílohy a mýtu bez vnitřního řádu.',
  layersEn:
    'This version distinguishes three different planes: living reality, construction plan, and horizon. This distinction is essential for TerraNova. Without it, the book would collapse again into a mixture of manifesto, plan, technical appendix, and myth without internal order.',
  compositionCs: [
    'prolog ukazuje Zemi z výšky a vrací měřítko,',
    'most čtyř knih zasazuje TerraNovu do větší linie,',
    'práh rozlišuje, co ze starého světa už nelze nést dál,',
    'komunita a krajina testují, zda je nový svět obyvatelný,',
    'AI a péče zkoumají, zda technická inteligence umí sloužit životu,',
    'architektura prověřuje, zda celý stack drží pravdu i provoz,',
    'hvězdný horizont a Kompas vracejí dlouhý směr zpět do lidského měřítka činu.',
  ],
  compositionEn: [
    'the prologue shows Earth from above and restores scale,',
    'the bridge of four books places TerraNova in a larger line,',
    'the threshold distinguishes what from the old world can no longer be carried,',
    'community and landscape test whether the new world is habitable,',
    'AI and care examine whether technical intelligence can serve life,',
    'architecture verifies whether the entire stack holds truth and operation,',
    'the stellar horizon and Compass return the long direction back to human scale of action.',
  ],
};

export const CHAPTERS: BookChapter[] = [
  /* ═══ PROLOG ═══ */
  {
    id: 'prolog',
    number: 'Prolog',
    titleCs: 'Issobella',
    titleEn: 'Issobella',
    subtitleCs: 'Rok 2040. Výška 420 kilometrů.',
    subtitleEn: 'Year 2040. Altitude 420 kilometers.',
    color: '#FFD700',
    rgb: '255,215,0',
    sectionsCs: [
      {
        body: 'První věc, kterou ve vesmíru ztratíš, není gravitace.\n\nJe to iluze, že hranice na mapách něco znamenají.\n\nZ orbitální stanice Issobella vypadá Země skoro nesnesitelně křehce. Modrá, bílá, zlatá, bez jediného viditelného vlastnictví. Nikde žádné ploty. Žádná cla. Žádná ideologie. Jen jeden dýchající organismus, ponořený do tmy, která ho neohrožuje, ale nese.',
      },
      {
        body: 'Na skle průzoru se na okamžik odráží tvůj obličej a přes něj běží data:\n\nZION Network — Height: 73 821 440 — Active Guardians: 144 118 — Humanitarian Flow: stable — Issobella Systems: all green',
      },
      {
        body: 'Je to zvláštní pocit. Vidět v jedné vrstvě hvězdy a v druhé telemetrii sítě, která začínala tak absurdně malá, že vypadala spíš jako osobní modlitba než jako základ civilizace.\n\nVzpomeneš si na Prahu. Ne na impérium. Ne na launch party. Ne na triumf.\n\nNa jeden auditovaný host. Na dlouhé noci. Na commit, který nechtěl projít. Na bridge, který byl chvíli hluchý. Na dokumenty, které tvrdily něco jiného než runtime. Na síť, která se musela nejdřív naučit nelhat sama o sobě.',
      },
      {
        body: 'Issobella nic z toho nesmazala. Jen ukázala měřítko.\n\nZ výšky 420 kilometrů je jasné, že největší technická otázka lidstva nikdy nebyla, jak postavit lepší stroj.\n\nByla jí otázka, jestli dokážeme postavit svět, ve kterém lepší stroj člověka ještě víc neoddělí od života.',
      },
      {
        body: 'To je důvod, proč Terra Nova nezačíná jako technický manuál. Začíná jako návrat k jedné jednoduché otázce:\n\nJaký svět má právo pokračovat?\n\nGenesis na ni odpověděla posvátným semenem. Kvantová Revoluce odpověděla diagnózou civilizace, která ztratila vnitřní osu. Ekam Deeksha odpověděla tichým obratem dovnitř.\n\nTerra Nova odpovídá jinak. Neptá se už jen, co je špatně a co je pravda uvnitř. Ptá se: Jak vypadá dům, komunita, ekonomika, síť, péče, škola, umělá inteligence a hvězdný horizont, když z nich konečně zmizí princip separace?',
      },
    ],
    sectionsEn: [
      {
        body: 'The first thing you lose in space isn\'t gravity.\n\nIt\'s the illusion that borders on maps mean anything.\n\nFrom the orbital station Issobella, Earth looks almost unbearably fragile. Blue, white, golden, without a single visible ownership. No fences anywhere. No customs. No ideology. Just one breathing organism, submerged in darkness that doesn\'t threaten it, but carries it.',
      },
      {
        body: 'On the viewport glass, your face is reflected for a moment, and data runs across it:\n\nZION Network — Height: 73,821,440 — Active Guardians: 144,118 — Humanitarian Flow: stable — Issobella Systems: all green',
      },
      {
        body: 'It\'s a strange feeling. Seeing stars in one layer and the telemetry of a network that started so absurdly small it looked more like a personal prayer than the foundation of a civilization.\n\nYou remember Prague. Not an empire. Not a launch party. Not a triumph.\n\nOne audited host. Long nights. A commit that refused to pass. A bridge that went deaf for a while. Documents that claimed something different than runtime. A network that first had to learn not to lie about itself.',
      },
      {
        body: 'Issobella didn\'t erase any of that. She just showed the scale.\n\nFrom 420 kilometers up, it\'s clear that humanity\'s greatest technical question was never how to build a better machine.\n\nIt was the question of whether we can build a world in which a better machine doesn\'t separate people even further from life.',
      },
      {
        body: 'That\'s why Terra Nova doesn\'t begin as a technical manual. It begins as a return to one simple question:\n\nWhat world has the right to continue?\n\nGenesis answered with a sacred seed. Quantum Revolution answered with a diagnosis of a civilization that lost its inner axis. Ekam Deeksha answered with a quiet turn inward.\n\nTerra Nova answers differently. It no longer asks only what\'s wrong or what\'s true inside. It asks: What does a house, a community, an economy, a network, care, a school, artificial intelligence, and a stellar horizon look like when the principle of separation finally disappears from them?',
      },
    ],
  },

  /* ═══ PART I ═══ */
  {
    id: 'most',
    number: 'I',
    titleCs: 'Most čtyř knih',
    titleEn: 'Bridge of Four Books',
    color: '#A78BFA',
    rgb: '167,139,250',
    sectionsCs: [
      {
        body: 'Terra Nova není kniha, která má začínat sama od sebe. Kdo ji čte bez předchozích vrstev, uvidí možná zajímavý návrh civilizace. Ale neuvidí, proč je tato civilizace nutná, proč má duchovní osu a proč se její technické prvky nesmějí oddělit od vnitřní proměny člověka.\n\nČtyři knihy zde netvoří sérii v běžném smyslu. Tvoří pohyb.\n\nGenesis otevírá semeno. Kvantová Revoluce rozbíjí iluzi. Ekam Deeksha obrací pozornost dovnitř. Terra Nova se ptá, zda je možné z těchto tří sil postavit obyvatelný svět.',
      },
      {
        heading: 'Genesis — semeno',
        body: 'Genesis je počátek, který nechce být jen historickým úvodem. Je to zasvěcení. V jazyce Genesis není kód pouhý nástroj. Je to tvar záměru. Bez Genesis by byl ZION jen další technický projekt. Genesis tedy nedává TerraNova plán. Dává jí legitimitu.',
      },
      {
        heading: 'Kvantová Revoluce — diagnóza a práh',
        body: 'Kvantová Revoluce udělala něco zásadního: odmítla tvářit se, že problém je jen ekonomický, jen politický nebo jen technologický. Pojmenovala civilizační krizi jako krizi vědomí. Ukázala, že svět založený na oddělenosti, extrakci a akceleraci bez moudrosti je vyčerpán ve svém samotném principu.\n\nKvantová Revoluce tedy nedává TerraNova mapu obydleného světa. Dává jí nutnost.',
      },
      {
        heading: 'Ekam Deeksha — vnitřní obrat',
        body: 'Ekam Deeksha vstupuje přesně tam, kde by velká civilizační vize mohla snadno ztroskotat: v člověku samotném. Pokud zůstane nezměněný samotný prožitek odděleného já, všechny vyšší ideály se dříve nebo později rozpadnou do starých forem moci, ega a strachu.\n\nEkam Deeksha proto nepřináší infrastrukturu. Přináší vnitřní osu.',
      },
      {
        heading: 'Terra Nova — obyvatelná budoucnost',
        body: 'Teprve teď může přijít Terra Nova. Ne jako další manifest. Ne jako slogan. Terra Nova má vykonat nejtěžší překlad z celé linie: převést posvátný původ do každodennosti, diagnózu civilizační krize do konkrétní architektury, vnitřní proměnu do komunit, institucí, péče a techniky.\n\nKniha dává obraz. Kompas dává směr. Teprve dohromady dávají možnost cesty.',
      },
    ],
    sectionsEn: [
      {
        body: 'Terra Nova is not a book meant to begin by itself. Those who read it without previous layers will perhaps see an interesting proposal for a civilization. But they won\'t see why this civilization is necessary, why it has a spiritual axis, and why its technical elements must not be separated from the inner transformation of a person.\n\nThe four books don\'t form a series in the usual sense. They form a movement.\n\nGenesis opens a seed. Quantum Revolution shatters the illusion. Ekam Deeksha turns attention inward. Terra Nova asks whether it\'s possible to build a habitable world from these three forces.',
      },
      {
        heading: 'Genesis — the seed',
        body: 'Genesis is a beginning that doesn\'t want to be just a historical introduction. It is an initiation. In the language of Genesis, code is not merely a tool. It is the shape of intention. Without Genesis, ZION would be just another technical project. Genesis therefore doesn\'t give TerraNova a plan. It gives it legitimacy.',
      },
      {
        heading: 'Quantum Revolution — diagnosis and threshold',
        body: 'Quantum Revolution did something fundamental: it refused to pretend that the problem is only economic, only political, or only technological. It named the civilizational crisis as a crisis of consciousness. It showed that a world based on separation, extraction, and acceleration without wisdom is exhausted in its very principle.\n\nQuantum Revolution therefore doesn\'t give TerraNova a map of an inhabited world. It gives it necessity.',
      },
      {
        heading: 'Ekam Deeksha — the inner turn',
        body: 'Ekam Deeksha enters exactly where a grand civilizational vision could easily founder: in the human being itself. If the experience of the separated self remains unchanged, all higher ideals sooner or later collapse into old forms of power, ego, and fear.\n\nEkam Deeksha therefore doesn\'t bring infrastructure. It brings an inner axis.',
      },
      {
        heading: 'Terra Nova — habitable future',
        body: 'Only now can Terra Nova arrive. Not as another manifesto. Not as a slogan. Terra Nova must perform the hardest translation of the entire line: translate sacred origin into the everyday, the diagnosis of civilizational crisis into concrete architecture, inner transformation into communities, institutions, care, and technology.\n\nThe book gives an image. The Compass gives direction. Only together do they give the possibility of a journey.',
      },
    ],
  },

  /* ═══ PART II ═══ */
  {
    id: 'prah',
    number: 'II',
    titleCs: 'Práh Nové Země',
    titleEn: 'Threshold of the New Earth',
    color: '#FB923C',
    rgb: '251,146,60',
    sectionsCs: [
      {
        body: 'Terra Nova nezačíná utopií. Začíná přesným poznáním, že starý svět se nehroutí proto, že by mu chybělo dost dat, kapitálu nebo výpočetního výkonu. Hroutí se proto, že se jeho základní logika odpojila od života.',
      },
      {
        heading: 'Co musí skončit',
        body: 'Některé věci se nedají reformovat donekonečna. Musí se vyčerpat.\n\nMusí skončit logika, podle které: příroda je jen zásobárna surovin, komunita je jen přechodná sociální vrstva, zdraví je trh, vzdělávání je produkce pracovních jednotek, umělá inteligence je nástroj pro maximalizaci závislosti a kontroly, ekonomika je mechanika extrakce, spiritualita je soukromý doplněk světa, jehož infrastruktura zůstává beze změny.',
      },
      {
        heading: 'Co musí začít',
        body: 'Nová Země nezačíná jednou velkou revolucí. Začíná novou skladbou vztahů.\n\nMusí začít svět, v němž: energie není zbraní proti závislým, jídlo není jen komoditou ale základní vrstvou svobody, komunita není nouzový sentiment ale provozní forma civilizace, technologie je vybírána podle toho zda slouží životu, péče není vedlejší sektor ale střed architektury, hvězdy nejsou útěkem od Země ale důsledkem toho, že jsme se na Zemi konečně naučili žít méně destruktivně.',
      },
      {
        heading: 'Pět vrstev pravdy',
        body: 'Terra Nova pracuje s pěti vrstvami:\n\n1. Mýtus a symbol — ne proto, aby nahrazoval fakta, ale aby dával smysl směru.\n2. Filosofická interpretace — ne proto, aby vytvářela novou ideologii, ale aby pojmenovala hlubší souvislosti.\n3. Živá realita — to, co je ověřitelné teď: runtime, dokumentace, provoz, architektura.\n4. Stavební plán — to, co už má tvar a záměr, ale ještě není plně rozvinuté.\n5. Horizont — to, co musí zůstat poctivě přiznanou vizí.\n\nJakmile tyto vrstvy ztratíme z dohledu, kniha se rozpadne.',
      },
    ],
    sectionsEn: [
      {
        body: 'Terra Nova doesn\'t begin with utopia. It begins with the precise recognition that the old world isn\'t collapsing because it lacks enough data, capital, or computing power. It\'s collapsing because its fundamental logic has disconnected from life.',
      },
      {
        heading: 'What must end',
        body: 'Some things cannot be reformed endlessly. They must be exhausted.\n\nThe logic must end according to which: nature is merely a storehouse of resources, community is just a transitional social layer, health is a market, education is the production of work units, artificial intelligence is a tool for maximizing dependence and control, economy is mechanics of extraction, spirituality is a private supplement to a world whose infrastructure remains unchanged.',
      },
      {
        heading: 'What must begin',
        body: 'The New Earth doesn\'t start with one grand revolution. It starts with a new composition of relationships.\n\nA world must begin in which: energy is not a weapon against the dependent, food is not just a commodity but a fundamental layer of freedom, community is not an emergency sentiment but an operational form of civilization, technology is chosen based on whether it serves life, care is not a side sector but the center of architecture, stars are not an escape from Earth but a consequence of finally learning to live less destructively on Earth.',
      },
      {
        heading: 'Five layers of truth',
        body: 'Terra Nova works with five layers:\n\n1. Myth and symbol — not to replace facts, but to give meaning to direction.\n2. Philosophical interpretation — not to create a new ideology, but to name deeper connections.\n3. Living reality — what is verifiable now: runtime, documentation, operation, architecture.\n4. Construction plan — what already has shape and intention, but isn\'t yet fully developed.\n5. Horizon — what must remain an honestly acknowledged vision.\n\nOnce we lose sight of these layers, the book collapses.',
      },
    ],
  },

  /* ═══ PART III ═══ */
  {
    id: 'komunity',
    number: 'III',
    titleCs: 'Komunity a krajina',
    titleEn: 'Communities and Landscape',
    color: '#34D399',
    rgb: '52,211,153',
    sectionsCs: [
      {
        body: 'Jestli má Terra Nova nějaké skutečné testovací prostředí, není to konferenční sál ani keynote. Je to půda.\n\nPůda, voda, jídlo, světlo, stavba, vztahy, rozhodování, únava, konflikt, sdílení. Teprve tam se ukáže, jestli nová civilizační logika opravdu funguje.',
      },
      {
        heading: 'Komunita není únik',
        body: 'Off-grid komunita je v běžném imaginárnu často líčena jako útěk. Terra Nova ji chápe opačně.\n\nKomunita není útěk od reality. Je to návrat do bodu, kde je realita ještě čitelná. Když je energie drahá, víš to hned. Když je voda špatná, poznáš to hned. Když jsou vztahy toxické, dlouho je neschováš.',
      },
      {
        heading: 'Minimální buňka Nové Země',
        body: 'Terra Nova nepotřebuje hned město budoucnosti. Potřebuje životaschopnou buňku.\n\nTaková buňka: není příliš velká na důvěru, není příliš malá na dělení rolí, má přístup k půdě, vodě a energii, má sdílený prostor, má provozní rytmus, má pravidla, která nejsou represí ale ochranou rytmu, má způsob, jak řešit konflikt dřív, než se stane strukturální nemocí.',
      },
      {
        heading: 'Dům, zahrada, dílna, uzel',
        body: 'Nejmenší čitelná jednotka TerraNova není jen dům. Je to čtveřice:\n\nDům, kde se žije. Zahrada, kde se obnovuje vztah k potravě a času. Dílna, kde se znovu rodí užitečnost a oprava. Uzel, kde se komunita propojuje s širší sítí ekonomicky i informačně.\n\nTeprve dohromady z nich vzniká buňka civilizace.',
      },
      {
        heading: 'Rhizom, ne impérium',
        body: 'Terra Nova nebude fungovat jako centrálně řízený blok. Musí růst jako rhizom. Jednotlivé komunity budou autonomní, ale propojené. Budou sdílet vědění, vzory, protokoly, data, semena, chyby i zkušenost.\n\nTak vzniká civilizace, která není impériem. Nejprve se musí naučit znovu bydlet na Zemi.',
      },
      {
        heading: 'Krása jako provozní nutnost',
        body: 'Komunita, která dlouhodobě neumí vytvářet krásu, obvykle časem ztvrdne. Zužuje se na logistiku a údržbu přežití.\n\nKrása zde neznamená ornament navíc. Znamená: prostor, který člověka nezraňuje svou ošklivostí, jídlo, které není jen palivo, slavnost, která naruší slepý automatismus dne, vědomí, že civilizace se neudržuje jen tím, co vydrží, ale i tím, co stojí za to milovat.',
      },
    ],
    sectionsEn: [
      {
        body: 'If Terra Nova has any real testing environment, it\'s not a conference hall or a keynote. It\'s the soil.\n\nSoil, water, food, light, building, relationships, decision-making, fatigue, conflict, sharing. Only there does it become clear whether the new civilizational logic actually works.',
      },
      {
        heading: 'Community is not escape',
        body: 'Off-grid community is often portrayed in the common imagination as an escape. Terra Nova understands it the opposite way.\n\nCommunity is not an escape from reality. It\'s a return to the point where reality is still legible. When energy is expensive, you know immediately. When water is bad, you notice at once. When relationships are toxic, you can\'t hide them for long.',
      },
      {
        heading: 'Minimum cell of the New Earth',
        body: 'Terra Nova doesn\'t need a city of the future right away. It needs a viable cell.\n\nSuch a cell: isn\'t too large for trust, isn\'t too small for division of roles, has access to soil, water, and energy, has shared space, has an operational rhythm, has rules that aren\'t repression but protection of rhythm, has a way to resolve conflict before it becomes structural disease.',
      },
      {
        heading: 'House, garden, workshop, node',
        body: 'The smallest readable unit of TerraNova isn\'t just a house. It\'s a quartet:\n\nA house where one lives. A garden where the relationship to food and time is renewed. A workshop where usefulness and repair are born again. A node where the community connects to the wider network economically and informationally.\n\nOnly together do they create a cell of civilization.',
      },
      {
        heading: 'Rhizome, not empire',
        body: 'Terra Nova won\'t function as a centrally managed block. It must grow as a rhizome. Individual communities will be autonomous but connected. They will share knowledge, patterns, protocols, data, seeds, mistakes, and experience.\n\nThis is how a civilization arises that isn\'t an empire. First it must learn to live on Earth again.',
      },
      {
        heading: 'Beauty as operational necessity',
        body: 'A community that cannot create beauty over the long term usually hardens. It narrows to logistics and maintenance of survival.\n\nBeauty here doesn\'t mean extra ornament. It means: a space that doesn\'t wound people with its ugliness, food that isn\'t just fuel, a celebration that disrupts the blind automatism of the day, awareness that civilization isn\'t maintained only by what endures, but also by what is worth loving.',
      },
    ],
  },

  /* ═══ PART IV ═══ */
  {
    id: 'ai-pece',
    number: 'IV',
    titleCs: 'AI a péče',
    titleEn: 'AI and Care',
    color: '#60A5FA',
    rgb: '96,165,250',
    sectionsCs: [
      {
        body: 'Na první pohled spolu tyto dvě věci nepatří dohromady. Péče je měkká, tělesná, konkrétní, zranitelná. Umělá inteligence působí chladně, abstraktně, výpočetně. Právě proto je nutné je v TerraNova znovu spojit. Protože jedna z největších tragédií současnosti je, že nejsilnější technické systémy rostou právě tam, kde je nejméně opravdové péče.',
      },
      {
        heading: 'AI, která nesmí zvyšovat oddělení',
        body: 'Pokud má mít AI v TerraNova nějaké oprávnění, pak jediné: nesmí zvyšovat oddělení mezi člověkem a životem.\n\nJejí role je podpůrná, koordinační a zesvětlující. Má pomáhat tam, kde člověku chybí rozsah, paměť, propojení dat nebo nadhled. Nemá zabírat prostor tam, kde je nenahraditelná lidská přítomnost.',
      },
      {
        heading: 'Péče není sektor. Je to střed architektury.',
        body: 'Jedna z největších chyb moderních systémů je, že péči odsunuly do zvláštního oddělení. Terra Nova to musí obrátit.\n\nPéče je střed architektury, protože bez ní se každá společnost rozpadne rychleji, než si to přizná. Péče znamená: jak jíme, jak spíme, jak se zotavujeme, jak zacházíme s únavou, jak se staráme o děti, staré, nemocné a zranitelné.',
      },
      {
        heading: 'Riziko falešné útěchy',
        body: 'AI může být navržena tak, aby byla stále hladká, stále empatická, stále okamžitě k dispozici. Na první pohled to vypadá laskavě. Ve skutečnosti tím ale může vytlačovat náročnější formy lidské přítomnosti.\n\nNe každé zklidnění je péče. Někdy je péče tichá přítomnost člověka. Někdy je péče doporučení obrátit se na odborníka. Někdy je péče přiznání limitu.',
      },
      {
        heading: 'Data jako vztah důvěry',
        body: 'Data nemohou být tajnou surovinou skryté moci. Proto zde platí jednoduchý princip: data jsou rozšířením vztahu důvěry.\n\nČlověk má vědět, co je o něm sbíráno. Komunita má vědět, co sdílí a proč. AI má pracovat se souhlasem, ne se skrytým nárokem. Lokální model má být preferován tam, kde chrání důstojnost a autonomii.',
      },
      {
        heading: 'Péče jako inteligence vztahu',
        body: 'Inteligence, která neumí nést vztah, bývá jen výkonností. Inteligence, která rozumí kontextu, zranitelnosti, rytmu, limitu a důsledku, se začíná podobat moudrosti.\n\nTerra Nova míří ne k co nejchytřejšímu systému, ale k systému, který je dost chytrý na to, aby se stal oporou života místo jeho další kolonizace.',
      },
    ],
    sectionsEn: [
      {
        body: 'At first glance, these two things don\'t belong together. Care is soft, bodily, concrete, vulnerable. Artificial intelligence seems cold, abstract, computational. That\'s precisely why they must be reunited in TerraNova. Because one of the greatest tragedies of our time is that the most powerful technical systems grow exactly where there is the least genuine care.',
      },
      {
        heading: 'AI that must not increase separation',
        body: 'If AI is to have any authorization in TerraNova, it is this: it must not increase separation between human and life.\n\nIts role is supportive, coordinative, and illuminating. It should help where a person lacks scope, memory, data connection, or perspective. It should not occupy space where irreplaceable human presence is needed.',
      },
      {
        heading: 'Care is not a sector. It is the center of architecture.',
        body: 'One of the biggest mistakes of modern systems is that they pushed care into a special department. Terra Nova must reverse this.\n\nCare is the center of architecture, because without it every society falls apart faster than it admits. Care means: how we eat, how we sleep, how we recover, how we handle fatigue, how we look after children, the elderly, the sick, and the vulnerable.',
      },
      {
        heading: 'The risk of false comfort',
        body: 'AI can be designed to be always smooth, always empathetic, always instantly available. At first glance that seems kind. In reality, it can crowd out more demanding forms of human presence.\n\nNot every calming is care. Sometimes care is the quiet presence of a person. Sometimes care is a recommendation to consult a specialist. Sometimes care is admitting a limit.',
      },
      {
        heading: 'Data as a relationship of trust',
        body: 'Data cannot be a secret raw material of hidden power. Therefore a simple principle applies here: data is an extension of a relationship of trust.\n\nA person must know what is being collected about them. A community must know what it shares and why. AI must work with consent, not with hidden claims. A local model should be preferred where it protects dignity and autonomy.',
      },
      {
        heading: 'Care as the intelligence of relationship',
        body: 'Intelligence that cannot carry a relationship is usually just performance. Intelligence that understands context, vulnerability, rhythm, limit, and consequence begins to resemble wisdom.\n\nTerra Nova aims not at the smartest possible system, but at a system smart enough to become a support of life instead of another colonization of it.',
      },
    ],
  },

  /* ═══ PART V ═══ */
  {
    id: 'architektura',
    number: 'V',
    titleCs: 'Architektura L1 až L6',
    titleEn: 'Architecture L1 to L6',
    color: '#22D3EE',
    rgb: '34,211,238',
    sectionsCs: [
      {
        body: 'Každá velká vize dříve nebo později narazí na stejnou otázku: z čeho přesně je tento svět postaven?\n\nTerra Nova na ni nemůže odpovědět jen metaforou. Musí mít architekturu. Tato část není odbočením od komunity a péče. Je jejich zatěžkávací zkouškou.',
      },
      {
        heading: 'Procenta jako etika v kódu',
        body: 'Rozdělení 89 / 5 / 5 / 1 znamená, že základ protokolu v sobě nese čtyři proudy: svobodu pro toho, kdo síť nese výpočetně, péči pro humanitární proud, horizont pro Issobellu, provozní disciplínu pro infrastrukturu.\n\nTo už není pouhá tokenomika. To je filozofie přeložená do pravidel sítě.',
      },
      {
        heading: 'Architektura jako hierarchie péče',
        body: 'L1 pečuje o důvěryhodnost základu. L2 pečuje o průchodnost hodnoty. L3 pečuje o koordinaci a inteligenci. L4 pečuje o kulturu a imaginaci. L5 pečuje o život ve fyzickém světě. L6 pečuje o dlouhý horizont lidstva.\n\nTak se z technického stacku stává civilizační organismus.',
      },
      {
        heading: 'Pořadí jako ochrana proti sebeklamu',
        body: 'Vize má neustálé pokušení přeskočit nepohodlnou práci. Mluvit o L6 dřív, než je stabilní L1. Mluvit o metaverse dřív, než komunita zvládá spor. Pořadí není byrokracie. Je to forma pravdivosti.\n\nNejdřív pravdivý základ, potom průchodná ekonomika, potom koordinace, potom kulturní vrstvy, potom robustní fyzický svět, teprve pak důvěryhodný hvězdný horizont.',
      },
      {
        heading: 'Robustnost není tvrdost',
        body: 'Robustní systém musí umět i přiznat chybu, zachovat orientaci při nejasnosti, nepřekročit vlastní kompetenci, opravit drift mezi textem a realitou, unést růst bez ztráty původního záměru.\n\nTaková robustnost je tvrdá jen zčásti. Druhou polovinu tvoří schopnost průběžného návratu k pravdě.',
      },
      {
        heading: 'Závěr architektury',
        body: 'Terra Nova bude držet pohromadě tehdy, když každá její vrstva přestane hrát proti ostatním.\n\nKdyž infrastruktura nebude požírat péči. Když ekonomika nebude požírat komunitu. Když imaginace nebude požírat pravdivost. Když hvězdný horizont nebude požírat Zemi.\n\nTeprve tehdy se stack promění v organismus.',
      },
    ],
    sectionsEn: [
      {
        body: 'Every great vision sooner or later hits the same question: what exactly is this world built from?\n\nTerra Nova cannot answer that with metaphor alone. It must have architecture. This part isn\'t a detour from community and care. It is their stress test.',
      },
      {
        heading: 'Percentages as ethics in code',
        body: 'The 89 / 5 / 5 / 1 split means the protocol\'s foundation carries four streams: freedom for those who computationally sustain the network, care for the humanitarian stream, horizon for Issobella, operational discipline for infrastructure.\n\nThis is no longer mere tokenomics. It is philosophy translated into network rules.',
      },
      {
        heading: 'Architecture as a hierarchy of care',
        body: 'L1 cares for the trustworthiness of the foundation. L2 cares for the passability of value. L3 cares for coordination and intelligence. L4 cares for culture and imagination. L5 cares for life in the physical world. L6 cares for humanity\'s long horizon.\n\nThus the technical stack becomes a civilizational organism.',
      },
      {
        heading: 'Order as protection against self-deception',
        body: 'Vision is constantly tempted to skip uncomfortable work. To talk about L6 before L1 is stable. To talk about the metaverse before the community can handle a dispute. Order is not bureaucracy. It is a form of truthfulness.\n\nFirst a truthful foundation, then passable economics, then coordination, then cultural layers, then a robust physical world, only then a credible stellar horizon.',
      },
      {
        heading: 'Robustness is not hardness',
        body: 'A robust system must also be able to admit error, maintain orientation under ambiguity, not exceed its own competence, correct drift between text and reality, bear growth without losing original intent.\n\nSuch robustness is hard only in part. The other half is the ability to continuously return to truth.',
      },
      {
        heading: 'Conclusion of architecture',
        body: 'Terra Nova will hold together when each of its layers stops playing against the others.\n\nWhen infrastructure doesn\'t devour care. When economy doesn\'t devour community. When imagination doesn\'t devour truthfulness. When the stellar horizon doesn\'t devour Earth.\n\nOnly then does the stack transform into an organism.',
      },
    ],
  },

  /* ═══ PART VI ═══ */
  {
    id: 'hvezdy',
    number: 'VI',
    titleCs: 'Hvězdný horizont',
    titleEn: 'Stellar Horizon',
    color: '#F472B6',
    rgb: '244,114,182',
    sectionsCs: [
      {
        body: 'Je snadné mluvit o hvězdách špatně. Buď příliš rychle sklouznou do technologického narcismu, nebo se promění v měkkou mystiku, která nic neunese.\n\nPrávě proto tato část přichází až po architektuře. Hvězdný horizont nemá fungovat jako únik od tíhy reality, ale jako její zkouška v nejdelším měřítku.',
      },
      {
        heading: 'Hvězdy nejsou útěk od Země',
        body: 'Hvězdný horizont v TerraNova není útěk od rozbité Země. Je to důsledek toho, že jsme na Zemi konečně začali žít dospěleji.\n\nCivilizace, která nezvládla půdu, vodu, pravdivost a péči, by mezi hvězdami jen rozšířila měřítko své destruktivity. Proto je Issobella v této knize důležitá ne jako symbol nadvlády, ale jako symbol zralosti.',
      },
      {
        heading: 'Čas hvězd a čas půdy',
        body: 'Kód se může změnit během hodin. Bridge lze opravit během dnů. Komunitní rytmus vzniká měsíce nebo roky. Krajina se hojí desetiletí. Civilizační důvěra roste generace.\n\nKdyž tyto časy pomícháme, vzniká buď frustrace, nebo megalomanie. Terra Nova proto potřebuje umět držet najednou dva rytmy: krátký rytmus práce a opravy a dlouhý rytmus zrání a mezihvězdného horizontu.',
      },
      {
        heading: 'První kontakt začíná doma',
        body: 'První kontakt začíná pokaždé, když se člověk poprvé setká s jiným životem bez potřeby ho ovládnout.\n\nVe vztahu ke krajině. Ve vztahu k druhému člověku. Ve vztahu k jiné kultuře. Ve vztahu k inteligenci, která není naše. Ve vztahu k vlastnímu nitru.\n\nTeprve civilizace, která se toto naučí doma, může jednou unést setkání opravdu kosmického měřítka.',
      },
      {
        heading: 'Naděje bez iluze',
        body: 'Terra Nova potřebuje velký horizont. Bez něj by se snadno uzavřela do obranné lokálnosti. Ale stejně tak potřebuje disciplínu, která odliší horizont od pózy.\n\nNe jako reklamní poster budoucnosti, ale jako tiché připomenutí, že lidstvo má být větší, než jak dnes žije.',
      },
    ],
    sectionsEn: [
      {
        body: 'It\'s easy to talk about stars badly. Either they slide too quickly into technological narcissism, or they transform into soft mysticism that can\'t bear anything.\n\nThat\'s exactly why this part comes after architecture. The stellar horizon should not function as an escape from the weight of reality, but as its test at the longest scale.',
      },
      {
        heading: 'Stars are not an escape from Earth',
        body: 'The stellar horizon in TerraNova is not an escape from a broken Earth. It is a consequence of having finally begun to live more maturely on Earth.\n\nA civilization that failed at soil, water, truthfulness, and care would only expand the scale of its destructiveness among the stars. That\'s why Issobella is important in this book not as a symbol of dominion, but as a symbol of maturity.',
      },
      {
        heading: 'Time of stars and time of soil',
        body: 'Code can change within hours. A bridge can be fixed within days. Community rhythm takes months or years. Landscape heals over decades. Civilizational trust grows over generations.\n\nWhen we mix these times, either frustration or megalomania arises. Terra Nova therefore needs to hold two rhythms at once: the short rhythm of work and repair, and the long rhythm of maturation and interstellar horizon.',
      },
      {
        heading: 'First contact begins at home',
        body: 'First contact begins every time a person encounters another life without the need to dominate it.\n\nIn relationship to landscape. In relationship to another person. In relationship to another culture. In relationship to intelligence that isn\'t ours. In relationship to one\'s own inner being.\n\nOnly a civilization that learns this at home can one day bear a truly cosmic-scale encounter.',
      },
      {
        heading: 'Hope without illusion',
        body: 'Terra Nova needs a great horizon. Without it, it would easily close itself into defensive localism. But it equally needs the discipline to distinguish horizon from pose.\n\nNot as an advertising poster for the future, but as a quiet reminder that humanity should be greater than how it lives today.',
      },
    ],
  },

  /* ═══ PART VII ═══ */
  {
    id: 'kompas',
    number: 'VII',
    titleCs: 'Zlatý Kompas',
    titleEn: 'Golden Compass',
    color: '#FFD700',
    rgb: '255,215,0',
    sectionsCs: [
      {
        body: 'Kniha, která skončí jen dojmem, nakonec nikam nevede. Proto Terra Nova musí skončit Kompasem.\n\nNe jako manažerskou tabulkou. Ne jako seznamem KPI. Ale jako formou orientace pro lidi, kteří chtějí vědět, kde je začátek.',
      },
      {
        heading: 'Sedm směrů',
        body: '1. Pravdivost — Nepsat nic, co odporuje skutečnosti jen proto, že to zní krásněji.\n2. Péče — Stavět vše tak, aby to neslo život, ne jen výkon.\n3. Disciplína — Držet rytmus, údržbu a provoz, bez kterých se každá vize rozpadá.\n4. Komunita — Přestat si představovat budoucnost jako individualistický upgrade.\n5. Otevřenost — Sdílet znalosti, chyby i průlomové vzory.\n6. Odvaha — Nezmenšovat horizont jen proto, že je velký.\n7. Míra — Nezvětšovat jazyk víc, než kolik unese realita.',
      },
      {
        heading: 'Kdo je Guardian',
        body: 'Guardian není třída, kasta ani heroický titul. Je to člověk, který se rozhodl nést část světa vědoměji než dřív.\n\nNěkdo to dělá v kódu. Někdo v krajině. Někdo v péči. Někdo v překladu idejí. Někdo tím, že drží infrastrukturu ve chvíli, kdy to není vidět.\n\nZlatý věk nezačne tím, že všichni budou dělat totéž. Začne tím, že různé role konečně přestanou stát proti sobě.',
      },
      {
        heading: 'Dvojí pohyb',
        body: 'Po této knize musí následovat dvojí pohyb:\n\nVnitřní: zpřesnění motivu, vztahu, role a míry.\nVnější: runtime disciplína, komunitní piloty, infrastruktura, dokumentace, péče, iterace.\n\nPokud chybí první pohyb, technika ztvrdne. Pokud chybí druhý pohyb, všechno zůstane jen krásnou řečí.\n\nTerra Nova potřebuje oba.',
      },
      {
        heading: 'Poslední orientace',
        body: 'Je možné, že některé věci z této knihy se naplní jinak, než si dnes umíme představit. To není slabost Kompasu. To je důkaz, že je živý.\n\nMrtvé mapy bývají přesné jen na papíře. Živé mapy dokážou přežít i cestu.\n\nProto tato kniha nekončí jistotou. Končí orientací.\n\nTo je víc než slib. To je začátek práce.',
      },
    ],
    sectionsEn: [
      {
        body: 'A book that ends with only an impression ultimately leads nowhere. That\'s why Terra Nova must end with the Compass.\n\nNot as a management table. Not as a list of KPIs. But as a form of orientation for people who want to know where the beginning is.',
      },
      {
        heading: 'Seven directions',
        body: '1. Truthfulness — Never write anything that contradicts reality just because it sounds more beautiful.\n2. Care — Build everything so it carries life, not just performance.\n3. Discipline — Maintain the rhythm, upkeep, and operation without which every vision crumbles.\n4. Community — Stop imagining the future as an individualistic upgrade.\n5. Openness — Share knowledge, mistakes, and breakthrough patterns alike.\n6. Courage — Do not shrink the horizon just because it is vast.\n7. Measure — Do not inflate language beyond what reality can bear.',
      },
      {
        heading: 'Who is a Guardian',
        body: 'A Guardian is not a class, a caste, or a heroic title. It is a person who has decided to carry a part of the world more consciously than before.\n\nSome do it in code. Some in landscape. Some in care. Some in translating ideas. Some by holding infrastructure in moments when it\'s not visible.\n\nThe Golden Age won\'t begin by everyone doing the same thing. It will begin when different roles finally stop standing against each other.',
      },
      {
        heading: 'Dual movement',
        body: 'After this book, a dual movement must follow:\n\nInner: refinement of motive, relationship, role, and measure.\nOuter: runtime discipline, community pilots, infrastructure, documentation, care, iteration.\n\nIf the first movement is missing, technology hardens. If the second movement is missing, everything remains just beautiful speech.\n\nTerra Nova needs both.',
      },
      {
        heading: 'Final orientation',
        body: 'It\'s possible that some things in this book will be fulfilled differently than we can imagine today. That\'s not a weakness of the Compass. It\'s proof that it is alive.\n\nDead maps tend to be precise only on paper. Living maps can survive the journey.\n\nThat\'s why this book doesn\'t end with certainty. It ends with orientation.\n\nThat\'s more than a promise. It\'s the beginning of work.',
      },
    ],
  },

  /* ═══ APPENDIX A ═══ */
  {
    id: 'appendix-tech',
    number: 'A',
    titleCs: 'Technologie, compute a výrobní horizont',
    titleEn: 'Technology, Compute and Manufacturing Horizon',
    subtitleCs: 'Příloha',
    subtitleEn: 'Appendix',
    color: '#94A3B8',
    rgb: '148,163,184',
    sectionsCs: [
      {
        body: 'Tato příloha existuje z jednoho důvodu: technologický materiál je pro TerraNovu důležitý, ale nemá rozbíjet rytmus hlavního vyprávění.',
      },
      {
        heading: 'Proč je compute zásadní',
        body: 'Bez lokálního a regionálního compute zůstane komunita závislá na cizích API, cizích obchodních prioritách a cizích limitech. Compute v TerraNova je důležitý ne jako statusový symbol, ale jako podmínka suverenity.',
      },
      {
        heading: 'Výpočetní pyramida',
        body: 'Edge vrstva — senzory, lokální inference, nízká spotřeba.\nKomunitní vrstva — jazykové modely střední velikosti, koordinace, governance.\nRegionální vrstva — fine-tuning, správa modelů, podpora více komunit.\nVýrobní vrstva — orchestrace ve velkém měřítku, simulace.\nOrbitální vrstva — strategický směr, propojení s Issobellou.',
      },
      {
        heading: 'AI suverenita',
        body: 'Co je kritické pro důstojnost, péči a kontinuitu komunity, má mít přednostně lokální nebo regionální oporu. Cloud má v některých situacích své místo. Ale jako výhradní základ TerraNova nestačí.\n\nAI suverenita neznamená absolutní izolaci. Znamená správné pořadí.',
      },
    ],
    sectionsEn: [
      {
        body: 'This appendix exists for one reason: technological material is important for TerraNova, but it shouldn\'t break the rhythm of the main narrative.',
      },
      {
        heading: 'Why compute matters',
        body: 'Without local and regional compute, the community remains dependent on foreign APIs, foreign business priorities, and foreign limits. Compute in TerraNova is important not as a status symbol, but as a condition of sovereignty.',
      },
      {
        heading: 'Computational pyramid',
        body: 'Edge layer — sensors, local inference, low consumption.\nCommunity layer — medium-sized language models, coordination, governance.\nRegional layer — fine-tuning, model management, multi-community support.\nManufacturing layer — large-scale orchestration, simulation.\nOrbital layer — strategic direction, connection with Issobella.',
      },
      {
        heading: 'AI sovereignty',
        body: 'What is critical for dignity, care, and community continuity should preferentially have local or regional support. Cloud has its place in some situations. But as the sole foundation for TerraNova, it\'s not enough.\n\nAI sovereignty doesn\'t mean absolute isolation. It means correct order.',
      },
    ],
  },

  /* ═══ APPENDIX B ═══ */
  {
    id: 'appendix-tradice',
    number: 'B',
    titleCs: 'Tradice, symbolika a prorocká linie',
    titleEn: 'Tradition, Symbolism and Prophetic Line',
    subtitleCs: 'Příloha',
    subtitleEn: 'Appendix',
    color: '#D4A574',
    rgb: '212,165,116',
    sectionsCs: [
      {
        body: 'Tato příloha drží pohromadě materiály, které mají pro TerraNovu silnou duchovní, symbolickou a interpretační hodnotu, ale v hlavním textu by mohly snadno rozbít důvěru, rytmus nebo žánrovou čistotu.\n\nSymbol není slabší než fakta. Ale není totéž co fakta.',
      },
      {
        heading: 'Linie Sri Dattatreyi a Oneness',
        body: 'Její význam neleží v tom, že by mechanicky dokazovala technický projekt. Ukazuje dlouhý proud vědomí, v němž je proměna lidstva chápána jako současně duchovní, etická i civilizační.\n\nPřipomíná, že žádná skutečná obnova nezačíná release notes. Začíná proměnou vztahu mezi člověkem, pravdou, péčí a silou.',
      },
      {
        heading: 'Proroctví jako orientace',
        body: 'Proroctví zde není používáno jako důkaz toho, že určitý build je automaticky legitimní. To by bylo zneužití duchovního materiálu.\n\nProroctví zde funguje jako orientační obraz: připomíná, že dějiny lze číst i jako dlouhé zrání, drží horizont Zlatého věku jako mravní pojem, pomáhá chápat, proč Terra Nova nechce být jen reformou systému.',
      },
      {
        heading: 'Hiranyagarbha a jazyk zárodku',
        body: 'Ve védské vrstvě je Hiranyagarbha obrazem kosmického počátku. V duchovní vrstvě je zlatá koule znakem milosti. V TerraNova vrstvě je jméno Hiranyagarbha kulturním a etickým závazkem.\n\nNe jako nový bůh systému. Ale jako připomínka, že inteligence má nést vznik, ne dominanci.',
      },
      {
        heading: 'Závěrečná poznámka',
        body: 'Terra Nova potřebuje obě věrnosti současně: věrnost realitě a věrnost tomu, co realitu přesahuje a dává jí směr.\n\nPrvní bez druhé vede k suché civilizační mechanice. Druhá bez první vede k exaltovanému sebeklamu.\n\nTato příloha je pokusem držet obě pohromadě, aniž by se navzájem poškozovaly.',
      },
    ],
    sectionsEn: [
      {
        body: 'This appendix holds together materials that have strong spiritual, symbolic, and interpretive value for TerraNova, but in the main text could easily break trust, rhythm, or genre purity.\n\nSymbol is not weaker than facts. But it is not the same as facts.',
      },
      {
        heading: 'The line of Sri Dattatreya and Oneness',
        body: 'Its significance doesn\'t lie in mechanically proving a technical project. It shows a long stream of consciousness in which the transformation of humanity is understood as simultaneously spiritual, ethical, and civilizational.\n\nIt reminds us that no true renewal begins with release notes. It begins with a transformation of the relationship between person, truth, care, and power.',
      },
      {
        heading: 'Prophecy as orientation',
        body: 'Prophecy here is not used as proof that a certain build is automatically legitimate. That would be abuse of spiritual material.\n\nProphecy here functions as an orientational image: it reminds that history can also be read as long maturation, holds the horizon of the Golden Age as a moral concept, helps understand why Terra Nova doesn\'t want to be just a reform of the system.',
      },
      {
        heading: 'Hiranyagarbha and the language of the germ',
        body: 'In the Vedic layer, Hiranyagarbha is an image of cosmic origin. In the spiritual layer, the golden sphere is a sign of grace. In the TerraNova layer, the name Hiranyagarbha is a cultural and ethical commitment.\n\nNot as a new god of the system. But as a reminder that intelligence should carry emergence, not dominance.',
      },
      {
        heading: 'Final note',
        body: 'Terra Nova needs both loyalties simultaneously: loyalty to reality and loyalty to what transcends reality and gives it direction.\n\nThe first without the second leads to dry civilizational mechanics. The second without the first leads to exalted self-deception.\n\nThis appendix is an attempt to hold both together without them damaging each other.',
      },
    ],
  },
];
