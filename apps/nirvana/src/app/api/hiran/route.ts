/**
 * GET  /api/hiran — availability probe for the Hiran window.
 * POST /api/hiran — asks Hiranyagarbha a question, { prompt }.
 *
 * Nirvana runs on EDGE, the grounded L3 service (ai-native :8001) runs on
 * EDGE2 behind the public web, so this proxy talks to the existing public
 * endpoint instead of opening a second path to the model. Same policy as
 * every other portal proxy: no keys, no session, no mutations.
 */

import { NextRequest, NextResponse } from 'next/server';

const CHAT_URL = process.env.HIRAN_CHAT_URL ?? 'https://app.zionterranova.com/api/ai-chat';
const PROBE_TIMEOUT_MS = 6_000;
const CHAT_TIMEOUT_MS = 120_000;
const MAX_PROMPT_LEN = 2_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/** Per-IP sliding window. In-memory on purpose: one box, one process. */
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 512) {
    for (const [key, stamps] of hits) {
      if (!stamps.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

export async function GET() {
  try {
    const res = await fetch(CHAT_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { available?: boolean } | null;
    const available = res.ok && body?.available === true;
    return NextResponse.json({ available }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ available: false }, { headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });
  }

  let prompt = '';
  try {
    const body = (await req.json()) as { prompt?: unknown };
    if (typeof body?.prompt === 'string') prompt = body.prompt.trim();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }
  if (!prompt) {
    return NextResponse.json({ error: 'prompt_required' }, { status: 400, headers: NO_STORE });
  }
  if (prompt.length > MAX_PROMPT_LEN) {
    return NextResponse.json(
      { error: 'prompt_too_long', max: MAX_PROMPT_LEN },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => null)) as
      | { response?: unknown; error?: unknown; model?: unknown }
      | null;

    if (typeof data?.response === 'string' && data.response.trim()) {
      return NextResponse.json(
        { answer: data.response, model: typeof data.model === 'string' ? data.model : null },
        { headers: NO_STORE },
      );
    }

    // The public endpoint answers 200 with an `error` when the inference node
    // sleeps. That is a state, not a crash — the sun keeps shining. We answer
    // 200 too: a sleeping model is not a failed HTTP request.
    if (typeof data?.error === 'string') {
      return NextResponse.json({ offline: true, error: data.error }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'degraded' }, { status: 502, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'unreachable' }, { status: 502, headers: NO_STORE });
  }
}
