export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:8766';
const TIMEOUT_MS = 8_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${DASHBOARD_URL}/api/alerts`, {
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
  } catch (error: any) {
    const message = error?.name === 'AbortError'
      ? 'Dashboard request timed out'
      : error?.message || 'Dashboard unreachable';

    return NextResponse.json(
      { error: message },
      { status: 502, headers: { ...CORS_HEADERS } },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS } });
}
