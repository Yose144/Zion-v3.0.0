import { useEffect, useState } from 'react';

interface Command {
  id: string;
  rig_id: string;
  command_type: string;
  status: string;
  created_at: string;
}

export default function CommandQueue({ apiBase }: { apiBase: string }) {
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${apiBase}/api/commands`);
        const data = await r.json();
        setCommands(data.slice(0, 10));
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [apiBase]);

  return (
    <div style={{ background: '#141428', border: '1px solid rgba(100,200,255,0.15)', borderRadius: '10px', padding: '16px' }}>
      <h3 style={{ color: '#64c8ff', fontSize: '14px', marginBottom: '10px' }}>Command Queue</h3>
      {commands.length === 0 ? (
        <div style={{ color: '#666', fontSize: '12px' }}>No recent commands</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {commands.map(cmd => (
            <div key={cmd.id} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{cmd.command_type}</span>
              <span style={{
                color: cmd.status === 'completed' ? '#4ade80' : cmd.status === 'failed' ? '#ef4444' : '#fbbf24',
              }}>{cmd.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
