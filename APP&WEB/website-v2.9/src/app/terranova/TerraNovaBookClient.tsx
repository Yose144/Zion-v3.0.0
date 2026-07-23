'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Sparkles,
  Terminal,
  X,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLang } from '@/contexts/LanguageContext';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';
import { CHAPTERS } from './bookData';
import PioneerProjectCards from './components/PioneerProjectCards';
import GeographyMenu from './components/GeographyMenu';
import LayerMenu from './components/LayerMenu';
import type { BookChapter } from './bookData';

type EditionKey = 'final';

type EditionMeta = {
  titleCs: string;
  titleEn: string;
  subtitleCs: string;
  subtitleEn: string;
  editionCs: string;
  editionEn: string;
  aboutCs: string;
  aboutEn: string;
  layersCs: string;
  layersEn: string;
  dedicationCs: string;
  dedicationEn: string;
};

type EditionIntro = {
  signalsCs: string[];
  signalsEn: string[];
  eyebrowCs: string;
  eyebrowEn: string;
  headlineCs: string;
  headlineEn: string;
  leadCs: string;
  leadEn: string;
  bodyCs: string;
  bodyEn: string;
  notesCs: string[];
  notesEn: string[];
};

const APPENDIX_NUMBERS = new Set(['A', 'B', 'C', 'D', 'E', 'F']);

const EDITION_OPTIONS: Array<{
  id: EditionKey;
  nameCs: string;
  nameEn: string;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    id: 'final',
    nameCs: 'BASE FINAL edice',
    nameEn: 'BASE FINAL edition',
    color: '#00BFFF',
    bg: 'rgba(0,191,255,0.1)',
    border: 'rgba(0,191,255,0.3)',
  },
];

const EDITION_META: Record<EditionKey, EditionMeta> = {
  final: {
    titleCs: 'Terra Nova',
    titleEn: 'Terra Nova',
    subtitleCs: 'Zlatý Kompas Nové Země',
    subtitleEn: 'Golden Compass of the New Earth',
    editionCs: 'BASE FINAL edice · kanonická větev · Praha 2026',
    editionEn: 'BASE FINAL edition · canonical branch · Prague 2026',
    aboutCs:
      'Kanonická BASE FINAL edice Terra Novy — kompletní 17 kapitol + přílohy (A-F) + geography. Zdroj: docs/TerraNova/BASE_FINAL/.',
    aboutEn:
      'Polished edition of Terra Nova — clearly separated REALITY / ROADMAP / HORIZON layers, accurate facts, readable rhythm. Canonical text for the web, communities and Guardians.',
    layersCs:
      '🟢 REALITA = co funguje dnes · 📋 ROADMAP = co se staví · 🌟 HORIZONT = kam míříme.',
    layersEn:
      '🟢 REALITY = what works today · 📋 ROADMAP = what is being built · 🌟 HORIZON = where we are heading.',
    dedicationCs:
      'Pro Sarah Issobel, Maitreyu Buddhu, Radhu & Situ i Meriam,\npřátele, rodinu, svobodné lidstvo a všechny děti tohoto světa:\nZION je váš. Stavte lepší svět, a dosáhnete ke hvězdám.\nZlatý věk začíná.',
    dedicationEn:
      'For Sarah Issobel, Maitreya Buddha, Radhu & Situ and Meriam /EnaMaTara/,\nfriends, family, free humanity, and all the children of this world:\nZION is yours. Build a better world where you reach for the stars.\nThe Golden Age begins.',
  },
};

const EDITION_INTRO: Record<EditionKey, EditionIntro> = {
  final: {
    signalsCs: ['BASE FINAL', '🟢 REALITA / 📋 ROADMAP / 🌟 HORIZONT', 'Praha 2026'],
    signalsEn: ['BASE FINAL', '🟢 REALITY / 📋 ROADMAP / 🌟 HORIZON', 'Prague 2026'],
    eyebrowCs: 'ZION Terra Nova · polished reader edice · 17 kapitol',
    eyebrowEn: 'ZION Terra Nova · polished reader edition · 17 chapters',
    headlineCs: 'Terra Nova. Jasná fakta, čitelný rytmus, tři vrstvy.',
    headlineEn: 'Terra Nova. Clear facts, readable rhythm, three layers.',
    leadCs:
      'Každé tvrzení je označeno: co je realita dnes, co je stavební plán a co je horizont na obzoru. Bez sebeklamu, bez přehnaných slibů.',
    leadEn:
      'Every claim is labelled: what is reality today, what is the build plan, and what is the horizon ahead. No self-deception, no inflated promises.',
    bodyCs:
      'Sedmnáct kapitol od Prologu po Bhagavad Gítu. Blockchain, AI, komunity, medicína, volná energie, WARP, Issobella — a vždy jasná hranice mezi tím, co je hotovo, co se staví a kam míříme.',
    bodyEn:
      'Seventeen chapters from Prologue to Bhagavad Gita. Blockchain, AI, communities, medicine, free energy, WARP, Issobella — always a clear line between what is done, what is being built, and where we are heading.',
    notesCs: [
      '🟢 REALITA = ověřená fakta a fungující systémy k roku 2026.',
      '📋 ROADMAP = konkrétní plány s časovým horizontem.',
      '🌟 HORIZONT = vize a výzkumné cíle (2030–2040+).',
    ],
    notesEn: [
      '🟢 REALITY = verified facts and working systems as of 2026.',
      '📋 ROADMAP = concrete plans with time horizon.',
      '🌟 HORIZON = vision and research goals (2030–2040+).',
    ],
  },
};

function computeEditionChapters(
  data: Record<string, BookChapter[]> | null
): Record<EditionKey, BookChapter[]> {
  return data ? { final: data['final'] as BookChapter[] } : { final: [] };
}

function computeCompositionLines(
  chapters: Record<EditionKey, BookChapter[]>,
  edition: EditionKey
): { cs: string[]; en: string[] } {
  return {
    cs: chapters[edition].map((chapter) => formatChapterLabel(chapter, true)),
    en: chapters[edition].map((chapter) => formatChapterLabel(chapter, false)),
  };
}

const STARFIELD_POINTS = Array.from({ length: 40 }, (_, index) => ({
  top: `${((index * 17.23) + 11) % 100}%`,
  left: `${((index * 29.71) + 7) % 100}%`,
  size: `${(0.7 + ((index * 11) % 18) / 10).toFixed(2)}px`,
  opacity: Number((0.16 + (((index * 13) % 9) * 0.07)).toFixed(2)),
}));

function chapterDigit(num: string): string {
  const d = num.replace(/\D/g, '');
  return d || num;
}

function formatChapterLabel(chapter: BookChapter, cs: boolean) {
  const title = cs ? chapter.titleCs : chapter.titleEn;

  if (chapter.number === 'Prolog') {
    return `${cs ? 'Prolog' : 'Prologue'} — ${title}`;
  }

  if (chapter.number === 'Závěr') {
    return `${cs ? 'Závěr' : 'Conclusion'} — ${title}`;
  }

  if (APPENDIX_NUMBERS.has(chapter.number)) {
    return title;
  }

  return title;
}

/* ═══════════════════════════════════════════════════════════
   L1-L6 Acceleration Map (Issobella Compass)
   ═══════════════════════════════════════════════════════════ */
export interface AccelerationDirection {
  id: string;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  techCs: string;
  techEn: string;
  checklistCs: string[];
  checklistEn: string[];
  color: string;
  rgb: string;
  symbol: string;
}

type DharmaWheelSpoke = {
  id: string;
  titleCs: string;
  titleEn: string;
  mapCs: string;
  mapEn: string;
  descCs: string;
  descEn: string;
};

export const ACCELERATION_DIRECTIONS: AccelerationDirection[] = [
  {
    id: 'l1',
    titleCs: 'L1 Release Candidate (2026)',
    titleEn: 'L1 Release Candidate (2026)',
    descCs: 'Čistý Rust codebase, pražský runtime, auditní polish a příprava Genesis freeze.',
    descEn: 'Clean Rust codebase, Prague runtime, audit polish, and Genesis freeze preparation.',
    techCs: 'Node, pool a miner runtime v čistém Rustu.',
    techEn: 'Node, pool, and miner runtime in clean Rust.',
    checklistCs: [
      'V3 codebase — čistý Rust, auditovatelný',
      'Desktop-agent funkční (macOS / Win / Linux)',
      'Website + docs live',
      'Base mainnet bridge contracts verified + Prague relay připravený',
      'Finální whitepaper PDF',
      'Genesis freeze — signed, checksummed',
      'Rotace kompromitovaných klíčů',
      'External security audit',
      'PUBLIC LAUNCH WINDOW ← Q4 2026',
    ],
    checklistEn: [
      'V3 codebase — clean Rust, auditable',
      'Desktop-agent running (macOS / Win / Linux)',
      'Website + docs live',
      'Base mainnet bridge contracts verified + Prague relay prepared',
      'Final whitepaper PDF',
      'Genesis freeze — signed, checksummed',
      'Compromised key rotation',
      'External security audit',
      'PUBLIC LAUNCH WINDOW ← Q4 2026',
    ],
    color: '#FFD700',
    rgb: '255,215,0',
    symbol: 'L1',
  },
  {
    id: 'l2',
    titleCs: 'L2 Ekosystém (2027)',
    titleEn: 'L2 Ecosystem (2027)',
    descCs: 'DeFi infrastruktura, wZION likvidita na Base, DAO governance.',
    descEn: 'DeFi infrastructure, wZION liquidity on Base, DAO governance.',
    techCs: 'Bridge, DAO a likviditní vrstva nad hlavním řetězcem.',
    techEn: 'Bridge, DAO, and liquidity layer above the main chain.',
    checklistCs: [
      'Veřejná wZION likvidita na Base mainnet',
      'DAO governance — první hlasování',
      'WARP bridges (ETH, BTC atomic swap)',
      'CoinGecko + CoinMarketCap listing',
      '10+ Terra Nova komunit aktivních',
    ],
    checklistEn: [
      'Public wZION liquidity on Base mainnet',
      'DAO governance — first vote',
      'WARP bridges (ETH, BTC atomic swap)',
      'CoinGecko + CoinMarketCap listing',
      '10+ Terra Nova communities active',
    ],
    color: '#34D399',
    rgb: '52,211,153',
    symbol: 'L2',
  },
  {
    id: 'l3',
    titleCs: 'L3 AI Native (2028)',
    titleEn: 'L3 AI Native (2028)',
    descCs: 'Hiranyagarbha AI v2, NCL orchestrace sítě, WARP bridges a Guardian compute.',
    descEn: 'Hiranyagarbha AI v2, NCL network orchestration, WARP bridges and Guardian compute.',
    techCs: 'AI orchestrace, Guardian compute a WARP protokoly.',
    techEn: 'AI orchestration, Guardian compute, and WARP protocols.',
    checklistCs: [
      'Hiranyagarbha AI v2 (70B model, RAG, multi-turn)',
      'NCL vrstva — AI orchestrace sítě',
      'WARP bridges — první cross-chain propojení',
      'Guardian compute — decentralizovaný výpočetní stack',
    ],
    checklistEn: [
      'Hiranyagarbha AI v2 (70B model, RAG, multi-turn)',
      'NCL layer — AI network orchestration',
      'WARP bridges — first cross-chain integration',
      'Guardian compute — decentralized compute stack',
    ],
    color: '#60A5FA',
    rgb: '96,165,250',
    symbol: 'L3',
  },
  {
    id: 'l4',
    titleCs: 'L4 Oasis (2029)',
    titleEn: 'L4 Oasis (2029)',
    descCs: 'OASIS prototyp v Unreal Engine 5, Golden Egg hunt a Sacred Avatars.',
    descEn: 'OASIS prototype in Unreal Engine 5, Golden Egg hunt and Sacred Avatars.',
    techCs: 'Interaktivní svět, engine a vědomá herní vrstva.',
    techEn: 'Interactive world, engine, and conscious game layer.',
    checklistCs: [
      'OASIS whitepaper + design doc',
      'Unreal Engine 5 prototype — první island',
      'Golden Egg hunt — 108 indicií připraveno',
      'Sacred Avatars — prvních 10 designů',
      'OASIS beta — 10 000 hráčů',
      'Consciousness Level v OASIS funkční',
    ],
    checklistEn: [
      'OASIS whitepaper + design doc',
      'Unreal Engine 5 prototype — first island',
      'Golden Egg hunt — 108 clues prepared',
      'Sacred Avatars — first 10 designs',
      'OASIS beta — 10,000 players',
      'Consciousness Level in OASIS functional',
    ],
    color: '#A78BFA',
    rgb: '167,139,250',
    symbol: 'L4',
  },
  {
    id: 'l5',
    titleCs: 'L5 Free World (2030+)',
    titleEn: 'L5 Free World (2030+)',
    descCs: '100 Terra Nova komunit, Humanitární fond, Medical Tables a Free Energy výzkum.',
    descEn: '100 Terra Nova communities, Humanitarian fund, Medical Tables and Free Energy research.',
    techCs: 'Komunitní infrastruktura, medical stack a free-energy piloty.',
    techEn: 'Community infrastructure, medical stack, and free-energy pilots.',
    checklistCs: [
      '100 Terra Nova komunit globálně',
      'Humanitarian fund: $1M+ měsíčně distribuováno',
      '10 Medical Table prototypů v komunitách',
      'Free Energy Research: 3 aktivní výzkumné linie',
      'Seed Library network: 50 regionálních knihoven',
      'Terra Nova DAO — globální governance',
    ],
    checklistEn: [
      '100 Terra Nova communities globally',
      'Humanitarian fund: $1M+ distributed monthly',
      '10 Medical Table prototypes in communities',
      'Free Energy Research: 3 active research lines',
      'Seed Library network: 50 regional libraries',
      'Terra Nova DAO — global governance',
    ],
    color: '#F472B6',
    rgb: '244,114,182',
    symbol: 'L5',
  },
  {
    id: 'l6',
    titleCs: 'L6 Issobella (2040+)',
    titleEn: 'L6 Issobella (2040+)',
    descCs: 'Orbitální stanice Issobella, WARP propulze, SETI program a spojení s hvězdami.',
    descEn: 'Orbital station Issobella, WARP propulsion, SETI program and stellar connection.',
    techCs: 'Orbitální observatoř, WARP pohon a hvězdná telemetrie.',
    techEn: 'Orbital observatory, WARP drive, and stellar telemetry.',
    checklistCs: [
      'Issobella fund: hardware partnerství',
      'Orbital feasibility study (NASA/ESA/ISRO spolupráce)',
      'WARP Research Engine — první fyzikální prototyp',
      'Station Module 1 — launch',
      'SETI program aktivní',
      'První rezidentní výzkumníci z Guardian komunity',
      'METI — první zpráva odeslaná',
    ],
    checklistEn: [
      'Issobella fund: hardware partnerships',
      'Orbital feasibility study (NASA/ESA/ISRO cooperation)',
      'WARP Research Engine — first physical prototype',
      'Station Module 1 — launch',
      'SETI program active',
      'First resident researchers from Guardian community',
      'METI — first message transmitted',
    ],
    color: '#22D3EE',
    rgb: '34,211,238',
    symbol: 'L6',
  }
];

function IssobellaCompass({ selected, onSelect, cs }: { selected: number | null, onSelect: (i: number | null) => void, cs: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const highlighted = selected ?? hovered;
  const [rotation, setRotation] = useState(0);

  const roundCoord = (value: number) => Number(value.toFixed(3));

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (!start) start = ts;
      setRotation(((ts - start) / 120) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const CX = 350;
  const CY = 350;
  const R_OUTER = 290;
  const R_RING = 270;
  const R_NODES = 220;
  const R_INNER = 130;
  const NODE_R = 34;

  const pt = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: roundCoord(cx + r * Math.cos(rad)),
      y: roundCoord(cy + r * Math.sin(rad)),
    };
  };

  const total = ACCELERATION_DIRECTIONS.length;
  const nodePos = (i: number) => pt(CX, CY, R_NODES, i * (360 / total));
  
  const polyStr = ACCELERATION_DIRECTIONS.map((_, i) => `${nodePos(i).x},${nodePos(i).y}`).join(' ');
  const starStr1 = [0, 2, 4].map(i => `${nodePos(i).x},${nodePos(i).y}`).join(' ');
  const starStr2 = [1, 3, 5].map(i => `${nodePos(i).x},${nodePos(i).y}`).join(' ');

  // ── Sacred geometry: Semeno života + Metatronova kostka ──
  const SOL_R = 50;
  const MET_R2 = 100;
  const sacredAngles1 = [0, 60, 120, 180, 240, 300];
  const sacredAngles2 = [30, 90, 150, 210, 270, 330];
  const metPts: [number, number][] = [
    [CX, CY],
    ...sacredAngles1.map((a): [number, number] => {
      const rad = (a - 90) * Math.PI / 180;
      return [roundCoord(CX + SOL_R * Math.cos(rad)), roundCoord(CY + SOL_R * Math.sin(rad))];
    }),
    ...sacredAngles2.map((a): [number, number] => {
      const rad = (a - 90) * Math.PI / 180;
      return [roundCoord(CX + MET_R2 * Math.cos(rad)), roundCoord(CY + MET_R2 * Math.sin(rad))];
    }),
  ];
  const metEdges: [number, number, number, number][] = [];
  for (let i = 0; i < metPts.length; i++) {
    for (let j = i + 1; j < metPts.length; j++) {
      metEdges.push([metPts[i][0], metPts[i][1], metPts[j][0], metPts[j][1]]);
    }
  }

  return (
    <svg viewBox="0 0 700 700" className="w-full h-auto select-none" role="img">
      <defs>
        <radialGradient id="zk-center-acc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,215,0,0.25)" />
          <stop offset="40%" stopColor="rgba(147,51,234,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="zk-glow-acc" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="zk-glow-sm-acc" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {ACCELERATION_DIRECTIONS.map((d) => (
          <linearGradient key={`lg-acc-${d.id}`} id={`lg-acc-${d.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,215,0,0.15)" />
            <stop offset="100%" stopColor={`rgba(${d.rgb},0.5)`} />
          </linearGradient>
        ))}
      </defs>

      <circle cx={CX} cy={CY} r={280} fill="url(#zk-center-acc)" />

      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
        {Array.from({ length: 72 }).map((_, i) => {
          const a = i * (360 / 72);
          const major = i % 6 === 0;
          const p1 = pt(CX, CY, R_OUTER, a);
          const p2 = pt(CX, CY, R_OUTER - (major ? 14 : 7), a);
          return (
            <line
              key={`tick-${i}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={major ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)'}
              strokeWidth={major ? 1.5 : 0.8}
            />
          );
        })}
      </g>

      <circle cx={CX} cy={CY} r={R_RING} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R_RING - 4} fill="none" stroke="rgba(255,215,0,0.06)" strokeWidth="0.5" strokeDasharray="2 6" />
      <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" />
      <circle cx={CX} cy={CY} r={R_INNER - 20} fill="none" stroke="rgba(147,51,234,0.06)" strokeWidth="0.5" strokeDasharray="3 8" />

      <polygon points={polyStr} fill="rgba(255,215,0,0.015)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <polygon points={starStr1} fill="none" stroke="rgba(255,215,0,0.08)" strokeWidth="0.8" />
      <polygon points={starStr2} fill="none" stroke="rgba(255,215,0,0.08)" strokeWidth="0.8" />

      {/* ── Holografická Metatronova kostka ── */}
      <g opacity="0.07" stroke="rgba(255,215,0,0.55)" fill="none">
        {metEdges.map(([x1, y1, x2, y2], idx) => (
          <line key={`mc-${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="0.4" />
        ))}
      </g>

      {/* ── Holografické Semeno života ── */}
      <g opacity="0.14" fill="none">
        <circle cx={CX} cy={CY} r={SOL_R} stroke="rgba(180,220,255,0.75)" strokeWidth="0.9" />
        {sacredAngles1.map(a => {
          const rad = (a - 90) * Math.PI / 180;
          return (
            <circle
              key={`sol-${a}`}
              cx={roundCoord(CX + SOL_R * Math.cos(rad))}
              cy={roundCoord(CY + SOL_R * Math.sin(rad))}
              r={SOL_R}
              stroke="rgba(140,200,255,0.65)"
              strokeWidth="0.8"
            />
          );
        })}
      </g>

      {ACCELERATION_DIRECTIONS.map((d, i) => {
        const p = nodePos(i);
        const isHl = highlighted === i;
        const gid = `spoke-g-acc-${d.id}`;
        return (
          <g key={`spoke-${d.id}`}>
            <linearGradient id={gid} x1={CX / 700} y1={CY / 700} x2={p.x / 700} y2={p.y / 700} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={isHl ? `rgba(${d.rgb},0.5)` : 'rgba(255,215,0,0.08)'} />
              <stop offset="100%" stopColor={isHl ? `rgba(${d.rgb},0.8)` : `rgba(${d.rgb},0.15)`} />
            </linearGradient>
            <line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={`url(#${gid})`} strokeWidth={isHl ? 2.5 : 1.2} filter={isHl ? 'url(#zk-glow-sm-acc)' : undefined} style={{ transition: 'stroke-width 0.4s' }} />
            <circle cx={CX + (p.x - CX) * 0.55} cy={CY + (p.y - CY) * 0.55} r={isHl ? 2.5 : 1.5} fill={isHl ? d.color : 'rgba(255,255,255,0.12)'} style={{ transition: 'all 0.3s' }} />
          </g>
        );
      })}

      <g>
        <circle cx={CX} cy={CY} r={42} fill="rgba(0,0,0,0.5)" stroke="rgba(255,215,0,0.25)" strokeWidth="1.5" />
        <circle cx={CX} cy={CY} r={36} fill="rgba(0,0,0,0.7)" stroke="rgba(255,215,0,0.15)" strokeWidth="1" />
        {[0, 90, 180, 270].map((a) => (
          <line key={`arm-${a}`} x1={pt(CX, CY, 10, a).x} y1={pt(CX, CY, 10, a).y} x2={pt(CX, CY, 30, a).x} y2={pt(CX, CY, 30, a).y} stroke={a === 0 ? 'rgba(255,215,0,0.7)' : 'rgba(255,255,255,0.2)'} strokeWidth={a === 0 ? 2 : 1} />
        ))}
        <polygon points={`${CX},${CY - 32} ${CX - 6},${CY - 18} ${CX + 6},${CY - 18}`} fill="rgba(255,215,0,0.8)" filter="url(#zk-glow-sm-acc)" />
        <polygon points={`${CX},${CY + 32} ${CX - 5},${CY + 20} ${CX + 5},${CY + 20}`} fill="rgba(255,255,255,0.15)" />
        <polygon points={`${CX},${CY - 6} ${CX + 6},${CY} ${CX},${CY + 6} ${CX - 6},${CY}`} fill="#FFD700" opacity={0.9} />
        <text x={CX} y={CY - 39} textAnchor="middle" fill="rgba(255,215,0,0.6)" fontSize="9" fontWeight="700" fontFamily="var(--font-mono), monospace">N</text>
        <text x={CX} y={CY + 47} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontWeight="600" fontFamily="var(--font-mono), monospace">S</text>
      </g>

      {ACCELERATION_DIRECTIONS.map((d, i) => {
        const p = nodePos(i);
        const isHl = highlighted === i;
        const isActive = selected === i;
        const angle = i * (360 / total);
        const lp = pt(CX, CY, R_NODES + 52, angle);

        return (
          <g key={d.id} className="cursor-pointer" onClick={() => onSelect(isActive ? null : i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            {isActive && (
              <circle cx={p.x} cy={p.y} r={NODE_R + 16} fill="none" stroke={d.color} strokeWidth="1" opacity={0.3}>
                <animate attributeName="r" from={String(NODE_R + 10)} to={String(NODE_R + 24)} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={p.x} cy={p.y} r={NODE_R + 10} fill="none" stroke={`rgba(${d.rgb},${isHl ? 0.35 : 0})`} strokeWidth="1.5" style={{ transition: 'stroke 0.4s' }} />
            <circle cx={p.x} cy={p.y} r={NODE_R} fill={isHl ? `rgba(${d.rgb},0.12)` : 'rgba(0,0,0,0.65)'} stroke={isHl ? d.color : 'rgba(255,255,255,0.12)'} strokeWidth={isHl ? 2.5 : 1.2} filter={isHl ? 'url(#zk-glow-acc)' : undefined} style={{ transition: 'all 0.35s' }} />
            <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="central" fill={isHl ? d.color : 'rgba(255,255,255,0.7)'} fontSize="18" fontWeight="600" fontFamily="var(--font-mono), monospace" style={{ transition: 'fill 0.3s' }}>{d.symbol}</text>
            <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central" fill={isHl ? d.color : 'rgba(255,255,255,0.45)'} fontSize="13" fontWeight={isHl ? '700' : '500'} letterSpacing="0.04em" style={{ transition: 'fill 0.3s' }}>{cs ? d.titleCs : d.titleEn}</text>
            {isHl && <line x1={p.x + (pt(CX, CY, R_NODES + 34, angle).x - p.x) * 0.7} y1={p.y + (pt(CX, CY, R_NODES + 34, angle).y - p.y) * 0.7} x2={pt(CX, CY, R_NODES + 34, angle).x} y2={pt(CX, CY, R_NODES + 34, angle).y} stroke={`rgba(${d.rgb},0.35)`} strokeWidth="1" strokeDasharray="2 3" />}
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Terra Nova — Public Book Reader
   Full bilingual reader with chapter navigation
   ═══════════════════════════════════════════════════════════ */

const GENESIS_BANNER = [
  '████████╗██╗ ██████╗███╗   ██╗',
  '╚══███╔╝██║██╔═══██╗████╗  ██║',
  '  ███╔╝ ██║██║   ██║██╔██╗ ██║',
  ' ███╔╝  ██║██║   ██║██║╚██╗██║',
  '███████╗██║╚██████╔╝██║ ╚████║',
  '╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
].join('\n');

const GENESIS_TREE = [
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⣀⢂⣁⣧⣖⡖⠠⢠⠀⠀⢤⡀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢼⣶⡭⣛⠫⡞⠡⠀⡤⢦⠆⠨⠀⠀⢸⠋⠬⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠒⢈⠀⢭⣉⠂⡄⢠⠖⣸⠑⣆⡦⠊⢀⠀⡂⢉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠍⠚⣁⣀⡀⣤⣰⢶⢷⢼⣿⠏⡡⢠⢗⡙⣶⣞⠛⣍⣪⣼⡠⠠⢶⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⢄⣎⡠⢠⠉⠋⠓⠉⠋⢨⠘⠚⢉⡄⠁⢾⡌⣗⢿⠛⠲⠛⠋⡝⠑⠀⠌⡤⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠘⠥⠄⡚⣜⢣⣴⡨⢁⡀⣈⡅⠀⣀⠀⠈⣄⣀⢿⣯⡔⢊⢺⣷⠆⣷⠶⠂⠀⠀⠀⢀⡀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠘⢁⣨⡅⠨⣤⣭⣵⣿⢿⢏⠿⠯⡁⠹⣿⡯⡜⠫⢯⢿⡾⣻⡅⣠⣆⣄⣰⡐⠲⠼⢶⠒⠯⠅⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠂⢈⠙⡋⣟⡛⣷⠴⢼⠓⠋⣺⣴⣷⣷⢾⣿⡿⣡⣠⣸⠗⠻⠹⠿⣟⢥⠯⣿⠻⢅⢴⢎⠄⠀⡄⢠⣀⠀⡀⠀⢄⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⢘⠳⠋⣤⣶⡿⢜⣳⢦⢶⣌⣩⠶⢠⣤⣯⠷⠈⠬⡉⠎⠎⣀⡌⠟⣝⣿⠇⡚⠒⠔⢀⣴⣍⣾⢲⠋⠟⠈⠙⠑⠉⢀⠄⠀',
  '⠀⠀⠀⡀⣽⠿⠻⡈⠱⢻⣽⡟⣶⣚⡻⢏⢹⡋⠁⣀⣂⣤⣴⠄⢤⣐⣴⡾⣶⠯⣄⣉⢓⡭⢍⡆⡀⣈⣿⣷⡷⠶⠒⢂⣠⣠⢶⣾⣳⣯⣵⡄',
  '⠀⠀⠀⠰⠴⠀⢘⢉⣧⣥⣏⠳⢈⣫⠞⣿⣷⢤⣤⣿⣿⣾⣧⣾⣿⣿⣿⣗⣿⣿⣿⠋⣚⡃⠿⡭⠹⣷⣿⠾⡿⢤⣤⣜⢿⣯⡿⣷⠯⣽⣿⡾',
  '⠀⠀⠀⠀⠀⠐⠞⠻⣿⢟⣿⢿⠷⠥⣼⣷⢷⣯⠟⠻⠙⢉⡿⣿⢻⣹⣿⣿⢉⢳⣿⣿⣯⡶⡄⡶⢦⣷⣶⣿⡬⢥⠨⣭⣹⠏⠁⡘⢫⠉⠈⠀',
  '⠀⠀⠔⣼⢂⠬⢌⠧⢋⡛⢡⣮⡡⠈⠓⣃⢀⣒⣊⣽⠻⣛⠟⢿⢸⣯⣿⣓⣿⡟⣷⣟⣿⣿⣿⣿⣻⣷⣟⣒⡺⠏⢰⡿⠿⣶⣶⡻⠒⡿⠦⡀',
  '⠀⢆⣀⣆⣸⣿⠋⡴⢲⡁⡋⠀⢴⣮⣷⠟⠫⠿⣿⢶⢅⢴⣇⣸⣷⣿⣿⣧⣾⣿⣿⣿⣿⣿⣿⣿⣿⢿⢿⣟⣲⢦⠦⢋⡀⢿⣾⣷⣶⣤⠋⠆',
  '⠈⠘⠛⠼⠿⡝⣻⠛⠻⠀⠀⠐⠛⢹⣱⣟⣽⣯⣿⡟⡊⣿⣷⣖⢽⣿⣿⣿⢿⣿⠀⠀⠘⠋⠃⠁⠀⠀⠨⠟⠿⡷⣥⣉⠁⠘⠉⠊⠚⠚⠓⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠋⠀⠀⠀⠀⠈⠋⠹⣎⢻⣿⠟⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⢳⡕⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣾⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣹⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠚⠛⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
].join('\n');

const CLI_PRESET = [
  'zion status --layer all',
  'zion l1 start node --profile mainnet',
  'zion mine bench --backend cpu',
  'zion doctor',
  'zion logs --tail 64',
  'zion dashboard',
];

const BOOT_SEQUENCE = [
  {
    command: 'zion version',
    responseCs: 'zion v3.0.6 "Trinity, Mainnet Beta" · mainnet · 6-decimal flowers · build 2026-07-15',
    responseEn: 'zion v3.0.6 "Trinity, Mainnet Beta" · mainnet · 6-decimal flowers · build 2026-07-15',
  },
  {
    command: 'zion status --layer all',
    responseCs: 'node ✓  pool ✓  miner ✓  bridge relay připraven',
    responseEn: 'node ✓  pool ✓  miner ✓  bridge relay prepared',
  },
  {
    command: 'zion l1 start node --profile mainnet',
    responseCs: 'Prague runtime healthy · release-candidate state',
    responseEn: 'Prague runtime healthy · release-candidate state',
  },
  {
    command: 'zion doctor',
    responseCs: 'audit polish active · external audit pending',
    responseEn: 'audit polish active · external audit pending',
  },
];

const DHARMA_WHEEL_SPOKES: DharmaWheelSpoke[] = [
  {
    id: 'understanding',
    titleCs: 'Správné Porozumění',
    titleEn: 'Right Understanding',
    mapCs: 'Blockchain transparentnost',
    mapEn: 'Blockchain transparency',
    descCs: 'Vidět věci tak, jak skutečně jsou: open-source kód, auditovatelný řetězec a žádná iluze skrytých pravidel.',
    descEn: 'Seeing things as they truly are: open-source code, an auditable chain, and no illusion of hidden rules.',
  },
  {
    id: 'intent',
    titleCs: 'Správný Záměr',
    titleEn: 'Right Intent',
    mapCs: 'AI Native Manifest + CL systém',
    mapEn: 'AI Native Manifest + CL system',
    descCs: 'Záměr musí předcházet činu: manifest, humanitární tithe i Consciousness Level drží směr dřív než přijde výkon.',
    descEn: 'Intent must precede action: the manifest, humanitarian tithe, and Consciousness Level hold the direction before performance arrives.',
  },
  {
    id: 'speech',
    titleCs: 'Správná Řeč',
    titleEn: 'Right Speech',
    mapCs: 'Hiranyagarbha Satya test',
    mapEn: 'Hiranyagarbha Satya test',
    descCs: 'Pravdivost, laskavost a užitečnost: blockchain neumí lhát a AI má říct nevím, když neví.',
    descEn: 'Truthfulness, kindness, and usefulness: the blockchain cannot lie, and AI must say it does not know when it does not know.',
  },
  {
    id: 'action',
    titleCs: 'Správné Jednání',
    titleEn: 'Right Action',
    mapCs: 'Permakultúra + ahimsa',
    mapEn: 'Permaculture + ahimsa',
    descCs: 'Každodenní čin bez škody: permakultura, honest mining a ochrana života jako provozní disciplína.',
    descEn: 'Daily action without harm: permaculture, honest mining, and protection of life as an operational discipline.',
  },
  {
    id: 'livelihood',
    titleCs: 'Správné Živobytí',
    titleEn: 'Right Livelihood',
    mapCs: 'Mining jako čistý byznys model',
    mapEn: 'Mining as a clean business model',
    descCs: 'Živobytí bez manipulace: práce za odměnu, bez prodeje pozornosti, dat nebo závislosti.',
    descEn: 'Livelihood without manipulation: work for reward, without selling attention, data, or addiction.',
  },
  {
    id: 'effort',
    titleCs: 'Správné Úsilí',
    titleEn: 'Right Effort',
    mapCs: 'Rust + testy u kořenů',
    mapEn: 'Rust + tests at the roots',
    descCs: 'Energie vynaložená správně: silné kořeny v Rustu, testech a dlouhém horizontu místo rychlých zkratek.',
    descEn: 'Energy spent rightly: strong roots in Rust, tests, and a long horizon instead of fast shortcuts.',
  },
  {
    id: 'mindfulness',
    titleCs: 'Správná Bdělost',
    titleEn: 'Right Mindfulness',
    mapCs: 'Medical Table biofeedback',
    mapEn: 'Medical Table biofeedback',
    descCs: 'Přítomnost bez útěku: biofeedback, paměť řetězce a AI zrcadlo ukazují stav takový, jaký je.',
    descEn: 'Presence without escape: biofeedback, chain memory, and the AI mirror show the state exactly as it is.',
  },
  {
    id: 'concentration',
    titleCs: 'Správná Meditace',
    titleEn: 'Right Concentration',
    mapCs: 'CL9 + Issobella + Ekam Deeksha',
    mapEn: 'CL9 + Issobella + Ekam Deeksha',
    descCs: 'Soustředění, které uklidní ego: od CL9 přes Overview Effect až po konsensus jako vědomou praxi.',
    descEn: 'Concentration that calms the ego: from CL9 through the Overview Effect to consensus as conscious practice.',
  },
];

const LIVE_TERMINAL_CMDS = [
  { cmd: 'zion version', resp: 'zion v3 release-candidate · Prague runtime · build 2026-04' },
  { cmd: 'zion status --layer all', resp: 'node ✓  pool ✓  miner ✓  bridge relay prepared · audit polish active' },
  { cmd: 'zion l1 status --profile mainnet', resp: 'Prague runtime healthy · Genesis freeze pending' },
  { cmd: 'zion mine bench --backend cpu', resp: '14.7 H/s · best-share 0x1f2a · 0 rejects · 8 threads' },
  { cmd: 'zion doctor', resp: 'local checks green · key rotation and external audit pending' },
  { cmd: 'zion logs --tail 8', resp: '[pool] share accepted · worker deeksha-01 · 0 ms latency' },
];

const VISION_20Y_STEPS = [
  {
    year: '2026',
    titleCs: 'L1 Genesis',
    titleEn: 'L1 Genesis',
    descCs: 'Mainnet základ a veřejný launch.',
    descEn: 'Mainnet baseline and public launch.',
  },
  {
    year: '2028',
    titleCs: 'L2/L3 Ekosystém',
    titleEn: 'L2/L3 Ecosystem',
    descCs: 'Bridge, DAO, DeFi, AI Native integrace.',
    descEn: 'Bridge, DAO, DeFi, AI Native integration.',
  },
  {
    year: '2030',
    titleCs: 'L4 OASIS',
    titleEn: 'L4 OASIS',
    descCs: 'Herní a vědomostní vrstva komunity.',
    descEn: 'Game and consciousness layer for communities.',
  },
  {
    year: '2033',
    titleCs: 'L5 Svět Svobody',
    titleEn: 'L5 Free World',
    descCs: 'Komunity, energie, zdravotní piloty.',
    descEn: 'Communities, energy, medical pilots.',
  },
  {
    year: '2038',
    titleCs: 'Issobella Program',
    titleEn: 'Issobella Program',
    descCs: 'Orbitální příprava, hardware partnerství.',
    descEn: 'Orbital preparation, hardware partnerships.',
  },
  {
    year: '2046',
    titleCs: 'Hvězdný Horizont',
    titleEn: 'Stellar Horizon',
    descCs: 'L6 mise, observatoř a první dlouhý výhled.',
    descEn: 'L6 missions, observatory, and first long-range horizon.',
  },
];

export default function TerraNovaBookClient() {
  const { lang, setLang } = useLang();
  const cs = lang === 'cs';

  const [activeEdition, setActiveEdition] = useState<EditionKey>('final');
  const [editionsData, setEditionsData] = useState<Record<string, BookChapter[]> | null>(null);

  useEffect(() => {
    fetch('/terranova-editions.json')
      .then((res) => res.json())
      .then((data) => setEditionsData(data))
      .catch((err) => console.error('Failed to load Terra Nova editions:', err));
  }, []);

  const EDITION_CHAPTERS = useMemo(() => computeEditionChapters(editionsData), [editionsData]);
  const EDITION_COMPOSITION_LINES = useMemo(
    () => ({
      final: computeCompositionLines(EDITION_CHAPTERS, 'final'),
    }),
    [EDITION_CHAPTERS]
  );

  const currentChapters = EDITION_CHAPTERS[activeEdition];
  const currentEdition = EDITION_OPTIONS.find((option) => option.id === activeEdition) ?? EDITION_OPTIONS[0];
  const meta = EDITION_META[activeEdition];
  const intro = EDITION_INTRO[activeEdition];
  const compositionLines = cs
    ? EDITION_COMPOSITION_LINES[activeEdition].cs
    : EDITION_COMPOSITION_LINES[activeEdition].en;

  const [activeChapter, setActiveChapter] = useState<number>(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<'genesis' | 'cli' | null>(null);
  const [visibleBootLines, setVisibleBootLines] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [compassDir, setCompassDir] = useState<number | null>(0);
  const [dharmaSpoke, setDharmaSpoke] = useState(0);
  const [twCmdText, setTwCmdText] = useState('');
  const [twRespText, setTwRespText] = useState('');
  const twRef = useRef({ cmdIdx: 0, charIdx: 0, phase: 'typing' as string, pauseTicks: 0 });
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayOpen = overlayMode !== null;

  const goTo = useCallback(
    (i: number) => {
      setActiveChapter(i);
      setTocOpen(false);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const prev = useCallback(() => {
    if (activeChapter > 0) goTo(activeChapter - 1);
  }, [activeChapter, goTo]);

  const next = useCallback(() => {
    if (activeChapter < currentChapters.length - 1) goTo(activeChapter + 1);
  }, [activeChapter, currentChapters.length, goTo]);

  /* Keyboard nav */
  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisibleBootLines((current) =>
        current >= BOOT_SEQUENCE.length ? 1 : current + 1,
      );
    }, 1150);

    return () => window.clearInterval(interval);
  }, []);

  /* Typewriter live terminal */
  useEffect(() => {
    const interval = window.setInterval(() => {
      const s = twRef.current;
      const cmd = LIVE_TERMINAL_CMDS[s.cmdIdx];
      if (s.phase === 'typing') {
        s.charIdx++;
        setTwCmdText(cmd.cmd.slice(0, s.charIdx));
        if (s.charIdx >= cmd.cmd.length) {
          s.phase = 'resp';
          s.pauseTicks = 0;
        }
      } else if (s.phase === 'resp') {
        s.pauseTicks++;
        if (s.pauseTicks === 5) {
          setTwRespText(cmd.resp);
          s.phase = 'pause';
          s.pauseTicks = 0;
        }
      } else if (s.phase === 'pause') {
        s.pauseTicks++;
        if (s.pauseTicks >= 30) {
          s.cmdIdx = (s.cmdIdx + 1) % LIVE_TERMINAL_CMDS.length;
          s.charIdx = 0;
          s.phase = 'typing';
          s.pauseTicks = 0;
          setTwCmdText('');
          setTwRespText('');
        }
      }
    }, 70);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTocOpen(false);
        setOverlayMode(null);
        return;
      }
      if (overlayOpen) {
        return;
      }
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, overlayOpen, prev]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 520);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const shouldLock = tocOpen || overlayOpen;
    if (shouldLock) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [tocOpen, overlayOpen]);

  if (!editionsData || currentChapters.length === 0) {
    return (
      <div className="zion-container flex min-h-[60vh] items-center justify-center text-center text-gray-400">
        <div>
          <div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p>Načítání Terra Nova…</p>
        </div>
      </div>
    );
  }

  const chapter = currentChapters[activeChapter];
  const sections = cs ? chapter.sectionsCs : chapter.sectionsEn;
  const chapterEpigraph = cs ? chapter.epigraphCs : chapter.epigraphEn;
  const progress = ((activeChapter + 1) / currentChapters.length) * 100;
  const chapterLabel =
    chapter.number === 'Prolog'
      ? cs
        ? 'Prolog'
        : 'Prologue'
      : APPENDIX_NUMBERS.has(chapter.number)
      ? `${cs ? 'Příloha' : 'Appendix'} ${chapter.number}`
      : chapter.number === 'Závěr'
      ? cs
        ? 'Závěr'
        : 'Conclusion'
      : `${cs ? 'Část' : 'Part'} ${chapter.number}`;
  const selectedDirection = compassDir !== null ? ACCELERATION_DIRECTIONS[compassDir] : null;
  const selectedDharmaSpoke = DHARMA_WHEEL_SPOKES[dharmaSpoke];
  const flowersPerZionLabel = cs
    ? `1 ZION = 10^${Math.log10(ATOMIC_UNITS_PER_ZION)} květů`
    : `1 ZION = 10^${Math.log10(ATOMIC_UNITS_PER_ZION)} flowers`;
  const introSignals = cs ? intro.signalsCs : intro.signalsEn;
  const introLead = cs ? intro.leadCs : intro.leadEn;
  const introBody = cs ? intro.bodyCs : intro.bodyEn;
  const introNotes = cs ? intro.notesCs : intro.notesEn;
  const introQuote = cs
    ? 'Gate, Gate, Paragate, Parasamgate, Bodhi Swaha'
    : 'Gate, Gate, Paragate, Parasamgate, Bodhi Swaha';
  const introDedication = cs
    ? 'Pro Sarah Issobel, Maitreyu Buddhu, Radhu & Situ i Meriam,\npřátele, rodinu, svobodné lidstvo a všechny děti tohoto světa:\nZION je váš. Stavte lepší svět, a dosáhnete ke hvězdám.\nZlatý věk začíná.'
    : 'For Sarah Issobel, Maitreya Buddha, Radha & Sita & Meriam /EnaMaTara/,\nfriends, family, free humanity and all the children of this world:\nZION is yours. Build a better world where you reach for the stars.\nThe Golden Age begins. Peace & One Love 4ever.';
  const genesisOverlayLines = cs
    ? [
        'Genesis není jen předmluva. Je to okamžik, kdy se jazyk, síť a závazek poprvé dotknou stejného horizontu.',
        'Proto má Terra Nova na vstupu nést i ceremoniální tíhu počátku, nejen čtecí komfort.',
      ]
    : [
        'Genesis is not only a foreword. It is the instant when language, network, and commitment first touch the same horizon.',
        'That is why Terra Nova should carry ceremonial weight at the entrance, not only reading comfort.',
      ];
  const cliOverlayLines = cs
    ? [
        'CLI je zde jako provozní svědomí projektu: připomíná, že vize musí být spustitelná, měřitelná a udržitelná.',
        'Overlay drží příkazy, boot sekvenci a orientační vrstvu, aby se intro neztratilo po prvním scrollu.',
      ]
    : [
        'The CLI is here as the operational conscience of the project: a reminder that vision must remain runnable, measurable, and sustainable.',
        'The overlay keeps the commands, boot sequence, and orientation layer present even after the first scroll.',
      ];

  return (
    <div className="zion-shell zion-page">
      {/* ── Ambient background ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full blur-[240px] bg-zion-gold/6" />
        <div className="absolute -right-40 top-1/2 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-purple/5" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-cyan/4" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="mb-12 md:mb-16"
        >
          <div className="relative overflow-hidden zion-rainbow-card p-5 sm:p-6 md:p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-zion-gold/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-zion-cyan/8 blur-3xl" />

            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {introSignals.map((signal) => (
                    <span
                      key={signal}
                      className="zion-badge"
                    >
                      <Sparkles className="h-3 w-3 text-zion-gold" />
                      {signal}
                    </span>
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-zion-gold/80">
                    {cs ? intro.eyebrowCs : intro.eyebrowEn}
                  </p>
                  <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-5xl">
                    {cs ? intro.headlineCs : intro.headlineEn}
                  </h2>
                </div>

                <p className="max-w-2xl text-base leading-relaxed text-gray-200 md:text-lg">
                  {introLead}
                </p>
                <p className="max-w-2xl text-sm leading-relaxed text-gray-400 md:text-base">
                  {introBody}
                </p>

                <div className="grid gap-2 sm:grid-cols-3">
                  {introNotes.map((note, index) => (
                    <div
                      key={note}
                      className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                    >
                      <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-gray-500">
                        {`${cs ? 'Vrstva' : 'Layer'} ${index + 1}`}
                      </p>
                      <p className="text-sm leading-relaxed text-gray-300">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setTocOpen(false);
                      setOverlayMode('genesis');
                    }}
                    className="zion-button-primary"
                  >
                    <BookOpen className="h-4 w-4" />
                    {cs ? 'Otevřít Genesis' : 'Open Genesis'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setTocOpen(false);
                      setOverlayMode('cli');
                    }}
                    className="zion-button-secondary"
                  >
                    <Terminal className="h-4 w-4" />
                    {cs ? 'Visual Zion CLI panel' : 'Visual ZION CLI Panel'}
                  </button>
                  <button
                    onClick={() => setTocOpen(true)}
                    className="zion-button-secondary"
                  >
                    <List className="h-4 w-4" />
                    {cs ? 'Obsah Terra Novy' : 'Terra Nova Contents'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden zion-rainbow-sub shadow-[0_20px_80px_rgba(2,8,18,0.6)]" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gray-500">
                      <Terminal className="h-3.5 w-3.5 text-zion-cyan" />
                      {cs ? 'Visual Zion CLI' : 'Visual ZION CLI'}
                    </div>
                  </div>

                  <div className="space-y-4 px-4 py-4">
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-zion-cyan/70">
                        {cs ? 'Mainnet launch pulse' : 'Mainnet launch pulse'}
                      </p>
                      <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-zion-cyan/90" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
{GENESIS_BANNER}
                      </pre>
                    </div>

                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                      <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-gray-500">
                        {cs ? 'Živý terminál — ZION CLI' : 'Live Terminal — ZION CLI'}
                      </p>
                      <div className="min-h-22 space-y-2 font-mono text-[12px] text-gray-300">
                        <div className="rounded-xl bg-white/3 px-3 py-2.5">
                          <div className="flex gap-3">
                            <span className="text-zion-gold">$</span>
                            <span className="break-all">
                              {twCmdText}
                              <span className="inline-block h-[13px] w-0.5 bg-zion-cyan/80 animate-pulse align-middle ml-px" />
                            </span>
                          </div>
                          {twRespText && (
                            <div className="mt-1.5 pl-6 text-[11px] text-emerald-300/80">
                              ▸ {twRespText}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 px-1 text-[11px] uppercase tracking-[0.24em] text-gray-500">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          {cs ? 'orbitální reader online' : 'orbital reader online'}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => setOverlayMode('cli')}
                          className="zion-button-secondary"
                        >
                          <Terminal className="h-3.5 w-3.5" />
                          {cs ? 'Rozbalit CLI overlay' : 'Expand CLI Overlay'}
                        </button>
                        <Link
                          href="/docs"
                          className="zion-button-secondary"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Real ZION CLI →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-zion-gold/15 bg-[linear-gradient(180deg,rgba(255,215,0,0.08),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.32)]">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-zion-gold/70">
                    Genesis.md
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre text-[7px] leading-tight text-zion-gold/30 sm:text-[8px]">{GENESIS_TREE}</pre>
                  <pre className="mt-3 overflow-x-auto whitespace-pre font-mono text-[10px] leading-relaxed text-zion-gold/85 sm:text-[11px]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>{GENESIS_BANNER}</pre>
                  <blockquote className="mt-4 border-l-2 border-zion-gold/35 pl-4 text-xs italic leading-relaxed text-gray-300 sm:text-sm">
                    {introDedication}
                  </blockquote>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-gray-500">
                    {introQuote}
                  </p>
                  <p className="mt-2 text-[10px] italic text-gray-600">
                    — Yeshuae / Zion Creator
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ ISSOBELLA COMPASS DECK ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="mb-14 md:mb-16"
        >
          <div className="mb-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.36em] text-zion-gold/70">
              {cs ? 'Issobella Vision Deck' : 'Issobella Vision Deck'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              {cs ? 'Zlatý Kompas v orbitální stanici' : 'Golden Compass on the Orbital Station'}
            </h2>
            <p className="mt-2 text-sm text-gray-400 sm:text-base">
              {cs
                ? 'Výhled na Zemi z observatoře Issobella a hlavní panel navigace šesti vrstvami L1 až L6.'
                : 'Earth view from the Issobella observatory and the main navigation panel across the six L1 to L6 layers.'}
            </p>
          </div>

          {/* ── Canonical branch banner ── */}
          <div className="mb-6 overflow-hidden zion-rainbow-card" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.4em] text-zion-gold/60">
                {cs ? 'Kanonická větev Terra Novy' : 'Canonical Terra Nova Branch'}
              </p>
              <button
                onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
                className="zion-button-secondary"
                title={lang === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}
              >
                {lang === 'cs' ? 'EN' : 'CS'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative min-h-[300px] overflow-hidden zion-rainbow-sub p-5 shadow-[0_0_80px_rgba(0,0,0,0.8)_inset,0_24px_90px_rgba(0,0,0,0.45)] md:p-6 md:min-h-[340px]" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.04)_0%,rgba(0,0,0,0)_100%)]" />
                {STARFIELD_POINTS.map((star, i) => (
                  <div
                    key={`star-${i}`}
                    className="absolute rounded-full bg-white"
                    style={{
                      top: star.top,
                      left: star.left,
                      width: star.size,
                      height: star.size,
                      opacity: star.opacity,
                    }}
                  />
                ))}
              </div>

              <div className="pointer-events-none absolute inset-0 text-sky-400/15">
                <svg width="100%" height="100%" className="absolute inset-0">
                  <line x1="12%" y1="0" x2="12%" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
                  <line x1="88%" y1="0" x2="88%" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
                  <line x1="0" y1="20%" x2="100%" y2="20%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
                  <line x1="0" y1="75%" x2="100%" y2="75%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
                  <circle cx="50%" cy="50%" r="140" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <circle cx="50%" cy="50%" r="220" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 12" />
                  <line x1="48.5%" y1="50%" x2="51.5%" y2="50%" stroke="rgba(56,189,248,0.4)" strokeWidth="1.5" />
                  <line x1="50%" y1="48.5%" x2="50%" y2="51.5%" stroke="rgba(56,189,248,0.4)" strokeWidth="1.5" />
                </svg>
              </div>

              <div className="pointer-events-none absolute -bottom-[420px] left-1/2 h-[600px] w-[150%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.25)_0%,rgba(5,25,50,0.95)_50%,rgba(0,0,0,1)_100%)] shadow-[0_-20px_100px_rgba(14,165,233,0.35)]" />
              <div className="pointer-events-none absolute -bottom-[420px] left-1/2 h-[600px] w-[150%] -translate-x-1/2 rounded-[50%] border-t-[3px] border-sky-300/40 shadow-[0_-4px_30px_rgba(56,189,248,0.6),inset_0_20px_40px_rgba(14,165,233,0.2)] blur-[1px]" />
              <div className="pointer-events-none absolute -bottom-[423px] left-1/2 h-[600px] w-[150%] -translate-x-1/2 rounded-[50%] border-t border-white/60 blur-[0.3px]" />

              <div className="relative z-10 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-cyan-300/80">
                  {cs ? 'ISSOBELLA // MODUL VÝHLEDU' : 'ISSOBELLA // OBSERVATION DECK'}
                </p>
                <p className="max-w-[85%] text-sm leading-relaxed text-gray-200 drop-shadow-md">
                  {cs
                    ? 'Tady se drží měřítko zítřka: pod tebou Země, nad tebou nekonečný oceán hvězd. Mezi tím naše rozhodnutí.'
                    : 'This is where tomorrow scale applies: Earth below, an endless ocean of stars above. In between, our choices.'}
                </p>
                <div
                  className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em]"
                  style={{
                    borderColor: currentEdition.border,
                    backgroundColor: currentEdition.bg,
                    color: currentEdition.color,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: currentEdition.color }} />
                  {cs ? currentEdition.nameCs : currentEdition.nameEn}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-5 left-5 right-5 flex items-end justify-between rounded-xl border border-sky-400/15 bg-black/30 p-3 backdrop-blur-md shadow-lg">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-sky-300">
                    ALT: 420.05 KM
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.3em] font-mono text-sky-300">
                    VEL: 7.66 KM/S
                  </p>
                </div>
                <div className="flex gap-1.5 opacity-80">
                  <div className="h-5 w-1.5 rounded-[1px] bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.8)]"></div>
                  <div className="h-5 w-1.5 rounded-[1px] bg-sky-400/70 shadow-[0_0_8px_rgba(56,189,248,0.6)]"></div>
                  <div className="h-5 w-1.5 rounded-[1px] bg-sky-500/40"></div>
                  <div className="h-5 w-1.5 rounded-[1px] bg-sky-600/20"></div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden zion-rainbow-card p-4 md:p-6" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zion-gold/70">
                    {cs ? 'Main Panel · Issobella Station' : 'Main Panel · Issobella Station'}
                  </p>
                  <p className="mt-1 text-sm text-gray-300">
                    {cs ? 'Interaktivní Zlatý Kompas' : 'Interactive Golden Compass'}
                  </p>
                </div>
                <div className="zion-badge-green">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                  {cs ? 'Navigace online' : 'Navigation online'}
                </div>
              </div>

              <div className="mb-4 zion-rainbow-sub p-3 md:p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                    {cs ? 'Body kompasu L1 až L6' : 'L1 to L6 Compass Nodes'}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.24em]" style={{ color: selectedDirection?.color ?? '#FFD700' }}>
                    {selectedDirection ? `${selectedDirection.symbol} · ${cs ? selectedDirection.titleCs : selectedDirection.titleEn}` : ''}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {ACCELERATION_DIRECTIONS.map((direction, index) => {
                    const isActive = compassDir === index;
                    return (
                      <button
                        key={`node-${direction.id}`}
                        onClick={() => setCompassDir(index)}
                        className="zion-rainbow-sub px-3 py-3 text-left transition-all"
                        style={{
                          '--rc': direction.rgb,
                          borderColor: isActive ? `rgba(${direction.rgb},0.42)` : undefined,
                          backgroundColor: isActive ? `rgba(${direction.rgb},0.12)` : undefined,
                          color: isActive ? direction.color : 'rgba(255,255,255,0.72)',
                        } as React.CSSProperties}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-[10px] font-bold"
                            style={{
                              borderColor: isActive ? `rgba(${direction.rgb},0.45)` : 'rgba(255,255,255,0.12)',
                              backgroundColor: isActive ? `rgba(${direction.rgb},0.18)` : 'rgba(255,255,255,0.03)',
                            }}
                          >
                            {direction.symbol}
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                            {cs ? direction.titleCs : direction.titleEn}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                          {cs ? direction.techCs : direction.techEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="zion-rainbow-sub p-3 md:p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                  <IssobellaCompass selected={compassDir} onSelect={setCompassDir} cs={cs} />
                </div>

                <div className="space-y-3">
                  <div className="zion-rainbow-sub p-4 min-h-[168px]" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    {selectedDirection ? (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: selectedDirection.color }}>
                          {cs ? 'Zvolený směr' : 'Selected Direction'}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold" style={{ color: selectedDirection.color }}>
                          {cs ? selectedDirection.titleCs : selectedDirection.titleEn}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-gray-300">
                          {cs ? selectedDirection.descCs : selectedDirection.descEn}
                        </p>
                        <div className="mt-3 zion-rainbow-sub px-3 py-2" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                          <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
                            {cs ? 'Technický bod' : 'Technical Point'}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-300">
                            {cs ? selectedDirection.techCs : selectedDirection.techEn}
                          </p>
                        </div>
                        <div className="mt-3 zion-rainbow-sub px-3 py-2.5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                          <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500">
                            {cs ? 'Checklist fáze' : 'Phase Checklist'}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {(cs ? selectedDirection.checklistCs : selectedDirection.checklistEn).map((item) => (
                              <li key={item} className="flex items-start gap-2 text-[12px] leading-snug text-gray-300">
                                <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full border" style={{ borderColor: selectedDirection.color, backgroundColor: `${selectedDirection.color}22` }} />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    ) : (
                      <div className="h-full min-h-[136px] flex items-center justify-center text-center text-sm text-gray-500">
                        {cs ? 'Klikni na směr v kompasu a otevři detail.' : 'Click a compass direction to open detail.'}
                      </div>
                    )}
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-300/80">
                          {cs ? 'Dharmachakra' : 'Dharmachakra'}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-emerald-200">
                          {cs ? 'Ušlechtilá osmidílná stezka' : 'The Noble Eightfold Path'}
                        </h3>
                      </div>
                      <p className="max-w-xs text-xs leading-relaxed text-emerald-100/70">
                        {cs
                          ? 'Buddhovo kolo Dharmy jako druhá navigační vrstva Terra Novy: osm paprsků, jedno vědomé jádro.'
                          : 'Buddha’s Wheel of Dharma as Terra Nova’s second navigation layer: eight spokes, one conscious core.'}
                      </p>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
                      <div className="mx-auto w-full max-w-[220px] rounded-[28px] border border-emerald-300/10 bg-[radial-gradient(circle_at_center,rgba(253,224,71,0.12),rgba(0,0,0,0)_45%),linear-gradient(180deg,rgba(16,185,129,0.08),rgba(0,0,0,0.18))] p-3 shadow-[0_16px_40px_rgba(16,185,129,0.08)]">
                        <motion.svg
                          viewBox="0 0 220 220"
                          className="h-auto w-full"
                          role="img"
                          aria-label={cs ? 'Dharmachakra s osmi paprsky' : 'Dharmachakra with eight spokes'}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                          <defs>
                            <radialGradient id="dharma-hub-glow" cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor="rgba(253,224,71,0.75)" />
                              <stop offset="55%" stopColor="rgba(245,158,11,0.25)" />
                              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                            </radialGradient>
                          </defs>
                          <motion.circle
                            cx="110"
                            cy="110"
                            r="98"
                            fill="url(#dharma-hub-glow)"
                            animate={{ opacity: [0.16, 0.28, 0.16] }}
                            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
                          />
                          <circle cx="110" cy="110" r="86" fill="rgba(16,185,129,0.06)" stroke="rgba(16,185,129,0.18)" strokeWidth="2" />
                          <motion.circle
                            cx="110"
                            cy="110"
                            r="86"
                            fill="none"
                            stroke="rgba(253,224,71,0.16)"
                            strokeWidth="1"
                            strokeDasharray="3 8"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
                            style={{ transformOrigin: '110px 110px' }}
                          />
                          <circle cx="110" cy="110" r="58" fill="rgba(245,158,11,0.05)" stroke="rgba(245,158,11,0.2)" strokeWidth="1.5" />
                          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                            <ellipse
                              key={`hub-petal-${angle}`}
                              cx="110"
                              cy="88"
                              rx="8"
                              ry="18"
                              fill="rgba(253,224,71,0.16)"
                              stroke="rgba(253,224,71,0.28)"
                              strokeWidth="0.8"
                              transform={`rotate(${angle} 110 110)`}
                            />
                          ))}
                          <motion.circle
                            cx="110"
                            cy="110"
                            r="34"
                            fill="none"
                            stroke="rgba(16,185,129,0.12)"
                            strokeWidth="8"
                            strokeDasharray="6 10"
                            animate={{ rotate: -360 }}
                            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                            style={{ transformOrigin: '110px 110px' }}
                          />
                          {DHARMA_WHEEL_SPOKES.map((spoke, index) => {
                            const isActive = dharmaSpoke === index;
                            const angle = ((index * 45) - 90) * (Math.PI / 180);
                            const x = 110 + Math.cos(angle) * 86;
                            const y = 110 + Math.sin(angle) * 86;
                            const innerX = 110 + Math.cos(angle) * 18;
                            const innerY = 110 + Math.sin(angle) * 18;
                            return (
                              <motion.g
                                key={spoke.id}
                                role="button"
                                tabIndex={0}
                                aria-label={cs ? spoke.titleCs : spoke.titleEn}
                                onClick={() => setDharmaSpoke(index)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setDharmaSpoke(index);
                                  }
                                }}
                                className="cursor-pointer"
                                animate={{ scale: isActive ? 1.035 : 1, opacity: isActive ? 1 : 0.86 }}
                                transition={{ duration: 0.28, ease: 'easeOut' }}
                              >
                                <motion.line
                                  x1={innerX}
                                  y1={innerY}
                                  x2={x}
                                  y2={y}
                                  stroke={isActive ? 'rgba(253,224,71,0.92)' : 'rgba(16,185,129,0.45)'}
                                  strokeWidth={isActive ? '4' : '3'}
                                  strokeLinecap="round"
                                  animate={{ opacity: isActive ? 1 : 0.72 }}
                                  transition={{ duration: 0.28, ease: 'easeOut' }}
                                />
                                <motion.circle
                                  cx={x}
                                  cy={y}
                                  r={isActive ? '9' : '7'}
                                  fill={isActive ? 'rgba(253,224,71,0.95)' : 'rgba(16,185,129,0.9)'}
                                  stroke="rgba(209,250,229,0.7)"
                                  strokeWidth="1.5"
                                  animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                                  transition={isActive ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.25 }}
                                />
                              </motion.g>
                            );
                          })}
                          <motion.circle
                            cx="110"
                            cy="110"
                            r="20"
                            fill="rgba(245,158,11,0.26)"
                            stroke="rgba(253,224,71,0.55)"
                            strokeWidth="1.5"
                            animate={{ scale: [1, 1.04, 1] }}
                            transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
                          />
                          <circle cx="110" cy="110" r="10" fill="rgba(254,240,138,0.92)" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
                          <text x="110" y="106" textAnchor="middle" className="fill-emerald-100 text-[10px] uppercase tracking-[0.28em]">
                            {cs ? 'Dharma' : 'Dharma'}
                          </text>
                          <text x="110" y="121" textAnchor="middle" className="fill-emerald-300 text-[8px] uppercase tracking-[0.22em]">
                            {dharmaSpoke + 1}/8
                          </text>
                        </motion.svg>
                      </div>
                      <div className="space-y-3">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={selectedDharmaSpoke.id}
                            initial={{ opacity: 0, y: 8, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.985 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="zion-rainbow-sub px-4 py-3"
                            style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                          >
                            <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-300/70">
                              {cs ? 'Aktivní paprsek' : 'Active spoke'}
                            </p>
                            <h4 className="mt-1 text-base font-semibold text-emerald-100">
                              {cs ? selectedDharmaSpoke.titleCs : selectedDharmaSpoke.titleEn}
                            </h4>
                            <p className="mt-2 text-sm leading-relaxed text-gray-300">
                              {cs ? selectedDharmaSpoke.descCs : selectedDharmaSpoke.descEn}
                            </p>
                            <div className="mt-3 zion-rainbow-sub px-3 py-2" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                              <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                                {cs ? 'ZION mapa' : 'ZION map'}
                              </p>
                              <p className="mt-1 text-sm text-emerald-100">
                                {cs ? selectedDharmaSpoke.mapCs : selectedDharmaSpoke.mapEn}
                              </p>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                        <div className="grid gap-2 sm:grid-cols-2">
                        {DHARMA_WHEEL_SPOKES.map((spoke, index) => {
                          const isActive = dharmaSpoke === index;
                          return (
                          <button
                            type="button"
                            onClick={() => setDharmaSpoke(index)}
                            key={spoke.id}
                            className="zion-rainbow-sub px-3 py-2.5 text-left transition-all"
                            style={{
                              '--rc': '251, 191, 36',
                              borderColor: isActive ? 'rgba(253,224,71,0.35)' : undefined,
                              backgroundColor: isActive ? 'rgba(253,224,71,0.08)' : undefined,
                            } as React.CSSProperties}
                          >
                            <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-300/70">
                              {index + 1}
                            </p>
                            <p className="mt-1 text-sm font-medium" style={{ color: isActive ? '#FDE047' : 'rgb(209 250 229 / 1)' }}>
                              {cs ? spoke.titleCs : spoke.titleEn}
                            </p>
                            <p className="mt-1 text-[12px] leading-snug text-gray-300">
                              {cs ? spoke.mapCs : spoke.mapEn}
                            </p>
                          </button>
                        );})}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    {cs
                      ? 'Každý bod kompasu je zároveň aktivní uzel roadmapy. Klikni na L1 až L6 nahoře nebo přímo do SVG.'
                      : 'Each compass point is also an active roadmap node. Click L1 to L6 above or directly inside the SVG.'}
                  </p>
                </div>
              </div>

              <div className="mt-8 zion-rainbow-sub p-6 md:p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                <PioneerProjectCards cs={cs} />
                <div className="mt-8 pt-6 border-t border-white/5">
                  <GeographyMenu cs={cs} />
                </div>
                <div className="mt-6 pt-6 border-t border-white/5">
                  <LayerMenu cs={cs} />
                </div>
              </div>

            </div>
          </div>
        </motion.section>

        {/* ═══════ BOOK HEADER ═══════ */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 space-y-5"
        >
          <div className="zion-badge-gold">
            <BookOpen className="h-4 w-4" />
            {cs ? 'Čtvrtá kniha ZION' : 'Fourth Book of ZION'}
          </div>

          <h1 className="zion-page-heading text-gradient">
            {cs ? meta.titleCs : meta.titleEn}
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 font-light">
            {cs ? meta.subtitleCs : meta.subtitleEn}
          </p>

          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            {cs ? meta.editionCs : meta.editionEn}
          </p>
        </motion.header>

        {/* ═══════ ABOUT + COMPOSITION ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-16 space-y-6"
        >
          <div className="zion-rainbow-card p-6 md:p-8 space-y-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <p className="text-gray-300 leading-relaxed">
              {cs ? meta.aboutCs : meta.aboutEn}
            </p>
            <p className="text-gray-400 leading-relaxed text-sm">
              {cs ? meta.layersCs : meta.layersEn}
            </p>

            <div className="border-t border-white/5 pt-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-3">
                {cs ? 'Kompoziční mapa' : 'Compositional Map'}
              </p>
              <ol className="space-y-1.5 list-none pl-0">
                {compositionLines.map((line: string, i: number) => (
                  <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-zion-gold/60 font-mono text-xs mt-0.5">{i + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </motion.section>

        {/* ═══════ TABLE OF CONTENTS (inline) ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-500 mb-5 text-center">
            {cs ? 'Obsah' : 'Contents'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {currentChapters.map((ch: typeof currentChapters[number], i: number) => {
              const isActive = activeChapter === i;
              const isAppendix = APPENDIX_NUMBERS.has(ch.number);
              return (
                <button
                  key={ch.id}
                  onClick={() => goTo(i)}
                  className="group flex items-start gap-3 zion-rainbow-sub p-4 text-left transition-all duration-300"
                  style={{
                    '--rc': ch.rgb,
                    borderColor: isActive ? `rgba(${ch.rgb},0.35)` : undefined,
                    backgroundColor: isActive ? `rgba(${ch.rgb},0.06)` : undefined,
                  } as React.CSSProperties}
                >
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl border text-xs font-bold transition-colors"
                    style={{
                      borderColor: `rgba(${ch.rgb},${isActive ? 0.4 : 0.15})`,
                      color: isActive ? ch.color : 'rgba(255,255,255,0.4)',
                      backgroundColor: `rgba(${ch.rgb},${isActive ? 0.1 : 0.03})`,
                    }}
                  >
                    {isAppendix ? ch.number : ch.number === 'Prolog' ? '✦' : chapterDigit(ch.number)}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    {ch.subtitleCs && (
                      <p className="line-clamp-2 text-[9px] uppercase tracking-[0.2em] text-gray-600 wrap-break-word">
                        {cs ? ch.subtitleCs : ch.subtitleEn}
                      </p>
                    )}
                    <p
                      className="mt-1 text-sm font-semibold leading-snug text-wrap transition-colors wrap-break-word"
                      style={{ color: isActive ? ch.color : 'rgba(255,255,255,0.65)' }}
                    >
                      {formatChapterLabel(ch, cs)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ CHAPTER READER ═══════ */}
        <div ref={contentRef} className="grid gap-4 md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
          <div className="lg:hidden sticky top-24 z-20 -mx-1 mb-2">
            <div className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gray-500">
                    {cs ? 'Čtecí režim' : 'Reading Mode'}
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {cs ? chapter.titleCs : chapter.titleEn}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
                    className="zion-button-secondary"
                  >
                    {lang === 'cs' ? 'EN' : 'CS'}
                  </button>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-gray-500">
                    {activeChapter + 1} / {currentChapters.length}
                  </p>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/6">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: chapter.color }}
                />
              </div>

            </div>
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-32">
            <div className="zion-rainbow-card p-5 space-y-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500">
                    {cs ? 'Čtecí režim' : 'Reading Mode'}
                  </p>
                  <button
                    onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:border-zion-gold/40 hover:text-zion-gold transition-colors"
                    title={lang === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}
                  >
                    {lang === 'cs' ? 'EN' : 'CS'}
                  </button>
                </div>
                <p className="mt-1 text-sm font-semibold text-white">{chapterLabel}</p>
                <p className="text-xs text-gray-500">{activeChapter + 1} / {currentChapters.length}</p>
              </div>

              <div className="space-y-2">
                <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: chapter.color }}
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-gray-400">
                  {cs
                    ? 'Každá kapitola drží jiný rytmus, ale stejnou disciplínu: realita, plán, horizont.'
                    : 'Each chapter holds a different rhythm, but the same discipline: reality, plan, horizon.'}
                </p>
              </div>

              <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-2">
                  {cs ? 'Aktivní kapitola' : 'Current Chapter'}
                </p>
                <p className="text-sm font-semibold" style={{ color: chapter.color }}>
                  {cs ? chapter.titleCs : chapter.titleEn}
                </p>
                {chapterEpigraph && (
                  <p className="mt-3 text-xs leading-relaxed text-gray-400 italic">
                    {chapterEpigraph}
                  </p>
                )}
              </div>

              <div className="text-[11px] leading-relaxed text-gray-500 space-y-1">
                <p>{cs ? 'Sipky vlevo/vpravo: další kapitoly' : 'Left/right arrows: next chapters'}</p>
                <p>{cs ? 'Esc: zavřít obsah' : 'Esc: close contents'}</p>
              </div>
            </div>
          </aside>

          <div>
            <AnimatePresence mode="wait">
              <motion.article
                key={chapter.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                className="zion-rainbow-card relative overflow-hidden p-5 sm:p-6 md:p-10 lg:p-14"
                style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
              >
              {/* Accent glow */}
              <div
                className="absolute -top-20 -right-20 h-48 w-48 rounded-full blur-[100px] opacity-20"
                style={{ backgroundColor: chapter.color }}
              />

              {/* Chapter header */}
              <div className="relative mb-8 md:mb-10">
                <div className="mb-4 flex flex-wrap items-start gap-3">
                  <span
                    className="zion-badge"
                    style={{
                      borderColor: `rgba(${chapter.rgb},0.3)`,
                      color: chapter.color,
                      backgroundColor: `rgba(${chapter.rgb},0.08)`,
                    }}
                  >
                    {chapter.subtitleCs && (cs ? chapter.subtitleCs : chapter.subtitleEn)}
                    {!chapter.subtitleCs &&
                      chapterLabel}
                  </span>
                  <span className="zion-badge">
                    {cs ? meta.editionCs : meta.editionEn}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {activeChapter + 1} / {currentChapters.length}
                  </span>
                </div>

                <h2
                  className="text-2xl sm:text-3xl md:text-4xl font-bold"
                  style={{ color: chapter.color }}
                >
                  {cs ? chapter.titleCs : chapter.titleEn}
                </h2>

                {(cs ? chapter.subtitleCs : chapter.subtitleEn) &&
                  chapter.number === 'Prolog' && (
                    <p className="mt-2 text-gray-400 italic">
                      {cs ? chapter.subtitleCs : chapter.subtitleEn}
                    </p>
                  )}

                {chapterEpigraph && (
                  <blockquote className="mt-5 max-w-2xl border-l-2 pl-4 text-sm italic leading-relaxed text-gray-300 sm:pl-5 md:text-base" style={{ borderColor: `${chapter.color}66` }}>
                    {chapterEpigraph}
                  </blockquote>
                )}

              </div>

              {/* Chapter body */}
              <div className="relative max-w-3xl space-y-7 md:space-y-8">
                {sections.map((sec: typeof sections[number], si: number) => {
                  const isLeadSection = si === 0;
                  const leadCharacter = isLeadSection ? sec.body.charAt(0) : '';
                  const bodyRest = isLeadSection ? sec.body.slice(1) : sec.body;
                  const dropCapBody = isLeadSection ? (leadCharacter + bodyRest) : sec.body;

                  return (
                    <div key={si} className="scroll-mt-36">
                      {sec.heading && (
                        <h3 className="mb-3 text-base font-semibold text-white sm:text-lg md:text-xl">
                          {sec.heading}
                        </h3>
                      )}
                      <article className="prose prose-invert prose-lg max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {dropCapBody}
                        </ReactMarkdown>
                      </article>
                    </div>
                  );
                })}
              </div>



              {/* ── Chapter navigation ── */}
              <div className="mt-10 flex items-center justify-between border-t border-white/5 pt-6 md:mt-12">
                <button
                  onClick={prev}
                  disabled={activeChapter === 0}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {activeChapter > 0 && (
                    <span className="hidden sm:inline">
                      {cs ? currentChapters[activeChapter - 1].titleCs : currentChapters[activeChapter - 1].titleEn}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setTocOpen(true)}
                  className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors"
                >
                  <List className="w-4 h-4" />
                  {cs ? 'Obsah' : 'Contents'}
                </button>

                <button
                  onClick={next}
                  disabled={activeChapter === currentChapters.length - 1}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  {activeChapter < currentChapters.length - 1 && (
                    <span className="hidden sm:inline">
                      {cs ? currentChapters[activeChapter + 1].titleCs : currentChapters[activeChapter + 1].titleEn}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              </motion.article>
            </AnimatePresence>
          </div>
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 text-center space-y-4"
        >
          <p className="text-gray-500 text-sm italic max-w-xl mx-auto">
            {cs
              ? 'Mrtvé mapy bývají přesné jen na papíře. Živé mapy dokážou přežít i cestu.'
              : 'Dead maps tend to be precise only on paper. Living maps can survive the journey.'}
          </p>
          <div className="flex items-center justify-center">
            <Link
              href="/docs"
              className="zion-button-secondary"
            >
              <BookOpen className="w-4 h-4" />
              {cs ? 'Dokumentace' : 'Documentation'}
            </Link>
          </div>
        </motion.footer>

        {/* ── pro Eričku ── */}
        <div className="mt-12 text-center select-none">
          <motion.svg
            viewBox="0 0 120 120"
            className="mx-auto w-36 h-36 cursor-pointer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              filter: [
                'drop-shadow(0 0 6px rgba(255,160,180,0.2))',
                'drop-shadow(0 0 24px rgba(255,160,180,0.65))',
                'drop-shadow(0 0 6px rgba(255,160,180,0.2))',
              ],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* outer petals – 6× @ 60° */}
            {[0, 60, 120, 180, 240, 300].map(a => (
              <g key={`op-${a}`} transform={`rotate(${a}, 60, 60)`}>
                <ellipse cx="60" cy="32" rx="9" ry="23"
                  fill="rgba(255,175,200,0.32)"
                  stroke="rgba(255,140,170,0.18)" strokeWidth="0.6" />
              </g>
            ))}
            {/* inner petals – 6× @ 30° offset */}
            {[30, 90, 150, 210, 270, 330].map(a => (
              <g key={`ip-${a}`} transform={`rotate(${a}, 60, 60)`}>
                <ellipse cx="60" cy="40" rx="7" ry="16"
                  fill="rgba(255,195,215,0.52)"
                  stroke="rgba(255,150,180,0.2)" strokeWidth="0.5" />
              </g>
            ))}
            {/* center */}
            <circle cx="60" cy="60" r="11" fill="rgba(255,210,0,0.42)" />
            <circle cx="60" cy="60" r="6.5" fill="rgba(255,238,150,0.75)" />
            <circle cx="60" cy="60" r="2.8" fill="rgba(255,255,255,0.88)" />
          </motion.svg>
          <p className="mt-4 text-sm italic text-pink-200/35 tracking-[0.18em]">
            pro vás ♡
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.26em] text-zion-gold/60">
            {flowersPerZionLabel}
          </p>
        </div>
      </div>

      {/* ═══════ FLOATING TOC OVERLAY ═══════ */}
      <AnimatePresence>
        {tocOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setTocOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[320px] max-w-[85vw] bg-black/95 backdrop-blur-xl border-r border-white/10 p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">
                  {cs ? 'Obsah' : 'Contents'}
                </h3>
                <button
                  onClick={() => setTocOpen(false)}
                  className="zion-button-secondary p-1.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {currentChapters.map((ch: typeof currentChapters[number], i: number) => {
                  const isActive = activeChapter === i;
                  const isAppendix = APPENDIX_NUMBERS.has(ch.number);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => goTo(i)}
                      className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3"
                      style={{
                        backgroundColor: isActive ? `rgba(${ch.rgb},0.1)` : 'transparent',
                        borderLeft: isActive ? `3px solid ${ch.color}` : '3px solid transparent',
                      }}
                    >
                      <span
                        className="text-xs font-mono w-5 text-center shrink-0"
                        style={{ color: isActive ? ch.color : 'rgba(255,255,255,0.3)' }}
                      >
                        {isAppendix ? ch.number : ch.number === 'Prolog' ? '✦' : chapterDigit(ch.number)}
                      </span>
                      <span
                        className="text-sm truncate"
                        style={{ color: isActive ? ch.color : 'rgba(255,255,255,0.6)' }}
                      >
                        {cs ? ch.titleCs : ch.titleEn}
                      </span>
                    </button>
                  );
                })}
              </nav>


            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {overlayMode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-black/72 backdrop-blur-md"
              onClick={() => setOverlayMode(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.24 }}
              className="fixed inset-x-3 top-[6vh] z-70 mx-auto max-h-[88vh] w-full max-w-4xl overflow-hidden zion-rainbow-card shadow-[0_30px_120px_rgba(0,0,0,0.58)] sm:inset-x-4 sm:top-[8vh] sm:max-h-[84vh]"
              style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                    {cs ? 'Terra Nova overlay' : 'Terra Nova Overlay'}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    {overlayMode === 'genesis'
                      ? cs
                        ? 'Genesis panel uvnitř Terra Novy'
                        : 'Genesis Panel Inside Terra Nova'
                      : cs
                        ? 'Visual Zion CLI panel'
                        : 'Visual ZION CLI Panel'}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setOverlayMode('genesis')}
                    className="zion-badge transition-colors"
                    style={{
                      borderColor:
                        overlayMode === 'genesis' ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.1)',
                      backgroundColor:
                        overlayMode === 'genesis' ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
                      color: overlayMode === 'genesis' ? 'rgb(251,191,36)' : 'rgba(255,255,255,0.75)',
                    }}
                  >
                    Genesis.md
                  </button>
                  <button
                    onClick={() => setOverlayMode('cli')}
                    className="zion-badge transition-colors"
                    style={{
                      borderColor:
                        overlayMode === 'cli' ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.1)',
                      backgroundColor:
                        overlayMode === 'cli' ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                      color: overlayMode === 'cli' ? 'rgb(34,211,238)' : 'rgba(255,255,255,0.75)',
                    }}
                  >
                    ZION CLI
                  </button>
                  <button
                    onClick={() => setOverlayMode(null)}
                    className="zion-button-secondary p-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(84vh-84px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                {overlayMode === 'genesis' ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="zion-rainbow-sub p-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                      <p className="text-[10px] uppercase tracking-[0.32em] text-zion-gold/70">
                        Genesis.md
                      </p>
                      <pre className="mt-3 overflow-x-auto whitespace-pre text-[7px] leading-tight text-zion-gold/28 sm:text-[8px]">{GENESIS_TREE}</pre>
                      <pre className="mt-4 overflow-x-auto whitespace-pre font-mono text-[10px] leading-relaxed text-zion-gold/90 sm:text-[11px]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
{GENESIS_BANNER}
                      </pre>
                      <blockquote className="mt-5 border-l-2 border-zion-gold/35 pl-4 text-sm italic leading-relaxed text-gray-300 whitespace-pre-line">
                        {introDedication}
                      </blockquote>
                      <p className="mt-3 text-[11px] italic text-gray-600">
                        — Yeshuae Ben Yose / Zion Creator | Om Namo Hiranyagarbha
                      </p>
                      <p className="mt-4 text-xs uppercase tracking-[0.28em] text-gray-500">
                        {introQuote}
                      </p>

                      {/* ── Premine Genesis ── */}
                      <div className="mt-5 zion-rainbow-sub px-4 py-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                        <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-zion-gold/70">
                          {cs ? 'Genesis premine · 16 280 000 000 ZION' : 'Genesis Premine · 16,280,000,000 ZION'}
                        </p>
                        <div className="space-y-1.5 font-mono text-[10px] text-gray-400">
                          <div className="flex justify-between gap-2"><span className="text-gray-500">OASIS Golden Egg ×5</span><span className="text-zion-gold/80">8.25B ZION</span></div>
                          <div className="flex justify-between gap-2"><span className="text-gray-500">{cs ? 'DAO Pokladna' : 'DAO Treasury'} ×3</span><span className="text-zion-gold/80">4.00B ZION</span></div>
                          <div className="flex justify-between gap-2"><span className="text-gray-500">{cs ? 'Infrastruktura + Vývoj' : 'Infrastructure + Dev'} ×2</span><span className="text-zion-gold/80">2.00B ZION</span></div>
                          <div className="flex justify-between gap-2"><span className="text-gray-500">{cs ? 'Genesis Projects (Dharma Temple, Piko de Ora + DAO)' : 'Genesis Projects (Dharma Temple, Piko de Ora + DAO)'}</span><span className="text-zion-gold/80">0.59B ZION</span></div>
                          <div className="flex justify-between gap-2"><span className="text-gray-500">{cs ? 'Humanitární DAO' : 'Humanitarian DAO'}</span><span className="text-zion-gold/80">1.44B ZION</span></div>
                          <div className="border-t border-white/8 pt-1.5 flex justify-between gap-2"><span className="text-gray-400 font-semibold">{cs ? 'Celkem genesis' : 'Total genesis'}</span><span className="text-zion-gold font-bold">16.28B ZION</span></div>
                        </div>
                        <p className="mt-3 text-[9px] uppercase tracking-[0.24em] text-gray-600">
                          {cs ? 'Split bloků: 89% miner · 5% humanitární · 5% Issobella · 1% pool' : 'Block split: 89% miner · 5% humanitarian · 5% Issobella · 1% pool'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="zion-rainbow-sub p-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                          {cs ? 'Proč je to tady' : 'Why It Lives Here'}
                        </p>
                        <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-300">
                          {genesisOverlayLines.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      </div>

                      <Link
                        href="/genesis"
                        className="zion-button-secondary"
                        onClick={() => setOverlayMode(null)}
                      >
                        <BookOpen className="h-4 w-4" />
                        {cs ? 'Přejít na plnou Genesis stránku' : 'Open Full Genesis Page'}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="overflow-hidden zion-rainbow-sub" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        </div>
                        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zion-cyan/70">
                          <Terminal className="h-3.5 w-3.5" />
                          {cs ? 'Visual Zion CLI' : 'Visual ZION CLI'}
                        </div>
                      </div>
                      <div className="space-y-3 p-4 font-mono text-[12px] text-gray-200">
                        {BOOT_SEQUENCE.map((line) => (
                          <div key={line.command} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                            <div className="flex gap-3">
                              <span className="text-zion-gold">$</span>
                              <span className="break-all">{line.command}</span>
                            </div>
                            <div className="mt-2 pl-6 text-[11px] uppercase tracking-[0.22em] text-emerald-300/75">
                              {cs ? line.responseCs : line.responseEn}
                            </div>
                          </div>
                        ))}

                        <div className="zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-zion-cyan/75">
                            {cs ? 'Ruční příkazy' : 'Manual Commands'}
                          </p>
                          <div className="mt-3 space-y-2 text-gray-300">
                            {CLI_PRESET.map((line) => (
                              <div key={line} className="flex gap-3">
                                <span className="text-zion-gold">$</span>
                                <span className="break-all">{line}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="zion-rainbow-sub p-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                          {cs ? 'Proč je to tady' : 'Why It Lives Here'}
                        </p>
                        <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-300">
                          {cliOverlayLines.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                      </div>

                      {/* ── Premine tabulka ── */}
                      <div className="zion-rainbow-sub p-5" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-zion-cyan/70">
                          {cs ? 'Genesis Premine · 16.28B ZION' : 'Genesis Premine · 16.28B ZION'}
                        </p>
                        <div className="mt-3 space-y-1.5 font-mono text-[10px]">
                          {[
                            { label: cs ? 'OASIS Golden Egg ×5' : 'OASIS Golden Egg ×5', amount: '8.25B' },
                            { label: cs ? 'DAO Pokladna ×3' : 'DAO Treasury ×3', amount: '4.00B' },
                            { label: cs ? 'Infrastruktura + Vývoj ×2' : 'Infrastructure + Dev ×2', amount: '2.00B' },
                            { label: cs ? 'Humanitární DAO' : 'Humanitarian DAO', amount: '1.44B' },
                            { label: cs ? 'Genesis Projects (Dharma Temple, Piko de Ora + DAO)' : 'Genesis Projects (Dharma Temple, Piko de Ora + DAO)', amount: '0.59B' },
                          ].map(({ label, amount }) => (
                            <div key={label} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-gray-500">
                                <span className="text-zion-cyan/40">▸</span>
                                {label}
                              </span>
                              <span className="text-zion-cyan/80 tabular-nums">{amount}</span>
                            </div>
                          ))}
                          <div className="border-t border-white/8 pt-1.5 flex justify-between gap-2">
                            <span className="text-gray-400 font-semibold">{cs ? 'Celkem' : 'Total'}</span>
                            <span className="text-zion-cyan font-bold tabular-nums">16.28B ZION</span>
                          </div>
                        </div>
                        <div className="mt-3 zion-rainbow-sub px-3 py-2" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-gray-600">
                            {cs ? 'split/blok: 89% miner · 5% humanitární · 5% issobella · 1% pool' : 'per-block split: 89% miner · 5% humanitarian · 5% issobella · 1% pool'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setOverlayMode(null);
                          setTocOpen(true);
                        }}
                        className="zion-button-secondary"
                      >
                        <List className="h-4 w-4" />
                        {cs ? 'Přejít do obsahu Terra Novy' : 'Open Terra Nova Contents'}
                      </button>

                      <Link
                        href="/docs"
                        className="zion-button-secondary"
                        onClick={() => setOverlayMode(null)}
                      >
                        <Terminal className="h-4 w-4" />
                        {cs ? 'Real ZION CLI dokumentace' : 'Real ZION CLI Docs'}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScrollTop && !tocOpen && !overlayOpen && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-200 shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur-lg transition-colors hover:bg-black/80"
          >
            <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
            {cs ? 'Nahoru' : 'Top'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
