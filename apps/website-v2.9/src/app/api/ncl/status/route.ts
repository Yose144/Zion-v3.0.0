export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const NCL_CONFIG_CANDIDATES = [
  process.env.ZION_NCL_CONFIG_PATH,
  path.resolve(process.cwd(), 'data/ncl-status.json'),
  path.resolve(process.cwd(), '../../data/ncl-status.json'),
  path.resolve(process.cwd(), '../../../data/ncl-status.json'),
].filter((candidate): candidate is string => Boolean(candidate));

async function resolveNclConfigPath(): Promise<string> {
  for (const candidate of NCL_CONFIG_CANDIDATES) {
    try {
      await readFile(candidate, 'utf8');
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('No NCL config file found');
}

async function readNclConfig(): Promise<{ path: string; data: Record<string, JsonValue> }> {
  const filePath = await resolveNclConfigPath();
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, JsonValue>;
  return { path: filePath, data: parsed };
}

import { coreUrl } from '@/lib/core-endpoints';

const HIRANYAGARBHA_URL = coreUrl('hiranyagarbha', process.env.HIRANYAGARBHA_URL);

async function fetchFromBackend(): Promise<Record<string, JsonValue> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`${HIRANYAGARBHA_URL}/ncl/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json() as Record<string, JsonValue>;
  } catch {
    return null;
  }
}

/** Backend status JSON is proxied verbatim — scrub internal endpoints (IA-17). */
function scrubInternalEndpoints(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return value
      .replace(/https?:\/\/(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?/g, 'internal')
      .replace(/\b(127\.0\.0\.1|::1)(:\d+)?\b/g, 'internal');
  }
  if (Array.isArray(value)) return value.map(scrubInternalEndpoints);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, scrubInternalEndpoints(v)]),
    );
  }
  return value;
}

export async function GET() {
  try {
    // Try live Hiranyagarbha backend first
    const liveData = await fetchFromBackend();
    if (liveData) {
      return NextResponse.json(scrubInternalEndpoints(liveData), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // Fallback to local JSON file
    const { data } = await readNclConfig();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load NCL status' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  // Unauthenticated config-file write (IA-05). nginx blocks this externally,
  // but the route itself must not be defenseless — require ZION_NCL_STATUS_KEY
  // when configured, otherwise deny the write entirely.
  const key = process.env.ZION_NCL_STATUS_KEY;
  if (!key || request.headers.get('x-api-key') !== key) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const submitted = await request.json() as Record<string, JsonValue>;
    const { path: filePath, data: current } = await readNclConfig();
    const merged = {
      ...current,
      ...submitted,
    } satisfies Record<string, JsonValue>;

    await writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

    // Do not echo the server filesystem path back to the client (IA-17).
    return NextResponse.json({ ok: true, config: merged });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to save NCL status' },
      { status: 500 },
    );
  }
}
