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
    philosophy: { cs: 'Filozofie',   en: 'Philosophy' },
    ai_native:  { cs: 'AI Native',   en: 'AI Native' },
  },

  /* ─── Hero ─── */
  hero: {
    badge_version:  { cs: 'Live TestNet · v2.9.8 · Deeksha', en: 'Live TestNet · v2.9.8 · Deeksha' },
    badge_chv4:     { cs: 'Primary host live · Zion2 · internal seeds', en: 'Primary host live · Zion2 · internal seeds' },
    tagline:        { cs: 'Veřejný testnet nativního Rust blockchainu', en: 'Public testnet of a native Rust blockchain' },
    title_sub:      { cs: 'Live TestNet · v2.9.8', en: 'Live TestNet · v2.9.8' },
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
    signal_status_l1: { cs: 'Deeksha live', en: 'Deeksha live' },
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
    title: { cs: 'Golden Egg na homepage', en: 'Golden Egg on the homepage' },
    title_emphasis: {
      cs: 'teď má širší příběh, ne jen dekoraci.',
      en: 'now carries a fuller story, not just ornament.',
    },
    visual_badge: { cs: 'Ekam vizuální reference', en: 'Ekam visual reference' },
    visual_text: {
      cs: 'Veřejný Ekam motiv dává Golden Egg bloku skutečný vizuální základ místo syntetické dekorace.',
      en: 'A public Ekam visual gives the Golden Egg section a real anchor instead of a synthetic motif.',
    },
    source: { cs: 'Zdroj: Ekam / Oneness', en: 'Source: Ekam / Oneness' },
    lead: {
      cs: 'Golden Egg tu není jako interní mystická poznámka. Funguje jako čitelný symbol původu, vědomí a budoucí vrstvy Oasis, zasazený mezi to, co je dnes skutečně živé: veřejný testnet, primary host telemetry, pool a dokumentaci.',
      en: 'Golden Egg is not presented as an internal mystical aside. It works as a clear symbol of origin, consciousness, and the future Oasis layer, placed beside what is verifiably live today: the public testnet, primary-host telemetry, pool, and documentation.',
    },
    support: {
      cs: 'Tree of Life zůstává níž na stránce jako volitelná interaktivní vrstva. Návštěvník tak nejdřív dostane srozumitelný obraz projektu a až potom si může otevřít hlubší symbolickou scénu.',
      en: 'Tree of Life stays lower on the page as an optional interactive layer. Visitors get a clear project narrative first, and only then a deeper symbolic scene if they want to continue.',
    },
    what_title: { cs: 'Co je Hiranyagarbha', en: 'What is Hiranyagarbha' },
    what_head: {
      cs: 'Védský obraz zlatého vejce, ze kterého vzniká svět.',
      en: 'A Vedic image of the golden egg from which the world emerges.',
    },
    what_body: {
      cs: 'Ve sdíleném chatu se opakuje stejná osa: zlatá sféra, aura, kosmický prostor, někdy lotus nebo voda. Pro web to znamená, že sekce nemá jen svítit, ale nést jednoduchý význam, který návštěvník pochopí i bez znalosti symboliky.',
      en: 'The shared chat keeps returning to the same visual axis: a golden sphere, aura, cosmic space, sometimes lotus or water. On the web that means the section should do more than glow. It should carry a meaning that visitors can read immediately, even without prior knowledge of the symbolism.',
    },
    ekam_title: { cs: 'Proč právě EKAM', en: 'Why EKAM specifically' },
    ekam_head: {
      cs: 'Ekam dává symbolu konkrétní chrámový a vizuální kontext.',
      en: 'Ekam gives the symbol a concrete temple and visual context.',
    },
    ekam_body: {
      cs: 'Ve sdíleném chatu se EKAM objevuje jako poslední komnata celé kosmologické cesty. Proto tu používáme reálný veřejný motiv z Oneness/Ekam a ne generický fantasy asset.',
      en: 'In the shared chat, EKAM appears as the final chamber of the cosmological journey. That is why this section uses a real public Oneness/Ekam motif instead of a generic fantasy asset.',
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
    cta_museum: { cs: 'Otevřít EKAM směr', en: 'Open the EKAM direction' },
    landing_kicker: { cs: 'Navazující směr', en: 'Next direction' },
    landing_title: { cs: 'Ekam a webové muzeum kosmologie', en: 'Ekam and a web-native museum of cosmology' },
    landing_body: {
      cs: 'Navazující stránka rozvíjí to, co homepage jen naznačuje: jak propojit kosmický vznik, život, vědomí a EKAM do lehké webové zkušenosti bez toho, aby se první načtení homepage rozpadlo výkonově.',
      en: 'The follow-up page develops what the homepage only hints at: how cosmic origin, life, consciousness, and EKAM could become a lightweight web experience without compromising the first homepage render.',
    },
  },

  ekamPage: {
    badge: { cs: 'EKAM direction · web-native concept', en: 'EKAM direction · web-native concept' },
    title: { cs: 'Od Golden Egg k muzeu kosmologie', en: 'From Golden Egg to a museum of cosmology' },
    subtitle: {
      cs: 'Tahle stránka není těžká 3D scéna. Je to veřejně čitelný koncept, jak může ZION časem propojit kosmický vznik, život, vědomí a EKAM do lehké webové zkušenosti.',
      en: 'This page is not a heavy 3D scene. It is a public-facing concept for how ZION could gradually connect cosmic origin, life, consciousness, and EKAM into a lightweight web experience.',
    },
    card_origin_label: { cs: 'Proč to vzniká', en: 'Why this exists' },
    card_origin_title: { cs: 'Homepage naznačuje, landing rozvíjí.', en: 'The homepage hints, the landing expands.' },
    card_origin_body: {
      cs: 'Golden Egg na homepage zůstává lehký a rychlý. Tady je prostor vysvětlit širší narativ bez rušení prvního renderu.',
      en: 'Golden Egg on the homepage stays light and fast. Here there is room to explain the wider narrative without burdening the first render.',
    },
    card_format_label: { cs: 'Formát', en: 'Format' },
    card_format_title: { cs: 'Web-native before metaverse.', en: 'Web-native before metaverse.' },
    card_format_body: {
      cs: 'Nejdřív obsahová a vizuální osa. Až potom případně GLB, R3F nebo interaktivní místnosti.',
      en: 'First a content and visual axis. Only later, if needed, GLB, R3F, or interactive rooms.',
    },
    card_constraint_label: { cs: 'Pravidlo výkonu', en: 'Performance rule' },
    card_constraint_title: { cs: 'Žádné těžké 3D v prvním kroku.', en: 'No heavy 3D in the first step.' },
    card_constraint_body: {
      cs: 'Každá budoucí interaktivita musí být lazy a mimo první homepage render.',
      en: 'Any future interactivity must stay lazy and outside the initial homepage render.',
    },
    hall_title: { cs: 'Navržená cesta návštěvníka', en: 'Proposed visitor path' },
    hall_subtitle: {
      cs: 'Ve sdíleném chatu se opakovala stejná linie. Tady ji převádíme do webové dramaturgie.',
      en: 'The shared chat kept returning to the same sequence. Here it is translated into a web narrative.',
    },
    hall_1_title: { cs: '1. Big Bang', en: '1. Big Bang' },
    hall_1_body: { cs: 'Vznik prostoru, času a prvotní energie.', en: 'The emergence of space, time, and primordial energy.' },
    hall_2_title: { cs: '2. Life', en: '2. Life' },
    hall_2_body: { cs: 'Země, biologie, evoluce a vznik komplexity.', en: 'Earth, biology, evolution, and the rise of complexity.' },
    hall_3_title: { cs: '3. Consciousness', en: '3. Consciousness' },
    hall_3_body: { cs: 'Mysl, vnímání, neurální síť a otázka vědomí.', en: 'Mind, perception, neural networks, and the question of consciousness.' },
    hall_4_title: { cs: '4. EKAM', en: '4. EKAM' },
    hall_4_body: { cs: 'Chrámový prostor, kde se symbol vrací jako finální komnata.', en: 'A temple space where the symbol returns as the final chamber.' },
    practical_title: { cs: 'Praktická implementace', en: 'Practical implementation' },
    practical_subtitle: {
      cs: 'Pokud z toho někdy bude skutečný webový zážitek, mělo by to postupovat od nejlehčí vrstvy k náročnější.',
      en: 'If this ever becomes a real web experience, it should move from the lightest layer to the more demanding one.',
    },
    practical_1: { cs: 'Obsahová landing page a statické schéma', en: 'Content landing page and static schematic' },
    practical_2: { cs: 'Lehký motion layer a lazy-loaded vizuály', en: 'Light motion layer and lazy-loaded visuals' },
    practical_3: { cs: 'Samostatná experimentální 3D route mimo homepage', en: 'A separate experimental 3D route outside the homepage' },
    practical_4: { cs: 'Až pak plnější museum path s R3F nebo GLB', en: 'Only then a fuller museum path with R3F or GLB' },
    stack_title: { cs: 'Technický směr z chatu', en: 'Technical direction from the chat' },
    stack_body: {
      cs: 'Ve sdíleném chatu padal Next.js, React Three Fiber, GLB, Draco compression a laziness jako správný směr. To dává smysl, ale až jako oddělená vrstva, ne jako povinná homepage animace.',
      en: 'The shared chat pointed toward Next.js, React Three Fiber, GLB, Draco compression, and lazy loading as the right direction. That makes sense, but only as a separate layer, not as a mandatory homepage animation.',
    },
    source_title: { cs: 'Veřejný zdroj symbolu', en: 'Public source of the symbol' },
    source_body: {
      cs: 'Golden Egg blok zůstává navázaný na veřejný Oneness/Ekam motiv. To drží vizuální linku s realitou místo generického sci-fi assetu.',
      en: 'The Golden Egg section remains tied to a public Oneness/Ekam visual. That keeps the visual line anchored in reality instead of drifting into a generic sci-fi asset.',
    },
    cta_home: { cs: 'Zpět na homepage', en: 'Back to homepage' },
    cta_tree: { cs: 'Přejít k Tree of Life', en: 'Go to Tree of Life' },
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
