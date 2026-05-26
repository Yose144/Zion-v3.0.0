// ─── ZION Dashboard v2 — Charts Tab (v2.9 aesthetic) ────────────────────────
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Cpu, Layers, Users } from 'lucide-react';
import { useStatusStore } from '../../stores/statusStore';
import { usePolling } from '../../hooks/usePolling';
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
  const history      = useStatusStore(s => s.history);
  const fetchHistory = useStatusStore(s => s.fetchHistory);

  useEffect(() => { fetchHistory(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(fetchHistory, 2);

  const chartData = history.map(p => ({
    ...p,
    time:       fmtTime(p.ts),
    hashrate_k: +(p.hashrate / 1000).toFixed(2),
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Hashrate area chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-gold/10 flex items-center justify-center">
            <TrendingUp size={15} className="text-zion-gold" />
          </div>
          <span className="text-sm font-semibold text-gray-200">Hashrate · KH/s</span>
        </div>
        <div className="px-6 py-4">
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
        </div>
      </motion.div>

      {/* ── CPU + RAM line chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-zion-cyan/10 flex items-center justify-center">
            <Cpu size={15} className="text-zion-cyan" />
          </div>
          <span className="text-sm font-semibold text-gray-200">CPU &amp; RAM · %</span>
        </div>
        <div className="px-6 py-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="time" tick={TICK} interval="preserveStartEnd" />
              <YAxis tick={TICK} domain={[0, 100]} width={35} />
              <Tooltip
                contentStyle={TIP}
                formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : v}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgb(100,116,139)' }} />
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
        </div>
      </motion.div>

      {/* ── Block height + Peers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-zion-purple/10 flex items-center justify-center">
              <Layers size={15} className="text-zion-purple" />
            </div>
            <span className="text-sm font-semibold text-gray-200">Block Height</span>
          </div>
          <div className="px-6 py-4">
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
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
            <div className="h-9 w-9 rounded-xl bg-green-400/10 flex items-center justify-center">
              <Users size={15} className="text-green-400" />
            </div>
            <span className="text-sm font-semibold text-gray-200">Peers</span>
          </div>
          <div className="px-6 py-4">
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
          </div>
        </motion.div>

      </div>

    </div>
  );
}
