export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const DEFAULT_REVENUE_CONFIG_CANDIDATES = [
  process.env.ZION_REVENUE_CONFIG_PATH,
  path.resolve(process.cwd(), 'data/ch3-settings.json'),
  path.resolve(process.cwd(), '../../../config/ch3_zion_only_settings.json'),
  path.resolve(process.cwd(), '../../../config/ch3_revenue_settings.json'),
  path.resolve(process.cwd(), '../../config/ch3_zion_only_settings.json'),
  path.resolve(process.cwd(), '../../config/ch3_revenue_settings.json'),
].filter((candidate): candidate is string => Boolean(candidate));

async function resolveRevenueConfigPath(): Promise<string> {
  for (const candidate of DEFAULT_REVENUE_CONFIG_CANDIDATES) {
    try {
      await readFile(candidate, 'utf8');
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('No revenue config file found');
}

async function readRevenueConfig(): Promise<{ path: string; data: Record<string, JsonValue> }> {
  const filePath = await resolveRevenueConfigPath();
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, JsonValue>;
  return { path: filePath, data: parsed };
}

export async function GET() {
  try {
    const { data } = await readRevenueConfig();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load revenue config' },
      { status: 503 },
    );
  }
}