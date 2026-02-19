# 📋 ZION TerraNova — TODO

> **Aktualizace:** 17. února 2026  
> **Cíl:** MainNet Genesis **31. 12. 2026**  
> **Detaily:** `docs/MAINNET_CHECKLIST.md` | `docs/L2_DEFI_PLAN.md` | `docs/L3_WARP_AI_PLAN.md`

---

## 🔴 P0 — MainNet Blokery (11 zbývá z 14)

### Fáze 1 — Stabilita (únor–březen)

- [ ] **P0-01** 14 dní bez critical bugu *(countdown od 16.2.)*
- [ ] **P0-02** Orphan rate < 2% — Prometheus metrika + Grafana
- [x] **P0-03** 72h stability run *(restart #3, od 10.2.)*

### Fáze 3 — Infrastruktura (Q2–Q3)

- [x] **P0-04** 5 seed nodů / 5 kontinentů (EU 1 ✅, USA 1 ✅, SA 1 ✅, Asia 1 ✅, Oceánie 1 ✅)
- [ ] **P0-05** Premine klíče — air-gapped Ed25519 keypair generace
- [x] **P0-06** RPC autentizace — API key pro write endpointy *(kód hotov v `rpc/auth.rs`; nasadit: `export ZION_RPC_TOKEN=$(openssl rand -hex 32)` na každém nodu)*

### Fáze 4 — Dress Rehearsal (Q4)

- [ ] **P0-07** Genesis block test (staging, reálné premine adresy)
- [ ] **P0-08** 168h (7-day) stability run na staging
- [ ] **P0-09** 1000 miners load test *(aktuálně 60 funguje)*
- [ ] **P0-10** Disaster recovery test (pád 50% nodů)
- [ ] **P0-11** External security audit — žádný critical/high
- [ ] **P0-12** Code freeze + tag `v2.9.6-mainnet`
- [ ] **P0-13** Binární releasy (Linux, macOS, Windows)
- [ ] **P0-14** Genesis block — offline + SHA-256 hash publikace

---

## 🟡 P1 — Důležité (18 položek)

### Bezpečnost

- [ ] Block size limit (max 1 MB)
- [ ] TX size limit (max 100 KB)
- [ ] Peer limit enforcement (96 in / 32 out)
- [ ] DDoS ochrana seed nodů
- [ ] LMDB backup strategie → offsite
- [ ] Bug bounty program

### Test Coverage

- [ ] Pool testy 31 → 60+ *(nejnižší hustota: 1/466 LOC)*
- [ ] Miner testy 16 → 40+ *(stabilita hashing)*
- [ ] Cosmic Harmony testy 24 → 50+ *(fork edge cases)*
- [ ] Reorg / rollback integration testy

### Observabilita

- [ ] Grafana dashboardy (pool, node, p2p)
- [ ] Alert rules (OOM, disk, orphan, lag)

### Dokumentace

- [ ] Operator runbook (start/stop/recovery)
- [ ] Wallet dokumentace + UX
- [ ] Changelog pro community

---

## 💱 L2 DeFi (post-MainNet → 2027 Q1–Q2)

```
Bridge 80% → prod | DAO 55% → prod | Atomic Swaps 0%
```

- [ ] **B-01** L1 `/api/bridge/unlock` endpoint *(🔴 P0 — L1 modifikace)*
- [ ] **B-04** Private key management (ne plaintext)
- [ ] **B-05** Testnet deploy (Base Sepolia) → **B-06** E2E test
- [ ] **B-10** Mainnet deploy (Base + Arbitrum)
- [ ] **D-01** DAO SQLite persistence + migrations
- [ ] **D-03** L1 memo scanner (treasury příchozí platby)
- [ ] **D-05** DAO daemon (main.rs — Tokio runtime)
- [ ] Atomic Swaps design + BTC HTLC prototype
- [ ] Solidity contracts audit

> Detail: `docs/L2_DEFI_PLAN.md` — 34 úkolů, ~75 dní práce, +6k LOC

---

## 🧠 L3 WARP & AI (2027 Q3 → 2028 Q1)

```
WARP 75% (7 stub adaptérů) | NCL 30% | AI-Native 20%
```

- [ ] **W-01** EVM adapter (ethers-rs → reálné RPC) *(🔴 P0)*
- [ ] **W-02** Bitcoin adapter (bitcoincore-rpc)
- [ ] **W-05** Solana adapter (solana-client)
- [ ] **N-01** ONNX Runtime backend
- [ ] **N-04** Marketplace HTTP server (Axum)
- [ ] **N-07** SQLite persistence pro joby
- [ ] **A-01** HTTP API server (Axum)
- [ ] **A-03** LLM integrace (OpenAI / local)
- [ ] **A-07** WebSocket real-time stream

> Detail: `docs/L3_WARP_AI_PLAN.md` — 39 úkolů, ~85 dní práce, +11k LOC

---

## 🎮 L4 OASIS (2029)

- [ ] OASIS game-layer skeleton → real XP engine
- [ ] Golden Egg + Winners integration

## 🌍 L5 Free World (2030) / 🔭 L6 Issobella (2040+)

- [x] Vision dokumenty vytvořeny (`L5/README.md`, `L6/README.md`)
- [ ] L5/L6 coinbase fund distribuce v `reward.rs`

---

## 🛠️ Infra & DevOps

- [ ] CI/CD — GitHub Actions pro 3 OS releasy
- [ ] Docker image optimalizace (multi-stage, < 100 MB)
- [ ] Monitoring stack: Prometheus + Grafana + Alertmanager
- [ ] Automatický testnet deployment (push → deploy)
- [ ] Nové repo (git corrupted — nutno založit nové)
- [x] SSH klíč vygenerován (`~/.ssh/zion_servers_ed25519`)
- [x] SSH config pro 5 serverů (Helsinki, Germany, USA, Singapore, Japan)
- [x] Deploy skript `scripts/deploy-new-node.sh` připraven

---

## 📊 Souhrn

| Oblast | Položek | Hotovo | Zbývá |
|--------|---------|--------|-------|
| P0 Blokery | 14 | 3 | **11** |
| P1 Důležité | 18 | 6 | **12** |
| L2 DeFi | 34 | 0 | **34** |
| L3 WARP/AI | 39 | 0 | **39** |
| Infra | 5 | 0 | **5** |
| **Celkem** | **110** | **9** | **101** |

> ⏱️ Celkový odhad práce: **~260 dní** (L1 launch + L2 + L3 + infra)  
> 🎯 L1 MainNet: **31. 12. 2026** | L2: **2027 Q2** | L3: **2028 Q1**
