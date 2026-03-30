export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

const RPC_URL = process.env.BASE_RPC_URL || 'https://sepolia.base.org';

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
  ZIONBridge:     '0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
  ZIONAtomicSwap: '0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc',
  ZIONStaking:    '0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913',
  ZIONFarm:       '0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843',
  ZIONGovernance: '0x039F730e3e1c3f36da95187697118791762290a1',
  ZIONTreasury:   '0x178d85323dC94Ce2477269Dfb93a12D04B9bE537',
  UniV3Pool:      '0xcCEaD51568E8d701f7db7e6699F3986031F07C7B',
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
      totalStakedHex,
      poolLengthHex,
      rewardPerSecHex,
      proposalCountHex,
      thresholdHex,
      validatorCountHex,
    ] = await Promise.all([
      ethCall(CONTRACTS.wZION, CALLS.totalSupply),
      ethCall(CONTRACTS.ZIONStaking, CALLS.totalStaked),
      ethCall(CONTRACTS.ZIONFarm, CALLS.poolLength),
      ethCall(CONTRACTS.ZIONFarm, CALLS.rewardPerSec),
      ethCall(CONTRACTS.ZIONGovernance, CALLS.proposalCount),
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
          totalStaked: hexToDecimal18(totalStakedHex),
          totalStakedRaw: totalStakedHex,
          apr: '12%',
          cooldownDays: 7,
        },
        farm: {
          poolCount: hexToNumber(poolLengthHex),
          rewardPerSecond: hexToDecimal18(rewardPerSecHex),
        },
        governance: {
          proposalCount: hexToNumber(proposalCountHex),
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
