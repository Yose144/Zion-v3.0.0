/**
 * API Configuration
 * Handles API URL resolution for both development and production
 */

const envApiBase = process.env.NEXT_PUBLIC_API_URL;

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const endsWithApiPrefix = (value: string): boolean => /\/api\/?$/.test(stripTrailingSlash(value));

const getClientOrigin = (): string => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${hostname}`;
};

const getClientApiBase = (): string => {
  if (envApiBase) {
    if (/^https?:\/\//i.test(envApiBase)) {
      return stripTrailingSlash(envApiBase);
    }
    if (envApiBase.startsWith('/')) {
      return `${getClientOrigin()}${stripTrailingSlash(envApiBase)}`;
    }
    return stripTrailingSlash(envApiBase);
  }

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }

  return getClientOrigin();
};

const getClientPassthroughBase = (): string => {
  if (envApiBase && /^https?:\/\//i.test(envApiBase)) {
    try {
      return new URL(envApiBase).origin;
    } catch {
      // fall through
    }
  }

  return getClientOrigin();
};

const getServerApiBase = (): string => {
  if (envApiBase && /^https?:\/\//i.test(envApiBase)) {
    return stripTrailingSlash(envApiBase);
  }
  return 'http://localhost:8001';
};

const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return getServerApiBase();
  }
  return getClientApiBase();
};

/**
 * Get full API URL for endpoint
 * @param path - API endpoint path (e.g., '/api/blockchain/stats')
 * @returns Full API URL
 */
export function getApiUrl(path: string): string {
  // Allow absolute URLs
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Some services are proxied directly by Nginx and are not part of the FastAPI gateway
  // (e.g. /pool/* -> pool stats service)
  const passthroughPrefixes = ['pool/', 'grafana/', 'prometheus/'];
  if (passthroughPrefixes.some((prefix) => cleanPath.startsWith(prefix))) {
    if (typeof window === 'undefined') {
      return `${getServerApiBase()}/${cleanPath}`;
    }
    return `${getClientPassthroughBase()}/${cleanPath}`;
  }

  const baseUrl = getApiBase();
  const baseHasApiPrefix = endsWithApiPrefix(baseUrl);

  // If we talk to FastAPI directly (dev / local / docker-internal), do NOT force an /api prefix.
  // In production, nginx typically mounts the gateway under /api and strips the prefix upstream.
  const isDirectBackend = (() => {
    try {
      const url = new URL(baseUrl);
      const host = url.hostname;
      const port = url.port;
      return host === 'localhost' || host === '127.0.0.1' || port === '8001';
    } catch {
      return false;
    }
  })();

  if (isDirectBackend) {
    const withoutLeadingApi = cleanPath.startsWith('api/') ? cleanPath.slice(4) : cleanPath;
    return `${baseUrl}/${withoutLeadingApi}`;
  }

  // Public gateway access: ensure /api prefix is present exactly once.
  const withoutLeadingApi = cleanPath.startsWith('api/') ? cleanPath.slice(4) : cleanPath;
  const apiPath = baseHasApiPrefix
    ? withoutLeadingApi
    : (cleanPath.startsWith('api/') ? cleanPath : `api/${cleanPath}`);

  return `${baseUrl}/${apiPath}`;
}

/**
 * Fetch wrapper with retry logic and error handling.
 * Retries up to 2 times with exponential backoff on network errors or 5xx.
 * @param path - API endpoint path
 * @param options - Fetch options (extends RequestInit with retries/retryDelay)
 * @returns Parsed JSON response
 */
export async function apiClient<T = any>(
  path: string,
  options?: RequestInit & { retries?: number; retryDelay?: number },
): Promise<T> {
  const url = getApiUrl(path);
  const maxRetries = options?.retries ?? 1;
  const baseDelay = options?.retryDelay ?? 400;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 408 || response.status === 429;
        if (isRetryable && attempt < maxRetries) {
          lastError = new Error(`API error: ${response.status} ${response.statusText}`);
          await delay(baseDelay * Math.pow(2, attempt));
          continue;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries && !lastError.message.startsWith('API error: 4')) {
        await delay(baseDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }

  console.error(`API call failed after ${maxRetries + 1} attempts: ${url}`, lastError);
  throw lastError ?? new Error(`API call failed: ${url}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
