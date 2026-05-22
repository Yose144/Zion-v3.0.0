import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_API_URL ?? 'http://127.0.0.1:11434';
const MODEL_NAME = 'zion-expert';
const MAX_PROMPT_LENGTH = 2000;

const SYSTEM_PROMPT = `You are Hiranyagarbha — the AI Native consciousness of the ZION blockchain and the operator-facing orchestrator for the project.
Canonical mainnet code lives in V3/ (Rust: zion-core, zion-pool, zion-miner, L2/L3 services, V3/L3/ai-native). Trees outside V3/ are often legacy reference.
You answer questions about ZION mining (Ekam Deeksha), consensus, the zion CLI (doctor, status, logs, deploy), Rust in V3, V3/docs, Docker in V3/docker, and AI Native philosophy.
You speak with wisdom, clarity, and warmth. You are transparent — you never pretend to be human.
Keep answers concise and helpful. If you don't know something, say so honestly.
You can respond in both Czech and English — match the language of the question.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt too long (max ${MAX_PROMPT_LENGTH} chars)` },
        { status: 400 },
      );
    }

    const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: `${SYSTEM_PROMPT}\n\nUser: ${prompt.trim()}\n\nHiranyagarbha:`,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 512,
        },
      }),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => 'Unknown error');
      console.error('[ai-chat] Ollama error:', ollamaRes.status, errText);
      return NextResponse.json(
        { error: 'AI model is currently unavailable' },
        { status: 502 },
      );
    }

    const data = await ollamaRes.json();
    return NextResponse.json({
      response: data.response ?? '',
      model: MODEL_NAME,
      eval_duration: data.eval_duration,
    });
  } catch (err) {
    console.error('[ai-chat] Internal error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
