// ─── ZION Dashboard v2 — Wallets Tab ────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, CheckCheck } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';
import type { WalletEntry } from '../../types/api';

// ── Static canonical data (from AGENTS.md) ───────────────────────────────────

const FEE_SPLIT_ADDRESSES = [
  { label: 'Miner',         address: 'zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3', share: '89%' },
  { label: 'Humanitarian',  address: 'zion1m4v5z8z850u480c5c208z274e334369275n5y20',  share: '5%'  },
  { label: 'Issobella',     address: 'zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702',  share: '5%'  },
  { label: 'Pool Fee',      address: 'zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5', share: '1%'  },
] as const;

const GENESIS_HASH = '003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923';

const TYPE_VARIANT = { premine: 'gold', operational: 'cyan', fee: 'purple' } as const;

// ── Copy helper ───────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return { copied, copy };
}

function CopyButton({ text, copied }: { text: string; copied: string | null }) {
  const isCopied = copied === text;
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
      className="p-1 rounded hover:bg-(--color-bg-hover) transition-colors text-(--color-text-muted) hover:text-(--color-zion-cyan)"
      title="Copy to clipboard"
    >
      {isCopied ? <CheckCheck size={12} className="text-(--color-zion-green)" /> : <Copy size={12} />}
    </button>
  );
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

      {/* ── Dynamic wallets ─────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">Wallets</h2>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      {wallets.length === 0 ? (
        <Card accent="none">
          <p className="text-sm text-(--color-text-muted) text-center py-8">No wallets data available.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {wallets.map((w, i) => (
            <Card key={i} accent={TYPE_VARIANT[w.type] ?? 'none'}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-(--color-text)">{w.label}</p>
                    <Badge variant={TYPE_VARIANT[w.type] ?? 'gray'}>{w.type}</Badge>
                  </div>
                  <button
                    onClick={() => copy(w.address)}
                    className="flex items-center gap-1.5 font-mono text-xs text-(--color-text-muted) hover:text-(--color-zion-cyan) transition-colors"
                    title="Copy address"
                  >
                    <span className="truncate max-w-xs">{w.address}</span>
                    <Copy size={10} className="shrink-0" />
                    {copied === w.address && <span className="text-(--color-zion-green) text-[10px]">Copied!</span>}
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-(--color-text-muted)">Balance</p>
                  <p className="text-lg font-mono font-bold text-(--color-zion-gold)">
                    {w.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </p>
                  <p className="text-[10px] text-(--color-text-muted)">ZION</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Fee Split Addresses (static, canonical) ─────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">Fee Split Addresses</h2>
        <Card accent="gold">
          <p className="text-xs text-(--color-text-muted) mb-3">
            Canonical on-chain fee distribution addresses. These are hardcoded in the ZION protocol.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-(--color-border)">
                  <th className="text-left py-2 pr-4 font-medium text-(--color-text-muted)">Recipient</th>
                  <th className="text-left py-2 pr-4 font-medium text-(--color-text-muted)">Address</th>
                  <th className="text-right py-2 font-medium text-(--color-text-muted)">Share</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {FEE_SPLIT_ADDRESSES.map(row => (
                  <tr
                    key={row.label}
                    className="border-b border-(--color-border-dim) last:border-0 hover:bg-(--color-bg-hover) transition-colors group"
                  >
                    <td className="py-2.5 pr-4 font-medium text-(--color-text)">{row.label}</td>
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-(--color-text-muted) break-all">{row.address}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge variant={row.share === '89%' ? 'gold' : row.share === '1%' ? 'purple' : 'cyan'}>
                        {row.share}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-center">
                      <button
                        onClick={() => copy(row.address)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-(--color-bg-hover) transition-all text-(--color-text-muted) hover:text-(--color-zion-cyan)"
                        title="Copy address"
                      >
                        {copied === row.address
                          ? <CheckCheck size={12} className="text-(--color-zion-green)" />
                          : <Copy size={12} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── Genesis Hash ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider mb-3">Genesis Hash</h2>
        <Card accent="cyan">
          <p className="text-xs text-(--color-text-muted) mb-3">
            Block #0 canonical hash. Verify against <span className="font-mono">PREMINE_ADDRESSES_PUBLIC.txt</span> and <span className="font-mono">V3/L1/core/src/genesis.rs</span>.
          </p>
          <div className="flex items-center gap-3 bg-(--color-bg-base) border border-(--color-border) rounded-lg px-4 py-3">
            <span className="flex-1 font-mono text-sm text-(--color-zion-cyan) break-all">{GENESIS_HASH}</span>
            <button
              onClick={() => copy(GENESIS_HASH)}
              className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded border border-(--color-border) text-xs text-(--color-text-muted) hover:text-(--color-zion-cyan) hover:border-(--color-zion-cyan)/40 transition-colors"
              title="Copy genesis hash"
            >
              {copied === GENESIS_HASH
                ? <><CheckCheck size={12} className="text-(--color-zion-green)" /><span className="text-(--color-zion-green)">Copied</span></>
                : <><Copy size={12} /><span>Copy</span></>
              }
            </button>
          </div>
        </Card>
      </div>

    </div>
  );
}
