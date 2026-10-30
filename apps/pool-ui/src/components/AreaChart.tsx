'use client';

// AreaChart — lightweight SVG area/line chart with axes (no chart lib).
// Used for client-accumulated time series: the public API has no
// historical endpoint yet, so the UI samples live stats while the tab is
// open (and persists the series to localStorage).

export interface SeriesPoint {
  t: number; // unix seconds
  v: number;
}

export default function AreaChart({
  data,
  color = '#fcd116',
  height = 140,
  fmt = (v: number) => v.toFixed(1),
  emptyLabel = '—',
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  fmt?: (v: number) => string;
  emptyLabel?: string;
}) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-white/30"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padL = 44;
  const padR = 8;
  const padT = 8;
  const padB = 18;

  const tMin = data[0].t;
  const tMax = data[data.length - 1].t;
  const vMax = Math.max(...data.map((d) => d.v));
  const vMin = Math.min(0, ...data.map((d) => d.v));
  const tSpan = Math.max(1, tMax - tMin);
  const vSpan = Math.max(1e-9, vMax - vMin);

  const x = (t: number) => padL + ((t - tMin) / tSpan) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - vMin) / vSpan) * (H - padT - padB);

  const pts = data.map((d) => `${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`);
  const linePath = `M${pts.join(' L')}`;
  const areaPath = `${linePath} L${x(tMax).toFixed(1)},${y(vMin).toFixed(1)} L${x(tMin).toFixed(1)},${y(vMin).toFixed(1)} Z`;

  const gid = `ag-${color.replace('#', '')}`;
  const ticks = [vMax, vMin + vSpan / 2, vMin];
  const fmtTime = (t: number) =>
    new Date(t * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      role="img"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          <text
            x={padL - 5}
            y={y(v) + 3}
            textAnchor="end"
            fontSize="9"
            fill="rgba(255,255,255,0.35)"
          >
            {fmt(v)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill={`url(#${gid})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      <text x={padL} y={H - 4} fontSize="9" fill="rgba(255,255,255,0.3)">
        {fmtTime(tMin)}
      </text>
      <text
        x={W - padR}
        y={H - 4}
        fontSize="9"
        fill="rgba(255,255,255,0.3)"
        textAnchor="end"
      >
        {fmtTime(tMax)}
      </text>
    </svg>
  );
}

// ── Client-side history accumulator ────────────────────────────────────
// Public API exposes only point-in-time stats; the UI keeps a rolling
// series per key in localStorage (survives reloads, ~4 h at 15 s polls).

const MAX_SAMPLES = 960; // 4 h @ 15 s

export function pushSample(key: string, v: number): SeriesPoint[] {
  if (typeof window === 'undefined') return [];
  let series: SeriesPoint[] = [];
  try {
    series = JSON.parse(localStorage.getItem(key) ?? '[]') as SeriesPoint[];
  } catch {
    series = [];
  }
  const now = Math.floor(Date.now() / 1000);
  const last = series[series.length - 1];
  // dedupe same-second writes
  if (last && now - last.t < 5) return series;
  series.push({ t: now, v });
  if (series.length > MAX_SAMPLES) series = series.slice(-MAX_SAMPLES);
  try {
    localStorage.setItem(key, JSON.stringify(series));
  } catch {
    /* quota — keep in-memory only */
  }
  return series;
}

export function loadSeries(key: string): SeriesPoint[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as SeriesPoint[];
  } catch {
    return [];
  }
}

/** Evenly thin a series to ~max points (7d of 60s samples = 10k pts is
 *  too heavy for the SVG path — visual fidelity is identical at ~700). */
export function thinSeries(pts: SeriesPoint[], max = 700): SeriesPoint[] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out: SeriesPoint[] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[Math.floor(i)]);
  const last = pts[pts.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
