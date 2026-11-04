import { NextResponse, type NextRequest } from 'next/server';
import { hasArchiveAccess } from '@/lib/archive-access';

// Gated downloads for Zion Archive.
//
// The files live on the marketplace host (a 65 MB ZIP has no business in the
// website deploy or in git). This route is the only advertised path: it checks
// the Archive Pass first, then redirects to the packaged edition. Revoking a
// pass therefore revokes the archive link — the marketplace URL itself stays a
// public product URL and is not treated as a secret.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MARKET_DOWNLOADS =
  process.env.ARCHIVE_DOWNLOAD_BASE ?? 'https://market.zionterranova.com/shop/downloads';

const SOURCES: Record<string, string> = {
  'kralovstvi-srdce-bundle': 'Kralovstvi_srdce_kompletni_edice_5_jazyku.zip',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const file = SOURCES[slug];
  if (!file) {
    return new NextResponse('Unknown download', { status: 404 });
  }

  if (!(await hasArchiveAccess())) {
    return new NextResponse('Archive Pass required', { status: 403 });
  }

  return NextResponse.redirect(`${MARKET_DOWNLOADS}/${file}`, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store',
      'X-Archive-Download': slug,
    },
  });
}
