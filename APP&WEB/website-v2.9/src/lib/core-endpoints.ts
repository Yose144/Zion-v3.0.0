/**
 * Edge-only runtime endpoint constants (2026-06-07).
 *
 * Topology: Edge (Hetzner VPS) is the sole live server.
 * Core PC is unreachable due to Tailscale VPN failure.
 * All canonical services run on Edge; localhost references are valid
 * because the Next.js website is deployed on the Edge server itself.
 */

export const EDGE_TAILSCALE_IP = '100.76.16.108';

export const CORE = {
  /** Hiranyagarbha AI orchestrator — Edge (may be offline if not deployed) */
  hiranyagarbha: `http://${EDGE_TAILSCALE_IP}:8001`,

  /** Hiran v2.2 LLM inference — Edge (may be offline if not deployed) */
  hiranInference: `http://${EDGE_TAILSCALE_IP}:8002`,

  /** DAO API — runs locally on Edge (port 8450) */
  dao: `http://127.0.0.1:8450`,

  /** Prometheus metrics scraper — runs locally on Edge (port 9090) */
  prometheus: `http://127.0.0.1:9090`,

  /** Bridge relay Prometheus metrics — runs locally on Edge (port 9102) */
  bridgeMetrics: `http://127.0.0.1:9102`,

  /** Dashboard Python Flask — runs locally on Edge (port 8766) */
  dashboard: `http://127.0.0.1:8766`,

  /** ZION Node RPC (raw TCP JSON-RPC) — runs locally on Edge */
  nodeRpc: `127.0.0.1:8443`,

  /** Pool stratum — runs locally on Edge */
  poolStratum: `127.0.0.1:8444`,
} as const;

/** Resolve a Core endpoint, allowing env-var override for dev/test. */
export function coreUrl(
  key: keyof typeof CORE,
  envVar?: string | undefined
): string {
  if (envVar && envVar.length > 0) return envVar;
  return CORE[key];
}
