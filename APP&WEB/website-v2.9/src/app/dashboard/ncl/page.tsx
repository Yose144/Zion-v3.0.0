import type { Metadata } from 'next';
"use client";

import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";

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

export const metadata: Metadata = {
  title: 'NCL Curriculum · ZION',
  description: 'Neural Compute Layer curriculum dashboard — task progress and learning analytics.',
};

export default function NCLDashboard() {
  const [status, setStatus] = useState<NCLStatus | null>(null);
  const [workers, setWorkers] = useState<NCLWorker[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [allocation, setAllocation] = useState(30);

  usePolling(async () => {
    try {
      setStatus({
        enabled: true,
        workers: { total: 42, active: 38 },
        tasks: { pending: 156, active: 23, completed: 15234 },
        rewards: { total_paid: 45.67, avg_per_task: 0.003 },
      });

      setWorkers([
        {
          worker_id: "ZION_ABC123.rig1",
          miner_address: "ZION_ABC123456789...",
          consciousness_level: 5,
          consciousness_multiplier: 1.5,
          npu_allocation: 0.3,
          tasks_completed: 1234,
          total_earnings: 12.45,
        },
        {
          worker_id: "ZION_DEF456.rig1",
          miner_address: "ZION_DEF456789012...",
          consciousness_level: 3,
          consciousness_multiplier: 1.1,
          npu_allocation: 0.25,
          tasks_completed: 567,
          total_earnings: 5.67,
        },
      ]);

      setLeaderboard([
        { rank: 1, miner_address: "ZION_ABC...", consciousness_level: 6, tasks_completed: 5432, total_earnings: 54.32 },
        { rank: 2, miner_address: "ZION_XYZ...", consciousness_level: 5, tasks_completed: 4321, total_earnings: 43.21 },
        { rank: 3, miner_address: "ZION_DEF...", consciousness_level: 5, tasks_completed: 3210, total_earnings: 32.10 },
        { rank: 4, miner_address: "ZION_GHI...", consciousness_level: 4, tasks_completed: 2109, total_earnings: 21.09 },
        { rank: 5, miner_address: "ZION_JKL...", consciousness_level: 3, tasks_completed: 1098, total_earnings: 10.98 },
      ]);

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch NCL data:", error);
      setLoading(false);
    }
  }, 10000);

  const handleAllocationChange = async (workerId: string, newAllocation: number) => {
    // In production, POST to API
    console.log(`Setting ${workerId} allocation to ${newAllocation}%`);
    // Update local state
    setWorkers(workers.map(w => 
      w.worker_id === workerId 
        ? { ...w, npu_allocation: newAllocation / 100 }
        : w
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-yellow-400 text-2xl animate-pulse">Loading NCL Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">
          🧠 NCL Dashboard
        </h1>
        <p className="text-gray-400">
          Neural Compute Layer - AI Bonus Management (5th Revenue Stream)
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Workers Card */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-gray-400 text-sm mb-2">Active Workers</div>
          <div className="text-4xl font-bold text-green-400">
            {status?.workers.active}
            <span className="text-lg text-gray-500">/{status?.workers.total}</span>
          </div>
          <div className="text-gray-500 text-sm mt-2">
            {((status?.workers.active || 0) / (status?.workers.total || 1) * 100).toFixed(0)}% online
          </div>
        </div>

        {/* Tasks Card */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-gray-400 text-sm mb-2">Tasks Completed</div>
          <div className="text-4xl font-bold text-blue-400">
            {status?.tasks.completed.toLocaleString()}
          </div>
          <div className="text-gray-500 text-sm mt-2">
            {status?.tasks.pending} pending • {status?.tasks.active} active
          </div>
        </div>

        {/* Rewards Card */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="text-gray-400 text-sm mb-2">Total NCL Rewards</div>
          <div className="text-4xl font-bold text-yellow-400">
            {status?.rewards.total_paid.toFixed(2)} <span className="text-lg">ZION</span>
          </div>
          <div className="text-gray-500 text-sm mt-2">
            Avg: {(status?.rewards.avg_per_task || 0).toFixed(4)} ZION/task
          </div>
        </div>

        {/* Revenue Stream Card */}
        <div className="bg-linear-to-br from-purple-900/50 to-blue-900/50 rounded-xl p-6 border border-purple-500/30">
          <div className="text-purple-300 text-sm mb-2">Revenue Stream #5</div>
          <div className="text-3xl font-bold text-white">NCL AI Bonus</div>
          <div className="text-purple-300 text-sm mt-2">
            ~5% of total miner revenue
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workers List */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-white mb-4">🔧 Your Workers</h2>
          
          {workers.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No NCL workers registered. Connect a miner to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {workers.map((worker) => (
                <div 
                  key={worker.worker_id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-mono text-sm text-gray-300">
                        {worker.worker_id}
                      </div>
                      <div className={`text-sm ${CONSCIOUSNESS_COLORS[worker.consciousness_level]}`}>
                        ✨ {CONSCIOUSNESS_NAMES[worker.consciousness_level]} ({worker.consciousness_multiplier}x)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-yellow-400">
                        {worker.total_earnings.toFixed(4)} ZION
                      </div>
                      <div className="text-gray-500 text-sm">
                        {worker.tasks_completed} tasks
                      </div>
                    </div>
                  </div>

                  {/* NPU Allocation Slider */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>NPU Allocation</span>
                      <span>{(worker.npu_allocation * 100).toFixed(0)}% AI / {((1 - worker.npu_allocation) * 100).toFixed(0)}% Mining</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={worker.npu_allocation * 100}
                      onChange={(e) => handleAllocationChange(worker.worker_id, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0% (Mining only)</span>
                      <span>50% (Max AI)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-white mb-4">🏆 NCL Leaderboard</h2>
          
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div 
                key={entry.rank}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  entry.rank <= 3 ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold ${
                    entry.rank === 1 ? 'text-yellow-400' :
                    entry.rank === 2 ? 'text-gray-400' :
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
                  <div className="font-bold text-yellow-400">
                    {entry.total_earnings.toFixed(2)}
                  </div>
                  <div className="text-gray-500 text-xs">ZION</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Streams Overview */}
      <div className="mt-8 bg-linear-to-r from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">📊 CH v3 Revenue Streams</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { name: "ZION", desc: "Cosmic Fusion", percent: 50, color: "yellow" },
            { name: "ETC", desc: "Keccak merged", percent: 20, color: "green" },
            { name: "NXS", desc: "SHA3 merged", percent: 5, color: "blue" },
            { name: "Dynamic", desc: "ERG/RVN/KAS", percent: 20, color: "purple" },
            { name: "NCL", desc: "AI Bonus", percent: 5, color: "pink", highlight: true },
          ].map((stream, i) => (
            <div 
              key={i}
              className={`p-4 rounded-lg ${
                stream.highlight 
                  ? 'bg-pink-900/30 border-2 border-pink-500/50' 
                  : 'bg-gray-800 border border-gray-700'
              }`}
            >
              <div className={`text-2xl font-bold text-${stream.color}-400`}>
                {stream.name}
              </div>
              <div className="text-gray-400 text-sm">{stream.desc}</div>
              <div className="mt-2">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-${stream.color}-400 rounded-full`}
                    style={{ width: `${stream.percent}%` }}
                  />
                </div>
                <div className="text-gray-500 text-xs mt-1">~{stream.percent}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="mt-8 bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">🚀 Enable NCL on Your Miner</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-yellow-400 mb-2">Option 1: Miner Flag</h3>
            <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto">
              <code className="text-green-400">
{`./zion_miner \
  --pool 91.98.122.165:3333 \
  --wallet ZION_YOUR_ADDRESS \\
  --ncl-enabled \\
  --ncl-allocation 30`}
              </code>
            </pre>
          </div>
          
          <div>
            <h3 className="font-bold text-yellow-400 mb-2">Option 2: Config File</h3>
            <pre className="bg-black p-4 rounded-lg text-sm overflow-x-auto">
              <code className="text-green-400">
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
          💡 <strong>Tip:</strong> Higher consciousness levels earn more NCL rewards. 
          Level up by consistent mining and community participation!
        </div>
      </div>
    </div>
  );
}
