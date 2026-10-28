import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createHash } from 'crypto';
import { requireMarketAuth, createMarketApiKey, isAuthDenied } from '@/lib/zis';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' })
  : null;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://market.zionterranova.com';

// Stripe price ids for the Hiran API subscription tiers — create the
// products in the Stripe dashboard once, then set these in the env.
const PRICE_IDS: Record<'pro' | 'team', string | undefined> = {
  pro: process.env.HIRAN_PRICE_PRO_ID,
  team: process.env.HIRAN_PRICE_TEAM_ID,
};

// POST /api/stripe/hiran-subscribe { plan: 'free'|'pro'|'team' }
// Requires a ZIS session — mints a fresh `zis_*` API key for the caller,
// puts sha256(key) into the Stripe subscription metadata (gateway's
// /v1/stripe/webhook maps it to the plan tier), and returns the raw key
// once alongside the checkout URL. The raw key is never stored here.
export async function POST(request: NextRequest) {
  const rl = rateLimit(`hiran-subscribe:${clientIp(request)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Rate limited' },
      { status: 429 },
    );
  }

  const userOrResponse = await requireMarketAuth();
  if (isAuthDenied(userOrResponse)) return userOrResponse;

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

  // Mint a dedicated key for the API — one key per subscription keeps
  // per-key quotas clean and revocation scoped.
  let apiKey: string;
  try {
    const created = await createMarketApiKey(`hiran-api-${plan}`);
    apiKey = created.apiKey;
  } catch (err) {
    console.error('hiran-subscribe: ZIS key creation failed:', err);
    return NextResponse.json(
      { success: false, error: 'Could not create API key' },
      { status: 502 },
    );
  }
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Free tier: no Stripe — key works immediately at free limits.
  if (plan === 'free') {
    return NextResponse.json({
      success: true,
      data: { plan, apiKey },
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
      data: { plan, apiKey, url: session.url },
    });
  } catch (err) {
    console.error('hiran-subscribe: Stripe session failed:', err);
    return NextResponse.json(
      { success: false, error: 'Stripe checkout failed' },
      { status: 500 },
    );
  }
}
