interface Alert {
  id: string;
  rig_id: string;
  severity: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  warning: '#fbbf24',
  info: '#64c8ff',
};

export default function AlertFeed({
  alerts, apiBase, onAck,
}: {
  alerts: Alert[];
  apiBase: string;
  onAck: () => void;
}) {
  const ack = async (id: string) => {
    await fetch(`${apiBase}/api/alerts/${id}/ack`, { method: 'POST' });
    onAck();
  };

  return (
    <div style={{ background: '#141428', border: '1px solid rgba(100,200,255,0.15)', borderRadius: '10px', padding: '16px' }}>
      <h3 style={{ color: '#64c8ff', fontSize: '14px', marginBottom: '10px' }}>Alerts</h3>
      {alerts.length === 0 ? (
        <div style={{ color: '#666', fontSize: '12px' }}>No active alerts</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map(a => (
            <div key={a.id} style={{ fontSize: '12px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: SEVERITY_COLOR[a.severity] || '#888', fontWeight: 600 }}>{a.severity.toUpperCase()}</span>
                <button
                  onClick={() => ack(a.id)}
                  style={{
                    fontSize: '10px', padding: '2px 8px',
                    background: 'rgba(100,200,255,0.1)',
                    border: '1px solid rgba(100,200,255,0.3)',
                    borderRadius: '4px',
                    color: '#64c8ff',
                    cursor: 'pointer',
                  }}
                >ACK</button>
              </div>
              <div style={{ color: '#aaa', marginTop: '4px' }}>{a.message}</div>
              <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>Rig: {a.rig_id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
