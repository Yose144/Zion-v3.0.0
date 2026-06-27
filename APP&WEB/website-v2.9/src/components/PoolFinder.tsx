'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Zap, Copy, Check, Navigation2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

interface Pool {
  id: string;
  name: string;
  host: string;
  port: number;
  region: string;
  distance?: number;
  stratumUrl: string;
  estimatedLatency?: number;
}

interface BestPoolResponse {
  userLocation?: { lat: number; lon: number };
  recommended?: Pool;
  pools: Pool[];
}

export default function PoolFinder() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BestPoolResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualLocation, setManualLocation] = useState({ lat: '', lon: '' });
  const [useManual, setUseManual] = useState(false);

  const findBestPool = async (lat?: number, lon?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lat !== undefined && lon !== undefined) {
        params.set('lat', lat.toString());
        params.set('lon', lon.toString());
      }
      
      const res = await fetch(`/api/network/best-pool?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (e) {
      console.error('Failed to find best pool:', e);
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = () => {
    if ('geolocation' in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          findBestPool(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Fallback to IP-based or default
          findBestPool();
        }
      );
    } else {
      findBestPool();
    }
  };

  const handleManualSearch = () => {
    const lat = parseFloat(manualLocation.lat);
    const lon = parseFloat(manualLocation.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      findBestPool(lat, lon);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // Initial load with defaults
    findBestPool();
  }, []);

  return (
    <div className="zion-rainbow-card p-6" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-zion-gold" />
        {cs ? 'Najít nejlepší těžební pool' : 'Find Best Mining Pool'}
      </h3>

      <p className="text-gray-400 text-sm mb-6">
        {cs ? 'Získejte optimální těžební pool podle své polohy pro co nejnižší latenci.' : 'Get the optimal mining pool based on your location for lowest latency.'}
      </p>

      {/* Location Detection */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={detectLocation}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan text-black font-semibold shadow-[0_10px_30px_rgba(147,51,234,0.35)] transition disabled:opacity-60"
        >
          <Navigation2 className="w-4 h-4" />
          {loading ? (cs ? 'Zjišťuji polohu...' : 'Detecting...') : (cs ? 'Použít moji polohu' : 'Use My Location')}
        </button>

        <button
          onClick={() => setUseManual(!useManual)}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 text-white hover:border-zion-gold/50 transition"
        >
          <MapPin className="w-4 h-4" />
          {cs ? 'Zadat ručně' : 'Enter Manually'}
        </button>
      </div>

      {/* Manual Input */}
      {useManual && (
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder={cs ? 'Zeměpisná šířka (např. 50.08)' : 'Latitude (e.g. 50.08)'}
            value={manualLocation.lat}
            onChange={(e) => setManualLocation(prev => ({ ...prev, lat: e.target.value }))}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:border-zion-gold outline-none"
          />
          <input
            type="text"
            placeholder={cs ? 'Zeměpisná délka (např. 14.42)' : 'Longitude (e.g. 14.42)'}
            value={manualLocation.lon}
            onChange={(e) => setManualLocation(prev => ({ ...prev, lon: e.target.value }))}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:border-zion-gold outline-none"
          />
          <button
            onClick={handleManualSearch}
            className="px-4 py-2 rounded-xl bg-zion-cyan text-black font-semibold hover:opacity-90 transition-colors"
          >
            {cs ? 'Hledat' : 'Search'}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Recommended Pool */}
          {result.recommended ? (
          <div className="p-4 bg-linear-to-r from-zion-gold/25 via-zion-purple/10 to-transparent border border-zion-gold/40 rounded-2xl shadow-[0_10px_35px_rgba(212,175,55,0.2)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <span className="font-semibold text-white">{result.recommended.name}</span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                  {cs ? 'Doporučeno' : 'Recommended'}
                </span>
              </div>
              {result.recommended.estimatedLatency && (
                <span className="text-sm text-zion-gold">
                  ~{result.recommended.estimatedLatency}ms
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 bg-black/50 border border-white/10 p-3 rounded-2xl">
              <code className="text-sm text-zion-gold flex-1 font-mono">
                {result.recommended.host}:{result.recommended.port}
              </code>
              <button
                onClick={() => copyToClipboard(`${result.recommended!.host}:${result.recommended!.port}`)}
                className="p-2 hover:bg-white/10 rounded transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>

            {result.recommended.distance && (
              <div className="mt-2 text-sm text-gray-400">
                {cs ? 'Vzdálenost' : 'Distance'}: {Math.round(result.recommended.distance)} km
              </div>
            )}
          </div>
          ) : (
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
            <p className="text-gray-400 text-sm">{cs ? 'Není k dispozici žádný doporučený pool. Zkuste zjistit svoji polohu.' : 'No recommended pool available. Try detecting your location.'}</p>
          </div>
          )}

          {/* All Pools */}
          {result.pools && result.pools.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-2">{cs ? 'Všechny pooly' : 'All Pools'}</h4>
            <div className="space-y-2">
              {result.pools.map((pool, index) => (
                <div
                  key={pool.id}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    index === 0 ? 'bg-white/5 border border-white/15' : 'bg-black/40 border border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 font-mono text-sm">#{index + 1}</span>
                    <div>
                      <div className="text-white text-sm">{pool.name}</div>
                      <div className="text-gray-500 text-xs font-mono">{pool.region}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-gray-300">
                      {pool.host}:{pool.port}
                    </div>
                    {pool.distance && (
                      <div className="text-xs text-gray-500">
                        {Math.round(pool.distance)} km
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
