import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { SITE_PRIMARY_POOL_API_URL } from '@/lib/site';
import { KNOWN_ADDRESS_MAP } from '@/lib/explorer/known-addresses';

async function rpc(method: string, params: Record<string, any> = {}) {
  try {
    const client = getZionRpc();
    return await client.rpcCall(method, params);
  } catch {
    return null;
  }
}

interface PoolMinerInfo {
  address: string;
  worker_name?: string;
  hashrate: number;
  pending: number;
  paid: number;
  shares: number;
}

// Fetch active/registered miners from the pool HTTP API.
async function fetchPoolMiners(): Promise<Record<string, PoolMinerInfo>> {
  const map: Record<string, PoolMinerInfo> = {};
  try {
    const res = await fetch(`${SITE_PRIMARY_POOL_API_URL}/miners?limit=500`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return map;
    const data = await res.json() as any;
    if (!data.ok || !Array.isArray(data.miners)) return map;

    for (const m of data.miners) {
      const addr = m.payout_address || m.address || '';
      if (!addr || !addr.startsWith('zion1')) continue;
      const existing = map[addr];
      const pending = Number(m.pending_balance || 0) / 1_000_000;
      const paid = Number(m.paid_total_atomic || m.paid_total || 0) / 1_000_000;
      const info: PoolMinerInfo = {
        address: addr,
        worker_name: m.worker_name,
        hashrate: Math.max(existing?.hashrate || 0, Number(m.hashrate || m.hashrate_1h || 0)),
        pending: (existing?.pending || 0) + pending,
        paid: (existing?.paid || 0) + paid,
        shares: (existing?.shares || 0) + Number(m.valid_shares || 0),
      };
      map[addr] = info;
    }
  } catch {
    /* ignore */
  }
  return map;
}

interface RichListEntry {
  rank: number;
  address: string;
  balance: number;
  balance_display: string;
  type: 'premine' | 'miner' | 'unknown' | 'dao' | 'humanitarian' | 'bridge' | 'pool';
  label: string | undefined;
  percentage: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

  try {
    const poolMiners = await fetchPoolMiners();
    const supplyInfo = await rpc('getSupplyInfo');
    const totalCirculating = supplyInfo?.circulating_supply || 16_280_000_000;

    let richList: RichListEntry[] = [];

    // Try RPC rich list first
    const utxoResult = await rpc('getRichList', [limit]);

    if (utxoResult && Array.isArray(utxoResult) && utxoResult.length > 0) {
      richList = utxoResult.map((entry: any, idx: number) => {
        const addr = entry.address || entry.addr || '';
        const balance = Number(entry.balance || 0) / 1_000_000; // flowers → ZION
        const known = KNOWN_ADDRESS_MAP.get(addr);
        const poolInfo = poolMiners[addr];
        const type: RichListEntry['type'] = known?.type || (poolInfo ? 'miner' : 'unknown');

        return {
          rank: idx + 1,
          address: addr,
          balance,
          balance_display: formatBalance(balance),
          type,
          label: known?.label,
          percentage: (balance / totalCirculating) * 100,
        };
      });
    } else {
      // Fallback: build from known premine / operational addresses + pool miners
      const allAddresses = new Set<string>([...KNOWN_ADDRESS_MAP.keys(), ...Object.keys(poolMiners)]);
      const client = getZionRpc();

      const balanceMap: Record<string, number> = {};
      await Promise.all(
        Array.from(allAddresses).map(async (addr) => {
          try {
            const bal = await client.getAddressBalance(addr);
            balanceMap[addr] = bal?.balance_zion || 0;
          } catch {
            balanceMap[addr] = 0;
          }
        })
      );

      richList = Array.from(allAddresses)
        .map((addr) => {
          const known = KNOWN_ADDRESS_MAP.get(addr);
          const poolInfo = poolMiners[addr];
          const balance = balanceMap[addr] || poolInfo?.pending || 0;

          // Skip addresses with zero balance unless they're a known premine/pool address
          if (balance <= 0 && !known) return null;

          const type: RichListEntry['type'] = known?.type || (poolInfo ? 'miner' : 'unknown');
          return {
            rank: 0,
            address: addr,
            balance,
            balance_display: formatBalance(balance),
            type,
            label: known?.label,
            percentage: (balance / totalCirculating) * 100,
          };
        })
        .filter((e): e is RichListEntry => e !== null)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, limit)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      // If still empty, return an honest empty state with known addresses listed
      if (richList.length === 0) {
        richList = Array.from(KNOWN_ADDRESS_MAP.values())
          .filter((k) => k.expected_balance_zion && k.expected_balance_zion > 0)
          .map((k, idx) => ({
            rank: idx + 1,
            address: k.address,
            balance: k.expected_balance_zion || 0,
            balance_display: formatBalance(k.expected_balance_zion || 0),
            type: k.type,
            label: `${k.label} (expected premine)`,
            percentage: ((k.expected_balance_zion || 0) / totalCirculating) * 100,
          }))
          .sort((a, b) => b.balance - a.balance)
          .slice(0, limit);
      }
    }

    const totalInRichList = richList.reduce((sum, e) => sum + e.balance, 0);
    const premineCount = richList.filter((e) => e.type === 'premine').length;
    const minerCount = richList.filter((e) => e.type === 'miner' || e.type === 'pool').length;

    return NextResponse.json({
      rich_list: richList,
      stats: {
        total_addresses: richList.length,
        total_balance: totalInRichList,
        total_balance_display: formatBalance(totalInRichList),
        circulating_supply: totalCirculating,
        top_10_percentage: richList.slice(0, 10).reduce((s, e) => s + e.percentage, 0),
        premine_addresses: premineCount,
        miner_addresses: minerCount,
        gini_coefficient: calculateGini(richList.map((e) => e.balance)),
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('Failed to fetch rich list:', error);
    return NextResponse.json({ error: 'Failed to fetch rich list' }, { status: 500 });
  }
}

function formatBalance(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function calculateGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;
  let sumDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumDiff += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return sumDiff / (2 * n * n * mean);
}
