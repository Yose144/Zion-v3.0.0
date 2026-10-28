import type { Metadata } from 'next';
import ArchiveLock from '@/components/books/ArchiveLock';
import { hasArchiveAccess } from '@/lib/archive-access';
import { SITE_APP_URL } from '@/lib/site';

// Zion Archive — Nirvana Hub is behind the Archive Pass gate (coming-soon +
// B2B access codes). A valid `zion_archive_pass` cookie unlocks the whole
// tree; to reopen publicly flip ARCHIVE_LOCKED to false.
const ARCHIVE_LOCKED = true;

export const metadata: Metadata = {
  title: 'Zion Archive — Nirvana Hub',
  description:
    'Zion Archive — knihovna ZION Terra Nova: Genesis, Kvantová revoluce, Ekam, Terra Nova, Maitreya, Nirvana a doprovodné knihy. Přístup přes Archive Pass — v přípravě. The library of the path — paid archive access coming soon.',
  alternates: { canonical: `${SITE_APP_URL}/zion-archive` },
};

export default async function ZionArchiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!ARCHIVE_LOCKED || (await hasArchiveAccess())) return children;
  return <ArchiveLock />;
}
