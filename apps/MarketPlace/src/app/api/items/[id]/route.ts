import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/items/[id] — single artifact detail
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const artifact = await prisma.artifact.findUnique({
      where: { id: params.id },
      include: {
        listings: {
          where: { status: 'active' },
          orderBy: { price: 'asc' },
        },
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { success: false, error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: artifact });
  } catch (error) {
    console.error('Failed to fetch artifact:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artifact' },
      { status: 500 }
    );
  }
}
