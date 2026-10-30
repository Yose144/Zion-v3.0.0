# RUNBOOK — deploy, restart, diagnostika, rollback

> Kanonická operativní příručka po cutoveru 2026-10-22 (web tier na EDGE2).
> Topologie detailně: `docs/ECOSYSTEM-REBUILD-PLAN.md` §1, live stav: `AGENTS.md`.

## Hosté a přístup

| Host | Alias | IP / port | Role |
|---|---|---|---|
| EDGE2 — web ingress + app/data hub | `zion-edge2` | `207.180.217.100` :22 | nginx :80/:443, weby, ZIS, L1 node, služby |
| EDGE — chain/mining tier | `zion-v6` (IPv6), `zion-new` (IPv4 :2222) | `62.171.141.136` | pool stratum/API, node followeři, monitoring, fallback vhosty |

Klíč: `~/.ssh/zion-edge-post-wipe-2026-07-29` (oba boxy, root).

## Deploy jednotlivých povrchů

Všechny skripty: lokální build → rsync → restart/reload → smoke check (nezero exit při selhání). Host je přepíšitelný env `*_HOST`.

| Plocha | Skript | Cíl (default) | Remote | Servis |
|---|---|---|---|---|
| app.zionterranova.com | `apps/website-v2.9/deploy/deploy-web2.9.sh` | `zion-edge2` | `/opt/zion/APP&WEB/website-v2.9` | `zion-website` restart |
| zionterranova.com (intro) | `apps/IntroPage/deploy/deploy-intro.sh` | `zion-edge2` | `/var/www/zion-maintenance` | nginx reload |
| freeworld.zionterranova.com | `apps/IntroPage/freeworld/deploy/deploy-freeworld.sh` | `zion-edge2` | `/var/www/freeworld` | nginx reload |
| oasis.zionterranova.com | `apps/OasisWeb/deploy/deploy-oasis-web.sh` | `zion-edge2` | `/var/www/oasis` | nginx reload |
| pool.zionterranova.com | `apps/pool-ui/deploy/deploy-pool.sh` | `zion-edge2` | `/var/www/pool` | nginx reload (`--nginx` instaluje vhost z `infra/nginx/edge2/`) |
| auth.zionterranova.com | `apps/identity/deploy/deploy-zis.sh` | `zion-edge2` (service + nginx) | `/opt/zion/identity` | `zion-zis` restart |
| market.zionterranova.com | `apps/MarketPlace/deploy/deploy-marketplace.sh` | `zion-edge2` | `/opt/zion/APP&WEB/MarketPlace` | `zion-marketplace` restart |
| nirvana.zionterranova.com | `apps/nirvana/deploy/deploy-nirvana.sh` | **`zion-new`** (EDGE — viz pozn. níže) | `/opt/zion/APP&WEB/nirvana` | `zion-nirvana` restart |

⚠️ **Fallback:** Edge (`zion-v6`) drží staré kopie `/var/www/*` a fallback vhosty (do F6). Deploy skripty je nemirrují — fallback servíruje stav z cutoveru.

⚠️ **nirvana. = výjimka z web-tier pravidla:** nasazena na **EDGE** (`zion-new`, port 3010) — DNS `nirvana.` resolvuje přes wildcard `* → 62.171.141.136` (explicitní A záznam zatím není). OASIS data tahá přes `OASIS_API_URL=http://127.0.0.1:8094` = chain-tunnel leg → reálný OASIS backend na EDGE2. **Fáze 2 (wildcard→EDGE2):** přidat explicitní `nirvana A 207.180.217.100` + nasadit instanci na EDGE2 (`ZION_EDGE_HOST=zion-edge2 bash apps/nirvana/deploy/deploy-nirvana.sh`) + certbot vhost tam — jinak po flipu doména umře.

## Restart / status služeb

```bash
# EDGE2
ssh zion-edge2 'systemctl restart zion-website'        # app web :3000
ssh zion-edge2 'systemctl restart zion-marketplace'    # market app :3100
ssh zion-edge2 'systemctl restart zion-zis'            # auth :8096
ssh zion-edge2 'systemctl restart zion-v31-free-world' # L5 :8095
ssh zion-edge2 'systemctl restart zion-v31-oasis'      # OASIS API :8094
ssh zion-edge2 'systemctl restart zion-v31-ncl'        # NCL :8098
ssh zion-edge2 'systemctl restart zion-v31-dao'        # DAO :8456
ssh zion-edge2 'systemctl restart zion-v31-node'       # L1 node RPC :9445
ssh zion-edge2 'systemctl restart zion-v31-multichain' # WARP :8453/:8454
ssh zion-edge2 'systemctl restart zion-v31-ai-native'  # ai-native :8001
ssh zion-edge2 'nginx -t && systemctl reload nginx'

# EDGE (chain/mining — opatrně, pool je produkční)
ssh zion-v6 'systemctl restart zion-v31-pool'   # stratum 8444/8445, API :8080 (~10s reconnect minerů)
ssh zion-v6 'systemctl restart zion-v31-node2'  # follower :9446
ssh zion-v6 'systemctl restart zion-v31-node3'  # follower :9447
ssh zion-v6 'systemctl restart zion-g8-probe'   # G8 probe :9105
ssh zion-v6 'systemctl restart zion-nirvana'    # nirvana web :3010 (Next.js standalone)
```

Health: `curl https://app.zionterranova.com/api/health` (28 služeb), `https://auth.zionterranova.com/health`, `https://pool.zionterranova.com/public/v1/coins`, `https://nirvana.zionterranova.com/api/oasis/worlds` (proxy → OASIS přes chain-tunnel).

## Co dělat když…

- **404 na obrázcích/docs po deployi webu** → standalone servíruje `public/` jen z `.next/standalone/public/`. `deploy-web2.9.sh` to řeší; při ručním hot-deployi zkopírovat soubor na **obě** místa (`public/…` i `.next/standalone/public/…`).
- **Nový public soubor = 404** → standalone drží manifest ze startu → `systemctl restart zion-website`.
- **`pool.` API 5xx / `/public/v1` prázdné** → edge2→edge tunel leg `:8080` (`zion-edge-tunnel` na EDGE2): `ssh zion-edge2 'systemctl status zion-edge-tunnel'`, `ssh zion-v6 'systemctl status zion-v31-pool'`.
- **app API/data prázdné, stránky 200 ale bez čísel** → edge→edge2 `zion-chain-tunnel` na Edgi: `ssh zion-v6 'systemctl status zion-chain-tunnel'` (legs: 9445/9944/44207/8332/8453/8454/8456/8094-8098/5432/3000/3100/8001).
- **Cert renewal** → všechny veřejné domény obnovuje certbot na **EDGE2** (`certbot renew --dry-run`); `dashboard.` + `newearth` renewal je na Edgi (DNS tam ukazuje).
- **Disk full** → `df -h`, `journalctl --vacuum-size=500M`, staré `.next.bak-*` a `oasis.bak-*` v `/var/www`, `docker system df`.
- **fail2ban lockout operátora** → jail `sshd` na Edgi umí zabanovat vlastní IP při rychlých SSH auditech — `OPERATOR_IPS` v `V31/AGENTS.md`.
- **Pool DoS / stratum flood / session churn** → layered vrstvy + kernel tuning + incident checklist: [`docs/3.2/POOL-DOS-LAYERS.md`](../docs/3.2/POOL-DOS-LAYERS.md).

## Rollback

- **Web:** `.next.bak-*` konvence — před riskantním deployem `ssh zion-edge2 "cp -a /opt/zion/APP\&WEB/website-v2.9/.next /opt/zion/APP\&WEB/website-v2.9/.next.bak-$(date -u +%Y%m%dT%H%M%SZ)-<tag>"`; zpět = přejmenovat + `systemctl restart zion-website`.
- **Statické weby:** rsync `--delete` → rollback = redeploy předchozího commitu (nebo `/var/www/*.bak-*` adresáře pokud existují).
- **Celý web-tier na Edge:** DNS 9 záznamů zpět na `62.171.141.136` — fallback vhosty na Edgi žijí (stale). Okno ≈ do expirace auth certu na Edgi.
- **nginx změna:** `nginx -t` vždy před reload; zálohy confů **mimo** `sites-enabled/` (include glob `*` načte i `.bak` → duplicate `server_name`).

## Ops lessons (2026-10-24)

- **`/etc/nginx/sites-enabled/*.bak` se PARSEUJE** — `include sites-enabled/*` bere všechny soubory. Zálohy confů vždy mimo: `/etc/nginx/backups/`.
- **Edge catch-all:** `zion-edge-download.conf` = `server_name 62.171.141.136` + `_`→`return 444` (IPv4+IPv6). IP `/zion-miner/` + `/rig-output/` zůstávají; neznámé Host = connection closed.
- **Service user ≠ root:** `zion-edge-backup` běží jako `zion` — soubory root:600 (`/data/zion/g8_run.json`) mu číst nejdou. Perms kontrolovat.
- **macOS case-insensitive FS:** `PUBLIC/` a `public/` = jeden adresář — při auditu duplicit rozlišovat `git ls-files`, ne `find`.
