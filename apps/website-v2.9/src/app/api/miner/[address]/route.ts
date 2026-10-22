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

    // Addresses that never mined get a zeroed/balance-only shape — no
    // mining signal at all. Treat those as not-found so the UI shows the
    // "no mining activity" state instead of a zeroed card.
    const hasMiningSignal = minerInfo && (
      (minerInfo.last_seen ?? 0) > 0 ||
      (minerInfo.first_seen ?? 0) > 0 ||
      (minerInfo.accepted_shares ?? 0) > 0 ||
      (minerInfo.rejected_shares ?? 0) > 0 ||
      (minerInfo.blocks_found ?? 0) > 0 ||
      (minerInfo.hashrate_1h ?? 0) > 0 ||
      (minerInfo.hashrate ?? 0) > 0
    );
    if (!hasMiningSignal) {
      return NextResponse.json({ error: 'Miner not found' }, { status: 404 });
    }

    // getMinerInfo returns flat miner fields, not a nested stats object.
    const lastSeen =
      minerInfo.last_seen || minerInfo.last_share_time || 0;
    const isActive =
      lastSeen > 0 &&
      Math.floor(Date.now() / 1000) - lastSeen < ACTIVE_THRESHOLD_SECONDS;

    const valid = minerInfo.accepted_shares ?? 0;
    const invalid = minerInfo.rejected_shares ?? 0;
    const total = valid + invalid;

    return NextResponse.json({
      wallet_address: addr,
      worker_name: minerInfo.worker ?? null,
      is_active: isActive,
      stats: {
        current_hashrate: minerInfo.hashrate_1h ?? 0,
        total_shares: valid + invalid,
        accepted_shares: valid,
        rejected_shares: invalid,
        blocks_found: minerInfo.blocks_found ?? 0,
        last_seen: lastSeen,
      },
      balance: {
        pending:
          typeof minerInfo.balance === 'object'
            ? minerInfo.balance.pending ?? 0
            : 0,
        total_earned:
          typeof minerInfo.balance === 'object'
            ? minerInfo.balance.paid ?? 0
            : minerInfo.balance ?? 0,
      },
      payments: Array.isArray(minerInfo.recent_payouts) ? minerInfo.recent_payouts : [],
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
