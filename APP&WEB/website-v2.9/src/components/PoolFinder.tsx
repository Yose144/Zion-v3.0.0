'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Zap, Copy, Check, Navigation2 } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const PoolFinderCopy = {
  findBestMiningPool: { cs: `Najít nejlepší těžební pool`, en: `Find Best Mining Pool` },
  getTheOptimalMiningPoolBasedOn: { cs: `Získejte optimální těžební pool podle své polohy pro co nejnižší latenci.`, en: `Get the optimal mining pool based on your location for lowest latency.` },
  detecting: { cs: `Zjišťuji polohu...`, en: `Detecting...` },
  useMyLocation: { cs: `Použít moji polohu`, en: `Use My Location` },
  enterManually: { cs: `Zadat ručně`, en: `Enter Manually` },
  latitudeEG5008: { cs: `Zeměpisná šířka (např. 50.08)`, en: `Latitude (e.g. 50.08)` },
  longitudeEG1442: { cs: `Zeměpisná délka (např. 14.42)`, en: `Longitude (e.g. 14.42)` },
  search: { cs: `Hledat`, en: `Search` },
  recommended: { cs: `Doporučeno`, en: `Recommended` },
  distance: { cs: `Vzdálenost`, en: `Distance` },
  noRecommendedPoolAvailableTryD: { cs: `Není k dispozici žádný doporučený pool. Zkuste zjistit svoji polohu.`, en: `No recommended pool available. Try detecting your location.` },
  allPools: { cs: `Všechny pooly`, en: `All Pools` },
};

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
    <div className="zion-rainbow-card p-6" style={{ '--rc': '7, 137, 48' } as React.CSSProperties}>
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-zion-gold" />
        {PoolFinderCopy.findBestMiningPool[cs ? 'cs' : 'en']}
      </h3>

      <p className="text-gray-400 text-sm mb-6">
        {PoolFinderCopy.getTheOptimalMiningPoolBasedOn[cs ? 'cs' : 'en']}
      </p>

      {/* Location Detection */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={detectLocation}
          disabled={loading}
          className="zion-button-primary disabled:opacity-60"
        >
          <Navigation2 className="w-4 h-4" />
          {loading ? (PoolFinderCopy.detecting[cs ? 'cs' : 'en']) : (PoolFinderCopy.useMyLocation[cs ? 'cs' : 'en'])}
        </button>

        <button
          onClick={() => setUseManual(!useManual)}
          className="zion-button-secondary"
        >
          <MapPin className="w-4 h-4" />
          {PoolFinderCopy.enterManually[cs ? 'cs' : 'en']}
        </button>
      </div>

      {/* Manual Input */}
      {useManual && (
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder={PoolFinderCopy.latitudeEG5008[cs ? 'cs' : 'en']}
            value={manualLocation.lat}
            onChange={(e) => setManualLocation(prev => ({ ...prev, lat: e.target.value }))}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:border-zion-gold outline-none"
          />
          <input
            type="text"
            placeholder={PoolFinderCopy.longitudeEG1442[cs ? 'cs' : 'en']}
            value={manualLocation.lon}
            onChange={(e) => setManualLocation(prev => ({ ...prev, lon: e.target.value }))}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:border-zion-gold outline-none"
          />
          <button
            onClick={handleManualSearch}
            className="zion-button-primary"
          >
            {PoolFinderCopy.search[cs ? 'cs' : 'en']}
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
          <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <span className="font-semibold text-white">{result.recommended.name}</span>
                <span className="zion-badge-green">
                  {PoolFinderCopy.recommended[cs ? 'cs' : 'en']}
                </span>
              </div>
              {result.recommended.estimatedLatency && (
                <span className="text-sm text-zion-gold">
                  ~{result.recommended.estimatedLatency}ms
                </span>
              )}
            </div>

            <div className="zion-rainbow-sub p-3 flex items-center gap-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <code className="text-sm text-zion-gold flex-1 font-mono">
                {result.recommended.host}:{result.recommended.port}
              </code>
              <button
                onClick={() => copyToClipboard(`${result.recommended!.host}:${result.recommended!.port}`)}
                className="zion-button-secondary w-8 h-8 p-0 flex items-center justify-center"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-zion-cyan-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>

            {result.recommended.distance && (
              <div className="mt-2 text-sm text-gray-400">
                {PoolFinderCopy.distance[cs ? 'cs' : 'en']}: {Math.round(result.recommended.distance)} km
              </div>
            )}
          </div>
          ) : (
          <div className="zion-rainbow-sub p-4 text-center" style={{ '--rc': '255, 255, 255' } as React.CSSProperties}>
            <p className="text-gray-400 text-sm">{PoolFinderCopy.noRecommendedPoolAvailableTryD[cs ? 'cs' : 'en']}</p>
          </div>
          )}

          {/* All Pools */}
          {result.pools && result.pools.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-400 mb-2">{PoolFinderCopy.allPools[cs ? 'cs' : 'en']}</h4>
            <div className="space-y-2">
              {result.pools.map((pool, index) => (
                <div
                  key={pool.id}
                  className="zion-rainbow-sub p-3 flex items-center justify-between"
                  style={{ '--rc': index === 0 ? '252, 209, 22' : '7, 137, 48' } as React.CSSProperties}
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
