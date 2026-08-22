export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };
const ALLOWED_METHODS = new Set(['submitTransaction', 'submitAccountTransaction', 'submitUtxoTransaction', 'sendRawTransaction']);
const FLOWERS_PER_ZION = 1_000_000;

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTransactionPayload(body: any): unknown {
  const candidate = body?.transaction ?? body?.payload ?? body?.data ?? body?.tx;
  if (candidate && typeof candidate === 'object' && 'data' in candidate && typeof candidate.data === 'object') {
    return candidate.data;
  }
  return candidate;
}

export async function GET(request: NextRequest) {
  const rpc = getZionRpc();
  const address = request.nextUrl.searchParams.get('address')?.trim() ?? '';

  try {
    const [info, supply, wallet, miner] = await Promise.all([
      rpc.getInfo(),
      rpc.rpcCall<any>('getSupplyInfo').catch(() => null),
      address ? rpc.getWalletSnapshot(address) : Promise.resolve(null),
      address ? rpc.getMinerInfo(address).catch(() => null) : Promise.resolve(null),
    ]);

    const walletPayload = wallet
      ? {
          address: wallet.address,
          balance_atomic: wallet.balance_atomic,
          balance_zion: wallet.balance_zion,
          balance_display: wallet.balance_atomic > 0
            ? (wallet.balance_atomic / FLOWERS_PER_ZION).toFixed(6)
            : wallet.balance_zion.toFixed(6),
          chain_height: wallet.chain_height,
          transaction_model: wallet.transaction_model,
          utxo_count: wallet.utxo_count,
          total_utxo_amount: wallet.total_utxo_amount,
          total_utxo_zion: wallet.total_utxo_amount / FLOWERS_PER_ZION,
          utxos: wallet.utxos.slice(0, 20),
        }
      : null;

    const minerPayload = miner
      ? {
          pending_balance_zion: asNumber(miner.balance?.pending ?? miner.balance ?? 0),
          paid_balance_zion: asNumber(miner.balance?.paid ?? 0),
          accepted_shares: asNumber(miner.accepted_shares ?? 0),
          rejected_shares: asNumber(miner.rejected_shares ?? 0),
          blocks_found: asNumber(miner.blocks_found ?? 0),
          hashrate_1h: asNumber(miner.hashrate_1h ?? 0),
          hashrate_24h: asNumber(miner.hashrate_24h ?? 0),
          last_seen: asNumber(miner.last_seen ?? 0),
          recent_payouts: Array.isArray(miner.recent_payouts) ? miner.recent_payouts.slice(0, 10) : [],
        }
      : null;

    return NextResponse.json(
      {
        ok: true,
        rpc: {
          connected: true,
          chain_height: info.height ?? 0,
          peers: (info.outgoing_connections_count ?? 0) + (info.incoming_connections_count ?? 0),
          mempool_size: info.tx_pool_size ?? 0,
          network: info.nettype ?? 'mainnet',
          version: info.version ?? 'unknown',
          submit_methods: Array.from(ALLOWED_METHODS),
        },
        supply: supply
          ? {
              circulating_supply_zion: asNumber(supply.circulating_supply_zion, 0),
              remaining_supply_zion: asNumber(supply.remaining_supply_zion, 0),
              block_reward_zion: asNumber(supply.block_reward_zion, 0),
            }
          : null,
        wallet: walletPayload,
        miner: minerPayload,
        broadcast: {
          endpoint: '/api/wallet',
          mode: 'signed-transaction-only',
          note: 'Web route broadcasts already signed account or UTXO transactions. Keys stay outside the server.',
        },
      },
      { headers: HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Wallet RPC unavailable' },
      { status: 502, headers: HEADERS },
    );
  }
}

export async function POST(request: NextRequest) {
  const rpc = getZionRpc();

  try {
    const body = await request.json();
    const method = ALLOWED_METHODS.has(body?.method) ? body.method : 'submitTransaction';
    const transaction = normalizeTransactionPayload(body);

    if (!transaction || typeof transaction !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Missing transaction object. Submit a signed account or UTXO transaction payload.' },
        { status: 400, headers: HEADERS },
      );
    }

    const result = await rpc.submitSignedTransaction(
      transaction,
      method as 'submitTransaction' | 'submitAccountTransaction' | 'submitUtxoTransaction' | 'sendRawTransaction',
    );

    return NextResponse.json(
      {
        ok: true,
        method,
        accepted: Boolean(result?.accepted),
        tx_id: result?.tx_id ?? null,
      },
      { headers: HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Transaction submit failed' },
      { status: 502, headers: HEADERS },
    );
  }
}