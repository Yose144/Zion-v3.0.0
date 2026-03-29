"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api";

type ChartType = "difficulty" | "blocktime" | "hashrate" | "emission" | "blocksize" | "txcount";
type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "all";

interface ChartData {
  chart: ChartType;
  range: TimeRange;
  data_points: number;
  data: {
    labels: string[];
    values: number[];
  };
}

const CHART_CONFIG: Record<ChartType, { label: string; color: string; unit: string; formatFn?: (v: number) => string }> = {
  difficulty: { label: "Difficulty", color: "#ef4444", unit: "", formatFn: formatSI },
  hashrate: { label: "Hashrate", color: "#06b6d4", unit: "H/s", formatFn: formatHashrate },
  blocktime: { label: "Block Time", color: "#22c55e", unit: "s" },
  emission: { label: "Circulating Supply", color: "#eab308", unit: "ZION", formatFn: formatSI },
  blocksize: { label: "Block Size", color: "#a855f7", unit: "B", formatFn: formatBytes },
  txcount: { label: "TX / Block", color: "#14b8a6", unit: "tx" },
};

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1H" },
  { value: "6h", label: "6H" },
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
];

export default function ExplorerCharts() {
  const [activeChart, setActiveChart] = useState<ChartType>("hashrate");
  const [activeRange, setActiveRange] = useState<TimeRange>("24h");
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient<ChartData>(`/blockchain/charts?type=${activeChart}&range=${activeRange}`);
      setChartData(data);
    } catch { setChartData(null); }
    finally { setLoading(false); }
  }, [activeChart, activeRange]);

  useEffect(() => { fetchChart(); }, [fetchChart]);

  const config = CHART_CONFIG[activeChart];

  return (
    <div className="rounded-[28px] bg-black/60 backdrop-blur-2xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Network Charts</h2>
            <p className="text-[11px] text-white/30">{chartData?.data_points || 0} data points</p>
          </div>
        </div>
      </div>

      {/* Chart type pills */}
      <div className="flex flex-wrap gap-1.5 px-6 pb-3">
        {(Object.keys(CHART_CONFIG) as ChartType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveChart(type)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all ${
              activeChart === type
                ? "bg-white/[0.12] text-white border border-white/[0.12]"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
            }`}
          >
            {CHART_CONFIG[type].label}
          </button>
        ))}
      </div>

      {/* Time range pills */}
      <div className="flex gap-0.5 px-6 pb-5">
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => setActiveRange(range.value)}
            className={`px-3 py-1 text-[11px] rounded-md transition-all ${
              activeRange === range.value
                ? "bg-white/[0.10] text-white font-semibold"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="relative h-72 px-2">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
          </div>
        ) : chartData && chartData.data.values.length > 0 ? (
          <SVGChart
            values={chartData.data.values}
            labels={chartData.data.labels}
            color={config.color}
            formatFn={config.formatFn}
            unit={config.unit}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 gap-2">
            <TrendingUp className="h-8 w-8" />
            <p className="text-sm">No data available</p>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {chartData && chartData.data.values.length > 0 && (
        <div className="grid grid-cols-3 border-t border-white/[0.06]">
          {[
            { label: "Min", value: Math.min(...chartData.data.values), color: "text-cyan-400" },
            { label: "Avg", value: chartData.data.values.reduce((a, b) => a + b, 0) / chartData.data.values.length, color: "text-white" },
            { label: "Max", value: Math.max(...chartData.data.values), color: "text-zion-gold" },
          ].map((s, i) => (
            <div key={s.label} className={`text-center py-4 ${i < 2 ? "border-r border-white/[0.06]" : ""}`}>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">{s.label}</p>
              <p className={`text-sm font-semibold tabular-nums ${s.color}`}>
                {(config.formatFn || String)(s.value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SVG Chart Component ─────────────────────────────────────

function SVGChart({ values, labels, color, formatFn, unit }: {
  values: number[]; labels: string[]; color: string; formatFn?: (v: number) => string; unit: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const W = 800, H = 220;
  const PAD = { top: 12, right: 12, bottom: 24, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => ({
    x: PAD.left + (i / Math.max(values.length - 1, 1)) * chartW,
    y: PAD.top + chartH - ((v - min) / range) * chartH,
    value: v,
    label: labels[i],
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`;
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({ value: min + pct * range, y: PAD.top + chartH - pct * chartH }));
  const fmt = formatFn || ((v: number) => v.toFixed(1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {/* Grid */}
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yl.y} y2={yl.y} stroke="rgba(255,255,255,0.04)" strokeDasharray="4" />
          <text x={PAD.left - 6} y={yl.y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">{fmt(yl.value)}</text>
        </g>
      ))}

      {/* Area gradient */}
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chartGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" opacity="0.9" />

      {/* Hover areas */}
      {points.map((p, i) => (
        <g key={i}>
          <rect x={p.x - chartW / values.length / 2} y={PAD.top} width={chartW / values.length} height={chartH} fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} />
          {hoveredIndex === i && (
            <>
              <line x1={p.x} x2={p.x} y1={PAD.top} y2={PAD.top + chartH} stroke="rgba(255,255,255,0.1)" strokeDasharray="2" />
              <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
              <rect x={Math.min(p.x - 42, W - 92)} y={Math.max(p.y - 28, 2)} width="84" height="20" rx="6" fill="rgba(0,0,0,0.85)" stroke={color} strokeWidth="0.5" />
              <text x={Math.min(p.x, W - 50)} y={Math.max(p.y - 14, 14)} textAnchor="middle" fill="white" fontSize="7.5" fontWeight="600" fontFamily="monospace">
                {fmt(p.value)} {unit}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Formatters ──────────────────────────────────────────────

function formatSI(v: number): string {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "G";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

function formatHashrate(v: number): string {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + " TH/s";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + " GH/s";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + " MH/s";
  if (v >= 1e3) return (v / 1e3).toFixed(2) + " kH/s";
  return v.toFixed(0) + " H/s";
}

function formatBytes(v: number): string {
  if (v >= 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + " MB";
  if (v >= 1024) return (v / 1024).toFixed(1) + " KB";
  return v.toFixed(0) + " B";
}
