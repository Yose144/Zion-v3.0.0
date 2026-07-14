# PoC-lab Fáze 1 — Real Hardware, Scale-up, Real Tasks, P2P

> **Status:** ✅ HOTOVO — 228 default / 239 s OpenCL testů PASS (Fáze 1 dokončena, Fáze 2 navazuje)
> **Datum:** 2026-07-14
> **Scope:** Pokračovat izolovaně v `PoC-lab/`, žádné V3 změny
> **HW:** AMD RX 5600 XT (Navi 10 / RDNA1 / gfx1010), ROCm 7.2.3, OpenCL 2.0

---

## 0. Současný stav (baseline)

| Co | Stav |
|----|------|
| Crates | 8 (`poc-core`, `poc-tasks`, `poc-npu`, `poc-verifier`, `poc-registry`, `poc-economics`, `poc-hiran`, `poc-sim`) |
| Testy | 145 PASS |
| NPU backend | `CpuReferenceBackend` (reálný INT8 VM), `OnnxBackend` (stub → deleguje na CPU), `HiranNpuBackend` (stub/live) |
| VM scale | ~1-10K MAC (ProgramConfig: 2-4 layers, 16-64 hidden) |
| Care task execution | `DummyExecutor` — generuje textový summary, ne reálnou logiku |
| Síť | Single-process, single-thread, in-memory |
| Circuit breaker | Implementován, testován jen CPU-vs-CPU |
| GPU/NPU HW | Nepoužívá se |

---

## 1. OpenCL GPU Backend (`poc-npu`)

### 1.1 Cíl

Implementovat `OpenClBackend` který spustí stejný INT8 VM forward pass na AMD RX 5600 XT přes OpenCL. Circuit breaker ověří bit-exact shodu s CPU referencí.

Tohle je **klíčový experiment**: dokáže GPU produkovat bit-exact INT8 výsledky? Pokud ano, circuit breaker pattern funguje a můžeme bezpečně přidávat další HW backendy. Pokud ne, zjistíme proč a upravíme specifikaci.

### 1.2 Proč OpenCL a ne HIP/ROCm

- RX 5600 XT je RDNA1 (gfx1010) — **není** v oficiálním ROCm supported list pro HIP compute
- OpenCL 2.0 funguje via `rocm-opencl` runtime (potvrzeno `clinfo`: AMD Accelerated Parallel Processing, device `gfx1010:xnack-`)
- OpenCL spec garantuje determinismus pro **integer** operace (char/short/int) — žádné floating-point rounding ambiguity
- `ocl` crate 0.19.7 už je v cargo registry cache (žádný network download potřeba)

### 1.3 Architektura

```
poc-npu/src/
├── lib.rs          (existing — NpuBackend trait, CpuReferenceBackend, etc.)
├── vm.rs           (existing — DeterministicRng, DenseLayer, RandomNpuProgram)
└── opencl.rs       (NEW — OpenClBackend + OpenCL kernel source)
```

**OpenCL kernel** (`opencl.rs` jako inline string nebo `opencl_kernel.cl`):

```c
// INT8 dense layer forward pass — jeden work-item per output neuron
__kernel void dense_forward(
    __global const char *weights,   // [out_dim * in_dim] INT8
    __global const int  *bias,      // [out_dim] INT32
    __global const char *input,     // [in_dim] INT8
    __global       char *output,    // [out_dim] INT8
    __constant const char *lut,     // [256] activation lookup table
    int in_dim,
    int shift
) {
    int o = get_global_id(0);
    if (o >= out_dim) return;

    int acc = bias[o];
    for (int j = 0; j < in_dim; j++) {
        acc += (int)weights[o * in_dim + j] * (int)input[j];
    }
    int scaled = acc >> shift;                    // arithmetic shift
    char clamped = (char)clamp(scaled, -128, 127);
    output[o] = lut[(uchar)clamped];              // activation LUT
}
```

**Klíčová rozhodnutí:**
- Jeden work-item per output neuron — přirozená paralelizace
- `char` = INT8, `int` = INT32 — OpenCL garantuje integer determinismus
- Activation LUT se předává jako `__constant` buffer (256 bytes, read-only)
- Multi-layer: host kód spouští kernel sekvenčně per layer, mezivýsledky v GPU buffer
- Žádný floating point nikde — vše integer

### 1.4 `OpenClBackend` struct

```rust
pub struct OpenClBackend {
    /// OpenCL platform + device + context + queue
    ctx: ocl::Context,
    queue: ocl::Queue,
    /// Pre-compiled program (kernel source je konstantní)
    program: ocl::Program,
    /// ProgramConfig pro generování topologie
    config: ProgramConfig,
    /// Backend name pro attestation
    name: &'static str,
}
```

**Lifecycle:**
1. `OpenClBackend::new()` — najde první GPU device, vytvoří context + queue, zkompiluje kernel
2. `infer(model_hash, input)` — vygeneruje `RandomNpuProgram` (stejný jako CPU), přenese weights/bias/LUT na GPU, spustí kernel per layer, přečte výstup
3. Vrátí `(output, NpuAttestation { backend: "opencl-gpu", ... })`

**Fallback:** Pokud žádné OpenCL device není k dispozici, `new()` vrátí `NpuError::UnsupportedBackend("no OpenCL GPU device found")` — žádný silent fallback (na rozdíl od Hiran backendu).

### 1.5 Testy

| Test | Co ověřuje |
|------|------------|
| `opencl_device_available` | `rocminfo` / `clinfo` najde GPU — skip pokud ne |
| `opencl_output_matches_cpu_reference` | **Circuit breaker**: stejný `(model_hash, input)` → bit-exact shoda |
| `opencl_deterministic_across_runs` | Dva běhy → stejný výstup |
| `opencl_multi_layer_program` | Program s 4+ layers → správný výstup |
| `opencl_all_activations` | ReLU, GELU, SiLU, HardSwish — každá projde circuit breaker |
| `opencl_benchmark_vs_cpu` | Měření latence: GPU vs CPU při různých scale (benchmark feature) |

### 1.6 Feature flag

```toml
[features]
default = []
opencl = ["dep:ocl"]    # opt-in — ne všichni mají GPU/OpenCL
benchmark = ["dep:criterion"]
```

`cargo test -p poc-npu --features opencl` — spustí OpenCL testy
`cargo test -p poc-npu` — bez OpenCL (default, CI-safe)

---

## 2. VM Scale-up + Stress Testing (`poc-npu`)

### 2.1 Cíl

Škálovat z ~1-10K MAC na ~2M MAC (theory doc target) a benchmarkovat CPU vs GPU výkon.

### 2.2 ProgramConfig presets

```rust
impl ProgramConfig {
    /// CI default — rychlé testy (~1-10K MAC)
    pub const CI: Self = Self {
        min_layers: 2, max_layers: 4,
        min_hidden_dim: 16, max_hidden_dim: 64,
    };

    /// Benchmark — střední scale (~50-200K MAC)
    pub const BENCH: Self = Self {
        min_layers: 4, max_layers: 8,
        min_hidden_dim: 64, max_hidden_dim: 256,
    };

    /// Production target — ~2M MAC (theory doc §3.4)
    pub const PRODUCTION: Self = Self {
        min_layers: 6, max_layers: 12,
        min_hidden_dim: 128, max_hidden_dim: 512,
    };
}
```

**MAC estimate:**
- CI: 2 layers × (64×16 + 16×64) = ~4K MAC
- BENCH: 6 layers × (64×256 + 256×256 + ... + 256×64) ≈ ~100-200K MAC
- PRODUCTION: 10 layers × (64×512 + 512×512×8 + 512×64) ≈ ~2M MAC

### 2.3 Benchmark infrastructure

Přidat `criterion` crate (feature-gated):

```
poc-npu/benches/
└── vm_benchmark.rs    — CPU vs GPU (OpenCL) při CI/BENCH/PRODUCTION scale
```

**Měřené metriky:**
- Latence per inference (µs)
- MAC ops / sec (throughput)
- GPU kernel launch overhead vs compute time
- Breakeven point: při jakém MAC count se GPU vyplatí nad CPU

**Očekávaný výsledek (hypotéza):**
- CI scale (~4K MAC): CPU rychlejší (GPU launch overhead dominuje)
- BENCH scale (~100K MAC): GPU začíná vyhrávat
- PRODUCTION scale (~2M MAC): GPU výrazně rychlejší (teorie doc §2.2: kernel launch ~100-500µs, compute ~0.3µs při 16K MAC → při 2M MAC compute ~37µs, launch amortizován)

### 2.4 Batch inference

Přidat `NpuBackend::infer_batch(model_hash, inputs: &[&[u8]])` — spustí více vstupů přes stejný program. Tohle je klíčové pro NPU amortizaci (teorie doc §2.2: "batch inference, tisíce vstupů paralelně").

```rust
pub trait NpuBackend {
    fn name(&self) -> &str;
    fn infer(&self, model_hash: Hash, input: &[u8]) -> Result<(Vec<u8>, NpuAttestation), NpuError>;

    /// Batch inference — default impl deleguje na infer() v smyčce.
    /// OpenClBackend override: všechny vstupy v jednom kernel launch.
    fn infer_batch(&self, model_hash: Hash, inputs: &[Vec<u8>])
        -> Result<Vec<(Vec<u8>, NpuAttestation)>, NpuError>
    { /* default: loop over infer() */ }
}
```

OpenCL kernel by měl zpracovat batch dimenzi: `get_global_id(0)` = output neuron, `get_global_id(1)` = batch index.

### 2.5 Stress testy

| Test | Co ověřuje |
|------|------------|
| `production_scale_program_generates` | PRODUCTION config generuje program s ~2M MAC |
| `production_scale_cpu_completes` | CPU zpracuje PRODUCTION program pod 100ms |
| `production_scale_opencl_completes` | GPU zprocessuje PRODUCTION program pod 10ms (hypotéza) |
| `batch_inference_correctness` | 100 vstupů → každý bit-exact s CPU referencí |
| `batch_inference_throughput` | 1000 vstupů: GPU throughput > CPU throughput |

---

## 3. Real Care Task Logic (`poc-tasks`)

### 3.1 Cíl

Nahradit `DummyExecutor` reálnou logikou pro specifické task typy. Každý executor produkuje smysluplný, hashovatelný, verifikovatelný output.

### 3.2 Architektura

```
poc-tasks/src/
├── lib.rs           (existing — TaskAssigner, TaskRegistry, DummyExecutor)
├── executors/
│   ├── mod.rs       (NEW — TaskExecutor trait)
│   ├── warp.rs      (NEW — WarpBridgeAuditExecutor)
│   ├── anomaly.rs   (NEW — L1AnomalyDetectionExecutor)
│   ├── liquidity.rs (NEW — LiquidityHealthExecutor)
│   └── constitutional.rs (NEW — ConstitutionalAuditExecutor)
```

### 3.3 `TaskExecutor` trait

```rust
/// Executor který produkuje reálný výstup pro care task.
/// Na rozdíl od DummyExecutor generuje smysluplná data.
pub trait TaskExecutor {
    /// Spustí task nad vstupními daty a vrátí výsledek.
    fn execute(&self, input: &TaskInput) -> Result<TaskOutput, ExecutorError>;

    /// Které task typy tento executor podporuje.
    fn supports(&self) -> &[CareTask];
}
```

### 3.4 Konkrétní executory

#### WarpBridgeAuditExecutor (`warp.rs`)

**Co dělá:** Audituje WARP bridge state — ověřuje že bridge balances jsou konzistentní, že nejsou pending locks starší než threshold, že TVL odpovídá očekávané hodnotě.

**Vstup:** `input_hash` = Blake3(bridge_state_snapshot) — snapshot L3 WARP API (`/api/bridge/status`)

**Logika:**
1. Parsování bridge state JSON (nebo binární digest)
2. Kontrola: `locked_zion == minted_wzion ± tolerance`
3. Kontrola: žádný pending lock > 24h starý
4. Kontrola: TVL v reasonable range
5. Output: `bytes` = Blake3(audit_result), `summary` = "bridge OK / bridge DRIFT detected / bridge STALE"

**Data source:** Pro izolovanou laboratoř — mock bridge state generator (deterministický z epoch seed). V budoucnu (Fáze 2) napojení na reálné L3 WARP API.

#### L1AnomalyDetectionExecutor (`anomaly.rs`)

**Co dělá:** Detekuje anomálie v L1 mempool/transaction patterns — neobvyklé fee spikes, circular transfers, dust attacks.

**Vstup:** `input_hash` = Blake3(mempool_snapshot)

**Logika:**
1. Deterministická generace "mempool" z epoch seed (mock — N transactions s random fees/amounts)
2. Statistická analýza: mean/median/stddev fee, outlier detection (z-score > 3)
3. Circular transfer detection (graf algoritmus na mock datech)
4. Output: `bytes` = Blake3(anomaly_report), `summary` = "N anomalies detected / mempool clean"

#### LiquidityHealthExecutor (`liquidity.rs`)

**Co dělá:** Kontroluje DEX liquidity pool health — TVL, slippage, impermanent loss indicators.

**Vstup:** `input_hash` = Blake3(pool_state_snapshot)

**Logika:**
1. Mock pool state (deterministický z epoch seed): N pools s reserves
2. Constant product check: `reserve_a * reserve_b == k ± tolerance`
3. Slippage calculation pro swap velikosti
4. Output: `bytes` = Blake3(health_report), `summary` = "pools healthy / pool N drifted"

#### ConstitutionalAuditExecutor (`constitutional.rs`)

**Co dělá:** Validuje DAO proposal against constitution rules — checks proposal doesn't violate fundamental constraints (max supply change, no self-dealing, etc.).

**Vstup:** `input_hash` = Blake3(proposal_text)

**Logika:**
1. Mock proposal (deterministický z epoch seed): random proposal parameters
2. Rule checks: max_mint < 1% supply, no direct treasury transfer to proposer, quorum met
3. Output: `bytes` = Blake3(audit_verdict), `summary` = "proposal constitutional / proposal VIOLATES rule N"

### 3.5 `CompositeExecutor`

```rust
/// Router executor — dispatches to the right executor based on task type.
pub struct CompositeExecutor {
    warp: WarpBridgeAuditExecutor,
    anomaly: L1AnomalyDetectionExecutor,
    liquidity: LiquidityHealthExecutor,
    constitutional: ConstitutionalAuditExecutor,
    /// Fallback pro tasky bez specifického executoru
    dummy: DummyExecutor,
}

impl CompositeExecutor {
    pub fn execute(&self, input: &TaskInput) -> TaskOutput {
        match input.task {
            CareTask::WarpBridgeAudit => self.warp.execute(input),
            CareTask::L1AnomalyDetection => self.anomaly.execute(input),
            CareTask::LiquidityHealth => self.liquidity.execute(input),
            CareTask::ConstitutionalAudit => self.constitutional.execute(input),
            _ => self.dummy.execute(input),  // NpuInferenceQuality, HiranInference, etc.
        }
    }
}
```

### 3.6 Testy

| Test | Co ověřuje |
|------|------------|
| `warp_executor_detects_drift` | Mock bridge s driftem → summary obsahuje "DRIFT" |
| `warp_executor_healthy_bridge` | Mock bridge OK → summary obsahuje "OK" |
| `anomaly_executor_detects_outliers` | Mock mempool s outlier fee → anomaly report |
| `liquidity_executor_detects_imbalance` | Mock pool s imbalance → health report |
| `constitutional_executor_rejects_violation` | Mock proposal s violation → "VIOLATES" |
| `composite_routes_correctly` | Každý task type → správný executor |
| `executor_outputs_are_deterministic` | Stejný input → stejný output (hash) |
| `executor_outputs_differ_per_epoch` | Různá epoch → různý output |

---

## 4. P2P / Multi-Process Simulation (`poc-p2p`)

### 4.1 Cíl

Rozšířit simulátor z jednoho procesu na multi-node P2P síť. Každý node je samostatný proces s vlastním `NetworkSimulator`, komunikují přes TCP.

### 4.2 Nový crate: `poc-p2p`

```
poc-p2p/
├── Cargo.toml
├── src/
│   ├── lib.rs        — P2pNode, P2pConfig, GossipMessage
│   ├── transport.rs  — TCP transport layer
│   ├── gossip.rs     — Gossip protocol (propagation of care proofs)
│   └── node.rs       — P2pNode: spojuje NetworkSimulator + transport
├── examples/
│   └── multi_node.rs — Spustí 5 nodů, každý jako thread, 3 epochy
└── tests/
    └── integration.rs — Multi-node integration test
```

### 4.3 Architektura

```
┌─────────────────────────────────────────────────────┐
│                    poc-p2p                           │
│                                                      │
│  ┌──────────┐  TCP   ┌──────────┐  TCP  ┌──────────┐│
│  │  Node A  │◀──────▶│  Node B  │◀─────▶│  Node C  ││
│  │(simulator)│       │(simulator)│      │(simulator)│
│  └──────────┘       └──────────┘      └──────────┘│
│       │                  │                  │       │
│       ▼                  ▼                  ▼       │
│  CareProofs         CareProofs         CareProofs   │
│  (gossiped)         (gossiped)         (gossiped)   │
└─────────────────────────────────────────────────────┘
```

### 4.4 Protokol

**Gossip message types:**

```rust
#[derive(Serialize, Deserialize)]
pub enum GossipMessage {
    /// Handshake — announce node identity + capabilities
    Hello { node_id: ValidatorId, port: u16, version: u8 },

    /// Propagate a care proof to peers
    CareProofBroadcast { proof: CareProof },

    /// Request proofs for a specific epoch
    EpochSyncRequest { epoch: u64 },

    /// Response to sync request
    EpochSyncResponse { proofs: Vec<CareProof> },

    /// Cross-validation request — "please verify this proof"
    CrossValidateRequest { proof: CareProof },

    /// Cross-validation response
    CrossValidateResponse { proof_hash: Hash, verdict: ValidationVerdict },

    /// Heartbeat — keep-alive
    Ping,
    Pong,
}
```

**Transport:** Synchronous TCP (s `std::net::TcpStream`), length-prefixed JSON messages. Jednoduché, spolehlivé, dostatečné pro laboratoř.

**Gossip protocol:**
1. Node A vyrobí care proof → broadcast všem peerům
2. Node B přijme proof → ověří (`CareVerifier`) → přidá do své epoch kolekce
3. Pokud proof projde, Node B rebroadcastuje dalším peerům (flooding gossip, TTL=2)
4. Na konci epochy: každý node má kolekci proofs → cross-validation (honest majority)

### 4.5 `P2pNode`

```rust
pub struct P2pNode {
    /// Node identity
    pub node_id: ValidatorId,
    /// Listen address
    pub listen_addr: SocketAddr,
    /// Connected peers
    peers: Vec<TcpStream>,
    /// Local simulator
    sim: NetworkSimulator,
    /// Received proofs from peers (per epoch)
    received_proofs: HashMap<u64, Vec<CareProof>>,
    /// Configuration
    config: P2pConfig,
}
```

**Lifecycle:**
1. `P2pNode::bind(addr)` — naslouchá na TCP portu
2. `connect(peer_addr)` — připojí se k peeru, pošle `Hello`
3. `run_epoch(epoch)` — lokální simulace + gossip broadcast + receive + cross-validation
4. `shutdown()` — uzavře všechny spojení

### 4.6 Cross-validation across nodes

Na konci epochy každý node:
1. Seznamne všechny proofs (lokální + gossiped)
2. Spustí `cross_validate()` (už existuje v `poc-verifier`)
3. Pokud quorum nodů shodně přijme proof → proof je accepted network-wide
4. Nody které se neshodnou jsou označeny jako "divergent"

### 4.7 Testy

| Test | Co ověřuje |
|------|------------|
| `two_nodes_exchange_proofs` | Node A proof → Node B přijme a verifikuje |
| `three_nodes_gossip_propagation` | A→B→C: proof se propáguje |
| `cross_validation_honest_majority` | 3 honest + 1 faulty → faulty je odhalen |
| `epoch_sync_catches_up` | Node startne pozdě → syncne proofs z minulé epochy |
| `node_disconnect_handled` | Node spadne → ostatní pokračují bez erroru |
| `multi_node_5_validators_3_epochs` | Full integration: 5 nodů, 3 epochy, všichni přijati |

### 4.8 Example binary

```bash
# Spustí 5 nodů jako separate threads na localhost, různé porty
cargo run -p poc-p2p --example multi_node -- --nodes 5 --epochs 3
```

Output: per-epoch report z každého node, cross-validation výsledky, network health.

---

## 5. Implementační pořadí

| Fáze | Co | Dependencies | Odhad |
|------|----|-------------|-------|
| **1a** | OpenCL backend + circuit breaker test | `ocl` crate, GPU | Klíčový experiment |
| **1b** | ProgramConfig presets + benchmark | 1a pro GPU benchmark | |
| **1c** | Batch inference | 1a | |
| **2a** | TaskExecutor trait + WarpBridgeAuditExecutor | — | Nezávislé na 1a |
| **2b** | L1AnomalyDetection + LiquidityHealth + ConstitutionalAudit | 2a | |
| **2c** | CompositeExecutor + integrace do poc-sim | 2a, 2b | |
| **3a** | poc-p2p crate skeleton (transport + gossip) | — | Nezávislé na 1a, 2a |
| **3b** | P2pNode + multi-node integration | 3a, poc-sim | |
| **3c** | Cross-validation across nodes | 3b, poc-verifier | |

**Paralelizace:** Fáze 1a/1b/1c (GPU), 2a/2b/2c (tasks), 3a/3b/3c (P2P) jsou nezávislé a mohou běžet paralelně.

---

## 6. Nové dependencies

| Crate | Verze | Účel | Feature gate |
|-------|-------|------|-------------|
| `ocl` | 0.19 | OpenCL bindings | `opencl` |
| `criterion` | 0.5 | Benchmarking | `benchmark` |
| `serde_json` | (workspace) | JSON pro P2P messages | — |

Vše už je v cargo registry cache (žádný network download).

---

## 7. Rizika a mitigace

| Rizika | Mitigace |
|--------|---------|
| OpenCL INT8 není bit-exact s CPU | Circuit breaker to odhalí. Pokud ne, upravíme specifikaci (možná INT16 intermediate) |
| GPU kernel launch overhead dominuje při small scale | Očekávané — benchmark ukáže breakeven point. PRODUCTION scale by mělo amortizovat |
| `ocl` crate API je verbose/error-prone | Wrapper struct s clean API, testy |
| P2P testy jsou flaky (port conflicts, timing) | Bind na port 0 (OS-assigned), generous timeouts, retry logic |
| Real care task logic je příliš mock-heavy | Mock generátory jsou deterministické z epoch seed — v Fázi 2 nahradíme reálnými API calls |
| ROCm OpenCL driver crash | Graceful error handling, `NpuError::InferenceFailed` |

---

## 8. Co NENÍ v scope

- **Žádné V3 změny** — vše v `PoC-lab/`
- **Žádný L1 consensus** — simulace only
- **Žádné reálné API calls** (WARP, L1 RPC, DEX) — mock generátory z epoch seed
- **Žádné ONNX Runtime** — OpenCL je HW backend, ONNX je future work
- **Žádné TEE/SGX attestation** — `NpuAttestation` zůstává hash-based stub
- **Žádné production economics** — slashing a reward model jsou konceptuální
