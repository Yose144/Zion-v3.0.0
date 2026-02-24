# ✅ ZION MainNet — Exit Criteria

> **Verze:** 1.0  
> **Vytvořeno:** 24. února 2026 (Session 50)  
> **Autoritativní dokument** — vybráno do launch-gatingu spolu s `MAINNET_CHECKLIST.md`  
> **Stav:** DRAFT — vyžaduje sign-off před genesis freeze

---

## Účel

Tento dokument definuje **měřitelné, ověřitelné podmínky**, které musí být splněny před spuštěním ZION MainNetu.  
Žádná podmínka nesmí být vynechána bez formálního `WAIVER` záznamu v sekci [Výjimky](#výjimky).

---

## Kritéria P0 — Blokující (musí být splněno 100 %)

### C-01 — Stabilita sítě (72h window)
| Metrika | Požadavek | Zdroj |
|---------|-----------|-------|
| Orphan rate | < 5 % (klouzavý průměr 72h) | Grafana `PoolHighOrphanRate` |
| Block reject rate | < 2 % | `blocks_rejected / blocks_total` |
| Node uptime (5 nodů) | 100 % bez neočekávaného restartu | `docker ps`, `journalctl` |
| Block time průměr | 55–65 s (±8 %) po 72h | Prometheus `block_time_seconds` |
| Chain height divergence | max ±2 bloky mezi 5 nody | cross-node height check |

> **Perioda:** 72 hodin nepřetržitého provozu bez ručního zásahu  
> **Důkaz:** screenshot Grafana dashboard + exportovaný Prometheus snapshot

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

*Exit Criteria Version: 1.0*  
*Vytvořeno: 2026-02-24 (Session 50)*  
*Stav: DRAFT — vyžaduje review před genesis freeze*
