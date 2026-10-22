import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'L4 · OASIS',
  alternates: { canonical: '/l4-oasis' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
