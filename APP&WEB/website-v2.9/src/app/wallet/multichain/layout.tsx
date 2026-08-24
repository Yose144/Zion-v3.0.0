import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Multichain Wallet · ZION ${SITE_RELEASE_LABEL}`,
  description: 'ZION multichain wallet — deposits, withdrawals, balances and DEX orders across chains.',
};

export default function MultichainWalletLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
