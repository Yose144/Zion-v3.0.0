# WORK REPORT — 2026-02-03 (v2.9.5 native stack)

## Summary
Focused on making the **native Rust Docker/Compose stack** consistent and deployable by removing port drift and reducing Docker build context size.

## Changes shipped in repo
- Standardized canonical ports:
  - Core JSON-RPC: **8444** (was 8080 in some configs)
  - Pool API: **8080** (was 8181 in some configs)
- Updated compose wiring so pool points to core RPC: `http://zion-core:8444/jsonrpc`.
- Updated Dockerfiles:
  - `Dockerfile.core`: `ZION_RPC_PORT=8444`, `EXPOSE 8444`, healthcheck on `:8444/health`.
  - `Dockerfile.pool.prod`: pool API `8080`, core RPC `8444`, healthcheck on `:8080/health`.
- Added `2.9.5/.dockerignore` to prevent huge build contexts (excludes `**/target/`, `node_modules`, caches, logs, data).
- Hardened repo ignores to prevent accidental wallet dumps (ignore `tmp-wallet.json` / `zion-wallet*.json`).

## Ops note (remote build unblock)
On the Hetzner pool host, Docker builds were failing due to disk pressure + gigantic contexts (Rust `target/`).
- Mitigation: prune dangling Docker artifacts and remove repo-local `target/` before rebuilding.
- Expected result: `docker build` should succeed without “no space left on device”.

## Next steps
- Rebuild and restart `zion-pool:2.9.5` on the server, then verify:
  - `curl http://127.0.0.1:8444/health` (core)
  - `curl http://127.0.0.1:8080/health` (pool)
  - Stratum login on `:3333` with a valid `zion1...` address.
