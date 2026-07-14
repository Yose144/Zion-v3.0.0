import { useEffect, useState, useCallback } from 'react';
import { Cpu, Activity, Server, Award } from 'lucide-react';
import { fetchAgentStatus, fetchAgentTelemetry, fetchAgentNodes, fetchAgentRewards, type AgentStatus } from '../lib/api';

export default function AgentPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [telemetry, setTelemetry] = useState<Record<string, unknown> | null>(null);
  const [nodes, setNodes] = useState<unknown[] | null>(null);
  const [rewards, setRewards] = useState<Record<string, unknown> | null>(null);

  const refresh = useCallback(async () => {
    const [s, t, n, r] = await Promise.all([
      fetchAgentStatus(),
      fetchAgentTelemetry(),
      fetchAgentNodes(),
      fetchAgentRewards(),
    ]);
    setStatus(s);
    setTelemetry(t);
    setNodes(n?.nodes ?? []);
    setRewards(r);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const online = status?.online ?? false;
  const rigsTotal = status?.rigs_total ?? (nodes?.length || 0);
  const rigsOnline = status?.rigs_online ?? (nodes?.filter((n: any) => n?.online).length || 0);
  const gpus = (telemetry?.gpus as any[])?.length ?? (telemetry?.gpu_count as number) ?? 0;
  const cpuLoad = telemetry?.cpu_load_pct as number | undefined;
  const memUsed = telemetry?.memory_used_gb as number | undefined;
  const memTotal = telemetry?.memory_total_gb as number | undefined;
  const rewardTotal = (rewards?.total_zion as number) ?? 0;

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu size={18} className="text-zion-cyan" />
          <h2 className="text-sm font-bold">Edge Agent</h2>
        </div>
        <span className={`zion-badge ${online ? 'zion-badge-green' : 'zion-badge-red'}`}>
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-xl font-bold text-white">{rigsTotal}</div>
          <div className="text-[9px] text-gray-400">Rigs</div>
        </div>
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-xl font-bold text-emerald-400">{rigsOnline}</div>
          <div className="text-[9px] text-gray-400">Online</div>
        </div>
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-xl font-bold text-zion-gold">{gpus || '—'}</div>
          <div className="text-[9px] text-gray-400">GPUs</div>
        </div>
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-xl font-bold text-zion-purple">{rewardTotal.toFixed(4)}</div>
          <div className="text-[9px] text-gray-400">Z Rewards</div>
        </div>
      </div>

      {(cpuLoad != null || memUsed != null) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="zion-panel-soft p-3">
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1"><Activity size={10} /> CPU Load</div>
            <div className="text-sm font-bold text-white font-mono">{cpuLoad != null ? cpuLoad.toFixed(1) + '%' : '—'}</div>
          </div>
          <div className="zion-panel-soft p-3">
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1"><Server size={10} /> Memory</div>
            <div className="text-sm font-bold text-white font-mono">{memUsed != null && memTotal != null ? `${memUsed.toFixed(1)}/${memTotal.toFixed(1)} GB` : '—'}</div>
          </div>
        </div>
      )}
    </section>
  );
}
