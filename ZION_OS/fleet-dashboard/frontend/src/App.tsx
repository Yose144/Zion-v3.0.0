import { useEffect, useState, useCallback } from 'react';
import RigGrid from './components/RigGrid';
import CommandQueue from './components/CommandQueue';
import AlertFeed from './components/AlertFeed';
import { apiFetch } from './api/client';

const API_BASE = 'http://localhost:8080';

interface Rig {
  id: string;
  name: string;
  status: string;
  ip_address: string | null;
  gpu_count: number;
  total_hashrate: number;
  power_watts: number;
  last_seen: string;
}

interface Alert {
  id: string;
  rig_id: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

interface DashboardStats {
  rig_count: number;
  online_count: number;
  total_hashrate: number;
  total_power: number;
}

export default function App() {
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ rig_count: 0, online_count: 0, total_hashrate: 0, total_power: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [rigsData, alertsData, statusData] = await Promise.all([
        apiFetch<Rig[]>(`${API_BASE}/api/rigs`),
        apiFetch<Alert[]>(`${API_BASE}/api/alerts`),
        apiFetch<{ rig_count: number; online_count: number }>(`${API_BASE}/api/status`),
      ]);

      if (rigsData) {
        setRigs(rigsData);
        const online = rigsData.filter(r => r.status === 'online' || r.status === 'mining');
        const hash = rigsData.reduce((s, r) => s + r.total_hashrate, 0);
        const power = rigsData.reduce((s, r) => s + r.power_watts, 0);
        setStats({
          rig_count: rigsData.length,
          online_count: online.length,
          total_hashrate: hash,
          total_power: power,
        });
      }
      if (alertsData) setAlerts(alertsData.filter(a => !a.acknowledged));
      if (statusData) setError(null);
    } catch (e) {
      setError('Fleet API nedostupne — zkontroluj backend (cargo run v fleet-dashboard/backend)');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#64c8ff', fontSize: '28px', marginBottom: '8px' }}>ZION Fleet Dashboard</h1>
        <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#888' }}>
          <span>Rigu: <strong style={{ color: '#fff' }}>{stats.rig_count}</strong></span>
          <span>Online: <strong style={{ color: '#4ade80' }}>{stats.online_count}</strong></span>
          <span>Hashrate: <strong style={{ color: '#64c8ff' }}>{(stats.total_hashrate / 1000).toFixed(2)} KH/s</strong></span>
          <span>Power: <strong style={{ color: '#fbbf24' }}>{(stats.total_power / 1000).toFixed(1)} kW</strong></span>
        </div>
        {error && (
          <div style={{ marginTop: '12px', padding: '8px 12px', background: '#451a03', color: '#fbbf24', borderRadius: '6px', fontSize: '13px' }}>
            {error}
          </div>
        )}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div>
          <RigGrid rigs={rigs} loading={loading} onCommand={(rigId, cmd) => {
            fetch(`${API_BASE}/api/commands`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rig_id: rigId, command_type: cmd }),
            }).then(refresh);
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <CommandQueue apiBase={API_BASE} />
          <AlertFeed alerts={alerts} apiBase={API_BASE} onAck={refresh} />
        </div>
      </div>
    </div>
  );
}
