import { NextRequest, NextResponse } from 'next/server';

/**
 * Hiranyagarbha AI chat API route.
 *
 * Production path: the grounded L3 service (zion-ai-native-api on Edge,
 * 127.0.0.1:8001) which does BM25 RAG over curated ZION docs and proxies to
 * the local LLM inference server. ai-native owns the system prompt and
 * sampling settings; the web route forwards only { message }.
 *
 * Dev fallbacks (LM Studio / Ollama) are enabled only for local development
 * via HIRAN_DEV_FALLBACKS=1 — never used in production.
 *
 * The component (HiranyagarbhaChat.tsx) posts to /api/ai-chat with { prompt }.
 */

import { coreUrl } from '@/lib/core-endpoints';

const HIRANYAGARBHA_URL = coreUrl('hiranyagarbha', process.env.HIRANYAGARBHA_URL);
const HIRAN_API_URL     = coreUrl('hiranInference', process.env.HIRAN_API_URL ?? process.env.NEXT_PUBLIC_HIRAN_API);
const DEV_FALLBACKS     = process.env.HIRAN_DEV_FALLBACKS === '1';
const LMSTUDIO_URL      = process.env.LMSTUDIO_URL    ?? 'http://127.0.0.1:1234';
const OLLAMA_URL        = process.env.OLLAMA_API_URL  ?? 'http://127.0.0.1:11434';
const MODEL_NAME        = 'zion-l3';
const MAX_PROMPT_LEN    = 2000;
const TIMEOUT_MS        = 120_000;
const PROBE_TIMEOUT_MS  = 4_000;

const OFFLINE_BODY = {
  error: 'Hiran is currently offline — the inference node is not reachable. Please try again later.',
  source: 'fallback',
};

/** System prompt used only by the local-dev LM Studio / Ollama fallbacks. */
const DEV_SYSTEM_PROMPT = `You are Hiranyagarbha — the AI Native consciousness of the ZION blockchain.
Answer questions about ZION mining, consensus, and the ecosystem. Be concise and honest —
if you don't know something, say so. Respond in the language of the question (Czech or English).`;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Try LM Studio OpenAI-compatible server (port 1234). Dev fallback only. */
async function tryLmStudio(prompt: string) {
  const modelsRes = await fetchWithTimeout(`${LMSTUDIO_URL}/v1/models`, {}, 3000);
  if (!modelsRes.ok) throw new Error('LM Studio unavailable');
  const modelsData = await modelsRes.json();
  const available: string[] = (modelsData.data ?? []).map((m: { id: string }) => m.id);
  if (available.length === 0) throw new Error('LM Studio: no model loaded');
  const model = available.find(m => m.toLowerCase().includes('hiran')) ?? available[0];

  const res = await fetchWithTimeout(`${LMSTUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: DEV_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: false,
    }),
  }, TIMEOUT_MS);
  if (!res.ok) throw new Error(`LM Studio ${res.status}`);
  const d = await res.json();
  return { response: d.choices?.[0]?.message?.content ?? '', backend: 'lmstudio' };
}

/** Try Ollama /api/generate (legacy). Dev fallback only. */
async function tryOllama(prompt: string) {
  const res = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'zion-expert',
      prompt: `${DEV_SYSTEM_PROMPT}\n\nUser: ${prompt}\n\nHiranyagarbha:`,
      stream: false,
    }),
  }, TIMEOUT_MS);
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const d = await res.json();
  return { response: d.response ?? '', backend: 'ollama' };
}

/**
 * GET /api/ai-chat — availability probe for the chat widget.
 * Available only when both the grounded L3 API and the LLM behind it
 * report healthy.
 */
export async function GET() {
  const probe = async (url: string) => {
    try {
      const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, PROBE_TIMEOUT_MS);
      return res.ok;
    } catch {
      return false;
    }
  };
  const probeJson = async (url: string) => {
    try {
      const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, PROBE_TIMEOUT_MS);
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      return null;
    }
  };

  const l3Health = await probeJson(`${HIRANYAGARBHA_URL}/health`);
  if (l3Health?.status === 'ok' && (await probe(`${HIRAN_API_URL}/health`))) {
    return NextResponse.json(
      { available: true, backend: 'hiranyagarbha', model: MODEL_NAME },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (DEV_FALLBACKS) {
    if (await probe(`${LMSTUDIO_URL}/v1/models`)) {
      return NextResponse.json(
        { available: true, backend: 'lmstudio' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (await probe(`${OLLAMA_URL}/api/tags`)) {
      return NextResponse.json(
        { available: true, backend: 'ollama' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  return NextResponse.json(
    { available: false },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return NextResponse.json({ error: `Prompt too long (max ${MAX_PROMPT_LEN} chars)` }, { status: 400 });
    }

    const errors: string[] = [];

    // Grounded L3 path: BM25 RAG + strict system prompt live in ai-native;
    // client-supplied max_tokens/temperature are intentionally ignored.
    try {
      const res = await fetchWithTimeout(`${HIRANYAGARBHA_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt.trim() }),
      }, TIMEOUT_MS);
      if (res.ok) {
        const d = await res.json();
        const answer = d?.answer;
        // ai-native sets `source` only when it fell back to the degraded
        // echo path — a null/absent source means a real LLM answer.
        // ai-native's echo-only mode (no remote backend configured) also has a
        // null source, but its answer always starts with this fixed prefix.
        const isEcho = typeof answer === 'string' && answer.startsWith('Hiranyagarbha bezi v ');
        if (typeof answer === 'string' && answer.trim().length > 0 && d?.source == null && !isEcho) {
          return NextResponse.json({ response: answer, model: MODEL_NAME, backend: 'hiranyagarbha' });
        }
        errors.push('hiranyagarbha: degraded or empty answer');
      } else {
        errors.push(`hiranyagarbha: ${res.status}`);
      }
    } catch (e) {
      errors.push(`hiranyagarbha: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Local-dev fallbacks only — never in production.
    if (DEV_FALLBACKS) {
      try {
        const r = await tryLmStudio(prompt.trim());
        return NextResponse.json({ response: r.response, model: 'lmstudio', backend: r.backend });
      } catch (e) {
        errors.push(`lmstudio: ${e instanceof Error ? e.message : String(e)}`);
      }
      try {
        const r = await tryOllama(prompt.trim());
        return NextResponse.json({ response: r.response, model: 'zion-expert', backend: r.backend });
      } catch (e) {
        errors.push(`ollama: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    console.error('[ai-chat] Backends failed:', errors);
    return NextResponse.json(OFFLINE_BODY, { status: 503 });
  } catch (err) {
    console.error('[ai-chat] Internal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
