// ─── ZION Dashboard v2 — Database Tab ───────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../api/client';

export default function DatabaseTab() {
  const [db, setDb]           = useState<Record<string, unknown> | null>(null);
  const [inspect, setInspect] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, i] = await Promise.all([
        api.db().catch(() => null),
        api.dbInspect().catch(() => null),
      ]);
      setDb(d);
      setInspect(i);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const renderObj = (obj: Record<string, unknown>) => (
    <div className="space-y-1.5">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="flex gap-3 py-1.5 border-b border-(--color-border-dim) last:border-0">
          <span className="text-xs text-(--color-text-muted) w-40 shrink-0 truncate">{k}</span>
          <span className="text-xs font-mono text-(--color-text) flex-1 break-all">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">Database</h2>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      {db && <Card title="DB Summary" accent="purple">{renderObj(db)}</Card>}
      {inspect && <Card title="DB Inspect" accent="cyan">{renderObj(inspect)}</Card>}

      {!db && !inspect && !loading && (
        <Card accent="none">
          <p className="text-sm text-center py-8 text-(--color-text-muted)">No database data available.</p>
        </Card>
      )}
    </div>
  );
}
