import { NextRequest, NextResponse } from 'next/server';
import { PASS_COOKIE } from '@/lib/pass';

/**
 * JEDNA BRÁNA PRO CELOU NIRVANU.
 *
 * Dřív byl ZAP pas jen na `/` (klientský `PassGate`) a na `/present/*`.
 * Všechno ostatní — `/mars`, `/venus`, `/mercury`, `/earth`, `/park`,
 * `/saturn`, `/avatars`, `/hiran`, `/multiplayer` — bylo volně dostupné
 * a stačilo se do hry přepnout z menu. To je chyba: pas má odemykat
 * **celou** Nirvanu.
 *
 * Proxy kontroluje jen **přítomnost cookie** (nesmí na
 * každý request volat orákulum). Že je kód opravdu platný, ověřuje
 * `/api/pass` při mountu (klientský `PassGate`) a serverová brána
 * v `/present/*`. Zfalšovaná cookie tedy UI neodemkne.
 *
 * `next` v redirectu drží původní cestu (i `?room=`), aby se po odemčení
 * člověk vrátil tam, kam šel.
 */

/** Co musí zůstat dostupné i bez pasu (jinak se nedá ani zadat kód). */
const PUBLIC_PREFIXES = [
  '/api/pass',
  // Health pro monitoring: bez pasu, jinak se stav aplikace nedá změřit zvenčí.
  // (Vrací jen stav klienta + realtime služby, žádná herní data ani identity.)
  '/api/health',
  '/_next',
  '/favicon',
  '/icons',
  '/textures',
  '/portraits',
  // 3D modely (lucerna pro Lumi) — statický asset, ne herní obsah
  '/models',
  '/audio',
  '/robots.txt',
  '/manifest',
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // `/` JE brána — bez téhle výjimky by redirect skončil sám na sobě.
  if (pathname === '/') return NextResponse.next();
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  // Lokální render audit (scripts/ops/…) — jen když to server dovolí envem.
  // V produkci se `ZION_RENDER_AUDIT` nenastavuje.
  if (process.env.ZION_RENDER_AUDIT === '1' && request.headers.get('x-render-audit') === '1') {
    return NextResponse.next();
  }

  if (request.cookies.get(PASS_COOKIE)?.value) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/';
  // Kam se má člověk vrátit po odemčení (jen interní cesta).
  const next = `${pathname}${search}`;
  if (next !== '/' && next.length < 200) url.searchParams.set('next', next);
  else url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Statické assety Nextu a obrázky neřešíme — jen dokumenty.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
