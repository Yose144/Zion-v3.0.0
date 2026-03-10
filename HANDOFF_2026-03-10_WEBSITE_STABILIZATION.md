# Handoff - Website Stabilization (2026-03-10)

## Scope

Tento handoff shrnuje praci na stabilizaci `APP&WEB/website-v2.9` po velkem pullu a API/topology zmenach.

Cil byl:
- opravit realne rozbite website API kontrakty,
- opravit explorer/pool UX breaky,
- commitnout a pushnout fixy,
- pripravit deploy-ready stav.

## Commits pushed

1. `1ba1650a9185c0d7d6c6f37f9ae1bc218f8f6425`
- message: `fix(website): restore broken API routes and explorer flows`
- obsah: website/API stabilizace

2. `eb482bf`
- message: `fix(deploy): align website compose with monorepo path`
- obsah: deploy compose build-context fix

Aktualni branch: `main` (origin/main synced to `eb482bf`).

## What was fixed

### 1) Missing DAO route surface on website

Problem:
- frontend DAO client ocekaval `/api/dao/*`, ale route na website chybela.

Fix:
- pridana route proxy:
  - `APP&WEB/website-v2.9/src/app/api/dao/[...path]/route.ts`
- pridana canonical DAO URL konstanta:
  - `APP&WEB/website-v2.9/src/lib/site.ts`
- DAO client prepnuty na internal proxy default:
  - `APP&WEB/website-v2.9/src/lib/dao-api.ts`

### 2) Revenue admin page volala neexistujici endpoint

Problem:
- `admin/revenue-v3` volal `${REVENUE_API_BASE}/v2.9/revenue/config`, ktere nebylo dostupne.

Fix:
- frontend prepnuty na interni endpoint:
  - `APP&WEB/website-v2.9/src/app/admin/revenue-v3/page.tsx`
- pridana file-backed API route:
  - `APP&WEB/website-v2.9/src/app/api/v2.9/revenue/config/route.ts`
- route cte/savuje aktivni config s fallback kandidaty:
  - `config/ch3_zion_only_settings.json`
  - `config/ch3_revenue_settings.json`

### 3) TX detail lookup failoval na format hash

Problem:
- lookup mohl failnout na hash s `0x` prefixem nebo whitespace.

Fix:
- normalizace hash inputu:
  - `APP&WEB/website-v2.9/src/app/api/blockchain/transactions/route.ts`

### 4) Explorer transactions page potichu prazdna

Problem:
- UI ocekaval pole, ale API vracelo objekt (`transactions`/`items`).

Fix:
- robustni parsing payloadu + mapovani `tx_hash/tx_id`:
  - `APP&WEB/website-v2.9/src/app/explorer/transactions/TransactionsPageClient.tsx`

### 5) Chybne explorer odkazy

Fixy:
- payout TX link v miner dashboardu opraven na TX detail:
  - `APP&WEB/website-v2.9/src/components/MinerDashboard.tsx`
- `RecentBlocks` link opraven z neexistujiciho `/blocks` na `/explorer/blocks`:
  - `APP&WEB/website-v2.9/src/components/RecentBlocks.tsx`

### 6) Deploy blocker v compose (critical)

Problem:
- website compose build context nesedel s monorepo strukturou a runbook deploy path.

Fix:
- `docker/docker-compose.website.yml`
  - build context opraven na `../APP&WEB/website-v2.9`

## Validation status

- Editor diagnostics: clean on touched website files.
- Full `npm run lint` v tomto workspace stale neni spolehlive pouzitelny kvuli lokalnimu module-resolution issue (eslint/next lookup).
- Logicka + contract validace probehla ctenim route/client kodu a diagnostics.

## Deploy status

Code je pushnuty, deploy z tohoto VS Code agent terminalu nebyl dokonceny.

### Blocker encountered

- OpenSSH v tomto agent terminalu pada pri `ssh/scp` na:
  - `getsockname failed: Not a socket`
  - `Read from remote host ... Unknown error`
- Sitova dostupnost serveru je OK (`Test-NetConnection 91.98.122.165 -Port 22` -> `TcpTestSucceeded: True`).
- Tj. blocker je lokalni execution vrstva terminalu, ne repository ani target host port.

## Server deploy commands (runbook aligned)

Pouzit normalni lokalni shell (mimo tento agent terminal), pak:

```powershell
scp -i "$HOME/.ssh/zion_hetzner_key" -r "C:\Users\anaha\Desktop\ZION\2.9.6-main\APP&WEB\website-v2.9" root@91.98.122.165:/root/zion-web-deploy/
scp -i "$HOME/.ssh/zion_hetzner_key" "C:\Users\anaha\Desktop\ZION\2.9.6-main\docker\docker-compose.website.yml" root@91.98.122.165:/root/zion-web-deploy/docker/
ssh -i "$HOME/.ssh/zion_hetzner_key" root@91.98.122.165
```

Na serveru:

```bash
cd /root/zion-web-deploy
docker network create zion-net 2>/dev/null || true
docker compose -f docker/docker-compose.website.yml build website
docker rm -f zion-website || true
docker compose -f docker/docker-compose.website.yml up -d website
docker ps --filter name=zion-website
```

## Suggested immediate post-deploy checks

1. `curl -sS http://127.0.0.1:3000/api/health | jq .status`
2. Open website pages:
- `/explorer/transactions`
- `/explorer/tx?hash=<valid_tx_hash>`
- `/admin/revenue-v3`
- `/dao`
3. Verify API contracts:
- `/api/dao/health` (through website proxy)
- `/api/v2.9/revenue/config`
- `/api/blockchain/transactions?limit=5`

## Notes

- Unrelated desktop-agent changes are still present in working tree and were intentionally not included in website commits.
- Repo memory note added:
  - `/memories/repo/website-deploy-compose-path.md`
  - documents compose build context requirement for this monorepo.
