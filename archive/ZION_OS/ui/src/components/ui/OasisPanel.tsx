import { useEffect, useState } from "react";

interface OasisStats {
  status: string;
  avatars: number;
  active_avatars: number;
  nfts_minted: number;
  guilds: number;
  guild_members: number;
  territories: number;
  contested: number;
  active_quests: number;
  completed_quests: number;
  online_players: number;
  cl_supply: number;
  golden_eggs: number;
}

interface Quest {
  id: string;
  name: string;
  description: string;
  reward: number;
  difficulty: "easy" | "medium" | "hard" | "legendary";
  status: "active" | "completed" | "expired";
  progress: number;
}

const DEMO_STATS: OasisStats = {
  status: "online",
  avatars: 1247,
  active_avatars: 892,
  nfts_minted: 3402,
  guilds: 56,
  guild_members: 2341,
  territories: 128,
  contested: 12,
  active_quests: 34,
  completed_quests: 12847,
  online_players: 456,
  cl_supply: 8250000000,
  golden_eggs: 88,
};

const DEMO_QUESTS: Quest[] = [
  { id: "q1", name: "Genesis Guardian", description: "Protect the genesis block for 24 hours", reward: 5000, difficulty: "legendary", status: "active", progress: 67 },
  { id: "q2", name: "Pool Master", description: "Submit 1000 valid shares to the pool", reward: 1200, difficulty: "medium", status: "active", progress: 45 },
  { id: "q3", name: "Bridge Builder", description: "Complete 10 cross-chain transfers", reward: 2500, difficulty: "hard", status: "active", progress: 20 },
  { id: "q4", name: "Node Runner", description: "Keep your node online for 7 days", reward: 800, difficulty: "easy", status: "completed", progress: 100 },
  { id: "q5", name: "Golden Egg Hunter", description: "Find 3 hidden golden eggs in OASIS", reward: 10000, difficulty: "legendary", status: "active", progress: 33 },
  { id: "q6", name: "DAO Voter", description: "Participate in 5 governance votes", reward: 600, difficulty: "easy", status: "completed", progress: 100 },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-zion-ok",
  medium: "text-zion-info",
  hard: "text-zion-warn",
  legendary: "text-purple-400",
};

const DIFFICULTY_BG: Record<string, string> = {
  easy: "bg-zion-ok/10 border-zion-ok/30",
  medium: "bg-zion-info/10 border-zion-info/30",
  hard: "bg-zion-warn/10 border-zion-warn/30",
  legendary: "bg-purple-500/10 border-purple-500/30",
};

export function OasisPanel() {
  const [stats, setStats] = useState<OasisStats>(DEMO_STATS);
  const [quests] = useState<Quest[]>(DEMO_QUESTS);
  const [activeTab, setActiveTab] = useState<"overview" | "quests" | "guilds" | "territories">("overview");

  useEffect(() => {
    // Try to fetch real data from dashboard API
    fetch("http://127.0.0.1:8766/api/oasis/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setStats((prev) => ({
            ...prev,
            status: data.status || prev.status,
            avatars: data.avatars || prev.avatars,
            active_quests: data.active_quests || prev.active_quests,
          }));
        }
      })
      .catch(() => {/* use demo data */});
  }, []);

  const isOnline = stats.status === "online";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-purple-400 font-mono text-glow-green">
            🌸 OASIS L4
          </h2>
          <p className="text-xs text-zion-dim font-mono mt-1">
            Cosmic Love Metaverse · {isOnline ? "🟢 Online" : "🔴 Offline"} · {stats.online_players} players
          </p>
        </div>
        <div className="flex gap-2">
          {(["overview", "quests", "guilds", "territories"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
                activeTab === tab
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                  : "bg-transparent text-zion-dim border-zion-border hover:text-white"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Avatars" value={stats.avatars} color="text-pink-400" icon="👤" />
            <StatCard label="Active" value={stats.active_avatars} color="text-zion-ok" icon="🟢" />
            <StatCard label="NFTs Minted" value={stats.nfts_minted} color="text-purple-400" icon="🎨" />
            <StatCard label="Guilds" value={stats.guilds} color="text-blue-400" icon="⚔️" />
            <StatCard label="Members" value={stats.guild_members} color="text-cyan-400" icon="👥" />
            <StatCard label="Territories" value={stats.territories} color="text-green-400" icon="🏰" />
            <StatCard label="Contested" value={stats.contested} color="text-zion-critical" icon="⚡" />
            <StatCard label="Quests Active" value={stats.active_quests} color="text-yellow-400" icon="📜" />
            <StatCard label="Completed" value={stats.completed_quests} color="text-zion-ok" icon="✅" />
            <StatCard label="CL Supply" value={`${(stats.cl_supply / 1e9).toFixed(2)}B`} color="text-zion-gold" icon="💎" />
            <StatCard label="Golden Eggs" value={stats.golden_eggs} color="text-yellow-300" icon="🥚" />
            <StatCard label="Players" value={stats.online_players} color="text-zion-info" icon="🎮" />
          </div>

          {/* CL Token Distribution */}
          <div className="glass-panel p-4">
            <h3 className="text-sm font-bold text-zion-gold font-mono mb-3">💎 CL Token Distribution</h3>
            <div className="space-y-3">
              {[
                { label: "OASIS Treasury", value: 45, color: "bg-purple-500" },
                { label: "Quest Rewards", value: 25, color: "bg-zion-ok" },
                { label: "Guild Staking", value: 15, color: "bg-blue-500" },
                { label: "Territory Control", value: 10, color: "bg-yellow-500" },
                { label: "Golden Eggs", value: 5, color: "bg-zion-gold" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-zion-dim font-mono w-32">{item.label}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                  <span className="text-xs text-white font-mono w-8">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Quests Tab */}
      {activeTab === "quests" && (
        <div className="space-y-3">
          {quests.map((quest) => (
            <div key={quest.id} className={`glass-panel p-4 border ${DIFFICULTY_BG[quest.difficulty]}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${DIFFICULTY_COLORS[quest.difficulty]}`}>
                    {quest.difficulty.toUpperCase()}
                  </span>
                  <h4 className="text-sm font-bold text-white font-mono">{quest.name}</h4>
                </div>
                <span className="text-xs text-zion-gold font-mono">{quest.reward.toLocaleString()} CL</span>
              </div>
              <p className="text-xs text-zion-dim mb-3">{quest.description}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quest.status === "completed"
                        ? "bg-zion-ok"
                        : quest.status === "expired"
                        ? "bg-zion-critical"
                        : "bg-zion-info"
                    }`}
                    style={{ width: `${quest.progress}%` }}
                  />
                </div>
                <span className="text-xs text-white font-mono w-10">{quest.progress}%</span>
                <span className={`text-xs font-mono ${
                  quest.status === "completed" ? "text-zion-ok" :
                  quest.status === "expired" ? "text-zion-critical" :
                  "text-zion-warn"
                }`}>
                  {quest.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guilds Tab */}
      {activeTab === "guilds" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "Genesis Guardians", members: 234, power: 8900, territory: "Sector Alpha", icon: "🛡️" },
            { name: "Hash Legion", members: 189, power: 7200, territory: "Mining District", icon: "⛏️" },
            { name: "Bridge Walkers", members: 156, power: 6100, territory: "Crossroads", icon: "🌉" },
            { name: "OASISkeepers", members: 312, power: 9500, territory: "Central Plaza", icon: "🌸" },
            { name: "Node Runners", members: 98, power: 4500, territory: "Uplink Zone", icon: "📡" },
            { name: "Cosmic Love", members: 267, power: 8200, territory: "Heartland", icon: "💖" },
          ].map((guild) => (
            <div key={guild.name} className="glass-panel p-4 hover:scale-[1.02] transition-transform">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{guild.icon}</span>
                  <h4 className="text-sm font-bold text-white font-mono">{guild.name}</h4>
                </div>
                <span className="text-xs text-zion-gold font-mono">⚡ {guild.power.toLocaleString()}</span>
              </div>
              <div className="flex gap-4 text-xs text-zion-dim font-mono">
                <span>👥 {guild.members} members</span>
                <span>🏰 {guild.territory}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Territories Tab */}
      {activeTab === "territories" && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 24 }).map((_, i) => {
            const owned = i < 16;
            const contested = i >= 16 && i < 18;
            const guilds = ["Genesis", "Hash", "Bridge", "OASIS"];
            const guild = owned ? guilds[i % 4] : contested ? guilds[i % 2] + " vs " + guilds[(i + 2) % 2] : "Unclaimed";
            return (
              <div
                key={i}
                className={`glass-panel p-3 text-center border transition-all hover:scale-105 ${
                  owned
                    ? "border-zion-ok/30 neon-border-green"
                    : contested
                    ? "border-zion-warn/30 neon-border-yellow"
                    : "border-zion-dim/20"
                }`}
              >
                <div className="text-xs text-zion-dim font-mono mb-1">Sector {String.fromCharCode(65 + Math.floor(i / 4))}{i % 4 + 1}</div>
                <div className={`text-sm font-bold font-mono ${
                  owned ? "text-zion-ok" : contested ? "text-zion-warn" : "text-zion-dim"
                }`}>
                  {owned ? "🟢" : contested ? "⚡" : "⚪"}
                </div>
                <div className="text-[10px] text-zion-dim font-mono mt-1 truncate">{guild}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) {
  return (
    <div className="glass-panel p-3 text-center hover:scale-105 transition-transform">
      <div className="text-lg mb-1">{icon}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-[10px] text-zion-dim font-mono mt-1">{label}</div>
    </div>
  );
}
