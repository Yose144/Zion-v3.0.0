/**
 * Core + Edge runtime endpoint constants.
 *
 * 2026-06-06: Core (100.86.102.5) unreachable via Tailscale. Services moved to Edge:
 *   - DAO: 127.0.0.1:8450 (zion-dao systemd)
 *   - WARP: 127.0.0.1:8453 (zion-warp-server systemd)
 * Still on Core (unreachable):
 *   - Hiranyagarbha (8001), Hiran inference (8002), Dashboard (8766)
 *   - Bridge metrics (9102)
 */

export const CORE_TAILSCALE_IP = '100.86.102.5';

export const CORE = {
  /** Hiranyagarbha AI orchestrator — on Core (unreachable) */
  hiranyagarbha: `http://${CORE_TAILSCALE_IP}:8001`,

  /** Hiran v2.2 LLM inference — on Core (unreachable) */
  hiranInference: `http://${CORE_TAILSCALE_IP}:8002`,

  /** DAO API — now running locally on Edge (port 8450) */
  dao: `http://127.0.0.1:8450`,

  /** Prometheus metrics scraper — runs locally on Edge (port 9090) */
  prometheus: `http://127.0.0.1:9090`,

  /** Bridge relay Prometheus metrics — on Core (unreachable) */
  bridgeMetrics: `http://${CORE_TAILSCALE_IP}:9102`,

  /** Dashboard Python Flask — on Core (unreachable) */
  dashboard: `http://${CORE_TAILSCALE_IP}:8766`,

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
