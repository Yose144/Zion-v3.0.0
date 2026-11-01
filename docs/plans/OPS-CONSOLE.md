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
| `GET /api/ops/market?gpu=&max_dph=&limit=` | nabídky GPU z vast.ai, seřazené od nejlevnější |
| `GET /api/ops/ai` | stav inference per rig + katalog modelů |
| `GET /api/ops/audit?limit=` | poslední akce operátora (JSONL) |
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

1. ~~**GPU market + rent** v dashboardu~~ → **hotové (F2.1)**: `Rigs → GPU market`,
   offers z vast.ai od nejlevnější, filtr `max $/h`, rent za dvojím potvrzením + audit.
2. ~~**AI inference** panely~~ → **hotové (F2.1)**: `Rigs → AI inference` (stav rigů/VRAM/modelů,
   katalog s deploy, chat proti libovolnému naběhnutému endpointu).
3. ~~**Agenti (2.B11)**~~ → **hotové (F2.3)**: ingress `/api/agent/*` jde
   `agent → nginx(EDGE2) → 127.0.0.1:8088 (ssh -L leg zion-edge-tunnel) → vastctl serve na EDGE`.
   `permitopen 127.0.0.1:8088` pro `edgetunnel` + registr agentů (`/root/.local/share/vastctl-agents.json`)
   nakopírovaný na EDGE; PC-side `vastctl-serve`/`daemon`/tunely vypnuté a disablované.
   Deploy/verify: `bash infra/tools/vast/deploy-agent-ingress.sh [--retire-pc]`.
4. ~~Akce s následky chtějí potvrzení + audit~~ → **hotové (F2.1)**: `POST /api/ops/action` zapisuje
   každou akci do `/opt/zion/data/dashboard-ops-audit.jsonl` (best-effort, nikdy neblokuje) a
   záložka Fleet má kartu **Audit akcí**.
5. **Alerty**: `vastctl serve` má `/api/alerts/*`; napojit na existující Alerts tab.
6. **Retire prototypu** `/vast-rigs` — až bude F2 hotová, smazat (a `/vast-ops` proxy + PC tunely).
7. **SMOS**: `ZionRig` je offline (samostatný problém, viz AGENTS).
8. **Latence marketu**: dotaz na offers trvá 5–15 s (vast.ai API); UI proto počítá sekundy a
   `/api/ops/market` má 40s timeout. Zvážit server-side cache 60 s, aby opakované hledání bylo zdarma.
9. ~~**EDGE nemá GPU → inference musí na vast**~~ → **hotové (F2.2)**: `POST /api/ops/provision`
   (background job + `GET /api/ops/job?id=`) rozhodne: model už běží → nic; existuje GPU rig →
   nasaď tam (nula nákladů); nic neběží → pronajmi nejlevnější offer pod `OPS_PROVISION_MAX_DPH`
   (default 0.15 $/h), počkej na boot (max 8 min) a nasaď. `dry_run=1` jen spočítá cenu.
   UI panel **„Chybí GPU? Pronajmi ho na vast.ai“** + live log; *deploy* bez rigu přesměruje tam.

## 5b. F2.1 — co přibylo v UI

`Rigs` má tři pod-záložky (jedno místo, žádná nová top-level položka v menu):

| Pod-záložka | Obsah |
|---|---|
| **Fleet** | KPI, tabulka rigů (rozbalení = minery + akce), pool top workery, Zdrojе, **Audit akcí** |
| **GPU market** | filtr GPU + max $/h, nabídky od nejlevnější ($/h, $/den, reliability, CUDA, RAM, disk, net), **Rent** = confirm + přepsání `RENT` |
| **AI inference** | stav inference per rig (VRAM bar, modely, util/temp/W), katalog modelů (internal = llama.cpp, ostatní deploy), chat s výběrem endpointu |

Akce jdou výhradně přes `POST /api/ops/action` (whitelist) — `rent`, `launch`, `stop`, `exec`,
`inference/*`, `smos/*`. Každá se zapíše do auditu (kdo/odkud, parametry, ok/http).

## 6. Provozní pravidla

- Nikdy neběžet dva `vastctl daemon` procesy proti stejnému `status.json`.
- `serve` startuje ~30 s (první probe) — `/api/ops/health` proto měří TCP, ne HTTP.
- Dashboard běží jako `zion`, `ProtectSystem=strict`; `status.json` čte z `/var/www/...` (read-only je OK).
- Deploy dashboardu = restart `zion-edge-python-dashboard.service` (2 s výpadek, `Restart=always`).
- **Agenti:** rig posílá heartbeat každých 30–60 s na `https://zionterranova.com/api/agent/heartbeat`
  s `Bearer rig_id:secret`; cesta končí na vastctl serve na EDGE (nginx EDGE2 → ssh -L → EDGE).
  Registr se čte s mtime-aware cache, takže ho vidí `serve` i `daemon` bez restartu.
  Bez tokenu endpoint failuje (403). Migrace/verify: `infra/tools/vast/deploy-agent-ingress.sh`.
