import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Whitepapers',
  alternates: { canonical: '/whitepapers' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
