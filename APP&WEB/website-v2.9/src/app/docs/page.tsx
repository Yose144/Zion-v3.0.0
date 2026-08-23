'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { Book, BookOpen, Code2, Rocket, Shield, Zap, FileText, Github, ExternalLink, ChevronRight, ChevronDown, Sparkles, Menu, X, Infinity, Users, HelpCircle, Globe, GitBranch, Lock, Layers, Coins, Cpu, Map, AlertTriangle, Building2, LayoutList } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr, tx } from '@/lib/translations';

const PhilosophyContent = dynamic(() => import('@/components/docs/PhilosophyContent'));
const DocMarkdownArticle = dynamic(() => import('@/components/docs/DocMarkdownArticle'));

/* ═══════════════════════════════════════════
   Version Tree — each version is a "branch"
   with its own categories & docs
   ═══════════════════════════════════════════ */

interface Doc {
  id: string;
  title: string;
  file: string;
  href?: string;
}

interface Category {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  docs: Doc[];
}

interface Version {
  id: string;
  label: string;
  tag: string;
  tagColor: string;
  description: string;
  categories: Category[];
}

type LocalizedText = { cs: string; en: string };

const docsPageCopy = {
  badge: { cs: 'Znalostní báze', en: 'Knowledge Base' },
  overviewNotice: {
    cs: 'Aktuální veřejná linka je v3.2.0 "One Love" Mainnet Stable. Decimal fork 1e12→1e6 (6-decimal flowers) dokončen. Síť běží na novém genesis hash po hard resetu ze srpna 2026 — viz hlavní dokument [Mainnet Status](#mainnet). Pool aktivní, mining live, 5/5 služeb green. Veřejný launch zůstává 31. prosince 2026.',
    en: 'The current public line is v3.2.0 "One Love" Mainnet Stable. Decimal fork 1e12→1e6 (6-decimal flowers) complete. The network is running on a new genesis hash after the August 2026 hard reset — see the main document [Mainnet Status](#mainnet). Pool active, mining live, 5/5 services green. Public launch remains 31 December 2026.',
  },
  githubLabel: { cs: 'GitHub', en: 'GitHub' },
  apiHealthLabel: { cs: 'Zdraví API', en: 'API Health' },
} as const satisfies Record<string, LocalizedText>;

const versionText: Record<string, { tag?: LocalizedText; description?: LocalizedText }> = {
  'v3.2.0': {
    tag: { cs: 'AKTUÁLNÍ', en: 'CURRENT' },
    description: { cs: 'Current public line — v3.2.0 "One Love" Mainnet Stable, nový genesis hash po srpnovém hard resetu (kompletní rotace klíčů), 5/5 služeb active, kanonický Ekam Deeksha PoW', en: 'Current public line — v3.2.0 "One Love" Mainnet Stable, new genesis hash after the August hard reset (complete key rotation), 5/5 services active, canonical Ekam Deeksha PoW' },
  },
  'v3.1.0': {
    tag: { cs: 'PŘEDCHOZÍ', en: 'PREVIOUS' },
    description: { cs: 'Mainnet Alpha — první produkční cutover, Terminal Miner release, OASIS preview', en: 'Mainnet Alpha — first production cutover, Terminal Miner release, OASIS preview' },
  },
  'v3.0.6': {
    tag: { cs: 'PŘEDCHOZÍ', en: 'PREVIOUS' },
    description: { cs: 'Trinity / Mainnet Beta — poslední stabilní vydání před Mainnet Stable', en: 'Trinity / Mainnet Beta — last stable release before Mainnet Stable' },
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

const categoryTitles: Record<string, LocalizedText> = {
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

const sectionTitles: Record<string, LocalizedText> = {
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
  'legal': { cs: 'Právní rámec', en: 'Legal' },
};

const docTitles: Record<string, LocalizedText> = {
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
};

function resolveLabel(value: string | LocalizedText, lang: 'cs' | 'en') {
  return typeof value === 'string' ? value : tx(value, lang);
}

function resolveMappedLabel<T extends string>(mapping: Record<string, LocalizedText>, key: string, fallback: T, lang: 'cs' | 'en') {
  return mapping[key] ? tx(mapping[key], lang) : fallback;
}

const versions: Version[] = [
  {
    id: 'v3.0.6',
    label: 'v3.0.6',
    tag: 'CURRENT',
    tagColor: 'text-zion-gold border-zion-gold/30 bg-zion-gold/10',
    description: 'Current public line — MainNet Edge server live, pool active, mining running',
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

/* ═══════════════════════════════════════════
   Resources — static sections (non-versioned)
   ═══════════════════════════════════════════ */

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentText: string;
  accentBorder: string;
  docs: Doc[];
}

const sections: Section[] = [
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
];

function findCategoryIdByDoc(docId: string): string | null {
  const category = versions
    .flatMap((version) => version.categories)
    .find((cat) => cat.docs.some((doc) => doc.id === docId));
  if (category) return category.id;
  const section = sections.find(s => s.docs.some(d => d.id === docId));
  return section?.id ?? null;
}

export default function DocsPage() {
  const [activeVersion, setActiveVersion] = useState('v3.0.6');
  const [selectedDoc, setSelectedDoc] = useState('live-index');
  const [activeCategory, setActiveCategory] = useState('live-ops');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({ 'v3.0.6': true, 'v3.0.0': false, 'v2.9.9': false, 'v2.9.8': false, 'v2.9.7': false, 'v2.9.6': false, 'v2.9.5': false, 'v2.9': false, 'v2.8.x': false, 'live-ops': true, 'ai-native': true, 'whitepaper': false, 'architecture': false, 'mainnet': false, 'listing': false, 'legal': false, 'lumi-language': false });
  const [sidebarTab, setSidebarTab] = useState<'resources' | 'history'>('resources');
  const { lang } = useLang();
  const currentLang = lang === 'cs' ? 'cs' : 'en';
  const primaryVersions = versions.filter((version) => version.id === 'v3.0.6');

  // Get current version data
  const currentVersion = versions.find(v => v.id === activeVersion) || versions[0];
  const docCategories = currentVersion.categories;

  // Find current doc across all versions AND sections
  const currentDoc = [
    ...versions.flatMap(v => v.categories).flatMap(cat => cat.docs),
    ...sections.flatMap(s => s.docs),
  ].find(doc => doc.id === selectedDoc);

  // Check if selected doc belongs to a resource section (not versioned)
  const currentSection = sections.find(s => s.docs.some(d => d.id === selectedDoc));
  const getVersionTag = (version: Version) => resolveLabel(versionText[version.id]?.tag ?? version.tag, currentLang);
  const getVersionDescription = (version: Version) => resolveLabel(versionText[version.id]?.description ?? version.description, currentLang);
  const getCategoryTitle = (category: Category) => resolveMappedLabel(categoryTitles, category.id, category.title, currentLang);
  const getSectionTitle = (section: Section) => resolveMappedLabel(sectionTitles, section.id, section.title, currentLang);
  const getDocTitle = (doc: Doc) => resolveMappedLabel(docTitles, doc.id, doc.title, currentLang);
  const currentDocTitle = currentDoc ? getDocTitle(currentDoc) : '';
  const currentSectionTitle = currentSection ? getSectionTitle(currentSection) : '';
  const currentCategoryTitle = currentDoc && !currentSection
    ? getCategoryTitle(docCategories.find(cat => cat.docs.some(d => d.id === currentDoc.id)) || docCategories[0])
    : '';

  // Sync with URL hash
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setSelectedDoc(hash);
      const categoryId = findCategoryIdByDoc(hash);
      if (categoryId) {
        setActiveCategory(categoryId);
      }
    }

    const onHashChange = () => {
      const id = window.location.hash.replace('#', '');
      if (id) {
        setSelectedDoc(id);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Update hash when doc changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentHash = window.location.hash.replace('#', '');
    if (selectedDoc && currentHash !== selectedDoc) {
      window.history.replaceState(null, '', `#${selectedDoc}`);
    }
  }, [selectedDoc]);

  // Load markdown content
  useEffect(() => {
    let isCancelled = false;

    const loadTextFromCandidates = async (paths: string[]) => {
      for (const path of paths) {
        const response = await fetch(`/docs/${path}`);
        if (response.ok) {
          return response.text();
        }
      }

      throw new Error(`Failed to load ${paths.join(', ')}`);
    };

    async function loadDoc() {
      if (!currentDoc) return;
      // Philosophy is a TSX component, not markdown — skip fetch
      if (currentDoc.file === '__philosophy__') {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const candidateFiles = [`${lang}/${currentDoc.file}`, currentDoc.file];
        const text = await loadTextFromCandidates(candidateFiles);
        if (!isCancelled) {
          setContent(text);
        }
      } catch (err) {
        console.error('Failed to load document:', err);
        if (!isCancelled) {
          setContent(lang === 'cs'
            ? `# Dokument neni dostupny\n\nDokument **${currentDocTitle}** (${currentDoc?.file}) momentalne neni k dispozici.\n\nZkuste to prosim pozdeji nebo vyberte jiny dokument z navigace.`
            : `# Document Not Available\n\nThe document **${currentDocTitle}** (${currentDoc?.file}) is currently not available.\n\nPlease check back later or try another document from the navigation.`);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [selectedDoc, currentDoc, currentDocTitle, lang]);

  const handleDocSelect = (docId: string, categoryId: string, versionId: string) => {
    // Check if doc has a direct href — navigate away instead of loading markdown
    const allDocs = [
      ...versions.flatMap(v => v.categories).flatMap(cat => cat.docs),
      ...sections.flatMap(s => s.docs),
    ];
    const targetDoc = allDocs.find(d => d.id === docId);
    if (targetDoc?.href) {
      window.location.href = targetDoc.href;
      return;
    }
    setSelectedDoc(docId);
    setActiveCategory(categoryId);
    setActiveVersion(versionId);
    setExpandedVersions(prev => ({ ...prev, [versionId]: true }));
  };

  const toggleVersion = (versionId: string) => {
    setExpandedVersions(prev => ({ ...prev, [versionId]: !prev[versionId] }));
  };

  return (
    <div className="">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-white/10 bg-linear-to-b from-zion-cyan/10 via-transparent to-transparent">
        <div className="zion-container py-20 relative">
          <div
            className="zion-rainbow-card max-w-4xl mx-auto p-8 md:p-10 text-center"
            style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
          >
            <div className="zion-kicker mx-auto mb-6 w-fit border-zion-cyan/30 bg-zion-cyan/10 text-cyan-200">
              <BookOpen className="w-4 h-4 text-zion-cyan" />
              <span className="text-sm text-zion-cyan font-semibold">{tx(docsPageCopy.badge, currentLang)}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gradient">
              {tr('docs', 'title', lang)}
            </h1>
            <p className="text-xl text-gray-400 mb-4">
              {tr('docs', 'subtitle', lang)}
            </p>
            <div
              className="zion-rainbow-sub mx-auto mb-8 max-w-3xl px-5 py-4 text-left text-sm text-gray-300"
              style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
            >
              {tx(docsPageCopy.overviewNotice, currentLang)}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              {primaryVersions.map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveVersion(v.id);
                    setExpandedVersions(prev => ({ ...prev, [v.id]: true }));
                    const firstDoc = v.categories[0]?.docs[0];
                    if (firstDoc) {
                      setSelectedDoc(firstDoc.id);
                      setActiveCategory(v.categories[0].id);
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-mono font-semibold transition-all ${
                    activeVersion === v.id
                      ? 'zion-rainbow-sub text-zion-gold'
                      : 'rounded-lg border border-white/10 bg-black/40 text-gray-400 hover:border-white/20 hover:text-gray-300'
                  }`}
                  style={activeVersion === v.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {v.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${v.tagColor}`}>
                    {getVersionTag(v)}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://github.com/Zion-TerraNova"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                <Github className="w-5 h-5" />
                {tx(docsPageCopy.githubLabel, currentLang)}
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="/health"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-primary"
              >
                <Zap className="w-5 h-5 text-zion-cyan" />
                {tx(docsPageCopy.apiHealthLabel, currentLang)}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="zion-container py-12">
        {/* Mobile Navigation Toggle */}
        <div className="lg:hidden sticky top-20 z-30 mb-6">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 zion-rainbow-sub text-white transition-colors"
            style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="w-5 h-5 text-zion-cyan shrink-0" />
              <span className="font-semibold min-w-0 break-words">{currentVersion.label} — {getVersionDescription(currentVersion)}</span>
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <div className="mt-4 zion-rainbow-card p-4 space-y-3 max-h-[70vh] overflow-y-auto" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              {/* Resources / History tabs */}
              <div className="flex border-b border-white/10 mb-2">
                <button
                  onClick={() => setSidebarTab('resources')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'resources'
                      ? 'zion-rainbow-sub text-zion-cyan'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'resources' ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  {tr('docs', 'resources_tab', lang)}
                </button>
                <button
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'history'
                      ? 'zion-rainbow-sub text-zion-gold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'history' ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {tr('docs', 'history_tab', lang)}
                </button>
              </div>

              {sidebarTab === 'resources' ? (
                <div className="space-y-1">
                  {sections.map(section => {
                    const Icon = section.icon;
                    const isExpanded = expandedVersions[section.id] ?? false;
                    const hasActiveDoc = section.docs.some(d => d.id === selectedDoc);
                    return (
                      <div key={section.id}>
                        <button
                          onClick={() => toggleVersion(section.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                            hasActiveDoc
                              ? 'zion-rainbow-sub text-white'
                              : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          style={hasActiveDoc ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${section.accentText}`} />
                            <span className={`font-semibold ${hasActiveDoc ? 'text-white' : 'text-gray-400'}`}>
                              {getSectionTitle(section)}
                            </span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                          <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                            {section.docs.map(doc => (
                              <button
                                key={doc.id}
                                onClick={() => {
                                  if (doc.href) { window.location.href = doc.href; return; }
                                  setSelectedDoc(doc.id);
                                  setActiveCategory(section.id);
                                  setActiveVersion('v3.0.1');
                                  setMobileMenuOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 transition-all text-sm flex items-center gap-2 ${
                                  selectedDoc === doc.id
                                    ? 'zion-rainbow-sub text-zion-gold font-medium'
                                    : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-xs">{getDocTitle(doc)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {versions.map(version => {
                    const isExpanded = expandedVersions[version.id];
                    const isActiveVersion = activeVersion === version.id;
                    return (
                      <div key={version.id}>
                        <button
                          onClick={() => toggleVersion(version.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                            isActiveVersion
                              ? 'zion-rainbow-sub text-white'
                              : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          style={isActiveVersion ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <GitBranch className={`w-4 h-4 ${isActiveVersion ? 'text-zion-gold' : 'text-gray-500'}`} />
                            <span className={`font-mono font-semibold ${isActiveVersion ? 'text-white' : 'text-gray-400'}`}>
                              {version.label}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${version.tagColor}`}>
                              {getVersionTag(version)}
                            </span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                            {version.categories.map(category => {
                              const Icon = category.icon;
                              const isActiveCat = activeCategory === category.id && activeVersion === version.id;
                              return (
                                <div key={category.id}>
                                  <button
                                    onClick={() => { setActiveCategory(category.id); setActiveVersion(version.id); }}
                                    className={`w-full text-left px-3 py-2 transition-all text-sm ${
                                      isActiveCat
                                        ? 'zion-rainbow-sub text-zion-cyan'
                                        : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                    style={isActiveCat ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Icon className="w-4 h-4" />
                                      {getCategoryTitle(category)}
                                    </div>
                                  </button>

                                  {isActiveCat && (
                                    <div className="mt-1 ml-6 space-y-0.5 border-l border-zion-cyan/20 pl-3">
                                      {category.docs.map(doc => (
                                        <button
                                          key={doc.id}
                                          onClick={() => { handleDocSelect(doc.id, category.id, version.id); setMobileMenuOpen(false); }}
                                          className={`w-full text-left px-2 py-1.5 text-xs transition-all ${
                                            selectedDoc === doc.id
                                              ? 'zion-rainbow-sub text-zion-gold font-medium'
                                              : 'rounded text-gray-500 hover:text-gray-300'
                                          }`}
                                          style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                                        >
                                          {getDocTitle(doc)}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* ═══ Sidebar — Version Tree ═══ */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 zion-rainbow-card overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              {/* Sidebar Tab Switcher */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setSidebarTab('resources')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'resources'
                      ? 'zion-rainbow-sub text-zion-cyan'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'resources' ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  {tr('docs', 'resources_tab', lang)}
                </button>
                <button
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
                    sidebarTab === 'history'
                      ? 'zion-rainbow-sub text-zion-gold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  style={sidebarTab === 'history' ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {tr('docs', 'history_tab', lang)}
                </button>
              </div>

              {/* Scrollable nav area */}
              <nav className="px-3 pb-4 max-h-[calc(100vh-180px)] overflow-y-auto space-y-1 pt-2">
                {sidebarTab === 'resources' ? (
                  /* ── Resources Panel ── */
                  <div className="space-y-1">
                    {sections.map(section => {
                      const Icon = section.icon;
                      const isExpanded = expandedVersions[section.id] ?? false;
                      const hasActiveDoc = section.docs.some(d => d.id === selectedDoc);
                      return (
                        <div key={section.id}>
                          <button
                            onClick={() => toggleVersion(section.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                              hasActiveDoc
                                ? 'zion-rainbow-sub text-white'
                                : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                            style={hasActiveDoc ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${section.accentText}`} />
                              <span className={`font-semibold ${hasActiveDoc ? 'text-white' : 'text-gray-400'}`}>
                                {getSectionTitle(section)}
                              </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                              {section.docs.map(doc => (
                                <button
                                  key={doc.id}
                                  onClick={() => {
                                    if (doc.href) { window.location.href = doc.href; return; }
                                    setSelectedDoc(doc.id);
                                    setActiveCategory(section.id);
                                    setActiveVersion('v3.0.1');
                                  }}
                                  className={`w-full text-left px-3 py-2 transition-all text-sm flex items-center gap-2 ${
                                    selectedDoc === doc.id
                                      ? 'zion-rainbow-sub text-zion-gold font-medium'
                                      : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                  style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-xs">{getDocTitle(doc)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                /* ── Version Tree ── */
                <div className="space-y-1">
                {versions.map(version => {
                  const isExpanded = expandedVersions[version.id];
                  const isActiveVersion = activeVersion === version.id;

                  return (
                    <div key={version.id}>
                      {/* Version Branch Header */}
                      <button
                        onClick={() => toggleVersion(version.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 transition-all text-sm ${
                          isActiveVersion
                            ? 'zion-rainbow-sub text-white'
                            : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                        style={isActiveVersion ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <GitBranch className={`w-4 h-4 ${isActiveVersion ? 'text-zion-gold' : 'text-gray-500'}`} />
                          <span className={`font-mono font-semibold ${isActiveVersion ? 'text-white' : 'text-gray-400'}`}>
                            {version.label}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${version.tagColor}`}>
                            {getVersionTag(version)}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Expanded Category Tree */}
                      {isExpanded && (
                        <div className="ml-3 mt-1 border-l border-white/5 pl-2 space-y-0.5 pb-2">
                          {version.categories.map(category => {
                            const Icon = category.icon;
                            const isActiveCat = activeCategory === category.id && activeVersion === version.id;

                            return (
                              <div key={category.id}>
                                <button
                                  onClick={() => { setActiveCategory(category.id); setActiveVersion(version.id); }}
                                  className={`w-full text-left px-3 py-2 transition-all text-sm ${
                                    isActiveCat
                                      ? 'zion-rainbow-sub text-zion-cyan'
                                      : 'rounded-lg text-gray-400 hover:text-white hover:bg-white/5'
                                  }`}
                                  style={isActiveCat ? { '--rc': '6, 105, 40' } as React.CSSProperties : undefined}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    {getCategoryTitle(category)}
                                  </div>
                                </button>

                                {isActiveCat && (
                                  <div className="mt-1 ml-6 space-y-0.5 border-l border-zion-cyan/20 pl-3">
                                    {category.docs.map(doc => (
                                      <button
                                        key={doc.id}
                                        onClick={() => handleDocSelect(doc.id, category.id, version.id)}
                                        className={`w-full text-left px-2 py-1.5 text-xs transition-all ${
                                          selectedDoc === doc.id
                                            ? 'zion-rainbow-sub text-zion-gold font-medium'
                                            : 'rounded text-gray-500 hover:text-gray-300'
                                        }`}
                                        style={selectedDoc === doc.id ? { '--rc': '252, 209, 22' } as React.CSSProperties : undefined}
                                      >
                                        {getDocTitle(doc)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
                )}
              </nav>
            </div>
          </aside>

          {/* ═══ Content ═══ */}
          <div className="flex-1 min-w-0 max-w-3xl xl:max-w-4xl mx-auto">
            {selectedDoc === 'philosophy' ? (
              <PhilosophyContent />
            ) : (
              <>
                {/* Doc Header */}
                {currentDoc && (
                  <div className="mb-10 pb-8 border-b border-white/10">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      {currentSection ? (
                        <>
                          <span className={currentSection.accentText}>{currentSectionTitle}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="text-zion-gold">{currentDocTitle}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-zion-cyan">{currentVersion.label}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span>{currentCategoryTitle}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span className="text-zion-gold">{currentDocTitle}</span>
                        </>
                      )}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-gradient">
                      {currentDocTitle}
                    </h1>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${currentVersion.tagColor}`}>
                        <GitBranch className="w-3 h-3" />
                        {currentVersion.label}
                      </span>
                      <code className="text-xs bg-white/5 px-2 py-1 rounded text-gray-500">{currentDoc.file}</code>
                    </div>
                  </div>
                )}

                {/* Doc Content */}
                <div className="zion-docs-prose">
                  {loading ? (
                    <div className="space-y-6 py-12">
                      <div className="h-10 w-2/3 rounded-lg bg-white/10 animate-pulse mx-auto" />
                      <div className="h-px w-full bg-white/5" />
                      <div className="h-5 w-full rounded bg-white/5 animate-pulse" />
                      <div className="h-5 w-5/6 rounded bg-white/5 animate-pulse" />
                      <div className="h-5 w-4/6 rounded bg-white/5 animate-pulse" />
                      <div className="h-32 w-full rounded-xl bg-white/5 animate-pulse mt-8" />
                    </div>
                  ) : (
                    <DocMarkdownArticle content={content} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
