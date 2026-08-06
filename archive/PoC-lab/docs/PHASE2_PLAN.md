# PoC-lab Fáze 2 — Real Data, Hardened P2P, Adversarial Economics, Persistent Storage

> **Status:** ✅ HOTOVO — 277 default / 325 all-features testů PASS
> **Datum:** 2026-07-14
> **Scope:** Pokračovat izolovaně v `PoC-lab/`, žádné V3 změny
> **HW:** AMD RX 5600 XT, ROCm 7.2.3, OpenCL 2.0
> **Live APIs:** L1 RPC `rpc.zionterranova.com:8443`, L3 WARP `127.0.0.1:8453`

---

## 0. Současný stav (po Fázi 1)

| Co | Stav |
|----|------|
| Crates | 9 (`poc-core`, `poc-tasks`, `poc-npu`, `poc-verifier`, `poc-registry`, `poc-economics`, `poc-hiran`, `poc-sim`, `poc-p2p`) |
| Testy | 228 default / 239 s OpenCL — vše PASS |
| GPU backend | OpenClBackend — bit-exact s CPU referencí |
| Care task executors | 4 reálné (Warp, Anomaly, Liquidity, Constitutional) + CompositeExecutor |
| P2P | TCP transport, gossip, P2pNode, cross-validation |
| Data sources | Mock generátory (deterministické z epoch seed) |
| P2P security | Žádná (plaintext TCP) |
| Economics | Konceptuální model, žádné adversarial sim |
| Storage | In-memory HashMap |

---

## 1. Real Data Sources (`poc-tasks`)

### 1.1 Cíl

Napojit care task executory na live L1 RPC a L3 WARP API. Read-only, laboratorní grade.
Mock generátory zůstávají jako fallback (default, no network).

### 1.2 Architektura

```
poc-tasks/src/
├── data_sources/
│   ├── mod.rs       — DataSource trait, DataSourceError
│   ├── l1_rpc.rs    — L1RpcSource (block height, mempool, recent TXs)
│   ├── warp_api.rs  — WarpApiSource (bridge status, pending locks, TVL)
│   └── mock.rs      — MockDataSource (existing mock generators wrapped)
```

### 1.3 DataSource trait

```rust
pub trait DataSource: Send + Sync {
    /// Fetch raw data snapshot for the given epoch.
    fn fetch(&self, epoch: u64) -> Result<DataSourceSnapshot, DataSourceError>;
    /// Human-readable name for logging.
    fn name(&self) -> &str;
}

pub struct DataSourceSnapshot {
    /// Raw bytes of the data (JSON, binary, etc.)
    pub raw: Vec<u8>,
    /// BLAKE3 hash of raw data — used as input_hash for executors
    pub hash: Hash,
    /// Source timestamp (Unix seconds)
    pub timestamp: u64,
}
```

### 1.4 L1RpcSource

- Endpoint: `http://rpc.zionterranova.com:8443` (public, nginx TCP stream proxy)
- Fetches: current block height, mempool TX count, recent block hashes
- Uses `ureq` (synchronous, already in workspace deps)
- Timeout: 5s, graceful error → fallback to mock
- Feature-gated: `--features live-data`

### 1.5 WarpApiSource

- Endpoint: `http://127.0.0.1:8453` (L3 WARP API, local)
- Fetches: `/api/bridge/status` — locked_zion, minted_wzion, pending_locks, TVL
- Uses `ureq`
- Timeout: 3s, graceful error → fallback to mock
- Feature-gated: `--features live-data`

### 1.6 Executor integration

Executors accept an optional `DataSource`. When present, `input_hash` is derived
from the live snapshot instead of the mock generator. When absent (default),
mock generators are used (existing behavior, backward compatible).

### 1.7 Testy

| Test | Co ověřuje |
|------|------------|
| `mock_data_source_is_deterministic` | Stejná epoch → stejný snapshot |
| `l1_rpc_source_parses_block_height` | Mock HTTP response → parsed snapshot |
| `warp_api_source_parses_bridge_status` | Mock HTTP response → parsed snapshot |
| `data_source_timeout_falls_back_to_mock` | Timeout → mock fallback |
| `executor_with_live_data_source` | Executor uses snapshot hash as input |
| `executor_with_mock_data_source` | Executor uses mock hash (backward compat) |

---

## 2. P2P Hardening (`poc-p2p`)

### 2.1 Cíl

Přidat encryption (X25519 ECDH + AES-GCM), node identity (Ed25519), peer discovery,
a reconnection logic. Zůstává laboratorní grade (žádné NAT traversal, DHT).

### 2.2 Architektura

```
poc-p2p/src/
├── crypto.rs        — NodeIdentity, EncryptedTransport, KeyExchange
├── peer_discovery.rs — PeerDiscovery (seed peers, gossip peer exchange)
├── transport.rs     — (existing, modified for encrypted mode)
├── node.rs          — (existing, modified for identity + reconnection)
├── gossip.rs        — (existing)
└── lib.rs           — (existing, re-exports)
```

### 2.3 NodeIdentity (Ed25519)

```rust
pub struct NodeIdentity {
    /// Ed25519 signing keypair
    keypair: ed25519_dalek::SigningKey,
    /// Public key (also the node's persistent ID)
    pub public_key: ed25519_dalek::VerifyingKey,
    /// BLAKE3(public_key) — short node ID for logging
    pub node_id: ValidatorId,
}

impl NodeIdentity {
    pub fn generate() -> Self;
    pub fn from_bytes(secret: &[u8; 32]) -> Self;
    pub fn sign(&self, msg: &[u8]) -> Signature;
    pub fn verify(pk: &VerifyingKey, msg: &[u8], sig: &Signature) -> bool;
}
```

### 2.4 EncryptedTransport (X25519 + AES-GCM)

Handshake:
1. Client → Server: `Hello { node_id, public_key, ephemeral_pk, signature }`
2. Server → Client: `HelloAck { node_id, public_key, ephemeral_pk, signature }`
3. Both: ECDH(ephemeral) → derive AES-GCM key via SHA-256(KDF)
4. All subsequent messages: AES-GCM encrypted + length-prefixed

```rust
pub struct EncryptedTransport {
    stream: TcpStream,
    cipher: Aes256Gcm,
    /// Nonce counter (incremented per message)
    nonce_counter: u64,
}
```

### 2.5 PeerDiscovery

```rust
pub struct PeerDiscovery {
    /// Known peer addresses (seed + discovered)
    peers: HashSet<SocketAddr>,
    /// Failed connection attempts (for backoff)
    failures: HashMap<SocketAddr, u32>,
    /// Max backoff in seconds
    max_backoff_secs: u64,
}

impl PeerDiscovery {
    pub fn from_seeds(seeds: &[&str]) -> Self;
    pub fn add_peer(&mut self, addr: SocketAddr);
    pub fn next_peer_to_try(&self) -> Option<SocketAddr>;
    pub fn record_failure(&mut self, addr: SocketAddr);
    pub fn record_success(&mut self, addr: SocketAddr);
    /// Gossip-based peer exchange — share known peers with connected nodes
    pub fn known_peers(&self) -> Vec<SocketAddr>;
}
```

### 2.6 Reconnection

`P2pNode::run_epoch` checks peer count. If below `min_peers`, attempts to connect
to peers from `PeerDiscovery` with exponential backoff (1s, 2s, 4s, ... max 60s).

### 2.7 Feature flags

```toml
[features]
default = []
crypto = ["dep:ed25519-dalek", "dep:curve25519-dalek", "dep:aes-gcm", "dep:sha2"]
```

`cargo test -p poc-p2p --features crypto` — spustí crypto testy
`cargo test -p poc-p2p` — bez crypto (default, CI-safe)

### 2.8 Testy

| Test | Co ověřuje |
|------|------------|
| `node_identity_generate_and_sign` | Ed25519 keypair generation + sign/verify |
| `node_identity_from_bytes_deterministic` | Stejný secret → stejný keypair |
| `encrypted_transport_handshake` | X25519 ECDH → both derive same AES key |
| `encrypted_transport_roundtrip` | Encrypt → decrypt → original message |
| `encrypted_transport_rejects_tampered` | Modified ciphertext → auth failure |
| `peer_discovery_from_seeds` | Seed list → peer set |
| `peer_discovery_backoff_on_failure` | Failed peer → backoff |
| `reconnection_after_disconnect` | Node disconnects → reconnects with backoff |

---

## 3. Adversarial Economics Simulation (`poc-sim`)

### 3.1 Cíl

Multi-epoch simulace s adversarial validátory. Modeluje gaming strategies,
slashing enforcement, a detection rate.

### 3.2 Architektura

```
poc-sim/src/
├── adversarial.rs   — AdversarialStrategy, AdversarialValidator, AdversarialSimulator
└── lib.rs           — (existing, re-exports)
```

### 3.3 AdversarialStrategy

```rust
pub enum AdversarialStrategy {
    /// Honest validator — always produces valid proofs
    Honest,
    /// Lazy — produces proofs but with minimal effort (low care score)
    Lazy,
    /// Score gamer — inflates care score artificially
    ScoreGamer,
    /// Bridge spoofer — fabricates bridge audit results
    BridgeSpoofer,
    /// Colluding group — multiple validators produce identical fake proofs
    Colluding(u32), // group ID
    /// Intermittent — honest most of the time, occasionally cheats
    Intermittent(f64), // honesty ratio (0.0-1.0)
}
```

### 3.4 AdversarialSimulator

```rust
pub struct AdversarialSimulator {
    /// Base simulator
    sim: NetworkSimulator,
    /// Per-validator adversarial strategy
    strategies: HashMap<ValidatorId, AdversarialStrategy>,
    /// Slashing history (validator_id → offense count)
    slashing_history: HashMap<ValidatorId, u8>,
    /// Total epochs simulated
    epochs_run: u64,
    /// Cumulative metrics
    metrics: SimulationMetrics,
}

pub struct SimulationMetrics {
    pub total_rewards_distributed: u64,
    pub total_slashed: u64,
    pub slashing_events: u32,
    pub detection_rate: f64,        // detected / actual
    pub false_positive_rate: f64,   // honest wrongly slashed / total honest
    pub gini_coefficient: f64,      // reward inequality
    pub validator_survival_rate: f64, // validators not banned / total
}
```

### 3.5 Gaming detection

- **Score gaming**: care_score > 2× median → flagged
- **Bridge spoofing**: output hash doesn't match expected bridge state
- **Collusion**: N validators produce identical output within tolerance
- **Lazy detection**: care_score consistently < min_care_score / 2

### 3.6 Slashing enforcement

When a validator is detected:
1. First offense: `SlashingPolicy::apply(stake, 0, reason)` — 10% slash
2. Second offense: `SlashingPolicy::apply(stake, 1, reason)` — 25% slash
3. Third offense: `SlashingPolicy::apply(stake, 2, reason)` — 40% slash + Sefirot Vow suspension
4. Fourth offense: 100% slash + permanent ban

### 3.7 Testy

| Test | Co ověřuje |
|------|------------|
| `honest_validators_not_slashed` | 10 epochs, all honest → 0 slashing events |
| `lazy_validator_detected_and_slashed` | Lazy strategy → detected within 3 epochs |
| `score_gamer_detected` | Inflated score → flagged by median check |
| `collusion_detected` | 3 colluding validators → identical outputs detected |
| `slashing_escalates` | Repeat offenses → escalating slash rates |
| `gini_coefficient_calculated` | Reward distribution → Gini in [0, 1] |
| `intermittent_validator_partial_detection` | 80% honest → detected on cheat epochs |
| `survival_rate_after_50_epochs` | Honest survive, adversaries banned |

---

## 4. Persistent Storage (`poc-storage` — NOVÝ crate, 10th)

### 4.1 Cíl

Perzistentní úložiště care proofs, epoch reports, a audit trail. Místo in-memory
HashMap → file-based bincode storage (žádný externí DB dependency).

### 4.2 Architektura

```
poc-storage/
├── Cargo.toml
├── src/
│   ├── lib.rs        — ProofStore trait, StorageError, re-exports
│   ├── file_store.rs — FileProofStore (bincode + content-addressed files)
│   ├── epoch_history.rs — EpochHistory (per-epoch snapshots, replay)
│   └── audit_trail.rs — AuditTrail (tamper-evident hash chain)
└── tests/
    └── integration.rs
```

### 4.3 ProofStore trait

```rust
pub trait ProofStore: Send + Sync {
    fn store_proof(&self, proof: &CareProof) -> Result<Hash, StorageError>;
    fn retrieve_proof(&self, hash: &Hash) -> Result<Option<CareProof>, StorageError>;
    fn proofs_for_epoch(&self, epoch: u64) -> Result<Vec<CareProof>, StorageError>;
    fn proofs_for_validator(&self, vid: &ValidatorId) -> Result<Vec<CareProof>, StorageError>;
    fn proof_count(&self) -> Result<usize, StorageError>;
}
```

### 4.4 FileProofStore

- Storage layout: `{base_dir}/proofs/{hash[0..2]}/{hash}.bincode`
- Content-addressed: filename = BLAKE3(serialize(proof))
- Bincode serialization (compact, fast)
- Sharded by first 2 bytes of hash (256 dirs) — avoids single dir with millions of files
- Index file: `{base_dir}/index.bincode` — HashMap<(epoch, validator_id), Hash>

### 4.5 EpochHistory

```rust
pub struct EpochHistory {
    /// Per-epoch report snapshots
    epochs: HashMap<u64, EpochSnapshot>,
    /// Base directory for persistence
    base_dir: PathBuf,
}

pub struct EpochSnapshot {
    pub epoch: u64,
    pub model_hash: Hash,
    pub accepted_proofs: Vec<Hash>,
    pub rejected_proofs: Vec<Hash>,
    pub reward_distribution: RewardDistribution,
    pub timestamp: u64,
}
```

- `save_epoch(snapshot)` — persists to `{base_dir}/epochs/{epoch}.bincode`
- `load_epoch(epoch)` — loads from disk
- `replay(from_epoch, to_epoch)` — replays epoch sequence
- `chain_hash()` — BLAKE3 chain of all epoch hashes (tamper-evident)

### 4.6 AuditTrail

```rust
pub struct AuditTrail {
    /// Hash chain: entry[i].prev_hash = BLAKE3(entry[i-1])
    entries: Vec<AuditEntry>,
    base_dir: PathBuf,
}

pub struct AuditEntry {
    pub sequence: u64,
    pub timestamp: u64,
    pub event: AuditEvent,
    pub prev_hash: Hash,
    pub entry_hash: Hash,
}

pub enum AuditEvent {
    ProofStored { proof_hash: Hash, validator_id: ValidatorId },
    ProofVerified { proof_hash: Hash, score: u64 },
    ProofRejected { proof_hash: Hash, reason: String },
    ValidatorSlashed { validator_id: ValidatorId, amount: u64, reason: SlashReason },
    EpochFinalized { epoch: u64, accepted: usize, rejected: usize },
}
```

- Append-only log: `{base_dir}/audit.log.bincode`
- Tamper-evident: each entry's `prev_hash` = hash of previous entry
- `verify_chain()` — validates hash chain integrity
- `append(event)` — adds new entry, updates chain

### 4.7 Integration

- `poc-sim`: `NetworkSimulator` accepts optional `ProofStore`. When present,
  proofs are persisted after each epoch.
- `poc-p2p`: `P2pNode` accepts optional `ProofStore`. Received proofs are persisted.
- Default: no storage (in-memory, backward compatible)
- Feature-gated in poc-sim/poc-p2p: `--features storage`

### 4.8 Testy

| Test | Co ověřuje |
|------|------------|
| `file_store_roundtrip` | Store proof → retrieve → identical |
| `file_store_content_addressed` | Same proof → same hash → same file |
| `file_store_proofs_for_epoch` | Store 3 proofs for epoch 1 → query returns 3 |
| `file_store_proofs_for_validator` | Store proofs from 2 validators → filter works |
| `epoch_history_save_and_load` | Save snapshot → load → identical |
| `epoch_history_replay` | 5 epochs → replay returns all 5 |
| `epoch_history_chain_hash` | Chain hash changes if any epoch modified |
| `audit_trail_append_and_verify` | Append 10 entries → verify chain OK |
| `audit_trail_detects_tampering` | Modify entry 5 → verify fails |
| `audit_trail_events_recorded` | All event types → stored correctly |
| `storage_cleanup_on_drop` | TempDir → files cleaned up |

---

## 5. Implementační pořadí

| Fáze | Co | Dependencies | Feature gate |
|------|----|-------------|-------------|
| **1a** | DataSource trait + MockDataSource | — | — |
| **1b** | L1RpcSource + WarpApiSource | 1a, `ureq` | `live-data` |
| **1c** | Executor integration + tests | 1a, 1b | `live-data` |
| **2a** | NodeIdentity (Ed25519) | `ed25519-dalek` | `crypto` |
| **2b** | EncryptedTransport (X25519+AES-GCM) | 2a, `curve25519-dalek`, `aes-gcm` | `crypto` |
| **2c** | PeerDiscovery + reconnection | 2a | `crypto` |
| **3a** | AdversarialStrategy + AdversarialSimulator | poc-sim, poc-economics | — |
| **3b** | Gaming detection + slashing enforcement | 3a | — |
| **3c** | SimulationMetrics + multi-epoch tests | 3a, 3b | — |
| **4a** | poc-storage crate (ProofStore + FileProofStore) | `bincode` | `storage` |
| **4b** | EpochHistory + AuditTrail | 4a | `storage` |
| **4c** | Integration with poc-sim + poc-p2p | 4a, 4b | `storage` |

**Paralelizace:** WS1 (data), WS2 (crypto), WS3 (economics), WS4 (storage) jsou nezávislé.

---

## 6. Nové dependencies

| Crate | Verze | Účel | Feature gate |
|-------|-------|------|-------------|
| `ed25519-dalek` | 2.2 | Node identity signatures | `crypto` |
| `curve25519-dalek` | 4.1 | X25519 ECDH key exchange | `crypto` |
| `aes-gcm` | 0.10 | AEAD encryption | `crypto` |
| `sha2` | 0.10 | SHA-256 for KDF | `crypto` |
| `bincode` | 1.3 | Binary serialization for storage | `storage` |
| `tempfile` | 3.27 | Temp dirs for storage tests | (dev-dep) |

Vše už je v cargo registry cache (žádný network download).

---

## 7. Rizika a mitigace

| Rizika | Mitigace |
|--------|---------|
| Live API nedostupné (server down) | Graceful fallback na mock, timeout 3-5s |
| Crypto API breaking changes | Pin verze, testy pro každý crypto primitiv |
| File storage corruption | BLAKE3 hash verification on load, atomic writes |
| Adversarial sim je příliš deterministická | Strategie mají random seed per validator |
| Feature gates komplikují CI | Default = bez features, vše optional |

---

## 8. Co NENÍ v scope

- **Žádné V3 změny** — vše v `PoC-lab/`
- **Žádné NAT traversal / DHT** — peer discovery jen seed + gossip exchange
- **Žádný ONNX Runtime** — OpenCL zůstává HW backend
- **Žádné TEE/SGX attestation** — Ed25519 identity je laboratorní grade
- **Žádné production economics** — adversarial sim je konceptuální
- **Žádná RocksDB/SQLite** — file-based bincode storage (laboratorní grade)
