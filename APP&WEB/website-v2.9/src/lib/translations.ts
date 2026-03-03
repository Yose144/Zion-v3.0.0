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
  },

  /* ─── Hero ─── */
  hero: {
    badge_version:  { cs: 'Pre-MainNet Gate · v2.9.7 · TestNet Živý', en: 'Pre-MainNet Gate · v2.9.7 · TestNet Live' },
    badge_chv4:     { cs: 'CHv4 Neural Bloom — vývojový roadmap 2026', en: 'CHv4 Neural Bloom — roadmap 2026' },
    tagline:        { cs: 'Nativní Rust těžební infrastruktura', en: 'Native Rust Mining Infrastructure' },
    title_sub:      { cs: 'Pre-MainNet Gate · v2.9.7', en: 'Pre-MainNet Gate · v2.9.7' },
    description:    {
      cs: '52 590 řádků nativního Rustu. 780+ testů. Cosmic Harmony PoW algoritmus, těžba v reálném čase na TestNetu — na cestě k MainNetu.',
      en: '52 590 lines of native Rust. 780+ tests. Cosmic Harmony PoW algorithm, real-time TestNet mining — on the road to MainNet.',
    },
    btn_start:      { cs: 'Začít těžit', en: 'Start Mining' },
    btn_docs:       { cs: 'Dokumentace', en: 'Docs' },
    btn_whitepaper: { cs: 'WhitePaper', en: 'WhitePaper' },
    signal_l1:      { cs: 'L1 Jádro', en: 'L1 Core' },
    signal_nodes:   { cs: 'Validátor síť', en: 'Validator Grid' },
    signal_mainnet: { cs: 'MainNet Gate', en: 'MainNet Gate' },
    signal_loc:     { cs: 'Helsinki · USA · Asie', en: 'Helsinki · USA · Asia' },
    signal_target:  { cs: 'Fáze 2–5 v přípravě', en: 'Phases 2–5 in pipeline' },
    signal_status_l1: { cs: 'Fáze 1 · 82 %', en: 'Phase 1 · 82 %' },
    signal_status_nodes: { cs: '3 / 3 nódy online', en: '3 / 3 nodes online' },
    signal_status_mainnet: { cs: '31. 12. 2026', en: '31. 12. 2026' },
    metric_loc:     { cs: 'Řádků kódu (Rust)', en: 'Rust LOC' },
    metric_nodes:   { cs: 'Nódy Online', en: 'Nodes Online' },
    metric_tests:   { cs: 'Testy úspěšně', en: 'Tests Passing' },
    observatory_label: { cs: 'Observatory mód', en: 'Observatory mode' },
    section_signals: { cs: 'Misi signály', en: 'Mission signals' },
  },

  /* ─── Features ─── */
  features: {
    heading: { cs: 'Vrstvy protokolu', en: 'Protocol Layers' },
    subheading: {
      cs: 'Šestisložková architektura od L1 Rust jádra až po L6 DAO vrstev.',
      en: 'Six-layer architecture from L1 Rust core to L6 DAO governance.',
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
          cs: 'P2P peer discovery, propagace bloků a synchronizace mempolu přes 3 validator nódy (Helsinki, USA, Asie).',
          en: 'P2P peer discovery, block propagation, and mempool sync across 3 validator nodes (Helsinki, USA, Asia).',
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
