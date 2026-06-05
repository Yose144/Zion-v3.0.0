/**
 * Core + Edge runtime endpoint constants.
 *
 * These are used by API routes that need to reach the Core PC (zionserver-144)
 * over the Tailscale VPN tunnel. The original Windows Core (100.86.102.5) has
 * been offline since 2026-05-30; the active Core is the Linux machine at
 * 100.74.34.40.
 *
 * Next.js inlines process.env at build time, so env vars set in PM2 after
 * build are not visible in production. We use these hardcoded constants as
 * the canonical fallback and allow env-var override for local development.
 */

export const CORE_TAILSCALE_IP = '100.86.102.5';

export const CORE = {
  /** Hiranyagarbha AI orchestrator (Axum/Rust) — on Core Tailscale */
  hiranyagarbha: `http://${CORE_TAILSCALE_IP}:8001`,

  /** Hiran v2.2 LLM inference (OpenAI-compatible) — on Core Tailscale */
  hiranInference: `http://${CORE_TAILSCALE_IP}:8002`,

  /** DAO API (Axum/SQLite) — on Core Tailscale */
  dao: `http://${CORE_TAILSCALE_IP}:8081`,

  /** Prometheus metrics scraper — runs locally on Edge (port 9090) */
  prometheus: `http://127.0.0.1:9090`,

  /** Bridge relay Prometheus metrics — on Core Tailscale */
  bridgeMetrics: `http://${CORE_TAILSCALE_IP}:9102`,

  /** Dashboard Python Flask — on Core Tailscale */
  dashboard: `http://${CORE_TAILSCALE_IP}:8766`,

  /** ZION Node RPC (raw TCP JSON-RPC) — on Core Tailscale */
  nodeRpc: `${CORE_TAILSCALE_IP}:8443`,

  /** Pool stratum */
  poolStratum: `${CORE_TAILSCALE_IP}:8444`,
} as const;

/** Resolve a Core endpoint, allowing env-var override for dev/test. */
export function coreUrl(
  key: keyof typeof CORE,
  envVar?: string | undefined
): string {
  if (envVar && envVar.length > 0) return envVar;
  return CORE[key];
}
