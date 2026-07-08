# PoC-lab Architecture

> **Scope:** Skeleton / prototype — mimo `V3/`. Žádná L1 consensus integrace.

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
  └─────────┘ └──────────┘ └──────────┘  └──────────────┘
        │           │           │               │
        └───────────┴─────┬─────┴───────────────┘
                           ▼
                   ┌───────────────┐        ┌────────────────┐
                   │poc-economics  │        │poc-sim         │
                   │reward split   │◀───────│network simulator│
                   │slashing model │        │(lib + CLI demo) │
                   └───────────────┘        └────────────────┘
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
- `DummyExecutor`: prototypový executor, který generuje dummy output.
- `TaskRegistry`: registry všech 11 care tasků.

## `poc-npu`

- `NpuBackend` trait pro různé inference backendy.
- `vm` modul: reálná deterministická **INT8 VM** implementující "ZION NPU VM Spec"
  z `docs/NPU_HARDWARE_MINING_THEORY.md` §4.2 (prototype scale):
  - `DeterministicRng` — xorshift64* seedovaný z Blake3 digestu.
  - `Activation` — 4 aktivace (ReLU/GELU/SiLU/HardSwish), každá materializovaná
    jako 256-entry INT8→INT8 lookup table.
  - `DenseLayer` — INT8 matmul + bias + arithmetic shift + clamp + activation lookup.
  - `RandomNpuProgram` — RandomNPU koncept (teorie doc §3): počet vrstev, dimenze
    a aktivace jsou náhodně (ale deterministicky) generované z `(seed, epoch)`.
    Vstup/výstup jsou fixní `IO_DIM = 64` bytů (odpovídá "64 bytes -> 64 bytes"
    NPU Mix shape z teorie doc).
- `CpuReferenceBackend`: canonical truth backend — používá `vm::RandomNpuProgram`.
- `OnnxBackend`: stub delegující na CPU reference (v produkci by volal ONNX Runtime
  s INT8 execution providerem).
- `RandomNpuGenerator`: tenký wrapper — odvozuje `model_hash` per epoch a
  poskytuje human-readable popis topologie.
- `CircuitBreaker`: porovnává výstup libovolného HW backendu s CPU referencí.

**Scale note:** teoretická studie cílí na ~2M MAC/hash pro efektivní NPU
workload amortizaci. Prototyp defaultně generuje mnohem menší programy
(~1-10K MAC), aby testy běžely rychle. Rozsah je konfigurovatelný přes
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
- Každý jiný backend musí projít `CircuitBreaker::check` proti CPU reference,
  nebo (silnější varianta) projít `cross_validation::cross_validate()` honest-majority
  testem proti sadě backendů.
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
- `DummyExecutor` negeneruje skutečnou AI práci pro care tasky — `poc-npu::vm`
  je real deterministic compute, ale sémanticky nejde o skutečnou anomaly
  detection / bridge audit, jen o demonstraci determinismu a workload sizing.
- `ValidatorRegistry` řeší Sybil resistance jen přes stake; skutečná identity
  uniqueness (hardware attestation, sociální graf, KYC) je out-of-scope.
- `SlashingPolicy` je konceptuální model; skutečná ekonomika by vyžadovala
  samostatný audit a game-theoretic analýzu (viz `ANALYSIS.md` §4).
- `poc-sim` je čistě in-memory simulace jednoho procesu — žádná síťová
  komunikace, žádný skutečný P2P konsensus.
