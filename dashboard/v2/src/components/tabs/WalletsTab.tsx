// ─── ZION Dashboard v2 — Wallets Tab ────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';
import type { WalletEntry } from '../../types/api';

const TYPE_VARIANT = { premine: 'gold', operational: 'cyan', fee: 'purple' } as const;

export default function WalletsTab() {
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setWallets(await api.wallets()); } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const copy = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="p-6 space-y-6">
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
    </div>
  );
}
