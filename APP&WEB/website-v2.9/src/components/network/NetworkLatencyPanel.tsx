'use client';

import { Activity, Server, Zap } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const NetworkLatencyPanelCopy = {
  latency: { cs: `Latence`, en: `Latency` },
  networkLatency: { cs: `Síťová latence`, en: `Network Latency` },
  rpcAndPoolLatenciesPerNodeToge: { cs: `RPC a pool latence jednotlivých uzlů spolu se zpožděním bloků (block lag).`, en: `RPC and pool latencies per node together with block propagation lag.` },
  noNodesAreCurrentlyOnline: { cs: `Žádné uzly nejsou online.`, en: `No nodes are currently online.` },
  lag: { cs: `Lag`, en: `Lag` },
};

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
}

function latencyBar(ms: number | undefined, max = 500) {
  if (ms == null) return null;
  const pct = Math.min((ms / max) * 100, 100);
  const color = ms < 100 ? 'bg-zion-cyan' : ms < 300 ? 'bg-zion-gold' : 'bg-zion-purple';
  return (
    <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function NetworkLatencyPanel({ nodes }: Props) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const onlineNodes = nodes.filter((n) => n.online);

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{NetworkLatencyPanelCopy.latency[cs ? 'cs' : 'en']}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Zap className="h-7 w-7 text-zion-gold" />
          {NetworkLatencyPanelCopy.networkLatency[cs ? 'cs' : 'en']}
        </h2>
        <p className="text-sm text-gray-400">
          {NetworkLatencyPanelCopy.rpcAndPoolLatenciesPerNodeToge[cs ? 'cs' : 'en']}
        </p>
      </div>

      <div className="grid gap-3">
        {onlineNodes.length === 0 && (
          <div className="zion-tile p-6 text-sm text-gray-500 text-center">
            {NetworkLatencyPanelCopy.noNodesAreCurrentlyOnline[cs ? 'cs' : 'en']}
          </div>
        )}
        {onlineNodes.map((node) => (
          <div
            key={node.id}
            className="zion-rainbow-sub p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
            style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
          >
            <div className="flex items-center gap-3 min-w-0 sm:min-w-[140px]">
              <div className={`w-2.5 h-2.5 rounded-full ${node.online ? 'bg-zion-cyan animate-pulse' : 'bg-zion-purple'}`} />
              <span className="text-sm font-medium text-white">{node.name}</span>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-row sm:flex-col items-center sm:items-start gap-2 sm:gap-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 w-12 sm:w-auto">RPC</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white w-12">
                    {node.rpcLatencyMs != null ? `${node.rpcLatencyMs}ms` : '—'}
                  </span>
                  {latencyBar(node.rpcLatencyMs)}
                </div>
              </div>
              <div className="flex flex-row sm:flex-col items-center sm:items-start gap-2 sm:gap-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 w-12 sm:w-auto">Pool</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white w-12">
                    {node.poolLatencyMs != null ? `${node.poolLatencyMs}ms` : '—'}
                  </span>
                  {latencyBar(node.poolLatencyMs)}
                </div>
              </div>
              <div className="flex flex-row sm:flex-col items-center sm:items-start gap-2 sm:gap-1">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 w-12 sm:w-auto">{NetworkLatencyPanelCopy.lag[cs ? 'cs' : 'en']}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white w-12">
                    {node.blockLag != null ? `${node.blockLag}` : '—'}
                  </span>
                  {node.blockLag != null && (
                    <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full ${node.blockLag <= 1 ? 'bg-zion-cyan' : node.blockLag <= 3 ? 'bg-zion-gold' : 'bg-zion-purple'}`}
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
