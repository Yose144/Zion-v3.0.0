# BASIC AUDIT — Native v2.9.5 (2026-02-03)

## Scope
- Local verification of `2.9.5/docker-compose.native-2.9.5.yml` (core + pool + redis).
- Quick hygiene check for accidental secret material tracked in git.

## Local test results (Windows + Docker Desktop)
- `docker compose config` renders successfully (no YAML/compose errors).
- Images build successfully:
  - `zion-core:2.9.5`
  - `zion-pool:2.9.5`
- Runtime checks (local):
  - Core health: `http://localhost:8444/health` ✅
  - Pool health: `http://localhost:8080/health` ✅
  - Stratum login (TCP `localhost:3333`): ✅ (returns `status: OK` and a job)

## Findings & fixes
### 1) Pool container healthcheck dependency
- **Finding:** `zion-pool` runtime image lacked `curl`, but Docker `HEALTHCHECK` uses `curl`.
- **Fix:** Install `curl` in runtime stage of `2.9.5/zion-native/Dockerfile.pool.prod`.

### 2) Wallet JSON files tracked in git (secret keys)
- **Finding:** `2.9.5/zion-wallet.json` and `2.9.5/zion-wallet-test.json` contained `secret_key_hex` and were tracked in git.
- **Fix:** Removed both files from the repo and ensured wallet dumps are ignored via root `.gitignore` (`**/tmp-wallet.json`, `**/zion-wallet*.json`).
- **Note:** If any of those keys were ever used operationally (even on TestNet), rotate/fund a new wallet address.

## Clean server deployment checklist (recommended)
1. Use the canonical port matrix:
   - Core RPC: `8444`
   - Core P2P: `8334`
   - Pool Stratum: `3333`
   - Pool API: `8080`
2. Ensure `.dockerignore` is present under `2.9.5/` to avoid shipping `target/` and other heavy artifacts into Docker build contexts.
3. Deploy “clean” without deleting state:
   - `docker compose down --remove-orphans`
   - `docker compose build`
   - `docker compose up -d`
4. Deploy “fully clean” (destroys chain/pool state volumes):
   - `docker compose down -v --remove-orphans`
   - `docker system prune -af`
   - `docker compose build --no-cache`
   - `docker compose up -d`
5. Verify:
   - `curl http://127.0.0.1:8444/health`
   - `curl http://127.0.0.1:8080/health`
   - Stratum login on `:3333`
