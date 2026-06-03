// ─── ZION Dashboard v2 — Topology Tab ───────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { HealthBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';
import type { TopologyResponse } from '../../types/api';

export default function TopologyTab() {
  const [topo, setTopo]   = useState<TopologyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setTopo(await api.topology()); } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">Network Topology</h2>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      {/* ASCII-style topology */}
      <Card title="Live Network" accent="cyan">
        <pre className="font-mono text-xs text-(--color-text-dim) whitespace-pre overflow-auto leading-6">
{`Core (Windows 11)              Edge (Hetzner VPS)
100.86.102.5                   100.76.16.108
     │ Tailscale VPN                 │
     ├─ Node (P2P:8333)             ├─ Node relay (P2P:8333)
     ├─ Pool (master)               ├─ Pool (public:8444)
     ├─ Miner (GPU)                 │
     │                             │
     └──── Hiranyagarbha (8001)    │
           └── Hiran (8002)        │
                                   │
          External miners ─────────┘
          Website (zionterranova.com)`}
        </pre>
      </Card>

      {topo && (
        <>
          <Card title="Nodes" accent="purple">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topo.nodes.map(n => (
                <div key={n.id} className="flex items-center justify-between p-3 bg-(--color-bg-base) rounded border border-(--color-border-dim)">
                  <div>
                    <p className="text-sm font-mono font-semibold text-(--color-text)">{n.label}</p>
                    <p className="text-xs text-(--color-text-muted)">{n.host}:{n.port}</p>
                  </div>
                  <HealthBadge status={n.status} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Edges" accent="gold">
            <div className="space-y-1.5">
              {topo.edges.map((e, i) => (
                <div key={i} className="text-xs font-mono text-(--color-text-dim) flex items-center gap-2">
                  <span className="text-(--color-zion-cyan)">{e.source}</span>
                  <span className="text-(--color-text-muted)">──{e.label ?? ''}──▶</span>
                  <span className="text-(--color-zion-gold)">{e.target}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
