# ZION Secure Deployment Checklist

Use this checklist before going live. It focuses on minimizing exposure, enforcing auth, and enabling observability.

## 1) Secrets & Env
- [ ] Create `.env` from `.env.example` and set strong values:
  - [ ] `ADAPTER_API_KEY` (long, random)
  - [ ] `CORS_ORIGINS` (comma-separated allowed origins)
  - [ ] `ZION_RPC_BIND` (prefer internal IP/127.0.0.1)
  - [ ] `ZION_RPC_CORS_ORIGINS` (set only if browser must access daemon)
  - [ ] `BITCOIN_RPCUSER`, `BITCOIN_RPCPASSWORD` (random), `BITCOIN_RPCALLOWIP` (docker subnet)
- [ ] Store secrets securely (e.g., Vault/Key Vault/1Password/Bitwarden) and restrict repo access.
- [ ] Do NOT commit `.env` or secrets.

## 2) Network & Firewall
- [ ] Allow inbound only on:
  - [ ] ZION P2P (18080) if node should be reachable from internet
  - [ ] Pool port (3333) if running pool for miners
  - [ ] Lightning P2P (9735) if using LND
- [ ] Deny inbound for RPC APIs (ziond 18081, walletd 8070, LND REST/gRPC) – expose only internally (Docker network/VPN).
- [ ] If exposure is required, use a reverse proxy with TLS, IP allowlist, auth.
- [ ] Configure host firewall (ufw/firewalld/WFAS) and any cloud SGs appropriately.

## 3) Docker Compose
- [ ] Pin image tags (no `:latest`)
- [ ] Use `env_file: .env` where applicable
- [ ] Remove public port mappings for services that shouldn’t be public (RPC APIs)
- [ ] Set `ZION_RPC_BIND` to internal bind and set `ZION_RPC_CORS_ORIGINS` only when necessary

## 4) Wallet Adapter
- [ ] Require API key in production (default behavior)
- [ ] Define `CORS_ORIGINS` and verify 403 when origin not in allowlist
- [ ] Monitor rate limits and logs for abuse

## 5) Next.js Frontend
- [ ] Review Content-Security-Policy sources and restrict to project domains
- [ ] Confirm HSTS is enabled (HTTPS only)
- [ ] Remove any debug logs and dangerous inline scripts

## 6) Logging & Monitoring
- [ ] Enable Prometheus scrape on adapter `/metrics` and daemon health
- [ ] Set log rotation (compose logging driver / external
- [ ] Ship logs to centralized store (Loki/ELK/Cloud)

## 7) Keys & Rotation
- [ ] Establish a rotation process for `ADAPTER_API_KEY`, Bitcoin RPC creds, and any macaroons/tls for LND
- [ ] Document where keys live and who can rotate them

## 8) Backups
- [ ] Schedule backups for wallet data and important configs (encrypted)
- [ ] Test restore procedures regularly

## 9) Incident Response
- [ ] Document contacts, escalation, and rollback steps
- [ ] Keep emergency disable switch (e.g., compose profile off, firewall rule)
