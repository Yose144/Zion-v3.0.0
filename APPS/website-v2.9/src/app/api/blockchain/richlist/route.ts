import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

async function rpc(method: string, params: Record<string, any> = {}) {
  try {
    const client = getZionRpc();
    return await client.rpcCall(method, params);
  } catch {
    return null;
  }
}

// V3 pool doesn't expose per-miner data — return empty
async function fetchPoolMiners() {
  return {} as Record<string, { hashrate: number; pending: number; paid: number; shares: number }>;
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
        const balance = Number(entry.balance || 0) / 1_000_000_000_000; // atomic → ZION (12 decimals)
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
      
      // Add pool miners
      const minerEntries: RichListEntry[] = Object.entries(poolMiners)
        .filter(([_, info]) => info.paid > 0 || info.pending > 0)
        .map(([addr, info]) => {
          const balance = (info.paid + info.pending) / 1_000_000_000_000;
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
