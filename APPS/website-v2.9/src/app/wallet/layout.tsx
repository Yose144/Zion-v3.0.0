import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `L1 Wallet · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION L1 non-custodial wallet. Create, import, send, and manage ZION natively.',
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
