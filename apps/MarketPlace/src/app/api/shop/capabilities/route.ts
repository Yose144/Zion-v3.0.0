import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Soft-launch capabilities — no secrets leaked, only booleans.
 * Cart UI uses this to disable card when Stripe is unset and to show
 * the digi/bank-transfer soft-launch banner.
 */
export async function GET() {
  const stripe = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const email =
    Boolean(process.env.RESEND_API_KEY?.trim()) ||
    Boolean(process.env.SMTP_PASSWORD?.trim()) ||
    ['127.0.0.1', 'localhost'].includes(
      (process.env.SMTP_HOST ?? '').trim().toLowerCase(),
    );
  const hiranBilling = Boolean(
    process.env.HIRAN_PRICE_PRO_ID?.trim() &&
      process.env.HIRAN_PRICE_TEAM_ID?.trim() &&
      stripe,
  );

  return NextResponse.json({
    softLaunch: !(stripe && email),
    stripe,
    email,
    hiranBilling,
    modes: {
      transfer: true,
      card: stripe,
      crypto: false,
    },
  });
}
