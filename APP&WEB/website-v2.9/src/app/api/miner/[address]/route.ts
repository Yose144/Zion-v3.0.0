import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: addr } = await params;
  if (!addr) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const rpc = getZionRpc();
    const [minerInfo, poolStats] = await Promise.all([
      rpc.getMinerInfo(addr).catch(() => null),
      rpc.getPoolStats().catch(() => null),
    ]);

    if (!minerInfo) {
      return NextResponse.json({ error: 'Miner not found' }, { status: 404 });
    }

    const valid = poolStats?.shares?.valid ?? poolStats?.routing?.accepted ?? 0;
    const invalid = poolStats?.shares?.invalid ?? poolStats?.routing?.rejected ?? 0;
    const total = valid + invalid;

    return NextResponse.json({
      wallet_address: addr,
      is_active: true,
      stats: {
        current_hashrate: 0,
        total_shares: valid,
        accepted_shares: valid,
        rejected_shares: invalid,
        blocks_found: 0,
      },
      balance: {
        pending: 0,
        total_earned: minerInfo.balance ?? 0,
      },
      payments: [],
      efficiency: {
        acceptance_rate: total > 0 ? Math.round((valid / total) * 10000) / 100 : 100,
        rejection_rate: total > 0 ? Math.round((invalid / total) * 10000) / 100 : 0,
      },
      pool: poolStats,
    });
  } catch (err) {
    console.error('[miner-api]', err);
    return NextResponse.json({ error: 'Pool API unavailable' }, { status: 502 });
  }
}
