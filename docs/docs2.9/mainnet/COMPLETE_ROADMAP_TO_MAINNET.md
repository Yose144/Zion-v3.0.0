# 🗺️ ZION TerraNova — KOMPLETNÍ ROADMAPA K MAINNET

**Verze:** 1.0  
**Datum:** 3. února 2026  
**Cíl:** Systematický plán od aktuálního stavu až k úspěšnému MainNet launchi

---

## 📊 AKTUÁLNÍ STAV (Baseline)

```
┌─────────────────────────────────────────────────────────────┐
│  ZION v2.9.5 Native Stack - Readiness Assessment           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Core Blockchain ████████████████████░░░░ 85%              │
│  Mining Pool     ████████████████████░░░░ 80%              │
│  P2P Network     █████████████░░░░░░░░░░░ 65%              │
│  Wallet System   ██████░░░░░░░░░░░░░░░░░░ 30%              │
│  Explorer API    ████░░░░░░░░░░░░░░░░░░░░ 20%              │
│  Legal/Docs      ██████████████████████░░ 90%              │
│  Genesis/Spec    ██████████████░░░░░░░░░░ 70%              │
│                                                             │
│  OVERALL: ████████████████░░░░░░░░ 70% MainNet Ready       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 FÁZE 0: REALITY LOCK (Týden 1)

### Cíl: Jedna pravda, jedna konfigurace, jeden deploy

### Úkoly

#### 0.1 Port Matrix Unifikace
- [ ] Vytvořit `docs/mainnet/PORT_MATRIX.md` jako jediný zdroj pravdy
- [ ] Synchronizovat všechny configs (docker-compose, systemd, e2e testy)
- [ ] Odstranit legacy port references

**Kanonické porty:**
```yaml
zion-core:
  rpc_port: 8444
  p2p_port: 8334

zion-pool:
  stratum_port: 3333
  api_port: 8080

redis:
  port: 6379
```

#### 0.2 Deploy Kanonizace
- [ ] Docker je JEDINÝ podporovaný způsob
- [ ] Aktualizovat `docker-compose.mainnet.yml`
- [ ] Deprecation warning v README pro systemd

#### 0.3 E2E Smoke Test
- [ ] Test projde bez manuálních zásahů
- [ ] `docker compose up -d` → all healthy < 60s

### Exit Criteria
- [ ] `docker compose up` prochází
- [ ] Miner → Pool → Core E2E funguje
- [ ] Jedna dokumentovaná port matrix

### Deliverables
- `docs/mainnet/PORT_MATRIX.md`
- `docker-compose.mainnet.yml`
- Aktualizovaný `2.9.5/README.md`

---

## 🎯 FÁZE 1: SPEC FREEZE (Týden 2-3)

### Cíl: Uzamknout to, co se po MainNet NIKDY nemění

### Úkoly

#### 1.1 Genesis Parametry
- [ ] Finalizovat `chain_id`: `zion-mainnet-1`
- [ ] Stanovit genesis timestamp (UTC)
- [ ] Vygenerovat reálné bech32 premine adresy
- [ ] Vytvořit `genesis.json`

#### 1.2 Emission Model
- [ ] Potvrdit base reward: 5,479.45 ZION/block
- [ ] Dokumentovat consciousness bonus pool
- [ ] Stanovit decay model (smooth vs halving)
- [ ] Vytvořit emission calculator script

#### 1.3 DAA Parametry
- [ ] Target block time: 60s ✅
- [ ] Window: 60 blocks ✅
- [ ] Max adjustment: 4x ✅
- [ ] Dokumentovat v constitution

#### 1.4 Algorithm Policy
- [ ] Rozhodnout: Cosmic Harmony only vs rotation
- [ ] Implementovat finální `Algorithm::from_height()`
- [ ] Dokumentovat rozhodnutí

### Exit Criteria
- [ ] `MAINNET_CONSTITUTION.md` finalizován
- [ ] `genesis.json` vytvořen a hash publikován
- [ ] Deterministické testy pro emission/DAA

### Deliverables
- `config/genesis.json`
- Aktualizovaný `MAINNET_CONSTITUTION.md`
- `scripts/emission_calculator.py`

---

## 🎯 FÁZE 2: WALLET MVP (Týden 4-7)

### Cíl: Minimální funkční wallet pro MainNet

### Úkoly

#### 2.1 Rust CLI Wallet Core
```rust
// Nový crate: 2.9.5/zion-wallet/
zion-wallet create --name "main"
zion-wallet import --seed "..."
zion-wallet export --name "main"
zion-wallet list
```

#### 2.2 Transaction Building
```rust
zion-wallet send --from "main" --to "zion1..." --amount 100
zion-wallet balance --name "main"
zion-wallet history --name "main"
```

#### 2.3 Key Management
- [ ] Secure storage (encrypted file)
- [ ] Mnemonic backup (BIP39)
- [ ] Recovery flow
- [ ] Password protection

#### 2.4 RPC Integration
- [ ] Connect to core RPC
- [ ] Fee estimation
- [ ] TX broadcast
- [ ] Confirmation tracking

### Exit Criteria
- [ ] E2E: create wallet → send TX → confirm → check balance
- [ ] Recovery test: import seed → access funds
- [ ] Unit testy: 20+ testů passing

### Deliverables
- `2.9.5/zion-wallet/` crate
- `docs/mainnet/WALLET_GUIDE.md`
- Integration tests

---

## 🎯 FÁZE 3: EXPLORER API (Týden 6-8)

### Cíl: API endpointy pro CMC, burzy a uživatele

### Úkoly

#### 3.1 Block Endpoints
```
GET /api/v1/block/:hash
GET /api/v1/block/height/:height
GET /api/v1/blocks?limit=10&offset=0
```

#### 3.2 Transaction Endpoints
```
GET /api/v1/tx/:hash
GET /api/v1/tx/pending
```

#### 3.3 Address Endpoints
```
GET /api/v1/address/:addr
GET /api/v1/address/:addr/txs?limit=10
GET /api/v1/address/:addr/utxos
```

#### 3.4 Network Endpoints
```
GET /api/v1/stats
GET /api/v1/supply
GET /api/v1/supply/circulating
```

### Exit Criteria
- [ ] Všechny endpointy funkční
- [ ] OpenAPI/Swagger dokumentace
- [ ] Circulating supply kalkulace

### Deliverables
- Explorer API v core/pool
- `docs/mainnet/API_REFERENCE.md`
- OpenAPI spec

---

## 🎯 FÁZE 4: POOL HARDENING (Týden 8-10)

### Cíl: Pool připravený na veřejný provoz

### Úkoly

#### 4.1 Stress Test
- [ ] 100+ concurrent miners
- [ ] 72h continuous run
- [ ] Metriky: accept rate, latency, memory

#### 4.2 Payout E2E
- [ ] Reálné testnet payouty
- [ ] Verify TX on-chain
- [ ] Edge cases: partial, failed, retry

#### 4.3 Anti-Spam
- [ ] Scanner traffic detection
- [ ] Invalid share kategorization
- [ ] Auto-ban thresholds

#### 4.4 VarDiff Tuning
- [ ] Optimal min/max difficulty
- [ ] Adjustment rate
- [ ] Hashrate estimation accuracy

### Exit Criteria
- [ ] 72h stability test passed
- [ ] Payout pipeline verified
- [ ] Scanner traffic < 1% of total

### Deliverables
- Stress test report
- Tuned VarDiff config
- Anti-spam rules

---

## 🎯 FÁZE 5: SECURITY HARDENING (Týden 10-14)

### Cíl: Základní bezpečnostní standardy

### Úkoly

#### 5.1 P2P Encryption (Optional v1)
- [ ] TLS nebo noise handshake
- [ ] Certificate management
- [ ] Backward compatibility

#### 5.2 Fuzzing
- [ ] JSON-RPC parser
- [ ] Stratum message parser
- [ ] Block/TX deserialization

#### 5.3 Threat Model
- [ ] Dokumentovat attack vectors
- [ ] Mitigation strategies
- [ ] Incident response plan

#### 5.4 Audit Preparation
- [ ] Code review checklist
- [ ] Critical path documentation
- [ ] Build reproducibility

### Exit Criteria
- [ ] Threat model dokumentován
- [ ] Fuzzing baseline (no crashes)
- [ ] Audit scope definován

### Deliverables
- `docs/security/THREAT_MODEL.md`
- `docs/security/AUDIT_SCOPE.md`
- Fuzzing harness

---

## 🎯 FÁZE 6: GENESIS REHEARSAL (Týden 14-15)

### Cíl: Dry-run MainNet launch

### Úkoly

#### 6.1 Isolated Network
- [ ] 3 seed nodes (different regions)
- [ ] Finální genesis config
- [ ] No external connectivity

#### 6.2 Genesis Ceremony
```bash
# Skriptovatelný proces
1. Freeze repo (tag v2.9.5-mainnet)
2. Build binaries (publish checksums)
3. Generate genesis block OFFLINE
4. Deploy to seed nodes
5. Verify sync across all nodes
```

#### 6.3 Runbook Testing
- [ ] Node restart test
- [ ] Network partition test
- [ ] Rollback procedure test

### Exit Criteria
- [ ] Rehearsal úspěšná (3x opakování)
- [ ] Runbook je skriptovatelný
- [ ] Go/No-Go checklist ready

### Deliverables
- `scripts/genesis_ceremony.sh`
- `docs/mainnet/RUNBOOK.md`
- `docs/mainnet/GO_NOGO_CHECKLIST.md`

---

## 🎯 FÁZE 7: MAINNET LAUNCH (Týden 16+)

### Pre-Launch Checklist

#### Technical
- [ ] Fáze 0-6 kompletní
- [ ] All unit tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met

#### Legal
- [ ] `legal/DISCLAIMER.md` publikován
- [ ] `legal/TOKEN_NOT_SECURITY.md` publikován
- [ ] `legal/PREMINE_DISCLOSURE.md` publikován

#### Community
- [ ] Announcement prepared
- [ ] Documentation published
- [ ] Support channels ready

#### Exchange Prep
- [ ] CMC application ready
- [ ] CoinGecko application ready
- [ ] Explorer public URL
- [ ] Node setup guide

### Launch Sequence

```
T-7 days:  Final freeze, no more changes
T-3 days:  Pre-announcement, seed nodes deployed
T-1 day:   Genesis block created, hash published
T-0:       Mining opened, announcement published
T+1 hour:  First block mined (expected)
T+24h:     Health check, public stats
T+7 days:  Stability report
T+30 days: CMC/CoinGecko listing expected
```

### Post-Launch

- [ ] Monitor network health 24/7
- [ ] Hotfix procedure ready
- [ ] Community feedback channel
- [ ] Exchange integration support

---

## 📅 TIMELINE SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│  ZION MAINNET ROADMAP TIMELINE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Week 1      │ FÁZE 0: Reality Lock                            │
│  Week 2-3    │ FÁZE 1: Spec Freeze                             │
│  Week 4-7    │ FÁZE 2: Wallet MVP ─────────────────┐           │
│  Week 6-8    │ FÁZE 3: Explorer API ──────────────┤ Parallel   │
│  Week 8-10   │ FÁZE 4: Pool Hardening ────────────┘           │
│  Week 10-14  │ FÁZE 5: Security Hardening                      │
│  Week 14-15  │ FÁZE 6: Genesis Rehearsal                       │
│  Week 16+    │ FÁZE 7: MAINNET LAUNCH 🚀                       │
│                                                                 │
│  Estimated Total: 16-20 týdnů (full-time)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 TRACKING BOARD

### Fáze Status

| Fáze | Název | Status | Progress |
|------|-------|--------|----------|
| 0 | Reality Lock | 🔴 Not Started | 0% |
| 1 | Spec Freeze | 🔴 Not Started | 0% |
| 2 | Wallet MVP | 🔴 Not Started | 0% |
| 3 | Explorer API | 🔴 Not Started | 0% |
| 4 | Pool Hardening | 🔴 Not Started | 0% |
| 5 | Security | 🔴 Not Started | 0% |
| 6 | Rehearsal | 🔴 Not Started | 0% |
| 7 | Launch | 🔴 Not Started | 0% |

### Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Config Unified | Week 1 | 🔴 |
| Genesis Frozen | Week 3 | 🔴 |
| Wallet Working | Week 7 | 🔴 |
| Explorer Live | Week 8 | 🔴 |
| Pool Stable | Week 10 | 🔴 |
| Audit Ready | Week 14 | 🔴 |
| Rehearsal Done | Week 15 | 🔴 |
| **MAINNET** | Week 16+ | 🔴 |

---

## 🔧 TOOLS & RESOURCES

### Development
- Rust toolchain: 1.93.0+
- Docker: 24.0+
- Cargo workspaces

### Monitoring
- Prometheus: metrics collection
- Grafana: visualization
- Alertmanager: alerts

### CI/CD
- GitHub Actions (recommended)
- Docker Hub for images
- Release checksums

### Communication
- Discord/Telegram for community
- GitHub Issues for bugs
- GitHub Discussions for features

---

## ⚠️ RIZIKA & MITIGACE

| Riziko | Pravděpodobnost | Dopad | Mitigace |
|--------|-----------------|-------|----------|
| Wallet development delay | Střední | Vysoký | Paralelní vývoj, prioritizace |
| P2P instabilita | Střední | Vysoký | Více testování, fallback na known peers |
| Security vulnerability | Nízká | Kritický | Audit, fuzzing, bug bounty |
| Exchange rejection | Střední | Střední | Kvalitní dokumentace, responsivita |
| Community adoption slow | Střední | Střední | Marketing, education, incentives |

---

## 📞 CONTACTS & OWNERSHIP

| Oblast | Owner | Backup |
|--------|-------|--------|
| Core Development | TBD | TBD |
| Pool Operations | TBD | TBD |
| Security | TBD | TBD |
| Documentation | TBD | TBD |
| Community | TBD | TBD |

---

## 🎯 NEXT IMMEDIATE ACTIONS

1. **Dnes:** Review tohoto dokumentu, potvrzení timeline
2. **Tento týden:** Zahájit Fázi 0 (Reality Lock)
3. **Do 7 dní:** Port matrix unifikace hotová
4. **Do 14 dní:** Spec freeze zahájeno

---

*Roadmap Version: 1.0*  
*Created: 2026-02-03*  
*Last Updated: 2026-02-03*
