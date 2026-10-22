export const dynamic = 'force-dynamic';

import { getZionRpc } from '@/lib/zion-rpc';
import { resolveSupplySnapshot } from '@/lib/supply';
import { GENESIS_PREMINE_ZION } from '@/lib/constants';

// CoinGecko/CMC supply API spec: plain numeric response.
export async function GET() {
  try {
    const rpc = getZionRpc();
    const info = await rpc.getInfo();
    const supply = await resolveSupplySnapshot(rpc, info.height);
    return new Response(String(Math.floor(supply.circulatingSupply)), {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, s-maxage=60' },
    });
  } catch {
    return new Response(String(GENESIS_PREMINE_ZION), {
      headers: { 'Content-Type': 'text/plain' },
      status: 200,
    });
  }
}
