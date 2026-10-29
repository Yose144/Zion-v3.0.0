import { NextRequest, NextResponse } from 'next/server';
import { redeemDevice } from '@/lib/hiran-cli-store';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** GET /api/hiran/cli/poll?device_code=… */
export async function GET(request: NextRequest) {
  const rl = rateLimit(`hiran-cli-poll:${clientIp(request)}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Rate limited' }, { status: 429 });
  }

  const deviceCode = request.nextUrl.searchParams.get('device_code')?.trim();
  if (!deviceCode) {
    return NextResponse.json(
      { success: false, error: 'device_code required' },
      { status: 400 },
    );
  }

  const result = await redeemDevice(deviceCode);
  if (result.status === 'pending') {
    return NextResponse.json({
      success: true,
      data: { status: 'pending', expires_at: result.expiresAt },
    });
  }
  if (result.status === 'expired') {
    return NextResponse.json({
      success: true,
      data: { status: 'expired' },
    });
  }
  if (result.status === 'redeemed') {
    return NextResponse.json({
      success: true,
      data: { status: 'redeemed' },
    });
  }
  // approved — apiKey present once
  return NextResponse.json({
    success: true,
    data: {
      status: 'approved',
      apiKey: result.apiKey,
    },
  });
}
