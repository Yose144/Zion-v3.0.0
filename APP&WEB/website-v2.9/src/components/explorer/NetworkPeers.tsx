"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Globe, Link2, Power, SatelliteDish, ArrowUpRight, ArrowDownLeft, Wifi, WifiOff, Clock, TrendingUp } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { usePolling } from "@/hooks/usePolling";

interface PeerInfo {
  address: string;
  host: string;
  port: number;
  height: number;
  connected: boolean;
  state: string;
  sub_version: string;
  last_seen: number;
  idle_seconds: number;
  incoming: boolean;
  failed_attempts: number;
}

interface PeersPayload {
  count: number;
  connected_peers: number;
  known_peers: number;
  peer_count: number;
  chain_height: number;
  peers: PeerInfo[];
}

const formatIdleTime = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

const formatLastSeen = (timestamp: number, locale: string) => {
  if (!timestamp) return "—";
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function NetworkPeers() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const locale = cs ? "cs-CZ" : "en-US";
  const [data, setData] = useState<PeersPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPeers = useCallback(async () => {
    try {
      const res = await fetch("/api/blockchain/peers", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const payload: PeersPayload = await res.json();
      setData(payload);
    } catch (error) {
      console.error("Failed to fetch peer info", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadPeers, 15_000);

  const connectedCount = data?.connected_peers ?? 0;
  const knownCount = data?.known_peers ?? data?.peer_count ?? 0;

  const stats = [
    { label: cs ? "Známé peery" : "Known peers", value: knownCount, icon: Globe },
    { label: cs ? "Připojeno" : "Connected", value: connectedCount, icon: SatelliteDish },
    { label: cs ? "Aktivní spojení" : "Active links", value: connectedCount, icon: Link2 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-gray-400 flex items-center gap-2">
            {cs ? "Peer telemetrie" : "Peer telemetry"}
            <motion.span
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="inline-flex h-2 w-2 rounded-full bg-emerald-400"
            />
          </p>
          <h2 className="text-xl font-semibold text-white">{cs ? "Síťoví peeři" : "Network peers"}</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.35em] text-gray-300 flex items-center gap-2">
          <Power className="w-3 h-3 text-emerald-400 animate-pulse" />
          {cs ? "obnova 15 s" : "refresh 15s"}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="zion-rainbow-sub p-4" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-[0.35em]">
              <stat.icon className="h-4 w-4 text-zion-cyan" />
              {stat.label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Peer Directory */}
      <div className="zion-rainbow-card rounded-[24px] bg-black/40 p-5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Power className="h-4 w-4 text-emerald-300" />
            <span>{cs ? "Seznam peerů" : "Peer directory"}</span>
            {loading && <span className="text-xs text-gray-500">Načítám...</span>}
          </div>
          {data && data.chain_height > 0 && (
            <span className="text-xs text-gray-500">
              {cs ? "Výška chainu" : "Chain height"}: <span className="text-zion-cyan font-mono">{data.chain_height?.toLocaleString(locale)}</span>
            </span>
          )}
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="animate-pulse zion-rainbow-sub p-4" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                  <div className="mb-2 h-4 rounded bg-white/10" />
                  <div className="h-3 rounded bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && (!data?.peers || data.peers.length === 0) && (
            <div className="text-center py-8">
              <WifiOff className="h-8 w-8 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Žádní známí peerové.</p>
              <p className="text-xs text-gray-600 mt-1">Daemon ještě neregistroval žádné P2P připojení.</p>
            </div>
          )}

          {/* Peer list */}
          {data?.peers?.map((peer) => {
            const isSynced = data.chain_height > 0 && peer.height >= data.chain_height - 2;
            return (
              <motion.div
                key={peer.address}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`zion-rainbow-sub p-4 transition-colors ${
                  peer.connected
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : ''
                }`}
                style={{ '--rc': '251, 191, 36' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Connection status indicator */}
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      peer.connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-gray-600'
                    }`} />
                    <div>
                      <p className="text-sm font-semibold text-white font-mono">{peer.host}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {peer.connected ? (
                          <span className="text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <Wifi className="h-3 w-3" /> {cs ? "Připojen" : "Connected"}
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1">
                            <WifiOff className="h-3 w-3" /> {cs ? "Známý" : "Known"}
                          </span>
                        )}
                        {peer.incoming ? (
                          <span className="text-[10px] text-sky-400 flex items-center gap-0.5">
                            <ArrowDownLeft className="h-3 w-3" /> IN
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                            <ArrowUpRight className="h-3 w-3" /> OUT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-gray-300 font-mono">
                      :{peer.port}
                    </span>
                  </div>
                </div>

                {/* Peer details row */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {cs ? "Výška" : "Height"}: <span className={`font-mono ${isSynced ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {peer.height.toLocaleString(locale)}
                    </span>
                    {!isSynced && data.chain_height > 0 && (
                      <span className="text-amber-500 text-[10px]">(-{data.chain_height - peer.height})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {cs ? "Nečinnost" : "Idle"}: {formatIdleTime(peer.idle_seconds)}
                  </span>
                  {peer.sub_version && (
                    <span className="text-gray-500">v{peer.sub_version}</span>
                  )}
                  {peer.failed_attempts > 0 && (
                    <span className="text-red-400">⚠ {peer.failed_attempts} {cs ? "selhání" : "failures"}</span>
                  )}
                  <span className="text-gray-600">
                    {cs ? "Naposledy" : "Last"}: {formatLastSeen(peer.last_seen, locale)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
