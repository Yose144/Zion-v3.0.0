'use client';

import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { Brain, Activity, Layers, AlertTriangle } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

const DashboardNclCopy = {
  loadingNclDashboard: { cs: `Načítání NCL Dashboardu...`, en: `Loading NCL Dashboard...` },
  neuralComputeLayerAiBonusManag: { cs: `Neural Compute Layer — Správa AI Bonusů (5. Revenue Stream)`, en: `Neural Compute Layer — AI Bonus Management (5th Revenue Stream)` },
  hiranyagarbhaOfflineShowingCac: { cs: `Hiranyagarbha offline — zobrazuji cache/prázdná data`, en: `Hiranyagarbha offline — showing cached/empty data` },
  activeWorkers: { cs: `Aktivní Workery`, en: `Active Workers` },
  online: { cs: `online`, en: `online` },
  tasksCompleted: { cs: `Dokončené úkoly`, en: `Tasks Completed` },
  pending: { cs: `čekajících`, en: `pending` },
  active: { cs: `aktivních`, en: `active` },
  totalNclRewards: { cs: `Celkové NCL odměny`, en: `Total NCL Rewards` },
  avg: { cs: `Průměr`, en: `Avg` },
  task: { cs: `úkol`, en: `task` },
  revenueStream5: { cs: `Revenue Stream #5`, en: `Revenue Stream #5` },
  k5OfTotalMinerRevenue: { cs: `~5% z celkových miner příjmů`, en: `~5% of total miner revenue` },
  yourWorkers: { cs: `Vaše Workery`, en: `Your Workers` },
  noNclWorkersRegisteredConnectA: { cs: `Žádní NCL workery registrováni. Připojte miner pro začátek.`, en: `No NCL workers registered. Connect a miner to get started.` },
  tasks: { cs: `úkolů`, en: `tasks` },
  npuAllocation: { cs: `NPU Alokace`, en: `NPU Allocation` },
  mining: { cs: `Mining`, en: `Mining` },
  miningOnly: { cs: `Pouze mining`, en: `Mining only` },
  maxAi: { cs: `Max AI`, en: `Max AI` },
  nclLeaderboard: { cs: `NCL Žebříček`, en: `NCL Leaderboard` },
  noLeaderboardData: { cs: `Žádná data žebříčku.`, en: `No leaderboard data.` },
  chV3RevenueStreams: { cs: `CH v3 Revenue Streams`, en: `CH v3 Revenue Streams` },
  cosmicFusion: { cs: `Cosmic Fusion`, en: `Cosmic Fusion` },
  keccakMerged: { cs: `Keccak merged`, en: `Keccak merged` },
  sha3Merged: { cs: `SHA3 merged`, en: `SHA3 merged` },
  ergRvnKas: { cs: `ERG/RVN/KAS`, en: `ERG/RVN/KAS` },
  aiBonus: { cs: `AI Bonus`, en: `AI Bonus` },
  enableNclOnYourMiner: { cs: `Povolit NCL na vašem mineru`, en: `Enable NCL on Your Miner` },
  option1MinerFlag: { cs: `Možnost 1: Miner Flag`, en: `Option 1: Miner Flag` },
  option2ConfigFile: { cs: `Možnost 2: Konfigurační soubor`, en: `Option 2: Config File` },
  tip: { cs: `Tip:`, en: `Tip:` },
  higherConsciousnessLevelsEarnM: { cs: `Vyšší úrovně vědomí vydělávají více NCL odměn. Levelujte konzistentním miningem a komunitní účastí!`, en: `Higher consciousness levels earn more NCL rewards. Level up by consistent mining and community participation!` },
};

interface NCLStatus {
  enabled: boolean;
  workers: {
    total: number;
    active: number;
  };
  tasks: {
    pending: number;
    active: number;
    completed: number;
  };
  rewards: {
    total_paid: number;
    avg_per_task: number;
  };
}

interface NCLWorker {
  worker_id: string;
  miner_address: string;
  consciousness_level: number;
  consciousness_multiplier: number;
  npu_allocation: number;
  tasks_completed: number;
  total_earnings: number;
}

interface LeaderboardEntry {
  rank: number;
  miner_address: string;
  consciousness_level: number;
  tasks_completed: number;
  total_earnings: number;
}

const CONSCIOUSNESS_NAMES: Record<number, string> = {
  1: "Physical",
  2: "Emotional",
  3: "Mental",
  4: "Spiritual",
  5: "Cosmic",
  6: "Orbital",
};

const CONSCIOUSNESS_COLORS: Record<number, string> = {
  1: "text-gray-400",
  2: "text-pink-400",
  3: "text-blue-400",
  4: "text-purple-400",
  5: "text-yellow-400",
  6: "text-amber-300",
};

function rc(color: 'cyan' | 'purple'): React.CSSProperties {
  return { '--rc': color === 'cyan' ? '7, 137, 48' : '228, 30, 43' } as React.CSSProperties;
}

function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`zion-rainbow-card p-6 ${className}`}>
      {children}
    </div>
  );
}

export default function NCLDashboard() {
  const { lang } = useLang();
  const [status, setStatus] = useState<NCLStatus | null>(null);
  const [workers, setWorkers] = useState<NCLWorker[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [allocation, setAllocation] = useState(30);
  const [source, setSource] = useState<'live' | 'fallback'>('live');

  usePolling(async () => {
    try {
      const statusRes = await fetch('/api/ncl/status', { cache: 'no-store' });
      if (statusRes.ok) {
        const data = await statusRes.json();
        if (!data.error) {
          setStatus({
            enabled: data.enabled ?? true,
            workers: data.workers ?? { total: 0, active: 0 },
            tasks: data.tasks ?? { pending: 0, active: 0, completed: 0 },
            rewards: data.rewards ?? { total_paid: 0, avg_per_task: 0 },
          });
          if (Array.isArray(data.worker_list)) setWorkers(data.worker_list);
          if (Array.isArray(data.leaderboard)) setLeaderboard(data.leaderboard);
          setSource(data.source === 'fallback' ? 'fallback' : 'live');
        }
      }

      const workersRes = await fetch('/api/ncl/workers', { cache: 'no-store' });
      if (workersRes.ok) {
        const wd = await workersRes.json();
        if (!wd.error) {
          const list = Array.isArray(wd) ? wd : Array.isArray(wd.workers) ? wd.workers : null;
          if (list) setWorkers(list);
        }
        if (wd.source === 'fallback') setSource('fallback');
      }

      const lbRes = await fetch('/api/ncl/leaderboard', { cache: 'no-store' });
      if (lbRes.ok) {
        const lb = await lbRes.json();
        if (!lb.error) {
          const list = Array.isArray(lb) ? lb : Array.isArray(lb.leaderboard) ? lb.leaderboard : null;
          if (list) setLeaderboard(list);
        }
        if (lb.source === 'fallback') setSource('fallback');
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch NCL data:", error);
      setLoading(false);
    }
  }, 10000);

  const handleAllocationChange = async (workerId: string, newAllocation: number) => {
    console.log(`Setting ${workerId} allocation to ${newAllocation}%`);
    setWorkers(workers.map(w =>
      w.worker_id === workerId
        ? { ...w, npu_allocation: newAllocation / 100 }
        : w
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-zion-gold text-xl animate-pulse flex items-center gap-3">
          <Brain className="h-6 w-6" /> {DashboardNclCopy.loadingNclDashboard[lang === 'cs' ? 'cs' : 'en']}
        </div>
      </div>
    );
  }

  return (
    <div className="text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-zion-gold/15 flex items-center justify-center">
            <Brain className="h-5 w-5 text-zion-gold" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">NCL Dashboard</h1>
            <p className="text-sm text-gray-400">
              {DashboardNclCopy.neuralComputeLayerAiBonusManag[lang === 'cs' ? 'cs' : 'en']}
            </p>
          </div>
        </div>
        {source === 'fallback' && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-400">
            <AlertTriangle className="h-3 w-3" /> {DashboardNclCopy.hiranyagarbhaOfflineShowingCac[lang === 'cs' ? 'cs' : 'en']}
          </div>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card style={rc('cyan')}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-emerald-400" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{DashboardNclCopy.activeWorkers[lang === 'cs' ? 'cs' : 'en']}</span>
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {status?.workers.active ?? 0}
            <span className="text-lg text-gray-500 font-normal">/{status?.workers.total ?? 0}</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {((status?.workers.active || 0) / (status?.workers.total || 1) * 100).toFixed(0)}% {DashboardNclCopy.online[lang === 'cs' ? 'cs' : 'en']}
          </div>
        </Card>

        <Card style={rc('cyan')}>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-zion-cyan" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{DashboardNclCopy.tasksCompleted[lang === 'cs' ? 'cs' : 'en']}</span>
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {(status?.tasks.completed ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {status?.tasks.pending ?? 0} {DashboardNclCopy.pending[lang === 'cs' ? 'cs' : 'en']} &bull; {status?.tasks.active ?? 0} {DashboardNclCopy.active[lang === 'cs' ? 'cs' : 'en']}
          </div>
        </Card>

        <Card style={rc('cyan')}>
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-zion-gold" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{DashboardNclCopy.totalNclRewards[lang === 'cs' ? 'cs' : 'en']}</span>
          </div>
          <div className="text-3xl font-bold font-mono text-zion-gold">
            {(status?.rewards.total_paid ?? 0).toFixed(2)} <span className="text-lg text-gray-500 font-normal">ZION</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {DashboardNclCopy.avg[lang === 'cs' ? 'cs' : 'en']}: {(status?.rewards.avg_per_task || 0).toFixed(4)} ZION/{DashboardNclCopy.task[lang === 'cs' ? 'cs' : 'en']}
          </div>
        </Card>

        <Card style={rc('purple')}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-zion-gold/5 rounded-full blur-3xl pointer-events-none" />
          <div className="text-xs text-zion-cyan font-medium uppercase tracking-wider mb-2">{DashboardNclCopy.revenueStream5[lang === 'cs' ? 'cs' : 'en']}</div>
          <div className="text-2xl font-bold text-white">NCL AI Bonus</div>
          <div className="text-sm text-zion-cyan mt-2">
            {DashboardNclCopy.k5OfTotalMinerRevenue[lang === 'cs' ? 'cs' : 'en']}
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workers List */}
        <div className="lg:col-span-2 space-y-4">
          <Card style={rc('cyan')}>
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Layers size={14} className="text-zion-cyan" /> {DashboardNclCopy.yourWorkers[lang === 'cs' ? 'cs' : 'en']}
            </h2>

            {workers.length === 0 ? (
              <div className="text-gray-500 text-center py-8 text-sm">
                {DashboardNclCopy.noNclWorkersRegisteredConnectA[lang === 'cs' ? 'cs' : 'en']}
              </div>
            ) : (
              <div className="space-y-3">
                {workers.map((worker) => (
                  <div
                    key={worker.worker_id}
                    style={rc('cyan')}
                    className="zion-rainbow-sub p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-mono text-sm text-gray-300">
                          {worker.worker_id}
                        </div>
                        <div className={`text-sm ${CONSCIOUSNESS_COLORS[worker.consciousness_level]}`}>
                          {CONSCIOUSNESS_NAMES[worker.consciousness_level]} ({worker.consciousness_multiplier}x)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold font-mono text-zion-gold">
                          {worker.total_earnings.toFixed(4)} ZION
                        </div>
                        <div className="text-gray-500 text-sm">
                          {worker.tasks_completed} {DashboardNclCopy.tasks[lang === 'cs' ? 'cs' : 'en']}
                        </div>
                      </div>
                    </div>

                    {/* NPU Allocation Slider */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>{DashboardNclCopy.npuAllocation[lang === 'cs' ? 'cs' : 'en']}</span>
                        <span>{(worker.npu_allocation * 100).toFixed(0)}% AI / {((1 - worker.npu_allocation) * 100).toFixed(0)}% {DashboardNclCopy.mining[lang === 'cs' ? 'cs' : 'en']}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={worker.npu_allocation * 100}
                        onChange={(e) => handleAllocationChange(worker.worker_id, parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-zion-gold"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0% ({DashboardNclCopy.miningOnly[lang === 'cs' ? 'cs' : 'en']})</span>
                        <span>50% ({DashboardNclCopy.maxAi[lang === 'cs' ? 'cs' : 'en']})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Leaderboard */}
        <Card style={rc('purple')}>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Brain size={14} className="text-zion-gold" /> {DashboardNclCopy.nclLeaderboard[lang === 'cs' ? 'cs' : 'en']}
          </h2>

          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <div className="text-gray-500 text-center py-8 text-sm">{DashboardNclCopy.noLeaderboardData[lang === 'cs' ? 'cs' : 'en']}</div>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  style={rc(entry.rank <= 3 ? 'purple' : 'cyan')}
                  className="zion-rainbow-sub flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-lg font-bold font-mono ${
                      entry.rank === 1 ? 'text-zion-gold' :
                      entry.rank === 2 ? 'text-gray-300' :
                      entry.rank === 3 ? 'text-amber-600' :
                      'text-gray-600'
                    }`}>
                      #{entry.rank}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-gray-300">
                        {entry.miner_address}
                      </div>
                      <div className={`text-xs ${CONSCIOUSNESS_COLORS[entry.consciousness_level]}`}>
                        {CONSCIOUSNESS_NAMES[entry.consciousness_level]}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold font-mono text-zion-gold">
                      {entry.total_earnings.toFixed(2)}
                    </div>
                    <div className="text-gray-500 text-xs">ZION</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Revenue Streams Overview */}
      <Card style={rc('cyan')} className="mt-4">
        <div className="absolute top-0 right-0 w-40 h-40 bg-zion-gold/5 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={14} className="text-zion-cyan" /> {DashboardNclCopy.chV3RevenueStreams[lang === 'cs' ? 'cs' : 'en']}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { name: "ZION", desc: DashboardNclCopy.cosmicFusion[lang === 'cs' ? 'cs' : 'en'], percent: 50, color: "zion-gold" },
            { name: "ETC", desc: DashboardNclCopy.keccakMerged[lang === 'cs' ? 'cs' : 'en'], percent: 20, color: "emerald-400" },
            { name: "NXS", desc: DashboardNclCopy.sha3Merged[lang === 'cs' ? 'cs' : 'en'], percent: 5, color: "zion-cyan" },
            { name: "Dynamic", desc: DashboardNclCopy.ergRvnKas[lang === 'cs' ? 'cs' : 'en'], percent: 20, color: "purple-400" },
            { name: "NCL", desc: DashboardNclCopy.aiBonus[lang === 'cs' ? 'cs' : 'en'], percent: 5, color: "pink-400", highlight: true },
          ].map((stream, i) => (
            <div
              key={i}
              style={rc(stream.highlight ? 'purple' : 'cyan')}
              className="zion-rainbow-sub p-4"
            >
              <div className={`text-xl font-bold text-${stream.color}`}>
                {stream.name}
              </div>
              <div className="text-gray-400 text-sm">{stream.desc}</div>
              <div className="mt-2">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-${stream.color} rounded-full`}
                    style={{ width: `${stream.percent}%` }}
                  />
                </div>
                <div className="text-gray-500 text-xs mt-1">~{stream.percent}%</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Setup Instructions */}
      <Card style={rc('purple')} className="mt-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Brain size={14} className="text-zion-gold" /> {DashboardNclCopy.enableNclOnYourMiner[lang === 'cs' ? 'cs' : 'en']}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs text-zion-gold font-medium uppercase tracking-wider mb-2">{DashboardNclCopy.option1MinerFlag[lang === 'cs' ? 'cs' : 'en']}</h3>
            <pre style={rc('purple')} className="zion-rainbow-sub p-4 text-sm overflow-x-auto">
              <code className="text-emerald-400">
{`./zion_miner \
  --pool ${process.env.NEXT_PUBLIC_ZION_POOL_HOST || 'pool.zionterranova.com'}:8444 \
  --wallet ZION_YOUR_ADDRESS \
  --ncl-enabled \
  --ncl-allocation 30`}
              </code>
            </pre>
          </div>

          <div>
            <h3 className="text-xs text-zion-cyan font-medium uppercase tracking-wider mb-2">{DashboardNclCopy.option2ConfigFile[lang === 'cs' ? 'cs' : 'en']}</h3>
            <pre style={rc('purple')} className="zion-rainbow-sub p-4 text-sm overflow-x-auto">
              <code className="text-emerald-400">
{`# miner_config.json
{
  "ncl": {
    "enabled": true,
    "allocation": 0.30,
    "models": ["embeddings", "llm"]
  }
}`}
              </code>
            </pre>
          </div>
        </div>

        <div style={rc('cyan')} className="zion-rainbow-sub mt-4 p-3 text-gray-400 text-sm">
          <span className="text-zion-gold">{DashboardNclCopy.tip[lang === 'cs' ? 'cs' : 'en']}</span> {DashboardNclCopy.higherConsciousnessLevelsEarnM[lang === 'cs' ? 'cs' : 'en']}
        </div>
      </Card>
    </div>
  );
}
