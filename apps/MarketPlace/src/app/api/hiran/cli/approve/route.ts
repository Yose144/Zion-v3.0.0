import { NextRequest, NextResponse } from 'next/server';
import { approveDevice, getDeviceByUserCode } from '@/lib/hiran-cli-store';
import { createMarketApiKey, isAuthDenied, requireMarketAuth } from '@/lib/zis';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** POST /api/hiran/cli/approve { user_code } — ZIS session required. */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`hiran-cli-approve:${clientIp(request)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Rate limited' }, { status: 429 });
  }

  const userOr = await requireMarketAuth();
  if (isAuthDenied(userOr)) return userOr;

  let userCode: string;
  try {
    const body = (await request.json()) as { user_code?: string; userCode?: string };
    userCode = (body.user_code ?? body.userCode ?? '').trim().toUpperCase();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (!userCode) {
    return NextResponse.json({ success: false, error: 'user_code required' }, { status: 400 });
  }

  const existing = await getDeviceByUserCode(userCode);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Unknown user code' }, { status: 404 });
  }
  if (existing.status === 'expired' || existing.expiresAt < Date.now()) {
    return NextResponse.json({ success: false, error: 'Code expired' }, { status: 410 });
  }
  if (existing.status === 'redeemed') {
    return NextResponse.json({ success: false, error: 'Code already used' }, { status: 409 });
  }
  if (existing.status === 'approved') {
    return NextResponse.json({
      success: true,
      data: {
        status: 'approved',
        user_code: existing.userCode,
        message: 'Already approved — return to the terminal',
      },
    });
  }

  try {
    const created = await createMarketApiKey('hiran-cli');
    const rec = await approveDevice(userCode, created.apiKey, userOr.id);
    return NextResponse.json({
      success: true,
      data: {
        status: rec.status,
        user_code: rec.userCode,
        message: 'CLI device approved — return to the terminal',
      },
    });
  } catch (err) {
    console.error('hiran-cli-approve:', err);
    return NextResponse.json(
      { success: false, error: 'Could not approve device' },
      { status: 502 },
    );
  }
}
