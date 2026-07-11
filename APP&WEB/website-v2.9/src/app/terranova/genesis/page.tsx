'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  Globe,
  Landmark,
  Leaf,
  LucideIcon,
  MapPin,
  Network,
  Sprout,
  Sun,
  Trees,
  Users,
  Waves,
  Zap,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

type FeatureItem = {
  icon: LucideIcon;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  status: 'open' | 'active' | 'planned';
  color: string;
  rgb: string;
};

type IntegrationItem = {
  label: string;
  status: 'active' | 'planned' | 'tbd';
  icon: LucideIcon;
};

const FEATURES: FeatureItem[] = [
  {
    icon: Leaf,
    titleCs: 'Glamping',
    titleEn: 'Glamping',
    descCs: 'Pohodlné stany uprostřed přírody — komfort bez kompromisu. Ubytování pro hosty a long-stay farmáře.',
    descEn: 'Comfortable tents in the heart of nature — comfort without compromise. Accommodation for guests and long-stay farmers.',
    status: 'open' as const,
    color: '#34D399',
    rgb: '52,211,153',
  },
  {
    icon: Sprout,
    titleCs: 'Organická farma',
    titleEn: 'Organic Farm',
    descCs: 'Pestrá škála organických plodin, obnova biodiverzity, sezónní sklizně. Každý návštěvník může přiložit ruku k dílu.',
    descEn: 'Diverse organic crops, biodiversity restoration, seasonal harvests. Every visitor can lend a hand.',
    status: 'active' as const,
    color: '#10B981',
    rgb: '16,185,129',
  },
  {
    icon: Trees,
    titleCs: 'Sázení stromů',
    titleEn: 'Tree Planting',
    descCs: 'Každý strom, který tu vyroste, bude tu dál, když tenhle tým dávno odejde. Budujeme dědictví v biologickém čase.',
    descEn: 'Every tree that grows here will be here long after this team is gone. We build legacy in biological time.',
    status: 'active' as const,
    color: '#059669',
    rgb: '5,150,105',
  },
  {
    icon: Waves,
    titleCs: 'Surf škola',
    titleEn: 'Surf School',
    descCs: 'Propojení oceánu, pohybu a vědomého stylu. Surf jako praxe přítomnosti — vlna jako učitel.',
    descEn: 'Connecting ocean, movement and conscious lifestyle. Surf as a practice of presence — the wave as teacher.',
    status: 'planned' as const,
    color: '#06B6D4',
    rgb: '6,182,212',
  },
  {
    icon: Sun,
    titleCs: 'Solar & Off-grid',
    titleEn: 'Solar & Off-grid',
    descCs: 'Fotovoltaický systém, sběr dešťové vody, kompostování. Fyzická manifestace energetické svobody.',
    descEn: 'Photovoltaic system, rainwater collection, composting. Physical manifestation of energy freedom.',
    status: 'active' as const,
    color: '#F59E0B',
    rgb: '245,158,11',
  },
  {
    icon: Network,
    titleCs: 'Komunitní setkání',
    titleEn: 'Community Gatherings',
    descCs: 'Workshopy, retreaty, ceremonie a festivaly. Prostor kde se lidé setkávají s autentickým záměrem.',
    descEn: 'Workshops, retreats, ceremonies and festivals. A space where people meet with authentic intention.',
    status: 'active' as const,
    color: '#8B5CF6',
    rgb: '139,92,246',
  },
];

const PHASES = [
  { num: 0, cs: 'Zárodek', en: 'Seed', descCs: 'Pozemek, legal základ, první Guardian', descEn: 'Land, legal base, first Guardian', done: true },
  { num: 1, cs: 'Kořeny', en: 'Roots', descCs: 'Solar, voda, organická zahrada, glamping', descEn: 'Solar, water, organic garden, glamping', active: true },
  { num: 2, cs: 'Komunita', en: 'Community', descCs: 'Stálí obyvatelé, ZION node, governance', descEn: 'Permanent residents, ZION node, governance', done: false },
  { num: 3, cs: 'Síť', en: 'Network', descCs: 'Propojení s Dharma Temple, L5 uzly', descEn: 'Connection with Dharma Temple, L5 nodes', done: false },
  { num: 4, cs: 'Výzařování', en: 'Radiance', descCs: 'Surf škola, retreaty, vzdělávací centrum', descEn: 'Surf school, retreats, education center', done: false },
];

const ZION_ITEMS: IntegrationItem[] = [
  { label: 'ZION Node', status: 'planned', icon: Network },
  { label: 'Guardian Wallet', status: 'tbd', icon: Landmark },
  { label: 'Medical Table', status: 'planned', icon: Zap },
  { label: 'LoRa / Meshtastic', status: 'planned', icon: Globe },
  { label: 'Seed Library', status: 'active', icon: Sprout },
  { label: 'Proof-of-Care DAO', status: 'planned', icon: Users },
];

const SIGNALS = [
  { icon: Sun, value: '320+', labelCs: 'Slunečné dny', labelEn: 'Sunny days' },
  { icon: Droplets, value: 'Off-grid', labelCs: 'Voda & retence', labelEn: 'Water & retention' },
  { icon: Trees, value: 'Base Camp', labelCs: 'Farma & stromy', labelEn: 'Farm & trees' },
];

const STATUS_LABEL = {
  open: { cs: 'Otevřeno', en: 'Open', color: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  active: { cs: 'Aktivní', en: 'Active', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  planned: { cs: 'Plánováno', en: 'Planned', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
};

export default function ZahradaGenesisPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="zion-page">
      <div className="relative z-10 zion-container max-w-5xl">

        {/* Back nav */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {cs ? 'Zpět na Terra Nova' : 'Back to Terra Nova'}
          </Link>
        </motion.div>

        {/* ═══ HERO ═══ */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-20 relative"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
              {/* Icon column */}
              <div className="shrink-0">
                <div className="relative flex h-28 w-28 items-center justify-center zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <div className="absolute inset-3 rounded-[26px] border border-white/5" />
                  <div className="absolute h-20 w-20 rounded-full bg-zion-gold/10 blur-2xl" />
                  <Leaf className="relative z-10 h-10 w-10 text-zion-gold" />
                  <Sprout className="absolute bottom-5 right-5 h-4 w-4 text-zion-cyan" />
                </div>
              </div>

              {/* Text column */}
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="zion-badge">
                    L5 · Terra Nova Pioneer
                  </span>
                  <span className="zion-badge-gold">
                    🟡 {cs ? 'Aktivní rozvoj' : 'Active Development'}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gradient">
                  Zahrada Genesis
                </h1>
                <p className="text-lg text-zion-cyan font-medium">Base Camp · Terra Nova ®</p>

                <div className="flex items-center gap-1.5 text-gray-400">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm">Algarve / Atlantické pobřeží · Portugalsko</span>
                </div>

                <blockquote className="mt-4 pl-4 border-l-2 border-emerald-500/40 text-sm text-gray-400 italic leading-relaxed max-w-lg">
                  {cs
                    ? '"One love, one heart. Společně tvoříme budoucnost, kde je člověk a Země opět v harmonii."'
                    : '"One love, one heart. Together we create a future where humanity and Earth are in harmony again."'}
                </blockquote>

                <div className="grid gap-3 pt-3 sm:grid-cols-3">
                  {SIGNALS.map((signal) => {
                    const Icon = signal.icon;
                    return (
                      <div key={signal.labelCs} className="zion-rainbow-sub px-3 py-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                        <div className="flex items-center gap-2 text-zion-gold">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{signal.value}</span>
                        </div>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                          {cs ? signal.labelCs : signal.labelEn}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* ═══ FEATURES GRID ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Co projekt nabízí' : 'What the project offers'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Aktivity & Infrastruktura' : 'Activities & Infrastructure'}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const s = STATUS_LABEL[f.status];
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.titleCs}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.5 }}
                  className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                  style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                >
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] bg-white/5 group-hover:bg-white/10 transition-colors duration-500" />

                  <div className="flex items-start justify-between relative z-10 gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                      <Icon className="h-5 w-5" style={{ color: f.color }} />
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: s.color, borderColor: s.border, backgroundColor: s.bg }}
                    >
                      {cs ? s.cs : s.en}
                    </span>
                  </div>
                  <h3 className="font-bold text-zion-gold relative z-10">
                    {cs ? f.titleCs : f.titleEn}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                    {cs ? f.descCs : f.descEn}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═══ PHASE TIMELINE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Fáze rozvoje' : 'Development Phases'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Cesta od zárodku k výzařování' : 'From Seed to Radiance'}
            </h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-zion-gold/40 via-white/10 to-transparent" />

            <div className="space-y-4 pl-16">
              {PHASES.map((p, i) => (
                <motion.div
                  key={p.num}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                  className="relative"
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-10 top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{
                      borderColor: p.done ? 'rgb(255,215,0)' : p.active ? 'rgb(6,182,212)' : 'rgba(255,255,255,0.15)',
                      backgroundColor: p.done ? 'rgba(255,215,0,0.2)' : p.active ? 'rgba(6,182,212,0.2)' : 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {p.done && <div className="w-1.5 h-1.5 rounded-full bg-zion-gold" />}
                    {p.active && <div className="w-1.5 h-1.5 rounded-full bg-zion-cyan animate-pulse" />}
                  </div>

                  <div className="zion-rainbow-sub p-4 space-y-1" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold tracking-wider"
                        style={{ color: p.done ? 'rgb(255,215,0)' : p.active ? 'rgb(6,182,212)' : 'rgba(255,255,255,0.3)' }}
                      >
                        {cs ? `Fáze ${p.num}` : `Phase ${p.num}`}
                      </span>
                      <span className="text-sm font-semibold text-white/80">
                        {cs ? p.cs : p.en}
                      </span>
                      {p.done && <span className="text-zion-gold text-xs">✅</span>}
                      {p.active && <span className="text-zion-cyan text-xs animate-pulse">⚡</span>}
                    </div>
                    <p className="text-gray-500 text-xs">{cs ? p.descCs : p.descEn}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ PHYSICAL INFRASTRUCTURE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Fyzická základna' : 'Physical Foundation'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Infrastruktura & Off-grid' : 'Infrastructure & Off-grid'}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Energie */}
            <div className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] bg-zion-gold/10" />
              <div className="flex items-center gap-2 relative z-10">
                <span className="inline-flex h-9 w-9 items-center justify-center zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <Sun className="h-4 w-4 text-zion-gold" />
                </span>
                <h3 className="font-bold text-zion-gold text-sm">{cs ? 'Energie' : 'Energy'}</h3>
              </div>
              <div className="space-y-1.5 relative z-10">
                {[
                  { label: cs ? 'Zdroj' : 'Source', val: 'Solar FV systém' },
                  { label: cs ? 'Záloha' : 'Backup', val: cs ? 'V rozvoji' : 'In development' },
                  { label: cs ? 'Status' : 'Status', val: cs ? '🟡 Instalace' : '🟡 Installing' },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-xs gap-2">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="text-gray-300 text-right">{r.val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 relative z-10">
                {cs ? 'Cíl: energetická soběstačnost areálu' : 'Goal: full energy self-sufficiency'}
              </p>
            </div>

            {/* Voda */}
            <div className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] bg-zion-cyan/10" />
              <div className="flex items-center gap-2 relative z-10">
                <span className="inline-flex h-9 w-9 items-center justify-center zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <Droplets className="h-4 w-4 text-zion-cyan" />
                </span>
                <h3 className="font-bold text-zion-cyan text-sm">{cs ? 'Voda' : 'Water'}</h3>
              </div>
              <div className="space-y-1.5 relative z-10">
                {[
                  { label: cs ? 'Zdroj' : 'Source', val: cs ? 'Studna + déšť' : 'Well + rainwater' },
                  { label: cs ? 'Čištění' : 'Filter', val: 'Gravitace + UV' },
                  { label: cs ? 'Status' : 'Status', val: cs ? '🟡 Funkční základ' : '🟡 Basic system' },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-xs gap-2">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="text-gray-300 text-right">{r.val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 relative z-10">
                {cs ? 'Plánovaný sběr dešťové vody — plná retence' : 'Planned rainwater harvesting — full retention'}
              </p>
            </div>

            {/* Jídlo */}
            <div className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-[40px] bg-emerald-500/10" />
              <div className="flex items-center gap-2 relative z-10">
                <span className="inline-flex h-9 w-9 items-center justify-center zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <Sprout className="h-4 w-4 text-emerald-400" />
                </span>
                <h3 className="font-bold text-emerald-400 text-sm">{cs ? 'Zahrada & Jídlo' : 'Garden & Food'}</h3>
              </div>
              <div className="space-y-1.5 relative z-10">
                {[
                  { label: cs ? 'Metoda' : 'Method', val: cs ? 'Organická farma' : 'Organic farming' },
                  { label: cs ? 'Cíl' : 'Goal', val: '40–60 % kalorií' },
                  { label: cs ? 'Status' : 'Status', val: cs ? '🟢 Roste' : '🟢 Growing' },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-xs gap-2">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="text-gray-300 text-right">{r.val}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 relative z-10">
                {cs ? 'Sázení stromů, obnova biodiverzity, sezónní sklizeň' : 'Tree planting, biodiversity restoration, seasonal harvest'}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ═══ GOVERNANCE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Komunitní správa' : 'Community Governance'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Governance & DAO' : 'Governance & DAO'}
            </h2>
          </div>

          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="relative z-10 grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-zion-cyan font-bold text-sm uppercase tracking-widest">
                  {cs ? 'Model rozhodování' : 'Decision Model'}
                </h3>
                <div className="space-y-3">
                  {[
                    { label: cs ? 'Model' : 'Model', val: cs ? 'Komunitní správa + Terra Nova ® framework' : 'Community governance + Terra Nova ® framework' },
                    { label: cs ? 'Rozhodování' : 'Decisions', val: cs ? 'Konsensuální pro klíčová rozhodnutí' : 'Consensus for key decisions' },
                    { label: cs ? 'ZION DAO' : 'ZION DAO', val: cs ? 'Plánováno — Proof-of-Care governance' : 'Planned — Proof-of-Care governance' },
                    { label: cs ? 'Min. buňka' : 'Min. cell', val: cs ? '3–5 stálých Guardians + sezónní' : '3–5 permanent Guardians + seasonal' },
                  ].map((row) => (
                    <div key={row.label} className="flex gap-3">
                      <span className="text-gray-500 text-xs w-28 shrink-0 pt-0.5">{row.label}</span>
                      <span className="text-gray-300 text-xs leading-relaxed">{row.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-zion-gold font-bold text-sm uppercase tracking-widest">
                  {cs ? 'Humanitární závazek' : 'Humanitarian Commitment'}
                </h3>
                <div className="relative zion-rainbow-sub p-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
                  <div className="text-3xl font-black text-zion-gold mb-1">10 %</div>
                  <p className="text-gray-400 text-sm">
                    {cs
                      ? 'z node odměn ZION sítě jde do humanitárního fondu komunity'
                      : 'of ZION network node rewards go to the community humanitarian fund'}
                  </p>
                </div>
                <p className="text-gray-600 text-xs">
                  {cs
                    ? 'Každý Guardian node, který bude provozován v areálu, přispívá 10 % odměn zpět komunitě a jejím projektům.'
                    : 'Every Guardian node operated on the premises contributes 10% of rewards back to the community and its projects.'}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ CHARACTER OF PLACE ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.39, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="relative z-10 max-w-2xl space-y-4">
              <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500">
                {cs ? 'Charakter místa' : 'Character of Place'}
              </p>
              <h2 className="text-xl font-bold text-white">
                {cs ? 'Farma na hranici dvou světů' : 'A Farm on the Edge of Two Worlds'}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {cs
                  ? 'Zahrada Genesis stojí na hranici dvou světů: tichého vnitrozemí farmy a divokého atlantického pobřeží. Tato dualita — ticho půdy a energie oceánu — je záměrná. Projekt hledá lidi, kteří umí pracovat v hlíně i surfovat vlny. Farmáře i surfaře. Stavitele i meditující.'
                  : 'Zahrada Genesis stands on the boundary of two worlds: the quiet inland farm and the wild Atlantic coast. This duality — the silence of soil and the energy of the ocean — is intentional. The project looks for people who can work in clay and surf waves. Farmers and surfers. Builders and meditators.'}
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                {cs
                  ? 'Sázení stromů není PR aktivita. Je to rituál zakořenění. Každý strom, který tu vyroste, bude tu dál, když tenhle tým dávno odejde. Zahrada Genesis buduje dědictví v biologickém čase — ne v čtvrtletních zprávách.'
                  : "Tree planting is not a PR activity. It is a ritual of rooting. Every tree that grows here will be here long after this team is gone. Zahrada Genesis builds legacy in biological time — not in quarterly reports."}
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                {[
                  cs ? '🌊 Oceán & pohyb' : '🌊 Ocean & movement',
                  cs ? '🌱 Půda & ticho' : '🌱 Soil & silence',
                  cs ? '🌳 Biologický čas' : '🌳 Biological time',
                  cs ? '🔥 Autentický záměr' : '🔥 Authentic intention',
                ].map((tag) => (
                  <span key={tag} className="zion-badge">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══ ZION INTEGRATION ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Blockchain integrace' : 'Blockchain Integration'}
            </p>
            <h2 className="text-2xl font-bold text-white">ZION Network</h2>
          </div>

          <div className="zion-rainbow-card p-6 md:p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 zion-rainbow-sub p-3" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center zion-rainbow-sub" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                    <item.icon className="h-4 w-4 text-zion-gold" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white/80">{item.label}</p>
                    <p className="text-[10px] text-gray-600 capitalize">
                      {item.status === 'active'
                        ? (cs ? 'Aktivní' : 'Active')
                        : item.status === 'planned'
                        ? (cs ? 'Plánováno' : 'Planned')
                        : 'TBD'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ═══ LINKS & CONTACT ═══ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card p-6 md:p-8 space-y-4" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <h3 className="text-lg font-bold text-zion-gold">
              {cs ? 'Zdroje a kontakt' : 'Resources & Contact'}
            </h3>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.newearth.cz/V2/camp.html"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                <Globe className="w-4 h-4" /> newearth.cz/camp
              </a>
              <a
                href="https://github.com/Zion-TerraNova"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                <Zap className="w-4 h-4" /> GitHub
              </a>
              <a
                href="https://discord.gg/eatGYDbd"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-secondary"
              >
                <Users className="w-4 h-4" /> Discord
              </a>
            </div>
            <p className="text-gray-600 text-xs">
              {cs
                ? 'Instagram: @terranova_project · Tento projektový list je živý dokument — průběžně aktualizujeme.'
                : 'Instagram: @terranova_project · This project sheet is a living document — continuously updated.'}
            </p>
          </div>
        </motion.section>

        {/* ═══ BOTTOM NAV ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-zion-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {cs ? 'Zpět na Terra Nova' : 'Back to Terra Nova'}
          </Link>
          <Link
            href="/terranova/dharma-temple"
            className="zion-button-secondary"
          >
            <span>{cs ? 'Dharma Temple' : 'Dharma Temple'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
