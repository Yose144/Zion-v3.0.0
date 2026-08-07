'use client';

import { useState } from 'react';
import { useLang } from "@/contexts/LanguageContext";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Heart,
  Layers,
  Link2,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

const Roadmap295Copy = {
  poolNativeRust: { cs: `Pool Native (Rust)`, en: `Pool Native (Rust)` },
  blockchainNativeRust: { cs: `Blockchain Native (Rust)`, en: `Blockchain Native (Rust)` },
  rainbowBridge: { cs: `Rainbow Bridge`, en: `Rainbow Bridge` },
  walletsCliWeb: { cs: `Wallets (CLI + Web)`, en: `Wallets (CLI + Web)` },
  januaryMarch: { cs: `Leden - Březen`, en: `January - March` },
  k2RustEngineers: { cs: `2 Rust engineers`, en: `2 Rust engineers` },
  realTimeMonitoringDashboard: { cs: `Real-time monitoring dashboard`, en: `Real-time monitoring dashboard` },
  loadTest10000Miners: { cs: `Load test: 10,000 miners`, en: `Load test: 10,000 miners` },
  miners: { cs: `Miners`, en: `Miners` },
  sharesSec: { cs: `Shares/sec`, en: `Shares/sec` },
  latency: { cs: `Latency`, en: `Latency` },
  aprilJune: { cs: `Duben - Červen`, en: `April - June` },
  k3RustEngineers: { cs: `3 Rust engineers`, en: `3 Rust engineers` },
  mempoolTransactionValidation: { cs: `Mempool + transaction validation`, en: `Mempool + transaction validation` },
  blockValidationEngine: { cs: `Block validation engine`, en: `Block validation engine` },
  consensusAlgorithmPow: { cs: `Consensus algorithm (PoW)`, en: `Consensus algorithm (PoW)` },
  loadTest500Tps: { cs: `Load test: 500 TPS`, en: `Load test: 500 TPS` },
  blockTime: { cs: `Block time`, en: `Block time` },
  k60sAvg: { cs: `60s avg`, en: `60s avg` },
  orphanRate: { cs: `Orphan rate`, en: `Orphan rate` },
  peers: { cs: `Peers`, en: `Peers` },
  bridgeWalletNative: { cs: `Bridge + Wallet Native`, en: `Bridge + Wallet Native` },
  julySeptember: { cs: `Červenec - Září`, en: `July - September` },
  k2Rust1Frontend: { cs: `2 Rust + 1 Frontend`, en: `2 Rust + 1 Frontend` },
  rainbowBridgeEthereum: { cs: `Rainbow Bridge Ethereum`, en: `Rainbow Bridge Ethereum` },
  bridgeSmartContracts: { cs: `Bridge smart contracts`, en: `Bridge smart contracts` },
  crossChainTransactions: { cs: `Cross-chain transactions`, en: `Cross-chain transactions` },
  chains: { cs: `Chains`, en: `Chains` },
  bridgeSpeed: { cs: `Bridge speed`, en: `Bridge speed` },
  walletLoad: { cs: `Wallet load`, en: `Wallet load` },
  security: { cs: `Security`, en: `Security` },
  multiSig: { cs: `Multi-sig`, en: `Multi-sig` },
  polishHistoricalV3LaunchTarget: { cs: `Polish + Historical V3 Launch Target`, en: `Polish + Historical V3 Launch Target` },
  octoberDecember: { cs: `Říjen - Prosinec`, en: `October - December` },
  fullTeamMarketing: { cs: `Full team + Marketing`, en: `Full team + Marketing` },
  rainbowBridge4444Complete: { cs: `Rainbow Bridge 44:44 complete`, en: `Rainbow Bridge 44:44 complete` },
  securityAudit50k: { cs: `Security audit ($50k)`, en: `Security audit ($50k)` },
  bugBountyProgram: { cs: `Bug bounty program`, en: `Bug bounty program` },
  historicalV3LaunchTargetDeploy: { cs: `Historical V3 launch target deployment`, en: `Historical V3 launch target deployment` },
  documentationGuides: { cs: `Documentation + guides`, en: `Documentation + guides` },
  launchEvent31122025: { cs: `Launch event (31.12.2025)`, en: `Launch event (31.12.2025)` },
  nodes: { cs: `Nodes`, en: `Nodes` },
  uptime: { cs: `Uptime`, en: `Uptime` },
  vulnerabilities: { cs: `Vulnerabilities`, en: `Vulnerabilities` },
  k0Critical: { cs: `0 critical`, en: `0 critical` },
  poolNativeComplete: { cs: `Pool Native Complete`, en: `Pool Native Complete` },
  blockchainNativeComplete: { cs: `Blockchain Native Complete`, en: `Blockchain Native Complete` },
  bridgeWalletComplete: { cs: `Bridge + Wallet Complete`, en: `Bridge + Wallet Complete` },
  historicalV3LaunchTarget: { cs: `Historical V3 Launch Target`, en: `Historical V3 Launch Target` },
  historicalMainnetTarget: { cs: `Historical MainNet Target`, en: `Historical MainNet Target` },
  nativeAwakening: { cs: `Nativní probuzení`, en: `Native Awakening` },
  zionNativeRoadmap: { cs: `ZION NATIVE ROADMAP`, en: `ZION NATIVE ROADMAP` },
  nativeAwakening_2: { cs: `NATIVNÍ PROBUZENÍ`, en: `NATIVE AWAKENING` },
  k100NativeStack12MonthsHistoric: { cs: `100% Nativní Stack • 12 měsíců • Historický archiv roadmapy`, en: `100% Native Stack • 12 Months • Historical roadmap archive` },
  visionStatement: { cs: `Vizní prohlášení`, en: `Vision Statement` },
  nativeConsciousness: { cs: `NATIVNÍ VĚDOMÍ`, en: `NATIVE CONSCIOUSNESS` },
  pythonCode: { cs: `Python kód`, en: `Python Code` },
  nativeRust: { cs: `Nativní Rust`, en: `Native Rust` },
  performance: { cs: `Výkon`, en: `Performance` },
  historicalStateSnapshotDecembe: { cs: `Historický snímek stavu (Prosinec 2025)`, en: `Historical State Snapshot (December 2025)` },
  k12MonthDevelopmentPlan: { cs: `12měsíční vývojový plán`, en: `12-Month Development Plan` },
  inProgress: { cs: `Probíhá`, en: `In Progress` },
  pending: { cs: `Čeká`, en: `Pending` },
  budget: { cs: `Rozpočet`, en: `Budget` },
  team: { cs: `Tým`, en: `Team` },
  keyDeliverables: { cs: `Klíčové výstupy`, en: `Key Deliverables` },
  performanceTargets: { cs: `Cíle výkonu`, en: `Performance Targets` },
  showLess: { cs: `Zobrazit méně`, en: `Show less` },
  showMore: { cs: `Zobrazit více`, en: `Show more` },
  criticalMilestones: { cs: `Klíčové milníky`, en: `Critical Milestones` },
  historicalV3LaunchRequirements: { cs: `Historické požadavky na V3 Launch`, en: `Historical V3 Launch Requirements` },
  december312025: { cs: `31. prosince 2025`, en: `December 31, 2025` },
  technical: { cs: `Technické`, en: `Technical` },
  nodesRunning: { cs: `uzlů běží`, en: `nodes running` },
  minersConnected: { cs: `minerů připojeno`, en: `miners connected` },
  rainbowBridgeEth: { cs: `Rainbow Bridge (ETH)`, en: `Rainbow Bridge (ETH)` },
  webCliWallets: { cs: `Web + CLI wallets`, en: `Web + CLI wallets` },
  verified: { cs: `ověřeno`, en: `verified` },
  miningLatency: { cs: `mining latency`, en: `mining latency` },
  uptime_2: { cs: `uptime`, en: `uptime` },
  orphanRate_2: { cs: `orphan rate`, en: `orphan rate` },
  multiChainBridge: { cs: `Multi-chain bridge`, en: `Multi-chain bridge` },
  criticalVulnerabilities: { cs: `kritických zranitelností`, en: `critical vulnerabilities` },
  historicalMainnetVision2026: { cs: `Historická MainNet vize 2026`, en: `Historical MainNet Vision 2026` },
  december312026: { cs: `31. prosince 2026`, en: `December 31, 2026` },
  historicalTarget: { cs: `Historický cíl`, en: `Historical target` },
  globalNetwork: { cs: `Globální síť`, en: `Global Network` },
  towardTheStar: { cs: `SMĚREM KE HVĚZDĚ`, en: `TOWARD THE STAR` },
  nativeStack: { cs: `Nativní Stack`, en: `Native Stack` },
  consciousness: { cs: `Vědomí`, en: `Consciousness` },
  goldenAge: { cs: `Zlatý věk`, en: `Golden Age` },
  peaceAndOneLove: { cs: `Mír a jedna láska`, en: `Peace and One Love` },
};

export default function Roadmap295Page() {
  const { lang } = useLang();
  const [activeQuarter, setActiveQuarter] = useState<string | null>(null);

  const currentState = [
    { component: 'AI Native', progress: 100, status: 'complete', color: 'green' },
    { component: 'Pool Server (Python)', progress: 100, status: 'complete', color: 'yellow' },
    { component: 'Blockchain (Python)', progress: 100, status: 'complete', color: 'yellow' },
    { component: Roadmap295Copy.poolNativeRust[lang === 'cs' ? 'cs' : 'en'], progress: 0, status: 'pending', color: 'red' },
    { component: Roadmap295Copy.blockchainNativeRust[lang === 'cs' ? 'cs' : 'en'], progress: 0, status: 'pending', color: 'red' },
    { component: Roadmap295Copy.rainbowBridge[lang === 'cs' ? 'cs' : 'en'], progress: 0, status: 'pending', color: 'red' },
    { component: Roadmap295Copy.walletsCliWeb[lang === 'cs' ? 'cs' : 'en'], progress: 0, status: 'pending', color: 'red' }
  ];

  const quarters = [
    {
      id: 'q1',
      name: 'Q1 2025',
      title: Roadmap295Copy.poolNativeRust[lang === 'cs' ? 'cs' : 'en'],
      months: Roadmap295Copy.januaryMarch[lang === 'cs' ? 'cs' : 'en'],
      status: 'active',
      color: 'cyan',
      budget: '$60k',
      team: Roadmap295Copy.k2RustEngineers[lang === 'cs' ? 'cs' : 'en'],
      deliverables: [
        'Stratum V2 server (Rust)',
        'Vardiff algorithm optimization',
        'PPLNS payout system',
        'PostgreSQL integration',
        Roadmap295Copy.realTimeMonitoringDashboard[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.loadTest10000Miners[lang === 'cs' ? 'cs' : 'en']
      ],
      performance: [
        { metric: Roadmap295Copy.miners[lang === 'cs' ? 'cs' : 'en'], target: '10,000+', current: '~2,000' },
        { metric: Roadmap295Copy.sharesSec[lang === 'cs' ? 'cs' : 'en'], target: '5,000+', current: '~500' },
        { metric: Roadmap295Copy.latency[lang === 'cs' ? 'cs' : 'en'], target: '< 50ms', current: '~200ms' },
        { metric: 'CPU', target: '< 30%', current: '~80%' }
      ]
    },
    {
      id: 'q2',
      name: 'Q2 2025',
      title: Roadmap295Copy.blockchainNativeRust[lang === 'cs' ? 'cs' : 'en'],
      months: Roadmap295Copy.aprilJune[lang === 'cs' ? 'cs' : 'en'],
      status: 'pending',
      color: 'purple',
      budget: '$90k',
      team: Roadmap295Copy.k3RustEngineers[lang === 'cs' ? 'cs' : 'en'],
      deliverables: [
        'UTXO model implementation',
        Roadmap295Copy.mempoolTransactionValidation[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.blockValidationEngine[lang === 'cs' ? 'cs' : 'en'],
        'P2P networking (libp2p)',
        Roadmap295Copy.consensusAlgorithmPow[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.loadTest500Tps[lang === 'cs' ? 'cs' : 'en']
      ],
      performance: [
        { metric: 'TPS', target: '500+', current: '~50' },
        { metric: Roadmap295Copy.blockTime[lang === 'cs' ? 'cs' : 'en'], target: Roadmap295Copy.k60sAvg[lang === 'cs' ? 'cs' : 'en'], current: '~120s' },
        { metric: Roadmap295Copy.orphanRate[lang === 'cs' ? 'cs' : 'en'], target: '< 1%', current: '~5%' },
        { metric: Roadmap295Copy.peers[lang === 'cs' ? 'cs' : 'en'], target: '100+', current: '~20' }
      ]
    },
    {
      id: 'q3',
      name: 'Q3 2025',
      title: Roadmap295Copy.bridgeWalletNative[lang === 'cs' ? 'cs' : 'en'],
      months: Roadmap295Copy.julySeptember[lang === 'cs' ? 'cs' : 'en'],
      status: 'pending',
      color: 'gold',
      budget: '$90k',
      team: Roadmap295Copy.k2Rust1Frontend[lang === 'cs' ? 'cs' : 'en'],
      deliverables: [
        Roadmap295Copy.rainbowBridgeEthereum[lang === 'cs' ? 'cs' : 'en'],
        'CLI Wallet (Rust)',
        'Web Wallet (WASM)',
        'Key management (Ed25519)',
        Roadmap295Copy.bridgeSmartContracts[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.crossChainTransactions[lang === 'cs' ? 'cs' : 'en']
      ],
      performance: [
        { metric: Roadmap295Copy.chains[lang === 'cs' ? 'cs' : 'en'], target: '44 chains', current: '1 (ETH)' },
        { metric: Roadmap295Copy.bridgeSpeed[lang === 'cs' ? 'cs' : 'en'], target: '< 5min', current: 'N/A' },
        { metric: Roadmap295Copy.walletLoad[lang === 'cs' ? 'cs' : 'en'], target: '< 1s', current: 'N/A' },
        { metric: Roadmap295Copy.security[lang === 'cs' ? 'cs' : 'en'], target: Roadmap295Copy.multiSig[lang === 'cs' ? 'cs' : 'en'], current: 'N/A' }
      ]
    },
    {
      id: 'q4',
      name: 'Q4 2025',
      title: Roadmap295Copy.polishHistoricalV3LaunchTarget[lang === 'cs' ? 'cs' : 'en'],
      months: Roadmap295Copy.octoberDecember[lang === 'cs' ? 'cs' : 'en'],
      status: 'pending',
      color: 'green',
      budget: '$80k',
      team: Roadmap295Copy.fullTeamMarketing[lang === 'cs' ? 'cs' : 'en'],
      deliverables: [
        Roadmap295Copy.rainbowBridge4444Complete[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.securityAudit50k[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.bugBountyProgram[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.historicalV3LaunchTargetDeploy[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.documentationGuides[lang === 'cs' ? 'cs' : 'en'],
        Roadmap295Copy.launchEvent31122025[lang === 'cs' ? 'cs' : 'en']
      ],
      performance: [
        { metric: Roadmap295Copy.nodes[lang === 'cs' ? 'cs' : 'en'], target: '100+', current: 'N/A' },
        { metric: Roadmap295Copy.miners[lang === 'cs' ? 'cs' : 'en'], target: '1,000+', current: 'N/A' },
        { metric: Roadmap295Copy.uptime[lang === 'cs' ? 'cs' : 'en'], target: '99.9%', current: 'N/A' },
        { metric: Roadmap295Copy.vulnerabilities[lang === 'cs' ? 'cs' : 'en'], target: Roadmap295Copy.k0Critical[lang === 'cs' ? 'cs' : 'en'], current: 'N/A' }
      ]
    }
  ];

  const milestones = [
    { date: '31.03.2025', title: Roadmap295Copy.poolNativeComplete[lang === 'cs' ? 'cs' : 'en'], status: 'pending', color: 'cyan', icon: Server },
    { date: '30.06.2025', title: Roadmap295Copy.blockchainNativeComplete[lang === 'cs' ? 'cs' : 'en'], status: 'pending', color: 'purple', icon: Layers },
    { date: '30.09.2025', title: Roadmap295Copy.bridgeWalletComplete[lang === 'cs' ? 'cs' : 'en'], status: 'pending', color: 'gold', icon: Link2 },
    { date: '31.12.2025', title: Roadmap295Copy.historicalV3LaunchTarget[lang === 'cs' ? 'cs' : 'en'], status: 'pending', color: 'green', icon: Rocket },
    { date: '31.12.2026', title: Roadmap295Copy.historicalMainnetTarget[lang === 'cs' ? 'cs' : 'en'], status: 'future', color: 'white', icon: Sparkles }
  ];

  return (
    <div className="pb-20 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-zion-cyan/20 via-transparent to-transparent" />
        <div className="zion-container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zion-cyan/20 border border-zion-cyan/30 mb-6">
            <Rocket className="w-4 h-4 text-zion-cyan" />
            <span className="text-sm font-medium text-zion-cyan">Version 2.9.5 — {Roadmap295Copy.nativeAwakening[lang === 'cs' ? 'cs' : 'en']}</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-linear-to-r from-zion-cyan via-zion-purple to-zion-gold bg-clip-text text-transparent">
            🌟 {Roadmap295Copy.zionNativeRoadmap[lang === 'cs' ? 'cs' : 'en']}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
            <strong>{Roadmap295Copy.nativeAwakening_2[lang === 'cs' ? 'cs' : 'en']}</strong>
          </p>
          <p className="text-lg text-gray-400">
            {Roadmap295Copy.k100NativeStack12MonthsHistoric[lang === 'cs' ? 'cs' : 'en']}
          </p>
        </div>
      </section>

      {/* Vision Statement */}
      <section className="py-16 px-6">
        <div className="zion-container">
          <div className="zion-section p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <h2 className="text-3xl font-bold text-zion-cyan mb-6">🎯 {Roadmap295Copy.visionStatement[lang === 'cs' ? 'cs' : 'en']}</h2>
              <div className="zion-rainbow-sub p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <p className="text-3xl font-bold text-white mb-6">
                  ZION 2.9.5 = 100% {Roadmap295Copy.nativeConsciousness[lang === 'cs' ? 'cs' : 'en']}
                </p>
                <div className="grid md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-4xl font-bold text-zion-purple mb-2">83% → 0%</div>
                    <div className="text-sm text-gray-400">{Roadmap295Copy.pythonCode[lang === 'cs' ? 'cs' : 'en']}</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-zion-cyan mb-2">17% → 100%</div>
                    <div className="text-sm text-gray-400">{Roadmap295Copy.nativeRust[lang === 'cs' ? 'cs' : 'en']}</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-zion-cyan mb-2">1x → 100x</div>
                    <div className="text-sm text-gray-400">{Roadmap295Copy.performance[lang === 'cs' ? 'cs' : 'en']}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Current State */}
      <section className="py-16 px-6">
        <div className="zion-container" style={{ maxWidth: '72rem' }}>
          <h2 className="text-3xl font-bold text-center text-zion-purple mb-12">
            📊 {Roadmap295Copy.historicalStateSnapshotDecembe[lang === 'cs' ? 'cs' : 'en']}
          </h2>
          <div className="space-y-4">
            {currentState.map((item, idx) => (
              <div
                key={idx}
                className="zion-rainbow-sub p-6"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {item.status === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-zion-cyan" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-500" />
                    )}
                    <span className="text-lg font-semibold text-white">{item.component}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    item.status === 'complete'
                      ? 'bg-zion-cyan/20 text-zion-cyan border border-zion-cyan/30'
                      : 'bg-zion-purple/20 text-zion-purple border border-zion-purple/30'
                  }`}>
                    {item.progress}%
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-linear-to-r ${
                      item.status === 'complete'
                        ? 'from-zion-cyan to-zion-cyan'
                        : 'from-gray-700 to-gray-600'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quarterly Roadmap */}
      <section className="py-16 px-6">
        <div className="zion-container" style={{ maxWidth: '80rem' }}>
          <h2 className="text-3xl font-bold text-center text-zion-gold mb-12">
            <div className="flex items-center justify-center gap-3">
              <Calendar className="w-8 h-8 text-zion-gold" />
              <span>{Roadmap295Copy.k12MonthDevelopmentPlan[lang === 'cs' ? 'cs' : 'en']}</span>
            </div>
          </h2>
          <div className="grid lg:grid-cols-2 gap-8">
            {quarters.map((quarter) => {
              const rc = quarter.color === 'cyan' ? '6, 105, 40' : quarter.color === 'purple' ? '228, 30, 43' : quarter.color === 'gold' ? '252, 209, 22' : '6, 105, 40';
              return (
                <div
                  key={quarter.id}
                  className={`zion-rainbow-card p-8 cursor-pointer ${activeQuarter === quarter.id ? 'scale-105' : ''}`}
                  style={{ '--rc': rc } as React.CSSProperties}
                  onClick={() => setActiveQuarter(activeQuarter === quarter.id ? null : quarter.id)}
                >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className={`text-2xl font-bold text-zion-${quarter.color} mb-1`}>
                      {quarter.name}
                    </div>
                    <div className="text-sm text-gray-400">{quarter.months}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    quarter.status === 'active'
                      ? 'bg-zion-cyan/20 text-zion-cyan border border-zion-cyan/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                  }`}>
                    {quarter.status === 'active' ? (Roadmap295Copy.inProgress[lang === 'cs' ? 'cs' : 'en']) : (Roadmap295Copy.pending[lang === 'cs' ? 'cs' : 'en'])}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-4">{quarter.title}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': rc } as React.CSSProperties}>
                    <div className="text-xs text-gray-400 mb-1">{Roadmap295Copy.budget[lang === 'cs' ? 'cs' : 'en']}</div>
                    <div className={`text-lg font-bold text-zion-${quarter.color}`}>{quarter.budget}</div>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': rc } as React.CSSProperties}>
                    <div className="text-xs text-gray-400 mb-1">{Roadmap295Copy.team[lang === 'cs' ? 'cs' : 'en']}</div>
                    <div className="text-sm font-semibold text-white">{quarter.team}</div>
                  </div>
                </div>

                {activeQuarter === quarter.id && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div>
                      <h4 className={`text-sm font-semibold text-zion-${quarter.color} mb-3 flex items-center gap-2`}>
                        <CheckCircle2 className="w-4 h-4" />
                        {Roadmap295Copy.keyDeliverables[lang === 'cs' ? 'cs' : 'en']}
                      </h4>
                      <ul className="space-y-2">
                        {quarter.deliverables.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className={`text-zion-${quarter.color} mt-0.5`}>•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className={`text-sm font-semibold text-zion-${quarter.color} mb-3 flex items-center gap-2`}>
                        <Activity className="w-4 h-4" />
                        {Roadmap295Copy.performanceTargets[lang === 'cs' ? 'cs' : 'en']}
                      </h4>
                      <div className="space-y-2">
                        {quarter.performance.map((perf, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">{perf.metric}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500">{perf.current}</span>
                              <span className="text-gray-600">→</span>
                              <span className={`font-semibold text-zion-${quarter.color}`}>
                                {perf.target}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-center">
                  <button className="zion-button-secondary text-xs">
                    {activeQuarter === quarter.id ? (Roadmap295Copy.showLess[lang === 'cs' ? 'cs' : 'en']) : (Roadmap295Copy.showMore[lang === 'cs' ? 'cs' : 'en'])}
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </section>

      {/* Timeline Milestones */}
      <section className="py-16 px-6">
        <div className="zion-container">
          <h2 className="text-3xl font-bold text-center text-zion-cyan mb-12">
            <div className="flex items-center justify-center gap-3">
              <Target className="w-8 h-8 text-zion-cyan" />
              <span>{Roadmap295Copy.criticalMilestones[lang === 'cs' ? 'cs' : 'en']}</span>
            </div>
          </h2>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-linear-to-b from-zion-cyan via-zion-purple to-zion-gold" />

            {/* Milestone Items */}
            <div className="space-y-8">
              {milestones.map((milestone, idx) => {
                const rc = milestone.color === 'cyan' ? '6, 105, 40' : milestone.color === 'purple' ? '228, 30, 43' : milestone.color === 'gold' ? '252, 209, 22' : milestone.color === 'green' ? '6, 105, 40' : '255, 255, 255';
                const IconComponent = milestone.icon;
                return (
                  <div key={idx} className="relative flex items-start gap-6">
                    <div className={`relative z-10 w-16 h-16 rounded-full bg-black border-2 flex items-center justify-center ${
                      milestone.status === 'future'
                        ? 'border-gray-600'
                        : `border-zion-${milestone.color}`
                    }`}>
                      {milestone.status === 'future' ? (
                        <Clock className={`w-6 h-6 text-gray-500`} />
                      ) : (
                        <IconComponent className={`w-6 h-6 text-zion-${milestone.color}`} />
                      )}
                    </div>
                    <div className="flex-1 zion-rainbow-sub p-6" style={{ '--rc': rc } as React.CSSProperties}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-white">{milestone.title}</h3>
                        <span className={`text-sm font-medium ${
                          milestone.status === 'future' ? 'text-gray-500' : `text-zion-${milestone.color}`
                        }`}>
                          {milestone.date}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Historical V3 launch requirements */}
      <section className="py-16 px-6">
        <div className="zion-container">
          <div className="zion-rainbow-card p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Zap className="w-8 h-8 text-zion-cyan" />
                <h2 className="text-3xl font-bold text-zion-cyan mb-0">
                  {Roadmap295Copy.historicalV3LaunchRequirements[lang === 'cs' ? 'cs' : 'en']}
                </h2>
              </div>
              <div className="text-gray-300 space-y-6">
                <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <p className="text-2xl font-bold text-zion-cyan mb-4 flex items-center justify-center gap-2">
                    <Rocket className="w-8 h-8" />
                    <span>{Roadmap295Copy.december312025[lang === 'cs' ? 'cs' : 'en']}</span>
                  </p>
                  <div className="grid md:grid-cols-2 gap-6 text-left">
                    <div>
                      <h3 className="text-lg font-semibold text-zion-cyan mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        {Roadmap295Copy.technical[lang === 'cs' ? 'cs' : 'en']}
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 100+ {Roadmap295Copy.nodesRunning[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• 10,000+ {Roadmap295Copy.minersConnected[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• {Roadmap295Copy.poolNativeRust[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• {Roadmap295Copy.blockchainNativeRust[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• {Roadmap295Copy.rainbowBridgeEth[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• {Roadmap295Copy.webCliWallets[lang === 'cs' ? 'cs' : 'en']}</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zion-cyan mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        {Roadmap295Copy.performance[lang === 'cs' ? 'cs' : 'en']}
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 500+ TPS {Roadmap295Copy.verified[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• {'<'} 50ms {Roadmap295Copy.miningLatency[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• 99.9% {Roadmap295Copy.uptime_2[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• {'<'} 1% {Roadmap295Copy.orphanRate_2[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• {Roadmap295Copy.multiChainBridge[lang === 'cs' ? 'cs' : 'en']}</li>
                        <li>• 0 {Roadmap295Copy.criticalVulnerabilities[lang === 'cs' ? 'cs' : 'en']}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MainNet Vision */}
      <section className="py-16 px-6">
        <div className="zion-container">
          <div className="zion-rainbow-card p-8" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <div className="flex items-center justify-center gap-3 mb-6">
                <TrendingUp className="w-8 h-8 text-zion-gold" />
                <h2 className="text-3xl font-bold text-zion-gold mb-0">
                  {Roadmap295Copy.historicalMainnetVision2026[lang === 'cs' ? 'cs' : 'en']}
                </h2>
              </div>
              <div className="text-gray-300 space-y-6">
                <p className="text-2xl font-bold text-white">
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-8 h-8 text-zion-gold" />
                    <span>{Roadmap295Copy.december312026[lang === 'cs' ? 'cs' : 'en']}</span>
                  </span>
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
                    <div className="flex justify-center mb-3">
                      <Zap className="w-12 h-12 text-zion-gold" />
                    </div>
                    <div className="text-2xl font-bold text-zion-gold mb-2">1,000+ TPS</div>
                    <div className="text-sm text-gray-400">{Roadmap295Copy.historicalTarget[lang === 'cs' ? 'cs' : 'en']}</div>
                  </div>
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                    <div className="flex justify-center mb-3">
                      <Link2 className="w-12 h-12 text-zion-cyan" />
                    </div>
                    <div className="text-2xl font-bold text-zion-cyan mb-2">44 Chains</div>
                    <div className="text-sm text-gray-400">{Roadmap295Copy.rainbowBridge[lang === 'cs' ? 'cs' : 'en']}</div>
                  </div>
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                    <div className="flex justify-center mb-3">
                      <Users className="w-12 h-12 text-zion-purple" />
                    </div>
                    <div className="text-2xl font-bold text-zion-purple mb-2">50k Miners</div>
                    <div className="text-sm text-gray-400">{Roadmap295Copy.globalNetwork[lang === 'cs' ? 'cs' : 'en']}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Finale */}
      <section className="py-20 px-6">
        <div className="zion-container text-center">
          <div className="zion-cta-banner p-12">
            <h2 className="text-5xl font-bold mb-8">
              <div className="flex items-center justify-center gap-4 bg-linear-to-r from-zion-cyan via-zion-purple to-zion-gold bg-clip-text text-transparent">
                <Sparkles className="w-12 h-12 text-zion-gold" />
                <span>{Roadmap295Copy.towardTheStar[lang === 'cs' ? 'cs' : 'en']}</span>
              </div>
            </h2>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <p className="text-xl text-gray-200 mb-6">
                <strong>100% {Roadmap295Copy.nativeStack[lang === 'cs' ? 'cs' : 'en']}</strong><br />
                <strong>100% {Roadmap295Copy.consciousness[lang === 'cs' ? 'cs' : 'en']}</strong><br />
                <strong>100% {Roadmap295Copy.goldenAge[lang === 'cs' ? 'cs' : 'en']}</strong>
              </p>
              <div className="space-y-4 text-gray-300">
                <p className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-zion-gold" />
                  <strong>JAI RAM</strong>
                  <Sparkles className="w-5 h-5 text-zion-gold" />
                </p>
                <p className="flex items-center justify-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-zion-cyan" />
                  <strong>Ave María de las Nieves</strong>
                  <Shield className="w-5 h-5 text-zion-cyan" />
                </p>
                <p className="flex items-center justify-center gap-2 mb-0">
                  <Heart className="w-5 h-5 text-zion-purple" />
                  <strong>{Roadmap295Copy.peaceAndOneLove[lang === 'cs' ? 'cs' : 'en']}</strong>
                  <Heart className="w-5 h-5 text-zion-purple" />
                </p>
              </div>
              <div className="mt-8 pt-28 border-t border-zion-cyan/30">
                <p className="text-sm italic text-gray-400 mb-0">
                  &quot;Native Philosophy → Native Code → Native Future&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
