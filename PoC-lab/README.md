# PoC-lab — Proof-of-Care Laboratory

> **Status:** Fáze 2 — real data, hardened P2P, adversarial economics, persistent storage.
> **Cíl:** Prototypovat datové struktury, care tasky a verifikaci Proof-of-Care mimo produkční codebase.
> **Upstream:** Kanonický koncept v [`docs/3.0.4/PoC_CONCEPT.md`](../docs/3.0.4/PoC_CONCEPT.md).

---

## Struktura workspace

```
PoC-lab/
├── Cargo.toml              # workspace root (11 crates)
├── README.md               # tento soubor
├── poc-core/               # základní datové struktury (CareProof, CareTask, Score)
├── poc-tasks/              # task assignment + real executors + data sources (live-data)
├── poc-npu/                # deterministická INT8 VM + OpenCL GPU backend (opencl)
├── poc-verifier/           # verifikace proofů + multi-backend cross-validace
├── poc-registry/           # validator registry, stake, Sefirot Vow lifecycle
├── poc-economics/          # reward split + slashing model
├── poc-sim/                # end-to-end simulátor + adversarial economics
├── poc-hiran/              # Hiran AI verdict engine (stub + live)
├── poc-p2p/                # TCP transport + gossip + crypto (Ed25519/X25519/AES-GCM)
├── poc-storage/            # persistent storage (FileProofStore + EpochHistory + AuditTrail)
└── docs/
    ├── ARCHITECTURE.md     # technická architektura prototypu
    ├── HOW_IT_WORKS.md     # vysvětlení pro neodborníky
    ├── ANALYSIS.md         # analýza možností a next steps
    ├── PHASE1_PLAN.md      # plán Fáze 1 (OpenCL, real executors, P2P)
    └── PHASE2_PLAN.md      # plán Fáze 2 (real data, P2P hardening, adversarial, storage)
```

---

## Build & run

```bash
cd PoC-lab
cargo build
cargo test                          # 277 default tests

# S všemi features (OpenCL GPU + live data sources + P2P crypto)
cargo test --all-features           # 325 tests

# End-to-end demo: simuluje 3 validátory přes 5 epoch,
# vypisuje care proofs, verifikaci a reward payouts.
cargo run -p poc-sim

# Adversarial economics demo
cargo run -p poc-sim --features adversarial
```

---

## Feature flags

| Feature | Crate | Co přidává |
|---------|-------|------------|
| `opencl` | poc-npu | OpenCL GPU backend (AMD RX 5600 XT / ROCm) — INT8 VM na GPU |
| `live-data` | poc-tasks | `L1RpcSource` + `WarpApiSource` — live data z L1 RPC a L3 WARP API |
| `crypto` | poc-p2p | `NodeIdentity` (Ed25519) + `EncryptedTransport` (X25519+AES-GCM) + `PeerDiscovery` |

---

## Fáze přehled

### Fáze 0 — Laboratoř (✅ dokončeno)
Základní datové struktury, task assignment, deterministická INT8 VM, multi-backend
cross-validace, validator registry, reward/slashing model, end-to-end simulátor.

### Fáze 1 — Soft layer (✅ dokončeno)
- OpenCL GPU backend pro INT8 VM (bit-exact s CPU referencí)
- `ProgramConfig` presets (CI / BENCH / PRODUCTION)
- Batch inference s program reuse
- Real care task executors (Warp, Anomaly, Liquidity, Constitutional)
- P2P multi-process simulátor (TCP transport, gossip protokol)

### Fáze 2 — Hardening (✅ dokončeno)
- **Real data sources** — `DataSource` trait + live L1 RPC + L3 WARP API s mock fallback
- **P2P hardening** — Ed25519 identity, X25519 ECDH + AES-256-GCM transport, peer discovery
- **Adversarial economics** — 6 strategií (Honest, Lazy, ScoreGamer, BridgeSpoofer, Colluding, Intermittent),
  gaming detection, slashing enforcement, Gini coefficient
- **Persistent storage** — content-addressed `FileProofStore`, chain-hashed `EpochHistory`,
  tamper-evident `AuditTrail`

---

## Scope

- **In scope:** datové modely, task assignment, deterministická INT8 VM (RandomNPU),
  multi-backend cross-validace, care score výpočet, validator registry + Sefirot Vow
  lifecycle, reward distribution + slashing model, end-to-end simulace, adversarial
  economics, P2P transport s crypto, persistent storage, unit testy.
- **Out of scope:** L1 consensus integration, on-chain registry/kontrakty, produkční
  NPU vendor attestation (TEE/quote), reálná AI inference (výstupy jsou stub/simulace).

---

## License

MIT (stejně jako celé ZION repo).
