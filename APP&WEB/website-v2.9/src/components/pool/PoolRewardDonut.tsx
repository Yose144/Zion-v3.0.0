'use client';

import { Pickaxe, Heart, Building2, Droplets } from 'lucide-react';

interface RewardSlice {
  label: string;
  labelCs: string;
  pct: number;
  color: string;
  icon: React.ReactNode;
}

export default function PoolRewardDonut({ cs, minerShare, humanitarianTithe, issobellaFund, poolFee }: {
  cs: boolean;
  minerShare: number;
  humanitarianTithe: number;
  issobellaFund: number;
  poolFee: number;
}) {
  const slices: RewardSlice[] = [
    {
      label: 'Miner',
      labelCs: 'Miner',
      pct: minerShare,
      color: '#10b981',
      icon: <Pickaxe className="h-4 w-4" />,
    },
    {
      label: 'Humanitarian',
      labelCs: 'Humanitární',
      pct: humanitarianTithe,
      color: '#f43f5e',
      icon: <Heart className="h-4 w-4" />,
    },
    {
      label: 'Issobella Fund',
      labelCs: 'Issobella fond',
      pct: issobellaFund,
      color: '#8b5cf6',
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      label: 'Pool Fee',
      labelCs: 'Pool poplatek',
      pct: poolFee,
      color: '#d4af37',
      icon: <Droplets className="h-4 w-4" />,
    },
  ];

  const total = slices.reduce((s, it) => s + it.pct, 0);
  let cumulative = 0;
  const arcs = slices.map((slice) => {
    const start = cumulative;
    cumulative += slice.pct;
    return { ...slice, start, end: cumulative };
  });

  function polar(cx: number, cy: number, r: number, angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polar(cx, cy, r, endAngle);
    const end = polar(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  }

  const R = 50;
  const CX = 60;
  const CY = 60;

  return (
    <section className="rounded-4xl border border-white/10 bg-black/40 p-8">
      <div className="flex flex-col gap-2 mb-6">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Ekonomika' : 'Economics'}</p>
        <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Heart className="h-7 w-7 text-zion-gold" />
          {cs ? 'Rozdělení odměny za blok' : 'Block Reward Distribution'}
        </h2>
        <p className="text-sm text-gray-400">
          {cs
            ? `Každý vytěžený blok rozděluje odměnu ${minerShare}% minerovi, ${humanitarianTithe}% humanitárnímu fondu, ${issobellaFund}% Issobella fondu a ${poolFee}% provoznímu poplatku poolu.`
            : `Every mined block distributes ${minerShare}% to the miner, ${humanitarianTithe}% to the humanitarian fund, ${issobellaFund}% to the Issobella fund, and ${poolFee}% as the pool operational fee.`}
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative shrink-0">
          <svg viewBox="0 0 120 120" className="w-48 h-48">
            {arcs.map((arc) => (
              <path
                key={arc.label}
                d={describeArc(CX, CY, R, (arc.start / total) * 360, (arc.end / total) * 360)}
                fill={arc.color}
                opacity={0.9}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="1"
              />
            ))}
            <circle cx={CX} cy={CY} r={28} fill="#0a0a0a" />
            <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="monospace">
              100%
            </text>
            <text x={CX} y={CY + 8} textAnchor="middle" fill="#9ca3af" fontSize="6" fontFamily="monospace">
              {cs ? 'ROZDĚLENÍ' : 'SPLIT'}
            </text>
          </svg>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3 w-full">
          {slices.map((slice) => (
            <div key={slice.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: slice.color + '25', border: `1px solid ${slice.color}40` }}
              >
                {slice.icon}
              </div>
              <div>
                <p className="text-sm text-white font-semibold">{slice.pct}%</p>
                <p className="text-xs text-gray-400">{cs ? slice.labelCs : slice.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
