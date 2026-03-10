import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation · ZION v2.9.8',
  description: 'ZION documentation focused on live testnet operations, protocol baseline, mining setup, and archived history.',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
