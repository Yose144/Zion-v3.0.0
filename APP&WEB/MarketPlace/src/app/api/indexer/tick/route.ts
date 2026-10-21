import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runIndexerTick } from '@/lib/indexer';
import { requireAdminAuth } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  // Bearer INDEXER_SECRET (cron/daemon) or admin x-api-key
  const secret = process.env.INDEXER_SECRET;
  const bearer = req.headers.get('authorization');
  if (secret && bearer === `Bearer ${secret}`) return true;
  return requireAdminAuth(req) === null;
}

/** POST /api/indexer/tick — run one indexer pass over recent marketplace logs. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const maxRange = new URL(req.url).searchParams.get('maxRange');
    const result = await runIndexerTick(prisma, {
      maxRange: maxRange ? BigInt(maxRange) : undefined,
    });
    return NextResponse.json({
      success: true,
      data: { ...result, fromBlock: result.fromBlock.toString(), toBlock: result.toBlock.toString(), tip: result.tip.toString() },
    });
  } catch (error) {
    console.error('Indexer tick failed:', error);
    return NextResponse.json({ success: false, error: 'Indexer tick failed' }, { status: 500 });
  }
}

/** GET /api/indexer/tick — indexer cursor status. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const row = await prisma.shopSetting.findUnique({ where: { key: 'l2_indexer_block' } });
  return NextResponse.json({ success: true, data: { lastBlock: row?.value ?? null } });
}
