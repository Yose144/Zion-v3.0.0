import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'L3 · Hiran',
  alternates: { canonical: '/l3-hiran' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
