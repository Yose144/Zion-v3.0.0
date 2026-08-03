import type { Lang } from '@/contexts/LanguageContext';

const t = {
  /* ─── Navigation ─── */
  nav: {
    mission: { cs: 'Mise', en: 'Mission' },
    stacks:  { cs: 'Vrstvy', en: 'Stacks' },
    knowledge: { cs: 'Znalosti', en: 'Knowledge' },
    home:     { cs: 'Domů', en: 'Home' },
    network:  { cs: 'Síť', en: 'Network' },
    roadmap:  { cs: 'Plán', en: 'Roadmap' },
    download: { cs: 'Stáhnout', en: 'Download' },
    mining:   { cs: 'Těžba & Nód', en: 'Mining & Node' },
    explorer: { cs: 'Průzkumník', en: 'Explorer' },
    genesis:  { cs: 'Genesis', en: 'Genesis' },
    api:      { cs: 'API', en: 'API' },
    docs:     { cs: 'Dokumentace', en: 'Docs' },
    dashboard:  { cs: 'Přehled',  en: 'Dashboard' },
    guardian:   { cs: 'Guardian', en: 'Guardian' },
    warp:       { cs: 'WARP',        en: 'WARP' },
    dao:        { cs: 'DAO',         en: 'DAO' },
    bridge:     { cs: 'Most',        en: 'Bridge' },
    cex:        { cs: 'CEX',         en: 'CEX' },
    cex_listings: { cs: 'CEX listinky', en: 'CEX Listings' },
    pool:       { cs: 'Pool',        en: 'Pool' },
    miner_stats: { cs: 'Statistiky minera', en: 'Miner Stats' },
    benchmarks: { cs: 'Benchmarky', en: 'Benchmarks' },
    news: { cs: 'Novinky', en: 'News' },
    philosophy: { cs: 'Filozofie',   en: 'Philosophy' },
    ai_native:  { cs: 'AI Native',   en: 'AI Native' },
    monitoring: { cs: 'Monitoring',  en: 'Monitoring' },
    defi:       { cs: 'Multichain Hub',    en: 'Multichain Hub' },
    meme_lab:   { cs: 'Meme Lab',    en: 'Meme Lab' },
    kompas:     { cs: 'Zlatý Kompas', en: 'Golden Compass' },
    info_group: { cs: 'Info', en: 'Info' },
    layers_group: { cs: 'Vrstvy', en: 'Layers' },
    wiki_group: { cs: 'Wiki', en: 'Wiki' },
    mission_group: { cs: 'Mise', en: 'Mission' },
    network_group: { cs: 'Síť & Mining', en: 'Network & Mining' },
    operator_group: { cs: 'Operátor', en: 'Operator' },
    defi_group: { cs: 'Multichain', en: 'Multichain' },
    learn_group: { cs: 'Učení', en: 'Learn' },
    l3_hiran:   { cs: 'L3 Hiran', en: 'L3 Hiran' },
    l4_oasis:   { cs: 'L4 Oasis', en: 'L4 Oasis' },
    l5_free_world: { cs: 'L5 Free World', en: 'L5 Free World' },
    l6_issobella: { cs: 'L6 Issobella', en: 'L6 Issobella' },
    terranova:  { cs: 'Terra Nova',   en: 'Terra Nova' },
    whitepapers: { cs: 'Whitepapers', en: 'Whitepapers' },
    tree_of_life: { cs: 'Strom života', en: 'Tree of Life' },
    quantum_revolution: { cs: 'Kvantová Revoluce', en: 'Quantum Revolution' },
    terranova_public: { cs: 'Veřejná edice', en: 'Public edition' },
    terra_garden_genesis: { cs: 'Zahrada Genesis', en: 'Garden of Genesis' },
    terra_dharma_temple: { cs: 'Dharma Temple', en: 'Dharma Temple' },
    resonance: { cs: 'Rezonance', en: 'Resonance' },
    menu_title: { cs: 'Menu ZION', en: 'ZION Menu' },
    mission_control: { cs: 'Mission Control', en: 'Mission Control' },
    wallet: { cs: 'Peněženka', en: 'Wallet' },
    dharma_temple: { cs: 'Dharma Temple', en: 'Dharma Temple' },
    te_piko_ora: { cs: 'Te Pīko Ora', en: 'Te Pīko Ora' },
    l2: { cs: 'L2', en: 'L2' },
    l3: { cs: 'L3', en: 'L3' },
    switch_to_en: { cs: 'Přepnout do angličtiny', en: 'Switch to English' },
    switch_to_cs: { cs: 'Přepnout do češtiny', en: 'Switch to Czech' },
    open_menu: { cs: 'Otevřít menu', en: 'Open menu' },
    close_menu: { cs: 'Zavřít menu', en: 'Close menu' },
    warp_status: { cs: 'WARP status', en: 'WARP status' },
    status_online: { cs: 'Online', en: 'Online' },
    language_toggle_desktop_cs: { cs: '🇨🇿 CS', en: '🇨🇿 CS' },
    language_toggle_desktop_en: { cs: '🇬🇧 EN', en: '🇬🇧 EN' },
    language_toggle_mobile_cs: { cs: '🇨🇿 Česky → English', en: '🇨🇿 Czech → English' },
    language_toggle_mobile_en: { cs: '🇬🇧 English → Česky', en: '🇬🇧 English → Czech' },
  },

  /* ─── Hero ─── */
  hero: {
    badge_version:  { cs: 'V31 Mainnet Alpha · 3.1.0', en: 'V31 Mainnet Alpha · 3.1.0' },
    badge_chv4:     { cs: 'Edge server topologie', en: 'Edge server topology' },
    tagline:        { cs: 'Nativní Rust blockchain s Proof-of-Work konsensem', en: 'Native Rust blockchain with Proof-of-Work consensus' },
    title_sub:      { cs: 'Genesis Live · Edge server · canonical runtime v3.1.0 V31 · 6-decimal flowers', en: 'Genesis Live · Edge server · canonical runtime v3.1.0 V31 · 6-decimal flowers' },
    description:    {
      cs: 'Odpočítávání ke spuštění ZION TerraNova mainnetu — 31. prosince 2026 (Silvestr). Příprava V3 mainnetu v Edge server topologii (Edge server) s veřejným poolem, mining binárkami a provozní telemetrií.',
      en: 'ZION TerraNova mainnet launch countdown — 31 December 2026 (New Year\'s Eve). Preparing the V3 mainnet in Edge server topology (Edge server), with public pool, mining binaries, and operational telemetry.',
    },
    btn_start:      { cs: 'Začít těžit', en: 'Start Mining' },
    btn_docs:       { cs: 'Dokumentace', en: 'Docs' },
    btn_whitepaper: { cs: 'WhitePaper', en: 'WhitePaper' },
    signal_l1:      { cs: 'L1 Jádro', en: 'L1 Core' },
    signal_nodes:   { cs: 'Validátor síť', en: 'Validator Grid' },
    signal_mainnet: { cs: 'Launch Countdown', en: 'Launch Countdown' },
    signal_loc:     { cs: 'Edge server + Edge server · ShareRelay', en: 'Edge server + Edge server · ShareRelay' },
    signal_target:  { cs: '31. prosince 2026', en: '31 December 2026' },
    signal_status_l1: { cs: 'Genesis Launch active · runtime v3.1.0', en: 'Genesis Launch active · runtime v3.1.0' },
    signal_status_nodes: { cs: 'Edge server online', en: 'Edge server online' },
    signal_status_mainnet: { cs: 'Launch Countdown · 31. prosince 2026', en: 'Launch Countdown · 31 December 2026' },
    metric_loc:     { cs: 'Řádků kódu (Rust)', en: 'Rust LOC' },
    metric_nodes:   { cs: 'Nódy Online', en: 'Nodes Online' },
    metric_tests:   { cs: 'Testy úspěšně', en: 'Tests Passing' },
    observatory_label: { cs: 'Režim observatoře', en: 'Observatory mode' },
    section_signals: { cs: 'Signály mise', en: 'Mission signals' },
    btn_warp:          { cs: 'Prozkoumat síť',      en: 'Explore Network' },
    btn_guardian_docs: { cs: 'Otevřít dokumentaci',   en: 'Open Docs' },
    btn_native_miner:  { cs: 'Stáhnout miner',          en: 'Download Miner' },
    teaser_title: { cs: 'Živá Edge server síť', en: 'Live Edge server network' },
    teaser_badge: { cs: 'Aktivní', en: 'Active' },
    teaser_body: {
      cs: 'Síťový stav, explorer, pool, downloady i dokumentace jsou na jednom místě. Homepage slouží jako veřejný vstup do Edge server mainnetu, ne jako oznámení produkčního launch.',
      en: 'Network status, explorer, pool, downloads, and documentation live in one place. The homepage acts as a public entry point into the Edge server mainnet, not as a production launch announcement.',
    },
    teaser_cta: { cs: 'Prozkoumat', en: 'Explore' },
    observatory_focus_label: { cs: 'Zaměření signálu', en: 'Signal focus' },
    observatory_scan_label: { cs: 'Aktuální scanline', en: 'Current scanline' },
    version_pill_rehearsal: { cs: 'Edge server topologie', en: 'Edge server topology' },
    mode_deep_space_label: { cs: 'Hluboký vesmír', en: 'Deep Space' },
    mode_deep_space_desc: { cs: 'Let skrz kosmos', en: 'Flight through the cosmos' },
    mode_deep_space_signal: { cs: 'Lov interstelárních anomálií', en: 'Interstellar anomaly hunting' },
    mode_deep_space_focus: { cs: 'Orchestrace kosmických minerů', en: 'Cosmic miner orchestration' },
    mode_planet_orbit_label: { cs: 'Planetární orbita', en: 'Planet Orbit' },
    mode_planet_orbit_desc: { cs: 'AI / mining paluba', en: 'AI / Mining deck' },
    mode_planet_orbit_signal: { cs: 'Orbitální AI relay + synchronizace poolu', en: 'Orbital AI relay + pool sync' },
    mode_planet_orbit_focus: { cs: 'WARP mosty a likvidita', en: 'WARP bridges & liquidity' },
    mode_galactic_core_label: { cs: 'Povelový nexus', en: 'Command Nexus' },
    mode_galactic_core_desc: { cs: 'Pohled na WARP a DAO', en: 'WARP & DAO view' },
    mode_galactic_core_signal: { cs: 'Komory DAO + rada WARP', en: 'DAO chambers + WARP council' },
    mode_galactic_core_focus: { cs: 'Governance + posvátné účetní knihy', en: 'Governance + sacred ledgers' },
  },

  countdown: {
    title: { cs: 'Launch Countdown — 31. prosince 2026', en: 'Launch Countdown — 31 December 2026' },
    target_date: { cs: 'Target: 31. prosince 2026', en: 'Target: December 31, 2026' },
    subtitle: {
      cs: 'Příprava V3 Mainnet · Edge server topology · Mining test · Bridge v přípravě',
      en: 'Preparing V3 Mainnet · Edge server topology · Mining test · Bridge in preparation',
    },
  },

  goldenEgg: {
    badge: { cs: 'Hiranyagarbha · Golden Egg', en: 'Hiranyagarbha · Golden Egg' },
    signal: { cs: 'L4 symbolika ukotvená v L1', en: 'L4 symbolism grounded in L1' },
    title: { cs: 'Hiranyagarbha —', en: 'Hiranyagarbha —' },
    title_emphasis: {
      cs: 'kosmické vejce, ze kterého vzešel svět.',
      en: 'the cosmic egg from which the world emerged.',
    },
    visual_badge: { cs: 'Ekam vizuální reference', en: 'Ekam visual reference' },
    visual_text: {
      cs: 'Veřejný Ekam motiv dává Golden Egg bloku skutečný vizuální základ místo syntetické dekorace.',
      en: 'A public Ekam visual gives the Golden Egg section a real anchor instead of a synthetic motif.',
    },
    source: { cs: 'Zdroj: Ekam / Oneness', en: 'Source: Ekam / Oneness' },
    lead: {
      cs: 'Ve védské kosmologii je Hiranyagarbha (हिरण्यगर्भ) zlaté vejce, z něhož se rodí vesmír. V architektuře chrámu Ekam dostává tento symbol fyzickou podobu: posvátnou geometrii, rozlehlou bezsloupovou síň a Zlatou kouli na vrcholu kopule.',
      en: 'In Vedic cosmology, Hiranyagarbha (हिरण्यगर्भ) is the golden egg from which the universe is born. In the architecture of the Ekam temple, that symbol takes physical form through sacred geometry, a vast pillarless hall, and the Golden Orb atop the dome.',
    },
    support: {
      cs: 'Tree of Life zůstává níž na stránce jako volitelná interaktivní vrstva. Návštěvník tak nejdřív dostane srozumitelný obraz projektu a až potom si může otevřít hlubší symbolickou scénu.',
      en: 'Tree of Life stays lower on the page as an optional interactive layer. Visitors get a clear project narrative first, and only then a deeper symbolic scene if they want to continue.',
    },
    what_title: { cs: 'Co je Hiranyagarbha', en: 'What is Hiranyagarbha' },
    what_head: {
      cs: 'Zdroj stvoření v Rig Védu',
      en: 'Source of creation in the Rig Veda',
    },
    what_body: {
      cs: 'Hiranyagarbha se poprvé objevuje v Rig Védu (hymnus 10.121) jako zárodek, z něhož se rodí bohové, prostor a čas. Zlatá koule plující v kosmických vodách — obraz počátku všeho.',
      en: 'Hiranyagarbha first appears in the Rig Veda (hymn 10.121) as the seed from which gods, space, and time are born. A golden sphere floating in cosmic waters — the image of the very beginning.',
    },
    ekam_title: { cs: 'Proč právě EKAM', en: 'Why EKAM specifically' },
    ekam_head: {
      cs: 'Chrám, kde se Hiranyagarbha mění v prostor',
      en: 'The temple where Hiranyagarbha becomes space',
    },
    ekam_body: {
      cs: 'Ekam stojí v Indii na platformě 130 × 106 metrů. Uvnitř se skrývá hala bez jediného sloupu s rozpětím 50 m, kopule zakončená Zlatou Koulí (~90 cm) a největší Sri Chakra na světě.',
      en: 'Ekam stands in India on a 130 × 106 m platform. Inside: a 50 m pillarless hall, a dome crowned by the Golden Orb (~90 cm), and the world\'s largest Sri Chakra.',
    },
    card_signal_label: { cs: 'Veřejný signál', en: 'Public signal' },
    card_signal_title: { cs: 'Jasný příběh homepage', en: 'Clear homepage story' },
    card_signal_body: { cs: 'Nejdřív síť, potom symbolika', en: 'Network first, symbolism second' },
    card_visual_label: { cs: 'Vizuální zdroj', en: 'Visual source' },
    card_visual_title: { cs: 'Reference EKAM', en: 'Ekam reference' },
    card_visual_body: { cs: 'Teplé, ukotvené, rozpoznatelné', en: 'Warm, grounded, recognisable' },
    card_perf_label: { cs: 'Výkon', en: 'Performance' },
    card_perf_title: { cs: 'Rychlé jako výchozí stav', en: 'Fast by default' },
    card_perf_body: { cs: 'Bez vynuceného těžkého renderu', en: 'No forced heavy render' },
    path_badge: { cs: 'Od symbolu k digitálnímu prostoru', en: 'From symbol to digital space' },
    path_symbol: { cs: '1. Symbol', en: '1. Symbol' },
    path_symbol_body: {
      cs: 'Hiranyagarbha jako golden egg, source of creation, kosmický začátek.',
      en: 'Hiranyagarbha as the golden egg, source of creation, and the first cosmic threshold.',
    },
    path_sanctuary: { cs: '2. Sanctuary', en: '2. Sanctuary' },
    path_sanctuary_body: {
      cs: 'EKAM jako fyzické místo, kde tenhle motiv dostává architekturu, ticho a směr.',
      en: 'EKAM as the physical setting where the motif gains architecture, silence, and direction.',
    },
    path_museum: { cs: '3. Museum path', en: '3. Museum path' },
    path_museum_body: {
      cs: 'Dlouhodobě z toho může vzniknout lehká webová cesta Big Bang → life → consciousness → EKAM, ale až mimo první homepage render.',
      en: 'Over time this can evolve into a lightweight web path Big Bang → life → consciousness → EKAM, but only outside the first homepage render.',
    },
    mini_label: { cs: 'Lehký muzeální směr', en: 'Light museum direction' },
    mini_bigbang: { cs: 'Big Bang', en: 'Big Bang' },
    mini_bigbang_desc: { cs: 'Vznik prostoru a času', en: 'The emergence of space and time' },
    mini_life: { cs: 'Life', en: 'Life' },
    mini_life_desc: { cs: 'Biologie, Země, evoluce', en: 'Biology, Earth, and evolution' },
    mini_consciousness: { cs: 'Consciousness', en: 'Consciousness' },
    mini_consciousness_desc: { cs: 'Mysl, vnímání, vědomí', en: 'Mind, perception, and awareness' },
    mini_ekam: { cs: 'EKAM', en: 'EKAM' },
    mini_ekam_desc: { cs: 'Chrámová komnata symbolu', en: 'The temple chamber of the symbol' },
    mini_caption: {
      cs: 'Tohle není aktivní 3D scéna. Je to lehké obsahové schéma, které ukazuje dlouhodobý narativ od kosmického vzniku po chrámový symbol.',
      en: 'This is not an active 3D scene. It is a lightweight content schematic that shows the long arc from cosmic origin to the temple symbol.',
    },
    cta_tree: { cs: 'Otevřít Tree of Life', en: 'Open Tree of Life' },
    cta_network: { cs: 'Prozkoumat živou síť', en: 'Explore the live network' },
    cta_museum: { cs: 'Otevřít virtuální cestu Ekamem', en: 'Open the Ekam virtual journey' },
    tour_badge: { cs: 'Virtuální prohlídka', en: 'Virtual tour' },
    tour_title: { cs: 'Prozkoumat chrám Ekam', en: 'Explore the Ekam temple' },
    tour_body: {
      cs: 'Posvátná architektura, geometrie Surya Yantra, největší Sri Chakra na světě a obřad Deeksha — vše na jedné stránce.',
      en: 'Sacred architecture, Surya Yantra geometry, the largest Sri Chakra in the world, and the Deeksha ceremony — all on one page.',
    },
    featured_label: { cs: 'Nově zvýrazněno', en: 'Now featured' },
    featured_title: { cs: 'Ekam Deeksha — úplná kniha', en: 'Ekam Deeksha — complete book' },
    featured_body: {
      cs: 'Kompletní vydání je přímo v dokumentaci a tvoří hlavní most mezi filozofickou vrstvou a runtime řadou v2.9.x.',
      en: 'The complete edition now lives directly in docs and serves as the main bridge between the philosophical layer and the v2.9.x runtime line.',
    },
    featured_cta: { cs: 'Otevřít knihu', en: 'Open book' },
    book_card_label: { cs: 'Kniha Ekam Deeksha', en: 'Ekam Deeksha book' },
    book_card_body: { cs: 'Plná verze (CZ + EN) v dokumentaci', en: 'Full version (CZ + EN) in docs' },
    landing_kicker: { cs: 'Navazující směr', en: 'Next direction' },
    landing_title: { cs: 'Ekam a webové muzeum kosmologie', en: 'Ekam and a web-native museum of cosmology' },
    landing_body: {
      cs: 'Navazující stránka rozvíjí to, co homepage jen naznačuje: jak propojit kosmický vznik, život, vědomí a EKAM do lehké webové zkušenosti bez toho, aby se první načtení homepage rozpadlo výkonově.',
      en: 'The follow-up page develops what the homepage only hints at: how cosmic origin, life, consciousness, and EKAM could become a lightweight web experience without compromising the first homepage render.',
    },
  },

  ekamPage: {
    badge: { cs: 'EKAM · Cesta chrámem', en: 'EKAM · Journey Through the Temple' },
    title: { cs: 'Ekam — chrám vědomí a Zlaté koule', en: 'Ekam — the Temple of Consciousness and the Golden Orb' },
    subtitle: {
      cs: 'Ekam je zasvěcený prostor vědomí, kde se propojují kosmologie, architektura a praxe Deeksha. Tahle stránka nabízí klidnou virtuální cestu jeho prostorem, symbolikou a rodinnou linií.',
      en: 'Ekam is a consecrated space of consciousness where cosmology, architecture, and the practice of Deeksha converge. This page offers a calm virtual journey through its space, symbolism, and family lineage.',
    },
    /* ── Architecture ── */
    arch_label: { cs: 'Posvátná architektura', en: 'Sacred architecture' },
    arch_title: { cs: 'Stavba nad běžným měřítkem', en: 'A structure beyond ordinary scale' },
    arch_subtitle: {
      cs: 'Ekam stojí na platformě 130 × 106 metrů, dosahuje výšky 32,85 m a jeho hlavní síň překonává rozpětí 50 metrů bez jediného sloupu. Celou stavbu obkružuje vodní příkop připomínající kosmický oceán.',
      en: 'Ekam stands on a 130 × 106 m platform, rises to 32.85 m, and its main hall spans 50 metres without a single pillar. The whole structure is encircled by a water moat evoking the cosmic ocean.',
    },
    arch_platform_title: { cs: 'Platforma 130 × 106 m', en: '130 × 106 m platform' },
    arch_platform_body: { cs: 'Jednoúrovňové základy orientované podle Vastu Purusha Mandaly.', en: 'Single-level foundations aligned to the Vastu Purusha Mandala.' },
    arch_hall_title: { cs: 'Bezsloupová síň 50 m', en: '50 m pillarless hall' },
    arch_hall_body: { cs: 'Hlavní meditační prostor pro až 8 000 lidí, překlenutý jedinou konstrukcí bez vnitřních sloupů.', en: 'The main meditation hall for up to 8,000 people, spanned by a single structure without internal columns.' },
    arch_floors_title: { cs: '3 podlaží · 8 schodišť', en: '3 floors · 8 staircases' },
    arch_floors_body: { cs: 'Osm oktagonálních schodišť v rozích stavby vytváří symbolickou cestu od pozemského k duchovnímu.', en: 'Eight octagonal staircases at the corners of the structure create a symbolic path from the earthly to the spiritual.' },
    arch_moat_title: { cs: 'Vodní příkop', en: 'Water moat' },
    arch_moat_body: { cs: 'Tok vody kolem celé stavby připomíná pradávný kosmický oceán a odděluje posvátný prostor.', en: 'Water flowing around the structure recalls the primordial cosmic ocean and separates sacred space.' },
    /* ── Sacred geometry ── */
    geo_label: { cs: 'Posvátná geometrie', en: 'Sacred geometry' },
    geo_title: { cs: 'Geometrie zakódovaná v každém detailu', en: 'Geometry encoded in every detail' },
    geo_subtitle: {
      cs: 'Ekam vkládá starověké geometrické systémy do současné architektury: 3D Surya Yantru, největší Sri Chakru na světě, Zlatý řez i Vastu Purusha Mandalu.',
      en: 'Ekam brings ancient geometric systems into contemporary architecture: the 3D Surya Yantra, the world\'s largest Sri Chakra, the Golden Ratio, and the Vastu Purusha Mandala.',
    },
    geo_yantra_title: { cs: '3D Surya Yantra Mandala', en: '3D Surya Yantra Mandala' },
    geo_yantra_body: { cs: 'Solární mandala fyzicky vtělená do struktury chrámu — trojrozměrný sakrální vzor.', en: 'A solar mandala physically embodied in the temple structure — a three-dimensional sacred pattern.' },
    geo_chakra_title: { cs: 'Sri Chakra', en: 'Sri Chakra' },
    geo_chakra_body: { cs: 'Největší Sri Chakra na světě. Devět vzájemně propojených trojúhelníků symbolizujících kosmos a lidské tělo.', en: 'The world\'s largest Sri Chakra. Nine interlocking triangles symbolising the cosmos and the human body.' },
    geo_golden_title: { cs: 'Zlatý řez (φ)', en: 'Golden Ratio (φ)' },
    geo_golden_body: { cs: 'Poměr 1:1.618 prochází proporcemi chrámu — od hlavní haly po špičku kopule.', en: 'The 1:1.618 ratio runs through the temple proportions — from the main hall to the dome spire.' },
    geo_vastu_title: { cs: 'Vastu Purusha Mandala', en: 'Vastu Purusha Mandala' },
    geo_vastu_body: { cs: 'Prastaré indické architektonické schéma orientující stavbu podle kosmických os.', en: 'An ancient Indian architectural schema orienting the structure along cosmic axes.' },
    /* ── Deeksha ── */
    deeksha_label: { cs: 'Deeksha', en: 'Deeksha' },
    deeksha_title: { cs: 'Deeksha — přenos probuzeného vědomí', en: 'Deeksha — the transmission of awakened consciousness' },
    deeksha_body: {
      cs: 'Deeksha (dīkṣā) je forma duchovního zasvěcení předávaná od učitele k přijímajícímu. V tradici Ekamu a Oneness se chápe jako přenos, který otevírá hlubší klid, vnímavost a vyšší stavy vědomí.',
      en: 'Deeksha (dīkṣā) is a form of spiritual initiation passed from teacher to recipient. In the Ekam and Oneness tradition it is understood as a transmission that opens deeper peace, receptivity, and higher states of consciousness.',
    },
    deeksha_sparsha_label: { cs: 'Sparsha Deeksha', en: 'Sparsha Deeksha' },
    deeksha_sparsha_title: { cs: 'Přímý dotek', en: 'Direct touch' },
    deeksha_sparsha_body: { cs: 'Energie je přenášena přímým položením rukou na hlavu přijímajícího. Nejstarší a nejintenzivnější forma.', en: 'Energy is transmitted by placing hands directly on the receiver\'s head. The oldest and most intense form.' },
    deeksha_smarana_label: { cs: 'Smarana Deeksha', en: 'Smarana Deeksha' },
    deeksha_smarana_title: { cs: 'Na dálku', en: 'At a distance' },
    deeksha_smarana_body: { cs: 'Přenos soustředěným záměrem bez fyzického kontaktu — meditující přijímá Deekshu i na velkou vzdálenost.', en: 'Transmission through focused intent without physical contact — the meditator receives Deeksha even across a great distance.' },
    /* ── Visitor path (halls) ── */
    hall_title: { cs: 'Cesta chrámem', en: 'Path through the temple' },
    hall_subtitle: {
      cs: 'Od kosmického počátku až k chrámu vědomí: čtyři zastavení, kterými návštěvník prochází při cestě Ekamem.',
      en: 'From cosmic origin to the temple of consciousness: four stations that shape the visitor\'s path through Ekam.',
    },
    hall_1_title: { cs: 'Big Bang', en: 'Big Bang' },
    hall_1_body: { cs: 'Vznik prostoru, času a prvotní energie — kosmický práh celé cesty.', en: 'The emergence of space, time, and primordial energy — the cosmic threshold of the journey.' },
    hall_2_title: { cs: 'Life', en: 'Life' },
    hall_2_body: { cs: 'Země, biologie, evoluce — jak z prvotní energie vzniká život a komplexita.', en: 'Earth, biology, evolution — how primordial energy gives rise to life and complexity.' },
    hall_3_title: { cs: 'Consciousness', en: 'Consciousness' },
    hall_3_body: { cs: 'Mysl, vnímání, neurobiologie vědomí — na prahu Deekshy a probouzení.', en: 'Mind, perception, the neurobiology of consciousness — on the threshold of Deeksha and awakening.' },
    hall_4_title: { cs: 'EKAM', en: 'EKAM' },
    hall_4_body: { cs: 'Chrámový prostor se Zlatou Koulí (Hiranyagarbha) — finální komnata, kde se symbol stává prožitkem.', en: 'The temple space with the Golden Orb (Hiranyagarbha) — the final chamber where symbol becomes experience.' },
    /* ── CTAs ── */
    cta_home: { cs: 'Zpět na úvod', en: 'Back to home' },
    cta_tree: { cs: 'Otevřít Tree of Life', en: 'Open Tree of Life' },
    cta_source: { cs: 'Zdroj: Oneness / Ekam', en: 'Source: Oneness / Ekam' },
    /* ── Founders / Family lineage ── */
    founders_label: { cs: 'Zakladatelská linie', en: 'Founding lineage' },
    founders_title: { cs: 'Rodina, která stojí za Ekamem', en: 'The family behind Ekam' },
    founders_subtitle: {
      cs: 'Za Ekamem stojí rodina duchovních učitelů, která rozšířila praxi Deeksha do světa. Dnes na tomto odkazu staví další generace — Sri Preethaji, Sri Krishnaji a jejich dcera Lokaa.',
      en: 'Ekam is rooted in a family of spiritual teachers who carried the practice of Deeksha into the wider world. Today that work continues through the next generation — Sri Preethaji, Sri Krishnaji, and their daughter Lokaa.',
    },
    founders_amma_title: { cs: 'Sri Amma (Padmavathi)', en: 'Sri Amma (Padmavathi)' },
    founders_amma_body: { cs: 'Spoluzakladatelka hnutí Oneness. V tradici Oneness představuje mateřský princip a je spojována s linií Padmavathi.', en: 'Co-founder of the Oneness movement. Within the Oneness tradition she represents the maternal principle and is associated with the lineage of Padmavathi.' },
    founders_bhagavan_title: { cs: 'Sri Bhagavan (Vijay Kumar)', en: 'Sri Bhagavan (Vijay Kumar)' },
    founders_bhagavan_body: { cs: 'Zakladatel Oneness a hlavní vizionář Jeevashramu, Satyaloky i chrámu Ekam. Svou práci zasvětil probuzení lidského vědomí.', en: 'Founder of Oneness and the principal visionary behind Jeevashram, Satyaloka, and the Ekam temple. He devoted his work to the awakening of human consciousness.' },
    founders_krishnaji_title: { cs: 'Sri Krishnaji (NKV Krishna)', en: 'Sri Krishnaji (NKV Krishna)' },
    founders_krishnaji_body: { cs: 'Syn Sri Ammy a Sri Bhagavana. Osvícený učitel a spolutvůrce současné podoby Oneness, vede Tapas a další programy v Ekamu.', en: 'Son of Sri Amma and Sri Bhagavan. An enlightened teacher and co-creator of the present expression of Oneness, he leads Tapas and other programmes at Ekam.' },
    founders_preethaji_title: { cs: 'Sri Preethaji (Preetha Krishna)', en: 'Sri Preethaji (Preetha Krishna)' },
    founders_preethaji_body: { cs: 'Filozofka, autorka a spoluzakladatelka Oneness. Vede Field of Awakening po celém světě a je spoluautorkou knihy The Four Sacred Secrets.', en: 'Philosopher, author, and co-founder of Oneness. She leads Field of Awakening around the world and co-authored The Four Sacred Secrets.' },
    founders_lokaa_title: { cs: 'Lokaa', en: 'Lokaa' },
    founders_lokaa_body: { cs: 'Dcera Sri Preethaji a Sri Krishnaji. Představuje další generaci rodiny a podílí se i na službě komunitám v okolí Ekamu.', en: 'Daughter of Sri Preethaji and Sri Krishnaji. She represents the next generation of the family and is also involved in service to the communities around Ekam.' },
    founders_quote: {
      cs: '„Každý den strávený v utrpení je promarněný den; každý den prožitý v krásném stavu je skutečně prožitý život."',
      en: '"For every day spent in suffering is a wasted day; every day lived in a beautiful state is life truly lived."',
    },
    founders_quote_author: { cs: '— Sri Preethaji & Sri Krishnaji', en: '— Sri Preethaji & Sri Krishnaji' },
    founders_banner_label: { cs: 'Zakladatelé Ekamu', en: 'Ekam founders' },
    founders_banner_caption: { cs: 'Sri Amma & Sri Bhagavan', en: 'Sri Amma & Sri Bhagavan' },
    /* ── Virtual Tour embed ── */
    tour_section_label: { cs: 'Virtuální prohlídka', en: 'Virtual tour' },
    tour_section_title: { cs: 'Nahlédněte dovnitř Ekamu', en: 'Look inside Ekam' },
    tour_section_subtitle: {
      cs: 'Ekam stojí na návrší poblíž Východních Ghátů, asi 73 km od Chennai. Bílý mramor, bezsloupová meditační hala pro 8 000 lidí a Zlatá koule na vrcholu kopule dávají chrámu jeho nezaměnitelný výraz.',
      en: 'Ekam stands on elevated ground near the Eastern Ghats, about 73 km from Chennai. White marble, a pillarless meditation hall for 8,000 people, and the Golden Orb atop the dome give the temple its unmistakable presence.',
    },
    tour_fact_cost: { cs: 'Stavební náklady: $75 milionů', en: 'Construction cost: $75 million' },
    tour_fact_inaugurated: { cs: 'Veřejně otevřeno: 2008', en: 'Opened to the public: 2008' },
    tour_fact_architect: { cs: 'Architekt: Prabhat Poddar (Auroville)', en: 'Architect: Prabhat Poddar (Auroville)' },
    tour_fact_location: { cs: 'Varadaiahpalem, Andhra Pradesh, Indie', en: 'Varadaiahpalem, Andhra Pradesh, India' },
    tour_nordic_title: { cs: 'Oneness Nordic — evropské centrum', en: 'Oneness Nordic — European centre' },
    tour_nordic_body: {
      cs: 'Bývalý buddhistický klášter v jižním Švédsku, nyní evropské centrum Oneness. Zasvěcený prostor obklopený dubovým a bukovým lesem Skåne.',
      en: 'A former Buddhist monastery in southern Sweden, now the European Oneness centre. A consecrated space surrounded by the oak and beech forest of Skåne.',
    },
    tour_gallery_ekam_label: { cs: 'Ekam', en: 'Ekam' },
    tour_gallery_ekam_caption: { cs: 'Varadaiahpalem, Andhra Pradesh', en: 'Varadaiahpalem, Andhra Pradesh' },
    tour_gallery_turiya_label: { cs: 'Turiya', en: 'Turiya' },
    tour_gallery_turiya_caption: { cs: 'Posvátný meditační prostor', en: 'Sacred meditation space' },
    tour_gallery_nordic_label: { cs: 'Nordic', en: 'Nordic' },
    tour_gallery_nordic_caption: { cs: 'Evropské centrum ve Švédsku', en: 'European centre in Sweden' },
    tour_cta_youtube: { cs: 'Otevřít YouTube kanál Oneness', en: 'Open the Oneness YouTube channel' },
    tour_cta_website: { cs: 'Otevřít oficiální web Oneness', en: 'Open the official Oneness website' },
  },

  /* ─── Features ─── */
  features: {
    heading: { cs: 'Vrstvy protokolu', en: 'Protocol Layers' },
    subheading: {
      cs: 'Šestisložková architektura: L1 Rust jádro, L2 Multichain (Bridge · DAO · DEX), L3 AI Native · WARP · NCL, L4 Oasis, L5 Free World, L6 Issobella.',
      en: 'Six-layer architecture: L1 Rust core, L2 Multichain (Bridge · DAO · DEX), L3 AI Native · WARP · NCL, L4 Oasis, L5 Free World, L6 Issobella.',
    },
    tracks: {
      chv3: {
        title: { cs: 'Cosmic Harmony PoW', en: 'Cosmic Harmony PoW' },
        desc:  {
          cs: 'CHv3 — 4fázový algoritmus: Quantum Seed, Galactic Matrix (2MB AES-NI scratchpad), Stellar Harmony, Cosmic Proof. ASIC-rezistentní.',
          en: 'CHv3 — 4-phase algorithm: Quantum Seed, Galactic Matrix (2MB AES-NI scratchpad), Stellar Harmony, Cosmic Proof. ASIC-resistant.',
        },
        badge: { cs: 'L1 Jádro', en: 'L1 Core' },
      },
      miner: {
        title: { cs: 'Nativní těžařská flotila', en: 'Native Miner Fleet' },
        desc:  {
          cs: 'Rust kompilované těžaře pro Linux (x86_64), Windows a macOS (ARM64) se stratum-v2 pool protokolem.',
          en: 'Rust-compiled miners for Linux (x86_64), Windows, and macOS (ARM64) with stratum-v2 pool protocol.',
        },
        badge: { cs: 'MainNet · Živý', en: 'MainNet · Live' },
      },
      dao: {
        title: { cs: 'DAO Správa', en: 'DAO Governance' },
        desc:  {
          cs: 'L2 governance vrstva pro správu treasury, bridge politik a komunitních návrhů nad ekonomickou a validační infrastrukturou.',
          en: 'L2 governance layer for treasury control, bridge policy, and community proposals over the economic and validation rails.',
        },
        badge: { cs: 'L2 · Governance', en: 'L2 · Governance' },
      },
      ai_native: {
        title: { cs: 'AI Native · Hiranyagarbha', en: 'AI Native · Hiranyagarbha' },
        desc:  {
          cs: 'L3 orchestrace agenta: Hiranyagarbha runtime, RAG paměť, tasky, NCL compute lane a napojení na WARP relay.',
          en: 'L3 agent orchestration: Hiranyagarbha runtime, RAG memory, task execution, the NCL compute lane, and WARP relay integration.',
        },
        badge: { cs: 'L3 · AI Runtime', en: 'L3 · AI Runtime' },
      },
      warp: {
        title: { cs: 'WARP Mosty', en: 'WARP Bridges' },
        desc:  {
          cs: 'L3 meziřetězcové relaye a HTLC mosty pro ETH, SOL a další sítě, řízené nad AI Native a DAO guard rails.',
          en: 'L3 cross-chain relays and HTLC bridges for ETH, SOL, and other networks, operated above AI Native and DAO guard rails.',
        },
        badge: { cs: 'L3 · 2027+', en: 'L3 · 2027+' },
      },
      p2p: {
        title: { cs: 'P2P síť', en: 'P2P Network' },
        desc:  {
          cs: 'P2P peer discovery, propagace bloků a synchronizace mempolu přes Edge server topologii (Edge server) se ShareRelay protokolem.',
          en: 'P2P peer discovery, block propagation, and mempool sync across the Edge server topology (Edge server) using the ShareRelay protocol.',
        },
        badge: { cs: 'Živý', en: 'Live' },
      },
      explorer: {
        title: { cs: 'Průzkumník blockchainu', en: 'Block Explorer' },
        desc:  {
          cs: 'Real-time průzkumník bloků, transakcí a adres s live telemetrickým dashboardem a REST API.',
          en: 'Real-time block, transaction, and address explorer with live telemetry dashboard and REST API.',
        },
        badge: { cs: 'Živý', en: 'Live' },
      },
    },
    timeline: {
      ph1: {
        phase: { cs: 'Fáze 1 · Nyní', en: 'Phase 1 · Now' },
        detail: {
          cs: 'Edge server mainnet — Rust pool, Cosmic Harmony těžba, P2P sync. 92 % dokončeno.',
          en: 'Edge server mainnet — Rust pool, Cosmic Harmony mining, P2P sync. 92 % done.',
        },
      },
      ph2: {
        phase: { cs: 'Fáze 2–3 · Q2–Q3 2026', en: 'Phase 2–3 · Q2–Q3 2026' },
        detail: {
          cs: 'Nódy UX, peněženka CLI/GUI, infrastruktura, bezp. audity, legal.',
          en: 'Node UX, wallet CLI/GUI, infrastructure, security audits, legal.',
        },
      },
      ph3: {
        phase: { cs: 'Veřejný launch · 31. 12. 2026', en: 'Public launch · 31 Dec 2026' },
        detail: {
          cs: 'MainNet Genesis 11. 6. 2026 dokončen. Veřejný launch pro všechny 31. 12. 2026.',
          en: 'MainNet Genesis 11 Jun 2026 complete. Public launch for everyone 31 Dec 2026.',
        },
      },
    },
    upgrade_heading: { cs: 'Vývoj upgradu · Timeline', en: 'Upgrade development · Timeline' },
    community_cta: {
      cs: 'DAO governance patří do L2 a nad ní roste L3 vrstva AI Native, NCL a WARP. Přidej se k diskuzi na GitHub’u a navrhuj funkce, guard rails nebo upgrady protokolu.',
      en: 'DAO governance belongs in L2, with the L3 AI Native, NCL, and WARP layer rising above it. Join the discussion on GitHub and propose features, guard rails, or protocol upgrades.',
    },
  },

  /* ─── CHv4 Upgrade section ─── */
  chv4: {
    badge:     { cs: 'Vývoj · Q2 2026', en: 'In development · Q2 2026' },
    heading:   { cs: 'Cosmic Harmony v4', en: 'Cosmic Harmony v4' },
    subheading: {
      cs: '4-fázový PoW algoritmus — Neural Bloom fáze přidává 8-kolové Feistel perceptrony a zdvojený scratchpad 4 MB.',
      en: '4-phase PoW algorithm — Neural Bloom phase adds 8-round Feistel perceptron and doubled 4 MB scratchpad.',
    },
    stable:    { cs: 'stabilní', en: 'stable' },
    upgraded:  { cs: 'upgradováno', en: 'upgraded' },
    new_badge: { cs: 'NOVÉ', en: 'NEW' },
    incoming:  { cs: 'příchozí', en: 'incoming' },
    timeline_label: { cs: 'Vývojový progress', en: 'Development progress' },
    timeline_target: { cs: 'Cíl: Q2 2026', en: 'Target: Q2 2026' },
    fork_title: { cs: 'Hard Fork aktivace', en: 'Hard Fork activation' },
    fork_desc: {
      cs: 'CHv4 vyžaduje hard fork. Community announcement min. 4 týdny před aktivací. Difficulty se automaticky přizpůsobí přes LWMA.',
      en: 'CHv4 requires a hard fork. Community announcement min. 4 weeks before activation. Difficulty auto-adjusts via LWMA.',
    },
    features: {
      memory:  { cs: 'Paměť 4 MB — DDR5 bandwidth limited', en: '4 MB memory — DDR5 bandwidth limited' },
      feistel: { cs: '8-kolo Feistel perceptron mix', en: '8-round Feistel perceptron mix' },
      asic:    { cs: 'Anti-ASIC bariéra — iregulární výpočetní graf', en: 'Anti-ASIC barrier — irregular compute graph' },
      gpu:     { cs: 'GPU-optimální: 32-wide warp per bloom round', en: 'GPU-optimal: 32-wide warp per bloom round' },
    },
  },

  /* ─── Docs ─── */
  docs: {
    title:         { cs: 'ZION DOKUMENTACE', en: 'ZION DOCUMENTATION' },
    subtitle:      { cs: 'Kompletní průvodci, API reference & architektura protokolu', en: 'Complete guides, API reference & protocol architecture' },
    resources_tab: { cs: 'Zdroje', en: 'Resources' },
    history_tab:   { cs: 'Historie', en: 'History' },
    not_available: {
      cs: '# Dokument není dostupný\n\nTento dokument ještě nebyl přeložen.',
      en: '# Document Not Available\n\nThis document is not yet translated.',
    },
  },

  /* ─── Docs rail (homepage section) ─── */
  docsRail: {
    nav_kicker: { cs: 'Navigace', en: 'Navigation' },
    headline_open: { cs: 'Otevři ', en: 'Open the ' },
    headline_gradient: {
      cs: 'aktuální dokumentaci, nástroje a zdroje',
      en: 'current docs, tools, and sources',
    },
    blurb: {
      cs: 'Veškerý provozní kontext Edge server mainnetu na jedné ose — dokumentace, mining nástroje, explorer i zdrojový kód.',
      en: 'Operational context for the Edge server mainnet in one spine — docs, mining tools, explorer, and source.',
    },
    card_open: { cs: 'Otevřít', en: 'Open' },
    res_docs_title: { cs: 'Aktuální dokumentace', en: 'Current docs' },
    res_docs_body: {
      cs: 'Otevře /docs s live přehledem Edge server topologie, maticí verzí 2.9.6 / 2.9.8 / 2.9.9 a launch blokery.',
      en: 'Opens /docs with the Edge server topology snapshot, versions 2.9.6 / 2.9.8 / 2.9.9, and launch blockers.',
    },
    res_download_title: { cs: 'Stáhnout minera', en: 'Miner downloads' },
    res_download_body: {
      cs: 'Nativní Rust binárky minera pro macOS, Linux a Windows s Cosmic Harmony.',
      en: 'Native Rust miner binaries for macOS, Linux, and Windows with Cosmic Harmony.',
    },
    res_explorer_title: { cs: 'Průzkumník blockchainu', en: 'Block explorer' },
    res_explorer_body: {
      cs: 'Projdi bloky, transakce, adresy a mempool v reálném čase.',
      en: 'Browse blocks, transactions, addresses, and the mempool in real time.',
    },
    cta_roadmap_title: { cs: 'Roadmap → veřejná launch gate', en: 'Roadmap → Public Launch Gate' },
    cta_roadmap_body: {
      cs: 'Osa od veřejné linie 2.9.9 a kanonického runtime 2.9.8 k closure hlášení a řazení launch kroků.',
      en: 'Thread from the 2.9.9 public line and 2.9.8 canonical runtime through closure reports and launch sequencing.',
    },
    cta_github_title: { cs: 'GitHub / Zion', en: 'GitHub / Zion' },
    cta_github_body: {
      cs: 'Mono-repo — core, minery, pool, dashboardy, dokumentace a deploy.',
      en: 'Mono-repo — core, miners, pool, dashboards, docs, and deployments.',
    },
  },

  /* ─── Whitepapers ─── */
  whitepapers: {
    hero_kicker: { cs: 'Dokumentace', en: 'Documentation' },
    hero_title: { cs: 'ZION Whitepapers', en: 'ZION Whitepapers' },
    hero_subtitle: {
      cs: 'Kanonická whitepaper dokumentace pro ZION TerraNova v3 — Mainnet Alpha 3.1.',
      en: 'Canonical whitepaper documentation for ZION TerraNova v3 — Mainnet Alpha 3.1.',
    },
    hero_description: {
      cs: 'Všechny dokumenty jsou veřejné, MIT licencované a verifikovatelné. README níže vysvětluje, jak jednotlivé whitepapery číst — od Zlaté knihy přes technickou referenci až po Knihu Zrození a WpStory6.',
      en: 'All documents are public, MIT licensed, and verifiable. The README below explains how to read each whitepaper — from the Golden Book through the technical reference to the Book of Genesis and WpStory6.',
    },
    source_button: { cs: 'Zdrojové soubory na GitHub', en: 'Source files on GitHub' },
    download_pdf: { cs: 'Stáhnout PDF', en: 'Download PDF' },
    pdf_notice: {
      cs: 'Tento dokument je dostupný jako PDF. Klikni na tlačítko výše pro stažení nebo otevření.',
      en: 'This document is available as a PDF. Click the button above to download or open it.',
    },
    not_available_title: { cs: '# Dokument není dostupný', en: '# Document Not Available' },
    not_available_body: {
      cs: 'momentálně není k dispozici.',
      en: 'is currently not available.',
    },
  },

  /* ─── Onboard ─── */
  onboard: {
    hero_kicker: { cs: 'Začni', en: 'Get Started' },
    hero_title: { cs: 'Onboard to ZION', en: 'Onboard to ZION' },
    hero_subtitle: {
      cs: 'Peněženka, nód, těžba, bridge a první DApp — krok za krokem.',
      en: 'Wallet, node, mining, bridge, and your first DApp — step by step.',
    },
    hero_description: {
      cs: 'Všechny návody jsou otevřené, praktické a MIT licencované. Vyber si kategorii vlevo a začni stavět na ZION TerraNova.',
      en: 'All guides are open, practical, and MIT licensed. Pick a category on the left and start building on ZION TerraNova.',
    },
    source_button: { cs: 'Zdrojové soubory na GitHub', en: 'Source files on GitHub' },
    download_pdf: { cs: 'Stáhnout PDF', en: 'Download PDF' },
    pdf_notice: {
      cs: 'Tento dokument je dostupný jako PDF. Klikni na tlačítko výše pro stažení nebo otevření.',
      en: 'This document is available as a PDF. Click the button above to download or open it.',
    },
    not_available_title: { cs: '# Dokument není dostupný', en: '# Document Not Available' },
    not_available_body: {
      cs: 'momentálně není k dispozici.',
      en: 'is currently not available.',
    },
  },

  notFound: {
    eyebrow: { cs: 'Ztracený signál', en: 'Signal lost' },
    title_hint: { cs: 'Stránka nenalezena', en: 'Page not found' },
    description: {
      cs: 'Tato URL v aktuálním routování neexistuje nebo se změnila.',
      en: 'This route is unknown or may have moved in the routing table.',
    },
    btn_home: { cs: 'Hlavní stránka', en: 'Home' },
    btn_docs: { cs: 'Dokumentace', en: 'Docs' },
    btn_explorer: { cs: 'Explorer', en: 'Explorer' },
    btn_github: { cs: 'Zdrojový kód', en: 'Source' },
    btn_back_hint: { cs: 'Zpět v historii', en: 'Go back in history' },
    btn_dashboard: { cs: 'Přehled (dashboard)', en: 'Dashboard' },
    quick_roadmap: { cs: 'Roadmap', en: 'Roadmap' },
    quick_download: { cs: 'Stažení', en: 'Download' },
    quick_docs: { cs: 'Dokumentace', en: 'Docs' },
    quick_network: { cs: 'Síť', en: 'Network' },
  },

  globalRouteError: {
    title: { cs: 'Aplikace narazila na chybu', en: 'Something went wrong' },
    paragraph: {
      cs: 'Při vykreslení části stránky nastala chyba — zkuste obnovit nebo vyřadit rozšíření prohlížeče.',
      en: 'This slice failed to render — try reloading or disabling browser extensions temporarily.',
    },
    retry: { cs: 'Zkusit znovu', en: 'Try again' },
    reload: { cs: 'Obnovit stránku', en: 'Reload page' },
    footer_hint: {
      cs: 'Pokud se chyba opakuje, proveď tvrdé obnovení bez cache.',
      en: 'If it keeps repeating, hard-reload without cache.',
    },
  },

  /* ─── Footer ─── */
  footer: {
    group_info: { cs: 'Info', en: 'Info' },
    group_layers: { cs: 'Vrstvy', en: 'Layers' },
    group_wiki: { cs: 'Wiki', en: 'Wiki' },
    whitepaper: { cs: 'Whitepaper', en: 'Whitepaper' },
    downloads: { cs: 'Downloady', en: 'Downloads' },
    tagline: {
      cs: 'Blockchain první generace. Nativní Rust těžba. Vědomá architektura.',
      en: 'First generation blockchain. Native Rust mining. Conscious architecture.',
    },
    disclaimer: {
      cs: 'ZION je experimentální open-source protokol. Nejde o investiční produkt a neposkytuje žádné záruky. Používáš jej na vlastní riziko. Tokeny ZION vznikají těžbou pomocí Proof of Work, nejsou prodávány žádným emitentem. Nic na tomto webu nepředstavuje finanční, investiční ani právní poradenství.',
      en: 'ZION is an experimental open-source protocol. It is not an investment product and carries no guarantees. Use it at your own risk. ZION tokens are mined through Proof of Work and are not sold by any issuer. Nothing published here constitutes financial, investment, or legal advice.',
    },
    legal_suffix: { cs: 'Úplné podmínky najdeš v', en: 'See' },
    legal_suffix_tail: { cs: '.', en: 'for full terms.' },
    legal_disclaimer: { cs: 'Právní upozornění', en: 'Legal Disclaimer' },
    test_mainnet_active: { cs: 'Test mainnet aktivní', en: 'Test Mainnet Active' },
  },
} as const;

type DeepRecord = typeof t;

/** Get a translated string for a given lang. */
export function tr<
  S extends keyof DeepRecord,
  K extends keyof DeepRecord[S],
>(section: S, key: K, lang: Lang): string {
  const entry = t[section][key] as { cs: string; en: string };
  return entry[lang] ?? entry['cs'];
}

/** Convenience hook-free getter for use in non-hook contexts */
export function tx(entry: { cs: string; en: string }, lang: Lang): string {
  return entry[lang] ?? entry['cs'];
}

export default t;
