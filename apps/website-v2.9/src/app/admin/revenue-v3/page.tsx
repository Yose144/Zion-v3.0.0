'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';

const AdminRevenueV3Copy = {
  saving: { cs: `Ukládání...`, en: `Saving...` },
  settingsSavedSuccessfully: { cs: `✅ Nastavení úspěšně uložena!`, en: `✅ Settings saved successfully!` },
  loadingSettings: { cs: `Načítání nastavení...`, en: `Loading Settings...` },
  failedToLoadConfiguration: { cs: `Nepodařilo se načíst konfiguraci.`, en: `Failed to load configuration.` },
  cosmicHarmonyV3RevenueSettings: { cs: `Cosmic Harmony v3 — Nastavení příjmů`, en: `Cosmic Harmony v3 Revenue Settings` },
  refresh: { cs: `Obnovit`, en: `Refresh` },
  readOnlyNotice: { cs: `Konfigurace je jen pro čtení — změny provádí operátor v souboru nastavení.`, en: `Configuration is read-only — changes are made by the operator in the settings file.` },
  error: { cs: `Chyba`, en: `Error` },
  nclArtificialIntelligence: { cs: `NCL Umělá inteligence`, en: `NCL Artificial Intelligence` },
  enabled: { cs: `Aktivní`, en: `Enabled` },
  npuAllocation0010: { cs: `NPU Alokace (0.0 - 1.0)`, en: `NPU Allocation (0.0 - 1.0)` },
  percentageOfNpuResourcesDedica: { cs: `Procento NPU zdrojů věnovaných AI úkolům.`, en: `Percentage of NPU resources dedicated to AI tasks.` },
  revenueTargetShare: { cs: `Cílový podíl příjmů`, en: `Revenue Target Share` },
  zionNativeChain: { cs: `ZION Nativní Chain`, en: `ZION Native Chain` },
  alwaysEnabled: { cs: `Vždy aktivní`, en: `Always Enabled` },
  targetShare: { cs: `Cílový podíl`, en: `Target Share` },
  etcExternal: { cs: `ETC (Externí)`, en: `ETC (External)` },
  poolStratumUrl: { cs: `Pool Stratum URL`, en: `Pool Stratum URL` },
  walletAddress: { cs: `Adresa peněženky`, en: `Wallet Address` },
  nxsExternal: { cs: `NXS (Externí)`, en: `NXS (External)` },
  pearlPrlPouwGpu: { cs: `Pearl PRL (PoUW GPU)`, en: `Pearl PRL (PoUW GPU)` },
  pearlhashPouwInt8MatmulBlake3P: { cs: `PearlHash PoUW — INT8 MatMul + BLAKE3 + Plonky2 ZK. GPU-nativní OpenCL těžba (~657 nonces/s na RX 5700 XT, 14x vs CPU).`, en: `PearlHash PoUW — INT8 MatMul + BLAKE3 + Plonky2 ZK. GPU-native OpenCL mining (~657 nonces/s on RX 5700 XT, 14x vs CPU).` },
};

const REVENUE_CONFIG_API = '/api/v2.9/revenue/config';

interface PoolConfig {
  stratum: string;
  wallet: string;
  worker: string;
  enabled: boolean;
}

interface RevenueConfig {
  streams: {
    zion: { enabled: boolean; target_share: number };
    etc: { enabled: boolean; target_share: number; pool: PoolConfig };
    nxs: { enabled: boolean; target_share: number; pool: PoolConfig };
    dynamic_gpu: { enabled: boolean; target_share: number; pools: Record<string, PoolConfig & { coin: string }> };
    ncl: { enabled: boolean; npu_allocation: number; target_share: number };
    pearl: { enabled: boolean; target_share: number; pool: PoolConfig };
  };
}

export default function RevenueSettings() {
  const { lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<RevenueConfig | null>(null);
  const [status, setStatus] = useState<string>('');

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(REVENUE_CONFIG_API);
      if (!res.ok) throw new Error('Failed to fetch config');
      const data = await res.json();
      setConfig(data);
    } catch (err: any) {
      console.error(err);
      setStatus(lang === 'cs' ? `Chyba při načítání konfigurace: ${err.message}` : `Error loading config: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateStream = (streamName: keyof RevenueConfig['streams'], field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      streams: {
        ...config.streams,
        [streamName]: {
          ...config.streams[streamName],
          [field]: value
        }
      }
    });
  };
  
  const updatePool = (streamName: keyof RevenueConfig['streams'], field: string, value: any) => {
      if (!config) return;
      const currentStream = config.streams[streamName] as any;
      if (!currentStream.pool) return;
      
      setConfig({
        ...config,
        streams: {
          ...config.streams,
          [streamName]: {
            ...currentStream,
            pool: {
              ...currentStream.pool,
              [field]: value
            }
          }
        }
      });
  };

  if (loading) return <div className="flex items-center justify-center"><div className="text-zion-gold text-2xl animate-pulse">{tx5(AdminRevenueV3Copy.loadingSettings, lang)}</div></div>;
  if (!config) return <div className="flex items-center justify-center"><div className="text-zion-purple text-xl">{tx5(AdminRevenueV3Copy.failedToLoadConfiguration, lang)}</div></div>;

  return (
    <div className="pt-28 md:pt-32 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-4xl space-y-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zion-purple to-zion-purple">
          {tx5(AdminRevenueV3Copy.cosmicHarmonyV3RevenueSettings, lang)}
        </h1>
        <div className="flex gap-4">
            <span className="text-sm text-gray-400 self-center">
                {tx5(AdminRevenueV3Copy.readOnlyNotice, lang)}
            </span>
            <button
                onClick={fetchConfig}
                className="zion-button-secondary"
            >
                {tx5(AdminRevenueV3Copy.refresh, lang)}
            </button>
        </div>
      </div>

      {status && (
        <div
          className="zion-rainbow-card p-4"
          style={{ '--rc': status.includes(tx5(AdminRevenueV3Copy.error, lang)) ? '228, 30, 43' : '6, 105, 40' } as React.CSSProperties}
        >
          {status}
        </div>
      )}

      <div className="grid gap-6">
        
        {/* NCL AI Section */}
        <section className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zion-purple">🤖 {tx5(AdminRevenueV3Copy.nclArtificialIntelligence, lang)}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{tx5(AdminRevenueV3Copy.enabled, lang)}</span>
                    <input
                        type="checkbox"
                        checked={config.streams.ncl.enabled}
                        onChange={(e) => updateStream('ncl', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                    <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.npuAllocation0010, lang)}</label>
                    <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={config.streams.ncl.npu_allocation}
                        onChange={(e) => updateStream('ncl', 'npu_allocation', parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">{tx5(AdminRevenueV3Copy.percentageOfNpuResourcesDedica, lang)}</p>
                </div>
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                    <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.revenueTargetShare, lang)}</label>
                    <input
                        type="number"
                        step="0.01"
                        value={config.streams.ncl.target_share}
                        onChange={(e) => updateStream('ncl', 'target_share', parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                    />
                </div>
            </div>
        </section>

        {/* ZION Native Section */}
        <section className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zion-purple">🌌 {tx5(AdminRevenueV3Copy.zionNativeChain, lang)}</h2>
                <div className="flex items-center gap-2">
                   <span className="zion-badge zion-badge-green">{tx5(AdminRevenueV3Copy.alwaysEnabled, lang)}</span>
                </div>
            </div>
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                 <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.targetShare, lang)}</label>
                 <input
                     type="number"
                     step="0.01"
                     value={config.streams.zion.target_share}
                     onChange={(e) => updateStream('zion', 'target_share', parseFloat(e.target.value))}
                     className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                 />
            </div>
        </section>

        {/* ETC Stream */}
        <section className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zion-cyan">⛏️ {tx5(AdminRevenueV3Copy.etcExternal, lang)}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{tx5(AdminRevenueV3Copy.enabled, lang)}</span>
                    <input
                        type="checkbox"
                        checked={config.streams.etc.enabled}
                        onChange={(e) => updateStream('etc', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600"
                    />
                </div>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.poolStratumUrl, lang)}</label>
                        <input
                            type="text"
                            value={config.streams.etc.pool.stratum}
                            onChange={(e) => updatePool('etc', 'stratum', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                        />
                     </div>
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.walletAddress, lang)}</label>
                        <input
                            type="text"
                            value={config.streams.etc.pool.wallet}
                            onChange={(e) => updatePool('etc', 'wallet', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                        />
                     </div>
                </div>
            </div>
        </section>

         {/* NXS Stream */}
         <section className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zion-gold">💎 {tx5(AdminRevenueV3Copy.nxsExternal, lang)}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{tx5(AdminRevenueV3Copy.enabled, lang)}</span>
                    <input
                        type="checkbox"
                        checked={config.streams.nxs.enabled}
                        onChange={(e) => updateStream('nxs', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600"
                    />
                </div>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.poolStratumUrl, lang)}</label>
                        <input
                            type="text"
                            value={config.streams.nxs.pool.stratum}
                            onChange={(e) => updatePool('nxs', 'stratum', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                        />
                     </div>
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.walletAddress, lang)}</label>
                        <input
                            type="text"
                            value={config.streams.nxs.pool.wallet}
                            onChange={(e) => updatePool('nxs', 'wallet', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                        />
                     </div>
                </div>
            </div>
        </section>

        {/* Pearl (PRL) Stream */}
        <section className="zion-rainbow-card p-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zion-cyan">🐚 {tx5(AdminRevenueV3Copy.pearlPrlPouwGpu, lang)}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{tx5(AdminRevenueV3Copy.enabled, lang)}</span>
                    <input
                        type="checkbox"
                        checked={config.streams.pearl?.enabled ?? false}
                        onChange={(e) => updateStream('pearl', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600"
                    />
                </div>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.poolStratumUrl, lang)}</label>
                        <input
                            type="text"
                            value={config.streams.pearl?.pool?.stratum ?? ''}
                            onChange={(e) => updatePool('pearl', 'stratum', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                            placeholder="stratum+tcp://us2.alphapool.tech:5566"
                        />
                     </div>
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.walletAddress, lang)}</label>
                        <input
                            type="text"
                            value={config.streams.pearl?.pool?.wallet ?? ''}
                            onChange={(e) => updatePool('pearl', 'wallet', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                            placeholder="bc1q..."
                        />
                     </div>
                </div>
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                    <label className="block text-sm font-medium mb-1">{tx5(AdminRevenueV3Copy.revenueTargetShare, lang)}</label>
                    <input
                        type="number"
                        step="0.01"
                        value={config.streams.pearl?.target_share ?? 0.05}
                        onChange={(e) => updateStream('pearl', 'target_share', parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        {tx5(AdminRevenueV3Copy.pearlhashPouwInt8MatmulBlake3P, lang)}
                    </p>
                </div>
            </div>
        </section>

      </div>
    </div>
  </div>
  );
}
