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
    dashboard:  { cs: 'Dashboard',  en: 'Dashboard' },
    warp:       { cs: 'WARP',        en: 'WARP' },
    dao:        { cs: 'DAO',         en: 'DAO' },
    bridge:     { cs: 'Most',        en: 'Bridge' },
    pool:       { cs: 'Pool',        en: 'Pool' },
    miner_stats: { cs: 'Statistiky minera', en: 'Miner Stats' },
    philosophy: { cs: 'Filozofie',   en: 'Philosophy' },
    ai_native:  { cs: 'AI Native',   en: 'AI Native' },
    monitoring: { cs: 'Monitoring',  en: 'Monitoring' },
  },

  /* ─── Hero ─── */
  hero: {
    badge_version:  { cs: 'Live TestNet · v2.9.9 Pure Code · runtime v2.9.8', en: 'Live TestNet · v2.9.9 Pure Code · runtime v2.9.8' },
    badge_chv4:     { cs: 'Primary host live · Zion2 · internal seeds', en: 'Primary host live · Zion2 · internal seeds' },
    tagline:        { cs: 'Veřejný testnet nativního Rust blockchainu', en: 'Public testnet of a native Rust blockchain' },
    title_sub:      { cs: 'Live TestNet · public line v2.9.9 · canonical runtime v2.9.8', en: 'Live TestNet · public line v2.9.9 · canonical runtime v2.9.8' },
    description:    {
      cs: 'ZION TerraNova je živý testnet s explorerem, veřejným poolem, mining binárkami a provozní telemetrií na primárním hostu Zion2. Historický 3-node rollout zůstává v dokumentaci a reportech jako validační milník, ne jako aktuální topologie.',
      en: 'ZION TerraNova is a live testnet with an explorer, public pool, mining binaries, and operational telemetry on the Zion2 primary host. The historical 3-node rollout remains in documentation and reports as a validation milestone, not the current topology.',
    },
    btn_start:      { cs: 'Začít těžit', en: 'Start Mining' },
    btn_docs:       { cs: 'Dokumentace', en: 'Docs' },
    btn_whitepaper: { cs: 'WhitePaper', en: 'WhitePaper' },
    signal_l1:      { cs: 'L1 Jádro', en: 'L1 Core' },
    signal_nodes:   { cs: 'Validátor síť', en: 'Validator Grid' },
    signal_mainnet: { cs: 'Release Status', en: 'Release Status' },
    signal_loc:     { cs: 'Zion2 · veřejný host · interní seedy', en: 'Zion2 · public host · internal seeds' },
    signal_target:  { cs: 'GO · primary host aktivní', en: 'GO · primary host active' },
    signal_status_l1: { cs: 'Pure Code live · runtime 2.9.8', en: 'Pure Code live · runtime 2.9.8' },
    signal_status_nodes: { cs: '1 veřejný host / 2 interní seedy', en: '1 public host / 2 internal seeds' },
    signal_status_mainnet: { cs: 'Release gate · GO', en: 'Release gate · GO' },
    metric_loc:     { cs: 'Řádků kódu (Rust)', en: 'Rust LOC' },
    metric_nodes:   { cs: 'Nódy Online', en: 'Nodes Online' },
    metric_tests:   { cs: 'Testy úspěšně', en: 'Tests Passing' },
    observatory_label: { cs: 'Observatory mód', en: 'Observatory mode' },
    section_signals: { cs: 'Misi signály', en: 'Mission signals' },
    btn_warp:          { cs: 'Prozkoumat síť',      en: 'Explore Network' },
    btn_guardian_docs: { cs: 'Číst dokumentaci',   en: 'Read Docs' },
    btn_native_miner:  { cs: 'Stáhnout miner',          en: 'Download Miner' },
  },

  goldenEgg: {
    badge: { cs: 'Hiranyagarbha · Golden Egg', en: 'Hiranyagarbha · Golden Egg' },
    signal: { cs: 'L4 signál, ukotvený v L1', en: 'L4 signal, grounded in L1' },
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
      cs: 'Ve védské kosmologii je Hiranyagarbha (हिरण्यगर्भ) zlaté vejce, z něhož se rodí vesmír. V architektuře chrámu Ekam dostává tento symbol fyzickou podobu — posvátnou geometrii, masivní halu bez sloupů a Zlatou Kouli na vrcholu kopule.',
      en: 'In Vedic cosmology, Hiranyagarbha (हिरण्यगर्भ) is the golden egg from which the universe is born. In the architecture of the Ekam temple, this symbol takes physical form — sacred geometry, a vast pillarless hall, and the Golden Orb atop the dome.',
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
      cs: 'Chrám, kde se Hiranyagarbha stává prostorem',
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
    cta_network: { cs: 'Zobrazit živou síť', en: 'View live network' },
    cta_museum: { cs: 'Virtuální prohlídka Ekam', en: 'Virtual tour of Ekam' },
    tour_badge: { cs: 'Virtuální prohlídka', en: 'Virtual tour' },
    tour_title: { cs: 'Prozkoumejte chrám Ekam', en: 'Explore the Ekam temple' },
    tour_body: {
      cs: 'Posvátná architektura, geometrie Surya Yantra, největší Sri Chakra na světě a obřad Deeksha — vše na jedné stránce.',
      en: 'Sacred architecture, Surya Yantra geometry, the largest Sri Chakra in the world, and the Deeksha ceremony — all on one page.',
    },
    landing_kicker: { cs: 'Navazující směr', en: 'Next direction' },
    landing_title: { cs: 'Ekam a webové muzeum kosmologie', en: 'Ekam and a web-native museum of cosmology' },
    landing_body: {
      cs: 'Navazující stránka rozvíjí to, co homepage jen naznačuje: jak propojit kosmický vznik, život, vědomí a EKAM do lehké webové zkušenosti bez toho, aby se první načtení homepage rozpadlo výkonově.',
      en: 'The follow-up page develops what the homepage only hints at: how cosmic origin, life, consciousness, and EKAM could become a lightweight web experience without compromising the first homepage render.',
    },
  },

  ekamPage: {
    badge: { cs: 'EKAM · Virtuální prohlídka', en: 'EKAM · Virtual Tour' },
    title: { cs: 'Ekam — Chrám Zlatého Vejce', en: 'Ekam — The Golden Egg Temple' },
    subtitle: {
      cs: 'Ekam je posvátné místo zasvěcené vědomí, kde se setkává kosmologie, architektura a duchovní praxe Deeksha. Toto je jeho virtuální prohlídka.',
      en: 'Ekam is a sacred space dedicated to consciousness, where cosmology, architecture, and the spiritual practice of Deeksha converge. This is its virtual tour.',
    },
    /* ── Architecture ── */
    arch_label: { cs: 'Posvátná architektura', en: 'Sacred architecture' },
    arch_title: { cs: 'Stavba nad běžným měřítkem', en: 'A structure beyond ordinary scale' },
    arch_subtitle: {
      cs: 'Ekam stojí na platformě 130 × 106 metrů, dosahuje výšky 32,85 m, a hlavní síň je nesena bez jediného sloupu přes rozpětí 50 metrů. Celou stavbu obklopuje vodní příkop symbolizující kosmický oceán.',
      en: 'Ekam sits on a 130 × 106 m platform, rises 32.85 m, and its main hall spans 50 metres without a single pillar. A water moat surrounds the structure, symbolising the cosmic ocean.',
    },
    arch_platform_title: { cs: 'Platforma 130 × 106 m', en: '130 × 106 m platform' },
    arch_platform_body: { cs: 'Jednoúrovňové základy orientované podle Vastu Purusha Mandaly.', en: 'Single-level foundations aligned to the Vastu Purusha Mandala.' },
    arch_hall_title: { cs: 'Sloupová hala 50 m', en: '50 m pillarless hall' },
    arch_hall_body: { cs: 'Bezsloupový prostor pro až 8 000 meditujících, zaklenutý jedinou klenbou.', en: 'A column-free space for up to 8,000 meditators, spanned by a single vault.' },
    arch_floors_title: { cs: '3 podlaží, 8 schodišť', en: '3 floors, 8 staircases' },
    arch_floors_body: { cs: 'Oktagonální schodiště v rozích — symbolická cesta od pozemského k duchovnímu.', en: 'Octagonal staircases at the corners — a symbolic path from the earthly to the spiritual.' },
    arch_moat_title: { cs: 'Vodní příkop', en: 'Water moat' },
    arch_moat_body: { cs: 'Tok vody kolem celé stavby připomíná pradávný kosmický oceán a odděluje posvátný prostor.', en: 'Water flowing around the structure recalls the primordial cosmic ocean and separates sacred space.' },
    /* ── Sacred geometry ── */
    geo_label: { cs: 'Posvátná geometrie', en: 'Sacred geometry' },
    geo_title: { cs: 'Geometrie zakódovaná v každém detailu', en: 'Geometry encoded in every detail' },
    geo_subtitle: {
      cs: 'Ekam integruje starověké geometrické systémy do moderní architektury: 3D Surya Yantra mandalu, největší Sri Chakru na světě, Zlatý řez a Vastu Purusha Mandalu.',
      en: 'Ekam integrates ancient geometric systems into modern architecture: the 3D Surya Yantra mandala, the world\'s largest Sri Chakra, the Golden Ratio, and the Vastu Purusha Mandala.',
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
    deeksha_title: { cs: 'Deeksha — přenos duchovní energie', en: 'Deeksha — transfer of spiritual energy' },
    deeksha_body: {
      cs: 'Deeksha (dīkṣā) je duchovní zasvěcení přenášené od učitele k žákovi. V tradici Ekamu a Oneness University se praktikuje jako přenos energie, který probouzí vyšší stavy vědomí.',
      en: 'Deeksha (dīkṣā) is a spiritual initiation transmitted from teacher to student. In the Ekam and Oneness University tradition it is practised as an energy transfer that awakens higher states of consciousness.',
    },
    deeksha_sparsha_label: { cs: 'Sparsha Deeksha', en: 'Sparsha Deeksha' },
    deeksha_sparsha_title: { cs: 'Přímý dotek', en: 'Direct touch' },
    deeksha_sparsha_body: { cs: 'Energie je přenášena přímým položením rukou na hlavu přijímajícího. Nejstarší a nejintenzivnější forma.', en: 'Energy is transmitted by placing hands directly on the receiver\'s head. The oldest and most intense form.' },
    deeksha_smarana_label: { cs: 'Smarana Deeksha', en: 'Smarana Deeksha' },
    deeksha_smarana_title: { cs: 'Na dálku', en: 'At a distance' },
    deeksha_smarana_body: { cs: 'Přenos soustředěným záměrem bez fyzického kontaktu — meditující přijímá Deekshu i na velkou vzdálenost.', en: 'Transmission through focused intent without physical contact — the meditator receives Deeksha even across a great distance.' },
    /* ── Visitor path (halls) ── */
    hall_title: { cs: 'Cesta návštěvníka', en: 'Visitor path' },
    hall_subtitle: {
      cs: 'Od kosmického počátku k chrámu vědomí — čtyři zastavení na cestě Ekamem.',
      en: 'From cosmic origin to the temple of consciousness — four stops on the path through Ekam.',
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
    cta_home: { cs: 'Zpět na homepage', en: 'Back to homepage' },
    cta_tree: { cs: 'Přejít k Tree of Life', en: 'Go to Tree of Life' },
    cta_source: { cs: 'Zdroj: Oneness / Ekam', en: 'Source: Oneness / Ekam' },
  },

  /* ─── Features ─── */
  features: {
    heading: { cs: 'Vrstvy protokolu', en: 'Protocol Layers' },
    subheading: {
      cs: 'Šestisložková architektura: L1 Rust jádro, L2 NCL, L3 DAO, L4 Oasis, L5 Free World, L6 Issobella.',
      en: 'Six-layer architecture: L1 Rust core, L2 NCL, L3 DAO, L4 Oasis, L5 Free World, L6 Issobella.',
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
        badge: { cs: 'TestNet', en: 'TestNet' },
      },
      dao: {
        title: { cs: 'DAO Správa', en: 'DAO Governance' },
        desc:  {
          cs: 'On-chain hlasování pro správu pokladnice, upgrady protokolu a komunitní návrhy. Plánováno pro Fázi 3.',
          en: 'On-chain voting for treasury allocation, protocol upgrades, and community proposals. Planned for Phase 3.',
        },
        badge: { cs: 'Plánováno', en: 'Planned' },
      },
      warp: {
        title: { cs: 'WARP Mosty', en: 'WARP Bridges' },
        desc:  {
          cs: 'Meziřetězcové mosty (ETH, SOL, Cosmos) přes HTLC a relay protokoly. Plánováno pro L3 vrstvu (2027+).',
          en: 'Cross-chain bridges (ETH, SOL, Cosmos) via HTLC and relay protocols. Planned for L3 layer (2027+).',
        },
        badge: { cs: 'L3 · 2027+', en: 'L3 · 2027+' },
      },
      p2p: {
        title: { cs: 'P2P síť', en: 'P2P Network' },
        desc:  {
          cs: 'P2P peer discovery, propagace bloků a synchronizace mempolu přes veřejný primární host a interní seed kontejnery. Historický 3-node rollout je vedený v reportech.',
          en: 'P2P peer discovery, block propagation, and mempool sync across the public primary host and internal seed containers. The historical 3-node rollout is preserved in reports.',
        },
        badge: { cs: 'Živý', en: 'Live' },
      },
      explorer: {
        title: { cs: 'Block Explorer', en: 'Block Explorer' },
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
          cs: 'Hardened TestNet — Rust pool, Cosmic Harmony těžba, P2P sync. 82 % dokončeno.',
          en: 'Hardened TestNet — Rust pool, Cosmic Harmony mining, P2P sync. 82 % done.',
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
        phase: { cs: 'Fáze 4–5 · Q4 2026', en: 'Phase 4–5 · Q4 2026' },
        detail: {
          cs: 'Dress rehearsal, genesis konfig, MainNet launch 31. 12. 2026.',
          en: 'Dress rehearsal, genesis config, MainNet launch 31. 12. 2026.',
        },
      },
    },
    upgrade_heading: { cs: 'Vývoj upgradu · Timeline', en: 'Upgrade development · Timeline' },
    community_cta: {
      cs: 'Governance DAO otevírá na L3 (2028). Přidej se k diskuzi na GitHub’u — navrhuj funkce, odměny nebo upgrady protokolu.',
      en: 'DAO governance opens at L3 (2028). Join the discussion on GitHub — propose features, bounties, or protocol upgrades.',
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
      asic:    { cs: 'Anti-ASIC bariéra — iregulér compute graph', en: 'Anti-ASIC barrier — irregular compute graph' },
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

  /* ─── Footer ─── */
  footer: {
    tagline: {
      cs: 'Blockchain první generace. Nativní Rust těžba. Vědomá architektura.',
      en: 'First generation blockchain. Native Rust mining. Conscious architecture.',
    },
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
