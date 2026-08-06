'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';

const AdminPoolConfigCopy = {
  routing: { cs: `Routing`, en: `Routing` },
  poolConfiguration: { cs: `Pool konfigurace`, en: `Pool configuration` },
  poolEndpointWalletAndWorkerPre: { cs: `Nastavení pool endpointů, walletů a worker prefixu pro každý algoritmus. Zatím mock UI — dokud se nepřipojí per-algo config endpointy.`, en: `Pool endpoint, wallet, and worker prefix settings for each algorithm. Currently mock UI — until per-algo config endpoints are connected.` },
  testConnections: { cs: `Testovat spojení`, en: `Test connections` },
  saved: { cs: `Uloženo`, en: `Saved` },
  save: { cs: `Uložit`, en: `Save` },
  back: { cs: `Zpět`, en: `Back` },
  gpuMiningRoutes: { cs: `GPU mining trasy`, en: `GPU mining routes` },
  multiAlgoListMockData: { cs: `Multi-algo seznam (mock data)`, en: `Multi-algo list (mock data)` },
  priority: { cs: `Priorita`, en: `Priority` },
  high: { cs: `Vysoká`, en: `High` },
  medium: { cs: `Střední`, en: `Medium` },
  low: { cs: `Nízká`, en: `Low` },
  walletAddress: { cs: `Wallet adresa`, en: `Wallet address` },
  workerPrefix: { cs: `Worker prefix`, en: `Worker prefix` },
  test: { cs: `Test`, en: `Test` },
  cpuMiningRoutes: { cs: `CPU mining trasy`, en: `CPU mining routes` },
  randomxCpuMinersMockData: { cs: `RandomX / CPU těžaři (mock data)`, en: `RandomX / CPU miners (mock data)` },
  notes: { cs: `Poznámky`, en: `Notes` },
  configurationNotes: { cs: `Konfigurační poznámky`, en: `Configuration notes` },
  changesTakeEffectAfterSavingAn: { cs: `Změny se projeví po uložení (a typicky po reconnectu pool klienta).`, en: `Changes take effect after saving (and typically after pool client reconnect).` },
  walletAddressesMustMatchTheNet: { cs: `Wallet adresy musí odpovídat síti konkrétní mince.`, en: `Wallet addresses must match the network of the specific coin.` },
  workerPrefixHelpsIdentifyZionW: { cs: `Worker prefix pomáhá identifikovat ZION workery na externích poolech.`, en: `Worker prefix helps identify ZION workers on external pools.` },
  alwaysTestConnectivityBeforePr: { cs: `Před produkcí vždy otestovat konektivitu.`, en: `Always test connectivity before production.` },
  algorithmManager: { cs: `Správce algoritmů →`, en: `Algorithm manager →` },
  admin: { cs: `Admin`, en: `Admin` },
};

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
        <div className="zion-rainbow-card p-5 sm:p-8 md:p-10" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{AdminPoolConfigCopy.routing[lang === 'cs' ? 'cs' : 'en']}</p>
              <h1 className="text-5xl md:text-6xl font-semibold text-gradient">{AdminPoolConfigCopy.poolConfiguration[lang === 'cs' ? 'cs' : 'en']}</h1>
              <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                {AdminPoolConfigCopy.poolEndpointWalletAndWorkerPre[lang === 'cs' ? 'cs' : 'en']}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={testAllConnections}
                className="zion-button-secondary"
              >
                {AdminPoolConfigCopy.testConnections[lang === 'cs' ? 'cs' : 'en']}
              </button>
              <button
                onClick={saveConfiguration}
                className="zion-button-primary"
              >
                {saved ? (AdminPoolConfigCopy.saved[lang === 'cs' ? 'cs' : 'en']) : (AdminPoolConfigCopy.save[lang === 'cs' ? 'cs' : 'en'])}
              </button>
              <Link
                href="/admin"
                className="zion-button-secondary"
              >
                {AdminPoolConfigCopy.back[lang === 'cs' ? 'cs' : 'en']}
              </Link>
            </div>
          </div>
        </div>

        <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">GPU</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{AdminPoolConfigCopy.gpuMiningRoutes[lang === 'cs' ? 'cs' : 'en']}</h2>
          <p className="mt-2 text-sm text-gray-300">{AdminPoolConfigCopy.multiAlgoListMockData[lang === 'cs' ? 'cs' : 'en']}</p>

          <div className="mt-6 space-y-4">
            {gpuConfigs.map((config) => (
              <div
                key={config.algo}
                className={`zion-rainbow-sub p-5 ${config.enabled ? '' : 'opacity-70'}`}
                style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
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
                      <span className={`zion-badge ${config.connectionStatus === 'connected' ? 'zion-badge-green' : config.connectionStatus === 'error' ? 'zion-badge-amber' : 'zion-badge-red'}`}>
                        {getStatusIcon(config.connectionStatus)} {config.connectionStatus}
                      </span>
                    </div>
                  </label>

                  <div className="flex items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminPoolConfigCopy.priority[lang === 'cs' ? 'cs' : 'en']}</p>
                    <select
                      value={config.priority}
                      onChange={(e) => updateConfig(config.algo, 'priority', parseInt(e.target.value))}
                      className="zion-rainbow-sub px-4 py-2 text-sm text-white disabled:opacity-50"
                      style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
                      disabled={!config.enabled}
                    >
                      <option value={1}>{AdminPoolConfigCopy.high[lang === 'cs' ? 'cs' : 'en']}</option>
                      <option value={2}>{AdminPoolConfigCopy.medium[lang === 'cs' ? 'cs' : 'en']}</option>
                      <option value={3}>{AdminPoolConfigCopy.low[lang === 'cs' ? 'cs' : 'en']}</option>
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
                      className="zion-rainbow-sub mt-2 w-full px-4 py-3 text-sm text-white disabled:opacity-50"
                      style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
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
                      className="zion-rainbow-sub mt-2 w-full px-4 py-3 text-sm text-white disabled:opacity-50"
                      style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
                      placeholder={AdminPoolConfigCopy.walletAddress[lang === 'cs' ? 'cs' : 'en']}
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminPoolConfigCopy.workerPrefix[lang === 'cs' ? 'cs' : 'en']}</p>
                      <input
                        type="text"
                        value={config.workerPrefix}
                        onChange={(e) => updateConfig(config.algo, 'workerPrefix', e.target.value)}
                        disabled={!config.enabled}
                        className="zion-rainbow-sub mt-2 w-full px-4 py-3 text-sm text-white disabled:opacity-50"
                        style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
                        placeholder="zion"
                      />
                    </div>
                    <button
                      onClick={() => testConnection(config.algo)}
                      disabled={!config.enabled || testing === config.algo}
                      className="zion-button-secondary disabled:opacity-50"
                    >
                      {testing === config.algo ? '…' : (AdminPoolConfigCopy.test[lang === 'cs' ? 'cs' : 'en'])}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">CPU</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{AdminPoolConfigCopy.cpuMiningRoutes[lang === 'cs' ? 'cs' : 'en']}</h2>
          <p className="mt-2 text-sm text-gray-300">{AdminPoolConfigCopy.randomxCpuMinersMockData[lang === 'cs' ? 'cs' : 'en']}</p>

          <div className="mt-6 space-y-4">
            {cpuConfigs.map((config) => (
              <div
                key={config.algo}
                className={`zion-rainbow-sub p-5 ${config.enabled ? '' : 'opacity-70'}`}
                style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
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
                      <span className={`zion-badge ${config.connectionStatus === 'connected' ? 'zion-badge-green' : config.connectionStatus === 'error' ? 'zion-badge-amber' : 'zion-badge-red'}`}>
                        {getStatusIcon(config.connectionStatus)} {config.connectionStatus}
                      </span>
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
                      className="zion-rainbow-sub mt-2 w-full px-4 py-3 text-sm text-white disabled:opacity-50"
                      style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Wallet</p>
                    <input
                      type="text"
                      value={config.wallet}
                      onChange={(e) => updateConfig(config.algo, 'wallet', e.target.value)}
                      disabled={!config.enabled}
                      className="zion-rainbow-sub mt-2 w-full px-4 py-3 text-sm text-white disabled:opacity-50"
                      style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
                    />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminPoolConfigCopy.workerPrefix[lang === 'cs' ? 'cs' : 'en']}</p>
                      <input
                        type="text"
                        value={config.workerPrefix}
                        onChange={(e) => updateConfig(config.algo, 'workerPrefix', e.target.value)}
                        disabled={!config.enabled}
                        className="zion-rainbow-sub mt-2 w-full px-4 py-3 text-sm text-white disabled:opacity-50"
                        style={{ '--rc': '7, 137, 48' } as React.CSSProperties}
                      />
                    </div>
                    <button
                      onClick={() => testConnection(config.algo)}
                      disabled={!config.enabled || testing === config.algo}
                      className="zion-button-secondary disabled:opacity-50"
                    >
                      {testing === config.algo ? '…' : (AdminPoolConfigCopy.test[lang === 'cs' ? 'cs' : 'en'])}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{AdminPoolConfigCopy.notes[lang === 'cs' ? 'cs' : 'en']}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{AdminPoolConfigCopy.configurationNotes[lang === 'cs' ? 'cs' : 'en']}</h3>
          <ul className="mt-4 space-y-2 text-sm text-gray-300">
            <li>• {AdminPoolConfigCopy.changesTakeEffectAfterSavingAn[lang === 'cs' ? 'cs' : 'en']}</li>
            <li>• {AdminPoolConfigCopy.walletAddressesMustMatchTheNet[lang === 'cs' ? 'cs' : 'en']}</li>
            <li>• {AdminPoolConfigCopy.workerPrefixHelpsIdentifyZionW[lang === 'cs' ? 'cs' : 'en']}</li>
            <li>• {AdminPoolConfigCopy.alwaysTestConnectivityBeforePr[lang === 'cs' ? 'cs' : 'en']}</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/algo-manager"
            className="zion-button-secondary"
          >
            {AdminPoolConfigCopy.algorithmManager[lang === 'cs' ? 'cs' : 'en']}
          </Link>
          <Link
            href="/admin"
            className="zion-button-secondary"
          >
            ← {AdminPoolConfigCopy.admin[lang === 'cs' ? 'cs' : 'en']}
          </Link>
        </div>
      </div>
    </div>
  );
}
