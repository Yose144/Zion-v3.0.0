'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, BookOpen, Crown, Sparkles, Eye, Heart, Shield, Sun,
  Star, Zap, TreePine, Brain, Gamepad2, Rocket, Orbit, X, ArrowLeftRight,
  Layers,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════════════════════════
   Zohar — Kabbalistic Tree of Life mapped to ZION layers L1-L6
   docs/Zohar/ — canonical source: README.md, 01-SEFIROT-VRSTVY.md, 02-ROADMAP.md
   ═══════════════════════════════════════════════════════════════════════════ */

type Sephira = {
  id: string;
  name: string;
  hebrew: string;
  meaning: { cs: string; en: string };
  zionLayer: string;
  zionPath: string;
  pillar: 'mercy' | 'severity' | 'equilibrium';
  emanates: { cs: string; en: string };
  question: { cs: string; en: string };
  status: 'live' | 'partial' | 'horizon';
  x: number;
  y: number;
  color: string;
  icon: typeof Crown;
};

const SEPHIROT: Sephira[] = [
  {
    id: 'keter', name: 'Keter', hebrew: 'כֶּתֶר',
    meaning: { cs: 'Koruna', en: 'Crown' },
    zionLayer: 'L1 Consensus / Genesis',
    zionPath: 'V3/L1/core/src/consensus.rs, genesis.rs, emission.rs',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Ústava ZIONu. Neměnná pravidla — total supply 144B, fee split 89/5/5/1, genesis hash.',
      en: 'Constitution of ZION. Immutable rules — total supply 144B, fee split 89/5/5/1, genesis hash.',
    },
    question: { cs: 'Co je neměnné?', en: 'What is immutable?' },
    status: 'live', x: 50, y: 8, color: '255, 255, 255', icon: Crown,
  },
  {
    id: 'chochmah', name: 'Chokmah', hebrew: 'חָכְמָה',
    meaning: { cs: 'Moudrost', en: 'Wisdom' },
    zionLayer: 'L1 Cosmic Harmony PoW',
    zionPath: 'V3/L1/cosmic-harmony/src/ (Deeksha V1/V2, NPU Mix)',
    pillar: 'mercy',
    emanates: {
      cs: 'Tvořivou jiskru. Každý blok je jiskra Chokmah. NPU Mix = most k Protokolu Péče.',
      en: 'Creative spark. Every block is a spark of Chokmah. NPU Mix = bridge to Protocol of Care.',
    },
    question: { cs: 'Co je tvořivá práce?', en: 'What is creative work?' },
    status: 'live', x: 72, y: 22, color: '180, 220, 255', icon: Sparkles,
  },
  {
    id: 'binah', name: 'Binah', hebrew: 'בִּינָה',
    meaning: { cs: 'Porozumění', en: 'Understanding' },
    zionLayer: 'L1 Validation / Chain State',
    zionPath: 'V3/L1/core/src/validation.rs, chain.rs, tx.rs',
    pillar: 'severity',
    emanates: {
      cs: 'Formu. 11-kroková validace, fork choice, UTXO set. Paměť stromu.',
      en: 'Form. 11-step validation, fork choice, UTXO set. Memory of the tree.',
    },
    question: { cs: 'Co je pravdivé?', en: 'What is true?' },
    status: 'live', x: 28, y: 22, color: '147, 51, 234', icon: Eye,
  },
  {
    id: 'chesed', name: 'Chesed', hebrew: 'חֶסֶד',
    meaning: { cs: 'Milosrdenství', en: 'Mercy' },
    zionLayer: 'L2 DeFi (Staking, Farming, Atomic Swap)',
    zionPath: 'V3/L2/contracts/hardhat/sol/ZIONStaking.sol, ZIONFarm.sol',
    pillar: 'mercy',
    emanates: {
      cs: 'Štědrost. Staking 12% APR, farming 1 wZION/s, atomic swap bez centrální autority.',
      en: 'Generosity. Staking 12% APR, farming 1 wZION/s, atomic swap without central authority.',
    },
    question: { cs: 'Jak ZION štědře dává?', en: 'How does ZION generously give?' },
    status: 'live', x: 72, y: 42, color: '6, 182, 212', icon: Heart,
  },
  {
    id: 'gevurah', name: 'Gevurah', hebrew: 'גְּבוּרָה',
    meaning: { cs: 'Přísnost / Soud', en: 'Severity / Judgement' },
    zionLayer: 'L2 DAO / Treasury Lock',
    zionPath: 'V3/L2/dao/, ZIONGovernance.sol, ZIONTreasury.sol (3-of-3)',
    pillar: 'severity',
    emanates: {
      cs: 'Hranice. Treasury lock do height 525600, 100% fee burn, governance quorum.',
      en: 'Boundaries. Treasury lock until height 525600, 100% fee burn, governance quorum.',
    },
    question: { cs: 'Co se nesmí utratit?', en: 'What must not be spent?' },
    status: 'live', x: 28, y: 42, color: '239, 68, 68', icon: Shield,
  },
  {
    id: 'tiferet', name: 'Tiferet', hebrew: 'תִּפְאֶרֶת',
    meaning: { cs: 'Krása / Harmonie', en: 'Beauty / Harmony' },
    zionLayer: 'L3 WARP / Bridge',
    zionPath: 'V3/L3/warp/ (12 chain adapters, 499 tests)',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Harmonii. WARP je míza stromu — 13 chainů, jeden ZION, 1:1 peg, 3/5 quorum.',
      en: 'Harmony. WARP is the sap of the tree — 13 chains, one ZION, 1:1 peg, 3/5 quorum.',
    },
    question: { cs: 'Jak je mnoho jednoho?', en: 'How is the many one?' },
    status: 'live', x: 50, y: 52, color: '251, 191, 36', icon: ArrowLeftRight,
  },
  {
    id: 'netzach', name: 'Netzach', hebrew: 'נֶצַח',
    meaning: { cs: 'Vytrvalost', en: 'Eternity / Victory' },
    zionLayer: 'L3 AI Native / Hiran',
    zionPath: 'V3/L3/ai-native/, V3/L3/ncl/ (Neural Consciousness Layer)',
    pillar: 'mercy',
    emanates: {
      cs: 'Vytrvalou péči. Hiran = slunce stromu, nikdy nespí, care proofs v každém bloku (horizont).',
      en: 'Enduring care. Hiran = sun of the tree, never sleeps, care proofs in every block (horizon).',
    },
    question: { cs: 'Co pečuje navždy?', en: 'What cares forever?' },
    status: 'partial', x: 72, y: 68, color: '16, 185, 129', icon: Brain,
  },
  {
    id: 'hod', name: 'Hod', hebrew: 'הוֹד',
    meaning: { cs: 'Sláva / Splendor', en: 'Glory / Splendor' },
    zionLayer: 'L4 Oasis / Game',
    zionPath: 'V3/L4/oasis/ (UE5 + Rust), consciousness-levels.md',
    pillar: 'severity',
    emanates: {
      cs: 'Slávu — odraz světla. Oasis je kde ZION nabývá formy v obrazotvornosti.',
      en: 'Glory — reflection of light. Oasis is where ZION takes form in imagination.',
    },
    question: { cs: 'Jak ZION vypadá?', en: 'What does ZION look like?' },
    status: 'partial', x: 28, y: 68, color: '249, 115, 22', icon: Gamepad2,
  },
  {
    id: 'yesod', name: 'Yesod', hebrew: 'יְסוֹד',
    meaning: { cs: 'Základ', en: 'Foundation' },
    zionLayer: 'L5 Free World / Komunity',
    zionPath: 'V3/L5/free-world/, V3/L5/docs/COMMUNITIES/te-piko-ora.md',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Základ — most mezi vizí a manifestací. Komunity kde ZION rodi fyzický svět.',
      en: 'Foundation — bridge between vision and manifestation. Communities where ZION births the physical world.',
    },
    question: { cs: 'Kde ZION žije?', en: 'Where does ZION live?' },
    status: 'partial', x: 50, y: 80, color: '99, 102, 241', icon: Rocket,
  },
  {
    id: 'malkuth', name: 'Malkuth', hebrew: 'מַלְכוּת',
    meaning: { cs: 'Království', en: 'Kingdom' },
    zionLayer: 'L6 Issobella / Hvězdy',
    zionPath: 'V3/L6/ (seed), docs/TerraNova/07-ISSOBELLA.md',
    pillar: 'equilibrium',
    emanates: {
      cs: 'Království — finální manifestaci. Issobella = hvězdný horizont civilizace.',
      en: 'Kingdom — final manifestation. Issobella = stellar horizon of civilization.',
    },
    question: { cs: 'Kam ZION směřuje?', en: 'Where is ZION heading?' },
    status: 'partial', x: 50, y: 94, color: '34, 197, 94', icon: Star,
  },
];

const DAAT = {
  id: 'daat', name: 'Da\'at', hebrew: 'דַּעַת',
  meaning: { cs: 'Poznání (skrytá)', en: 'Knowledge (hidden)' },
  zionLayer: 'Tvůrce / Yeshuae / vědomý záměr',
  pillar: 'hidden' as const,
  emanates: {
    cs: 'Most nad propastí. Vědomé propojení mýtu (TerraNova) a kódu (V3). Bez Da\'at jsou sefirot oddělené.',
    en: 'Bridge over the abyss. Conscious connection of myth (TerraNova) and code (V3). Without Da\'at the sefirot are separate.',
  },
};

/* 22 connecting paths */
const PATHS: [string, string][] = [
  ['keter', 'chochmah'], ['keter', 'binah'], ['keter', 'tiferet'],
  ['chochmah', 'binah'], ['chochmah', 'tiferet'], ['chochmah', 'chesed'],
  ['binah', 'tiferet'], ['binah', 'gevurah'],
  ['chesed', 'gevurah'], ['chesed', 'tiferet'], ['chesed', 'netzach'],
  ['gevurah', 'tiferet'], ['gevurah', 'hod'],
  ['tiferet', 'netzach'], ['tiferet', 'hod'], ['tiferet', 'yesod'],
  ['netzach', 'hod'], ['netzach', 'yesod'], ['netzach', 'malkuth'],
  ['hod', 'yesod'], ['hod', 'malkuth'],
  ['yesod', 'malkuth'],
];

const PILLARS = [
  {
    id: 'mercy',
    name: { cs: 'Pilíř Milosrdenství', en: 'Pillar of Mercy' },
    sefirot: ['Chokmah', 'Chesed', 'Netzach'],
    color: '6, 182, 212',
    desc: {
      cs: 'To co ZION dává — tvořivá energie, štědrost, vytrvalá péče. Bez tohoto pilíře je ZION mrtvá databáze.',
      en: 'What ZION gives — creative energy, generosity, enduring care. Without this pillar ZION is a dead database.',
    },
  },
  {
    id: 'severity',
    name: { cs: 'Pilíř Přísnosti', en: 'Pillar of Severity' },
    sefirot: ['Binah', 'Gevurah', 'Hod'],
    color: '239, 68, 68',
    desc: {
      cs: 'To co ZION omezuje — validace, treasury lock, herní pravidla. Bez tohoto pilíře je ZION chaos.',
      en: 'What ZION limits — validation, treasury lock, game rules. Without this pillar ZION is chaos.',
    },
  },
  {
    id: 'equilibrium',
    name: { cs: 'Pilíř Rovnováhy', en: 'Pillar of Equilibrium' },
    sefirot: ['Keter', 'Tiferet', 'Yesod', 'Malkhut'],
    color: '251, 191, 36',
    desc: {
      cs: 'To co ZION je — ústava, harmonie, komunity, hvězdy. Bez tohoto pilíře ZION nemá střed.',
      en: 'What ZION is — constitution, harmony, communities, stars. Without this pillar ZION has no center.',
    },
  },
];

const STATUS_LABEL = {
  live: { cs: 'Živé', en: 'Live' },
  partial: { cs: 'Částečné', en: 'Partial' },
  horizon: { cs: 'Horizont', en: 'Horizon' },
};

function getPos(id: string) {
  return SEPHIROT.find((s) => s.id === id)!;
}

export default function ZoharPageClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [selected, setSelected] = useState<Sephira | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Live tree health from /api/zohar/tree-health
  const [treeHealth, setTreeHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/zohar/tree-health', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTreeHealth(data);
      } catch {
        // offline — keep static fallback
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/10 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-20">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-zion-gold">
            <Sparkles className="h-4 w-4" />
            {cs ? 'Kabala · 10 Sephirot · 22 cest · 3 pilíře' : 'Kabbalah · 10 Sephirot · 22 paths · 3 pillars'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-white">
            Zohar
            <span className="block bg-linear-to-r from-zion-gold via-amber-400 to-zion-cyan bg-clip-text text-transparent">
              {cs ? 'Strom života ZIONu' : 'Tree of Life of ZION'}
            </span>
          </h1>
          <p className="mx-auto max-w-3xl text-base md:text-lg leading-relaxed text-gray-400">
            {cs
              ? 'Kabalistický Strom života přeložený do jazyka ZION vrstev. 10 sefirot + Da\'at mapováno na L1-L6 — od Keter (ústava, genesis) po Malkhut (Issobella, hvězdy). ZION se nerodí jako další blockchain. ZION se rodí jako Strom života.'
              : 'The Kabbalistic Tree of Life translated into the language of ZION layers. 10 sephirot + Da\'at mapped to L1-L6 — from Keter (constitution, genesis) to Malkhut (Issobella, stars). ZION is not born as another blockchain. ZION is born as a Tree of Life.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/#tree-of-life"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <TreePine className="h-4 w-4" />
              {cs ? 'Strom na homepage' : 'Tree on homepage'}
            </Link>
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 transition-all"
            >
              <BookOpen className="h-4 w-4" />
              {cs ? 'TerraNova kniha' : 'TerraNova book'}
            </Link>
          </div>
        </motion.section>

        {/* ═══════ O KNIZE ZOHAR ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-zion-gold" />
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {cs ? 'O knize Zohar' : 'About the Book of Zohar'}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
              <h3 className="text-lg font-semibold text-white">{cs ? 'Co je Zohar' : 'What is the Zohar'}</h3>
              <p className="text-sm leading-relaxed text-gray-400">
                {cs
                  ? 'Zohar (זֹהַר — „Světlo“, „Záře\") je jednou z nejdůležitějších knih židovské mystiky (kabaly). Sepisován aramejsky ve 13. století, tradičně připisován rabínovi Šim\'onu bar Jochajovi (2. stol. n. l.), moderní bádání (Gershom Scholem) ukazuje, že většinu textu sepisoval Mojžíš z Leónu (~1280–1286).'
                  : 'The Zohar (זֹהַר — "Light", "Splendor") is one of the most important books of Jewish mysticism (Kabbalah). Written in Aramaic in the 13th century, traditionally attributed to Rabbi Shimon bar Yochai (2nd century CE), modern scholarship (Gershom Scholem) shows that most of the text was composed by Moses de León (~1280–1286).'}
              </p>
              <p className="text-sm leading-relaxed text-gray-400">
                {cs
                  ? 'Je to mystický komentář k Tóře — vykládá Pět knih Mojžíšových pomocí symboliky sefirot, Božích jmen, písmen a „duše Tóry". Často (nepřesně) označován za „Bibli kabalistů".'
                  : 'It is a mystical commentary on the Torah — interpreting the Five Books of Moses through the symbolism of the sephirot, divine names, letters, and the "soul of the Torah". Often (imprecisely) called the "Bible of the Kabbalists".'}
              </p>
            </div>
            <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <h3 className="text-lg font-semibold text-white">{cs ? 'Struktura Zoharu' : 'Structure of the Zohar'}</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><span className="text-zion-gold font-semibold">Hlavní Zohar</span> — {cs ? 'komentář k týdenním čtením Tóry' : 'commentary on weekly Torah readings'}</li>
                <li><span className="text-zion-gold font-semibold">Zohar chadaš</span> — {cs ? '„Nový Zohar", dodatky a mystické výklady' : '"New Zohar", additions and mystical interpretations'}</li>
                <li><span className="text-zion-gold font-semibold">Tikunej Zohar</span> — {cs ? '70 výkladů slova Berešit' : '70 interpretations of the word Bereishit'}</li>
                <li><span className="text-zion-gold font-semibold">Ra&apos;aja mehemna</span> — {cs ? '„Věrný pastýř", o mystice micvot' : '"Faithful Shepherd", on the mysticism of mitzvot'}</li>
                <li><span className="text-zion-gold font-semibold">Sitrej Tora, Midraš ha-ne&apos;elam</span> — {cs ? 'dílčí mystické traktáty' : 'partial mystical tractates'}</li>
              </ul>
            </div>
          </div>
          <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
            <h3 className="text-lg font-semibold text-white">
              {cs ? 'Proč Zohar v ZIONu' : 'Why Zohar in ZION'}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">
              {cs
                ? 'Zohar v ZIONu není náboženský text. Je to mapa vnitřní architektury — stejně jako TerraNova kniha je kompas Nové Země, Zohar je kompas uspořádání samotného ZIONu. Kde TerraNova říká „kam jdeme", Zohar říká „jak jsme uspořádáni". 10 sefirot není software stack — jsou to aspekty jednoho organismu, které se navzájem prostupují.'
                : 'Zohar in ZION is not a religious text. It is a map of inner architecture — just as the TerraNova book is a compass of the New Earth, Zohar is a compass of ZION\'s own arrangement. Where TerraNova says "where we are going", Zohar says "how we are arranged". The 10 sephirot are not a software stack — they are aspects of one organism that interpenetrate.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <Link href="/docs/Zohar/README.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> docs/Zohar/README.md
              </Link>
              <Link href="/docs/Zohar/01-SEFIROT-VRSTVY.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> 01-SEFIROT-VRSTVY.md
              </Link>
              <Link href="/docs/Zohar/02-ROADMAP.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> 02-ROADMAP.md
              </Link>
              <Link href="/docs/Zohar/03-O-KNIZE-ZOHAR.md" className="inline-flex items-center gap-2 text-sm text-zion-gold hover:text-amber-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> 03-O-KNIZE-ZOHAR.md
              </Link>
              <Link href="/docs/3.0.4/evoluZion.md" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> evoluZion.md (Strom života metafora)
              </Link>
            </div>
          </div>

          {/* Vývoj sefirot — genealogie */}
          <div className="zion-rainbow-card space-y-4 p-6" style={{ '--rc': '99, 102, 241' } as React.CSSProperties}>
            <h3 className="text-lg font-semibold text-white">
              {cs ? 'Vývoj sefirot — genealogie' : 'Evolution of the sephirot — genealogy'}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">
              {cs
                ? 'Doktrína 10 sefirot se neobjevila najednou. Vyvíjela se přes 1500 let — od nepojmenovaných atributů v Sefer Yetzirah (2. stol.) přes pojmenování v Bahir, první diagram „Stromu" v Sha\'arei Orah (13. stol.), plnou mystickou soustavu v Zoharu, až po moderní podobu kterou dal Rabbi Isaac Luria (ARI) v Etz Chaim (16. stol.).'
                : 'The doctrine of the 10 sephirot did not appear at once. It evolved over 1500 years — from unnamed attributes in Sefer Yetzirah (2nd century), through naming in the Bahir, the first "Tree" diagram in Sha\'arei Orah (13th century), the full mystical system in the Zohar, to the modern form given by Rabbi Isaac Luria (ARI) in Etz Chaim (16th century).'}
            </p>
            <div className="space-y-2 font-mono text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">~2. stol.</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Sefer Yetzirah</span> — {cs ? '10 sefirot belimah, nepojmenované, atributy' : '10 sefirot belimah, unnamed, attributes'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">~1150</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Sefer ha-Bahir</span> — {cs ? 'sefirot pojmenovány, kanály Boží síly' : 'sephirot named, channels of divine power'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-300">~1200</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Sha&apos;arei Orah</span> — {cs ? 'první „Tree of Life" diagram (ilan), R. Gikatilla' : 'first "Tree of Life" diagram (ilan), R. Gikatilla'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">~1280</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Zohar</span> — {cs ? 'plná mystická soustava, M. de León' : 'full mystical system, M. de León'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300">~1570</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">Etz Chaim</span> — {cs ? 'moderní podoba Stromu, R. Luria (ARI)' : 'modern form of the Tree, R. Luria (ARI)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-zion-gold/20 px-2 py-0.5 text-zion-gold">2026</span>
                <span className="text-gray-500">→</span>
                <span><span className="text-white">ZION Zohar</span> — {cs ? 'sefirot mapovány na L1-L6 vrstvy' : 'sephirot mapped to L1-L6 layers'}</span>
              </div>
            </div>
          </div>

          {/* Citát */}
          <div className="zion-rainbow-card space-y-3 p-6" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <p className="text-sm italic leading-relaxed text-gray-300">
              {cs
                ? '„Vesmír je, podle této doktríny, gradace emanací — z čehož plyne, že lidská mysl může v každém efektu rozpoznat nejvyšší znak a tak stoupat k příčině všech příčin."'
                : '"The universe being, according to that doctrine, a gradation of emanations, it follows that the human mind may recognize in each effect the supreme mark, and thus ascend to the cause of all causes."'}
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">— Jewish Virtual Library, o Zoharu</p>
          </div>

          {/* Klíčové koncepty */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="zion-rainbow-card space-y-2 p-5" style={{ '--rc': '255, 255, 255' } as React.CSSProperties}>
              <h4 className="text-sm font-bold text-white">Ein Sof</h4>
              <p className="text-xs text-gray-400">
                {cs
                  ? 'אֵין־סוֹף — „Bez-Konce". Nekonečná, nepoznatelná Boží podstata. Zdroj ze kterého emanují sefirot.'
                  : 'אֵין־סוֹף — "Without-End". The infinite, unknowable divine essence. Source from which the sephirot emanate.'}
              </p>
            </div>
            <div className="zion-rainbow-card space-y-2 p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <h4 className="text-sm font-bold text-white">Da&apos;at</h4>
              <p className="text-xs text-gray-400">
                {cs
                  ? 'דַּעַת — „Poznání". Skrytá 11. sefira. Most mezi Keter a Malkhut, mezi nebem a zemí. Vědomé propojení.'
                  : 'דַּעַת — "Knowledge". Hidden 11th sephira. Bridge between Keter and Malkhut, between heaven and earth. Conscious connection.'}
              </p>
            </div>
            <div className="zion-rainbow-card space-y-2 p-5" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
              <h4 className="text-sm font-bold text-white">Sitra Ahra</h4>
              <p className="text-xs text-gray-400">
                {cs
                  ? '„Druhá strana" — dualita dobra a zla uvnitř Božství. Gnostický vliv identifikovaný Scholemem (kruh Castile, ~1265).'
                  : '"The Other Side" — duality of good and evil within the Godhead. Gnostic influence identified by Scholem (Castile circle, ~1265).'}
              </p>
            </div>
          </div>

          {/* Scholem box */}
          <div className="zion-rainbow-card space-y-3 p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">
                {cs ? 'Gershom Scholem (1897–1982)' : 'Gershom Scholem (1897–1982)'}
              </h4>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">
              {cs
                ? 'Zakladatel akademického studia kabaly. V polovině 20. století prokázal, že většinu Zoharu napsal Mojžíš de León (~1280–1286), ne rabín Šim\'on bar Jochai (2. stol.). Důkazy: chyby v aramejské gramatice, stopy španělštiny, neznalost země Izrael. Orthodoxní židé tradici nadále obhajují.'
                : 'Founder of academic Kabbalah study. In the mid-20th century he demonstrated that most of the Zohar was written by Moses de León (~1280–1286), not Rabbi Shimon bar Yochai (2nd century). Evidence: errors in Aramaic grammar, traces of Spanish, lack of knowledge of the land of Israel. Orthodox Jews continue to defend the tradition.'}
            </p>
          </div>
        </motion.section>

        {/* ═══════ INTERAKTIVNÍ STROM ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
              {cs ? 'Interaktivní mapa' : 'Interactive map'}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {cs ? '10 Sefirot → ZION vrstvy' : '10 Sephirot → ZION layers'}
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-gray-400">
              {cs
                ? 'Klikni na sefiru pro detail. Barva = pilíř (modrý = Milosrdenství, červený = Přísnost, zlatý = Rovnováha).'
                : 'Click a sephira for details. Color = pillar (blue = Mercy, red = Severity, gold = Equilibrium).'}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            {/* Tree SVG */}
            <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-zion-gold/15 bg-[radial-gradient(circle_at_50%_15%,rgba(251,191,36,0.12),rgba(10,12,24,0.04)_30%,rgba(1,3,6,0.98)_75%)]">
              {/* Paths */}
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {PATHS.map(([from, to], i) => {
                  const a = getPos(from);
                  const b = getPos(to);
                  const isActive = hovered === from || hovered === to || selected?.id === from || selected?.id === to;
                  return (
                    <line
                      key={i}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={isActive ? 'rgba(251,191,36,0.7)' : 'rgba(255,255,255,0.10)'}
                      strokeWidth={isActive ? 0.5 : 0.25}
                      vectorEffect="non-scaling-stroke"
                      className="transition-all duration-300"
                    />
                  );
                })}
              </svg>

              {/* Da'at — hidden sephira (between Keter and Tiferet, ~y=30) */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 0.6, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: '50%', top: '30%' }}
              >
                <div
                  className="flex items-center justify-center rounded-full border-2 border-dashed"
                  style={{
                    width: '32px', height: '32px',
                    borderColor: 'rgba(255,255,255,0.25)',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="text-[8px] font-bold text-gray-400">11</span>
                </div>
                <p className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[7px] uppercase tracking-wider text-gray-600">
                  Da&apos;at
                </p>
              </motion.div>

              {/* Sephirot nodes */}
              {SEPHIROT.map((s, i) => {
                const isSelected = selected?.id === s.id;
                const isHovered = hovered === s.id;
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s)}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer outline-none"
                    style={{ left: `${s.x}%`, top: `${s.y}%` }}
                    onMouseEnter={() => setHovered(s.id)}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={`${s.name} — ${cs ? s.meaning.cs : s.meaning.en}`}
                  >
                    <div
                      className="flex items-center justify-center rounded-full border-2 transition-all"
                      style={{
                        width: isSelected || isHovered ? '48px' : '38px',
                        height: isSelected || isHovered ? '48px' : '38px',
                        borderColor: `rgba(${s.color}, ${isSelected ? 0.9 : 0.5})`,
                        backgroundColor: `rgba(${s.color}, ${isSelected ? 0.25 : 0.12})`,
                        boxShadow: isSelected || isHovered
                          ? `0 0 24px rgba(${s.color}, 0.6)`
                          : `0 0 8px rgba(${s.color}, 0.2)`,
                      }}
                    >
                      <s.icon
                        className="transition-all"
                        style={{
                          width: isSelected || isHovered ? '20px' : '16px',
                          height: isSelected || isHovered ? '20px' : '16px',
                          color: `rgb(${s.color})`,
                        }}
                      />
                    </div>
                    {/* Label below node */}
                    <p
                      className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[8px] font-semibold transition-opacity"
                      style={{ color: `rgb(${s.color})`, opacity: isHovered || isSelected ? 1 : 0.5 }}
                    >
                      {s.name}
                    </p>
                  </motion.button>
                );
              })}

              {/* Pillar labels */}
              <div className="absolute bottom-1 left-[28%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-red-400/70">Severity</div>
              <div className="absolute bottom-1 left-[50%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-amber-400/70">Equilibrium</div>
              <div className="absolute bottom-1 left-[72%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-cyan-400/70">Mercy</div>
            </div>

            {/* Detail panel */}
            <div className="min-h-[400px]">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="zion-rainbow-card space-y-4 p-6"
                    style={{ '--rc': selected.color } as React.CSSProperties}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center rounded-xl border-2"
                          style={{
                            width: '48px', height: '48px',
                            borderColor: `rgba(${selected.color}, 0.6)`,
                            backgroundColor: `rgba(${selected.color}, 0.12)`,
                          }}
                        >
                          <selected.icon className="h-6 w-6" style={{ color: `rgb(${selected.color})` }} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white">{selected.name}</h3>
                          <p className="text-sm text-gray-400">
                            {selected.hebrew} · {cs ? selected.meaning.cs : selected.meaning.en}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'ZION vrstva' : 'ZION layer'}</p>
                        <p className="mt-1 text-base font-semibold" style={{ color: `rgb(${selected.color})` }}>
                          {selected.zionLayer}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-gray-500">{selected.zionPath}</p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Co emanuje' : 'What it emanates'}</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-300">
                          {cs ? selected.emanates.cs : selected.emanates.en}
                        </p>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Otázka' : 'Question'}</p>
                        <p className="mt-1 text-sm italic text-gray-300">
                          {cs ? selected.question.cs : selected.question.en}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: `rgba(${selected.color}, 0.15)`,
                            color: `rgb(${selected.color})`,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: `rgb(${selected.color})` }}
                          />
                          {STATUS_LABEL[selected.status][cs ? 'cs' : 'en']}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">
                          {cs ? 'Pilíř' : 'Pillar'}: {PILLARS.find((p) => p.id === selected.pillar)?.name[cs ? 'cs' : 'en']}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="zion-rainbow-card flex min-h-[400px] flex-col items-center justify-center space-y-4 p-8 text-center"
                    style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zion-gold/30 bg-zion-gold/5">
                      <Sparkles className="h-8 w-8 text-zion-gold" />
                    </div>
                    <p className="text-sm text-gray-400">
                      {cs
                        ? 'Vyber sefiru na stromu vlevo a prozkoumej, jak se kabalistický archetyp mapuje na ZION vrstvu.'
                        : 'Select a sephira on the tree to explore how the kabbalistic archetype maps to a ZION layer.'}
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
                        <p className="text-[9px] uppercase tracking-wider text-cyan-400">Mercy</p>
                        <p className="text-[10px] text-gray-500">3 sefirot</p>
                      </div>
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                        <p className="text-[9px] uppercase tracking-wider text-red-400">Severity</p>
                        <p className="text-[10px] text-gray-500">3 sefirot</p>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                        <p className="text-[9px] uppercase tracking-wider text-amber-400">Equilibrium</p>
                        <p className="text-[10px] text-gray-500">4 sefirot</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* ═══════ DA'AT — SKRYTÁ SEFIRA ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-rainbow-card space-y-4 p-6"
          style={{ '--rc': '255, 255, 255' } as React.CSSProperties}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/30">
              <span className="text-xs font-bold text-gray-300">11</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Da&apos;at <span className="text-gray-500">— {DAAT.hebrew}</span></h2>
              <p className="text-sm text-gray-400">{cs ? DAAT.meaning.cs : DAAT.meaning.en}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-gray-300">
            {cs ? DAAT.emanates.cs : DAAT.emanates.en}
          </p>
          <p className="text-sm font-semibold text-white">
            {cs ? DAAT.zionLayer : DAAT.zionLayer}
          </p>
        </motion.section>

        {/* ═══════ TŘI PILÍŘE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-gold">
              {cs ? 'Architektura stromu' : 'Architecture of the tree'}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {cs ? 'Tři pilíře' : 'Three Pillars'}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.id}
                className="zion-rainbow-card space-y-4 p-6"
                style={{ '--rc': p.color } as React.CSSProperties}
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5" style={{ color: `rgb(${p.color})` }} />
                  <h3 className="text-lg font-bold text-white">{cs ? p.name.cs : p.name.en}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.sefirot.map((name) => (
                    <span
                      key={name}
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: `rgba(${p.color}, 0.15)`,
                        color: `rgb(${p.color})`,
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-gray-400">
                  {cs ? p.desc.cs : p.desc.en}
                </p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ STAV EMANACE — LIVE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-emerald-400">
              {cs ? 'Diagnostika organismu — živá data' : 'Organism diagnostics — live data'}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {cs ? 'Stav emanace' : 'Emanation status'}
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-gray-400">
              {cs
                ? 'Které aspekty ZIONu jsou živé v runtime, které čekají na manifestaci. Strom života jako diagnostický nástroj. Data z /api/zohar/tree-health — agregováno z blockchain, DeFi, bridge a NCL API.'
                : 'Which aspects of ZION are alive in runtime, which await manifestation. The Tree of Life as a diagnostic tool. Data from /api/zohar/tree-health — aggregated from blockchain, DeFi, bridge and NCL APIs.'}
            </p>
          </div>

          {/* Aggregate tree health + pillars */}
          {treeHealth && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Strom celkem' : 'Tree overall'}</p>
                <p className="text-4xl font-bold text-zion-gold">{treeHealth.treeHealth}<span className="text-lg text-gray-500">/100</span></p>
                <div className="mx-auto h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-zion-gold to-amber-400 transition-all duration-700"
                    style={{ width: `${treeHealth.treeHealth}%` }}
                  />
                </div>
              </div>
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Pilíř Milosrdenství' : 'Pillar of Mercy'}</p>
                <p className="text-3xl font-bold text-cyan-400">{treeHealth.pillars.mercy}<span className="text-base text-gray-500">/100</span></p>
                <p className="text-[10px] text-gray-500">{cs ? 'Chokmah, Chesed, Netzach' : 'Chokmah, Chesed, Netzach'}</p>
              </div>
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Pilíř Přísnosti' : 'Pillar of Severity'}</p>
                <p className="text-3xl font-bold text-red-400">{treeHealth.pillars.severity}<span className="text-base text-gray-500">/100</span></p>
                <p className="text-[10px] text-gray-500">{cs ? 'Binah, Gevurah, Hod' : 'Binah, Gevurah, Hod'}</p>
              </div>
              <div className="zion-rainbow-card space-y-2 p-5 text-center" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Pilíř Rovnováhy' : 'Pillar of Equilibrium'}</p>
                <p className="text-3xl font-bold text-amber-400">{treeHealth.pillars.equilibrium}<span className="text-base text-gray-500">/100</span></p>
                <p className="text-[10px] text-gray-500">{cs ? 'Keter, Tiferet, Yesod, Malkhut' : 'Keter, Tiferet, Yesod, Malkhut'}</p>
              </div>
            </div>
          )}

          {/* Per-sephira health grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SEPHIROT.map((s) => {
              const liveData = treeHealth?.sephirot?.find((ls: any) => ls.id === s.id);
              const health = liveData?.health ?? 0;
              const liveStatus = liveData?.status ?? s.status;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border p-3 transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: `rgba(${s.color}, 0.25)`,
                    backgroundColor: `rgba(${s.color}, 0.05)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{s.name}</span>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: `rgb(${s.color})`,
                        opacity: liveStatus === 'live' ? 1 : liveStatus === 'partial' ? 0.5 : 0.25,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">{s.zionLayer}</p>
                  {/* Health bar */}
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${health}%`,
                        backgroundColor: `rgb(${s.color})`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: `rgb(${s.color})` }}
                    >
                      {STATUS_LABEL[liveStatus as keyof typeof STATUS_LABEL]?.[cs ? 'cs' : 'en'] ?? STATUS_LABEL.horizon[cs ? 'cs' : 'en']}
                    </p>
                    {liveData && (
                      <p className="text-[10px] font-mono text-gray-400">{health}/100</p>
                    )}
                  </div>
                  {/* Key metric */}
                  {liveData?.metrics && (
                    <p className="mt-1 text-[9px] text-gray-600 truncate">
                      {Object.entries(liveData.metrics).slice(0, 1).map(([k, v]) => (
                        <span key={k}>{k}: {String(v)}</span>
                      ))}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Da'at + sources */}
          {treeHealth?.daat && (
            <div className="zion-rainbow-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ '--rc': '255, 255, 255' } as React.CSSProperties}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/30">
                  <span className="text-xs font-bold text-gray-300">11</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Da&apos;at — {cs ? 'most vědomí' : 'bridge of consciousness'}</p>
                  <p className="text-xs text-gray-400">
                    {cs ? 'Živých sefirot' : 'Live sephirot'}: {treeHealth.daat.metrics.live_sephirot}/{treeHealth.daat.metrics.total_sephirot}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{treeHealth.daat.health}<span className="text-sm text-gray-500">/100</span></p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'propojení mýtu a kódu' : 'myth-code connection'}</p>
              </div>
            </div>
          )}

          {/* Loading + sources */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-gray-500">
            {healthLoading && (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-zion-gold" />
                {cs ? 'Načítám živá data…' : 'Loading live data…'}
              </span>
            )}
            {treeHealth?.sources?.length > 0 && (
              <span>{cs ? 'Zdroje:' : 'Sources:'} {treeHealth.sources.join(', ')}</span>
            )}
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> {cs ? 'Živé v runtime' : 'Live in runtime'}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400/50" /> {cs ? 'Částečné / seed' : 'Partial / seed'}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-600" /> {cs ? 'Horizont' : 'Horizon'}
            </span>
          </div>
        </motion.section>

        {/* ═══════ ROADMAP ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-zion-purple">
              {cs ? 'Implementace' : 'Implementation'}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              {cs ? 'Roadmapa Zohar → ZION' : 'Zohar → ZION roadmap'}
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                phase: 'Fáze 0',
                title: { cs: 'Manifest', en: 'Manifest' },
                status: { cs: 'Hotovo', en: 'Done' },
                color: '34, 197, 94',
                desc: { cs: 'docs/Zohar/ — README, mapování sefirot, roadmapa. Čistá dokumentace.', en: 'docs/Zohar/ — README, sephirot mapping, roadmap. Pure documentation.' },
              },
              {
                phase: 'Fáze 1',
                title: { cs: 'Website vizualizace', en: 'Website visualization' },
                status: { cs: 'Tato stránka', en: 'This page' },
                color: '251, 191, 36',
                desc: { cs: 'Interaktivní strom na /zohar + CTA na homepage. Klikatelné sefirot s detaily.', en: 'Interactive tree on /zohar + CTA on homepage. Clickable sephirot with details.' },
              },
              {
                phase: 'Fáze 2',
                title: { cs: 'Sefirot vow pro governance', en: 'Sefirot vow for governance' },
                status: { cs: 'Plán', en: 'Planned' },
                color: '147, 51, 234',
                desc: { cs: 'Validator pledge strukturovaný jako 10 slibů péče (jeden za sefiru).', en: 'Validator pledge structured as 10 care vows (one per sephira).' },
              },
              {
                phase: 'Fáze 3',
                title: { cs: 'Care task kategorie', en: 'Care task categories' },
                status: { cs: 'Horizont', en: 'Horizon' },
                color: '239, 68, 68',
                desc: { cs: 'V Protokolu Péče klasifikovat care tasks podle sefirot. Vyžaduje L1 consensus schválení.', en: 'In Protocol of Care, classify care tasks by sephirot. Requires L1 consensus approval.' },
              },
              {
                phase: 'Fáze 4',
                title: { cs: 'getTreeHealth RPC', en: 'getTreeHealth RPC' },
                status: { cs: 'Horizont', en: 'Horizon' },
                color: '6, 182, 212',
                desc: { cs: 'Dashboard / RPC endpoint který vrací stav 10 sefirot jako health score.', en: 'Dashboard / RPC endpoint returning state of 10 sephirot as health score.' },
              },
            ].map((p) => (
              <div
                key={p.phase}
                className="zion-rainbow-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ '--rc': p.color } as React.CSSProperties}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: `rgba(${p.color}, 0.5)`,
                      backgroundColor: `rgba(${p.color}, 0.1)`,
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: `rgb(${p.color})` }}>
                      {p.phase.replace('Fáze ', 'F').replace('Phase ', 'F')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{cs ? p.title.cs : p.title.en}</p>
                    <p className="text-xs text-gray-400">{cs ? p.desc.cs : p.desc.en}</p>
                  </div>
                </div>
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `rgba(${p.color}, 0.15)`,
                    color: `rgb(${p.color})`,
                  }}
                >
                  {cs ? p.status.cs : p.status.en}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══════ ZÁVĚR + ODKAZY ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="space-y-6 text-center"
        >
          <div className="zion-rainbow-card space-y-4 p-8" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <p className="text-lg italic text-gray-300">
              {cs
                ? '„Ne ten kdo má největší sílu, ale ten kdo nejlépe opékuje, ten bude vést."'
                : '"Not the one who has the greatest strength, but the one who cares best, that one shall lead."'}
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">— {cs ? 'Protokol Péče' : 'Protocol of Care'}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/terranova"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 transition-all"
            >
              <BookOpen className="h-4 w-4" />
              {cs ? 'TerraNova kniha' : 'TerraNova book'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/#tree-of-life"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <TreePine className="h-4 w-4" />
              {cs ? 'Strom na homepage' : 'Tree on homepage'}
            </Link>
            <Link
              href="/l6-issobella"
              className="inline-flex items-center gap-2 rounded-2xl border border-pink-500/30 bg-pink-500/5 px-5 py-2.5 text-sm font-medium text-pink-300 hover:bg-pink-500/10 transition-all"
            >
              <Star className="h-4 w-4" />
              {cs ? 'L6 Issobella (Malkhut)' : 'L6 Issobella (Malkhut)'}
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
