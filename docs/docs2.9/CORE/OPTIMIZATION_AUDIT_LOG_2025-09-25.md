# ZION v2.5 TestNet - Optimization Audit Log
**Date:** 2025-09-25

---

## 1. Project Structure & Dependencies
- Modular monorepo: `frontend` (Next.js/React), `zion-core` (Node/TS), `pool` (Node), `adapters` (wallet/rpc shims)
- Heavy but justified dependencies: `framer-motion`, `three.js`, `web3`, `ethers`, `@react-three/fiber`, `qrcode.react`
- Dev stack: Modern, no obvious bloat

---

## 2. Redundant/Unused Files & Code
- **Backup/duplicate files:**
  - `frontend/app/hub/page.backup.tsx`, `page-original.tsx`
  - `frontend/app/wallet/page.backup.tsx`, `page-original.tsx`
  - Similar patterns in `miner`, `mining-status`, `dashboard`, `stargate`, `wallet`, `hub`, `explorer`, etc.
  - *Recommendation:* Archive or remove if not needed for rollback.
- **No test files:**
  - No `*.test.ts(x)` or `*.spec.ts(x)` in repo.
  - *Recommendation:* Add at least smoke/unit tests for wallet, mining, dashboard.

---

## 3. Frontend (Next.js/React) Issues
- **Direct window/document usage:**
  - `wallet/page.tsx` (many lines), `hub/page.tsx`, `components/ThemeShell.tsx`, etc.
  - *Risk:* SSR/Next.js hydration errors. *Fix:* Guard with `typeof window !== 'undefined'`.
- **Console.log/debug code in production:**
  - `wallet/page.tsx`, `dashboard/page.tsx`, `dashboard-v2/page.tsx`, etc.
  - *Fix:* Remove or replace with user-facing notifications.
- **Type any:**
  - `wallet/page.tsx`, `dashboard/page.tsx`, etc.
  - *Fix:* Use stricter types for state/props.
- **Heavy imports:**
  - `framer-motion`, `three.js`, `web3`, `ethers`, `@react-three/fiber` used in main pages/components.
  - *Fix:* Consider dynamic/lazy imports for 3D, AI, mining widgets.

---

## 4. Backend/Mining Scripts
- **Pool:** Minimal, only `dotenv` dependency.
- **zion-core:** Modern stack, good security (helmet, rate-limit, morgan, etc.).
- **No backend tests:**
  - *Fix:* Add smoke/API tests for main endpoints.

---

## 5. Optimization Recommendations
- Remove/archive backup/duplicate files from `frontend/app`.
- Remove all `console.log` from production code.
- Add guards for all direct `window`/`document` usage in React/Next.js.
- Replace `any` with proper types in new code.
- Add at least basic tests for wallet, mining, dashboard.
- Consider dynamic imports for heavy/rarely used components.

---

## 6. Next Steps
- [ ] Confirm which backup files can be deleted/archived
- [ ] Refactor frontend for SSR safety and type safety
- [ ] Remove debug code/logs
- [ ] Add basic test coverage
- [ ] Summarize and apply optimizations

---

*End of audit log. Ready for action phase.*

---

## 7. Aplikované změny (2025-09-25)
- Frontend (Next.js):
  - Přidány bezpečnostní hlavičky (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy) a CSP aktivní pouze v produkci.
- Wallet Adapter:
  - Přidán helmet, CORS zpřísněn na allowlist dle proměnné CORS_ORIGINS (v dev fallback na localhost),
    API klíč vyžadován v produkci (X-API-KEY), logging omezen v produkci, přidán varovný výstup, zpřísněny limity.
- Zion daemon entrypoint:
  - CORS již není `*` defaultně; nově konfigurovatelné přes ZION_RPC_CORS_ORIGINS a RPC bind přes ZION_RPC_BIND.
- Lightning stack (docker-compose.lightning.yml):
  - Pinned image tagy (bitcoin/bitcoin:25.1, lnd v0.17.5-beta), RPC uživatel/heslo externalizováno do .env, odstraněno publikování RPC/REST/gRPC portů do veřejné sítě (ponechán pouze P2P).
- bitcoin.conf:
  - Odstraněny pevné přihlašovací údaje; nahrazeno placeholders a doporučením použít .env/docker-compose proměnné; zpřísněn rpcallowip.
- .env.example:
  - Doplněny nové proměnné: ADAPTER_API_KEY, CORS_ORIGINS, ADAPTER_PORT/BIND, WALLET_RPC, SHIM_RPC, ZION_RPC_CORS_ORIGINS, ZION_RPC_BIND, BITCOIN_RPCUSER, BITCOIN_RPCPASSWORD, BITCOIN_RPCALLOWIP.
- .dockerignore:
  - Přidány archivy a další artefakty do ignoru, ignor .env, wallets/keys, VSCode.

## 8. Doporučené další kroky
- Frontend: lazy/dynamic import pro těžké komponenty (3D, QR kód), odstranění zbylých debug logů, přísnější typy.
- Testy: přidat základní smoke/API testy pro adaptery a hlavní API, snapshot testy UI.
- Síť/Firewall: zajistit, že RPC porty jsou dostupné pouze z interních sítí (Docker network, VPN, reverse proxy s auth).
- Monitorování: doplnit Prometheus/Grafana dashboard pro ziond, adapter, pool a lnd.

---

## 9. Iterace 2025-09-25 (večer)
- Submodule cleanup: zion-cryptonote je nyní vendored, odstraněny zbývající submodule kroky v `deploy-hetzner.sh` a `deploy-ssh.sh`.
- Docker Compose hardening:
  - `docker-compose.prod.yml` publikuje defaultně pouze P2P (18080); RPC/wallet porty zakázány. Přidán `env_file` a bezpečné bindy (RPC -> 127.0.0.1).
  - `docker-compose.yml` sjednocen `environment`, vypnuto defaultní mapování RPC, ponechán stratum 3333 a P2P.
- Frontend CSP: odstraněn wildcard `connect-src *` v produkci; allowlist se skládá z `NEXT_PUBLIC_APP_ORIGIN`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_SHIM_ORIGIN`, případně `NEXT_PUBLIC_CSP_CONNECT_EXTRA`.
- Dokumentace: doplněny poznámky, že instrukce o submodule jsou zastaralé (core je vendored).

Plán testů adapteru:
1) Spustit wallet-adapter s vypnutým vyžadováním API klíče v dev: `REQUIRE_API_KEY=false`.
2) Ověřit `/healthz`, `/wallet/validate` a základní průchod chyb, když wallet RPC není dostupné (503 místo 500 tam, kde je to vhodné).
3) V produkci znovu zapnout `ADAPTER_API_KEY` a prověřit CORS allowlist přes `CORS_ORIGINS`.
