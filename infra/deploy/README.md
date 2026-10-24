# infra/deploy — jednotné deploy rozhraní

> Kanonický pattern (vzor: `apps/website-v2.9/deploy/deploy-web2.9.sh`):
>
> ```
> build → sync → restart/reload → smoke check (exit≠0 při failu)
> ```
>
> Skripty zůstávají u appek (`apps/<app>/deploy/deploy-*.sh`) — cestu k buildi
> a artefaktům znají. Toto je jen kontrakt + registry.

## Kontrakt

1. **Host přes env** — `*_HOST`/`ZION_EDGE_HOST` s defaultem `zion-edge2` (web tier po cutoveru 2026-10-22). Nikdy hardcoded IP.
2. **`set -euo pipefail`**, SSH `BatchMode`-friendly (`-o StrictHostKeyChecking=accept-new`, žádné `UserKnownHostsFile=/dev/null`).
3. **Sync:** `rsync -avz --delete` na webroot/app dir; vždy `--exclude` pro runtime soubory co generuje server (např. `vast-rigs/status.json`).
4. **nginx:** vhost instalace jen opt-in flagem; zdroj = `infra/nginx/edge2/<domain>.conf`; cíl `sites-available/` + symlink do `sites-enabled/`; `nginx -t` před reload. Zálohy mimo `sites-enabled/`.
5. **Restart:** `systemctl daemon-reload && systemctl restart <service>` (služby) / `nginx -s reload` (statické weby).
6. **Smoke check:** min. homepage 200 + 1 reprezentativní asset + 1 API/health endpoint; exit 1 při failu.

## Registry

| Skript | Plocha | Default host |
|---|---|---|
| `apps/website-v2.9/deploy/deploy-web2.9.sh` | app.zionterranova.com | `zion-edge2` |
| `apps/IntroPage/deploy/deploy-intro.sh` | zionterranova.com | `zion-edge2` (`ZION_EDGE_HOST`) |
| `apps/IntroPage/freeworld/deploy/deploy-freeworld.sh` | freeworld.zionterranova.com | `zion-edge2` (`ZION_EDGE_HOST`) |
| `apps/OasisWeb/deploy/deploy-oasis-web.sh` | oasis.zionterranova.com | `zion-edge2` (`ZION_EDGE_HOST`) |
| `apps/pool-ui/deploy/deploy-pool.sh` | pool.zionterranova.com | `zion-edge2` (`POOL_DEPLOY_HOST`) |
| `apps/identity/deploy/deploy-zis.sh` | auth.zionterranova.com | `zion-edge2` (`ZIS_DEPLOY_HOST` + `ZIS_NGINX_HOST`) |
| `apps/MarketPlace/deploy/deploy-marketplace.sh` | market.zionterranova.com | `zion-edge2` (`ZION_EDGE_HOST`) |

Operativní runbook: [`../RUNBOOK.md`](../RUNBOOK.md).
