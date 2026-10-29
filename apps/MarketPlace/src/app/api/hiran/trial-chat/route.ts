import { NextRequest, NextResponse } from 'next/server';
import { createMarketApiKey, isAuthDenied, requireMarketAuth } from '@/lib/zis';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const GATEWAY =
  process.env.HIRAN_GATEWAY_URL?.trim().replace(/\/$/, '') ||
  'https://market.zionterranova.com';

const MAX_PROMPT = 500;

/**
 * POST /api/hiran/trial-chat { prompt, model? }
 * Session-auth single-turn trial against gateway (mints free zis_* if needed).
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(`hiran-trial:${clientIp(request)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Rate limited — try again shortly' },
      { status: 429 },
    );
  }

  const userOr = await requireMarketAuth();
  if (isAuthDenied(userOr)) return userOr;

  let prompt: string;
  let model = 'hiran-mini';
  try {
    const body = (await request.json()) as { prompt?: string; model?: string };
    prompt = String(body.prompt || '').trim();
    if (body.model && typeof body.model === 'string') {
      model = body.model.trim().slice(0, 64) || model;
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 },
    );
  }
  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'prompt required' },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_PROMPT) {
    return NextResponse.json(
      { success: false, error: `prompt max ${MAX_PROMPT} chars` },
      { status: 400 },
    );
  }

  let apiKey: string;
  try {
    const created = await createMarketApiKey('hiran-trial');
    apiKey = created.apiKey;
  } catch (err) {
    console.error('trial-chat: key mint failed', err);
    return NextResponse.json(
      { success: false, error: 'Could not mint trial API key' },
      { status: 502 },
    );
  }

  try {
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        temperature: 0.4,
        stream: false,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    if (!res.ok) {
      const errMsg =
        (json as { error?: { message?: string } } | null)?.error?.message ||
        text.slice(0, 300) ||
        `gateway ${res.status}`;
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: res.status === 401 ? 502 : res.status },
      );
    }
    const content =
      (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
        ?.message?.content || '';
    return NextResponse.json({
      success: true,
      data: {
        model,
        content: content || '(empty)',
        note: 'Trial key minted for this request; create a plan key under Free for durable access.',
      },
    });
  } catch (err) {
    console.error('trial-chat: gateway failed', err);
    return NextResponse.json(
      { success: false, error: 'Gateway unreachable' },
      { status: 502 },
    );
  }
}
