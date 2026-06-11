'use client';

import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { Brain, Activity, Layers, AlertTriangle } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

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

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] ${className}`}>
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
          <Brain className="h-6 w-6" /> {lang === 'cs' ? 'Načítání NCL Dashboardu...' : 'Loading NCL Dashboard...'}
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
              {lang === 'cs' ? 'Neural Compute Layer — Správa AI Bonusů (5. Revenue Stream)' : 'Neural Compute Layer — AI Bonus Management (5th Revenue Stream)'}
            </p>
          </div>
        </div>
        {source === 'fallback' && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-400">
            <AlertTriangle className="h-3 w-3" /> {lang === 'cs' ? 'Hiranyagarbha offline — zobrazuji cache/prázdná data' : 'Hiranyagarbha offline — showing cached/empty data'}
          </div>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-emerald-400" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{lang === 'cs' ? 'Aktivní Workery' : 'Active Workers'}</span>
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {status?.workers.active ?? 0}
            <span className="text-lg text-gray-500 font-normal">/{status?.workers.total ?? 0}</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {((status?.workers.active || 0) / (status?.workers.total || 1) * 100).toFixed(0)}% {lang === 'cs' ? 'online' : 'online'}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-zion-cyan" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{lang === 'cs' ? 'Dokončené úkoly' : 'Tasks Completed'}</span>
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {(status?.tasks.completed ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {status?.tasks.pending ?? 0} {lang === 'cs' ? 'čekajících' : 'pending'} &bull; {status?.tasks.active ?? 0} {lang === 'cs' ? 'aktivních' : 'active'}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-zion-gold" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{lang === 'cs' ? 'Celkové NCL odměny' : 'Total NCL Rewards'}</span>
          </div>
          <div className="text-3xl font-bold font-mono text-zion-gold">
            {(status?.rewards.total_paid ?? 0).toFixed(2)} <span className="text-lg text-gray-500 font-normal">ZION</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {lang === 'cs' ? 'Průměr' : 'Avg'}: {(status?.rewards.avg_per_task || 0).toFixed(4)} ZION/{lang === 'cs' ? 'úkol' : 'task'}
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-zion-gold/5 rounded-full blur-3xl pointer-events-none" />
          <div className="text-xs text-zion-cyan font-medium uppercase tracking-wider mb-2">{lang === 'cs' ? 'Revenue Stream #5' : 'Revenue Stream #5'}</div>
          <div className="text-2xl font-bold text-white">NCL AI Bonus</div>
          <div className="text-sm text-zion-cyan mt-2">
            {lang === 'cs' ? '~5% z celkových miner příjmů' : '~5% of total miner revenue'}
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workers List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Layers size={14} className="text-zion-cyan" /> {lang === 'cs' ? 'Vaše Workery' : 'Your Workers'}
            </h2>

            {workers.length === 0 ? (
              <div className="text-gray-500 text-center py-8 text-sm">
                {lang === 'cs' ? 'Žádní NCL workery registrováni. Připojte miner pro začátek.' : 'No NCL workers registered. Connect a miner to get started.'}
              </div>
            ) : (
              <div className="space-y-3">
                {workers.map((worker) => (
                  <div
                    key={worker.worker_id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
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
                          {worker.tasks_completed} {lang === 'cs' ? 'úkolů' : 'tasks'}
                        </div>
                      </div>
                    </div>

                    {/* NPU Allocation Slider */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>{lang === 'cs' ? 'NPU Alokace' : 'NPU Allocation'}</span>
                        <span>{(worker.npu_allocation * 100).toFixed(0)}% AI / {((1 - worker.npu_allocation) * 100).toFixed(0)}% {lang === 'cs' ? 'Mining' : 'Mining'}</span>
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
                        <span>0% ({lang === 'cs' ? 'Pouze mining' : 'Mining only'})</span>
                        <span>50% ({lang === 'cs' ? 'Max AI' : 'Max AI'})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Leaderboard */}
        <Card>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Brain size={14} className="text-zion-gold" /> {lang === 'cs' ? 'NCL Žebříček' : 'NCL Leaderboard'}
          </h2>

          <div className="space-y-2">
            {leaderboard.length === 0 ? (
              <div className="text-gray-500 text-center py-8 text-sm">{lang === 'cs' ? 'Žádná data žebříčku.' : 'No leaderboard data.'}</div>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    entry.rank <= 3 ? 'bg-zion-gold/10 border border-zion-gold/30' : 'bg-white/5'
                  }`}
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
      <Card className="mt-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-zion-gold/5 rounded-full blur-3xl pointer-events-none" />
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={14} className="text-zion-cyan" /> {lang === 'cs' ? 'CH v3 Revenue Streams' : 'CH v3 Revenue Streams'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { name: "ZION", desc: lang === 'cs' ? "Cosmic Fusion" : "Cosmic Fusion", percent: 50, color: "zion-gold" },
            { name: "ETC", desc: lang === 'cs' ? "Keccak merged" : "Keccak merged", percent: 20, color: "emerald-400" },
            { name: "NXS", desc: lang === 'cs' ? "SHA3 merged" : "SHA3 merged", percent: 5, color: "zion-cyan" },
            { name: "Dynamic", desc: lang === 'cs' ? "ERG/RVN/KAS" : "ERG/RVN/KAS", percent: 20, color: "purple-400" },
            { name: "NCL", desc: lang === 'cs' ? "AI Bonus" : "AI Bonus", percent: 5, color: "pink-400", highlight: true },
          ].map((stream, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl ${
                stream.highlight
                  ? 'bg-zion-gold/10 border border-zion-gold/30'
                  : 'bg-white/5 border border-white/10'
              }`}
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
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Brain size={14} className="text-zion-gold" /> {lang === 'cs' ? 'Povolit NCL na vašem mineru' : 'Enable NCL on Your Miner'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs text-zion-gold font-medium uppercase tracking-wider mb-2">{lang === 'cs' ? 'Možnost 1: Miner Flag' : 'Option 1: Miner Flag'}</h3>
            <pre className="bg-black/60 border border-white/10 rounded-xl p-4 text-sm overflow-x-auto">
              <code className="text-emerald-400">
{`./zion_miner \
  --pool 77.42.71.94:8444 \
  --wallet ZION_YOUR_ADDRESS \
  --ncl-enabled \
  --ncl-allocation 30`}
              </code>
            </pre>
          </div>

          <div>
            <h3 className="text-xs text-zion-cyan font-medium uppercase tracking-wider mb-2">{lang === 'cs' ? 'Možnost 2: Konfigurační soubor' : 'Option 2: Config File'}</h3>
            <pre className="bg-black/60 border border-white/10 rounded-xl p-4 text-sm overflow-x-auto">
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

        <div className="mt-4 text-gray-400 text-sm">
          <span className="text-zion-gold">{lang === 'cs' ? 'Tip:' : 'Tip:'}</span> {lang === 'cs' ? 'Vyšší úrovně vědomí vydělávají více NCL odměn. Levelujte konzistentním miningem a komunitní účastí!' : 'Higher consciousness levels earn more NCL rewards. Level up by consistent mining and community participation!'}
        </div>
      </Card>
    </div>
  );
}
