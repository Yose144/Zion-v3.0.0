import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Status — pool health and uptime',
  description: 'Public API health, pool uptime, last-block and last-payout age, per-coin status and average effort — a live status page for ZION Pool.',
  alternates: { canonical: '/status' },
  openGraph: { url: 'https://pool.zionterranova.com/status' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
