import { NextRequest, NextResponse } from 'next/server';
import { uploadArtifactMetadata, uploadFile } from '@/lib/ipfs';

// POST /api/ipfs/upload — upload artifact metadata to IPFS
export async function POST(req: NextRequest) {
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
