'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const AdminAlgoManagerCopy = {
  miningRouting: { cs: `Mining routing`, en: `Mining routing` },
  algorithmManager: { cs: `Správce algoritmů`, en: `Algorithm manager` },
  algorithmSwitchingAndAutoManua: { cs: `Přepínání algoritmů a režim auto/manual. Aktuálně běží na mock datech, dokud se nepřipojí pool API.`, en: `Algorithm switching and auto/manual mode. Currently running on mock data until pool API is connected.` },
  autoSwitch: { cs: `Auto-přepínání`, en: `Auto-switch` },
  back: { cs: `Zpět`, en: `Back` },
  mode: { cs: `Režim`, en: `Mode` },
  profitabilityBased: { cs: `založeno na ziskovosti`, en: `profitability based` },
  operatorControlled: { cs: `řízeno operátorem`, en: `operator controlled` },
  active: { cs: `Aktivní`, en: `Active` },
  profitDay: { cs: `Zisk/den`, en: `Profit/day` },
  perGpuBaseline: { cs: `na GPU baseline`, en: `per GPU baseline` },
  nextCheck: { cs: `Další kontrola`, en: `Next check` },
  schedulerTick: { cs: `scheduler tick`, en: `scheduler tick` },
  connectedMiners: { cs: `Připojení těžaři`, en: `Connected miners` },
  totalHashrate: { cs: `Celkový hashrate`, en: `Total hashrate` },
  profitability: { cs: `Ziskovost`, en: `Profitability` },
  liveTable: { cs: `Live tabulka`, en: `Live table` },
  mockDataRtx4090Baseline: { cs: `Mock data (RTX 4090 baseline)`, en: `Mock data (RTX 4090 baseline)` },
  poolConfiguration: { cs: `Pool konfigurace →`, en: `Pool configuration →` },
  algorithm: { cs: `Algoritmus`, en: `Algorithm` },
  status: { cs: `Status`, en: `Status` },
  action: { cs: `Akce`, en: `Action` },
  active_2: { cs: `AKTIVNÍ`, en: `ACTIVE` },
  standby: { cs: `Pohotovost`, en: `Standby` },
  switch: { cs: `Přepnout`, en: `Switch` },
  tuning: { cs: `Ladění`, en: `Tuning` },
  settings: { cs: `Nastavení`, en: `Settings` },
  switchThreshold: { cs: `Práh přepnutí`, en: `Switch threshold` },
  minProfitDiffForSwitch: { cs: `min rozdíl zisku pro přepnutí`, en: `min profit diff for switch` },
  checkInterval: { cs: `Interval kontroly`, en: `Check interval` },
  recalcPeriod: { cs: `perioda přepočtu`, en: `recalc period` },
  minTimeOnAlgo: { cs: `Min čas na algoritmu`, en: `Min time on algo` },
  antiFlapGuard: { cs: `anti-flap ochrana`, en: `anti-flap guard` },
};

interface AlgoStatus {
  algo: string;
  coin: string;
  profitPerDay: number;
  trend24h: number;
  isActive: boolean;
  poolUrl: string;
  enabled: boolean;
}

interface ManagerStatus {
  mode: 'auto' | 'manual';
  activeAlgo: string;
  activeCoin: string;
  profitPerDay: number;
  nextCheckIn: number;
  connectedMiners: number;
  totalHashrate: string;
}

// Mock data - will be replaced with API calls
const MOCK_ALGOS: AlgoStatus[] = [
  { algo: 'kheavyhash', coin: 'KAS', profitPerDay: 3.12, trend24h: 5, isActive: false, poolUrl: 'kas.2miners.com:2020', enabled: true },
  { algo: 'kawpow', coin: 'RVN', profitPerDay: 2.45, trend24h: 0, isActive: true, poolUrl: 'rvn.2miners.com:6060', enabled: true },
  { algo: 'autolykos2', coin: 'ERG', profitPerDay: 2.21, trend24h: -3, isActive: false, poolUrl: 'erg.2miners.com:8888', enabled: true },
  { algo: 'blake3', coin: 'ALPH', profitPerDay: 1.89, trend24h: 2, isActive: false, poolUrl: 'alph.2miners.com:1199', enabled: true },
  { algo: 'ethash', coin: 'ETC', profitPerDay: 1.45, trend24h: -8, isActive: false, poolUrl: 'etc.2miners.com:1010', enabled: false },
];

const MOCK_STATUS: ManagerStatus = {
  mode: 'auto',
  activeAlgo: 'kawpow',
  activeCoin: 'RVN',
  profitPerDay: 2.45,
  nextCheckIn: 154,
  connectedMiners: 42,
  totalHashrate: '1.2 GH/s',
};

export default function AlgoManagerPage() {
  const { lang } = useLang();
  const [status, setStatus] = useState<ManagerStatus>(MOCK_STATUS);
  const [algos, setAlgos] = useState<AlgoStatus[]>(MOCK_ALGOS);
  const [settings, setSettings] = useState({
    switchThreshold: 10,
    checkInterval: 5,
    minTimeOnAlgo: 15,
  });
  const [countdown, setCountdown] = useState(status.nextCheckIn);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : status.nextCheckIn));
    }, 1000);
    return () => clearInterval(timer);
  }, [status.nextCheckIn]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min} min ${sec.toString().padStart(2, '0')} sec`;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '📈';
    if (trend < 0) return '📉';
    return '📊';
  };

  const handleSwitch = async (algo: string) => {
    console.log(`Switching to ${algo}`);
    setAlgos(algos.map(a => ({
      ...a,
      isActive: a.algo === algo
    })));
    setStatus((prev) => {
      const selected = algos.find((a) => a.algo === algo);
      return {
        ...prev,
        activeAlgo: algo,
        activeCoin: selected?.coin ?? prev.activeCoin,
        profitPerDay: selected?.profitPerDay ?? prev.profitPerDay,
      };
    });
  };

  const handleModeToggle = () => {
    setStatus(prev => ({
      ...prev,
      mode: prev.mode === 'auto' ? 'manual' : 'auto'
    }));
  };

  return (
    <div className="pt-28 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">
        <div className="zion-rainbow-card p-5 sm:p-8 md:p-10" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{AdminAlgoManagerCopy.miningRouting[lang === 'cs' ? 'cs' : 'en']}</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">{AdminAlgoManagerCopy.algorithmManager[lang === 'cs' ? 'cs' : 'en']}</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                {AdminAlgoManagerCopy.algorithmSwitchingAndAutoManua[lang === 'cs' ? 'cs' : 'en']}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="zion-rainbow-sub px-4 py-3 text-sm text-gray-300" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                {AdminAlgoManagerCopy.autoSwitch[lang === 'cs' ? 'cs' : 'en']}
              </div>
              <button
                onClick={handleModeToggle}
                className={status.mode === 'auto' ? 'zion-button-primary' : 'zion-button-secondary'}
              >
                {status.mode === 'auto' ? 'ON' : 'OFF'}
              </button>
              <Link
                href="/admin"
                className="zion-button-secondary"
              >
                {AdminAlgoManagerCopy.back[lang === 'cs' ? 'cs' : 'en']}
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.mode[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{status.mode.toUpperCase()}</p>
              <p className="text-sm text-gray-300">{status.mode === 'auto' ? (AdminAlgoManagerCopy.profitabilityBased[lang === 'cs' ? 'cs' : 'en']) : (AdminAlgoManagerCopy.operatorControlled[lang === 'cs' ? 'cs' : 'en'])}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.active[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{status.activeAlgo.toUpperCase()}</p>
              <p className="text-sm text-gray-300">{status.activeCoin}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.profitDay[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">${status.profitPerDay.toFixed(2)}</p>
              <p className="text-sm text-gray-300">{AdminAlgoManagerCopy.perGpuBaseline[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.nextCheck[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatTime(countdown)}</p>
              <p className="text-sm text-gray-300">{AdminAlgoManagerCopy.schedulerTick[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-300">
            <div className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              {AdminAlgoManagerCopy.connectedMiners[lang === 'cs' ? 'cs' : 'en']}: <span className="text-white font-semibold">{status.connectedMiners}</span>
            </div>
            <div className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              {AdminAlgoManagerCopy.totalHashrate[lang === 'cs' ? 'cs' : 'en']}: <span className="text-white font-semibold">{status.totalHashrate}</span>
            </div>
          </div>
        </div>

        <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.profitability[lang === 'cs' ? 'cs' : 'en']}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{AdminAlgoManagerCopy.liveTable[lang === 'cs' ? 'cs' : 'en']}</h2>
              <p className="mt-2 text-sm text-gray-300">{AdminAlgoManagerCopy.mockDataRtx4090Baseline[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
            <Link
              href="/admin/pool-config"
              className="zion-button-secondary"
            >
              {AdminAlgoManagerCopy.poolConfiguration[lang === 'cs' ? 'cs' : 'en']}
            </Link>
          </div>

          <div className="zion-rainbow-sub p-0 mt-6 overflow-x-auto" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-gray-300">
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">{AdminAlgoManagerCopy.algorithm[lang === 'cs' ? 'cs' : 'en']}</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">Coin</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">$/den</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">24h</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">{AdminAlgoManagerCopy.status[lang === 'cs' ? 'cs' : 'en']}</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">{AdminAlgoManagerCopy.action[lang === 'cs' ? 'cs' : 'en']}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {algos
                  .filter(a => a.enabled)
                  .sort((a, b) => b.profitPerDay - a.profitPerDay)
                  .map((algo) => (
                    <tr key={algo.algo}>
                      <td className="px-4 py-4 font-semibold text-white">{algo.algo.toUpperCase()}</td>
                      <td className="px-4 py-4">
                        <span className="zion-badge">
                          {algo.coin}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-white">${algo.profitPerDay.toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <span className={algo.trend24h > 0 ? 'zion-badge zion-badge-green' : algo.trend24h < 0 ? 'zion-badge zion-badge-red' : 'zion-badge'}>
                          {getTrendIcon(algo.trend24h)} {algo.trend24h > 0 ? '+' : ''}{algo.trend24h}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {algo.isActive ? (
                          <span className="zion-badge zion-badge-green">{AdminAlgoManagerCopy.active_2[lang === 'cs' ? 'cs' : 'en']}</span>
                        ) : (
                          <span className="zion-badge">{AdminAlgoManagerCopy.standby[lang === 'cs' ? 'cs' : 'en']}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {algo.isActive ? (
                          <span className="text-gray-500">—</span>
                        ) : (
                          <button
                            onClick={() => handleSwitch(algo.algo)}
                            className="zion-button-secondary text-xs px-4 py-2"
                          >
                            {AdminAlgoManagerCopy.switch[lang === 'cs' ? 'cs' : 'en']}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.tuning[lang === 'cs' ? 'cs' : 'en']}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{AdminAlgoManagerCopy.settings[lang === 'cs' ? 'cs' : 'en']}</h2>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.switchThreshold[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{settings.switchThreshold}%</p>
              <input
                type="range"
                min="5"
                max="25"
                value={settings.switchThreshold}
                onChange={(e) => setSettings({ ...settings, switchThreshold: parseInt(e.target.value) })}
                className="mt-4 w-full"
              />
              <p className="mt-2 text-sm text-gray-300">{AdminAlgoManagerCopy.minProfitDiffForSwitch[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>

            <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.checkInterval[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{settings.checkInterval} min</p>
              <input
                type="range"
                min="1"
                max="15"
                value={settings.checkInterval}
                onChange={(e) => setSettings({ ...settings, checkInterval: parseInt(e.target.value) })}
                className="mt-4 w-full"
              />
              <p className="mt-2 text-sm text-gray-300">{AdminAlgoManagerCopy.recalcPeriod[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>

            <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminAlgoManagerCopy.minTimeOnAlgo[lang === 'cs' ? 'cs' : 'en']}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{settings.minTimeOnAlgo} min</p>
              <input
                type="range"
                min="5"
                max="60"
                value={settings.minTimeOnAlgo}
                onChange={(e) => setSettings({ ...settings, minTimeOnAlgo: parseInt(e.target.value) })}
                className="mt-4 w-full"
              />
              <p className="mt-2 text-sm text-gray-300">{AdminAlgoManagerCopy.antiFlapGuard[lang === 'cs' ? 'cs' : 'en']}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
