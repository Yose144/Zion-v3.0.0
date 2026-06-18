export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Minimal contract interfaces for on-chain reads
const CALLS = {
  // wZION
  totalSupply:    '0x18160ddd', // totalSupply()
  decimals:       '0x313ce567', // decimals()
  // Staking
  totalStaked:    '0x817b1cd2', // totalStaked()
  annualRateBps:  '0x1b05a948', // annualRateBps() — may not match, we'll try
  // Farm
  poolLength:     '0x081e3eda', // poolLength()
  rewardPerSec:   '0x8bdf67f2', // rewardPerSecond()
  // Governance
  proposalCount:  '0xda35c664', // proposalCount()
  // Bridge
  threshold:      '0x42cde4e8', // threshold()
  validatorCount: '0x0f43a677', // validatorCount()
};

const CONTRACTS: Record<string, string> = {
  wZION:          '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
  ZIONBridge:     '0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721',
  UniV3Pool:      '0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB',
  UniV3Router:    '0x2626664c2603336E57B271c5C0b26F421741e481',
  WETH:           '0x4200000000000000000000000000000000000006',
};

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

function hexToNumber(hex: string | null): number {
  if (!hex || hex === '0x') return 0;
  return Number(BigInt(hex));
}

function hexToDecimal18(hex: string | null): string {
  if (!hex || hex === '0x') return '0';
  const raw = BigInt(hex);
  const whole = raw / BigInt(1e18);
  const frac = raw % BigInt(1e18);
  const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${fracStr}`;
}

export async function GET() {
  try {
    const [
      totalSupplyHex,
      thresholdHex,
      validatorCountHex,
    ] = await Promise.all([
      ethCall(CONTRACTS.wZION, CALLS.totalSupply),
      ethCall(CONTRACTS.ZIONBridge, CALLS.threshold),
      ethCall(CONTRACTS.ZIONBridge, CALLS.validatorCount),
    ]);

    return NextResponse.json({
      ok: true,
      network: RPC_URL.includes('sepolia') ? 'base-sepolia' : 'base-mainnet',
      chainId: RPC_URL.includes('sepolia') ? 84532 : 8453,
      contracts: CONTRACTS,
      data: {
        wZION: {
          totalSupply: hexToDecimal18(totalSupplyHex),
          totalSupplyRaw: totalSupplyHex,
        },
        staking: {
          totalStaked: '0',
          apr: '—',
          cooldownDays: 7,
        },
        farm: {
          poolCount: 0,
          rewardPerSecond: '0',
        },
        governance: {
          proposalCount: 0,
        },
        bridge: {
          threshold: hexToNumber(thresholdHex),
          validatorCount: hexToNumber(validatorCountHex),
        },
      },
      fetchedAt: Date.now(),
    }, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to fetch DeFi data' },
      { status: 502, headers: HEADERS },
    );
  }
}
