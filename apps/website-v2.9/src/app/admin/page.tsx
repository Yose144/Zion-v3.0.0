'use client';

import Link from 'next/link';
import { SITE_VERSION } from '@/lib/site';
import { useLang } from '@/contexts/LanguageContext';

const AdminCopy = {
  controlPlane: { cs: `Řídící rovina`, en: `Control plane` },
  operatorForMiningPoolRoutingAn: { cs: `Operátor pro mining pool, routing a NCL orchestraci. Záměrně bez dead linků — jen stránky, které reálně existují.`, en: `Operator for mining pool, routing and NCL orchestration. Intentionally no dead links — only pages that actually exist.` },
  backToDashboard: { cs: `Zpět na Dashboard`, en: `Back to Dashboard` },
  backToWeb: { cs: `Zpět na Web`, en: `Back to Web` },
  miners: { cs: `Mineři`, en: `Miners` },
  liveViaApi: { cs: `live napojení přes API`, en: `live via API` },
  hashrate: { cs: `Hashrate`, en: `Hashrate` },
  poolAggregate: { cs: `pool agregace`, en: `pool aggregate` },
  activeAlgo: { cs: `Aktivní algo`, en: `Active algo` },
  autoManual: { cs: `auto / manuál`, en: `auto / manual` },
  build: { cs: `Build`, en: `Build` },
  adminUxShell: { cs: `admin UX shell`, en: `admin UX shell` },
  mining: { cs: `Mining`, en: `Mining` },
  algorithmManager: { cs: `Správce algoritmů`, en: `Algorithm manager` },
  algorithmSwitchingActiveRoutin: { cs: `Přepínání algoritmů, status aktivního routingu a (po napojení API) profitability engine.`, en: `Algorithm switching, active routing status and (after API hookup) profitability engine.` },
  open: { cs: `Otevřít`, en: `Open` },
  routing: { cs: `Routing`, en: `Routing` },
  poolConfiguration: { cs: `Pool konfigurace`, en: `Pool configuration` },
  poolUrlsWalletAddressesAndHeal: { cs: `URL poolů, wallet adresy a health-check konektivity pro multi-algo režim.`, en: `Pool URLs, wallet addresses and health-check connectivity for multi-algo mode.` },
  proofOfUsefulWorkSplit: { cs: `Proof of Useful Work split`, en: `Proof of Useful Work split` },
  overviewOfWorkSplitAccordingTo: { cs: `Přehled rozdělení práce podle NCL konceptu (whitepaper v 2.9.5).`, en: `Overview of work split according to the NCL concept (whitepaper v 2.9.5).` },
  primaryPowWork: { cs: `primární PoW práce`, en: `primary PoW work` },
  aiCompute: { cs: `AI výpočty`, en: `AI compute` },
  npuTaskGateway: { cs: `NPU / task gateway`, en: `NPU / task gateway` },
  mergedMining: { cs: `Merged mining`, en: `Merged mining` },
  hybridBridgeWork: { cs: `hybridní bridge práce`, en: `hybrid bridge work` },
  securedByBasicAuthMiddlewareIf: { cs: `zabezpečeno middleware Basic Auth (pokud je nastaveno)`, en: `secured by Basic Auth middleware (if configured)` },
};

export default function AdminDashboard() {
  const { lang } = useLang();
  return (
    <div className="pt-28 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">
        <div className="zion-rainbow-card p-5 sm:p-8 md:p-10" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{AdminCopy.controlPlane[lang === 'cs' ? 'cs' : 'en']}</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">Admin</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                {AdminCopy.operatorForMiningPoolRoutingAn[lang === 'cs' ? 'cs' : 'en']}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="zion-button-secondary"
              >
                {AdminCopy.backToDashboard[lang === 'cs' ? 'cs' : 'en']}
              </Link>
              <Link
                href="/"
                className="zion-button-secondary"
              >
                {AdminCopy.backToWeb[lang === 'cs' ? 'cs' : 'en']}
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.miners[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">—</p>
              <p className="text-sm text-gray-300">{AdminCopy.liveViaApi[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.hashrate[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">—</p>
              <p className="text-sm text-gray-300">{AdminCopy.poolAggregate[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.activeAlgo[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">—</p>
              <p className="text-sm text-gray-300">{AdminCopy.autoManual[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.build[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{SITE_VERSION}</p>
              <p className="text-sm text-gray-300">{AdminCopy.adminUxShell[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Link href="/admin/algo-manager" className="group zion-rainbow-card p-6 hover:border-white/25" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.mining[lang === 'cs' ? 'cs' : 'en']}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{AdminCopy.algorithmManager[lang === 'cs' ? 'cs' : 'en']}</h2>
            <p className="mt-3 text-gray-300">
              {AdminCopy.algorithmSwitchingActiveRoutin[lang === 'cs' ? 'cs' : 'en']}
            </p>
            <div className="mt-6 zion-button-secondary group-hover:border-white/25">
              {AdminCopy.open[lang === 'cs' ? 'cs' : 'en']}
              <span className="text-zion-cyan">→</span>
            </div>
          </Link>

          <Link href="/admin/pool-config" className="group zion-rainbow-card p-6 hover:border-white/25" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.routing[lang === 'cs' ? 'cs' : 'en']}</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{AdminCopy.poolConfiguration[lang === 'cs' ? 'cs' : 'en']}</h2>
            <p className="mt-3 text-gray-300">
              {AdminCopy.poolUrlsWalletAddressesAndHeal[lang === 'cs' ? 'cs' : 'en']}
            </p>
            <div className="mt-6 zion-button-secondary group-hover:border-white/25">
              {AdminCopy.open[lang === 'cs' ? 'cs' : 'en']}
              <span className="text-zion-gold">→</span>
            </div>
          </Link>
        </div>

        <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">NCL</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{AdminCopy.proofOfUsefulWorkSplit[lang === 'cs' ? 'cs' : 'en']}</h2>
              <p className="mt-2 text-sm text-gray-300">
                {AdminCopy.overviewOfWorkSplitAccordingTo[lang === 'cs' ? 'cs' : 'en']}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.mining[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">50%</p>
              <p className="text-sm text-gray-300">{AdminCopy.primaryPowWork[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.aiCompute[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">30%</p>
              <p className="text-sm text-gray-300">{AdminCopy.npuTaskGateway[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminCopy.mergedMining[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">20%</p>
              <p className="text-sm text-gray-300">{AdminCopy.hybridBridgeWork[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          ZION Admin {SITE_VERSION} · {AdminCopy.securedByBasicAuthMiddlewareIf[lang === 'cs' ? 'cs' : 'en']}
        </div>
      </div>
    </div>
  );
}
