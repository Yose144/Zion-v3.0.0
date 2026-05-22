# ZION TerraNova v2.9.6 — Root Repository Index

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
├── StatusV3.md                        ← Current V3 status + blockers
├── ROOT_INDEX.md                      ← You are here
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
├── APP&WEB/                           ← Frontend applications
│   ├── desktop-agent/                 ← Electron desktop agent + mining fallback
│   ├── mobile-app/                    ← React Native mobile app
│   └── website-v2.9/                  ← Next.js marketing + explorer website
│
├── docs/                              ← Project documentation
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
├── HiranV2.3/                         ← AI model v2.3 (32B base, DeepSpeed, in progress)
│   ├── data/                          ← Dataset generators
│   ├── scripts/                       ← Training + benchmark scripts
│   └── rag/                           ← Hybrid RAG (ChromaDB + vector search)
│
├── L1/                                ← [LEGACY] Pre-V3 blockchain code
├── L2/                                ← [LEGACY] Pre-V3 DAO / bridge code
├── L3/                                ← [LEGACY] Pre-V3 warp code
├── L4/                                ← [LEGACY] Pre-V3 OASIS code
├── L5/                                ← [LEGACY] Vision docs only (README)
├── L6/                                ← [LEGACY] Vision docs only (README)
│
├── legal/                             ← Legal documents
├── config/                            ← Runtime configuration files
├── docker/                            ← Root-level Docker configs
├── dashboard/                         ← Python monitoring dashboard (app.py)
├── monitoring/                        ← Prometheus/Grafana configs
├── data/                              ← Runtime data (databases, caches)
├── logs/                              ← Log files
├── run/                               ← Runtime state
├── backups/                           ← Backup archives
│
├── scripts/                           ← Deployment + operations scripts
│   ├── deploy-*.sh                    ← Deployment scripts
│   ├── autopilot-2.9.8.sh            ← Validation + deploy pipeline
│   ├── launch-stack.ps1              ← Windows launch script
│   └── [various]                      ← Helper scripts
│
├── tests/                             ← Integration + e2e tests
├── tools/                             ← Developer tools
├── opencl_sdk/                        ← GPU mining OpenCL SDK
├── ops/                               ← Operations runbooks
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
| `StatusV3-Part2.md` | Independent audit + 2026-05-07 cleanup notes |
| `Cargo.toml` | Root Rust workspace manifest |
| `LICENSE` | MIT License |

### Roadmaps & Plans

| File | Purpose |
|------|---------|
| `ROADMAP.md` | Historical multi-layer roadmap |
| `DEFI_ROADMAP.md` | DeFi + Explorer deployment roadmap |
| `HIRANYAGARBHA_UPGRADE_PLAN.md` | Hiran AI model upgrade plan |
| `HIRAN_V2.2_CLI_INTEGRATION.md` | Hiran v2.2 CLI integration spec |
| `HIRAN_V2.2_COMPLETION_PLAN.md` | Hiran v2.2 completion checklist |
| `planHv2.2train.md` | Hiran v2.2 training plan |
| `planTestingMainetDocker.md` | Mainnet Docker testing plan |
| `NCL_INTEGRATION.md` | NCL (Neural Conscious Layer) gateway integration |
| `REVENUE_IMPLEMENTATION_PLAN.md` | Revenue system implementation |
| `REVENUE_DEEP_ANALYSIS.md` | Revenue model deep dive |
| `REVENUE_SYSTEM_ROBUST.md` | Revenue system robustness analysis |
| `revenue.md` | Revenue summary |

### Launch & Status Files

| File | Purpose |
|------|---------|
| `MainnetLaunch.md` | Mainnet launch checklist |
| `MAINNETREADYrun.md` | Mainnet ready-to-run guide |
| `MAINNETSTATUSW11.md` | Windows 11 mainnet status |
| `reportv3.md` | V3 status report |

### Addresses & Registry

| File | Purpose |
|------|---------|
| `PREMINE_ADDRESSES_PUBLIC.txt` | Genesis premine addresses (public) |
| `Oasis.md` | OASIS system documentation |
| `FORSITA.md` | FORSITA documentation |
| `analzak2.6.md` | Analysis document |

### Guides

| File | Purpose |
|------|---------|
| `DUALBOOT_GUIDE.md` | Dual-boot setup guide |
| `install.sh` | Installation script |
| `find_nonce.py` | Nonce finding utility |
| `patch_edition_selector.js` | Edition selector patch |

### Log Files (runtime)

| File | Purpose |
|------|---------|
| `node_test7.log` | Node test log |
| `pool_test7.log` | Pool test log |
| `nul` | Empty/null file (Windows artifact) |

---

## Layer-by-Layer Map

### L1 — ZION TerraNova (Blockchain)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L1/core/` | 🟢 Active | Node, consensus, mempool, P2P, RPC, UTXO, Ed25519 |
| `V3/L1/pool/` | 🟢 Active | Stratum pool server, PPLNS, share validation |
| `V3/L1/miner/` | 🟢 Active | CPU/GPU miner, OpenCL/CUDA backends |
| `V3/L1/cosmic-harmony/` | 🟢 Active | Revenue distribution (89/5/5/1 split) |
| `L1/` | 🟡 Legacy | Pre-V3 reference code |

### L2 — Governance & Bridge

| Path | Status | Description |
|------|--------|-------------|
| `V3/L2/dao/` | 🟢 Active | Proposal engine, voting, treasury, multi-layer Co-Admin governance, consent engine, cross-layer vetoes |
| `V3/L2/bridge/` | 🟢 Active | EVM bridge relay, L1 watcher |
| `V3/L2/atomic-swap/` | 🟢 Active | HTLC swap daemon |
| `L2/` | 🟡 Legacy | Pre-V3 reference code |

### L3 — WARP (Cross-Chain)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L3/warp/` | 🟢 Active | Cross-chain relay, Axum API |
| `L3/` | 🟡 Legacy | Pre-V3 reference code |

### L4 — OASIS (Digital Realm)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L4/oasis/` | 🔵 Planned | Avatar system, quests, reputation |
| `L4/` | 🟡 Legacy | Pre-V3 reference code |

### L5 — Terra Nova (Physical Communities)

| Path | Status | Description |
|------|--------|-------------|
| `V3/L5/free-world/` | 🟢 Active | `zion-free-world` daemon — humanitarian grants, projects, L1 scanner, DAO client |
| `V3/L5/docs/` | 🟢 Active | **Community documentation** (see below) |
| `L5/` | 🟡 Legacy | Vision README only |
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
| `L6/` | 🟡 Legacy | Vision README only |

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
| v2.3 | `HiranV2.3/` | 🟡 In Progress | OpenReasoning-Nemotron-32B | DeepSpeed ZeRO-3 |

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

1. `StatusV3.md` / `StatusV3-Part2.md` — current operational truth
2. `V3/README.md` / `V3/ROADMAP.md` — V3 planning
3. `V3/docs/**` — V3 detailed docs
4. `ROOT_INDEX.md` — this file (structural map)
5. `README.md` (root) — project overview
6. `docs/2.9.9/archive/` — legacy archive

---

## For Contributors

1. **Always work in `V3/`** unless the task explicitly targets legacy or docs.
2. **Never commit secrets** — use `.env` files (already gitignored).
3. **Run tests before push:** `cargo test --manifest-path V3/Cargo.toml --workspace`
4. **Update this file** when adding new root directories.

---

*Last updated: 2026-05-21*
*Major updates: L5/L6 daemon crates + docs, DAO multi-layer governance, Dev Team docs, Network topology, Dashboard L5/L6, **TerraNova Chapter 12 (Vlna Te Piti + Rapa Nui)** + Rapa Nui cultural lineage*
*Repository: `Yose144/2.9.6` · Branch: `main`*
