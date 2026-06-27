'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import { 
  type LucideIcon,
  Globe, 
  Server, 
  Activity, 
  Users, 
  Gauge,
  CheckCircle,
  XCircle,
  RefreshCw,
  MapPin,
  Zap,
} from 'lucide-react';

interface NodeStatus {
  id: string;
  name: string;
  host: string;
  region: string;
  lat: number;
  lon: number;
  online: boolean;
  height: number;
  peers: number;
  hashrate: number;
  miners: number;
  uptime: number;
  rpcLatencyMs?: number;
  poolLatencyMs?: number;
  blockLag?: number;
  lastChecked: string;
  error?: string;
}

interface NetworkStatus {
  timestamp: string;
  nodes: NodeStatus[];
  summary: {
    total: number;
    online: number;
    onlinePct?: number;
    maxHeight: number;
    minHeight?: number;
    heightGap?: number;
    totalHashrate: number;
    totalMiners: number;
    inSync: boolean;
  };
}

const regionFlags: Record<string, string> = {
  'PRIMARY': '🟡',
  'INTERNAL': '🔹',
  'EU-NORTH': '🟡',
  'US-EAST': '🔹',
  'ASIA-SE': '🔹',
};

const getRegionLabels = (cs: boolean): Record<string, string> => ({
  'PRIMARY': cs ? 'Primarni host' : 'Primary host',
  'INTERNAL': cs ? 'Interni quorum' : 'Internal quorum',
  'EU-NORTH': cs ? 'Primarni host' : 'Primary host',
  'US-EAST': cs ? 'Interni quorum' : 'Internal quorum',
  'ASIA-SE': cs ? 'Interni quorum' : 'Internal quorum',
});

export default function NetworkStatus({ className }: { className?: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const locale = cs ? 'cs-CZ' : 'en-US';
  const regionLabels = getRegionLabels(cs);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/network', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStatus(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchStatus, 30_000);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-zion-gold" />
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="p-4 rounded-2xl border border-red-500/40 bg-red-500/10 text-red-300">
        {error}
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className={["space-y-6", className].filter(Boolean).join(" ")}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={Server}
          label={cs ? 'Hosty online' : 'Hosts Online'}
          value={`${status.summary.online}/${status.summary.total}`}
          accent={status.summary.online === status.summary.total ? 'green' : 'yellow'}
          sub={status.summary.onlinePct != null ? `${status.summary.onlinePct}%` : undefined}
        />
        <SummaryCard
          icon={Activity}
          label={cs ? 'Vyska bloku' : 'Block Height'}
          value={status.summary.maxHeight ? status.summary.maxHeight.toLocaleString(locale) : '—'}
          accent="blue"
        />
        <SummaryCard
          icon={Gauge}
          label={cs ? 'Rozdil vysky' : 'Height Gap'}
          value={`${status.summary.heightGap ?? 0}`}
          accent="purple"
          sub={status.summary.inSync ? (cs ? 'synchronizovano' : 'in sync') : (cs ? 'synchronizuji' : 'syncing')}
        />
        <SummaryCard
          icon={Users}
          label={cs ? 'Aktivni mineri' : 'Active Miners'}
          value={status.summary.totalMiners.toString()}
          accent="gold"
        />
      </div>

      {/* Sync Status */}
      <div className={`p-4 rounded-2xl border backdrop-blur ${
        status.summary.inSync 
          ? 'bg-emerald-500/10 border-emerald-400/40' 
          : 'bg-yellow-500/10 border-yellow-400/40'
      }`}>
        <div className="flex items-center gap-2">
          {status.summary.inSync ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-yellow-400" />
          )}
          <span className={status.summary.inSync ? 'text-green-400' : 'text-yellow-400'}>
            {status.summary.inSync ? (cs ? 'Sit je synchronizovana' : 'Network Synchronized') : (cs ? 'Synchronizuji...' : 'Synchronizing...')}
          </span>
        </div>
      </div>

      {/* Node List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-zion-gold" />
          {cs ? 'Sitove hosty' : 'Network Hosts'}
        </h3>
        
        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {status.nodes.map((node, index) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
              >
                <NodeCard node={node} cs={cs} locale={locale} regionLabels={regionLabels} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Latency Panel */}
      {status.nodes.some((n) => n.online && (n.rpcLatencyMs != null || n.poolLatencyMs != null)) && (
        <div className="zion-rainbow-card p-5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-yellow-400" />
            {cs ? 'Latence uzlů' : 'Node Latency'}
          </h3>
          <div className="grid gap-3">
            {status.nodes.filter((n) => n.online).map((node) => (
              <div key={node.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="flex items-center gap-2 min-w-[140px]">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-white">{node.name}</span>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 block mb-0.5">RPC</span>
                    <span className="text-white font-mono">{node.rpcLatencyMs != null ? `${node.rpcLatencyMs}ms` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Pool</span>
                    <span className="text-white font-mono">{node.poolLatencyMs != null ? `${node.poolLatencyMs}ms` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">{cs ? 'Lag' : 'Lag'}</span>
                    <span className="text-white font-mono">{node.blockLag != null ? `${node.blockLag}` : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Update */}
      {lastUpdate && (
        <div className="text-xs uppercase tracking-[0.3em] text-gray-500 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-zion-gold" />
          {cs ? 'Aktualizovano' : 'Updated'} {lastUpdate.toLocaleTimeString(locale)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ 
  icon: Icon, 
  label, 
  value, 
  accent,
  sub,
}: { 
  icon: LucideIcon;
  label: string; 
  value: string; 
  accent: 'green' | 'yellow' | 'blue' | 'purple' | 'gold';
  sub?: string;
}) {
  const accentMap: Record<'green' | 'yellow' | 'blue' | 'purple' | 'gold', { border: string; value: string }> = {
    green: { border: 'border-emerald-400/40', value: 'text-emerald-200' },
    yellow: { border: 'border-yellow-400/40', value: 'text-yellow-200' },
    blue: { border: 'border-blue-400/40', value: 'text-blue-200' },
    purple: { border: 'border-purple-400/40', value: 'text-purple-200' },
    gold: { border: 'border-zion-gold/40', value: 'text-zion-gold' },
  };

  const accentClasses = accentMap[accent];

  return (
    <div className={`p-4 rounded-2xl bg-black/40 backdrop-blur border ${accentClasses.border}`}>
      <div className="flex items-center gap-2 mb-2 text-gray-400">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-[0.3em]">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accentClasses.value}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function NodeCard({ node, cs, locale, regionLabels }: { node: NodeStatus; cs: boolean; locale: string; regionLabels: Record<string, string> }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      node.online 
        ? 'bg-black/40 border-white/10 hover:border-zion-gold/40' 
        : 'bg-red-900/20 border-red-500/40'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className={`w-3 h-3 rounded-full ${
            node.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`} />
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{regionFlags[node.region] || '🌐'}</span>
              <span className="font-semibold text-white">{node.name}</span>
              <span className="text-xs text-gray-500 font-mono">{node.host}</span>
            </div>
            
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {regionLabels[node.region] || node.region}
              </span>
              {node.online && (
                <>
                  <span>{cs ? 'Vyska' : 'Height'}: {node.height ? node.height.toLocaleString(locale) : '—'}</span>
                  {node.blockLag != null && <span>{cs ? 'Zpozdeni' : 'Lag'}: {node.blockLag}</span>}
                  {node.rpcLatencyMs != null && <span>RPC: {node.rpcLatencyMs} ms</span>}
                  {node.poolLatencyMs != null && <span>Pool: {node.poolLatencyMs} ms</span>}
                  {node.miners > 0 && (
                    <span className="text-zion-gold">
                      {node.miners} {cs ? (node.miners !== 1 ? 'mineru' : 'miner') : `miner${node.miners !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Hashrate badge */}
        {node.online && node.hashrate > 0 && (
          <div className="px-3 py-1 bg-zion-gold/15 border border-zion-gold/40 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.25)]">
            <span className="text-sm text-zion-gold font-mono">
              {formatHashrate(node.hashrate)}
            </span>
          </div>
        )}
      </div>

      {node.error && !node.online && (
        <div className="mt-2 text-xs text-red-400">
          {cs ? 'Chyba' : 'Error'}: {node.error}
        </div>
      )}
    </div>
  );
}

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
  if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
  if (hashrate >= 1e6) return (hashrate / 1e6).toFixed(2) + ' MH/s';
  if (hashrate >= 1e3) return (hashrate / 1e3).toFixed(2) + ' KH/s';
  return hashrate.toFixed(2) + ' H/s';
}
