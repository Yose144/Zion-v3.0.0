# ZION V3 — Comprehensive Upgrade Plan

> **Datum:** 2026-03-17
> **Status:** AKTIVNÍ — hlavní pracovní dokument pro všechny V3 upgrady
> **Scope:** Miner hardening, pool production readiness, monitoring stack, dashboard, infra, public release

---

## Přehled stavu

V3 mainnet kódová základna je **funkčně kompletní** pro consensus, node, pool a miner.
Canary stack na Hetzner Edge (Core + Edge topology) běží, 5/5 accepted shares potvrzeno, revenue routing operační.

**Co máme:**
- Ekam Deeksha PoW — kanonický, otestovaný, stabilní
- Node s 474+ testy, LMDB persistence, P2P relay, IBD, RPC
- Pool s revenue routing, session pinning, multistream scheduler
- Miner s local/remote režimem, DCR stealth worker, GPU OpenCL, telemetrie
- Docker images (node, pool, miner) — multi-stage production builds
- Canary compose stack deployed, chain height 110+

**Co chybí pro produkci:**
- Miner není production-ready pro veřejnost (UX, error handling, documentation)
- Žádný monitoring stack (Grafana, Prometheus, alerting)
- Dashboard je jen PowerShell snapshot, ne live service
- Server stack je bare minimum (docker compose, žádné metriky, žádné logy)
- CI/CD pipeline neexistuje
- Native FFI testy chybí
- BFG scrub premine keys

---

## Upgrade Plán — 7 fází

### Fáze A: Miner Production Hardening

**Priorita:** KRITICKÁ — bez tohoto nemůže veřejnost těžit
**Odhadovaná složitost:** Velká
**Závislosti:** Žádné

#### A1. Error Handling & Graceful Degradation

| Položka | Aktuální stav | Cíl |
|---------|---------------|-----|
| Panic na huge page alloc failure | `panic!()` | Graceful fallback na standardní alokaci + warning log |
| SSH/TCP connection loss | Miner crashne | Reconnect loop s exponential backoff (1s → 30s → 5min cap) |
| Invalid pool response | Unwrap panic | Structured error + skip iteration |
| GPU OpenCL init failure | Crash | CPU fallback + user-visible warning |
| ONNX/NPU load failure | catch_unwind | Clean feature-gate + startup diagnostic |

#### A2. Miner UX pro veřejnost

| Položka | Popis |
|---------|-------|
| `--help` / `--version` CLI | clap-based CLI s popisky všech env vars a příkladů |
| Config file support | `miner.toml` alternativa k env vars |
| Startup banner | Logo + verze + detected hardware (CPU cores, GPU, NPU, RAM) |
| Progress bar | Hashrate, accepted/rejected, uptime, ETA do dalšího share |
| Color output | Barevný terminál (accepted=zelená, rejected=červená, info=cyan) |
| Benchmark mode | `--benchmark` pro quick hardware test bez pool connection |
| Log levels | `ZION_LOG_LEVEL=info|debug|trace|warn|error` |

#### A3. Miner Performance

| Položka | Popis |
|---------|-------|
| Multi-thread nonce scan | Rayon-based parallel nonce range partitioning |
| Batch nonce submission | Hromadný submit pro vysoké hashrate |
| Adaptive nonce window | Auto-tuned podle měřeného hashrate vs job TTL |
| Memory pool reuse | Pre-allocated scratchpad buffers místo alloc per hash |
| SIMD detection | Runtime AVX2/NEON detection pro optimized paths |

#### A4. Miner Configuration Matrix

| Profil | Popis | Defaulty |
|--------|-------|----------|
| `solo` | Přímý mining bez pool | Node RPC addr, wallet |
| `pool` | Standardní pool mining | Pool addr, worker name |
| `dual` | ZION + DCR paralelně | Pool addr + DCR pool + wallet |
| `benchmark` | Hardware test only | No network, local hashing |

#### A5. Miner Test Coverage

| Oblast | Aktuální testy | Cíl |
|--------|---------------|-----|
| Config parsing | 5 | 15 (edge cases, invalid values) |
| Session lifecycle | 2 | 10 (reconnect, timeout, stale) |
| DCR worker | 6 | 15 (GPU fallback, stratum errors) |
| Telemetry | 0 | 8 (hashrate windows, latency stats) |
| Integration | 0 | 5 (pool+miner end-to-end) |

---

### Fáze B: Pool Production Hardening

**Priorita:** VYSOKÁ — pool musí být spolehlivý pro více minerů
**Závislosti:** Fáze A (miner musí umět reconnect)

#### B1. Pool Resilience

| Položka | Popis |
|---------|-------|
| Graceful shutdown | SIGTERM handler, drain active sessions, flush stats |
| Rate limiting per IP | Prevence against spam connections |
| Max sessions per IP | Konfigurovatelný limit (default 10) |
| Job broadcast optimization | Fan-out nových jobů bez blokování |
| Memory leak audit | Session cleanup po disconnect |

#### B2. Pool Metrics Endpoint

| Endpoint | Data |
|----------|------|
| `GET /metrics` | Prometheus format: active_miners, hashrate, shares_accepted/rejected, job_count, session_duration |
| `GET /health` | JSON: `{"status":"ok","miners":N,"uptime":S}` |
| `GET /stats` | JSON: detailed pool statistics pro dashboard |

#### B3. PPLNS Payout Engine

| Položka | Popis |
|---------|-------|
| Share window | Sliding PPLNS window (last N shares) |
| Payout batch | wallet.rs batch_payout integration |
| Min payout threshold | Configurable (default 1.0 ZION) |
| Payout schedule | Every N blocks or manual trigger |
| Accounting log | Per-miner share count, earned amount, payout tx |

#### B4. Pool Test Coverage Target

| Oblast | Cíl |
|--------|-----|
| Wire protocol edge cases | 20 tests |
| Revenue routing combinations | 15 tests |
| Session lifecycle (connect/disconnect/reconnect) | 10 tests |
| PPLNS calculation accuracy | 10 tests |
| Rate limiting / DoS protection | 8 tests |

---

### Fáze C: Monitoring & Observability Stack

**Priorita:** VYSOKÁ — bez monitoringu blind-flying v produkci
**Závislosti:** Fáze B2 (pool metrics endpoint)

#### C1. Prometheus Scrape Targets

| Service | Port | Metrics Path |
|---------|------|-------------|
| Node | 9100 | `/metrics` (already implemented in `metrics.rs`) |
| Pool | 9101 | `/metrics` (new — Fáze B2) |
| Miner | 9102 | `/metrics` (new — optional local exporter) |
| Host | 9103 | node_exporter (standard) |

#### C2. Grafana Dashboards

| Dashboard | Panely |
|-----------|--------|
| **Chain Overview** | Block height, difficulty, block time avg, peer count, mempool size |
| **Mining Operations** | Pool hashrate, active miners, shares/min, accept rate, reject trend |
| **Revenue Routing** | Per-lane share distribution, Blake3/NCL/ZION ratios, USD estimates |
| **Node Health** | CPU, RAM, disk, network I/O, P2P connections, RPC latency |
| **Miner Fleet** | Per-worker hashrate, uptime, stale rate, GPU temp (if available) |

#### C3. Alerting Rules

| Alert | Podmínka | Severity |
|-------|----------|----------|
| `PoolNoMiners` | active_miners == 0 for 5min | WARN |
| `HighRejectRate` | reject_rate > 10% for 15min | CRIT |
| `ChainStalled` | no new block for 10min | CRIT |
| `NodeDown` | health check fails | CRIT |
| `DiskFull` | disk usage > 90% | WARN |
| `PeerCountLow` | peers < 3 for 10min | WARN |
| `MempoolBacklog` | mempool > 5000 txs | WARN |

#### C4. Docker Compose — Monitoring Stack

Nový soubor: `V3/docker/docker-compose.monitoring.yml`

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.2
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:11.5
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-zion_monitor}

  node-exporter:
    image: prom/node-exporter:v1.9
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    command:
      - --path.procfs=/host/proc
      - --path.sysfs=/host/sys

  alertmanager:
    image: prom/alertmanager:v0.28
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
    ports:
      - "9093:9093"
```

---

### Fáze D: Live Dashboard Service

**Priorita:** STŘEDNÍ — operátorský přehled, ne jen snapshot
**Závislosti:** Fáze C (monitoring data sources)

#### D1. Dashboard Architecture

Aktuální PowerShell snapshot dashboard (`scripts/mainnet-tests-dashboard.ps1`) zůstává jako quick-check tool.
Nový live dashboard bude Grafana-based (Fáze C2) pro produkci.

Mezikrok: rozšířit PowerShell dashboard o:

| Feature | Popis |
|---------|-------|
| Auto-refresh | `-Watch` mode s WebSocket nebo polling |
| Miner fleet view | Per-worker řádky s hashrate, shares, uptime |
| Revenue breakdown | USD estimates per stream |
| Chain explorer mini | Recent blocks s hash, miner, reward |
| Log tail | Posledních N řádků z node/pool/miner |

#### D2. Dashboard pro veřejnost (budoucí)

Webový block explorer + pool dashboard (SPA):
- Block explorer: výška, hash, txs, miner, reward, timestamp
- Pool stats: hashrate, miners, shares, payouts
- Network stats: difficulty, block time, supply
- Wallet lookup: balance, history, UTXOs

Technologie: static SPA (React/Svelte) + node JSON-RPC backend
Scope: po stabilizaci core L1 runtime

---

### Fáze E: Infrastructure & Deployment

**Priorita:** VYSOKÁ pro mainnet launch
**Závislosti:** Fáze A-C hotové

#### E1. Server Stack Hardening

| Položka | Popis |
|---------|-------|
| TLS/SSL | Nginx reverse proxy s Let's Encrypt pro RPC/API |
| Firewall rules | Pouze potřebné porty (P2P, Stratum, RPC, Grafana) |
| Log rotation | logrotate pro Docker container logy |
| Backup strategy | Automatický backup LMDB chain dat + peers.json |
| Multi-node deploy | Docker compose pro 3+ node cluster |

#### E2. CI/CD Pipeline

| Krok | Nástroj |
|------|---------|
| Lint | `cargo clippy --all-targets` |
| Test | `cargo test --workspace` |
| Build | `cargo build --release` (Linux x86_64, aarch64) |
| Docker | Build + push images to registry |
| Deploy | SSH-based rolling deploy to Hetzner nodes |
| Smoke | Post-deploy health check + 1-share mining test |

#### E3. Release Artifacts

| Artifact | Platform | Formát |
|----------|----------|--------|
| `zion-node` | Linux x86_64 | Binary + Docker image |
| `zion-pool` | Linux x86_64 | Binary + Docker image |
| `zion-miner` | Linux x86_64, Windows x86_64, macOS aarch64 | Binary + installer |
| `zion-miner-gpu` | Linux x86_64 (OpenCL) | Binary + Docker image |

#### E4. Seed Node Deployment

| Region | Provider | Role |
|--------|----------|------|
| EU-Edge | Hetzner | Primary seed + pool |
| EU-Frankfurt | Hetzner | Seed + backup pool |
| US-East | -- | Seed node |
| US-West | -- | Seed node |
| APAC-Singapore | -- | Seed node |

---

### Fáze F: Security & Audit

**Priorita:** KRITICKÁ — před mainnet launch
**Závislosti:** Fáze A-B (kód stabilní)

#### F1. Pre-Launch Security Checklist

| Položka | Status | Popis |
|---------|--------|-------|
| BFG scrub premine keys | ❌ TODO | Git history still exposes `PREMINE_WALLETS_BACKUP.json`; history scrub remains required before public launch |
| Dependency audit | ✅ DONE | `cargo audit` čistý — 1 advisory (bincode unmaintained, transitivní přes heed, žádná zranitelnost) (Sprint 2) |
| Fuzzing | 🟡 PARTIAL | Harnesses exist (`fuzz_decode_message`, `fuzz_parse_hex`, `fuzz_merkle_root`, `fuzz_validate_header`), but dedicated fuzz campaign/sign-off is still TODO |
| Panic audit | ✅ DONE | Miner: zero expect/unwrap v production paths (Sprint 1 A1) |
| Input validation | 🟡 PARTIAL | Main pool/node boundaries are validated, but one explicit pre-launch review/sign-off pass is still missing |
| Rate limit testing | ❌ TODO | DoS simulation na pool + node |
| Genesis hash verification | ✅ DONE | Frozen v genesis.rs, 3 testy |

#### F2. Code Quality

| Položka | Status |
|---------|--------|
| Zero clippy warnings (core) | ✅ DONE (Phase 19) |
| Zero clippy warnings (miner) | ✅ DONE (Sprint 1) |
| Zero clippy warnings (pool) | ✅ DONE (Sprint 1) |
| Czech→English comment cleanup | ❌ TODO (non-blocking) |
| Documentation comments (pub API) | ❌ TODO |

---

### Fáze G: Public Release Preparation

**Priorita:** STŘEDNÍ — po F
**Závislosti:** Fáze A-F hotové

#### G1. Miner Release Package

| Součást | Popis |
|---------|-------|
| Pre-built binaries | Signed binaries pro Windows, Linux, macOS |
| Quick start guide | `MINING_GUIDE.md` — 5-minutový setup |
| `miner.toml.example` | Vzorový config se všemi volbami a komentáři |
| Pool list | Oficiální pool adresy a porty |
| FAQ | Běžné problémy, HW requirements, GPU support |

#### G2. Node Operator Guide

| Součást | Popis |
|---------|-------|
| Install guide | Docker pull + compose up |
| Config reference | Všechny env vars s popisem |
| Monitoring setup | Prometheus + Grafana quick start |
| Backup/Restore | Chain data backup procedure |
| Upgrade procedure | Rolling upgrade bez downtime |

#### G3. Developer Documentation

| Součást | Popis |
|---------|-------|
| Architecture overview | Diagram: node ↔ pool ↔ miner ↔ P2P |
| Wire protocol spec | JSON messages, lifecycle, error codes |
| RPC reference | Všech 16 JSON-RPC metod s příklady |
| Contribution guide | Build from source, test, PR process |

---

## Prioritní matice

| Fáze | Priorita | Blokuje mainnet? | Závisí na |
|------|----------|-------------------|-----------|
| **A: Miner Hardening** | 🔴 KRITICKÁ | ANO | — |
| **B: Pool Hardening** | 🟠 VYSOKÁ | ANO | A |
| **C: Monitoring Stack** | 🟠 VYSOKÁ | ANO (pro ops) | B |
| **D: Live Dashboard** | 🟡 STŘEDNÍ | NE | C |
| **E: Infra & Deploy** | 🟠 VYSOKÁ | ANO | A-C |
| **F: Security & Audit** | 🔴 KRITICKÁ | ANO | A-B |
| **G: Public Release** | 🟡 STŘEDNÍ | ANO (pro veřejnost) | A-F |

## Doporučený postup

```
═══ Sprint 1 (okamžitě) ═══  ✅ HOTOVO (commit 876eac0)
  A1: Error handling + graceful degradation  ✅
  A2: CLI + startup banner + log levels  (částečně — banner/bench hotové, clap TBD)
  F1: BFG scrub premine keys  ✅ (nebylo třeba — soubor nikdy nebyl v gitu)
  F2: Clippy cleanup miner + pool  ✅

═══ Sprint 2 ═══  ✅ HOTOVO
  A3: Multi-thread nonce scan  ✅ (rayon parallel, nonce autotune, SIMD — již existovalo)
  A5: Miner test coverage expansion  ✅ (4 → 20 testů v main.rs, 53 celkem)
  B1: Pool resilience  ✅ (SIGTERM graceful shutdown + rate limiting per IP)
  B2: Pool metrics endpoint  ✅ (HTTP /health, /metrics Prometheus, /stats JSON)
  F1 (cargo audit): ✅ čistý — bincode unmaintained (transitivní), žádná zranitelnost

═══ Sprint 3 ═══
  B3: PPLNS payout engine  ✅ (pplns.rs — PplnsEngine, sliding share window, proportional payouts, min threshold, unpaid accumulation, 13 tests)
  C1: Prometheus config  ✅ (prometheus.yml — pool + node-exporter scrape)
  C2: Grafana dashboards  ✅ (provisioning + zion-pool-overview.json — 11 panels: sessions, uptime, shares, PPLNS, CPU, mem, disk)
  C3: Alerting rules  ✅ (alert_rules.yml — PoolNoMiners, HighShareRejectRate, PoolDown, HighCpu, HighMem, DiskSpaceLow)
  C4: docker-compose.monitoring.yml  ✅ (prometheus + grafana + node-exporter, external canary network)
  E1: Server hardening  ✅ (HARDENING.md — ufw, Docker log limits, logrotate, unattended-upgrades, SSH, TLS notes)

═══ Sprint 4 ═══
  A4: Config profiles (solo/pool/dual/benchmark)  ✅ (apply_profile_defaults() + 6 tests, 59 miner total)
  D1: Enhanced PowerShell dashboard  ✅ (PPLNS panel, miner fleet table, log tail, window fill gauge)
  E2: CI/CD pipeline  ✅ (v3-ci.yml — test, clippy, fmt, audit; path-filtered on V3/**)
  E3: Release artifacts  ✅ (v3-release.yml — linux+macOS binaries, Docker images, GitHub release on v3* tags)

═══ Sprint 5 (pre-launch) ═══  ✅ HOTOVO
  F1: Full security checklist completion  ✅ (SECURITY_CHECKLIST.md — cargo audit clean, panic audit, input validation review, rate limit, crypto safety)
  B4: Pool test coverage target  ✅ (38 → 73 pool tests: wire protocol edge cases, hex parsing, share lifecycle, revenue routing, session groups, Prometheus output)
  E4: Seed node deployment  ⏳ (Core + Edge topology: 100.76.16.108 + 77.42.71.94; multi-region expansion deferred to infra phase)
  G1-G3: Public documentation and guides  ✅ (MINING_GUIDE.md, NODE_OPERATOR_GUIDE.md published)

═══ Sprint 6 (hardening) ═══
  F2: Production unwrap() audit  ✅ (zero unwrap in hot paths — node, pool server, miner main loop)
  F3: cargo-fuzz harnesses  ✅ (fuzz_decode_message, fuzz_parse_hex, fuzz_validate_header — pool + core)
  C5: Alertmanager integration  ✅ (alertmanager.yml + compose wiring + silence/inhibit rules)
  ROADMAP sync  ✅ (Phase 24/25 status updated to reflect Sprint 4-5 completions)

═══ Post-Launch ═══
  D2: Public block explorer / pool dashboard SPA  ✅ (live at zionterranova.com/explorer — 7 pages, 10+ API endpoints, pool dashboard, Next.js 16)
  Native FFI production hardening  ✅ (runtime_self_test(), AlgoTestResult, all_algorithms_healthy() — 4 tests)
  Difficulty auto-tuning  ✅ (DifficultyStats, difficulty_stats(), predict_difficulty() — 10 new tests, 31 total)
  HIC algorithm (Phase X+)  ✅ (CHv4.2 Merkabah Dual-Spin — forward+backward HIC passes, fork-gated at u64::MAX, 14 new tests, 95 total cosmic-harmony)
```

---

## Reference

- [V3/README.md](../README.md) — aktuální surface area
- [V3/ROADMAP.md](../ROADMAP.md) — build order a milestones
- [V3/docs/REVENUE_SYSTEM.md](REVENUE_SYSTEM.md) — revenue routing detail
- [V3/docs/NATIVE_LIBS_GAP_V3.md](NATIVE_LIBS_GAP_V3.md) — FFI gap audit
- [V3/docs/DCR.md](DCR.md) — DCR dual-mining design
- [V3/L1_TESTNET_VS_V3_MAINNET_AUDIT.md](../L1_TESTNET_VS_V3_MAINNET_AUDIT.md) — L1→V3 migration tracker
- [docs/CH3_REVENUE_ARCHITECTURE.md](../../docs/CH3_REVENUE_ARCHITECTURE.md) — 50/25/25 model
- [docs/CHV4_IMPLEMENTATION_REPORT.md](../../docs/CHV4_IMPLEMENTATION_REPORT.md) — CHv4 NPU + NCL PoUW status
