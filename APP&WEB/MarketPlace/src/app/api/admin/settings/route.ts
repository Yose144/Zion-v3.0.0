import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function isValidTheme(value: unknown): value is 'rasta' | 'zion' {
  return value === 'rasta' || value === 'zion';
}

export async function GET() {
  try {
    const all = await prisma.shopSetting.findMany({ orderBy: { key: 'asc' } });
    const theme = all.find((s) => s.key === 'shop_theme')?.value ?? 'rasta';
    return NextResponse.json({ success: true, data: { theme, settings: all } });
  } catch (error) {
    console.error('Failed to load settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { theme?: unknown };
    if (!isValidTheme(body.theme)) {
      return NextResponse.json({ success: false, error: 'Invalid theme' }, { status: 400 });
    }

    await prisma.shopSetting.upsert({
      where: { key: 'shop_theme' },
      create: { key: 'shop_theme', value: body.theme },
      update: { value: body.theme },
    });

    return NextResponse.json({ success: true, data: { theme: body.theme } });
  } catch (error) {
    console.error('Failed to save theme:', error);
    return NextResponse.json({ success: false, error: 'Failed to save theme' }, { status: 500 });
  }
}
