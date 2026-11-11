import { NextRequest, NextResponse } from 'next/server';
import { getProductViews, reseed } from '@/lib/catalog-server';

export const dynamic = 'force-dynamic';

/**
 * Naplní prodejní řádky z katalogu. Chrání `LUMI_SEED_TOKEN` (Bearer).
 * Běží při prvním deployi a po přidání produktu do `src/data/catalog.ts`.
 */
export async function POST(request: NextRequest) {
  const token = process.env.LUMI_SEED_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Seed není nakonfigurován.' }, { status: 503 });
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ success: false, error: 'Neautorizováno.' }, { status: 401 });
  }
  try {
    // Explicitní seed vždy doplní chybějící řádky (např. po přidání
    // nových motivů do katalogu). Existující ceny a sklad nemění.
    await reseed();
    const products = await getProductViews();
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error('Seed failed:', error);
    return NextResponse.json({ success: false, error: 'Seed selhal.' }, { status: 500 });
  }
}
