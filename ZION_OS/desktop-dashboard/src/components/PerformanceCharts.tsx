import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { V3Status } from '../lib/api';

interface Props {
  miner: V3Status['miner'] | undefined;
}

// Rolling history kept in module scope (not ideal but works for demo)
const history: { time: string; hashrate: number; sharesOk: number; sharesRej: number }[] = [];

export default function PerformanceCharts({ miner }: Props) {
  const data = useMemo(() => {
    const hr = miner?.hashrate || 0;
    const ok = miner?.shares_accepted || 0;
    const rej = miner?.shares_rejected || 0;
    const now = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Compute delta since last point
    const last = history[history.length - 1];
    const deltaOk = last ? Math.max(0, ok - last.sharesOk) : 0;
    const deltaRej = last ? Math.max(0, rej - last.sharesRej) : 0;

    history.push({ time: now, hashrate: hr, sharesOk: deltaOk, sharesRej: deltaRej });
    if (history.length > 60) history.shift();

    return history.map(h => ({
      time: h.time,
      hashrate: h.hashrate,
      shares: h.sharesOk + h.sharesRej,
    }));
  }, [miner?.hashrate, miner?.shares_accepted, miner?.shares_rejected]);

  return (
    <section className="zion-card">
      <h2 className="text-sm font-bold mb-3">📈 Performance</h2>
      <div className="space-y-4">
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#131a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area type="monotone" dataKey="hashrate" stroke="#10b981" fill="url(#hrGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
