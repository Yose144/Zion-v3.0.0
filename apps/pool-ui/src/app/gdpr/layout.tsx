import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy policy — GDPR',
  description: 'How ZION Pool processes personal data under GDPR.',
  alternates: { canonical: '/gdpr' },
  openGraph: { url: 'https://pool.zionterranova.com/gdpr' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
