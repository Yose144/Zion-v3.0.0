# 🚀 ZION v2.9.5 TestNet Roadmap — Leden-Únor 2026

**Vytvořeno:** 30. ledna 2026  
**Cíl:** Kompletní TestNet s multi-node P2P sítí  
**Server:** TreeOfLife-Zion (77.42.31.72)

---

## 📊 Aktuální Stav (31.1.2026)

| Komponenta | Status | Poznámka |
|------------|--------|----------|
| Core Blockchain | ✅ Běží | Height: 2, Payouts enabled |
| Mining Pool | ✅ Běží | Payout loop active |
| Redis | ✅ Běží | Cache funkční |
| P2P Network | ✅ **2 NODY** | Helsinki ↔ USA synced |
| Miner | ⚠️ Test | Rust miner runs, shares submitted |

### 🌐 P2P Síť - LIVE
| Node | IP | Port | Status |
|------|-----|------|--------|
| Helsinki (SEED) | 77.42.31.72 | 8334 | ✅ Online |
| USA (PEER 1) | 5.78.145.234 | 8335 | ✅ Online |
| Singapore (PEER 2) | 5.223.56.124 | 8336 | ✅ Online |

---

## 🎯 FÁZE 1: Základní Funkčnost (31.1. - 2.2.2026)

### Milestone 1.1: Test Mining Loop ⬅️ AKTUÁLNĚ
**Cíl:** Ověřit že miner → pool → core flow funguje

- [x] **1.1.1** Spustit Python miner z lokálu proti `77.42.31.72:3333` (Executed Rust miner successfully)
- [x] **1.1.2** Ověřit share acceptance (target: 90%+) (Verified: 294 shares submitted)
- [x] **1.1.3** Ověřit block submission a height increment (Miner job height=2, P2P sync active)
- [ ] **1.1.4** Zkontrolovat payout queue

**Příkazy:**
```bash
# Z lokálu (macOS) - Rust Miner:
cd 2.9.5/zion-universal-miner
cargo run --release --features gpu -- --pool stratum+tcp://77.42.31.72:3333 --wallet zion1q893q6c5j7y0e3r062g4m7c240t5g294k7z6729 --gpu
```

### Milestone 1.2: P2P Bootstrap ⬅️ DOKONČENO
**Cíl:** Rozběhnout P2P síť alespoň mezi 2 nody

- [x] **1.2.1** Zkontrolovat seed nodes v `seeds.rs`
- [x] **1.2.2** Otevřít firewall port 8334 na serveru
- [x] **1.2.3** Spustit druhý node (nebo lokálně, nebo druhý VPS)
- [x] **1.2.4** Ověřit peer discovery a handshake
- [x] **1.2.5** Ověřit block propagation mezi nody (Sync verified, mining pending)

**Příkazy:**
```bash
# Na serveru - check firewall:
ssh root@77.42.31.72 "ufw status; ufw allow 8334/tcp"

# Lokální test node:
cargo run --release -p zion-core -- --rpc-port 18444 --p2p-port 18334 --peers 77.42.31.72:8334
```

---

## 🎯 FÁZE 2: Multi-Node TestNet (3.2. - 9.2.2026)

### Milestone 2.1: 3-Node Síť ⬅️ DOKONČENO (31.1.2026)
**Cíl:** Stabilní síť s 3 nody

- [x] **2.1.1** Deploy node na USA VPS (5.78.145.234) ✅ ONLINE
- [x] **2.1.2** Deploy node na Singapore VPS (5.223.56.124) ✅ ONLINE
- [x] **2.1.3** Ověřit cross-region block sync (Helsinki ↔ USA ↔ Singapore synced)
- [ ] **2.1.4** Test reorg handling (simulace)

**Aktuální P2P Status (31.1.2026):**
```
Helsinki (77.42.31.72:8334) - PRIMARY SEED ✅
  └── USA (5.78.145.234:8335) - PEER 1 ✅ Connected & Synced
  └── Singapore (5.223.56.124:8336) - PEER 2 ✅ Connected & Synced
```

### Milestone 2.2: Stress Test Mining
**Cíl:** 10+ minerů současně

- [ ] **2.2.1** Spustit 5 minerů z různých IP
- [ ] **2.2.2** Monitor pool stats (hashrate, shares)
- [ ] **2.2.3** Ověřit VarDiff adjustments
- [ ] **2.2.4** Měřit block time stability (~60s target)

---

## 🎯 FÁZE 3: Payouts & Wallet (10.2. - 16.2.2026)

### Milestone 3.1: Payout Execution
**Cíl:** Reálné payouty na TestNet

- [ ] **3.1.1** Nakonfigurovat payout threshold (0.1 ZION)
- [ ] **3.1.2** Trigger manual payout run
- [ ] **3.1.3** Ověřit TX v blockchain
- [ ] **3.1.4** Test multiple miner payouts

### Milestone 3.2: Wallet Integration
**Cíl:** Mobile wallet funguje s TestNet

- [ ] **3.2.1** Připojit mobile wallet na RPC
- [ ] **3.2.2** Test send/receive ZION
- [ ] **3.2.3** Test balance updates po miningu

---

## 🎯 FÁZE 4: Dashboard & API (17.2. - 23.2.2026)

### Milestone 4.1: Frontend Kompatibilita
**Cíl:** Dashboard zobrazuje real data

- [ ] **4.1.1** Přidat `/api/pool` endpoint do Rust
- [ ] **4.1.2** Přidat historical stats worker
- [ ] **4.1.3** Fix API response format pro frontend
- [ ] **4.1.4** Test grafy a charts

### Milestone 4.2: Block Explorer
**Cíl:** Základní explorer API

- [ ] **4.2.1** `/api/blocks` - list bloků
- [ ] **4.2.2** `/api/block/{hash}` - detail bloku
- [ ] **4.2.3** `/api/tx/{hash}` - detail transakce
- [ ] **4.2.4** `/api/address/{addr}` - balance a history

---

## 🎯 FÁZE 5: GPU Mining (24.2. - 2.3.2026)

### Milestone 5.1: Metal (macOS) Integration
**Cíl:** GPU mining na Apple Silicon

- [ ] **5.1.1** Sjednotit Cosmic Harmony verzi (v1 vs v3)
- [ ] **5.1.2** Test Metal miner proti poolu
- [ ] **5.1.3** Benchmark hashrate (target: 5+ MH/s)

### Milestone 5.2: CUDA/OpenCL
**Cíl:** GPU mining na NVIDIA/AMD

- [ ] **5.2.1** Test OpenCL miner
- [ ] **5.2.2** Test CUDA miner (pokud dostupné)
- [ ] **5.2.3** Multi-GPU support

---

## 🎯 FÁZE 6: Security & Audit (3.3. - 16.3.2026)

### Milestone 6.1: Security Hardening
- [ ] **6.1.1** Enable P2P TLS encryption
- [ ] **6.1.2** Rate limiting audit
- [ ] **6.1.3** DDoS protection test

### Milestone 6.2: External Audit
- [ ] **6.2.1** Připravit audit scope
- [ ] **6.2.2** Najít audit firmu
- [ ] **6.2.3** Fix findings

---

## 📈 Metriky Úspěchu

| Metrika | Target | Aktuálně |
|---------|--------|----------|
| P2P Peers | 3+ | 0 |
| Block Height | 100+ | 4 |
| Share Acceptance | 95%+ | ~54% |
| Active Miners | 5+ | 0 |
| Avg Block Time | 60s ±10% | N/A |
| Payout Success | 100% | 0% (untested) |

---

## 🔧 Denní Check Commands

```bash
# Server status
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "
  curl -s http://127.0.0.1:8444/health | jq .
  curl -s http://127.0.0.1:8080/stats | jq .
  docker ps
"

# Start mining
python3 zion_native_miner_v2_9.py --pool 77.42.31.72:3333 --wallet zion1test --algorithm cosmic_harmony

# Check logs
ssh root@77.42.31.72 "docker logs -f zion-pool"
```

---

## 📅 Kalendář

| Týden | Fáze | Milestone |
|-------|------|-----------|
| 31.1-2.2 | 1 | Basic Mining + P2P |
| 3.2-9.2 | 2 | Multi-Node |
| 10.2-16.2 | 3 | Payouts |
| 17.2-23.2 | 4 | Dashboard |
| 24.2-2.3 | 5 | GPU Mining |
| 3.3-16.3 | 6 | Security |

---

**🎯 MainNet ETA:** Q4 2026 (po úspěšném TestNet a auditu)

---

*Tento dokument je živý a bude aktualizován průběžně.*
