export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { coreUrl } from '@/lib/core-endpoints';

const HIRANYAGARBHA_URL = coreUrl('hiranyagarbha', process.env.HIRANYAGARBHA_URL);
const TIMEOUT_MS = 10_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${HIRANYAGARBHA_URL}/ncl/leaderboard`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeout);

    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store', ...CORS_HEADERS },
    });
  } catch {
    return NextResponse.json(
      { leaderboard: [], source: 'fallback', note: 'Hiranyagarbha unreachable' },
      { status: 503, headers: { 'Cache-Control': 'no-store', ...CORS_HEADERS } },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS } });
}
