# ✅ ZION MainNet Launch Checklist

**Comprehensive checklist for MainNet readiness**

---

## 🔴 PHASE 0 — SPEC FREEZE (P0 Critical)

### Genesis & Supply
- [ ] Genesis parametry definovány (chain id, timestamp, supply)
- [ ] `genesis.json` / `genesis.rs` vytvořen
- [ ] Emission křivka implementována (reward vs height)
- [ ] Premine rozdělení finální
- [ ] Time-lock mechanismus implementován
- [ ] Hash genesis souboru publikován

### DAA & Consensus
- [ ] DAA finální implementace (bez TODO)
- [ ] Max reorg depth definován
- [ ] Finality window definován
- [ ] Fork-choice rule implementován

### Exit Criteria
- [ ] `mainnet_exit_criteria.md` vytvořen
- [ ] CI job: `mainnet_correctness_suite`

---

## 🟠 PHASE 1 — CORE CORRECTNESS (P0)

### Test Suite
- [ ] Reorg test suite (short + long)
- [ ] Double-spend simulace
- [ ] Fork-choice testy
- [ ] Time drift / timestamp sanity
- [ ] Mempool edge cases
- [ ] DoS basic ochrany (rate limit, peers)

### Node Stability
- [ ] Node restart mid-block test
- [ ] Network partition scénáře (2-3)
- [ ] Clock skew tolerance test
- [ ] 72-168h stability run bez restartu

---

## 🟡 PHASE 2 — NODE & MINING (P1)

### Node UX
- [ ] README: "run full node in 10 min"
- [ ] Jednotná config struktura
- [ ] Logy srozumitelné pro lidi
- [ ] Panic → error handling
- [ ] `docs/run-node.md` hotový

### Mining Reality
- [ ] CPU mining baseline (low-end stroje)
- [ ] GPU mining stabilita
- [ ] Pool failover scénáře
- [ ] Solo vs pool parity
- [ ] Mining dokumentace

---

## 🟢 PHASE 3 — INFRASTRUCTURE (P1)

### Seed & Bootstrap
- [ ] Min. 3 geografické seed nody
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Alerty (disk, peers, block lag)
- [ ] Zálohy dat

### Docker & Deploy
- [ ] `docker-compose.mainnet.yml` hotový
- [ ] `ops/runbook.md` hotový
- [ ] Docker images published
- [ ] Checksums publikovány

---

## 🔵 PHASE 4 — LAUNCH CEREMONY

### Pre-Launch
- [ ] Repo tag (`v2.9.5-mainnet`)
- [ ] Build binárek (hash publikovaný)
- [ ] Genesis block vytvořen OFFLINE
- [ ] Seed nody ready

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

*Checklist Version: 1.0*  
*Last Updated: 2026-02-03*
