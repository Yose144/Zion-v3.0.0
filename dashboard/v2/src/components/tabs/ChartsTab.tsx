// ─── ZION Dashboard v2 — Charts Tab ─────────────────────────────────────────
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

export default function ChartsTab() {
  const history     = useStatusStore(s => s.history);
  const fetchHistory = useStatusStore(s => s.fetchHistory);

  useEffect(() => { fetchHistory(); }, []);
  usePolling(fetchHistory, 2);

  const chartData = history.map(p => ({
    ...p,
    time:      fmtTime(p.ts),
    hashrate_k: +(p.hashrate / 1000).toFixed(2),
  }));

  const TICK_STYLE = { fontSize: 10, fill: '#64748B' };
  const GRID_COLOR = '#252832';
  const TOOLTIP_STYLE = {
    backgroundColor: '#16181F',
    border: '1px solid #252832',
    borderRadius: 6,
    fontSize: 11,
  };

  return (
    <div className="p-6 space-y-6">

      {/* Hashrate */}
      <Card title="Hashrate (KH/s)" accent="gold">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="time" tick={TICK_STYLE} interval="preserveStartEnd" />
            <YAxis tick={TICK_STYLE} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="hashrate_k" stroke="#FFD700" fill="url(#hashGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* CPU + RAM */}
      <Card title="CPU & RAM (%)" accent="cyan">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="time" tick={TICK_STYLE} interval="preserveStartEnd" />
            <YAxis tick={TICK_STYLE} domain={[0, 100]} width={35} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="cpu" name="CPU" stroke="#06B6D4" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ram" name="RAM" stroke="#9333EA" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Block Height + Peers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Block Height" accent="purple">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="blockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333EA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="time" tick={TICK_STYLE} interval="preserveStartEnd" />
              <YAxis tick={TICK_STYLE} width={55} tickFormatter={(v: number) => v.toLocaleString()} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => typeof v === 'number' ? v.toLocaleString() : v} />
              <Area type="monotone" dataKey="block_height" stroke="#9333EA" fill="url(#blockGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Peers" accent="green">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="time" tick={TICK_STYLE} interval="preserveStartEnd" />
              <YAxis tick={TICK_STYLE} width={25} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="peers" stroke="#22C55E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

    </div>
  );
}
