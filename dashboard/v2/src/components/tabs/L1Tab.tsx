// ─── ZION Dashboard v2 — L1 Consensus Tab ───────────────────────────────────
import React, { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useStatusStore } from '../../stores/statusStore';
import { usePolling } from '../../hooks/usePolling';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function KV({ k, v }: { k: string; v: string | number | undefined }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-(--color-border-dim) last:border-0">
      <span className="text-xs text-(--color-text-muted)">{k}</span>
      <span className="text-xs font-mono text-(--color-text)">{v ?? '—'}</span>
    </div>
  );
}

/** Tiny 80×32 sparkline — no axes, no grid */
function Sparkline({ data }: { data: { hashrate: number }[] }) {
  if (!data.length) {
    return <div className="h-8 w-20 flex items-center justify-center text-[10px] text-(--color-text-muted)">—</div>;
  }
  return (
    <div style={{ width: 80, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Tooltip
            contentStyle={{ display: 'none' }}
            cursor={false}
          />
          <Line
            type="monotone"
            dataKey="hashrate"
            dot={false}
            strokeWidth={1.5}
            stroke="var(--color-zion-gold)"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Visual bar — pct 0–100 */
function ProgressBar({ pct, color = 'bg-(--color-zion-cyan)' }: { pct: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-(--color-bg-base) rounded-full overflow-hidden border border-(--color-border-dim)">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs font-mono text-(--color-text-muted) w-10 text-right">{clamped.toFixed(0)}%</span>
    </div>
  );
}

/** Share-efficiency gauge (accepted / total) */
function ShareGauge({ accepted, rejected, label }: { accepted: number; rejected: number; label: string }) {
  const total = accepted + rejected;
  const eff = total > 0 ? (accepted / total) * 100 : 0;
  const color = eff >= 95 ? 'bg-(--color-zion-green)' : eff >= 80 ? 'bg-(--color-zion-gold)' : 'bg-(--color-zion-red)';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-(--color-text-muted)">{label}</span>
        <span className="font-mono text-(--color-text)">{eff.toFixed(1)}%</span>
      </div>
      <ProgressBar pct={eff} color={color} />
    </div>
  );
}

// ── Quick-action button ───────────────────────────────────────────────────────

function ActionBtn({
  label,
  action,
  variant,
}: {
  label: string;
  action: () => Promise<{ ok: boolean }>;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null);

  const run = async () => {
    setBusy(true);
    setFlash(null);
    try {
      await action();
      setFlash('ok');
    } catch {
      setFlash('err');
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 2000);
    }
  };

  return (
    <Button
      variant={variant}
      size="sm"
      loading={busy}
      onClick={run}
      className={flash === 'ok' ? 'ring-1 ring-(--color-zion-green)' : flash === 'err' ? 'ring-1 ring-(--color-zion-red)' : ''}
    >
      {label}
    </Button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function L1Tab() {
  const status  = useStatusStore(s => s.status);
  const history = useStatusStore(s => s.history);
  const fetchStatus  = useStatusStore(s => s.fetchStatus);
  const fetchHistory = useStatusStore(s => s.fetchHistory);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePolling(fetchStatus);
  usePolling(fetchHistory, 3);

  const n1    = status?.node1;
  const n2    = status?.node2;
  const pool  = status?.pool;
  const miner = status?.miner;

  // Mempool depth visual (max 500 txs reference)
  const mempoolPct = n1?.mempool_size != null ? Math.min((n1.mempool_size / 500) * 100, 100) : 0;
  const mempoolColor =
    mempoolPct >= 80 ? 'bg-(--color-zion-red)' :
    mempoolPct >= 50 ? 'bg-(--color-zion-gold)' :
    'bg-(--color-zion-cyan)';

  return (
    <div className="p-6 space-y-6">

      {/* ── Quick-action row ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-(--color-text-muted) mr-1">Quick actions:</span>
        <ActionBtn label="Start Node"  action={api.nodeStart}  variant="secondary" />
        <ActionBtn label="Stop Node"   action={api.nodeStop}   variant="danger" />
        <ActionBtn label="Start Pool"  action={api.poolStart}  variant="secondary" />
        <ActionBtn label="Stop Pool"   action={api.poolStop}   variant="danger" />
        <ActionBtn label="Start Miner" action={api.minerStart} variant="secondary" />
        <ActionBtn label="Stop Miner"  action={api.minerStop}  variant="danger" />
      </div>

      {/* ── Hashrate sparkline + mempool bar ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Hashrate History" accent="gold">
          <div className="flex items-center gap-4">
            <Sparkline data={history} />
            <div>
              <p className="text-xs text-(--color-text-muted) mb-0.5">Current</p>
              <p className="text-sm font-mono font-bold text-(--color-zion-gold)">
                {pool?.hashrate_hs != null
                  ? `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s`
                  : miner?.hashrate_hs != null
                    ? `${(miner.hashrate_hs / 1000).toFixed(2)} KH/s`
                    : '—'}
              </p>
              <p className="text-[10px] text-(--color-text-muted) mt-0.5">{history.length} data points</p>
            </div>
          </div>
        </Card>

        <Card title="Mempool Depth" accent="cyan">
          <div className="space-y-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-(--color-text-muted)">Node 1 mempool</span>
              <span className="font-mono text-(--color-text)">{n1?.mempool_size ?? '—'} txs</span>
            </div>
            <ProgressBar pct={mempoolPct} color={mempoolColor} />
            <p className="text-[10px] text-(--color-text-muted)">Reference max: 500 txs</p>
          </div>
        </Card>
      </div>

      {/* ── Share efficiency ─────────────────────────────────────────── */}
      <Card title="Share Efficiency" accent="purple">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ShareGauge
            label="Pool shares"
            accepted={pool?.accepted_shares ?? 0}
            rejected={pool?.rejected_shares ?? 0}
          />
          <ShareGauge
            label="Miner shares"
            accepted={miner?.accepted ?? 0}
            rejected={miner?.rejected ?? 0}
          />
        </div>
      </Card>

      {/* ── KV grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Card title="Node 1 (Core)" accent="gold">
          <KV k="Block Height" v={n1?.block_height?.toLocaleString()} />
          <KV k="Best Hash"    v={n1?.best_hash ? `${n1.best_hash.slice(0, 16)}…` : undefined} />
          <KV k="Peers"        v={n1?.peers} />
          <KV k="Mempool"      v={n1?.mempool_size} />
          <KV k="Version"      v={n1?.version} />
          <div className="mt-3 flex gap-2 flex-wrap">
            <Badge variant={n1?.running ? 'green' : 'red'}>{n1?.running ? 'running' : 'stopped'}</Badge>
            {n1?.syncing && <Badge variant="gold">syncing</Badge>}
          </div>
        </Card>

        <Card title="Node 2 (Edge)" accent="purple">
          <KV k="Block Height" v={n2?.block_height?.toLocaleString()} />
          <KV k="Best Hash"    v={n2?.best_hash ? `${n2.best_hash.slice(0, 16)}…` : undefined} />
          <KV k="Peers"        v={n2?.peers} />
          <KV k="Mempool"      v={n2?.mempool_size} />
          <KV k="Version"      v={n2?.version} />
          <div className="mt-3 flex gap-2 flex-wrap">
            <Badge variant={n2?.running ? 'green' : 'red'}>{n2?.running ? 'running' : 'stopped'}</Badge>
            {n2?.syncing && <Badge variant="gold">syncing</Badge>}
          </div>
        </Card>

        <Card title="Pool" accent="cyan">
          <KV k="Miners connected" v={pool?.connected_miners} />
          <KV k="Hashrate"         v={pool ? `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s` : undefined} />
          <KV k="Accepted shares"  v={pool?.accepted_shares?.toLocaleString()} />
          <KV k="Rejected shares"  v={pool?.rejected_shares?.toLocaleString()} />
          <div className="mt-3">
            <Badge variant={pool?.running ? 'green' : 'red'}>{pool?.running ? 'running' : 'stopped'}</Badge>
          </div>
        </Card>

        <Card title="Miner" accent="green">
          <KV k="Hashrate" v={miner ? `${(miner.hashrate_hs / 1000).toFixed(2)} KH/s` : undefined} />
          <KV k="Accepted" v={miner?.accepted?.toLocaleString()} />
          <KV k="Rejected" v={miner?.rejected?.toLocaleString()} />
          {miner?.gpu_temp != null && <KV k="GPU Temp" v={`${miner.gpu_temp}°C`} />}
          {miner?.gpu_load != null && <KV k="GPU Load" v={`${miner.gpu_load}%`} />}
          <div className="mt-3">
            <Badge variant={miner?.running ? 'green' : 'red'}>{miner?.running ? 'running' : 'stopped'}</Badge>
          </div>
        </Card>

      </div>
    </div>
  );
}
