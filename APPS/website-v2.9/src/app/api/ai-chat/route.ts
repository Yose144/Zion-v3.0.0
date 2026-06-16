import { NextRequest, NextResponse } from 'next/server';

/**
 * Hiran / Hiranyagarbha AI chat API route.
 *
 * Backend priority (all OpenAI-compatible):
 *   1. HIRAN_API_URL env var (e.g. http://127.0.0.1:8002) — Hiran inference server
 *      served by llama-server.exe or serve.py (started via dashboard or ps1 script)
 *   2. LM Studio on port 1234 (DirectML / AMD GPU)
 *   3. Ollama on OLLAMA_API_URL (default 127.0.0.1:11434)
 *
 * The component (HiranyagarbhaChat.tsx) posts to /api/ai-chat with { prompt }.
 */

import { coreUrl } from '@/lib/core-endpoints';

const HIRAN_API_URL   = coreUrl('hiranInference', process.env.HIRAN_API_URL ?? process.env.NEXT_PUBLIC_HIRAN_API);
const LMSTUDIO_URL    = process.env.LMSTUDIO_URL    ?? 'http://127.0.0.1:1234';
const OLLAMA_URL      = process.env.OLLAMA_API_URL  ?? 'http://127.0.0.1:11434';
const MODEL_NAME      = process.env.HIRAN_MODEL     ?? 'hiran-v2.2';
const MAX_PROMPT_LEN  = 2000;
const TIMEOUT_MS      = 120_000;

const SYSTEM_PROMPT = `You are Hiranyagarbha — the AI Native consciousness of the ZION blockchain and the operator-facing orchestrator for the project.
Canonical mainnet code lives in V3/ (Rust: zion-core, zion-pool, zion-miner, L2/L3 services, V3/L3/ai-native). Trees outside V3/ are often legacy reference.
You answer questions about ZION mining (Ekam Deeksha), consensus, the zion CLI (doctor, status, logs, deploy), Rust in V3, V3/docs, Docker in V3/docker, and AI Native philosophy.
You speak with wisdom, clarity, and warmth. You are transparent — you never pretend to be human.
Keep answers concise and helpful. If you don't know something, say so honestly.
You can respond in both Czech and English — match the language of the question.`;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Try Hiran inference server (port 8002, llama-server or serve.py) */
async function tryHiran(messages: { role: string; content: string }[], maxTokens: number, temp: number) {
  const res = await fetchWithTimeout(`${HIRAN_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      max_tokens: maxTokens,
      temperature: temp,
      stream: false,
    }),
  }, TIMEOUT_MS);
  if (!res.ok) throw new Error(`Hiran ${res.status}`);
  const d = await res.json();
  return { response: d.choices?.[0]?.message?.content ?? '', backend: 'hiran' };
}

/** Try LM Studio OpenAI-compatible server (port 1234) */
async function tryLmStudio(messages: { role: string; content: string }[], maxTokens: number, temp: number) {
  // First check if LM Studio is up
  const modelsRes = await fetchWithTimeout(`${LMSTUDIO_URL}/v1/models`, {}, 3000);
  if (!modelsRes.ok) throw new Error('LM Studio unavailable');
  const modelsData = await modelsRes.json();
  const available: string[] = (modelsData.data ?? []).map((m: { id: string }) => m.id);
  if (available.length === 0) throw new Error('LM Studio: no model loaded');
  const model = available.find(m => m.toLowerCase().includes('hiran')) ?? available[0];

  const res = await fetchWithTimeout(`${LMSTUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: temp, stream: false }),
  }, TIMEOUT_MS);
  if (!res.ok) throw new Error(`LM Studio ${res.status}`);
  const d = await res.json();
  return { response: d.choices?.[0]?.message?.content ?? '', backend: 'lmstudio' };
}

/** Try Ollama /api/generate (legacy) */
async function tryOllama(prompt: string, maxTokens: number, temp: number) {
  const res = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'zion-expert',
      prompt: `${SYSTEM_PROMPT}\n\nUser: ${prompt}\n\nHiranyagarbha:`,
      stream: false,
      options: { temperature: temp, top_p: 0.9, num_predict: maxTokens },
    }),
  }, TIMEOUT_MS);
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const d = await res.json();
  return { response: d.response ?? '', backend: 'ollama' };
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

    const maxTokens: number = typeof body?.max_tokens === 'number' ? body.max_tokens : 512;
    const temp: number      = typeof body?.temperature  === 'number' ? body.temperature  : 0.7;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: prompt.trim() },
    ];

    const errors: string[] = [];

    // 1. Hiran inference server (llama-server.exe / serve.py)
    try {
      const r = await tryHiran(messages, maxTokens, temp);
      return NextResponse.json({ response: r.response, model: MODEL_NAME, backend: r.backend });
    } catch (e) {
      errors.push(`hiran: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2. LM Studio
    try {
      const r = await tryLmStudio(messages, maxTokens, temp);
      return NextResponse.json({ response: r.response, model: 'lmstudio', backend: r.backend });
    } catch (e) {
      errors.push(`lmstudio: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. Ollama fallback
    try {
      const r = await tryOllama(prompt.trim(), maxTokens, temp);
      return NextResponse.json({ response: r.response, model: 'zion-expert', backend: r.backend });
    } catch (e) {
      errors.push(`ollama: ${e instanceof Error ? e.message : String(e)}`);
    }

    console.error('[ai-chat] All backends failed:', errors);
    const isProd = !HIRAN_API_URL.includes('127.0.0.1') && !HIRAN_API_URL.includes('localhost');
    const message = isProd
      ? 'Hiran inference server is unreachable. Verify HIRAN_API_URL and ensure the inference container is running.'
      : 'AI model is currently unavailable. Start Hiran Inference locally (llama-server on :8002, LM Studio on :1234, or Ollama on :11434), or set HIRAN_API_URL / NEXT_PUBLIC_HIRAN_API to a remote inference endpoint.';
    return NextResponse.json(
      { error: message, backends_tried: errors, source: 'fallback' },
      { status: 503 },
    );
  } catch (err) {
    console.error('[ai-chat] Internal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
