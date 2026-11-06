// Generic HTTP + JSON-RPC clients used by all direct API modules.

const DEFAULT_TIMEOUT_MS = 3000;
const LOCAL_TIMEOUT_MS = 400;
const LOCAL_MISS_MS = 60_000;
const SHARE_MS = 2000;

const localMissUntil = new Map<string, number>();

/** Explicit loopback URL. Relative dev-proxy paths are not loopback. */
function loopbackKey(url: string): string | null {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url)) return null;
  const u = new URL(url);
  return `${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
}

export interface SharedSlot<T> {
  inflight: Promise<T> | null;
  cached: { at: number; value: T } | null;
}

/** One in-flight call, then a short reuse so a single refresh does not probe twice. */
export function shareLatest<T>(slot: SharedSlot<T>, run: () => Promise<T>, ttlMs = SHARE_MS): Promise<T> {
  const now = Date.now();
  if (slot.cached && now - slot.cached.at < ttlMs) return Promise.resolve(slot.cached.value);
  if (slot.inflight) return slot.inflight;
  const pending = run().then(
    (value) => {
      slot.cached = { at: Date.now(), value };
      slot.inflight = null;
      return value;
    },
    (err: unknown) => {
      slot.inflight = null;
      throw err;
    },
  );
  slot.inflight = pending;
  return pending;
}

export interface FetchOptions {
  timeout?: number;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  /** Skip throwing on non-OK status; return null instead. */
  tolerateError?: boolean;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class ApiError extends Error {
  constructor(
    public url: string,
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function httpFetch<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T | null> {
  const { method = 'GET', headers = {}, body, tolerateError = true } = opts;
  const key = loopbackKey(url);
  if (key) {
    const until = localMissUntil.get(key) ?? 0;
    if (until > Date.now()) return null;
  }
  const timeout = key ? Math.min(opts.timeout ?? LOCAL_TIMEOUT_MS, LOCAL_TIMEOUT_MS) : (opts.timeout ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...headers,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };

    const res = await fetch(url, init);
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (tolerateError) {
        console.warn(`[api] ${method} ${url} -> ${res.status}: ${text.slice(0, 200)}`);
        return null;
      }
      throw new ApiError(url, res.status, text, undefined);
    }

    if (res.status === 204) return null as T;

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof ApiError) throw e;
    if (key) localMissUntil.set(key, Date.now() + LOCAL_MISS_MS);
    if (tolerateError) {
      if (!key) console.warn(`[api] ${method} ${url} unreachable`, e);
      return null;
    }
    throw e;
  }
}

export async function httpGet<T = unknown>(url: string, timeout?: number): Promise<T | null> {
  return httpFetch<T>(url, { timeout, method: 'GET' });
}

export async function httpPost<T = unknown>(url: string, body: unknown, timeout?: number): Promise<T | null> {
  return httpFetch<T>(url, { timeout, method: 'POST', body });
}

let jsonRpcId = 1;

export async function jsonRpc<T = unknown>(url: string, method: string, params: unknown = {}, timeout?: number): Promise<T | null> {
  const req: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: jsonRpcId++,
    method,
    params,
  };

  const res = await httpFetch<JsonRpcResponse<T>>(url, {
    method: 'POST',
    body: req,
    timeout,
    tolerateError: true,
  });

  if (!res) return null;
  if (res.error) {
    console.warn(`[rpc] ${method} error: ${res.error.message}`);
    return null;
  }
  return res.result ?? null;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
