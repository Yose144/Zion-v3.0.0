# 📋 ZION TerraNova — TODO

> **Aktualizace:** Session 24 — 23. února 2026  
> **Cíl:** MainNet Genesis **31. 12. 2026**  
> **Detaily:** `docs/MAINNET_CHECKLIST.md` | `docs/L2_DEFI_PLAN.md` | `docs/L3_WARP_AI_PLAN.md`

---

## � Plán na zítra — 24. února 2026

> Buildy `zion-miner:2.9.6-testnet` běží na SeedDE/Usa1/Usa2/Asia3 od 23.2. večer (~15–20 min cargo). Zítra ráno ověřit + spustit minery a validovat workflow.

### 🔴 Priorita 1 — Minery (nutné ověřit mining workflow)

- [ ] **[M-1] Ověřit build dokončen** na všech 4 seed serverech
  ```bash
  for host in zion-seedde zion-usa1 zion-usa2 zion-asia3; do
    ssh $host 'docker images | grep miner && tail -3 /tmp/miner-build.log'
  done
  ```
- [ ] **[M-2] Spustit minery** přes compose na všech 4 serverech
  ```bash
  for host in zion-seedde zion-usa1 zion-usa2 zion-asia3; do
    ssh $host 'docker compose -f /root/docker-compose-seed.yml up -d miner'
  done
  ```
- [ ] **[M-3] Ověřit logy** — RandomX init + stratum job + share submit
  ```bash
  for host in zion-seedde zion-usa1 zion-usa2 zion-asia3; do
    ssh $host 'docker logs zion-miner --tail 20'
  done
  ```
- [ ] **[M-4] Pool stats** — ověřit že 4 workery vidí pool na Helsinki
  ```bash
  ssh zion-helsinki 'curl -s http://localhost:8080/stats | python3 -m json.tool | grep -E "worker|miner|hash|connected"'
  ```

### 🟡 Priorita 2 — Website + DAO

- [ ] **[W-1] Helsinki website rebuild** — `dao-api.ts` fix (commit `dfa4dae`) nasadit
  ```bash
  ssh zion-helsinki 'cd /root/zion-2.9.6 && docker build -t zion-website:dao-fix -f APP&WEB/website-v2.9/Dockerfile . && docker stop zion-website && docker run -d --name zion-website-new ... '
  ```
  nebo přes rsync + docker compose up --force-recreate
- [ ] **[W-2] Ověřit /dao stránku** na https://zionterranova.com/dao — `daemonOnline` = false, info notice viditelný, žádné error bannery

### 🟢 Priorita 3 — Stabilita + monitoring

- [ ] **[S-1] Zkontrolovat 168h stability run** — progress ke dni 2/7
  ```bash
  ssh zion-helsinki 'tail -20 /root/stability_run_v2.log'
  ```
- [ ] **[S-2] Block height** — všechny nody synced (kontrola h > 4200)
- [ ] **[S-3]** Pokud minery jedou → nechat běžet 24h, zkontrolovat hashrate a share acceptance rate

### 📌 Poznámky k nasazení

| Server | Worker | Pool | Status cíl |
|--------|--------|------|-----------|
| SeedDE | `seedde-miner` | 77.42.31.72:3333 | ✅ mining |
| Usa1 | `usa1-miner` | 77.42.31.72:3333 | ✅ mining |
| Usa2 | `usa2-miner` | 77.42.31.72:3333 | ✅ mining |
| Asia3 | `asia3-miner` | 77.42.31.72:3333 | ✅ mining |
| Helsinki | `testnet-miner` | localhost:3333 | ✅ již běží |

**Pokud build selhal znovu:** zkontrolovat chybu v `/tmp/miner-build.log`, opravit, znovu rsync + build.

---

## �🔴 P0 — MainNet Blokery (10 zbývá z 14) — 4 hotovo: P0-02, P0-03, P0-04, P0-06

### Fáze 1 — Stabilita (únor–březen)

- [ ] **P0-01** 14 dní bez critical bugu *(countdown od 16.2.)*
- [x] **P0-02** Orphan rate < 2% — `pool_orphan_blocks_total` counter + `pool_orphan_rate_permille` gauge ✅ *(Session 22, commit `023528d`)*
- [x] **P0-03** 72h stability run *(restart #3, od 10.2.)*

### Fáze 3 — Infrastruktura (Q2–Q3)

- [x] **P0-04** 5 seed nodů — Helsinki ✅ SeedDE ✅ Usa1 ✅ Usa2 ✅ Asia3 ✅ — všechny běží + **miner nasadzen na všechny 4 seed nody** *(22.2.2026; fix `is_multiple_of()` → `% n == 0` pro stable Rust 1.85, commit `ef4b105`, Session 24)*
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

- [x] Block size limit (max 1 MB) ✅ `MAX_BLOCK_SIZE_BYTES = 1_048_576`, step-0 v `validate_block()` *(Session 22)*
- [x] TX size limit (max 100 KB) ✅ `MAX_TX_SIZE_BYTES = 100_000` již existovalo *(před Session 22)*
- [x] Peer limit enforcement (96 in / 32 out) ✅ `allow_inbound(128, 32)` *(Session 22)*
- [ ] DDoS ochrana seed nodů
- [ ] LMDB backup strategie → offsite
- [ ] Bug bounty program

### Test Coverage

- [x] Pool testy 31 → 60+ ✅ **96 testů** *(wZION 48 + ZIONBridge 34 + E2E 14)*
- [x] Miner testy 16 → 40+ ✅ **73 testů**
- [x] Cosmic Harmony testy 24 → 50+ ✅ **48 testů** *(CHv3 finální)*
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

- [x] **B-05** Testnet deploy (Base Sepolia) ✅ *wZION `0x0c49...` + ZIONBridge `0xa5a0...` LIVE (21.2.2026)*
- [x] **B-06** E2E test ✅ *96/96 Hardhat + 16/16 Rust relay*
- [x] **B-02** WS auto-reconnect ✅ *exponenciální backoff 5→80s, MAX_RETRIES=5 (Session 18)*
- [x] **B-03** Bridge Prometheus `/metrics` HTTP endpoint ✅ *(port 9100, 11 metrik, Session 19)*
- [x] **WEB-01** Bridge stránka `/bridge` na webu ✅ *(`page.tsx` + `/api/bridge/status` proxy + Nav+Footer, Session 19)*
- [x] **B-01** L1 `/api/bridge/unlock` endpoint ✅ *(Ed25519 vault key, coin selection, signed TX → mempool, Session 19)*
- [ ] **B-04** Private key management (ne plaintext)
- [ ] **B-10** Mainnet deploy (Base + Arbitrum)
- [x] **D-01** DAO SQLite persistence + migrations ✅ *(Session 17)*
- [x] **D-03** L1 memo scanner (treasury příchozí platby) ✅ *(Session 17)*
- [x] **D-05** DAO executor — Parameter, Emergency, guardian multisig ✅ *(Session 18)*
- [x] **D-07** DAO integration testy (38 testů, E2E lifecycle) ✅ *(Session 18)*
- [x] **D-06** TOML konfig pro DAO daemon ✅ *(`DaoConfig::load()`, TOML file + env var override, `config/dao-testnet.toml`, Session 20)*
- [x] **D-09** Prometheus metriky pro DAO ✅ *(`GET /metrics`, 17 metrik, Session 19)*
- [x] **D-10** DAO web integrace ✅ *(`dao-api.ts` přepsán pro Rust `/api/dao/*`, `dao/page.tsx` graceful offline, commit `dfa4dae`, Session 24)*
- [x] **DEX-01** wZION/ETH Uniswap V3 pool deploy (Base Mainnet) ✅ *(scripts/deploy-pool.ts, Session 18)*
- [x] **DEX-02** Liquidity seeding script ✅ *(scripts/seed-liquidity.ts, Session 18)*
- [ ] **DEX-03** Price oracle + slippage guard
- [ ] Atomic Swaps design + BTC HTLC prototype
- [ ] Solidity contracts audit

> Detail: `docs/L2_DEFI_PLAN.md` — 34 úkolů, ~75 dní práce, +6k LOC

---

## 🧠 L3 WARP & AI (2027 Q3 → 2028 Q1)

```
WARP 75% (7 stub adaptérů) | NCL 30% | AI-Native 20%
```

- [x] **W-01** EVM adapter (ethers-rs → reálné RPC) ✅ *(Session 17)*
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
- [x] Nové repo ✅ *(Yose144/2.9.6 — commit `0d92fe0`)*
- [x] SSH klíč vygenerován (`~/.ssh/zion_servers_ed25519`)
- [x] SSH config pro 5 serverů (Helsinki, Germany, USA, Singapore, Japan)
- [x] Deploy skript `scripts/deploy-new-node.sh` připraven

---

## 📊 Souhrn

| Oblast | Položek | Hotovo | Zbývá |
|--------|---------|--------|-------|
| P0 Blokery | 14 | 3 | **11** |
| P1 Test Coverage | 4 | 3 | **1** |
| P1 Ostatní | 14 | 0 | **14** |
| L2 DeFi | 34 | 2 | **32** |
| L3 WARP/AI | 39 | 0 | **39** |
| Infra | 5 | 1 | **4** |
| **Celkem** | **110** | **9→14** | **101→96** |

> ⏱️ Celkový odhad práce: **~260 dní** (L1 launch + L2 + L3 + infra)  
> 🎯 L1 MainNet: **31. 12. 2026** | L2: **2027 Q2** | L3: **2028 Q1**
