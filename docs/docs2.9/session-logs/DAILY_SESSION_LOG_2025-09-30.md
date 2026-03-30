# DAILY SESSION LOG — 2025-09-30

Time zone: system default

## What changed today (high-level)
- Stabilized a production Go "lite" gateway (Gin + Prometheus) to avoid heavy LND/gRPC deps during build.
- Switched Go Dockerfile to build from an isolated module at `bridge/lite` (clean deps, fast build).
- Added runtime security/ops details: non-root user, healthcheck, metrics endpoint.
- Extended docker-compose to include:
  - `zion-go-bridge` (Go lite server on :8090)
  - `legacy-daemon` (CryptoNote daemon image built from a minimal Dockerfile)
  - Existing JS gateway `zion-production` kept as-is with Strict Bridge hooks and Prometheus metrics
- Implemented minimal read-only chain integrations:
  - Daemon JSON-RPC proxy: `/api/v1/daemon/get_info` (Go) and `/api/bridge/daemon/get_info` (JS)
  - Stellar read-only endpoints
- Fixes around legacy daemon Dockerfile to self-clone sources if local tree is absent and to copy a default `mainnet.conf` from `legacy/docker-variants/config/mainnet.conf`.

## Key files touched
- `bridge/Dockerfile` → builds from `bridge/lite` module; generates static binary; healthcheck path updated
- `bridge/lite/main.go` + `bridge/lite/go.mod` → minimal Go service (health, metrics, daemon proxy, Stellar)
- `legacy/docker-variants/docker/Dockerfile.zion-cryptonote.minimal` → self-contained minimal build; default config
- `legacy/docker-variants/config/mainnet.conf` → default daemon config used in the image
- `docker-compose.production.yml` → adds `legacy-daemon` + `zion-go-bridge`; enables strict env in JS service
- `zion2.6.5testnet/server.js` + `package.json` → JS gateway hardened (helmet, metrics, strict checks)

## Build/run status (macOS vs Ubuntu)
- Go lite image: OK on macOS via Docker (validated).
  - Local smoke test with a dummy socat server on 18081: `/api/v1/health`, `/api/v1/daemon/get_info`, `/metrics` are OK.
- legacy-daemon image: build attempted on macOS Docker but failed at CryptoNote `slow-hash` with `__m128i` (SSE) intrinsics.
  - This is expected on non-amd64 targets (e.g., Apple Silicon) unless the fork provides portable slow-hash toggles.
  - On Ubuntu amd64 this should compile cleanly; if you use ARM Ubuntu, we may need to flip slow-hash flags to a portable path.

## How to build and run on Ubuntu (recommended)
Prereqs: Docker (24+) with compose plugin, or docker-compose v2. Go 1.21 only if building natively.

- Full stack (JS gateway + legacy daemon + Go bridge):
```bash
# From repo root
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d legacy-daemon zion-go-bridge
# Optionally also bring the JS gateway
docker compose -f docker-compose.production.yml up -d zion-production
```
- Individual images:
```bash
# Build Go bridge (lite)
docker build -t zion-go-bridge:latest -f bridge/Dockerfile bridge

# Build legacy daemon
# (On Ubuntu amd64 expected to pass; on ARM use a host with amd64 or consider portable slow-hash flags)
docker build -t zion-cryptonote:latest -f legacy/docker-variants/docker/Dockerfile.zion-cryptonote.minimal legacy/docker-variants
```
- Smoke tests:
```bash
# Go bridge
curl -s http://localhost:8090/api/v1/health | jq .
curl -s http://localhost:8090/api/v1/daemon/get_info | jq .
curl -s http://localhost:8090/metrics | head -n 20

# JS gateway (if running on 8888)
curl -s http://localhost:8888/health | jq .
curl -s http://localhost:8888/api/bridge/daemon/get_info | jq .
curl -s http://localhost:8888/api/metrics | head -n 20
```

Notes:
- The Go service reads these envs: `BRIDGE_PORT` (default 8090), `DAEMON_RPC_URL` (default `http://legacy-daemon:18081`), `STELLAR_HORIZON_URL`.
- The JS service uses: `STRICT_BRIDGE_REQUIRED`, `EXTERNAL_DAEMON_ENABLED`, `DAEMON_RPC_URL`, `BRIDGE_TIMEOUT_MS`, `STELLAR_HORIZON_URL`.

## Why macOS Docker failed for legacy daemon
- Error: `__m128i` not found in CryptoNote `slow-hash` C source. This usually requires SSE2 intrinsics (x86_64).
- On Apple Silicon or ARM hosts, the fork must offer a portable implementation (e.g., `NO_AES`/no-intrinsics path). If needed, we can add appropriate CMake flags in the Dockerfile; for production speed, prefer Ubuntu amd64 builds.

## Current capabilities
- JS gateway (Express) in hardened prod mode with security headers and Prometheus metrics.
- Go gateway (Gin) with health, metrics, daemon get_info proxy, Stellar ledger.
- Compose wiring for a real daemon container.

## Remaining work (next Ubuntu iteration)
1. Build `legacy-daemon` on Ubuntu amd64 and run the full stack; verify:
   - `/api/v1/daemon/get_info` (Go) and `/api/bridge/daemon/get_info` (JS) return real chain data
   - Strict Mode end-to-end via `/strict/verify` (JS)
2. Decide the primary gateway (Go vs JS) and/or proxy routes; consider deprecating JS after Go is stable.
3. Extend Go gateway:
   - JSON-RPC pass-through endpoints (submit_block, get_block, get_last_block_header, tx pool)
   - Prometheus gauges for daemon health/height/txpool
4. Optional: LND integration behind `LND_ENABLED=true` with build tag; ship a separate Dockerfile stage if needed.
5. Add basic unit/integration tests for gateway endpoints.
6. CI: add GitHub Actions for building Go bridge + daemon on Ubuntu (amd64) and publishing images.

## Quick git steps (you can run on Ubuntu)
```bash
git add -A
git commit -m "Go lite bridge + compose wiring; legacy daemon minimal Dockerfile; docs/log"
git push origin main
```

## Reference endpoints
- Go bridge (default :8090):
  - Health: `GET /api/v1/health`
  - Daemon get_info: `GET /api/v1/daemon/get_info`
  - Metrics: `GET /metrics`
  - Stellar ledger: `GET /api/v1/stellar/ledger`
- JS gateway (default :8888):
  - Health: `GET /health`
  - Strict verify: `GET /strict/verify`
  - Daemon get_info: `GET /api/bridge/daemon/get_info`
  - Metrics: `GET /api/metrics`

---
Status: repo ready for Ubuntu build; Go bridge verified locally (Docker); legacy daemon expected to compile on Ubuntu amd64.
