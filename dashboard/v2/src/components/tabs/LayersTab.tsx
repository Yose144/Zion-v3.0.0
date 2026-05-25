// ─── ZION Dashboard v2 — Layers Tab (L2–L6) ─────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { HealthBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { RefreshCw } from 'lucide-react';
import api from '../../api/client';
import type { DaoProposal } from '../../types/api';
import type { TabId } from '../layout/Sidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function KV({ k, v }: { k: string; v: unknown }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-(--color-border-dim) last:border-0">
      <span className="text-xs text-(--color-text-muted)">{k}</span>
      <span className="text-xs font-mono text-(--color-text)">{String(v ?? '—')}</span>
    </div>
  );
}

function StatsCard({ title, stats }: { title: string; stats: Record<string, unknown> }) {
  return (
    <Card title={title} accent="cyan">
      <div className="space-y-0">
        {Object.entries(stats).map(([k, v]) => (
          <KV key={k} k={k} v={v} />
        ))}
      </div>
    </Card>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="text-xs text-(--color-zion-red) bg-red-950/30 border border-red-900 rounded p-3">
      {msg}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1 py-2">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 bg-(--color-text-muted) rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

// ── L2 sub-components ────────────────────────────────────────────────────────

function ServiceHealthRow({
  name,
  description,
  port,
  healthy,
  loading,
}: {
  name: string;
  description: string;
  port?: number;
  healthy: boolean | null;
  loading: boolean;
}) {
  const status = loading ? 'unknown' : healthy === null ? 'unknown' : healthy ? 'healthy' : 'down';
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-(--color-border-dim) last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-(--color-text)">{name}</span>
          {port && <span className="text-[10px] font-mono text-(--color-text-muted)">:{port}</span>}
        </div>
        <p className="text-xs text-(--color-text-muted) leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0">
        {loading ? <LoadingDots /> : <HealthBadge status={status} />}
      </div>
    </div>
  );
}

function L2Tab() {
  const [bridgeHealth, setBridgeHealth] = useState<boolean | null>(null);
  const [daoHealth,    setDaoHealth]    = useState<boolean | null>(null);
  const [swapHealth,   setSwapHealth]   = useState<boolean | null>(null);
  const [proposals,    setProposals]    = useState<DaoProposal[] | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [b, d, s, p] = await Promise.allSettled([
        api.bridgeHealth(),
        api.daoHealth(),
        api.swapHealth(),
        api.daoProposals(),
      ]);
      if (b.status === 'fulfilled') setBridgeHealth(b.value.healthy);
      if (d.status === 'fulfilled') setDaoHealth(d.value.healthy);
      if (s.status === 'fulfilled') setSwapHealth(s.value.healthy);
      if (p.status === 'fulfilled') setProposals(p.value);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">L2 Services</h3>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      <Card title="Bridge" accent="purple">
        <ServiceHealthRow
          name="zion-bridge"
          description="Relay daemon: watches L1 + EVM chains, relays cross-chain messages. Uses SQLite persistence and Prometheus metrics."
          port={8001}
          healthy={bridgeHealth}
          loading={loading}
        />
      </Card>

      <Card title="DAO" accent="gold">
        <ServiceHealthRow
          name="zion-dao"
          description="Governance daemon: L1 scanner + Axum HTTP API for treasury and proposal management. SQLite backend."
          port={8001}
          healthy={daoHealth}
          loading={loading}
        />
        {proposals !== null && (
          <div className="mt-3 pt-3 border-t border-(--color-border-dim)">
            <div className="flex items-center gap-3">
              <span className="text-xs text-(--color-text-muted)">Active proposals</span>
              <Badge variant="cyan">{proposals.filter(p => p.status === 'active').length}</Badge>
              <span className="text-xs text-(--color-text-muted)">Total</span>
              <Badge variant="gray">{proposals.length}</Badge>
            </div>
            {proposals.length > 0 && (
              <div className="mt-2 space-y-1">
                {proposals.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1">
                    <span className="text-(--color-text-muted) truncate max-w-[200px]">#{p.id} {p.title}</span>
                    <Badge variant={p.status === 'active' ? 'green' : p.status === 'passed' ? 'cyan' : p.status === 'failed' ? 'red' : 'gray'}>
                      {p.status}
                    </Badge>
                  </div>
                ))}
                {proposals.length > 3 && (
                  <p className="text-[10px] text-(--color-text-muted)">+{proposals.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Atomic Swap" accent="cyan">
        <ServiceHealthRow
          name="zion-atomic-swap"
          description="HTLC swap daemon: config-driven, L1 watcher, refund loop, optional EVM watcher, Axum API for swap lifecycle."
          port={8001}
          healthy={swapHealth}
          loading={loading}
        />
      </Card>

      {err && <ErrorBox msg={err} />}
    </div>
  );
}

// ── L3 sub-component ─────────────────────────────────────────────────────────

function L3Tab() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.warpHealth();
      setHealthy(res.healthy);
    } catch (e) {
      setErr(String(e));
      setHealthy(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">L3 Service</h3>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      <Card title="Warp — Cross-Chain Relay" accent="purple">
        <ServiceHealthRow
          name="zion-warp"
          description="Cross-chain relay daemon: Axum HTTP API + background watcher. Config-first startup with optional SQLite persistence. Routes messages between ZION L1 and external chains."
          port={8001}
          healthy={healthy}
          loading={loading}
        />
        <div className="mt-3 pt-3 border-t border-(--color-border-dim) space-y-1 text-xs text-(--color-text-muted)">
          <p>• Monitors L1 for outbound relay events</p>
          <p>• Signs and submits transactions on target chains</p>
          <p>• Configurable retry / finality wait windows</p>
        </div>
      </Card>

      {err && <ErrorBox msg={err} />}
    </div>
  );
}

// ── Generic stats layer (L4/L5/L6) ───────────────────────────────────────────

function StatsLayer({
  title,
  description,
  fetch,
  accent,
}: {
  title: string;
  description: string;
  fetch: () => Promise<Record<string, unknown>>;
  accent: 'gold' | 'purple' | 'cyan' | 'green' | 'red' | 'none';
}) {
  const [stats,   setStats]   = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      setStats(await fetch());
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-(--color-text-muted) uppercase tracking-wider">{title}</h3>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      <Card accent={accent}>
        <p className="text-xs text-(--color-text-muted) mb-3">{description}</p>
        {loading && <LoadingDots />}
        {!loading && stats && Object.keys(stats).length > 0 && (
          <div className="space-y-0">
            {Object.entries(stats).map(([k, v]) => <KV key={k} k={k} v={v} />)}
          </div>
        )}
        {!loading && stats && Object.keys(stats).length === 0 && (
          <p className="text-xs text-(--color-text-muted)">No stats returned yet.</p>
        )}
      </Card>

      {err && <ErrorBox msg={err} />}
    </div>
  );
}

// ── Layer header colours ──────────────────────────────────────────────────────

const LAYER_META: Record<string, { label: string; color: string; desc: string }> = {
  l2: { label: 'L2 — Bridge · DAO · Swap', color: 'text-(--color-zion-purple)', desc: 'Smart-contract bridge, on-chain governance, and HTLC atomic swaps.' },
  l3: { label: 'L3 — Warp Cross-Chain',    color: 'text-(--color-zion-cyan)',   desc: 'Cross-chain relay daemon for routing messages between ZION and external chains.' },
  l4: { label: 'L4 — Oasis',               color: 'text-(--color-zion-gold)',   desc: 'Oasis privacy and compute layer.' },
  l5: { label: 'L5 — Space',               color: 'text-(--color-zion-green)',  desc: 'Space distributed storage and networking layer.' },
  l6: { label: 'L6 — Freeworld',           color: 'text-(--color-zion-gold)',   desc: 'Freeworld decentralised application layer.' },
};

// ── Main export ───────────────────────────────────────────────────────────────

interface Props { layer: TabId }

export default function LayersTab({ layer }: Props) {
  const meta = LAYER_META[layer] ?? { label: String(layer).toUpperCase(), color: 'text-(--color-text)', desc: '' };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className={`text-lg font-bold ${meta.color}`}>{meta.label}</h2>
        <p className="text-xs text-(--color-text-muted) mt-1">{meta.desc}</p>
      </div>

      {layer === 'l2' && <L2Tab />}
      {layer === 'l3' && <L3Tab />}
      {layer === 'l4' && (
        <StatsLayer
          title="L4 Oasis Stats"
          description="Raw runtime statistics from the Oasis service."
          fetch={api.oasisStats}
          accent="gold"
        />
      )}
      {layer === 'l5' && (
        <StatsLayer
          title="L5 Space Stats"
          description="Raw runtime statistics from the Space distributed storage service."
          fetch={api.spaceStats}
          accent="green"
        />
      )}
      {layer === 'l6' && (
        <StatsLayer
          title="L6 Freeworld Stats"
          description="Raw runtime statistics from the Freeworld application layer."
          fetch={api.freeworldStats}
          accent="purple"
        />
      )}
    </div>
  );
}
