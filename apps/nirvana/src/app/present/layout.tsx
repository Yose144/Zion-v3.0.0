import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PASS_COOKIE, verifyPassCode } from '@/lib/pass';

export const dynamic = 'force-dynamic';

// Server-side gate for all /present/* deep links — the portal entry
// (PassGate) is client-side; direct presentation URLs must not bypass it.
export default async function PresentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lokální render audit (scripts/ops/audit-project-scenes.py) potřebuje dosáhnout scén.
  // Zapnuté jen když to server explicitně dovolí env proměnnou — v produkci se nenastavuje.
  if (process.env.ZION_RENDER_AUDIT === '1') {
    const requestHeaders = await headers();
    if (requestHeaders.get('x-render-audit') === '1') {
      return <>{children}</>;
    }
  }

  const store = await cookies();
  const code = store.get(PASS_COOKIE)?.value;
  if (!code) redirect('/');

  const verdict = await verifyPassCode(code);
  // Only a definitive "invalid" (revoked/expired) sends the user back to the
  // gate. A transient oracle failure must not look like a lost pass — the
  // cookie stays valid and the next request re-checks. (Content still does
  // not render on an undecided verdict: fail-closed, same as before.)
  if (verdict !== 'valid') redirect('/');
  return <>{children}</>;
}
