# ✅ ZION MainNet — Exit Criteria

> **Verze:** 1.1  
> **Vytvořeno:** 24. února 2026 (Session 50)  
> **Aktualizováno:** 30. března 2026 — sladěno s aktivním V3 controlled rehearsal  
> **Autoritativní dokument** — vybráno do launch-gatingu spolu s `MAINNET_CHECKLIST.md`  
> **Stav:** DRAFT — vyžaduje sign-off před genesis freeze

---

## Účel

Tento dokument definuje **měřitelné, ověřitelné podmínky**, které musí být splněny před spuštěním ZION MainNetu.  
Žádná podmínka nesmí být vynechána bez formálního `WAIVER` záznamu v sekci [Výjimky](#výjimky).

Aktivní veřejné validační okno k 30. 3. 2026 je **72h controlled V3 rehearsal** nad auditovaným 3-node setem:
- Prague — `91.98.122.165`
- USA — `5.78.194.94`
- Singapore — `5.223.84.191`

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
| Node uptime (3 auditované geo nody) | 100 % bez **nečekaného** restartu; plánovaný upgrade restart je přípustný jen s recovery evidencí | `docker inspect`, `docker ps`, collector log |
| Block time průměr | 55–65 s (±8 %) po 72h | Prometheus `block_time_seconds` |
| Chain height divergence | steady-state `0 blk`, při recovery max dočasně ±2 bloky | cross-node height check |
| Restart discipline | po plánovaném restartu se musí obnovit tip agreement, peer connectivity a pool acceptance | collector report + cross-node RPC |

> **Perioda:** 72 hodin nepřetržitého provozu auditovaného 3-node setu  
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
| Premine suma | = 16,280,000,000 ZION (ověřeno `test_premine_grand_total`) |
| Premine kategorie | 4 kategorie, součet = PREMINE_TOTAL (ověřeno testy) |
| Adresy premine | Unikátní, validní bech32 `zion1…` formát |
| On-chain time-lock | Aktivován pro mainnet build (nebo formální WAIVER) |

---

### C-04 — Infra a deployment
| Metrika | Požadavek |
|---------|-----------|
| Seed nody (min 3 geo) | ≥ 3 geograficky oddělené nody synchronizovány na genesis |
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
- [ ] Exportovat poslední collector snapshot a čas posledního vzorku
- [ ] Uložit `getChainInfo` z Prague, USA a Singapore
- [ ] Ověřit shodu `chain_height` a `tip_hash` na všech 3 nodech
- [ ] Zapsat `restart_count` a `started_at` pro `zion-core` na všech 3 nodech

### B. Restart / recovery appendix
- [ ] Každý restart klasifikovat jako `planned upgrade` nebo `unexpected incident`
- [ ] U plánovaných restartů uvést důvod, čas zásahu a čas návratu do `tip agreement`
- [ ] Potvrdit, že po restartu se obnovila peer konektivita a `pool accept`
- [ ] Pokud restart nebyl plánovaný, otevřít incident a rehearsal označit minimálně `AMBER`

### C. Výkonnostní a launch-gating metriky
- [ ] Zapsat pool acceptance / reject rate za celé okno
- [ ] Zapsat chain growth, průměrný block time a divergence summary
- [ ] Zapsat orphan / reject evidence nebo explicitní stav `not yet instrumented`
- [ ] Zapsat, zda closure gate zůstává blokovaný kvůli BFG, genesis artefaktům a sign-offu

### D. Výstup
- [ ] Vydat krátký closure report s verdiktem `GO / AMBER / NO-GO`
- [ ] Připojit odkazy na dashboard evidence, runbook a checklist
- [ ] Pokud není public launch povolen, explicitně napsat zbývající blokátory

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

*Exit Criteria Version: 1.1*  
*Vytvořeno: 2026-02-24 (Session 50)*  
*Aktualizováno: 2026-03-30 — aligned with 3-node V3 rehearsal*  
*Stav: DRAFT — vyžaduje review před genesis freeze*
