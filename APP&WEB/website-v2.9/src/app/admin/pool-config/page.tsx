'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

interface PoolConfig {
  algo: string;
  coin: string;
  enabled: boolean;
  poolUrl: string;
  wallet: string;
  workerPrefix: string;
  priority: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
}

const INITIAL_CONFIGS: PoolConfig[] = [
  {
    algo: 'autolykos2',
    coin: 'ERG',
    enabled: true,
    poolUrl: 'erg.2miners.com:8888',
    wallet: '9f4QF8AD1nQ3nMqVbNUgA5vmRiYPF3UBjx7sHJxhJJnWiZH6q',
    workerPrefix: 'zion',
    priority: 1,
    connectionStatus: 'connected',
  },
  {
    algo: 'kawpow',
    coin: 'RVN',
    enabled: true,
    poolUrl: 'rvn.2miners.com:6060',
    wallet: 'RVN_WALLET_ADDRESS_HERE',
    workerPrefix: 'zion',
    priority: 1,
    connectionStatus: 'connected',
  },
  {
    algo: 'kheavyhash',
    coin: 'KAS',
    enabled: true,
    poolUrl: 'kas.2miners.com:2020',
    wallet: 'kaspa:qzxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    workerPrefix: 'zion',
    priority: 1,
    connectionStatus: 'disconnected',
  },
  {
    algo: 'blake3',
    coin: 'ALPH',
    enabled: true,
    poolUrl: 'alph.2miners.com:1199',
    wallet: 'ALPH_WALLET_ADDRESS_HERE',
    workerPrefix: 'zion',
    priority: 2,
    connectionStatus: 'connected',
  },
  {
    algo: 'ethash',
    coin: 'ETC',
    enabled: false,
    poolUrl: 'etc.2miners.com:1010',
    wallet: '0x_ETC_WALLET_ADDRESS',
    workerPrefix: 'zion',
    priority: 3,
    connectionStatus: 'disconnected',
  },
  {
    algo: 'equihash',
    coin: 'ZEC',
    enabled: false,
    poolUrl: 'zec.2miners.com:1010',
    wallet: 'ZEC_WALLET_ADDRESS',
    workerPrefix: 'zion',
    priority: 3,
    connectionStatus: 'disconnected',
  },
  {
    algo: 'randomx',
    coin: 'XMR',
    enabled: true,
    poolUrl: 'xmr.2miners.com:2222',
    wallet: 'XMR_WALLET_ADDRESS_HERE',
    workerPrefix: 'zion',
    priority: 1,
    connectionStatus: 'connected',
  },
];

export default function PoolConfigPage() {
  const { lang } = useLang();
  const [configs, setConfigs] = useState<PoolConfig[]>(INITIAL_CONFIGS);
  const [testing, setTesting] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const updateConfig = (algo: string, field: keyof PoolConfig, value: any) => {
    setConfigs(configs.map(c => 
      c.algo === algo ? { ...c, [field]: value } : c
    ));
    setSaved(false);
  };

  const testConnection = async (algo: string) => {
    setTesting(algo);
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 2000));
    setConfigs(configs.map(c =>
      c.algo === algo ? { ...c, connectionStatus: 'connected' } : c
    ));
    setTesting(null);
  };

  const testAllConnections = async () => {
    for (const config of configs.filter(c => c.enabled)) {
      await testConnection(config.algo);
    }
  };

  const saveConfiguration = async () => {
    // TODO: API call to save configuration
    console.log('Saving configuration:', configs);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '🟢';
      case 'disconnected': return '🔴';
      case 'error': return '🟠';
      default: return '⚪';
    }
  };

  const gpuConfigs = configs.filter(c => c.algo !== 'randomx');
  const cpuConfigs = configs.filter(c => c.algo === 'randomx');

  return (
    <div className="pt-28 pb-20 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-12">
        <div className="rounded-[32px] border border-white/10 bg-black/60 p-5 sm:p-8 md:p-10 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{lang === 'cs' ? 'Routing' : 'Routing'}</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">{lang === 'cs' ? 'Pool konfigurace' : 'Pool configuration'}</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                {lang === 'cs'
                  ? 'Nastavení pool endpointů, walletů a worker prefixu pro každý algoritmus. Zatím mock UI — dokud se nepřipojí per-algo config endpointy.'
                  : 'Pool endpoint, wallet, and worker prefix settings for each algorithm. Currently mock UI — until per-algo config endpoints are connected.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={testAllConnections}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold hover:border-white/30"
              >
                {lang === 'cs' ? 'Testovat spojení' : 'Test connections'}
              </button>
              <button
                onClick={saveConfiguration}
                className={`inline-flex items-center justify-center rounded-2xl border px-6 py-3 text-sm font-semibold transition-colors ${
                  saved ? 'border-emerald-500/50 bg-white/10 text-white' : 'border-zion-gold/50 bg-white/10 text-white hover:border-white/30'
                }`}
              >
                {saved ? (lang === 'cs' ? 'Uloženo' : 'Saved') : (lang === 'cs' ? 'Uložit' : 'Save')}
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 px-6 py-3 text-sm font-semibold hover:border-white/30"
              >
                {lang === 'cs' ? 'Zpět' : 'Back'}
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/50 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">GPU</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{lang === 'cs' ? 'GPU mining trasy' : 'GPU mining routes'}</h2>
          <p className="mt-2 text-sm text-gray-300">{lang === 'cs' ? 'Multi-algo seznam (mock data)' : 'Multi-algo list (mock data)'}</p>

          <div className="mt-6 space-y-4">
            {gpuConfigs.map((config) => (
              <div
                key={config.algo}
                className={`rounded-2xl border p-5 ${
                  config.enabled ? 'border-white/10 bg-white/5' : 'border-white/5 bg-black/40 opacity-70'
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateConfig(config.algo, 'enabled', e.target.checked)}
                      className="h-5 w-5"
                    />
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {config.coin}{' '}
                        <span className="text-sm text-gray-400">({config.algo.toUpperCase()})</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {getStatusIcon(config.connectionStatus)} {config.connectionStatus}
                      </p>
                    </div>
                  </label>

                  <div className="flex items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Priorita' : 'Priority'}</p>
                    <select
                      value={config.priority}
                      onChange={(e) => updateConfig(config.algo, 'priority', parseInt(e.target.value))}
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                      disabled={!config.enabled}
                    >
                      <option value={1}>{lang === 'cs' ? 'Vysoká' : 'High'}</option>
                      <option value={2}>{lang === 'cs' ? 'Střední' : 'Medium'}</option>
                      <option value={3}>{lang === 'cs' ? 'Nízká' : 'Low'}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Pool URL</p>
                    <input
                      type="text"
                      value={config.poolUrl}
                      onChange={(e) => updateConfig(config.algo, 'poolUrl', e.target.value)}
                      disabled={!config.enabled}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white disabled:opacity-50"
                      placeholder="pool.example.com:port"
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Wallet</p>
                    <input
                      type="text"
                      value={config.wallet}
                      onChange={(e) => updateConfig(config.algo, 'wallet', e.target.value)}
                      disabled={!config.enabled}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white disabled:opacity-50"
                      placeholder={lang === 'cs' ? 'Wallet adresa' : 'Wallet address'}
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Worker prefix' : 'Worker prefix'}</p>
                      <input
                        type="text"
                        value={config.workerPrefix}
                        onChange={(e) => updateConfig(config.algo, 'workerPrefix', e.target.value)}
                        disabled={!config.enabled}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white disabled:opacity-50"
                        placeholder="zion"
                      />
                    </div>
                    <button
                      onClick={() => testConnection(config.algo)}
                      disabled={!config.enabled || testing === config.algo}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:border-white/30 disabled:opacity-50"
                    >
                      {testing === config.algo ? '…' : (lang === 'cs' ? 'Test' : 'Test')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/50 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">CPU</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{lang === 'cs' ? 'CPU mining trasy' : 'CPU mining routes'}</h2>
          <p className="mt-2 text-sm text-gray-300">{lang === 'cs' ? 'RandomX / CPU mineři (mock data)' : 'RandomX / CPU miners (mock data)'}</p>

          <div className="mt-6 space-y-4">
            {cpuConfigs.map((config) => (
              <div
                key={config.algo}
                className={`rounded-2xl border p-5 ${
                  config.enabled ? 'border-white/10 bg-white/5' : 'border-white/5 bg-black/40 opacity-70'
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateConfig(config.algo, 'enabled', e.target.checked)}
                      className="h-5 w-5"
                    />
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {config.coin}{' '}
                        <span className="text-sm text-gray-400">({config.algo.toUpperCase()})</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {getStatusIcon(config.connectionStatus)} {config.connectionStatus}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Pool URL</p>
                    <input
                      type="text"
                      value={config.poolUrl}
                      onChange={(e) => updateConfig(config.algo, 'poolUrl', e.target.value)}
                      disabled={!config.enabled}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Wallet</p>
                    <input
                      type="text"
                      value={config.wallet}
                      onChange={(e) => updateConfig(config.algo, 'wallet', e.target.value)}
                      disabled={!config.enabled}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white disabled:opacity-50"
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Worker prefix' : 'Worker prefix'}</p>
                      <input
                        type="text"
                        value={config.workerPrefix}
                        onChange={(e) => updateConfig(config.algo, 'workerPrefix', e.target.value)}
                        disabled={!config.enabled}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white disabled:opacity-50"
                      />
                    </div>
                    <button
                      onClick={() => testConnection(config.algo)}
                      disabled={!config.enabled || testing === config.algo}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:border-white/30 disabled:opacity-50"
                    >
                      {testing === config.algo ? '…' : (lang === 'cs' ? 'Test' : 'Test')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/50 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{lang === 'cs' ? 'Poznámky' : 'Notes'}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{lang === 'cs' ? 'Konfigurační poznámky' : 'Configuration notes'}</h3>
          <ul className="mt-4 space-y-2 text-sm text-gray-300">
            <li>• {lang === 'cs' ? 'Změny se projeví po uložení (a typicky po reconnectu pool klienta).' : 'Changes take effect after saving (and typically after pool client reconnect).'}</li>
            <li>• {lang === 'cs' ? 'Wallet adresy musí odpovídat síti konkrétní mince.' : 'Wallet addresses must match the network of the specific coin.'}</li>
            <li>• {lang === 'cs' ? 'Worker prefix pomáhá identifikovat ZION workery na externích poolech.' : 'Worker prefix helps identify ZION workers on external pools.'}</li>
            <li>• {lang === 'cs' ? 'Před produkcí vždy otestovat konektivitu.' : 'Always test connectivity before production.'}</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/algo-manager"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold hover:border-white/30"
          >
            {lang === 'cs' ? 'Správce algoritmů →' : 'Algorithm manager →'}
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 px-6 py-3 text-sm font-semibold hover:border-white/30"
          >
            ← {lang === 'cs' ? 'Admin' : 'Admin'}
          </Link>
        </div>
      </div>
    </div>
  );
}
