import { NextRequest, NextResponse } from 'next/server';
import { requireHiranCaller } from '@/lib/hiran-auth';
import { getCryptoIntent, markCryptoConfirmed } from '@/lib/hiran-cli-store';
import { gatewaySetPlan, verifyUsdcTransfer } from '@/lib/hiran-crypto';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** POST /api/hiran/crypto/confirm { intentId, txHash } */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`hiran-crypto-confirm:${clientIp(request)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Rate limited' }, { status: 429 });
  }

  const caller = await requireHiranCaller(request);
  if (caller instanceof NextResponse) return caller;

  let intentId: string;
  let txHash: string;
  try {
    const body = (await request.json()) as { intentId?: string; txHash?: string };
    intentId = (body.intentId ?? '').trim();
    txHash = (body.txHash ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!intentId || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json(
      { success: false, error: 'intentId and valid txHash required' },
      { status: 400 },
    );
  }

  const intent = await getCryptoIntent(intentId);
  if (!intent) {
    return NextResponse.json({ success: false, error: 'Unknown intent' }, { status: 404 });
  }
  if (intent.status === 'confirmed') {
    return NextResponse.json({
      success: true,
      data: { status: 'confirmed', plan: intent.plan, txHash: intent.txHash },
    });
  }
  if (intent.status !== 'pending') {
    return NextResponse.json(
      { success: false, error: `Intent is ${intent.status}` },
      { status: 409 },
    );
  }

  // If caller used API key, ensure it matches the intent key_hash.
  if (caller.keyHash && caller.keyHash !== intent.keyHash) {
    return NextResponse.json(
      { success: false, error: 'API key does not match payment intent' },
      { status: 403 },
    );
  }

  const verified = await verifyUsdcTransfer({
    txHash: txHash as `0x${string}`,
    token: intent.tokenAddress,
    to: intent.toAddress,
    amount: intent.amount,
  });
  if (!verified.ok) {
    return NextResponse.json(
      { success: false, error: verified.error },
      { status: 400 },
    );
  }

  const gw = await gatewaySetPlan(intent.keyHash, intent.plan);
  if (!gw.ok) {
    return NextResponse.json(
      { success: false, error: gw.error ?? 'Gateway plan update failed' },
      { status: 502 },
    );
  }

  await markCryptoConfirmed(intentId, txHash);
  return NextResponse.json({
    success: true,
    data: { status: 'confirmed', plan: intent.plan, txHash },
  });
}
