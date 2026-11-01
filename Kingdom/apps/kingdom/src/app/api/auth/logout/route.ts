import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, logout } from '@zion/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Odhlášení: zruší session v ZIS a smaže cookie (se stejnou doménou). */
export async function POST(request: Request) {
  const host = request.headers.get('host') ?? '';
  const domain = host.endsWith('zionterranova.com') ? '.zionterranova.com' : undefined;

  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;

  if (value) {
    try {
      await logout(value);
    } catch {
      /* ZIS nedostupný — cookie smažeme i tak, ať se člověk odhlásí lokálně. */
    }
  }

  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(domain),
    path: '/',
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });

  return NextResponse.json({ ok: true });
}
