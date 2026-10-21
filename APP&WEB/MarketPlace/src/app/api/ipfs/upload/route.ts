import { NextRequest, NextResponse } from 'next/server';
import { uploadArtifactMetadata, uploadFile } from '@/lib/ipfs';
import { requireMarketAuth, isAuthDenied } from '@/lib/zis';
import { requireAdminAuth } from '@/lib/admin-guard';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// POST /api/ipfs/upload — upload artifact metadata to IPFS.
// Requires ZIS session (or admin key) + rate limited — open uploads would
// let anyone pin arbitrary content through our gateway credentials.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const rl = rateLimit(`ipfs:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }
  const auth = await requireMarketAuth();
  if (isAuthDenied(auth) && requireAdminAuth(req) !== null) return auth;

  try {
    const contentType = req.headers.get('content-type') ?? '';

    // JSON metadata upload
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { name, description, image, attributes, properties } = body;

      if (!name || !description) {
        return NextResponse.json(
          { success: false, error: 'name and description are required' },
          { status: 400 }
        );
      }

      const result = await uploadArtifactMetadata({
        name,
        description,
        image: image ?? '',
        attributes: attributes ?? [],
        properties,
      });

      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }

    // File upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'no file provided' },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'file too large (max 10 MB)' },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadFile(buffer, file.name || 'upload');
      return NextResponse.json({ success: true, ...result }, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: 'unsupported content type' },
      { status: 415 }
    );
  } catch (error) {
    console.error('IPFS upload failed:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
