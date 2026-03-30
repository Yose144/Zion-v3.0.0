import { redirect } from 'next/navigation';

export default function Roadmap295Page() {
  const [activeQuarter, setActiveQuarter] = useState<string | null>(null);

  const currentState = [
    { component: 'AI Native', progress: 100, status: 'complete', color: 'green' },
    { component: 'Pool Server (Python)', progress: 100, status: 'complete', color: 'yellow' },
    { component: 'Blockchain (Python)', progress: 100, status: 'complete', color: 'yellow' },
    { component: 'Pool Native (Rust)', progress: 0, status: 'pending', color: 'red' },
    { component: 'Blockchain Native (Rust)', progress: 0, status: 'pending', color: 'red' },
    { component: 'Rainbow Bridge', progress: 0, status: 'pending', color: 'red' },
    { component: 'Wallets (CLI + Web)', progress: 0, status: 'pending', color: 'red' }
  ];

  const quarters = [
    {
      id: 'q1',
      name: 'Q1 2025',
      title: 'Pool Native (Rust)',
      months: 'Leden - Březen',
      status: 'active',
      color: 'cyan',
      budget: '$60k',
      team: '2 Rust engineers',
      deliverables: [
        'Stratum V2 server (Rust)',
        'Vardiff algorithm optimization',
        'PPLNS payout system',
        'PostgreSQL integration',
        'Real-time monitoring dashboard',
        'Load test: 10,000 miners'
      ],
      performance: [
        { metric: 'Miners', target: '10,000+', current: '~2,000' },
        { metric: 'Shares/sec', target: '5,000+', current: '~500' },
        { metric: 'Latency', target: '< 50ms', current: '~200ms' },
        { metric: 'CPU', target: '< 30%', current: '~80%' }
      ]
    },
    {
      id: 'q2',
      name: 'Q2 2025',
      title: 'Blockchain Native (Rust)',
      months: 'Duben - Červen',
      status: 'pending',
      color: 'purple',
      budget: '$90k',
      team: '3 Rust engineers',
      deliverables: [
        'UTXO model implementation',
        'Mempool + transaction validation',
        'Block validation engine',
        'P2P networking (libp2p)',
        'Consensus algorithm (PoW)',
        'Load test: 500 TPS'
      ],
      performance: [
        { metric: 'TPS', target: '500+', current: '~50' },
        { metric: 'Block time', target: '60s avg', current: '~120s' },
        { metric: 'Orphan rate', target: '< 1%', current: '~5%' },
        { metric: 'Peers', target: '100+', current: '~20' }
      ]
    },
    {
      id: 'q3',
      name: 'Q3 2025',
      title: 'Bridge + Wallet Native',
      months: 'Červenec - Září',
      status: 'pending',
      color: 'gold',
      budget: '$90k',
      team: '2 Rust + 1 Frontend',
      deliverables: [
        'Rainbow Bridge Ethereum',
        'CLI Wallet (Rust)',
        'Web Wallet (WASM)',
        'Key management (Ed25519)',
        'Bridge smart contracts',
        'Cross-chain transactions'
      ],
      performance: [
        { metric: 'Chains', target: '44 chains', current: '1 (ETH)' },
        { metric: 'Bridge speed', target: '< 5min', current: 'N/A' },
        { metric: 'Wallet load', target: '< 1s', current: 'N/A' },
        { metric: 'Security', target: 'Multi-sig', current: 'N/A' }
      ]
    },
    {
      id: 'q4',
      name: 'Q4 2025',
      title: 'Polish + Historical V3 Launch Target',
      months: 'Říjen - Prosinec',
      status: 'pending',
      color: 'green',
      budget: '$80k',
      team: 'Full team + Marketing',
      deliverables: [
        'Rainbow Bridge 44:44 complete',
        'Security audit ($50k)',
        'Bug bounty program',
        'Historical V3 launch target deployment',
        'Documentation + guides',
        'Launch event (31.12.2025)'
      ],
      performance: [
        { metric: 'Nodes', target: '100+', current: 'N/A' },
        { metric: 'Miners', target: '1,000+', current: 'N/A' },
        { metric: 'Uptime', target: '99.9%', current: 'N/A' },
        { metric: 'Vulnerabilities', target: '0 critical', current: 'N/A' }
      ]
    }
  ];

  const milestones = [
    { date: '31.03.2025', title: 'Pool Native Complete', status: 'pending', color: 'cyan', icon: Server },
    { date: '30.06.2025', title: 'Blockchain Native Complete', status: 'pending', color: 'purple', icon: Layers },
    { date: '30.09.2025', title: 'Bridge + Wallet Complete', status: 'pending', color: 'gold', icon: Link2 },
    { date: '31.12.2025', title: 'Historical V3 Launch Target', status: 'pending', color: 'green', icon: Rocket },
    { date: '31.12.2026', title: 'Historical MainNet Target', status: 'future', color: 'white', icon: Sparkles }
  ];

  return (
    <div className="zion-shell min-h-screen pb-20 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-zion-cyan/20 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zion-cyan/20 border border-zion-cyan/30 mb-6">
            <Rocket className="w-4 h-4 text-zion-cyan" />
            <span className="text-sm font-medium text-zion-cyan">Version 2.9.5 — Native Awakening</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-linear-to-r from-zion-cyan via-zion-purple to-zion-gold bg-clip-text text-transparent">
            🌟 ZION NATIVE ROADMAP
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
            <strong>NATIVE AWAKENING</strong>
          </p>
          <p className="text-lg text-gray-400">
            100% Native Stack • 12 Months • Historical roadmap archive
          </p>
        </div>
      </section>

      {/* Vision Statement */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-8 border border-zion-cyan/30">
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <h2 className="text-3xl font-bold text-zion-cyan mb-6">🎯 Vision Statement</h2>
              <div className="bg-linear-to-r from-zion-cyan/20 via-zion-purple/20 to-zion-gold/20 rounded-xl p-8 border border-zion-cyan/30">
                <p className="text-3xl font-bold text-white mb-6">
                  ZION 2.9.5 = 100% NATIVE CONSCIOUSNESS
                </p>
                <div className="grid md:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-4xl font-bold text-red-400 mb-2">83% → 0%</div>
                    <div className="text-sm text-gray-400">Python Code</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-green-400 mb-2">17% → 100%</div>
                    <div className="text-sm text-gray-400">Native Rust</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-zion-cyan mb-2">1x → 100x</div>
                    <div className="text-sm text-gray-400">Performance</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Current State */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-zion-purple mb-12">
            📊 Historical State Snapshot (Prosinec 2025)
          </h2>
          <div className="space-y-4">
            {currentState.map((item, idx) => (
              <div
                key={idx}
                className="bg-black/60 backdrop-blur-xl rounded-xl p-6 border border-gray-700 hover:border-zion-cyan/50 transition-all"
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
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-zion-gold mb-12">
            <div className="flex items-center justify-center gap-3">
              <Calendar className="w-8 h-8 text-zion-gold" />
              <span>12-Month Development Plan</span>
            </div>
          </h2>
          <div className="grid lg:grid-cols-2 gap-8">
            {quarters.map((quarter) => (
              <div
                key={quarter.id}
                className={`bg-black/60 backdrop-blur-xl rounded-2xl p-8 border transition-all duration-300 cursor-pointer ${
                  activeQuarter === quarter.id
                    ? `border-zion-${quarter.color} shadow-lg shadow-zion-${quarter.color}/20 scale-105`
                    : `border-zion-${quarter.color}/30 hover:border-zion-${quarter.color}/60`
                }`}
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
                    {quarter.status === 'active' ? 'In Progress' : 'Pending'}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-4">{quarter.title}</h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Budget</div>
                    <div className={`text-lg font-bold text-zion-${quarter.color}`}>{quarter.budget}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Team</div>
                    <div className="text-sm font-semibold text-white">{quarter.team}</div>
                  </div>
                </div>

                {activeQuarter === quarter.id && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div>
                      <h4 className={`text-sm font-semibold text-zion-${quarter.color} mb-3 flex items-center gap-2`}>
                        <CheckCircle2 className="w-4 h-4" />
                        Key Deliverables
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
                        Performance Targets
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
                  <button className={`text-xs text-zion-${quarter.color} hover:underline`}>
                    {activeQuarter === quarter.id ? 'Zobrazit méně' : 'Zobrazit více'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Milestones */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-zion-cyan mb-12">
            <div className="flex items-center justify-center gap-3">
              <Target className="w-8 h-8 text-zion-cyan" />
              <span>Critical Milestones</span>
            </div>
          </h2>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-linear-to-b from-zion-cyan via-zion-purple to-zion-gold" />
            
            {/* Milestone Items */}
            <div className="space-y-8">
              {milestones.map((milestone, idx) => {
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
                    <div className="flex-1 bg-black/60 backdrop-blur-xl rounded-xl p-6 border border-gray-700 hover:border-zion-cyan/50 transition-all">
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
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Zap className="w-8 h-8 text-green-400" />
                <h2 className="text-3xl font-bold text-green-400 mb-0">
                  Historical V3 Launch Requirements
                </h2>
              </div>
              <div className="text-gray-300 space-y-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
                  <p className="text-2xl font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <Rocket className="w-8 h-8" />
                    <span>31. prosince 2025</span>
                  </p>
                  <div className="grid md:grid-cols-2 gap-6 text-left">
                    <div>
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Technical
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 100+ nodes running</li>
                        <li>• 10,000+ miners connected</li>
                        <li>• Pool Native (Rust)</li>
                        <li>• Blockchain Native (Rust)</li>
                        <li>• Rainbow Bridge (ETH)</li>
                        <li>• Web + CLI wallets</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Performance
                      </h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 500+ TPS verified</li>
                        <li>• {'<'} 50ms mining latency</li>
                        <li>• 99.9% uptime</li>
                        <li>• {'<'} 1% orphan rate</li>
                        <li>• Multi-chain bridge</li>
                        <li>• 0 critical vulnerabilities</li>
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
        <div className="max-w-4xl mx-auto">
          <div className="bg-linear-to-br from-zion-gold/20 via-zion-cyan/20 to-zion-purple/20 rounded-2xl p-8 border border-zion-gold/30">
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <div className="flex items-center justify-center gap-3 mb-6">
                <TrendingUp className="w-8 h-8 text-zion-gold" />
                <h2 className="text-3xl font-bold text-zion-gold mb-0">
                  Historical MainNet Vision 2026
                </h2>
              </div>
              <div className="text-gray-300 space-y-6">
                <p className="text-2xl font-bold text-white">
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-8 h-8 text-zion-gold" />
                    <span>31. prosince 2026</span>
                  </span>
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-zion-gold/10 border border-zion-gold/30 rounded-xl p-6">
                    <div className="flex justify-center mb-3">
                      <Zap className="w-12 h-12 text-zion-gold" />
                    </div>
                    <div className="text-2xl font-bold text-zion-gold mb-2">1,000+ TPS</div>
                    <div className="text-sm text-gray-400">Historical target</div>
                  </div>
                  <div className="bg-zion-cyan/10 border border-zion-cyan/30 rounded-xl p-6">
                    <div className="flex justify-center mb-3">
                      <Link2 className="w-12 h-12 text-zion-cyan" />
                    </div>
                    <div className="text-2xl font-bold text-zion-cyan mb-2">44 Chains</div>
                    <div className="text-sm text-gray-400">Rainbow Bridge</div>
                  </div>
                  <div className="bg-zion-purple/10 border border-zion-purple/30 rounded-xl p-6">
                    <div className="flex justify-center mb-3">
                      <Users className="w-12 h-12 text-zion-purple" />
                    </div>
                    <div className="text-2xl font-bold text-zion-purple mb-2">50k Miners</div>
                    <div className="text-sm text-gray-400">Global Network</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Finale */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-linear-to-b from-zion-cyan/20 via-zion-purple/20 to-zion-gold/20 rounded-2xl p-12 border border-zion-cyan/30">
            <h2 className="text-5xl font-bold mb-8">
              <div className="flex items-center justify-center gap-4 bg-linear-to-r from-zion-cyan via-zion-purple to-zion-gold bg-clip-text text-transparent">
                <Sparkles className="w-12 h-12 text-zion-gold" />
                <span>TOWARD THE STAR</span>
              </div>
            </h2>
            <div className="prose prose-invert prose-lg text-center max-w-none">
              <p className="text-xl text-gray-200 mb-6">
                <strong>100% Native Stack</strong><br />
                <strong>100% Consciousness</strong><br />
                <strong>100% Golden Age</strong>
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
                  <strong>Peace and One Love</strong>
                  <Heart className="w-5 h-5 text-zion-purple" />
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-zion-cyan/30">
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
