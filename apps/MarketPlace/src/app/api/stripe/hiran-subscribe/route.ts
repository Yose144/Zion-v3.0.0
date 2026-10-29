import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createHash } from 'crypto';
import { createMarketApiKey, isAuthDenied, requireMarketAuth } from '@/lib/zis';
import { extractApiKey, requireHiranCaller } from '@/lib/hiran-auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' })
  : null;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://market.zionterranova.com';

const PRICE_IDS: Record<'pro' | 'team', string | undefined> = {
  pro: process.env.HIRAN_PRICE_PRO_ID,
  team: process.env.HIRAN_PRICE_TEAM_ID,
};

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * POST /api/stripe/hiran-subscribe { plan: 'free'|'pro'|'team' }
 *
 * Auth: ZIS session cookie OR X-API-Key (CLI upgrade of existing key —
 * no second key minted).
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`hiran-subscribe:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Rate limited' },
      { status: 429 },
    );
  }

  let plan: 'free' | 'pro' | 'team';
  try {
    const body = (await request.json()) as { plan?: string };
    if (body.plan !== 'free' && body.plan !== 'pro' && body.plan !== 'team') {
      return NextResponse.json(
        { success: false, error: 'Invalid plan' },
        { status: 400 },
      );
    }
    plan = body.plan;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Prefer explicit API key (CLI) so we upgrade that hash; else session mint.
  const headerKey = extractApiKey(request);
  let apiKey: string;
  let keyHash: string;
  let returnKey = true;

  if (headerKey) {
    const caller = await requireHiranCaller(request);
    if (caller instanceof NextResponse) return caller;
    if (!caller.apiKey || !caller.keyHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 },
      );
    }
    apiKey = caller.apiKey;
    keyHash = caller.keyHash;
    returnKey = false; // CLI already has the key
  } else {
    const userOrResponse = await requireMarketAuth();
    if (isAuthDenied(userOrResponse)) return userOrResponse;
    try {
      const created = await createMarketApiKey(`hiran-api-${plan}`);
      apiKey = created.apiKey;
      keyHash = hashKey(apiKey);
    } catch (err) {
      console.error('hiran-subscribe: ZIS key creation failed:', err);
      return NextResponse.json(
        { success: false, error: 'Could not create API key' },
        { status: 502 },
      );
    }
  }

  if (plan === 'free') {
    return NextResponse.json({
      success: true,
      data: returnKey ? { plan, apiKey } : { plan, upgraded: true },
    });
  }

  const priceId = PRICE_IDS[plan];
  if (!stripe || !priceId) {
    return NextResponse.json(
      { success: false, error: 'Billing is not configured for this plan yet' },
      { status: 500 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { key_hash: keyHash, plan },
      },
      metadata: { key_hash: keyHash, plan },
      success_url: `${SITE_URL}/ai?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/ai?cancelled=1`,
      locale: 'cs',
    });

    return NextResponse.json({
      success: true,
      data: returnKey
        ? { plan, apiKey, url: session.url }
        : { plan, url: session.url, upgraded: true },
    });
  } catch (err) {
    console.error('hiran-subscribe: Stripe session failed:', err);
    return NextResponse.json(
      { success: false, error: 'Stripe checkout failed' },
      { status: 500 },
    );
  }
}
