import { useEffect, useRef, useState } from "react";

interface LogLine {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

const DEMO_LOGS: LogLine[] = [
  { timestamp: "23:45:01", level: "INFO", message: "zion-node started (PID: 35840)", source: "orchestrator" },
  { timestamp: "23:45:02", level: "INFO", message: "P2P listener bound to 0.0.0.0:8333", source: "node" },
  { timestamp: "23:45:03", level: "INFO", message: "RPC listener bound to 0.0.0.0:8443", source: "node" },
  { timestamp: "23:45:05", level: "INFO", message: "zion-pool started (PID: 20695)", source: "orchestrator" },
  { timestamp: "23:45:06", level: "INFO", message: "Pool stratum bound to 0.0.0.0:8444", source: "pool" },
  { timestamp: "23:45:10", level: "INFO", message: "Miner session accepted from 100.86.102.5", source: "pool" },
  { timestamp: "23:45:12", level: "INFO", message: "Share accepted: diff 256, height 138", source: "pool" },
  { timestamp: "23:45:15", level: "WARN", message: "High memory usage: 78%", source: "system" },
  { timestamp: "23:45:20", level: "INFO", message: "Block mined at height 139, hash: 0000abc...", source: "node" },
  { timestamp: "23:45:25", level: "ERROR", message: "Connection timeout to peer 77.42.71.94:8333", source: "node" },
  { timestamp: "23:45:26", level: "INFO", message: "Reconnecting to seed peer...", source: "node" },
  { timestamp: "23:45:30", level: "INFO", message: "Peer connected: 100.86.102.5:49669", source: "node" },
];

const LEVEL_COLORS: Record<string, string> = {
  INFO: "text-zion-ok",
  WARN: "text-zion-warn",
  ERROR: "text-zion-critical",
  DEBUG: "text-zion-dim",
};

const SOURCE_COLORS: Record<string, string> = {
  node: "border-l-blue-400",
  pool: "border-l-purple-400",
  miner: "border-l-green-400",
  orchestrator: "border-l-cyan-400",
  system: "border-l-yellow-400",
};

export function LogTail() {
  const [logs, setLogs] = useState<LogLine[]>(DEMO_LOGS);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Simulate incoming logs
  useEffect(() => {
    const interval = setInterval(() => {
      const sources = ["node", "pool", "miner", "system"];
      const levels = ["INFO", "INFO", "INFO", "WARN", "INFO"];
      const messages = [
        "Share accepted: diff 256",
        "New block template received",
        "Peer handshake complete",
        "Memory usage: 65%",
        "GPU hash: 420 H/s",
        "Connection from 100.100.46.39",
      ];
      const now = new Date();
      const ts = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

      const newLog: LogLine = {
        timestamp: ts,
        level: levels[Math.floor(Math.random() * levels.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        source: sources[Math.floor(Math.random() * sources.length)],
      };

      setLogs((prev) => [...prev.slice(-49), newLog]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.message.toLowerCase().includes(filter.toLowerCase()) ||
      l.source.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="glass-panel p-4 h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-zion-ok font-mono">Log Tail</span>
          <span className="text-[10px] text-zion-dim font-mono">{filtered.length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-black/30 border border-zion-border rounded px-2 py-1 text-xs text-white font-mono w-40 focus:outline-none focus:border-zion-ok"
          />
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded font-mono border ${
              autoScroll
                ? "bg-zion-ok/20 text-zion-ok border-zion-ok/30"
                : "bg-zion-dim/20 text-zion-dim border-zion-dim/30"
            }`}
          >
            {autoScroll ? "Auto-ON" : "Auto-OFF"}
          </button>
        </div>
      </div>

      {/* Log lines */}
      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 pr-2">
        {filtered.map((log, i) => (
          <div
            key={i}
            className={`flex gap-2 py-0.5 px-2 rounded border-l-2 ${
              SOURCE_COLORS[log.source] || "border-l-gray-500"
            } hover:bg-white/5`}
          >
            <span className="text-zion-dim w-16 shrink-0">{log.timestamp}</span>
            <span className={`w-14 shrink-0 font-bold ${LEVEL_COLORS[log.level] || "text-white"}`}>
              {log.level}
            </span>
            <span className="text-zion-dim w-20 shrink-0">[{log.source}]</span>
            <span className="text-white truncate">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
