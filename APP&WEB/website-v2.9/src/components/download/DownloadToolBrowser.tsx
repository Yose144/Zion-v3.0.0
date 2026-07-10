'use client';

import Link from 'next/link';
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  TerminalSquare,
  Zap,
  Wallet,
  Server,
  Copy,
  ExternalLink,
  Package,
  Boxes,
  ShieldCheck,
  GitBranch,
  Cpu,
  HardDrive,
  Network,
} from 'lucide-react';
import { SITE_POOL_PRIMARY } from '@/lib/site';
import {
  LATEST_RELEASE,
  GITHUB_REPO_URL,
  NETWORK_PARAMS,
} from '@/lib/github-releases';

/* ── helpers ── */

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  cli: <TerminalSquare className="h-5 w-5" />,
  node: <Server className="h-5 w-5" />,
  miner: <Zap className="h-5 w-5" />,
  pool: <Package className="h-5 w-5" />,
  bridge: <Network className="h-5 w-5" />,
  dao: <Boxes className="h-5 w-5" />,
  swap: <Copy className="h-5 w-5" />,
  all: <Boxes className="h-5 w-5" />,
  checksum: <ShieldCheck className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  cli: '6, 182, 212',      // cyan
  node: '168, 85, 247',    // purple
  miner: '250, 204, 21',   // gold
  pool: '34, 197, 94',     // green
  bridge: '59, 130, 246',  // blue
  dao: '236, 72, 153',     // pink
  swap: '249, 115, 22',    // orange
  all: '250, 204, 21',     // gold
  checksum: '100, 116, 139', // slate
};

function formatSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

/* ── subcommand reference ── */

type Subcommand = {
  id: string;
  name: string;
  icon: React.ReactNode;
  cmd: string;
  desc: string;
};

function getSubcommands(cs: boolean): Subcommand[] {
  return [
    {
      id: 'node',
      name: cs ? 'Node' : 'Node',
      icon: <Server className="h-5 w-5" />,
      cmd: 'zion node status',
      desc: cs ? 'Status, bloky, transakce, mempool a WebSocket' : 'Status, blocks, transactions, mempool & WebSocket',
    },
    {
      id: 'mine',
      name: cs ? 'Miner' : 'Miner',
      icon: <Zap className="h-5 w-5" />,
      cmd: `zion mine start --pool stratum+tcp://${SITE_POOL_PRIMARY} --wallet YOUR_ADDRESS`,
      desc: cs ? 'CPU/GPU tezba s Ekam Deeksha dual-algo' : 'CPU/GPU mining with Ekam Deeksha dual-algo',
    },
    {
      id: 'wallet',
      name: cs ? 'Wallet' : 'Wallet',
      icon: <Wallet className="h-5 w-5" />,
      cmd: 'zion wallet new --mnemonic --out my-wallet.json --print',
      desc: cs ? 'Ed25519 + BIP39 mnemotechnika, zustatek, odesilani' : 'Ed25519 + BIP39 mnemonic, balance, send',
    },
    {
      id: 'pool',
      name: cs ? 'Pool' : 'Pool',
      icon: <TerminalSquare className="h-5 w-5" />,
      cmd: 'zion pool status',
      desc: cs ? 'Stratum pool monitoring a statistiky' : 'Stratum pool monitoring & stats',
    },
  ];
}

/* ── platform availability ── */

type PlatformInfo = {
  os: string;
  icon: string;
  status: 'available' | 'coming-soon' | 'build-from-source';
  note: string;
};

function getPlatforms(cs: boolean): PlatformInfo[] {
  return [
    {
      os: 'Linux x86_64',
      icon: 'L',
      status: 'available',
      note: cs ? 'Binárky k dispozici níže' : 'Binaries available below',
    },
    {
      os: 'Windows x86_64',
      icon: 'W',
      status: 'build-from-source',
      note: cs ? 'Cross-compile: x86_64-pc-windows-gnu' : 'Cross-compile: x86_64-pc-windows-gnu',
    },
    {
      os: 'macOS Apple Silicon',
      icon: 'M',
      status: 'build-from-source',
      note: cs ? 'Nativně: cargo build --release' : 'Native: cargo build --release',
    },
    {
      os: 'Linux ARM64',
      icon: 'A',
      status: 'build-from-source',
      note: cs ? 'Pro Raspberry Pi, AWS Graviton' : 'For Raspberry Pi, AWS Graviton',
    },
  ];
}

/* ── component ── */

export default function DownloadToolBrowser({ cs }: { cs: boolean }) {
  const release = LATEST_RELEASE;
  const subcommands = getSubcommands(cs);
  const platforms = getPlatforms(cs);

  // Split assets: binaries + checksum
  const binaries = release.assets.filter((a) => a.category !== 'checksum');
  const checksum = release.assets.find((a) => a.category === 'checksum');

  return (
    <section className="space-y-8">
      {/* ─── Release header ─── */}
      <div
        className="zion-rainbow-card p-5 sm:p-6"
        style={{ '--rc': '250, 204, 21' } as React.CSSProperties}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
              <GitBranch className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-semibold text-white">{release.tag}</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                  {cs ? 'Pre-release' : 'Pre-release'}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">
                {release.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {cs ? 'Publikováno' : 'Published'} {release.publishedAt} · commit {release.commitHash}
              </p>
            </div>
          </div>
          <Link
            href={release.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/10 transition-colors shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
            {cs ? 'GitHub Release' : 'GitHub Release'}
          </Link>
        </div>
      </div>

      {/* ─── Subcommand quick reference ─── */}
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {cs ? 'Co umí ZION CLI' : 'ZION CLI capabilities'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {subcommands.map((sub) => (
            <div
              key={sub.id}
              className="zion-rainbow-sub p-4 transition-colors"
              style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zion-gold">{sub.icon}</span>
                <span className="text-sm font-semibold text-white">{sub.name}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{sub.desc}</p>
              <div className="rounded-lg bg-black/60 p-2 font-mono text-[10px] text-gray-300 overflow-x-auto">
                <span className="text-gray-500">$</span> {sub.cmd}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Platform availability ─── */}
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {cs ? 'Platformy' : 'Platforms'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((pf) => (
            <div
              key={pf.os}
              className={`zion-rainbow-sub p-4 ${pf.status === 'available' ? '' : 'opacity-60'}`}
              style={{ '--rc': pf.status === 'available' ? '34, 197, 94' : '100, 116, 139' } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-zion-gold">
                  {pf.icon}
                </span>
                <span className="text-sm font-semibold text-white">{pf.os}</span>
              </div>
              {pf.status === 'available' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {cs ? 'Dostupné' : 'Available'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                  <Clock className="h-3 w-3" />
                  {cs ? 'Build ze zdrojů' : 'Build from source'}
                </span>
              )}
              <p className="text-xs text-gray-500 mt-2">{pf.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Binary download cards ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
            {cs ? 'Stažení binárek — Linux x86_64' : 'Binary downloads — Linux x86_64'}
          </p>
          <span className="text-xs text-gray-500">{binaries.length} {cs ? 'balíčků' : 'packages'}</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {binaries.map((asset) => {
            const color = CATEGORY_COLORS[asset.category] || '6, 182, 212';
            const isAll = asset.category === 'all';
            return (
              <div
                key={asset.name}
                className={`zion-rainbow-sub p-5 transition-colors ${isAll ? 'ring-1 ring-zion-gold/20' : ''}`}
                style={{ '--rc': color } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10"
                      style={{ backgroundColor: `rgba(${color}, 0.1)`, color: `rgb(${color})` }}
                    >
                      {CATEGORY_ICONS[asset.category]}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        {asset.label}
                        {isAll && (
                          <span className="rounded-full border border-zion-gold/30 bg-zion-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zion-gold">
                            {cs ? 'Doporučeno' : 'Recommended'}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">{asset.description}</p>
                      <p className="text-xs text-gray-500 font-mono mt-1 truncate">{asset.name}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" />
                    {formatSize(asset.sizeMB)}
                  </span>
                  <Link
                    href={asset.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: `rgba(${color}, 0.15)`, border: `1px solid rgba(${color}, 0.3)` }}
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    {cs ? 'Stáhnout' : 'Download'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Checksum + verification ─── */}
      <div
        className="zion-rainbow-sub p-5"
        style={{ '--rc': '100, 116, 139' } as React.CSSProperties}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                {cs ? 'SHA256 verifikace' : 'SHA256 verification'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {cs
                  ? 'Stáhni SHA256SUMS.txt a ověř binárky před použitím:'
                  : 'Download SHA256SUMS.txt and verify binaries before use:'}
              </p>
              <div className="mt-2 rounded-lg bg-black/60 p-2 font-mono text-[10px] text-gray-300 overflow-x-auto">
                <span className="text-gray-500">$</span> sha256sum -c SHA256SUMS.txt
              </div>
            </div>
          </div>
          {checksum && (
            <Link
              href={checksum.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/10 transition-colors shrink-0"
            >
              <Copy className="h-4 w-4" />
              SHA256SUMS.txt
            </Link>
          )}
        </div>
      </div>

      {/* ─── Network parameters ─── */}
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {cs ? 'Parametry sítě' : 'Network parameters'}
        </p>
        <div
          className="zion-rainbow-sub p-5 overflow-x-auto"
          style={{ '--rc': '168, 85, 247' } as React.CSSProperties}
        >
          <table className="w-full text-sm">
            <tbody>
              {NETWORK_PARAMS.map((param) => (
                <tr key={param.label} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pr-4 text-gray-400 whitespace-nowrap align-top">
                    {param.label}
                  </td>
                  <td className={`py-2.5 text-white ${param.mono ? 'font-mono text-xs' : ''}`}>
                    {param.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Build from source ─── */}
      <div
        className="zion-rainbow-sub p-5"
        style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3 mb-3">
          <Cpu className="h-5 w-5 text-zion-cyan" />
          <h3 className="text-sm font-semibold text-white">
            {cs ? 'Build ze zdrojů (macOS, Windows, ARM64)' : 'Build from source (macOS, Windows, ARM64)'}
          </h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {cs
            ? 'Pro platformy bez pre-built binárek můžeš zkompilovat přímo ze zdrojů:'
            : 'For platforms without pre-built binaries, compile directly from source:'}
        </p>
        <div className="rounded-lg bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto space-y-1">
          <div><span className="text-gray-500">$</span> git clone {GITHUB_REPO_URL}.git</div>
          <div><span className="text-gray-500">$</span> cd v3-Mainnet</div>
          <div><span className="text-gray-500">$</span> cargo build --release</div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          <span className="text-zion-cyan font-semibold">Windows:</span>{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">rustup target add x86_64-pc-windows-gnu</code>
          {' → '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">cargo build --release --target x86_64-pc-windows-gnu</code>
        </p>
        <div className="mt-3">
          <Link
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zion-cyan hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {GITHUB_REPO_URL}
          </Link>
        </div>
      </div>
    </section>
  );
}
