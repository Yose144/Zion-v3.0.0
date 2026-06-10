'use client';

import { Activity, Server, Zap } from 'lucide-react';

interface NodeLatency {
  id: string;
  name: string;
  online: boolean;
  rpcLatencyMs?: number;
  poolLatencyMs?: number;
  blockLag?: number;
}

interface Props {
  nodes: NodeLatency[];
  cs: boolean;
}

function latencyBar(ms: number | undefined, max = 500) {
  if (ms == null) return null;
  const pct = Math.min((ms / max) * 100, 100);
  const color = ms < 100 ? 'bg-emerald-400' : ms < 300 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function NetworkLatencyPanel({ nodes, cs }: Props) {
  const onlineNodes = nodes.filter((n) => n.online);

  return (
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Latence' : 'Latency'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Zap className="h-7 w-7 text-yellow-400" />
          {cs ? 'Síťová latence' : 'Network Latency'}
        </h2>
        <p className="text-sm text-gray-400">
          {cs
            ? 'RPC a pool latence jednotlivých uzlů spolu se zpožděním bloků (block lag).'
            : 'RPC and pool latencies per node together with block propagation lag.'}
        </p>
      </div>

      <div className="grid gap-3">
        {onlineNodes.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-500 text-center">
            {cs ? 'Žádné uzly nejsou online.' : 'No nodes are currently online.'}
          </div>
        )}
        {onlineNodes.map((node) => (
          <div
            key={node.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
          >
            <div className="flex items-center gap-3 min-w-[140px]">
              <div className={`w-2.5 h-2.5 rounded-full ${node.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-white">{node.name}</span>
            </div>

            <div className="flex-1 grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">RPC</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white w-12">
                    {node.rpcLatencyMs != null ? `${node.rpcLatencyMs}ms` : '—'}
                  </span>
                  {latencyBar(node.rpcLatencyMs)}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Pool</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white w-12">
                    {node.poolLatencyMs != null ? `${node.poolLatencyMs}ms` : '—'}
                  </span>
                  {latencyBar(node.poolLatencyMs)}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Lag' : 'Lag'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white w-12">
                    {node.blockLag != null ? `${node.blockLag}` : '—'}
                  </span>
                  {node.blockLag != null && (
                    <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full ${node.blockLag <= 1 ? 'bg-emerald-400' : node.blockLag <= 3 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min((node.blockLag / 5) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
