'use client';

import { useEffect, useState } from "react";
import {
  Crown,
  Gem,
  ShieldCheck,
  Sparkles,
  Star,
  TreeDeciduous,
  Users,
} from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import LifeTreeVisualization from "./LifeTreeVisualization";
import GuardiansTreeClient from "@/components/GuardiansTreeClient";

const DashboardDaoTreeCopy = {
  daoLedger: { cs: `DAO Ledger`, en: `DAO Ledger` },
  treeOfLifeDaoGuardians: { cs: `Tree of Life · DAO Strážci`, en: `Tree of Life · DAO Guardians` },
  treeOfLifeServesAsALiveDaoLedg: { cs: `Tree of Life slouží jako živý DAO ledger. Kořeny reprezentují komunitní guildy, srdce vývojové kruhy a koruna správní strážci. Zápisy jsou navázané na DAO governance a treasury.`, en: `Tree of Life serves as a live DAO ledger. Roots represent community guilds, heart represents dev circles, and crown represents stewardship guardians. Records are tied to DAO governance and treasury.` },
  treeOfLife: { cs: `Strom života`, en: `Tree of life` },
  liveDaoTopology: { cs: `Live DAO topologie`, en: `Live DAO topology` },
  levelsConnectTheEnergyMapWithD: { cs: `Úrovně propojují energetickou mapu s DAO závazky. Po přidání strážců se graf rozsvítí a uzly se propojí s jejich governance odpovědností.`, en: `Levels connect the energy map with DAO commitments. After adding guardians, the graph lights up and nodes connect to their governance responsibility.` },
  autoRefreshEvery60sTodo: { cs: `Auto-refresh každých 60s (TODO)`, en: `Auto-refresh every 60s (TODO)` },
  consciousnessMining: { cs: `Vědomostní těžba`, en: `Consciousness Mining` },
  kabbalahTreeOfLife144kGuardian: { cs: `Kabbalah Strom života · 144k Strážců`, en: `Kabbalah Tree of Life · 144k Guardians` },
  k9ConsciousnessLevelsMappedTo10: { cs: `9 vědomostních levelů namapovaných na 10 Sefirot. Každý DAO circle odpovídá různým consciousness levelům. Interaktivní strom ukazuje, kde jste na své cestě od PHYSICAL (CL1) k orbital horizon vrstvě (CL9).`, en: `9 consciousness levels mapped to 10 Sefirot. Each DAO circle corresponds to different consciousness levels. The interactive tree shows where you are on your journey from PHYSICAL (CL1) to the orbital horizon layer (CL9).` },
  realTimeDaoTracking: { cs: `Real-time DAO sledování`, en: `Real-time DAO tracking` },
  hallOfGuardians: { cs: `Sál strážců`, en: `Hall of Guardians` },
  role: { cs: `Role`, en: `Role` },
  allocation: { cs: `Alokace`, en: `Allocation` },
  date: { cs: `Datum`, en: `Date` },
  perksMechanics: { cs: `Výhody a mechaniky`, en: `Perks & mechanics` },
  comingSoon: { cs: `Co chystáme`, en: `Coming soon` },
};

const emeraldVar = { '--rc': '6, 105, 40' } as React.CSSProperties;
const goldVar = { '--rc': '252, 209, 22' } as React.CSSProperties;

const daoNodes = [
  {
    name: "🌱 Community Guild",
    role: "Foundational",
    allocation: "Community flow",
    notes: ["Open onboarding", "Contribution tracking", "Community proposals"],
    color: "from-zion-purple/40 to-zion-gold/20",
  },
  {
    name: "💠 Builders Circle",
    role: "Core",
    allocation: "Protocol development",
    notes: ["Core roadmap", "Treasury stewardship", "Technical governance"],
    color: "from-zion-gold/40 to-zion-gold/20",
  },
  {
    name: "👑 Guardians Council",
    role: "Stewardship",
    allocation: "DAO oversight",
    notes: ["Council elections", "Audit reviews", "Guardian attestations"],
    color: "from-zion-cyan/40 to-zion-purple/20",
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
    color: "from-zion-purple/70 to-zion-purple/40",
    guardians: [guardianHall[2]],
  },
  {
    level: "Heart",
    title: "Builders Circle",
    description: "Srdce ekosystému — vývoj protokolu, core návrhy a koordinace technických misí.",
    color: "from-zion-cyan/60 to-zion-cyan/30",
    guardians: [guardianHall[1]],
  },
  {
    level: "Roots",
    title: "Community Guild",
    description: "Kořeny DAO — otevřená komunita, contribution streamy, komunitní hlasování a růst sítě.",
    color: "from-zion-gold/60 to-zion-gold/30",
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

const DAO_TREASURY_ADDRESSES = [
  "zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5",
  "zion1s27490u7n823g098w42077h8f2n824w0y75w0s3",
  "zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238",
];

export default function DaoDashboardPage() {
  const { lang } = useLang();
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let total = 0;
        for (const addr of DAO_TREASURY_ADDRESSES) {
          const r = await fetch(`/api/blockchain/address?address=${encodeURIComponent(addr)}`, { signal: AbortSignal.timeout(5000) });
          if (!r.ok) continue;
          const d = await r.json();
          total += typeof d?.balance === 'number' ? d.balance : 0;
        }
        if (!cancelled) setTreasuryBalance(total);
      } catch { /* treasury fetch optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const daoMetrics = [
    {
      label: "DAO Treasury",
      value: treasuryBalance != null ? `${treasuryBalance.toLocaleString()} ZION` : "—",
      note: lang === 'cs' ? "Live on-chain · 3 sloty · time-lock 144,000" : "Live on-chain · 3 slots · time-lock 144,000",
    },
    {
      label: "Active circles",
      value: "3",
      note: "Community · Builders · Guardians",
    },
    {
      label: "Guardians initiated",
      value: "—",
      note: lang === 'cs' ? "Registry se připravuje" : "Registry pending",
    },
    {
      label: "144k Guardians",
      value: "—",
      note: lang === 'cs' ? "Onboarding po public launch" : "Onboarding after public launch",
    },
  ];
  return (
    <div className="zion-page text-white">
      <div className="zion-container max-w-6xl space-y-12">
        <header className="zion-rainbow-card p-5 sm:p-8 md:p-10" style={emeraldVar}>
          <p className="text-xs uppercase tracking-[0.4em] text-gray-300">{DashboardDaoTreeCopy.daoLedger[lang === 'cs' ? 'cs' : 'en']}</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold text-gradient">
            {DashboardDaoTreeCopy.treeOfLifeDaoGuardians[lang === 'cs' ? 'cs' : 'en']}
          </h1>
          <p className="mt-4 text-gray-200 max-w-3xl">
            {DashboardDaoTreeCopy.treeOfLifeServesAsALiveDaoLedg[lang === 'cs' ? 'cs' : 'en']}
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {daoMetrics.map((metric) => (
            <div key={metric.label} className="zion-rainbow-sub p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? {
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

        <section className="zion-rainbow-card p-8" style={emeraldVar}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{DashboardDaoTreeCopy.treeOfLife[lang === 'cs' ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{DashboardDaoTreeCopy.liveDaoTopology[lang === 'cs' ? 'cs' : 'en']}</h2>
              <p className="text-gray-300 max-w-2xl">
                {DashboardDaoTreeCopy.levelsConnectTheEnergyMapWithD[lang === 'cs' ? 'cs' : 'en']}
              </p>
            </div>
            <div className="zion-rainbow-sub flex items-center gap-3 px-4 py-2 text-sm" style={emeraldVar}>
              <TreeDeciduous className="h-5 w-5 text-zion-cyan" />
              <span>{DashboardDaoTreeCopy.autoRefreshEvery60sTodo[lang === 'cs' ? 'cs' : 'en']}</span>
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {treeLevels.map((node) => (
              <div key={node.level} className="zion-rainbow-sub p-5" style={node.level === 'Crown' ? goldVar : emeraldVar}>
                <div className="flex items-center gap-3">
                  {node.level === "Crown" && <Crown className="h-5 w-5 text-yellow-200" />}
                  {node.level === "Heart" && <Sparkles className="h-5 w-5 text-teal-200" />}
                  {node.level === "Roots" && <Users className="h-5 w-5 text-amber-200" />}
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-100">{lang === 'cs' ? {
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
                    <div key={guardian.name} className="zion-rainbow-sub p-3">
                      <p className="text-sm font-semibold text-zion-gold">{guardian.name}</p>
                      <p className="text-xs text-gray-200">{lang === 'cs' ? {
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
        <section className="zion-rainbow-card p-8" style={emeraldVar}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">{DashboardDaoTreeCopy.consciousnessMining[lang === 'cs' ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white">{DashboardDaoTreeCopy.kabbalahTreeOfLife144kGuardian[lang === 'cs' ? 'cs' : 'en']}</h2>
              <p className="text-gray-300 max-w-2xl">
                {DashboardDaoTreeCopy.k9ConsciousnessLevelsMappedTo10[lang === 'cs' ? 'cs' : 'en']}
              </p>
            </div>
            <div className="zion-rainbow-sub flex items-center gap-3 px-4 py-2 text-sm" style={goldVar}>
              <Star className="h-5 w-5 text-zion-gold" />
              <span className="text-white">{DashboardDaoTreeCopy.realTimeDaoTracking[lang === 'cs' ? 'cs' : 'en']}</span>
            </div>
          </div>
          <GuardiansTreeClient />
        </section>

        <section className="zion-rainbow-card p-8" style={emeraldVar}>
          <div className="flex items-center gap-3 mb-6">
            <Star className="h-6 w-6 text-zion-gold" />
            <h2 className="text-3xl font-semibold">{DashboardDaoTreeCopy.hallOfGuardians[lang === 'cs' ? 'cs' : 'en']}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {guardianHall.map((guardian) => (
              <div key={guardian.name} className="zion-rainbow-sub p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-500">{lang === 'cs' ? {
                      'Community': 'Komunita',
                      'Builders': 'Vývojáři',
                      'Guardians': 'Strážci',
                    }[guardian.realm] || guardian.realm : guardian.realm}</p>
                    <h3 className="text-2xl font-semibold text-white">{guardian.name}</h3>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-zion-cyan" />
                </div>
                <div className="mt-4 space-y-1 text-sm text-gray-300">
                  <p>{DashboardDaoTreeCopy.role[lang === 'cs' ? 'cs' : 'en']}: <span className="font-semibold text-white">{guardian.role}</span></p>
                  <p>{DashboardDaoTreeCopy.allocation[lang === 'cs' ? 'cs' : 'en']}: <span className="font-mono text-zion-gold">{guardian.allocation}</span></p>
                  <p>Wallet: <span className="font-mono">{guardian.wallet}</span></p>
                  <p>{DashboardDaoTreeCopy.date[lang === 'cs' ? 'cs' : 'en']}: <span>{guardian.joined}</span></p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="zion-rainbow-card p-6" style={emeraldVar}>
            <div className="flex items-center gap-3 mb-4">
              <Gem className="h-5 w-5 text-pink-200" />
              <h3 className="text-2xl font-semibold">{DashboardDaoTreeCopy.perksMechanics[lang === 'cs' ? 'cs' : 'en']}</h3>
            </div>
            <ul className="space-y-4 text-sm text-gray-200">
              {perks.map((perk) => (
                <li key={perk.title} className="zion-rainbow-sub p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">{perk.title}</p>
                  <p className="mt-2 text-gray-100">{perk.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="zion-rainbow-card p-6" style={emeraldVar}>
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-5 w-5 text-emerald-200" />
              <h3 className="text-2xl font-semibold">{DashboardDaoTreeCopy.comingSoon[lang === 'cs' ? 'cs' : 'en']}</h3>
            </div>
            <ul className="space-y-4 text-sm text-gray-200">
              {upcoming.map((item) => (
                <li key={item.title} className="zion-rainbow-sub p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zion-cyan">{item.title}</p>
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
