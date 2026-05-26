// ─── ZION Dashboard v2 — Charts Tab (v2.9 aesthetic) ────────────────────────
import React, { useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useStatusStore } from '../../stores/statusStore';
import { usePolling } from '../../hooks/usePolling';
import { Card } from '../ui/Card';
import { format } from 'date-fns';

function fmtTime(ts: number) { return format(new Date(ts), 'HH:mm:ss'); }

// Shared chart theme — matches v2.9 glass aesthetic
const TICK  = { fontSize: 10, fill: 'rgba(100,116,139,0.9)', fontFamily: 'monospace' };
const GRID  = 'rgba(255,255,255,0.05)';
const TIP   = {
  backgroundColor: 'rgba(7,10,20,0.92)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  backdropFilter: 'blur(20px)',
  fontSize: 11,
  color: '#CBD5E1',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

export default function ChartsTab() {
  const history     = useStatusStore(s => s.history);
  const fetchHistory = useStatusStore(s => s.fetchHistory);

  useEffect(() => { fetchHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(fetchHistory, 2);

  const chartData = history.map(p => ({
    ...p,
    time:       fmtTime(p.ts),
    hashrate_k: +(p.hashrate / 1000).toFixed(2),
  }));

  return (
    <div className="p-6 space-y-6">

      {/* ── Hashrate area chart ── */}
      <Card title="Hashrate · KH/s" accent="gold">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="rgb(255,215,0)" stopOpacity={0.35} />
                <stop offset="85%" stopColor="rgb(255,215,0)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time" tick={TICK} interval="preserveStartEnd" />
            <YAxis tick={TICK} width={42} />
            <Tooltip contentStyle={TIP} />
            <Area
              type="monotone"
              dataKey="hashrate_k"
              name="Hashrate (KH/s)"
              stroke="rgb(255,215,0)"
              fill="url(#hashGrad)"
              strokeWidth={2.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* ── CPU + RAM line chart ── */}
      <Card title="CPU & RAM · %" accent="cyan">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="time" tick={TICK} interval="preserveStartEnd" />
            <YAxis tick={TICK} domain={[0, 100]} width={35} />
            <Tooltip
              contentStyle={TIP}
              formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'rgb(100,116,139)' }}
            />
            <Line
              type="monotone"
              dataKey="cpu"
              name="CPU"
              stroke="rgb(6,182,212)"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="ram"
              name="RAM"
              stroke="rgb(147,51,234)"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Block height + Peers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card title="Block Height" accent="purple">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="rgb(147,51,234)" stopOpacity={0.35} />
                  <stop offset="85%" stopColor="rgb(147,51,234)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="time" tick={TICK} interval="preserveStartEnd" />
              <YAxis
                tick={TICK}
                width={55}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                contentStyle={TIP}
                formatter={(v) => typeof v === 'number' ? v.toLocaleString() : v}
              />
              <Area
                type="monotone"
                dataKey="block_height"
                name="Height"
                stroke="rgb(147,51,234)"
                fill="url(#blockGrad)"
                strokeWidth={2.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Peers" accent="green">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="peersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="rgb(34,197,94)" stopOpacity={0.3} />
                  <stop offset="85%" stopColor="rgb(34,197,94)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="time" tick={TICK} interval="preserveStartEnd" />
              <YAxis tick={TICK} width={28} allowDecimals={false} />
              <Tooltip contentStyle={TIP} />
              <Line
                type="monotone"
                dataKey="peers"
                name="Peers"
                stroke="rgb(34,197,94)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

      </div>

    </div>
  );
}
