import type { FastifyInstance } from 'fastify';
import { renderMetrics } from '../lib/metrics.js';

// GET /metrics — Prometheus text exposition. Scraped on localhost by the
// edge Prometheus; no secrets, so it stays unauthenticated like the other
// ZION service metrics endpoints.
export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_req, reply) => {
    const body = await renderMetrics();
    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(body);
  });
}
