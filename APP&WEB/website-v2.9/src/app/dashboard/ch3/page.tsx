"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { useLang } from "@/contexts/LanguageContext";

const DashboardCh3Copy = {
  loadingChV3Settings: { cs: `Načítání CH v3 nastavení...`, en: `Loading CH v3 Settings...` },
  chV3RevenueStreams: { cs: `CH v3 Revenue Streams`, en: `CH v3 Revenue Streams` },
  configureAll5RevenueStreamsFor: { cs: `Konfigurace všech 5 revenue streamů pro Cosmic Harmony v3`, en: `Configure all 5 revenue streams for Cosmic Harmony v3` },
  overview: { cs: `📊 Přehled`, en: `📊 Overview` },
  mergedMining: { cs: `💎 Merged Mining`, en: `💎 Merged Mining` },
  dynamicGpu: { cs: `🎮 Dynamic GPU`, en: `🎮 Dynamic GPU` },
  nclAi: { cs: `🧠 NCL AI`, en: `🧠 NCL AI` },
  pearlPrl: { cs: `🐚 Pearl (PRL)`, en: `🐚 Pearl (PRL)` },
  revenueDistribution: { cs: `Rozdělení příjmů`, en: `Revenue Distribution` },
  aiTasks: { cs: `AI úkoly`, en: `AI Tasks` },
  active: { cs: `✓ Aktivní`, en: `✓ Active` },
  disabled: { cs: `✗ Vypnuto`, en: `✗ Disabled` },
  mergedMiningConfiguration: { cs: `Merged Mining konfigurace`, en: `Merged Mining Configuration` },
  intermediateHashesFromCosmicHa: { cs: `Intermediate hashes z Cosmic Harmony se exportují do kompatibilních blockchainů. Žádný extra výpočet není potřeba — je to free revenue!`, en: `Intermediate hashes from Cosmic Harmony are exported to compatible blockchains. No extra computation required — it\'s free revenue!` },
  enabled: { cs: `Zapnuto`, en: `Enabled` },
  disabled_2: { cs: `Vypnuto`, en: `Disabled` },
  poolStratum: { cs: `Pool Stratum`, en: `Pool Stratum` },
  poolWallet: { cs: `Pool Wallet`, en: `Pool Wallet` },
  autoConvertToZion: { cs: `Auto-convert do ZION`, en: `Auto-convert to ZION` },
  dynamicGpuMining: { cs: `Dynamic GPU Mining`, en: `Dynamic GPU Mining` },
  automaticallySwitchBetweenGpuA: { cs: `Automatické přepínání mezi GPU algoritmy na základě real-time ziskovosti. Pool vybere nejziskovější coin pro všechny minery.`, en: `Automatically switch between GPU algorithms based on real-time profitability. Pool selects the most profitable coin for all miners.` },
  switchingMode: { cs: `Režim přepínání`, en: `Switching Mode` },
  auto: { cs: `auto`, en: `auto` },
  manual: { cs: `manuál`, en: `manual` },
  hybrid: { cs: `hybrid`, en: `hybrid` },
  selectCoin: { cs: `Vybrat Coin`, en: `Select Coin` },
  preferredCoins: { cs: `Preferované Coiny`, en: `Preferred Coins` },
  miningNow: { cs: `Těží nyní`, en: `Mining Now` },
  minProfitUsdDay: { cs: `Min zisk (USD/den)`, en: `Min Profit (USD/day)` },
  switchIntervalMin: { cs: `Interval přepnutí (min)`, en: `Switch Interval (min)` },
  hysteresis: { cs: `Hystereze (%)`, en: `Hysteresis (%)` },
  nclAiBonusConfiguration: { cs: `NCL AI Bonus konfigurace`, en: `NCL AI Bonus Configuration` },
  allocateComputeTimeForAiInfere: { cs: `Alokujte výpočetní čas pro AI inference úkoly. Vyšší vědomí = vyšší odměny!`, en: `Allocate compute time for AI inference tasks. Higher consciousness = higher rewards!` },
  computeAllocation: { cs: `Výpočetní alokace`, en: `Compute Allocation` },
  mining: { cs: `Mining`, en: `Mining` },
  miningOnly: { cs: `Pouze mining`, en: `Mining only` },
  maxAi: { cs: `Max AI`, en: `Max AI` },
  supportedAiTasks: { cs: `Podporované AI úkoly`, en: `Supported AI Tasks` },
  base: { cs: `Základ`, en: `Base` },
  pearlPrlPouwMining: { cs: `Pearl (PRL) PoUW Mining`, en: `Pearl (PRL) PoUW Mining` },
  pearlCoinPrlUsesProofOfUsefulW: { cs: `Pearl coin (PRL) využívá Proof-of-Useful-Work: INT8 MatMul + BLAKE3 + Plonky2 ZK. GPU-nativní OpenCL těžba na AMD RX 5700 XT (~657 nonces/s, 14x rychlejší než CPU). Pool: AlphaPool/suprnova, custom Stratum dialect.`, en: `Pearl coin (PRL) uses Proof-of-Useful-Work: INT8 MatMul + BLAKE3 + Plonky2 ZK. GPU-native OpenCL mining on AMD RX 5700 XT (~657 nonces/s, 14x faster than CPU). Pool: AlphaPool/suprnova, custom Stratum dialect.` },
  targetShare: { cs: `Cílový podíl`, en: `Target Share` },
  gpuSpeed: { cs: `GPU rychlost`, en: `GPU Speed` },
  vsCpu: { cs: `vs CPU`, en: `vs CPU` },
  speedup: { cs: `zrychlení`, en: `speedup` },
  algorithm: { cs: `Algoritmus`, en: `Algorithm` },
  saving: { cs: `Ukládání...`, en: `Saving...` },
  saveSettings: { cs: `💾 Uložit nastavení`, en: `💾 Save Settings` },
};

const zionStyle = (rc: string): CSSProperties => ({ "--rc": rc } as CSSProperties);

interface StreamConfig {
  stream: number;
  name: string;
  description: string;
  enabled: boolean;
  target_share: number;
  configurable: boolean;
  algorithm?: string;
  pool?: {
    stratum: string;
    wallet: string;
    worker: string;
  };
  mode?: string;
  current_coin?: string;
  preferred_coins?: string[];
  npu_allocation?: number;
  mining_allocation?: number;
}

interface CH3Settings {
  version: string;
  streams: {
    zion: StreamConfig;
    etc: StreamConfig;
    nxs: StreamConfig;
    dynamic_gpu: StreamConfig;
    ncl: StreamConfig;
    pearl: StreamConfig;
  };
  summary: {
    enabled_streams: number;
    stream_names: string[];
    total_target_share: number;
  };
}

const STREAM_COLORS: Record<string, string> = {
  zion: "from-zion-gold to-amber-500",
  etc: "from-green-500 to-emerald-600",
  nxs: "from-blue-500 to-cyan-600",
  dynamic_gpu: "from-purple-500 to-violet-600",
  ncl: "from-pink-500 to-rose-600",
  pearl: "from-teal-400 to-cyan-500",
};

const STREAM_ICONS: Record<string, string> = {
  zion: "⚡",
  etc: "💎",
  nxs: "🔷",
  dynamic_gpu: "🎮",
  ncl: "🧠",
  pearl: "🐚",
};

const GPU_COINS = [
  { id: "ERG", name: "Ergo", algo: "Autolykos2", color: "text-orange-400" },
  { id: "RVN", name: "Ravencoin", algo: "KawPow", color: "text-blue-400" },
  { id: "KAS", name: "Kaspa", algo: "KHeavyHash", color: "text-teal-400" },
  { id: "ALPH", name: "Alephium", algo: "Blake3", color: "text-purple-400" },
  { id: "FLUX", name: "Flux", algo: "Equihash", color: "text-indigo-400" },
];

const DEFAULT_SETTINGS: CH3Settings = {
  version: "3.0.2",
  streams: {
    zion: {
      stream: 1,
      name: "ZION",
      description: "Cosmic Fusion base mining",
      enabled: true,
      target_share: 0.5,
      configurable: false,
      algorithm: "cosmic_fusion",
    },
    etc: {
      stream: 2,
      name: "ETC",
      description: "Keccak256 merged mining to Ethereum Classic",
      enabled: true,
      target_share: 0.2,
      configurable: true,
      algorithm: "keccak256",
      pool: {
        stratum: "stratum+tcp://etc.2miners.com:1010",
        wallet: "0x...",
        worker: "zion_merged",
      },
    },
    nxs: {
      stream: 3,
      name: "NXS",
      description: "SHA3-512 merged mining to Nexus",
      enabled: true,
      target_share: 0.05,
      configurable: true,
      algorithm: "sha3_512",
      pool: {
        stratum: "stratum+tcp://pool.nexus.io:9549",
        wallet: "NXS...",
        worker: "zion_merged",
      },
    },
    dynamic_gpu: {
      stream: 4,
      name: "Dynamic GPU",
      description: "Profit-switched GPU mining",
      enabled: true,
      target_share: 0.2,
      configurable: true,
      mode: "auto",
      current_coin: "ERG",
      preferred_coins: ["ERG", "RVN", "KAS", "ALPH"],
    },
    ncl: {
      stream: 5,
      name: "NCL AI Bonus",
      description: "Neural Compute Layer AI inference",
      enabled: true,
      target_share: 0.05,
      configurable: true,
      npu_allocation: 0.3,
      mining_allocation: 0.7,
    },
    pearl: {
      stream: 6,
      name: "Pearl (PRL)",
      description: "PearlHash PoUW GPU mining (INT8 MatMul + BLAKE3 + ZK)",
      enabled: true,
      target_share: 0.05,
      configurable: true,
      algorithm: "pearlhash",
      pool: {
        stratum: "stratum+tcp://us2.alphapool.tech:5566",
        wallet: "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw",
        worker: "zion_pearl",
      },
    },
  },
  summary: {
    enabled_streams: 6,
    stream_names: ["ZION", "ETC", "NXS", "Dynamic GPU", "NCL AI", "Pearl"],
    total_target_share: 1.0,
  },
};

export default function CH3SettingsPage() {
  const { lang } = useLang();
  const [settings, setSettings] = useState<CH3Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/v2.9/revenue/config', { cache: 'no-store' });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        // Validate expected shape
        if (data.streams && data.summary) {
          setSettings(data as CH3Settings);
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        setError(null);
      } catch (err) {
        console.warn('Failed to load CH3 settings, using defaults:', err);
        setSettings(DEFAULT_SETTINGS);
        setError(err instanceof Error ? err.message : 'Load failed');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const toggleStream = (streamKey: string) => {
    if (!settings || streamKey === "zion") return;
    setSettings({
      ...settings,
      streams: {
        ...settings.streams,
        [streamKey]: {
          ...settings.streams[streamKey as keyof typeof settings.streams],
          enabled: !settings.streams[streamKey as keyof typeof settings.streams].enabled,
        },
      },
    });
  };

  const updateDynamicGPU = (field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      streams: {
        ...settings.streams,
        dynamic_gpu: {
          ...settings.streams.dynamic_gpu,
          [field]: value,
        },
      },
    });
  };

  const updateNCL = (allocation: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      streams: {
        ...settings.streams,
        ncl: {
          ...settings.streams.ncl,
          npu_allocation: allocation,
          mining_allocation: 1 - allocation,
        },
      },
    });
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v2.9/revenue/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-zion-gold text-2xl animate-pulse">{DashboardCh3Copy.loadingChV3Settings[lang === 'cs' ? 'cs' : 'en']}</div>
      </div>
    );
  }

  return (
    <div className="text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-zion-gold/15 flex items-center justify-center">
            <span className="text-xl">⚡</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zion-gold">{DashboardCh3Copy.chV3RevenueStreams[lang === 'cs' ? 'cs' : 'en']}</h1>
            <p className="text-sm text-gray-400">
              {DashboardCh3Copy.configureAll5RevenueStreamsFor[lang === 'cs' ? 'cs' : 'en']}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
        {Object.entries(settings.streams).map(([key, stream]) => (
          <div
            key={key}
            className={`zion-rainbow-card p-4 ${
              stream.enabled ? "" : "opacity-60"
            }`}
            style={zionStyle("251, 191, 36")}
          >
            {/* Gradient bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${STREAM_COLORS[key]}`} />
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{STREAM_ICONS[key]}</span>
              {stream.configurable && (
                <button
                  onClick={() => toggleStream(key)}
                  className={`w-10 h-6 rounded-full transition-colors ${
                    stream.enabled ? "bg-emerald-500" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
                      stream.enabled ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              )}
            </div>
            
            <div className="font-bold text-lg">{stream.name}</div>
            <div className="text-gray-400 text-sm">~{stream.target_share * 100}%</div>
            
            {key === "dynamic_gpu" && stream.current_coin && (
              <div className="mt-2 text-xs zion-rainbow-sub px-2 py-1 inline-block" style={zionStyle("245, 158, 11")}>
                Mining: {stream.current_coin}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
        {["overview", "merged", "dynamic", "ncl", "pearl"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-bold transition-colors ${
              activeTab === tab
                ? "zion-rainbow-sub"
                : "rounded-lg bg-black/40 text-gray-400 hover:bg-white/10"
            }`}
            style={activeTab === tab ? zionStyle("251, 191, 36") : undefined}
          >
            {tab === "overview" && (DashboardCh3Copy.overview[lang === 'cs' ? 'cs' : 'en'])}
            {tab === "merged" && (DashboardCh3Copy.mergedMining[lang === 'cs' ? 'cs' : 'en'])}
            {tab === "dynamic" && (DashboardCh3Copy.dynamicGpu[lang === 'cs' ? 'cs' : 'en'])}
            {tab === "ncl" && (DashboardCh3Copy.nclAi[lang === 'cs' ? 'cs' : 'en'])}
            {tab === "pearl" && (DashboardCh3Copy.pearlPrl[lang === 'cs' ? 'cs' : 'en'])}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="zion-rainbow-card p-6" style={zionStyle("251, 191, 36")}>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{DashboardCh3Copy.revenueDistribution[lang === 'cs' ? 'cs' : 'en']}</h2>
            
            {/* Visual bar */}
            <div className="h-12 rounded-lg overflow-hidden flex mb-6">
              {Object.entries(settings.streams).map(([key, stream]) => (
                stream.enabled && (
                  <div
                    key={key}
                    className={`bg-gradient-to-r ${STREAM_COLORS[key]} flex items-center justify-center text-black font-bold text-sm`}
                    style={{ width: `${stream.target_share * 100}%` }}
                  >
                    {stream.name} {stream.target_share * 100}%
                  </div>
                )
              ))}
            </div>

            {/* Stream details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(settings.streams).map(([key, stream]) => (
                <div key={key} className="zion-rainbow-sub p-4" style={zionStyle("245, 158, 11")}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{STREAM_ICONS[key]}</span>
                    <div>
                      <div className="font-bold">{stream.name}</div>
                      <div className="text-gray-400 text-sm">{stream.algorithm || stream.mode || (DashboardCh3Copy.aiTasks[lang === 'cs' ? 'cs' : 'en'])}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{stream.description}</div>
                  <div className={`mt-2 text-sm ${stream.enabled ? "text-emerald-400" : "text-red-400"}`}>
                    {stream.enabled ? (DashboardCh3Copy.active[lang === 'cs' ? 'cs' : 'en']) : (DashboardCh3Copy.disabled[lang === 'cs' ? 'cs' : 'en'])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merged Mining Tab */}
        {activeTab === "merged" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{DashboardCh3Copy.mergedMiningConfiguration[lang === 'cs' ? 'cs' : 'en']}</h2>
            <p className="text-gray-400 mb-6">
              {DashboardCh3Copy.intermediateHashesFromCosmicHa[lang === 'cs' ? 'cs' : 'en']}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ETC */}
              <div className="zion-rainbow-card p-6" style={zionStyle("245, 158, 11")}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">💎</span>
                    <div>
                      <div className="font-bold text-xl">Ethereum Classic</div>
                      <div className="text-gray-400">Keccak256 hash export</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleStream("etc")}
                    className={`px-4 py-2 font-bold ${
                      settings.streams.etc.enabled
                        ? "zion-rainbow-sub text-white"
                        : "rounded-lg bg-black/40 text-gray-400"
                    }`}
                    style={settings.streams.etc.enabled ? zionStyle("251, 191, 36") : undefined}
                  >
                    {settings.streams.etc.enabled ? (DashboardCh3Copy.enabled[lang === 'cs' ? 'cs' : 'en']) : (DashboardCh3Copy.disabled_2[lang === 'cs' ? 'cs' : 'en'])}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">{DashboardCh3Copy.poolStratum[lang === 'cs' ? 'cs' : 'en']}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.etc.pool?.stratum}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="stratum+tcp://etc.2miners.com:1010"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">{DashboardCh3Copy.poolWallet[lang === 'cs' ? 'cs' : 'en']}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.etc.pool?.wallet}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="0x..."
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    {DashboardCh3Copy.autoConvertToZion[lang === 'cs' ? 'cs' : 'en']}
                  </div>
                </div>
              </div>

              {/* NXS */}
              <div className="zion-rainbow-card p-6" style={zionStyle("245, 158, 11")}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🔷</span>
                    <div>
                      <div className="font-bold text-xl">Nexus</div>
                      <div className="text-gray-400">SHA3-512 hash export</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleStream("nxs")}
                    className={`px-4 py-2 font-bold ${
                      settings.streams.nxs.enabled
                        ? "zion-rainbow-sub text-white"
                        : "rounded-lg bg-black/40 text-gray-400"
                    }`}
                    style={settings.streams.nxs.enabled ? zionStyle("251, 191, 36") : undefined}
                  >
                    {settings.streams.nxs.enabled ? (DashboardCh3Copy.enabled[lang === 'cs' ? 'cs' : 'en']) : (DashboardCh3Copy.disabled_2[lang === 'cs' ? 'cs' : 'en'])}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">{DashboardCh3Copy.poolStratum[lang === 'cs' ? 'cs' : 'en']}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.nxs.pool?.stratum}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="stratum+tcp://pool.nexus.io:9549"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">{DashboardCh3Copy.poolWallet[lang === 'cs' ? 'cs' : 'en']}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.nxs.pool?.wallet}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="NXS..."
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    {DashboardCh3Copy.autoConvertToZion[lang === 'cs' ? 'cs' : 'en']}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic GPU Tab */}
        {activeTab === "dynamic" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{DashboardCh3Copy.dynamicGpuMining[lang === 'cs' ? 'cs' : 'en']}</h2>
            <p className="text-gray-400 mb-6">
              {DashboardCh3Copy.automaticallySwitchBetweenGpuA[lang === 'cs' ? 'cs' : 'en']}
            </p>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-2">{DashboardCh3Copy.switchingMode[lang === 'cs' ? 'cs' : 'en']}</label>
              <div className="flex gap-4">
                {["auto", "manual", "hybrid"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateDynamicGPU("mode", mode)}
                    className={`px-6 py-3 font-bold capitalize ${
                      settings.streams.dynamic_gpu.mode === mode
                        ? "zion-rainbow-sub text-white"
                        : "rounded-lg bg-black/40 text-gray-400"
                    }`}
                    style={settings.streams.dynamic_gpu.mode === mode ? zionStyle("251, 191, 36") : undefined}
                  >
                    {mode === "auto" && "🤖 "}
                    {mode === "manual" && "👆 "}
                    {mode === "hybrid" && "🔀 "}
                    {mode === "auto" ? (DashboardCh3Copy.auto[lang === 'cs' ? 'cs' : 'en']) : mode === "manual" ? (DashboardCh3Copy.manual[lang === 'cs' ? 'cs' : 'en']) : (DashboardCh3Copy.hybrid[lang === 'cs' ? 'cs' : 'en'])}
                  </button>
                ))}
              </div>
            </div>

            {/* Coin Selection */}
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-2">
                {settings.streams.dynamic_gpu.mode === "manual" ? (DashboardCh3Copy.selectCoin[lang === 'cs' ? 'cs' : 'en']) : (DashboardCh3Copy.preferredCoins[lang === 'cs' ? 'cs' : 'en'])}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {GPU_COINS.map((coin) => {
                  const isSelected = settings.streams.dynamic_gpu.preferred_coins?.includes(coin.id);
                  const isCurrent = settings.streams.dynamic_gpu.current_coin === coin.id;
                  
                  return (
                    <button
                      key={coin.id}
                      onClick={() => {
                        if (settings.streams.dynamic_gpu.mode === "manual") {
                          updateDynamicGPU("current_coin", coin.id);
                        } else {
                          const coins = settings.streams.dynamic_gpu.preferred_coins || [];
                          updateDynamicGPU(
                            "preferred_coins",
                            isSelected
                              ? coins.filter(c => c !== coin.id)
                              : [...coins, coin.id]
                          );
                        }
                      }}
                      className={`p-4 rounded-xl transition-all ${
                        isCurrent || isSelected
                          ? "zion-rainbow-sub"
                          : "bg-black/40 border border-white/10 hover:border-white/20"
                      }`}
                      style={isCurrent ? zionStyle("251, 191, 36") : isSelected ? zionStyle("245, 158, 11") : undefined}
                    >
                      <div className={`font-bold text-xl ${coin.color}`}>{coin.id}</div>
                      <div className="text-gray-400 text-sm">{coin.name}</div>
                      <div className="text-gray-500 text-xs mt-1">{coin.algo}</div>
                      {isCurrent && (
                        <div className="text-zion-gold text-xs mt-2">⚡ {DashboardCh3Copy.miningNow[lang === 'cs' ? 'cs' : 'en']}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Switching Settings */}
            {settings.streams.dynamic_gpu.mode === "auto" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-400 text-sm">{DashboardCh3Copy.minProfitUsdDay[lang === 'cs' ? 'cs' : 'en']}</label>
                  <input
                    type="number"
                    defaultValue="0.10"
                    step="0.01"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">{DashboardCh3Copy.switchIntervalMin[lang === 'cs' ? 'cs' : 'en']}</label>
                  <input
                    type="number"
                    defaultValue="15"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">{DashboardCh3Copy.hysteresis[lang === 'cs' ? 'cs' : 'en']}</label>
                  <input
                    type="number"
                    defaultValue="5"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 mt-1"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* NCL Tab */}
        {activeTab === "ncl" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{DashboardCh3Copy.nclAiBonusConfiguration[lang === 'cs' ? 'cs' : 'en']}</h2>
            <p className="text-gray-400 mb-6">
              {DashboardCh3Copy.allocateComputeTimeForAiInfere[lang === 'cs' ? 'cs' : 'en']}
            </p>

            {/* Allocation Slider */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{DashboardCh3Copy.computeAllocation[lang === 'cs' ? 'cs' : 'en']}</span>
                <span>
                  {((settings.streams.ncl.npu_allocation || 0) * 100).toFixed(0)}% AI / 
                  {((settings.streams.ncl.mining_allocation || 0) * 100).toFixed(0)}% {DashboardCh3Copy.mining[lang === 'cs' ? 'cs' : 'en']}
                </span>
              </div>
              
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={(settings.streams.ncl.npu_allocation || 0) * 100}
                  onChange={(e) => updateNCL(parseInt(e.target.value) / 100)}
                  className="w-full h-4 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, 
                      #ec4899 0%, 
                      #ec4899 ${(settings.streams.ncl.npu_allocation || 0) * 200}%, 
                      #374151 ${(settings.streams.ncl.npu_allocation || 0) * 200}%, 
                      #374151 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0% ({DashboardCh3Copy.miningOnly[lang === 'cs' ? 'cs' : 'en']})</span>
                  <span>50% ({DashboardCh3Copy.maxAi[lang === 'cs' ? 'cs' : 'en']})</span>
                </div>
              </div>

              {/* Visual split */}
              <div className="flex h-20 mt-4 rounded-lg overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-zion-gold flex items-center justify-center"
                  style={{ width: `${(settings.streams.ncl.mining_allocation || 0) * 100}%` }}
                >
                  <span className="font-bold">⛏️ {DashboardCh3Copy.mining[lang === 'cs' ? 'cs' : 'en']}</span>
                </div>
                <div 
                  className="bg-gradient-to-r from-pink-600 to-pink-500 flex items-center justify-center"
                  style={{ width: `${(settings.streams.ncl.npu_allocation || 0) * 100}%` }}
                >
                  <span className="font-bold">🧠 AI</span>
                </div>
              </div>
            </div>

            {/* Task Types */}
            <div>
              <label className="text-gray-400 text-sm block mb-2">{DashboardCh3Copy.supportedAiTasks[lang === 'cs' ? 'cs' : 'en']}</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: "embeddings", name: "Embeddings", reward: "0.001" },
                  { id: "llm_inference", name: "LLM Inference", reward: "0.01" },
                  { id: "image_classification", name: "Image Classification", reward: "0.002" },
                  { id: "code_analysis", name: "Code Analysis", reward: "0.003" },
                ].map((task) => (
                  <div key={task.id} className="zion-rainbow-sub p-4" style={zionStyle("245, 158, 11")}>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="font-medium">{task.name}</span>
                    </div>
                    <div className="text-gray-500 text-sm">
                      {DashboardCh3Copy.base[lang === 'cs' ? 'cs' : 'en']}: {task.reward} ZION
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pearl Tab */}
        {activeTab === "pearl" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{DashboardCh3Copy.pearlPrlPouwMining[lang === 'cs' ? 'cs' : 'en']}</h2>
            <p className="text-gray-400 mb-6">
              {DashboardCh3Copy.pearlCoinPrlUsesProofOfUsefulW[lang === 'cs' ? 'cs' : 'en']}
            </p>

            <div className="zion-rainbow-card p-6 mb-6" style={zionStyle("245, 158, 11")}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🐚</span>
                  <div>
                    <div className="font-bold text-xl">Pearl (PRL)</div>
                    <div className="text-gray-400">PearlHash — PoUW (INT8 MatMul + BLAKE3 + ZK)</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleStream("pearl")}
                  className={`px-4 py-2 font-bold ${
                    settings.streams.pearl.enabled
                      ? "zion-rainbow-sub text-white"
                      : "rounded-lg bg-black/40 text-gray-400"
                  }`}
                  style={settings.streams.pearl.enabled ? zionStyle("251, 191, 36") : undefined}
                >
                  {settings.streams.pearl.enabled ? (DashboardCh3Copy.enabled[lang === 'cs' ? 'cs' : 'en']) : (DashboardCh3Copy.disabled_2[lang === 'cs' ? 'cs' : 'en'])}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm">{DashboardCh3Copy.poolStratum[lang === 'cs' ? 'cs' : 'en']}</label>
                  <input
                    type="text"
                    defaultValue={settings.streams.pearl.pool?.stratum}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                    placeholder="stratum+tcp://us2.alphapool.tech:5566"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">{DashboardCh3Copy.poolWallet[lang === 'cs' ? 'cs' : 'en']}</label>
                  <input
                    type="text"
                    defaultValue={settings.streams.pearl.pool?.wallet}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                    placeholder="bc1q..."
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">{DashboardCh3Copy.targetShare[lang === 'cs' ? 'cs' : 'en']}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    defaultValue={settings.streams.pearl.target_share}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                  {DashboardCh3Copy.autoConvertToZion[lang === 'cs' ? 'cs' : 'en']}
                </div>
              </div>
            </div>

            {/* GPU Performance Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="zion-rainbow-sub p-4" style={zionStyle("245, 158, 11")}>
                <div className="text-gray-400 text-sm">{DashboardCh3Copy.gpuSpeed[lang === 'cs' ? 'cs' : 'en']}</div>
                <div className="font-bold text-2xl text-teal-400">657.6</div>
                <div className="text-gray-500 text-xs">nonces/s (batch=16)</div>
              </div>
              <div className="zion-rainbow-sub p-4" style={zionStyle("245, 158, 11")}>
                <div className="text-gray-400 text-sm">{DashboardCh3Copy.vsCpu[lang === 'cs' ? 'cs' : 'en']}</div>
                <div className="font-bold text-2xl text-teal-400">14.2x</div>
                <div className="text-gray-500 text-xs">{DashboardCh3Copy.speedup[lang === 'cs' ? 'cs' : 'en']}</div>
              </div>
              <div className="zion-rainbow-sub p-4" style={zionStyle("245, 158, 11")}>
                <div className="text-gray-400 text-sm">{DashboardCh3Copy.algorithm[lang === 'cs' ? 'cs' : 'en']}</div>
                <div className="font-bold text-lg text-teal-400">PearlHash</div>
                <div className="text-gray-500 text-xs">PoUW — INT8 MatMul + ZK</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Save Button */}
      <div className="zion-cta-banner mt-8 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving || !settings}
          className={`px-8 py-3 rounded-xl font-bold text-lg ${
            saving || !settings
              ? "bg-white/10 text-gray-400 cursor-wait"
              : "bg-zion-gold text-black hover:bg-yellow-400"
          }`}
        >
          {saving ? (DashboardCh3Copy.saving[lang === 'cs' ? 'cs' : 'en']) : (DashboardCh3Copy.saveSettings[lang === 'cs' ? 'cs' : 'en'])}
        </button>
      </div>
    </div>
  );
}
