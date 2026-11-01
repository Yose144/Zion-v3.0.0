import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'L4 · OASIS — Avatars',
  description:
    'Complete ZION OASIS avatar roster — 200 sacred characters with quest lines, teachings, rays, rarities and consciousness-level requirements, grouped by roster circles.',
  alternates: { canonical: '/l4-oasis/avatars' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
