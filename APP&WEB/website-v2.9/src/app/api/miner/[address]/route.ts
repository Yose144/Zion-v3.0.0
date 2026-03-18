import { NextResponse } from 'next/server';
import { SITE_PRIMARY_HOST } from '@/lib/site';

const POOL_API = `http://${SITE_PRIMARY_HOST}:8080`;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: addr } = await params;
  if (!addr) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const [minersRes, statsRes] = await Promise.all([
      fetch(`${POOL_API}/miners`, { cache: 'no-store' }),
      fetch(`${POOL_API}/stats`, { cache: 'no-store' }),
    ]);

    const minersData = await minersRes.json();
    const poolStats = statsRes.ok ? await statsRes.json() : null;

    const miner = minersData?.miners?.find(
      (m: { address: string }) => m.address === addr
    );

    if (!miner) {
      return NextResponse.json({ error: 'Miner not found' }, { status: 404 });
    }

    return NextResponse.json({
      wallet_address: miner.address,
      is_active: true,
      last_share: miner.last_share,
      stats: {
        last_share_time: miner.last_share,
        time_since_last_share: miner.last_share
          ? Math.floor(Date.now() / 1000) - miner.last_share
          : 0,
        current_hashrate: poolStats?.hashrate?.pool ?? 0,
        total_shares: poolStats?.shares?.valid ?? 0,
        accepted_shares: poolStats?.shares?.valid ?? 0,
        rejected_shares: poolStats?.shares?.invalid ?? 0,
        blocks_found: 0,
        first_seen: miner.last_share ?? 0,
        last_seen: miner.last_share ?? 0,
      },
      balance: {
        pending: 0,
        total_earned: 0,
      },
      payments: [],
      efficiency: {
        acceptance_rate: (() => {
          const v = poolStats?.shares?.valid ?? 0;
          const i = poolStats?.shares?.invalid ?? 0;
          const total = v + i;
          return total > 0 ? Math.round((v / total) * 10000) / 100 : 100;
        })(),
        rejection_rate: (() => {
          const v = poolStats?.shares?.valid ?? 0;
          const i = poolStats?.shares?.invalid ?? 0;
          const total = v + i;
          return total > 0 ? Math.round((i / total) * 10000) / 100 : 0;
        })(),
      },
      pool: poolStats,
    });
  } catch (err) {
    console.error('[miner-api]', err);
    return NextResponse.json({ error: 'Pool API unavailable' }, { status: 502 });
  }
}
