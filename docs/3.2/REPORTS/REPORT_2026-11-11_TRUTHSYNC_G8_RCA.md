# REPORT 2026-11-11 — Truth-sync plánů + G8 `chain_live` RCA

> **Datum:** 2026-11-11 · **Režim:** autonomní, dokumentace + read-only analýza (bez deploye, restartu, money-path)
> **Zadání 👤:** „koukni na autonomní fronty a plány" → „teď 2 a pak 4" (2 = truth-sync plánů, 4 = G8 `chain_live` RCA) → „reportni a push na git".
> **Commity:** `3b182b5f0` (truth-sync), `7ca05aabc` (RCA report + StatusV3). Oba pushnuté na `origin/main`.
> **Detail RCA:** [`REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md`](REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md).

---

## 1. Truth-sync plánů (commit `3b182b5f0`)

Srovnáno 6 dokumentů na realitu 11. 11. (G8 **run #7**, proto 34, QTC payout OFF, hotové položky). Starší snapshoty jsou nově explicitně označené; odkazy ověřeny (`check-doc-links.py`: **0 rozbitých / 892 souborů**).

| Dokument | Hlavní změny |
|---|---|
| `PLAN.md` | snapshot 10. 11. → **11. 11.**; G8 99,92 %, pool `ece8b6965`, chain 118 687, EDGE2 `networkd-wait-online` fix, ZIS 60/60; nové „Od snapshotu" (M2 payout monitoring, ZIS sub-accounts, R9 factual); přepsaná fronta §8 |
| `docs/3.2/3.2.1-3.2.9_PLAN.md` | korekce v hlavičce; run #5 → **#7** (DoD, kotvy, kritická cesta); **5.B2, 7.B4, 8.B7, 8.B9, 9.B5** odškrtnuty s důkazy; 2.B7/2.S1 QTC a accept stav; 9.B4 stav artefaktů |
| `docs/3.2/DEFERRED_3.2.md` | revize 11. 11.; G8 #7; cert `auth.` renewal (do 24./25. 1. 2027); QTC payout OFF; D-17 Next 16.4.3 |
| `docs/3.3/NIRVANA-V3.3-CHECKLIST.md` | blok 11. 11.; G8 #7 99,9241; DoD „0/9 plně · 6 rozpracovaných"; V33-4 prod E2E; ZIS 60/60; fronta odkázána na DOC_VS_CODE §4 |
| `docs/3.3/NIRVANA-V3.3-MAP.md` | kritická cesta run #7; matice (chain 118 687, pool `ece8b6965`, QTC OFF, G8 run #7); timeline 11. 11. |
| `docs/3.3/NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md` | korekce 11. 11. (přednost před snapshoty); W3.5/W6 QTC OFF + re-enable; changelog v1.15 |

**Co se necommitovalo:** cizí WIP v pracovním stromu (`scripts/ops/avatar-3d/generate.py`) — ponecháno netknuté. Paralelní session mezitím commitla `cc6ab6581` (macOS cleanup) a `d261e5d0a` (desktop-agent GPU dedup).

---

## 2. G8 `chain_live` RCA (commit `7ca05aabc`)

### 2.1 Závěr

**5× `chain_live` incident (60 s) nebyl výpadkem chainu.** V každém případě primary RPC (`9445` → EDGE2) vrátil **starý tip** — height o **56–240 bloků nižší**, timestamp **1–4 h starý** — a/nebo byl node ve stejné chvíli restartován watchdogem. Chain byl živý: followeři odpovídali, bloky přibývaly, žádná mezera >900 s; ostatní required služby a exporter byly `1`.

### 2.2 Důkazy

| Incident (UTC) | Změna height | `tip_age` | Poznámka |
|---|---|---|---|
| 11-08 23:17:25 | 115 583 → 115 406 (−177) | 10 307 s | bez restartu |
| 11-09 00:17:25 | 115 644 → 115 406 (−238) | 13 846 s | stejný zamrzlý tip |
| 11-09 00:21:25 | 115 646 → 115 406 (−240) | 14 087 s | watchdog restart 00:20:45Z |
| 11-09 01:17:25 | 115 702 → 115 646 (−56) | 3 481 s | watchdog restart 01:17:27Z |
| 11-09 16:38:25 | 116 621 → 116 434 (−187) | 11 780 s | watchdog restart 16:38:18Z |

- Starý tip byl **zamrzlý** (115 406 po >1 h), ale v čase se posouval → nejde o lagging follower, ale o **druhý/nekonzistentní backend na `9445`** (jeden proces + jedno `Mutex<Connection>` v `storage.rs` dva tipy neumí).
- **Chronické P2P chyby** z EDGE `:8336` (`Connection reset`, `no status response`, `peer rejected`) — primary ztrácel block source; EDGE je dlouhodobě CPU-vytížený miningem.
- Po restartu 10. 11. 19:17Z už žádný `chain_live` incident.
- **6. incident 11. 11. 14:27:25Z** je samostatný 60s TCP blip na stratum `8444` (`pool_http` = 1); uptime 99,9241 → **99,916481 %**.

### 2.3 Doporučení (bez deploye během run #7)

1. **P0:** vyloučit duplicitní node listenery (`ss`/`pgrep`/`SO_REUSEPORT` + startovní guard); P2P robustnost (retry/druhý peer, mining priorita); watchdog stale-tip check.
2. **P1:** hardening sondy — vyžadovat `success` při výběru tipu, čistit `chain_height`/`tip_timestamp` při selhání, povolit malý negativní `tip_age`, per-node tip metriky, došetřit `node_tip_fresh=0` u followerů.
3. **P2:** sémantika `chain_live` v docs/runbooku (dnes fakticky „primary má čerstvý tip"), došetřit stratum blip.

---

## 3. Živý stav při sepsání (11. 11. ~14:35 UTC)

`GET https://app.zionterranova.com/api/g8`:

- run **#7** `g8-20261106T145125Z`, cíl **2026-12-06T14:51:25Z**, `pending`
- uptime **99,916481 %**, evidence 100 %, **6 incidentů / 0 kritických**, downtime 360 s
- `chain_live` 99,930401 % · `pool_stratum` 99,98608 % · ostatní required 100 %

> Plány mají „99,9241 % / 5 incidentů" jako ranní snapshot; `StatusV3` už má doplněk 14:35Z s 6. incidentem a odkazem na RCA.

---

## 4. Otevřené body / další autonomní krok

| Položka | Stav |
|---|---|
| G8 run #7 PASS (do 6. 12.) | 🔄 běží; RCA uzavřela, že incidenty nejsou chain outage |
| Duplicitní node listenery / P2P robustnost | 🤖→🔀 kód + inventura; deploy mimo run / s rollbackem |
| Hardening `g8_probe_exporter` | 🤖 testy + patch připravit, nasadit mimo run |
| Release artefakty 9.B4 | ⏸️ x86_64-apple-darwin blokuje Mac disk; RC rebuild = 👤 9.S1 |
| ZIS sub-accounts | 🔀 kód hotový; DB push + deploy + UI = 👤 |
| P0-3 env subsety + rotace | 🔀 audit hotový, rotace = 👤 |

---

## 5. Hranice
- Žádný restart, deploy, DNS, env ani finanční akce; vše read-only.
- Aktivní G8 run #7 nebyl změněn; jeho čísla se v čase mění.
- Cizí rozpracované soubory nebyly editovány ani commitovány.

## 6. Reference
- [`REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md`](REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md) — plná RCA
- [`REPORT_2026-11-11_PAYOUT_MONITORING.md`](REPORT_2026-11-11_PAYOUT_MONITORING.md) — M2 payout monitoring
- [`DOC_VS_CODE_ANALYSIS_2026-11-10.md`](../../3.3/DOC_VS_CODE_ANALYSIS_2026-11-10.md) — verify matrix + fronta
- [`StatusV3.md`](../StatusV3.md) — kanonický stav
