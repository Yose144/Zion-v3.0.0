import { useEffect, useState, useCallback } from 'react';
import { HardDrive, Clock } from 'lucide-react';
import { fetchBackupStatus, type BackupStatus } from '../lib/api';

function formatAge(seconds?: number): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function BackupPanel() {
  const [data, setData] = useState<BackupStatus | null>(null);

  const refresh = useCallback(async () => {
    const s = await fetchBackupStatus();
    if (s) setData(s);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const backups = data?.backups ?? [];
  const last = data?.last_backup;
  const lastAge = backups[0]?.age_seconds;

  return (
    <section className="zion-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-zion-gold" />
          <h2 className="text-sm font-bold">Backups</h2>
        </div>
        <span className={`zion-badge ${data?.ok ? 'zion-badge-green' : 'zion-badge-red'}`}>
          {data?.ok ? 'OK' : 'ERROR'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-xl font-bold text-white">{backups.length}</div>
          <div className="text-[9px] text-gray-400">Backups</div>
        </div>
        <div className="zion-panel-soft p-3 text-center">
          <div className="text-sm font-bold text-zion-cyan font-mono">{formatAge(lastAge)}</div>
          <div className="text-[9px] text-gray-400">Last Backup</div>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto space-y-1.5">
        {backups.slice(0, 10).map((b) => (
          <div key={b.name} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 text-xs">
            <span className="font-mono text-gray-300 truncate max-w-[60%]" title={b.name}>{b.name}</span>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <Clock size={10} />
              {formatAge(b.age_seconds)}
              <span className="text-zion-gold font-mono">{(b.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          </div>
        ))}
        {data?.error && <div className="text-[10px] text-red-400">{data.error}</div>}
      </div>
    </section>
  );
}
