/**
 * ZION Explorer — Peers / Connections API
 * 
 * Returns connected peers from the daemon via getPeerList RPC.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { createSwrCache, cacheControl } from '@/lib/server-cache';

/**
 * Loopback / private-range peers are local co-hosted nodes and tunnel
 * endpoints — publishing their addresses exposes internal topology (IA-17).
 * They are counted but their addresses are masked.
 */
function isPrivateHost(host: string | undefined | null): boolean {
  if (!host) return true;
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h.startsWith('127.') || h === '::1' || h.startsWith('[::1]') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.startsWith('169.254.') ||
    h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')
  );
}

const peersCache = createSwrCache<any>({
  freshMs: 10_000,
  staleMs: 120_000,
  maxEntries: 2,
});

async function computePeers() {
  const rpc = getZionRpc();
  const connections = await rpc.getConnections().catch(() => []);

  const peers = connections.map((peer: any) => {
    const internal = isPrivateHost(peer.host) || isPrivateHost(peer.address?.split(':')[0]);
    return {
      address: internal ? 'internal' : (peer.address || `${peer.host}:${peer.port}`),
      host: internal ? undefined : peer.host,
      port: internal ? undefined : peer.port,
      height: peer.height || 0,
      incoming: peer.incoming || false,
      connected: peer.connected === true,
      state: peer.connected === true ? 'connected' : (peer.state || 'known'),
      source: internal ? 'internal' : (peer.source || 'unknown'),
      sub_version: peer.sub_version || '',
      last_seen: peer.last_seen || 0,
      idle_seconds: peer.idle_seconds ?? 0,
      good: peer.good ?? 0,
      bad: peer.bad ?? 0,
      failed_attempts: peer.failed_attempts || 0,
    };
  });

  // Sort: connected first, then by height desc
  peers.sort((a: any, b: any) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return b.height - a.height;
  });

  const connectedCount = peers.filter((p: any) => p.connected).length;

  return {
    count: peers.length,
    connected_peers: connectedCount,
    known_peers: peers.length,
    peer_count: peers.length,
    chain_height: peers.length > 0 ? Math.max(...peers.map((p: any) => p.height)) : 0,
    peers,
  };
}

export async function GET() {
  try {
    const { value, stale, ageMs } = await peersCache.get('peers', computePeers);
    return NextResponse.json(value, {
      headers: {
        'Cache-Control': cacheControl({ maxAge: 5, sMaxAge: 5, swr: 30 }),
        'X-Explorer-Cache': stale ? `stale-${Math.round(ageMs / 1000)}s` : 'fresh',
      },
    });
  } catch (error) {
    console.error('Failed to fetch peers:', error);
    return NextResponse.json(
      { count: 0, connected_peers: 0, known_peers: 0, peer_count: 0, peers: [] },
      { status: 503 }
    );
  }
}
