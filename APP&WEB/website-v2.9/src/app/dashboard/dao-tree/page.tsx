'use client';

import {
  Crown,
  Gem,
  ShieldCheck,
  Sparkles,
  Star,
  TreeDeciduous,
  Users,
} from "lucide-react";
import LifeTreeVisualization from "./LifeTreeVisualization";
import GuardiansTreeClient from "@/components/GuardiansTreeClient";

const daoNodes = [
  {
    name: "🌱 Community Guild",
    role: "Foundational",
    allocation: "Community flow",
    notes: ["Open onboarding", "Contribution tracking", "Community proposals"],
    color: "from-rose-500/40 to-orange-400/20",
  },
  {
    name: "💠 Builders Circle",
    role: "Core",
    allocation: "Protocol development",
    notes: ["Core roadmap", "Treasury stewardship", "Technical governance"],
    color: "from-amber-500/40 to-yellow-400/20",
  },
  {
    name: "👑 Guardians Council",
    role: "Stewardship",
    allocation: "DAO oversight",
    notes: ["Council elections", "Audit reviews", "Guardian attestations"],
    color: "from-emerald-500/40 to-blue-400/20",
  },
];

const guardianHall = daoNodes.map((node, index) => ({
  name: node.name.replace("✨ ", "").replace("👑 ", "").replace("💠 ", "").replace("🌱 ", ""),
  realm: index === 0 ? "Community" : index === 1 ? "Builders" : "Guardians",
  role: node.role,
  allocation: node.allocation,
  wallet: index === 0 ? "COMMUNITY-EXAMPLE" : index === 1 ? "BUILDERS-EXAMPLE" : "GUARDIANS-EXAMPLE",
  joined: "TBD",
}));

const treeLevels = [
  {
    level: "Crown",
    title: "Guardians Council",
    description: "Vrchní vrstva správy DAO — dohled nad treasury, bezpečnostní revize a dlouhodobá vize.",
    color: "from-indigo-500/70 to-fuchsia-500/40",
    guardians: [guardianHall[2]],
  },
  {
    level: "Heart",
    title: "Builders Circle",
    description: "Srdce ekosystému — vývoj protokolu, core návrhy a koordinace technických misí.",
    color: "from-emerald-500/60 to-cyan-500/30",
    guardians: [guardianHall[1]],
  },
  {
    level: "Roots",
    title: "Community Guild",
    description: "Kořeny DAO — otevřená komunita, contribution streamy, komunitní hlasování a růst sítě.",
    color: "from-amber-500/60 to-orange-500/30",
    guardians: [guardianHall[0]],
  },
];

const perks = [
  {
    title: "DAO VOTING STREAM",
    body: "Snapshoty governance rozhodnutí, credential NFT a průběžná transparentní váha hlasů.",
  },
  {
    title: "TREASURY STEWARDSHIP",
    body: "Treasury reporty, multi-sig governance a měsíční auditní přehledy v Mission Control.",
  },
  {
    title: "TREE OF LIFE HUD",
    body: "Vizuální ledger propojuje DAO role s Tree of Life a consciousness multipliers.",
  },
];

const upcoming = [
  {
    title: "On-chain attestations",
    detail: "Zrcadlení DAO zápisů do zkAttest + IPFS manifestu.",
  },
  {
    title: "DAO API",
    detail: "/api/dao/guardians pro live embed + Discord feed.",
  },
  {
    title: "AR Tree mode",
    detail: "WebXR scéna pro DAO ceremonie v roce 2026.",
  },
];

const daoMetrics = [
  {
    label: "Guardians initiated",
    value: "27",
    note: "Limit 144 před public launch",
  },
  {
    label: "DAO Treasury",
    value: "1.82M ZION",
    note: "Live multi-sig escrow",
  },
  {
    label: "Active circles",
    value: "3",
    note: "Community · Builders · Guardians",
  },
  {
    label: "Last induction",
    value: "19 Dec 2025",
    note: "AURORA PRIME",
  },
];

export default function DaoDashboardPage() {
  const { cs } = useLang();
  return (
    <div className="text-white pb-20">
      <div className="zion-container max-w-6xl pt-28 space-y-12">
        <header className="rounded-[32px] border border-white/10 bg-gradient-to-r from-black/40 via-zion-purple/20 to-zion-gold/20 p-10 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-300">{cs ? 'DAO Ledger' : 'DAO Ledger'}</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold text-gradient">
            {cs ? 'Tree of Life · DAO Strážci' : 'Tree of Life · DAO Guardians'}
          </h1>
          <p className="mt-4 text-gray-200 max-w-3xl">
            {cs
              ? 'Tree of Life slouží jako živý DAO ledger. Kořeny reprezentují komunitní guildy, srdce vývojové kruhy a koruna správní strážci. Zápisy jsou navázané na DAO governance a treasury.'
              : 'Tree of Life serves as a live DAO ledger. Roots represent community guilds, heart represents dev circles, and crown represents stewardship guardians. Records are tied to DAO governance and treasury.'}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {daoMetrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{cs ? {
                'Guardians initiated': 'Aktivní strážci',
                'DAO Treasury': 'DAO Treasury',
                'Active circles': 'Aktivní kruhy',
                'Last induction': 'Poslední indukce',
              }[metric.label] || metric.label : metric.label}</p>
              <p className="mt-3 text-3xl font-semibold">{metric.value}</p>
              <p className="text-sm text-zion-gold">{metric.note}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{cs ? 'Strom života' : 'Tree of life'}</p>
              <h2 className="text-3xl font-semibold text-white">{cs ? 'Live DAO topologie' : 'Live DAO topology'}</h2>
              <p className="text-gray-300 max-w-2xl">
                {cs
                  ? 'Úrovně propojují energetickou mapu s DAO závazky. Po přidání strážců se graf rozsvítí a uzly se propojí s jejich governance odpovědností.'
                  : 'Levels connect the energy map with DAO commitments. After adding guardians, the graph lights up and nodes connect to their governance responsibility.'}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm">
              <TreeDeciduous className="h-5 w-5 text-emerald-300" />
              <span>{cs ? 'Auto-refresh každých 60s (TODO)' : 'Auto-refresh every 60s (TODO)'}</span>
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {treeLevels.map((node) => (
              <div key={node.level} className={`rounded-2xl border border-white/10 bg-gradient-to-b ${node.color} p-5`}>
                <div className="flex items-center gap-3">
                  {node.level === "Crown" && <Crown className="h-5 w-5 text-yellow-200" />}
                  {node.level === "Heart" && <Sparkles className="h-5 w-5 text-teal-200" />}
                  {node.level === "Roots" && <Users className="h-5 w-5 text-amber-200" />}
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-100">{cs ? {
                      'Crown': 'Koruna',
                      'Heart': 'Srdce',
                      'Roots': 'Kořeny',
                    }[node.level] || node.level : node.level}</p>
                    <h3 className="text-xl font-semibold text-white">{node.title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-50/90">{node.description}</p>
                <div className="mt-4 space-y-3">
                  {node.guardians.map((guardian) => (
                    <div key={guardian.name} className="rounded-xl border border-white/20 bg-black/40 p-3">
                      <p className="text-sm font-semibold text-zion-gold">{guardian.name}</p>
                      <p className="text-xs text-gray-200">{cs ? {
                        'Foundational': 'Základní',
                        'Core': 'Core',
                        'Stewardship': 'Správcovská',
                      }[guardian.role] || guardian.role : guardian.role} · {guardian.allocation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <LifeTreeVisualization treeLevels={treeLevels} />
        </section>

        {/* 🌟 Interactive Kabbalah Consciousness Tree */}
        <section className="rounded-[32px] border border-white/10 bg-gradient-to-b from-zion-purple/10 to-black/80 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{cs ? 'Vědomostní těžba' : 'Consciousness Mining'}</p>
              <h2 className="text-3xl font-semibold text-white">{cs ? 'Kabbalah Strom života · 144k Strážců' : 'Kabbalah Tree of Life · 144k Guardians'}</h2>
              <p className="text-gray-300 max-w-2xl">
                {cs
                  ? '9 vědomostních levelů namapovaných na 10 Sefirot. Každý DAO circle odpovídá různým consciousness levelům. Interaktivní strom ukazuje, kde jste na své cestě od PHYSICAL (CL1) k orbital horizon vrstvě (CL9).'
                  : '9 consciousness levels mapped to 10 Sefirot. Each DAO circle corresponds to different consciousness levels. The interactive tree shows where you are on your journey from PHYSICAL (CL1) to the orbital horizon layer (CL9).'}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-sm">
              <Star className="h-5 w-5 text-zion-gold" />
              <span className="text-white">{cs ? 'Real-time DAO sledování' : 'Real-time DAO tracking'}</span>
            </div>
          </div>
          <GuardiansTreeClient />
        </section>

        <section className="rounded-[32px] border border-white/10 bg-black/60 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Star className="h-6 w-6 text-zion-gold" />
            <h2 className="text-3xl font-semibold">{cs ? 'Sál strážců' : 'Hall of Guardians'}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {guardianHall.map((guardian) => (
              <div key={guardian.name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-500">{cs ? {
                      'Community': 'Komunita',
                      'Builders': 'Vývojáři',
                      'Guardians': 'Strážci',
                    }[guardian.realm] || guardian.realm : guardian.realm}</p>
                    <h3 className="text-2xl font-semibold text-white">{guardian.name}</h3>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-emerald-300" />
                </div>
                <div className="mt-4 space-y-1 text-sm text-gray-300">
                  <p>{cs ? 'Role' : 'Role'}: <span className="font-semibold text-white">{guardian.role}</span></p>
                  <p>{cs ? 'Alokace' : 'Allocation'}: <span className="font-mono text-zion-gold">{guardian.allocation}</span></p>
                  <p>Wallet: <span className="font-mono">{guardian.wallet}</span></p>
                  <p>{cs ? 'Datum' : 'Date'}: <span>{guardian.joined}</span></p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Gem className="h-5 w-5 text-pink-200" />
              <h3 className="text-2xl font-semibold">{cs ? 'Výhody a mechaniky' : 'Perks & mechanics'}</h3>
            </div>
            <ul className="space-y-4 text-sm text-gray-200">
              {perks.map((perk) => (
                <li key={perk.title} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">{perk.title}</p>
                  <p className="mt-2 text-gray-100">{perk.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-emerald-200" />
              <h3 className="text-2xl font-semibold">{cs ? 'Co chystáme' : 'Coming soon'}</h3>
            </div>
            <ul className="space-y-4 text-sm text-gray-200">
              {upcoming.map((item) => (
                <li key={item.title} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">{item.title}</p>
                  <p className="mt-2 text-gray-100">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
