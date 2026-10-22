import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Onboard',
  alternates: { canonical: '/onboard' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
