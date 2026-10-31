import { cookies } from 'next/headers';
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
  const store = await cookies();
  const code = store.get(PASS_COOKIE)?.value;
  if (!code || !(await verifyPassCode(code))) {
    redirect('/');
  }
  return <>{children}</>;
}
