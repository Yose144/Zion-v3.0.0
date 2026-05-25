// ─── ZION Dashboard v2 — L1 Consensus Tab ───────────────────────────────────
import React, { useEffect } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { usePolling } from '../../hooks/usePolling';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

function KV({ k, v }: { k: string; v: string | number | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-(--color-border-dim) last:border-0">
      <span className="text-xs text-(--color-text-muted)">{k}</span>
      <span className="text-xs font-mono text-(--color-text)">{v ?? '—'}</span>
    </div>
  );
}

export default function L1Tab() {
  const status = useStatusStore(s => s.status);
  const fetchStatus = useStatusStore(s => s.fetchStatus);
  useEffect(() => { fetchStatus(); }, []);
  usePolling(fetchStatus);

  const n1 = status?.node1;
  const n2 = status?.node2;
  const pool = status?.pool;
  const miner = status?.miner;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Card title="Node 1 (Core)" accent="gold">
          <KV k="Block Height" v={n1?.block_height?.toLocaleString()} />
          <KV k="Best Hash"    v={n1?.best_hash ? `${n1.best_hash.slice(0, 16)}…` : undefined} />
          <KV k="Peers"        v={n1?.peers} />
          <KV k="Mempool"      v={n1?.mempool_size} />
          <KV k="Version"      v={n1?.version} />
          <div className="mt-2 flex gap-2">
            <Badge variant={n1?.running ? 'green' : 'red'}>{n1?.running ? 'running' : 'stopped'}</Badge>
            {n1?.syncing && <Badge variant="gold">syncing</Badge>}
          </div>
        </Card>

        <Card title="Node 2 (Edge)" accent="purple">
          <KV k="Block Height" v={n2?.block_height?.toLocaleString()} />
          <KV k="Best Hash"    v={n2?.best_hash ? `${n2.best_hash.slice(0, 16)}…` : undefined} />
          <KV k="Peers"        v={n2?.peers} />
          <KV k="Mempool"      v={n2?.mempool_size} />
          <div className="mt-2 flex gap-2">
            <Badge variant={n2?.running ? 'green' : 'red'}>{n2?.running ? 'running' : 'stopped'}</Badge>
            {n2?.syncing && <Badge variant="gold">syncing</Badge>}
          </div>
        </Card>

        <Card title="Pool" accent="cyan">
          <KV k="Miners connected" v={pool?.connected_miners} />
          <KV k="Hashrate" v={pool ? `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s` : undefined} />
          <KV k="Accepted shares" v={pool?.accepted_shares?.toLocaleString()} />
          <KV k="Rejected shares" v={pool?.rejected_shares?.toLocaleString()} />
          <div className="mt-2">
            <Badge variant={pool?.running ? 'green' : 'red'}>{pool?.running ? 'running' : 'stopped'}</Badge>
          </div>
        </Card>

        <Card title="Miner" accent="green">
          <KV k="Hashrate" v={miner ? `${(miner.hashrate_hs / 1000).toFixed(2)} KH/s` : undefined} />
          <KV k="Accepted" v={miner?.accepted?.toLocaleString()} />
          <KV k="Rejected" v={miner?.rejected?.toLocaleString()} />
          {miner?.gpu_temp != null && <KV k="GPU Temp" v={`${miner.gpu_temp}°C`} />}
          {miner?.gpu_load != null && <KV k="GPU Load" v={`${miner.gpu_load}%`} />}
          <div className="mt-2">
            <Badge variant={miner?.running ? 'green' : 'red'}>{miner?.running ? 'running' : 'stopped'}</Badge>
          </div>
        </Card>

      </div>
    </div>
  );
}
