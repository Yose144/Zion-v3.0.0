import { Book, Rocket, Shield, FileText, Sparkles, Globe, Cpu, Map, AlertTriangle, GitBranch, Coins } from 'lucide-react';
import { MAITREYA_CHAPTERS } from '@/app/maitreya/chapters';
import { NIRVANA_CHAPTERS } from '@/app/nirvana/chapters';
import { SURTA_CHAPTERS } from '@/app/surta-srdce/chapters';
import { KRAL_CHAPTERS } from '@/app/kralovstvi-srdce/chapters';

/* ═══════════════════════════════════════════
   Docs manifest — single source of truth for
   the /docs knowledge base. Shared by the docs
   page, the link resolver and the /docs/view
   generic reader.
   ═══════════════════════════════════════════ */

export type LocalizedText = { cs: string; en: string };

export function resolveLabel(text: LocalizedText | string | undefined, lang: 'cs' | 'en'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] ?? text.cs ?? text.en ?? '';
}

export function resolveMappedLabel(
  map: Record<string, LocalizedText>,
  id: string,
  fallback: string,
  lang: 'cs' | 'en',
): string {
  const entry = map[id];
  return entry ? resolveLabel(entry, lang) : fallback;
}

export interface Doc {
  id: string;
  title: string;
  file: string;
  href?: string;
}

export interface Category {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  docs: Doc[];
}

export interface Version {
  id: string;
  label: string;
  tag: string;
  tagColor: string;
  description: string;
  categories: Category[];
}

export interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentText: string;
  accentBorder: string;
  docs: Doc[];
}

export const versionText: Record<string, { tag?: LocalizedText; description?: LocalizedText }> = {
  'v3.2.0': {
    tag: { cs: 'AKTUÁLNÍ', en: 'CURRENT' },
    description: { cs: 'Aktuální veřejná linka — v3.2.0 "One Love", kandidát na Mainnet Stable (stability run #2 nesplnil gate), nový genesis hash po srpnovém hard resetu (kompletní rotace klíčů), 7/7 služeb aktivních, kanonický Ekam Deeksha PoW, DEX a bridge nasazeny', en: 'Current public line — v3.2.0 "One Love", Mainnet Stable candidate (stability run #2 failed the gate), new genesis hash after the August hard reset (complete key rotation), 7/7 services active, canonical Ekam Deeksha PoW, DEX and bridge deployed' },
  },
  'v3.1.0': {
    tag: { cs: 'PŘEDCHOZÍ', en: 'PREVIOUS' },
    description: { cs: 'Mainnet Alpha — první produkční cutover, Terminal Miner release, OASIS preview', en: 'Mainnet Alpha — first production cutover, Terminal Miner release, OASIS preview' },
  },
  'v3.0.6': {
    tag: { cs: 'PŘEDCHOZÍ', en: 'PREVIOUS' },
    description: { cs: 'Trinity / Mainnet Beta — AuxPoW triple plan, poslední beta linie před One Love', en: 'Trinity / Mainnet Beta — AuxPoW triple plan, last beta line before One Love' },
  },
  'v3.0.2': {
    tag: { cs: 'PŘEDCHOZÍ', en: 'PREVIOUS' },
    description: { cs: 'Bridge, DeFi Run — L2 bridge na Base Mainnet, wZION token live', en: 'Bridge, DeFi Run — L2 bridge on Base Mainnet, wZION token live' },
  },
  'v3.0.0': {
    tag: { cs: 'MAINNET READY', en: 'MAINNET READY' },
    description: { cs: 'V3 mainnet readiness — Docker, systemd, fee split, genesis freeze', en: 'V3 mainnet readiness — Docker, systemd, fee split, genesis freeze' },
  },
  'v2.9.9': {
    tag: { cs: 'PURE CODE', en: 'PURE CODE' },
    description: { cs: 'Pure Code linie — cleanup a migrační most směrem k V3', en: 'Pure Code line — cleanup + migration bridge toward V3' },
  },
  'v2.9.8': {
    tag: { cs: 'KANONICKÝ RUNTIME', en: 'CANONICAL RUNTIME' },
    description: { cs: 'Ekam Deeksha kanonická runtime sjednocovací linie', en: 'Ekam Deeksha canonical runtime unification line' },
  },
  'v2.9.7': {
    tag: { cs: 'PRE-MAINNET GATE', en: 'PRE-MAINNET GATE' },
    description: { cs: 'Stabilizační a dokumentační gate před kanonickou runtime linií', en: 'Stability and documentation gate before canonical runtime line' },
  },
  'v2.9.6': {
    tag: { cs: 'ZÁKLAD', en: 'BASELINE' },
    description: { cs: 'Protokolový baseline — architektura, ekonomika, migrace, konsenzus', en: 'Protocol baseline — architecture, economics, migration, consensus' },
  },
  'v2.9.5': {
    tag: { cs: 'ARCHIV', en: 'ARCHIVE' },
    description: { cs: 'Native Awakening — kompletní Rust přepis a Fair Launch', en: 'Native Awakening — complete Rust rewrite, Fair Launch' },
  },
  'v2.9': {
    tag: { cs: 'LEGACY', en: 'LEGACY' },
    description: { cs: 'Quantum Leap — první multi-node síť a Python éra', en: 'Quantum Leap — first multi-node network, Python era' },
  },
  'v2.8.x': {
    tag: { cs: 'LEGACY', en: 'LEGACY' },
    description: { cs: 'Python éra — v2.8.5 genesis a v2.8.9 Polish Sprint', en: 'Python era — v2.8.5 genesis, v2.8.9 Polish Sprint' },
  },
};

export const categoryTitles: Record<string, LocalizedText> = {
  'v320-overview': { cs: 'Přehled', en: 'Overview' },
  'v320-security': { cs: 'Bezpečnost', en: 'Security' },
  'v320-dex': { cs: 'ZionDEX', en: 'ZionDEX' },
  'v320-roadmap': { cs: 'Roadmap', en: 'Roadmap' },
  'v301-overview': { cs: 'Přehled', en: 'Overview' },
  'v300-overview': { cs: 'Přehled', en: 'Overview' },
  'v299-overview': { cs: 'Přehled', en: 'Overview' },
  'v298-overview': { cs: 'Přehled', en: 'Overview' },
  'v297-overview': { cs: 'Přehled', en: 'Overview' },
  'v296-overview': { cs: 'Přehled', en: 'Overview' },
  'v296-layers': { cs: '6vrstvá architektura', en: '6-Layer Architecture' },
  'v296-economics': { cs: 'Ekonomika', en: 'Economics' },
  'v296-architecture': { cs: 'Protokol', en: 'Protocol' },
  'v296-mainnet': { cs: 'Launch readiness', en: 'Launch Readiness' },
  'v295-overview': { cs: 'Přehled', en: 'Overview' },
  'v295-protocol': { cs: 'Protokol', en: 'Protocol' },
  'v295-whitepaper': { cs: 'Whitepaper', en: 'Whitepaper' },
  'v29-overview': { cs: 'Přehled', en: 'Overview' },
  'v28-overview': { cs: 'Přehled', en: 'Overview' },
  'v28-archive': { cs: 'Archiv', en: 'Archive' },
};

export const sectionTitles: Record<string, LocalizedText> = {
  'live-ops': { cs: 'Mainnet operace', en: 'Mainnet Ops' },
  'release-lineage': { cs: 'Release lineage', en: 'Release Lineage' },
  'whitepaper': { cs: 'Whitepaper', en: 'Whitepaper' },
  'architecture': { cs: 'Architektura', en: 'Architecture' },
  'mainnet': { cs: 'Veřejná launch cesta', en: 'Public Launch Path' },
  'zion-cli': { cs: 'ZION CLI', en: 'ZION CLI' },
  'books': { cs: 'Knihy', en: 'Books' },
  'listing': { cs: 'Listing / CoinGecko', en: 'Listing / CoinGecko' },
  'ai-native': { cs: 'AI / výzkumný archiv', en: 'AI / Research Archive' },
  'lumi-language': { cs: 'Lumi — jazyk světla', en: 'Lumi — Light Language' },
  'l6-issobella': { cs: 'L6 — Issobella', en: 'L6 — Issobella' },
  'legal': { cs: 'Právní rámec', en: 'Legal' },
};

export const docTitles: Record<string, LocalizedText> = {
  'v320-readme': { cs: 'v3.2.0 — přehled', en: 'v3.2.0 Overview' },
  'v320-audit': { cs: 'Bezpečnostní audit 3.2', en: 'Security Audit 3.2' },
  'v320-ziondex': { cs: 'ZionDEX — průvodce', en: 'ZionDEX User Guide' },
  'v320-roadmap': { cs: 'Roadmap 3.2 → 3.3', en: 'Roadmap 3.2 → 3.3' },
  'v301-readme': { cs: 'v3.0.1 Genesis — historický přehled', en: 'v3.0.1 Genesis Overview (historical)' },
  'mainnet-public-release': { cs: 'Veřejný release — jak použít', en: 'Public Release — How to Use' },
  'v301-launch-sequence': { cs: 'MainNet Launch sekvence', en: 'MainNet Launch Sequence' },
  'v301-status': { cs: 'v3.0.1 Stav a KAT vektory', en: 'v3.0.1 Status & KAT Vectors' },
  'v301-roadmap': { cs: 'v3.0.1 Roadmap', en: 'v3.0.1 Roadmap' },
  'v300-readme': { cs: 'v3.0.0 MainNet Readiness', en: 'v3.0.0 MainNet Readiness' },
  'v300-upgrade-plan': { cs: 'Plán upgradu na v3.0.1', en: 'Upgrade v3.0.1 Plan' },
  'v300-edge-primary': { cs: 'Edge Primary topologie', en: 'Edge Primary Topology' },
  'v299-readme': { cs: 'Přehled v2.9.9 Pure Code', en: 'v2.9.9 Pure Code Overview' },
  'v299-changelog': { cs: 'Changelog v2.9.9', en: 'Changelog v2.9.9' },
  'v299-migration': { cs: 'Migrace v2.9.9 -> V3', en: 'Migration v2.9.9 -> V3' },
  'v298-readme': { cs: 'Přehled v2.9.8 Ekam', en: 'v2.9.8 Ekam Overview' },
  'v298-changelog': { cs: 'Changelog v2.9.8', en: 'Changelog v2.9.8' },
  'v298-runtime': { cs: 'Runtime poznámky v2.9.8', en: 'Runtime Notes v2.9.8' },
  'v297-readme': { cs: 'v2.9.7 Pre-MainNet Gate', en: 'v2.9.7 Pre-MainNet Gate' },
  'v297-changelog': { cs: 'Changelog v2.9.7', en: 'Changelog v2.9.7' },
  'v296-readme': { cs: 'Přehled v2.9.6', en: 'v2.9.6 Overview' },
  'v296-changelog': { cs: 'Co je nového', en: 'What Changed' },
  'v296-migration': { cs: 'Migrace z v2.9.5', en: 'Migration from v2.9.5' },
  'v296-layer-architecture': { cs: 'On the Star — 6 vrstev', en: 'On the Star — 6 Layers' },
  'v296-tokenomics': { cs: 'Tokenomika — Decade Decay (Model A)', en: 'Tokenomics — Decade Decay (Model A)' },
  'v296-consensus': { cs: 'Změny konsenzu', en: 'Consensus Changes' },
  'v296-p2p': { cs: 'P2P síťový protokol', en: 'P2P Network Protocol' },
  'v296-launch-plan': { cs: 'Launch plán', en: 'Launch Plan' },
  'v296-audit': { cs: 'Bezpečnostní audit', en: 'Security Audit' },
  'v295-readme': { cs: 'Přehled ZION v2.9.5', en: 'ZION v2.9.5 Overview' },
  'v295-changelog': { cs: 'Changelog od v2.9', en: 'Changelog from v2.9' },
  'v295-tokenomics': { cs: 'Tokenomika a ekonomický model', en: 'Tokenomics & Economic Model' },
  'v295-consensus': { cs: 'Cosmic Harmony v3', en: 'Cosmic Harmony v3' },
  'whitepaper-295-full': { cs: 'Whitepaper v2.9.5 (kompletní)', en: 'Whitepaper v2.9.5 (full)' },
  'whitepaper-lite': { cs: 'Whitepaper Lite', en: 'Whitepaper Lite' },
  'v29-readme': { cs: 'ZION v2.9 — Quantum Leap', en: 'ZION v2.9 — Quantum Leap' },
  'v29-origins': { cs: 'Počátky — 26. září 2025', en: 'Origins — Sep 26, 2025' },
  'v28-readme': { cs: 'Legacy éra v2.8.x', en: 'v2.8.x Legacy Era' },
  'whitepaper-285': { cs: 'Whitepaper v2.8.5', en: 'Whitepaper v2.8.5' },
  'cosmic-map-public': { cs: 'Cosmic Map (veřejná edice)', en: 'Cosmic Map (public edition)' },
  'live-index': { cs: 'Live Index: snapshot a verze', en: 'Live Index: snapshot + versions' },
  'live-p2p': { cs: 'P2P topologie', en: 'P2P Topology' },
  'live-mainnet': { cs: 'Launch cesta', en: 'Launch Path' },
  'v297-gate': { cs: 'v2.9.7 — Pre-MainNet Gate', en: 'v2.9.7 — Pre-MainNet Gate' },
  'v298-canonical': { cs: 'v2.9.8 — Ekam kanonický runtime', en: 'v2.9.8 — Ekam canonical runtime' },
  'v299-purecode': { cs: 'v2.9.9 — Pure Code linie', en: 'v2.9.9 — Pure Code line' },
  'wp-v3-mainnet': { cs: 'Whitepaper V3 Mainnet (EN)', en: 'V3 Mainnet Whitepaper (EN)' },
  'wp-lite': { cs: 'Whitepaper Lite (CZ shrnutí)', en: 'Whitepaper Lite (CZ summary)' },
  'arch-overview': { cs: '6vrstvý stack', en: '6-Layer Stack' },
  'arch-consensus': { cs: 'Roadmapa CHv3 -> CHv4', en: 'CHv3 -> CHv4 Roadmap' },
  'mainnet-plan': { cs: 'Veřejná launch cesta', en: 'Public Launch Path' },
  'cli-quickstart': { cs: 'ZION CLI rychly start (10 minut)', en: 'ZION CLI Quickstart (10 min)' },
  'cli-guide': { cs: 'ZION CLI průvodce', en: 'ZION CLI Guide' },
  'cli-glossary': { cs: 'ZION CLI slovnicek pojmu', en: 'ZION CLI Glossary' },
  'cli-faq': { cs: 'ZION CLI - casté dotazy', en: 'ZION CLI FAQ' },
  'cli-reference': { cs: 'ZION CLI referencní přehled', en: 'ZION CLI Reference' },
  'cli-troubleshooting': { cs: 'ZION CLI - řešení problémů', en: 'ZION CLI Troubleshooting' },
  'cli-deploy-playbook': { cs: 'ZION CLI - deploy playbook', en: 'ZION CLI Deploy Playbook' },
  'roadmap-lite': { cs: 'Roadmap Lite — launch readiness', en: 'Roadmap Lite — launch readiness' },
  'mainnet-checklist': { cs: 'Checklist launch gate (archiv)', en: 'Public Launch Gate Checklist (archive)' },
  'book-genesis': { cs: 'Genesis — Kniha probuzení', en: 'Genesis — Book of Awakening' },
  'book-ekam-full': { cs: 'Ekam Deeksha — kompletní kniha', en: 'Ekam Deeksha — Full Book' },
  'book-qr': { cs: 'Kvantová revoluce', en: 'Quantum Revolution' },
  'book-terranova': { cs: 'Terra Nova — Zlatý Kompas Nové Země', en: 'Terra Nova — Golden Compass of the New Earth' },
  'book-ekam-ucebnice': { cs: 'Učebnice Ekam (historie)', en: 'Ekam Study Book (history)' },
  'coingecko-checklist': { cs: 'CoinGecko checklist', en: 'CoinGecko Checklist' },
  'ai-native-vision': { cs: 'AI Native — vize a manifest', en: 'AI Native — Vision & Manifest' },
  'ai-native-cudax': { cs: 'NVIDIA CUDA-X integrace', en: 'NVIDIA CUDA-X Integration' },
  'ai-native-ncl': { cs: 'NCL — Neural Compute', en: 'NCL — Neural Compute' },
  'ai-native-oasis': { cs: 'L4 Oasis — úrovně vědomí', en: 'L4 Oasis — Consciousness Levels' },
  'lumi-overview': { cs: 'Lumi — přehled jazyka světla', en: 'Lumi — Light Language Overview' },
  'lumi-phonetics': { cs: 'Fonetika a tóny', en: 'Phonetics & Tones' },
  'lumi-core-108': { cs: 'Jádrový slovník 108', en: 'Core Dictionary 108' },
  'lumi-light-tones': { cs: 'Light Language tóny', en: 'Light Language Tones' },
  'legal-disclaimer': { cs: 'Disclaimer', en: 'Disclaimer' },
  'legal-risk': { cs: 'Risk Disclosure', en: 'Risk Disclosure' },
  'legal-token': { cs: 'Token Not Security', en: 'Token Not Security' },
  'l6-readme': { cs: 'L6 — přehled', en: 'L6 Overview' },
  'l6-architecture': { cs: 'Architektura stanice', en: 'Station Architecture' },
  'l6-quantum-motor': { cs: 'Kvantový motor', en: 'Quantum Motor' },
  'l6-artificial-gravity': { cs: 'Umělá gravitace', en: 'Artificial Gravity' },
  'l6-human-factors': { cs: 'Lidské faktory', en: 'Human Factors' },
  'l6-history': { cs: 'Historie vesmírných stanic', en: 'Space Station History' },
  'l6-ground-station': { cs: 'Pozemní stanice Kostarika', en: 'Costa Rica Ground Station' },
  ...Object.fromEntries(
    MAITREYA_CHAPTERS.map((c) => [
      `book-maitreya-${c.slug}`,
      { cs: `${c.num.cs} — ${c.title.cs}`, en: `${c.num.en} — ${c.title.en}` },
    ]),
  ),
  ...Object.fromEntries(
    NIRVANA_CHAPTERS.map((c) => [
      `book-nirvana-${c.slug}`,
      { cs: `Nirvana · ${c.num.cs} — ${c.title.cs}`, en: `Nirvana · ${c.num.en} — ${c.title.en}` },
    ]),
  ),
  ...Object.fromEntries(
    SURTA_CHAPTERS.map((c) => [
      `book-surta-${c.slug}`,
      { cs: `Surta Srdce · ${c.num.cs} — ${c.title.cs}`, en: `Surta Srdce · ${c.num.en} — ${c.title.en}` },
    ]),
  ),
  ...Object.fromEntries(
    KRAL_CHAPTERS.map((c) => [
      `book-kral-${c.slug}`,
      { cs: `Království srdce · ${c.num.cs} — ${c.title.cs}`, en: `Kingdom of the Heart · ${c.num.en} — ${c.title.en}` },
    ]),
  ),
};

export const versions: Version[] = [
  {
    id: 'v3.2.0',
    label: 'v3.2.0',
    tag: 'CURRENT',
    tagColor: 'text-zion-gold border-zion-gold/30 bg-zion-gold/10',
    description: 'Current public line — v3.2.0 "One Love" Mainnet Alpha, DEX and bridge deployed',
    categories: [
      {
        id: 'v320-overview',
        title: 'Overview',
        icon: Rocket,
        docs: [
          { id: 'v320-readme', title: 'v3.2.0 Overview', file: 'v3.2.0/README.md' },
        ]
      },
      {
        id: 'v320-security',
        title: 'Security',
        icon: Shield,
        docs: [
          { id: 'v320-audit', title: 'Security Audit 3.2', file: 'v3.2.0/security-audit.md' },
        ]
      },
      {
        id: 'v320-dex',
        title: 'ZionDEX',
        icon: Coins,
        docs: [
          { id: 'v320-ziondex', title: 'ZionDEX User Guide', file: 'v3.2.0/ziondex.md' },
        ]
      },
      {
        id: 'v320-roadmap',
        title: 'Roadmap',
        icon: Map,
        docs: [
          { id: 'v320-roadmap', title: 'Roadmap 3.2 → 3.3', file: 'v3.2.0/roadmap.md' },
        ]
      },
    ]
  },
  {
    id: 'v3.0.6',
    label: 'v3.0.6',
    tag: 'PREVIOUS',
    tagColor: 'text-zion-cyan border-zion-cyan/30 bg-zion-cyan/10',
    description: 'Trinity / Mainnet Beta — AuxPoW triple plan, last beta line before One Love',
    categories: [
      {
        id: 'v301-overview',
        title: 'Overview',
        icon: Rocket,
        docs: [
          { id: 'v301-readme', title: 'v3.0.6 Current Line Overview', file: 'v3.0.1/README.md' },
          { id: 'v301-launch-sequence', title: 'MainNet Launch Sequence', file: 'v3.0.1/MAINNET_LAUNCH_SEQUENCE.md' },
          { id: 'v301-status', title: 'v3.0.6 Status & Runtime Track', file: 'v3.0.1/StatusV3.md' },
          { id: 'v301-roadmap', title: 'v3.0.6 Roadmap Track', file: 'v3.0.1/ROADMAP.md' },
        ]
      },
    ]
  },
  {
    id: 'v3.0.0',
    label: 'v3.0.0',
    tag: 'MAINNET READY',
    tagColor: 'text-zion-cyan border-zion-cyan/30 bg-zion-cyan/10',
    description: 'V3 mainnet readiness — Docker, systemd, fee split, genesis freeze',
    categories: [
      {
        id: 'v300-overview',
        title: 'Overview',
        icon: Rocket,
        docs: [
          { id: 'v300-readme', title: 'v3.0.0 MainNet Readiness', file: 'v3.0.0/README.md' },
          { id: 'v300-upgrade-plan', title: 'Upgrade v3.0.1 Plan', file: 'v3.0.0/UPGRADE_3.0.1_PLAN.md' },
          { id: 'v300-edge-primary', title: 'Edge Primary Topology', file: 'v3.0.0/EdgePrimary.md' },
        ]
      },
    ]
  },
];

export const sections: Section[] = [
  {
    id: 'live-ops',
    title: 'Mainnet Ops',
    icon: Globe,
    accentText: 'text-zion-cyan',
    accentBorder: 'border-zion-cyan/30',
    docs: [
      { id: 'live-index', title: 'Live Index: snapshot + verze', file: 'index.md' },
      { id: 'live-mainnet', title: 'Genesis 3.0.6 Status', file: 'mainnet/README.md' },
      { id: 'v301-launch-sequence', title: 'MainNet Launch Sequence', file: 'v3.0.1/MAINNET_LAUNCH_SEQUENCE.md' },
    ],
  },
  {
    id: 'release-lineage',
    title: 'Release Lineage',
    icon: GitBranch,
    accentText: 'text-zion-gold',
    accentBorder: 'border-zion-gold/30',
    docs: [
      { id: 'v301-genesis', title: 'v3.0.6 — Current Public Line', file: 'v3.0.1/README.md' },
      { id: 'mainnet-public-release', title: 'Public Release — How to Use', file: 'mainnet/public-release.md' },
      { id: 'v300-readiness', title: 'v3.0.0 — MainNet Ready', file: 'v3.0.0/README.md' },
      { id: 'v299-purecode', title: 'v2.9.9 — Pure Code line', file: 'v2.9.9/README.md' },
      { id: 'v298-canonical', title: 'v2.9.8 — Ekam canonical runtime', file: 'v2.9.8/README.md' },
      { id: 'v297-gate', title: 'v2.9.7 — Pre-MainNet Gate', file: 'v2.9.7/README.md' },
    ],
  },
  {
    id: 'whitepaper',
    title: 'WhitePaper',
    icon: FileText,
    accentText: 'text-zion-gold',
    accentBorder: 'border-zion-gold/30',
    docs: [
      { id: 'wp-v3-mainnet', title: 'Whitepaper V3 Mainnet (EN)', file: 'whitepaper/ZION_V3_Whitepaper.md' },
      { id: 'wp-lite', title: 'Whitepaper Lite (CS summary)', file: 'whitepaper-lite.md' },
    ],
  },
  {
    id: 'books',
    title: 'Books',
    icon: Book,
    accentText: 'text-zion-gold',
    accentBorder: 'border-zion-gold/30',
    docs: [
      ...MAITREYA_CHAPTERS.map((c) => ({
        id: `book-maitreya-${c.slug}`,
        title: c.title.cs,
        file: `books/maitreya/kapitoly/${c.slug}.md`,
      })),
      ...NIRVANA_CHAPTERS.map((c) => ({
        id: `book-nirvana-${c.slug}`,
        title: c.title.cs,
        file: `books/nirvana/kapitoly/${c.slug}.md`,
      })),
      ...SURTA_CHAPTERS.map((c) => ({
        id: `book-surta-${c.slug}`,
        title: c.title.cs,
        file: `books/surta-srdce/kapitoly/${c.slug}.md`,
      })),
      ...KRAL_CHAPTERS.map((c) => ({
        id: `book-kral-${c.slug}`,
        title: c.title.cs,
        file: `books/kralovstvi-srdce/kapitoly/${c.slug}.md`,
      })),
      { id: 'book-genesis', title: 'Genesis — Kniha probuzení', file: 'mainnet/genesis-book.md' },
      { id: 'book-ekam-full', title: 'Ekam Deeksha — kompletní kniha', file: 'books/ekam-deeksha/BOOK-FULL-VERSION.md' },
      { id: 'book-ekam-ucebnice', title: 'Učebnice Ekam (historie)', file: 'books/ekam-deeksha/UCEBNICE-FULL-VERSION.md' },
      { id: 'book-qr', title: 'Kvantová revoluce', file: 'books/quantum-revolution.md' },
    ],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    icon: Cpu,
    accentText: 'text-zion-cyan',
    accentBorder: 'border-zion-cyan/30',
    docs: [
      { id: 'arch-overview', title: '6-Layer Stack', file: 'architecture/README.md' },
      { id: 'arch-consensus', title: 'CHv3 → CHv4 Roadmap', file: 'architecture/consensus.md' },
    ],
  },
  {
    id: 'mainnet',
    title: 'Public Launch Path',
    icon: Rocket,
    accentText: 'text-zion-cyan',
    accentBorder: 'border-zion-cyan/30',
    docs: [
      { id: 'mainnet-plan', title: 'Public Launch Plan 2026', file: 'mainnet/README.md' },
      { id: 'mainnet-genesis-book', title: 'Genesis Book of Awakening', file: 'mainnet/genesis-book.md' },
      { id: 'v301-status', title: 'v3.0.6 Status & Runtime Track', file: 'v3.0.1/StatusV3.md' },
    ],
  },
  {
    id: 'listing',
    title: 'Listing / CoinGecko',
    icon: Map,
    accentText: 'text-zion-purple',
    accentBorder: 'border-zion-purple/30',
    docs: [
      { id: 'coingecko-checklist', title: 'CoinGecko Checklist', file: 'mainnet/coingecko.md' },
    ],
  },
  {
    id: 'ai-native',
    title: 'AI Native',
    icon: Sparkles,
    accentText: 'text-zion-purple',
    accentBorder: 'border-zion-purple/30',
    docs: [
      { id: 'ai-native-vision', title: 'AI Native — Vize & Manifest', file: 'ai-native/README.md' },
      { id: 'ai-native-cudax', title: 'NVIDIA CUDA-X integrace', file: 'ai-native/cuda-x.md' },
      { id: 'ai-native-ncl', title: 'NCL — Neural Compute', file: 'ai-native/ncl.md' },
      { id: 'ai-native-oasis', title: 'L4 Oasis — Consciousness Levels', file: 'ai-native/oasis.md' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal',
    icon: AlertTriangle,
    accentText: 'text-zion-gold',
    accentBorder: 'border-zion-gold/30',
    docs: [
      { id: 'legal-disclaimer', title: 'Právní disclaimer', file: 'legal/legal-disclaimer.md' },
      { id: 'legal-terms', title: 'Podmínky použití', file: 'legal/terms-of-use.md' },
      { id: 'legal-privacy', title: 'Zásady soukromí', file: 'legal/privacy-policy.md' },
      { id: 'legal-jurisdiction', title: 'Jurisdikce a compliance', file: 'legal/jurisdiction.md' },
      { id: 'legal-token', title: 'Token disclosure', file: 'legal/token-disclosure.md' },
      { id: 'legal-risk', title: 'Risk Disclosure (starý)', file: 'legal/risk.md' },
    ],
  },
  {
    id: 'lumi-language',
    title: 'Lumi — Light Language',
    icon: Sparkles,
    accentText: 'text-zion-gold',
    accentBorder: 'border-zion-gold/30',
    docs: [
      { id: 'lumi-overview', title: 'Lumi — Light Language Overview', file: 'lumi/README.md' },
      { id: 'lumi-phonetics', title: 'Phonetics & Tones', file: 'lumi/phonetics.md' },
      { id: 'lumi-core-108', title: 'Core Dictionary 108', file: 'lumi/core-108.md' },
      { id: 'lumi-light-tones', title: 'Light Language Tones', file: 'lumi/light-tones.md' },
    ],
  },
  {
    id: 'l6-issobella',
    title: 'L6 — Issobella',
    icon: Rocket,
    accentText: 'text-zion-purple',
    accentBorder: 'border-zion-purple/30',
    docs: [
      { id: 'l6-readme', title: 'L6 — přehled', file: 'l6/README.md' },
      { id: 'l6-architecture', title: 'Architektura stanice', file: 'l6/Architektura.md' },
      { id: 'l6-quantum-motor', title: 'Kvantový motor', file: 'l6/Kvantovy_Motor.md' },
      { id: 'l6-artificial-gravity', title: 'Umělá gravitace', file: 'l6/Umela_Gravitace.md' },
      { id: 'l6-human-factors', title: 'Lidské faktory', file: 'l6/Lidske_Faktory.md' },
      { id: 'l6-history', title: 'Historie vesmírných stanic', file: 'l6/Histori.md' },
      { id: 'l6-ground-station', title: 'Pozemní stanice Kostarika', file: 'l6/Pozemni_Stanice_Kostarika.md' },
    ],
  },
];

/* ── Derived lookup maps ──────────────────────────────── */

export const ALL_DOCS: Doc[] = [
  ...versions.flatMap((v) => v.categories).flatMap((cat) => cat.docs),
  ...sections.flatMap((s) => s.docs),
];

/** public-docs file path → /docs#doc-id (first registration wins). */
export const DOC_FILE_TO_ID: Record<string, string> = Object.fromEntries(
  (() => {
    const seen = new Set<string>();
    const out: [string, string][] = [];
    for (const d of ALL_DOCS) {
      if (d.file === '__philosophy__' || d.href || seen.has(d.file)) continue;
      seen.add(d.file);
      out.push([d.file, d.id]);
    }
    return out;
  })(),
);

export const DOC_IDS = new Set(ALL_DOCS.map((d) => d.id));

/** Hash aliases — corpus links pointing at section ids or legacy anchors. */
export const DOC_HASH_ALIASES: Record<string, string> = {
  mainnet: 'mainnet-plan',
  'book-maitreya': `book-maitreya-${MAITREYA_CHAPTERS[0].slug}`,
  'book-nirvana': `book-nirvana-${NIRVANA_CHAPTERS[0].slug}`,
  'book-surta': `book-surta-${SURTA_CHAPTERS[0].slug}`,
  'book-surta-srdce': `book-surta-${SURTA_CHAPTERS[0].slug}`,
  'surta-srdce': `book-surta-${SURTA_CHAPTERS[0].slug}`,
  'book-kralovstvi': `book-kral-${KRAL_CHAPTERS[0].slug}`,
  'kralovstvi-srdce': `book-kral-${KRAL_CHAPTERS[0].slug}`,
  whitepaper: 'wp-v3-mainnet',
  books: `book-maitreya-${MAITREYA_CHAPTERS[0].slug}`,
};
