// ─── ZION Dashboard v2 — Layers Tab (L2–L6) ─────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useStatusStore } from '../../stores/statusStore';
import { Card } from '../ui/Card';
import { HealthBadge } from '../ui/Badge';
import api from '../../api/client';
import type { TabId } from '../layout/Sidebar';

type LayerId = 'l2' | 'l3' | 'l4' | 'l5' | 'l6';

const LAYER_CONFIG: Record<LayerId, {
  label: string;
  services: string[];
  fetchHealth: () => Promise<{ healthy: boolean }>;
  fetchStats?: () => Promise<Record<string, unknown>>;
}> = {
  l2: {
    label: 'L2 — Bridge & DAO & Swap',
    services: ['bridge', 'dao', 'atomic-swap'],
    fetchHealth: api.bridgeHealth,
  },
  l3: {
    label: 'L3 — Warp Cross-Chain',
    services: ['warp'],
    fetchHealth: api.warpHealth,
  },
  l4: {
    label: 'L4 — Oasis',
    services: ['oasis'],
    fetchHealth: async () => ({ healthy: true }),
    fetchStats: api.oasisStats,
  },
  l5: {
    label: 'L5 — Space',
    services: ['space'],
    fetchHealth: async () => ({ healthy: true }),
    fetchStats: api.spaceStats,
  },
  l6: {
    label: 'L6 — Freeworld',
    services: ['freeworld'],
    fetchHealth: async () => ({ healthy: true }),
    fetchStats: api.freeworldStats,
  },
};

interface Props {
  layer: TabId;
}

export default function LayersTab({ layer }: Props) {
  const id = layer as LayerId;
  const config = LAYER_CONFIG[id];
  const health = useStatusStore(s => s.health);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (config.fetchStats) {
      config.fetchStats().then(setStats).catch(e => setErr(String(e)));
    }
  }, [id]);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-bold text-(--color-zion-gold)">{config.label}</h2>

      {/* Service health */}
      <Card title="Services" accent="purple">
        <div className="space-y-3">
          {config.services.map(svc => (
            <div key={svc} className="flex items-center justify-between">
              <span className="text-sm font-mono text-(--color-text)">{svc}</span>
              <HealthBadge status={(health as Record<string, string>)?.[svc] as 'healthy' | 'degraded' | 'down' | 'unknown' ?? 'unknown'} />
            </div>
          ))}
        </div>
      </Card>

      {/* Stats */}
      {stats && (
        <Card title="Stats" accent="cyan">
          <div className="space-y-2">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-(--color-border-dim) last:border-0">
                <span className="text-xs text-(--color-text-muted)">{k}</span>
                <span className="text-xs font-mono text-(--color-text)">{String(v)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {err && (
        <div className="text-xs text-(--color-zion-red) bg-red-950/30 border border-red-900 rounded p-3">
          {err}
        </div>
      )}

      {!stats && !err && (
        <div className="text-sm text-(--color-text-muted)">No stats available for this layer yet.</div>
      )}
    </div>
  );
}
