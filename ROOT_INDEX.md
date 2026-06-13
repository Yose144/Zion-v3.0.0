# ZION TerraNova v3.0.0 — Root Repository Index

> **Complete map of the `2.9.6-main` monorepo.**
>
> If you are lost, start here. If you are maintaining, keep this updated.

---

## Quick Navigation

| You want to... | Go to |
|---------------|-------|
| **Build / run mainnet** | [`V3/`](V3/) — clean-room mainnet code |
| **Read project docs** | [`docs/`](docs/) or [`docs/TerraNova/`](docs/TerraNova/) |
| **Deploy with Docker** | [`V3/docker/`](V3/docker/) |
| **Run AI model (Hiran)** | [`HiranV2.3/`](HiranV2.3/) |
| **Web / mobile apps** | [`APP&WEB/`](APP&WEB/) |
| **Deploy scripts** | [`scripts/`](scripts/) |
| **Check status** | [`StatusV3.md`](StatusV3.md) |
| **Agent guidance** | [`AGENTS.md`](AGENTS.md) |

---

## Directory Structure

```
2.9.6-main/
├── AGENTS.md                          ← Agent operating rules (Devin, WARP, Copilot)
├── Cargo.toml                         ← Rust workspace manifest
├── LICENSE                            ← MIT License
├── README.md                          ← Main project README
├── ROOT_INDEX.md                      ← You are here
├── ROADMAP.md                         ← v3.0.0 canonical roadmap
├── StatusV3.md                        ← Current V3 status + blockers
│
├── config/                            ← Configuration templates
│   ├── .env.*                         ← Environment templates
│   ├── zion.toml                      ← ZION node configuration
│   └── ssh/                           ← SSH keys (gitignored)
│
├── docs/                              ← Active project documentation
│   ├── Genesis.md                     ← Genesis block art + hash
│   ├── GENESIS_REGENERATION_RUNBOOK.md ← Genesis key rotation procedures
│   ├── HIRAN_LOCAL_SETUP.md          ← AI inference setup
│   ├── PREMINE_ADDRESSES_PUBLIC.txt   ← Genesis premine addresses
│   ├── 3.0.0/                         ← Historical documentation (2026-06-05)
│   │   ├── EdgePrimary.md             ← Edge deployment topology
│   │   ├── MAINNET_LAUNCH_SEQUENCE.md ← Launch plan
│   │   └── [historical reports...]
│   └── ...
│
├── V3/                                ← [ACTIVE] Clean-room mainnet code
│   ├── L1/ core, pool, miner          ← Blockchain consensus, mining, PPLNS
│   ├── L2/ dao, bridge, atomic-swap   ← Governance, cross-chain bridge, HTLC
│   ├── L3/ warp                       ← Cross-chain relay daemon
│   ├── L4/ oasis                      ← Digital avatars, quests, reputation
│   ├── L5/ free-world                 ← Physical community integration (daemon)
│   ├── L6/ issobella                  ← Space fund allocation (daemon)
│   ├── cli/                           ← Unified operator CLI (`zion` binary)
│   ├── docker/                        ← Docker Compose (mainnet + monitoring)
│   └── Cargo.toml                     ← V3 workspace manifest
│
├── DeekshaDebug/                      ← [SANDBOX] Algorithm R&D (CPU + GPU benchmarks)
│   ├── src/deeksha_lite.rs            ← Reference: 256 KiB, 64 reads, 4 AES (= V3 Lite v1)
│   ├── src/deeksha_lite_optimized.rs  ← Experimental: 128 KiB, 32 reads, 3 AES (Summer mode)
│   ├── src/deeksha_lite_fire_optimized.rs ← Experimental: 128 KiB, 131072 thermal iters (Winter+)
│   ├── kernels/                       ← OpenCL GPU kernels matching CPU implementations
│   ├── src/bin/                       ← Benchmarks: lite, optimized, fire_optimized, compare_all
│   └── Cargo.toml                     ← Standalone crate (depends on zion-cosmic-harmony)
│
├── APP&WEB/                           ← Frontend applications
│   ├── desktop-agent/                 ← Electron desktop agent + mining fallback
│   ├── mobile-app/                    ← React Native mobile app
│   └── website-v2.9/                  ← Next.js marketing + explorer website
│       └── src/components/
│           ├── DeekshaLiteNews.tsx    ← Live ZION news feed (deeksha_lite_v1 theme, added 2026-06-07)
│           ├── HolographicEarth.tsx   ← 3D holographic earth animation
│           └── NewsFeed.tsx           ← Dynamic news feed component
│
├── archive/                           ← Legacy archive (v2.9.x era)
│   └── 2.9.9/
│       ├── legacy-code/               ← Pre-V3 L1-L6 code
│       ├── docs/                      ← Historical documentation
│       └── ops/                       ← Runtime data, monitoring, tests
│
├── docs/                              ← Active project documentation
│   ├── TerraNova/                     ← Literary + operational docs
│   │   ├── KNIHA-LEHUA/               ← Hawaii/Pacific lineage texts
│   │   ├── maya/                      ← Mayan literary branch (KNIHA-HUNABKU)
│   │   ├── ancient-egypt/             ← Egypt avatar lineage
│   │   ├── hawaii/                    ← Polynesian OASIS avatars
│   │   ├── Projects/                  ← Physical community project sheets
│   │   └── [00-12]-*.md               ← Core TerraNova chapters (Czech)
│   ├── docs2.9/                       ← v2.9 archive docs
│   └── 2.9.9/archive/                 ← WARP + legacy archive
│
├── HiranV2.1/                         ← AI model v2.1 (QLoRA, 8B base)
├── HiranV2.2/                         ← AI model v2.2 (QLoRA, completed)
│   ├── scripts/                       ← Training + merge scripts
│   ├── checkpoints_vast/            ← Model checkpoints (gitignored)
│   └── *.md                           ← Interview reports, GPU experiments
├── HiranV2.3/                         ← AI model v2.3 (32B base, DeepSpeed, ready for training)
│   ├── data/                          ← Dataset generators
│   ├── scripts/                       ← Training + benchmark scripts
│   │   ├── provision_vast.py          ← Vast.ai auto-provisioning
│   │   ├── vast_price_compare.py      ← Hardware cost comparator
│   │   └── ...
│   ├── rag/                           ← Hybrid RAG (ChromaDB + vector search)
│   ├── PRE_FLIGHT_CHECKLIST.md      ← Pre-training verification checklist
│   ├── HARDWARE_COST_ANALYSIS.md    ← VRAM calculations + cost comparison
│   └── benchmark_results/           ← Placeholder dry-run data (NOT real model results)
│
├── docs/legal/                        ← Legal documents (licence, disclaimers, premine)
├── edge-deploy/                       ← Edge server deployment package
├── opencl_sdk/                        ← GPU mining OpenCL SDK
├── ops/                               ← Operations runbooks
├── scripts/                           ← Deployment + operations scripts
│   ├── deploy-*.sh                    ← Deployment scripts
│   ├── autopilot-2.9.8.sh            ← Validation + deploy pipeline
│   ├── launch-stack.ps1              ← Windows launch script
│   └── [various]                      ← Helper scripts
│
├── ZionOS/                            ← ZionOS operating system
│
└── [Root files]                       ← See "Root Files" section below
```

---

## Root Files

### Core Project Files

| File | Purpose |
|------|---------|
| `README.md` | Main project introduction, architecture, emission schedule |
| `AGENTS.md` | Operating guidance for Devin, WARP, Copilot, future AI agents |
| `StatusV3.md` | Current V3 status, launch blockers, audit results |
| `docs/Genesis.md` | Genesis block art + hash |
| `Cargo.toml` | Root Rust workspace manifest |
| `config/zion.toml` | ZION node configuration |
| `LICENSE` | MIT License |

### Launch & Mainnet

| File | Purpose |
|------|---------|
| `MAINNET_LAUNCH_SEQUENCE.md` | Current mainnet launch plan |
| `docs/PREMINE_ADDRESSES_PUBLIC.txt` | Genesis premine addresses (public) |

### Archived Files (v2.9.x era)

Historical docs, roadmaps, and analysis moved to [`archive/2.9.9/docs/`](archive/2.9.9/docs/):
- `FORSITA.md`, `STATUS.md`, `StatusV3-Part2.md`
- `ROADMAP.md`, `DEFI_ROADMAP.md`
- `LAUNCH_PLAN_20_6_2026.md`, `MainnetLaunch.md`, `MAINNETREADYrun.md`, `MAINNETSTATUSW11.md`
- `revenue.md`, `REVENUE_*.md`
- `Oasis.md`, `zion.md`, `ZION-CLI.md`
- `NCL_INTEGRATION.md`, `DUALBOOT_GUIDE.md`, `WINDOWS11_DOCKER_STACK.md`
- `HIRAN_V2.2_*.md`, `planHv2.2train.md`
- `analzak2.6.md`, `reportv3.md`, `webupdate.md`
- Test reports: `test-results-V3-mainnet-e2e-*.md`

---

## Layer-by-Layer Map

### L1 — ZION TerraNova (Blockchain)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L1/core/` | 🟢 Active | Node, consensus, mempool, P2P, RPC, UTXO, Ed25519 |
| `V3/L1/pool/` | 🟢 Active | Stratum pool server, PPLNS, share validation |
| `V3/L1/miner/` | 🟢 Active | CPU/GPU miner, OpenCL/CUDA backends — **3 kanonické algoritmy** |
| `V3/L1/cosmic-harmony/` | 🟢 Active | Revenue distribution (89/5/5/1 split); OpenCL kernely pro 3 algoritmy |
| `DeekshaDebug/` | 🔵 Sandbox | Algorithm R&D — experimentální varianty (optimized/fire_optimized) před GPU validací |
| `archive/2.9.9/legacy-code/L1/` | 🟡 Legacy | Pre-V3 reference code |

**Kanonické algoritmy V3** (žádné jiné nesmí být v produkčním kódu):

| Algoritmus | Scratchpad | Použití |
|------------|-----------|---------|
| `cosmic_harmony_ekam_deeksha_v2` | ~256 KiB + NPU | Plný Ekam pipeline |
| `deeksha_lite_v1` | 256 KiB | Standardní těžba, reference |
| `deeksha_lite_fire` | 256 KiB | Zimní režim, termální loop |

### L2 — Governance & Bridge

| Path | Status | Description |
|------|--------|-------------|
| `V3/L2/dao/` | 🟢 Active | Proposal engine, voting, treasury, multi-layer Co-Admin governance, consent engine, cross-layer vetoes |
| `V3/L2/bridge/` | 🟢 Active | EVM bridge relay, L1 watcher |
| `V3/L2/atomic-swap/` | 🟢 Active | HTLC swap daemon |
| `archive/2.9.9/legacy-code/L2/` | 🟡 Legacy | Pre-V3 reference code |

### L3 — WARP (Cross-Chain)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L3/warp/` | 🟢 Active | Cross-chain relay, Axum API |
| `archive/2.9.9/legacy-code/L3/` | 🟡 Legacy | Pre-V3 reference code |

### L4 — OASIS (Digital Realm)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L4/oasis/` | 🟢 Active | Avatar system, quests, reputation, REST API |
| `archive/2.9.9/legacy-code/L4/` | 🟡 Legacy | Pre-V3 reference code |

### L5 — Terra Nova (Physical Communities)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L5/free-world/` | 🟢 Active | `zion-free-world` daemon — humanitarian grants, projects, L1 scanner, DAO client |
| `V3/L5/docs/` | 🟢 Active | **Community documentation** (see below) |
| `archive/2.9.9/legacy-code/L5/` | 🟡 Legacy | Vision README only |
| `docs/TerraNova/Projects/` | 🟡 Active | Project sheets (Portugal, La Palma, Polynesia) |

**`V3/L5/docs/` detail:**
- `ARCHITECTURE/l5-system-design.md` — L5 connection to L1–L4
- `GOVERNANCE/community-dao-framework.md` — Hybrid sociocracy + DAO
- `GOVERNANCE/consciousness-admission-framework.md` — Age-based entry, 5 Dharmic principles, Bodhisattva vow
- `GOVERNANCE/multi-layer-dao-governance.md` — Co-Admin system across L1–L6
- `PROTOCOLS/resonance-protocol.md` — Sound/time/intergenerational bridge: Resonance Council, Fibonacci Time Capsule, Light Language Registry
- `TECH/zion-node-spec.md` — Guardian node hardware spec
- `TECH/mesh-network.md` — LoRa/Meshtastic off-grid network
- `TECH/medical-table.md` — Community health protocol
- `COMMUNITIES/genesis-garden.md` — Portugal base camp
- `COMMUNITIES/dharma-temple.md` — La Palma sanctuary
- `COMMUNITIES/te-piko-ora.md` — French Polynesia paradise node
- `TEMPLATES/community-blueprint.md` — Generic template for new L5 nodes

**`V3/L2/dao/docs/` detail (Governance):**
- `README.md` — DAO overview, parameters, transition plan
- `GOVERNANCE_STRUCTURE.md` — Co-Admins, Koncil 9, Round Table 12, Sacred Trinity
- `PROTOCOLS.md` — 20-year transition, voting, treasury, succession
- `SACRED_TRINITY.md` — Cosmic family, Rama/Síta/Hanuman archetypes
- `V3_SOFTWARE.md` — `zion-dao` crate architecture, API, modules

**`V3/docs/DEV_TEAM/` detail (Developer Team):**
- `README.md` — Dev team overview, workspace layout, constants
- `VISHWAKARMA.md` — Chief Architect archetype, 10 commandments, vow
- `STRUCTURE.md` — Team hierarchy, compensation, bounties
- `ROADMAP.md` — 4-phase plan 2025–2070
- `STANDARDS.md` — Rust standards, review process, CI/CD
- `ONBOARDING.md` — Day 1–7 guide, contribution guide, FAQ

### L6 — Issobella (Space)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L6/issobella/` | 🟢 Active | `zion-issobella` daemon — space missions, research proposals, L1 scanner, DAO client |
| `V3/L6/issobella/docs/` | 🟢 Active | **Station documentation** (see below) |
| `archive/2.9.9/legacy-code/L6/` | 🟡 Legacy | Vision README only |

**`V3/L6/issobella/docs/` detail:**
- `README.md` — L6 overview, links, constants
- `STANICE_ISSOBELLA.md` — Philosophy, symbolism, station concept, cosmic family
- `V3_SOFTWARE.md` — `zion-issobella` crate architecture, API, DB, config
- `FINANCOVANI.md` — Fee split, funding sources, Decade Decay
- `CASOVA_OSA.md` — Milestones 2026–2126+, roadmap

---

## AI / Hiran Models

| Version | Path | Status | Base Model | Method |
|---------|------|--------|-----------|--------|
| v2.1 | `HiranV2.1/` | ✅ Complete | Meta-Llama-3.1-8B | QLoRA |
| v2.2 | `HiranV2.2/` | ✅ Complete | Meta-Llama-3.1-8B | QLoRA (5 stages) |
| v2.3 | `HiranV2.3/` | 🟡 Ready for Training | Qwen3-32B | DeepSpeed ZeRO-3 Full FT |

---

## Cultural Lineages (OASIS L4 Avatar Lines)

| Culture | Path | Status | OASIS Integration |
|---------|------|--------|-------------------|
| **Hawaii / Polynesia** | docs/TerraNova/hawaii/ + KNIHA-LEHUA/ | Active | KNIHA-LEHUA book, Pacific protocols |
| **Maya** | docs/TerraNova/maya/ + KNIHA-HUNABKU/ | Active | KNIHA-HUNABKU book, Hunab Ku cosmology |
| **Ancient Egypt** | docs/TerraNova/ancient-egypt/ | Active | Avatar lineage, OASIS quest integration |
| **Norse / Celtic** | docs/TerraNova/norse-celtic/ | Active | Valhalla & spring lore |
| **Rapa Nui (Easter Island)** | docs/TerraNova/rapa-nui/ | NEW | Edge-world warning + hope, Moai as blocks, Tangata manu DAO |
| **Africa** | docs/TerraNova/africa/ | Active | Ubuntu lineage |
| **India** | docs/TerraNova/india/ | Active | Dharma & chakra systems |
| **China** | docs/TerraNova/china/ | Active | Qi & Tao cosmology |
| **Japan** | docs/TerraNova/japan/ | Active | Zen & animist lineage |
| **Australia** | docs/TerraNova/australia/ | Active | Dreamtime & songlines |
| **Indonesia** | docs/TerraNova/indonesia/ | Active | Maritime archipelago |
| **New Zealand** | docs/TerraNova/newzealand/ | Active | Maori whakapapa |
| **Atlantis** | docs/TerraNova/atlantis/ | Mythic | Underwater quest line |
| **Lemuria** | docs/TerraNova/lemuria/ | Mythic | Lost continent echoes |
| **Cosmic Federation** | docs/TerraNova/cosmic/ | Future | Galactic civilization |

---

## Application Layer

| App | Path | Stack | Status |
|-----|------|-------|--------|
| Website | `APP&WEB/website-v2.9/` | Next.js | 🟡 Active |
| Mobile App | `APP&WEB/mobile-app/` | React Native | 🔵 Planned |
| Desktop Agent | `APP&WEB/desktop-agent/` | Electron + Python | 🟡 Active |
| DesktopApp (V3) | `V3/DesktopApp/` | Electron shell | 🔵 Planned |

---

## Docker & Deployment

| Path | Purpose |
|------|---------|
| `V3/docker/` | Main Docker Compose (all services) |
| `V3/docker/DOCKER.md` | Docker deployment guide |
| `V3/docker/HARDENING.md` | Production hardening |
| `V3/docker/Dockerfile.free-world` | L5 free-world service |
| `V3/docker/Dockerfile.issobella` | L6 issobella service |
| `docker/` | Root-level Docker configs |
| `docs/ZION_NETWORK_TOPOLOGY.md` | Core+Edge architecture guide |
| `scripts/launch-edge-node.sh` | Edge relay launcher (Linux) |
| `scripts/launch-edge-node.ps1` | Edge relay launcher (Windows) |
| `scripts/setup-tailscale.sh` | Tailscale VPN setup |
| `scripts/deploy-edge.ps1` | Edge server deploy (Windows) |
| `scripts/edge-server-setup.sh` | Edge server bootstrap |
| `scripts/hetzner-api.ps1` | Hetzner Cloud API helper |

---

## Documentation Hierarchy

When docs disagree, use this order of truth:

1. `StatusV3.md` — current operational truth
2. `V3/README.md` / `V3/ROADMAP.md` — V3 planning
3. `V3/docs/**` — V3 detailed docs
4. `ROOT_INDEX.md` — this file (structural map)
5. `README.md` (root) — project overview
6. `archive/2.9.9/docs/` — v2.9.x legacy archive (historical reference)

---

## For Contributors

1. **Always work in `V3/`** unless the task explicitly targets legacy or docs.
2. **Never commit secrets** — use `.env` files (already gitignored).
3. **Run tests before push:** `cargo test --manifest-path V3/Cargo.toml --workspace`
4. **Update this file** when adding new root directories.

---

*Last updated: 2026-06-10*
*2026-06-10: DCR stealth backdoor odstraněn z zion-miner — dcr_worker/gpu/hash/stratum smazány (commit `5afc37f7`); RDNA1 detekce fix — RX 5700 XT detekován jako GCN místo RDNA1, work_size 2048→8192, 4× hashrate boost (commit `cc50d1b4`); benchmark: deeksha_lite_fire=18.16 KH/s.*
*2026-06-10: Share acceptance fix — Bug #1: pool/lib.rs algorithm-aware validate_candidate_with_algorithm (commit `21c7a028`); Bug #2: gpu_backend.rs GPU/CPU path oddělení — GPU hash je primary, CPU je audit-only (commit `8d5d44ca`). Nové diagnostické logy: GPU_CPU_MISMATCH, SHARE_ACCEPTED/REJECTED s algo+hash.*
*2026-06-09: V3 cleanup — 3 kanonické algoritmy, algorithm-aware validace, gpu_backend_optimized.rs smazán, DeekshaDebug Cargo.toml kompletní, chain height 525+*
*2026-06-07: Chain reset → genesis `7543004c`, consensus `deeksha_lite_v1`, Edge disk cleanup, DeekshaLiteNews.tsx added*
*2026-05-23: Root directory cleanup — legacy L1-L6, docs, monitoring, tests moved to `archive/2.9.9/`; Genesis.md moved to root; v3.0.0 Mainnet Ready structure*
*Repository: `Yose144/Zion-v3.0.0` · Branch: `main` · Version: v3.0.1*
