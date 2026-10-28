import type { Metadata } from 'next';
import ArchiveLock from '@/components/books/ArchiveLock';
import { SITE_APP_URL } from '@/lib/site';

// Zion Archive — Nirvana Hub is temporarily locked (coming-soon access gate:
// paid Archive Pass on the marketplace + OASIS bonuses + B2B in discussion).
// To reopen the full library flip this to false — all hub panels, readers and
// deep links stay intact under this route tree.
const ARCHIVE_LOCKED = true;

export const metadata: Metadata = {
  title: 'Zion Archive — Nirvana Hub',
  description:
    'Zion Archive — knihovna ZION Terra Nova: Genesis, Kvantová revoluce, Ekam, Terra Nova, Maitreya, Nirvana a doprovodné knihy. Přístup přes Archive Pass — v přípravě. The library of the path — paid archive access coming soon.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive` },
};

export default function ZionArchiveLayout({ children }: { children: React.ReactNode }) {
  if (ARCHIVE_LOCKED) return <ArchiveLock />;
  return children;
}
