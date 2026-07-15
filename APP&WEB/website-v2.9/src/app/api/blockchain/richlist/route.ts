import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { SITE_PRIMARY_POOL_API_URL } from '@/lib/site';

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
// PPLNS composite keys (miner_id/worker_name) are split by the pool; we key
// the result by payout_address so the explorer can mark mining addresses.
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
      // Merge multiple workers pointing to the same payout address; keep the
      // largest values so the address appears active in the leaderboard.
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
  type: 'premine' | 'miner' | 'unknown';
  label?: string;
  percentage: number;
}

// Known premine addresses
const KNOWN_ADDRESSES: Record<string, { type: 'premine' | 'miner'; label: string }> = {
  'zion1oasis': { type: 'premine', label: 'ZION Oasis + Golden Egg' },
  'zion1dao': { type: 'premine', label: 'DAO Treasury' },
  'zion1infra': { type: 'premine', label: 'Infrastructure & Dev' },
  'zion1humanitarian': { type: 'premine', label: 'Humanitarian Fund' },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);
  
  try {
    // Try to get UTXO-based rich list from RPC
    const utxoResult = await rpc('getRichList', [limit]);
    
    // Also get pool miners for mining activity data
    const poolMiners = await fetchPoolMiners();
    
    // Get supply info
    const supplyInfo = await rpc('getSupplyInfo');
    const totalCirculating = supplyInfo?.circulating_supply || 16_280_000_000;
    
    let richList: RichListEntry[] = [];
    
    if (utxoResult && Array.isArray(utxoResult)) {
      // RPC returned real data
      richList = utxoResult.map((entry: any, idx: number) => {
        const addr = entry.address || entry.addr || '';
        const balance = Number(entry.balance || 0) / 1_000_000; // flowers → ZION (6 decimals)
        const known = KNOWN_ADDRESSES[addr];
        return {
          rank: idx + 1,
          address: addr,
          balance,
          balance_display: formatBalance(balance),
          type: known?.type || (poolMiners[addr] ? 'miner' : 'unknown'),
          label: known?.label,
          percentage: (balance / totalCirculating) * 100,
        };
      });
    } else {
      // Fallback: build from genesis premine + pool miners
      const premineEntries: RichListEntry[] = [
        { rank: 1, address: 'zion1oasis...golden_egg', balance: 8_250_000_000, balance_display: '8,250,000,000', type: 'premine', label: 'ZION Oasis + Winners Golden Egg/XP', percentage: (8_250_000_000 / totalCirculating) * 100 },
        { rank: 2, address: 'zion1dao...treasury', balance: 4_000_000_000, balance_display: '4,000,000,000', type: 'premine', label: 'DAO Treasury', percentage: (4_000_000_000 / totalCirculating) * 100 },
        { rank: 3, address: 'zion1infra...dev', balance: 2_500_000_000, balance_display: '2,500,000,000', type: 'premine', label: 'Infrastructure & Dev', percentage: (2_500_000_000 / totalCirculating) * 100 },
        { rank: 4, address: 'zion1humanitarian...fund', balance: 1_530_000_000, balance_display: '1,530,000,000', type: 'premine', label: 'Humanitarian Fund', percentage: (1_530_000_000 / totalCirculating) * 100 },
      ];
      
      // Add real pool miners from the PPLNS pool API. Look up on-chain balance
      // for each unique payout address so the leaderboard is sorted correctly.
      const minerAddrs = Object.keys(poolMiners);
      const balanceMap: Record<string, number> = {};
      if (minerAddrs.length > 0) {
        const client = getZionRpc();
        await Promise.all(
          minerAddrs.map(async (addr) => {
            try {
              const bal = await client.getAddressBalance(addr);
              balanceMap[addr] = bal?.balance_zion || 0;
            } catch {
              balanceMap[addr] = 0;
            }
          })
        );
      }

      const minerEntries: RichListEntry[] = minerAddrs
        .filter((addr) => {
          const info = poolMiners[addr];
          return balanceMap[addr] > 0 || info.pending > 0 || info.paid > 0 || info.shares > 0;
        })
        .map((addr) => {
          const info = poolMiners[addr];
          const balance = balanceMap[addr] || info.pending || 0;
          return {
            rank: 0,
            address: addr,
            balance,
            balance_display: formatBalance(balance),
            type: 'miner' as const,
            percentage: (balance / totalCirculating) * 100,
          };
        })
        .sort((a, b) => b.balance - a.balance);

      richList = [...premineEntries, ...minerEntries]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, limit)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    }
    
    // Stats
    const totalInRichList = richList.reduce((sum, e) => sum + e.balance, 0);
    const premineCount = richList.filter(e => e.type === 'premine').length;
    const minerCount = richList.filter(e => e.type === 'miner').length;
    
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
        gini_coefficient: calculateGini(richList.map(e => e.balance)),
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
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
