"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";

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
};

const STREAM_ICONS: Record<string, string> = {
  zion: "⚡",
  etc: "💎",
  nxs: "🔷",
  dynamic_gpu: "🎮",
  ncl: "🧠",
};

const GPU_COINS = [
  { id: "ERG", name: "Ergo", algo: "Autolykos2", color: "text-orange-400" },
  { id: "RVN", name: "Ravencoin", algo: "KawPow", color: "text-blue-400" },
  { id: "KAS", name: "Kaspa", algo: "KHeavyHash", color: "text-teal-400" },
  { id: "ALPH", name: "Alephium", algo: "Blake3", color: "text-purple-400" },
  { id: "FLUX", name: "Flux", algo: "Equihash", color: "text-indigo-400" },
];

const DEFAULT_SETTINGS: CH3Settings = {
  version: "3.0.0",
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
  },
  summary: {
    enabled_streams: 5,
    stream_names: ["ZION", "ETC", "NXS", "Dynamic GPU", "NCL AI"],
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
        <div className="text-zion-gold text-2xl animate-pulse">{lang === 'cs' ? 'Načítání CH v3 nastavení...' : 'Loading CH v3 Settings...'}</div>
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
            <h1 className="text-3xl font-bold text-zion-gold">{lang === 'cs' ? 'CH v3 Revenue Streams' : 'CH v3 Revenue Streams'}</h1>
            <p className="text-sm text-gray-400">
              {lang === 'cs' ? 'Konfigurace všech 5 revenue streamů pro Cosmic Harmony v3' : 'Configure all 5 revenue streams for Cosmic Harmony v3'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
        {Object.entries(settings.streams).map(([key, stream]) => (
          <div
            key={key}
            className={`relative overflow-hidden rounded-xl p-4 border ${
              stream.enabled
                ? "border-white/10 bg-white/5"
                : "border-white/10 bg-black/40 opacity-60"
            }`}
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
              <div className="mt-2 text-xs bg-purple-900/50 px-2 py-1 rounded inline-block">
                Mining: {stream.current_coin}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
        {["overview", "merged", "dynamic", "ncl"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab
                ? "bg-zion-gold text-black font-bold"
                : "bg-black/40 text-gray-400 hover:bg-white/10"
            }`}
          >
            {tab === "overview" && (lang === 'cs' ? '📊 Přehled' : '📊 Overview')}
            {tab === "merged" && (lang === 'cs' ? '💎 Merged Mining' : '💎 Merged Mining')}
            {tab === "dynamic" && (lang === 'cs' ? '🎮 Dynamic GPU' : '🎮 Dynamic GPU')}
            {tab === "ncl" && (lang === 'cs' ? '🧠 NCL AI' : '🧠 NCL AI')}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{lang === 'cs' ? 'Rozdělení příjmů' : 'Revenue Distribution'}</h2>
            
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
                <div key={key} className="bg-black/40 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{STREAM_ICONS[key]}</span>
                    <div>
                      <div className="font-bold">{stream.name}</div>
                      <div className="text-gray-400 text-sm">{stream.algorithm || stream.mode || (lang === 'cs' ? 'AI úkoly' : 'AI Tasks')}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{stream.description}</div>
                  <div className={`mt-2 text-sm ${stream.enabled ? "text-emerald-400" : "text-red-400"}`}>
                    {stream.enabled ? (lang === 'cs' ? '✓ Aktivní' : '✓ Active') : (lang === 'cs' ? '✗ Vypnuto' : '✗ Disabled')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merged Mining Tab */}
        {activeTab === "merged" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{lang === 'cs' ? 'Merged Mining konfigurace' : 'Merged Mining Configuration'}</h2>
            <p className="text-gray-400 mb-6">
              {lang === 'cs' ? 'Intermediate hashes z Cosmic Harmony se exportují do kompatibilních blockchainů. Žádný extra výpočet není potřeba — je to free revenue!' : 'Intermediate hashes from Cosmic Harmony are exported to compatible blockchains. No extra computation required — it\'s free revenue!'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ETC */}
              <div className="bg-black/40 rounded-xl p-6">
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
                    className={`px-4 py-2 rounded-lg font-bold ${
                      settings.streams.etc.enabled
                        ? "bg-emerald-600 text-white"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {settings.streams.etc.enabled ? (lang === 'cs' ? 'Zapnuto' : 'Enabled') : (lang === 'cs' ? 'Vypnuto' : 'Disabled')}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">{lang === 'cs' ? 'Pool Stratum' : 'Pool Stratum'}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.etc.pool?.stratum}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="stratum+tcp://etc.2miners.com:1010"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">{lang === 'cs' ? 'Pool Wallet' : 'Pool Wallet'}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.etc.pool?.wallet}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="0x..."
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    {lang === 'cs' ? 'Auto-convert do ZION' : 'Auto-convert to ZION'}
                  </div>
                </div>
              </div>

              {/* NXS */}
              <div className="bg-black/40 rounded-xl p-6">
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
                    className={`px-4 py-2 rounded-lg font-bold ${
                      settings.streams.nxs.enabled
                        ? "bg-emerald-600 text-white"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {settings.streams.nxs.enabled ? (lang === 'cs' ? 'Zapnuto' : 'Enabled') : (lang === 'cs' ? 'Vypnuto' : 'Disabled')}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">{lang === 'cs' ? 'Pool Stratum' : 'Pool Stratum'}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.nxs.pool?.stratum}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="stratum+tcp://pool.nexus.io:9549"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">{lang === 'cs' ? 'Pool Wallet' : 'Pool Wallet'}</label>
                    <input
                      type="text"
                      defaultValue={settings.streams.nxs.pool?.wallet}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 mt-1"
                      placeholder="NXS..."
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    {lang === 'cs' ? 'Auto-convert do ZION' : 'Auto-convert to ZION'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic GPU Tab */}
        {activeTab === "dynamic" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{lang === 'cs' ? 'Dynamic GPU Mining' : 'Dynamic GPU Mining'}</h2>
            <p className="text-gray-400 mb-6">
              {lang === 'cs' ? 'Automatické přepínání mezi GPU algoritmy na základě real-time ziskovosti. Pool vybere nejziskovější coin pro všechny minery.' : 'Automatically switch between GPU algorithms based on real-time profitability. Pool selects the most profitable coin for all miners.'}
            </p>

            {/* Mode Selection */}
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-2">{lang === 'cs' ? 'Režim přepínání' : 'Switching Mode'}</label>
              <div className="flex gap-4">
                {["auto", "manual", "hybrid"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateDynamicGPU("mode", mode)}
                    className={`px-6 py-3 rounded-lg font-bold capitalize ${
                      settings.streams.dynamic_gpu.mode === mode
                        ? "bg-purple-600 text-white"
                        : "bg-black/40 text-gray-400"
                    }`}
                  >
                    {mode === "auto" && "🤖 "}
                    {mode === "manual" && "👆 "}
                    {mode === "hybrid" && "🔀 "}
                    {mode === "auto" ? (lang === 'cs' ? 'auto' : 'auto') : mode === "manual" ? (lang === 'cs' ? 'manuál' : 'manual') : (lang === 'cs' ? 'hybrid' : 'hybrid')}
                  </button>
                ))}
              </div>
            </div>

            {/* Coin Selection */}
            <div className="mb-6">
              <label className="text-gray-400 text-sm block mb-2">
                {settings.streams.dynamic_gpu.mode === "manual" ? (lang === 'cs' ? 'Vybrat Coin' : 'Select Coin') : (lang === 'cs' ? 'Preferované Coiny' : 'Preferred Coins')}
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
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isCurrent
                          ? "border-zion-gold bg-zion-gold/10"
                          : isSelected
                          ? "border-purple-500 bg-purple-900/20"
                          : "border-white/10 bg-black/40 hover:border-white/20"
                      }`}
                    >
                      <div className={`font-bold text-xl ${coin.color}`}>{coin.id}</div>
                      <div className="text-gray-400 text-sm">{coin.name}</div>
                      <div className="text-gray-500 text-xs mt-1">{coin.algo}</div>
                      {isCurrent && (
                        <div className="text-zion-gold text-xs mt-2">⚡ {lang === 'cs' ? 'Těží nyní' : 'Mining Now'}</div>
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
                  <label className="text-gray-400 text-sm">{lang === 'cs' ? 'Min zisk (USD/den)' : 'Min Profit (USD/day)'}</label>
                  <input
                    type="number"
                    defaultValue="0.10"
                    step="0.01"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">{lang === 'cs' ? 'Interval přepnutí (min)' : 'Switch Interval (min)'}</label>
                  <input
                    type="number"
                    defaultValue="15"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">{lang === 'cs' ? 'Hystereze (%)' : 'Hysteresis (%)'}</label>
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
            <h2 className="text-2xl font-bold mb-6">{lang === 'cs' ? 'NCL AI Bonus konfigurace' : 'NCL AI Bonus Configuration'}</h2>
            <p className="text-gray-400 mb-6">
              {lang === 'cs' ? 'Alokujte výpočetní čas pro AI inference úkoly. Vyšší vědomí = vyšší odměny!' : 'Allocate compute time for AI inference tasks. Higher consciousness = higher rewards!'}
            </p>

            {/* Allocation Slider */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{lang === 'cs' ? 'Výpočetní alokace' : 'Compute Allocation'}</span>
                <span>
                  {((settings.streams.ncl.npu_allocation || 0) * 100).toFixed(0)}% AI / 
                  {((settings.streams.ncl.mining_allocation || 0) * 100).toFixed(0)}% {lang === 'cs' ? 'Mining' : 'Mining'}
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
                  <span>0% ({lang === 'cs' ? 'Pouze mining' : 'Mining only'})</span>
                  <span>50% ({lang === 'cs' ? 'Max AI' : 'Max AI'})</span>
                </div>
              </div>

              {/* Visual split */}
              <div className="flex h-20 mt-4 rounded-lg overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-zion-gold flex items-center justify-center"
                  style={{ width: `${(settings.streams.ncl.mining_allocation || 0) * 100}%` }}
                >
                  <span className="font-bold">⛏️ {lang === 'cs' ? 'Mining' : 'Mining'}</span>
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
              <label className="text-gray-400 text-sm block mb-2">{lang === 'cs' ? 'Podporované AI úkoly' : 'Supported AI Tasks'}</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: "embeddings", name: "Embeddings", reward: "0.001" },
                  { id: "llm_inference", name: "LLM Inference", reward: "0.01" },
                  { id: "image_classification", name: "Image Classification", reward: "0.002" },
                  { id: "code_analysis", name: "Code Analysis", reward: "0.003" },
                ].map((task) => (
                  <div key={task.id} className="bg-black/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span className="font-medium">{task.name}</span>
                    </div>
                    <div className="text-gray-500 text-sm">
                      {lang === 'cs' ? 'Základ' : 'Base'}: {task.reward} ZION
                    </div>
                  </div>
                ))}
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
      <div className="mt-8 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving || !settings}
          className={`px-8 py-3 rounded-xl font-bold text-lg ${
            saving || !settings
              ? "bg-white/10 text-gray-400 cursor-wait"
              : "bg-zion-gold text-black hover:bg-yellow-400"
          }`}
        >
          {saving ? (lang === 'cs' ? 'Ukládání...' : 'Saving...') : (lang === 'cs' ? '💾 Uložit nastavení' : '💾 Save Settings')}
        </button>
      </div>
    </div>
  );
}
