'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LanguageContext';

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
  };
}

export default function RevenueSettings() {
  const { lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RevenueConfig | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
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
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setStatus(lang === 'cs' ? 'Ukládání...' : 'Saving...');
    try {
      const res = await fetch(REVENUE_CONFIG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
      setStatus(lang === 'cs' ? '✅ Nastavení úspěšně uložena!' : '✅ Settings saved successfully!');
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

  if (loading) return <div className="flex items-center justify-center"><div className="text-yellow-400 text-2xl animate-pulse">{lang === 'cs' ? 'Načítání nastavení...' : 'Loading Settings...'}</div></div>;
  if (!config) return <div className="flex items-center justify-center"><div className="text-red-400 text-xl">{lang === 'cs' ? 'Nepodařilo se načíst konfiguraci.' : 'Failed to load configuration.'}</div></div>;

  return (
    <div className="pt-28 md:pt-32 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-4xl space-y-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          {lang === 'cs' ? 'Cosmic Harmony v3 — Nastavení příjmů' : 'Cosmic Harmony v3 Revenue Settings'}
        </h1>
        <div className="flex gap-4">
            <button 
                onClick={fetchConfig}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition"
                disabled={saving}
            >
                {lang === 'cs' ? 'Obnovit' : 'Refresh'}
            </button>
            <button 
                onClick={handleSave}
                className="px-6 py-2 rounded bg-green-600 hover:bg-green-500 font-bold transition shadow-lg shadow-green-900/20"
                disabled={saving}
            >
                {saving ? (lang === 'cs' ? 'Ukládání...' : 'Saving...') : (lang === 'cs' ? 'Uložit konfiguraci' : 'Save Configuration')}
            </button>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-lg border ${status.includes(lang === 'cs' ? 'Chyba' : 'Error') ? 'bg-red-900/20 border-red-500/50 text-red-200' : 'bg-green-900/20 border-green-500/50 text-green-200'}`}>
          {status}
        </div>
      )}

      <div className="grid gap-6">
        
        {/* NCL AI Section */}
        <section className="zion-section p-6" style={{ '--rc': '168, 85, 247' } as React.CSSProperties}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-purple-300">🤖 {lang === 'cs' ? 'NCL Umělá inteligence' : 'NCL Artificial Intelligence'}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{lang === 'cs' ? 'Aktivní' : 'Enabled'}</span>
                    <input 
                        type="checkbox" 
                        checked={config.streams.ncl.enabled}
                        onChange={(e) => updateStream('ncl', 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">{lang === 'cs' ? 'NPU Alokace (0.0 - 1.0)' : 'NPU Allocation (0.0 - 1.0)'}</label>
                    <input 
                        type="number" 
                        step="0.05"
                        min="0"
                        max="1"
                        value={config.streams.ncl.npu_allocation}
                        onChange={(e) => updateStream('ncl', 'npu_allocation', parseFloat(e.target.value))}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                    />
                    <p className="text-xs text-gray-400 mt-1">{lang === 'cs' ? 'Procento NPU zdrojů věnovaných AI úkolům.' : 'Percentage of NPU resources dedicated to AI tasks.'}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">{lang === 'cs' ? 'Cílový podíl příjmů' : 'Revenue Target Share'}</label>
                    <input 
                        type="number"
                        step="0.01"
                        value={config.streams.ncl.target_share}
                        onChange={(e) => updateStream('ncl', 'target_share', parseFloat(e.target.value))}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                    />
                </div>
            </div>
        </section>

        {/* ZION Native Section */}
        <section className="zion-section p-6" style={{ '--rc': '59, 130, 246' } as React.CSSProperties}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-blue-300">🌌 {lang === 'cs' ? 'ZION Nativní Chain' : 'ZION Native Chain'}</h2>
                <div className="flex items-center gap-2">
                   <span className="text-gray-400">{lang === 'cs' ? 'Vždy aktivní' : 'Always Enabled'}</span>
                </div>
            </div>
            <div>
                 <label className="block text-sm font-medium mb-1">{lang === 'cs' ? 'Cílový podíl' : 'Target Share'}</label>
                 <input 
                     type="number"
                     step="0.01"
                     value={config.streams.zion.target_share}
                     onChange={(e) => updateStream('zion', 'target_share', parseFloat(e.target.value))}
                     className="w-full bg-gray-900 border border-gray-700 rounded p-2"
                 />
            </div>
        </section>

        {/* ETC Stream */}
        <section className="zion-section p-6" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-green-300">⛏️ {lang === 'cs' ? 'ETC (Externí)' : 'ETC (External)'}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{lang === 'cs' ? 'Aktivní' : 'Enabled'}</span>
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
                     <div>
                        <label className="block text-sm font-medium mb-1">{lang === 'cs' ? 'Pool Stratum URL' : 'Pool Stratum URL'}</label>
                        <input 
                            type="text" 
                            value={config.streams.etc.pool.stratum}
                            onChange={(e) => updatePool('etc', 'stratum', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 font-mono text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{lang === 'cs' ? 'Adresa peněženky' : 'Wallet Address'}</label>
                        <input 
                            type="text" 
                            value={config.streams.etc.pool.wallet}
                            onChange={(e) => updatePool('etc', 'wallet', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 font-mono text-sm"
                        />
                     </div>
                </div>
            </div>
        </section>

         {/* NXS Stream */}
         <section className="zion-section p-6" style={{ '--rc': '249, 115, 22' } as React.CSSProperties}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-orange-300">💎 {lang === 'cs' ? 'NXS (Externí)' : 'NXS (External)'}</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{lang === 'cs' ? 'Aktivní' : 'Enabled'}</span>
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
                     <div>
                        <label className="block text-sm font-medium mb-1">{lang === 'cs' ? 'Pool Stratum URL' : 'Pool Stratum URL'}</label>
                        <input 
                            type="text" 
                            value={config.streams.nxs.pool.stratum}
                            onChange={(e) => updatePool('nxs', 'stratum', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 font-mono text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{lang === 'cs' ? 'Adresa peněženky' : 'Wallet Address'}</label>
                        <input 
                            type="text" 
                            value={config.streams.nxs.pool.wallet}
                            onChange={(e) => updatePool('nxs', 'wallet', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 font-mono text-sm"
                        />
                     </div>
                </div>
            </div>
        </section>

      </div>
    </div>
  </div>
  );
}
