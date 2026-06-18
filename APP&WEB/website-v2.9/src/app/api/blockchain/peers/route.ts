/**
 * ZION Explorer — Peers / Connections API
 * 
 * Returns connected peers from the daemon via getPeerList RPC.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

export async function GET() {
  const rpc = getZionRpc();

  try {
    const connections = await rpc.getConnections().catch(() => []);

    const peers = connections.map((peer: any) => ({
      address: peer.address || `${peer.host}:${peer.port}`,
      host: peer.host,
      port: peer.port,
      height: peer.height || 0,
      incoming: peer.incoming || false,
      connected: peer.connected || false,
      state: peer.state || 'known',
      sub_version: peer.sub_version || '',
      last_seen: peer.last_seen || 0,
      idle_seconds: peer.idle_seconds || 0,
      failed_attempts: peer.failed_attempts || 0,
    }));

    // Sort: connected first, then by height desc
    peers.sort((a: any, b: any) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return b.height - a.height;
    });

    const connectedCount = peers.filter((p: any) => p.connected).length;

    return NextResponse.json({
      count: peers.length,
      connected_peers: connectedCount,
      known_peers: peers.length,
      peer_count: peers.length,
      chain_height: peers.length > 0 ? Math.max(...peers.map((p: any) => p.height)) : 0,
      peers,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch (error) {
    console.error('Failed to fetch peers:', error);
    return NextResponse.json(
      { count: 0, connected_peers: 0, known_peers: 0, peer_count: 0, peers: [] },
      { status: 503 }
    );
  }
}
