import type { EndpointSpec, ServiceId } from '@zion/contract';

/**
 * @zion/api — jediná datová cesta Kingdomu.
 *
 * Čte se na serveru. Do prohlížeče nepropadne žádné tajemství ani URL
 * interní služby. Cache je deklarovaná v manifestu (`reads[].cache`).
 */

export class ReadError extends Error {
  constructor(
    readonly service: ServiceId,
    readonly path: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ReadError';
  }
}

export type Origins = Partial<Record<ServiceId, string>>;

export interface Api {
  read<T>(spec: EndpointSpec, init?: { locale?: string }): Promise<T>;
  tryRead<T>(spec: EndpointSpec): Promise<T | null>;
}

interface NextFetchInit extends RequestInit {
  next?: { revalidate?: number; tags?: string[] };
}

const DEFAULT_TIMEOUT_MS = 6000;

export function createApi(origins: Origins): Api {
  function resolve(spec: EndpointSpec): URL {
    const base = origins[spec.service];
    if (!base) {
      throw new ReadError(spec.service, spec.path, 0, `Služba "${spec.service}" není nakonfigurovaná`);
    }
    if (!spec.path.startsWith('/')) {
      throw new ReadError(spec.service, spec.path, 0, 'Cesta čtení musí začínat "/"');
    }
    return new URL(spec.path, base);
  }

  async function read<T>(spec: EndpointSpec): Promise<T> {
    const url = resolve(spec);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), spec.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const init: NextFetchInit = {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: spec.cache ?? 60, tags: [`${spec.service}:${spec.path}`] },
    };

    try {
      const res = await fetch(url, init as RequestInit);
      if (!res.ok) {
        throw new ReadError(spec.service, spec.path, res.status, `HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    read,
    async tryRead<T>(spec: EndpointSpec): Promise<T | null> {
      try {
        return await read<T>(spec);
      } catch {
        return null;
      }
    },
  };
}
