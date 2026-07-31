'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Newspaper, ArrowRight, Calendar, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import DogeVsZionBanner from '@/components/DogeVsZionBanner';

const NewsFeedCopy = {
  newsUpdates: { cs: `Novinky a aktualizace`, en: `News & Updates` },
  news: { cs: `Novinky`, en: `News` },
  latestUpdatesFromTheZionEcosys: { cs: `Poslední zprávy z vývoje ZION ekosystému, Multichain, OASIS a sítě.`, en: `Latest updates from the ZION ecosystem development, Multichain, OASIS, and network.` },
  readMore: { cs: `Číst více`, en: `Read more` },
};

// ─── Article type ─────────────────────────────────────────────────────────────

export interface NewsArticle {
  slug: string;
  date: string;            // ISO date
  tag: { cs: string; en: string };
  tagColor: string;        // tailwind text color
  title: { cs: string; en: string };
  summary: { cs: string; en: string };
  href: string;            // internal or external link
  external?: boolean;
  banner?: 'doge-vs-zion'; // special visual banner
}

// ─── Articles data ────────────────────────────────────────────────────────────

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: 'v3-1-0-mainnet-alpha-website',
    date: '2026-07-31',
    tag: { cs: 'Aktualizace', en: 'Update' },
    tagColor: 'text-cyan-400',
    title: {
      cs: 'Web 2.9 se aktualizuje na v3.1.0 Mainnet Alpha',
      en: 'Web 2.9 updated to v3.1.0 Mainnet Alpha',
    },
    summary: {
      cs: 'ZION web 2.9 přechází na V31 Mainnet Alpha. Veřejná linka nyní ukazuje v3.1.0, dokumentace a přehledy jsou synchronizované. Tři samostatné veřejné služby běží současně: intro na zionterranova.com, web2.9 na app.zionterranova.com a OASIS Web na oasis.zionterranova.com.',
      en: 'ZION web 2.9 is moving to V31 Mainnet Alpha. The public line now shows v3.1.0; docs and dashboards are in sync. Three separate public services run at the same time: the intro at zionterranova.com, web2.9 at app.zionterranova.com, and OASIS Web at oasis.zionterranova.com.',
    },
    href: '/docs',
  },
  {
    slug: 'oasis-construction-v0-0-1',
    date: '2026-07-31',
    tag: { cs: 'OASIS', en: 'OASIS' },
    tagColor: 'text-fuchsia-400',
    title: {
      cs: 'OASIS se staví — L4 herní vrstva ZIONu dostává vizuál v0.0.1',
      en: 'OASIS under construction — ZION L4 gaming layer gets v0.0.1 visuals',
    },
    summary: {
      cs: 'Právě probíhá stavba OASIS, L4 herní vrstvy ZION TerraNova. První vizuální iterace v0.0.1 je live na oasis.zionterranova.com: spirálová galaxie 30 000 částic inspirovaná Three.js Journey, 3D Strom života s trubičkovými větvemi a svítícími plody, bloom postprocessing a kamerový přílet do centra. Následují interaktivní světy, avataři a guild mechaniky.',
      en: 'OASIS, the L4 gaming layer of ZION TerraNova, is currently under construction. The first visual iteration v0.0.1 is live at oasis.zionterranova.com: a 30,000-particle spiral galaxy inspired by Three.js Journey, a 3D Tree of Life with tube branches and glowing fruits, bloom postprocessing, and a camera fly-in to the center. Interactive worlds, avatars, and guild mechanics are next.',
    },
    href: 'https://oasis.zionterranova.com',
    external: true,
  },
  {
    slug: 'roadmap-to-mainnet-alpha-31',
    date: '2026-07-23',
    tag: { cs: 'Roadmap', en: 'Roadmap' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'Cesta k ZION 3.1.0 Mainnet Alpha — od Trinity k čistému mainnetu',
      en: 'Roadmap to ZION 3.1.0 Mainnet Alpha — from Trinity to a clean mainnet',
    },
    summary: {
      cs: 'ZION 3.0.6 Trinity je venku a síť běží. Nyní míříme k 3.1.0 Mainnet Alpha: 3.0.7 „All Green“ → 3.0.8 „Full Stack Stable“ → 3.0.9 „Pre-Alpha Hardening“ → 3.1.0. Pokud síť zůstane bez kritických chyb, další hard reset nebude nutný — současný genesis hash je trvalý. Pracujeme na všech známých bugech a připravujeme repozitář pro masivní miner onboarding.',
      en: 'ZION 3.0.6 Trinity is live and the network is running. We are now heading toward 3.1.0 Mainnet Alpha: 3.0.7 “All Green” → 3.0.8 “Full Stack Stable” → 3.0.9 “Pre-Alpha Hardening” → 3.1.0. If the network stays free of critical bugs, no further hard reset will be needed — the current genesis hash is permanent. We are working through every known issue and preparing the repository for large-scale miner onboarding.',
    },
    href: '/whitepapers',
  },
  {
    slug: 'v3.0.6-beta-trinity-released',
    date: '2026-07-21',
    tag: { cs: 'Release', en: 'Release' },
    tagColor: 'text-emerald-400',
    title: {
      cs: 'ZION v3.0.6-beta Trinity — veřejný miner release',
      en: 'ZION v3.0.6-beta Trinity — public miner release',
    },
    summary: {
      cs: 'ZION v3.0.6-beta "Trinity, Mainnet Beta" je venku. Miner pro Linux x86_64/ARM64, macOS Apple Silicon/Intel a Windows. Stáhni z GitHub Releases, vytvoř peněženku a začni těžit na oficiální pool. Veřejný launch zůstává naplánován na 31. prosince 2026.',
      en: 'ZION v3.0.6-beta "Trinity, Mainnet Beta" is out. Miner for Linux x86_64/ARM64, macOS Apple Silicon/Intel, and Windows. Download from GitHub Releases, create your wallet, and start mining to the official pool. Public launch remains scheduled for 31 December 2026.',
    },
    href: 'https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.6-beta',
    external: true,
  },
  {
    slug: 'v3.0.5-beta-simplified-community-cli',
    date: '2026-07-10',
    tag: { cs: 'Release', en: 'Release' },
    tagColor: 'text-emerald-400',
    title: {
      cs: 'ZION v3.0.5-beta — Simplified Community CLI: jeden binary, 4 platformy, interaktivní menu',
      en: 'ZION v3.0.5-beta — Simplified Community CLI: one binary, 4 platforms, interactive menu',
    },
    summary: {
      cs: 'Nový release v3.0.5-beta nahrazuje 8 oddělených binárek jedním `zion` binary s interaktivním menu (šipky + Enter). Wallet, node, miner, pool, status, doctor, monitor — vše v jednom. 4 platformy: Linux x86_64, macOS Apple Silicon (M1–M4), macOS Intel, Windows x86_64 (node + pool + miner embedded, 10 MB). GPU mining: Metal (macOS), OpenCL/CUDA (Linux), CPU fallback. SHA256 verifikace. Stáhni z GitHub Releases.',
      en: 'New release v3.0.5-beta replaces 8 separate binaries with a single `zion` binary featuring an interactive arrow-key menu. Wallet, node, miner, pool, status, doctor, monitor — all in one. 4 platforms: Linux x86_64, macOS Apple Silicon (M1–M4), macOS Intel, Windows x86_64 (node + pool + miner embedded, 10 MB). GPU mining: Metal (macOS), OpenCL/CUDA (Linux), CPU fallback. SHA256 verification. Download from GitHub Releases.',
    },
    href: 'https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta',
    external: true,
  },
  {
    slug: '3.0.5-all-green-mainnet-beta-github-public',
    date: '2026-07-09',
    tag: { cs: 'Security', en: 'Security' },
    tagColor: 'text-rose-400',
    title: {
      cs: 'ZION 3.0.5 "All Green" Mainnet Beta — hard reset po hacku, 11/11 služeb aktivních, zdroj na GitHubu',
      en: 'ZION 3.0.5 "All Green" Mainnet Beta — hard reset after hack, 11/11 services active, source on GitHub',
    },
    summary: {
      cs: 'Po bezpečnostním incidentu (ZION-2026-001 až 005: padělané P2P podpisy, neomezená inflace F5, expozice serveru) jsme provedli kompletní hard genesis reset (6. 7. 2026) a následný 3.0.5 "All Green" upgrade (9. 7. 2026). Nový genesis hash 4f75a0df…, všech 14 premine + 5 kanonických + bridge vault adres regenerováno z BIP39 mnemonik (air-gapped). 7 DeFi kontraktů na Base Mainnet ověřeno na Basescan (7/7). 5/5 EVM bridge validátorů, 6 chainů aktivních. WARP bridge pokrývá 13 chain rodin. 11/11 služeb aktivních, protocol 3.0.5, E2E memo testy potvrzeny. ZION běží jako Mainnet Beta — veřejný launch 31. 12. 2026. Těžba na vlastní nebezpečí. Zdrojový kód: github.com/Zion-TerraNova/v3-Mainnet.',
      en: 'Following a security incident (ZION-2026-001 through 005: forged P2P signatures, unlimited inflation F5, server exposure) we performed a complete hard genesis reset (6 Jul 2026) and subsequent 3.0.5 "All Green" upgrade (9 Jul 2026). New genesis hash 4f75a0df…, all 14 premine + 5 canonical + bridge vault addresses regenerated from BIP39 mnemonics (air-gapped). 7 DeFi contracts on Base Mainnet verified on Basescan (7/7). 5/5 EVM bridge validators, 6 chains active. WARP bridge covers 13 chain families. 11/11 services active, protocol 3.0.5, E2E memo tests confirmed. ZION runs as Mainnet Beta — public launch 31 Dec 2026. Mining at your own risk. Source code: github.com/Zion-TerraNova/v3-Mainnet.',
    },
    href: 'https://github.com/Zion-TerraNova/v3-Mainnet/tree/main',
    external: true,
  },
  {
    slug: 'multichain-ecosystem-live',
    date: '2026-06-30',
    tag: { cs: 'Multichain', en: 'Multichain' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'ZION Multichain ekosystém LIVE — 2 DEX, 6 chainů, CCA aukce, bridge',
      en: 'ZION Multichain ecosystem LIVE — 2 DEX, 6 chains, CCA auction, bridge',
    },
    summary: {
      cs: 'wZION je dostupný na 2 DEX platformách (Uniswap V4 + PancakeSwap V3), na 6 EVM chainech (Base, BSC, Polygon, Arbitrum, Optimism, Avalanche), s aktivní Uniswap CCA aukcí (66.47M wZION za USDC) a obousměrným bridge (lock ZION na L1 → mint wZION, burn → unlock). LiFi agregátor přidává 30+ DEX a 20+ bridge protokolů. Live cenový graf, swap widget a portfolio dashboard na /defi.',
      en: 'wZION is available on 2 DEX platforms (Uniswap V4 + PancakeSwap V3), on 6 EVM chains (Base, BSC, Polygon, Arbitrum, Optimism, Avalanche), with an active Uniswap CCA auction (66.47M wZION for USDC) and bidirectional bridge (lock ZION on L1 → mint wZION, burn → unlock). LiFi aggregator adds 30+ DEX and 20+ bridge protocols. Live price chart, swap widget, and portfolio dashboard on /defi.',
    },
    href: '/defi',
  },
  {
    slug: 'warp-13-chain-families',
    date: '2026-06-30',
    tag: { cs: 'WARP', en: 'WARP' },
    tagColor: 'text-purple-400',
    title: {
      cs: 'WARP pokrývá všech 13 chain rodin! — 408 testů prošlo',
      en: 'WARP covers all 13 chain families! — 408 tests pass',
    },
    summary: {
      cs: 'ZION WARP bridge má kompletní pokrytí: EVM (6 chainů), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui a TON. Nové adaptéry: Aptos (Ed25519), NEAR (borsh TX), Sui (Ed25519 + flag byte), TON (Ed25519 + getTransactions), Lightning (BOLT11 parser + LND REST). 408 testů prošlo, 110 nových. WARP je most mezi ZION L1 a celým blockchain vesmírem.',
      en: 'ZION WARP bridge has complete coverage: EVM (6 chains), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui, and TON. New adapters: Aptos (Ed25519), NEAR (borsh TX), Sui (Ed25519 + flag byte), TON (Ed25519 + getTransactions), Lightning (BOLT11 parser + LND REST). 408 tests pass, 110 new. WARP is the bridge between ZION L1 and the entire blockchain universe.',
    },
    href: '/warp',
  },
  {
    slug: 'zion-3.0.4-decimal-fork',
    date: '2026-06-27',
    tag: { cs: 'Hard Fork', en: 'Hard Fork' },
    tagColor: 'text-rose-400',
    title: {
      cs: 'ZION 3.0.4 — Decimal Fork: 10¹² → 10⁶ flowers, historie bloků zachována',
      en: 'ZION 3.0.4 — Decimal Fork: 10¹² → 10⁶ flowers, block history preserved',
    },
    summary: {
      cs: 'Měníme FLOWERS_PER_ZION z 10¹² na 10⁶ — čistší jednotky jako Monero a Cardano. Bloky 0..H zůstávají, hashe se nemění, explorer vidí celou historii. Na bloku H+1 migration block: burn starých UTXO, nové s amount /10⁶. Nový protocol_version 2, nová emise, nové fees — vše v flowers (10⁶). Bridge factor se mění z 10⁶ na 10¹² pro 1:1 kompatibilitu. Stejný release uzamkne canonical RPC pojmenování.',
      en: 'Changing FLOWERS_PER_ZION from 10¹² to 10⁶ — cleaner units like Monero and Cardano. Blocks 0..H stay on disk, hashes unchanged, explorer sees full history. At block H+1 a migration block: burn old UTXO, create new with amount /10⁶. New protocol_version 2, new emission, new fees — all in flowers (10⁶). Bridge factor changes from 10⁶ to 10¹² for 1:1 compatibility. Same release locks canonical RPC naming.',
    },
    href: '/network',
  },
  {
    slug: 'doge-vs-zion-legendary-price',
    date: '2026-06-26',
    tag: { cs: 'Historie', en: 'History' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'Historická paměť 🐕 Když Dogecoin stál $0.0002 — a proč ZION kráčí stejnou cestou',
      en: 'Historic memory 🐕 When Dogecoin was $0.0002 — and why ZION walks the same path',
    },
    summary: {
      cs: 'V prosinci 2013 stál jeden Dogecoin $0.0002. Nikdo nevěděl, že v květnu 2021 — po 7.5 letech — dosáhne ATH $0.73, tedy 3650× skok, který zapsal memecoin do historie. Dnes ZION nastavuje seed cenu na stejných $0.0002/ZION. Ne proto, že bychom chtěli zopakovat Doge. Ale proto, že každá legenda začíná stejně — s malým číslem a velkým příběhem. 144B zásoba, 5/5 validátorů, AI vrstva, Strom života. FDV ~$28.8M. ZION není memecoin. Je to vzpomínka na budoucnost.',
      en: 'In December 2013, one Dogecoin cost $0.0002. Nobody knew that in May 2021 — after 7.5 years — it would reach its ATH of $0.73, a 3650× jump that wrote memecoins into history. Today ZION sets its seed price at the same $0.0002/ZION. Not because we want to repeat Doge. But because every legend starts the same way — with a small number and a big story. 144B supply, 5/5 validators, AI layer, Tree of Life. FDV ~$28.8M. ZION is not a memecoin. It is a memory of the future.',
    },
    href: '/defi',
    banner: 'doge-vs-zion',
  },
  {
    slug: 'hiran-v2.3-trained',
    date: '2026-06-18',
    tag: { cs: 'AI', en: 'AI' },
    tagColor: 'text-purple-400',
    title: {
      cs: 'Hiran v2.3 úspěšně natrénován — QLoRA fine-tuning dokončen',
      en: 'Hiran v2.3 successfully trained — QLoRA fine-tuning completed',
    },
    summary: {
      cs: 'Hiran v2.3 AI model byl úspěšně natrénován pomocí QLoRA fine-tuning. Nový checkpoint modelu je připraven pro nasazení v L3 vrstvě. Vylepšené schopnosti inference a lepší výkon pro AI-native aplikace.',
      en: 'Hiran v2.3 AI model was successfully trained using QLoRA fine-tuning. New model checkpoint is ready for deployment in L3 layer. Enhanced inference capabilities and improved performance for AI-native applications.',
    },
    href: '/l3-hiran',
  },
  {
    slug: 'terranova-genesis-3.0.1',
    date: '2026-06-11',
    tag: { cs: 'Genesis', en: 'Genesis' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'TerraNova Genesis 3.0.1 — MainNet spuštěn 11. 6. 2026 · veřejný launch 31. 12. 2026',
      en: 'TerraNova Genesis 3.0.1 — MainNet launched 11 Jun 2026 · public launch 31 Dec 2026',
    },
    summary: {
      cs: 'Hard reset Genesis řetězce byl úspěšně proveden. Síť je stabilní, Edge server topologie běží, pool a mining jsou aktivní. Veřejný přístup pro všechny zůstává naplánován na Silvestra 31. 12. 2026.',
      en: 'The Genesis chain hard reset was successfully completed. The network is stable, Edge server topology is running, pool and mining are active. Public access remains scheduled for New Year\'s Eve 31 Dec 2026.',
    },
    href: '/terranova',
  },
  {
    slug: 'fire-hard-fork-5000',
    date: '2026-06-13',
    tag: { cs: 'Hard Fork', en: 'Hard Fork' },
    tagColor: 'text-rose-400',
    title: {
      cs: 'Deeksha Lite Fire hard fork — aktivace na bloku 5000',
      en: 'Deeksha Lite Fire hard fork — activation at block 5000',
    },
    summary: {
      cs: 'ZION přepne konsensus algoritmus z deeksha_lite_v1 na deeksha_lite_fire na bloku 5000. OpenCL kernel s Metal alignment fixy, GPU/CPU path oddělení, algorithm-aware validace. Očekávaná aktivace ~2–3 dny.',
      en: 'ZION will switch consensus algorithm from deeksha_lite_v1 to deeksha_lite_fire at block 5000. OpenCL kernel with Metal alignment fixes, GPU/CPU path separation, algorithm-aware validation. Expected activation in ~2–3 days.',
    },
    href: '/network',
  },
  {
    slug: 'deeksha-fire-announcement',
    date: '2026-06-07',
    tag: { cs: 'Oznámení', en: 'Announcement' },
    tagColor: 'text-rose-400',
    title: {
      cs: 'Deeksha Fire & Lite — sezónní těžební módy ZION',
      en: 'Deeksha Fire & Lite — seasonal mining modes for ZION',
    },
    summary: {
      cs: 'Deeksha Lite = malá spotřeba energie bez topení, ideální na léto. Deeksha Fire = plný výkon i s teplem, topení pro zimu. Dva režimy, jeden protokol.',
      en: 'Deeksha Lite = low energy consumption without heating, ideal for summer. Deeksha Fire = full power with heat output, winter heating mode. Two modes, one protocol.',
    },
    href: '/network',
  },
  {
    slug: 'l3-hiran-orchestration',
    date: '2026-05-23',
    tag: { cs: 'AI', en: 'AI' },
    tagColor: 'text-purple-400',
    title: {
      cs: 'L3 Hiran v2.2 — AI orchestrace, chat a marketplace',
      en: 'L3 Hiran v2.2 — AI orchestration, chat & marketplace',
    },
    summary: {
      cs: 'Nová stránka /l3-hiran s kompletním přehledem AI vrstvy: deployment GPU, monitoring, RAG pipeline, QLoRA fine-tuning, live chat a AI marketplace s modely a datasety.',
      en: 'New /l3-hiran page with complete AI layer overview: GPU deployment, monitoring, RAG pipeline, QLoRA fine-tuning, live chat and AI marketplace with models and datasets.',
    },
    href: '/l3-hiran',
  },
  {
    slug: 'wiki-section-launch',
    date: '2026-05-23',
    tag: { cs: 'Wiki', en: 'Wiki' },
    tagColor: 'text-emerald-400',
    title: {
      cs: 'Wiki sekce — TerraNova, Genesis, Dokumentace na jednom místě',
      en: 'Wiki section — TerraNova, Genesis, Docs in one place',
    },
    summary: {
      cs: 'Nová /wiki landing page a reorganizace navigace do 3 skupin (Info, Vrstvy, Wiki). Přímý přístup k TerraNova knize, Genesis specifikaci a dokumentaci.',
      en: 'New /wiki landing page and navigation reorganized into 3 groups (Info, Layers, Wiki). Direct access to TerraNova book, Genesis spec, and documentation.',
    },
    href: '/wiki',
  },
  {
    slug: 'l4-oasis-page',
    date: '2026-05-23',
    tag: { cs: 'Layers', en: 'Layers' },
    tagColor: 'text-orange-400',
    title: {
      cs: 'L4 Oasis — UE5 metaverse stránka a reorganizace menu',
      en: 'L4 Oasis — UE5 metaverse page and menu reorganization',
    },
    summary: {
      cs: 'Nová /l4-oasis stránka pro herní vrstvu ZION. Reorganizace navigace do skupin Info, Vrstvy (L2-L6) a Wiki. L5 komunitní karty prolinkované s TerraNova.',
      en: 'New /l4-oasis page for ZION game layer. Navigation reorganized into Info, Layers (L2-L6), and Wiki groups. L5 community cards linked to TerraNova.',
    },
    href: '/l4-oasis',
  },
  {
    slug: 'v3-internal-audit-complete',
    date: '2026-05-04',
    tag: { cs: 'Audit', en: 'Audit' },
    tagColor: 'text-emerald-400',
    title: {
      cs: 'Interní audit ZION V3 dokončen — shrnutí nálezů a launch readiness',
      en: 'ZION V3 internal audit completed — findings summary and launch readiness',
    },
    summary: {
      cs: 'Zkonsolidovali jsme interní security audit V3: uzavřené nálezy, co ještě blokuje Genesis, a konkrétní aktivační plán (tx-hash v2 + Merkle F2).',
      en: 'We consolidated the V3 internal security audit: closed findings, what still blocks Genesis, and the concrete activation plan (tx-hash v2 + Merkle F2).',
    },
    href: '/news/v3-internal-audit',
  },
  {
    slug: 'zion-cli-rollout',
    date: '2026-04-21',
    tag: { cs: 'CLI', en: 'CLI' },
    tagColor: 'text-zion-cyan',
    title: {
      cs: 'ZION CLI je nově součástí veřejného webu, dokumentace a download surface',
      en: 'ZION CLI is now part of the public website, docs, and download surface',
    },
    summary: {
      cs: 'Nový sjednocený operátorský gateway pro node, pool, miner, agent, bridge, DAO, deploy a monitoring má vlastní docs sekci, zmínku na homepage a samostatný blok na download page. Veřejné binární release artefakty teď doháníme jako další krok.',
      en: 'The new unified operator gateway for node, pool, miner, agent, bridge, DAO, deploy, and monitoring now has its own docs section, homepage mention, and dedicated block on the download page. Public binary release artifacts are the next step now catching up.',
    },
    href: '/download',
  },
  {
    slug: 'terranova-book',
    date: '2026-04-20',
    tag: { cs: 'Kniha', en: 'Book' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'Terra Nova — čtvrtá kniha ZION je online jako veřejná čtenářská edice',
      en: 'Terra Nova — fourth ZION book is online as a public reader\'s edition',
    },
    summary: {
      cs: 'Kompletní čtenářská edice TerraNovy: od Prologu na orbitální stanici Issobella, přes komunity, AI a péči, architekturu L1–L6, hvězdný horizont až po Zlatý Kompas sedmi směrů. Bilingvální CZ/EN, propojená s interaktivním Kompasem.',
      en: 'Complete reader\'s edition of TerraNova: from the Prologue on orbital station Issobella, through communities, AI and care, L1–L6 architecture, stellar horizon to the Golden Compass of seven directions. Bilingual CZ/EN, linked with the interactive Compass.',
    },
    href: '/terranova',
  },
  {
    slug: 'gpu-benchmark-matrix',
    date: '2026-04-02',
    tag: { cs: 'Mining', en: 'Mining' },
    tagColor: 'text-cyan-400',
    title: {
      cs: 'GPU Benchmark Matrix — 8 GPU od GTX 1060 po H100 SXM (81.7 KH/s)',
      en: 'GPU Benchmark Matrix — 8 GPUs from GTX 1060 to H100 SXM (81.7 KH/s)',
    },
    summary: {
      cs: 'Kompletní benchmark Ekam Deeksha v2 napříč 8 GPU. H100 SXM dosáhl 81.7 KH/s (nový rekord), RTX 3060 je král cena/výkon (344 KH/$). TPB=24 (¾ warpu) je optimální pro moderní architektury Hopper a Ampere. I 3GB karty těží!',
      en: 'Complete Ekam Deeksha v2 benchmark across 8 GPUs. H100 SXM reached 81.7 KH/s (new record), RTX 3060 is the cost-efficiency king (344 KH/$). TPB=24 (¾ warp) is optimal for modern Hopper and Ampere architectures. Even 3GB cards can mine!',
    },
    href: '/benchmarks',
  },
  {
    slug: 'defi-mainnet-live',
    date: '2026-04-02',
    tag: { cs: 'DeFi', en: 'DeFi' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'wZION DEX je live na Base Mainnet — swap, bridge a portfolio',
      en: 'wZION DEX is live on Base Mainnet — swap, bridge & portfolio',
    },
    summary: {
      cs: 'Počáteční Uniswap V3 pool wZION/WETH nasazen na Base Mainnet. WETH pozice později spálena — nyní aktivní pouze wZION/USDT 0.3% pool. Na zionterranova.com/defi funguje swap, bridge a portfolio dashboard s live cenami z on-chain poolu.',
      en: 'Initial Uniswap V3 wZION/WETH pool deployed on Base Mainnet. WETH position later burned — now only wZION/USDT 0.3% pool is active. zionterranova.com/defi features swap, bridge, and a portfolio dashboard with live on-chain pool prices.',
    },
    href: '/defi',
  },
  {
    slug: 'ekam-deeksha-featured-cz-en-rollout',
    date: '2026-03-31',
    tag: { cs: 'Kniha', en: 'Book' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'Ekam Deeksha zvýrazněna na homepage + kompletní CZ/EN překlady ve Web 2.9',
      en: 'Ekam Deeksha now featured on homepage + complete CZ/EN translations across Web 2.9',
    },
    summary: {
      cs: 'Kniha Ekam Deeksha je nově výrazně zvýrazněná na homepage a přidaná do novinek. Současně postupně sjednocujeme kompletní české a anglické texty napříč Web 2.9, aby byl obsah konzistentní v obou jazycích.',
      en: 'Ekam Deeksha is now prominently highlighted on the homepage and added to News. In parallel, we are rolling out complete Czech and English copy consistency across Web 2.9 for a unified bilingual experience.',
    },
    href: '/docs#book-ekam-full',
  },
  {
    slug: 'defi-hub-launch',
    date: '2026-03-30',
    tag: { cs: 'DeFi', en: 'DeFi' },
    tagColor: 'text-zion-gold',
    title: {
      cs: 'ZION L2 DeFi kontrakty nasazeny — Bridge, DEX pool a wZION na Base',
      en: 'ZION L2 DeFi contracts deployed — Bridge, DEX pool & wZION on Base',
    },
    summary: {
      cs: 'wZION ERC-20, ZIONBridge a počáteční Uniswap V3 pool (wZION/WETH 0.3%) nasazeny na Base. WETH pozice později spálena — nyní aktivní wZION/USDT 0.3% pool. Relay propojuje ZION L1 s Base. Bridge umožňuje lock/mint a burn/unlock.',
      en: 'wZION ERC-20, ZIONBridge, and initial Uniswap V3 pool (wZION/WETH 0.3%) deployed on Base. WETH position later burned — now wZION/USDT 0.3% pool is active. Relay connects ZION L1 with Base. Bridge enables lock/mint and burn/unlock.',
    },
    href: '/defi',
  },
  {
    slug: 'coingecko-listing',
    date: '2026-03-30',
    tag: { cs: 'Listing', en: 'Listing' },
    tagColor: 'text-green-400',
    title: {
      cs: 'CoinGecko registrace — ZION se připravuje na listing',
      en: 'CoinGecko registration — ZION prepares for listing',
    },
    summary: {
      cs: 'Zahájili jsme proces registrace ZION na CoinGecko. Požadavky: funkční blockchain s veřejným explorerem ✅, obchodovatelný token na DEX (wZION/USDT Uniswap V3 pool na Base) ✅, otevřený zdrojový kód ✅, dokumentace a whitepaper ✅. Čekáme na schválení a mainnet deployment na Base mainnet s reálnou likviditou.',
      en: 'We have started the process of registering ZION on CoinGecko. Requirements: working blockchain with public explorer ✅, tradeable token on DEX (wZION/USDT Uniswap V3 pool on Base) ✅, open source code ✅, documentation and whitepaper ✅. Awaiting approval and Base mainnet deployment with real liquidity.',
    },
    href: '/roadmap',
  },
  {
    slug: 'v3-testnet-live',
    date: '2026-03-15',
    tag: { cs: 'Mainnet', en: 'Mainnet' },
    tagColor: 'text-blue-400',
    title: {
      cs: 'V3 Mainnet — Edge server topologie v provozu',
      en: 'V3 Mainnet — Edge server topology operational',
    },
    summary: {
      cs: 'ZION V3 mainnet běží v Edge server topologii (Edge server). Kanonický runtime v2.9.8 Ekam Deeksha, veřejný mining pool a Prometheus telemetrie. Chain height přes 470+ bloků.',
      en: 'ZION V3 mainnet running in Edge server topology (Edge server). Canonical runtime v2.9.8 Ekam Deeksha, public mining pool, Prometheus telemetry. Chain height over 470+ blocks.',
    },
    href: '/network',
  },
  {
    slug: 'bridge-testnet-deploy',
    date: '2026-03-10',
    tag: { cs: 'L2', en: 'L2' },
    tagColor: 'text-purple-400',
    title: {
      cs: 'L1↔L2 Bridge nasazen — relay propojuje ZION s Base',
      en: 'L1↔L2 Bridge deployed — relay connects ZION with Base',
    },
    summary: {
      cs: 'Rust relay propojuje ZION L1 s Base. Lock ZION → mint wZION, burn wZION → unlock ZION. Guardian threshold validace, 60-block finality na L1, 64-block finality na EVM.',
      en: 'Rust relay connects ZION L1 with Base. Lock ZION → mint wZION, burn wZION → unlock ZION. Guardian threshold validation, 60-block finality on L1, 64-block finality on EVM.',
    },
    href: '/bridge',
  },
];

// ─── Card accent gradients ────────────────────────────────────────────────────
const CARD_ACCENT: Record<string, { from: string; to: string; glow: string }> = {
  Mainnet:   { from: 'from-amber-500/20', to: 'to-orange-500/5', glow: 'shadow-amber-500/10' },
  AI:        { from: 'from-purple-500/20', to: 'to-pink-500/5', glow: 'shadow-purple-500/10' },
  Wiki:      { from: 'from-emerald-500/20', to: 'to-teal-500/5', glow: 'shadow-emerald-500/10' },
  Layers:    { from: 'from-orange-500/20', to: 'to-amber-500/5', glow: 'shadow-orange-500/10' },
  Audit:     { from: 'from-emerald-500/20', to: 'to-green-500/5', glow: 'shadow-emerald-500/10' },
  CLI:       { from: 'from-cyan-500/20', to: 'to-blue-500/5', glow: 'shadow-cyan-500/10' },
  Kniha:     { from: 'from-yellow-500/20', to: 'to-amber-500/5', glow: 'shadow-yellow-500/10' },
  Book:      { from: 'from-yellow-500/20', to: 'to-amber-500/5', glow: 'shadow-yellow-500/10' },
  Mining:    { from: 'from-cyan-500/20', to: 'to-sky-500/5', glow: 'shadow-cyan-500/10' },
  DeFi:      { from: 'from-gold-500/20', to: 'to-yellow-500/5', glow: 'shadow-yellow-500/10' },
  Launch:    { from: 'from-amber-500/20', to: 'to-yellow-500/5', glow: 'shadow-amber-500/10' },
  Listing:   { from: 'from-green-500/20', to: 'to-emerald-500/5', glow: 'shadow-green-500/10' },
  'Hard Fork': { from: 'from-rose-500/20', to: 'to-red-500/5', glow: 'shadow-rose-500/10' },
  History:    { from: 'from-amber-500/20', to: 'to-yellow-500/5', glow: 'shadow-amber-500/10' },
  Security:   { from: 'from-rose-500/20', to: 'to-red-500/5', glow: 'shadow-rose-500/10' },
};

function getAccent(tag: string) {
  return CARD_ACCENT[tag] || { from: 'from-white/10', to: 'to-white/5', glow: 'shadow-white/10' };
}

// ─── Component ────────────────────────────────────────────────────────────────

const HOMEPAGE_LIMIT = 4;

export default function NewsFeed() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const visibleArticles = NEWS_ARTICLES.slice(0, HOMEPAGE_LIMIT);
  const hasMore = NEWS_ARTICLES.length > HOMEPAGE_LIMIT;

  return (
    <section className="relative py-20 px-4 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-zion-gold/[0.02] to-transparent pointer-events-none" />
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/5 animate-pulse"
            style={{
              width: `${2 + (i % 4)}px`,
              height: `${2 + (i % 4)}px`,
              top: `${(i * 17.3) % 100}%`,
              left: `${(i * 29.7) % 100}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      <div className="zion-container relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-3">
            <Newspaper className="w-5 h-5 text-zion-gold" />
            <span className="text-sm uppercase tracking-[0.4em] text-gray-400">
              {NewsFeedCopy.newsUpdates[cs ? 'cs' : 'en']}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-zion-gold/60 bg-zion-gold/10 border border-zion-gold/20 px-2 py-0.5 rounded-full">
              {cs ? `${NEWS_ARTICLES.length} článků` : `${NEWS_ARTICLES.length} articles`}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            <span className="text-gradient">
              {NewsFeedCopy.news[cs ? 'cs' : 'en']}
            </span>
          </h2>
          <p className="text-lg text-gray-300 mt-3 max-w-2xl">
            {NewsFeedCopy.latestUpdatesFromTheZionEcosys[cs ? 'cs' : 'en']}
          </p>
        </motion.div>

        {/* Articles grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleArticles.map((article, i) => {
            const accent = getAccent(cs ? article.tag.cs : article.tag.en);
            return (
              <motion.div
                key={article.slug}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Link
                  href={article.href}
                  target={article.external ? '_blank' : undefined}
                  rel={article.external ? 'noopener noreferrer' : undefined}
                  className={`zion-rainbow-sub group relative block h-full overflow-hidden`}
                  style={{ '--rc': '14, 165, 233' } as React.CSSProperties}
                >
                  {/* Gradient accent top */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r ${accent.from} ${accent.to}`} />
                  {/* Background glow on hover */}
                  <div className={`absolute -inset-px rounded-3xl bg-linear-to-br ${accent.from} ${accent.to} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none`} />

                  <div className="relative p-6">
                    {/* Meta row */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5 ${article.tagColor}`}>
                        {cs ? article.tag.cs : article.tag.en}
                      </span>
                      <span className="text-[11px] text-white/30 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {article.date}
                      </span>
                    </div>

                    {/* Special banner */}
                    {article.banner === 'doge-vs-zion' && (
                      <div className="mb-4">
                        <DogeVsZionBanner cs={cs} />
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-white group-hover:text-zion-gold transition-colors mb-3 leading-snug">
                      {cs ? article.title.cs : article.title.en}
                    </h3>

                    {/* Summary */}
                    <p className="text-sm text-white/45 leading-relaxed mb-4">
                      {cs ? article.summary.cs : article.summary.en}
                    </p>

                    {/* Read more */}
                    <div className="flex items-center gap-1.5 text-xs text-zion-gold/60 group-hover:text-zion-gold transition-colors">
                      <span>{NewsFeedCopy.readMore[cs ? 'cs' : 'en']}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* View all link */}
        {hasMore && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 text-center"
          >
            <Link
              href="/news"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white transition-all text-sm"
            >
              {cs ? `Všechny novinky (${NEWS_ARTICLES.length})` : `All news (${NEWS_ARTICLES.length})`}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
