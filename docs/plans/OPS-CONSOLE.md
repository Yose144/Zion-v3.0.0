# OPS CONSOLE — jednotný interní systém pro rigy, pool a fleet

> Stav: **F1 hotová a nasazená** (2026-11-01). Cílové místo = `dashboard.zionterranova.com/dashboard`,
> záložka **Rigs**. `/vast-rigs` zůstává jako prototyp (next-generation UI, nebude se rozšiřovat).

## 1. Proč to vzniklo

Před F1 byly tři oddělené světy a ani jeden nevěděl o ostatních:

| Kde | Co umělo | Co neumělo |
|---|---|---|
| `/vast-rigs` (Next, EDGE2) | číst `status.json`, volat `/vast-ops/*` | akce jen přes basic auth + reverzní tunel z operátorského PC (často dole) |
| Python dashboard (EDGE, `:8766`) | 54 záložek, pool přímo na `127.0.0.1:8080`, `fleet` = rig agenti | žádná vast.ai data, žádné GPU/inference, žádné custy |
| `vastctl` na PC | daemon + `serve` (offers/rent/launch/stop/exec) | běželo z uživatelského účtu, tunel na EDGE2, po rebootu PC nic |

Data byla na EDGE, akce na PC, UI na EDGE2. „Jedno místo“ neexistovalo.

## 2. Architektura po F1

```
                ┌──────────────────────── EDGE (62.171.141.136) ───────────────────────┐
vast.ai API ──► │ vastctl-daemon ──► /var/www/zion-maintenance/vast-rigs/status.json  │
rigy (SSH)  ──► │      │                     │                                        │
                │      │                     └──► scp mirror → EDGE2 (apex webroot)   │
                │      ▼                                                              │
                │ vastctl-serve 127.0.0.1:8088  (status, offers, rent, launch, stop,   │
                │        ▲                       exec, logs, smos, inference)          │
                │        │                                                            │
                │ ops_console.py  ──►  /api/ops/{health,overview,fleet,pool,logs,action}
                │        │                       (agregace: status.json + pool :8080)  │
                │        ▼                                                            │
                │ dashboard :8766  →  nginx 443 (IP allowlist + Basic Auth / ZIS)      │
                └──────────────────────────────────────────────────────────────────────┘
```

**Rozhodnutí (👤 2026-11-01):**
- UI žije v dashboardu (tam už je auth: IP allowlist + `DASHBOARD_USERS`/ZIS).
- Control plane (akce) žije na EDGE jako `vastctl-serve` — nezávislé na tom, zda má operátor zapnuté PC.

**Klíčové pravidlo:** dashboard **nikdy nemluví s vast.ai přímo**. Jediné rozhraní je
`http://127.0.0.1:8088`, a to jen přes whitelist v `ops_console.py` (`_ALLOWED_ACTION`) — dashboard
tedy nemůže být zneužit jako obecný proxy.

## 3. Datový kontrakt `/api/ops/*`

| Route | Vrací |
|---|---|
| `GET /api/ops/health` | liveness jednotlivých zdrojů (TCP na `:8088`, HTTP na `:8080`, stáří `status.json`) |
| `GET /api/ops/overview` | sloučený snapshot: `fleet{rigs,running,dph_h,dph_day,coins[],shares}` + `pool{sessions,workers,hashrate,accept_pct,blocks,luck,top_miners[]}` + `rigs[]`, `smos`, `agents`, `fresh/errors`, `source`, `stale` |
| `GET /api/ops/fleet` | jen rigy + SMOS + agenti |
| `GET /api/ops/pool` | pool `/stats` + top minery + posledních 10 bloků |
| `GET /api/ops/status` | surový vastctl snapshot (debug) |
| `GET /api/ops/logs?id=&src=` | tail logů z rigu (proxy na vastctl, 25 s timeout) |
| `POST /api/ops/action` | `{"action":"launch\|stop\|rent\|exec\|smos/action\|inference/…","params":{…}}` → proxy na vastctl |

Čtení je **file-first**: `status.json` píše daemon každých 60 s, takže dashboard je rychlý a nezávislý
na tom, jestli `serve` zrovna dělá živý SSH probe (`/api/status` umí blokovat desítky sekund).
Soubor starší než 180 s → fallback na `serve`, pak `file-stale`, pak `unavailable`.

Cache: snapshot 10 s, pool 15 s. Každé volání má timeout; modul nikdy neshodí dashboard
(`handle()` chytá výjimky a vrací JSON).

## 4. Co je hotové (F1)

- `vastctl` na EDGE jako dvě systemd služby (`vastctl-daemon`, `vastctl-serve`) — do té doby běžel
  daemon z **uživatelem smazaného stromu** `/root/build/warpd-zis`, takže každý restart = mrtvý probe.
  Deploy: `bash infra/tools/vast/deploy-vastctl-edge.sh`.
- Klíče v `/etc/zion/vastctl.env` (0600): `VASTAI_API_KEY`, `VASTCTL_SMOS_KEY`, `VASTCTL_ENROLL_TOKEN`.
- Daemon píše `status.json` lokálně **a** mirroruje na EDGE2 (scp) → apex `/vast-rigs` i dashboard mají
  stejná data bez tunelu z PC.
- Duplikátní daemon na operátorském PC **vypnutý** (`systemctl --user disable vastctl-daemon`) — dřív
  dva procesy přepisovaly stejný soubor.
- `ops_console.py` + záložka **Rigs & Fleet** v dashboardu: KPI (rigy, $/h, $/den, hashrate per coin,
  pool hashrate/accept/bloky), tabulka rigů s rozbalením (minery, pooly, shares, uptime, akce
  full deploy / zion / stop all / logs), pool s top workery, karta Zdroje.
- Deploy: `bash ZION_OS/dashboard/deploy-dashboard.sh` (backup → rsync 4 souborů → restart →
  ověření `/api/ops/*` na dočasné instanci s auth bypassem).

## 5. Co chybí (F2+)

1. **GPU market + rent** v dashboardu (`/api/offers`, `/api/rent`) — dnes jen v prototypu.
2. **AI inference** panely (deploy/chat/catalog) — tamtéž.
3. **Agenti (2.B11)**: enrollment dnes končí na `https://zionterranova.com/api/agent/` → EDGE2:8088 →
   tunel na PC. Po přesunu na EDGE je potřeba buď tunel EDGE2→EDGE:8088 (permitopen), nebo přepsat
   agent URL na dashboard. Registr agentů (`~/.local/share/vastctl-agents.json`) je zatím na PC.
4. **Akce s následky** (rent = reálné peníze, stop = výpadek) chtějí potvrzení + audit log v dashboardu.
5. **Alerty**: `vastctl serve` má `/api/alerts/*`; napojit na existující Alerts tab.
6. **Retire prototypu** `/vast-rigs` — až bude F2 hotová, smazat (a `/vast-ops` proxy + PC tunely).
7. **SMOS**: `ZionRig` je offline (samostatný problém, viz AGENTS).

## 6. Provozní pravidla

- Nikdy neběžet dva `vastctl daemon` procesy proti stejnému `status.json`.
- `serve` startuje ~30 s (první probe) — `/api/ops/health` proto měří TCP, ne HTTP.
- Dashboard běží jako `zion`, `ProtectSystem=strict`; `status.json` čte z `/var/www/...` (read-only je OK).
- Deploy dashboardu = restart `zion-edge-python-dashboard.service` (2 s výpadek, `Restart=always`).
