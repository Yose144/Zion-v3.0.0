import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'L6 · Issobella',
  alternates: { canonical: '/l6-issobella' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
