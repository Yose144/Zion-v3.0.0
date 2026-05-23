'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, Server, TerminalSquare, Wallet, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { SITE_POOL_PRIMARY } from '@/lib/site';

const DL = '/downloads';

type CLIBuild = {
  os: string;
  suffix: string;
  icon: string;
  reqs: string[];
};

type ToolInfo = {
  name: string;
  id: string;
  desc: string;
  icon: ReactNode;
  prefix: string;
  color: string;
  quickCmd: string;
};

function getPlatforms(cs: boolean): CLIBuild[] {
  return [
    { os: 'Windows 10 / 11 — x64', suffix: 'windows-x86_64.exe', icon: 'W', reqs: ['Windows 10+ (64-bit)'] },
    { os: 'Linux — Intel / AMD', suffix: 'linux-x86_64', icon: 'L', reqs: ['Ubuntu 22.04+', 'Debian 12+', 'RHEL 9+'] },
    { os: 'Linux — ARM64 (RPi)', suffix: 'linux-arm64', icon: 'A', reqs: ['Raspberry Pi 4/5', 'Oracle Cloud', 'AWS Graviton'] },
    { os: 'macOS — Apple Silicon', suffix: 'macos-arm64', icon: 'M', reqs: ['macOS 12+', 'Apple M1 / M2 / M3 / M4'] },
  ];
}

function getPlatformShortLabel(platform: CLIBuild): string {
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

function getTools(cs: boolean): ToolInfo[] {
  return [
    {
      name: 'CLI',
      id: 'cli',
      desc: cs ? 'Sjednoceny operator gateway pro node, pool, miner, agent, bridge, dao, deploy a monitoring.' : 'Unified operator gateway for node, pool, miner, agent, bridge, dao, deploy, and monitoring.',
      icon: <TerminalSquare className="h-6 w-6" />,
      prefix: 'zion-cli',
      color: 'text-white',
      quickCmd: 'zion --help',
    },
    {
      name: 'Miner',
      id: 'miner',
      desc: cs ? 'CPU/GPU miner s Cosmic Harmony v3 — pripojte se k poolu a zacte vydelavat ZION' : 'CPU/GPU miner with Cosmic Harmony v3 — connect to pool and start earning ZION',
      icon: <Zap className="h-6 w-6" />,
      prefix: 'zion-miner',
      color: 'text-zion-gold',
      quickCmd: `zion-miner --pool stratum+tcp://${SITE_POOL_PRIMARY} --wallet YOUR_ADDRESS`,
    },
    {
      name: 'Wallet',
      id: 'wallet',
      desc: cs ? 'Generujte penezenky, kontrolujte zustatek a posilejte transakce — Ed25519 + BIP39 mnemotechnika' : 'Generate wallets, check balance, send transactions — Ed25519 + BIP39 mnemonic',
      icon: <Wallet className="h-6 w-6" />,
      prefix: 'zion-wallet',
      color: 'text-zion-cyan',
      quickCmd: 'zion-wallet gen-mnemonic --out my-wallet.json --print',
    },
    {
      name: 'Node',
      id: 'node',
      desc: cs ? 'Plny blockchain node — overujte transakce, poskytujte RPC a podporujte decentralizaci' : 'Full blockchain node — verify transactions, serve RPC, support decentralization',
      icon: <Server className="h-6 w-6" />,
      prefix: 'zion-node',
      color: 'text-zion-purple',
      quickCmd: 'zion-node --network mainnet --rpc-port 8443 --p2p-port 8333',
    },
  ];
}

export default function DownloadToolBrowser({ cs }: { cs: boolean }) {
  const [activeTool, setActiveTool] = useState('cli');
  const platforms = getPlatforms(cs);
  const tools = getTools(cs);
  const tool = tools.find((item) => item.id === activeTool) || tools[0];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Nativni Rust CLI' : 'Native Rust CLI'}</p>
        <h2 className="text-3xl font-semibold text-white">CLI · Miner · Wallet · Node</h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tools.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTool(item.id)}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTool === item.id
                ? 'bg-white/15 border border-white/30 text-white'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {item.icon}
            {item.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className={`text-sm font-semibold ${tool.color}`}>{tool.name}</p>
        <p className="text-gray-300 mt-1">{tool.desc}</p>
        <div className="mt-3 rounded-xl bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto">
          <span className="text-gray-500">$</span> {tool.quickCmd}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {platforms.map((platform) => {
            const filename = `${tool.prefix}-${platform.suffix}`;
            const url = `${DL}/${filename}`;

            return (
              <Link
                key={`${tool.id}-${platform.suffix}-quick`}
                href={url}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                {tool.id === 'cli'
                  ? `${cs ? 'Download ZION CLI' : 'Download ZION CLI'} · ${getPlatformShortLabel(platform)}`
                  : `${cs ? 'Stahnout' : 'Download'} ${tool.name} · ${getPlatformShortLabel(platform)}`}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {platforms.map((platform) => {
          const filename = `${tool.prefix}-${platform.suffix}`;
          const url = `${DL}/${filename}`;
          return (
            <div
              key={platform.suffix}
              className="rounded-3xl border border-white/10 bg-black/40 p-5 hover:border-white/20 transition-colors"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-zion-gold mr-2">{platform.icon}</span>
                    {platform.os}
                  </h3>
                  <p className="text-sm text-gray-400 font-mono mt-1">{filename}</p>
                </div>
                <Link
                  href={url}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  {cs ? 'Stahnout' : 'Download'}
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                {platform.reqs.map((requirement) => (
                  <span key={requirement} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{requirement}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">{cs ? 'Instalace jednim prikazem (Linux / macOS)' : 'One-line install (Linux / macOS)'}</p>
        <div className="rounded-xl bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto">
          <span className="text-gray-500">$</span>{' '}
          curl -fsSL https://raw.githubusercontent.com/Zion-TerraNova/2.9.6/main/install.sh | bash
        </div>
      </div>
    </section>
  );
}