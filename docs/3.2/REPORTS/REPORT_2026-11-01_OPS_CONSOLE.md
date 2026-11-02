# REPORT 2026-11-01 — OPS CONSOLE: jednotná správa rigů, poolu a inference v dashboardu

**Stav:** F1 + F2.1 + F2.2 + F2.3 hotové a nasazené na produkci (EDGE).
**Kde:** `https://dashboard.zionterranova.com/dashboard` → záložka **Rigs**.
**Kód:** `ZION_OS/dashboard/{ops_console.py, app.py, dashboard.html, dashboard.js}`,
`infra/tools/vast/deploy-vastctl-edge.sh`, `ZION_OS/dashboard/deploy-dashboard.sh`.
**Plán:** [`docs/plans/OPS-CONSOLE.md`](../../plans/OPS-CONSOLE.md).

---

## 1. Zadání a co mu stálo v cestě

👤: „vytvořit jednotný systém pro správu rigů, poolů atd., všechno jen pro nás, interní…
`/vast-rigs` je zatím jen skeleton, rád bych to celé přenesl do našeho dashboardu
a tam to rozšířil, ať to máme na jednom místě.“

Při revizi se ukázalo, že **žádné jedno místo neexistovalo** — byly tři světy, které o sobě nevěděly:

| Kde | Umělo | Neumělo |
|---|---|---|
| `/vast-rigs` (Next, EDGE2) | číst `status.json`, volat `/vast-ops/*` | akce jen přes basic auth **a reverzní tunel z operátorského PC** (dnes flaky) |
| Python dashboard (EDGE, `:8766`) | 54 záložek, pool na `127.0.0.1:8080`, `fleet` = **jiný** fleet (rig agenti) | žádná vast.ai data, žádná inference, žádné custy |
| `vastctl` na PC | daemon + `serve` (offers/rent/launch/stop/exec) | běželo z uživatelského účtu; tunel na EDGE2; po vypnutí PC nic |

**🔴 Nález, který byl skrytá bomba:** `vastctl-daemon` na EDGE běžel z **uživatelem smazaného stromu**
`/root/build/warpd-zis` — `vastctl.py` ani `xmrig-vast-cpu.json` tam už neexistují. Proces žil jen
ze své paměti, takže **první restart/reboot by zabil vast.ai probe** a fleet by „zmizel“ z dashboardu
i z apexu, aniž by cokoli spadlo.

---

## 2. Architektura po zásahu

```
              ┌───────────────────── EDGE (62.171.141.136) — bez GPU ─────────────────────┐
vast.ai API ─►│ vastctl-daemon  (60 s)  ──►  /var/www/zion-maintenance/vast-rigs/status.json│
rigy (SSH)  ─►│        │                              │                                    │
              │        └── scp mirror ──► EDGE2 (apex webroot, `/vast-rigs`)               │
              │                                                                           │
              │ vastctl-serve  127.0.0.1:8088   (status, offers, rent, launch, stop,       │
              │        ▲                         exec, logs, smos, inference)               │
              │        │                                                                   │
              │ ops_console.py  /api/ops/*   ── agregace + orchestrace ──┐                 │
              │        │                                                  │                 │
              │ dashboard :8766 ──► nginx 443 (IP allowlist + Basic/ZIS)  │                 │
              └───────────────────────────────────────────────────────────┼─────────────────┘
                                                                          │
                                     GPU práce (vLLM, mining) běží na pronajatých vast.ai
```

**Rozhodnutí (👤 2026-11-01):** UI v dashboardu (tam už je auth), control plane na EDGE
(nezávislé na tom, zda má operátor zapnutý notebook).

**Klíčové pravidlo:** dashboard nikdy nemluví s vast.ai přímo — jediné rozhraní je
`http://127.0.0.1:8088` a to jen přes **whitelist** v `ops_console.py`.

**👤 upozornění „edge nemají GPU“:** EDGE i EDGE2 jsou CPU-only, takže control plane **jen
orchestruje** — veškerý výpočet (vLLM, mining) běží na pronajatých vast.ai instancích. Proto vznikl
F2.2 „auto → vast“ (níže): když není žádný GPU rig, dashboard sám pronajme nejlevnější nabídku a model
nasadí. UI to říká explicitně v panelu „Chybí GPU? Pronajmi ho na vast.ai“.

---

## 3. Co je hotové

### F1 — control plane + fleet

- `infra/tools/vast/deploy-vastctl-edge.sh`: nainstaluje `/opt/zion/vastctl/` (vastctl.py,
  vast_inference.py, agent.py, code_run.py, shell skripty, `xmrig-vast-cpu.json`) a dvě systemd
  služby; klíče v `/etc/zion/vastctl.env` (0600) — `VASTAI_API_KEY`, `VASTCTL_SMOS_KEY`,
  `VASTCTL_ENROLL_TOKEN` (SMOS tím začal fungovat i na EDGE).
- `vastctl-daemon` píše `status.json` **lokálně** a mirroruje ho **scp** na EDGE2 — apex `/vast-rigs`
  i dashboard tak mají stejná data bez tunelu z PC. Duplicitní daemon na PC vypnut
  (`systemctl --user disable vastctl-daemon`) — dva procesy přepisovaly stejný soubor.
- `ops_console.py`: `/api/ops/{health,overview,fleet,pool,logs,status}` + `POST /api/ops/action`.
  Čtení je **file-first** (status.json každých 60 s), protože `serve /api/status` umí blokovat
  desítky sekund živým SSH probeem; fallback `serve → file-stale → unavailable`, cache 10/15 s,
  každé volání s timeoutem, modul nikdy neshodí dashboard.
- UI záložka **Rigs**: KPI (rigy, $/h, $/den, hashrate per coin, pool hashrate/accept/bloky/luck),
  tabulka rigů s rozbalením (minery, pooly, shares, uptime) a akcemi **full deploy / zion / stop all /
  logs**, pool s top workery, karta Zdroje, **SimpleMining** a **Fleet agenti**, **Audit akcí**.

### F2.1 — GPU market, inference, audit

- **GPU market**: `/api/ops/market` (proxy na vastctl `/api/offers`), nabídky **od nejlevnější**,
  filtr GPU + `max $/h`, sloupce $/h, $/den, reliability, CUDA, RAM, disk, net, lokace; **Rent** za
  dvojím potvrzením (dialog + přepsání `RENT`) s varováním o okamžitém účtování.
  UI počítá sekundy (dotaz 5–15 s podle vast.ai).
- **AI inference**: `/api/ops/ai` = `ai/status` + katalog. VRAM bar per GPU, modely, util/temp/W,
  *stop worker*, katalog 18 modelů (interní Hiran = llama.cpp / nedeployovatelné, veřejné = deploy
  přes vLLM), chat s výběrem endpointu.
- **Audit**: každé `POST /api/ops/action` se zapisuje do `/opt/zion/data/dashboard-ops-audit.jsonl`
  (ts, actor, action, params, ok/http; best-effort, akci nikdy neblokuje) a `GET /api/ops/audit`.

### F2.2 — „auto → vast“ (protože EDGE nemá GPU)

`POST /api/ops/provision` spustí **background job** (vrátí `job` id, `GET /api/ops/job?id=` dává
živý log; UI polluje po 3 s) s tímto rozhodovacím stromem:

1. **Model už běží?** → nic nepronajímej (`already`).
2. **Nějaký GPU rig existuje?** → použij ten s nejvíc volné VRAM a jen nasaď
   (`inference/auto-deploy`) — **nula nových nákladů**.
3. **Nic neběží?** → najdi nejlevnější offer pod stropem (`OPS_PROVISION_MAX_DPH`, default `0.15 $/h`),
   pronajmi (`/api/rent`), čekej na `running` (max 8 min, loguje změny stavu), pak nasaď model.
4. `dry_run=1` → jen spočítá, co by to stálo (offer, $/h, $/den), nic nepronajme.

UI: panel **„Chybí GPU? Pronajmi ho na vast.ai“** (model, GPU, max $/h, *Spočítat* /
*⚡ Pronajmout a nasadit* + live log). Klik na *deploy* v katalogu, když neběží žádný rig, sám
přesměruje do tohoto panelu.

---

### F2.3 — agenti (push-model 2.B11) na EDGE

Agentní ingress dřív končil na operátorském PC (`agent → nginx EDGE2 → 127.0.0.1:8088 (sshd reverse
tunel) → PC`). Po F1 běží `vastctl serve` na EDGE, takže se jen přesměroval poslední úsek:

```
agent → nginx(EDGE2) /api/agent/ → 127.0.0.1:8088  (ssh -L leg zion-edge-tunnel) → vastctl serve (EDGE)
```

- `permitopen="127.0.0.1:8088"` pro klíč uživatele `edgetunnel` na EDGE (záloha `authorized_keys`).
- `zion-edge-tunnel.service` na EDGE2 dostal `-L 127.0.0.1:8088:127.0.0.1:8088` (záloha unitu).
- Registr agentů (`~/.local/share/vastctl-agents.json`) z PC → `/root/.local/share/vastctl-agents.json`
  na EDGE (0600) — obsahuje **per-rig secrety** (`sha256`), takže rigy nemusely re-enrollovat.
- PC-side `vastctl-serve`, `vastctl-daemon`, `vastctl-tunnel`, `vastctl-tunnel-edge2` **vypnuté a
  disablované** — na PC už neběží žádná část control plane.
- `vastctl.py`: `_agent_db()` je **mtime-aware** (dřív držel registry v paměti navěky → daemon
  reportoval stále rostoucí `age_s`, i když heartbeaty chodily).
- Dashboard: karta *Fleet agenti* (liveness < 300 s, heartbeat 30–60 s).

Ověřeno: rig `58077390` posílá `POST /api/agent/heartbeat` každých 30 s → **HTTP 200** (access log
EDGE2), `age_s` v registru **8 s**, `status.json → agents[0].age_s = 25 s`, události
`alert_offline` → `alert_recovered` při výpadku během přepojení tunelu; veřejný heartbeat bez tokenu
**403**. Reprodukovatelné: `bash infra/tools/vast/deploy-agent-ingress.sh [--retire-pc]`.

---

## 4. Ověření

**Lokálně** (mock vastctl + reálná fixtures ze status.json / stats / miners / blocks / offers / ai /
catalog):
- fleet/market/AI/audit render, žádný `pageerror`;
- `rent` → `POST /api/rent?id=…`, `auto-chat` → `POST /api/inference/auto-chat?prompt=…`;
- audit zapsán do JSONL;
- provision `dry_run` bez rigů → vybral `RTX 3060 $0.0539/h (Henan, CN) ≈ $1.29/den`, `rented=false`;
- provision s jedním rigem → „použiju existující rig … bez nového nákladu“.

**Live na EDGE** (dočasná instance `ZION_DESKTOP_EMBEDDED` na `127.0.0.1:8798` + SSH forward,
protože Basic Auth heslo je v env jen jako SHA-256):
- `overview → rigs=1 running=1 $/h=0.0544 [XMR ~3915 H/s, QTU 105.87 MH/s] | pool 3/12 workers,
  accept 99.9 %, 2835 bloků | source=file, stale=false`;
- `market → 30 offers, nejlevnější $0.0516/h`; `ai → 1 rig, 18 modelů, 1 reachable`;
- `provision dry-run` s existujícím rigem → reuse, `rented=false`;
- UI přes SSH forward vykreslilo reálná data (Fleet s SMOS kartou, GPU market, AI panel s logem),
  0 `pageerror`, 0 tracebacků v journalu, všechny tři služby `active`.

---

## 5. Provoz (runbook)

```bash
# control plane (vastctl daemon + serve) na EDGE
bash infra/tools/vast/deploy-vastctl-edge.sh

# dashboard (backup → rsync 4 souborů → restart → self-verify)
bash ZION_OS/dashboard/deploy-dashboard.sh

# zdraví
ssh zion-v6 'systemctl is-active vastctl-daemon vastctl-serve zion-edge-python-dashboard'
curl -s localhost:8088/api/status | head -c 200      # na EDGE
```

Env (`/etc/zion/vastctl.env`, 0600): `VASTAI_API_KEY`, `VASTCTL_SMOS_KEY`, `VASTCTL_ENROLL_TOKEN`.
Volitelné pro dashboard: `OPS_VASTCTL_URL`, `OPS_POOL_URL`, `OPS_STATUS_JSON`, `OPS_AUDIT_PATH`,
`OPS_PROVISION_MAX_DPH` (default `0.15`).

**Pravidla:** nikdy neběžet dva `vastctl daemon` procesy proti stejnému `status.json`;
`serve` startuje ~30 s (první probe) → health měří TCP, ne HTTP; akce jdou jen přes whitelist
a každá se audituje.

---

## 6. Meze a co zbývá

1. ~~**Agenti (2.B11)**~~ — **hotové ve F2.3** (viz výše): ingress, registr i runtime jsou na EDGE,
   na operátorském PC už neběží žádná část control plane.
2. **Alerty** — `vastctl /api/alerts/*` chce ops token; napojit na existující Alerts tab.
3. **Retire prototypu** `/vast-rigs` + `/vast-ops` proxy (až bude 2 hotové).
4. **Latence marketu** — 5–15 s (vast.ai API); zvážit server-side cache 60 s.
5. **Provision bez stropu rizik** — nyní pronajímá jen když neexistuje žádný GPU rig (silná pojistka);
   pokud bude potřeba víc rigů, dodat explicitní limit `OPS_MAX_RIGS`.
6. **SMOS `ZionRig` je offline** (samostatný problém, viz AGENTS) — dashboard to korektně zobrazuje
   včetně `⚠ hashrate` alertu.
