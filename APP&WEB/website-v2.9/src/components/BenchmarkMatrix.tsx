'use client';

import { Cpu, Zap, DollarSign, BarChart3, ArrowRight, ExternalLink } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import Link from 'next/link';

/* ─── Data ─────────────────────────────────────────────────────────────────── */

interface GpuRow {
  gpu: string;
  arch: string;
  vram: string;
  bw: number;       // GB/s
  compute: string;
  khs: number;
  tpb: string;
  wc: string;
  price: string;    // $/hr
  khDollar: string; // KH/$
  highlight?: boolean;
}

const GPUS: GpuRow[] = [
  { gpu: 'GTX 1060 3GB',  arch: 'Pascal (SM 6.1)',   vram: '3 GB GDDR5',   bw: 192,  compute: '6.1',  khs: 5.9,  tpb: '48',      wc: '2560',   price: '$0.095', khDollar: '62' },
  { gpu: 'GTX 1080',      arch: 'Pascal (SM 6.1)',   vram: '8 GB GDDR5X',  bw: 320,  compute: '6.1',  khs: 9.5,  tpb: '48–256',  wc: '16384',  price: '$0.048', khDollar: '198' },
  { gpu: 'RTX 2060 SUPER',arch: 'Turing (SM 7.5)',   vram: '8 GB GDDR6',   bw: 448,  compute: '7.5',  khs: 3.4,  tpb: '—',       wc: '—',      price: '—',      khDollar: '—' },
  { gpu: 'RTX 3060',      arch: 'Ampere (SM 8.6)',   vram: '12 GB GDDR6',  bw: 360,  compute: '8.6',  khs: 16.5, tpb: '24',      wc: '4096',   price: '$0.048', khDollar: '344', highlight: true },
  { gpu: 'RX 5600 XT',    arch: 'RDNA1 (OpenCL)',    vram: '6 GB GDDR6',   bw: 288,  compute: '—',    khs: 10.0, tpb: 'lws=256', wc: '—',      price: 'local',  khDollar: '∞' },
  { gpu: 'RTX 5070 Ti',   arch: 'Blackwell (SM 12.0)',vram: '16 GB GDDR7', bw: 896,  compute: '12.0', khs: 21.0, tpb: '48',      wc: '49152',  price: '$0.10',  khDollar: '210' },
  { gpu: 'A100 SXM4',     arch: 'Ampere (SM 8.0)',   vram: '40 GB HBM2e',  bw: 2039, compute: '8.0',  khs: 38.5, tpb: 'any',     wc: 'any',    price: '$0.62',  khDollar: '62' },
  { gpu: 'H100 SXM',      arch: 'Hopper (SM 9.0)',   vram: '80 GB HBM3',   bw: 3350, compute: '9.0',  khs: 81.7, tpb: '24',      wc: '262144', price: '$1.88',  khDollar: '43', highlight: true },
];

interface FindingCard {
  icon: typeof Zap;
  title: { cs: string; en: string };
  body: { cs: string; en: string };
}

const FINDINGS: FindingCard[] = [
  {
    icon: Zap,
    title: { cs: 'TPB=24 dominuje na moderních GPU', en: 'TPB=24 dominates on modern GPUs' },
    body: {
      cs: '¾ warpu (TPB=24) je optimální pro Hopper (H100: 81.7 KH/s) i Ampere consumer (RTX 3060: 16.5 KH/s). TPB=48 vyhrává na Blackwell (5070 Ti) a Pascal 3GB (1060). Staré výchozí TPB=256 je katastrofálně pomalé na moderních architekturách.',
      en: '¾ warp (TPB=24) is optimal for Hopper (H100: 81.7 KH/s) and Ampere consumer (RTX 3060: 16.5 KH/s). TPB=48 wins on Blackwell (5070 Ti) and Pascal 3GB (1060). Old default TPB=256 is catastrophically slow on modern architectures.',
    },
  },
  {
    icon: BarChart3,
    title: { cs: 'Šířka pásma → hashrate je sublineární', en: 'Bandwidth → hashrate is sublinear' },
    body: {
      cs: 'Nízké GPU dostávají více KH/s na GB/s šířky pásma. 256 KiB scratchpad s náhodnými čteními je omezen latencí, ne propustností. L2 cache má větší vliv než surová propustnost.',
      en: 'Lower-end GPUs get more KH/s per GB/s of bandwidth. The 256 KiB scratchpad with random reads is latency-bound, not bandwidth-bound. L2 cache size matters more than raw throughput.',
    },
  },
  {
    icon: DollarSign,
    title: { cs: 'RTX 3060 = nejlepší cena/výkon', en: 'RTX 3060 = best price/performance' },
    body: {
      cs: 'Za $0.048/hod dává RTX 3060 úžasných 344 KH/$. To je 2× lepší než RTX 5070 Ti a 8× lepší než H100. Pro masovou těžbu je 3060 jednoznačný král.',
      en: 'At $0.048/hr, RTX 3060 delivers an amazing 344 KH/$. That\'s 2× better than RTX 5070 Ti and 8× better than H100. For mass mining, the 3060 is the undisputed king.',
    },
  },
  {
    icon: Cpu,
    title: { cs: '3 GB karty fungují!', en: '3 GB cards work!' },
    body: {
      cs: 'GTX 1060 3GB dosahuje 5.9 KH/s s wc=2560 (640 MB scratchpad). Minimum VRAM pro Ekam Deeksha je přibližně 2 GB.',
      en: 'GTX 1060 3GB achieves 5.9 KH/s at wc=2560 (640 MB scratchpad). Minimum VRAM for Ekam Deeksha mining is approximately 2 GB.',
    },
  },
];

const TUNING_DEFAULTS = [
  { cls: '3 GB (1060…)',      tpb: '48', wc: '2560',   note: { cs: 'VRAM-limit', en: 'VRAM-limited' } },
  { cls: '6 GB (2060, 1660)', tpb: '48', wc: '16384',  note: { cs: 'Dobrý kompromis', en: 'Good balance' } },
  { cls: '8 GB (1080, 3060 Ti)', tpb: '48', wc: '16384', note: { cs: '1080: TPB=256 taky OK', en: '1080: TPB=256 also works' } },
  { cls: '12 GB (3060)',      tpb: '24', wc: '4096',   note: { cs: '¾ warpu, Ampere optimální', en: '¾ warp, Ampere optimal' } },
  { cls: '16 GB (5070 Ti…)',  tpb: '48', wc: '49152',  note: { cs: '', en: '' } },
  { cls: '24+ GB (A100, H100)', tpb: '24', wc: '262144', note: { cs: 'H100 škáluje s wc; A100 flat', en: 'H100 scales with wc; A100 flat' } },
];

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function BenchmarkMatrix() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="py-20 px-4">
      <div className="zion-container">
        {/* ── Hero header ────────────────────────────────────── */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zion-gold/30 bg-zion-gold/5 mb-6">
            <BarChart3 className="w-4 h-4 text-zion-gold" />
            <span className="text-xs tracking-widest uppercase text-zion-gold">
              Ekam Deeksha v2 · CUDA + OpenCL
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-gradient">GPU Benchmarks</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            {cs
              ? '8 GPU od GTX 1060 po H100 SXM — čistý benchmark bez pool overhead. Algoritmus: 256 KiB scratchpad, 4 průchody, 256 náhodných čtení, INT8 NPU Mix, 8-round Cosmic Fusion.'
              : '8 GPUs from GTX 1060 to H100 SXM — pure benchmark without pool overhead. Algorithm: 256 KiB scratchpad, 4 passes, 256 random reads, INT8 NPU Mix, 8-round Cosmic Fusion.'}
          </p>
        </div>

        {/* ── Main results table ─────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden mb-16">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-zion-gold" />
              {cs ? 'Výsledky — seřazeno dle výkonu' : 'Results — sorted by performance'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">GPU</th>
                  <th className="px-4 py-3">{cs ? 'Architektura' : 'Architecture'}</th>
                  <th className="px-4 py-3">VRAM</th>
                  <th className="px-4 py-3">BW (GB/s)</th>
                  <th className="px-4 py-3 text-right font-bold text-zion-gold/80">KH/s</th>
                  <th className="px-4 py-3">{cs ? 'Opt. TPB' : 'Opt TPB'}</th>
                  <th className="px-4 py-3">{cs ? 'Opt. wc' : 'Opt wc'}</th>
                  <th className="px-4 py-3">$/hr</th>
                  <th className="px-4 py-3 text-right">KH/$</th>
                </tr>
              </thead>
              <tbody>
                {[...GPUS].sort((a, b) => b.khs - a.khs).map((g) => (
                  <tr
                    key={g.gpu}
                    className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${
                      g.highlight ? 'bg-zion-gold/[0.04]' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{g.gpu}</td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{g.arch}</td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{g.vram}</td>
                    <td className="px-4 py-3 text-white/50">{g.bw.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-zion-gold text-base">{g.khs} <span className="text-xs text-zion-gold/60 font-normal">KH/s</span></td>
                    <td className="px-4 py-3 font-mono text-white/60">{g.tpb}</td>
                    <td className="px-4 py-3 font-mono text-white/60">{g.wc}</td>
                    <td className="px-4 py-3 text-white/50">{g.price}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{g.khDollar} <span className="text-xs text-green-400/50 font-normal">KH/$</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 text-xs text-white/30">
            {cs
              ? '¹ RTX 2060S: benchmark s pool overhead — dolní mez. ² RX 5600 XT: OpenCL, ne CUDA. Vast.ai ceny z dubna 2026.'
              : '¹ RTX 2060S: benchmarked with pool overhead — lower bound. ² RX 5600 XT: OpenCL, not CUDA. Vast.ai prices from April 2026.'}
          </div>
        </div>

        {/* ── Key findings cards ─────────────────────────────── */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8">
            {cs ? 'Klíčové závěry' : 'Key Findings'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FINDINGS.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-zion-gold/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-zion-gold" />
                    </div>
                    <h3 className="font-semibold text-white">{cs ? f.title.cs : f.title.en}</h3>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed">{cs ? f.body.cs : f.body.en}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tuning defaults table ──────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden mb-16">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-zion-gold" />
              {cs ? 'Doporučené nastavení' : 'Recommended Tuning Defaults'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">{cs ? 'Třída GPU' : 'GPU Class'}</th>
                  <th className="px-4 py-3">ZION_CUDA_TPB</th>
                  <th className="px-4 py-3">ZION_GPU_WORK_SIZE</th>
                  <th className="px-4 py-3">{cs ? 'Poznámka' : 'Notes'}</th>
                </tr>
              </thead>
              <tbody>
                {TUNING_DEFAULTS.map((d) => (
                  <tr key={d.cls} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 text-white/70">{d.cls}</td>
                    <td className="px-4 py-3 font-mono text-zion-gold">{d.tpb}</td>
                    <td className="px-4 py-3 font-mono text-zion-gold">{d.wc}</td>
                    <td className="px-4 py-3 text-white/40">{cs ? d.note.cs : d.note.en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bandwidth efficiency chart (text) ──────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-16">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-zion-gold" />
            {cs ? 'Efektivita šířky pásma' : 'Bandwidth Efficiency'}
          </h2>
          <div className="space-y-3">
            {[
              { gpu: 'H100 SXM',    bw: 3350, khs: 81.7 },
              { gpu: 'A100 SXM4',   bw: 2039, khs: 38.5 },
              { gpu: 'RTX 5070 Ti', bw: 896,  khs: 21.0 },
              { gpu: 'GTX 1080',    bw: 320,  khs: 9.5 },
              { gpu: 'GTX 1060',    bw: 192,  khs: 5.9 },
            ].map((g) => {
              const eff = g.khs / g.bw;
              const pct = (eff / 0.035) * 100; // normalized to ~max
              return (
                <div key={g.gpu} className="flex items-center gap-4">
                  <span className="w-28 text-sm text-white/60 text-right shrink-0">{g.gpu}</span>
                  <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-zion-gold/40 to-zion-gold rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="w-24 text-xs text-white/40 shrink-0">
                    {(eff * 1000).toFixed(1)} H/s per GB/s
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-white/30 mt-4">
            {cs
              ? 'Nižší GPU mají lepší KH/s na GB/s — Ekam Deeksha je omezen latencí paměti, ne propustností.'
              : 'Lower GPUs have better KH/s per GB/s — Ekam Deeksha is memory-latency-bound, not bandwidth-bound.'}
          </p>
        </div>

        {/* ── CTA ────────────────────────────────────────────── */}
        <div className="text-center">
          <p className="text-white/40 text-sm mb-4">
            {cs
              ? 'Benchmarky provedeny v režimu --ekam-bench (10s měření, bez pool overhead). Miner commit: 9e307c4d'
              : 'Benchmarks run with --ekam-bench mode (10-second measurement, no pool overhead). Miner commit: 9e307c4d'}
          </p>
          <Link
            href="/mining"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zion-gold/30 bg-zion-gold/5 text-zion-gold hover:bg-zion-gold/10 transition-colors"
          >
            {cs ? 'Průvodce těžbou' : 'Mining Guide'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
