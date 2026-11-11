import { NextResponse } from 'next/server';
import { COD_FEE_CZK, FREE_SHIPPING_FROM } from '@/types/shop';
import { mailConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        transfer: true,
        card: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
        cod: COD_FEE_CZK > 0,
        codFeeCzk: COD_FEE_CZK,
        freeShippingFrom: FREE_SHIPPING_FROM,
        emails: mailConfigured(),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
