// Minimal Prometheus metrics registry for ZIS.
//
// Hand-rolled (no prom-client dep) — counters/gauges rendered in the
// text exposition format. Counters are incremented inline in handlers;
// gauges (users, active sessions) are computed on scrape from Postgres.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';

/** Structural host — works with the app's concrete FastifyInstance type. */
export interface MetricsHost {
  prisma: PrismaClient;
  addHook(
    name: 'onResponse',
    hook: (req: FastifyRequest, reply: FastifyReply) => Promise<void>,
  ): unknown;
}

type Labels = Record<string, string | number>;

const counters = new Map<string, number>();
const gaugeFns = new Map<string, () => Promise<number> | number>();

function key(name: string, labels: Labels): string {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return parts.length ? `${name}{${parts.join(',')}}` : name;
}

export function inc(name: string, labels: Labels = {}, value = 1): void {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + value);
}

export function gauge(name: string, fn: () => Promise<number> | number): void {
  gaugeFns.set(name, fn);
}

// ── Metric names used across the codebase ────────────────────────────
export const M = {
  authChallenge: 'zis_auth_challenges_total',
  authVerify: 'zis_auth_verify_total',       // {method, result}
  sessionIssued: 'zis_sessions_issued_total', // {method}
  link: 'zis_links_total',                    // {chain, result}
  apikeyVerify: 'zis_apikey_verify_total',    // {result}
  httpRequests: 'zis_http_requests_total',    // {method, route, status}
  emailSent: 'zis_email_sent_total',          // {result}
  notificationPush: 'zis_notifications_pushed_total',
} as const;

/** Render the registry + live gauges in Prometheus text format. */
export async function renderMetrics(): Promise<string> {
  const lines: string[] = [];
  for (const [k, v] of [...counters.entries()].sort()) {
    lines.push(`${k} ${v}`);
  }
  for (const [name, fn] of gaugeFns) {
    try {
      lines.push(`${name} ${await fn()}`);
    } catch {
      lines.push(`${name} -1`);
    }
  }
  return lines.join('\n') + '\n';
}

/** Register the default gauges + the HTTP request counter hook. */
export function registerMetrics(app: MetricsHost): void {
  gauge('zis_users_total', () => app.prisma.user.count());
  gauge('zis_sessions_active', () =>
    app.prisma.session.count({ where: { revoked: false, expiresAt: { gt: new Date() } } }),
  );
  gauge('zis_linked_addresses_total', () => app.prisma.linkedAddress.count());
  gauge('zis_apikeys_total', () => app.prisma.apiKey.count());
  gauge('zis_webauthn_credentials_total', () => app.prisma.webAuthnCredential.count());
  gauge('zis_pending_challenges', () =>
    app.prisma.authChallenge.count({ where: { expiresAt: { gt: new Date() } } }),
  );

  app.addHook('onResponse', async (req, reply) => {
    // routeOptions.url gives the templated route ("/avatar/:file"), not the
    // concrete path — bounded cardinality. Unmatched 404s share "unknown".
    const route = req.routeOptions?.url ?? 'unknown';
    inc(M.httpRequests, {
      method: req.method,
      route,
      status: reply.statusCode,
    });
  });
}
