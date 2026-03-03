import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation · ZION v2.9.7',
  description: 'ZION blockchain documentation — getting started, architecture, mining guides, tutorials, whitepaper, and advanced topics.',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
