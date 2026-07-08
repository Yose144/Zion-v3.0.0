# PoC-lab — Proof-of-Care Laboratory

> **Status:** Experimental skeleton — mimo `V3/`, žádné L1 změny.  
> **Cíl:** Prototypovat datové struktury, care tasky a verifikaci Proof-of-Care mimo produkční codebase.  
> **Upstream:** Kanonický koncept v [`docs/3.0.4/PoC_CONCEPT.md`](../docs/3.0.4/PoC_CONCEPT.md).

---

## Struktura workspace

```
PoC-lab/
├── Cargo.toml              # workspace root
├── README.md               # tento soubor
├── poc-core/                # základní datové struktury (CareProof, CareTask, Score)
├── poc-tasks/                # task assignment podle sefirot + dummy executor
├── poc-npu/                  # deterministická INT8 VM (RandomNPU), backend abstrakce
├── poc-verifier/              # verifikace proofů + multi-backend cross-validace
├── poc-registry/              # validator registry, stake, Sefirot Vow lifecycle
├── poc-economics/              # reward split + slashing model
├── poc-sim/                   # end-to-end network simulátor (lib + CLI demo)
└── docs/
    ├── ARCHITECTURE.md     # technická architektura prototypu
    └── ANALYSIS.md         # analýza možností a next steps
```

---

## Build & run

```bash
cd PoC-lab
cargo build
cargo test

# End-to-end demo: simuluje 3 validátory přes 5 epoch,
# vypisuje care proofs, verifikaci a reward payouts.
cargo run -p poc-sim
```

---

## Scope

- **In scope:** datové modely, task assignment, deterministická INT8 VM (RandomNPU),
  multi-backend cross-validace, care score výpočet, validator registry + Sefirot Vow
  lifecycle, reward distribution + slashing model, end-to-end simulace, unit testy.
- **Out of scope:** L1 consensus integration, on-chain registry/kontrakty, produkční
  NPU vendor attestation (TEE/quote), reálná AI inference (výstupy jsou stub/simulace).

---

## License

MIT (stejně jako celé ZION repo).
