import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, getChallenge, verifyEd25519 } from '@zion/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * Cookie doména: v produkci `.zionterranova.com`, aby session platila napříč
 * subdoménami (jedno přihlášení pro celý ekosystém). Lokálně host-only.
 */
function cookieDomain(host: string): string | undefined {
  return host.endsWith('zionterranova.com') ? '.zionterranova.com' : undefined;
}

type Body =
  | { step: 'challenge'; address: string }
  | { step: 'verify'; address: string; publicKey: string; signature: string };

/**
 * Přihlášení přes ZIS ve dvou krocích.
 *
 * Klíč zůstává v prohlížeči — sem dorazí jen adresa, veřejný klíč a podpis.
 * Server ZIS jen ověří a nastaví cookie.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  if (body?.step === 'challenge') {
    if (!body.address) {
      return NextResponse.json({ error: 'MISSING_ADDRESS' }, { status: 400 });
    }
    try {
      const challenge = await getChallenge(body.address, 'zion-l1');
      return NextResponse.json(challenge);
    } catch {
      return NextResponse.json({ error: 'ZIS_UNAVAILABLE' }, { status: 502 });
    }
  }

  if (body?.step === 'verify') {
    if (!body.address || !body.publicKey || !body.signature) {
      return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
    }

    try {
      const session = await verifyEd25519({
        address: body.address,
        publicKey: body.publicKey,
        signature: body.signature,
      });

      const host = request.headers.get('host') ?? '';
      const domain = cookieDomain(host);
      const store = await cookies();

      store.set(SESSION_COOKIE, session.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: Boolean(domain),
        path: '/',
        maxAge: SESSION_MAX_AGE,
        ...(domain ? { domain } : {}),
      });

      return NextResponse.json({ ok: true, user: session.user });
    } catch {
      return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
    }
  }

  return NextResponse.json({ error: 'BAD_STEP' }, { status: 400 });
}
