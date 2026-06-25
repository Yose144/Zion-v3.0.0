'use client';

import Link from 'next/link';
import { ArrowDownToLine, CheckCircle2, Clock, TerminalSquare, Zap, Wallet, Server, Copy } from 'lucide-react';
import { SITE_POOL_PRIMARY } from '@/lib/site';

const DL = '/downloads';

type Platform = {
  os: string;
  suffix: string;
  icon: string;
  reqs: string[];
  available: boolean;
};

function getPlatforms(cs: boolean): Platform[] {
  return [
    {
      os: 'Windows 10 / 11 — x64',
      suffix: 'windows-x86_64.exe',
      icon: 'W',
      reqs: ['Windows 10+ (64-bit)'],
      available: true,
    },
    {
      os: 'Linux — Intel / AMD',
      suffix: 'linux-x86_64',
      icon: 'L',
      reqs: ['Ubuntu 22.04+', 'Debian 12+', 'RHEL 9+'],
      available: false,
    },
    {
      os: 'Linux — ARM64 (RPi)',
      suffix: 'linux-arm64',
      icon: 'A',
      reqs: ['Raspberry Pi 4/5', 'Oracle Cloud', 'AWS Graviton'],
      available: false,
    },
    {
      os: 'macOS — Apple Silicon',
      suffix: 'macos-arm64',
      icon: 'M',
      reqs: ['macOS 12+', 'Apple M1 / M2 / M3 / M4'],
      available: false,
    },
  ];
}

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
      desc: cs ? 'CPU/GPU tezba s Cosmic Harmony v3' : 'CPU/GPU mining with Cosmic Harmony v3',
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

function getPlatformShortLabel(platform: Platform): string {
  switch (platform.suffix) {
    case 'windows-x86_64.exe':
      return 'Windows';
    case 'linux-x86_64':
      return 'Linux x64';
    case 'linux-arm64':
      return 'Linux ARM64';
    case 'macos-arm64':
      return 'macOS';
    default:
      return platform.os;
  }
}

export default function DownloadToolBrowser({ cs }: { cs: boolean }) {
  const platforms = getPlatforms(cs);
  const subcommands = getSubcommands(cs);
  const filename = `zion-cli-windows-x86_64.exe`;
  const shaUrl = `${DL}/${filename}.sha256`;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {cs ? 'Nativni Rust CLI' : 'Native Rust CLI'}
        </p>
        <h2 className="text-3xl font-semibold text-white">ZION CLI · v3.0.2</h2>
        <p className="text-gray-400 max-w-3xl">
          {cs
            ? 'Jedna unifikovaná binárka obsahující celý stack: node, pool, miner, wallet, bridge, dao, deploy, monitoring a topology.'
            : 'One unified binary containing the whole stack: node, pool, miner, wallet, bridge, dao, deploy, monitoring, and topology.'}
        </p>
      </div>

      {/* Subcommand quick reference */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {subcommands.map((sub) => (
          <div
            key={sub.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
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

      {/* Platform download cards */}
      <div className="space-y-4">
        {platforms.map((platform) => {
          const pf = platform;
          const f = `zion-cli-${pf.suffix}`;
          const url = `${DL}/${f}`;
          return (
            <div
              key={pf.suffix}
              className={`rounded-3xl border p-5 transition-colors ${
                pf.available
                  ? 'border-white/10 bg-black/40 hover:border-white/20'
                  : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-zion-gold">
                    {pf.icon}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      {pf.os}
                      {pf.available ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {cs ? 'Dostupné' : 'Available'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                          <Clock className="h-3 w-3" />
                          {cs ? 'Brzy' : 'Coming Soon'}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400 font-mono mt-0.5">{f}</p>
                  </div>
                </div>
                {pf.available ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={url}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                    >
                      <ArrowDownToLine className="h-4 w-4" />
                      {cs ? 'Stáhnout' : 'Download'}
                    </Link>
                    <Link
                      href={shaUrl}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-gray-300 transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      SHA256
                    </Link>
                  </div>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-500 cursor-not-allowed"
                  >
                    <Clock className="h-4 w-4" />
                    {cs ? 'Ve vývoji' : 'In Progress'}
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                {pf.reqs.map((r) => (
                  <span key={r} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification note */}
      <div className="rounded-2xl border border-zion-cyan/20 bg-zion-cyan/5 p-5">
        <p className="text-sm text-gray-300">
          <span className="text-zion-cyan font-semibold">{cs ? 'Verifikace:' : 'Verification:'}</span>{' '}
          {cs
            ? 'Ke každé dostupné binárce je na serveru i odpovídající soubor .sha256. Po stažení spusť: '
            : 'Each available binary has a matching .sha256 file on the server. After download, run: '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-gray-200">
            certutil -hashfile zion-cli-windows-x86_64.exe SHA256
          </code>{' '}
          {cs ? '(Windows) nebo ' : '(Windows) or '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-gray-200">
            sha256sum zion-cli-windows-x86_64.exe
          </code>{' '}
          {cs ? '(Linux/macOS).' : '(Linux/macOS).'}
        </p>
      </div>
    </section>
  );
}
