import type { Metadata } from 'next';
import { Pickaxe, Download, HardDrive, FileText, Cpu, Terminal } from 'lucide-react';
import MiningDashboard from '@/components/MiningDashboard';

export const metadata: Metadata = {
  title: 'ZION OASIS · Public Miner',
  description: 'Download the public desktop miner and track live OASIS mining stats.',
};

const GITHUB_BASE =
  'https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-desktop';

const DOWNLOADS = {
  appImage: {
    github: `${GITHUB_BASE}/zion-public-miner-v3.0.6-linux-x86_64.AppImage`,
    mirror: '/downloads/zion-public-miner-v3.0.6-linux-x86_64.AppImage',
    sha256:
      'b9f47a62d296bc225aa7e29a596b9f4344478032025970c8e8da409165b1882f',
    size: '137.7 MB',
    label: 'AppImage',
    note: 'Linux x86_64 portable executable',
  },
  deb: {
    github: `${GITHUB_BASE}/zion-public-miner-v3.0.6-linux-amd64.deb`,
    mirror: '/downloads/zion-public-miner-v3.0.6-linux-amd64.deb',
    sha256:
      'ebf0ff479e90842104d22ceb69ca8a86892b2de3050dabed7f55d6049a3e02ff',
    size: '105.8 MB',
    label: 'Debian / Ubuntu',
    note: 'Linux x86_64 .deb package',
  },
  sha256sums: {
    github: `${GITHUB_BASE}/SHA256SUMS.txt`,
    mirror: '/downloads/SHA256SUMS.txt',
    label: 'SHA256SUMS.txt',
  },
};

export default function MinerPage() {
  return (
    <div className="h-full overflow-y-auto bg-oasis-black pt-16 pb-24">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-transparent sm:text-4xl bg-clip-text bg-gradient-to-r from-oasis-cyan via-oasis-purple to-oasis-gold">
            <Pickaxe className="h-8 w-8 text-oasis-cyan" />
            Public Desktop Miner
          </h1>
          <p className="max-w-2xl text-sm text-white/70 sm:text-base">
            The ZION Public Desktop Miner is a standalone Electron GUI that lets you mine
            ZION with one click. It tracks real-time hashrate and shares, supports CPU
            and NVIDIA GPU mining, and stores your configuration between sessions.
          </p>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <DownloadCard artifact={DOWNLOADS.appImage} icon={HardDrive} />
          <DownloadCard artifact={DOWNLOADS.deb} icon={Download} />
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#0d0d0d]/80 p-5 backdrop-blur-xl sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Terminal className="h-5 w-5 text-oasis-cyan" />
            Quick Start
          </h2>
          <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-white/80">
            <li>
              Download the{' '}
              <strong className="text-white">AppImage</strong> or{' '}
              <strong className="text-white">.deb</strong> package above.
            </li>
            <li>
              Launch the miner and enter your ZION wallet address (format{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-oasis-cyan">
                ZION_...
              </code>
              ).
            </li>
            <li>
              Set the pool to{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-oasis-gold">
                62.171.141.136:8444
              </code>
              .
            </li>
            <li>
              Choose a worker name, adjust CPU threads, enable GPU if available, and
              click <strong className="text-white">Start Mining</strong>.
            </li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <CodeBlock
              title="AppImage"
              lines={[
                'chmod +x zion-public-miner-v3.0.6-linux-x86_64.AppImage',
                './zion-public-miner-v3.0.6-linux-x86_64.AppImage',
              ]}
            />
            <CodeBlock
              title="Debian / Ubuntu"
              lines={[
                'sudo dpkg -i zion-public-miner-v3.0.6-linux-amd64.deb',
                'sudo apt-get -f install',
                'zion-public-miner',
              ]}
            />
          </div>
          <p className="mt-4 text-xs text-white/60">
            The AppImage may need{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono">
              sudo apt install libfuse2
            </code>{' '}
            on Ubuntu 22.04+.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d0d0d]/80 p-5 backdrop-blur-xl sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Cpu className="h-5 w-5 text-oasis-gold" />
            Live Mining Dashboard
          </h2>
          <MiningDashboard />
        </section>

        <footer className="mt-8 text-center text-xs text-white/60">
          <a
            href={DOWNLOADS.sha256sums.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-oasis-cyan transition hover:text-oasis-gold"
          >
            <FileText className="h-3.5 w-3.5" />
            SHA256SUMS (GitHub)
          </a>
          <span className="mx-2">·</span>
          <a
            href={DOWNLOADS.sha256sums.mirror}
            className="inline-flex items-center gap-1.5 text-oasis-cyan transition hover:text-oasis-gold"
          >
            SHA256SUMS (mirror)
          </a>
        </footer>
      </div>
    </div>
  );
}

function DownloadCard({
  artifact,
  icon: Icon,
}: {
  artifact: {
    github: string;
    mirror: string;
    sha256: string;
    size: string;
    label: string;
    note: string;
  };
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0d0d]/80 p-5 backdrop-blur-xl transition hover:border-oasis-cyan/30">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-oasis-cyan/20 to-oasis-purple/20">
          <Icon className="h-5 w-5 text-oasis-cyan" />
        </div>
        <span className="rounded-full bg-oasis-gold/10 px-2 py-1 text-xs font-bold text-oasis-gold">
          {artifact.size}
        </span>
      </div>
      <h3 className="mb-1 text-lg font-bold text-white">{artifact.label}</h3>
      <p className="mb-4 text-xs text-white/70">{artifact.note}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href={artifact.github}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-oasis-cyan/20 px-3 py-2 text-sm font-semibold text-oasis-cyan transition hover:bg-oasis-cyan/30"
        >
          <Download className="h-4 w-4" />
          GitHub
        </a>
        <a
          href={artifact.mirror}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <HardDrive className="h-4 w-4" />
          Mirror
        </a>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
          SHA256
        </p>
        <code className="block break-all text-[10px] font-mono text-oasis-gold">
          {artifact.sha256}
        </code>
      </div>
    </div>
  );
}

function CodeBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <p className="mb-2 text-xs font-semibold text-oasis-cyan">{title}</p>
      <pre className="overflow-x-auto rounded-lg bg-black/60 p-3 text-xs text-white/80">
        <code>{lines.join('\n')}</code>
      </pre>
    </div>
  );
}
