# PoC-lab Architecture

> **Scope:** Prototype / laboratory — mimo `V3/`. Žádná L1 consensus integrace.
> **Updated:** 2026-07-14 — Fáze 2 implementace (real data, hardened P2P, adversarial economics, persistent storage)

---

## Fáze 2 — Co je nového (2026-07-14)

| Workstream | Status | Detail |
|-----------|--------|--------|
| Real data sources | ✅ | `DataSource` trait + `MockDataSource` (default) + `L1RpcSource` + `WarpApiSource` (feature-gated `live-data`) — live L1 RPC + L3 WARP API s automatickým fallback na mock |
| P2P hardening | ✅ | `NodeIdentity` (Ed25519) + `EncryptedTransport` (X25519 ECDH + AES-256-GCM) + `PeerDiscovery` (exponential backoff, gossip peer exchange) — feature-gated `crypto` |
| Adversarial economics | ✅ | `AdversarialSimulator` s 6 strategiemi (Honest, Lazy, ScoreGamer, BridgeSpoofer, Colluding, Intermittent) — gaming detection, slashing enforcement, Gini coefficient, survival rate |
| Persistent storage | ✅ | Nový crate `poc-storage` (10th) — `FileProofStore` (content-addressed bincode), `EpochHistory` (chain hash, replay), `AuditTrail` (tamper-evident hash chain) |
| Test count | ✅ | 277 default / 325 s všemi features — vše PASS |

---

## Fáze 1 — Co je nového (2026-07-14)

| Workstream | Status | Detail |
|-----------|--------|--------|
| OpenCL GPU backend | ✅ | `OpenClBackend` v `poc-npu/src/opencl.rs` — INT8 VM na AMD RX 5600 XT přes ROCm OpenCL, bit-exact s CPU referencí (circuit breaker ověřen) |
| ProgramConfig presets | ✅ | `CI` (~4K MAC), `BENCH` (~100-200K MAC), `PRODUCTION` (~2M MAC) |
| Batch inference | ✅ | `NpuBackend::infer_batch()` — default loop, OpenCL override s program reuse |
| Real care task executors | ✅ | `TaskExecutor` trait + 4 executory (Warp, Anomaly, Liquidity, Constitutional) + `CompositeExecutor` router |
| P2P multi-process sim | ✅ | Nový crate `poc-p2p` — TCP transport, gossip protokol, `P2pNode`, cross-validation across nodes |
| Test count | ✅ | 228 default / 239 s OpenCL — vše PASS |

---

## Crate overview

```
┌─────────────────────────────────────────────────────────────┐
│                         poc-core                             │
│  CareProof, CareTask, CareScoreComponents, NpuAttestation    │
│  Hash, ValidatorId, basic validation                         │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────────┐
        │           │           │               │
        ▼           ▼           ▼               ▼
  ┌─────────┐ ┌──────────┐ ┌──────────┐  ┌──────────────┐
  │poc-tasks│ │poc-npu   │ │poc-verifier│  │poc-registry  │
  │assignment│ │INT8 VM   │ │score + validation│ │validators   │
  │registry  │ │RandomNPU │ │cross-validation   │ │Sefirot Vow   │
  │executors │ │OpenCL GPU│ │                   │ │              │
  │(4 real)  │ │batch inf │ │                   │ │              │
  └─────────┘ └──────────┘ └──────────┘  └──────────────┘
        │           │           │               │
        └───────────┴─────┬─────┴───────────────┘
                           ▼
                   ┌───────────────┐        ┌────────────────┐
                   │poc-economics  │        │poc-sim         │
                   │reward split   │◀───────│network simulator│
                   │slashing model │        │(lib + CLI demo) │
                   └───────────────┘        └────────────────┘
                                                  │
                                                  ▼
                                          ┌────────────────┐
                                          │  poc-p2p       │
                                          │  TCP transport │
                                          │  gossip protokol│
                                          │  P2pNode       │
                                          │  cross-valid.  │
                                          │  crypto (opt)  │
                                          └────────────────┘
                                                 │
                                                 ▼
                                          ┌────────────────┐
                                          │  poc-storage   │
                                          │  FileProofStore│
                                          │  EpochHistory  │
                                          │  AuditTrail    │
                                          └────────────────┘
```

---

## `poc-core`

- Definuje kanonické datové struktury pro Proof-of-Care.
- `CareTask` enumerace 11 tasků podle sefirot.
- `CareProof` je hlavní entita pro záznam care práce.
- `CareScoreComponents` vážený score 0–10_000_000.
- **`BodhisattvaPledge`** — 8 slibů z Bodhisattva Vow (consciousness-admission-framework.md §6.2),
  jako typově bezpečný enum. Každý slib obsahuje kanonický anglický text.
- **`BodhisattvaVowRecord`** — záznam slibu validátora: `vow_hash` (SHA3-256 přes
  všechny texty + validator_id), `taken_epoch`, `last_renewed_epoch`, `ceremony_location`.
- **`BODHISATTVA_VOW_EPILOG`** — kanonický epilog ("May I break it a thousand times…").
- **`apply_dual_vow_bonus(score)`** — aplikuje +5 % bonus pro dual-vow validátory.
- `DUAL_VOW_CARE_SCORE_BONUS_BPS = 10_500` (basis points → +5 %).
- Bez externích závislostí na L1.

## `poc-tasks`

- `TaskAssigner`: deterministicky přiřazuje tasky validátorům per epoch.
- `DummyExecutor`: prototypový executor, který generuje dummy output (fallback).
- `TaskRegistry`: registry všech 11 care tasků.
- **`TaskExecutor` trait** (Fáze 1): společný trait pro reálné executory.
- **`WarpBridgeAuditExecutor`** (Fáze 1): audit WARP bridge consistency —
  generuje deterministický mock bridge state, kontroluje locked/minted drift,
  stale pending locky, TVL range. Output = BLAKE3 hash audit výsledku.
- **`L1AnomalyDetectionExecutor`** (Fáze 1): detekce anomálií v L1 mempoolu —
  generuje mock mempool, z-score outlier detection, circular transfer detection.
- **`LiquidityHealthExecutor`** (Fáze 1): kontrola DEX liquidity pool health —
  constant product check, slippage calculation.
- **`ConstitutionalAuditExecutor`** (Fáze 1): audit DAO proposal vs constitution —
  max mint check, treasury transfer check, quorum check.
- **`CompositeExecutor`** (Fáze 1): router který dispatchuje na správný executor
  podle task typu. Pro tasky bez specifického executoru fallbackuje na DummyExecutor.

## `poc-npu`

- `NpuBackend` trait pro různé inference backendy (včetně `infer_batch`).
- `vm` modul: reálná deterministická **INT8 VM** implementující "ZION NPU VM Spec"
  z `docs/NPU_HARDWARE_MINING_THEORY.md` §4.2:
  - `DeterministicRng` — xorshift64* seedovaný z Blake3 digestu.
  - `Activation` — 4 aktivace (ReLU/GELU/SiLU/HardSwish), každá materializovaná
    jako 256-entry INT8→INT8 lookup table.
  - `DenseLayer` — INT8 matmul + bias + arithmetic shift + clamp + activation lookup.
  - `RandomNpuProgram` — RandomNPU koncept (teorie doc §3): počet vrstev, dimenze
    a aktivace jsou náhodně (ale deterministicky) generované z `(seed, epoch)`.
    Vstup/výstup jsou fixní `IO_DIM = 64` bytů.
  - **`ProgramConfig` presets** (Fáze 1): `CI` (~4K MAC), `BENCH` (~100-200K MAC),
    `PRODUCTION` (~2M MAC) — konfigurovatelný scale pro benchmarking.
- `CpuReferenceBackend`: canonical truth backend — používá `vm::RandomNpuProgram`.
- **`OpenClBackend`** (Fáze 1): GPU backend přes OpenCL — spouští stejný INT8 VM
  na AMD RX 5600 XT (RDNA1/gfx1010) přes ROCm OpenCL. Bit-exact s CPU referencí
  (circuit breaker ověřen přes 50+ inputs, všechny aktivace, multi-layer programy).
  Feature-gated: `--features opencl`.
- `OnnxBackend`: stub delegující na CPU reference.
- `RandomNpuGenerator`: tenký wrapper — odvozuje `model_hash` per epoch.
- `CircuitBreaker`: porovnává výstup libovolného HW backendu s CPU referencí.
- **`infer_batch`** (Fáze 1): batch inference — default impl loop, OpenCL override
  s program reuse (generuje program jednou, reuseuje pro všechny vstupy).

**Scale note:** `ProgramConfig::PRODUCTION` cílí na ~2M MAC/hash (theory doc §3.4).
`ProgramConfig::CI` (default) generuje ~1-10K MAC pro rychlé testy.
`ProgramConfig` pro budoucí scale-up experimenty.

## `poc-verifier`

- `CareVerifier`: validuje `CareProof` proti konfiguraci.
- Kontroluje: strukturu, model hash, backend allowlist, attestation, score threshold.
- `ScoreAggregator`: agreguje score napříč více proofy.
- `cross_validation` modul: **multi-backend honest-majority** verifikace
  (viz `ANALYSIS.md` §3.3, option 4) — spustí stejný `(model_hash, input)` přes
  více backendů a vyžaduje shodu alespoň `quorum` z nich. Backendy, které se
  neshodují s většinou, jsou nahlášeny jako potenciálně chybné/nečestné.

## `poc-registry`

- `ValidatorRegistry`: in-memory registry validátorů (prototyp; produkce by byla
  on-chain / L2 DAO-governed, viz `sefirot-vow.md` §7).
- Stake-based Sybil resistance (minimum stake threshold; identity uniqueness
  je out-of-scope pro prototyp).
- **Sefirot Vow lifecycle** přesně podle `sefirot-vow.md` §5:
  `NotTaken → Active → Suspended{since_epoch} → Active (renew)` nebo
  `→ Revoked{since_epoch, cooldown_epochs}` (refusal to renew, nebo permanentní
  revokace po 3 suspenzích s 365-epoch cooldown).
- **Bodhisattva Vow** (consciousness-admission-framework.md §6) — druhý, volitelný
  vow pro validátory kteří jsou zároveň L5 community Guardians:
  - `take_bodhisattva_vow(id, epoch, location?)` — zapíše `BodhisattvaVowRecord` do záznamu.
  - `renew_bodhisattva_vow(id, epoch)` — roční obnova (aktualizuje `last_renewed_epoch`).
  - `is_dual_vow(id, epoch)` — vrací `true` pokud je Sefirot Vow Active A Bodhisattva Vow
    v rámci ročního renewal window (`BODHISATTVA_RENEWAL_WINDOW_EPOCHS = 365`).
- **Dual-vow bonus**: validátor s oběma vow aktivními (`is_dual_vow = true`) dostává
  +5 % bonus na care score v každé epoše (`apply_dual_vow_bonus()` v poc-core).
- Care score bookkeeping (`total_care_score`, `proofs_submitted`, running average).

## `poc-economics`

- `RewardSplit`: 70/10/10/5/5 split (care validators / humanitarian / DAO /
  WARP / Hiran AI) podle `docs/3.0.4/PoC_CONCEPT.md` §7. `distribute()` zachovává
  celkový total i s rounding remainder (přiděleným do care validators pool).
- `distribute_to_validators`: proporcionální rozdělení care poolu podle care
  score, s **largest-remainder method** (Hamilton), takže součet výplat vždy
  přesně odpovídá poolu (žádný dust loss).
- `SlashingPolicy` + `SlashReason`: eskalující slash rate podle počtu předchozích
  offenses a závažnosti provinění (mapováno na sefirot-vow.md §5.1 breaking
  categories).

## `poc-sim`

- `NetworkSimulator`: propojuje všechny výše uvedené crates do jedné simulace.
- `SimulatedValidator` má flag `is_guardian: bool` a `ceremony_location: Option<String>`.
- `add_validator()`: registruje validátora, Sefirot Vow (vždy), a pokud `is_guardian = true`
  také Bodhisattva Vow s volitelnou `ceremony_location`.
- `run_epoch()`: task assignment → NPU inference → care proof → **dual-vow check** →
  care score (± bonus) → verifikace → registry bookkeeping → reward distribution → payout.
- `ValidatorEpochResult` má `dual_vow_bonus_applied: bool`.
- CLI demo (`cargo run -p poc-sim`) simuluje 4 validátory (honest, average, **guardian/dual-vow**, lazy)
  přes 5 epoch. Guardian `diana [S+B]` má +5 % care score oproti `alice [S]` se stejnou kvalitou.

## `poc-p2p` (Fáze 1 — NOVÝ)

- P2P networking layer pro multi-node simulaci.
- `GossipMessage` enum: Hello, CareProofBroadcast, EpochSyncRequest/Response,
  CrossValidateRequest/Response, Ping/Pong — serializováno jako length-prefixed JSON.
- `TcpTransport`: synchronní TCP transport (4-byte LE length prefix + JSON).
- `GossipProtocol`: flooding gossip s TTL-based propagací a BLAKE3 message dedup.
- `P2pNode`: spojuje `NetworkSimulator` + TCP listener + peer connections.
  - `bind()`: naslouchá na TCP portu (non-blocking accept loop v dedicated thread).
  - `connect(peer_addr)`: připojí se k peeru, pošle Hello handshake, spawn reader thread.
  - `run_epoch(epoch)`: lokální simulace + gossip broadcast care proofs.
  - `cross_validate_epoch(epoch, model_hash, min_score, quorum)`: honest-majority
    cross-validation — dedup proofs by validator_id, verifikace přes CareVerifier,
    quorum check, identifikace divergentních validátorů.
- `CrossValidationResult`: report s accepted/rejected proofs, quorum status,
  divergent validators.
- Thread-per-connection model, 10ms accept poll, 100ms read timeout.
- Testy: 2-node proof exchange, 3-node honest majority, divergent node detection,
  empty epoch quorum failure, single-node quorum-1.

---

## Data flow (end-to-end, jak implementováno v `poc-sim::run_epoch`)

```
1. Epoch seed + validator ID + registry eligibility check
        │
        ▼
2. TaskAssigner → TaskInput[]  (poc-tasks)
        │
        ▼
3. RandomNpuProgram::generate(model_hash, epoch) → deterministic topology (poc-npu::vm)
        │
        ▼
4. NpuBackend.infer(model_hash, input) → (output, attestation)  (poc-npu)
        │        (optionally: cross_validate() přes více backendů — poc-verifier)
        ▼
5. CareProof.new(...) + CareScoreComponents.compute()  (poc-core)
        │
        ▼
6. CareVerifier.verify(proof) → accepted score / error  (poc-verifier)
        │
        ▼
7. ValidatorRegistry.record_care_proof(...)  (poc-registry)
        │
        ▼
8. RewardSplit.distribute(block_reward) → pools  (poc-economics)
        │
        ▼
9. distribute_to_validators(care_pool, shares) → per-validator payout  (poc-economics)
```

---

## Determinism strategy

- `CpuReferenceBackend` (nad `vm::RandomNpuProgram`) je canonical reference.
- **`OpenClBackend`** (Fáze 1) prošel circuit breaker testem — **bit-exact shoda**
  s CPU referencí ověřena přes 50+ inputs, všechny 4 aktivace, multi-layer programy
  (3-5 layers, 32-128 hidden dim). OpenCL integer operace (char/int) jsou deterministické
  podle specifikace, a arithmetic right shift je emulován v kernelu pro zaručení shody
  s Rust's `i32 >> n`.
- Každý jiný backend musí projít `CircuitBreaker::check` proti CPU reference,
  nebo (silnější varianta) projít `cross_validation::cross_validate()` honest-majority
  testem proti sadě backendů.
- **P2P cross-validation** (Fáze 1): `P2pNode::cross_validate_epoch()` implementuje
  honest-majority across nodes — každý node verifikuje gossiped proofs a quorum
  je vyžadováno pro epoch validity.
- Model hash / program topology je deterministicky odvozen z `(genesis_seed, epoch)`.
- Všechny aritmetické operace ve VM jsou INT8/INT32 s explicitně definovaným
  rounding (arithmetic shift, clamp), takže výsledek je bit-exact na jakémkoli HW,
  které tuto specifikaci implementuje.
- V produkci by se aktivace nového `NpuBackend` dělala až po úspěšném
  circuit-breaker/cross-validation testu.

---

## Security assumptions (prototype)

- `NpuAttestation` je jen stub (quote_hash z výstupu, ne skutečný vendor quote).
  Reálné attestation vyžaduje vendor quote / TEE (viz `ANALYSIS.md` §3.3).
- **Real care task executors** (Fáze 1) produkují smysluplný output, ale z
  deterministických mock generátorů (ne reálná API data). V Fázi 2 se nahradí
  reálnými napojeními na L3 WARP API, L1 RPC, DEX indexer.
- `ValidatorRegistry` řeší Sybil resistance jen přes stake; skutečná identity
  uniqueness (hardware attestation, sociální graf, KYC) je out-of-scope.
- `SlashingPolicy` je konceptuální model; skutečná ekonomika by vyžadovala
  samostatný audit a game-theoretic analýzu (viz `ANALYSIS.md` §4).
- `poc-sim` je in-memory simulace. **`poc-p2p`** (Fáze 1) přidává multi-node
  TCP komunikaci a cross-validation, ale bez produkčního P2P stacku
  (žádné encryption, DHT, NAT traversal — laboratorní grade).
