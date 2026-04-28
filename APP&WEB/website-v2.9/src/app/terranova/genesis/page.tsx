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
  Lock,
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
    <div className="zion-shell min-h-screen pt-24 md:pt-28 pb-24 overflow-x-hidden">
      {/* Ambient atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[600px] w-[600px] rounded-full blur-[240px] bg-emerald-500/8" />
        <div className="absolute -right-40 top-2/3 h-[500px] w-[500px] rounded-full blur-[200px] bg-teal-500/6" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-emerald-400/5" />
      </div>

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
          {/* Hero glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full blur-[120px] bg-emerald-500/12 pointer-events-none" />

          <div className="relative zion-panel rounded-3xl md:rounded-4xl p-8 md:p-12 overflow-hidden border border-emerald-500/20">
            {/* BG gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-teal-900/10 to-transparent" />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ['0%', '220%'] }}
              transition={{ duration: 7, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
            />
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] bg-emerald-500/15" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-[80px] bg-teal-500/10" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
              {/* Icon column */}
              <div className="shrink-0">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-[32px] border border-emerald-400/25 bg-gradient-to-br from-emerald-400/18 via-emerald-950/50 to-black shadow-[0_0_60px_rgba(16,185,129,0.16)]">
                  <div className="absolute inset-3 rounded-[26px] border border-emerald-300/15" />
                  <div className="absolute h-20 w-20 rounded-full bg-emerald-400/12 blur-2xl" />
                  <Leaf className="relative z-10 h-10 w-10 text-emerald-300" />
                  <Sprout className="absolute bottom-5 right-5 h-4 w-4 text-teal-300" />
                </div>
              </div>

              {/* Text column */}
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold tracking-[0.3em] text-emerald-400 uppercase">
                    L5 · Terra Nova Pioneer
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-yellow-400 uppercase">
                    🟡 {cs ? 'Aktivní rozvoj' : 'Active Development'}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                  Zahrada Genesis
                </h1>
                <p className="text-lg text-emerald-400 font-medium">Base Camp · Terra Nova ®</p>

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
                      <div key={signal.labelCs} className="rounded-2xl border border-emerald-400/12 bg-emerald-400/6 px-3 py-3 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-emerald-300">
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
                  className="relative rounded-2xl border p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                  style={{ borderColor: `rgba(${f.rgb},0.2)`, backgroundColor: `rgba(${f.rgb},0.04)` }}
                >
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] opacity-20 group-hover:opacity-35 transition-opacity duration-500"
                    style={{ backgroundColor: f.color }} />

                  <div className="flex items-start justify-between relative z-10 gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                      <Icon className="h-5 w-5" style={{ color: f.color }} />
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: s.color, borderColor: s.border, backgroundColor: s.bg }}
                    >
                      {cs ? s.cs : s.en}
                    </span>
                  </div>
                  <h3 className="font-bold text-white relative z-10" style={{ color: f.color }}>
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
            <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent" />

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
                      borderColor: p.done ? '#34D399' : p.active ? '#F59E0B' : 'rgba(255,255,255,0.15)',
                      backgroundColor: p.done ? 'rgba(52,211,153,0.2)' : p.active ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {p.done && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {p.active && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />}
                  </div>

                  <div
                    className="rounded-2xl border p-4 space-y-1"
                    style={{
                      borderColor: p.done ? 'rgba(52,211,153,0.2)' : p.active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                      backgroundColor: p.done ? 'rgba(52,211,153,0.04)' : p.active ? 'rgba(245,158,11,0.04)' : 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-bold tracking-wider"
                        style={{ color: p.done ? '#34D399' : p.active ? '#F59E0B' : 'rgba(255,255,255,0.3)' }}
                      >
                        {cs ? `Fáze ${p.num}` : `Phase ${p.num}`}
                      </span>
                      <span className="text-sm font-semibold text-white/80">
                        {cs ? p.cs : p.en}
                      </span>
                      {p.done && <span className="text-emerald-400 text-xs">✅</span>}
                      {p.active && <span className="text-yellow-400 text-xs animate-pulse">⚡</span>}
                    </div>
                    <p className="text-gray-500 text-xs">{cs ? p.descCs : p.descEn}</p>
                  </div>
                </motion.div>
              ))}
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

          <div className="zion-panel rounded-3xl p-6 md:p-8 border border-emerald-500/15 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-transparent" />
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[80px] bg-emerald-500/10" />

            <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 p-3"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/12 bg-emerald-400/8">
                    <item.icon className="h-4 w-4 text-emerald-300" />
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
          <div className="zion-panel rounded-3xl p-6 md:p-8 border border-emerald-500/15 space-y-4">
            <h3 className="text-lg font-bold text-emerald-400">
              {cs ? 'Zdroje a kontakt' : 'Resources & Contact'}
            </h3>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.newearth.cz/V2/camp.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 text-sm text-emerald-300 transition-all duration-300"
              >
                <Globe className="w-4 h-4" /> newearth.cz/camp
              </a>
              <a
                href="https://github.com/Zion-TerraNova"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-gray-300 transition-all duration-300"
              >
                <Zap className="w-4 h-4" /> GitHub
              </a>
              <a
                href="https://discord.gg/eatGYDbd"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-gray-300 transition-all duration-300"
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
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {cs ? 'Zpět na Terra Nova' : 'Back to Terra Nova'}
          </Link>
          <div className="relative inline-flex items-center gap-3 overflow-hidden rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-sm text-violet-300/85 saturate-75">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_10px,transparent_10px,transparent_22px)] opacity-70" />
            <div className="relative z-10">
              <span>{cs ? 'Dharma Temple' : 'Dharma Temple'}</span>
              <p className="mt-1 text-[11px] text-violet-200/55">
                {cs ? 'Sealed mock · doplníme později' : 'Sealed mock · details later'}
              </p>
            </div>
            <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-black/35 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-violet-100/80">
              <Lock className="w-3.5 h-3.5" />
              Sealed
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
