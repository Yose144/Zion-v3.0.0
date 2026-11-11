# REPORT 2026-11-11 — Autonomní fronta: uzávěrka (ops/monitoring)

> **Datum:** 2026-11-11 · **Režim:** autonomní, kód/testy/dokumentace (bez deploye, restartu, money-path)
> **Zadání 👤:** „udelej vse a reportni at uz mame autonomni frontu hotovou."
> **Výsledek:** **ops/monitoring autonomní fronta z RCA je vyčerpaná.** Zbytek je buď 👤/🔀 (deploy, peníze, klíče, právo), nebo více­denní feature backlog (L3, OASIS, QTC, i18n) — viz §6.
> **Commity dne:** `3b182b5f0` (truth-sync), `7ca05aabc` (RCA), `2a1d4bc9f` (souhrn), `6719fb115` (probe hardening), `a421edb88` (alert + listener/drop-in), `+ tento` (watchdog + runbook + closeout).

---

## 1. Co je dnes uzavřené

| # | Deliverable | Důkaz |
|---|---|---|
| 1 | Truth-sync 6 plánů (G8 #7, proto 34, QTC OFF, hotové 5.B2/7.B4/8.B7/8.B9/9.B5) | `3b182b5f0`, 0 rozbitých odkazů |
| 2 | G8 `chain_live` RCA — starý tip primary, ne chain outage | `7ca05aabc`, 5 incidentů + důkazy z Promethea/journalu |
| 3 | Probe hardening — failed probe neleakuje stale tip, `success` gate, future tolerance 120 s, per-node metriky | `6719fb115`, 21/21 testů |
| 4 | Alert `G8PrimaryTipStale` + promtool firing/quiet testy | `a421edb88`, promtool 3.16.0 SUCCESS (6 rules) |
| 5 | Listener inventura + repo drop-in `zz-primary` (produkce 0.0.0.0:9445 + peer) | `a421edb88`, README + komentář v base unitu |
| 6 | Watchdog stale-tip helper (log-only, opt-in restart) + testy | tento commit, 8/8 testů |
| 7 | Stratum blip 14:27Z RCA (pool restart watchdogem) | tento commit, §3 |
| 8 | Alert runbook: 37 alertů, nový řádek + watchdog poznámka | tento commit |

## 2. Watchdog stale-tip check

RCA ukázala, že watchdog restartuje jen při „RPC not reachable"; primary, který **odpovídá a má 1–4 h starý tip**, zůstal bez zásahu.

- Nový `scripts/ops/node-tip-age.sh` čte `zion_g8_node_tip_age_seconds{service="node_primary"}` z lokálního probe (`127.0.0.1:9105/metrics`, nebo `--metrics-file` pro testy).
- Semantika je konzervativní: **chybějící metrika / `-1` / negativní čas = no-op** (`exit 0`, `unknown`) — starý probe bez metriky nesmí vyvolat falešný alarm.
- Integrace v `scripts/watchdog.sh` → `check_health` (mode `edge2`): `check_primary_tip_fresh` **jen loguje** `WARN: node_primary tip stale (age=…)`.
- Restart je opt-in `ZION_WATCHDOG_STALE_RESTART=1` (každý restart stojí jeden 60s G8 vzorek), threshold `ZION_WATCHDOG_TIP_MAX_AGE=900`.
- Testy: `bash scripts/ops/test_node_tip_age.sh` → **8/8** (fresh, stale, exact 900, 901, unknown, missing series, unreadable file, future skew).

## 3. Stratum blip 11. 11. 14:27Z — uzavřeno

Sekvence z journalu EDGE1:

1. `14:27:14Z` a `14:27:42Z` — dva mineři spadli na vlastní watchdog: `no share accepted/rejected for 300s … Exiting to force restart`.
2. Následný reconnect storm přetížil accept queue → **G8 probe i ops watchdog** viděly `pool TCP 127.0.0.1:8444 not reachable` (G8 `pool_stratum=0` ve třech scrapích 14:27:15–14:27:45).
3. `14:27:43Z` — `zion-v31-watchdog` (mode `v31`) zalogoval `RESTART: zion-v31-pool — pool TCP 127.0.0.1:8444 not reachable` a poslal SIGTERM.
4. Pool drained (`stratum: drain — listener stopped accepting`), nový proces nastartoval `14:27:50Z`, listenery `8444/8445/8446` a API `:8080` znovu nahoře; první accepted share `14:28:01Z`.

**Závěr:** 6. G8 incident nebyl chain ani síť — byl to **důsledek restartu poolu**, který vyvolal ops watchdog poté, co stratum přestal přijímat spojení během reconnect stormu. `pool_http` zůstal `1`. Doporučení: zvážit méně agresivní miner `no-share` watchdog / větší accept backlog; **neměnit během run #7**.

## 4. Runbook a alerty

- `docs/3.2/ops/ALERT-RUNBOOK.md`: **36 → 37 alertů**; nový řádek `G8PrimaryTipStale` (co znamená, první kontrola, co nedělat, závislost na probe ≥ 2026-11-11); poznámka k watchdog helperu a testu.
- `scripts/ops/test-alert-rules.sh --list` nově ukazuje `g8.rules.yml 6 alerts` (dřív 5); ostatní soubory beze změny.

## 5. Ověření

| Kontrola | Výsledek |
|---|---|
| `bash -n scripts/watchdog.sh` | OK |
| `bash scripts/ops/test_node_tip_age.sh` | **8/8** |
| `python3 scripts/ops/test_g8_probe_exporter.py` | 21/21 |
| `python3 scripts/ops/test_g8_evidence.py` / `test_g8_alert_sink.py` | exit 0 / 18/18 |
| `promtool check rules g8.rules.yml` | SUCCESS (6 rules) |
| `promtool test rules test_zion_g8_rules.yml` | SUCCESS |
| `check-doc-links.py` | 0 rozbitých |
| `git diff --check` | OK |

## 6. Co **není** hotové (a proč to není autonomní)

### 6.1 Deploy-gated (během G8 run #7 se nenasazuje)
- Probe hardening + `G8PrimaryTipStale` + `node-tip-age.sh` + watchdog změna na EDGE/EDGE2. Probe restart může minout scrape → 60s incident. **Po 6. 12. nebo v odsouhlaseném okně s rollbackem.**
- P2P robustnost EDGE `:8336` (resety, druhý peer, priorita miningu) — změna v `V31/L1/core` (P2P je chráněná vrstva) + deploy.

### 6.2 👤 / 🔀 (rozhodnutí, peníze, klíče, toolchain)
- ZIS agent sub-accounts: `db push` + deploy + step-up/UI.
- P0-3 env subsety + rotace; PRL `DRY_RUN=0`; ZionDex funded E2E; DAO guardian registry + treasury key; HA `armed`.
- Release artefakty: macOS (Xcode/osxcross) a Windows (mingw) na tomto PC **nejsou**; na disku 2/5 linux tarballů. Linux CUDA variantu nelze bez CUDA toolkitu.
- G9 audit, QTC funding/re-enable, BTC swap scope, node reward, Stable L2 scope, premine 144k, SMTP, SMOS rig, EDGE load trade-off, HW upgrade, bug bounty, legal/kulturní R9, launch date.

### 6.3 Více­denní feature backlog (🤖, ale ne „fronta na dnes")
- L3: Miner↔NCL spike, Dharma policy manifest, Amitabha draft-only UI, red-team, citace/retrieval gate.
- OASIS: device matrix, WebGPU gaps, reverse-sync, on-chain anchoring.
- QTC integrace F1/F2/F3/F5; i18n/Footer; 3D avatar batch (čeká na G0 a volnou VRAM).

## 7. Definice „hotovo" pro tuto frontu

**Ops/monitoring autonomní fronta je vyčerpaná.** Vše, co šlo dnes udělat bez deploye, peněz, klíčů a bez zásahu do G8 required služeb, je v repu, otestované a pushnuté. Další krok je buď 👤 gate, nebo vědomé spuštění feature backlogu — ne „ještě jeden ops fix".
