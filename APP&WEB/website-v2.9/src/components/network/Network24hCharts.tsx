'use client';

import { useMemo } from 'react';
import { TrendingUp, Activity, Gauge, Timer } from 'lucide-react';

function fmtSI(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}G`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function AreaChartSVG({ values, color, height = 180 }: { values: number[]; color: string; height?: number }) {
  if (!values.length) return (
    <div className="flex items-center justify-center h-full text-xs text-gray-500">collecting…</div>
  );
  const W = 480;
  const H = height;
  const PAD = { top: 10, right: 10, bottom: 24, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: PAD.left + (i / Math.max(values.length - 1, 1)) * cw,
    y: PAD.top + ch - ((v - min) / range) * ch,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${PAD.top + ch} L ${pts[0].x} ${PAD.top + ch} Z`;
  const yTicks = [0, 0.5, 1].map((pct) => min + pct * range);
  const gradId = `ac-${color.replace(/[^a-z0-9]/gi, '')}`;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    x: PAD.left + pct * cw,
    label: pct === 0 ? '24h' : pct === 1 ? 'now' : `${Math.round((1 - pct) * 24)}h`,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* X grid + labels */}
      {xTicks.map((t, i) => (
        <g key={`x-${i}`}>
          <line x1={t.x} x2={t.x} y1={PAD.top} y2={PAD.top + ch} stroke="rgba(255,255,255,0.03)" strokeDasharray="2" />
          <text x={t.x} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{t.label}</text>
        </g>
      ))}
      {/* Y grid + labels */}
      {yTicks.map((v, i) => {
        const y = PAD.top + ch - ((v - min) / range) * ch;
        return (
          <g key={`y-${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">{fmtSI(v)}</text>
          </g>
        );
      })}
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

interface ChartData {
  label: string;
  labelCs: string;
  data: number[];
  color: string;
  icon: React.ReactNode;
  unit?: string;
  tip: string;
  tipCs: string;
}

export default function Network24hCharts({
  cs,
  hashrateData,
  difficultyData,
  blockTimeData,
}: {
  cs: boolean;
  hashrateData: number[];
  difficultyData: number[];
  blockTimeData: number[];
}) {
  const charts: ChartData[] = useMemo(
    () => [
      {
        label: 'Hashrate',
        labelCs: 'Hashrate',
        data: hashrateData,
        color: '#10b981',
        icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
        unit: 'H/s',
        tip: 'Network hashrate over the last 24 hours — total computational power securing the chain.',
        tipCs: 'Síťový hashrate za posledních 24 hodin — celkový výpočetní výkon zabezpečující řetězec.',
      },
      {
        label: 'Difficulty',
        labelCs: 'Obtížnost',
        data: difficultyData,
        color: '#3b82f6',
        icon: <Gauge className="h-4 w-4 text-blue-400" />,
        tip: 'Mining difficulty adjusted by LWMA DAA every block to maintain 60-second target.',
        tipCs: 'Těžební obtížnost upravovaná LWMA DAA každý blok pro udržení 60s cíle.',
      },
      {
        label: 'Block Time',
        labelCs: 'Čas bloku',
        data: blockTimeData,
        color: '#a855f7',
        icon: <Timer className="h-4 w-4 text-purple-400" />,
        unit: 's',
        tip: 'Average time between consecutive blocks. Target is 60 seconds.',
        tipCs: 'Průměrný čas mezi po sobě jdoucími bloky. Cíl je 60 sekund.',
      },
    ],
    [hashrateData, difficultyData, blockTimeData]
  );

  return (
    <section className="zion-rainbow-card p-8" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Historie' : 'History'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Activity className="h-7 w-7 text-emerald-400" />
          {cs ? '24hodinové trendy' : '24-Hour Trends'}
        </h2>
        <p className="text-sm text-gray-400">
          {cs
            ? 'Celodenní historie hashrate, obtížnosti a času mezi bloky s mřížkou a popisky os.'
            : 'Full-day history of hashrate, difficulty, and inter-block time with grid and axis labels.'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {charts.map((chart) => (
          <div key={chart.label} className="zion-rainbow-sub p-5 flex flex-col" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-1">
              {chart.icon}
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{cs ? chart.labelCs : chart.label}</span>
            </div>
            <div className="text-xs text-gray-500 mb-3">{cs ? chart.tipCs : chart.tip}</div>
            <div className="flex-1 min-h-[140px]">
              <AreaChartSVG values={chart.data} color={chart.color} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
