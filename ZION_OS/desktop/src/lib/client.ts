// Generic HTTP + JSON-RPC clients used by all direct API modules.

const DEFAULT_TIMEOUT_MS = 3000;

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
  const { timeout = DEFAULT_TIMEOUT_MS, method = 'GET', headers = {}, body, tolerateError = true } = opts;
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
    if (tolerateError) {
      console.warn(`[api] ${method} ${url} unreachable`, e);
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
