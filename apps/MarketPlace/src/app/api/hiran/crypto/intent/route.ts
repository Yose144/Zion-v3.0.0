import { NextRequest, NextResponse } from 'next/server';
import { requireHiranCaller } from '@/lib/hiran-auth';
import { createCryptoIntent } from '@/lib/hiran-cli-store';
import { resolveKeyHash, usdcConfig } from '@/lib/hiran-crypto';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** POST /api/hiran/crypto/intent { plan: 'pro'|'team' } */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`hiran-crypto-intent:${clientIp(request)}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Rate limited' }, { status: 429 });
  }

  const caller = await requireHiranCaller(request);
  if (caller instanceof NextResponse) return caller;

  let plan: 'pro' | 'team';
  try {
    const body = (await request.json()) as { plan?: string };
    if (body.plan !== 'pro' && body.plan !== 'team') {
      return NextResponse.json(
        { success: false, error: 'plan must be pro or team' },
        { status: 400 },
      );
    }
    plan = body.plan;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  let cfg;
  try {
    cfg = usdcConfig(plan);
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : 'Crypto billing not configured',
      },
      { status: 500 },
    );
  }

  try {
    const { keyHash, apiKey } = await resolveKeyHash(caller);
    const intent = await createCryptoIntent({
      plan,
      keyHash,
      amount: cfg.amount,
      toAddress: cfg.treasury,
      tokenAddress: cfg.token,
      chainId: cfg.chainId,
    });

    return NextResponse.json({
      success: true,
      data: {
        intentId: intent.id,
        reference: intent.reference,
        plan: intent.plan,
        amount: intent.amount,
        token: intent.tokenAddress,
        to: intent.toAddress,
        chainId: intent.chainId,
        key_hash: intent.keyHash,
        expires_at: intent.expiresAt,
        ...(apiKey ? { apiKey } : {}),
      },
    });
  } catch (err) {
    console.error('hiran-crypto-intent:', err);
    return NextResponse.json(
      { success: false, error: 'Could not create payment intent' },
      { status: 502 },
    );
  }
}
