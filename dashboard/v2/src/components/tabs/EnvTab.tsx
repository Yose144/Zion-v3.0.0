// ─── ZION Dashboard v2 — Env Files Tab ──────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import api from '../../api/client';
import type { EnvFile } from '../../types/api';

export default function EnvTab() {
  const [files, setFiles]   = useState<EnvFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const f = await api.env();
      setFiles(f);
      if (f.length > 0 && !selected) setSelected(f[0].path);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const current = files.find(f => f.path === selected);

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-wider">Environment Files</h2>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}><RefreshCw size={12} /></Button>
      </div>

      {files.length === 0 ? (
        <Card accent="none">
          <p className="text-sm text-center py-8 text-(--color-text-muted)">No env files loaded.</p>
        </Card>
      ) : (
        <div className="flex gap-4">
          {/* File list */}
          <div className="shrink-0 w-48 space-y-1">
            {files.map(f => (
              <button
                key={f.path}
                onClick={() => setSelected(f.path)}
                className={`w-full text-left text-xs font-mono px-3 py-2 rounded transition-colors truncate
                  ${selected === f.path
                    ? 'bg-zion-purple/20 text-zion-purple border border-zion-purple/40'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'
                  }`}
              >
                {f.path.split('/').pop() ?? f.path}
              </button>
            ))}
          </div>

          {/* File content */}
          {current && (
            <Card className="flex-1 min-w-0" accent="cyan" title={current.path}>
              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap overflow-auto max-h-96 bg-black/40 rounded p-3">
                {current.content}
              </pre>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
