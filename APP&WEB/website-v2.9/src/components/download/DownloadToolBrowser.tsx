'use client';

import Link from 'next/link';
import {
  ArrowDownToLine,
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
  Package,
  Zap,
  Droplets,
  Server,
} from 'lucide-react';
import { SITE_POOL_PRIMARY } from '@/lib/site';
import {
  LATEST_RELEASE,
  COMMUNITY_CLI_RELEASE,
  GITHUB_REPO_URL,
  NETWORK_PARAMS,
} from '@/lib/github-releases';

const DownloadToolBrowserCopy = {
  boostMiner: { cs: `Terminal`, en: `Terminal` },
  threeStreamsZionPrimaryGpuCpu: { cs: `One-click GPU auto-detect: CUDA → OpenCL → Metal → CPU`, en: `One-click GPU auto-detect: CUDA → OpenCL → Metal → CPU` },
  zionLiquidity: { cs: `Zion Liquidity`, en: `Zion Liquidity` },
  poolHandlesConversionsNoExchan: { cs: `Pool hlídá konverze — žádné burzy, žádný sell pressure`, en: `Pool handles conversions — no exchanges, no sell pressure` },
  autoGpuBackend: { cs: `Auto GPU backend`, en: `Auto GPU backend` },
  autoGpuBackendDesc: { cs: `OpenCL/CUDA/Metal auto-detected na základě hardwaru`, en: `OpenCL/CUDA/Metal auto-detected based on hardware` },
  tuiDashboard: { cs: `TUI dashboard`, en: `TUI dashboard` },
  tuiDashboardDesc: { cs: `Real-time hashrate, shares a stream status v terminálu`, en: `Real-time hashrate, shares, and stream status in terminal` },
  wallet: { cs: `Wallet`, en: `Wallet` },
  ed25519Bip39MnemonicBalanceSen: { cs: `Ed25519 + BIP39 mnemotechnika, zustatek, odesilani`, en: `Ed25519 + BIP39 mnemonic, balance, send` },
  node: { cs: `Node`, en: `Node` },
  fullL1NodeBlocksTransactionsMe: { cs: `Full L1 node — bloky, transakce, mempool, P2P`, en: `Full L1 node — blocks, transactions, mempool, P2P` },
  miner: { cs: `Miner`, en: `Miner` },
  cpuGpuMiningWithEkamDeekshaDua: { cs: `CPU/GPU tezba s Ekam Deeksha dual-algo`, en: `CPU/GPU mining with Ekam Deeksha dual-algo` },
  pool: { cs: `Pool`, en: `Pool` },
  stratumPoolMonitoringStats: { cs: `Stratum pool monitoring a statistiky`, en: `Stratum pool monitoring & stats` },
  preRelease: { cs: `Pre-release`, en: `Pre-release` },
  latest: { cs: `Nejnovější`, en: `Latest` },
  published: { cs: `Publikováno`, en: `Published` },
  githubRelease: { cs: `GitHub Release`, en: `GitHub Release` },
  boostMinerEverythingYouNeed: { cs: `Terminal Miner — vše, co potřebuješ`, en: `Terminal Miner — everything you need` },
  oneBinaryEverythingYouNeed: { cs: `Jeden binary — vše, co potřebuješ`, en: `One binary — everything you need` },
  theBoostMinerMinesZionWithThree: { cs: `Terminal Miner těží ZION s one-click GPU auto-detect (CUDA → OpenCL → Metal → CPU) a nativními algoritmy (VerusHash, RandomX, BLAKE3, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, Cosmic Harmony). Spusť binárku bez argumentů a projdi interaktivním menu, nebo použij příkazovou řádku pro pokročilé nastavení.`, en: `The Terminal Miner mines ZION with one-click GPU auto-detect (CUDA → OpenCL → Metal → CPU) and native algorithms (VerusHash, RandomX, BLAKE3, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, Cosmic Harmony). Run the binary with no arguments and walk through the interactive menu, or use the command line for advanced settings.` },
  runZionWithNoArgumentsForAnInt: { cs: "Spusť `zion-miner` bez argumentů pro interaktivní menu. Pro vytvoření peněženky použij v3.2.0 Community CLI níže.", en: "Run `zion-miner` with no arguments for the interactive setup menu. To create a wallet, use the v3.2.0 Community CLI below." },
  downloads: { cs: `Stažení`, en: `Downloads` },
  packages: { cs: `balíčků`, en: `packages` },
  download: { cs: `Stáhnout`, en: `Download` },
  sha256Verification: { cs: `SHA256 verifikace`, en: `SHA256 verification` },
  downloadSha256sumsTxtAndVerify: { cs: `Stáhni SHA256SUMS.txt a ověř binárky před použitím:`, en: `Download SHA256SUMS.txt and verify binaries before use:` },
  quickStartBoostMiner: { cs: `Rychlý start — Terminal Miner`, en: `Quick start — Terminal Miner` },
  theMinerConnectsToTheOfficialP: { cs: `Miner se připojí k oficiálnímu poolu a zobrazí live dashboard: hashrate, accepted/rejected shares, pool height. Na Linux/macOS spusť ./zion-miner, na Windows dvakrát klikni na zion-miner.exe.`, en: `The miner connects to the official pool and shows a live dashboard: hashrate, accepted/rejected shares, pool height. On Linux/macOS run ./zion-miner; on Windows double-click zion-miner.exe.` },
  quickStartCommunityCli: { cs: `Rychlý start — Community CLI`, en: `Quick start — Community CLI` },
  theInteractiveMenuGuidesYouWal: { cs: "Interaktivní menu tě provede: wallet → node → pool → miner. Nebo použij subcommandy: `zion wallet`, `zion node`, `zion mine`, `zion pool`.", en: "The interactive menu guides you: wallet → node → pool → miner. Or use subcommands: `zion wallet`, `zion node`, `zion mine`, `zion pool`." },
  latestReleaseBoostMiner: { cs: `Nejnovější release — Terminal Miner`, en: `Latest release — Terminal Miner` },
  communityCliWalletNodePoolBasi: { cs: `Community CLI — peněženka, node, pool, basic mining`, en: `Community CLI — wallet, node, pool, basic mining` },
  networkParameters: { cs: `Parametry sítě`, en: `Network parameters` },
  buildFromSource: { cs: `Build ze zdrojů`, en: `Build from source` },
  forArm64RaspberryPiAwsGraviton: { cs: `Pro vlastní build (včetně ARM64 jako Raspberry Pi nebo AWS Graviton) stáhni zdrojový kód a přelož:`, en: `For custom builds (including ARM64 like Raspberry Pi or AWS Graviton) clone the source and build:` },
};

/* ── helpers ── */

function formatSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

/* ── platform icons ── */

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  'linux-x86_64': <Terminal className="h-6 w-6" />,
  'linux-aarch64': <Server className="h-6 w-6" />,
  'macos-arm64': <Apple className="h-6 w-6" />,
  'macos-x86_64': <Monitor className="h-6 w-6" />,
  'windows-x86_64': <MonitorSmartphone className="h-6 w-6" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  'linux-x86_64': '6, 105, 40',      // green
  'linux-aarch64': '6, 105, 40',    // teal
  'macos-arm64': '228, 30, 43',      // purple
  'macos-x86_64': '228, 30, 43',     // indigo
  'windows-x86_64': '59, 130, 246',   // blue
};

/* ── Triple Stream features ── */

type Feature = {
  id: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
};

function getBoostMinerFeatures(cs: boolean): Feature[] {
  return [
    {
      id: 'boost-miner',
      icon: <Zap className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.boostMiner[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.threeStreamsZionPrimaryGpuCpu[cs ? 'cs' : 'en'],
    },
    {
      id: 'zion-liquidity',
      icon: <Droplets className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.zionLiquidity[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.poolHandlesConversionsNoExchan[cs ? 'cs' : 'en'],
    },
    {
      id: 'auto-gpu-backend',
      icon: <Cpu className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.autoGpuBackend[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.autoGpuBackendDesc[cs ? 'cs' : 'en'],
    },
    {
      id: 'tui-dashboard',
      icon: <Terminal className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.tuiDashboard[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.tuiDashboardDesc[cs ? 'cs' : 'en'],
    },
  ];
}

function getCliFeatures(cs: boolean): Feature[] {
  return [
    {
      id: 'wallet',
      icon: <ShieldCheck className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.wallet[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.ed25519Bip39MnemonicBalanceSen[cs ? 'cs' : 'en'],
    },
    {
      id: 'node',
      icon: <Terminal className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.node[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.fullL1NodeBlocksTransactionsMe[cs ? 'cs' : 'en'],
    },
    {
      id: 'mine',
      icon: <ArrowDownToLine className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.miner[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.cpuGpuMiningWithEkamDeekshaDua[cs ? 'cs' : 'en'],
    },
    {
      id: 'pool',
      icon: <MenuIcon className="h-5 w-5" />,
      label: DownloadToolBrowserCopy.pool[cs ? 'cs' : 'en'],
      desc: DownloadToolBrowserCopy.stratumPoolMonitoringStats[cs ? 'cs' : 'en'],
    },
  ];
}

/* ── release card subcomponent ── */

function ReleaseCard({
  release,
  variant,
  cs,
}: {
  release: typeof LATEST_RELEASE;
  variant: 'boost' | 'cli';
  cs: boolean;
}) {
  const binaries = release.assets.filter((a) => a.platform !== 'checksum');
  const checksum = release.assets.find((a) => a.platform === 'checksum');
  const features = variant === 'boost' ? getBoostMinerFeatures(cs) : getCliFeatures(cs);
  const accent = '6, 105, 40';
  const primary = variant === 'boost';

  return (
    <div className="space-y-6">
      {/* ─── Release header ─── */}
      <div
        className={`zion-rainbow-card p-5 sm:p-6 ${primary ? 'ring-1 ring-zion-cyan/30' : ''}`}
        style={{ '--rc': accent } as React.CSSProperties}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
              <GitBranch className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-semibold text-white">{release.tag}</h2>
                {release.prerelease && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-2.5 py-0.5 text-[10px] font-semibold text-zion-gold uppercase tracking-wider">
                    {DownloadToolBrowserCopy.preRelease[cs ? 'cs' : 'en']}
                  </span>
                )}
                {primary && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-2.5 py-0.5 text-[10px] font-semibold text-zion-cyan uppercase tracking-wider">
                    {DownloadToolBrowserCopy.latest[cs ? 'cs' : 'en']}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{release.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {DownloadToolBrowserCopy.published[cs ? 'cs' : 'en']} {release.publishedAt}
              </p>
            </div>
          </div>
          <Link
            href={release.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="zion-button-secondary text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            {DownloadToolBrowserCopy.githubRelease[cs ? 'cs' : 'en']}
          </Link>
        </div>
      </div>

      {/* ─── What's in the box ─── */}
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {variant === 'boost'
            ? (DownloadToolBrowserCopy.boostMinerEverythingYouNeed[cs ? 'cs' : 'en'])
            : (DownloadToolBrowserCopy.oneBinaryEverythingYouNeed[cs ? 'cs' : 'en'])}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat) => (
            <div
              key={feat.id}
              className="zion-rainbow-sub p-4 transition-colors"
              style={{ '--rc': accent } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zion-gold">{feat.icon}</span>
                <span className="text-sm font-semibold text-white">{feat.label}</span>
              </div>
              <p className="text-xs text-gray-400">{feat.desc}</p>
            </div>
          ))}
        </div>
        {variant === 'boost' ? (
          <p className="text-xs text-gray-500">
            {DownloadToolBrowserCopy.theBoostMinerMinesZionWithThree[cs ? 'cs' : 'en']}
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            {DownloadToolBrowserCopy.runZionWithNoArgumentsForAnInt[cs ? 'cs' : 'en']}
          </p>
        )}
      </div>

      {/* ─── Platform download cards ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
            {DownloadToolBrowserCopy.downloads[cs ? 'cs' : 'en']}
          </p>
          <span className="text-xs text-gray-500">
            {binaries.length} {DownloadToolBrowserCopy.packages[cs ? 'cs' : 'en']}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {binaries.map((asset) => {
            const color = PLATFORM_COLORS[asset.platform] || accent;
            return (
              <div
                key={asset.name}
                className="zion-rainbow-sub p-5 transition-colors"
                style={{ '--rc': accent } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10"
                      style={{ backgroundColor: `rgba(${color}, 0.1)`, color: `rgb(${color})` }}
                    >
                      {PLATFORM_ICONS[asset.platform] || <Package className="h-6 w-6" />}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white">{asset.label}</h3>
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
                    rel="noopener noreferrer"
                    className="zion-button-secondary text-sm"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    {DownloadToolBrowserCopy.download[cs ? 'cs' : 'en']}
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
        style={{ '--rc': accent } as React.CSSProperties}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-zion-cyan" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                {DownloadToolBrowserCopy.sha256Verification[cs ? 'cs' : 'en']}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {DownloadToolBrowserCopy.downloadSha256sumsTxtAndVerify[cs ? 'cs' : 'en']}
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
              rel="noopener noreferrer"
              className="zion-button-secondary text-sm"
            >
              <ShieldCheck className="h-4 w-4" />
              SHA256SUMS.txt
            </Link>
          )}
        </div>
      </div>

      {/* ─── Quick start ─── */}
      {variant === 'boost' ? (
        <div
          className="zion-rainbow-sub p-5"
          style={{ '--rc': accent } as React.CSSProperties}
        >
          <div className="flex items-center gap-3 mb-3">
            <Terminal className="h-5 w-5 text-zion-cyan" />
            <h3 className="text-sm font-semibold text-white">
              {DownloadToolBrowserCopy.quickStartBoostMiner[cs ? 'cs' : 'en']}
            </h3>
          </div>
          <div className="rounded-lg bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto space-y-1">
            <div><span className="text-gray-500">$</span> tar xzf zion-miner-v3.2.0-linux-x86_64.tar.gz</div>
            <div><span className="text-gray-500">$</span> chmod +x zion-miner</div>
            <div><span className="text-gray-500">$</span> ./zion-miner</div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {DownloadToolBrowserCopy.theMinerConnectsToTheOfficialP[cs ? 'cs' : 'en']}
          </p>
        </div>
      ) : (
        <div
          className="zion-rainbow-sub p-5"
          style={{ '--rc': accent } as React.CSSProperties}
        >
          <div className="flex items-center gap-3 mb-3">
            <Terminal className="h-5 w-5 text-zion-cyan" />
            <h3 className="text-sm font-semibold text-white">
              {DownloadToolBrowserCopy.quickStartCommunityCli[cs ? 'cs' : 'en']}
            </h3>
          </div>
          <div className="rounded-lg bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto space-y-1">
            <div><span className="text-gray-500">$</span> tar xzf zion-cli-v3.2.0-linux-x86_64.tar.gz</div>
            <div><span className="text-gray-500">$</span> chmod +x zion</div>
            <div><span className="text-gray-500">$</span> ./zion</div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {DownloadToolBrowserCopy.theInteractiveMenuGuidesYouWal[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-3 rounded-lg bg-black/40 p-2 font-mono text-[10px] text-gray-400 overflow-x-auto">
            <span className="text-gray-500">$</span> ./zion wallet new --mnemonic --out my-wallet.json
          </div>
        </div>
      )}
    </div>
  );
}

/* ── component ── */

export default function DownloadToolBrowser({ cs }: { cs: boolean }) {
  return (
    <section className="space-y-12">
      {/* ─── v3.2.0 — Terminal Miner (primary) ─── */}
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.4em] text-zion-cyan">
          {DownloadToolBrowserCopy.latestReleaseBoostMiner[cs ? 'cs' : 'en']}
        </p>
        <ReleaseCard release={LATEST_RELEASE} variant="boost" cs={cs} />
      </div>

      {/* ─── v3.2.0 — Community CLI (secondary) ─── */}
      <div className="space-y-3 pt-6 border-t border-white/5">
        <p className="text-sm uppercase tracking-[0.4em] text-zion-cyan">
          {DownloadToolBrowserCopy.communityCliWalletNodePoolBasi[cs ? 'cs' : 'en']}
        </p>
        <ReleaseCard release={COMMUNITY_CLI_RELEASE} variant="cli" cs={cs} />
      </div>

      {/* ─── Network parameters ─── */}
      <div className="space-y-3 pt-6 border-t border-white/5">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
          {DownloadToolBrowserCopy.networkParameters[cs ? 'cs' : 'en']}
        </p>
        <div
          className="zion-rainbow-sub p-5 overflow-x-auto"
          style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
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
        style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3 mb-3">
          <Cpu className="h-5 w-5 text-zion-cyan" />
          <h3 className="text-sm font-semibold text-white">
            {DownloadToolBrowserCopy.buildFromSource[cs ? 'cs' : 'en']}
          </h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {DownloadToolBrowserCopy.forArm64RaspberryPiAwsGraviton[cs ? 'cs' : 'en']}
        </p>
        <div className="rounded-lg bg-black/60 p-3 font-mono text-xs text-gray-300 overflow-x-auto space-y-1">
          <div><span className="text-gray-500">$</span> git clone {GITHUB_REPO_URL}.git</div>
          <div><span className="text-gray-500">$</span> cd v3-Mainnet/V3</div>
          <div><span className="text-gray-500">$</span> cargo build --release -p zion-miner</div>
          <div className="text-gray-500"># optional GPU features: --features gpu-opencl,gpu-cuda,gpu-metal</div>
        </div>
        <div className="mt-3">
          <Link
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
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
