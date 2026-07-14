import { Bitcoin, Droplets, Coins, ArrowLeftRight, CheckCircle2, Clock, ExternalLink, Zap } from 'lucide-react';
import { EDGE_WEB } from '../lib/api';

interface Corridor {
  from: string;
  to: string;
  icon: typeof Bitcoin;
  color: string;
  bg: string;
  border: string;
  status: 'live' | 'planned' | 'research';
  desc: string;
}

const CORRIDORS: Corridor[] = [
  {
    from: 'ETH', to: 'wZION', icon: Droplets,
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20',
    status: 'live',
    desc: 'Uniswap V3 · Base · wZION/WETH + wZION/USDC',
  },
  {
    from: 'ZION', to: 'wZION', icon: ArrowLeftRight,
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    status: 'live',
    desc: 'L1 ↔ L2 bridge · 5/5 validators · 1:1 peg',
  },
  {
    from: 'BTC', to: 'wZION', icon: Bitcoin,
    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20',
    status: 'planned',
    desc: 'HTLC · SegWit + Taproot · 2-of-3 multi-sig',
  },
  {
    from: 'SOL', to: 'wZION', icon: Coins,
    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20',
    status: 'research',
    desc: 'SPL program · PDA-secured · Tower BFT',
  },
];

const STATUS_STYLE = {
  live:     { label: 'Live',     color: 'text-emerald-400', icon: CheckCircle2 },
  planned:  { label: 'Planned',  color: 'text-cyan-400',    icon: Clock },
  research: { label: 'Research', color: 'text-amber-400',   icon: Clock },
};

export default function WarpPanel() {
  const liveCount = CORRIDORS.filter(c => c.status === 'live').length;
  const plannedCount = CORRIDORS.filter(c => c.status === 'planned').length;

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">WARP Corridors</h3>
        </div>
        <span className="text-[9px] text-gray-500">
          {liveCount} live · {plannedCount} planned
        </span>
      </div>

      <div className="space-y-2">
        {CORRIDORS.map((c) => {
          const Icon = c.icon;
          const s = STATUS_STYLE[c.status];
          const SIcon = s.icon;
          return (
            <div key={`${c.from}-${c.to}`} className={`flex items-center gap-3 p-2 rounded-lg border ${c.border} ${c.bg}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.border} border`}>
                <Icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">{c.from}</span>
                  <span className="text-gray-600 text-[10px]">→</span>
                  <span className="text-xs font-bold text-white">{c.to}</span>
                </div>
                <p className="text-[9px] text-gray-500 truncate">{c.desc}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-[8px] font-semibold ${s.color} shrink-0`}>
                <SIcon className="h-2.5 w-2.5" />
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] text-gray-500">Cross-chain · BTC · ETH · SOL · ZION</span>
        <a
          href={`${EDGE_WEB}/warp`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[9px] text-purple-400 hover:text-white"
        >
          Open <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}
