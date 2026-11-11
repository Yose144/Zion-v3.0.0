import { NextResponse } from 'next/server';
import { getProductViews } from '@/lib/catalog-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getProductViews();
    return NextResponse.json(
      { success: true, data: products },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Products API failed:', error);
    return NextResponse.json({ success: false, error: 'Katalog se nepodařilo načíst.' }, { status: 500 });
  }
}
