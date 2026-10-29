import { NextResponse } from 'next/server';
import { createDevice } from '@/lib/hiran-cli-store';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://market.zionterranova.com';

/** POST /api/hiran/cli/start — begin device-code login for `zion hiran login`. */
export async function POST(request: Request) {
  const rl = rateLimit(`hiran-cli-start:${clientIp(request)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Rate limited' }, { status: 429 });
  }

  const rec = await createDevice();
  const expiresIn = Math.max(0, Math.floor((rec.expiresAt - Date.now()) / 1000));
  const verifyUrl = `${SITE_URL}/ai/cli?code=${encodeURIComponent(rec.userCode)}`;

  return NextResponse.json({
    success: true,
    data: {
      device_code: rec.deviceCode,
      user_code: rec.userCode,
      verify_url: verifyUrl,
      expires_in: expiresIn,
      interval: 2,
    },
  });
}
