// ─── ZION Dashboard v2 — Wallets Tab (v2.9 glass) ───────────────────────────
import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, CheckCheck, Wallet, Hash } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';
import type { WalletEntry } from '../../types/api';

// ── Static canonical data (from AGENTS.md) ───────────────────────────────────

const FEE_SPLIT_ADDRESSES = [
  { label: 'Miner',        address: 'zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3', share: '89%', variant: 'gold'   as const },
  { label: 'Humanitarian', address: 'zion1m4v5z8z850u480c5c208z274e334369275n5y20',  share: '5%',  variant: 'cyan'   as const },
  { label: 'Issobella',    address: 'zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702',  share: '5%',  variant: 'cyan'   as const },
  { label: 'Pool Fee',     address: 'zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5', share: '1%',  variant: 'purple' as const },
] as const;

const GENESIS_HASH = '003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923';

const TYPE_VARIANT: Record<string, 'gold' | 'cyan' | 'purple'> = {
  premine:     'gold',
  operational: 'cyan',
  fee:         'purple',
};

// ── Copy helper ───────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1600);
    });
  };
  return { copied, copy };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WalletsTab() {
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { copied, copy } = useCopy();

  const load = async () => {
    setLoading(true);
    try { setWallets(await api.wallets()); } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Wallet size={15} style={{ color: 'rgb(255,215,0)' }} />
          <h2 className="text-sm font-bold text-gradient tracking-wide">Wallets</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          <RefreshCw size={12} />
        </Button>
      </div>

      {/* ── Dynamic wallets ── */}
      {wallets.length === 0 ? (
        <div
          className="flex items-center justify-center py-12 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-sm text-slate-500">No wallets data from backend.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map((w, i) => {
            const variant = TYPE_VARIANT[w.type] ?? 'gray';
            const glowColor = variant === 'gold' ? '255,215,0' : variant === 'cyan' ? '6,182,212' : '147,51,234';
            return (
              <div
                key={i}
                className="zion-panel zion-panel-hover p-5 flex items-start justify-between gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-bold text-slate-100">{w.label}</p>
                    <Badge variant={variant}>{w.type}</Badge>
                  </div>
                  <button
                    onClick={() => copy(w.address)}
                    className="group flex items-center gap-2 text-left"
                    title="Copy address"
                  >
                    <span className="font-mono text-xs text-slate-500 group-hover:text-slate-300 transition-colors truncate max-w-xs">
                      {w.address}
                    </span>
                    <span className="shrink-0 text-slate-600 group-hover:text-slate-300 transition-colors">
                      {copied === w.address
                        ? <CheckCheck size={11} style={{ color: 'rgb(52,211,153)' }} />
                        : <Copy size={11} />}
                    </span>
                    {copied === w.address && (
                      <span className="text-[10px]" style={{ color: 'rgb(52,211,153)' }}>Copied!</span>
                    )}
                  </button>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-600 uppercase tracking-wider font-medium mb-1">Balance</p>
                  <p
                    className="text-2xl font-bold font-mono"
                    style={{ color: `rgb(${glowColor})`, textShadow: `0 0 20px rgba(${glowColor},0.3)` }}
                  >
                    {w.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">ZION</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Fee Split Addresses ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-3">
          Fee Split Addresses
        </p>
        <Card accent="gold">
          <p className="text-xs text-slate-500 mb-4">
            Canonical on-chain fee distribution. Hardcoded in the ZION protocol.
          </p>
          <div className="space-y-0">
            {FEE_SPLIT_ADDRESSES.map((row, i) => (
              <div
                key={row.label}
                className="flex items-center gap-3 py-3 group"
                style={{ borderBottom: i < FEE_SPLIT_ADDRESSES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}
              >
                {/* Share pill */}
                <Badge variant={row.variant}>{row.share}</Badge>

                {/* Label */}
                <span className="text-sm text-slate-300 font-medium w-28 shrink-0">{row.label}</span>

                {/* Address */}
                <span className="flex-1 font-mono text-xs text-slate-500 truncate min-w-0">
                  {row.address}
                </span>

                {/* Copy button */}
                <button
                  onClick={() => copy(row.address)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-slate-200 hover:bg-white/5 transition-all"
                  title="Copy address"
                >
                  {copied === row.address
                    ? <CheckCheck size={12} style={{ color: 'rgb(52,211,153)' }} />
                    : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Genesis Hash ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-3">
          Genesis Hash
        </p>
        <div
          className="rounded-2xl p-4"
          style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Hash size={12} style={{ color: 'rgb(6,182,212)' }} />
            <p className="text-xs text-slate-500">
              Block #0 — verify against{' '}
              <code className="text-slate-400 font-mono">PREMINE_ADDRESSES_PUBLIC.txt</code>
              {' '}and{' '}
              <code className="text-slate-400 font-mono">V3/L1/core/src/genesis.rs</code>
            </p>
          </div>
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <span
              className="flex-1 font-mono text-sm break-all"
              style={{ color: 'rgb(34,211,238)' }}
            >
              {GENESIS_HASH}
            </span>
            <button
              onClick={() => copy(GENESIS_HASH)}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: copied === GENESIS_HASH ? 'rgba(52,211,153,0.1)' : 'rgba(6,182,212,0.1)',
                border: copied === GENESIS_HASH ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(6,182,212,0.25)',
                color: copied === GENESIS_HASH ? 'rgb(52,211,153)' : 'rgb(34,211,238)',
              }}
              title="Copy genesis hash"
            >
              {copied === GENESIS_HASH
                ? <><CheckCheck size={12} /><span>Copied</span></>
                : <><Copy size={12} /><span>Copy</span></>}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
