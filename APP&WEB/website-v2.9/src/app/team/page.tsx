'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Users, Crown, ShieldCheck, Bot, ArrowRight, Github,
  Sprout, Flame, Waves, Wind, Sparkles, Layers,
  GitBranch, Heart, BookOpen, Compass, Globe2, UserPlus,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const TeamCopy = {
  kicker: { cs: `Lidé a agenti za ZION ekosystémem`, en: `The people and agents behind the ZION ecosystem` },
  title: { cs: `Dev Team`, en: `Dev Team` },
  intro: {
    cs: `ZION staví malý kruh správců, otevření přispěvatelé a autonomní agenti. Žádný zakladatelský podíl, žádný VIP vstup — každý ZION vzniká z práce. Toto je pracovní skica týmu; obsazení rolí se průběžně doplňuje.`,
    en: `ZION is built by a small circle of stewards, open contributors and autonomous agents. No founder allocation, no VIP entrance — every ZION comes from work. This is a working sketch of the team; roles are being filled over time.`,
  },
  chipOpenSource: { cs: `Open source · MIT`, en: `Open source · MIT` },
  chipDao: { cs: `DAO governance`, en: `DAO governed` },
  chipFair: { cs: `Fair launch — bez founder alokace`, en: `Fair launch — no founder allocation` },

  coreCircle: { cs: `Jádro`, en: `Core Circle` },
  coreCircleTitle: { cs: `Správcovský kruh`, en: `Stewardship Circle` },
  coreCircleDesc: {
    cs: `Tři role drží vizi, klíče a kontinuitu. Správa ≠ vlastnictví — rozhodnutí o fondech prochází DAO a guardian multisig.`,
    en: `Three roles hold the vision, the keys, and continuity. Stewardship ≠ ownership — fund decisions pass through DAO and guardian multisig.`,
  },

  founderRole: { cs: `Founder & Architect`, en: `Founder & Architect` },
  founderName: { cs: `Yeshuae`, en: `Yeshuae` },
  founderDesc: {
    cs: `Založil ZION v létě 2025 — spolu s AI. Navrhuje protokol, ekonomiku, filozofii i mapu L1–L6. Píše, kóduje, těží, sází.`,
    en: `Founded ZION in summer 2025 — together with AI. Designs the protocol, the economics, the philosophy and the L1–L6 map. Writes, codes, mines, plants.`,
  },
  founderTags: ['Vision', 'Protocol', 'L1–L6', 'Terra Nova'],

  trusteeRole: { cs: `Trustee`, en: `Trustee` },
  trusteeName: { cs: `Vyhlašuje se`, en: `To be announced` },
  trusteeDesc: {
    cs: `Nezávislý správce svěřenských klíčů a guardian multisig. Drží kontinuitu fondu a eskalační cesty — mimo zakladatele.`,
    en: `Independent steward of trustee keys and guardian multisig. Holds fund continuity and escalation paths — outside the founder.`,
  },
  trusteeTags: ['Guardian Multisig', 'Escrow', 'Continuity'],

  agentRole: { cs: `Autonomous Engineering`, en: `Autonomous Engineering` },
  agentName: { cs: `Devin — AI agent`, en: `Devin — AI agent` },
  agentDesc: {
    cs: `Autonomní vývojový agent. Čte repo, píše a deployuje kód, drží testy zelené — pod dohledem lidských správců. ZION je první blockchain, kde je AI spolutvůrce, ne jen nástroj.`,
    en: `Autonomous engineering agent. Reads the repo, writes and deploys code, keeps tests green — under human stewardship. ZION is the first chain where AI is a co-builder, not just a tool.`,
  },
  agentTags: ['Code', 'Deploy', 'Tests', 'Docs'],

  statusActive: { cs: `Aktivní`, en: `Active` },
  statusOpen: { cs: `Otevřená role`, en: `Open role` },

  l5Leads: { cs: `L5 Free World`, en: `L5 Free World` },
  l5LeadsTitle: { cs: `Vedení L5 projektů`, en: `L5 Project Leads` },
  l5LeadsDesc: {
    cs: `Pět fyzických komunit Terra Nova — každá drží jeden element Stromu života. Vedení se rodí z místních kruhů, ne z centrály.`,
    en: `Five physical Terra Nova communities — each holds one element of the Tree of Life. Leadership grows from local circles, not from a headquarters.`,
  },
  projectLead: { cs: `Project Lead`, en: `Project Lead` },
  visitProject: { cs: `Projekt`, en: `Project` },

  sketchKicker: { cs: `Celková skica`, en: `The Big Sketch` },
  sketchTitle: { cs: `Jak je tým poskládaný`, en: `How the team is organized` },
  sketchDesc: {
    cs: `Ne korporace, ale prstence: správcovský kruh drží klíče a vizi, layer pody staví jednotlivé vrstvy, komunitní guildy nesou provoz. Všechno teče přes DAO.`,
    en: `Not a corporation — concentric rings: the stewardship circle holds keys and vision, layer pods build each layer, community guilds carry operations. Everything flows through the DAO.`,
  },

  ringSteward: { cs: `Správcovský kruh`, en: `Stewardship ring` },
  ringStewardDesc: { cs: `Founder · Trustee · Guardian multisig`, en: `Founder · Trustee · Guardian multisig` },
  ringPods: { cs: `Layer pody`, en: `Layer pods` },
  ringPodsDesc: { cs: `L1–L6 — malé týmy, jasný scope`, en: `L1–L6 — small teams, clear scope` },
  ringGuilds: { cs: `Komunitní guildy`, en: `Community guilds` },
  ringGuildsDesc: { cs: `Miners · Stewards · Creators · Pilgrims`, en: `Miners · Stewards · Creators · Pilgrims` },

  podFocus: { cs: `Zaměření`, en: `Focus` },

  joinKicker: { cs: `Přidej se`, en: `Join us` },
  joinTitle: { cs: `Místo v kruhu je otevřené`, en: `A seat in the circle is open` },
  joinDesc: {
    cs: `Hledáme vedení L5 projektů, Rust / TypeScript vývojáře, překladatele a správce uzlů. Začni v repozitáři — kód mluví za vše.`,
    en: `We are looking for L5 project leads, Rust / TypeScript developers, translators and node stewards. Start in the repository — code speaks for itself.`,
  },
  joinGithub: { cs: `Repozitář na GitHubu`, en: `GitHub repository` },
  joinDocs: { cs: `Dokumentace`, en: `Documentation` },
};

const CORE = [
  {
    key: 'founder',
    icon: Crown,
    accent: '252, 209, 22',
    text: 'text-zion-gold',
    ring: 'from-zion-gold via-amber-400 to-yellow-200',
    name: TeamCopy.founderName,
    role: TeamCopy.founderRole,
    desc: TeamCopy.founderDesc,
    tags: TeamCopy.founderTags,
    monogram: 'Y',
    status: 'active' as const,
  },
  {
    key: 'trustee',
    icon: ShieldCheck,
    accent: '147, 51, 234',
    text: 'text-zion-purple',
    ring: 'from-zion-purple via-fuchsia-500 to-violet-300',
    name: TeamCopy.trusteeName,
    role: TeamCopy.trusteeRole,
    desc: TeamCopy.trusteeDesc,
    tags: TeamCopy.trusteeTags,
    monogram: 'T',
    status: 'open' as const,
  },
  {
    key: 'agent',
    icon: Bot,
    accent: '6, 182, 212',
    text: 'text-zion-cyan',
    ring: 'from-zion-cyan via-sky-400 to-cyan-200',
    name: TeamCopy.agentName,
    role: TeamCopy.agentRole,
    desc: TeamCopy.agentDesc,
    tags: TeamCopy.agentTags,
    monogram: 'AI',
    status: 'active' as const,
  },
];

const L5_LEADS = [
  {
    key: 'genesis',
    name: 'Genesis Garden',
    element: { cs: 'Země · Kořen', en: 'Earth · Root' },
    location: { cs: 'Algarve, Portugalsko', en: 'Algarve, Portugal' },
    icon: Sprout,
    accent: '16, 185, 129',
    text: 'text-emerald-300',
    href: '/terranova/genesis',
  },
  {
    key: 'dharma',
    name: 'Dharma Temple',
    element: { cs: 'Oheň · Kmen', en: 'Fire · Trunk' },
    location: { cs: 'La Palma, Kanárské ostrovy', en: 'La Palma, Canary Islands' },
    icon: Flame,
    accent: '251, 146, 60',
    text: 'text-amber-300',
    href: '/terranova/dharma-temple',
  },
  {
    key: 'piko',
    name: 'Te Pīko Ora',
    element: { cs: 'Voda · Koruna', en: 'Water · Crown' },
    location: { cs: 'Raiatea, Francouzská Polynésie', en: 'Raiatea, French Polynesia' },
    icon: Waves,
    accent: '56, 189, 248',
    text: 'text-sky-300',
    href: '/terranova/te-piko-ora',
  },
  {
    key: 'bohemia',
    name: 'Golden Republic Bohemia',
    element: { cs: 'Vzduch · Srdce', en: 'Air · Heart' },
    location: { cs: 'Čechy, Česká republika', en: 'Bohemia, Czech Republic' },
    icon: Wind,
    accent: '167, 139, 250',
    text: 'text-violet-300',
    href: '/terranova/golden-republic-bohemia',
  },
  {
    key: 'lanka',
    name: 'Bodhi Lanka',
    element: { cs: 'Akáša · Éter', en: 'Akasha · Ether' },
    location: { cs: 'Srí Lanka', en: 'Sri Lanka' },
    icon: Sparkles,
    accent: '232, 121, 249',
    text: 'text-fuchsia-300',
    href: '/terranova/bodhi-lanka',
  },
];

const PODS = [
  { layer: 'L1', name: 'Chain Core', focus: { cs: 'Konsenzus · UTXO · těžba', en: 'Consensus · UTXO · mining' }, status: 'active' as const, accent: '252, 209, 22' },
  { layer: 'L2', name: 'Multichain', focus: { cs: 'Bridge · DAO · DeFi', en: 'Bridge · DAO · DeFi' }, status: 'active' as const, accent: '6, 182, 212' },
  { layer: 'L3', name: 'Hiran', focus: { cs: 'AI Native · NCL · WARP', en: 'AI Native · NCL · WARP' }, status: 'active' as const, accent: '147, 51, 234' },
  { layer: 'L4', name: 'OASIS', focus: { cs: 'Metaverse · Golden Egg', en: 'Metaverse · Golden Egg' }, status: 'active' as const, accent: '16, 185, 129' },
  { layer: 'L5', name: 'Terra Nova', focus: { cs: 'Komunity · fond · půda', en: 'Communities · fund · land' }, status: 'open' as const, accent: '251, 146, 60' },
  { layer: 'L6', name: 'Issobella', focus: { cs: 'Vědomí · příběh · knihy', en: 'Consciousness · story · books' }, status: 'open' as const, accent: '232, 121, 249' },
];

function StatusBadge({ status, cs }: { status: 'active' | 'open'; cs: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border shrink-0 ${
      status === 'active'
        ? 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20'
        : 'bg-zion-gold/10 text-zion-gold border-zion-gold/25'
    }`}>
      {status === 'active'
        ? TeamCopy.statusActive[cs ? 'cs' : 'en']
        : TeamCopy.statusOpen[cs ? 'cs' : 'en']}
    </span>
  );
}

export default function TeamPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="zion-page">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          <div className="space-y-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
              <Users className="h-4 w-4" />
              ZION · Terra Nova · Team
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                {TeamCopy.kicker[cs ? 'cs' : 'en']}
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {TeamCopy.title[cs ? 'cs' : 'en']}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {TeamCopy.intro[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-amber-200">
                <GitBranch className="h-3 w-3" /> {TeamCopy.chipOpenSource[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-4 py-2 text-emerald-200">
                <ShieldCheck className="h-3 w-3" /> {TeamCopy.chipDao[cs ? 'cs' : 'en']}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
                <Heart className="h-3 w-3" /> {TeamCopy.chipFair[cs ? 'cs' : 'en']}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── CORE CIRCLE ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{TeamCopy.coreCircle[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Crown className="h-7 w-7 text-zion-gold" />
              {TeamCopy.coreCircleTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{TeamCopy.coreCircleDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {CORE.map((person) => (
              <div
                key={person.key}
                className="zion-rainbow-sub p-6 flex flex-col"
                style={{ '--rc': person.accent } as React.CSSProperties}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className={`relative h-16 w-16 rounded-full bg-gradient-to-br ${person.ring} p-[2px]`}>
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0d0d0d]">
                      <span className={`text-lg font-bold ${person.text}`}>{person.monogram}</span>
                    </div>
                  </div>
                  <StatusBadge status={person.status} cs={cs} />
                </div>
                <h3 className="text-xl font-bold text-white">{person.name[cs ? 'cs' : 'en']}</h3>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${person.text} mt-1 mb-3`}>
                  {person.role[cs ? 'cs' : 'en']}
                </p>
                <p className="text-sm text-gray-400 leading-relaxed flex-1">{person.desc[cs ? 'cs' : 'en']}</p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {person.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── L5 PROJECT LEADS ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{TeamCopy.l5Leads[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Globe2 className="h-7 w-7 text-emerald-300" />
              {TeamCopy.l5LeadsTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{TeamCopy.l5LeadsDesc[cs ? 'cs' : 'en']}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {L5_LEADS.map((lead) => (
              <Link
                key={lead.key}
                href={lead.href}
                className="zion-rainbow-sub p-5 group hover:bg-white/5 transition-colors flex flex-col"
                style={{ '--rc': lead.accent } as React.CSSProperties}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border"
                    style={{ borderColor: `rgba(${lead.accent},0.4)`, background: `rgba(${lead.accent},0.08)` }}
                  >
                    <lead.icon className={`h-5 w-5 ${lead.text}`} />
                  </div>
                  <StatusBadge status="open" cs={cs} />
                </div>
                <h3 className="font-semibold text-white leading-tight">{lead.name}</h3>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${lead.text} mt-1`}>
                  {lead.element[cs ? 'cs' : 'en']}
                </p>
                <p className="text-xs text-gray-500 mt-1.5">{lead.location[cs ? 'cs' : 'en']}</p>
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{TeamCopy.projectLead[cs ? 'cs' : 'en']}</span>
                  <ArrowRight className="h-4 w-4 text-gray-500 group-hover:translate-x-1 group-hover:text-white transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* ── BIG SKETCH ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{TeamCopy.sketchKicker[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Layers className="h-7 w-7 text-zion-purple" />
              {TeamCopy.sketchTitle[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">{TeamCopy.sketchDesc[cs ? 'cs' : 'en']}</p>
          </div>

          {/* Ring 1 — stewardship */}
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-4 w-4 text-zion-gold" />
                <p className="text-sm font-semibold text-zion-gold">{TeamCopy.ringSteward[cs ? 'cs' : 'en']}</p>
              </div>
              <p className="text-xs text-gray-400">{TeamCopy.ringStewardDesc[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-4 w-4 text-zion-purple" />
                <p className="text-sm font-semibold text-zion-purple">{TeamCopy.ringPods[cs ? 'cs' : 'en']}</p>
              </div>
              <p className="text-xs text-gray-400">{TeamCopy.ringPodsDesc[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-zion-cyan" />
                <p className="text-sm font-semibold text-zion-cyan">{TeamCopy.ringGuilds[cs ? 'cs' : 'en']}</p>
              </div>
              <p className="text-xs text-gray-400">{TeamCopy.ringGuildsDesc[cs ? 'cs' : 'en']}</p>
            </div>
          </div>

          {/* Ring 2 — layer pods */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {PODS.map((pod) => (
              <div
                key={pod.layer}
                className="zion-rainbow-sub p-4 text-center"
                style={{ '--rc': pod.accent } as React.CSSProperties}
              >
                <p className="text-2xl font-bold text-white">{pod.layer}</p>
                <p className="text-xs font-semibold text-gray-300 mt-0.5">{pod.name}</p>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{pod.focus[cs ? 'cs' : 'en']}</p>
                <div className="mt-3 flex justify-center">
                  <StatusBadge status={pod.status} cs={cs} />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── JOIN CTA ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div className="max-w-2xl">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500 mb-2">{TeamCopy.joinKicker[cs ? 'cs' : 'en']}</p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white flex items-center gap-3 mb-3">
                <UserPlus className="h-7 w-7 text-zion-cyan" />
                {TeamCopy.joinTitle[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">{TeamCopy.joinDesc[cs ? 'cs' : 'en']}</p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <a
                href="https://github.com/Yose144/Zion-v3.0.0"
                target="_blank"
                rel="noopener noreferrer"
                className="zion-button-primary inline-flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                {TeamCopy.joinGithub[cs ? 'cs' : 'en']}
              </a>
              <Link href="/docs" className="zion-button-secondary inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {TeamCopy.joinDocs[cs ? 'cs' : 'en']}
              </Link>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-gray-500">
            <Compass className="h-3.5 w-3.5 text-zion-gold/60" />
            {cs
              ? 'Tato stránka je živý návrh — obsazení rolí se aktualizuje, jak tým roste.'
              : 'This page is a living sketch — roles update as the team grows.'}
          </div>
        </motion.section>

      </div>
    </div>
  );
}
