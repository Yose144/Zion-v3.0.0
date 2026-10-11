import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wiki',
  alternates: { canonical: '/wiki' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
