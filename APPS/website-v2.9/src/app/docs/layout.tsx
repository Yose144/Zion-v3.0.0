import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation · ZION v2.9.9',
  description: 'ZION documentation focused on /docs#live-index: current mainnet launch countdown snapshot, version matrix 2.9.6 / 2.9.8 / 2.9.9, protocol baseline, mining setup, and archived history.',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
