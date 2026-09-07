# ✅ ZION MainNet Launch Checklist

**Comprehensive checklist for MainNet readiness**

> 🔄 Aktualizace: 28. 3. 2026 — checklist doplněn o ověřený V3 fee-split rollout a live post-deploy audit

## Recent Verified Milestone

- ✅ V3 core reward split je ověřen přímo on-chain, ne pouze v pool accounting vrstvě
- ✅ Live ověřené rozdělení block subsidy: miner `89%`, humanitarian `5%`, issobella `5%`, pool fee `1%`
- ✅ První explicitně potvrzený split-enabled blok: `465`
- ✅ Následné potvrzení na auditovaných nodech: bloky `471` a `472`
- ✅ Referenční rollout report: `docs/reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md`

---

## 🔴 PHASE 0 — SPEC FREEZE (P0 Critical)

### Genesis & Supply
- ✅ Genesis parametry definovány (chain id, timestamp, supply) — `consensus.rs`, `reward.rs`, `premine.rs`
- ⚠️ `genesis.json` / `genesis.rs` — GENESIS_MESSAGE.txt placeholder existuje; formální genesis blok NENAPLNĚN před mainnet
- ✅ Emission křivka implementována — `reward.rs` (decade decay, tail 724 ZION, 100+ let)
- ✅ On-chain reward split enforcement ověřen ve V3 core — live potvrzené coinbase rozdělení `89/5/5/1`
- ✅ Premine rozdělení finální — `premine.rs` (4 kategorie, 16.78B ZION)
- ⚠️ Time-lock mechanismus — pole `unlock_height` v kódu existuje; on-chain enforcement **není aktivní v v2.9.5**, řídí DAO governance
- [ ] Hash genesis souboru publikován — blokováno do vytvoření genesis bloku OFFLINE

### DAA & Consensus
- ✅ DAA finální implementace — LWMA, window 60, ±25%, clamp 30–120 s (`consensus.rs`)
- ✅ Max reorg depth definován — 10 bloků (`docs/mainnet/MAINNET_CONSTITUTION.md`)
- ✅ Finality window definován — 60 bloků (soft finality)
- ✅ Fork-choice rule implementován — highest accumulated work (`reorg.rs`)

### Exit Criteria
- ⚠️ `MAINNET_EXIT_CRITERIA.md` existuje, ale je stále `DRAFT` a bez sign-offu — launch blocker do finálního schválení
- [ ] CI job: `mainnet_correctness_suite` nebo ekvivalentní explicitní launch-gating workflow

---

## 🟠 PHASE 1 — CORE CORRECTNESS (P0)

### Test Suite
- ✅ Reorg test suite — `reorg.rs` + `L1/core/tests/genesis_verification.rs` existuje
- [ ] Double-spend simulace — **CHYBÍ**
- [ ] Fork-choice testy — logika v `reorg.rs`, ale integrační test chybí
- ✅ Time drift / timestamp sanity — `validation.rs` (testnet 86400 s, mainnet 7200 s) ⚠️ zkontrolovat přepnutí při launch
- ✅ Live payout workflow ověřen na V3 mainnet rolloutu včetně cross-node akceptace nových split bloků
- [ ] Mempool edge cases
- ✅ Max block size DoS ochrana — `validation.rs` limit 1 MB blokuje OOM

### Node Stability
- [ ] Node restart mid-block test
- [ ] Network partition scénáře (2-3)
- [ ] Clock skew tolerance test
- 🔄 Aktivní runtime je Prague-only; případné nové geo nody musí projít samostatným rehearsal a closure reportem

---

## 🟡 PHASE 2 — NODE & MINING (P1)

### Node UX
- [ ] README: "run full node in 10 min"
- ✅ Jednotná config struktura — `config/testnet.toml`, `config/mainnet.toml`
- [ ] Logy srozumitelné pro lidi
- [ ] Panic → error handling
- [ ] `docs/run-node.md` hotový

### Mining Reality
- [ ] CPU mining baseline (low-end stroje)
- ✅ GPU mining — Rust miner s OpenCL (AMD RX 5600 XT) implementován a otestován
- [ ] Pool failover scénáře
- [ ] Solo vs pool parity
- ⚠️ Algoritmus rotace (Blake3/RandomX/Yescrypt) zakomentována pro testnet — **rozhodnout před mainnet**
- [ ] Mining dokumentace

---

## 🟢 PHASE 3 — INFRASTRUCTURE (P1)

### Seed & Bootstrap
- ✅ Min. 3 geografické seed nody — Prague / USA / Singapore auditovány po V3 fee-split rolloutu 28. 3. 2026
- ✅ Monitoring (Prometheus/Grafana) — běží na Helsinki (port 3001/9090)
- [ ] Alerty (disk, peers, block lag) — **Alertmanager routing CHYBÍ** (Telegram/Slack)
- [ ] Zálohy dat

### Docker & Deploy
- ✅ `docker-compose.mainnet.yml` — existuje
- ✅ `ops/runbook.md` — existuje
- ✅ V3 rollout verification checklist doplněn — `docs/mainnet/V3_ROLLOUT_VERIFICATION_CHECKLIST.md`
- [ ] Docker images published na registry
- [ ] Checksums / SHA256 publikovány

---

## 🔵 PHASE 4 — LAUNCH CEREMONY

### Pre-Launch
- [ ] Repo tag (`v2.9.5-mainnet`)
- [ ] Build binárek (hash publikovaný)
- [ ] Genesis block vytvořen OFFLINE
- [ ] Seed nody ready
- [ ] 72h rehearsal closure report publikován včetně restart / recovery appendixu

### Launch Sequence
- [ ] Genesis freeze ✓
- [ ] Seed online ✓
- [ ] Mining open ✓
- [ ] Announcement (blog + Discord)

---

## 🟣 PHASE 5 — POST-LAUNCH (0-90 days)

### Stabilization
- [ ] Monitor orphan rate
- [ ] Monitor difficulty stability
- [ ] Monitor peer churn
- [ ] Bugfix releases ready

### Governance v1
- [ ] DAO read-only → proposal → hlasování
- [ ] První testovací proposal
- [ ] Quorum pravidla aktivní

---

## 📊 EXCHANGE READINESS

### Required Infrastructure
- [ ] Block explorer běží
- [ ] API endpointy funkční
- [ ] Circulating supply výpočet
- [ ] Node setup guide pro burzy

### Documentation
- [ ] Whitepaper (PDF)
- [ ] Legal disclaimer
- [ ] Premine disclosure
- [ ] Token-not-security statement

### CoinMarketCap/CoinGecko
- [ ] Oficiální web
- [ ] GitHub public
- [ ] Logo (SVG/PNG)
- [ ] Supply info (max / circulating)
- [ ] Kontaktní email

---

## 🛡️ LEGAL COMPLIANCE

### Documents Ready
- [ ] `/legal/DISCLAIMER.md`
- [ ] `/legal/TOKEN-NOT-SECURITY.md`
- [ ] `/legal/NO-INVESTMENT.md`
- [ ] `/legal/RISK-DISCLOSURE.md`
- [ ] `/legal/PREMINE-DISCLOSURE.md`

### Communication Guidelines
- [ ] No "investment" language
- [ ] No price predictions
- [ ] No profit promises
- [ ] Clear experimental disclaimer

---

## 📝 Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Core Dev | | | |
| Ops Lead | | | |
| Community | | | |

---

**🔥 MAINNET LAUNCH DATE: TBD**

---

*Checklist Version: 1.1*  
*Last Updated: 2026-03-28 (V3 fee-split rollout verification)*
