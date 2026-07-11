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

export default function Roadmap295Page() {
  const { lang } = useLang();
  const [activeQuarter, setActiveQuarter] = useState<string | null>(null);

  const currentState = [
    { component: 'AI Native', progress: 100, status: 'complete', color: 'green' },
    { component: 'Pool Server (Python)', progress: 100, status: 'complete', color: 'yellow' },
    { component: 'Blockchain (Python)', progress: 100, status: 'complete', color: 'yellow' },
    { component: lang === 'cs' ? 'Pool Native (Rust)' : 'Pool Native (Rust)', progress: 0, status: 'pending', color: 'red' },
    { component: lang === 'cs' ? 'Blockchain Native (Rust)' : 'Blockchain Native (Rust)', progress: 0, status: 'pending', color: 'red' },
    { component: lang === 'cs' ? 'Rainbow Bridge' : 'Rainbow Bridge', progress: 0, status: 'pending', color: 'red' },
    { component: lang === 'cs' ? 'Wallets (CLI + Web)' : 'Wallets (CLI + Web)', progress: 0, status: 'pending', color: 'red' }
  ];

  const quarters = [
    {
      id: 'q1',
      name: 'Q1 2025',
      title: lang === 'cs' ? 'Pool Native (Rust)' : 'Pool Native (Rust)',
      months: lang === 'cs' ? 'Leden - Březen' : 'January - March',
      status: 'active',
      color: 'cyan',
      budget: '$60k',
      team: lang === 'cs' ? '2 Rust engineers' : '2 Rust engineers',
      deliverables: [
        'Stratum V2 server (Rust)',
        'Vardiff algorithm optimization',
        'PPLNS payout system',
        'PostgreSQL integration',
        lang === 'cs' ? 'Real-time monitoring dashboard' : 'Real-time monitoring dashboard',
        lang === 'cs' ? 'Load test: 10,000 miners' : 'Load test: 10,000 miners'
      ],
      performance: [
        { metric: lang === 'cs' ? 'Miners' : 'Miners', target: '10,000+', current: '~2,000' },
        { metric: lang === 'cs' ? 'Shares/sec' : 'Shares/sec', target: '5,000+', current: '~500' },
        { metric: lang === 'cs' ? 'Latency' : 'Latency', target: '< 50ms', current: '~200ms' },
        { metric: 'CPU', target: '< 30%', current: '~80%' }
      ]
    },
    {
      id: 'q2',
      name: 'Q2 2025',
      title: lang === 'cs' ? 'Blockchain Native (Rust)' : 'Blockchain Native (Rust)',
      months: lang === 'cs' ? 'Duben - Červen' : 'April - June',
      status: 'pending',
      color: 'purple',
      budget: '$90k',
      team: lang === 'cs' ? '3 Rust engineers' : '3 Rust engineers',
      deliverables: [
        'UTXO model implementation',
        lang === 'cs' ? 'Mempool + transaction validation' : 'Mempool + transaction validation',
        lang === 'cs' ? 'Block validation engine' : 'Block validation engine',
        'P2P networking (libp2p)',
        lang === 'cs' ? 'Consensus algorithm (PoW)' : 'Consensus algorithm (PoW)',
        lang === 'cs' ? 'Load test: 500 TPS' : 'Load test: 500 TPS'
      ],
      performance: [
        { metric: 'TPS', target: '500+', current: '~50' },
        { metric: lang === 'cs' ? 'Block time' : 'Block time', target: lang === 'cs' ? '60s avg' : '60s avg', current: '~120s' },
        { metric: lang === 'cs' ? 'Orphan rate' : 'Orphan rate', target: '< 1%', current: '~5%' },
        { metric: lang === 'cs' ? 'Peers' : 'Peers', target: '100+', current: '~20' }
      ]
    },
    {
      id: 'q3',
      name: 'Q3 2025',
      title: lang === 'cs' ? 'Bridge + Wallet Native' : 'Bridge + Wallet Native',
      months: lang === 'cs' ? 'Červenec - Září' : 'July - September',
      status: 'pending',
      color: 'gold',
      budget: '$90k',
      team: lang === 'cs' ? '2 Rust + 1 Frontend' : '2 Rust + 1 Frontend',
      deliverables: [
        lang === 'cs' ? 'Rainbow Bridge Ethereum' : 'Rainbow Bridge Ethereum',
        'CLI Wallet (Rust)',
        'Web Wallet (WASM)',
        'Key management (Ed25519)',
        lang === 'cs' ? 'Bridge smart contracts' : 'Bridge smart contracts',
        lang === 'cs' ? 'Cross-chain transactions' : 'Cross-chain transactions'
      ],
      performance: [
        { metric: lang === 'cs' ? 'Chains' : 'Chains', target: '44 chains', current: '1 (ETH)' },
        { metric: lang === 'cs' ? 'Bridge speed' : 'Bridge speed', target: '< 5min', current: 'N/A' },
        { metric: lang === 'cs' ? 'Wallet load' : 'Wallet load', target: '< 1s', current: 'N/A' },
        { metric: lang === 'cs' ? 'Security' : 'Security', target: lang === 'cs' ? 'Multi-sig' : 'Multi-sig', current: 'N/A' }
      ]
    },
    {
      id: 'q4',
      name: 'Q4 2025',
      title: lang === 'cs' ? 'Polish + Historical V3 Launch Target' : 'Polish + Historical V3 Launch Target',
      months: lang === 'cs' ? 'Říjen - Prosinec' : 'October - December',
      status: 'pending',
      color: 'green',
      budget: '$80k',
      team: lang === 'cs' ? 'Full team + Marketing' : 'Full team + Marketing',
      deliverables: [
        lang === 'cs' ? 'Rainbow Bridge 44:44 complete' : 'Rainbow Bridge 44:44 complete',
        lang === 'cs' ? 'Security audit ($50k)' : 'Security audit ($50k)',
        lang === 'cs' ? 'Bug bounty program' : 'Bug bounty program',
        lang === 'cs' ? 'Historical V3 launch target deployment' : 'Historical V3 launch target deployment',
        lang === 'cs' ? 'Documentation + guides' : 'Documentation + guides',
        lang === 'cs' ? 'Launch event (31.12.2025)' : 'Launch event (31.12.2025)'
      ],
      performance: [
        { metric: lang === 'cs' ? 'Nodes' : 'Nodes', target: '100+', current: 'N/A' },
        { metric: lang === 'cs' ? 'Miners' : 'Miners', target: '1,000+', current: 'N/A' },
        { metric: lang === 'cs' ? 'Uptime' : 'Uptime', target: '99.9%', current: 'N/A' },
        { metric: lang === 'cs' ? 'Vulnerabilities' : 'Vulnerabilities', target: lang === 'cs' ? '0 critical' : '0 critical', current: 'N/A' }
      ]
    }
  ];

  const milestones = [
    { date: '31.03.2025', title: lang === 'cs' ? 'Pool Native Complete' : 'Pool Native Complete', status: 'pending', color: 'cyan', icon: Server },
    { date: '30.06.2025', title: lang === 'cs' ? 'Blockchain Native Complete' : 'Blockchain Native Complete', status: 'pending', color: 'purple', icon: Layers },
    { date: '30.09.2025', title: lang === 'cs' ? 'Bridge + Wallet Complete' : 'Bridge + Wallet Complete', status: 'pending', color: 'gold', icon: Link2 },
    { date: '31.12.2025', title: lang === 'cs' ? 'Historical V3 Launch Target' : 'Historical V3 Launch Target', status: 'pending', color: 'green', icon: Rocket },
    { date: '31.12.2026', title: lang === 'cs' ? 'Historical MainNet Target' : 'Historical MainNet Target', status: 'future', color: 'white', icon: Sparkles }
  ];

  return (
    <div className="pb-20 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-zion-cyan/20 via-transparent to-transparent" />
        <div className="zion-container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zion-cyan/20 border border-zion-cyan/30 mb-6">
            <Rocket className="w-4 h-4 text-zion-cyan" />
            <span className="text-sm font-medium text-zion-cyan">Version 2.9.5 — {lang === 'cs' ? 'Nativní probuzení' : 'Native Awakening'}</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-linear-to-r from-zion-cyan via-zion-purple to-zion-gold bg-clip-text text-transparent">
            🌟 {lang === 'cs' ? 'ZION NATIVE ROADMAP' : 'ZION NATIVE ROADMAP'}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
            <strong>{lang === 'cs' ? 'NATIVNÍ PROBUZENÍ' : 'NATIVE AWAKENING'}</strong>
          </p>
          <p className="text-lg text-gray-400">
            {lang === 'cs' ? '100% Nativní Stack • 12 měsíců • Historický archiv roadmapy' : '100% Native Stack • 12 Months • Historical roadmap archive'}
          </p>
        </div>
      </section>

      {/* Vision Statement */}
      <section className="py-16 px-6">
        <div className="zion-container">
          <div className="zion-section p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <h2 className="text-3xl font-bold text-zion-cyan mb-6">🎯 {lang === 'cs' ? 'Vizní prohlášení' : 'Vision Statement'}</h2>
              <div className="zion-rainbow-sub p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                <p className="text-3xl font-bold text-white mb-6">
                  ZION 2.9.5 = 100% {lang === 'cs' ? 'NATIVNÍ VĚDOMÍ' : 'NATIVE CONSCIOUSNESS'}
                </p>
                <div className="grid md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-4xl font-bold text-red-400 mb-2">83% → 0%</div>
                    <div className="text-sm text-gray-400">{lang === 'cs' ? 'Python kód' : 'Python Code'}</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-green-400 mb-2">17% → 100%</div>
                    <div className="text-sm text-gray-400">{lang === 'cs' ? 'Nativní Rust' : 'Native Rust'}</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-zion-cyan mb-2">1x → 100x</div>
                    <div className="text-sm text-gray-400">{lang === 'cs' ? 'Výkon' : 'Performance'}</div>
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
            📊 {lang === 'cs' ? 'Historický snímek stavu (Prosinec 2025)' : 'Historical State Snapshot (December 2025)'}
          </h2>
          <div className="space-y-4">
            {currentState.map((item, idx) => (
              <div
                key={idx}
                className="zion-rainbow-sub p-6"
                style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {item.status === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-500" />
                    )}
                    <span className="text-lg font-semibold text-white">{item.component}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    item.status === 'complete'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {item.progress}%
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-linear-to-r ${
                      item.status === 'complete'
                        ? 'from-green-500 to-green-400'
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
              <span>{lang === 'cs' ? '12měsíční vývojový plán' : '12-Month Development Plan'}</span>
            </div>
          </h2>
          <div className="grid lg:grid-cols-2 gap-8">
            {quarters.map((quarter) => {
              const rc = quarter.color === 'cyan' ? '6, 182, 212' : quarter.color === 'purple' ? '147, 51, 234' : quarter.color === 'gold' ? '255, 215, 0' : '34, 197, 94';
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
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                  }`}>
                    {quarter.status === 'active' ? (lang === 'cs' ? 'Probíhá' : 'In Progress') : (lang === 'cs' ? 'Čeká' : 'Pending')}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-4">{quarter.title}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': rc } as React.CSSProperties}>
                    <div className="text-xs text-gray-400 mb-1">{lang === 'cs' ? 'Rozpočet' : 'Budget'}</div>
                    <div className={`text-lg font-bold text-zion-${quarter.color}`}>{quarter.budget}</div>
                  </div>
                  <div className="zion-rainbow-sub p-3" style={{ '--rc': rc } as React.CSSProperties}>
                    <div className="text-xs text-gray-400 mb-1">{lang === 'cs' ? 'Tým' : 'Team'}</div>
                    <div className="text-sm font-semibold text-white">{quarter.team}</div>
                  </div>
                </div>

                {activeQuarter === quarter.id && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div>
                      <h4 className={`text-sm font-semibold text-zion-${quarter.color} mb-3 flex items-center gap-2`}>
                        <CheckCircle2 className="w-4 h-4" />
                        {lang === 'cs' ? 'Klíčové výstupy' : 'Key Deliverables'}
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
                        {lang === 'cs' ? 'Cíle výkonu' : 'Performance Targets'}
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
                    {activeQuarter === quarter.id ? (lang === 'cs' ? 'Zobrazit méně' : 'Show less') : (lang === 'cs' ? 'Zobrazit více' : 'Show more')}
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
              <span>{lang === 'cs' ? 'Klíčové milníky' : 'Critical Milestones'}</span>
            </div>
          </h2>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-linear-to-b from-zion-cyan via-zion-purple to-zion-gold" />

            {/* Milestone Items */}
            <div className="space-y-8">
              {milestones.map((milestone, idx) => {
                const rc = milestone.color === 'cyan' ? '6, 182, 212' : milestone.color === 'purple' ? '147, 51, 234' : milestone.color === 'gold' ? '255, 215, 0' : milestone.color === 'green' ? '34, 197, 94' : '255, 255, 255';
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
          <div className="zion-rainbow-card p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Zap className="w-8 h-8 text-green-400" />
                <h2 className="text-3xl font-bold text-green-400 mb-0">
                  {lang === 'cs' ? 'Historické požadavky na V3 Launch' : 'Historical V3 Launch Requirements'}
                </h2>
              </div>
              <div className="text-gray-300 space-y-6">
                <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                  <p className="text-2xl font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <Rocket className="w-8 h-8" />
                    <span>{lang === 'cs' ? '31. prosince 2025' : 'December 31, 2025'}</span>
                  </p>
                  <div className="grid md:grid-cols-2 gap-6 text-left">
                    <div>
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        {lang === 'cs' ? 'Technické' : 'Technical'}
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 100+ {lang === 'cs' ? 'uzlů běží' : 'nodes running'}</li>
                        <li>• 10,000+ {lang === 'cs' ? 'minerů připojeno' : 'miners connected'}</li>
                        <li>• {lang === 'cs' ? 'Pool Native (Rust)' : 'Pool Native (Rust)'}</li>
                        <li>• {lang === 'cs' ? 'Blockchain Native (Rust)' : 'Blockchain Native (Rust)'}</li>
                        <li>• {lang === 'cs' ? 'Rainbow Bridge (ETH)' : 'Rainbow Bridge (ETH)'}</li>
                        <li>• {lang === 'cs' ? 'Web + CLI wallets' : 'Web + CLI wallets'}</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        {lang === 'cs' ? 'Výkon' : 'Performance'}
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 500+ TPS {lang === 'cs' ? 'ověřeno' : 'verified'}</li>
                        <li>• {'<'} 50ms {lang === 'cs' ? 'mining latency' : 'mining latency'}</li>
                        <li>• 99.9% {lang === 'cs' ? 'uptime' : 'uptime'}</li>
                        <li>• {'<'} 1% {lang === 'cs' ? 'orphan rate' : 'orphan rate'}</li>
                        <li>• {lang === 'cs' ? 'Multi-chain bridge' : 'Multi-chain bridge'}</li>
                        <li>• 0 {lang === 'cs' ? 'kritických zranitelností' : 'critical vulnerabilities'}</li>
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
          <div className="zion-rainbow-card p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <div className="flex items-center justify-center gap-3 mb-6">
                <TrendingUp className="w-8 h-8 text-zion-gold" />
                <h2 className="text-3xl font-bold text-zion-gold mb-0">
                  {lang === 'cs' ? 'Historická MainNet vize 2026' : 'Historical MainNet Vision 2026'}
                </h2>
              </div>
              <div className="text-gray-300 space-y-6">
                <p className="text-2xl font-bold text-white">
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-8 h-8 text-zion-gold" />
                    <span>{lang === 'cs' ? '31. prosince 2026' : 'December 31, 2026'}</span>
                  </span>
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '255, 215, 0' } as React.CSSProperties}>
                    <div className="flex justify-center mb-3">
                      <Zap className="w-12 h-12 text-zion-gold" />
                    </div>
                    <div className="text-2xl font-bold text-zion-gold mb-2">1,000+ TPS</div>
                    <div className="text-sm text-gray-400">{lang === 'cs' ? 'Historický cíl' : 'Historical target'}</div>
                  </div>
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                    <div className="flex justify-center mb-3">
                      <Link2 className="w-12 h-12 text-zion-cyan" />
                    </div>
                    <div className="text-2xl font-bold text-zion-cyan mb-2">44 Chains</div>
                    <div className="text-sm text-gray-400">{lang === 'cs' ? 'Rainbow Bridge' : 'Rainbow Bridge'}</div>
                  </div>
                  <div className="zion-rainbow-sub p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                    <div className="flex justify-center mb-3">
                      <Users className="w-12 h-12 text-zion-purple" />
                    </div>
                    <div className="text-2xl font-bold text-zion-purple mb-2">50k Miners</div>
                    <div className="text-sm text-gray-400">{lang === 'cs' ? 'Globální síť' : 'Global Network'}</div>
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
                <span>{lang === 'cs' ? 'SMĚREM KE HVĚZDĚ' : 'TOWARD THE STAR'}</span>
              </div>
            </h2>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <p className="text-xl text-gray-200 mb-6">
                <strong>100% {lang === 'cs' ? 'Nativní Stack' : 'Native Stack'}</strong><br />
                <strong>100% {lang === 'cs' ? 'Vědomí' : 'Consciousness'}</strong><br />
                <strong>100% {lang === 'cs' ? 'Zlatý věk' : 'Golden Age'}</strong>
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
                  <strong>{lang === 'cs' ? 'Mír a jedna láska' : 'Peace and One Love'}</strong>
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
