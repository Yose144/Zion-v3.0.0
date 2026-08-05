'use client';

import { ArrowRight, CalendarDays, CheckCircle2, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const RoadmapPulseCopy = {
  l1TerranovaGenesis301: { cs: `L1 TerraNova — Genesis 3.0.1`, en: `L1 TerraNova — Genesis 3.0.1` },
  marJun2026: { cs: `Čer — Čvn 2026`, en: `Mar — Jun 2026` },
  genesis301Successful11Jun2026M: { cs: `Genesis 3.0.1 úspěšný 11. 6. 2026 — MainNet Edge server topologie běží`, en: `Genesis 3.0.1 successful 11 Jun 2026 — MainNet Edge server topology live` },
  poolActive89551SplitVerifiedEx: { cs: `Pool aktivní, 89/5/5/1 split ověřen, explorer synchronizován`, en: `Pool active, 89/5/5/1 split verified, explorer synced` },
  lwmaDaaDualAlgoMiningGpuCpuStr: { cs: `LWMA DAA, dual-algo mining, GPU/CPU stratum live`, en: `LWMA DAA, dual-algo mining, GPU/CPU stratum live` },
  l2BridgeDefiRunV306: { cs: `L2 Bridge, DeFi Run — v3.0.6`, en: `L2 Bridge, DeFi Run — v3.0.6` },
  jun2026: { cs: `Čvn 2026`, en: `Jun 2026` },
  bridgeDeployedOnBaseMainnetWzi: { cs: `Bridge nasazen na Base Mainnet — wZION token live`, en: `Bridge deployed on Base Mainnet — wZION token live` },
  defiContractsActiveSwapBridgeP: { cs: `DeFi kontrakty aktivní — swap, bridge, portfolio`, en: `DeFi contracts active — swap, bridge, portfolio` },
  atomicSwapApiFunctionalCrossCh: { cs: `Atomic swap API funkční — cross-chain operace`, en: `Atomic swap API functional — cross-chain operations` },
  launchOpsSecurityClosure: { cs: `Launch Ops & Bezpečnostní uzávěr`, en: `Launch Ops & Security Closure` },
  junDec2026: { cs: `Čvn — Pro 2026`, en: `Jun — Dec 2026` },
  bfgScrubGenesisArtifactsChecks: { cs: `BFG scrub + genesis artefakty / checksumy v průběhu`, en: `BFG scrub + genesis artifacts / checksums in progress` },
  externalSecurityAuditScheduled: { cs: `Externí bezpečnostní audit naplánován (Q4 2026)`, en: `External security audit scheduled (Q4 2026)` },
  documentationMonitoringBridgeP: { cs: `Dokumentace, monitoring, bridge provisioning — odpočet k 31. 12. 2026`, en: `Documentation, monitoring, bridge provisioning — countdown to 31 Dec 2026` },
  publicLaunchGate: { cs: `Veřejný launch`, en: `Public Launch Gate` },
  k31Dec2026: { cs: `31. Pro 2026`, en: `31 Dec 2026` },
  genesisFreezeAllParametersBein: { cs: `Genesis freeze — všechny parametry finalizovány`, en: `Genesis freeze — all parameters being finalized` },
  publicLaunchScheduledCountdown: { cs: `Veřejný launch naplánován — odpočet aktivní`, en: `Public launch scheduled — countdown active` },
  coingeckoListingWzionBridgeInP: { cs: `CoinGecko listing + wZION bridge v přípravě`, en: `CoinGecko listing + wZION bridge in preparation` },
  mainnetGenesisCosmicHarmonyV3V: { cs: `Mainnet genesis, Cosmic Harmony v3/v4, UTXO, zásoba 144B ZION`, en: `MainNet Genesis, Cosmic Harmony v3/v4, UTXO, 144B ZION supply` },
  wzionDexOnBaseMainnetLiveBridg: { cs: `wZION DEX na Base Mainnet live, bridge relay, treasury rails a DAO governance vrstva`, en: `wZION DEX on Base Mainnet live, bridge relay, treasury rails, and the DAO governance layer` },
  hiranyagarbhaRuntimeTheNclComp: { cs: `Hiranyagarbha runtime, NCL compute lane, WARP relaye a agentická orchestrace nad L1/L2`, en: `Hiranyagarbha runtime, the NCL compute lane, WARP relays, and agentic orchestration above L1/L2` },
  goldenEggXpEconomyWinnersProgr: { cs: `Golden Egg, XP ekonomika, Winners program, herní vrstva`, en: `Golden Egg, XP economy, Winners program, game layer` },
  humanitarianMissionsFreeEnergy: { cs: `Humanitární mise, free-energy R&D, off-grid komunity`, en: `Humanitarian missions, free energy R&D, off-grid communities` },
  orbitalObservatoryLeoResearchS: { cs: `Orbitální observatoř, LEO výzkumná stanice, dlouhodobý misijní layer`, en: `Orbital observatory, LEO research station, long-range mission layer` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  mainnetGenesis11Jun2026Success: { cs: `MainNet Genesis 11. 6. 2026 úspěšný — public line 3.0.6 Bridge, DeFi Run nad kanonickou runtime v3.0.6 Deeksha/Ekam. Decimal fork 1e12→1e6 (6-decimal flowers) dokončen. Edge server topologie běží, pool aktivní, mining live. Bridge a DeFi protokoly nasazeny na Base Mainnet, wZION token live. Veřejný launch zůstává naplánován na 31. prosinec 2026 (Silvestr). Prioritou je finální validace telemetrie, doladění dokumentace, bezpečnostní audit a provozní připravenost.`, en: `MainNet Genesis 11 Jun 2026 successful — public line 3.0.6 Bridge, DeFi Run over the canonical v3.0.6 Deeksha/Ekam runtime. Decimal fork 1e12→1e6 (6-decimal flowers) complete. Edge server topology running, pool active, mining live. Bridge and DeFi protocols deployed on Base Mainnet, wZION token live. Public launch remains scheduled for 31 December 2026 (New Year\'s Eve). Priority is final telemetry validation, documentation polish, security audit, and operational readiness.` },
  fullRoadmap: { cs: `Celá roadmapa`, en: `Full Roadmap` },
  blockExplorer: { cs: `Průzkumník blockchainu`, en: `Block Explorer` },
  k6LayerVision: { cs: `6vrstva vize`, en: `6-Layer Vision` },
  k6LayerVisionAfterThePureCodeBa: { cs: `6vrstva vize po Pure Code baseline`, en: `6-layer vision — after the Pure Code baseline` },
};

const getPhaseCards = (cs: boolean) => [
  {
    name: RoadmapPulseCopy.l1TerranovaGenesis301[cs ? 'cs' : 'en'],
    window: RoadmapPulseCopy.marJun2026[cs ? 'cs' : 'en'],
    progress: 100,
    highlights: [
      RoadmapPulseCopy.genesis301Successful11Jun2026M[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.poolActive89551SplitVerifiedEx[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.lwmaDaaDualAlgoMiningGpuCpuStr[cs ? 'cs' : 'en'],
    ],
  },
  {
    name: RoadmapPulseCopy.l2BridgeDefiRunV306[cs ? 'cs' : 'en'],
    window: RoadmapPulseCopy.jun2026[cs ? 'cs' : 'en'],
    progress: 100,
    highlights: [
      RoadmapPulseCopy.bridgeDeployedOnBaseMainnetWzi[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.defiContractsActiveSwapBridgeP[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.atomicSwapApiFunctionalCrossCh[cs ? 'cs' : 'en'],
    ],
  },
  {
    name: RoadmapPulseCopy.launchOpsSecurityClosure[cs ? 'cs' : 'en'],
    window: RoadmapPulseCopy.junDec2026[cs ? 'cs' : 'en'],
    progress: 40,
    highlights: [
      RoadmapPulseCopy.bfgScrubGenesisArtifactsChecks[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.externalSecurityAuditScheduled[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.documentationMonitoringBridgeP[cs ? 'cs' : 'en'],
    ],
  },
  {
    name: RoadmapPulseCopy.publicLaunchGate[cs ? 'cs' : 'en'],
    window: RoadmapPulseCopy.k31Dec2026[cs ? 'cs' : 'en'],
    progress: 15,
    highlights: [
      RoadmapPulseCopy.genesisFreezeAllParametersBein[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.publicLaunchScheduledCountdown[cs ? 'cs' : 'en'],
      RoadmapPulseCopy.coingeckoListingWzionBridgeInP[cs ? 'cs' : 'en'],
    ],
  },
];

const getTimeline = (cs: boolean) => [
  {
    title: '⛏️ L1 TerraNova · 2026',
    focus: RoadmapPulseCopy.mainnetGenesisCosmicHarmonyV3V[cs ? 'cs' : 'en'],
  },
  {
    title: '🌉 L2 Bridge, DAO & DeFi · 2026',
    focus: RoadmapPulseCopy.wzionDexOnBaseMainnetLiveBridg[cs ? 'cs' : 'en'],
  },
  {
    title: '🧠 L3 AI Native, WARP & NCL · 2027–2028',
    focus: RoadmapPulseCopy.hiranyagarbhaRuntimeTheNclComp[cs ? 'cs' : 'en'],
  },
  {
    title: '🎮 L4 Oasis · 2029',
    focus: RoadmapPulseCopy.goldenEggXpEconomyWinnersProgr[cs ? 'cs' : 'en'],
  },
  {
    title: '🌍 L5 Free World · 2030',
    focus: RoadmapPulseCopy.humanitarianMissionsFreeEnergy[cs ? 'cs' : 'en'],
  },
  {
    title: '🔭 L6 Issobella · 2040+',
    focus: RoadmapPulseCopy.orbitalObservatoryLeoResearchS[cs ? 'cs' : 'en'],
  },
];

export default function RoadmapPulse() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const phaseCards = getPhaseCards(cs);
  const timeline = getTimeline(cs);

  return (
    <section className="py-8 px-4">
      <div className="zion-container space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-zion-gold">{RoadmapPulseCopy.roadmap[cs ? 'cs' : 'en']}</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              3.0.6 <span className="text-gradient">Bridge, DeFi Run</span>
            </h2>
            <p className="text-sm text-gray-300 max-w-2xl">
              {RoadmapPulseCopy.mainnetGenesis11Jun2026Success[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-sm font-semibold"
            >
              {RoadmapPulseCopy.fullRoadmap[cs ? 'cs' : 'en']}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explorer"
              className="zion-rainbow-sub inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{ '--rc': '249, 115, 22' } as React.CSSProperties}
            >
              <CalendarDays className="w-4 h-4 text-zion-cyan" />
              {RoadmapPulseCopy.blockExplorer[cs ? 'cs' : 'en']}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {phaseCards.map((phase, idx) => (
            <div
              key={phase.name}
              className="zion-rainbow-card p-4 space-y-3 backdrop-blur"
              style={{ '--rc': '249, 115, 22' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{phase.window}</p>
                  <h3 className="text-base font-semibold text-white">{phase.name}</h3>
                </div>
                <div className="px-2 py-0.5 text-[10px] font-semibold text-zion-gold bg-zion-gold/10 rounded-full">
                  {phase.progress}%
                </div>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  style={{ width: `${phase.progress}%` }}
                  className="h-full bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan"
                />
              </div>
              <ul className="space-y-1.5 text-xs text-gray-300">
                {phase.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zion-cyan mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="zion-rainbow-card p-4" style={{ '--rc': '249, 115, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-5 h-5 text-zion-cyan" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">{RoadmapPulseCopy.k6LayerVision[cs ? 'cs' : 'en']}</p>
              <h3 className="text-base font-semibold text-white">{RoadmapPulseCopy.k6LayerVisionAfterThePureCodeBa[cs ? 'cs' : 'en']}</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {timeline.map((entry) => (
              <div key={entry.title} className="zion-rainbow-sub p-3" style={{ '--rc': '249, 115, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">{entry.title}</p>
                <p className="text-xs text-gray-200 mt-1 leading-relaxed">{entry.focus}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
