# REPORT 2026-11-11 — G8 probe hardening + korekce artefaktové reality

> **Datum:** 2026-11-11 · **Režim:** autonomní, kód + testy + dokumentace (bez deploye, restartu, money-path)
> **Zadání 👤:** „jed autonomni praci a pak report a push na git .. uz nejsme na macu ale lokal node pc!"
> **Kontext:** navazuje na [`REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md`](REPORT_2026-11-11_G8_CHAIN_LIVE_RCA.md) — RCA doporučila hardening sondy a inventuru artefaktů.
> **Prostředí:** lokální node PC (Ubuntu, `zionserver-144`, GTX 1070 Ti, 199 G volných), **ne Mac**.

---

## 1. Co je hotové

### 1.1 Hardening `g8_probe_exporter.py`

Čtyři změny přesně proti tomu, co RCA označila za příčinu zkreslení:

| # | Změna | Proč |
|---|---|---|
| 1 | **Selhaný probe čistí `chain_height`/`tip_timestamp`** | Dřív `getStatus` prošel, `getBlockByHeight` selhal → `success=False`, ale starý height/tip zůstaly a mohly vyhrát výběr tipu. Přesně to vidělo 5 incidentů (starý tip 115 406). |
| 2 | **Výběr tipu vyžaduje `success`** | `tip_res` bral nejvyšší timestamp bez ohledu na `success`; nyní jen plně úspěšný probe (getStatus + getBlockByHeight) může dodat tip. |
| 3 | **Tolerance future-dated tipu** (`G8_CHAIN_TIP_FUTURE_TOLERANCE_SECONDS`, default **120 s**) | Block timestamp je miner-supplied a může být mírně napřed; `0 <= tip_age` dřív odmítal i +1 s. Followeři měli `node_tip_fresh=0` i při živém tipu. |
| 4 | **Per-node metriky** `zion_g8_node_tip_age_seconds{service=…}` a `zion_g8_node_chain_height{service=…}` | Dosud byl jen binární `node_tip_fresh`; nově je vidět, *který* node je starý a o kolik — přesně chybějící důkaz pro RCA. |

`chain_live` teď počítá `-future_tol <= tip_age <= chain_tip_max_age`; `tip_age` je vždy float (stabilní formát metrik).

### 1.2 Testy

`scripts/ops/test_g8_probe_exporter.py` — **21/21 OK** (4 nové):

- `test_failed_probe_clears_stale_tip_fields` — simuluje getStatus 115406 + timeout getBlockByHeight; pole musí být `None`.
- `test_failed_primary_does_not_win_tip_selection` — selhaný primary se starým tipem nesmí přebít čerstvého followery; `chain_live=1`, `chain_height` z followera.
- `test_small_future_skew_is_live` — +60 s tip je live (`chain_live=1`), +300 s (mimo toleranci) zůstává 0.
- `test_per_node_tip_age_and_height_metrics` — nové per-node metriky mají správné labely a hodnoty.

Regresní g8 suite: `test_g8_evidence.py` **exit 0**, `test_g8_alert_sink.py` **18/18 OK**, `py_compile` OK.

### 1.3 Korekce artefaktové reality (PC vs Mac)

Dokumenty tvrdily „5 tarballů v `dist/v3.2.0-rc-w1.4/`" a „Mac disk 100 %". Ověřeno na tomto PC:

- na disku jsou **jen 2 linux tarbally** (`default` + `gpu-opencl`), žádné aarch64/gpu-metal/windows;
- **macOS** buildy vyžadují Mac/Xcode (nebo osxcross), **Windows** mingw-w64 — tento PC nemá ani jedno;
- Mac disk už není pracovní prostředí (jsme na lokálním node PC), takže „uvolnit místo na Macu" není aktuální blocker; blocker je **chybějící toolchain**.

Opraveno v: `PLAN.md` (§1, §3, §8), `docs/3.2/3.2.1-3.2.9_PLAN.md` (9.B4), `docs/3.3/DOC_VS_CODE_ANALYSIS_2026-11-10.md` (§1 #11, §3 #2), `docs/3.3/NIRVANA-V3.3-CHECKLIST.md` (11.11 note), `docs/3.2/StatusV3.md` (11.11 doplnění).

---

## 2. Ověření

| Kontrola | Výsledek |
|---|---|
| `python3 -m py_compile scripts/ops/g8_probe_exporter.py` | OK |
| `python3 scripts/ops/test_g8_probe_exporter.py` | **21/21 OK** |
| `python3 scripts/ops/test_g8_evidence.py` | exit 0 |
| `python3 scripts/ops/test_g8_alert_sink.py` | 18/18 OK |
| `python3 scripts/ops/check-doc-links.py` | **0 rozbitých / 893 souborů** |
| `git diff --check` | OK |

---

## 3. Co se **nenasazovalo**

- Produkce běží beze změny: živý probe je stále `/opt/zion/scripts/ops/g8_probe_exporter.py` na EDGE (stará verze), G8 run #7 se nedotkl.
- Nová verze **není** v produkci — deploy by znamenal restart `zion-g8-probe` (oneshot? `Restart=always`, `Type=simple`), což může minout jeden 15s scrape a vyrobit falešný 60s incident. Doporučeno nasadit **mimo aktivní run** nebo v explicitně odsouhlaseném okně s rollbackem.
- Žádný restart, deploy, DNS, env ani finanční akce.

**Deploy postup (až po schválení / po 6. 12.):**
```bash
scp scripts/ops/g8_probe_exporter.py zion-new:/opt/zion/scripts/ops/g8_probe_exporter.py
ssh zion-new 'systemctl restart zion-g8-probe'
# ověřit: curl -s 127.0.0.1:9105/metrics | grep -E "node_tip_age|node_chain_height|chain_live"
```
Rollback: předchozí soubor do `.bak-20261111` + restart.

---

## 4. Co z RCA zůstává

| # | Položka | Stav |
|---|---|---|
| 1 | Inventura duplicitních node listenerů (`ss`/`pgrep`/`SO_REUSEPORT`, startovní guard) | ⬜ read-only check lze kdykoli; na serveru |
| 2 | P2P robustnost EDGE `:8336` (resety, druhý peer, priorita miningu) | ⬜ kód/konfigurace, deploy mimo run |
| 3 | Watchdog stale-tip check (dnes jen „RPC not reachable") | ⬜ návrh; restart je až poslední možnost |
| 4 | Alert `G8PrimaryTipStale` na `zion_g8_node_tip_age_seconds{service="node_primary"} > 900` | ⬜ **lokálně není `promtool`** — rule + firing test připravit na EDGE/CI, nasadit spolu s probem |
| 5 | Došetřit, proč followeři měli `node_tip_fresh=0` | 🟡 toleranci future timestampů řeší tato dávka; po deployi ověřit |
| 6 | Stratum blip 14:27Z (11. 11.) | ⬜ samostatná observability položka |

---

## 5. Změněné soubory

- `scripts/ops/g8_probe_exporter.py` — hardening (4 změny)
- `scripts/ops/test_g8_probe_exporter.py` — 4 nové testy + config helper
- `PLAN.md`, `docs/3.2/3.2.1-3.2.9_PLAN.md`, `docs/3.2/StatusV3.md`
- `docs/3.3/DOC_VS_CODE_ANALYSIS_2026-11-10.md`, `docs/3.3/NIRVANA-V3.3-CHECKLIST.md`
- tento report

---

## 6. Limity

- Probe není nasazený; čísla v G8 run #7 se touto dávkou nemění.
- `promtool` na tomto PC není, takže nové alert pravidlo nebylo přidáno (aby vzniklo bez firing testu = porušení 8.S1).
- Artefakty pro macOS/Windows nelze na tomto PC postavit bez Xcode/osxcross a mingw-w64.
