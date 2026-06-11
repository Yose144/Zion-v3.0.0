'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

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
        <div className="rounded-[32px] border border-white/10 bg-black/60 p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{lang === 'cs' ? 'Mining routing' : 'Mining routing'}</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">{lang === 'cs' ? 'Správce algoritmů' : 'Algorithm manager'}</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                {lang === 'cs'
                  ? 'Přepínání algoritmů a režim auto/manual. Aktuálně běží na mock datech, dokud se nedopojí pool API.'
                  : 'Algorithm switching and auto/manual mode. Currently running on mock data until pool API is connected.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
                {lang === 'cs' ? 'Auto-přepínání' : 'Auto-switch'}
              </div>
              <button
                onClick={handleModeToggle}
                className={`inline-flex items-center justify-center rounded-2xl border px-6 py-3 text-sm font-semibold transition-colors ${
                  status.mode === 'auto'
                    ? 'border-zion-gold/50 bg-white/10 text-white'
                    : 'border-white/10 bg-black/40 text-gray-200 hover:border-white/30'
                }`}
              >
                {status.mode === 'auto' ? 'ON' : 'OFF'}
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 px-6 py-3 text-sm font-semibold hover:border-white/30"
              >
                {lang === 'cs' ? 'Zpět' : 'Back'}
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Režim' : 'Mode'}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{status.mode.toUpperCase()}</p>
              <p className="text-sm text-gray-300">{status.mode === 'auto' ? (lang === 'cs' ? 'založeno na ziskovosti' : 'profitability based') : (lang === 'cs' ? 'řízeno operátorem' : 'operator controlled')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Aktivní' : 'Active'}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{status.activeAlgo.toUpperCase()}</p>
              <p className="text-sm text-gray-300">{status.activeCoin}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Zisk/den' : 'Profit/day'}</p>
              <p className="mt-2 text-3xl font-semibold text-white">${status.profitPerDay.toFixed(2)}</p>
              <p className="text-sm text-gray-300">{lang === 'cs' ? 'na GPU baseline' : 'per GPU baseline'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Další kontrola' : 'Next check'}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatTime(countdown)}</p>
              <p className="text-sm text-gray-300">{lang === 'cs' ? 'scheduler tick' : 'scheduler tick'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-300">
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              {lang === 'cs' ? 'Připojení mineři' : 'Connected miners'}: <span className="text-white font-semibold">{status.connectedMiners}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              {lang === 'cs' ? 'Celkový hashrate' : 'Total hashrate'}: <span className="text-white font-semibold">{status.totalHashrate}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/50 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Ziskovost' : 'Profitability'}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{lang === 'cs' ? 'Live tabulka' : 'Live table'}</h2>
              <p className="mt-2 text-sm text-gray-300">{lang === 'cs' ? 'Mock data (RTX 4090 baseline)' : 'Mock data (RTX 4090 baseline)'}</p>
            </div>
            <Link
              href="/admin/pool-config"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold hover:border-white/30"
            >
              {lang === 'cs' ? 'Pool konfigurace →' : 'Pool configuration →'}
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-gray-300">
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">{lang === 'cs' ? 'Algoritmus' : 'Algorithm'}</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">Coin</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">$/den</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">24h</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">{lang === 'cs' ? 'Status' : 'Status'}</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] font-semibold">{lang === 'cs' ? 'Akce' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {algos
                  .filter(a => a.enabled)
                  .sort((a, b) => b.profitPerDay - a.profitPerDay)
                  .map((algo) => (
                    <tr key={algo.algo} className="bg-black/30">
                      <td className="px-4 py-4 font-semibold text-white">{algo.algo.toUpperCase()}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white">
                          {algo.coin}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-white">${algo.profitPerDay.toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <span className={algo.trend24h > 0 ? 'text-emerald-300' : algo.trend24h < 0 ? 'text-red-300' : 'text-gray-400'}>
                          {getTrendIcon(algo.trend24h)} {algo.trend24h > 0 ? '+' : ''}{algo.trend24h}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {algo.isActive ? (
                          <span className="text-emerald-300 font-semibold">{lang === 'cs' ? 'AKTIVNÍ' : 'ACTIVE'}</span>
                        ) : (
                          <span className="text-gray-400">{lang === 'cs' ? 'Pohotovost' : 'Standby'}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {algo.isActive ? (
                          <span className="text-gray-500">—</span>
                        ) : (
                          <button
                            onClick={() => handleSwitch(algo.algo)}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:border-white/30"
                          >
                            {lang === 'cs' ? 'Přepnout' : 'Switch'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/50 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Ladění' : 'Tuning'}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{lang === 'cs' ? 'Nastavení' : 'Settings'}</h2>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Práh přepnutí' : 'Switch threshold'}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{settings.switchThreshold}%</p>
              <input
                type="range"
                min="5"
                max="25"
                value={settings.switchThreshold}
                onChange={(e) => setSettings({ ...settings, switchThreshold: parseInt(e.target.value) })}
                className="mt-4 w-full"
              />
              <p className="mt-2 text-sm text-gray-300">{lang === 'cs' ? 'min rozdíl zisku pro přepnutí' : 'min profit diff for switch'}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Interval kontroly' : 'Check interval'}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{settings.checkInterval} min</p>
              <input
                type="range"
                min="1"
                max="15"
                value={settings.checkInterval}
                onChange={(e) => setSettings({ ...settings, checkInterval: parseInt(e.target.value) })}
                className="mt-4 w-full"
              />
              <p className="mt-2 text-sm text-gray-300">{lang === 'cs' ? 'perioda přepočtu' : 'recalc period'}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Min čas na algoritmu' : 'Min time on algo'}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{settings.minTimeOnAlgo} min</p>
              <input
                type="range"
                min="5"
                max="60"
                value={settings.minTimeOnAlgo}
                onChange={(e) => setSettings({ ...settings, minTimeOnAlgo: parseInt(e.target.value) })}
                className="mt-4 w-full"
              />
              <p className="mt-2 text-sm text-gray-300">{lang === 'cs' ? 'anti-flap ochrana' : 'anti-flap guard'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
