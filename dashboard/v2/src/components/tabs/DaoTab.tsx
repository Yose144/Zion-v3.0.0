// ─── ZION Dashboard v2 — DAO Tab ────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import api from '../../api/client';
import type { DaoProposal } from '../../types/api';
import { formatDistanceToNow } from 'date-fns';

const STATUS_VARIANT = {
  active:  'cyan',
  passed:  'green',
  failed:  'red',
  pending: 'gold',
} as const;

export default function DaoTab() {
  const [proposals, setProposals] = useState<DaoProposal[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setProposals(await api.daoProposals()); } catch { /* no DAO yet */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">DAO Proposals</h2>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      {proposals.length === 0 ? (
        <Card accent="none">
          <p className="text-sm text-(--color-text-muted) text-center py-8">No proposals found. DAO daemon may not be running.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <Card key={p.id} accent="purple">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-(--color-text)">{p.title}</p>
                  <p className="text-xs text-(--color-text-muted) mt-0.5">
                    Deadline: {formatDistanceToNow(new Date(p.deadline_ts * 1000), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[p.status] ?? 'gray'}>{p.status}</Badge>
              </div>
              <div className="mt-3 flex gap-6 text-xs">
                <div>
                  <span className="text-(--color-text-muted)">Yes: </span>
                  <span className="font-mono text-(--color-zion-green)">{p.yes_votes.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-(--color-text-muted)">No: </span>
                  <span className="font-mono text-(--color-zion-red)">{p.no_votes.toLocaleString()}</span>
                </div>
              </div>
              {/* Vote bar */}
              <div className="mt-2 h-1.5 rounded-full bg-(--color-border) overflow-hidden">
                {p.yes_votes + p.no_votes > 0 && (
                  <div
                    className="h-full bg-(--color-zion-green) transition-all"
                    style={{ width: `${(p.yes_votes / (p.yes_votes + p.no_votes)) * 100}%` }}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
