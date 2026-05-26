// ─── ZION Dashboard v2 — L1 Consensus Tab (v2.9 aesthetic) ─────────────────
import React, { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useStatusStore } from '../../stores/statusStore';
import { usePolling } from '../../hooks/usePolling';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';

// ── KV row ────────────────────────────────────────────────────────────────────

function KV({ k, v }: { k: string; v: string | number | undefined }) {
  return (
    <div
      className="flex justify-between py-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span className="text-xs text-slate-500 font-medium">{k}</span>
      <span className="text-xs font-mono text-slate-200">{v ?? '—'}</span>
    </div>
  );
}

/** Tiny sparkline — no axes */
function Sparkline({ data }: { data: { hashrate: number }[] }) {
  if (!data.length) {
    return (
      <div className="h-10 w-24 flex items-center justify-center text-[10px] text-slate-600">
        no data
      </div>
    );
  }
  return (
    <div style={{ width: 96, height: 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Tooltip contentStyle={{ display: 'none' }} cursor={false} />
          <Line
            type="monotone"
            dataKey="hashrate"
            dot={false}
            strokeWidth={2}
            stroke="rgb(255,215,0)"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Progress bar with gradient fill */
function ProgressBar({
  pct, gradient,
}: {
  pct: number;
  gradient: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${clamped}%`, background: gradient }}
        />
      </div>
      <span className="text-xs font-mono text-slate-400 w-10 text-right">
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}

/** Share-efficiency gauge */
function ShareGauge({
  accepted, rejected, label,
}: {
  accepted: number; rejected: number; label: string;
}) {
  const total = accepted + rejected;
  const eff = total > 0 ? (accepted / total) * 100 : 0;
  const gradient =
    eff >= 95 ? 'linear-gradient(90deg, rgb(34,197,94), rgb(74,222,128))' :
    eff >= 80 ? 'linear-gradient(90deg, rgb(255,215,0), rgb(251,191,36))' :
                'linear-gradient(90deg, rgb(239,68,68), rgb(248,113,113))';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="font-mono text-slate-200 font-semibold">{eff.toFixed(1)}%</span>
      </div>
      <ProgressBar pct={eff} gradient={gradient} />
      <p className="text-[10px] text-slate-600">
        {accepted.toLocaleString()} acc / {rejected.toLocaleString()} rej
      </p>
    </div>
  );
}

// ── Quick-action button ───────────────────────────────────────────────────────

function ActionBtn({
  label, action, variant,
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
      className={
        flash === 'ok'  ? 'ring-1 ring-emerald-500/60' :
        flash === 'err' ? 'ring-1 ring-red-500/60'     : ''
      }
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

  const mempoolPct = n1?.mempool_size != null
    ? Math.min((n1.mempool_size / 500) * 100, 100) : 0;
  const mempoolGradient =
    mempoolPct >= 80 ? 'linear-gradient(90deg, rgb(239,68,68), rgb(248,113,113))' :
    mempoolPct >= 50 ? 'linear-gradient(90deg, rgb(255,215,0), rgb(251,191,36))' :
                       'linear-gradient(90deg, rgb(6,182,212), rgb(34,211,238))';

  return (
    <div className="p-6 space-y-6">

      {/* ── Quick actions ── */}
      <div
        className="zion-panel-soft rounded-2xl px-4 py-3 flex flex-wrap gap-2 items-center"
      >
        <span className="text-[11px] text-slate-600 uppercase tracking-wider font-bold mr-2">
          Quick actions
        </span>
        <ActionBtn label="Start Node"  action={api.nodeStart}  variant="secondary" />
        <ActionBtn label="Stop Node"   action={api.nodeStop}   variant="danger" />
        <ActionBtn label="Start Pool"  action={api.poolStart}  variant="secondary" />
        <ActionBtn label="Stop Pool"   action={api.poolStop}   variant="danger" />
        <ActionBtn label="Start Miner" action={api.minerStart} variant="secondary" />
        <ActionBtn label="Stop Miner"  action={api.minerStop}  variant="danger" />
      </div>

      {/* ── Hashrate sparkline + Mempool ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Hashrate History" accent="gold">
          <div className="flex items-center gap-5">
            <Sparkline data={history} />
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                Current
              </p>
              <p
                className="text-lg font-mono font-bold"
                style={{
                  backgroundImage: 'linear-gradient(135deg, rgb(255,215,0), rgb(251,191,36))',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {pool?.hashrate_hs != null
                  ? `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s`
                  : miner?.hashrate_hs != null
                    ? `${(miner.hashrate_hs / 1000).toFixed(2)} KH/s`
                    : '—'}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">{history.length} data points</p>
            </div>
          </div>
        </Card>

        <Card title="Mempool Depth" accent="cyan">
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500 font-medium">Node 1 mempool</span>
              <span className="font-mono text-slate-200 font-semibold">
                {n1?.mempool_size ?? '—'} txs
              </span>
            </div>
            <ProgressBar pct={mempoolPct} gradient={mempoolGradient} />
            <p className="text-[10px] text-slate-600">Reference max: 500 txs</p>
          </div>
        </Card>
      </div>

      {/* ── Share efficiency ── */}
      <Card title="Share Efficiency" accent="purple">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* ── KV grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card title="Node 1 · Core" accent="gold">
          <KV k="Block Height" v={n1?.block_height?.toLocaleString()} />
          <KV k="Best Hash"    v={n1?.best_hash ? `${n1.best_hash.slice(0, 18)}…` : undefined} />
          <KV k="Peers"        v={n1?.peers} />
          <KV k="Mempool"      v={n1?.mempool_size} />
          <KV k="Version"      v={n1?.version} />
          <div className="mt-3 flex gap-2 flex-wrap">
            <Badge variant={n1?.running ? 'green' : 'red'}>
              {n1?.running ? 'running' : 'stopped'}
            </Badge>
            {n1?.syncing && <Badge variant="gold">syncing</Badge>}
          </div>
        </Card>

        <Card title="Node 2 · Edge" accent="purple">
          <KV k="Block Height" v={n2?.block_height?.toLocaleString()} />
          <KV k="Best Hash"    v={n2?.best_hash ? `${n2.best_hash.slice(0, 18)}…` : undefined} />
          <KV k="Peers"        v={n2?.peers} />
          <KV k="Mempool"      v={n2?.mempool_size} />
          <KV k="Version"      v={n2?.version} />
          <div className="mt-3 flex gap-2 flex-wrap">
            <Badge variant={n2?.running ? 'green' : 'red'}>
              {n2?.running ? 'running' : 'stopped'}
            </Badge>
            {n2?.syncing && <Badge variant="gold">syncing</Badge>}
          </div>
        </Card>

        <Card title="Pool" accent="cyan">
          <KV k="Miners connected" v={pool?.connected_miners} />
          <KV k="Hashrate"         v={pool ? `${(pool.hashrate_hs / 1000).toFixed(2)} KH/s` : undefined} />
          <KV k="Accepted shares"  v={pool?.accepted_shares?.toLocaleString()} />
          <KV k="Rejected shares"  v={pool?.rejected_shares?.toLocaleString()} />
          <div className="mt-3">
            <Badge variant={pool?.running ? 'green' : 'red'}>
              {pool?.running ? 'running' : 'stopped'}
            </Badge>
          </div>
        </Card>

        <Card title="Miner" accent="green">
          <KV k="Hashrate" v={miner ? `${(miner.hashrate_hs / 1000).toFixed(2)} KH/s` : undefined} />
          <KV k="Accepted" v={miner?.accepted?.toLocaleString()} />
          <KV k="Rejected" v={miner?.rejected?.toLocaleString()} />
          {miner?.gpu_temp != null && <KV k="GPU Temp" v={`${miner.gpu_temp}°C`} />}
          {miner?.gpu_load != null && <KV k="GPU Load" v={`${miner.gpu_load}%`} />}
          <div className="mt-3">
            <Badge variant={miner?.running ? 'green' : 'red'}>
              {miner?.running ? 'running' : 'stopped'}
            </Badge>
          </div>
        </Card>

      </div>
    </div>
  );
}
