import { useEffect, useState, useCallback } from 'react';
import { MemoryStick } from 'lucide-react';
import { fetchMempool, type MempoolResponse } from '../lib/api';

export default function MempoolPanel() {
  const [data, setData] = useState<MempoolResponse | null>(null);

  const refresh = useCallback(async () => {
    const s = await fetchMempool();
    if (s) setData(s);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const size = data?.size ?? 0;
  const bytes = data?.bytes ?? 0;
  const fees = data?.fee_estimates ?? {};

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MemoryStick size={18} className="text-zion-cyan" />
          <h2 className="text-sm font-bold">Mempool</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-xl font-bold text-white">{size.toLocaleString()}</div>
          <div className="text-[9px] text-gray-400">Pending TXs</div>
        </div>
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-sm font-bold text-zion-gold font-mono">{(bytes / 1024).toFixed(1)} KB</div>
          <div className="text-[9px] text-gray-400">Size</div>
        </div>
      </div>

      {Object.keys(fees).length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-400 uppercase">Fee estimates</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(fees).slice(0, 6).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between p-1.5 rounded bg-white/5 border border-white/5 text-[10px]">
                <span className="text-gray-400">{k}</span>
                <span className="font-mono text-emerald-400">{Number(v).toFixed(4)} Z</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
