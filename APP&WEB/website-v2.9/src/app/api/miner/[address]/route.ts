import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

const ACTIVE_THRESHOLD_SECONDS = 600;

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

    const stats = minerInfo?.stats || {};
    const balance = minerInfo?.balance || {};
    const lastSeen = stats.last_seen || stats.last_share_time || 0;
    const isActive =
      lastSeen > 0 &&
      Math.floor(Date.now() / 1000) - lastSeen < ACTIVE_THRESHOLD_SECONDS;

    const valid = stats.valid_shares ?? 0;
    const invalid = stats.invalid_shares ?? 0;
    const total = valid + invalid;

    return NextResponse.json({
      wallet_address: addr,
      is_active: isActive,
      stats: {
        current_hashrate: stats.hashrate_1h ?? 0,
        total_shares: stats.total_shares ?? valid + invalid,
        accepted_shares: valid,
        rejected_shares: invalid,
        blocks_found: stats.blocks_found ?? 0,
        last_seen: lastSeen,
      },
      balance: {
        pending: balance.pending ?? 0,
        total_earned: balance.paid ?? minerInfo.balance ?? 0,
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
