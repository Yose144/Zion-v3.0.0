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

## Pool HA (active-passive) — STAV: připraveno, NEaktivováno

> Rozhodnutí 👤 2026-10-31: HA stack **dokumentovat + oficiálně aktivovat** (2.S5 uzavřeno ve prospěch A4.2 active-passive).
> **Aktivace je blokovaná, dokud není doložené fencing.** Detail: [`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`](../NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md) §W2.

### Co existuje (EDGE2)

| Unit | Role | Stav |
|---|---|---|
| `zion-pool-standby.service` | replika poolu (`/opt/zion/bin/zion-pool-standby`), nepublikuje stratum | **inactive** (`ConditionPathExists=/opt/zion/data/v31-standby/ACTIVATED` — bez markeru se `start` tiše skipne) |
| `zion-pool-ha-watchdog.timer` | 30 s — měří health primary a **jen alertuje**; **NIKDY nepromotuje** | active |
| `zion-pool-standby-sync.timer` | 60 s — `pool-pplns.json` + payout ledger + `store.db` z EDGE (pull) | active |
| `zion-pool-standby-dbsync.timer` | 60 min — plná DB replikace (pull) | active |

**RPO (měřeno 2026-10-31, `scripts/ops/dr-parity-check.sh --only data`):**
- PPLNS state + payout ledger: **≤ 60 s** (naměřeno ~47 s) — odpovídá kadence `*-sync.timer`.
- `pool-store.db`: **≤ 60 min** (naměřeno ~3343 s) — odpovídá `*-dbsync.timer`. Mezi syncy je `store.db` na standby **zastaralá až o hodinu**; PPLNS + ledger jsou ale čerstvé, takže promote neztratí payout idempotency guards, jen historii bloků.

**RTO** = čas operátora. V kódu **neexistuje žádný `armed`/auto-promote režim** — watchdog je alert-only (hlavička skriptu: *„never starts the standby … split-brain"*). Auto-promote je jen backlog (`G*` v DR runbooku), ne funkce.

> **Kanonický postup aktivace / promote / rollback / failback:** [`docs/3.2/ops/DR-BRINGUP-RUNBOOK.md`](../docs/3.2/ops/DR-BRINGUP-RUNBOOK.md) (W1.3). Obsahuje 5 blokujících defektů B1–B5 a paritní matici; `scripts/ops/dr-parity-check.sh` je jediný povolený gate.

### ⚠️ Proč to nesmí být `armed` bez fencingu

Promote **při zpomalení** místo **při smrti** primáru znamená, že obě instance chvíli píšou ledger → **dvojí výplata minerům**. To je nejdražší možná chyba v celém systému; payout historie se needituje zpětně.

**Podmínky aktivace (všechny tři):**

1. Watchdog rozlišuje **prokázaný fail** (proces/port/health dead po N po sobě jdoucích pokusech) od **degradace** (pomalá odpověď) — degradace nikdy nespouští promote.
2. Promote obsahuje **explicitní stop primary** (systemd stop na EDGE + verifikace, že primary opravdu neběží), ne jen „převzít roli".
3. Staged observační období ≥ 1 týden bez falešného poplachu → teprve pak 👤 rozhodnutí.

> ⚠️ **`log-only` ani `armed` mód v kódu neexistují** — jsou to jen názvy cílových stavů v tomto runbooku, ne přepínače. Dnešní watchdog je *alert-only by design* a žádná konfigurační hodnota ho nepřepne na promote. Zavádění auto-promote = **nový kód** (backlog `G*` v DR runbooku), ne „flip env proměnné".

### Manuální promote

```bash
# 1. STOP primary FIRST — jinak dvojí výplata
ssh <edge> "systemctl stop zion-v31-pool && systemctl is-active zion-v31-pool"   # musí vrátit inactive
# 2. ověř, že primary opravdu neběží (ne jen 'deactivating')
ssh <edge> "pgrep -af zion-pool || echo NO_PROCESS"
# 3. promote standby — NEJDŘÍV ale zakaž watchdogu vzkřísit primary (B4)
ssh <edge> "systemctl stop zion-v31-watchdog.timer"            # jinak do 60 s restartuje pool
ssh zion-edge2 "touch /opt/zion/data/v31-standby/ACTIVATED && chmod 600 /opt/zion/data/v31-standby/ACTIVATED"
ssh zion-edge2 "systemctl start zion-pool-standby && systemctl is-active zion-pool-standby"
# 4. ověř stratum + API + payout sweep (standby API je na :8090, ne :8080 — B5)
curl -s http://127.0.0.1:8090/stats | head -c 200
# 5. zapiš do incident logu: čas, důvod, kdo, RPO (poslední sync timestamp)
```

**Rollback (zpět na EDGE):** stop standby + `rm /opt/zion/data/v31-standby/ACTIVATED` → ověř `NO_PROCESS` → start primary → `systemctl start zion-v31-watchdog.timer` → ověř `/stats` a payout sweep. Nikdy nespouštěj obě instance současně, ani na „jen pár sekund". Kompletní sekvence včetně nginx/monitoringu zpět na `:8080` je v DR runbooku §8 (Rollback / failback).

### Failback

Watchdog **neumí** vrátit roli primáru zpět automaticky — failback je vždy 👤 manuální okno (stejná sekvence jako promote, jen opačně). Automatický failback = další příležitost na split-brain.

---

## DNS a veřejné povrchy (stav 2026-10-31)

| Hostname | Cíl | HTTP | Poznámka |
|---|---|---|---|
| `zionterranova.com`, `www.` | EDGE2 | 200 | static export `/var/www/zion-maintenance` |
| `app.` | EDGE2 | 200 | `zion-website` :3000 — **hlavní pracovní povrch** |
| `market.` | EDGE2 | 200 | `zion-marketplace` :3100 |
| `pool.` | EDGE2 | 200 | ingress → `zion-edge-tunnel` → EDGE :8080 |
| `oasis.` | EDGE2 | 200 | `/var/www/oasis` |
| `auth.` | EDGE2 | 200 | `zion-zis` :8096 — **cert expiruje 24. 1. 2027** |
| `freeworld.` | EDGE2 | 200 | `zion-v31-free-world` :8095 |
| `rpc.` | EDGE2 | 200 | veřejné RPC |
| `explorer.` | EDGE | 301 | web-tier cutover není úplný |
| `nirvana.` | EDGE | 200 | `zion-nirvana` :3010 (`User=zion`, `/opt/zion/APP&WEB/nirvana`) |
| `dashboard.` | EDGE | 401 | basic auth — **živé, ne mrtvé** |
| `api.` | **EDGE** (DNS) / EDGE2 (služba) | **404** | ⚠️ **není mrtvé** — `zion-hiran-gateway` běží na EDGE2 `127.0.0.1:8007` (`/health` 200, neauth chat `401`). Vhost `infra/nginx/edge2/api.zionterranova.com.conf` je v repu a staged na EDGE2 (**NO_CERT**). Chybí **DNS `api` A → `207.180.217.100`** + `certbot` (rozhodnutí 👤 31. 10.: publikovat) |
| `updates.` | EDGE (přes **wildcard `*`**) | 404 | **mrtvé.** ⚠️ V zóně **není explicitní `A` záznam** — resolvuje jen díky wildcardu `* → 62.171.141.136`, takže „smazat A záznam" **nelze** (smazalo by celý wildcard = grafana/dashboard/testnet/… ). Správná akce: buď nechat 404 (dnes), nebo přidat explicitní záznam až při obnovení `update-server/` (dnes jen v `archive/`) |
| `dex.` | **EDGE** (DNS) / EDGE2 (služba) | **404** | ⚠️ **není mrtvé** — warpd `:8454` (`/v1/swap/pools` 200). `/prices/:token/history` **už implementováno + nasazeno** (`V31/L2/multichain`, `768fc23dc`). Vhost staged (**NO_CERT**). Chybí **DNS: nový explicitní `dex` A → `207.180.217.100`** + `certbot` (rozhodnutí 👤 31. 10.: doplnit + publikovat) |

**Cert expiry (EDGE2, měřeno 2026-10-31):** `auth.` **24. 1. 2027** · `pool.` **16. 1. 2027** · `rpc.` **4. 1. 2027** · `market.` **29. 12. 2026** · `freeworld.` **28. 12. 2026** · `app.` **27. 12. 2026** · `oasis.` **27. 12. 2026** · `api.`/`dex.` **NO_CERT**.
Nejbližší expirace tedy **27. 12. 2026** (`app.` + `oasis.`) — **není** to kritická cesta v3.3 (W1 končí 24. 11.); `auth.` není blokátor, jak se dřív tvrdilo.

**Pozor na past:** `api.` a `dex.` **nejsou** mrtvé povrchy — DNS vede na EDGE, ale služby žijí na EDGE2. Diagnóza `curl` = `000` + `ssl_verify_result=1` znamená **SAN mismatch**, ne „nic tam neběží". Vždy nejdřív `ss -tlnp` na EDGE2, pak teprve suď.

**Pravidlo:** veřejný povrch je buď **200/301**, nebo **DNS záznam neexistuje**. 404 na vlastním hostname = nedodělek, ne „placeholder".

---

## Rollback

- **Web:** `.next.bak-*` konvence — před riskantním deployem `ssh zion-edge2 "cp -a /opt/zion/APP\&WEB/website-v2.9/.next /opt/zion/APP\&WEB/website-v2.9/.next.bak-$(date -u +%Y%m%dT%H%M%SZ)-<tag>"`; zpět = přejmenovat + `systemctl restart zion-website`.
- **Statické weby:** rsync `--delete` → rollback = redeploy předchozího commitu (nebo `/var/www/*.bak-*` adresáře pokud existují).
- **Celý web-tier na Edge:** DNS 9 záznamů zpět na `62.171.141.136` — fallback vhosty na Edgi žijí (stale). Rollback okno je otevřené **do 25. 1. 2027** (expirace `auth.` certu na Edgi); `dashboard.` a `explorer.` tam mají certy platné do 5. 10. 2026 / 28. 1. 2027 — `dashboard.` dnes servíruje jiný (platný) cert než ten v `live/`, `curl` hlásí `verify=0`.
- **nginx změna:** `nginx -t` vždy před reload; zálohy confů **mimo** `sites-enabled/` (include glob `*` načte i `.bak` → duplicate `server_name`).

## Ops lessons (2026-10-24)

- **`/etc/nginx/sites-enabled/*.bak` se PARSEUJE** — `include sites-enabled/*` bere všechny soubory. Zálohy confů vždy mimo: `/etc/nginx/backups/`.
- **Edge catch-all:** `zion-edge-download.conf` = `server_name 62.171.141.136` + `_`→`return 444` (IPv4+IPv6). IP `/zion-miner/` + `/rig-output/` zůstávají; neznámé Host = connection closed.
- **Service user ≠ root:** `zion-edge-backup` běží jako `zion` — soubory root:600 (`/data/zion/g8_run.json`) mu číst nejdou. Perms kontrolovat.
- **macOS case-insensitive FS:** `PUBLIC/` a `public/` = jeden adresář — při auditu duplicit rozlišovat `git ls-files`, ne `find`.
