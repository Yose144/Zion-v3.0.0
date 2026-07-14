import { useEffect, useState, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { fetchLayerStatus, type LayerStatus } from '../lib/api';

const LAYER_COLORS: Record<string, string> = {
  L1: 'text-zion-gold',
  L2: 'text-blue-400',
  L3: 'text-zion-purple',
  L4: 'text-pink-400',
  L5: 'text-cyan-400',
  L6: 'text-emerald-400',
};

export default function LayerStatusPanel() {
  const [data, setData] = useState<LayerStatus | null>(null);

  const refresh = useCallback(async () => {
    const s = await fetchLayerStatus();
    if (s) setData(s);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const summary = data?.summary;
  const layers = data?.layers ?? [];

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-zion-purple" />
          <h2 className="text-sm font-bold">Layer Status</h2>
        </div>
        {summary && (
          <span className="zion-badge">
            {summary.up}/{summary.total} up
          </span>
        )}
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {layers.length === 0 && <div className="text-xs text-gray-500 italic">No layer data</div>}
        {layers.map((l) => {
          const color = l.status === 'up' ? 'text-emerald-400' : l.status === 'degraded' ? 'text-amber-400' : 'text-red-400';
          const dot = l.status === 'up' ? 'bg-emerald-400' : l.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400';
          const layerColor = LAYER_COLORS[l.id?.split('-')[0].toUpperCase()] ?? 'text-gray-400';
          return (
            <div key={l.id} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className={`text-xs font-semibold ${layerColor}`}>{l.id}</span>
                <span className="text-[10px] text-gray-400 truncate">{l.name}</span>
              </div>
              <span className={`text-[10px] font-mono uppercase ${color}`}>{l.status}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
