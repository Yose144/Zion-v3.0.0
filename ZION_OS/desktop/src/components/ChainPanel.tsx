import { Link2, Database, ArrowUpDown, Layers } from 'lucide-react';
import type { V3Status } from '../lib/api';

interface Props {
  status: V3Status | null;
}

export default function ChainPanel({ status }: Props) {
  const edgeH = status?.edge_node?.chain_height ?? null;
  const localH = status?.node1?.chain_height ?? null;
  const mempool = status?.edge_node?.mempool_size ?? status?.node1?.mempool_size ?? 0;

  let gapText = '—';
  let gapClass = 'text-gray-400';
  let syncText = 'Unknown';
  let syncClass = 'zion-badge';

  if (edgeH != null && localH != null) {
    const gap = Math.abs(edgeH - localH);
    gapText = String(gap);
    if (gap <= 5) {
      gapClass = 'text-emerald-400';
      syncText = 'Synced';
      syncClass = 'zion-badge zion-badge-green';
    } else if (gap <= 20) {
      gapClass = 'text-amber-400';
      syncText = 'Syncing (' + gap + ')';
      syncClass = 'zion-badge zion-badge-amber';
    } else {
      gapClass = 'text-red-400';
      syncText = 'Lag (' + gap + ')';
      syncClass = 'zion-badge zion-badge-red';
    }
  }

  return (
    <section className="zion-card lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link2 size={18} className="text-zion-purple" />
          <h2 className="text-sm font-bold">Chain Status</h2>
        </div>
        <span className={syncClass}>{syncText}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 flex items-center gap-1"><Database size={10} /> Edge Height</div>
          <div className="text-xl font-bold text-white font-mono">{edgeH != null ? edgeH.toLocaleString() : '—'}</div>
        </div>
        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 flex items-center gap-1"><Database size={10} /> Local Height</div>
          <div className="text-xl font-bold text-zion-cyan font-mono">{localH != null ? localH.toLocaleString() : '—'}</div>
        </div>
        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 flex items-center gap-1"><ArrowUpDown size={10} /> Sync Gap</div>
          <div className={`text-xl font-bold font-mono ${gapClass}`}>{gapText}</div>
        </div>
        <div className="zion-panel-soft p-3">
          <div className="text-[10px] text-gray-400 flex items-center gap-1"><Layers size={10} /> Mempool</div>
          <div className="text-xl font-bold text-zion-gold font-mono">{mempool.toLocaleString()}</div>
        </div>
      </div>
    </section>
  );
}
