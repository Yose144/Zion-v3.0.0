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
import { SITE_POOL_PRIMARY, SITE_RELEASE_LABEL, SITE_VERSION } from '@/lib/site';

const DownloadCopy = {
  guiDashboardWithRealTimeHashra: { cs: `GUI dashboard s hashratem a zůstatkem v reálném čase`, en: `GUI Dashboard with real-time hashrate & balance` },
  oneClickMiningNoTerminalNeeded: { cs: `Těžba na jedno kliknutí — bez terminálu`, en: `One-click mining — no terminal needed` },
  builtInWalletGeneratorManager: { cs: `Vestavěný generátor a správa peněženek`, en: `Built-in wallet generator & manager` },
  autoUpdatesSystemTrayIntegrati: { cs: `Auto-updaty a integrace do system tray`, en: `Auto-updates & system tray integration` },
  remoteMonitoringGamingMode: { cs: `Vzdálené monitorování a Gaming mode`, en: `Remote monitoring & Gaming mode` },
  availableForWindowsMacosLinux: { cs: `Dostupné pro Windows, macOS a Linux`, en: `Available for Windows, macOS & Linux` },
  k1CreateWallet: { cs: `1. Vytvoř peněženku`, en: `1. Create Wallet` },
  downloadZionCliForWindowsBelow: { cs: `Stáhni ZION CLI pro Windows níže`, en: `Download ZION CLI for Windows below` },
  writeDown24WordsOnPaperThisIsY: { cs: `Zapiš si 24 slov na papír — to je tvá záloha!`, en: `Write down 24 words on paper — this is your backup!` },
  k2StartMining: { cs: `2. Spusť těžbu`, en: `2. Start Mining` },
  setAddressZionConfigSetMinerWa: { cs: `Nastav adresu: zion config set miner.wallet YOUR_ADDRESS`, en: `Set address: zion config set miner.wallet YOUR_ADDRESS` },
  watchHashrateAcceptedSharesInC: { cs: `Sleduj hashrate a přijaté shares v konzoli`, en: `Watch hashrate & accepted shares in console` },
  k3CheckBalance: { cs: `3. Zkontroluj zůstatek`, en: `3. Check Balance` },
  orVisitTheExplorerAtZionterran: { cs: `Nebo navštiv Explorer na zionterranova.com/explorer`, en: `Or visit the Explorer at zionterranova.com/explorer` },
  sendZionZionWalletSendToRecipi: { cs: `Poslat ZION: zion wallet send --to RECIPIENT --amount 100`, en: `Send ZION: zion wallet send --to RECIPIENT --amount 100` },
  tripleStreamMinerGpuCpuZionLiq: { cs: `Triple Stream Miner · GPU + CPU · Zion Liquidity`, en: `Triple Stream Miner · GPU + CPU · Zion Liquidity` },
  downloadMineEarn: { cs: `Stáhni. Těž. Vydělávej.`, en: `Download. Mine. Earn.` },
  zionV306BetaTripleStreamMinerG: { cs: `ZION v3.0.6-beta — Triple Stream Miner. GPU + CPU současně, `, en: `ZION v3.0.6-beta — Triple Stream Miner. GPU + CPU simultaneously, ` },
  invertsTraditionalMiningMineHo: { cs: `inverzuje tradiční mining: těž → drž ZION → likvidita roste. Žádné burzy, žádný sell pressure. `, en: `inverts traditional mining: mine → hold ZION → liquidity grows. No exchanges, no sell pressure. ` },
  availableFor: { cs: `Dostupné pro `, en: `Available for ` },
  for: { cs: `. Pro `, en: `. For ` },
  and: { cs: `a `, en: ` and ` },
  useTheV305BetaCommunityCliBelo: { cs: ` použij v3.0.5-beta Community CLI níže.`, en: ` use the v3.0.5-beta Community CLI below.` },
  downloadBinaries: { cs: `Stáhnout binárky`, en: `Download binaries` },
  githubReleases: { cs: `GitHub Releases`, en: `GitHub Releases` },
  publicMainnetRelease: { cs: `Veřejný mainnet release`, en: `Public mainnet release` },
  theLatestReleaseBringsTheTripl: { cs: `Nejnovější release přináší Triple Stream mining engine — GPU a CPU pracují současně pro maximalizaci ZION earnings. Optimalizované OpenCL/CUDA kernely pro AMD RDNA a NVIDIA. Linux x86_64 binárka dostupná z GitHub Releases s SHA256 verifikací. Pro macOS a Windows použij v3.0.5-beta Community CLI níže.`, en: `The latest release brings the Triple Stream mining engine — GPU and CPU work together to maximize ZION earnings. Optimized OpenCL/CUDA kernels for AMD RDNA and NVIDIA. Linux x86_64 binary available from GitHub Releases with SHA256 verification. For macOS and Windows use the v3.0.5-beta Community CLI below.` },
  sourceOfTruth: { cs: `Zdroj pravdy:`, en: `Source of truth:` },
  operatorCommandsGuideFaqRefere: { cs: `operátorské příkazy, guide, FAQ, reference a troubleshooting jsou v sekci `, en: `operator commands, guide, FAQ, reference, and troubleshooting live in the ` },
  sectionOfTheDocsSourceCodeIsOp: { cs: ` v dokumentaci. Zdrojový kód je open-source na `, en: ` section of the docs. Source code is open-source on ` },
  mitLicense: { cs: ` (MIT licence).`, en: ` (MIT license).` },
  comingSoon: { cs: `Brzy`, en: `Coming Soon` },
  oneClickGuiForMiningWalletMana: { cs: `GUI na jedno kliknutí pro těžbu, správu peněženky a monitoring — bez terminálu`, en: `One-click GUI for mining, wallet management and monitoring — no terminal needed` },
  inDevelopment: { cs: `VE VYVOJI`, en: `IN DEVELOPMENT` },
  fullGuiApplicationWithBuiltInM: { cs: `Plná GUI aplikace s vestavěným minerem, peněženkou a dashboardem v reálném čase. Brzy dostupná pro Windows, macOS a Linux.`, en: `Full GUI application with built-in miner, wallet, and real-time dashboard. Available soon for Windows, macOS & Linux.` },
  windowsComingSoon: { cs: `Windows — Brzy`, en: `Windows — Coming Soon` },
  macosComingSoon: { cs: `macOS — Brzy`, en: `macOS — Coming Soon` },
  linuxComingSoon: { cs: `Linux — Brzy`, en: `Linux — Coming Soon` },
  wantEarlyAccess: { cs: `Chcete předběžný přístup?`, en: `Want early access?` },
  theDesktopAgentWillBeAvailable: { cs: `Desktop Agent bude dostupný v našem `, en: `The Desktop Agent will be available in our ` },
  shop: { cs: `Shopu`, en: `Shop` },
  asAPremiumDownloadWithPriority: { cs: `jako premium download s prioritní podporou a auto-updaty. Připojte se na `, en: `as a premium download with priority support and auto-updates. Join ` },
  toBeNotifiedWhenItLaunches: { cs: `a dostanete upozornění při launchi.`, en: `to be notified when it launches.` },
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
  windows1011LinuxX8664Arm64Maco: { cs: `Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)`, en: `Windows 10/11, Linux (x86_64/ARM64), macOS (Apple Silicon)` },
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
    title: DownloadCopy.k1CreateWallet[cs ? 'cs' : 'en'],
    items: [
      DownloadCopy.downloadZionCliForWindowsBelow[cs ? 'cs' : 'en'],
      'Run: zion wallet new --mnemonic --out my-wallet.json --print',
      DownloadCopy.writeDown24WordsOnPaperThisIsY[cs ? 'cs' : 'en'],
    ],
  },
  {
    title: DownloadCopy.k2StartMining[cs ? 'cs' : 'en'],
    items: [
      DownloadCopy.setAddressZionConfigSetMinerWa[cs ? 'cs' : 'en'],
      `Run: zion mine start --pool stratum+tcp://${SITE_POOL_PRIMARY}`,
      DownloadCopy.watchHashrateAcceptedSharesInC[cs ? 'cs' : 'en'],
    ],
  },
  {
    title: DownloadCopy.k3CheckBalance[cs ? 'cs' : 'en'],
    items: [
      'Run: zion wallet balance --address YOUR_ADDRESS',
      DownloadCopy.orVisitTheExplorerAtZionterran[cs ? 'cs' : 'en'],
      DownloadCopy.sendZionZionWalletSendToRecipi[cs ? 'cs' : 'en'],
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
              {DownloadCopy.zionV306BetaTripleStreamMinerG[cs ? 'cs' : 'en']}{' '}
              <span className="text-white font-semibold">Zion Liquidity</span>{' '}
              {DownloadCopy.invertsTraditionalMiningMineHo[cs ? 'cs' : 'en']}
              {DownloadCopy.availableFor[cs ? 'cs' : 'en']}{' '}
              <span className="text-emerald-400 font-semibold">Linux x86_64</span>
              {DownloadCopy.for[cs ? 'cs' : 'en']}
              <span className="text-purple-400 font-semibold">macOS</span>{' '}
              {DownloadCopy.and[cs ? 'cs' : 'en']}{' '}
              <span className="text-blue-400 font-semibold">Windows</span>
              {DownloadCopy.useTheV305BetaCommunityCliBelo[cs ? 'cs' : 'en']}
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

        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DownloadCopy.publicMainnetRelease[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">ZION v3.0.6-beta · Triple Stream Miner</h2>
            <p className="text-gray-400 max-w-3xl">
              {DownloadCopy.theLatestReleaseBringsTheTripl[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
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

        {/* ─── Desktop Agent — placeholder ─── */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DownloadCopy.comingSoon[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">Desktop Agent · {SITE_VERSION}</h2>
            <p className="text-gray-400">{DownloadCopy.oneClickGuiForMiningWalletMana[cs ? 'cs' : 'en']}</p>
          </div>

          <div className="relative overflow-hidden zion-rainbow-card p-8" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="absolute top-4 right-4 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-3 py-1 text-xs font-semibold tracking-wider text-zion-gold">
              🚧 {DownloadCopy.inDevelopment[cs ? 'cs' : 'en']}
            </div>

            <div className="flex items-start gap-4 mb-6">
              <Monitor className="mt-1 h-10 w-10 shrink-0 text-zion-gold" />
              <div>
                <h3 className="text-2xl font-semibold text-white">ZION Desktop Agent</h3>
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
              <button
                disabled
                className="zion-button-secondary opacity-50 cursor-not-allowed text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.windowsComingSoon[cs ? 'cs' : 'en']}
              </button>
              <button
                disabled
                className="zion-button-secondary opacity-50 cursor-not-allowed text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.macosComingSoon[cs ? 'cs' : 'en']}
              </button>
              <button
                disabled
                className="zion-button-secondary opacity-50 cursor-not-allowed text-sm"
              >
                <Package className="h-4 w-4" />
                {DownloadCopy.linuxComingSoon[cs ? 'cs' : 'en']}
              </button>
            </div>

            <div className="mt-6 zion-rainbow-sub p-4" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-sm text-gray-300">
                <span className="text-zion-gold font-semibold">💡 {DownloadCopy.wantEarlyAccess[cs ? 'cs' : 'en']}</span>{' '}
                {DownloadCopy.theDesktopAgentWillBeAvailable[cs ? 'cs' : 'en']}
                <Link href="/shop" className="text-zion-gold underline hover:no-underline">
                  {DownloadCopy.shop[cs ? 'cs' : 'en']}
                </Link>{' '}
                {DownloadCopy.asAPremiumDownloadWithPriority[cs ? 'cs' : 'en']}
                <Link href="https://discord.gg/zion-terranova" target="_blank" className="text-zion-gold underline hover:no-underline">
                  Discord
                </Link>{' '}
                {DownloadCopy.toBeNotifiedWhenItLaunches[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
        </section>

        {/* ─── 3-step onboarding ─── */}
        <section className="zion-section">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DownloadCopy.quickStart[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{DownloadCopy.k3StepsToMining[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {cliQuickstartSteps.map((step) => (
              <div key={step.title} className="zion-rainbow-sub p-6" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
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
              <div key={req.label} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
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
