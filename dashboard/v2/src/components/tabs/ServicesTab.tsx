// ─── ZION Dashboard v2 — Services Tab ───────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStatusStore } from '../../stores/statusStore';
import { Card } from '../ui/Card';
import { HealthBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';
import type { HealthStatus, ServiceName } from '../../types/api';

const ALL_SERVICES: ServiceName[] = [
  'node1', 'node2', 'pool', 'pool-edge', 'miner',
  'bridge', 'dao', 'swap', 'warp', 'oasis',
  'hiran', 'hiranyagarbha', 'freeworld', 'space',
];

const SERVICE_PORTS: Partial<Record<ServiceName, number | string>> = {
  node1:          8443,
  node2:          8443,
  pool:           8444,
  'pool-edge':    8444,
  hiran:          8002,
  hiranyagarbha:  8001,
};

function ServiceCard({ name, health }: { name: ServiceName; health: HealthStatus }) {
  const port = SERVICE_PORTS[name];
  return (
    <div className="flex items-center justify-between p-3 bg-(--color-bg-card) border border-(--color-border) rounded-lg hover:border-(--color-border)/80 transition-colors">
      <div>
        <p className="text-sm font-mono font-semibold text-(--color-text)">{name}</p>
        {port && <p className="text-xs text-(--color-text-muted)">:{port}</p>}
      </div>
      <HealthBadge status={health} />
    </div>
  );
}

// Simple ASCII-style dep graph
function DepGraph() {
  return (
    <div className="font-mono text-xs text-(--color-text-dim) space-y-1 p-2 bg-(--color-bg-base) rounded overflow-auto">
      <div className="text-(--color-zion-gold) font-bold mb-2">ZION Service Dependency Graph</div>
      <div>node1 ←──── pool ←──── miner</div>
      <div>node1 ←──── pool-edge ←──── (remote miners)</div>
      <div>node1 ←──── bridge (L2)</div>
      <div>node1 ←──── dao (L2)</div>
      <div>node1 ←──── swap (L2)</div>
      <div>node1 ←──── warp (L3)</div>
      <div>hiran → hiranyagarbha → node1</div>
      <div className="mt-2 text-(--color-text-muted)">node2 (edge) syncs from node1 via P2P</div>
    </div>
  );
}

export default function ServicesTab() {
  const health      = useStatusStore(s => s.health);
  const fetchHealth = useStatusStore(s => s.fetchHealth);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await fetchHealth();
    setLoading(false);
  };

  useEffect(() => { fetchHealth(); }, []);

  return (
    <div className="p-6 space-y-6">

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">Service Health</h2>
        <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {ALL_SERVICES.map(svc => (
          <ServiceCard key={svc} name={svc} health={health?.[svc] ?? 'unknown'} />
        ))}
      </div>

      {/* Health summary */}
      <div className="flex gap-4 text-sm">
        {(['healthy', 'degraded', 'down', 'unknown'] as HealthStatus[]).map(s => {
          const count = health ? Object.values(health).filter(h => h === s).length : 0;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s === 'healthy' ? 'dot-healthy' : s === 'degraded' ? 'dot-degraded' : s === 'down' ? 'dot-down' : 'dot-unknown'}`} />
              <span className="text-(--color-text-muted)">{count} {s}</span>
            </div>
          );
        })}
      </div>

      {/* Dep graph */}
      <Card title="Dependency Graph" accent="cyan">
        <DepGraph />
      </Card>

    </div>
  );
}
