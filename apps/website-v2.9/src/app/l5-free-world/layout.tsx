import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'L5 · Free World',
  alternates: { canonical: '/l5-free-world' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
