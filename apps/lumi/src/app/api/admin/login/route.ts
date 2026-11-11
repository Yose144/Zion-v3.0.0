import { NextRequest, NextResponse } from 'next/server';
import { adminConfigured, setSessionCookie, verifyCredentials } from '@/lib/admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ success: false, error: 'Admin není nakonfigurován.' }, { status: 503 });
  }
  const rl = rateLimit(`admin-login:${clientIp(request)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Příliš mnoho pokusů.', retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  if (!verifyCredentials(String(body.username ?? ''), String(body.password ?? ''))) {
    return NextResponse.json({ success: false, error: 'Nesprávné jméno nebo heslo.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  return setSessionCookie(response);
}
