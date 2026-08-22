/**
 * Edge-only runtime endpoint constants (2026-07-09).
 *
 * Topology: Edge server (cloud VPS) is the sole live server.
 * All canonical services run on Edge; localhost references are the default
 * because the Next.js website is deployed on the Edge server itself.
 *
 * For development or off-box testing, override the Edge host via the
 * ZION_EDGE_HOST environment variable. Never hardcode production IPs here.
 */

const EDGE_HOST = process.env.ZION_EDGE_HOST || '127.0.0.1';

export const CORE = {
  /** Hiranyagarbha AI orchestrator — Edge (port 8001) */
  hiranyagarbha: `http://${EDGE_HOST}:8001`,

  /** Hiran v2.2 LLM inference — Edge (port 8002) */
  hiranInference: `http://${EDGE_HOST}:8002`,

  /** DAO API — runs locally on Edge (port 8450) */
  dao: `http://127.0.0.1:8450`,

  /** Prometheus metrics scraper — runs locally on Edge (port 9090) */
  prometheus: `http://127.0.0.1:9090`,

  /** Bridge relay Prometheus metrics — runs on Edge host (port 9101) */
  bridgeMetrics: `http://${EDGE_HOST}:9101`,

  /** Dashboard Python Flask — runs locally on Edge (port 8766) */
  dashboard: `http://127.0.0.1:8766`,

  /**
   * ZION Node RPC (raw TCP JSON-RPC) — node itself only listens on
   * 127.0.0.1:9445; port 8443 is the public nginx TCP stream proxy in
   * front of it. Prefer connecting directly to 9445 for local/server-side
   * calls running on Edge to skip the extra proxy hop.
   */
  nodeRpc: `127.0.0.1:9445`,

  /** Pool stratum — runs locally on Edge */
  poolStratum: `127.0.0.1:8444`,

  /** Atomic Swap API — runs locally on Edge (port 8452) */
  atomicSwap: `http://127.0.0.1:8452`,

  /** WARP daemon — runs locally on Edge (port 8453) */
  warp: `http://127.0.0.1:8453`,
} as const;

/** Resolve a Core endpoint, allowing env-var override for dev/test. */
export function coreUrl(
  key: keyof typeof CORE,
  envVar?: string | undefined
): string {
  if (envVar && envVar.length > 0) return envVar;
  return CORE[key];
}
