export const dynamic = 'force-dynamic';

import { TOTAL_SUPPLY_ZION } from '@/lib/constants';

// CoinGecko/CMC supply API spec: plain numeric response.
export async function GET() {
  return new Response(String(TOTAL_SUPPLY_ZION), {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, s-maxage=300' },
  });
}
