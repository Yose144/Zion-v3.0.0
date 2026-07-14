import { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Cpu } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { PoolMinersDashboard } from '../lib/api';

const STORAGE_KEY = 'zion-dashboard-pool-hashrate';
const MAX_POINTS = 60; // 5 min @ 5s interval

interface HistoryPoint {
  time: string;
  hashrate: number;
  network_hashrate: number;
  ts: number;
}

function loadHistory(): HistoryPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Discard points older than 1h
    const cutoff = Date.now() - 3600_000;
    return arr.filter((p: HistoryPoint) => p.ts > cutoff);
  } catch { return []; }
}

function saveHistory(h: HistoryPoint[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch { /* ignore */ }
}

function formatHr(h: number): string {
  if (!h || h <= 0) return '—';
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} KH/s`;
  return `${h.toFixed(0)} H/s`;
}

export default function HashrateChart() {
  const [history, setHistory] = useState<HistoryPoint[]>(() => loadHistory());
  const [poolHr, setPoolHr] = useState(0);
  const [poolHr24h, setPoolHr24h] = useState(0);
  const [netHr, setNetHr] = useState(0);
  const [miners, setMiners] = useState(0);
  const [blocks, setBlocks] = useState(0);
  const [loading, setLoading] = useState(true);
  const histRef = useRef<HistoryPoint[]>(history);

  const refresh = useCallback(async () => {
    try {
      const d = await apiFetch<PoolMinersDashboard>('/api/pool/miners-dashboard', { timeout: 8000 });
      if (!d || !d.pool_info) return;
      const hr = d.pool_info.hashrate_live ?? 0;
      const nhr = d.pool_info.network_hashrate ?? 0;
      setPoolHr(hr);
      setPoolHr24h(d.pool_info.hashrate_24h ?? 0);
      setNetHr(nhr);
      setMiners(d.summary?.active_miners ?? 0);
      setBlocks(d.summary?.blocks_found ?? 0);

      const now = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const point: HistoryPoint = { time: now, hashrate: hr, network_hashrate: nhr, ts: Date.now() };
      const newHist = [...histRef.current, point].slice(-MAX_POINTS);
      histRef.current = newHist;
      setHistory(newHist);
      saveHistory(newHist);
    } catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  const showNetwork = netHr > 0 || history.some(h => h.network_hashrate > 0);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, [refresh]);

  const chartData = history.map(h => ({
    time: h.time,
    pool: h.hashrate,
    network: h.network_hashrate,
  }));

  return (
    <div className="zion-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pool Hashrate</h3>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-gray-500">
            <Cpu className="inline h-2.5 w-2.5 mr-1" />
            {miners} miners
          </span>
          <span className="text-gray-500">{blocks} blocks</span>
        </div>
      </div>

      {/* Current stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Pool HR</p>
          <p className="text-sm font-bold text-emerald-400 font-mono">{formatHr(poolHr)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Pool 24h</p>
          <p className="text-sm font-bold text-white font-mono">{formatHr(poolHr24h)}</p>
        </div>
        {showNetwork && (
          <div>
            <p className="text-gray-500 text-[9px] uppercase">Network</p>
            <p className="text-sm font-bold text-cyan-400 font-mono">{formatHr(netHr)}</p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: 140 }}>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="poolHrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netHrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={formatHr} width={70} />
              <Tooltip
                contentStyle={{ background: '#131a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(v: number) => formatHr(v)}
              />
              {showNetwork && <Area type="monotone" dataKey="network" stroke="#06b6d4" fill="url(#netHrGrad)" strokeWidth={1.5} dot={false} name="Network" />}
              <Area type="monotone" dataKey="pool" stroke="#10b981" fill="url(#poolHrGrad)" strokeWidth={2} dot={false} name="Pool" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-600">
            {loading ? 'Loading…' : 'Collecting data…'}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[9px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Pool</span>
        {showNetwork && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" />Network</span>}
        <span className="ml-auto">{chartData.length} pts · 5s interval</span>
      </div>
    </div>
  );
}
