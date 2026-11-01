import { NextResponse } from 'next/server';
import { ORIGINS } from '@/core/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PROMPT = 800;
const WINDOW_MS = 60_000;
const LIMIT = 20;

/**
 * Rozhovor s Hiranem.
 *
 * Server-side proxy: prohlížeč nikdy nemluví s modelem přímo, takže v klientu
 * není žádný klíč ani interní URL. Rate limit je in-memory per IP — stejná
 * hranice, jakou má web; hlubší ochrana patří do ai-native.
 */
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > 1024) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'TOO_MANY_REQUESTS' }, { status: 429 });
  }

  let prompt: unknown;
  try {
    ({ prompt } = (await request.json()) as { prompt?: unknown });
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT) {
    return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${ORIGINS.hiran}/api/ai-chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim() }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ offline: true, response: '' }, { status: 200 });
    }

    const data = (await response.json()) as { response?: string; model?: string; backend?: string };
    return NextResponse.json({
      response: typeof data.response === 'string' ? data.response : '',
      model: data.model,
      backend: data.backend,
    });
  } catch {
    /* Spící uzel není selhaná služba — vracíme 200 s `offline`, ne 5xx. */
    return NextResponse.json({ offline: true, response: '' }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}
