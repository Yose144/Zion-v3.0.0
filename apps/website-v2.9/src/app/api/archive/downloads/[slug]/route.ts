import { NextResponse, type NextRequest } from 'next/server';
import { hasArchiveAccess } from '@/lib/archive-access';
import { recordAccess, recordDownload } from '@/lib/archive-metrics';
import { signArchiveMarketDownloadUrl } from '@/lib/market-download-sign';

// Gated downloads for Zion Archive.
//
// The files live on the marketplace host (a 65 MB ZIP has no business in the
// website deploy or in git). This route is the only advertised archive path:
// it checks the Archive Pass first, then redirects to a short-lived signed
// marketplace URL. The raw /shop/downloads/ path is no longer a public product
// URL — set DOWNLOAD_SIGNING_SECRET to the same value as on MarketPlace.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    recordAccess(false);
    return new NextResponse('Archive Pass required', { status: 403 });
  }
  recordAccess(true);
  recordDownload(slug);

  let target: string;
  try {
    target = signArchiveMarketDownloadUrl(file, 900);
  } catch (err) {
    console.error('Archive download signing failed:', err);
    return new NextResponse('Download signing is not configured', { status: 503 });
  }

  return NextResponse.redirect(target, {
    status: 307,
    headers: {
      'Cache-Control': 'no-store',
      'X-Archive-Download': slug,
    },
  });
}
