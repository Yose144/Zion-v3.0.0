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

const STATUS_COLOR: Record<string, string> = {
  online: '#4ade80',
  mining: '#64c8ff',
  offline: '#6b7280',
  error: '#ef4444',
  maintenance: '#fbbf24',
};

export default function RigGrid({
  rigs, loading, onCommand,
}: {
  rigs: Rig[];
  loading: boolean;
  onCommand: (rigId: string, cmd: string) => void;
}) {
  if (loading && rigs.length === 0) return <div style={{ color: '#888' }}>Nacitam rigy...</div>;
  if (rigs.length === 0) return <div style={{ color: '#888' }}>Zadne rigy zaregistrovany. Rig se objevi po prvnim pripojeni.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {rigs.map(rig => (
        <div key={rig.id} style={{
          background: '#141428',
          border: '1px solid rgba(100,200,255,0.15)',
          borderRadius: '10px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600 }}>{rig.name}</span>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: STATUS_COLOR[rig.status] || '#6b7280',
              boxShadow: `0 0 6px ${STATUS_COLOR[rig.status] || '#6b7280'}`,
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.6 }}>
            <div>ID: <code>{rig.id}</code></div>
            <div>IP: {rig.ip_address || '—'}</div>
            <div>GPU: {rig.gpu_count}</div>
            <div>Hashrate: {(rig.total_hashrate / 1000).toFixed(2)} KH/s</div>
            <div>Power: {rig.power_watts.toFixed(0)} W</div>
            <div>Last seen: {new Date(rig.last_seen).toLocaleTimeString()}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            {['start_miner', 'stop_miner', 'reboot'].map(cmd => (
              <button
                key={cmd}
                onClick={() => onCommand(rig.id, cmd)}
                style={{
                  flex: 1, padding: '6px', fontSize: '11px',
                  background: 'rgba(100,200,255,0.1)',
                  border: '1px solid rgba(100,200,255,0.3)',
                  borderRadius: '4px',
                  color: '#64c8ff',
                  cursor: 'pointer',
                }}
              >
                {cmd.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
