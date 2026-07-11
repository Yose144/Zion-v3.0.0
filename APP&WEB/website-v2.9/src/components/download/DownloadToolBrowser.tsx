'use client';

import Link from 'next/link';
import {
  ArrowDownToLine,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  GitBranch,
  Cpu,
  HardDrive,
  Terminal,
  Monitor,
  Apple,
  MonitorSmartphone,
  Menu as MenuIcon,
} from 'lucide-react';
import { SITE_POOL_PRIMARY } from '@/lib/site';
import {
  LATEST_RELEASE,
  GITHUB_REPO_URL,
  NETWORK_PARAMS,
} from '@/lib/github-releases';

/* ── helpers ── */

function formatSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

/* ── platform icons ── */

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  'linux-x86_64': <Terminal className="h-6 w-6" />,
  'macos-arm64': <Apple className="h-6 w-6" />,
  'macos-x86_64': <Monitor className="h-6 w-6" />,
  'windows-x86_64': <MonitorSmartphone className="h-6 w-6" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  'linux-x86_64': '34, 197, 94',      // green
  'macos-arm64': '168, 85, 247',      // purple
  'macos-x86_64': '99, 102, 241',     // indigo
  'windows-x86_64': '59, 130, 246',   // blue
};

/* ── interactive menu features ── */

type Feature = {
  id: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
};

function getFeatures(cs: boolean): Feature[] {
  return [
    {
      id: 'wallet',
      icon: <ShieldCheck className="h-5 w-5" />,
      label: cs ? 'Wallet' : 'Wallet',
      desc: cs ? 'Ed25519 + BIP39 mnemotechnika, zustatek, odesilani' : 'Ed25519 + BIP39 mnemonic, balance, send',
    },
    {
      id: 'node',
      icon: <Terminal className="h-5 w-5" />,
      label: cs ? 'Node' : 'Node',
      desc: cs ? 'Full L1 node — bloky, transakce, mempool, P2P' : 'Full L1 node — blocks, transactions, mempool, P2P',
    },
    {
      id: 'mine',
      icon: <ArrowDownToLine className="h-5 w-5" />,
      label: cs ? 'Miner' : 'Miner',
      desc: cs ? 'CPU/GPU tezba s Ekam Deeksha dual-algo' : 'CPU/GPU mining with Ekam Deeksha dual-algo',
    },
    {
      id: 'pool',
      icon: <MenuIcon className="h-5 w-5" />,
      label: cs ? 'Pool' : 'Pool',
      desc: cs ? 'Stratum pool monitoring a statistiky' : 'Stratum pool monitoring & stats',
    },
  ];
}

/* ── component ── */

export default function DownloadToolBrowser({ cs }: { cs: boolean }) {
  const release = LATEST_RELEASE;
  const features = getFeatures(cs);

  // Split assets: platform binaries + checksum
  const binaries = release.assets.filter((a) => a.platform !== 'checksum');
  const checksum = release.assets.find((a) => a.platform === 'checksum');

  return (
    <section className="space-y-8">
      {/* ─── Release header ─── */}
      <div
        className="zion-rainbow-card p-5 sm:p-6"
        style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
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
                {cs ? 'Publikováno' : 'Published'} {release.publishedAt}
              </p>
            </div>
          </div>
          <Link
            href={release.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="zion-button-secondary text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            {cs ? 'GitHub Release' : 'GitHub Release'}
          </Link>
        </div>
      </div>

      {/* ─── What's in the box ─── */}
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {cs ? 'Jeden binary — vše, co potřebuješ' : 'One binary — everything you need'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat) => (
            <div
              key={feat.id}
              className="zion-rainbow-sub p-4 transition-colors"
              style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zion-gold">{feat.icon}</span>
                <span className="text-sm font-semibold text-white">{feat.label}</span>
              </div>
              <p className="text-xs text-gray-400">{feat.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          {cs
            ? 'Spusť `zion` bez argumentů pro interaktivní menu se šipkami. Windows verze má node + pool + miner embedded (10 MB).'
            : 'Run `zion` with no arguments for an interactive arrow-key menu. Windows version has node + pool + miner embedded (10 MB).'}
        </p>
      </div>

      {/* ─── Platform download cards ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
            {cs ? 'Stažení — 4 platformy' : 'Downloads — 4 platforms'}
          </p>
          <span className="text-xs text-gray-500">{binaries.length} {cs ? 'balíčků' : 'packages'}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {binaries.map((asset) => {
            const color = PLATFORM_COLORS[asset.platform] || '6, 182, 212';
            return (
              <div
                key={asset.name}
                className="zion-rainbow-sub p-5 transition-colors"
                style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10"
                      style={{ backgroundColor: `rgba(${color}, 0.1)`, color: `rgb(${color})` }}
                    >
                      {PLATFORM_ICONS[asset.platform]}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white">
                        {asset.label}
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
                    className="zion-button-secondary text-sm"
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
        style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
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
              className="zion-button-secondary text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              SHA256SUMS.txt
            </Link>
          )}
        </div>
      </div>

      {/* ─── Quick start ─── */}
      <div
        className="zion-rainbow-sub p-5"
        style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3 mb-3">
          <Terminal className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">
            {cs ? 'Rychlý start' : 'Quick start'}
          </h3>
        </div>
        <div className="rounded-lg bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto space-y-1">
          <div><span className="text-gray-500">$</span> tar xzf zion-cli-linux-x86_64.tar.gz</div>
          <div><span className="text-gray-500">$</span> chmod +x zion</div>
          <div><span className="text-gray-500">$</span> ./zion</div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {cs
            ? 'Interaktivní menu tě provede: wallet → node → pool → miner. Nebo použij subcommandy: `zion wallet`, `zion node`, `zion mine`, `zion pool`.'
            : 'The interactive menu guides you: wallet → node → pool → miner. Or use subcommands: `zion wallet`, `zion node`, `zion mine`, `zion pool`.'}
        </p>
        <div className="mt-3 rounded-lg bg-black/40 p-2 font-mono text-[10px] text-gray-400 overflow-x-auto">
          <span className="text-gray-500">$</span> ./zion mine start --pool stratum+tcp://{SITE_POOL_PRIMARY} --wallet YOUR_ADDRESS
        </div>
      </div>

      {/* ─── Network parameters ─── */}
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {cs ? 'Parametry sítě' : 'Network parameters'}
        </p>
        <div
          className="zion-rainbow-sub p-5 overflow-x-auto"
          style={{ '--rc': '6, 182, 212' } as React.CSSProperties}
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
            {cs ? 'Build ze zdrojů' : 'Build from source'}
          </h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {cs
            ? 'Pro ARM64 (Raspberry Pi, AWS Graviton) nebo vlastní build:'
            : 'For ARM64 (Raspberry Pi, AWS Graviton) or custom builds:'}
        </p>
        <div className="rounded-lg bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto space-y-1">
          <div><span className="text-gray-500">$</span> git clone {GITHUB_REPO_URL}.git</div>
          <div><span className="text-gray-500">$</span> cd v3-Mainnet/V3</div>
          <div><span className="text-gray-500">$</span> cargo build --release -p zion-public</div>
        </div>
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
