// ─── ZION Dashboard v2 — Ops Tab ────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, Upload, ShieldCheck } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import api from '../../api/client';
import type { BackupInfo } from '../../types/api';
import { formatDistanceToNow } from 'date-fns';

export default function OpsTab() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [log, setLog]         = useState<string[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const appendLog = (msg: string) => setLog(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try {
      const r = await fn();
      appendLog(`${key}: ${JSON.stringify(r)}`);
      if (key.startsWith('backup')) loadBackups();
    } catch (e) {
      appendLog(`${key} ERROR: ${String(e)}`);
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  };

  const loadBackups = () =>
    api.backups().then(setBackups).catch(() => {});

  useEffect(() => { loadBackups(); }, []);

  return (
    <div className="p-6 space-y-6">

      {/* Backup controls */}
      <Card title="Backups" accent="gold" actions={
        <Button variant="ghost" size="sm" onClick={loadBackups}><RefreshCw size={12} /></Button>
      }>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button variant="primary" size="sm" loading={loading['backup-create']}
            onClick={() => run('backup-create', api.backupCreate)}>
            <Download size={12} /> Create Backup
          </Button>
          <Button variant="secondary" size="sm" loading={loading['backup-trigger']}
            onClick={() => run('backup-trigger', api.backupTrigger)}>
            Trigger Auto-Backup
          </Button>
        </div>

        {backups.length === 0 ? (
          <p className="text-xs text-(--color-text-muted)">No backups found.</p>
        ) : (
          <div className="space-y-2">
            {backups.map(b => (
              <div key={b.filename} className="flex items-center justify-between p-2 bg-(--color-bg-base) rounded border border-(--color-border-dim) text-xs gap-3 flex-wrap">
                <div>
                  <p className="font-mono text-(--color-text)">{b.filename}</p>
                  <p className="text-(--color-text-muted)">
                    {(b.size_bytes / 1024 / 1024).toFixed(1)} MB ·{' '}
                    {formatDistanceToNow(new Date(b.created_ts * 1000), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={b.verified ? 'green' : 'gray'}>{b.verified ? 'verified' : 'unverified'}</Badge>
                  <Button variant="ghost" size="sm" loading={loading[`verify-${b.filename}`]}
                    onClick={() => run(`verify-${b.filename}`, () => api.backupVerify(b.filename))}>
                    <ShieldCheck size={11} />
                  </Button>
                  <Button variant="danger" size="sm" loading={loading[`restore-${b.filename}`]}
                    onClick={() => run(`restore-${b.filename}`, () => api.backupRestore(b.filename))}>
                    <Upload size={11} /> Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Ops log */}
      <Card title="Operations Log" accent="purple" actions={
        <Button variant="ghost" size="sm" onClick={() => setLog([])}>Clear</Button>
      }>
        <div className="h-48 overflow-y-auto bg-(--color-bg-base) rounded p-3 font-mono text-xs space-y-0.5">
          {log.length === 0
            ? <span className="text-(--color-text-muted)">No operations yet</span>
            : log.map((l, i) => <div key={i} className="text-(--color-text-dim)">{l}</div>)
          }
        </div>
      </Card>

    </div>
  );
}
