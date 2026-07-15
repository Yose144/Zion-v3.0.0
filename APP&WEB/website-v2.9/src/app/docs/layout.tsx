import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation · ZION v3.0.6',
  description: 'ZION documentation focused on /docs#live-index: current v3.0.6 mainnet snapshot, release/runtime map, mining setup, protocol baseline, and archived history.',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
