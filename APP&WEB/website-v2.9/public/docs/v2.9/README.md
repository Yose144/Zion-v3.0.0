# ZION TerraNova v2.9 — "Quantum Leap"

> **Era: October – December 2025 · Status: Legacy (superseded by v2.9.5)**
> **Archive note:** this page is kept as a historical snapshot of the Python-era track and does not describe the current public launch gate or current operational topology.

v2.9 "Quantum Leap" was the first multi-layer, multi-node TestNet era of ZION. It ran on a Python/FastAPI stack and established the core architectural vision that defined all subsequent versions.

---

## What Was v2.9

v2.9 was not a single release — it was a development era spanning October through December 2025, going through sub-versions v2.9.0 through v2.9.4. The significant milestone was the **first operational multi-node TestNet** with live mining.

### Technology Stack (v2.9 era)

| Component | Technology |
|-----------|-----------|
| Blockchain core | Python 3.11 (src/core/) |
| API server | FastAPI (Python) |
| Mining pool | Python (Stratum v2) |
| Website | Next.js (TypeScript) |
| Database | SQLite / in-memory |
| Containerization | Docker Compose |
| Monitoring | Prometheus + Grafana |
| Reverse proxy | Nginx |

### Infrastructure

```
Internet
    │
    ├─ Port 80/443 → NGINX
    │      ├─ / → Static Website (Next.js)
    │      ├─ /api/ → FastAPI (Python)
    │      ├─ /pool/ → Pool Stats
    │      └─ /grafana/ → Grafana
    │
    └─ Port 3333 (Stratum) → Mining Pool

Docker Network (zion-internal):
    ├─ blockchain  (RPC: 8545, P2P: 18081)
    ├─ pool        (Stratum: 3333, stats: 8080)
    ├─ api         (8001)
    ├─ redis       (6379)
    ├─ prometheus  (9090)
    └─ grafana     (3000)
```

---

## Key Milestones in the v2.9 Era

### October 2025 — "Quantum Leap" Launch
- v2.9.0 released, building on v2.8.9 Python foundation
- First Docker production stack with health checks
- Block explorer deployed
- Multi-region P2P design articulated

### November 2025 — GPU Mining & Multi-Node
- GPU mining support added (OpenCL)
- First 2 MH/s GPU session documented
- Multi-node P2P sync working
- Critical supply bug fixed (wrong total supply calculation in older code was corrected to 144B hard cap)
- Pool payouts PPLNS system implemented

### December 2025 — End-of-Year Review & Rewrite Decision
- Real project audit conducted (December 14, 2025):
  - Blockchain running but at genesis block only
  - Python pool was not running in production  
  - 76+ `NotImplementedError` stubs across codebase
  - Presale backend ready but not published
- Decision made: full Rust rewrite in January 2026
- v2.9.5 "Native Awakening" development begins

---

## Cosmic Harmony Algorithm in v2.9

The CHv3 algorithm lineage during the v2.9 era:

| Sub-version | Algorithm | Notes |
|-------------|-----------|-------|
| v2.9.0 | CHv1 (Python) | ~200 KH/s, proof-of-concept |
| v2.9.2 | CHv2 (Python + C bindings) | ~800 KH/s, improved memory hardness |
| v2.9.4 | CHv2+ (GPU prototype) | ~15 MH/s GPU, CUDA/OpenCL |

The algorithm design was already mature by late v2.9 — the block structure, 4-phase hash, and memory hardness parameters were all established. What changed in v2.9.5 was the implementation language (Python → Rust), not the algorithm design.

---

## Block Reward Design (v2.9 era)

In early v2.9, the block reward was researched as part of the tokenomics work. The mathematical derivation:

```
MINING_EMISSION = 127,720,000,000 ZION
TOTAL_BLOCKS    = 23,652,000 (45 years × 525,600 blocks/year)
BLOCK_REWARD    = 127,720,000,000 / 23,652,000 = 5,400.067 ZION
```

This 5,400.067 figure was derived in v2.9 and remained the block reward through v2.9.5. (v2.9.6 then added Decade Decay on top of this base.)

Early v2.9 documentation occasionally used "50 ZION" as a placeholder — this was a naive early estimate that was corrected once the full supply math was worked out.

---

## v2.9 → v2.9.5 Transition

The transition from v2.9 to v2.9.5 was the most significant change in ZION's history:

| Aspect | v2.9 (Dec 2025) | v2.9.5 (Jan 2026) |
|--------|-----------------|-------------------|
| Language | Python + FastAPI | 100% Rust |
| Tests | ~400 (many broken) | 108 (all passing) |
| NotImplementedErrors | 76+ | 0 |
| Mining in production | ❌ Not running | ✅ Live |
| Pool in production | ❌ Not running | ✅ Live |
| LMDB storage | ❌ SQLite/memory | ✅ LMDB |
| Signatures | ECDSA mixed | Ed25519 uniform |
| Rust LOC | 0 | ~15,245 |
