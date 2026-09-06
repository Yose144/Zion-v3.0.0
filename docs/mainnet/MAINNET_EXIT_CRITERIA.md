# ✅ ZION MainNet — Exit Criteria

> **Verze:** 1.2  
> **Vytvořeno:** 24. února 2026 (Session 50)  
> **Aktualizováno:** 20. dubna 2026 — active topology aligned to Prague-only runtime  
> **Autoritativní dokument** — vybráno do launch-gatingu spolu s `MAINNET_CHECKLIST.md`  
> **Stav:** FORMALIZED — historical 3-node rehearsal archived, active runtime is Prague-only

---

## Účel

Tento dokument definuje **měřitelné, ověřitelné podmínky**, které musí být splněny před spuštěním ZION MainNetu.  
Žádná podmínka nesmí být vynechána bez formálního `WAIVER` záznamu v sekci [Výjimky](#výjimky).

Aktivní provozní realita k 20. 4. 2026 je **single-host Prague runtime**:
- Prague — `91.98.122.165`

Historická 72h controlled V3 rehearsal nad Prague / USA / Singapore zůstává jako audit evidence, ne jako aktuální topologie.

Tento dokument rozlišuje:
- **nečekaný restart / crash** — porušení C-01
- **plánovaný upgrade restart** — je přípustný pouze tehdy, pokud je výslovně zdokumentovaný v collector evidenci a closure reportu včetně doby recovery a obnovení tip agreementu

---

## Kritéria P0 — Blokující (musí být splněno 100 %)

### C-01 — Stabilita sítě (72h window)
| Metrika | Požadavek | Zdroj |
|---------|-----------|-------|
| Orphan rate | < 5 % (klouzavý průměr 72h) | Grafana `PoolHighOrphanRate` |
| Block reject rate | < 2 % | `blocks_rejected / blocks_total` |
| Node uptime (auditovaný Prague host) | 100 % bez **nečekaného** restartu; plánovaný upgrade restart je přípustný jen s recovery evidencí | `docker inspect`, `docker ps`, collector log |
| Block time průměr | 55–65 s (±8 %) po 72h | Prometheus `block_time_seconds` |
| Chain height divergence | N/A v single-host režimu; při budoucím multi-node rozšíření znovu aktivovat cross-node gate | cross-node height check |
| Restart discipline | po plánovaném restartu se musí obnovit tip agreement, peer connectivity a pool acceptance | collector report + cross-node RPC |

> **Perioda:** 72 hodin nepřetržitého provozu auditovaného Prague runtime  
> **Pravidlo zásahu:** plánovaný upgrade restart neresetuje window, pokud je zachycený v evidenci a uzavřený recovery appendixem  
> **Důkaz:** screenshot dashboardu, exportovaný Prometheus snapshot, collector evidence a restart/recovery appendix

---

### C-02 — Konsensus a bezpečnost
| Metrika | Požadavek | Implementace |
|---------|-----------|--------------|
| Double-spend test | MUSÍ selhat (tx odmítnuta) | `L1/core/tests/sprint_1_2_test_suite.rs` (sekce 1.2.2 + `test_double_spend_block_level_rejected`) |
| Reorg test (depth ≤ 10) | Přijat, chain se reconnectuje korektně | `L1/core/tests/sprint_1_2_test_suite.rs` (sekce 1.2.1) |
| Reorg test (depth > 10) | Odmítnut / izolace | `reorg.rs` max reorg depth |
| Timestamp manipulation | Blok s future timestamp odmítnut | `validation.rs` `MAX_FUTURE_DRIFT` (7200 s hardcoded) |
| Fork-choice (highest work) | Správná volba větve | `reorg.rs` `is_stronger_chain()` |
| DAA konvergence | Difficulty stabilizovaná po 60 blocích od startu | `consensus.rs` LWMA |

---

### C-03 — Genesis & Premine
| Metrika | Požadavek |
|---------|-----------|
| `genesis.json` vytvořen OFFLINE | Soubor existuje, hash SHA-256 publikován |
| Premine suma | = 16,780,000,000 ZION (ověřeno `test_premine_grand_total`) |
| Premine kategorie | 4 kategorie, součet = PREMINE_TOTAL (ověřeno testy) |
| Adresy premine | Unikátní, validní bech32 `zion1…` formát |
| On-chain time-lock | Aktivován pro mainnet build (nebo formální WAIVER) |

---

### C-04 — Infra a deployment
| Metrika | Požadavek |
|---------|-----------|
| Bootstrap topology | Prague primary je auditovaný bootstrap; návrat k ≥ 3 geo seedům vyžaduje nový go/no-go audit |
| Docker images | SHA-256 hash publikován pro `zion-core`, `zion-pool`, `zion-miner` |
| Alertmanager | Telegram/Slack routing aktivní, test-incident otestován |
| `MAX_TIMESTAMP_DRIFT` | = 7200 s v produkčním mainnet buildu |
| Záloha konfigurací | Záloha na ≥ 2 nezávislých místech |

---

### C-05 — Dokumentace a právní
| Položka | Požadavek |
|---------|-----------|
| `legal/DISCLAIMER.md` | Existuje, aktuální |
| `legal/TOKEN_NOT_SECURITY.md` | Existuje, aktuální |
| `legal/PREMINE_DISCLOSURE.md` | Existuje, aktuální ✅ |
| `legal/RISK_DISCLOSURE.md` | Existuje, aktuální |
| `legal/NO_INVESTMENT.md` | Existuje, aktuální |
| Whitepaper (PDF) | Finální verze publikována |
| `docs/mainnet/MAINNET_CONSTITUTION.md` | Označen jako FROZEN (hash locked) |

---

## Kritéria P1 — Doporučená (libovolná výjimka vyžaduje zdůvodnění)

| ID | Kritérium | Poznámka |
|----|-----------|---------|
| P1-01 | Block explorer funkční (API) | Nutné pro burzy |
| P1-02 | CPU mining baseline test (low-end CPU) | Dokumentace |
| P1-03 | Pool failover test | Miner přepne na backup pool |
| P1-04 | 168h stability run (extenze C-01) | Před dress rehearsal |
| P1-05 | Reproducible build + SHA256 flow | Release engineering |
| P1-06 | Firewall audit (5 nodů) | Jen potřebné porty otevřené |
| P1-07 | Height divergence alert (Prometheus) | Monitoring |

---

## Postup verifikace před genesis

```
1. [ ] Spustit cargo test --release -p zion-core 2x po sobě (clean run)
2. [ ] Spustit 72h testnet stability window (výsledky do README)
3. [ ] Ověřit všechna C-01 kritéria z Grafana dashboardu
4. [ ] Spustit genesis ceremony OFFLINE (air-gapped stroj)
5. [ ] SHA-256 hash genesis.json publikovat ve 3 kanálech (repo, web, Discord)
6. [ ] Deploy mainnet seed nodů (genesis.json distribuovat bezpečně)
7. [ ] Sign-off tabulka níže podepsat
```

## Closure checklist pro 72h rehearsal

Tento checklist se vyplňuje při uzavření aktivního rehearsal okna, než padne další `GO/NO-GO` verdict.

### A. Live runtime evidence
- [x] Exportovat poslední collector snapshot a čas posledního vzorku
  - **2026-03-31T~15:00 UTC** — sběr dat ze všech 3 nodů
- [x] Uložit `getChainInfo` z Prague, USA a Singapore
  - Prague: `height=5104 tip=0001c143…9b65 accepted_blocks=5105`
  - USA:    `height=5105 tip=0000dee0…3fa5 accepted_blocks=5106`
  - SG:     `height=5105 tip=0000dee0…3fa5 accepted_blocks=5106`
- [x] Ověřit shodu `chain_height` a `tip_hash` na všech 3 nodech
  - USA a SG v plném agreement (5105, stejný tip). Prague 1 blk behind (transient, propagace probíhá).
- [x] Zapsat `restart_count` a `started_at` pro `zion-core` na všech 3 nodech
  - Prague: started `2026-03-29T12:05:40Z` | restarts=**0**
  - USA:    started `2026-03-30T15:32:21Z` | restarts=**1** (plánovaný upgrade)
  - SG:     started `2026-03-30T12:30:15Z` | restarts=**1** (plánovaný upgrade)

### B. Restart / recovery appendix
- [x] Každý restart klasifikovat jako `planned upgrade` nebo `unexpected incident`
  - Prague: **žádný restart** — 0 restartů od 29. 3.
  - USA: **planned upgrade** — restart 30. 3. při aktualizaci konfigurace
  - SG: **planned upgrade** — restart 30. 3. při aktualizaci konfigurace
- [x] U plánovaných restartů uvést důvod, čas zásahu a čas návratu do `tip agreement`
  - USA/SG: config refresh → restarted → tip agreement obnoven do <2 min (stejný tip hash na obou)
- [x] Potvrdit, že po restartu se obnovila peer konektivita a `pool accept`
  - Potvrzeno — USA má nově nasazený pool (31. 3.) s 1 aktivním minerem, Prague pool běží 3.5+ dní
- [ ] Pokud restart nebyl plánovaný, otevřít incident a rehearsal označit minimálně `AMBER`
  - N/A — všechny restarty byly plánované

### C. Výkonnostní a launch-gating metriky
- [x] Zapsat pool acceptance / reject rate za celé okno
  - Prague pool: **4763 accepted / 37 rejected** → reject rate **0.77%** (< 2% ✓)
  - USA pool: čerstvě nasazen 31. 3. — sbírá data
- [x] Zapsat chain growth, průměrný block time a divergence summary
  - Chain height: **5105** po ~3.5 днях rehearsalu
  - Pool uptime: **305,503s** (~3.54 dní)
  - Divergence: max 1 blk transient, steady-state 0 ✓
- [x] Zapsat orphan / reject evidence nebo explicitní stav `not yet instrumented`
  - Block reject: 37/4800 = 0.77% ✓
  - Orphan rate: **not yet instrumented** (Grafana/Prometheus dashboard pending)
- [x] Zapsat, zda closure gate zůstává blokovaný kvůli BFG, genesis artefaktům a sign-offu
  - **BLOKÁTORY:** BFG history scrub (private keys v git), genesis ceremony offline, whitepaper finální verze

### D. Výstup
- [ ] Vydat krátký closure report s verdiktem `GO / AMBER / NO-GO`
  - **Předběžný verdikt: AMBER** — 72h okno ještě nedoběhlo, orphan monitoring chybí, BFG pending
- [ ] Připojit odkazy na dashboard evidence, runbook a checklist
- [ ] Pokud není public launch povolen, explicitně napsat zbývající blokátory
  - 1. 72h window nedokončeno (zbývá ~cca 18-20h)
  - 2. BFG scrub private keys z git historie
  - 3. Grafana orphan rate dashboard
  - 4. Genesis ceremony offline
  - 5. Whitepaper finální verze

---

## Sign-Off

| Role | Jméno | Datum | Podpis |
|------|-------|-------|--------|
| Core Dev | | | |
| Ops Lead | | | |
| Security Review | | | |

---

## Výjimky (WAIVER log)

| Datum | Kritérium | Zdůvodnění | Schválil |
|-------|-----------|-----------|---------|
| — | — | — | — |

---

*Exit Criteria Version: 1.2*  
*Vytvořeno: 2026-02-24 (Session 50)*  
*Aktualizováno: 2026-03-31 — formalized with live V3 rehearsal evidence*  
*Stav: FORMALIZED — closure pending po 72h window*
