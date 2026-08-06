'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowDownToLine,
  CheckCircle2,
  Cpu,
  Shield,
  TerminalSquare,
  Package,
  Monitor,
  ExternalLink,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { SITE_RELEASE_LABEL, SITE_VERSION } from '@/lib/site';

const DownloadCopy = {
  guiDashboardWithRealTimeHashra: { cs: `GUI dashboard s hashratem a zůstatkem v reálném čase`, en: `GUI Dashboard with real-time hashrate & balance` },
  oneClickMiningNoTerminalNeeded: { cs: `Těžba na jedno kliknutí — bez terminálu`, en: `One-click mining — no terminal needed` },
  builtInWalletGeneratorManager: { cs: `Vestavěný generátor a správa peněženek`, en: `Built-in wallet generator & manager` },
  autoUpdatesSystemTrayIntegrati: { cs: `Auto-updaty a integrace do system tray`, en: `Auto-updates & system tray integration` },
  remoteMonitoringGamingMode: { cs: `Vzdálené monitorování a Gaming mode`, en: `Remote monitoring & Gaming mode` },
  availableForWindowsMacosLinux: { cs: `Dostupné pro Windows, macOS a Linux`, en: `Available for Windows, macOS & Linux` },
  k1DownloadMiner: { cs: `1. Stáhni miner`, en: `1. Download Miner` },
  pickYourPlatformBelowAndExtra: { cs: `Vyber svou platformu níže a rozbal archiv`, en: `Pick your platform below and extract the archive` },
  k2StartMining: { cs: `2. Spusť těžbu`, en: `2. Start Mining` },
  runZionMinerNoArgsForMenu: { cs: `Spusť ./zion-miner bez argumentů a projdi interaktivním menu`, en: `Run ./zion-miner with no arguments and walk through the interactive menu` },
  windowsDoubleClickZionMinerExe: { cs: `Na Windows dvakrát klikni na zion-miner.exe`, en: `On Windows double-click zion-miner.exe` },
  k3CheckBalance: { cs: `3. Zkontroluj zůstatek`, en: `3. Check Balance` },
  orVisitTheExplorerAtZionterran: { cs: `Nebo navštiv Explorer na zionterranova.com/explorer`, en: `Or visit the Explorer at zionterranova.com/explorer` },
  needAWalletUseV305CliBelow: { cs: `Potřebuješ peněženku? Použij v3.0.5-beta Community CLI níže`, en: `Need a wallet? Use the v3.0.5-beta Community CLI below` },
  tripleStreamMinerGpuCpuZionLiq: { cs: `Terminal Miner · GPU + CPU · Zion Liquidity`, en: `Terminal Miner · GPU + CPU · Zion Liquidity` },
  downloadMineEarn: { cs: `Stáhni. Těž. Vydělávej.`, en: `Download. Mine. Earn.` },
  zionV310BoostMinerThreeStream: { cs: `ZION v3.2.0 "One Love" — Terminal Miner. One-click GPU auto-detect na 4 platformách. `, en: `ZION v3.2.0 "One Love" — Terminal Miner. One-click GPU auto-detect on 4 platforms. ` },
  invertsTraditionalMiningMineHo: { cs: `Auto GPU backend (CUDA + OpenCL + Metal) a nativní algoritmy (VerusHash, RandomX, BLAKE3, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, Cosmic Harmony). Linux x86_64, macOS Apple Silicon/Intel, Windows x86_64.`, en: `Auto GPU backend (CUDA + OpenCL + Metal) and native algorithms (VerusHash, RandomX, BLAKE3, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, Cosmic Harmony). Linux x86_64, macOS Apple Silicon/Intel, Windows x86_64.` },
  downloadBinaries: { cs: `Stáhnout binárky`, en: `Download binaries` },
  githubReleases: { cs: `GitHub Releases`, en: `GitHub Releases` },
  publicMainnetRelease: { cs: `Veřejný mainnet release`, en: `Public mainnet release` },
  theLatestReleaseBringsTheTripl: { cs: `Nejnovější release v3.2.0 "One Love" přináší Terminal Miner — one-click GPU auto-detect (CUDA → OpenCL → Metal → CPU). Nativní algoritmy: VerusHash, RandomX, BLAKE3, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, Cosmic Harmony. 4 platformy: Linux x86_64, macOS Apple Silicon/Intel, Windows x86_64. SHA256 verifikace.`, en: `The latest v3.2.0 "One Love" release brings Terminal Miner — one-click GPU auto-detect (CUDA → OpenCL → Metal → CPU). Native algorithms: VerusHash, RandomX, BLAKE3, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, Cosmic Harmony. 4 platforms: Linux x86_64, macOS Apple Silicon/Intel, Windows x86_64. SHA256 verification.` },
  sourceOfTruth: { cs: `Zdroj pravdy:`, en: `Source of truth:` },
  operatorCommandsGuideFaqRefere: { cs: `operátorské příkazy, guide, FAQ, reference a troubleshooting jsou v sekci `, en: `operator commands, guide, FAQ, reference, and troubleshooting live in the ` },
  sectionOfTheDocsSourceCodeIsOp: { cs: ` v dokumentaci. Zdrojový kód je open-source na `, en: ` section of the docs. Source code is open-source on ` },
  mitLicense: { cs: ` (MIT licence).`, en: ` (MIT license).` },
  comingSoon: { cs: `Brzy`, en: `Coming Soon` },
  oneClickGuiForMiningWalletMana: { cs: `GUI na jedno kliknutí pro těžbu, správu peněženky a monitoring — bez terminálu`, en: `One-click GUI for mining, wallet management and monitoring — no terminal needed` },
  inDevelopment: { cs: `VE VYVOJI`, en: `IN DEVELOPMENT` },
  fullGuiApplicationWithBuiltInM: { cs: `Plná GUI aplikace s vestavěným minerem, peněženkou a dashboardem v reálném čase. Dostupná pro Linux (AppImage + DEB), macOS (DMG) a Windows (EXE + ZIP).`, en: `Full GUI application with built-in miner, wallet, and real-time dashboard. Available for Linux (AppImage + DEB), macOS (DMG), and Windows (EXE + ZIP).` },
  allPlatforms: { cs: `Linux + macOS + Windows`, en: `Linux + macOS + Windows` },
  windowsComingSoon: { cs: `Windows — Brzy`, en: `Windows — Coming Soon` },
  macosComingSoon: { cs: `macOS — Brzy`, en: `macOS — Coming Soon` },
  linuxPreview: { cs: `Linux — Dostupné`, en: `Linux — Available` },
  desktopLinuxAppImage: { cs: `AppImage`, en: `AppImage` },
  desktopLinuxAppImageDesc: { cs: `Staňte se spustitelným — žádná instalace`, en: `Run anywhere — no install needed` },
  desktopLinuxDeb: { cs: `DEB balíček`, en: `DEB package` },
  desktopLinuxDebDesc: { cs: `Pro Debian/Ubuntu — instalace přes dpkg`, en: `For Debian/Ubuntu — install via dpkg` },
  desktopWindowsExe: { cs: `Windows instalátor`, en: `Windows installer` },
  desktopWindowsZip: { cs: `Windows ZIP`, en: `Windows ZIP` },
  desktopWindowsExeDesc: { cs: `Stáhni a spusť NSIS instalátor`, en: `Download and run the NSIS installer` },
  desktopWindowsZipDesc: { cs: `Přenosná verze — rozbal a spusť`, en: `Portable — extract and run` },
  desktopMacDmg: { cs: `macOS DMG`, en: `macOS DMG` },
  desktopMacDmgDesc: { cs: `Pro macOS Apple Silicon (M1–M4)`, en: `For macOS Apple Silicon (M1–M4)` },
  desktopReleaseNotes: { cs: `Poznámky k vydání`, en: `Release notes` },
  wantEarlyAccess: { cs: `Chcete předběžný přístup?`, en: `Want early access?` },
  theDesktopAgentWillBeAvailable: { cs: `Desktop App bude dostupná v našem `, en: `The Desktop App will be available in our ` },
  shop: { cs: `Shopu`, en: `Shop` },
  asAPremiumDownloadWithPriority: { cs: `jako premium download s prioritní podporou a auto-updaty. Připojte se na `, en: `as a premium download with priority support and auto-updates. Join ` },
  toBeNotifiedWhenItLaunches: { cs: `a dostanete upozornění při launchi.`, en: `to be notified when it launches.` },
  desktopNeedHelp: { cs: `Potřebuješ pomoc?`, en: `Need help?` },
  desktopJoinDiscordForSupport: { cs: `Připoj se na Discord pro podporu s instalací a aktuality.`, en: `Join our Discord for setup support and updates.` },
  quickStart: { cs: `Rychlý start`, en: `Quick Start` },
  k3StepsToMining: { cs: `3 kroky k těžbě`, en: `3 steps to mining` },
  step: { cs: `Krok`, en: `Step` },
  hardware: { cs: `Hardware`, en: `Hardware` },
  systemRequirements: { cs: `Systémové požadavky`, en: `System Requirements` },
  minimum: { cs: `Minimum`, en: `Minimum` },
  k2CoreCpu2GbRam100MbDisk: { cs: `2jádrový CPU, 2 GB RAM, 100 MB disk`, en: `2-core CPU, 2 GB RAM, 100 MB disk` },
  recommended: { cs: `Doporučené`, en: `Recommended` },
  k4CoreCpu4GbRam500MbSsd: { cs: `4+ jádrový CPU, 4 GB RAM, 500 MB SSD`, en: `4+ core CPU, 4 GB RAM, 500 MB SSD` },
  supportedOs: { cs: `Podporované OS`, en: `Supported OS` },
  windows1011LinuxX8664Arm64Maco: { cs: `Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon/Intel)`, en: `Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon/Intel)` },
  network: { cs: `Síť`, en: `Network` },
  stableInternetOutboundTcpPort8: { cs: `Stabilní internet, odchozí TCP port 8444 (pool stratum)`, en: `Stable internet, outbound TCP port 8444 (pool stratum)` },
  readyToMine: { cs: `Připraven těžit?`, en: `Ready to mine?` },
  joinOurCommunityForMiningSuppo: { cs: `Připojte se ke komunitě pro podporu s těžbou, pomoc s peněženkou a aktuality projektu.`, en: `Join our community for mining support, wallet help, and project updates.` },
  joinDiscord: { cs: `Připojit se na Discord`, en: `Join Discord` },
  documentation: { cs: `Dokumentace`, en: `Documentation` },
  publicDownloads: { cs: `Veřejné downloady`, en: `Public Downloads` },
};

const DownloadToolBrowser = dynamic(() => import('@/components/download/DownloadToolBrowser'));
const DownloadFaq = dynamic(() => import('@/components/download/DownloadFaq'));

const getDesktopAgentFeatures = (cs: boolean) => [
  DownloadCopy.guiDashboardWithRealTimeHashra[cs ? 'cs' : 'en'],
  DownloadCopy.oneClickMiningNoTerminalNeeded[cs ? 'cs' : 'en'],
  DownloadCopy.builtInWalletGeneratorManager[cs ? 'cs' : 'en'],
  DownloadCopy.autoUpdatesSystemTrayIntegrati[cs ? 'cs' : 'en'],
  DownloadCopy.remoteMonitoringGamingMode[cs ? 'cs' : 'en'],
  DownloadCopy.availableForWindowsMacosLinux[cs ? 'cs' : 'en'],
];

const getCliQuickstartSteps = (cs: boolean) => [
  {
    title: DownloadCopy.k1DownloadMiner[cs ? 'cs' : 'en'],
    items: [
      DownloadCopy.pickYourPlatformBelowAndExtra[cs ? 'cs' : 'en'],
      'Linux/macOS: tar xzf zion-miner-*.tar.gz',
      'Windows: right-click the .zip → Extract All',
    ],
  },
  {
    title: DownloadCopy.k2StartMining[cs ? 'cs' : 'en'],
    items: [
      DownloadCopy.runZionMinerNoArgsForMenu[cs ? 'cs' : 'en'],
      DownloadCopy.windowsDoubleClickZionMinerExe[cs ? 'cs' : 'en'],
      'Advanced: ./start.sh or ./start.bat',
    ],
  },
  {
    title: DownloadCopy.k3CheckBalance[cs ? 'cs' : 'en'],
    items: [
      DownloadCopy.orVisitTheExplorerAtZionterran[cs ? 'cs' : 'en'],
      DownloadCopy.needAWalletUseV305CliBelow[cs ? 'cs' : 'en'],
      'Community CLI can also create wallets, run node & pool',
    ],
  },
];

/* ───────────────────────── component ───────────────────────── */

export default function DownloadPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const desktopAgentFeatures = getDesktopAgentFeatures(cs);
  const cliQuickstartSteps = getCliQuickstartSteps(cs);

  return (
    <div className="zion-page">
      <div className="zion-container max-w-5xl space-y-16">

        {/* ─── Hero ─── */}
        <section
          className="zion-rainbow-card p-5 sm:p-8 md:p-10"
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
          <div className="flex flex-col gap-6">
            <div className="zion-kicker border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <ArrowDownToLine className="h-4 w-4" />
              {SITE_RELEASE_LABEL}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{DownloadCopy.tripleStreamMinerGpuCpuZionLiq[cs ? 'cs' : 'en']}</p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                {DownloadCopy.downloadMineEarn[cs ? 'cs' : 'en']}
              </h1>
            </div>
            <p className="text-lg text-gray-300">
              {DownloadCopy.zionV310BoostMinerThreeStream[cs ? 'cs' : 'en']}{' '}
              <span className="text-white font-semibold">Zion Liquidity</span>{' '}
              {DownloadCopy.invertsTraditionalMiningMineHo[cs ? 'cs' : 'en']}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#downloads"
                className="zion-button-primary text-sm"
              >
                <ArrowDownToLine className="h-4 w-4" />
                {DownloadCopy.downloadBinaries[cs ? 'cs' : 'en']}
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases"
                target="_blank"
                rel="noreferrer"
                className="zion-button-secondary text-sm"
              >
                <ExternalLink className="h-3 w-3" />
                {DownloadCopy.githubReleases[cs ? 'cs' : 'en']}
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Desktop App — top spotlight ─── */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">Desktop App</p>
            <h2 className="text-3xl font-semibold text-white">ZION Desktop App · {SITE_VERSION}</h2>
            <p className="text-gray-400">{DownloadCopy.oneClickGuiForMiningWalletMana[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="relative overflow-hidden zion-rainbow-card p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="absolute top-4 right-4 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-emerald-400">
              ✅ {DownloadCopy.allPlatforms[cs ? 'cs' : 'en']}
            </div>
            <div className="flex items-start gap-4 mb-6">
              <Monitor className="mt-1 h-10 w-10 shrink-0 text-zion-gold" />
              <div>
                <h3 className="text-2xl font-semibold text-white">ZION Desktop App</h3>
                <p className="text-gray-400 mt-1">
                  {DownloadCopy.fullGuiApplicationWithBuiltInM[cs ? 'cs' : 'en']}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
              {desktopAgentFeatures.map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm text-gray-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zion-gold" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.1.0-desktop/zion-public-miner-v3.1.0-linux-x86_64.AppImage"
                target="_blank"
                rel="noreferrer"
                className="zion-button-primary text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.desktopLinuxAppImage[cs ? 'cs' : 'en']}
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.1.0-desktop/zion-public-miner-v3.1.0-linux-amd64.deb"
                target="_blank"
                rel="noreferrer"
                className="zion-button-primary text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.desktopLinuxDeb[cs ? 'cs' : 'en']}
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.1.0-desktop/zion-public-miner-v3.1.0-windows-x64.exe"
                target="_blank"
                rel="noreferrer"
                className="zion-button-primary text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.desktopWindowsExe[cs ? 'cs' : 'en']}
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.1.0-desktop/zion-public-miner-v3.1.0-windows-x64.zip"
                target="_blank"
                rel="noreferrer"
                className="zion-button-primary text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.desktopWindowsZip[cs ? 'cs' : 'en']}
              </Link>
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.1.0-desktop/zion-public-miner-v3.1.0-mac-arm64.dmg"
                target="_blank"
                rel="noreferrer"
                className="zion-button-primary text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.desktopMacDmg[cs ? 'cs' : 'en']}
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                {DownloadCopy.desktopLinuxAppImageDesc[cs ? 'cs' : 'en']}
              </span>
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                {DownloadCopy.desktopLinuxDebDesc[cs ? 'cs' : 'en']}
              </span>
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                {DownloadCopy.desktopWindowsExeDesc[cs ? 'cs' : 'en']}
              </span>
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                {DownloadCopy.desktopWindowsZipDesc[cs ? 'cs' : 'en']}
              </span>
              <span className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                {DownloadCopy.desktopMacDmgDesc[cs ? 'cs' : 'en']}
              </span>
              <Link
                href="https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-zion-cyan hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {DownloadCopy.desktopReleaseNotes[cs ? 'cs' : 'en']}
              </Link>
            </div>

            <div className="mt-6 zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
              <p className="text-sm text-gray-300">
                <span className="text-zion-gold font-semibold">💡 {DownloadCopy.desktopNeedHelp[cs ? 'cs' : 'en']}</span>{' '}
                {DownloadCopy.desktopJoinDiscordForSupport[cs ? 'cs' : 'en']}{' '}
                <Link href="https://discord.gg/zion-terranova" target="_blank" className="text-zion-gold underline hover:no-underline">
                  Discord
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DownloadCopy.publicMainnetRelease[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">ZION v3.2.0 "One Love" · Terminal Miner</h2>
            <p className="text-gray-400 max-w-3xl">
              {DownloadCopy.theLatestReleaseBringsTheTripl[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
            <p className="text-sm text-gray-300">
              <span className="text-zion-cyan font-semibold">{DownloadCopy.sourceOfTruth[cs ? 'cs' : 'en']}</span>{' '}
              {DownloadCopy.operatorCommandsGuideFaqRefere[cs ? 'cs' : 'en']}
              <Link href="/docs" className="text-zion-cyan underline hover:no-underline">ZION CLI</Link>
              {DownloadCopy.sectionOfTheDocsSourceCodeIsOp[cs ? 'cs' : 'en']}
              <Link href="https://github.com/Zion-TerraNova/v3-Mainnet" target="_blank" className="text-zion-cyan underline hover:no-underline">GitHub</Link>
              {DownloadCopy.mitLicense[cs ? 'cs' : 'en']}
            </p>
          </div>
        </section>

        <section id="downloads">
          <DownloadToolBrowser cs={cs} />
        </section>

        {/* ─── 3-step onboarding ─── */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DownloadCopy.quickStart[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{DownloadCopy.k3StepsToMining[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {cliQuickstartSteps.map((step) => (
              <div key={step.title} className="zion-rainbow-sub p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{DownloadCopy.step[cs ? 'cs' : 'en']}</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {step.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zion-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Requirements ─── */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DownloadCopy.hardware[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{DownloadCopy.systemRequirements[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: DownloadCopy.minimum[cs ? 'cs' : 'en'], value: DownloadCopy.k2CoreCpu2GbRam100MbDisk[cs ? 'cs' : 'en'] },
              { label: DownloadCopy.recommended[cs ? 'cs' : 'en'], value: DownloadCopy.k4CoreCpu4GbRam500MbSsd[cs ? 'cs' : 'en'] },
              { label: DownloadCopy.supportedOs[cs ? 'cs' : 'en'], value: DownloadCopy.windows1011LinuxX8664Arm64Maco[cs ? 'cs' : 'en'] },
              { label: DownloadCopy.network[cs ? 'cs' : 'en'], value: DownloadCopy.stableInternetOutboundTcpPort8[cs ? 'cs' : 'en'] },
            ].map((req) => (
              <div key={req.label} className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-zion-gold" />
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{req.label}</p>
                </div>
                <p className="mt-3 text-lg text-white">{req.value}</p>
              </div>
            ))}
          </div>
        </section>

        <DownloadFaq cs={cs} />

        {/* ─── CTA ─── */}
        <section className="zion-cta-banner">
          <TerminalSquare className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{DownloadCopy.readyToMine[cs ? 'cs' : 'en']}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {DownloadCopy.joinOurCommunityForMiningSuppo[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="https://discord.gg/zion-terranova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-primary text-sm"
            >
              {DownloadCopy.joinDiscord[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="https://t.me/zionterranova"
              target="_blank"
              rel="noreferrer"
              className="zion-button-secondary text-sm"
            >
              Telegram
            </Link>
            <Link
              href="/docs"
              className="zion-button-secondary text-sm"
            >
              {DownloadCopy.documentation[cs ? 'cs' : 'en']}
            </Link>
            <Link
              href="#downloads"
              className="zion-button-secondary text-sm"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {DownloadCopy.publicDownloads[cs ? 'cs' : 'en']}
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
