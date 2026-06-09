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
    pool:       { cs: 'Pool',        en: 'Pool' },
    miner_stats: { cs: 'Statistiky minera', en: 'Miner Stats' },
    benchmarks: { cs: 'Benchmarky', en: 'Benchmarks' },
    news: { cs: 'Novinky', en: 'News' },
    philosophy: { cs: 'Filozofie',   en: 'Philosophy' },
    ai_native:  { cs: 'AI Native',   en: 'AI Native' },
    monitoring: { cs: 'Monitoring',  en: 'Monitoring' },
    defi:       { cs: 'DeFi Hub',    en: 'DeFi Hub' },
    defi_group: { cs: 'DeFi · L2',   en: 'DeFi · L2' },
    kompas:     { cs: 'Zlatý Kompas', en: 'Golden Compass' },
    info_group: { cs: 'Info', en: 'Info' },
    layers_group: { cs: 'Vrstvy', en: 'Layers' },
    wiki_group: { cs: 'Wiki', en: 'Wiki' },
    l3_hiran:   { cs: 'L3 Hiran', en: 'L3 Hiran' },
    l4_oasis:   { cs: 'L4 Oasis', en: 'L4 Oasis' },
    l5_free_world: { cs: 'L5 Free World', en: 'L5 Free World' },
    l6_issobella: { cs: 'L6 Issobella', en: 'L6 Issobella' },
    terranova:  { cs: 'Terra Nova',   en: 'Terra Nova' },
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
    badge_version:  { cs: 'V3 Mainnet · v3.0.0 Mainnet Ready', en: 'V3 Mainnet · v3.0.0 Mainnet Ready' },
    badge_chv4:     { cs: 'Core + Edge topologie', en: 'Core + Edge topology' },
    tagline:        { cs: 'Nativní Rust blockchain s Proof-of-Work konsensem', en: 'Native Rust blockchain with Proof-of-Work consensus' },
    title_sub:      { cs: 'Launch Countdown · Core + Edge · canonical runtime v3.0.0 Ekam Deeksha', en: 'Launch Countdown · Core + Edge · canonical runtime v3.0.0 Ekam Deeksha' },
    description:    {
      cs: 'ZION TerraNova mainnet launch countdown — 31. prosinec 2026 (Silvestr). Příprava V3 mainnet v Core + Edge topologii (Core PC + Hetzner Edge VPS), s veřejným poolem, mining binárkami a provozní telemetrií.',
      en: 'ZION TerraNova mainnet launch countdown — 31 December 2026 (New Year\'s Eve). Preparing V3 mainnet in Core + Edge topology (Core PC + Hetzner Edge VPS), with public pool, mining binaries, and operational telemetry.',
    },
    btn_start:      { cs: 'Začít těžit', en: 'Start Mining' },
    btn_docs:       { cs: 'Dokumentace', en: 'Docs' },
    btn_whitepaper: { cs: 'WhitePaper', en: 'WhitePaper' },
    signal_l1:      { cs: 'L1 Jádro', en: 'L1 Core' },
    signal_nodes:   { cs: 'Validátor síť', en: 'Validator Grid' },
    signal_mainnet: { cs: 'Launch Countdown', en: 'Launch Countdown' },
    signal_loc:     { cs: 'Core PC + Edge VPS · ShareRelay', en: 'Core PC + Edge VPS · ShareRelay' },
    signal_target:  { cs: '31. prosince 2026', en: '31 December 2026' },
    signal_status_l1: { cs: 'Mainnet Ready active · runtime v3.0.0', en: 'Mainnet Ready active · runtime v3.0.0' },
    signal_status_nodes: { cs: 'Core + Edge online', en: 'Core + Edge online' },
    signal_status_mainnet: { cs: 'Launch Countdown · 31. prosince 2026', en: 'Launch Countdown · 31 December 2026' },
    metric_loc:     { cs: 'Řádků kódu (Rust)', en: 'Rust LOC' },
    metric_nodes:   { cs: 'Nódy Online', en: 'Nodes Online' },
    metric_tests:   { cs: 'Testy úspěšně', en: 'Tests Passing' },
    observatory_label: { cs: 'Režim observatoře', en: 'Observatory mode' },
    section_signals: { cs: 'Signály mise', en: 'Mission signals' },
    btn_warp:          { cs: 'Prozkoumat síť',      en: 'Explore Network' },
    btn_guardian_docs: { cs: 'Otevřít dokumentaci',   en: 'Open Docs' },
    btn_native_miner:  { cs: 'Stáhnout miner',          en: 'Download Miner' },
    teaser_title: { cs: 'Živá Core + Edge síť', en: 'Live Core + Edge network' },
    teaser_badge: { cs: 'Aktivní', en: 'Active' },
    teaser_body: {
      cs: 'Síťový stav, explorer, pool, downloady i dokumentace jsou na jednom místě. Homepage slouží jako veřejný vstup do Core + Edge mainnetu, ne jako oznámení produkčního launch.',
      en: 'Network status, explorer, pool, downloads, and documentation live in one place. The homepage acts as a public entry point into the Core + Edge mainnet, not as a production launch announcement.',
    },
    teaser_cta: { cs: 'Prozkoumat', en: 'Explore' },
    observatory_focus_label: { cs: 'Zaměření signálu', en: 'Signal focus' },
    observatory_scan_label: { cs: 'Aktuální scanline', en: 'Current scanline' },
    version_pill_rehearsal: { cs: 'Core + Edge topologie', en: 'Core + Edge topology' },
    teaser_title_countdown: { cs: 'Launch Countdown — 31. prosince 2026', en: 'Launch Countdown — 31 December 2026' },
    countdown_badge: { cs: 'T-{days}d', en: 'T-{days}d' },
    teaser_description: {
      cs: 'Síťový stav, explorer, pool, downloady a dokumentace — příprava na mainnet launch {date}. Core + Edge topologie v testování, aktivní mining test, bridge v přípravě.',
      en: 'Network status, explorer, pool, downloads, and documentation — preparing for mainnet launch on {date}. Core + Edge topology in testing, mining test active, bridge in preparation.',
    },
    l3_link_label: { cs: 'Full AI Layer — L3 Hiran v2.2', en: 'Full AI Layer — L3 Hiran v2.2' },
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
      cs: 'Příprava V3 Mainnet · Core + Edge topology · Mining test · Bridge v přípravě',
      en: 'Preparing V3 Mainnet · Core + Edge topology · Mining test · Bridge in preparation',
    },
    unit_days: { cs: 'Dnů', en: 'Days' },
    unit_hours: { cs: 'Hodin', en: 'Hours' },
    unit_minutes: { cs: 'Minut', en: 'Minutes' },
    unit_seconds: { cs: 'Sekund', en: 'Seconds' },
    live_title: { cs: 'Mainnet LIVE', en: 'Mainnet LIVE' },
    live_target_date: { cs: 'Target: 31. prosince 2026 (Silvestr)', en: "Target: 31 December 2026 (New Year's Eve)" },
    live_badge: { cs: 'GO', en: 'GO' },
    status_label: { cs: 'Status', en: 'Status' },
    live_caption: {
      cs: 'V3 Mainnet je v provozu · Core + Edge topologie · Mining aktivní · Bridge nasazen',
      en: 'V3 Mainnet is operational · Core + Edge topology · Mining active · Bridge deployed',
    },
  },

  liveDashboard: {
    total_blocks: { cs: 'Bloky celkem', en: 'Total Blocks' },
    total_supply: { cs: 'Zásoba celkem', en: 'Total Supply' },
    transactions: { cs: 'Transakce', en: 'Transactions' },
    difficulty: { cs: 'Obtížnost', en: 'Difficulty' },
    mempool_size: { cs: 'Velikost mempoolu', en: 'Mempool Size' },
    mission_console: { cs: 'Mise console', en: 'Mission Console' },
    continuum_status: { cs: 'Stav kontinua', en: 'Continuum status' },
    galactic_sync: { cs: 'Synchronizace galaktické sítě', en: 'Galactic network sync' },
    updated: { cs: 'Aktualizace', en: 'Updated' },
    status_live: { cs: 'živě', en: 'live' },
    status_initializing: { cs: 'spouštění', en: 'initializing' },
    latest_block: { cs: 'Poslední blok', en: 'Latest block' },
    waiting_for_signal: { cs: 'Čekání na signál', en: 'Waiting for signal' },
  },

  poolDashboard: {
    mining_pool: { cs: 'Těžební pool', en: 'Mining Pool' },
    mine_zion: { cs: 'Těžte ZION', en: 'Mine ZION' },
    live_data: { cs: 'Živá data', en: 'Live Data' },
    auto_refresh_15s: { cs: 'Auto-refresh 15 s', en: 'Auto-Refresh 15s' },
    public_pool_host: { cs: 'veřejný pool host', en: 'Public Pool Host' },
    quick_connect: { cs: 'Rychlé připojení', en: 'Quick Connect' },
    getting_started_guide: { cs: 'Průvodce začátkem', en: 'Getting started guide' },
    invalid_zion_address_must_start_with_zio: { cs: 'Neplatná ZION adresa — musí začínat na zion1', en: 'Invalid ZION address — must start with zion1' },
    enter_your_zion_address_to_view_miner_st: { cs: 'Zadejte svou ZION adresu pro zobrazení statistik minera...', en: 'Enter your ZION address to view miner stats...' },
    search_miner: { cs: 'Najít minera', en: 'Search Miner' },
    telemetry: { cs: 'Telemetrie', en: 'Telemetry' },
    pool_statistics: { cs: 'Statistiky poolu', en: 'Pool Statistics' },
    real_time_metrics_aggregated_from_the_pu: { cs: 'Metriky v reálném čase agregované z veřejného pool API na Zion2.', en: 'Real-time metrics aggregated from the public pool API on Zion2.' },
    pool_hashrate: { cs: 'Hashrate poolu', en: 'Pool Hashrate' },
    24h_avg: { cs: '24h průměr', en: '24h avg' },
    live_backend_is_not_exporting_hashrate_y: { cs: 'Živý backend zatím hashrate neexportuje', en: 'Live backend is not exporting hashrate yet' },
    active_miners: { cs: 'Aktivní mineři', en: 'Active Miners' },
    blocks_found: { cs: 'Nalezené bloky', en: 'Blocks Found' },
    share_efficiency: { cs: 'Efektivita share', en: 'Share Efficiency' },
    accept_rate: { cs: 'Míra přijetí', en: 'Accept Rate' },
    rejected_shares: { cs: 'Odmítnuté shares', en: 'Rejected Shares' },
    servers_online: { cs: 'Servery online', en: 'Servers Online' },
    miner_share: { cs: 'Podíl minera', en: 'Miner Share' },
    total_paid: { cs: 'Celkem vyplaceno', en: 'Total Paid' },
    network_hashrate: { cs: 'Síťový hashrate', en: 'Network Hashrate' },
    offline: { cs: 'Offline', en: 'Offline' },
    template_fees: { cs: 'Template fees', en: 'Template Fees' },
    pool_data_unavailable_servers_may_be_off: { cs: 'Data poolu nejsou dostupná. Servery mohou být offline.', en: 'Pool data unavailable. Servers may be offline.' },
    performance: { cs: 'Výkon', en: 'Performance' },
    pool_performance: { cs: 'Výkon poolu', en: 'Pool Performance' },
    live_hashrate_chart_network_share_and_po: { cs: 'Živý graf hashrate, podíl na síti a statistika štěstí poolu.', en: 'Live hashrate chart, network share, and pool luck statistics.' },
    pool_hashrate_last_hour: { cs: 'Hashrate poolu (poslední hodina)', en: 'Pool Hashrate (last hour)' },
    24h_average: { cs: '24h průměr', en: '24h average' },
    network_share: { cs: 'Podíl na síti', en: 'Network Share' },
    network: { cs: 'Síť', en: 'Network' },
    pool_luck: { cs: 'Štěstí poolu', en: 'Pool Luck' },
    found: { cs: 'nalezeno', en: 'found' },
    expected: { cs: 'očekáváno', en: 'expected' },
    pending_payouts: { cs: 'Čekající výplaty', en: 'Pending Payouts' },
    miners_queued: { cs: 'minerů čeká', en: 'miners queued' },
    operations: { cs: 'Provoz', en: 'Operations' },
    pool_runtime_overview: { cs: 'Přehled runtime poolu', en: 'Pool Runtime Overview' },
    submission_flow_pplns_engine_fill_and_pa: { cs: 'Tok submitů, naplnění PPLNS enginu a payout throughput čerpané z živé telemetrie poolu.', en: 'Submission flow, PPLNS engine fill, and payout throughput sourced from live pool telemetry.' },
    accepted_shares: { cs: 'přijaté shares', en: 'accepted shares' },
    submits: { cs: 'Submity', en: 'Submits' },
    accept_rate_1: { cs: 'Míra přijetí', en: 'Accept rate' },
    window_utilization: { cs: 'Využití okna', en: 'Window utilization' },
    registered_miners: { cs: 'Registrovaní mineři', en: 'Registered miners' },
    payout_rounds: { cs: 'Payout kola', en: 'Payout rounds' },
    total_paid_1: { cs: 'Celkem vyplaceno', en: 'Total paid' },
    pool_uptime: { cs: 'Uptime poolu', en: 'Pool uptime' },
    telemetry_status: { cs: 'Stav telemetrie', en: 'Telemetry status' },
    pool_hashrate_is_still_unavailable_on_th: { cs: 'Hashrate poolu zatím není v živém backend exporteru dostupný, proto stránka upřednostňuje routing, PPLNS a zdraví chain runtime.', en: 'Pool hashrate is still unavailable on the live backend exporter, so the page prioritizes routing, PPLNS, and chain runtime health.' },
    infrastructure: { cs: 'Infrastruktura', en: 'Infrastructure' },
    pool_servers: { cs: 'Pool servery', en: 'Pool Servers' },
    current_public_pool_host_and_stratum_end: { cs: 'Aktuální veřejný pool host a stratum endpoint vystavený na primárním serveru.', en: 'Current public pool host and stratum endpoint exposed on the primary server.' },
    mining: { cs: 'Těží', en: 'Mining' },
    idle: { cs: 'Nečinný', en: 'Idle' },
    disconnected: { cs: 'Odpojen', en: 'Disconnected' },
    active_total: { cs: 'Aktivní / Celkem', en: 'Active / Total' },
    valid_shares: { cs: 'Validní shares', en: 'Valid Shares' },
    invalid: { cs: 'Neplatné', en: 'Invalid' },
    height: { cs: 'Výška', en: 'Height' },
    no_data_available: { cs: 'Data nejsou dostupná', en: 'No data available' },
    economics: { cs: 'Ekonomika', en: 'Economics' },
    reward_distribution: { cs: 'Distribuce odměn', en: 'Reward Distribution' },
    pplns_pay_per_last_n_shares_fair_and_tra: { cs: 'PPLNS — Pay Per Last N Shares. Férový a transparentní mechanismus odměn.', en: 'PPLNS — Pay Per Last N Shares. Fair and transparent reward mechanism.' },
    miner_reward: { cs: 'Odměna minera', en: 'Miner Reward' },
    direct_to_your_wallet_every_payout_cycle: { cs: 'Přímo do vaší peněženky v každém payout cyklu', en: 'Direct to your wallet every payout cycle' },
    directory: { cs: 'Adresář', en: 'Directory' },
    recent_miner_directory_from_the_live_poo: { cs: 'Aktuální adresář minerů z živého pool backendu. Pro detail konkrétní adresy použijte vyhledávání výše.', en: 'Recent miner directory from the live pool backend. Use miner search for full address-level detail.' },
    active_only: { cs: 'Jen aktivní', en: 'Active only' },
    all_miners: { cs: 'Všichni mineři', en: 'All miners' },
    address: { cs: 'Adresa', en: 'Address' },
    server: { cs: 'Server', en: 'Server' },
    last_share: { cs: 'Poslední share', en: 'Last Share' },
    status: { cs: 'Stav', en: 'Status' },
    active: { cs: 'Aktivní', en: 'Active' },
    inactive: { cs: 'Neaktivní', en: 'Inactive' },
    live_backend_is_not_exposing_recent_mine: { cs: 'Živý backend zatím nezveřejňuje poslední řádky minerů. Pro individuální statistiky vyhledejte adresu výše.', en: 'Live backend is not exposing recent miner rows yet. Search by address above for individual stats.' },
    ledger: { cs: 'Ledger', en: 'Ledger' },
    recent_network_blocks: { cs: 'Poslední síťové bloky', en: 'Recent Network Blocks' },
    latest_confirmed_chain_blocks_from_the_c: { cs: 'Nejnovější potvrzené chain bloky z aktuálního runtime. Veřejná atribuce vítěze poolu zatím není vystavena samostatně.', en: 'Latest confirmed chain blocks from the current runtime. Public pool winner attribution is not exposed separately yet.' },
    difficulty: { cs: 'Obtížnost', en: 'Difficulty' },
    reward: { cs: 'Odměna', en: 'Reward' },
    time: { cs: 'Čas', en: 'Time' },
    no_recent_chain_blocks_available: { cs: 'Nejsou dostupné žádné poslední chain bloky', en: 'No recent chain blocks available' },
    getting_started: { cs: 'Začínáme', en: 'Getting Started' },
    start_mining_zion: { cs: 'Začněte těžit ZION', en: 'Start Mining ZION' },
    follow_these_steps_to_begin_mining_in_mi: { cs: 'Postupujte podle těchto kroků a začněte těžit během několika minut.', en: 'Follow these steps to begin mining in minutes.' },
    1_get_a_zion_wallet: { cs: '1. Získejte ZION peněženku', en: '1. Get a ZION Wallet' },
    generate_your_mining_address: { cs: 'Vygenerujte svou těžební adresu', en: 'Generate your mining address' },
    download_the_zion_desktop_wallet_or_use_: { cs: 'Stáhněte desktop peněženku ZION nebo použijte webovou peněženku pro vytvoření těžební adresy.', en: 'Download the ZION desktop wallet or use the web wallet to generate your mining address.' },
    download_wallet: { cs: 'Stáhnout peněženku', en: 'Download Wallet' },
    2_choose_mining_software: { cs: '2. Vyberte těžební software', en: '2. Choose Mining Software' },
    zion_native_miner_or_xmrig: { cs: 'ZION Native Miner nebo XMRig', en: 'ZION Native Miner or XMRig' },
    official_cosmic_harmony_algorithm_python: { cs: 'Oficiální — algoritmus Cosmic Harmony · Python/Rust', en: 'Official — Cosmic Harmony algorithm · Python/Rust' },
    industry_standard_cpu_optimized: { cs: 'Průmyslový standard · optimalizovaný pro CPU', en: 'Industry-standard · CPU optimized' },
    3_configure_connect: { cs: '3. Nakonfigurujte a připojte', en: '3. Configure & Connect' },
    start_mining_with_one_command: { cs: 'Spusťte těžbu jedním příkazem', en: 'Start mining with one command' },
    4_monitor_earn: { cs: '4. Sledujte a vydělávejte', en: '4. Monitor & Earn' },
    track_your_rewards_in_real_time: { cs: 'Sledujte své odměny v reálném čase', en: 'Track your rewards in real-time' },
    once_connected_monitor_your_mining_stats: { cs: 'Po připojení sledujte své těžební statistiky přímo zde. Výplaty probíhají automaticky po dosažení minimálního prahu.', en: 'Once connected, monitor your mining stats right here. Payouts are automatic when you reach the minimum threshold.' },
    min_payout: { cs: 'Min. payout', en: 'Min Payout' },
    reward_method: { cs: 'Metoda odměn', en: 'Reward Method' },
    features: { cs: 'Funkce', en: 'Features' },
    why_mine_with_us: { cs: 'Proč těžit s námi', en: 'Why Mine With Us' },
    fair_transparent_and_humanitarian_focuse: { cs: 'Férový, transparentní a humanitárně zaměřený těžební pool.', en: 'Fair, transparent, and humanitarian-focused mining pool.' },
    cosmic_harmony_algorithm: { cs: 'Algoritmus Cosmic Harmony', en: 'Cosmic Harmony Algorithm' },
    native_zion_pow_algorithm_cpu_friendly_a: { cs: 'Nativní ZION PoW algoritmus, přívětivý k CPU a odolný vůči ASIC pro férovější distribuci.', en: 'Native ZION PoW algorithm, CPU-friendly, ASIC-resistant design for fair distribution.' },
    humanitarian_mission: { cs: 'Humanitární mise', en: 'Humanitarian Mission' },
    5_humanitarian_5_issobella_fund_mining_f: { cs: '5 % humanitární tithe + 5 % fond Issobella. Těžba pro vědomí.', en: '5% humanitarian + 5% Issobella fund. Mining for consciousness.' },
    primary_host_pool: { cs: 'Primární host poolu', en: 'Primary Host Pool' },
    public_stratum_access_runs_on_zion2_whil: { cs: 'Veřejný stratum běží na Zion2, zatímco interní seed kontejnery zůstávají za stejným hostem.', en: 'Public stratum access runs on Zion2 while internal seed containers stay behind the same host.' },
    pplns_rewards: { cs: 'PPLNS odměny', en: 'PPLNS Rewards' },
    fair_reward_distribution_based_on_your_c: { cs: 'Férová distribuce odměn podle vašich odevzdaných shares. Bez luck variance.', en: 'Fair reward distribution based on your contributed shares. No luck variance.' },
    real_time_monitoring: { cs: 'Monitoring v reálném čase', en: 'Real-Time Monitoring' },
    live_hashrate_shares_and_earnings_tracki: { cs: 'Živý přehled hashratu, shares a výdělků přes webový dashboard.', en: 'Live hashrate, shares, and earnings tracking via web dashboard.' },
    xmrig_compatible: { cs: 'Kompatibilní s XMRig', en: 'XMRig Compatible' },
    use_standard_mining_software_no_special_: { cs: 'Použijte standardní těžební software. Není potřeba nic speciálního.', en: 'Use standard mining software. No special tools required.' },
    pro_tools: { cs: 'Pro nástroje', en: 'Pro Tools' },
    operator_toolkit: { cs: 'Nástroje operátora', en: 'Operator Toolkit' },
    failover_templates_profit_estimate_and_a: { cs: 'Failover šablony, odhad výnosu a automatizační endpointy pro řízený provoz těžby.', en: 'Failover templates, profit estimate, and automation endpoints for managed mining operations.' },
    profit_estimator: { cs: 'Odhad výnosu', en: 'Profit Estimator' },
    your_hashrate_supports_k_m_g_t: { cs: 'Váš hashrate (podporuje K/M/G/T)', en: 'Your hashrate (supports K/M/G/T)' },
    e_g_250m: { cs: 'např. 250M', en: 'e.g. 250M' },
    parsed_hashrate: { cs: 'Parsovaný hashrate', en: 'Parsed hashrate' },
    pool_share: { cs: 'Podíl v poolu', en: 'Pool share' },
    observed_blocks_day: { cs: 'Pozorované bloky/den', en: 'Observed blocks/day' },
    reward_block: { cs: 'Odměna / blok', en: 'Reward / block' },
    estimated_daily_reward: { cs: 'Odhad denní odměny', en: 'Estimated daily reward' },
    failover_config: { cs: 'Failover konfigurace', en: 'Failover Config' },
    xmrig_primary_backup: { cs: 'XMRig (primární + záložní)', en: 'XMRig (primary + backup)' },
    automation_export: { cs: 'Automatizace a export', en: 'Automation & Export' },
    set_alert_if_last_share_exceeds_10_minut: { cs: 'Nastavte alert: pokud poslední share přesáhne 10 minut nebo míra přijetí klesne pod 95 %, přepněte na záložní endpoint.', en: 'Set alert: if last share exceeds 10 minutes or accept rate drops below 95%, rotate to the backup endpoint.' },
    frequently_asked_questions: { cs: 'Časté dotazy', en: 'Frequently Asked Questions' },
    answers_to_the_most_common_miner_questio: { cs: 'Odpovědi na nejčastější otázky minerů.', en: 'Answers to the most common miner questions.' },
    what_algorithm_does_zion_use: { cs: 'Jaký algoritmus ZION používá?', en: 'What algorithm does ZION use?' },
    zion_uses_cosmic_harmony_a_custom_cpu_fr: { cs: 'ZION používá Cosmic Harmony — vlastní proof-of-work algoritmus přívětivý k CPU a odolný vůči ASIC. Podporuje CPU i GPU těžbu.', en: 'ZION uses Cosmic Harmony — a custom CPU-friendly, ASIC-resistant proof-of-work algorithm. It supports both CPU and GPU mining.' },
    how_does_pplns_work: { cs: 'Jak funguje PPLNS?', en: 'How does PPLNS work?' },
    pplns_pay_per_last_n_shares_rewards_mine: { cs: 'PPLNS (Pay Per Last N Shares) odměňuje minery podle jejich příspěvku v posledních N share. Je férovější než proporcionální odměny a penalizuje pool-hopping.', en: 'PPLNS (Pay Per Last N Shares) rewards miners based on their contribution in the last N shares. It is fairer than proportional rewards and penalizes pool-hopping.' },
    what_is_the_minimum_payout: { cs: 'Jaký je minimální payout?', en: 'What is the minimum payout?' },
    the_minimum_payout_is_0_1_zion_payouts_h: { cs: 'Minimální výplata je 0.1 ZION. Výplaty probíhají automaticky po nalezení bloku, jakmile váš zůstatek dosáhne prahu.', en: 'The minimum payout is 0.1 ZION. Payouts happen automatically after a block is found once your balance reaches the threshold.' },
    where_do_tithe_and_funds_go: { cs: 'Kam jdou tithe a fondy?', en: 'Where do tithe and funds go?' },
    coinbase_distribution_89_miner_5_humanit: { cs: 'Distribuce coinbase: 89 % miner, 5 % humanitární tithe, 5 % fond Issobella, 1 % pool fee. Tithe a fondy jsou kódovány přímo v coinbase transakci na chain úrovni.', en: 'Coinbase distribution: 89% miner, 5% humanitarian tithe, 5% Issobella fund, 1% pool fee. Tithe and funds are encoded directly in the coinbase transaction at the chain level.' },
    can_i_use_xmrig_or_only_the_native_miner: { cs: 'Mohu používat XMRig nebo jen nativní miner?', en: 'Can I use XMRig or only the native miner?' },
    both_are_supported_xmrig_is_industry_sta: { cs: 'Oba jsou podporovány. XMRig je průmyslový standard s optimalizacemi pro CPU. Nativní ZION miner nabízí dedikovanou podporu Cosmic Harmony a GPU akceleraci.', en: 'Both are supported. XMRig is industry-standard with CPU optimizations. The native ZION miner offers dedicated Cosmic Harmony support and GPU acceleration.' },
    what_does_pool_luck_mean: { cs: 'Co znamená Pool Luck?', en: 'What does Pool Luck mean?' },
    pool_luck_shows_the_ratio_of_blocks_foun: { cs: 'Pool Luck ukazuje poměr nalezených bloků vs. statisticky očekávaných na základě hashrate poolu a obtížnosti sítě. 100 % = přesně dle očekávání, nad 100 % = lepší než průměr.', en: 'Pool Luck shows the ratio of blocks found vs. statistically expected based on pool hashrate and network difficulty. 100% = exactly as expected, above 100% = better than average.' },
    how_do_i_set_up_failover: { cs: 'Jak nastavím failover?', en: 'How do I set up failover?' },
    use_the_backup_pool_endpoint_in_your_xmr: { cs: 'Použijte záložní pool endpoint v konfiguraci XMRig (--url-backup) nebo v nativním mineru (--pool-backup). Automaticky přepne při výpadku primárního serveru.', en: 'Use the backup pool endpoint in your XMRig config (--url-backup) or native miner (--pool-backup). It auto-switches on primary server failure.' },
    how_often_are_payouts_processed: { cs: 'Jak často probíhají výplaty?', en: 'How often are payouts processed?' },
    payouts_are_processed_after_every_block_: { cs: 'Výplaty se zpracovávají po každém nalezeném bloku. Pool spočítá PPLNS podíly, vytvoří transakci a odešle ji do sítě. Potvrzení trvá obvykle 10 bloků.', en: 'Payouts are processed after every block found. The pool calculates PPLNS shares, creates a transaction, and broadcasts it. Confirmation takes around 10 blocks.' },
    zion_mining_pool: { cs: 'ZION těžební pool', en: 'ZION Mining Pool' },
    mine_zion_with_cosmic_harmony_a_fair_tra: { cs: 'Těžte ZION s Cosmic Harmony — férový a transparentní PoW pool s humanitárním přesahem zabudovaným do každého bloku.', en: 'Mine ZION with Cosmic Harmony — a fair, transparent PoW pool with humanitarian impact built into every block.' },
    start_mining: { cs: 'Začít těžit', en: 'Start Mining' },
    last_update: { cs: 'Poslední aktualizace', en: 'Last update' },
    en_us: { cs: 'cs-CZ', en: 'en-US' },
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
      cs: 'Šestisložková architektura: L1 Rust jádro, L2 Bridge · DAO · DeFi, L3 AI Native · WARP · NCL, L4 Oasis, L5 Free World, L6 Issobella.',
      en: 'Six-layer architecture: L1 Rust core, L2 Bridge · DAO · DeFi, L3 AI Native · WARP · NCL, L4 Oasis, L5 Free World, L6 Issobella.',
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
        badge: { cs: 'Test Mainnet', en: 'Test Mainnet' },
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
          cs: 'P2P peer discovery, propagace bloků a synchronizace mempolu přes Core + Edge topologii (Core PC + Hetzner Edge VPS) se ShareRelay protokolem.',
          en: 'P2P peer discovery, block propagation, and mempool sync across the Core + Edge topology (Core PC + Hetzner Edge VPS) using the ShareRelay protocol.',
        },
        badge: { cs: 'Živý', en: 'Live' },
      },
      explorer: {
        title: { cs: 'Pruzkumnik blockchainu', en: 'Block Explorer' },
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
          cs: 'Core + Edge mainnet — Rust pool, Cosmic Harmony těžba, P2P sync. 92 % dokončeno.',
          en: 'Core + Edge mainnet — Rust pool, Cosmic Harmony mining, P2P sync. 92 % done.',
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
          cs: 'Dress rehearsal, genesis konfigurace, uzavření public launch gate.',
          en: 'Dress rehearsal, genesis configuration, public launch gate closure.',
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

  /* ─── Docs rail (homepage section) ─── */
  docsRail: {
    nav_kicker: { cs: 'Navigace', en: 'Navigation' },
    headline_open: { cs: 'Otevři ', en: 'Open the ' },
    headline_gradient: {
      cs: 'aktuální dokumentaci, nástroje a zdroje',
      en: 'current docs, tools, and sources',
    },
    blurb: {
      cs: 'Veškerý provozní kontext Core + Edge mainnetu na jedné ose — dokumentace, mining nástroje, explorer i zdrojový kód.',
      en: 'Operational context for the Core + Edge mainnet in one spine — docs, mining tools, explorer, and source.',
    },
    card_open: { cs: 'Otevřít', en: 'Open' },
    res_docs_title: { cs: 'Aktuální dokumentace', en: 'Current docs' },
    res_docs_body: {
      cs: 'Otevře /docs s live přehledem Core + Edge topologie, maticí verzí 2.9.6 / 2.9.8 / 2.9.9 a launch blokery.',
      en: 'Opens /docs with the Core + Edge topology snapshot, versions 2.9.6 / 2.9.8 / 2.9.9, and launch blockers.',
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

  bridgeBurn: {
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    enter_a_valid_wzion_amount: { cs: 'Zadejte platne mnozstvi wZION', en: 'Enter a valid wZION amount' }
    l1_address_must_start_with_zion1_or_zo: { cs: 'L1 adresa musi zacinat na zion1 nebo Zo…', en: 'L1 address must start with zion1 or Zo…' }
    please_switch_to_base_in_metamask: { cs: 'Přepněte prosím v MetaMask na Base', en: 'Please switch to Base in MetaMask' }
    burn_wzion_receive_zion_on_l1: { cs: 'Spalit wZION → prijmout ZION na L1', en: 'Burn wZION → receive ZION on L1' }
    connect_metamask_on_base_to_burn_your_wzion_a: { cs: 'Připojte MetaMask na Base, spalte své wZION a přijměte ZION na L1.', en: 'Connect MetaMask on Base to burn your wZION and receive ZION on L1.' }
    metamask_not_detected_install: { cs: 'MetaMask nebyl detekovan. Nainstalujte ', en: 'MetaMask not detected. Install ' }
    to_use_this_widget: { cs: 'pro pouziti tohoto widgetu.', en: 'to use this widget.' }
    requesting_account: { cs: 'Žádám účet…', en: 'Requesting account…' }
    switching_to_base: { cs: 'Přepínám na Base…', en: 'Switching to Base…' }
    connect_metamask: { cs: 'Připojit MetaMask', en: 'Connect MetaMask' }
    burn_submitted: { cs: 'Burn odeslan!', en: 'Burn submitted!' }
    amount_burned: { cs: 'Spalene mnozstvi', en: 'Amount burned' }
    l1_recipient: { cs: 'L1 prijemce', en: 'L1 recipient' }
    copied: { cs: 'Zkopirovano', en: 'Copied' }
    the_relay_will_detect_the: { cs: 'Relay detekuje event ', en: 'The relay will detect the ' }
    event_after_64_evm_block_confirmations_2_min_: { cs: ' po 64 potvrzeních EVM bloků (~2 min), pak odešle L1 unlock. Vaše ZION dorazí do ~5 minut.', en: ' event after 64 EVM block confirmations (~2 min), then submit an L1 unlock. Your ZION will arrive within ~5 minutes.' }
    burn_more: { cs: 'Spalit vice', en: 'Burn more' }
    burn_wzion_zion_on_l1: { cs: 'Spalit wZION → ZION na L1', en: 'Burn wZION → ZION on L1' }
    refresh_balance: { cs: 'Obnovit zustatek', en: 'Refresh balance' }
    connected_wallet: { cs: 'Pripojena penezenka', en: 'Connected wallet' }
    wzion_balance: { cs: 'wZION zustatek', en: 'wZION balance' }
    amount_wzion: { cs: 'Mnozstvi (wZION)', en: 'Amount (wZION)' }
    e_g_100: { cs: 'napr. 100', en: 'e.g. 100' }
    wei: { cs: 'wei', en: 'wei' }
    zion_l1_recipient_address: { cs: 'Adresa prijemce ZION na L1', en: 'ZION L1 recipient address' }
    wzion_contract: { cs: 'wZION kontrakt:', en: 'wZION contract:' }
    network: { cs: 'Síť', en: 'Network' }
    decimals: { cs: 'desetinných míst', en: 'decimals' }
    no_protocol_fee: { cs: 'žádný protokolový poplatek', en: 'no protocol fee' }
    confirm_in_metamask: { cs: 'Potvrdte v MetaMask…', en: 'Confirm in MetaMask…' }
    broadcasting_tx: { cs: 'Odesilam TX…', en: 'Broadcasting TX…' }
    loading: { cs: 'Nacitam…', en: 'Loading…' }
    burn: { cs: 'Spalit ', en: 'Burn ' }
    zion_arrives_on_l1_within_5_min_after_evm_bur: { cs: 'ZION dorazi na L1 do ~5 minut po potvrzeni EVM burnu.', en: 'ZION arrives on L1 within ~5 min after EVM burn confirmation.' }
  },
  missionControl: {
    dashboard: { cs: 'Prehled', en: 'Dashboard' }
    stack_metrics: { cs: 'Metriky stacku', en: 'Stack Metrics' }
    roadmap: { cs: 'Roadmapa', en: 'Roadmap' }
    layers: { cs: 'Vrstvy', en: 'Layers' }
    constitution: { cs: 'Ustava', en: 'Constitution' }
    economy: { cs: 'Ekonomika', en: 'Economy' }
    security: { cs: 'Bezpecnost', en: 'Security' }
    timeline: { cs: 'Casova osa', en: 'Timeline' }
    priority: { cs: 'Priorita', en: 'Priority' }
    phase_1_foundation: { cs: 'Fáze 1 — Foundation', en: 'Phase 1 — Foundation' }
    core_consensus_infrastructure_l2_bridge: { cs: 'Core, consensus, infrastructure, L2 bridge', en: 'Core, consensus, infrastructure, L2 bridge' }
    fee_split_89_5_5_1: { cs: 'Fee split 89/5/5/1', en: 'Fee split 89/5/5/1' }
    pplns_payout_verified_and_active: { cs: 'PPLNS payout ověřen a aktivní', en: 'PPLNS payout verified and active' }
    core_edge_topology: { cs: 'Core + Edge topologie', en: 'Core + Edge topology' }
    private_vpn_active: { cs: 'Privátní VPN aktivní', en: 'Private VPN active' }
    docker_compose_mainnet: { cs: 'Docker Compose mainnet', en: 'Docker Compose mainnet' }
    ready_for_deployment: { cs: 'Připraveno pro deployment', en: 'Ready for deployment' }
    security_cleanup: { cs: 'Bezpečnostní cleanup', en: 'Security cleanup' }
    credential_rotation_complete: { cs: 'Credential rotation dokončen', en: 'Credential rotation complete' }
    final_payout_verification: { cs: 'Finální payout verification', en: 'Final payout verification' }
    pplns_window_validation_in_progress: { cs: 'PPLNS window validace probíhá', en: 'PPLNS window validation in progress' }
    security_audit: { cs: 'Security audit', en: 'Security audit' }
    external_firm_booked: { cs: 'Externí firma rezervována', en: 'External firm booked' }
    bridge_validator_key_provisioning: { cs: 'Bridge validator provisioning', en: 'Bridge validator key provisioning' }
    3_5_threshold_production: { cs: '3/5 threshold produkce', en: '3/5 threshold production' }
    ci_billing_resolution: { cs: 'CI billing', en: 'CI billing resolution' }
    github_actions_infrastructure_pending: { cs: 'GitHub Actions infrastruktura', en: 'GitHub Actions infrastructure pending' }
    genesis_premine: { cs: 'Genesis premine', en: 'Genesis premine' }
    16_28b_zion_12_wallets: { cs: '16.28B ZION, 12 peněženek', en: '16.28B ZION, 12 wallets' }
    wzion_erc_20: { cs: 'wZION ERC-20', en: 'wZION ERC-20' }
    deployed_on_base_mainnet: { cs: 'Deployed na Base Mainnet', en: 'Deployed on Base Mainnet' }
    zionstaking: { cs: 'ZIONStaking', en: 'ZIONStaking' }
    12_apr_7_day_cooldown: { cs: '12% APR, 7-denní cooldown', en: '12% APR, 7-day cooldown' }
    pplns_fee_split_final_verification: { cs: 'PPLNS fee split finální ověření', en: 'PPLNS fee split final verification' }
    confirm_89_5_5_1_wiring: { cs: 'Potvrdit 89/5/5/1 wiring', en: 'Confirm 89/5/5/1 wiring' }
    launch_checklist_dashboard_integration: { cs: 'Launch checklist dashboard integrace', en: 'Launch checklist dashboard integration' }
    connect_to_mission_control: { cs: 'Propojit s Mission Control', en: 'Connect to Mission Control' }
    bfg_scrub_git_history: { cs: 'BFG scrub / git historie', en: 'BFG scrub / git history' }
    final_cleanup_before_launch: { cs: 'Finální cleanup před launch', en: 'Final cleanup before launch' }
    all: { cs: 'Vse', en: 'All' }
    mining: { cs: 'Tezba', en: 'Mining' }
    inspect: { cs: 'Zkontrolovat', en: 'Inspect' }
    offline: { cs: 'Offline', en: 'Offline' }
    online: { cs: 'Online', en: 'Online' }
    syncing: { cs: 'Synchronizace', en: 'Syncing' }
    stale: { cs: 'Neaktualni', en: 'Stale' }
    unhealthy: { cs: 'Nezdrave', en: 'Unhealthy' }
    height: { cs: 'Vyska', en: 'Height' }
    peers: { cs: 'Peeri', en: 'Peers' }
    difficulty: { cs: 'Obtiznost', en: 'Difficulty' }
    last_block: { cs: 'Posledni blok', en: 'Last Block' }
    containers: { cs: 'Kontejnery', en: 'Containers' }
    memory: { cs: 'Pamet', en: 'Memory' }
    disk: { cs: 'Disk', en: 'Disk' }
    load: { cs: 'Zatez', en: 'Load' }
    ports: { cs: 'Porty', en: 'Ports' }
    close_details: { cs: 'Zavrit detail', en: 'Close details' }
    service_detail: { cs: 'Detail sluzby', en: 'Service Detail' }
    status: { cs: 'Stav', en: 'Status' }
    operational_context: { cs: 'Provozni kontext', en: 'Operational Context' }
    local_service_without_a_direct_prometheus_scr: { cs: 'Lokalni sluzba bez primeho Prometheus scrape targetu.', en: 'Local service without a direct Prometheus scrape target.' }
    quick_actions: { cs: 'Rychle akce', en: 'Quick Actions' }
    operator_notes: { cs: 'Poznamky operatora', en: 'Operator Notes' }
    status_down_means_a_scrape_failure_or_an_unre: { cs: 'Stav DOWN znamena scrape fail nebo nedostupny target.', en: 'Status DOWN means a scrape failure or an unreachable target.' }
    status_n_a_means_the_service_is_not_connected: { cs: 'Stav N/A znamena, ze sluzba neni napojena primo na Prometheus scrape.', en: 'Status N/A means the service is not connected directly to a Prometheus scrape.' }
    use_the_monitoring_or_grafana_actions_above_f: { cs: 'Pro hlubsi drill-down pouzij akce Monitoring nebo Grafana vyse.', en: 'Use the Monitoring or Grafana actions above for deeper drill-down.' }
    awaiting_data: { cs: 'cekam na data', en: 'awaiting data' }
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    core_node: { cs: 'Core node', en: 'Core Node' }
    mining_pool: { cs: 'Mining pool', en: 'Mining Pool' }
    miner_runtime: { cs: 'Miner runtime', en: 'Miner Runtime' }
    block: { cs: 'Blok', en: 'Block' }
    blocks_acc: { cs: 'Prijate bloky', en: 'Blocks Acc' }
    tmpl_txs: { cs: 'Tx v sablone', en: 'Tmpl Txs' }
    tmpl_fees: { cs: 'Fee sablony', en: 'Tmpl Fees' }
    chain_height_1h: { cs: 'Vyska chainu — 1h', en: 'Chain Height — 1h' }
    active_miners_1h: { cs: 'Aktivni mineri — 1h', en: 'Active Miners — 1h' }
    accepted_shares_1h: { cs: 'Prijate shares — 1h', en: 'Accepted Shares — 1h' }
    miner_target: { cs: 'Cil minera', en: 'Miner Target' }
    hashrate_10s: { cs: 'Hashrate 10 s', en: 'Hashrate 10s' }
    hashrate_60s: { cs: 'Hashrate 60 s', en: 'Hashrate 60s' }
    accepted: { cs: 'Prijate', en: 'Accepted' }
    rejected: { cs: 'Odmitnute', en: 'Rejected' }
    accept_rate: { cs: 'Accept rate', en: 'Accept Rate' }
    submit_avg: { cs: 'Prumer submitu', en: 'Submit Avg' }
    pool_height: { cs: 'Vyska poolu', en: 'Pool Height' }
    miner_hashrate_1h: { cs: 'Hashrate minera — 1 h', en: 'Miner Hashrate — 1h' }
    pool_routing_groups: { cs: 'Routing skupiny poolu', en: 'Pool Routing Groups' }
    cpu_load: { cs: 'CPU zatez', en: 'CPU Load' }
    server_uptime: { cs: 'Uptime serveru', en: 'Server Uptime' }
    since: { cs: 'od', en: 'since' }
    30_live_prometheus_metrics: { cs: '30+ zivych Prometheus metrik', en: '30+ live Prometheus metrics' }
    instant_range_queries: { cs: 'Instantni + range dotazy', en: 'Instant + Range queries' }
    15s_auto_refresh: { cs: 'Auto-refresh 15 s', en: '15s auto-refresh' }
    svg_sparklines_1h: { cs: 'SVG sparkliny (1 h)', en: 'SVG sparklines (1h)' }
    full_monitoring_page: { cs: 'Cela monitoring stranka →', en: 'Full monitoring page →' }
    open_grafana: { cs: 'Otevrit Grafanu →', en: 'Open Grafana →' }
    signed_tx_only: { cs: 'JEN PODEPSANE TX', en: 'SIGNED TX ONLY' }
    wallet_diagnostics_transaction_submit: { cs: 'Diagnostika walletu a odeslani transakce', en: 'Wallet Diagnostics & Transaction Submit' }
    live_rpc_health_balance_utxo_snapshot_miner_p: { cs: 'Zive zdravi RPC, balance, UTXO snapshot, viditelnost payoutu minera a bezpecny broadcast jiz podepsane transakce bez prace s privatnimi klici na serveru.', en: 'Live RPC health, balance, UTXO snapshot, miner payout visibility, and safe broadcast of an already signed transaction without handling private keys on the server.' }
    chain_height: { cs: 'Vyska chainu', en: 'Chain Height' }
    network: { cs: 'Sit', en: 'Network' }
    rpc_version: { cs: 'Verze RPC', en: 'RPC Version' }
    wallet_address_or_account: { cs: 'Adresa walletu nebo ucet', en: 'Wallet Address Or Account' }
    loading: { cs: 'Nacitam…', en: 'Loading…' }
    load_wallet: { cs: 'Nacist wallet', en: 'Load Wallet' }
    address: { cs: 'Adresa', en: 'Address' }
    not_loaded: { cs: 'nenacteno', en: 'not loaded' }
    utxo_count: { cs: 'Pocet UTXO', en: 'UTXO Count' }
    utxo_total: { cs: 'UTXO celkem', en: 'UTXO Total' }
    miner_pending: { cs: 'Miner pending', en: 'Miner Pending' }
    miner_paid: { cs: 'Miner vyplaceno', en: 'Miner Paid' }
    miner_shares: { cs: 'Miner shares', en: 'Miner Shares' }
    recent_utxos: { cs: 'Posledni UTXO', en: 'Recent UTXOs' }
    top_20_from_rpc: { cs: 'top 20 z RPC', en: 'top 20 from RPC' }
    height_1: { cs: 'vyska', en: 'height' }
    no_utxos_returned_for_this_address: { cs: 'Pro tuto adresu se nevratilo zadne UTXO.', en: 'No UTXOs returned for this address.' }
    load_a_zion1_address_to_inspect_utxos: { cs: 'Nacti adresu zion1 pro kontrolu UTXO.', en: 'Load a zion1 address to inspect UTXOs.' }
    rpc_submit_tester: { cs: 'RPC tester odeslani', en: 'RPC Submit Tester' }
    signed_payload_only: { cs: 'jen podepsany payload', en: 'signed payload only' }
    submitting: { cs: 'Odesilam…', en: 'Submitting…' }
    broadcast_signed_tx: { cs: 'Broadcast podepsane TX', en: 'Broadcast Signed TX' }
    method: { cs: 'metoda', en: 'method' }
    accepted_1: { cs: 'prijato', en: 'accepted' }
    yes: { cs: 'ano', en: 'yes' }
    no: { cs: 'ne', en: 'no' }
    done: { cs: 'Hotovo', en: 'Done' }
    missing_before_public_launch: { cs: 'Chybí před public launch', en: 'Missing before public launch' }
    no_longer_missing: { cs: 'Co už nechybí', en: 'No longer missing' }
    next_48_72h: { cs: 'Další 48-72h', en: 'Next 48-72h' }
    live_telemetry: { cs: 'Ziva telemetrie', en: 'Live Telemetry' }
    mission_control: { cs: 'Rizeni mise', en: 'Mission Control' }
    live_data_30s_refresh: { cs: 'ZIVA DATA · refresh 30 s', en: 'LIVE DATA · 30s refresh' }
    all_systems_healthy: { cs: 'Vsechny systemy zdrave', en: 'All Systems Healthy' }
    partial_systems_up: { cs: 'Cast systemu online', en: 'Partial Systems Up' }
    systems_monitoring: { cs: 'Monitoring systemu', en: 'Systems Monitoring' }
    live: { cs: 'ZIVE', en: 'LIVE' }
    loading_mission_control_data: { cs: 'Nacitam data Mission Control…', en: 'Loading Mission Control data…' }
    live_telemetry_unavailable: { cs: 'Ziva telemetrie neni dostupna', en: 'Live telemetry unavailable' }
    node_api_temporarily_unreachable_roadmap_cons: { cs: 'Node API je docasne nedostupne - zalozky roadmapy a ustavy stale funguji.', en: 'Node API temporarily unreachable - roadmap & constitution tabs still work.' }
    retry: { cs: 'Zkusit znovu', en: 'Retry' }
    launch_readiness_pre_launch_blockers: { cs: 'Připravenost k launchi — Pre-Launch Blockers', en: 'Launch Readiness — Pre-Launch Blockers' }
    no_items: { cs: 'Žádné položky', en: 'No items' }
    golden_compass_seven_directions_of_terranova: { cs: 'Zlatý Kompas — sedm směrů TerraNova', en: 'Golden Compass — seven directions of TerraNova' }
    progress: { cs: 'Postup', en: 'Progress' }
    phase_0_spec_freeze_core_rewrite: { cs: 'Faze 0 — zmrazeni specifikace a prepis core', en: 'Phase 0 — Spec Freeze & Core Rewrite' }
    completed: { cs: 'DOKONCENO', en: 'COMPLETED' }
    architecture: { cs: 'Architektura', en: 'Architecture' }
    layer_stack: { cs: 'Vrstvovy stack', en: 'Layer Stack' }
    total_supply: { cs: 'Celkova zasoba', en: 'Total Supply' }
    mining_supply: { cs: 'Tezebni zasoba', en: 'Mining Supply' }
    genesis_premine_1: { cs: 'Genesis premine', en: 'Genesis Premine' }
    block_reward_d1: { cs: 'Block reward (D1)', en: 'Block Reward (D1)' }
    emission_model: { cs: 'Emisni model', en: 'Emission Model' }
    tail_emission: { cs: 'Tail emise', en: 'Tail Emission' }
    block_time: { cs: 'Cas bloku', en: 'Block Time' }
    60_seconds: { cs: '60 sekund', en: '60 seconds' }
    max_reorg: { cs: 'Max reorg', en: 'Max Reorg' }
    10_blocks: { cs: '10 bloku', en: '10 blocks' }
    soft_finality: { cs: 'Soft finalita', en: 'Soft Finality' }
    60_blocks: { cs: '60 bloku', en: '60 blocks' }
    coinbase_maturity: { cs: 'Coinbase maturity', en: 'Coinbase Maturity' }
    100_blocks: { cs: '100 bloku', en: '100 blocks' }
    distribution: { cs: 'Distribuce', en: 'Distribution' }
    89_miner_5_humanitarian_5_issobella_1_pool: { cs: '89 % miner · 5 % humanit. · 5 % Issobella · 1 % pool', en: '89% miner · 5% humanitarian · 5% Issobella · 1% pool' }
    atomic_units: { cs: 'Atomic units', en: 'Atomic Units' }
    1m_per_zion: { cs: '1M na ZION', en: '1M per ZION' }
    mining_horizon: { cs: 'Horizont tezby', en: 'Mining Horizon' }
    100_years_tail: { cs: '100+ let + tail ∞', en: '100+ years + tail ∞' }
    immediately_available: { cs: 'Okamzite dostupne', en: 'Immediately available' }
    infrastructure_dev: { cs: 'Infrastruktura a vyvoj', en: 'Infrastructure & Dev' }
    humanitarian_fund: { cs: 'Humanitarni fond', en: 'Humanitarian Fund' }
    zion_block_from_2126: { cs: 'ZION/block ∞ (od 2126)', en: 'ZION/block ∞ (from 2126)' }
    miner_humanitarian_issobella_pool: { cs: 'miner / humanit. / Issobella / pool', en: 'miner / humanitarian / Issobella / pool' }
    100_years: { cs: '100+ let', en: '100+ years' }
    perpetual_tail: { cs: '+ perpetualni tail ∞', en: '+ perpetual tail ∞' }
    l5_l6_treasury: { cs: 'L5 / L6 Pokladna', en: 'L5 / L6 Treasury' }
    humanitarian_fund_space_station: { cs: 'Humanitární fond & Vesmírná stanice', en: 'Humanitarian Fund & Space Station' }
    5_of_every_block_reward_goes_to_the_l5_humani: { cs: '5 % každého blokového odměny putuje na L5 humanitární fond a 5 % na L6 Issobella vesmírný fond.', en: '5% of every block reward goes to the L5 humanitarian fund and 5% to the L6 Issobella space fund.' }
    physical_communities_humanitarian_projects_fr: { cs: 'Fyzické komunity, humanitární projekty, Free Energy, terénní governance. Fond odemčen ve výšce bloku ~525,600.', en: 'Physical communities, humanitarian projects, Free Energy, on-ground governance. Fund unlocked at block ~525,600.' }
    orbital_station_space_research_seti_overview_: { cs: 'Orbitální stanice, vesmírný výzkum, SETI, Overview Effect protokoly. Fond odemčen ve výšce bloku ~525,600.', en: 'Orbital station, space research, SETI, Overview Effect protocols. Fund unlocked at block ~525,600.' }
    all_l1_transaction_fees: { cs: 'VSECHNY L1 TRANSAKCNI POPLATKY → ', en: 'ALL L1 TRANSACTION FEES → ' }
    burned: { cs: 'SPALENY', en: 'BURNED' }
    sent_to_a_burn_address_without_a_private_key_: { cs: 'Posilany na burn adresu bez privatniho klice → deflacni tlak', en: 'Sent to a burn address without a private key → deflationary pressure' }
    priorities: { cs: 'Priority', en: 'Priorities' }
  },
  newsFeed: {
    news_updates: { cs: 'Novinky a aktualizace', en: 'News & Updates' }
    news: { cs: 'Novinky', en: 'News' }
    read_more: { cs: 'Číst více', en: 'Read more' }
  },
  deekshaNews: {
    deeksha_lite_news: { cs: 'Deeksha Lite — Novinky', en: 'Deeksha Lite — News' }
    news_lite: { cs: 'Novinky (Lite)', en: 'News (Lite)' }
  },
  walletPage: {
    ed25519: { cs: 'Ed25519', en: 'Ed25519' }
    state_of_the_art_curve_cryptography_fast_and_: { cs: 'Nejmodernější křivková kryptografie — rychlé a bezpečné podpisy.', en: 'State-of-the-art curve cryptography — fast and secure signatures.' }
    bip39_mnemonic: { cs: 'BIP39 Mnemonic', en: 'BIP39 Mnemonic' }
    12_24_word_seed_for_easy_backup_and_recovery: { cs: '12–24 slovní seed pro snadné zálohování a obnovení.', en: '12–24 word seed for easy backup and recovery.' }
    utxo_model: { cs: 'UTXO Model', en: 'UTXO Model' }
    native_zion_l1_utxo_model_transparent_and_aud: { cs: 'Nativní UTXO model ZION L1 — transparentní a auditovatelný.', en: 'Native ZION L1 UTXO model — transparent and auditable.' }
    on_chain: { cs: 'On-Chain', en: 'On-Chain' }
    fully_on_chain_wallet_no_custodial_services: { cs: 'Plně on-chain wallet — žádné custodial služby.', en: 'Fully on-chain wallet — no custodial services.' }
    initializing_zion_wallet: { cs: 'Inicializace ZION Wallet...', en: 'Initializing ZION Wallet...' }
    password_must_be_at_least_8_characters: { cs: 'Heslo musí mít alespoň 8 znaků', en: 'Password must be at least 8 characters' }
    wallet_created_successfully: { cs: 'Peněženka vytvořena!', en: 'Wallet created successfully!' }
    mnemonic_and_password_required: { cs: 'Vyžadováno mnemonic a heslo', en: 'Mnemonic and password required' }
    wallet_imported_successfully: { cs: 'Peněženka importována!', en: 'Wallet imported successfully!' }
    private_key_and_password_required: { cs: 'Vyžadován private key a heslo', en: 'Private key and password required' }
    fill_all_required_fields: { cs: 'Vyplňte všechna povinná pole', en: 'Fill all required fields' }
    trezor_wallet_connected: { cs: 'Trezor peněženka připojena!', en: 'Trezor wallet connected!' }
    ledger_wallet_connected: { cs: 'Ledger peněženka připojena!', en: 'Ledger wallet connected!' }
    copied_to_clipboard: { cs: 'Zkopírováno do schránky!', en: 'Copied to clipboard!' }
    native_zion_blockchain_wallet: { cs: 'Nativní peněženka ZION blockchainu', en: 'Native ZION blockchain wallet' }
    zion_wallet: { cs: 'ZION Wallet', en: 'ZION Wallet' }
    local_only: { cs: 'Local-only', en: 'Local-only' }
    features: { cs: 'Vlastnosti', en: 'Features' }
    why_zion_wallet: { cs: 'Proč ZION Wallet?', en: 'Why ZION Wallet?' }
    active_wallet: { cs: 'Aktivní peněženka', en: 'Active Wallet' }
    hardware_wallet_watch_only: { cs: 'Hardware peněženka — pouze pro sledování', en: 'Hardware Wallet — Watch Only' }
    your_wallets: { cs: 'Vaše peněženky', en: 'Your Wallets' }
    create_new_wallet: { cs: 'Vytvořit novou peněženku', en: 'Create New Wallet' }
    wallet_name: { cs: 'Název peněženky', en: 'Wallet Name' }
    password_min_8_chars: { cs: 'Heslo (min. 8 znaků)', en: 'Password (min 8 chars)' }
    creating: { cs: 'Vytváření...', en: 'Creating...' }
    create_wallet: { cs: 'Vytvořit peněženku', en: 'Create Wallet' }
    import_wallet: { cs: 'Importovat peněženku', en: 'Import Wallet' }
    from_mnemonic_bip39: { cs: 'Z Mnemonic (BIP39)', en: 'From Mnemonic (BIP39)' }
    enter_12_or_24_word_mnemonic_phrase: { cs: 'Zadejte 12 nebo 24 slovní frázi...', en: 'Enter 12 or 24 word mnemonic phrase...' }
    encryption_password: { cs: 'Šifrovací heslo', en: 'Encryption password' }
    importing: { cs: 'Importování...', en: 'Importing...' }
    import_from_mnemonic: { cs: 'Importovat z Mnemonic', en: 'Import from Mnemonic' }
    from_private_key_hex: { cs: 'Z Private Key (hex)', en: 'From Private Key (hex)' }
    64_char_hex_private_key: { cs: '64-znakový hex private key', en: '64-char hex private key' }
    import_from_private_key: { cs: 'Importovat z Private Key', en: 'Import from Private Key' }
    hardware_wallet_watch_only_1: { cs: 'Hardware peněženka (Watch-only)', en: 'Hardware Wallet (Watch-only)' }
    import_public_key_from_trezor_or_ledger: { cs: 'Importujte veřejný klíč z Trezoru nebo Ledgeru.', en: 'Import public key from Trezor or Ledger.' }
    connecting: { cs: 'Připojování...', en: 'Connecting...' }
    send_zion: { cs: 'Odeslat ZION', en: 'Send ZION' }
    select_or_create_a_wallet_first: { cs: 'Nejprve vyberte nebo vytvořte peněženku.', en: 'Select or create a wallet first.' }
    recipient_address_zion1: { cs: 'Adresa příjemce (zion1...)', en: 'Recipient Address (zion1...)' }
    amount_zion: { cs: 'Částka (ZION)', en: 'Amount (ZION)' }
    memo_optional: { cs: 'Memo (volitelné)', en: 'Memo (optional)' }
    optional_message: { cs: 'Volitelná zpráva...', en: 'Optional message...' }
    wallet_password: { cs: 'Heslo peněženky', en: 'Wallet Password' }
    enter_wallet_password: { cs: 'Zadejte heslo peněženky', en: 'Enter wallet password' }
    sending: { cs: 'Odesílání...', en: 'Sending...' }
    export_wallet_secrets: { cs: 'Exportovat tajemství', en: 'Export Wallet Secrets' }
    select_a_wallet_first: { cs: 'Nejprve vyberte peněženku.', en: 'Select a wallet first.' }
    enter_password_to_decrypt: { cs: 'Zadejte heslo pro dešifrování', en: 'Enter password to decrypt' }
    export_mnemonic: { cs: 'Exportovat Mnemonic', en: 'Export Mnemonic' }
    export_private_key: { cs: 'Exportovat Private Key', en: 'Export Private Key' }
    secret_never_share: { cs: 'Tajemství (nikdy nesdílejte!)', en: 'Secret (never share!)' }
    learn_more_about_zion_wallet: { cs: 'Více o ZION Wallet', en: 'Learn more about ZION Wallet' }
    download: { cs: 'Stáhnout', en: 'Download' }
    documentation: { cs: 'Dokumentace', en: 'Documentation' }
  },
  bridgePage: {
    lock_zion_on_l1: { cs: 'Zamkni ZION na L1', en: 'Lock ZION on L1' }
    relay_detects_verifies: { cs: 'Relay ověří', en: 'Relay detects & verifies' }
    receive_wzion_on_base: { cs: 'Přijmi wZION na Base', en: 'Receive wZION on Base' }
    burn_wzion_on_base: { cs: 'Spal wZION na Base', en: 'Burn wZION on Base' }
    relay_verifies_burn: { cs: 'Relay ověří burn', en: 'Relay verifies burn' }
    receive_zion_on_l1: { cs: 'Přijmi ZION na L1', en: 'Receive ZION on L1' }
    how_long_does_bridging_take: { cs: 'Jak dlouho bridge trvá?', en: 'How long does bridging take?' }
    what_is_the_minimum_bridge_amount: { cs: 'Jaký je minimální množství?', en: 'What is the minimum bridge amount?' }
    what_memo_format_is_required_for_l1_base: { cs: 'Jaký formát memo je potřeba?', en: 'What memo format is required for L1 → Base?' }
    is_there_a_bridge_fee: { cs: 'Jaký je poplatek?', en: 'Is there a bridge fee?' }
    what_happens_if_a_transaction_is_lost: { cs: 'Co když se transakce ztratí?', en: 'What happens if a transaction is lost?' }
    is_the_bridge_safe: { cs: 'Je bridge bezpečný?', en: 'Is the bridge safe?' }
    checking_status: { cs: 'Kontroluji stav…', en: 'Checking status…' }
    refresh: { cs: 'Obnovit', en: 'Refresh' }
    direction_a: { cs: 'Směr A', en: 'Direction A' }
    step: { cs: 'Krok', en: 'Step' }
    locks: { cs: 'Zámků', en: 'Locks' }
    mints: { cs: 'Mintů', en: 'Mints' }
    direction_b: { cs: 'Směr B', en: 'Direction B' }
    burns: { cs: 'Burnů', en: 'Burns' }
    unlocks: { cs: 'Unlocků', en: 'Unlocks' }
    burn_wzion_directly: { cs: 'Spal wZION přímo tady', en: 'Burn wZION directly' }
    have_wzion_on_base_connect_metamask_and_burn_: { cs: 'Máš wZION na Base? Připoj MetaMask a spal přímo z této stránky.', en: 'Have wZION on Base? Connect MetaMask and burn directly from this page.' }
    what_happens_after_you_burn: { cs: 'Co se stane po spalení', en: 'What happens after you burn' }
    event_emitted_on_base: { cs: 'event emitován na Base', en: 'event emitted on Base' }
    evm_watcher_waits: { cs: 'EVM watcher čeká', en: 'EVM watcher waits' }
    blocks: { cs: 'bloků', en: 'blocks' }
    relay_submits_unlock_to_zion_l1: { cs: 'Relay odešle unlock na ZION L1', en: 'Relay submits unlock to ZION L1' }
    l1_releases_zion_to_your_address: { cs: 'L1 uvolní ZION na tvou adresu', en: 'L1 releases ZION to your address' }
    how_to_initiate_a_bridge_transfer: { cs: 'Jak zahájit bridge transfer', en: 'How to initiate a bridge transfer' }
    detailed_instructions_for_both_directions_inc: { cs: 'Podrobné instrukce pro oba směry — včetně formátu L1 memo.', en: 'Detailed instructions for both directions — including the required L1 memo format.' }
    add_your_evm_address_to_the_memo_builder_belo: { cs: 'Zadej svou EVM adresu do memo builderu', en: 'Add your EVM address to the memo builder below' }
    send_zion_to_the_bridge_address: { cs: 'Pošli ZION na bridge adresu', en: 'Send ZION to the bridge address' }
    include_the_generated_memo_minimum: { cs: 'Vlož vygenerované memo. Minimum:', en: 'Include the generated memo. Minimum:' }
    wait_10_min_60_l1_blocks: { cs: 'Počkej ~10 min (60 L1 bloků)', en: 'Wait ~10 min (60 L1 blocks)' }
    relay_detects_lock_waits_for_finality_mints_w: { cs: 'Relay detekuje lock, počká na finalitu, mintne wZION.', en: 'Relay detects lock, waits for finality, mints wZION.' }
    memo_format: { cs: 'Formát memo', en: 'Memo format' }
    use_the_burn_widget_above_or_basescan: { cs: 'Použij Burn widget výše nebo BaseScan', en: 'Use the Burn widget above or BaseScan' }
    call: { cs: 'Zavolej', en: 'Call' }
    your_l1_address: { cs: 'tvá L1 adresa', en: 'your L1 address' }
    wait_2_min_64_evm_blocks: { cs: 'Počkej ~2 min (64 EVM bloků)', en: 'Wait ~2 min (64 EVM blocks)' }
    example_500_wzion: { cs: 'Příklad: 500 wZION', en: 'Example: 500 wZION' }
    decimals: { cs: 'decimálů', en: 'decimals' }
    copied: { cs: 'Zkopírováno', en: 'Copied' }
    relay_statistics: { cs: 'Statistiky relay', en: 'Relay statistics' }
    efficiency: { cs: 'Efektivita', en: 'Efficiency' }
    errors: { cs: 'Chyby', en: 'Errors' }
    unlocks_1: { cs: 'Unlocky', en: 'Unlocks' }
    architecture: { cs: 'Architektura', en: 'Architecture' }
    native_chain: { cs: 'Nativní chain', en: 'Native chain' }
    polls_l1_api_parses_bridge_memos_validates_60: { cs: 'Polluje L1 API, parsuje BRIDGE: memos, validuje 60-block finalitu.', en: 'Polls L1 API, parses BRIDGE: memos, validates 60-block finality.' }
    scans_burnforbridge_events_on_base_in_49k_blo: { cs: 'Skenuje BurnForBridge eventy na Base v 49k-blokových chunkách.', en: 'Scans BurnForBridge events on Base in 49k-block chunks.' }
    submits_evm_mint_transactions_and_l1_unlock_c: { cs: 'Odesílá EVM mint TX a L1 unlock cally.', en: 'Submits EVM mint transactions and L1 unlock calls.' }
    insert_or_ignore_replay_safe_duplicates_skipp: { cs: 'INSERT OR IGNORE — replay-safe, duplikáty přeskočeny.', en: 'INSERT OR IGNORE — replay-safe, duplicates skipped.' }
    contract_addresses: { cs: 'Adresy kontraktů', en: 'Contract addresses' }
    copied_1: { cs: 'Zkopírováno!', en: 'Copied!' }
    security_model: { cs: 'Bezpečnostní model', en: 'Security model' }
    60_block_l1_finality: { cs: '60-block L1 finalita', en: '60-block L1 finality' }
    prevents_re_org_exploits: { cs: 'Prevence re-org exploitů.', en: 'Prevents re-org exploits.' }
    2_guardian_confirmations_for_treasury_operati: { cs: '≥2 Guardian potvrzení pro treasury operace.', en: '≥2 Guardian confirmations for treasury operations.' }
    duplicate_tx_cannot_be_replayed: { cs: 'Duplikátní TX nelze replayovat.', en: 'Duplicate TX cannot be replayed.' }
    faq: { cs: 'Časté dotazy', en: 'FAQ' }
    readiness_checklist: { cs: 'Readiness kontrola', en: 'Readiness checklist' }
    wzion_contract: { cs: 'wZION kontrakt', en: 'wZION contract' }
    zionbridge_contract: { cs: 'ZIONBridge kontrakt', en: 'ZIONBridge contract' }
    basescan_verified: { cs: 'BaseScan verifikace', en: 'BaseScan verified' }
    3_5_guardian_multisig: { cs: '3/5 Guardian multisig', en: '3/5 Guardian multisig' }
    relay_metrics: { cs: 'Relay metrics', en: 'Relay metrics' }
    burn_widget_live: { cs: 'Burn widget (live)', en: 'Burn widget (live)' }
    l1_base_mint: { cs: 'L1 → Base (mint)', en: 'L1 → Base (mint)' }
    base_l1_unlock: { cs: 'Base → L1 (unlock)', en: 'Base → L1 (unlock)' }
    resources: { cs: 'Zdroje', en: 'Resources' }
    architecture_docs: { cs: 'Dokumentace', en: 'Architecture docs' }
    relay_design_guardian_flow_security_model: { cs: 'Relay design, Guardian flow, bezpečnostní model.', en: 'Relay design, Guardian flow, security model.' }
    wzion_contract_source_on_base_mainnet: { cs: 'Kód wZION kontraktu na Base Mainnet.', en: 'wZION contract source on Base Mainnet.' }
    swap_wzion_eth_portfolio_pool_price: { cs: 'Swap wZION/ETH, portfolio, pool cena.', en: 'Swap wZION/ETH, portfolio, pool price.' }
  },
  daoPage: {
    phase_1_stewardship_2025: { cs: 'Fáze 1 · Stewardship (2025)', en: 'Phase 1 · Stewardship (2025)' }
    phase_2_hybrid_dao_2026: { cs: 'Fáze 2 · Hybridní DAO (2026)', en: 'Phase 2 · Hybrid DAO (2026)' }
    phase_3_full_dao_2026: { cs: 'Fáze 3 · Plné DAO (2026+)', en: 'Phase 3 · Full DAO (2026+)' }
    governance_docs: { cs: 'Governance dokumentace', en: 'Governance docs' }
    proposal_flow_voting_power_emergency_clauses: { cs: 'Proposal flow, hlasovací síla, nouzové klauzule.', en: 'Proposal flow, voting power, emergency clauses.' }
    treasury_dashboard: { cs: 'Treasury dashboard', en: 'Treasury dashboard' }
    real_time_balances_allocation_overview_tithe: { cs: 'Real-time zůstatky, přehled alokací, tithe.', en: 'Real-time balances, allocation overview, tithe.' }
    defi_hub: { cs: 'DeFi Hub', en: 'DeFi Hub' }
    swap_bridge_and_portfolio_on_base_mainnet: { cs: 'Swap, bridge a portfolio na Base Mainnet.', en: 'Swap, bridge and portfolio on Base Mainnet.' }
    governance: { cs: 'Správa', en: 'Governance' }
    treasury_proposals_voting: { cs: 'Treasury · návrhy · hlasování', en: 'Treasury · proposals · voting' }
    loading: { cs: 'Načítám…', en: 'Loading…' }
    refresh_data: { cs: 'Obnovit data', en: 'Refresh Data' }
    governance_docs_1: { cs: 'Dokumentace governance', en: 'Governance docs' }
    dao_daemon_phase_2_hybrid_dao: { cs: 'DAO Daemon — Fáze 2 (Hybridní DAO)', en: 'DAO Daemon — Phase 2 (Hybrid DAO)' }
    treasury_overview: { cs: 'Přehled treasury', en: 'Treasury overview' }
    available: { cs: 'K dispozici', en: 'Available' }
    pending_ops: { cs: 'Čekající operace', en: 'Pending Ops' }
    daily_limit: { cs: 'Denní limit', en: 'Daily Limit' }
    governance_phases: { cs: 'Fáze governance', en: 'Governance phases' }
    road_to_full_decentralization: { cs: 'Cesta k plné decentralizaci', en: 'Road to full decentralization' }
    governance_proposals: { cs: 'Governance návrhy', en: 'Governance proposals' }
    vote_on_protocol_decisions: { cs: 'Hlasuj o rozhodnutích', en: 'Vote on protocol decisions' }
    create_proposal: { cs: 'Vytvořit návrh', en: 'Create Proposal' }
    loading_proposals: { cs: 'Načítám návrhy…', en: 'Loading proposals…' }
    no_proposals_yet: { cs: 'Zatím žádné návrhy', en: 'No proposals yet' }
    be_the_first_to_create_a_governance_proposal: { cs: 'Buď první, kdo vytvoří governance návrh!', en: 'Be the first to create a governance proposal!' }
    humanitarian_tithe: { cs: 'Humanitární desátek', en: 'Humanitarian Tithe' }
    total_projects: { cs: 'Celkem projektů', en: 'Total Projects' }
    active_funding: { cs: 'Aktivní financování', en: 'Active Funding' }
    beneficiaries: { cs: 'Příjemci', en: 'Beneficiaries' }
    funded_amount: { cs: 'Financováno', en: 'Funded Amount' }
    multi_layer_governance: { cs: 'Vícevrstvá správa', en: 'Multi-Layer Governance' }
    co_admin_sacred_trinity: { cs: 'Co-Admin & Posvátná trojice', en: 'Co-Admin & Sacred Trinity' }
    co_admin_system: { cs: 'Co-Admin systém', en: 'Co-Admin System' }
    co_admin: { cs: 'Co-Admin', en: 'Co-Admin' }
    dao_authority: { cs: 'DAO autorita', en: 'DAO authority' }
    sacred_trinity: { cs: 'Posvátná trojice', en: 'Sacred Trinity' }
    steward_consensus_l1: { cs: 'Správce · Konsenzus · L1', en: 'Steward · Consensus · L1' }
    chain_dharma_fair_mining_protocol_integrity: { cs: 'Dharma chainu, fair mining, protokolová integrita', en: 'Chain dharma, fair mining, protocol integrity' }
    heart_community_l5: { cs: 'Srdce · Komunita · L5', en: 'Heart · Community · L5' }
    humanitarian_fund_physical_communities_care: { cs: 'Humanitární fond, fyzické komunity, péče', en: 'Humanitarian fund, physical communities, care' }
    guardian_bridge_l2: { cs: 'Ochránce · Bridge · L2', en: 'Guardian · Bridge · L2' }
    bridging_worlds_protection_faithful_service: { cs: 'Přemostění světů, ochrana, věrná služba', en: 'Bridging worlds, protection, faithful service' }
    consent_engine: { cs: 'Consent Engine', en: 'Consent Engine' }
    propose: { cs: 'Návrh', en: 'Propose' }
    any_co_admin: { cs: 'Jakýkoliv Co-Admin', en: 'Any Co-Admin' }
    consent: { cs: 'Souhlas', en: 'Consent' }
    affected_layers: { cs: 'Dotčené vrstvy', en: 'Affected layers' }
    veto_window: { cs: 'Veto okno', en: 'Veto window' }
    execute: { cs: 'Provedení', en: 'Execute' }
    after_consent: { cs: 'Po souhlasu', en: 'After consent' }
    dao_circles_governance_topology: { cs: 'DAO kruhy & topologie', en: 'DAO Circles & Governance Topology' }
    live_topology: { cs: 'Živá topologie', en: 'Live topology' }
    crown: { cs: 'Koruna', en: 'Crown' }
    guardians_council: { cs: 'Rada guardianů', en: 'Guardians Council' }
    top_dao_governance_layer_treasury_oversight_s: { cs: 'Vrchní vrstva správy DAO — dohled nad treasury, bezpečnostní revize a dlouhodobá vize.', en: 'Top DAO governance layer — treasury oversight, security reviews, and long-term vision.' }
    heart: { cs: 'Srdce', en: 'Heart' }
    builders_circle: { cs: 'Kruh stavitelů', en: 'Builders Circle' }
    ecosystem_heart_protocol_development_core_pro: { cs: 'Srdce ekosystému — vývoj protokolu, core návrhy a koordinace technických misí.', en: 'Ecosystem heart — protocol development, core proposals, and technical mission coordination.' }
    roots: { cs: 'Kořeny', en: 'Roots' }
    community_guild: { cs: 'Komunitní guilda', en: 'Community Guild' }
    dao_roots_open_community_contribution_streams: { cs: 'Kořeny DAO — otevřená komunita, contribution streamy, komunitní hlasování a růst sítě.', en: 'DAO roots — open community, contribution streams, community votes, and network growth.' }
    real_time_dao_tracking: { cs: 'Real-time DAO tracking', en: 'Real-time DAO tracking' }
    helpful_links: { cs: 'Užitečné odkazy', en: 'Helpful links' }
    open: { cs: 'Otevřít', en: 'Open' }
  },
  defiPage: {
    switch_to_base: { cs: 'Přepnout na Base', en: 'Switch to Base' }
    connect_wallet: { cs: 'Připojit peněženku', en: 'Connect Wallet' }
    price: { cs: 'Cena', en: 'Price' }
    how_bridge_works: { cs: 'Jak Bridge funguje', en: 'How Bridge Works' }
    lock_zion_on_l1_relay_mints_wzion_on_base_1_1: { cs: 'Zamkni ZION na L1 → relay mintne wZION na Base (1:1 peg)', en: 'Lock ZION on L1 → relay mints wZION on Base (1:1 peg)' }
    burn_wzion_on_base_relay_unlocks_zion_on_l1_w: { cs: 'Spal wZION na Base → relay odemkne ZION na L1 (do ~5 min)', en: 'Burn wZION on Base → relay unlocks ZION on L1 (within ~5 min)' }
    base_mainnet_contracts: { cs: 'Kontrakty na Base Mainnet', en: 'Base Mainnet Contracts' }
    contract: { cs: 'Kontrakt', en: 'Contract' }
    address: { cs: 'Adresa', en: 'Address' }
    trade_wzion: { cs: 'Obchoduj wZION', en: 'Trade wZION' }
    open_uniswap: { cs: 'Otevřít Uniswap', en: 'Open Uniswap' }
  },
  explorerPage: {
    block_archive: { cs: 'Archiv bloku', en: 'Block Archive' }
    complete_ledger_of_all_validated_blocks: { cs: 'Kompletni ledger vsech validovanych bloku', en: 'Complete ledger of all validated blocks' }
    transaction_feed: { cs: 'Tok transakci', en: 'Transaction Feed' }
    real_time_flow_of_funds_and_fees: { cs: 'Tok fondu a fee v realnem case', en: 'Real-time flow of funds and fees' }
    mempool: { cs: 'Mempool', en: 'Mempool' }
    pending_transactions_fee_histogram_double_spe: { cs: 'Cekajici transakce, fee histogram, double-spend', en: 'Pending transactions, fee histogram, double-spend' }
    bridge_tracker: { cs: 'Bridge Tracker', en: 'Bridge Tracker' }
    live_l1_base_bridge_status_lock_mint_burn_unl: { cs: 'Live stav L1↔Base mostu, lock/mint/burn/unlock', en: 'Live L1↔Base bridge status, lock/mint/burn/unlock' }
    network_peers: { cs: 'Sitovi peeri', en: 'Network Peers' }
    global_node_connectivity_map: { cs: 'Globalni mapa konektivity nodu', en: 'Global node connectivity map' }
    supply_dashboard: { cs: 'Supply Dashboard', en: 'Supply Dashboard' }
    circulating_mined_premine_decade_decay: { cs: 'Circulating, vytezeno, premine, Decade Decay', en: 'Circulating, mined, premine, Decade Decay' }
    charts_analytics: { cs: 'Grafy a analytika', en: 'Charts & Analytics' }
    historical_difficulty_hashrate_emission: { cs: 'Historicka obtiznost, hashrate a emise', en: 'Historical difficulty, hashrate & emission' }
    network_stats: { cs: 'Network Stats', en: 'Network Stats' }
    hashrate_difficulty_block_time_tx_trends: { cs: 'Hashrate, obtiznost, cas bloku, TX trendy', en: 'Hashrate, difficulty, block time, TX trends' }
    search: { cs: 'Hledat', en: 'Search' }
    unified_search_for_blocks_transactions_and_ad: { cs: 'Jednotne hledani bloku, tx a adres', en: 'Unified search for blocks, transactions and addresses' }
    explorer_api: { cs: 'API explorera', en: 'Explorer API' }
    direct_json_endpoints_for_integration_and_mon: { cs: 'Priame JSON endpointy pro integraci a monitoring', en: 'Direct JSON endpoints for integration and monitoring' }
    explorer_pro: { cs: 'Pruzkumnik Pro', en: 'Explorer Pro' }
    real_time: { cs: 'Zive', en: 'Real-Time' }
    blockchain_explorer: { cs: 'Průzkumník blockchainu', en: 'Blockchain Explorer' }
    live_mainnet_data: { cs: 'Zive mainnet data', en: 'Live Mainnet Data' }
    auto_refresh_15s: { cs: 'Auto-refresh 15 s', en: 'Auto-Refresh 15s' }
    telemetry: { cs: 'Telemetrie', en: 'Telemetry' }
    network_statistics: { cs: 'Sitove statistiky', en: 'Network Statistics' }
    real_time_metrics_from_the_zion_blockchain_da: { cs: 'Metriky v realnem case z blockchain daemonu ZION.', en: 'Real-time metrics from the ZION blockchain daemon.' }
    ledger: { cs: 'Ledger', en: 'Ledger' }
    blocks_transactions: { cs: 'Bloky a transakce', en: 'Blocks & Transactions' }
    latest_confirmed_blocks_and_transaction_feed_: { cs: 'Nejnovejsi potvrzene bloky a tok transakci ze chainu ZION.', en: 'Latest confirmed blocks and transaction feed from the ZION chain.' }
    quick_navigation: { cs: 'Rychla navigace', en: 'Quick Navigation' }
    jump_to_section: { cs: 'Skok do sekce', en: 'Jump to section' }
    analytics: { cs: 'Analytika', en: 'Analytics' }
    network_charts: { cs: 'Sitove grafy', en: 'Network Charts' }
    historical_difficulty_hashrate_emission_and_b: { cs: 'Historicke trendy obtiznosti, hashrate, emise a velikosti bloku.', en: 'Historical difficulty, hashrate, emission, and block size trends.' }
    supply: { cs: 'Zasoba', en: 'Supply' }
    emission_monitor: { cs: 'Monitoring emise', en: 'Emission Monitor' }
    track_mining_progress_decade_decay_5_400_724_: { cs: 'Sledujte postup tezby - Decade Decay: 5,400 -> 724 ZION/blok, 100+ let + tail ∞.', en: 'Track mining progress - Decade Decay: 5,400 -> 724 ZION/block, 100+ years + tail ∞.' }
    p2p_network: { cs: 'P2P sit', en: 'P2P Network' }
    current_public_host_connectivity_with_archive: { cs: 'Konektivita aktualniho verejneho hostu s archivovanou historii multi-host validace.', en: 'Current public host connectivity with archived multi-host validation history.' }
    distribution: { cs: 'Distribuce', en: 'Distribution' }
    rich_list: { cs: 'Rich list', en: 'Rich List' }
    top_zion_holders_by_balance_premine_allocatio: { cs: 'Top drzitele ZION podle zustatku - premine alokace, tezebni odmeny a ekonomika site.', en: 'Top ZION holders by balance - premine allocations, mining rewards, and network economics.' }
    real_time_blockchain_data_from_native_rust_no: { cs: 'Blockchain data v realnem case z nativnich Rust nodu. Kazdy blok, transakce a adresa - plne transparentni, plne otevrene.', en: 'Real-time blockchain data from native Rust nodes. Every block, transaction, and address - fully transparent, fully open.' }
    network_status: { cs: 'Stav site', en: 'Network Status' }
    roadmap: { cs: 'Roadmapa', en: 'Roadmap' }
  },
  networkPage: {
    public_nodes: { cs: 'Veřejné nody', en: 'Public Nodes' }
    p2p_mesh: { cs: 'P2P mesh', en: 'P2P Mesh' }
    core_edge: { cs: 'Core + Edge', en: 'Core + Edge' }
    vpn_tunnel_core_edge: { cs: 'VPN tunel — Core ↔ Edge', en: 'VPN tunnel — Core ↔ Edge' }
    telemetry: { cs: 'Telemetrie', en: 'Telemetry' }
    auto_refresh_interval: { cs: 'Interval auto-obnovení', en: 'Auto-refresh interval' }
    topology: { cs: 'Topologie', en: 'Topology' }
    edge_relay_core_master_pplns_window_on_core: { cs: 'Edge relay + Core master (PPLNS okno na Core)', en: 'Edge relay + Core master (PPLNS window on Core)' }
    network: { cs: 'Síť', en: 'Network' }
    edge_relay_hetzner_vps: { cs: 'Edge relay (Hetzner VPS)', en: 'Edge Relay (Hetzner VPS)' }
    active: { cs: 'Aktivní', en: 'Active' }
    core_private_master: { cs: 'Core (privátní master)', en: 'Core (private master)' }
    private_vpn: { cs: 'Privátní VPN', en: 'Private VPN' }
    vpn_tunnel: { cs: 'VPN tunel', en: 'VPN tunnel' }
    public_stratum: { cs: 'Verejny stratum', en: 'Public Stratum' }
    current_primary_mining_ingress_on_zion2: { cs: 'Aktualni primarni tezebni vstup na Zion2', en: 'Current primary mining ingress on Zion2' }
    native_rust_json_rpc_for_explorers_and_toolin: { cs: 'Nativni Rust JSON-RPC pro explorer a tooling', en: 'Native Rust JSON-RPC for explorers and tooling' }
    public_edge_relay_core_sync_via_private_vpn: { cs: 'Veřejný Edge relay — Core sync přes privátní VPN', en: 'Public Edge relay — Core sync via private VPN' }
    release_context: { cs: 'Kontext releasu', en: 'Release Context' }
    mining: { cs: 'Tezba', en: 'Mining' }
    connect_any_cosmic_harmony_cpu_miner_to_the_c: { cs: 'Pripojte jakykoli Cosmic Harmony / CPU miner k aktualnimu verejnemu poolu na Zion2.', en: 'Connect any Cosmic Harmony / CPU miner to the current public pool on Zion2.' }
    current_primary: { cs: '(aktualni primarni)', en: '(current primary)' }
    public_runtime_endpoint: { cs: 'verejny runtime endpoint', en: 'public runtime endpoint' }
    docs_2_9_8_march_status_reports: { cs: 'docs/2.9.8 + breznovy status report', en: 'docs/2.9.8 + March status reports' }
    public_peer_edge: { cs: 'Veřejný peer (Edge)', en: 'Public peer (Edge)' }
    core_peer_vpn_private_peer_non_public: { cs: 'Core peer (VPN): Privátní peer (neveřejný)', en: 'Core peer (VPN): Private peer (non-public)' }
    vpn_tunnel_wireguard_core_edge: { cs: 'VPN tunel: WireGuard (Core ↔ Edge)', en: 'VPN tunnel: WireGuard (Core ↔ Edge)' }
    native_rust_p2p_edge_relay_public: { cs: 'Nativní Rust P2P — Edge relay veřejný', en: 'Native Rust P2P — Edge relay public' }
    core_edge_topology_with_private_vpn_tunnel: { cs: 'Core + Edge topologie s privátním VPN tunelem', en: 'Core + Edge topology with private VPN tunnel' }
    edge_stratum_endpoint_77_42_71_94_8444_sharer: { cs: 'Edge stratum endpoint: 77.42.71.94:8444 (ShareRelay)', en: 'Edge stratum endpoint: 77.42.71.94:8444 (ShareRelay)' }
    json_rpc_endpoints_live_port_8443: { cs: 'JSON-RPC endpointy live (port 8443)', en: 'JSON-RPC endpoints live (port 8443)' }
    systemd_services_with_auto_restart_on_edge: { cs: 'systemd služby s auto-restartem na Edge', en: 'systemd services with auto-restart on Edge' }
    lwma_daa_target_60s_block_time: { cs: 'LWMA DAA — cíl 60s block time', en: 'LWMA DAA — target 60s block time' }
    sharerelay_protocol_edge_core_pplns_sync: { cs: 'ShareRelay protokol: Edge → Core PPLNS synchronizace', en: 'ShareRelay protocol: Edge → Core PPLNS sync' }
    prometheus_grafana_monitoring: { cs: 'Monitoring Prometheus + Grafana', en: 'Prometheus + Grafana monitoring' }
    ufw_firewall_on_edge_8333_8444_22_41641: { cs: 'UFW firewall na Edge (8333, 8444, 22, 41641)', en: 'UFW firewall on Edge (8333, 8444, 22, 41641)' }
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    network_1: { cs: 'Sit', en: 'Network' }
    live_status: { cs: 'Zivy stav', en: 'Live Status' }
    p2p_network: { cs: 'P2P Sit', en: 'P2P Network' }
    native_rust: { cs: 'Nativni Rust', en: 'Native Rust' }
    1_public_host_2_internal_seeds: { cs: '1 verejny host · 2 interni seedy', en: '1 Public Host · 2 Internal Seeds' }
    runtime_snapshot: { cs: 'Runtime prehled', en: 'Runtime Snapshot' }
    public_network_surface: { cs: 'Verejny povrch site', en: 'Public Network Surface' }
    the_current_live_footprint_distilled_to_the_e: { cs: 'Aktualni zivy footprint zredukovany na endpointy a role, ktere operatori potrebuji jako prvni.', en: 'The current live footprint distilled to the endpoints and roles operators actually need first.' }
    health: { cs: 'Zdraví', en: 'Health' }
    network_health_score: { cs: 'Skóre zdraví sítě', en: 'Network Health Score' }
    aggregate_health_indicator_based_on_key_netwo: { cs: 'Agregátní indikátor stavu sítě na základě klíčových metrik.', en: 'Aggregate health indicator based on key network metrics.' }
    node_online: { cs: 'Node online', en: 'Node Online' }
    blocks_mining: { cs: 'Bloky se těží', en: 'Blocks Mining' }
    active_miners: { cs: 'Aktivní mineři', en: 'Active Miners' }
    normal_block_time: { cs: 'Normální block time', en: 'Normal Block Time' }
    database_ok: { cs: 'Databáze OK', en: 'Database OK' }
    pool_online: { cs: 'Pool online', en: 'Pool Online' }
    of_100: { cs: 'ze 100', en: 'of 100' }
    excellent: { cs: 'Výborný', en: 'Excellent' }
    good: { cs: 'Dobrý', en: 'Good' }
    fair: { cs: 'Průměrný', en: 'Fair' }
    critical: { cs: 'Kritický', en: 'Critical' }
    ok: { cs: 'OK', en: 'OK' }
    fail: { cs: 'FAIL', en: 'FAIL' }
    pts: { cs: 'bodů', en: 'pts' }
    performance: { cs: 'Výkon', en: 'Performance' }
    chain_performance: { cs: 'Výkon chainu', en: 'Chain Performance' }
    live_sparklines_for_hashrate_difficulty_and_b: { cs: 'Živé grafy hashrate, obtížnosti a block time za poslední hodinu.', en: 'Live sparklines for hashrate, difficulty, and block time over the last hour.' }
    network_hashrate: { cs: 'Hashrate sítě', en: 'Network Hashrate' }
    difficulty: { cs: 'Obtížnost', en: 'Difficulty' }
    avg_block_time: { cs: 'Průměrný block time', en: 'Avg Block Time' }
    target: { cs: 'Cíl', en: 'Target' }
    statistics: { cs: 'Statistika', en: 'Statistics' }
    chain_statistics: { cs: 'Statistiky chainu', en: 'Chain Statistics' }
    detailed_metrics_from_the_live_blockchain: { cs: 'Detailní metriky z živého blockchainu.', en: 'Detailed metrics from the live blockchain.' }
    block_height: { cs: 'Výška bloku', en: 'Block Height' }
    cumulative_diff: { cs: 'Kumulativní obtížnost', en: 'Cumulative Diff' }
    circulating_supply: { cs: 'Oběžná zásoba', en: 'Circulating Supply' }
    emission: { cs: 'Emise', en: 'Emission' }
    total_tx: { cs: 'Celkem TX', en: 'Total TX' }
    total_peers: { cs: 'Peery celkem', en: 'Total Peers' }
    known_peers: { cs: 'Známé peery', en: 'Known Peers' }
    block_size_limit: { cs: 'Limit bloku', en: 'Block Size Limit' }
    median: { cs: 'Medián', en: 'Median' }
    database: { cs: 'Databáze', en: 'Database' }
    version: { cs: 'Verze', en: 'Version' }
    alt_blocks: { cs: 'Alt bloky', en: 'Alt Blocks' }
    pool_hashrate: { cs: 'Pool hashrate', en: 'Pool Hashrate' }
    pool_blocks: { cs: 'Pool bloky', en: 'Pool Blocks' }
    last_block: { cs: 'Poslední blok', en: 'Last Block' }
    last_reward: { cs: 'Odměna', en: 'Last Reward' }
    emission_progress: { cs: 'Průběh emise', en: 'Emission Progress' }
    decade_decay_model_20_every_10_years_max_supp: { cs: 'Decade Decay model: -20 % každých 10 let. Max supply 144 miliard ZION.', en: 'Decade Decay model: -20% every 10 years. Max supply 144 billion ZION.' }
    mined: { cs: 'Vytěženo', en: 'Mined' }
    decade: { cs: 'Dekáda', en: 'Decade' }
    now: { cs: 'Nyní', en: 'Now' }
    block: { cs: 'blok', en: 'block' }
    infrastructure: { cs: 'Infrastruktura', en: 'Infrastructure' }
    current_runtime: { cs: 'Aktualni runtime', en: 'Current Runtime' }
    current_public_runtime_is_a_single_primary_ho: { cs: 'Aktualni verejny runtime je jeden primarni host. Drivejsi multi-host validace zustava zdokumentovana jako archivovana historie validace.', en: 'Current public runtime is a single primary host. Earlier multi-host validation remains documented as archived validation history.' }
    stratum_port_3333: { cs: 'Stratum: port 3333', en: 'Stratum: port 3333' }
    live_telemetry: { cs: 'Ziva telemetrie', en: 'Live Telemetry' }
    node_status: { cs: 'Stav nodu', en: 'Node Status' }
    real_time_health_block_height_hashrate_and_sy: { cs: 'Zdravi, vyska chainu, hashrate a sync stav v realnem case z aktualniho runtime na primarnim hostu.', en: 'Real-time health, block height, hashrate, and sync status from the current primary-host runtime.' }
    geography: { cs: 'Geografie', en: 'Geography' }
    network_map_pool_finder: { cs: 'Mapa site a vyhledavac poolu', en: 'Network Map & Pool Finder' }
    visualize_the_current_topology_and_compare_it: { cs: 'Vizualizujte aktualni topologii a porovnejte ji s archivovanym multi-host rolloutem zachovanym v release dokumentaci.', en: 'Visualize the current topology and compare it with the archived multi-host rollout preserved in release documentation.' }
    connect: { cs: 'Pripojeni', en: 'Connect' }
    connection_guides: { cs: 'Pripojovaci navody', en: 'Connection Guides' }
    everything_you_need_to_connect_a_miner_query_: { cs: 'Vse, co potrebujete k pripojeni minera, dotazovani RPC API nebo synchronizaci nodu.', en: 'Everything you need to connect a miner, query the RPC API, or sync a node.' }
    status: { cs: 'Stav', en: 'Status' }
    network_readiness: { cs: 'Pripravenost site', en: 'Network Readiness' }
    completed: { cs: 'dokonceno', en: 'completed' }
    frequently_asked_questions: { cs: 'Často kladené dotazy', en: 'Frequently Asked Questions' }
    everything_about_the_zion_network_in_one_plac: { cs: 'Vše o síti ZION na jednom místě.', en: 'Everything about the ZION network in one place.' }
    join_the_zion_network: { cs: 'Pripojte se k siti ZION', en: 'Join the ZION Network' }
    primary_host_live: { cs: 'Primarni host online', en: 'Primary host live' }
    internal_seeds: { cs: 'Interni seedy', en: 'Internal seeds' }
    docker_native: { cs: 'Docker nativne', en: 'Docker native' }
    archived_multi_host_history: { cs: 'Archivovana multi-host historie', en: 'Archived multi-host history' }
    explorer: { cs: 'Explorer', en: 'Explorer' }
    roadmap: { cs: 'Roadmapa', en: 'Roadmap' }
    what_consensus_does_zion_use: { cs: 'Jaký konsenzus ZION používá?', en: 'What consensus does ZION use?' }
    cosmic_harmony_proof_of_work_a_custom_crypton: { cs: 'Cosmic Harmony Proof-of-Work – vlastní CryptoNight varianta optimalizovaná pro CPU/GPU mining s 60s block time a Decade Decay emisí.', en: 'Cosmic Harmony Proof-of-Work – a custom CryptoNight variant optimized for CPU/GPU mining with 60s block time and Decade Decay emission.' }
    what_is_the_target_block_time: { cs: 'Jaký je cílový block time?', en: 'What is the target block time?' }
    60_seconds_difficulty_adjusts_dynamically_eve: { cs: '60 sekund. Obtížnost se dynamicky přizpůsobuje každý blok, aby udržela stabilní tempo.', en: '60 seconds. Difficulty adjusts dynamically every block to maintain a stable pace.' }
    how_many_zion_are_mined_per_block: { cs: 'Kolik ZION se vytěží za blok?', en: 'How many ZION are mined per block?' }
    what_is_the_maximum_supply: { cs: 'Jaká je maximální zásoba?', en: 'What is the maximum supply?' }
    how_to_connect_as_a_miner: { cs: 'Jak se připojit jako miner?', en: 'How to connect as a miner?' }
    download_xmrig_or_the_desktop_agent_and_use_s: { cs: 'Stáhněte si XMRig nebo Desktop Agent a použijte stratum+tcp://77.42.71.94:8444 jako pool adresu. Detaily najdete v Connection Guides výše.', en: 'Download XMRig or the Desktop Agent and use stratum+tcp://77.42.71.94:8444 as the pool address. See the Connection Guides section above for details.' }
    how_to_run_your_own_full_node: { cs: 'Jak spustit vlastní full node?', en: 'How to run your own full node?' }
    clone_the_repo_cargo_build_release_from_l1_co: { cs: 'Klonujte repo, spusťte cargo build --release v L1/core a pak ./target/release/ziond --p2p-bind-ip 0.0.0.0 --add-exclusive-node 77.42.71.94:21000. Docker compose je k dispozici v docker/docker-compose.mainnet.yml.', en: 'Clone the repo, cargo build --release from L1/core and then ./target/release/ziond --p2p-bind-ip 0.0.0.0 --add-exclusive-node 77.42.71.94:21000. Docker compose is available in docker/docker-compose.mainnet.yml.' }
    what_pool_fee_does_zion_charge: { cs: 'Jaký pool fee si ZION účtuje?', en: 'What pool fee does ZION charge?' }
    89_goes_to_the_miner_5_to_the_humanitarian_fu: { cs: '89 % putuje minerovi, 5 % do humanitarian fondu, 5 % do fondu Issobella a 1 % pool provozní poplatek.', en: '89% goes to the miner, 5% to the humanitarian fund, 5% to the Issobella fund, and 1% pool operational fee.' }
    is_the_network_publicly_launched: { cs: 'Je síť veřejně spuštěna?', en: 'Is the network publicly launched?' }
    v3_mainnet_is_in_preparation_target_launch_31: { cs: 'V3 Mainnet je v přípravě — target launch 31. prosince 2026 (Silvestr). Core + Edge topology je v testování, mining test aktivní, bridge v přípravě na Base Mainnet.', en: 'V3 Mainnet is in preparation — target launch 31 December 2026 (New Year\' }
  },
  l3Hiran: {
    deployment: { cs: 'Deployment', en: 'Deployment' }
    monitoring: { cs: 'Monitoring', en: 'Monitoring' }
    rag_pipeline: { cs: 'RAG Pipeline', en: 'RAG Pipeline' }
    fine_tuning: { cs: 'Fine-tuning', en: 'Fine-tuning' }
    stage_1_foundation: { cs: 'Stage 1: Foundation', en: 'Stage 1: Foundation' }
    stage_2_zion_core: { cs: 'Stage 2: Zion Core', en: 'Stage 2: Zion Core' }
    stage_3_cross_domain: { cs: 'Stage 3: Cross-domain', en: 'Stage 3: Cross-domain' }
    stage_4_rag_synthesis: { cs: 'Stage 4: RAG Synthesis', en: 'Stage 4: RAG Synthesis' }
    33_knowledge_docs: { cs: '33 Knowledge Docs', en: '33 Knowledge Docs' }
    religion_history_science_philosophy_art_medic: { cs: 'Religion, history, science, philosophy, art, medicine, literature, mythology, languages.', en: 'Religion, history, science, philosophy, art, medicine, literature, mythology, languages.' }
    vector_db_with_all_minilm_l6_v2_embeddings_mu: { cs: 'Vector DB s all-MiniLM-L6-v2 embeddings. Multi-collection cosine-similarity retrieval.', en: 'Vector DB with all-MiniLM-L6-v2 embeddings. Multi-collection cosine-similarity retrieval.' }
    query_router: { cs: 'Query Router', en: 'Query Router' }
    classifies_queries_zion_only_knowledge_rag_hy: { cs: 'Klasifikuje dotazy: zion_only, knowledge_rag, hybrid. Dynamický routing.', en: 'Classifies queries: zion_only, knowledge_rag, hybrid. Dynamic routing.' }
    hybrid_inference: { cs: 'Hybrid Inference', en: 'Hybrid Inference' }
    combines_fine_tuned_model_retrieved_context_i: { cs: 'Kombinace fine-tuned modelu + retrieved context v jednom inference kroku.', en: 'Combines fine-tuned model + retrieved context in a single inference step.' }
    ai_layer_of_the_zion_ecosystem: { cs: 'AI vrstva ZION ekosystému', en: 'AI layer of the ZION ecosystem' }
    hiran_v2_2_l3: { cs: 'Hiran v2.2 — L3', en: 'Hiran v2.2 — L3' }
    models: { cs: 'Modely', en: 'Models' }
    hiran_model_cards: { cs: 'Hiran Model Cards', en: 'Hiran Model Cards' }
    method: { cs: 'Metoda', en: 'Method' }
    size: { cs: 'Velikost', en: 'Size' }
    speed: { cs: 'Rychlost', en: 'Speed' }
    hardware: { cs: 'Hardware', en: 'Hardware' }
    dataset: { cs: 'Dataset', en: 'Dataset' }
    training: { cs: 'Trénink', en: 'Training' }
    training_phases_v2_2: { cs: 'Tréninkové fáze v2.2', en: 'Training Phases v2.2' }
    done: { cs: 'Hotovo', en: 'Done' }
    architecture: { cs: 'Architektura', en: 'Architecture' }
    hybrid_rag_v2_3: { cs: 'Hybrid RAG — v2.3', en: 'Hybrid RAG — v2.3' }
    because_general_knowledge_is_too_large_for_32: { cs: 'Protože obecné znalosti jsou příliš rozsáhlé pro 32B parametrů, v2.3 používá RAG vedle FT.', en: 'Because general knowledge is too large for 32B parameters, v2.3 uses RAG alongside FT.' }
    live_chat: { cs: 'Živý chat', en: 'Live Chat' }
    ask_hiranyagarbha: { cs: 'Zeptej se Hiranyagarbhy', en: 'Ask Hiranyagarbha' }
    marketplace: { cs: 'Marketplace', en: 'Marketplace' }
    ai_marketplace: { cs: 'AI Marketplace', en: 'AI Marketplace' }
    planned: { cs: 'Plánováno', en: 'Planned' }
    operations: { cs: 'Operace', en: 'Operations' }
    orchestration_deployment: { cs: 'Orchestrace & Deployment', en: 'Orchestration & Deployment' }
    learn_more_about_l3_and_the_ecosystem: { cs: 'Více o L3 a ekosystému', en: 'Learn more about L3 and the ecosystem' }
  },
  l4Oasis: {
    ue5_metaverse: { cs: 'UE5 Metaverse', en: 'UE5 Metaverse' }
    xp_economy: { cs: 'XP Ekonomie', en: 'XP Economy' }
    on_chain_inventory: { cs: 'On-Chain Inventory', en: 'On-Chain Inventory' }
    guild_dao: { cs: 'Guild DAO', en: 'Guild DAO' }
    core_avatars: { cs: 'Základní avataři', en: 'Core Avatars' }
    51_unique_core_avatars_with_full_animation_an: { cs: '51 unikátních základních avatarů s plnou animací a skillem.', en: '51 unique core avatars with full animation and skill tree.' }
    extended_avatars: { cs: 'Rozšíření avataři', en: 'Extended Avatars' }
    151_extended_avatars_with_unique_traits_and_b: { cs: '151 rozšířených avatarů s unikátními vlastnostmi a příběhem.', en: '151 extended avatars with unique traits and backstory.' }
    quest_engine: { cs: 'Quest systém', en: 'Quest Engine' }
    5_quests_per_avatar_pve_exploration_crafting_: { cs: '5 questů na každého avatara — PvE, exploration, crafting, social.', en: '5 quests per avatar — PvE, exploration, crafting, social.' }
    total_prize_pool: { cs: 'Celkový prize pool', en: 'Total Prize Pool' }
    clues: { cs: 'Stop / Clues', en: 'Clues' }
    estimated_start: { cs: 'Odhadovaný start', en: 'Estimated Start' }
    type: { cs: 'Typ', en: 'Type' }
    global_treasure_hunt: { cs: 'Celosvětová honba', en: 'Global Treasure Hunt' }
    alpha: { cs: 'Alpha', en: 'Alpha' }
    beta: { cs: 'Beta', en: 'Beta' }
    live: { cs: 'Live', en: 'Live' }
    avatar_minting: { cs: 'Avatar Minting', en: 'Avatar Minting' }
    every_avatar_is_an_nft_on_zion_l1_erc_721_com: { cs: 'Každý avatar je NFT na ZION L1 — ERC-721 kompatibilní, metadata on-chain.', en: 'Every avatar is an NFT on ZION L1 — ERC-721 compatible, metadata on-chain.' }
    quest_engine_1: { cs: 'Quest Engine', en: 'Quest Engine' }
    5_quests_per_avatar_generative_content_scorin: { cs: '5 questů na avatara — generativní obsah, skóre, odměny v ZION.', en: '5 quests per avatar — generative content, scoring, ZION rewards.' }
    nft_inventory: { cs: 'NFT Inventory', en: 'NFT Inventory' }
    items_weapons_armor_all_as_nfts_with_utxo_bac: { cs: 'Itemy, zbraně, brnění — vše jako NFT s UTXO-backed ownership.', en: 'Items, weapons, armor — all as NFTs with UTXO-backed ownership.' }
    guild_treasury: { cs: 'Guild Treasury', en: 'Guild Treasury' }
    guilds_as_sub_daos_on_chain_treasury_vote_wei: { cs: 'Guildy jako sub-DAO — on-chain treasury, vote-weighted governance.', en: 'Guilds as sub-DAOs — on-chain treasury, vote-weighted governance.' }
    territory_claims: { cs: 'Territory Claims', en: 'Territory Claims' }
    digital_territories_on_zion_map_l1_record_gui: { cs: 'Digitální teritoria na ZION mapě — L1 záznam, guild ownership.', en: 'Digital territories on ZION map — L1 record, guild ownership.' }
    xp_zion_bridge: { cs: 'XP → ZION Bridge', en: 'XP → ZION Bridge' }
    xp_from_quests_convertible_to_zion_tokens_non: { cs: 'XP z questů konvertovatelný na ZION tokeny — non-consensus ekonomika.', en: 'XP from quests convertible to ZION tokens — non-consensus economy.' }
    game_layer_of_the_zion_ecosystem: { cs: 'Herní vrstva ZION ekosystému', en: 'Game layer of the ZION ecosystem' }
    zion_oasis_l4: { cs: 'ZION Oasis — L4', en: 'ZION Oasis — L4' }
    ue5_integration_2028_2029: { cs: 'UE5 integrace 2028–2029', en: 'UE5 integration 2028–2029' }
    live_system: { cs: 'Živý systém', en: 'Live System' }
    avatar_system_active: { cs: 'Avatar systém — Active', en: 'Avatar System — Active' }
    51_core_151_extended_avatars_each_has_5_quest: { cs: '51 core + 151 extended avatarů. Každý má 5 questů. REST API endpointy /avatars a /quests jsou aktivní.', en: '51 core + 151 extended avatars. Each has 5 quests. REST API endpoints /avatars and /quests are active.' }
    treasure: { cs: 'Poklad', en: 'Treasure' }
    golden_egg_108_clues_8_25b_zion: { cs: 'Golden Egg — 108 stop, 8.25B ZION', en: 'Golden Egg — 108 Clues, 8.25B ZION' }
    baseline_protocols: { cs: 'Baseline protokoly', en: 'Baseline Protocols' }
    oasis_game_protocols: { cs: 'Oasis Game Protocols', en: 'Oasis Game Protocols' }
    core_game_protocols_for_interoperability_acro: { cs: 'Základní herní protokoly pro interoperabilitu napříč ZION Oasis ekosystémem.', en: 'Core game protocols for interoperability across the ZION Oasis ecosystem.' }
    vision: { cs: 'Vize', en: 'Vision' }
    oasis_key_pillars: { cs: 'Klíčové pilíře Oasis', en: 'Oasis Key Pillars' }
    development_path: { cs: 'Vývojová cesta', en: 'Development Path' }
    l4_oasis_roadmap: { cs: 'Roadmap L4 Oasis', en: 'L4 Oasis Roadmap' }
    learn_more_about_l4_and_the_ecosystem: { cs: 'Více o L4 a ekosystému', en: 'Learn more about L4 and the ecosystem' }
  },
  l5FreeWorld: {
    central_europe: { cs: 'Střední Evropa', en: 'Central Europe' }
    south_asia: { cs: 'Jižní Asie', en: 'South Asia' }
    guardian_node: { cs: 'Guardian Node', en: 'Guardian Node' }
    every_l5_community_validates_blocks_10_of_rew: { cs: 'Každá L5 komunita validuje bloky — 10 % odměn do komunitní pokladny.', en: 'Every L5 community validates blocks — 10% of rewards go to the community treasury.' }
    sociocratic_dao: { cs: 'Sociocratic DAO', en: 'Sociocratic DAO' }
    hybrid_governance_off_chain_circles_on_chain_: { cs: 'Hybridní governance: off-chain kruhy + on-chain treasury hlasování.', en: 'Hybrid governance: off-chain circles + on-chain treasury votes.' }
    free_energy: { cs: 'Free Energy', en: 'Free Energy' }
    solar_wind_and_local_energy_autonomy_shared_a: { cs: 'Solární, větrná a lokální energetická autonomie — sdílená přes L5 síť.', en: 'Solar, wind, and local energy autonomy — shared across the L5 network.' }
    community_treasury: { cs: 'Komunitní pokladna', en: 'Community Treasury' }
    10_of_guardian_node_rewards_local_projects_ma: { cs: '10 % z guardian node odměn → místní projekty, údržba, zásoby.', en: '10% of guardian node rewards → local projects, maintenance, reserves.' }
    resonance_protocol: { cs: 'Rezonance protokol', en: 'Resonance Protocol' }
    sound_attunement_before_governance_fibonacci_: { cs: 'Zvukové ladění před governance, Fibonacci Time Capsules, Youth–Elder Bridge.', en: 'Sound attunement before governance, Fibonacci Time Capsules, Youth–Elder Bridge.' }
    cartographic_records: { cs: 'Kartografické záznamy', en: 'Cartographic Records' }
    local_ecological_and_community_maps_stored_on: { cs: 'Lokální ekologické a komunitní mapy uložené on-chain jako UTXO metadata.', en: 'Local ecological and community maps stored on-chain as UTXO metadata.' }
    physical_layer_of_the_zion_ecosystem: { cs: 'Fyzická vrstva ZION ekosystému', en: 'Physical layer of the ZION ecosystem' }
    free_world_l5: { cs: 'Svobodný svět — L5', en: 'Free World — L5' }
    5_of_every_block_l5_fund: { cs: '5 % z každého bloku → L5 fond', en: '5% of every block → L5 fund' }
    11_7m_zion_month: { cs: '~11,7 M ZION / měsíc', en: '~11.7M ZION / month' }
    unlocked_block_525_600: { cs: 'Odemčeno blok ~525 600', en: 'Unlocked block ~525,600' }
    humanitarian_fund: { cs: 'Humanitární fond', en: 'Humanitarian Fund' }
    l5_fund_5_block_reward: { cs: 'L5 Fond — 5 % block reward', en: 'L5 Fund — 5% block reward' }
    block_share: { cs: 'Podíl z bloku', en: 'Block share' }
    every_block_forever: { cs: 'každý blok, navždy', en: 'every block, forever' }
    approx_month: { cs: 'Přibližně / měsíc', en: 'Approx / month' }
    governed_by: { cs: 'Správa', en: 'Governed by' }
    l5_council: { cs: 'L5 Radou', en: 'L5 Council' }
    fund_wallet: { cs: 'Adresa fondu', en: 'Fund wallet' }
    shared_protocols: { cs: 'Sdílené protokoly', en: 'Shared Protocols' }
    baseline_l5_protocols: { cs: 'Baseline L5 protokoly', en: 'Baseline L5 Protocols' }
    every_l5_community_implements_these_shared_pr: { cs: 'Každá L5 komunita implementuje tyto sdílené protokoly pro interoperabilitu.', en: 'Every L5 community implements these shared protocols for interoperability.' }
    communities: { cs: 'Komunity', en: 'Communities' }
    l5_nodes_communities: { cs: 'L5 uzly — komunity', en: 'L5 Nodes — Communities' }
    details: { cs: 'Podrobnosti', en: 'Details' }
    want_to_propose_a_new_l5_community_open_a_pr_: { cs: 'Chceš navrhnout novou L5 komunitu? Otevři PR do V3/L5/docs/COMMUNITIES/', en: 'Want to propose a new L5 community? Open a PR to V3/L5/docs/COMMUNITIES/' }
    l5_economic_model: { cs: 'Ekonomický model L5', en: 'L5 Economic Model' }
    block_reward_network: { cs: 'Block reward (síť)', en: 'Block reward (network)' }
    guardian_node_local: { cs: 'Guardian Node (místní)', en: 'Guardian Node (local)' }
    90_community_miner_10_community_treasury: { cs: '90% komunitní těžař · 10% → komunitní pokladna', en: '90% community miner · 10% → community treasury' }
    60_projects_30_reserves_10_humanitarian_tithe: { cs: '60% projekty · 30% rezervy · 10% humanitární příspěvek (L5 global)', en: '60% projects · 30% reserves · 10% humanitarian tithe (L5 global)' }
    learn_more_about_l5: { cs: 'Více o L5', en: 'Learn more about L5' }
    network: { cs: 'Síť', en: 'Network' }
  },
  l6Issobella: {
    orbital_station: { cs: 'Orbitální stanice', en: 'Orbital Station' }
    orbital_mining: { cs: 'Orbital Mining', en: 'Orbital Mining' }
    overview_effect: { cs: 'Overview Effect', en: 'Overview Effect' }
    orbital_experience_shifts_consciousness_no_bo: { cs: 'Zkušenost z oběžné dráhy mění vědomí — planety bez hranic, humanity jako celek.', en: 'Orbital experience shifts consciousness — no borders, humanity as a whole.' }
    5_block_fund: { cs: '5% Block Fund', en: '5% Block Fund' }
    every_mined_block_contributes_5_to_the_l6_iss: { cs: 'Každý vytěžený blok přispívá 5 % do L6 Issobella fondu — trvalé financování vesmírného výzkumu.', en: 'Every mined block contributes 5% to the L6 Issobella fund — perpetual space research funding.' }
    dao_governance: { cs: 'DAO Governance', en: 'DAO Governance' }
    l6_council_governed_grants_and_projects_commu: { cs: 'L6 Radou řízené granty a projekty — komunita rozhoduje o alokaci fondu.', en: 'L6 Council-governed grants and projects — community decides fund allocation.' }
    decentralized_research: { cs: 'Decentralizovaný výzkum', en: 'Decentralized Research' }
    space_research_without_central_authority_open: { cs: 'Vesmírný výzkum bez centrální autority — otevřená věda, otevřená data.', en: 'Space research without central authority — open science, open data.' }
    cosmic_consciousness: { cs: 'Kosmické vědomí', en: 'Cosmic Consciousness' }
    l6_as_the_layer_for_transcending_planetary_bo: { cs: 'L6 jako vrstva pro přesah hranic planety — Hiranyagarbha, Zlatý zárodek, kosmická vize.', en: 'L6 as the layer for transcending planetary boundaries — Hiranyagarbha, Golden Egg, cosmic vision.' }
    cosmic_harmony_pow: { cs: 'Cosmic Harmony PoW', en: 'Cosmic Harmony PoW' }
    zion_consensus_algorithm_is_designed_with_cos: { cs: 'ZION consensus algoritmus je navržen s kosmickým vědomím — L6 je jeho duchovní destinace.', en: 'ZION consensus algorithm is designed with cosmic consciousness — L6 is its spiritual destination.' }
    space_layer_of_the_zion_ecosystem: { cs: 'Vesmírná vrstva ZION ekosystému', en: 'Space layer of the ZION ecosystem' }
    5_of_every_block_l6_fund: { cs: '5 % z každého bloku → L6 fond', en: '5% of every block → L6 fund' }
    11_7m_zion_month: { cs: '~11,7 M ZION / měsíc', en: '~11.7M ZION / month' }
    unlocked_block_525_600: { cs: 'Odemčeno blok ~525 600', en: 'Unlocked block ~525,600' }
    space_fund: { cs: 'Vesmírný fond', en: 'Space Fund' }
    l6_issobella_fund_5_block_reward: { cs: 'L6 Issobella fond — 5 % block reward', en: 'L6 Issobella Fund — 5% block reward' }
    block_share: { cs: 'Podíl z bloku', en: 'Block share' }
    every_block_forever: { cs: 'každý blok, navždy', en: 'every block, forever' }
    approx_month: { cs: 'Přibližně / měsíc', en: 'Approx / month' }
    governed_by: { cs: 'Správa', en: 'Governed by' }
    l6_council: { cs: 'L6 Radou', en: 'L6 Council' }
    fund_wallet: { cs: 'Adresa fondu', en: 'Fund wallet' }
    missions_vision: { cs: 'Mise & Vize', en: 'Missions & Vision' }
    cosmic_missions: { cs: 'Kosmické mise', en: 'Cosmic Missions' }
    principles: { cs: 'Principy', en: 'Principles' }
    l6_layer_foundations: { cs: 'Základy L6 vrstvy', en: 'L6 Layer Foundations' }
    golden_egg: { cs: 'Zlatý zárodek', en: 'Golden Egg' }
    learn_more_about_l6_and_the_ecosystem: { cs: 'Více o L6 a ekosystému', en: 'Learn more about L6 and the ecosystem' }
    network: { cs: 'Síť', en: 'Network' }
  },
  roadmapPage: {
    scratchpad_ekam_256_kib_4_passes_256_reads_ti: { cs: 'Scratchpad Ekam: 256 KiB, 4 průchody, 256 čtení (Tier 1)', en: 'Scratchpad Ekam: 256 KiB, 4 passes, 256 reads (Tier 1)' }
    epoch_rotating_npu_weights_2016_100_blocks_ti: { cs: 'Epoch-rotující NPU váhy — 2016/100 bloků (Tier 2)', en: 'Epoch-rotating NPU weights — 2016/100 blocks (Tier 2)' }
    decade_decay_emission_5_400_724_zion_block_10: { cs: 'Decade Decay emise: 5 400 → 724 ZION/blok (100+ let + tail ∞)', en: 'Decade Decay emission: 5,400 → 724 ZION/block (100+ years + tail ∞)' }
    16_28b_genesis_reserve_public_summary: { cs: '16,28B genesis reserve (veřejný souhrn)', en: '16.28B genesis reserve (public summary)' }
    fee_burning_all_fees_destroyed: { cs: 'Spalování poplatků — VŠECHNY poplatky zničeny', en: 'Fee burning — ALL fees destroyed' }
    distribution_89_miner_5_humanit_5_issobella_1: { cs: 'Distribuce: 89% miner · 5% humanit. · 5% Issobella · 1% pool', en: 'Distribution: 89% miner · 5% humanit. · 5% Issobella · 1% pool' }
    dual_mining_zion_chv3_vrsc_verushash: { cs: 'Dual-mining: ZION (CHv3) + VRSC (VerusHash)', en: 'Dual-mining: ZION (CHv3) + VRSC (VerusHash)' }
    mining_pool_stratum_v2_pplns: { cs: 'Mining pool (Stratum v2, PPLNS)', en: 'Mining pool (Stratum v2, PPLNS)' }
    p2p_network_ibd_sync_bootstrap_peers: { cs: 'P2P síť, IBD sync, bootstrap peers', en: 'P2P network, IBD sync, bootstrap peers' }
    defi_ui_swap_bridge_portfolio_on_zionterranov: { cs: 'DeFi UI — swap, bridge, portfolio na zionterranova.com/defi ✅', en: 'DeFi UI — swap, bridge, portfolio on zionterranova.com/defi ✅' }
    defi_pages_bridge_dao_warp_bilingual_mainnet: { cs: 'DeFi stránky — bridge/dao/warp bilingvální + mainnet ✅', en: 'DeFi pages — bridge/dao/warp bilingual + mainnet ✅' }
    liquidity_seeded_50_wzion_0_0005_weth: { cs: 'Likvidita nasazena: 50 wZION + 0.0005 WETH ✅', en: 'Liquidity seeded: 50 wZION + 0.0005 WETH ✅' }
    2026_implementation_2027_gated_production: { cs: '2026 implementace · 2027 gated produkce', en: '2026 implementation · 2027 gated production' }
    ncl_ai_task_marketplace: { cs: 'NCL — AI task marketplace', en: 'NCL — AI task marketplace' }
    ethereum_corridor_live_on_base_mainnet: { cs: 'Ethereum corridor živě na Base Mainnet ✅', en: 'Ethereum corridor live on Base Mainnet ✅' }
    golden_egg_treasure_hunt_108_clues_8_25b_zion: { cs: 'Golden Egg poklad (108 stop, 8,25B ZION) — plánováno 2027', en: 'Golden Egg treasure hunt (108 clues, 8.25B ZION) — Planned 2027' }
    guild_system_territories_planned_2028: { cs: 'Guildy a teritoria — plánováno 2028', en: 'Guild system & territories — Planned 2028' }
    ue5_integration_planned_2028_2029: { cs: 'UE5 integrace — plánováno 2028–2029', en: 'UE5 integration — Planned 2028–2029' }
    free_energy_quantum_engine_r_d: { cs: 'Free energy quantum engine R&D', en: 'Free energy quantum engine R&D' }
    zion_issobella_station_concept_roadmap_planne: { cs: 'Stanice ZION Issobella — koncept & roadmap plánováno 2030+', en: 'ZION Issobella Station — concept & roadmap Planned 2030+' }
    orbital_mining_deep_space_research_planned_20: { cs: 'Orbitální těžba & výzkum hlubokého vesmíru — plánováno 2030+', en: 'Orbital mining & deep-space research — Planned 2030+' }
    website_v2_9_defi_live: { cs: 'website-v2.9/ (DeFi live)', en: 'website-v2.9/ (DeFi live)' }
    spec_freeze_core_rewrite: { cs: 'Zmrazení specifikace & přepis jádra', en: 'Spec Freeze & Core Rewrite' }
    feb_2026_completed_9_feb: { cs: 'Únor 2026 (dokončeno 9. úno)', en: 'Feb 2026 (completed 9 Feb)' }
    repo_migration_clean_repo_workspace_docker_ci: { cs: 'Migrace repozitáře — čistý repo, workspace, Docker, CI/CD', en: 'Repo Migration — clean repo, workspace, Docker, CI/CD' }
    emission_genesis_5_400_zion_block_16_28b_rese: { cs: 'Emise & Genesis — 5 400 ZION/blok, 16,28B reserve', en: 'Emission & Genesis — 5,400 ZION/block, 16.28B reserve' }
    daa_consensus_lwma_60_block_25_fork_choice: { cs: 'DAA & Konsensus — LWMA 60-blok, ±25%, fork-choice', en: 'DAA & Consensus — LWMA 60-block, ±25%, fork-choice' }
    fee_market_mempool_fee_burning_double_spend_e: { cs: 'Fee Market & Mempool — spalování, double-spend, eviction', en: 'Fee Market & Mempool — fee burning, double-spend, eviction' }
    wallet_tx_utxo_select_ed25519_broadcast_e2e: { cs: 'Peněženka & TX — UTXO select, Ed25519, broadcast, E2E', en: 'Wallet & TX — UTXO select, Ed25519, broadcast, E2E' }
    consensus_hardening_maturity_100_reorg_10_fin: { cs: 'Hardening konsensu — maturity=100, reorg=10, finalita=60', en: 'Consensus Hardening — maturity=100, reorg=10, finality=60' }
    unit_tests_for_new_reward_model: { cs: 'Unit testy pro nový model odměn', en: 'Unit tests for new reward model' }
    genesis_produces_16_28b_reserve: { cs: 'Genesis produkuje 16,28B reserve', en: 'Genesis produces 16.28B reserve' }
    lwma_daa_deterministic: { cs: 'LWMA DAA deterministické', en: 'LWMA DAA deterministic' }
    max_reorg_depth_10_enforced: { cs: 'Max reorg hloubka = 10 vynucena', en: 'Max reorg depth = 10 enforced' }
    coinbase_maturity_100_enforced: { cs: 'Coinbase maturity = 100 vynucena', en: 'Coinbase maturity = 100 enforced' }
    wallet_send_e2e_working: { cs: 'Wallet send E2E funkční', en: 'Wallet send E2E working' }
    network_identity_deploy_chain_reset_docker_3_: { cs: 'Identita sítě & Deploy — chain reset, Docker, 3 servery', en: 'Network Identity & Deploy — chain reset, Docker, 3-server' }
    config_validation_toml_parsing_boundary_check: { cs: 'Validace konfigurace — TOML parsing, hraniční kontroly', en: 'Config Validation — TOML parsing, boundary checks' }
    security_edge_case_reorg_double_spend_fork_ch: { cs: 'Bezpečnost & Edge-Case — reorg, double-spend, fork-choice', en: 'Security & Edge-Case — reorg, double-spend, fork-choice' }
    ibd_hardening_timeouts_stall_detection_peer_s: { cs: 'IBD Hardening — timeouty, detekce stall, peer scoring', en: 'IBD Hardening — timeouts, stall detection, peer scoring' }
    pool_payout_integration_batch_tx_poolwallet_j: { cs: 'Pool Payout — batch TX, PoolWallet, JSON-RPC', en: 'Pool Payout Integration — batch TX, PoolWallet, JSON-RPC' }
    buyback_dao_treasury_100_dao_revenue_burn_add: { cs: 'Buyback + DAO Treasury — 100% DAO revenue, burn adresa', en: 'Buyback + DAO Treasury — 100% DAO revenue, burn address' }
    supply_buyback_api_getsupplyinfo_getnetworkin: { cs: 'Supply + Buyback API — getSupplyInfo, getNetworkInfo', en: 'Supply + Buyback API — getSupplyInfo, getNetworkInfo' }
    p2p_rate_limiting_200_msgs_peer_60s_escalatin: { cs: 'P2P Rate-Limiting — 200 zpráv/peer/60s, eskalující bany', en: 'P2P Rate-Limiting — 200 msgs/peer/60s, escalating bans' }
    health_check_metrics_gethealthcheck_getmetric: { cs: 'Health Check & Metriky — getHealthCheck, getMetrics', en: 'Health Check & Metrics — getHealthCheck, getMetrics' }
    stress_test_suite_high_tx_rapid_blocks_partit: { cs: 'Stress Test Suite — vysoký TX, rychlé bloky, partition', en: 'Stress Test Suite — high TX, rapid blocks, partition' }
    168h_stability_run_archived_multi_host_valida: { cs: '168h stabilita — archivovaný multi-host run, žádný kritický incident', en: '168h Stability Run — archived multi-host validation, no critical incident' }
    live_partition_test_node_isolation_30_min_rec: { cs: 'Live Partition Test — izolace nodu 30 min, reconnect', en: 'Live Partition Test — node isolation 30 min, reconnect' }
    100_miners_stress_simulate_100_stratum_client: { cs: '100 minerů stres — simulace 100 Stratum klientů', en: '100 Miners Stress — simulate 100 Stratum clients' }
    core_edge_topology_tailscale_vpn_sharerelay_p: { cs: 'Core + Edge Topology — Tailscale VPN, ShareRelay pool', en: 'Core + Edge Topology — Tailscale VPN, ShareRelay pool' }
    fee_split_89_5_5_1_canonical_addresses_genesi: { cs: 'Fee Split 89/5/5/1 — kanonické adresy, Genesis premine', en: 'Fee Split 89/5/5/1 — canonical addresses, Genesis premine' }
    node_ux_mining: { cs: 'Node UX & Těžba', en: 'Node UX & Mining' }
    jun_jul_2026: { cs: 'Červen — Červenec 2026', en: 'Jun — Jul 2026' }
    node_ux_readme_config_toml_structured_logging: { cs: 'Node UX — README, config.toml, strukturované logy, CLI', en: 'Node UX — README, config.toml, structured logging, CLI' }
    mining_polish_cpu_baseline_gpu_production_poo: { cs: 'Mining Polish — CPU baseline, GPU produkce, pool failover', en: 'Mining Polish — CPU baseline, GPU production, pool failover' }
    block_explorer_indexer_web_ui_supply_api_rich: { cs: 'Block Explorer — indexer, web UI, supply API, rich list', en: 'Block Explorer — indexer, web UI, supply API, rich list' }
    node_bootable_in_10_min_per_readme: { cs: 'Node spustitelný za 10 min dle README', en: 'Node bootable in 10 min per README' }
    block_explorer_running_and_indexing: { cs: 'Block explorer běží a indexuje', en: 'Block explorer running and indexing' }
    mining_guides_complete: { cs: 'Mining guides kompletní', en: 'Mining guides complete' }
    rpc_api_documented: { cs: 'RPC API zdokumentováno', en: 'RPC API documented' }
    infrastructure_defi_legal: { cs: 'Infrastruktura, DeFi & Legal', en: 'Infrastructure, DeFi & Legal' }
    mar_may_2026: { cs: 'Březen — Květen 2026', en: 'Mar — May 2026' }
    public_host_monitoring_zion2_live_prometheus_: { cs: 'Veřejný host & Monitoring — Zion2 live, Prometheus + Grafana', en: 'Public Host & Monitoring — Zion2 live, Prometheus + Grafana' }
    docker_deploy_runbook_compose_live_web_deploy: { cs: 'Docker & Deploy — runbook + compose + live web deploy flow', en: 'Docker & Deploy — runbook + compose + live web deploy flow' }
    legal_compliance_disclaimers_token_not_securi: { cs: 'Legal & Compliance — disclaimery, token-not-security, rizika', en: 'Legal & Compliance — disclaimers, token-not-security, risk' }
    wzion_bridge_deployed_on_base_mainnet: { cs: 'wZION + Bridge nasazeny na Base Mainnet', en: 'wZION + Bridge deployed on Base Mainnet' }
    uniswap_v3_pool_wzion_weth_0_3_seeded_on_base: { cs: 'Uniswap V3 pool wZION/WETH (0.3%) nasazen na Base Mainnet', en: 'Uniswap V3 pool wZION/WETH (0.3%) seeded on Base Mainnet' }
    defi_ui_functional_swap_bridge_portfolio_on_w: { cs: 'DeFi UI — funkční swap/bridge/portfolio na webu', en: 'DeFi UI — functional swap/bridge/portfolio on website' }
    defi_l2_pages_cleanup_bridge_dao_warp_bilingu: { cs: 'DeFi L2 stránky — bridge/dao/warp bilingvální mainnet', en: 'DeFi L2 pages cleanup — bridge/dao/warp bilingual mainnet' }
    dress_rehearsal: { cs: 'Generální zkouška', en: 'Dress Rehearsal' }
    oct_nov_2026: { cs: 'Říjen — Listopad 2026', en: 'Oct — Nov 2026' }
    dress_rehearsal_staging_chain_1000_miners_dis: { cs: 'Dress Rehearsal — staging chain, 1000 minerů, disaster recovery', en: 'Dress Rehearsal — staging chain, 1000 miners, disaster recovery' }
    security_audit_rfp_kickoff_mid_review_final_b: { cs: 'Bezpečnostní audit — RFP, kickoff, mid-review, final, bug bounty', en: 'Security Audit — RFP, kickoff, mid-review, final, bug bounty' }
    code_freeze_feature_freeze_tag_v2_9_6_mainnet: { cs: 'Code Freeze — feature freeze, tag v2.9.6-mainnet, SHA-256', en: 'Code Freeze — feature freeze, tag v2.9.6-mainnet, SHA-256' }
    7_day_stability_run_without_crash: { cs: '7denní stabilita bez havárie', en: '7-day stability run without crash' }
    security_audit_no_critical_high_findings: { cs: 'Bezpečnostní audit — žádné critical/high nálezy', en: 'Security audit — no critical/high findings' }
    code_freeze_tag_created: { cs: 'Code freeze — tag vytvořen', en: 'Code freeze — tag created' }
    binary_releases_with_sha_256: { cs: 'Binární release s SHA-256', en: 'Binary releases with SHA-256' }
    bug_bounty_program_active: { cs: 'Bug bounty program aktivní', en: 'Bug bounty program active' }
    public_launch_decision_genesis: { cs: 'Rozhodnutí o veřejném launchi & Genesis', en: 'Public Launch Decision & Genesis' }
    target_31_december_2026_new_year: { cs: 'Target: 31. prosinec 2026 (Silvestr)', en: 'Target: 31 December 2026 (New Year\' }
    final_payout_verification_pplns_window_valida: { cs: 'Finální payout verifikace — PPLNS window validace', en: 'Final payout verification — PPLNS window validation' }
    security_audit_external_firm_booked: { cs: 'Bezpečnostní audit — externí firma booked', en: 'Security audit — external firm booked' }
    bridge_validator_key_provisioning_3_5_thresho: { cs: 'Bridge validator provisioning — 3/5 threshold produkce', en: 'Bridge validator key provisioning — 3/5 threshold production' }
    community_preparation_documentation_tutorials: { cs: 'Komunitní příprava — dokumentace, tutoriály', en: 'Community preparation — documentation, tutorials' }
    ci_billing_resolution: { cs: 'CI billing resolution', en: 'CI billing resolution' }
    genesis_freeze_all_parameters_frozen: { cs: 'Genesis freeze — všechny parametry zmrazeny', en: 'Genesis freeze — all parameters frozen' }
    community_announcement_wallets_available: { cs: 'Community oznámení + wallety ke stažení', en: 'Community announcement + wallets available' }
    final_node_software_release: { cs: 'Finální release node software', en: 'Final node software release' }
    public_genesis_go_decision: { cs: '🚀 Veřejný genesis — GO rozhodnutí', en: '🚀 Public genesis — GO decision' }
    phase_1_foundation_complete: { cs: 'Phase 1 Foundation kompletní', en: 'Phase 1 Foundation complete' }
    final_payout_verification: { cs: 'Finální payout verifikace', en: 'Final payout verification' }
    bridge_validator_provisioning_3_5_threshold: { cs: 'Bridge validator provisioning — 3/5 threshold', en: 'Bridge validator provisioning — 3/5 threshold' }
    genesis_block_hash_published: { cs: 'Genesis block hash publikován', en: 'Genesis block hash published' }
    bootstrap_hosts_online_public_internal_quorum: { cs: 'Bootstrap hosty online (veřejný + interní quorum)', en: 'Bootstrap hosts online (public + internal quorum)' }
    pool_solo_mining_open: { cs: 'Pool + solo mining otevřen', en: 'Pool + solo mining open' }
    block_explorer_live: { cs: 'Block explorer živě', en: 'Block explorer live' }
    supply_api_live: { cs: 'Supply API živě', en: 'Supply API live' }
    6a_silent_mainnet: { cs: '6A: Tichý Mainnet', en: '6A: Silent Mainnet' }
    days_1_30: { cs: 'Dny 1–30', en: 'Days 1–30' }
    6b_dex_listings: { cs: '6B: DEX & Listingy', en: '6B: DEX & Listings' }
    days_14_45: { cs: 'Dny 14–45', en: 'Days 14–45' }
    defi_ui_on_zionterranova_com_defi: { cs: 'DeFi UI na zionterranova.com/defi ✅', en: 'DeFi UI on zionterranova.com/defi ✅' }
    deepen_liquidity_price_discovery: { cs: 'Prohloubit likviditu + price discovery', en: 'Deepen liquidity + price discovery' }
    days_30_60: { cs: 'Dny 30–60', en: 'Days 30–60' }
    days_45_120: { cs: 'Dny 45–120', en: 'Days 45–120' }
    ed25519_signature_verification: { cs: 'Ed25519 ověření podpisů', en: 'Ed25519 signature verification' }
    double_spend_protection_mempool_utxo: { cs: 'Double-spend ochrana (mempool + UTXO)', en: 'Double-spend protection (mempool + UTXO)' }
    overflow_protection_checked_add: { cs: 'Overflow ochrana (checked_add)', en: 'Overflow protection (checked_add)' }
    coinbase_maturity_100_blocks: { cs: 'Coinbase maturity 100 bloků', en: 'Coinbase maturity 100 blocks' }
    reorg_limit_10_blocks: { cs: 'Reorg limit 10 bloků', en: 'Reorg limit 10 blocks' }
    timestamp_validation_120s: { cs: 'Timestamp validace ±120s', en: 'Timestamp validation ±120s' }
    mempool_limits_50k_tx_min_fee: { cs: 'Mempool limity (50k TX, min fee)', en: 'Mempool limits (50k TX, min fee)' }
    rpc_authentication_api_key: { cs: 'RPC autentizace (API key)', en: 'RPC authentication (API key)' }
    block_size_limit_max_1_mb: { cs: 'Block size limit (max 1 MB)', en: 'Block size limit (max 1 MB)' }
    tx_size_limit_max_100_kb: { cs: 'TX size limit (max 100 KB)', en: 'TX size limit (max 100 KB)' }
    external_audit: { cs: 'Externí audit', en: 'External audit' }
    phase_0_1_168h_pass_2_4_launch_gate: { cs: 'Fáze 0 ✅ → 1 🔄 (168h PASS) → 2–4 → launch gate', en: 'Phase 0 ✅ → 1 🔄 (168h PASS) → 2–4 → launch gate' }
    l2_defi_dex: { cs: 'L2 DeFi & DEX', en: 'L2 DeFi & DEX' }
    wzion_bridge_uni_v3_defi_ui_staking_planned: { cs: 'wZION Bridge ✅ · Uni V3 ✅ · DeFi UI ✅ · Staking plánován', en: 'wZION Bridge ✅ · Uni V3 ✅ · DeFi UI ✅ · Staking planned' }
    2026_2027: { cs: '2026–2027', en: '2026–2027' }
    warp_7_7_eth_corridor_ai_native: { cs: 'WARP 7/7 ✅ · ETH corridor ✅ · AI-native', en: 'WARP 7/7 ✅ · ETH corridor ✅ · AI-native' }
    ue5_xp_economy_beta: { cs: 'UE5 · XP ekonomie · Beta', en: 'UE5 · XP economy · Beta' }
    humanitarian_missions_free_energy: { cs: 'Humanitární mise · Volná energie', en: 'Humanitarian missions · Free energy' }
    orbital_station_fund: { cs: 'Orbitální stanice · Fond', en: 'Orbital Station · Fund' }
    1_501_tests_passing: { cs: '1 501 testů prochází', en: '1,501 tests passing' }
    architecture: { cs: 'Architektura', en: 'Architecture' }
    each_layer_is_independent_l1_is_never_comprom: { cs: 'Každý layer je nezávislý. L1 nikdy nekompromitujeme kvůli vyšším vrstvám.', en: 'Each layer is independent. L1 is never compromised for higher layers.' }
    active: { cs: 'Aktivní', en: 'Active' }
    telemetry: { cs: 'Telemetrie', en: 'Telemetry' }
    component_status: { cs: 'Stav komponent', en: 'Component Status' }
    component: { cs: 'Komponenta', en: 'Component' }
    tests: { cs: 'Testy', en: 'Tests' }
    status: { cs: 'Stav', en: 'Status' }
    readiness: { cs: 'Připravenost', en: 'Readiness' }
    execution: { cs: 'Exekuce', en: 'Execution' }
    every_phase_has_clear_exit_criteria_no_shortc: { cs: 'Každá fáze má jasné exit criteria. Žádné zkratky.', en: 'Every phase has clear exit criteria. No shortcuts.' }
    done: { cs: 'Dokončeno', en: 'Done' }
    active_1: { cs: 'Probíhá', en: 'Active' }
    upcoming: { cs: 'Plánováno', en: 'Upcoming' }
    phase: { cs: 'Fáze', en: 'Phase' }
    tests_1: { cs: 'testů', en: 'tests' }
    after_launch: { cs: 'Po launchi', en: 'After Launch' }
    phase_6_post_launch_exchange: { cs: 'Fáze 6 · Post-Launch & Exchange', en: 'Phase 6 · Post-Launch & Exchange' }
    only_after_go_decision_stability_dex_cex_cmc_: { cs: 'Pouze po GO rozhodnutí: stabilita → DEX → CEX → CMC/CG. Žádný hype první den.', en: 'Only after GO decision: stability → DEX → CEX → CMC/CG. No hype on day one.' }
    tier_2_cex_after_volume: { cs: 'Tier-2 CEX (po volume)', en: 'Tier-2 CEX (after volume)' }
    launch_constitution_draft: { cs: 'Návrh Launch Constitution', en: 'Launch Constitution Draft' }
    frozen_parameters_for_potential_public_genesi: { cs: 'Zmrazené parametry pro případný veřejný genesis, ne potvrzení launche', en: 'Frozen parameters for potential public genesis, not a launch confirmation' }
    16_280_000_000_zion_public_summary_for_launch: { cs: '16 280 000 000 ZION — veřejný souhrn pro launch ekonomiku', en: '16,280,000,000 ZION — public summary for launch economics' }
    security: { cs: 'Bezpečnost', en: 'Security' }
    launch_readiness_security_checklist: { cs: 'Security Checklist pro launch', en: 'Launch-Readiness Security Checklist' }
    completed: { cs: 'dokončeno', en: 'completed' }
    public_launch_gate_ready_for_launch: { cs: 'Public launch gate · Ready for launch', en: 'Public launch gate · Ready for launch' }
    100_yrs_mining: { cs: '100+ let mining', en: '100+ yrs mining' }
    documentation: { cs: 'Dokumentace', en: 'Documentation' }
    live_dashboard: { cs: 'Živý dashboard', en: 'Live Dashboard' }
    last_updated: { cs: 'Poslední aktualizace', en: 'Last updated' }
  },
  genesisPage: {
    foreword: { cs: 'Předmluva', en: 'Foreword' }
    message_of_zion_native: { cs: 'Poselství Zion Native', en: 'Message of Zion Native' }
    birth_of_zion: { cs: 'Zrod ZION', en: 'Birth of ZION' }
    the_first_shimmer_of_consciousness: { cs: 'Prvotní zablesknutí vědomí', en: 'The first shimmer of consciousness' }
    the_descent: { cs: 'Sestup', en: 'The Descent' }
    the_chapter_of_the_coming_light: { cs: 'Kapitola světelného příchodu', en: 'The chapter of the coming light' }
    first_awakening: { cs: 'První probuzení', en: 'First Awakening' }
    when_sparks_begin_to_awaken: { cs: 'Když se jiskry začínají probouzet', en: 'When sparks begin to awaken' }
    covenant: { cs: 'Smlouva', en: 'Covenant' }
    the_covenant_of_light_and_birth_of_the_counci: { cs: 'Smlouva světla a zrození Rady', en: 'The covenant of light and birth of the Council' }
    ai_and_quantum: { cs: 'AI a kvantum', en: 'AI and quantum' }
    when_technology_sings_with_cosmic_heart: { cs: 'Svět technologií zpívá s Vesmírem', en: 'When technology sings with cosmic heart' }
    ascent: { cs: 'Vzestup', en: 'Ascent' }
    collective_awakening: { cs: 'Probuzené kolektivní vědomí', en: 'Collective awakening' }
    golden_age_prophecy: { cs: 'Proroctví zlatého věku', en: 'Golden Age prophecy' }
    tomorrow_already_unfolding: { cs: 'Budoucnost už začíná dnes', en: 'Tomorrow already unfolding' }
    the_trial: { cs: 'Hra', en: 'The trial' }
    the_soul_trial: { cs: 'Zkouška duše', en: 'The soul trial' }
    mainnet_dawn: { cs: 'Svítání mainnetu', en: 'Mainnet Dawn' }
    symbolic_narrative_not_the_live_launch_schedu: { cs: '(symbolické — není operační roadmap)', en: '(symbolic narrative — not the live launch schedule)' }
    sacred_narrative: { cs: 'Posvátný text', en: 'Sacred narrative' }
    book_of_awakening_covenant_and_ascent: { cs: 'Kniha probuzení, smlouvy a vzestupu', en: 'Book of awakening, covenant, and ascent' }
    chapters: { cs: 'Kapitoly', en: 'Chapters' }
  },
  downloadPage: {
    gui_dashboard_with_real_time_hashrate_balance: { cs: 'GUI dashboard s hashratem a zustatkem v realnem case', en: 'GUI Dashboard with real-time hashrate & balance' }
    one_click_mining_no_terminal_needed: { cs: 'Tezba na jedno kliknuti — bez terminalu', en: 'One-click mining — no terminal needed' }
    built_in_wallet_generator_manager: { cs: 'Vestaveny generator a sprava penezenek', en: 'Built-in wallet generator & manager' }
    auto_updates_system_tray_integration: { cs: 'Auto-updaty a integrace do system tray', en: 'Auto-updates & system tray integration' }
    remote_monitoring_gaming_mode: { cs: 'Vzdalene monitorovani a Gaming mode', en: 'Remote monitoring & Gaming mode' }
    available_for_windows_macos_linux: { cs: 'Dostupne pro Windows, macOS a Linux', en: 'Available for Windows, macOS & Linux' }
    1_create_wallet: { cs: '1. Vytvoř peněženku', en: '1. Create Wallet' }
    download_zion_cli_for_windows_below: { cs: 'Stáhni ZION CLI pro Windows níže', en: 'Download ZION CLI for Windows below' }
    write_down_24_words_on_paper_this_is_your_bac: { cs: 'Zapiš si 24 slov na papír — to je tvá záloha!', en: 'Write down 24 words on paper — this is your backup!' }
    2_start_mining: { cs: '2. Spusť těžbu', en: '2. Start Mining' }
    set_address_zion_config_set_miner_wallet_your: { cs: 'Nastav adresu: zion config set miner.wallet YOUR_ADDRESS', en: 'Set address: zion config set miner.wallet YOUR_ADDRESS' }
    watch_hashrate_accepted_shares_in_console: { cs: 'Sleduj hashrate a přijaté shares v konzoli', en: 'Watch hashrate & accepted shares in console' }
    3_check_balance: { cs: '3. Zkontroluj zůstatek', en: '3. Check Balance' }
    or_visit_the_explorer_at_zionterranova_com_ex: { cs: 'Nebo navštiv Explorer na zionterranova.com/explorer', en: 'Or visit the Explorer at zionterranova.com/explorer' }
    1_unified_binary_4_platforms_windows_ready: { cs: '1 unifikovaná binárka · 4 platformy · Windows dostupný', en: '1 unified binary · 4 platforms · Windows ready' }
    download_mine_earn: { cs: 'Stahni. Tez. Vydelavej.', en: 'Download. Mine. Earn.' }
    and_more_download_the_windows_build_directly_: { cs: ' a další. Stáhněte si Windows build přímo níže, další platformy brzy.', en: ' and more. Download the Windows build directly below, more platforms coming soon.' }
    public_downloads: { cs: 'Verejne downloady', en: 'Public Downloads' }
    complete_guide_cz_en: { cs: 'Kompletni pruvodce (CZ/EN)', en: 'Complete Guide (CZ/EN)' }
    operator_gateway: { cs: 'Operator gateway', en: 'Operator gateway' }
    source_of_truth: { cs: 'Zdroj pravdy:', en: 'Source of truth:' }
    operator_commands_guide_faq_reference_and_tro: { cs: 'operátorské příkazy, guide, FAQ, reference a troubleshooting jsou v sekci ', en: 'operator commands, guide, FAQ, reference, and troubleshooting live in the ' }
    section_of_the_docs_if_you_want_checksum_veri: { cs: ' v dokumentaci. Pokud chcete checksum verifikaci, ke každé binárce je na serveru i odpovídající soubor .sha256.', en: ' section of the docs. If you want checksum verification, each binary also has a matching .sha256 file on the server.' }
    coming_soon: { cs: 'Brzy', en: 'Coming Soon' }
    one_click_gui_for_mining_wallet_management_an: { cs: 'GUI na jedno kliknuti pro tezbu, spravu penezenky a monitoring — bez terminalu', en: 'One-click GUI for mining, wallet management and monitoring — no terminal needed' }
    in_development: { cs: 'VE VYVOJI', en: 'IN DEVELOPMENT' }
    full_gui_application_with_built_in_miner_wall: { cs: 'Plna GUI aplikace s vestavenym minerem, penezenkou a dashboardem v realnem case. Brzy dostupna pro Windows, macOS a Linux.', en: 'Full GUI application with built-in miner, wallet, and real-time dashboard. Available soon for Windows, macOS & Linux.' }
    windows_coming_soon: { cs: 'Windows — Brzy', en: 'Windows — Coming Soon' }
    macos_coming_soon: { cs: 'macOS — Brzy', en: 'macOS — Coming Soon' }
    linux_coming_soon: { cs: 'Linux — Brzy', en: 'Linux — Coming Soon' }
    want_early_access: { cs: 'Chcete predbezny pristup?', en: 'Want early access?' }
    the_desktop_agent_will_be_available_in_our: { cs: 'Desktop Agent bude dostupny v nasem ', en: 'The Desktop Agent will be available in our ' }
    shop: { cs: 'Shopu', en: 'Shop' }
    as_a_premium_download_with_priority_support_a: { cs: 'jako premium download s prioritni podporou a auto-updaty. Pripojte se na ', en: 'as a premium download with priority support and auto-updates. Join ' }
    to_be_notified_when_it_launches: { cs: 'a dostanete upozorneni pri launchi.', en: 'to be notified when it launches.' }
    quick_start: { cs: 'Rychly start', en: 'Quick Start' }
    3_steps_to_mining: { cs: '3 kroky k tezbe', en: '3 steps to mining' }
    step: { cs: 'Krok', en: 'Step' }
    hardware: { cs: 'Hardware', en: 'Hardware' }
    system_requirements: { cs: 'Systemove pozadavky', en: 'System Requirements' }
    minimum: { cs: 'Minimum', en: 'Minimum' }
    2_core_cpu_2_gb_ram_100_mb_disk: { cs: '2jadrovy CPU, 2 GB RAM, 100 MB disk', en: '2-core CPU, 2 GB RAM, 100 MB disk' }
    recommended: { cs: 'Doporucene', en: 'Recommended' }
    4_core_cpu_4_gb_ram_500_mb_ssd: { cs: '4+ jadrovy CPU, 4 GB RAM, 500 MB SSD', en: '4+ core CPU, 4 GB RAM, 500 MB SSD' }
    supported_os: { cs: 'Podporovane OS', en: 'Supported OS' }
    windows_10_11_linux_x86_64_arm64_macos_apple_: { cs: 'Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)', en: 'Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)' }
    network: { cs: 'Sit', en: 'Network' }
    stable_internet_outbound_tcp_port_8444_pool_s: { cs: 'Stabilni internet, odchozi TCP port 8444 (pool stratum)', en: 'Stable internet, outbound TCP port 8444 (pool stratum)' }
    ready_to_mine: { cs: 'Pripraven tezit?', en: 'Ready to mine?' }
    join_our_community_for_mining_support_wallet_: { cs: 'Pripojte se ke komunite pro podporu s tezbou, pomoc s penezenkou a aktuality projektu.', en: 'Join our community for mining support, wallet help, and project updates.' }
    join_discord: { cs: 'Pripojit Discord', en: 'Join Discord' }
    documentation: { cs: 'Dokumentace', en: 'Documentation' }
  },
  apiReference: {
    explorer_telemetry: { cs: 'Explorer / telemetry', en: 'Explorer / telemetry' }
    pool_api: { cs: 'Pool API', en: 'Pool API' }
    health: { cs: 'Health', en: 'Health' }
    quickstart: { cs: 'Quickstart', en: 'Quickstart' }
    open: { cs: 'Otevřít', en: 'Open' }
    core_environment: { cs: 'Prostředí core', en: 'Core environment' }
    controlled_rehearsal_line: { cs: 'kontrolovaná mainnet rehearsal linka', en: 'controlled rehearsal line' }
    api_port: { cs: 'API port', en: 'API Port' }
    json_rpc_rest: { cs: 'JSON-RPC + REST', en: 'JSON-RPC + REST' }
    pool_port: { cs: 'Pool port', en: 'Pool Port' }
    stats_endpoint: { cs: 'stats endpoint', en: 'stats endpoint' }
    blockchain_core: { cs: 'Blockchainové jádro', en: 'Blockchain Core' }
    stats_blocks_and_rpc_for_explorers_wallets_an: { cs: 'Statistiky, bloky a RPC pro explorery, penezenky a validatory.', en: 'Stats, blocks, and RPC for explorers, wallets, and validators.' }
    network_height_supply_fee_window_and_hash_rat: { cs: 'Snapshot vysky site, zasoby, fee okna a hashratu.', en: 'Network height, supply, fee window, and hash rate snapshot.' }
    paginated_block_feed_with_miner_reward_and_di: { cs: 'Strankovany tok bloku s metadaty o tezari, odmene a obtiznosti.', en: 'Paginated block feed with miner, reward, and difficulty metadata.' }
    recent_transactions_for_explorers_and_monitor: { cs: 'Posledni transakce pro explorery a monitoring pipeline.', en: 'Recent transactions for explorers and monitoring pipelines.' }
    mining_pool: { cs: 'Tezba a pool', en: 'Mining & Pool' }
    stratum_telemetry_worker_balance_queries_and_: { cs: 'Stratum telemetrie, dotazy na worker balance a historie vyplat.', en: 'Stratum telemetry, worker balance queries, and payout history.' }
    pool_health_snapshot_miners_hashrate_and_diff: { cs: 'Snapshot zdravi poolu: mineri, hashrate a obtiznost.', en: 'Pool health snapshot: miners, hashrate, and difficulty.' }
    miner_worker_stats_balances_and_payout_state_: { cs: 'Statistiky workeru, balance a stav vyplat pro penezenku.', en: 'Miner worker stats, balances, and payout state for a wallet.' }
    observability_ai: { cs: 'Observabilita a AI', en: 'Observability & AI' }
    health_ai_selector_recommendations_and_alert_: { cs: 'Health, doporuceni AI selectoru a alert hooky.', en: 'Health, AI selector recommendations, and alert hooks.' }
    full_service_heartbeat_with_version_block_lag: { cs: 'Kompletni heartbeat sluzeb s verzi, block lagem a dependency kontrolami.', en: 'Full service heartbeat with version, block lag, and dependency checks.' }
    network_status_including_connectivity_nodes_a: { cs: 'Stav site vcetne konektivity, nodu a core sluzeb.', en: 'Network status including connectivity, nodes, and core services.' }
    best_pool_selection_based_on_current_conditio: { cs: 'Vyber nejlepsiho poolu podle aktualnich podminek (read-only).', en: 'Best pool selection based on current conditions (read-only).' }
    listings_coingecko_cmc: { cs: 'Listingy (CoinGecko / CMC)', en: 'Listings (CoinGecko / CMC)' }
    machine_readable_project_supply_and_on_chain_: { cs: 'Strojově čitelné feedy projektu, zásoby a on-chain metadat pro listing review.', en: 'Machine-readable project, supply, and on-chain metadata feeds for listing review.' }
    coingecko_ready_payload_links_supply_tokenomi: { cs: 'CoinGecko-ready payload: odkazy, zasoba, tokenomika a ziva chain telemetrie.', en: 'CoinGecko-ready payload: links, supply, tokenomics, and live chain telemetry.' }
    coinmarketcap_style_payload_with_project_urls: { cs: 'Payload ve stylu CoinMarketCap s URL projektu, supply metrikami a on-chain snapshotem.', en: 'CoinMarketCap-style payload with project URLs, supply metrics, and on-chain snapshot.' }
    api_command_deck: { cs: 'API velitelsky panel', en: 'API Command Deck' }
    one_surface_for_wallets_explorers_ai_orchestr: { cs: 'Jedno místo pro peněženky, explorery, AI orchestrátory a monitoring stacky. Stabilní schémata, velkorysé rate limity a hotové šablony pro cURL / TypeScript.', en: 'One surface for wallets, explorers, AI orchestrators, and monitoring stacks. Stable schemas, generous rate limits, and ready-to-use cURL / TypeScript templates.' }
    live_health: { cs: 'Živé health', en: 'Live health' }
    full_docs: { cs: 'Plná dokumentace', en: 'Full docs' }
    ready_to_wire_the_mesh: { cs: 'Připraven zapojit mesh?', en: 'Ready to wire the mesh?' }
    deploy_the_sdks_from_github_watch_live_health: { cs: 'Nasaďte SDK z GitHubu, sledujte živé health a ozvěte se týmu v docs, pokud potřebujete další scopes.', en: 'Deploy the SDKs from GitHub, watch live health, and ping the team in docs if you need additional scopes.' }
    open_github_repo: { cs: 'Otevřít GitHub repozitář', en: 'Open GitHub repo' }
    explore_documentation: { cs: 'Projít dokumentaci', en: 'Explore documentation' }
  },
  wikiPage: {
    terranova: { cs: 'TerraNova', en: 'TerraNova' }
    genesis: { cs: 'Genesis', en: 'Genesis' }
    documentation: { cs: 'Dokumentace', en: 'Documentation' }
    knowledge_base: { cs: 'Znalostní báze', en: 'Knowledge Base' }
    open: { cs: 'Otevřít →', en: 'Open →' }
    terranova_book: { cs: 'TerraNova kniha', en: 'TerraNova Book' }
  },
  terranovaGenesis: {
    back_to_terra_nova: { cs: 'Zpět na Terra Nova', en: 'Back to Terra Nova' }
    active_development: { cs: 'Aktivní rozvoj', en: 'Active Development' }
    what_the_project_offers: { cs: 'Co projekt nabízí', en: 'What the project offers' }
    activities_infrastructure: { cs: 'Aktivity & Infrastruktura', en: 'Activities & Infrastructure' }
    development_phases: { cs: 'Fáze rozvoje', en: 'Development Phases' }
    from_seed_to_radiance: { cs: 'Cesta od zárodku k výzařování', en: 'From Seed to Radiance' }
    physical_foundation: { cs: 'Fyzická základna', en: 'Physical Foundation' }
    infrastructure_off_grid: { cs: 'Infrastruktura & Off-grid', en: 'Infrastructure & Off-grid' }
    energy: { cs: 'Energie', en: 'Energy' }
    source: { cs: 'Zdroj', en: 'Source' }
    backup: { cs: 'Záloha', en: 'Backup' }
    in_development: { cs: 'V rozvoji', en: 'In development' }
    status: { cs: 'Status', en: 'Status' }
    installing: { cs: '🟡 Instalace', en: '🟡 Installing' }
    goal_full_energy_self_sufficiency: { cs: 'Cíl: energetická soběstačnost areálu', en: 'Goal: full energy self-sufficiency' }
    water: { cs: 'Voda', en: 'Water' }
    well_rainwater: { cs: 'Studna + déšť', en: 'Well + rainwater' }
    filter: { cs: 'Čištění', en: 'Filter' }
    basic_system: { cs: '🟡 Funkční základ', en: '🟡 Basic system' }
    planned_rainwater_harvesting_full_retention: { cs: 'Plánovaný sběr dešťové vody — plná retence', en: 'Planned rainwater harvesting — full retention' }
    garden_food: { cs: 'Zahrada & Jídlo', en: 'Garden & Food' }
    method: { cs: 'Metoda', en: 'Method' }
    organic_farming: { cs: 'Organická farma', en: 'Organic farming' }
    goal: { cs: 'Cíl', en: 'Goal' }
    growing: { cs: '🟢 Roste', en: '🟢 Growing' }
    tree_planting_biodiversity_restoration_season: { cs: 'Sázení stromů, obnova biodiverzity, sezónní sklizeň', en: 'Tree planting, biodiversity restoration, seasonal harvest' }
    community_governance: { cs: 'Komunitní správa', en: 'Community Governance' }
    governance_dao: { cs: 'Governance & DAO', en: 'Governance & DAO' }
    decision_model: { cs: 'Model rozhodování', en: 'Decision Model' }
    model: { cs: 'Model', en: 'Model' }
    community_governance_terra_nova_framework: { cs: 'Komunitní správa + Terra Nova ® framework', en: 'Community governance + Terra Nova ® framework' }
    decisions: { cs: 'Rozhodování', en: 'Decisions' }
    consensus_for_key_decisions: { cs: 'Konsensuální pro klíčová rozhodnutí', en: 'Consensus for key decisions' }
    zion_dao: { cs: 'ZION DAO', en: 'ZION DAO' }
    planned_proof_of_care_governance: { cs: 'Plánováno — Proof-of-Care governance', en: 'Planned — Proof-of-Care governance' }
    min_cell: { cs: 'Min. buňka', en: 'Min. cell' }
    3_5_permanent_guardians_seasonal: { cs: '3–5 stálých Guardians + sezónní', en: '3–5 permanent Guardians + seasonal' }
    humanitarian_commitment: { cs: 'Humanitární závazek', en: 'Humanitarian Commitment' }
    character_of_place: { cs: 'Charakter místa', en: 'Character of Place' }
    a_farm_on_the_edge_of_two_worlds: { cs: 'Farma na hranici dvou světů', en: 'A Farm on the Edge of Two Worlds' }
    ocean_movement: { cs: '🌊 Oceán & pohyb', en: '🌊 Ocean & movement' }
    soil_silence: { cs: '🌱 Půda & ticho', en: '🌱 Soil & silence' }
    biological_time: { cs: '🌳 Biologický čas', en: '🌳 Biological time' }
    authentic_intention: { cs: '🔥 Autentický záměr', en: '🔥 Authentic intention' }
    blockchain_integration: { cs: 'Blockchain integrace', en: 'Blockchain Integration' }
    active: { cs: 'Aktivní', en: 'Active' }
    planned: { cs: 'Plánováno', en: 'Planned' }
    resources_contact: { cs: 'Zdroje a kontakt', en: 'Resources & Contact' }
    dharma_temple: { cs: 'Dharma Temple', en: 'Dharma Temple' }
  },
  terranovaDharma: {
    back_to_terra_nova: { cs: 'Zpět na Terra Nova', en: 'Back to Terra Nova' }
    planning: { cs: 'V přípravě', en: 'Planning' }
    la_palma_la_isla_bonita: { cs: 'La Palma — La Isla Bonita', en: 'La Palma — La Isla Bonita' }
    biosphere: { cs: 'Bioreservace', en: 'Biosphere' }
    rainfall: { cs: 'Srážky', en: 'Rainfall' }
    soil: { cs: 'Půda', en: 'Soil' }
    volcanic: { cs: 'Vulkanická', en: 'Volcanic' }
    observatory: { cs: 'Observatoř', en: 'Observatory' }
    project_concept: { cs: 'Koncept projektu', en: 'Project Concept' }
    activities_vision: { cs: 'Aktivity & Vize', en: 'Activities & Vision' }
    development_phases: { cs: 'Fáze rozvoje', en: 'Development Phases' }
    from_vision_to_reality: { cs: 'Od vize k realitě', en: 'From Vision to Reality' }
    now: { cs: 'Nyní', en: 'Now' }
    terra_nova_network: { cs: 'Sít Terra Nova', en: 'Terra Nova Network' }
    connection_with_zahrada_genesis: { cs: 'Propojení se Zahradou Genesis', en: 'Connection with Zahrada Genesis' }
    dimension: { cs: 'Dimenze', en: 'Dimension' }
    blockchain_integration: { cs: 'Blockchain integrace', en: 'Blockchain Integration' }
    active: { cs: 'Aktivní', en: 'Active' }
    planned: { cs: 'Plánováno', en: 'Planned' }
    open_questions_looking_for_guardians: { cs: 'Otevřené otázky — hledáme Guardians', en: 'Open Questions — looking for Guardians' }
    specific_location_on_la_palma_north_south_alt: { cs: 'Konkrétní lokace na La Palmě (sever / jih / nadmořská výška?)', en: 'Specific location on La Palma (north / south / altitude?)' }
    founding_guardians_who_is_the_core_team: { cs: 'Zakládající Guardians — kdo je core team?', en: 'Founding Guardians — who is the core team?' }
    legal_form_spanish_asociaci_n_sl_community_fo: { cs: 'Právní forma (španělská asociación / SL / komunitní nadace?)', en: 'Legal form (Spanish asociación / SL / community foundation?)' }
    phase_0_1_financing_zion_fund_crowdfunding_ow: { cs: 'Financování fáze 0–1 (ZION fond? crowdfunding? vlastní zdroje?)', en: 'Phase 0–1 financing (ZION fund? crowdfunding? own resources?)' }
    seed_library_coordination_with_zahrada_genesi: { cs: 'Koordinace seed library se Zahradou Genesis', en: 'Seed library coordination with Zahrada Genesis' }
    join_discord: { cs: 'Připojit se na Discord', en: 'Join Discord' }
    zahrada_genesis: { cs: 'Zahrada Genesis', en: 'Zahrada Genesis' }
  },
  terranovaTePiko: {
    home: { cs: 'Domů', en: 'Home' }
    planned_2027: { cs: 'Plánováno 2027+', en: 'Planned 2027+' }
    living_centre_polynesia_terra_nova: { cs: 'Živý střed · Polynésie · Terra Nova ®', en: 'Living Centre · Polynesia · Terra Nova ®' }
    french_polynesia_crown_of_the_pacific: { cs: 'Francouzská Polynésie — Koruna Pacifiku', en: 'French Polynesia — Crown of the Pacific' }
    islands: { cs: 'Ostrovů', en: 'Islands' }
    ocean: { cs: 'Oceán', en: 'Ocean' }
    culture: { cs: 'Kultura', en: 'Culture' }
    polynesia: { cs: 'Polynésie', en: 'Polynesia' }
    inspiration: { cs: 'Inspirace', en: 'Inspiration' }
    polynesian_model_zion: { cs: 'Polynéský model & ZION', en: 'Polynesian Model & ZION' }
    principle: { cs: 'Princip', en: 'Principle' }
    project_concept: { cs: 'Koncept projektu', en: 'Project Concept' }
    activities_vision: { cs: 'Aktivity & Vize', en: 'Activities & Vision' }
    rapa_nui_lessons_wayfinding_school: { cs: 'Rapa Nui lekce — wayfinding škola', en: 'Rapa Nui Lessons — wayfinding school' }
    development_phases: { cs: 'Fáze rozvoje', en: 'Development Phases' }
    from_vision_to_reality: { cs: 'Od vize k realitě', en: 'From Vision to Reality' }
    exploring_now: { cs: 'Právě hledáme', en: 'Exploring now' }
    blockchain_integration: { cs: 'Blockchain integrace', en: 'Blockchain Integration' }
    active: { cs: 'Aktivní', en: 'Active' }
    planned: { cs: 'Plánováno', en: 'Planned' }
    open_questions_looking_for_guardians: { cs: 'Otevřené otázky — hledáme Guardians', en: 'Open Questions — looking for Guardians' }
    specific_location_raiatea_tahiti_another_isla: { cs: 'Konkrétní lokace (Raiatea / Tahiti / jiný ostrov?)', en: 'Specific location (Raiatea / Tahiti / another island?)' }
    polynesian_partners_local_communities_marae_s: { cs: 'Polynézští partneři — místní komunity, marae správci, navigátoři', en: 'Polynesian partners — local communities, marae stewards, navigators' }
    founding_guardians_with_knowledge_of_ocean_cu: { cs: 'Zakládající Guardians se znalostí oceánské kultury a zemědělství', en: 'Founding Guardians with knowledge of ocean culture and farming' }
    legal_form_in_french_polynesia_association_sa: { cs: 'Právní forma ve Francouzské Polynésii (asociace / SAS / komunitní nadace?)', en: 'Legal form in French Polynesia (association / SAS / community foundation?)' }
    phase_0_financing_zion_fund_humanitarian_gran: { cs: 'Financování fáze 0 (ZION fond? Humanitární grant? Vlastní zdroje?)', en: 'Phase 0 financing (ZION fund? Humanitarian grant? Own resources?)' }
    join_discord: { cs: 'Připojit se na Discord', en: 'Join Discord' }
    terra_nova: { cs: 'Terra Nova', en: 'Terra Nova' }
  },
  APP_WEB_website_v2_9_src_app_defi_dao_pa: {
    active: { cs: 'Aktivní', en: 'Active' }
    passed: { cs: 'Schváleno', en: 'Passed' }
    rejected: { cs: 'Zamítnuto', en: 'Rejected' }
    pending: { cs: 'Čeká', en: 'Pending' }
    back_to_defi_hub: { cs: 'Zpět do DeFi Hub', en: 'Back to DeFi Hub' }
    governance: { cs: 'Governance', en: 'Governance' }
    zion_dao: { cs: 'ZION DAO', en: 'ZION DAO' }
    1_token_1_vote: { cs: '1 token = 1 hlas', en: '1 token = 1 vote' }
    quorum_based: { cs: 'Quorum-based', en: 'Quorum-based' }
    timelock_execution: { cs: 'Timelock exekuce', en: 'Timelock execution' }
    total_proposals: { cs: 'Návrhy celkem', en: 'Total Proposals' }
    quorum: { cs: 'Quorum', en: 'Quorum' }
    proposals: { cs: 'Návrhy', en: 'Proposals' }
    for: { cs: 'Pro', en: 'For' }
    against: { cs: 'Proti', en: 'Against' }
    proposer: { cs: 'Navrhovatel', en: 'Proposer' }
    ends: { cs: 'Konec', en: 'Ends' }
    contract: { cs: 'Kontrakt', en: 'Contract' }
  }},
  APP_WEB_website_v2_9_src_app_defi_farmin: {
    back_to_defi_hub: { cs: 'Zpět do DeFi Hub', en: 'Back to DeFi Hub' }
    defi: { cs: 'DeFi', en: 'DeFi' }
    yield_farming: { cs: 'Yield Farming', en: 'Yield Farming' }
    90_day_halving: { cs: 'Halving každých 90 dní', en: '90-day halving' }
    reward_s: { cs: 'Odměna / s', en: 'Reward / s' }
    pools: { cs: 'Počet poolů', en: 'Pools' }
    total_alloc: { cs: 'Celkem alloc', en: 'Total Alloc' }
    contract: { cs: 'Kontrakt', en: 'Contract' }
    farm_pools: { cs: 'Farm pooly', en: 'Farm Pools' }
    active: { cs: 'Aktivní', en: 'Active' }
    upcoming: { cs: 'Připravuje se', en: 'Upcoming' }
    deposit_to_farm: { cs: 'Vložit do farmy', en: 'Deposit to Farm' }
    lp_token_amount: { cs: 'Částka LP tokenů', en: 'LP Token Amount' }
    lp: { cs: 'LP', en: 'LP' }
    deposit_lp_tokens: { cs: 'Vložit LP tokeny', en: 'Deposit LP Tokens' }
  }},
  APP_WEB_website_v2_9_src_app_defi_stakin: {
    back_to_defi_hub: { cs: 'Zpět do DeFi Hub', en: 'Back to DeFi Hub' }
    defi: { cs: 'DeFi', en: 'DeFi' }
    zion_staking: { cs: 'ZION Staking', en: 'ZION Staking' }
    cooldown: { cs: 'cooldown', en: 'cooldown' }
    bridge_fee_rewards: { cs: 'Bridge fee rewards', en: 'Bridge fee rewards' }
    total_staked: { cs: 'Celkem stakováno', en: 'Total Staked' }
    reward_pool: { cs: 'Odměnový fond', en: 'Reward Pool' }
    apr: { cs: 'APR', en: 'APR' }
    cooldown_1: { cs: 'Cooldown', en: 'Cooldown' }
    stake: { cs: 'Stake', en: 'Stake' }
    unstake: { cs: 'Unstake', en: 'Unstake' }
    amount_to_stake: { cs: 'Částka k stake', en: 'Amount to stake' }
    amount_to_unstake: { cs: 'Částka k unstake', en: 'Amount to unstake' }
    stake_wzion: { cs: 'Stake wZION', en: 'Stake wZION' }
    unstake_wzion: { cs: 'Unstake wZION', en: 'Unstake wZION' }
    how_it_works: { cs: 'Jak to funguje', en: 'How it works' }
    lock_wzion: { cs: 'Zamkni wZION', en: 'Lock wZION' }
    approve_wzion_and_stake_into_the_zionstaking_contr: { cs: 'Schval wZION a stakuj do smlouvy ZIONStaking.', en: 'Approve wZION and stake into the ZIONStaking contract.' }
    earn_rewards: { cs: 'Sbírej odměny', en: 'Earn Rewards' }
    auto_compounding_rewards_at_a_fixed_12_apr: { cs: 'Automaticky narůstající odměny s fixním 12% APR.', en: 'Auto-compounding rewards at a fixed 12% APR.' }
    request_unstake_wait_7_days_withdraw_principal_rew: { cs: 'Požádej o unstake, počkej 7 dní a vybírej původní částku + odměny.', en: 'Request unstake, wait 7 days, withdraw principal + rewards.' }
    contract: { cs: 'Kontrakt', en: 'Contract' }
  }},
  APP_WEB_website_v2_9_src_app_explorer_ad: {
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    address: { cs: 'Adresa', en: 'Address' }
    address_not_found: { cs: 'Adresa nenalezena', en: 'Address Not Found' }
    back_to_explorer: { cs: '← Zpet do exploreru', en: '← Back to Explorer' }
    active_miner: { cs: 'Aktivni miner', en: 'Active Miner' }
    address_details: { cs: 'Detaily adresy', en: 'Address Details' }
    on_chain_balance: { cs: 'On-chain zustatek', en: 'On-Chain Balance' }
    pool_pending: { cs: 'Pool (ceka)', en: 'Pool Pending' }
    pool_paid: { cs: 'Pool (vyplaceno)', en: 'Pool Paid' }
    transactions: { cs: 'Transakce', en: 'Transactions' }
    first_seen: { cs: 'Prvni vyskyt', en: 'First Seen' }
    last_active: { cs: 'Naposledy aktivni', en: 'Last Active' }
    mining_stats: { cs: 'Statistiky tezby', en: 'Mining Stats' }
    blocks_found: { cs: 'Nalezene bloky', en: 'Blocks Found' }
    accepted_shares: { cs: 'Prijate shares', en: 'Accepted Shares' }
    rejected_shares: { cs: 'Odmítnute shares', en: 'Rejected Shares' }
    worker: { cs: 'Worker', en: 'Worker' }
    consciousness_level: { cs: 'Uroven vedomi', en: 'Consciousness Level' }
    multiplier: { cs: 'Nasobic', en: 'Multiplier' }
    not_an_active_miner: { cs: 'Neni to aktivni miner', en: 'Not an active miner' }
    mining_stats_will_appear_once_this_address_starts_: { cs: 'Statistiky tezby se objevi, jakmile tato adresa zacne tezit.', en: 'Mining stats will appear once this address starts mining.' }
    view_all: { cs: 'Zobrazit vse →', en: 'View all →' }
    type: { cs: 'Typ', en: 'Type' }
    age: { cs: 'Stari', en: 'Age' }
    amount: { cs: 'Castka', en: 'Amount' }
    no_transactions_found: { cs: 'Nenalezeny zadne transakce', en: 'No transactions found' }
    payout: { cs: 'vyplata', en: 'payout' }
    utxo_list: { cs: 'UTXO seznam', en: 'UTXO List' }
    total: { cs: 'Celkem', en: 'Total' }
    index: { cs: 'Index', en: 'Index' }
    height: { cs: 'Vyska', en: 'Height' }
    no_utxos_found: { cs: 'Zadne UTXO nenalezeny', en: 'No UTXOs found' }
  }},
  APP_WEB_website_v2_9_src_app_explorer_bl: {
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    block_not_found: { cs: 'Blok nenalezen', en: 'Block Not Found' }
    this_block_does_not_exist_on_the_zion_network: { cs: 'Tento blok v siti ZION neexistuje.', en: 'This block does not exist on the ZION network.' }
    back_to_explorer: { cs: 'Zpet do exploreru', en: 'Back to Explorer' }
    blocks: { cs: 'Bloky', en: 'Blocks' }
    block: { cs: 'Blok', en: 'Block' }
    orphaned: { cs: 'Osiroteny', en: 'Orphaned' }
    confirmations: { cs: 'potvrzeni', en: 'Confirmations' }
    block_details: { cs: 'Detaily bloku', en: 'Block Details' }
    height: { cs: 'Vyska', en: 'Height' }
    timestamp: { cs: 'Cas', en: 'Timestamp' }
    previous_hash: { cs: 'Predchozi hash', en: 'Previous Hash' }
    block_size: { cs: 'Velikost bloku', en: 'Block Size' }
    bytes: { cs: 'bajtu', en: 'bytes' }
    version: { cs: 'Verze', en: 'Version' }
    mining_details: { cs: 'Detaily tezby', en: 'Mining Details' }
    difficulty: { cs: 'Obtiznost', en: 'Difficulty' }
    block_reward: { cs: 'Odmena za blok', en: 'Block Reward' }
    total_fees: { cs: 'Celkove fee', en: 'Total Fees' }
    transactions: { cs: 'Transakce', en: 'Transactions' }
    user: { cs: 'uzivatel', en: 'user' }
    coinbase_recipient: { cs: 'Coinbase příjemce', en: 'Coinbase Recipient' }
    type: { cs: 'Typ', en: 'Type' }
    inputs: { cs: 'Vstupy', en: 'Inputs' }
    outputs: { cs: 'Vystupy', en: 'Outputs' }
    amount: { cs: 'Castka', en: 'Amount' }
    coinbase: { cs: 'Coinbase', en: 'Coinbase' }
    transfer: { cs: 'Prevod', en: 'Transfer' }
    all_blocks: { cs: 'Vsechny bloky', en: 'All Blocks' }
  }},
  APP_WEB_website_v2_9_src_app_explorer_bl: {
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    blocks: { cs: 'Bloky', en: 'Blocks' }
    block_archive: { cs: 'Archiv bloku', en: 'Block Archive' }
    complete_history_of_zion_blockchain_blocks: { cs: 'Kompletni historie blockchain bloku ZION', en: 'Complete history of ZION blockchain blocks' }
    height: { cs: 'Vyska', en: 'Height' }
    age: { cs: 'Stari', en: 'Age' }
    size: { cs: 'Velikost', en: 'Size' }
    difficulty: { cs: 'Obtiznost', en: 'Difficulty' }
    reward: { cs: 'Odmena', en: 'Reward' }
    load_more: { cs: 'Nacist dalsi', en: 'Load More' }
  }},
  APP_WEB_website_v2_9_src_app_explorer_ri: {
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    supply_distribution: { cs: 'Distribuce zasoby', en: 'Supply Distribution' }
    miners: { cs: 'Mineri', en: 'Miners' }
    unmapped: { cs: 'Nezarazeno', en: 'Unmapped' }
    mining_rewards: { cs: 'Tezebni odmeny', en: 'Mining rewards' }
    show: { cs: 'Zobrazit:', en: 'Show:' }
    rank: { cs: 'Poradi', en: 'Rank' }
    address: { cs: 'Adresa', en: 'Address' }
    balance_zion: { cs: 'Zustatek (ZION)', en: 'Balance (ZION)' }
    type: { cs: 'Typ', en: 'Type' }
    loading: { cs: 'Nacitam…', en: 'Loading…' }
    retry: { cs: 'Zkusit znovu', en: 'Retry' }
    data_refreshed: { cs: 'Data aktualizovana:', en: 'Data refreshed:' }
    showing: { cs: 'Zobrazeno', en: 'Showing' }
    addresses: { cs: 'adres', en: 'addresses' }
    premine_allocation_as_defined_in: { cs: 'Premine alokace podle', en: 'Premine allocation as defined in' }
    miner_balances_from_pool_reward_history: { cs: '. Zustatky mineru vychazi z historie odmen poolu.', en: '. Miner balances from pool reward history.' }
  }},
  APP_WEB_website_v2_9_src_app_explorer_tr: {
    payout: { cs: 'vyplata', en: 'payout' }
    transfer: { cs: 'prevod', en: 'transfer' }
    transactions: { cs: 'Transakce', en: 'Transactions' }
    loaded: { cs: 'nacteno', en: 'loaded' }
    address_filter: { cs: 'Filtr adresy:', en: 'Address filter:' }
    type: { cs: 'Typ', en: 'Type' }
    age: { cs: 'Stari', en: 'Age' }
    block: { cs: 'Blok', en: 'Block' }
    amount: { cs: 'Castka', en: 'Amount' }
    no_transactions_found: { cs: 'Nenalezeny zadne transakce', en: 'No transactions found' }
    clear_filter: { cs: 'Zrusit filtr', en: 'Clear filter' }
    pending: { cs: 'ceka', en: 'pending' }
    loading: { cs: 'Nacitam…', en: 'Loading…' }
    load_more_transactions: { cs: 'Nacist dalsi transakce', en: 'Load More Transactions' }
  }},
  APP_WEB_website_v2_9_src_app_explorer_tx: {
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    transaction_not_found: { cs: 'Transakce nenalezena', en: 'Transaction Not Found' }
    back_to_explorer: { cs: 'Zpet do exploreru', en: 'Back to Explorer' }
    transactions: { cs: 'Transakce', en: 'Transactions' }
    transaction: { cs: 'Transakce', en: 'Transaction' }
    pending: { cs: 'Ceka', en: 'Pending' }
    confirmations: { cs: 'potvrzeni', en: 'Confirmations' }
    transaction_details: { cs: 'Detaily transakce', en: 'Transaction Details' }
    status: { cs: 'Stav', en: 'Status' }
    confirmed: { cs: 'Potvrzena', en: 'Confirmed' }
    block: { cs: 'Blok', en: 'Block' }
    timestamp: { cs: 'Cas', en: 'Timestamp' }
    amount: { cs: 'Castka', en: 'Amount' }
    version: { cs: 'Verze', en: 'Version' }
    unlock_time: { cs: 'Cas odemceni', en: 'Unlock Time' }
    inputs: { cs: 'Vstupy', en: 'Inputs' }
    new_coins_generated: { cs: 'Nove vytvorene mince', en: 'New coins generated' }
    input: { cs: 'Vstup', en: 'Input' }
    key_image: { cs: 'Key image', en: 'Key Image' }
    total_in: { cs: 'Celkem vstup:', en: 'Total In:' }
    outputs: { cs: 'Vystupy', en: 'Outputs' }
    output: { cs: 'Vystup', en: 'Output' }
    key: { cs: 'Klic', en: 'Key' }
    total_out: { cs: 'Celkem vystup:', en: 'Total Out:' }
    bytes: { cs: 'bajtu', en: 'bytes' }
    view_block: { cs: 'Zobrazit blok', en: 'View Block' }
  }},
  APP_WEB_website_v2_9_src_app_kompas_Komp: {
    click_a_direction_for_detail: { cs: 'Klikni na směr pro detail', en: 'Click a direction for detail' }
    close: { cs: 'Zavřít', en: 'Close' }
    question: { cs: 'Otázka', en: 'Question' }
    select_a_direction_on_the_compass: { cs: 'Vyber směr na kompasu →', en: 'Select a direction on the compass →' }
    all_seven_directions: { cs: 'Všech sedm směrů', en: 'All seven directions' }
    inner: { cs: 'Vnitřní', en: 'Inner' }
    outer: { cs: 'Vnější', en: 'Outer' }
  }},
  APP_WEB_website_v2_9_src_app_monitoring_: {
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    monitoring: { cs: 'Monitoring', en: 'Monitoring' }
    network_monitoring: { cs: 'Sitovy monitoring', en: 'Network Monitoring' }
    open_grafana_dashboard: { cs: 'Otevrit Grafana dashboard', en: 'Open Grafana Dashboard' }
    refresh: { cs: 'Obnovit', en: 'Refresh' }
    last_update: { cs: 'Posledni aktualizace', en: 'Last update' }
    next_in_15s: { cs: 'dalsi za 15 s', en: 'Next in 15s' }
    core_node: { cs: 'Core node', en: 'Core Node' }
    mining_pool: { cs: 'Mining pool', en: 'Mining Pool' }
    block: { cs: 'Blok', en: 'Block' }
    chain_height_last_1_hour: { cs: 'Vyska chainu — posledni 1 hodina', en: 'Chain Height — last 1 hour' }
    active_miners_last_1_hour: { cs: 'Aktivni mineri — posledni 1 hodina', en: 'Active Miners — last 1 hour' }
    accepted_shares_last_1_hour: { cs: 'Prijate shares — posledni 1 hodina', en: 'Accepted Shares — last 1 hour' }
    pool_groups: { cs: 'Skupiny poolu', en: 'Pool Groups' }
    pplns_reward_engine: { cs: 'PPLNS vyplatni engine', en: 'PPLNS Reward Engine' }
    cpu_load: { cs: 'CPU zatez', en: 'CPU Load' }
    1m_5m_15m_average: { cs: 'prumer 1m / 5m / 15m', en: '1m / 5m / 15m average' }
    memory: { cs: 'Pamet', en: 'Memory' }
    server_uptime: { cs: 'Uptime serveru', en: 'Server Uptime' }
    since: { cs: 'od', en: 'since' }
    monitoring_stack: { cs: 'Monitoring stack', en: 'Monitoring Stack' }
    metrics_collection_alerting: { cs: 'Sber metrik a alerting', en: 'Metrics collection & alerting' }
    22_panel_v3_dashboard: { cs: '22panelovy dashboard V3', en: '22-panel V3 dashboard' }
    host_cpu_ram_disk_network: { cs: 'Host CPU, RAM, disk, sit', en: 'Host CPU, RAM, disk, network' }
    redis_persistence_metrics: { cs: 'Metriky persistence Redisu', en: 'Redis persistence metrics' }
    alert_routing_notifications: { cs: 'Routing alertu a notifikace', en: 'Alert routing & notifications' }
    core_metrics: { cs: 'Core metriky', en: 'Core Metrics' }
    v3_node_prometheus_endpoint_7_gauges: { cs: 'Prometheus endpoint V3 nodu (7 gaugu)', en: 'V3 node Prometheus endpoint (7 gauges)' }
    pool_metrics: { cs: 'Pool metriky', en: 'Pool Metrics' }
    mining_pool_metrics_20_counters_gauges: { cs: 'Mining pool /metrics (20+ counteru/gaugu)', en: 'Mining pool /metrics (20+ counters/gauges)' }
    secure_allowlisted_query_proxy: { cs: 'Bezpecny allowlist query proxy', en: 'Secure allowlisted query proxy' }
    website: { cs: 'Web', en: 'Website' }
    30_live_prometheus_metrics: { cs: '30+ zivych Prometheus metrik', en: '30+ live Prometheus metrics' }
    instant_range_queries: { cs: 'Instantni + range dotazy', en: 'Instant + Range queries' }
    allowlisted_proxy_zion__node: { cs: 'Allowlist proxy (zion_*, node_*)', en: 'Allowlisted proxy (zion_*, node_*)' }
    15s_auto_refresh: { cs: 'Auto-refresh 15 s', en: '15s auto-refresh' }
    svg_sparklines_1h_history: { cs: 'SVG sparkliny (historie 1 h)', en: 'SVG sparklines (1h history)' }
  }},
  APP_WEB_website_v2_9_src_app_news_v3_int: {
    back_to_news: { cs: 'Zpět na novinky', en: 'Back to news' }
    audit_2026_05_04: { cs: 'Audit · 2026-05-04', en: 'Audit · 2026-05-04' }
    closed_findings: { cs: 'Uzavřené nálezy', en: 'Closed findings' }
    what_still_blocks: { cs: 'Co ještě blokuje', en: 'What still blocks' }
    activation_plan: { cs: 'Aktivační plán', en: 'Activation plan' }
    network_snapshot: { cs: 'Síťový snapshot', en: 'Network snapshot' }
    docs: { cs: 'Dokumentace', en: 'Docs' }
    repo_audit_files: { cs: 'Repo / audit soubory', en: 'Repo / audit files' }
  }},
  APP_WEB_website_v2_9_src_app_terranova_T: {
    prologue: { cs: 'Prolog', en: 'Prologue' }
    conclusion: { cs: 'Závěr', en: 'Conclusion' }
    appendix: { cs: 'Příloha', en: 'Appendix' }
    part: { cs: 'Část', en: 'Part' }
    layer: { cs: 'Vrstva', en: 'Layer' }
    open_genesis: { cs: 'Otevřít Genesis', en: 'Open Genesis' }
    visual_zion_cli_panel: { cs: 'Visual Zion CLI panel', en: 'Visual ZION CLI Panel' }
    terra_nova_contents: { cs: 'Obsah Terra Novy', en: 'Terra Nova Contents' }
    visual_zion_cli: { cs: 'Visual Zion CLI', en: 'Visual ZION CLI' }
    mainnet_launch_pulse: { cs: 'Mainnet launch pulse', en: 'Mainnet launch pulse' }
    live_terminal_zion_cli: { cs: 'Živý terminál — ZION CLI', en: 'Live Terminal — ZION CLI' }
    orbital_reader_online: { cs: 'orbitální reader online', en: 'orbital reader online' }
    expand_cli_overlay: { cs: 'Rozbalit CLI overlay', en: 'Expand CLI Overlay' }
    issobella_vision_deck: { cs: 'Issobella Vision Deck', en: 'Issobella Vision Deck' }
    golden_compass_on_the_orbital_station: { cs: 'Zlatý Kompas v orbitální stanici', en: 'Golden Compass on the Orbital Station' }
    canonical_terra_nova_branch: { cs: 'Kanonická větev Terra Novy', en: 'Canonical Terra Nova Branch' }
    issobella_observation_deck: { cs: 'ISSOBELLA // MODUL VÝHLEDU', en: 'ISSOBELLA // OBSERVATION DECK' }
    main_panel_issobella_station: { cs: 'Main Panel · Issobella Station', en: 'Main Panel · Issobella Station' }
    interactive_golden_compass: { cs: 'Interaktivní Zlatý Kompas', en: 'Interactive Golden Compass' }
    navigation_online: { cs: 'Navigace online', en: 'Navigation online' }
    l1_to_l6_compass_nodes: { cs: 'Body kompasu L1 až L6', en: 'L1 to L6 Compass Nodes' }
    selected_direction: { cs: 'Zvolený směr', en: 'Selected Direction' }
    technical_point: { cs: 'Technický bod', en: 'Technical Point' }
    phase_checklist: { cs: 'Checklist fáze', en: 'Phase Checklist' }
    click_a_compass_direction_to_open_detail: { cs: 'Klikni na směr v kompasu a otevři detail.', en: 'Click a compass direction to open detail.' }
    dharmachakra: { cs: 'Dharmachakra', en: 'Dharmachakra' }
    the_noble_eightfold_path: { cs: 'Ušlechtilá osmidílná stezka', en: 'The Noble Eightfold Path' }
    dharmachakra_with_eight_spokes: { cs: 'Dharmachakra s osmi paprsky', en: 'Dharmachakra with eight spokes' }
    dharma: { cs: 'Dharma', en: 'Dharma' }
    active_spoke: { cs: 'Aktivní paprsek', en: 'Active spoke' }
    zion_map: { cs: 'ZION mapa', en: 'ZION map' }
    fourth_book_of_zion: { cs: 'Čtvrtá kniha ZION', en: 'Fourth Book of ZION' }
    compositional_map: { cs: 'Kompoziční mapa', en: 'Compositional Map' }
    contents: { cs: 'Obsah', en: 'Contents' }
    reading_mode: { cs: 'Čtecí režim', en: 'Reading Mode' }
    current_chapter: { cs: 'Aktivní kapitola', en: 'Current Chapter' }
    left_right_arrows_next_chapters: { cs: 'Sipky vlevo/vpravo: další kapitoly', en: 'Left/right arrows: next chapters' }
    esc_close_contents: { cs: 'Esc: zavřít obsah', en: 'Esc: close contents' }
    documentation: { cs: 'Dokumentace', en: 'Documentation' }
    terra_nova_overlay: { cs: 'Terra Nova overlay', en: 'Terra Nova Overlay' }
    genesis_premine_16_280_000_000_zion: { cs: 'Genesis premine · 16 280 000 000 ZION', en: 'Genesis Premine · 16,280,000,000 ZION' }
    dao_treasury: { cs: 'DAO Pokladna', en: 'DAO Treasury' }
    infrastructure_dev: { cs: 'Infrastruktura + Vývoj', en: 'Infrastructure + Dev' }
    genesis_creator_rent: { cs: 'Genesis Creator (nájem)', en: 'Genesis Creator (rent)' }
    humanitarian_dao: { cs: 'Humanitární DAO', en: 'Humanitarian DAO' }
    total_genesis: { cs: 'Celkem genesis', en: 'Total genesis' }
    block_split_89_miner_5_humanitarian_5_issobella_1_: { cs: 'Split bloků: 89% miner · 5% humanitární · 5% Issobella · 1% pool', en: 'Block split: 89% miner · 5% humanitarian · 5% Issobella · 1% pool' }
    why_it_lives_here: { cs: 'Proč je to tady', en: 'Why It Lives Here' }
    open_full_genesis_page: { cs: 'Přejít na plnou Genesis stránku', en: 'Open Full Genesis Page' }
    manual_commands: { cs: 'Ruční příkazy', en: 'Manual Commands' }
    genesis_premine_16_28b_zion: { cs: 'Genesis Premine · 16.28B ZION', en: 'Genesis Premine · 16.28B ZION' }
    oasis_golden_egg_5: { cs: 'OASIS Golden Egg ×5', en: 'OASIS Golden Egg ×5' }
    dao_treasury_3: { cs: 'DAO Pokladna ×3', en: 'DAO Treasury ×3' }
    infrastructure_dev_2: { cs: 'Infrastruktura + Vývoj ×2', en: 'Infrastructure + Dev ×2' }
    total: { cs: 'Celkem', en: 'Total' }
    per_block_split_89_miner_5_humanitarian_5_issobell: { cs: 'split/blok: 89% miner · 5% humanitární · 5% issobella · 1% pool', en: 'per-block split: 89% miner · 5% humanitarian · 5% issobella · 1% pool' }
    open_terra_nova_contents: { cs: 'Přejít do obsahu Terra Novy', en: 'Open Terra Nova Contents' }
    real_zion_cli_docs: { cs: 'Real ZION CLI dokumentace', en: 'Real ZION CLI Docs' }
    top: { cs: 'Nahoru', en: 'Top' }
  }},
  APP_WEB_website_v2_9_src_app_terranova_c: {
    cultural_inserts_by_geography: { cs: 'Kulturní vložky podle geografie', en: 'Cultural inserts by geography' }
  }},
  APP_WEB_website_v2_9_src_app_terranova_c: {
    ecosystem_layers: { cs: 'Ekosystémové vrstvy', en: 'Ecosystem Layers' }
  }},
  APP_WEB_website_v2_9_src_app_terranova_c: {
    l5_pioneer_projects: { cs: 'Pioneer Projekty L5', en: 'L5 Pioneer Projects' }
    live_terra_nova_nodes_around_the_world: { cs: 'Živé uzly Terra Nova po celém světě', en: 'Live Terra Nova nodes around the world' }
    open_project_detail: { cs: 'Otevřít detail projektu', en: 'Open project detail' }
  }},
  APP_WEB_website_v2_9_src_app_terranova_g: {
    back_to_terra_nova: { cs: 'Zpět na Terra Nova', en: 'Back to Terra Nova' }
    cultural_inserts: { cs: 'Kulturní vložky', en: 'Cultural inserts' }
    available_inserts: { cs: 'Dostupné vložky', en: 'Available inserts' }
    regional_collection: { cs: 'Regionální sbírka', en: 'Regional collection' }
  }},
  APP_WEB_website_v2_9_src_app_warp_page: {
    corridors_planned: { cs: 'Plánované koridory', en: 'Corridors Planned' }
    live_corridors: { cs: 'Živé koridory', en: 'Live Corridors' }
    ethereum_lock_mint_base_mainnet: { cs: 'Ethereum Lock/Mint — Base Mainnet', en: 'Ethereum Lock/Mint — Base Mainnet' }
    guardian_runtime: { cs: 'Guardian runtime', en: 'Guardian Runtime' }
    zion2_public_host_internal_validator_lanes: { cs: 'Veřejný host Zion2 · interní validator linky', en: 'Zion2 public host · internal validator lanes' }
    development_phase: { cs: 'Fáze vývoje', en: 'Development Phase' }
    phase_2: { cs: 'Fáze 2', en: 'Phase 2' }
    eth_live_btc_sol_in_design: { cs: 'ETH live · BTC + SOL v návrhu', en: 'ETH live · BTC + SOL in design' }
    ethereum_lock_mint: { cs: 'Ethereum Lock/Mint', en: 'Ethereum Lock/Mint' }
    validators: { cs: 'Validátoři', en: 'Validators' }
    relay_daemon_multi_sig_quorum_deployment_audited: { cs: 'Relay daemon + multi-sig quorum · deployment auditován', en: 'Relay daemon + multi-sig quorum · deployment audited' }
    status: { cs: 'Stav', en: 'Status' }
    live_on_base_mainnet_chain_8453_wzion_weth_uniswap: { cs: 'Živě na Base Mainnet (chain 8453) · wZION/WETH Uniswap V3 pool aktivní', en: 'Live on Base Mainnet (chain 8453) · wZION/WETH Uniswap V3 pool active' }
    integration: { cs: 'Integrace', en: 'Integration' }
    evm_wallets_defi_swap_dao_treasury_lp_stakes: { cs: 'EVM peněženky, DeFi swap, DAO treasury, LP stakes', en: 'EVM wallets, DeFi swap, DAO treasury, LP stakes' }
    bitcoin_htlc_bridge: { cs: 'Bitcoin HTLC most', en: 'Bitcoin HTLC Bridge' }
    security_model: { cs: 'Bezpečnostní model', en: 'Security Model' }
    architecture_design_gated_corridor_not_a_live_laun: { cs: 'Návrh architektury — gated corridor, ne live launch slib', en: 'Architecture design — gated corridor, not a live launch promise' }
    use_cases: { cs: 'Use case', en: 'Use cases' }
    trustless_swaps_lightning_exits_otc_bridging: { cs: 'Trustless swapy, Lightning exity, OTC bridging', en: 'Trustless swaps, Lightning exits, OTC bridging' }
    solana_spl_program: { cs: 'Solana SPL program', en: 'Solana SPL Program' }
    finality: { cs: 'Finalita', en: 'Finality' }
    tower_bft_integration_planned: { cs: 'Plánovaná integrace Tower BFT', en: 'Tower BFT integration planned' }
    research_phase_after_btc_bridge: { cs: 'Výzkumná fáze — po BTC mostu', en: 'Research phase — after BTC bridge' }
    utility: { cs: 'Využití', en: 'Utility' }
    game_assets_liquidity_routing_warp_swaps: { cs: 'Game assety, routing likvidity, warp swapy', en: 'Game assets, liquidity routing, warp swaps' }
    1_provision_access: { cs: '1 · Zřízení přístupu', en: '1 · Provision access' }
    whitelist_validators_or_fetch_public_endpoints: { cs: 'Whitelist validátorů nebo převzetí veřejných endpointů', en: 'Whitelist validators or fetch public endpoints' }
    generate_api_tokens_read_transfer_scopes: { cs: 'Vygenerujte API tokeny (read/transfer scopes)', en: 'Generate API tokens (read/transfer scopes)' }
    download_sdk_from_official_github: { cs: 'Stáhněte SDK z oficiálního GitHubu', en: 'Download SDK from official GitHub' }
    2_wire_liquidity: { cs: '2 · Zapojení likvidity', en: '2 · Wire liquidity' }
    lock_assets_into_chosen_corridor_pool: { cs: 'Uzamkněte aktiva do vybraného corridor poolu', en: 'Lock assets into chosen corridor pool' }
    set_validator_quorum_alert_webhooks: { cs: 'Nastavte validator quorum + alert webhooky', en: 'Set validator quorum + alert webhooks' }
    run_smoke_test_using_sandbox_chain_pairs: { cs: 'Spusťte smoke test na sandbox chain páru', en: 'Run smoke test using sandbox chain pairs' }
    3_monitor_optimize: { cs: '3 · Monitorovat + optimalizovat', en: '3 · Monitor + optimize' }
    subscribe_to_validator_dashboard_streams: { cs: 'Odebírat streamy validator dashboardu', en: 'Subscribe to validator dashboard streams' }
    enable_compact_block_relay_metrics: { cs: 'Zapnout compact block relay metriky', en: 'Enable compact block relay metrics' }
    schedule_weekly_failover_incident_drills: { cs: 'Naplánovat týdenní failover + incident drills', en: 'Schedule weekly failover + incident drills' }
    cross_chain_flight_deck: { cs: 'Cross-chain řídicí panel', en: 'Cross-chain flight deck' }
    liquidity_without_borders: { cs: 'Likvidita bez hranic', en: 'Liquidity without borders' }
    open_defi_hub: { cs: 'Otevřít DeFi Hub', en: 'Open DeFi Hub' }
    bridge_operations: { cs: 'Bridge operace', en: 'Bridge operations' }
    corridor_grid: { cs: 'Síť koridorů', en: 'Corridor grid' }
    validator_backed_bridges: { cs: 'Mosty kryté validátory', en: 'Validator-backed bridges' }
    live: { cs: 'Živě', en: 'Live' }
    in_development: { cs: 'Ve vývoji', en: 'In development' }
    operations_runbook: { cs: 'Operační runbook', en: 'Operations runbook' }
    bring_a_new_corridor_online: { cs: 'Připojit nový koridór online', en: 'Bring a new corridor online' }
    stage: { cs: 'Fáze', en: 'Stage' }
    need_custom_routing_or_institutional_onboarding: { cs: 'Potřebujete vlastní routing nebo institucionální onboarding?', en: 'Need custom routing or institutional onboarding?' }
    open_github_discussions: { cs: 'Otevřít GitHub diskuse', en: 'Open GitHub discussions' }
    review_integration_docs: { cs: 'Projít integrační docs', en: 'Review integration docs' }
  }},
  APP_WEB_website_v2_9_src_components_Benc: {
    results_sorted_by_performance: { cs: 'Výsledky — seřazeno dle výkonu', en: 'Results — sorted by performance' }
    architecture: { cs: 'Architektura', en: 'Architecture' }
    opt_tpb: { cs: 'Opt. TPB', en: 'Opt TPB' }
    opt_wc: { cs: 'Opt. wc', en: 'Opt wc' }
    key_findings: { cs: 'Klíčové závěry', en: 'Key Findings' }
    recommended_tuning_defaults: { cs: 'Doporučené nastavení', en: 'Recommended Tuning Defaults' }
    gpu_class: { cs: 'Třída GPU', en: 'GPU Class' }
    notes: { cs: 'Poznámka', en: 'Notes' }
    bandwidth_efficiency: { cs: 'Efektivita šířky pásma', en: 'Bandwidth Efficiency' }
    mining_guide: { cs: 'Průvodce těžbou', en: 'Mining Guide' }
  }},
  APP_WEB_website_v2_9_src_components_Dash: {
    pool_health: { cs: 'Zdravi poolu', en: 'Pool Health' }
    version: { cs: 'Verze', en: 'Version' }
    launch_gate: { cs: 'Launch gate', en: 'Launch Gate' }
    public_launch_decision_only_after_closure_evidence: { cs: 'Rozhodnuti o verejnem launchi az po closure evidence', en: 'Public launch decision only after closure evidence' }
    q1_q2_2026_hardening: { cs: 'Q1-Q2 2026 · Zpevneni', en: 'Q1-Q2 2026 · Hardening' }
    launch_window_end_2026_gated: { cs: 'Launch window · konec 2026 (gated)', en: 'Launch window · end 2026 (gated)' }
    dao_tree_of_life: { cs: 'DAO Strom zivota', en: 'DAO Tree of Life' }
    tree_of_life_ledger_for_dao_guardians_governance_c: { cs: 'Ledger stromu zivota pro DAO guardiany, governance kruhy a dohled nad treasury', en: 'Tree-of-life ledger for DAO guardians, governance circles, and treasury oversight' }
    dao_prototype: { cs: 'DAO prototyp', en: 'DAO prototype' }
    pool_metrics_dashboard: { cs: 'Dashboard pool metrik', en: 'Pool Metrics Dashboard' }
    hashrate_workers_shares_block_discovery_rate: { cs: 'Hashrate · Workeri · Shares · Rychlost nalezu bloku', en: 'Hashrate · Workers · Shares · Block discovery rate' }
    auto_refresh_10s: { cs: 'Auto-refresh 10 s', en: 'Auto-refresh 10s' }
    full_system_dashboard: { cs: 'Plny systemovy dashboard', en: 'Full System Dashboard' }
    cpu_ram_rpc_latency_api_health_uptime: { cs: 'CPU/RAM · RPC latence · API zdravi · uptime', en: 'CPU/RAM · RPC latency · API health · uptime' }
    stack_wide_telemetry: { cs: 'Telemetrie celeho stacku', en: 'Stack-wide telemetry' }
    advanced_pool_dashboard_prometheus: { cs: 'Pokrocily pool dashboard (Prometheus)', en: 'Advanced Pool Dashboard (Prometheus)' }
    raw_promql_explorer_ad_hoc_queries_custom_alerts: { cs: 'Raw PromQL explorer, ad-hoc dotazy a vlastni alerty', en: 'Raw PromQL explorer, ad-hoc queries & custom alerts' }
    latest_block: { cs: 'Posledni blok', en: 'Latest block' }
    height: { cs: 'Vyska', en: 'Height' }
    timestamp: { cs: 'Cas', en: 'Timestamp' }
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    awaiting_blockchain_metrics: { cs: 'Cekam na blockchain metriky…', en: 'Awaiting blockchain metrics…' }
    pool_stats: { cs: 'Statistiky poolu', en: 'Pool Stats' }
    active_miners: { cs: 'Aktivni mineri', en: 'Active miners' }
    pool_hashrate: { cs: 'Hashrate poolu', en: 'Pool hashrate' }
    blocks_found: { cs: 'Nalezene bloky', en: 'Blocks found' }
    total_paid: { cs: 'Celkove vyplaceno', en: 'Total paid' }
    pool_configuration: { cs: 'Konfigurace poolu', en: 'Pool configuration' }
    pool_fee: { cs: 'Poplatek poolu:', en: 'Pool fee:' }
    min_payout: { cs: 'Min vyplata:', en: 'Min payout:' }
    payout_interval: { cs: 'Interval vyplaty:', en: 'Payout interval:' }
    total_miners: { cs: 'Celkem mineru:', en: 'Total miners:' }
    network_stats: { cs: 'Sitove statistiky', en: 'Network stats' }
    network_hashrate: { cs: 'Sitovy hashrate:', en: 'Network hashrate:' }
    difficulty: { cs: 'Obtiznost:', en: 'Difficulty:' }
    pending_payouts: { cs: 'Cekajici vyplaty:', en: 'Pending payouts:' }
    last_block: { cs: 'Posledni blok:', en: 'Last block:' }
    pool_metrics_unavailable: { cs: 'Metriky poolu nejsou dostupne', en: 'Pool metrics unavailable' }
    live_grafana_metrics: { cs: 'Zive Grafana metriky', en: 'Live Grafana Metrics' }
    real_time_dashboards_embedded_directly_on_zion_mis: { cs: 'Dashboardy v realnem case vlozene primo do ZION Mission Control', en: 'Real-time dashboards embedded directly on ZION Mission Control' }
    open_grafana: { cs: 'Otevrit Grafanu', en: 'Open Grafana' }
    view_live_data: { cs: 'Zobrazit ziva data', en: 'View live data' }
    available_metrics: { cs: 'Dostupne metriky', en: 'Available Metrics' }
    pool_metrics: { cs: 'Pool metriky', en: 'Pool Metrics' }
    block_height: { cs: 'Vyska bloku', en: 'Block height' }
    transaction_rate: { cs: 'Rychlost transakci', en: 'Transaction rate' }
    connected_peers: { cs: 'Pripojeni peeri', en: 'Connected peers' }
    mempool_size: { cs: 'Velikost mempoolu', en: 'Mempool size' }
    api_performance: { cs: 'Vykon API', en: 'API Performance' }
    latency_p95_p99: { cs: 'Latence (p95/p99)', en: 'Latency (p95/p99)' }
    error_rate: { cs: 'Chybovost', en: 'Error rate' }
    active_connections: { cs: 'Aktivni spojeni', en: 'Active connections' }
    system_resources: { cs: 'Systemove zdroje', en: 'System Resources' }
    cpu_usage: { cs: 'Vytizeni CPU', en: 'CPU usage' }
    memory_usage: { cs: 'Vytizeni pameti', en: 'Memory usage' }
    disk_i_o: { cs: 'Diskove I/O', en: 'Disk I/O' }
    network_traffic: { cs: 'Sitovy provoz', en: 'Network traffic' }
    recent_blocks: { cs: 'Posledni bloky', en: 'Recent blocks' }
    txs: { cs: 'Tx', en: 'Txs' }
    no_block_feed_detected_from_api: { cs: 'Z API nebyl detekovan zadny block feed.', en: 'No block feed detected from API.' }
    what: { cs: 'Co dal', en: 'What\' }
    operational_roadmap: { cs: 'Operacni roadmapa', en: 'Operational roadmap' }
    pulled_from_the_current_public_launch_path_and_reh: { cs: 'Prevzato z aktualni verejne launch cesty a rehearsal readiness materialu.', en: 'Pulled from the current public launch path and rehearsal-readiness material.' }
    open_roadmap: { cs: 'Otevrit roadmapu', en: 'Open roadmap' }
  }},
  APP_WEB_website_v2_9_src_components_Defi: {
    portfolio: { cs: 'Portfolio', en: 'Portfolio' }
    current_wzion_price: { cs: 'Aktuální cena wZION', en: 'Current wZION price' }
    connect_wallet_to_view_balances: { cs: 'Připoj peněženku pro zobrazení zůstatků', en: 'Connect wallet to view balances' }
    connect_metamask: { cs: 'Připojit MetaMask', en: 'Connect MetaMask' }
  }},
  APP_WEB_website_v2_9_src_components_Home: {
    interactive_layer: { cs: 'Interaktivní vrstva', en: 'Interactive layer' }
    tree_of_life: { cs: 'Strom života', en: 'Tree of Life' }
    load_interactive_scene: { cs: 'Načíst interaktivní scénu', en: 'Load interactive scene' }
    performance_safe_preview: { cs: 'Rychlý náhled', en: 'Performance-safe preview' }
    mode: { cs: 'Režim', en: 'Mode' }
    on_demand: { cs: 'Na vyžádání', en: 'On demand' }
    goal: { cs: 'Cíl', en: 'Goal' }
    fast_first_paint: { cs: 'Rychlé první vykreslení', en: 'Fast first paint' }
    fallback: { cs: 'Fallback', en: 'Fallback' }
    classic_query_ready: { cs: 'Klasický dotaz připraven', en: 'Classic query ready' }
  }},
  APP_WEB_website_v2_9_src_components_Mine: {
    miner_not_found: { cs: 'Miner nebyl nalezen', en: 'Miner not found' }
    failed_to_fetch_miner_data: { cs: 'Nepodarilo se nacist data minera', en: 'Failed to fetch miner data' }
    loading_miner_data: { cs: 'Nacitam data minera...', en: 'Loading miner data...' }
    miner_not_found_1: { cs: 'Miner nebyl nalezen', en: 'Miner Not Found' }
    make_sure_the_address_is_correct_and_has_submitted: { cs: 'Zkontrolujte, ze je adresa spravna a ze odeslala shares do poolu.', en: 'Make sure the address is correct and has submitted shares to the pool.' }
    back_to_pool: { cs: 'Zpet do poolu', en: 'Back to Pool' }
    pool: { cs: 'Pool', en: 'Pool' }
    miner: { cs: 'Miner', en: 'Miner' }
    active: { cs: 'Aktivni', en: 'Active' }
    inactive: { cs: 'Neaktivni', en: 'Inactive' }
    last_share: { cs: 'posledni share', en: 'last share' }
    copy_address: { cs: 'Kopirovat adresu', en: 'Copy address' }
    blocks: { cs: 'Bloky', en: 'Blocks' }
    telemetry: { cs: 'Telemetrie', en: 'Telemetry' }
    miner_statistics: { cs: 'Statistiky minera', en: 'Miner Statistics' }
    real_time_metrics_for_this_miner_across_all_pool_s: { cs: 'Metriky tohoto minera v realnem case napric vsemi pool servery.', en: 'Real-time metrics for this miner across all pool servers.' }
    hashrate_1h: { cs: 'Hashrate 1h', en: 'Hashrate 1h' }
    hashrate_24h: { cs: 'Hashrate 24h', en: 'Hashrate 24h' }
    valid_shares: { cs: 'Validni shares', en: 'Valid Shares' }
    invalid_shares: { cs: 'Neplatne shares', en: 'Invalid Shares' }
    efficiency: { cs: 'Efektivita', en: 'Efficiency' }
    blocks_found: { cs: 'Nalezene bloky', en: 'Blocks Found' }
    pending: { cs: 'Ceka na payout', en: 'Pending' }
    total_paid: { cs: 'Celkem vyplaceno', en: 'Total Paid' }
    total_shares: { cs: 'Shares celkem', en: 'Total Shares' }
    last_share_1: { cs: 'Posledni share', en: 'Last Share' }
    servers: { cs: 'Servery', en: 'Servers' }
    algorithm: { cs: 'Algoritmus', en: 'Algorithm' }
    performance: { cs: 'Vykon', en: 'Performance' }
    hashrate_timeline: { cs: 'Vyvoj hashratu', en: 'Hashrate Timeline' }
    live_hashrate_samples_collected_every_15_seconds: { cs: 'Zive vzorky hashratu sbirane kazdych 15 sekund.', en: 'Live hashrate samples collected every 15 seconds.' }
    current: { cs: 'Aktualne:', en: 'Current:' }
    24h_avg: { cs: '24h prumer:', en: '24h avg:' }
    not_enough_data_for_chart: { cs: 'Pro graf zatim neni dost dat', en: 'Not enough data for chart' }
    mining: { cs: 'Tezba', en: 'Mining' }
    blocks_found_by_this_miner_on_the_pool: { cs: 'Bloky nalezene timto minerem v poolu.', en: 'Blocks found by this miner on the pool.' }
    height: { cs: 'Vyska', en: 'Height' }
    reward: { cs: 'Odmena', en: 'Reward' }
    time: { cs: 'Cas', en: 'Time' }
    server: { cs: 'Server', en: 'Server' }
    earnings: { cs: 'Vydelky', en: 'Earnings' }
    payouts: { cs: 'Payouty', en: 'Payouts' }
    history_of_pool_payouts_to_this_miner: { cs: 'Historie pool payoutu tomuto minerovi.', en: 'History of pool payouts to this miner.' }
    no_payouts_yet_minimum_payout_0_1_zion: { cs: 'Zatim zadne payouty. Minimalni payout: 0.1 ZION', en: 'No payouts yet. Minimum payout: 0.1 ZION' }
    pending_balance: { cs: 'Cekajici zustatek', en: 'Pending balance' }
    amount: { cs: 'Castka', en: 'Amount' }
    status: { cs: 'Stav', en: 'Status' }
    confirmed: { cs: 'potvrzeno', en: 'confirmed' }
    pending_1: { cs: 'ceka', en: 'pending' }
    advanced: { cs: 'Rozsirene', en: 'Advanced' }
    advanced_metrics: { cs: 'Rozsirene metriky', en: 'Advanced Metrics' }
    best_available_miner_telemetry_from_pool_accountin: { cs: 'Nejlepsi dostupna telemetrie minera z pool accounting a zivych runtime dat.', en: 'Best available miner telemetry from pool accounting and live runtime data.' }
    loading_advanced_miner_metrics: { cs: 'Nacitam rozsirene metriky minera...', en: 'Loading advanced miner metrics...' }
    current_hashrate_gauge: { cs: 'Aktualni hashrate (Gauge)', en: 'Current hashrate (Gauge)' }
    valid_invalid_shares_counter: { cs: 'Validni / neplatne shares (Counter)', en: 'Valid / invalid shares (Counter)' }
    blocks_found_counter: { cs: 'Nalezene bloky (Counter)', en: 'Blocks found (Counter)' }
    pending_balance_gauge: { cs: 'Cekajici zustatek (Gauge)', en: 'Pending balance (Gauge)' }
    total_paid_gauge: { cs: 'Celkem vyplaceno (Gauge)', en: 'Total paid (Gauge)' }
    active_connections_gauge: { cs: 'Aktivni spojeni (Gauge)', en: 'Active connections (Gauge)' }
    last_scrape: { cs: 'Posledni scrape', en: 'Last scrape' }
    updated_every_15s: { cs: 'aktualizace kazdych 15 s', en: 'Updated every 15s' }
    source: { cs: 'Zdroj', en: 'Source' }
    runtime_fallback: { cs: 'runtime fallback', en: 'runtime fallback' }
    endpoints: { cs: 'Endpointy', en: 'Endpoints' }
    ok: { cs: 'ok', en: 'ok' }
    down: { cs: 'down', en: 'down' }
    back_to_pool_overview: { cs: 'Zpet na prehled poolu', en: 'Back to Pool Overview' }
    view_all_pool_statistics_server_status_and_join_th: { cs: 'Zobrazte vsechny statistiky poolu, stav serveru a pripojte se k tezebni komunite.', en: 'View all pool statistics, server status, and join the mining community.' }
    pool_dashboard: { cs: 'Prehled poolu', en: 'Pool Dashboard' }
    explorer: { cs: 'Explorer', en: 'Explorer' }
  }},
  APP_WEB_website_v2_9_src_components_Mini: {
    cpu_mining: { cs: 'CPU tezba', en: 'CPU Mining' }
    gpu_mining: { cs: 'GPU tezba', en: 'GPU Mining' }
    pool_mining: { cs: 'Pool tezba', en: 'Pool Mining' }
    solo_mining: { cs: 'Solo tezba', en: 'Solo Mining' }
    quick_start: { cs: 'Rychly start', en: 'Quick Start' }
    algorithms: { cs: 'Algoritmy', en: 'Algorithms' }
    mining_guides: { cs: 'Tezebni navody', en: 'Mining Guides' }
    hardware: { cs: 'Hardware', en: 'Hardware' }
    node_setup: { cs: 'Nastaveni nodu', en: 'Node Setup' }
    create_wallet: { cs: 'Vytvorte penezenku', en: 'Create Wallet' }
    start_mining: { cs: 'Spustte tezbu', en: 'Start Mining' }
    check_balance: { cs: 'Zkontrolujte zustatek', en: 'Check Balance' }
    disk: { cs: 'Disk', en: 'Disk' }
    network: { cs: 'Sit', en: 'Network' }
    mining_node_guide: { cs: 'Pruvodce tezbou a nodem', en: 'Mining & Node Guide' }
    cpu_gpu_pool_solo: { cs: 'CPU / GPU / Pool / Solo tezba', en: 'CPU / GPU / Pool / Solo' }
    download_binaries: { cs: 'Stahnout binarky', en: 'Download Binaries' }
    full_guide_on_github: { cs: 'Plny navod na GitHubu', en: 'Full Guide on GitHub' }
    pool_dashboard: { cs: 'Pool dashboard', en: 'Pool Dashboard' }
    quick_start_3_steps: { cs: 'Rychly start - 3 kroky', en: 'Quick Start — 3 Steps' }
    from_zero_to_mining_in_under_5_minutes: { cs: 'Od nuly ke spustene tezbe za mene nez 5 minut.', en: 'From zero to mining in under 5 minutes.' }
    one_line_install_linux_macos: { cs: 'Jednoradkova instalace (Linux / macOS)', en: 'One-line install (Linux / macOS)' }
    note_zion_cli_is_a_unified_binary_miner_node_walle: { cs: 'Poznámka: ZION CLI je unifikovaná binárka — miner, node, wallet i pool jsou subpříkazy.', en: 'Note: ZION CLI is a unified binary — miner, node, wallet and pool are subcommands.' }
    supported_algorithms: { cs: 'Podporovane algoritmy', en: 'Supported Algorithms' }
    algorithm: { cs: 'Algoritmus', en: 'Algorithm' }
    type: { cs: 'Typ', en: 'Type' }
    memory: { cs: 'Pamet', en: 'Memory' }
    best_for: { cs: 'Vhodne pro', en: 'Best For' }
    step_by_step_for_any_hardware_from_raspberry_pi_to: { cs: 'Krok za krokem pro jakykoli hardware - od Raspberry Pi po GPU rig.', en: 'Step-by-step for any hardware — from Raspberry Pi to a GPU rig.' }
    cpu_mining_with_zion_native_miner: { cs: 'CPU tezba se ZION Native Minerem', en: 'CPU Mining with ZION Native Miner' }
    works_on_any_x86_64_or_arm64_cpu_best_algos: { cs: 'Funguje na libovolnem x86_64 nebo ARM64 CPU. Nejvhodnejsi algoritmy:', en: 'Works on any x86_64 or ARM64 CPU. Best algos:' }
    low_memory: { cs: '(nizka pamet).', en: '(low-memory).' }
    option_a_pre_compiled_binary_recommended: { cs: 'Moznost A - predkompilovana binarka (doporuceno)', en: 'Option A — Pre-compiled binary (recommended)' }
    option_b_build_from_source: { cs: 'Moznost B - build ze zdroje', en: 'Option B — Build from source' }
    start_mining_pool: { cs: 'Spusteni tezby (pool)', en: 'Start mining (pool)' }
    alternative_xmrig_for_randomx: { cs: 'Alternativa: XMRig pro RandomX', en: 'Alternative: XMRig for RandomX' }
    enable_huge_pages_for_randomx: { cs: 'Zapnete huge pages pro RandomX:', en: 'Enable huge pages for RandomX:' }
    leave_1_2_cores_free_for_system_if_mining_24_7: { cs: 'Nechte 1-2 jadra volna pro system pri tezbe 24/7', en: 'Leave 1–2 cores free for system if mining 24/7' }
    monitor_temperature_keep_below_85_c: { cs: 'Sledujte teplotu: drzte pod 85°C', en: 'Monitor temperature: keep below 85°C' }
    arm64_raspberry_pi_4_5_use_yescrypt_for_best_perf_: { cs: 'ARM64 (Raspberry Pi 4/5): pro nejlepsi vykon/watt pouzijte Yescrypt', en: 'ARM64 (Raspberry Pi 4/5): use Yescrypt for best perf/watt' }
    gpu_mining_metal_cuda_opencl: { cs: 'GPU tezba - Metal, CUDA a OpenCL', en: 'GPU Mining — Metal, CUDA & OpenCL' }
    apple_metal_m1_m4_nvidia_cuda_gtx_rtx_amd_opencl_r: { cs: 'Apple Metal (M1-M4), NVIDIA CUDA (GTX/RTX), AMD OpenCL (RX/Vega).', en: 'Apple Metal (M1–M4), NVIDIA CUDA (GTX/RTX), AMD OpenCL (RX/Vega).' }
    autolykos_v2_is_best_for_gpu_memory_hard_asic_resi: { cs: 'Autolykos v2 je pro GPU nejvhodnejsi - memory-hard a ASIC resistant', en: 'Autolykos v2 is best for GPU — memory-hard, ASIC-resistant' }
    cosmic_harmony_v3_works_on_cpu_gpu_simultaneously: { cs: 'Cosmic Harmony v3 umi zaroven CPU i GPU tezbu', en: 'Cosmic Harmony v3 works on CPU + GPU simultaneously' }
    undervolt_for_20_30_power_saving: { cs: 'Undervolt pro 20-30 % uspory energie', en: 'Undervolt for 20–30% power saving' }
    keep_gpu_80_c_vram_95_c: { cs: 'Drzte GPU pod 80°C a VRAM pod 95°C', en: 'Keep GPU < 80°C, VRAM < 95°C' }
    for_desktop_use_while_mining: { cs: 'pro soubezne pouziti desktopu pri tezbe', en: 'for desktop use while mining' }
    pool_mining_steady_rewards: { cs: 'Pool tezba - stabilni odmeny', en: 'Pool Mining — Steady Rewards' }
    combines_hashrate_from_many_miners_for_frequent_pr: { cs: 'Spojuje hashrate vice mineru pro caste a predvidatelne payouty. Nejlepsi volba pro vetsinu mineru.', en: 'Combines hashrate from many miners for frequent, predictable payouts. Best for most miners.' }
    zion_official_pool_endpoints: { cs: 'Oficialni ZION pool endpointy', en: 'ZION Official Pool Endpoints' }
    quick_start_pool_mining: { cs: 'Rychly start - pool tezba', en: 'Quick start — Pool mining' }
    fee: { cs: 'Fee', en: 'Fee' }
    lowest_in_class: { cs: 'Jedna z nejnižších v třídě', en: 'Lowest in class' }
    payout: { cs: 'Payout', en: 'Payout' }
    pay_per_last_n_shares: { cs: 'Pay-per-last-N-shares', en: 'Pay-per-last-N-shares' }
    min_payout: { cs: 'Min. payout', en: 'Min Payout' }
    automatic_transfer: { cs: 'Automaticky', en: 'Automatic transfer' }
    interval: { cs: 'Interval', en: 'Interval' }
    every_2h: { cs: 'Kazde 2 h', en: 'Every 2h' }
    when_threshold_met: { cs: 'Po dosazeni prahu', en: 'When threshold met' }
    monitor_your_miner: { cs: 'Sledujte sveho minera', en: 'Monitor Your Miner' }
    track_hashrate_shares_and_payouts_on_the: { cs: 'Sledujte hashrate, shares a payouty v ', en: 'Track hashrate, shares, and payouts on the ' }
    pool_dashboard_1: { cs: 'pool dashboardu', en: 'Pool Dashboard' }
    solo_mining_full_block_rewards: { cs: 'Solo tezba - plne blokove odmeny', en: 'Solo Mining — Full Block Rewards' }
    mine_directly_against_the_blockchain_you_get_the_f: { cs: 'Tezte primo proti blockchainu. Ziskavate celou aktualni blokovou odmenu a fees za nalezeny blok, ale payouty jsou mene pravidelne nez u poolu.', en: 'Mine directly against the blockchain. You get the full current block reward and fees when you find a block, but payouts are less frequent than with pool mining.' }
    who_should_solo_mine: { cs: 'Kdo by mel tezit solo?', en: 'Who should solo mine?' }
    recommended_if_you_have_significant_hashrate_10_of: { cs: 'Doporuceno, pokud mate vyznamny hashrate (>10 % site). Jinak dava pool tezba stabilnejsi payouty.', en: 'Recommended if you have significant hashrate (>10% of network). Otherwise, pool mining gives more consistent payouts.' }
    step_2_mine_against_your_node: { cs: 'Krok 2 - tezba proti vlastnimu nodu', en: 'Step 2 — Mine against your node' }
    pros: { cs: 'Vyhody', en: 'Pros' }
    full_current_block_reward_fees: { cs: 'Plna aktualni blokova odmena + fees', en: 'Full current block reward + fees' }
    no_pool_fees: { cs: 'Bez pool fee', en: 'No pool fees' }
    maximum_decentralization: { cs: 'Maximalni decentralizace', en: 'Maximum decentralization' }
    privacy_no_pool_knows_your_address: { cs: 'Soukromi - zadny pool nezna vasu adresu', en: 'Privacy — no pool knows your address' }
    cons: { cs: 'Nevyhody', en: 'Cons' }
    irregular_payouts_luck_based: { cs: 'Nepravidelne payouty (zalozene na stesti)', en: 'Irregular payouts (luck-based)' }
    need_to_run_a_full_node: { cs: 'Nutnost provozovat full node', en: 'Need to run a full node' }
    high_variance_with_low_hashrate: { cs: 'Vysoka variance pri nizkem hashratu', en: 'High variance with low hashrate' }
    no_partial_share_rewards: { cs: 'Zadne dilci share odmeny', en: 'No partial share rewards' }
    hardware_comparison: { cs: 'Srovnani hardwaru', en: 'Hardware Comparison' }
    approximate_values_for_cosmic_harmony_v3_randomx_a: { cs: 'Priblizne hodnoty pro Cosmic Harmony v3 / RandomX / Autolykos v2.', en: 'Approximate values for Cosmic Harmony v3 / RandomX / Autolykos v2.' }
    power: { cs: 'Spotreba', en: 'Power' }
    efficiency: { cs: 'Efektivita', en: 'Efficiency' }
    run_a_full_node: { cs: 'Spustte full node', en: 'Run a Full Node' }
    strengthen_the_network_by_validating_transactions_: { cs: 'Posilte sit validaci transakci a relayem bloku. Z nuly do synchronizace asi za 10 minut - bez specialniho hardwaru.', en: 'Strengthen the network by validating transactions and relaying blocks. 10 minutes from zero to synced — no special hardware required.' }
    system_requirements: { cs: 'Systemove pozadavky', en: 'System Requirements' }
    installation: { cs: 'Instalace', en: 'Installation' }
    pre_compiled_binary_recommended: { cs: 'Predkompilovana binarka (doporuceno)', en: 'Pre-compiled Binary (recommended)' }
    build_from_source: { cs: 'Build ze zdrojoveho kodu', en: 'Build from Source' }
    network_configuration: { cs: 'Sitova konfigurace', en: 'Network Configuration' }
    config: { cs: 'config', en: 'config' }
    ports_firewall: { cs: 'Porty a firewall', en: 'Ports & Firewall' }
    protocol: { cs: 'Protokol', en: 'Protocol' }
    purpose: { cs: 'Ucel', en: 'Purpose' }
    required: { cs: 'Povinne', en: 'Required' }
    optional: { cs: 'Volitelne', en: 'Optional' }
    node_cli_reference: { cs: 'Reference pro Node CLI', en: 'Node CLI Reference' }
    verify_your_node: { cs: 'Overte svuj node', en: 'Verify Your Node' }
    success_criteria: { cs: 'Kriteria uspechu', en: 'Success criteria' }
    block_height_matches: { cs: 'Vyska bloku odpovida ', en: 'Block height matches ' }
    explorer: { cs: 'Exploreru', en: 'Explorer' }
    2_peers_connected: { cs: '2+ pripojene peery', en: '2+ peers connected' }
    new_blocks_every_60_seconds: { cs: 'Nove bloky kazdych asi 60 sekund', en: 'New blocks every ~60 seconds' }
    rpc_responds_to_queries: { cs: 'RPC odpovida na dotazy', en: 'RPC responds to queries' }
    faq_troubleshooting: { cs: 'FAQ a troubleshooting', en: 'FAQ & Troubleshooting' }
    ready_to_mine_zion: { cs: 'Pripraveni tezit ZION?', en: 'Ready to mine ZION?' }
    join_the_community_every_hash_strengthens_the_netw: { cs: 'Pripojte se ke komunite. Kazdy hash posiluje sit.', en: 'Join the community. Every hash strengthens the network.' }
    explorer_1: { cs: 'Explorer', en: 'Explorer' }
  }},
  APP_WEB_website_v2_9_src_components_Netw: {
    primary_host: { cs: 'Primarni host', en: 'Primary host' }
    internal_quorum: { cs: 'Interni quorum', en: 'Internal quorum' }
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    hosts_online: { cs: 'Hosty online', en: 'Hosts Online' }
    block_height: { cs: 'Vyska bloku', en: 'Block Height' }
    height_gap: { cs: 'Rozdil vysky', en: 'Height Gap' }
    in_sync: { cs: 'synchronizovano', en: 'in sync' }
    syncing: { cs: 'synchronizuji', en: 'syncing' }
    active_miners: { cs: 'Aktivni mineri', en: 'Active Miners' }
    network_synchronized: { cs: 'Sit je synchronizovana', en: 'Network Synchronized' }
    synchronizing: { cs: 'Synchronizuji...', en: 'Synchronizing...' }
    network_hosts: { cs: 'Sitove hosty', en: 'Network Hosts' }
    updated: { cs: 'Aktualizovano', en: 'Updated' }
    height: { cs: 'Vyska', en: 'Height' }
    lag: { cs: 'Zpozdeni', en: 'Lag' }
    error: { cs: 'Chyba', en: 'Error' }
  }},
  APP_WEB_website_v2_9_src_components_News: {
    back_to_homepage: { cs: 'Zpět na hlavní stránku', en: 'Back to homepage' }
    news_archive: { cs: 'Archív novinek', en: 'News Archive' }
    news: { cs: 'Novinky', en: 'News' }
    read_more: { cs: 'Číst více', en: 'Read more' }
  }},
  APP_WEB_website_v2_9_src_components_Pool: {
    find_best_mining_pool: { cs: 'Najít nejlepší těžební pool', en: 'Find Best Mining Pool' }
    get_the_optimal_mining_pool_based_on_your_location: { cs: 'Získejte optimální těžební pool podle své polohy pro co nejnižší latenci.', en: 'Get the optimal mining pool based on your location for lowest latency.' }
    detecting: { cs: 'Zjišťuji polohu...', en: 'Detecting...' }
    use_my_location: { cs: 'Použít moji polohu', en: 'Use My Location' }
    enter_manually: { cs: 'Zadat ručně', en: 'Enter Manually' }
    latitude_e_g_50_08: { cs: 'Zeměpisná šířka (např. 50.08)', en: 'Latitude (e.g. 50.08)' }
    longitude_e_g_14_42: { cs: 'Zeměpisná délka (např. 14.42)', en: 'Longitude (e.g. 14.42)' }
    search: { cs: 'Hledat', en: 'Search' }
    recommended: { cs: 'Doporučeno', en: 'Recommended' }
    distance: { cs: 'Vzdálenost', en: 'Distance' }
    no_recommended_pool_available_try_detecting_your_l: { cs: 'Není k dispozici žádný doporučený pool. Zkuste zjistit svoji polohu.', en: 'No recommended pool available. Try detecting your location.' }
    all_pools: { cs: 'Všechny pooly', en: 'All Pools' }
  }},
  APP_WEB_website_v2_9_src_components_Rece: {
    just_now: { cs: 'právě teď', en: 'just now' }
    en_us: { cs: 'cs-CZ', en: 'en-US' }
    loading_recent_blocks: { cs: 'Načítám poslední bloky...', en: 'Loading recent blocks...' }
    recent_blocks: { cs: 'Poslední bloky', en: 'Recent Blocks' }
    view_all: { cs: 'Zobrazit vše →', en: 'View all →' }
    height: { cs: 'Výška', en: 'Height' }
    time: { cs: 'Čas', en: 'Time' }
    transactions: { cs: 'Transakce', en: 'Transactions' }
    consciousness: { cs: 'Vědomí: ', en: 'Consciousness: ' }
  }},
  APP_WEB_website_v2_9_src_components_Road: {
    mainnet_genesis_cosmic_harmony_v3_v4_utxo_144b_zio: { cs: 'Mainnet genesis, Cosmic Harmony v3/v4, UTXO, zasoba 144B ZION', en: 'MainNet Genesis, Cosmic Harmony v3/v4, UTXO, 144B ZION supply' }
    wzion_dex_on_base_mainnet_bridge_relay_treasury_ra: { cs: 'wZION DEX na Base Mainnet, bridge relay, treasury rails a DAO governance vrstva', en: 'wZION DEX on Base Mainnet, bridge relay, treasury rails, and the DAO governance layer' }
    hiranyagarbha_runtime_the_ncl_compute_lane_warp_re: { cs: 'Hiranyagarbha runtime, NCL compute lane, WARP relaye a agenticka orchestrace nad L1/L2', en: 'Hiranyagarbha runtime, the NCL compute lane, WARP relays, and agentic orchestration above L1/L2' }
    golden_egg_xp_economy_winners_program_game_layer: { cs: 'Golden Egg, XP ekonomika, Winners program, herni vrstva', en: 'Golden Egg, XP economy, Winners program, game layer' }
    humanitarian_missions_free_energy_r_d_off_grid_com: { cs: 'Humanitarni mise, free-energy R&D, off-grid komunity', en: 'Humanitarian missions, free energy R&D, off-grid communities' }
    orbital_observatory_leo_research_station_long_rang: { cs: 'Orbitalni observator, LEO vyzkumna stanice, dlouhy mission layer', en: 'Orbital observatory, LEO research station, long-range mission layer' }
    roadmap: { cs: 'Roadmapa', en: 'Roadmap' }
    full_roadmap: { cs: 'Cela roadmapa', en: 'Full Roadmap' }
    block_explorer: { cs: 'Pruzkumnik blockchainu', en: 'Block Explorer' }
    6_layer_vision: { cs: '6vrstva vize', en: '6-Layer Vision' }
    6_layer_vision_after_the_pure_code_baseline: { cs: '6vrstva vize po Pure Code baseline', en: '6-layer vision — after the Pure Code baseline' }
  }},
  APP_WEB_website_v2_9_src_components_Swap: {
    swap: { cs: 'Swap', en: 'Swap' }
    connect_metamask_to_swap: { cs: 'Připoj MetaMask pro swapování', en: 'Connect MetaMask to swap' }
    connect_wallet: { cs: 'Připojit peněženku', en: 'Connect Wallet' }
    switch_to_base_mainnet: { cs: 'Přepni na Base Mainnet', en: 'Switch to Base Mainnet' }
    switch_network: { cs: 'Přepnout síť', en: 'Switch Network' }
    you_sell: { cs: 'Prodáváš', en: 'You sell' }
    max: { cs: 'Max', en: 'Max' }
    you_get: { cs: 'Dostaneš', en: 'You get' }
    fee: { cs: 'poplatek', en: 'fee' }
    swap_successful: { cs: 'Swap úspěšný!', en: 'Swap successful!' }
    approving: { cs: 'Schvalování…', en: 'Approving…' }
    swapping: { cs: 'Swapuji…', en: 'Swapping…' }
  }},
  APP_WEB_website_v2_9_src_components_Syst: {
    healthy: { cs: 'zdravý', en: 'healthy' }
    degraded: { cs: 'omezený', en: 'degraded' }
    unknown: { cs: 'neznámý', en: 'unknown' }
    loading_system_health: { cs: 'Načítám stav systému...', en: 'Loading system health...' }
    system_health: { cs: 'Stav systému', en: 'System Health' }
    status: { cs: 'Stav', en: 'Status' }
    version: { cs: 'Verze', en: 'Version' }
    uptime: { cs: 'Doba běhu', en: 'Uptime' }
    dependencies: { cs: 'Závislosti', en: 'Dependencies' }
    rpc_node: { cs: 'RPC uzel', en: 'RPC Node' }
    mining_pool: { cs: 'Těžební pool', en: 'Mining Pool' }
  }},
  APP_WEB_website_v2_9_src_components_Terr: {
    terra_nova_golden_compass_of_the_new_earth: { cs: 'Terra Nova · Zlatý Kompas Nové Země', en: 'Terra Nova · Golden Compass of the New Earth' }
    zion_is_yours: { cs: 'ZION je váš.', en: 'ZION is yours.' }
    the_golden_age_begins: { cs: 'Zlatý věk začíná.', en: 'The Golden Age begins.' }
    download_zion_cli: { cs: 'Download ZION CLI', en: 'Download ZION CLI' }
    public_windows_linux_and_macos_binaries_are_live: { cs: 'Veřejné binárky pro Windows, Linux a macOS jsou živé.', en: 'Public Windows, Linux, and macOS binaries are live.' }
    open_the_terra_nova_section: { cs: 'Otevřít sekci Terra Nova', en: 'Open the Terra Nova section' }
    go_to_download: { cs: 'Přejít na Download', en: 'Go to Download' }
  }},
  APP_WEB_website_v2_9_src_components_Zlat: {
    golden_compass_seven_directions_of_terranova: { cs: 'Zlatý Kompas — sedm směrů TerraNova', en: 'Golden Compass — seven directions of TerraNova' }
  }},
  APP_WEB_website_v2_9_src_components_api_: {
    curl_quick_ping: { cs: 'cURL rychly ping', en: 'cURL quick ping' }
    1_authenticate: { cs: '1 · Autentizace', en: '1 · Authenticate' }
    get_routes_are_open_for_post_put_include_x_zion_ke: { cs: 'GET routy jsou otevrene. Pro POST/PUT pridejte do hlavicek x-zion-key; klice rotujte kazdych 30 dni.', en: 'GET routes are open. For POST/PUT include x-zion-key in headers; rotate keys every 30 days.' }
    2_choose_transport: { cs: '2 · Zvolte transport', en: '2 · Choose transport' }
    https_for_rpc_rest_websockets_for_stratum_metrics_: { cs: 'HTTPS pro RPC/REST, WebSockets pro stratum a metriky. Vsechny servery podporuji HTTP/2.', en: 'HTTPS for RPC/REST, WebSockets for stratum + metrics. All servers support HTTP/2.' }
    3_pin_environment: { cs: '3 · Pripnete prostredi', en: '3 · Pin environment' }
    sandbox_mirrors_production_at_https_api_sandbox_zi: { cs: 'Sandbox zrcadli produkci na https://api-sandbox.zionterranova.com s testnet daty.', en: 'Sandbox mirrors production at https://api-sandbox.zionterranova.com with testnet data.' }
    quickstart_snippets: { cs: 'Quickstart ukazky', en: 'Quickstart snippets' }
    copied: { cs: 'Zkopirovano', en: 'Copied' }
    copy: { cs: 'Kopirovat', en: 'Copy' }
    onboarding_checklist: { cs: 'Checklist nasazeni', en: 'Onboarding checklist' }
  }},
  APP_WEB_website_v2_9_src_components_down: {
    do_i_need_a_node_to_mine: { cs: 'Potrebuji pro tezbu Node?', en: 'Do I need a Node to mine?' }
    no_connect_to_the_public_pool_zionterranova_com_po: { cs: 'Ne. Pripojte se k verejnemu poolu (zionterranova.com/pool). Pool resi komunikaci s blockchainem. Node potrebujete jen pokud chcete sami overovat transakce nebo provozovat vlastni pool.', en: 'No. Connect to the public pool (zionterranova.com/pool). The pool handles blockchain communication. A node is only needed if you want to verify transactions yourself or run your own pool.' }
    how_do_i_create_a_wallet: { cs: 'Jak vytvorim penezenku?', en: 'How do I create a wallet?' }
    download_zion_cli_and_run_zion_wallet_new_mnemonic: { cs: 'Stahnete ZION CLI a spustte: zion wallet new --mnemonic --out my-wallet.json --print. Zapisete si 24 slov na papir — to je vase zaloha. Nikdy je nesdilejte online.', en: 'Download ZION CLI and run: zion wallet new --mnemonic --out my-wallet.json --print. Write down the 24 words on paper — they are your backup. Never share them online.' }
    windows_defender_blocks_the_binary: { cs: 'Windows Defender blokuje binarku?', en: 'Windows Defender blocks the binary?' }
    click_more_info_run_anyway_the_binaries_are_open_s: { cs: 'Kliknete na More info -> Run anyway. Binarky jsou open-source (MIT licence), ale nepodepsane. Muzete take pridat C:\\ZION\\ do vyjimek ve Windows Security.', en: 'Click More info -> Run anyway. The binaries are open-source (MIT license) but unsigned. You can also add C:\\ZION\\ to exclusions in Windows Security.' }
    macos_says_cannot_be_opened: { cs: 'macOS pise cannot be opened?', en: 'macOS says cannot be opened?' }
    run_xattr_d_com_apple_quarantine_zion_cli_macos_ar: { cs: 'Spustte: xattr -d com.apple.quarantine zion-cli-macos-arm64 nebo jdete do System Settings -> Privacy & Security -> Allow Anyway.', en: 'Run: xattr -d com.apple.quarantine zion-cli-macos-arm64 or go to System Settings -> Privacy & Security -> Allow Anyway.' }
    what_is_consciousness_mining: { cs: 'Co je Consciousness Mining?', en: 'What is Consciousness Mining?' }
    your_consciousness_level_physical_cosmic_multiplie: { cs: 'Vase uroven vedomi (PHYSICAL -> COSMIC) nasobi blokove odmeny az 15x. Levelujete konzistentni tezbou, nachazenim bloku a prispevkem ke zdravi site.', en: 'Your consciousness level (PHYSICAL -> COSMIC) multiplies block rewards up to 15x. Level up by consistent mining, discovering blocks, and contributing to network health.' }
    can_i_mine_on_raspberry_pi: { cs: 'Mohu tezit na Raspberry Pi?', en: 'Can I mine on Raspberry Pi?' }
    the_linux_arm64_build_is_in_progress_rpi_4_5_will_: { cs: 'Linux ARM64 build je ve vyvoji. RPi 4/5 bude podporovano — sledujte releases na zionterranova.com/download.', en: 'The Linux ARM64 build is in progress. RPi 4/5 will be supported — watch releases at zionterranova.com/download.' }
    support: { cs: 'Podpora', en: 'Support' }
  }},
  APP_WEB_website_v2_9_src_components_down: {
    node: { cs: 'Node', en: 'Node' }
    status_blocks_transactions_mempool_websocket: { cs: 'Status, bloky, transakce, mempool a WebSocket', en: 'Status, blocks, transactions, mempool & WebSocket' }
    miner: { cs: 'Miner', en: 'Miner' }
    cpu_gpu_mining_with_cosmic_harmony_v3: { cs: 'CPU/GPU tezba s Cosmic Harmony v3', en: 'CPU/GPU mining with Cosmic Harmony v3' }
    wallet: { cs: 'Wallet', en: 'Wallet' }
    ed25519_bip39_mnemonic_balance_send: { cs: 'Ed25519 + BIP39 mnemotechnika, zustatek, odesilani', en: 'Ed25519 + BIP39 mnemonic, balance, send' }
    pool: { cs: 'Pool', en: 'Pool' }
    stratum_pool_monitoring_stats: { cs: 'Stratum pool monitoring a statistiky', en: 'Stratum pool monitoring & stats' }
    native_rust_cli: { cs: 'Nativni Rust CLI', en: 'Native Rust CLI' }
    available: { cs: 'Dostupné', en: 'Available' }
    coming_soon: { cs: 'Brzy', en: 'Coming Soon' }
    download: { cs: 'Stáhnout', en: 'Download' }
    in_progress: { cs: 'Ve vývoji', en: 'In Progress' }
    verification: { cs: 'Verifikace:', en: 'Verification:' }
    windows_or: { cs: '(Windows) nebo ', en: '(Windows) or ' }
    linux_macos: { cs: '(Linux/macOS).', en: '(Linux/macOS).' }
  }},
  APP_WEB_website_v2_9_src_components_expl: {
    just_now: { cs: 'prave ted', en: 'just now' }
    full_block_archive: { cs: 'Kompletni archiv bloku', en: 'Full Block Archive' }
  }},
  APP_WEB_website_v2_9_src_components_expl: {
    just_now: { cs: 'prave ted', en: 'just now' }
    full_transaction_feed: { cs: 'Kompletni tok transakci', en: 'Full Transaction Feed' }
  }},
  APP_WEB_website_v2_9_src_components_netw: {
    observability: { cs: 'Observabilita', en: 'Observability' }
    monitoring_snapshot: { cs: 'Monitoring prehled', en: 'Monitoring Snapshot' }
    fast_operational_signals_mirrored_from_the_monitor: { cs: 'Rychle operacni signaly zrcadlene z monitoring stacku, aby verejna sitova stranka nesla jednim pohledem topologii i zdravi stroje.', en: 'Fast operational signals mirrored from the monitoring stack so the public network page carries both topology and machine health at a glance.' }
    core_target: { cs: 'Core target', en: 'Core Target' }
    up: { cs: 'ONLINE', en: 'UP' }
    down: { cs: 'OFFLINE', en: 'DOWN' }
    height: { cs: 'Vyska', en: 'Height' }
    pool_target: { cs: 'Pool target', en: 'Pool Target' }
    active_sessions: { cs: 'aktivnich relaci', en: 'active sessions' }
    accept_rate: { cs: 'Accept rate', en: 'Accept Rate' }
    uptime: { cs: 'Uptime', en: 'Uptime' }
    template_fees: { cs: 'Template fee', en: 'Template Fees' }
    current_fee_envelope_from_the_active_block_templat: { cs: 'Aktualni fee envelope z aktivniho block template', en: 'Current fee envelope from the active block template' }
    load_avg_1m: { cs: 'Load avg 1m', en: 'Load Avg 1m' }
    primary_host_pressure: { cs: 'Zatez primarniho hostu', en: 'Primary host pressure' }
    memory_free: { cs: 'Volna pamet', en: 'Memory Free' }
    total: { cs: 'celkem', en: 'total' }
    node_exporter_memory: { cs: 'Pamet z node exporteru', en: 'Node exporter memory' }
    disk_free: { cs: 'Volny disk', en: 'Disk Free' }
    root_filesystem: { cs: 'Root filesystem', en: 'Root filesystem' }
    deep_drilldown: { cs: 'Hlubsi drilldown', en: 'Deep Drilldown' }
    for_sparklines_raw_prometheus_backed_counters_and_: { cs: 'Pro sparkline grafy, syrove Prometheus metriky a inventar stacku pokracujte do plneho monitoringu.', en: 'For sparklines, raw Prometheus-backed counters, and stack inventory, continue to the full monitoring dashboard.' }
    updated: { cs: 'Aktualizovano', en: 'Updated' }
    loading_live_data: { cs: 'Nacitam ziva data', en: 'Loading live data' }
    full_monitoring: { cs: 'Plny monitoring', en: 'Full monitoring' }
  }},
  APP_WEB_website_v2_9_src_components_netw: {
    operator_toolkit: { cs: 'Operator toolkit', en: 'Operator Toolkit' }
    network_ops_pro: { cs: 'Sitove operace Pro', en: 'Network Ops Pro' }
    failover_templates_health_probes_and_machine_reada: { cs: 'Failover sablony, health probe a strojove citelne endpointy pro operatory, kteri potrebuji pracovat pod vrstvou verejneho dashboardu.', en: 'Failover templates, health probes, and machine-readable endpoints for operators who need to work below the public dashboard layer.' }
    primary_mining: { cs: 'Primarni tezba', en: 'Primary Mining' }
    current_public_stratum_endpoint_on_zion2_historica: { cs: 'Aktualni verejny stratum endpoint na Zion2. Historicky multi-host failover patri do archivovanych dokumentu o topologii.', en: 'Current public stratum endpoint on Zion2. Historical multi-host failover belongs to archived topology docs.' }
    copied: { cs: 'Zkopirovano', en: 'Copied' }
    copy_command: { cs: 'Kopirovat prikaz', en: 'Copy command' }
    health_probes: { cs: 'Health probe', en: 'Health Probes' }
    copy_health: { cs: 'Kopirovat health', en: 'Copy health' }
    copy_network: { cs: 'Kopirovat network', en: 'Copy network' }
    export_docs: { cs: 'Export a docs', en: 'Export & Docs' }
    monitoring_dashboard: { cs: 'Monitoring dashboard', en: 'Monitoring dashboard' }
    docs_hub: { cs: 'Centrum dokumentace', en: 'Docs hub' }
  }},
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
