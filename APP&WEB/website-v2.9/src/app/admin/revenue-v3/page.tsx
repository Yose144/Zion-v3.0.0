'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/contexts/LanguageContext';

const AdminRevenueV3Copy = {
  saving: { cs: `Ukládání...`, en: `Saving...` },
  settingsSavedSuccessfully: { cs: `✅ Nastavení úspěšně uložena!`, en: `✅ Settings saved successfully!` },
  loadingSettings: { cs: `Načítání nastavení...`, en: `Loading Settings...` },
  failedToLoadConfiguration: { cs: `Nepodařilo se načíst konfiguraci.`, en: `Failed to load configuration.` },
  cosmicHarmonyV3RevenueSettings: { cs: `Cosmic Harmony v3 — Nastavení příjmů`, en: `Cosmic Harmony v3 Revenue Settings` },
  refresh: { cs: `Obnovit`, en: `Refresh` },
  saveConfiguration: { cs: `Uložit konfiguraci`, en: `Save Configuration` },
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
  const [saving, setSaving] = useState(false);
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

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setStatus(AdminRevenueV3Copy.saving[lang === 'cs' ? 'cs' : 'en']);
    try {
      const res = await fetch(REVENUE_CONFIG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
      setStatus(AdminRevenueV3Copy.settingsSavedSuccessfully[lang === 'cs' ? 'cs' : 'en']);
    } catch (err: any) {
      console.error(err);
      setStatus(lang === 'cs' ? `Chyba při ukládání: ${err.message}` : `Error saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) return <div className="flex items-center justify-center"><div className="text-zion-gold text-2xl animate-pulse">{AdminRevenueV3Copy.loadingSettings[lang === 'cs' ? 'cs' : 'en']}</div></div>;
  if (!config) return <div className="flex items-center justify-center"><div className="text-zion-purple text-xl">{AdminRevenueV3Copy.failedToLoadConfiguration[lang === 'cs' ? 'cs' : 'en']}</div></div>;

  return (
    <div className="pt-28 md:pt-32 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-4xl space-y-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zion-purple to-zion-purple">
          {AdminRevenueV3Copy.cosmicHarmonyV3RevenueSettings[lang === 'cs' ? 'cs' : 'en']}
        </h1>
        <div className="flex gap-4">
            <button
                onClick={fetchConfig}
                className="zion-button-secondary"
                disabled={saving}
            >
                {AdminRevenueV3Copy.refresh[lang === 'cs' ? 'cs' : 'en']}
            </button>
            <button
                onClick={handleSave}
                className="zion-button-primary"
                disabled={saving}
            >
                {saving ? (AdminRevenueV3Copy.saving[lang === 'cs' ? 'cs' : 'en']) : (AdminRevenueV3Copy.saveConfiguration[lang === 'cs' ? 'cs' : 'en'])}
            </button>
        </div>
      </div>

      {status && (
        <div
          className="zion-rainbow-card p-4"
          style={{ '--rc': status.includes(AdminRevenueV3Copy.error[lang === 'cs' ? 'cs' : 'en']) ? '228, 30, 43' : '7, 137, 48' } as React.CSSProperties}
        >
          {status}
        </div>
      )}

      <div className="grid gap-6">
        
        {/* NCL AI Section */}
        <section className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zion-purple">🤖 {AdminRevenueV3Copy.nclArtificialIntelligence[lang === 'cs' ? 'cs' : 'en']}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{AdminRevenueV3Copy.enabled[lang === 'cs' ? 'cs' : 'en']}</span>
                    <input
                        type="checkbox"
                        checked={config.streams.ncl.enabled}
                        onChange={(e) => updateStream('ncl', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                    <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.npuAllocation0010[lang === 'cs' ? 'cs' : 'en']}</label>
                    <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={config.streams.ncl.npu_allocation}
                        onChange={(e) => updateStream('ncl', 'npu_allocation', parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">{AdminRevenueV3Copy.percentageOfNpuResourcesDedica[lang === 'cs' ? 'cs' : 'en']}</p>
                </div>
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                    <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.revenueTargetShare[lang === 'cs' ? 'cs' : 'en']}</label>
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
                <h2 className="text-xl font-bold text-zion-purple">🌌 {AdminRevenueV3Copy.zionNativeChain[lang === 'cs' ? 'cs' : 'en']}</h2>
                <div className="flex items-center gap-2">
                   <span className="zion-badge zion-badge-green">{AdminRevenueV3Copy.alwaysEnabled[lang === 'cs' ? 'cs' : 'en']}</span>
                </div>
            </div>
            <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                 <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.targetShare[lang === 'cs' ? 'cs' : 'en']}</label>
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
                <h2 className="text-xl font-bold text-zion-cyan">⛏️ {AdminRevenueV3Copy.etcExternal[lang === 'cs' ? 'cs' : 'en']}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{AdminRevenueV3Copy.enabled[lang === 'cs' ? 'cs' : 'en']}</span>
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
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.poolStratumUrl[lang === 'cs' ? 'cs' : 'en']}</label>
                        <input
                            type="text"
                            value={config.streams.etc.pool.stratum}
                            onChange={(e) => updatePool('etc', 'stratum', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                        />
                     </div>
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.walletAddress[lang === 'cs' ? 'cs' : 'en']}</label>
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
                <h2 className="text-xl font-bold text-zion-gold">💎 {AdminRevenueV3Copy.nxsExternal[lang === 'cs' ? 'cs' : 'en']}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{AdminRevenueV3Copy.enabled[lang === 'cs' ? 'cs' : 'en']}</span>
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
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.poolStratumUrl[lang === 'cs' ? 'cs' : 'en']}</label>
                        <input
                            type="text"
                            value={config.streams.nxs.pool.stratum}
                            onChange={(e) => updatePool('nxs', 'stratum', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                        />
                     </div>
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.walletAddress[lang === 'cs' ? 'cs' : 'en']}</label>
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
        <section className="zion-rainbow-card p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zion-cyan">🐚 {AdminRevenueV3Copy.pearlPrlPouwGpu[lang === 'cs' ? 'cs' : 'en']}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{AdminRevenueV3Copy.enabled[lang === 'cs' ? 'cs' : 'en']}</span>
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
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.poolStratumUrl[lang === 'cs' ? 'cs' : 'en']}</label>
                        <input
                            type="text"
                            value={config.streams.pearl?.pool?.stratum ?? ''}
                            onChange={(e) => updatePool('pearl', 'stratum', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                            placeholder="stratum+tcp://us2.alphapool.tech:5566"
                        />
                     </div>
                     <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                        <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.walletAddress[lang === 'cs' ? 'cs' : 'en']}</label>
                        <input
                            type="text"
                            value={config.streams.pearl?.pool?.wallet ?? ''}
                            onChange={(e) => updatePool('pearl', 'wallet', e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded p-2 font-mono text-sm text-white"
                            placeholder="bc1q..."
                        />
                     </div>
                </div>
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
                    <label className="block text-sm font-medium mb-1">{AdminRevenueV3Copy.revenueTargetShare[lang === 'cs' ? 'cs' : 'en']}</label>
                    <input
                        type="number"
                        step="0.01"
                        value={config.streams.pearl?.target_share ?? 0.05}
                        onChange={(e) => updateStream('pearl', 'target_share', parseFloat(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded p-2 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        {AdminRevenueV3Copy.pearlhashPouwInt8MatmulBlake3P[lang === 'cs' ? 'cs' : 'en']}
                    </p>
                </div>
            </div>
        </section>

      </div>
    </div>
  </div>
  );
}
