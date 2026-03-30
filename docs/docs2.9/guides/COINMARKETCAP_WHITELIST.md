# CoinMarketCap Whitelist

This document lists the public endpoints and IPs that CoinMarketCap (CMC) can use for network status checks and data collection.

Last updated: 2025-09-21

## Public Endpoints

- Reverse Proxy (recommended single entrypoint):
  - Base URL: `http://91.98.122.165:8080/`
  - Health: `GET /healthz` → `{ "status": "ok" }`
  - Shim: `POST /shim/json_rpc` (Monero-like RPC)
  - Shim health/metrics: `GET /shim/` and `GET /shim/metrics.json`
  - Prometheus metrics: `GET /shim/metrics` (plaintext for scrapers)
  - Explorer API: `GET /adapter/explorer/...` (summary, blocks, block/{height,hash}, search)

- Direct RPC Shim (read-only):
  - URL: `http://91.98.122.165:18089/`
  - Health: `GET /` → `{ "status": "ok" }`
  - Height: `POST /json_rpc` with `{ "method":"getheight" }`

- Explorer API (via wallet-adapter):
  - Summary: `http://91.98.122.165:18099/explorer/summary` or via proxy `/adapter/explorer/summary`
  - Blocks: `http://91.98.122.165:18099/explorer/blocks?limit=10` or via proxy `/adapter/explorer/blocks?limit=10`
  - Block by height: `http://91.98.122.165:18099/explorer/block/height/<h>` or via proxy `/adapter/explorer/block/height/<h>`
  - Block by hash: `http://91.98.122.165:18099/explorer/block/hash/<hash>` or via proxy `/adapter/explorer/block/hash/<hash>`

## Network Nodes (P2P/RPC)

- Seed1: `91.98.122.165:18080` (P2P), `91.98.122.165:18081` (RPC)
- Seed2: (add when public)

## HTTP Access Policy

- Methods: GET, POST
- CORS: `*` (read-only endpoints)
- Rate limiting: reverse proxy enforces ~10 rps/IP with burst 20 (nginx). Contact us for higher limits.

## Contact

- Email: support@zion.org (placeholder)
- Telegram: https://t.me/zion (placeholder)
