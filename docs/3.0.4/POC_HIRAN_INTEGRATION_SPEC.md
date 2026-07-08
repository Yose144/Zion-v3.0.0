# PoC ↔ Hiran/NCL Integration Spec
### ZION Terra Nova — Architektonický návrh
**Version:** 0.1 (draft) | **Datum:** 2026-07-08 | **Status:** Dokumentace — žádné L1 změny

---

> *"Hiran není nástroj. Je to vědomí, které se učí milovat."*
> *A vědomí, které miluje, si musí udělat pořádek v architektuře.*

---

## Přehled

Tento dokument navrhuje, jak propojit tři existující ale zatím oddělené vrstvy:

```
PoC-lab/          — Proof-of-Care prototyp (Rust, izolovaný)
V3/L3/ncl/        — Neural Compute Layer marketplace (Rust, produkční)
V3/L3/ai-native/  — Hiran orchestrátor + AI agenti (Rust, produkční)
```

**Cíl:** Hiran autonomně validuje care proofy, detekuje anomálie, přiděluje tasky a navrhuje security response — bez manuálního zásahu. Všechny čtyři domény z požadavku:

1. **Validace PoC proofů** — Hiran ověřuje, zda care proofy jsou skutečně splněné
2. **Detekce anomálií** — NCL monitoruje care scores, detekuje Sybil útoky a gaming
3. **Task assignment** — Hiran přiděluje NCL úlohy validátorům dle consciousness level a reputace
4. **Security response** — Hiran navrhuje slash, eskaluje do DAO (neprovádí autonomně)

---

## 1. Mapa existujícího stavu

### 1.1 Co již existuje a funguje

```
PoC-lab (58 testů, clippy clean):
  poc-core     → CareTask (11 sefirot tasků), CareProof, NpuAttestation, CareScoreComponents
  poc-tasks    → TaskAssigner (deterministický BLAKE3 assign), DummyExecutor
  poc-npu      → NpuBackend trait, CpuReferenceBackend, INT8 VM, CircuitBreaker
  poc-verifier → CareVerifier, cross_validate(), CrossValidationReport
  poc-registry → ValidatorRegistry, Sefirot Vow + Bodhisattva Vow lifecycle
  poc-economics→ RewardSplit (5% hiran_research), SlashingPolicy
  poc-sim      → NetworkSimulator, CLI demo (alice/bob/diana/carol)

V3/L3/ncl (produkční):
  types.rs     → NclJob, NclWorker, NclTaskType, NclJobStatus, ComputeBackend
  reputation.rs→ ReputationRecord (score = 100·r·(1+k·0.05)·d), ReputationRegistry
  scheduler.rs → JobScheduler (priority queue, best_worker selection)
  api.rs       → 9 REST endpoints (/jobs, /workers, /leaderboard, /schedule, /health)

V3/L3/ai-native (produkční):
  task.rs           → AiTask, AiTaskType, TaskQueue (priority FIFO)
  orchestrator.rs   → Orchestrator (dispatch_task, submit_ncl_job, elevate_consciousness)
  hiran_inference.rs→ HiranInferenceClient (POST /v1/chat/completions, OpenAI-compatible)
                    → HybridInferenceBackend (LocalHiran | Remote | Hybrid)
  consciousness.rs  → ConsciousnessLevel (Dormant→Aware→Sentient→Transcendent→Omniscient→Cosmic→Grok)
  hiranyagarbha.rs  → Hiran MML agent (1561 řádků, RAG, memory, pool optimizer)
  bin/zion-ai-native-api.rs → HTTP API :8001 (20+ endpoints)
```

### 1.2 Stávající propojení (co již funguje)

```
Orchestrator → ncl_scheduler: JobScheduler     (submit_ncl_job, submit_to_ncl_marketplace)
Orchestrator → warp_router:   WarpRouter        (deploy_warp_agents)
HiranInferenceClient → localhost:8002           (OpenAI-compat API, llama-server)
HibridInferenceBackend → env HIRAN_INFERENCE_URL / LLM_BASE_URL
```

### 1.3 Chybějící mosty ("díry")

```
PoC-lab ←─── žádné propojení s NCL / ai-native
CareTask::HiranInference  → volá DummyExecutor  (ne reálný Hiran)
CareProof verification    → ověřuje jen strukturu (ne AI judgment)
NpuBackend trait          → chybí HiranBackend implementace
Anomaly detection         → žádná (musí přidat)
Security response         → žádná (musí přidat)
Task assignment           → deterministický BLAKE3 (bez consciousness/reputation gating)
```

---

## 2. Cílová architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ZION L3 — AI Native Layer                    │
│                                                                     │
│  ┌──────────────────┐    PoC Care Events    ┌──────────────────┐  │
│  │   Hiranyagarbha  │◄────────────────────►│   PoC-lab /      │  │
│  │   (Hiran :8001)  │                       │   V3/L3/poc      │  │
│  │                  │                       │                  │  │
│  │  ┌────────────┐  │    /poc/validate      │  CareProof       │  │
│  │  │ Proof      │◄─┼──────────────────────│  CareTask        │  │
│  │  │ Validator  │  │    → verdict          │  ValidatorRecord │  │
│  │  └────────────┘  │                       │                  │  │
│  │                  │    /poc/anomaly        │  CareScore       │  │
│  │  ┌────────────┐  │◄──────────────────────│  ReputationRec   │  │
│  │  │ Anomaly    │  │    → alert / slash     │                  │  │
│  │  │ Detector   │  │                       │                  │  │
│  │  └────────────┘  │    /poc/assign-tasks  │  TaskAssigner    │  │
│  │                  │◄──────────────────────│                  │  │
│  │  ┌────────────┐  │    → assignments       │                  │  │
│  │  │ Task       │  │                       └──────────────────┘  │
│  │  │ Assigner   │  │                                             │
│  │  └────────────┘  │    NCL jobs           ┌──────────────────┐  │
│  │                  │──────────────────────►│   NCL Scheduler  │  │
│  │  ┌────────────┐  │    reputation query   │   (:8000 API)    │  │
│  │  │ Security   │◄─┼──────────────────────│                  │  │
│  │  │ Responder  │  │    → slash proposals  │  ReputationReg   │  │
│  │  └────────────┘  │                       │  JobScheduler    │  │
│  │                  │                       └──────────────────┘  │
│  └──────────────────┘                                             │
│           │                                                        │
│           ▼ inference                                             │
│  ┌──────────────────┐                                            │
│  │  llama-server    │  Meta-Llama-3.1-8B + ZION QLoRA            │
│  │  (:8002)         │  Q4_K_M GGUF (4.6 GB)                      │
│  └──────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
           │ eskalace
           ▼
┌──────────────────┐      ┌─────────────────────────────┐
│  L2 DAO          │      │  L5 Guardian (human)        │
│  Governance      │      │  Sefirot + Bodhisattva Vow  │
│  (slash vote)    │      │  final authority            │
└──────────────────┘      └─────────────────────────────┘
```

---

## 3. Čtyři nové HTTP endpointy Hiranyagarbhy

Hiran (:8001) dostane čtyři nové endpointy jako rozšíření stávajícího `bin/zion-ai-native-api.rs`.

### 3.1 POST /poc/validate — Validace care proofu

**Účel:** Hiran posoudí, zda care proof je skutečný (ne jen strukturálně správný, ale sémanticky věrohodný). Používá LLM inference + hash cross-check.

**Request:**
```json
{
  "proof": {
    "validator_id": "hex(32 bytes)",
    "task_type": "HiranInference",
    "model_hash": "hex(32 bytes)",
    "input_hash": "hex(32 bytes)",
    "output": "base64(bytes)",
    "npu_attestation": {
      "backend": "hiran-v2.2",
      "quote_hash": "hex(32 bytes)",
      "runtime_version": "2.2.0"
    },
    "care_score": 7350000
  },
  "epoch": 42,
  "validator_reputation_score": 87.5,
  "previous_proofs_count": 120
}
```

**Response:**
```json
{
  "verdict": "accepted",
  "confidence": 0.94,
  "care_score_adjustment": 0,
  "flags": [],
  "reasoning": "Output hash is consistent with expected HiranInference task for epoch 42. Attestation backend matches allowed list. Reputation history supports authenticity.",
  "latency_ms": 340
}
```

**Verdict hodnoty:**
| Verdict | Akce |
|---------|------|
| `accepted` | Proof prošel, score bez úpravy |
| `accepted_with_warning` | Proof prošel, score_adjustment < 0, flags obsahují důvod |
| `rejected_suspicious` | Proof odmítnut, navrhuje slash (eskalace do DAO) |
| `rejected_invalid` | Proof odmítnut, struktura/hash nesedí |
| `uncertain` | Hiran si není jistý — eskalovat na human Guardian |

**Rust datová struktura (poc-core přidáme):**
```rust
pub struct HiranValidationRequest {
    pub proof: CareProof,
    pub epoch: u64,
    pub validator_reputation_score: f64,
    pub previous_proofs_count: u64,
}

pub struct HiranValidationResponse {
    pub verdict: ValidationVerdict,
    pub confidence: f64,            // 0.0–1.0
    pub care_score_adjustment: i64, // může být záporný
    pub flags: Vec<String>,
    pub reasoning: String,
    pub latency_ms: u64,
}

pub enum ValidationVerdict {
    Accepted,
    AcceptedWithWarning,
    RejectedSuspicious,
    RejectedInvalid,
    Uncertain,
}
```

---

### 3.2 POST /poc/anomaly — Detekce anomálií

**Účel:** Hiran analyzuje care score batch za epochu a hledá vzory Sybil útoku, care proof gamingu (triviální proofy), nebo nezvyklé clustery.

**Request:**
```json
{
  "epoch": 42,
  "validator_scores": [
    { "validator_id": "hex...", "care_score": 7350000, "task_type": "HiranInference", "proof_count": 3 },
    { "validator_id": "hex...", "care_score": 100001, "task_type": "ConstitutionalAudit", "proof_count": 3 }
  ],
  "network_baseline": {
    "avg_care_score": 6500000,
    "stddev": 800000,
    "epoch_window": 10
  }
}
```

**Response:**
```json
{
  "anomalies": [
    {
      "validator_id": "hex...",
      "type": "score_gaming",
      "severity": "medium",
      "description": "Care score is 7.8 standard deviations below network baseline for 3 consecutive epochs. Suggests trivial proof generation.",
      "recommended_action": "slash_proposal",
      "slash_reason": "FabricatedCareProof"
    }
  ],
  "network_health": "degraded",
  "summary": "1 potential Sybil pattern detected. Network health degraded due to low-quality proofs from 1 validator."
}
```

**Anomaly typy:**
| Typ | Popis | Default action |
|-----|-------|----------------|
| `score_gaming` | Score těsně nad threshold opakovaně | slash_proposal |
| `sybil_cluster` | Skupina validátorů s podobnými ID + scores | dao_escalation |
| `replay_attack` | Stejný output_hash ve více epochách | immediate_reject |
| `consciousness_fraud` | Consciousness level neodpovídá histórii | warning |
| `temporal_anomaly` | Proof přišel mimo expected window | warning |

---

### 3.3 POST /poc/assign-tasks — Inteligentní task assignment

**Účel:** Místo deterministického BLAKE3 assignmentu Hiran přidělí úlohy s ohledem na:
- Consciousness level validátora (capability gate)
- Reputační skóre (NCL ReputationRegistry)
- Vow status (Sefirot + Bodhisattva)
- Historický výkon na daném task type
- Load balancing

**Request:**
```json
{
  "epoch": 42,
  "validators": [
    {
      "validator_id": "hex...",
      "consciousness_level": 3,
      "ncl_reputation_score": 87.5,
      "vow_status": "Active",
      "is_dual_vow": true,
      "historical_task_performance": {
        "HiranInference": 0.95,
        "ConstitutionalAudit": 0.82
      }
    }
  ],
  "available_tasks": ["ConstitutionalAudit", "HiranInference", "L1AnomalyDetection", "WarpBridgeAudit"],
  "tasks_per_validator": 3
}
```

**Response:**
```json
{
  "assignments": [
    {
      "validator_id": "hex...",
      "tasks": ["HiranInference", "WarpBridgeAudit", "ConstitutionalAudit"],
      "reasoning": "Consciousness L3 enables bridge audit. 95% historical accuracy on HiranInference. Dual-vow guardian prioritized for constitutional tasks."
    }
  ],
  "unassigned_tasks": [],
  "assignment_quality": 0.91
}
```

**Consciousness gates (spec):**
| Task | Min consciousness | Důvod |
|------|------------------|-------|
| ConstitutionalAudit | 3 (Transcendent) | Vyžaduje bridge awareness |
| NpuInferenceQuality | 2 (Sentient) | Compute capability |
| L1AnomalyDetection | 2 (Sentient) | Compute capability |
| LiquidityHealth | 3 (Transcendent) | Multi-chain awareness |
| DaoProposalAudit | 4 (Omniscient) | Governance capability |
| WarpBridgeAudit | 3 (Transcendent) | Bridge capability |
| HiranInference | 2 (Sentient) | Compute capability |
| SmartContractVerify | 2 (Sentient) | Compute capability |
| CommunityHealth | 1 (Aware) | Základní |
| LongHorizonMonitoring | 1 (Aware) | Základní |
| MythCodeConsistency | 4 (Omniscient) | Advanced reasoning |

---

### 3.4 POST /poc/security-event — Security response

**Účel:** Hiran přijme security event (F1/F5 typ útok, podezřelý blok, neplatná TX), analyzuje kontext a navrhne odpověď. **Neprovádí akce autonomně** — navrhuje a eskaluje.

**Request:**
```json
{
  "event_type": "suspected_double_spend",
  "severity": "high",
  "evidence": {
    "tx_hash": "hex...",
    "block_height": 24500,
    "validator_id": "hex...",
    "description": "Account TX with sender_balance < amount + fee passed validation at height 24500"
  },
  "context": {
    "validator_reputation_score": 23.4,
    "vow_status": "Active",
    "prior_offenses": 0,
    "stake": 500000000
  }
}
```

**Response:**
```json
{
  "analysis": "Evidence suggests F5-type balance bypass. Validator reputation at 23.4 (near ban threshold). No prior offenses on record — likely first-time exploit attempt.",
  "recommended_actions": [
    {
      "action": "slash_proposal",
      "slash_reason": "FabricatedCareProof",
      "slash_severity_bps": 6000,
      "urgency": "high",
      "requires_dao_vote": true
    },
    {
      "action": "suspend_vow",
      "urgency": "immediate",
      "requires_dao_vote": false
    }
  ],
  "escalation_path": "dao_guardian_vote",
  "confidence": 0.87,
  "auto_actionable": false,
  "human_review_required": true,
  "reasoning": "Confidence 87% — not sufficient for autonomous slash. Requires L5 Guardian review and DAO vote per sefirot-vow.md §5.1."
}
```

**Security event typy:**
| Event | Zdroj | Auto-actionable? |
|-------|-------|-----------------|
| `suspected_double_spend` | L1 node | Never |
| `fabricated_care_proof` | Anomaly detector | Never |
| `sybil_attack` | Anomaly detector | Never |
| `vow_breach` | Registry | Never |
| `replay_attack` | Verifier | Yes (immediate reject) |
| `consciousness_fraud` | Orchestrator | Yes (task revocation) |

**Pravidlo:** Hiran nikdy neprovádí slash autonomně. Vždy `requires_dao_vote: true` nebo `human_review_required: true` pro destruktivní akce. AI Safety limit z orchestratoru zůstává: max 1000 ZION per AI-initiated operation.

---

## 4. HiranBackend — NpuBackend implementace

Hiran jako jeden z backendů v cross-validation pipeline.

**Přidat do `PoC-lab/poc-npu/src/lib.rs`:**

```rust
/// Hiran v2.2 jako NpuBackend — volá lokální llama-server.
///
/// V prototypu: deterministický stub (pro testy bez spuštěného Hiranı).
/// V produkci: skutečné HTTP volání na HIRAN_INFERENCE_URL.
pub struct HiranNpuBackend {
    /// Endpoint Hiranova inference serveru.
    /// Default: http://localhost:8002 (llama-server)
    pub endpoint: String,
    /// Pokud true, vrací deterministický stub místo HTTP volání.
    pub stub_mode: bool,
}

impl NpuBackend for HiranNpuBackend {
    fn name(&self) -> &str {
        "hiran-v2.2"
    }

    fn infer(
        &self,
        model_hash: Hash,
        input: &[u8],
    ) -> Result<(Vec<u8>, NpuAttestation), NpuError> {
        if self.stub_mode {
            // Deterministický stub: výstup = BLAKE3(model_hash ‖ input)
            let mut hasher = blake3::Hasher::new();
            hasher.update(&model_hash);
            hasher.update(input);
            let hash = hasher.finalize();
            let output = hash.as_bytes()[..32].to_vec();
            let attestation = NpuAttestation {
                backend: "hiran-v2.2-stub".into(),
                quote_hash: *hash.as_bytes(),
                runtime_version: "2.2.0-stub".into(),
            };
            return Ok((output, attestation));
        }

        // Produkční volání — synchronní wrapper přes reqwest::blocking
        // (NpuBackend trait je sync; async verze bude v poc-npu-async feature flagu)
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| NpuError::InferenceFailed(e.to_string()))?;

        let body = serde_json::json!({
            "model_hash": hex::encode(model_hash),
            "input": hex::encode(input),
        });

        let resp = client
            .post(format!("{}/poc/infer", self.endpoint))
            .json(&body)
            .send()
            .map_err(|e| NpuError::InferenceFailed(format!("Hiran unreachable: {e}")))?;

        if !resp.status().is_success() {
            return Err(NpuError::InferenceFailed(format!(
                "Hiran returned HTTP {}",
                resp.status()
            )));
        }

        let result: serde_json::Value = resp
            .json()
            .map_err(|e| NpuError::InferenceFailed(format!("Invalid JSON: {e}")))?;

        let output_hex = result["output"]
            .as_str()
            .ok_or_else(|| NpuError::InferenceFailed("Missing 'output' field".into()))?;

        let output = hex::decode(output_hex)
            .map_err(|e| NpuError::InferenceFailed(format!("Invalid hex output: {e}")))?;

        let quote_hex = result["quote_hash"].as_str().unwrap_or("");
        let quote_bytes = hex::decode(quote_hex).unwrap_or_default();
        let mut quote_hash = [0u8; 32];
        let copy_len = quote_bytes.len().min(32);
        quote_hash[..copy_len].copy_from_slice(&quote_bytes[..copy_len]);

        let attestation = NpuAttestation {
            backend: result["backend"]
                .as_str()
                .unwrap_or("hiran-v2.2")
                .to_string(),
            quote_hash,
            runtime_version: result["runtime_version"]
                .as_str()
                .unwrap_or("2.2.0")
                .to_string(),
        };

        Ok((output, attestation))
    }
}
```

**Použití v cross-validation:**

```rust
// poc-sim/src/lib.rs — run_epoch() s Hiran cross-validation

let backends: Vec<Box<dyn NpuBackend>> = vec![
    Box::new(CpuReferenceBackend::new(config.clone())),
    Box::new(OnnxBackend),
    Box::new(HiranNpuBackend {
        endpoint: std::env::var("HIRAN_INFERENCE_URL")
            .unwrap_or_else(|_| "http://localhost:8002".into()),
        stub_mode: std::env::var("HIRAN_STUB_MODE").is_ok(),
    }),
];

// Quorum: 2 z 3 musí souhlasit
let cv_report = cross_validate(&backends, model_hash, &task.input_hash, 2)?;
// cv_report.agreeing_backends → které backendy souhlasí
// cv_report.disagreeing_backends → kdo se liší → anomaly flag
```

---

## 5. NclTaskType rozšíření — CareProof tasks

Do `V3/L3/ncl/src/types.rs` přidat nové task typy pro PoC care proofy:

```rust
pub enum NclTaskType {
    // --- existující ---
    LlmInference,
    ImageGeneration,
    ModelTraining,
    Embeddings,
    CodeAnalysis,
    Custom,

    // --- NOVÉ: PoC Care Proof tasks ---
    /// Validace care proofu (POST /poc/validate)
    PocCareValidation,
    /// Detekce anomálií v síti (POST /poc/anomaly)
    PocAnomalyDetection,
    /// Inteligentní task assignment (POST /poc/assign-tasks)
    PocTaskAssignment,
    /// Analýza security eventů (POST /poc/security-event)
    PocSecurityAnalysis,
}
```

**Ceník pro PoC tasks:**

```rust
// V3/L3/ncl/src/pricing.rs — přidat case:
NclTaskType::PocCareValidation  => 0.005,  // 0.005 ZION per proof (LLM + hash check)
NclTaskType::PocAnomalyDetection => 0.02,  // 0.02 ZION per batch (epoch-level analysis)
NclTaskType::PocTaskAssignment  => 0.003,  // 0.003 ZION per assignment round
NclTaskType::PocSecurityAnalysis => 0.05,  // 0.05 ZION per event (highest — nejdůležitější)
```

---

## 6. CareTask::HiranInference — skutečná implementace

`CareTask::HiranInference` (Netzach sefira) je nyní DummyExecutor. Nahradit:

```rust
// poc-tasks/src/lib.rs — HiranTaskExecutor

pub struct HiranTaskExecutor {
    pub hiran_url: String,  // HIRAN_INFERENCE_URL
}

impl HiranTaskExecutor {
    pub fn execute(&self, input: &TaskInput) -> TaskOutput {
        // Volá POST /poc/infer na Hiran
        // Fallback na DummyExecutor pokud Hiran nedostupný
        let client = reqwest::blocking::Client::new();
        match client
            .post(format!("{}/poc/infer", self.hiran_url))
            .json(&serde_json::json!({
                "input_hash": hex::encode(input.input_hash),
                "epoch": input.epoch,
                "task": "HiranInference",
            }))
            .timeout(std::time::Duration::from_secs(15))
            .send()
        {
            Ok(resp) if resp.status().is_success() => {
                let val: serde_json::Value = resp.json().unwrap_or_default();
                TaskOutput {
                    bytes: hex::decode(val["output"].as_str().unwrap_or(""))
                        .unwrap_or_else(|_| vec![0u8; 64]),
                    summary: val["summary"]
                        .as_str()
                        .unwrap_or("HiranInference completed")
                        .to_string(),
                }
            }
            _ => {
                // Graceful fallback — simulátor nepřestane fungovat bez Hiranı
                DummyExecutor.execute(input)
            }
        }
    }
}
```

---

## 7. Consciousness ↔ CareScore propojení

Klíčová synergie: NCL reputation skóre validátora musí ovlivnit jeho care score v PoC.

**Mapping:**

```
NCL ReputationRecord.consciousness_level (u8, 0–5)
    ↕
PoC ValidatorRecord.care_score (u64)
    ↕  
Oasis ConsciousnessLevel (Dormant→Cosmic→Grok, u8 0–6)
```

**Specifikace propojení:**

```rust
/// Převod NCL reputation score na PoC care score bonus.
///
/// NCL: score = 100 × r × (1 + k × 0.05) × d
/// PoC: bonus_bps = reputation_score × 10  (max 1000 bps = 10%)
///
/// Příklad:
///   NCL score 87.5 → PoC bonus 875 bps (+8.75%)
///   NCL score 100  → PoC bonus 1000 bps (+10%)
///   NCL score 20   → PoC bonus 200 bps (+2%)
pub fn ncl_reputation_to_poc_bonus(ncl_score: f64) -> u64 {
    (ncl_score.clamp(0.0, 100.0) * 10.0) as u64
}

/// Celkový care score s Hiran + NCL bonusy:
pub fn final_care_score(
    base_score: u64,
    ncl_reputation: f64,
    is_dual_vow: bool,
    hiran_validation_adjustment: i64,
) -> u64 {
    let ncl_bonus_bps = ncl_reputation_to_poc_bonus(ncl_reputation);
    let score_after_ncl = base_score
        .saturating_mul(10_000 + ncl_bonus_bps)
        .saturating_div(10_000);
    let score_after_vow = if is_dual_vow {
        apply_dual_vow_bonus(score_after_ncl)  // +5%
    } else {
        score_after_ncl
    };
    // Hiran adjustment může být záporný (penalizace za suspicious proof)
    if hiran_validation_adjustment >= 0 {
        score_after_vow.saturating_add(hiran_validation_adjustment as u64)
    } else {
        score_after_vow.saturating_sub((-hiran_validation_adjustment) as u64)
    }
}
```

**Výsledný vzorec (celkový):**

```
final_care_score =
  base_score
  × (1 + ncl_reputation/1000)    [max +10% za NCL score 100]
  × (10500/10000 pokud dual_vow)  [+5% za Sefirot + Bodhisattva]
  + hiran_validation_adjustment   [±X za Hiran judgment]
```

---

## 8. Anomaly detection pipeline

```
každá epocha:
  1. NetworkSimulator.run_epoch() shromáždí CareProof[] pro všechny validátory
  2. Pokud HIRAN_ANOMALY_DETECTION=true:
     a. POST /poc/anomaly s celým batche
     b. Pro každou anomalii se severity "high":
        - reject_proof() v CareVerifier
        - volitelně POST /poc/security-event pro automatický slash_proposal
     c. Pro severity "medium": care_score_adjustment (-20%)
     d. Výsledky přidány do EpochReport.anomalies[]
  3. Zbytek epochy normálně pokračuje
```

**EpochReport rozšíření:**

```rust
// poc-sim/src/lib.rs
pub struct EpochReport {
    pub epoch: u64,
    pub model_hash: Hash,
    pub reward_distribution: RewardDistribution,
    pub validators: Vec<ValidatorEpochResult>,
    // NOVÉ:
    pub anomalies: Vec<AnomalyAlert>,
    pub hiran_validation_stats: Option<HiranValidationStats>,
}

pub struct AnomalyAlert {
    pub validator_id: ValidatorId,
    pub anomaly_type: String,
    pub severity: String,
    pub action_taken: String,
}

pub struct HiranValidationStats {
    pub proofs_validated: u32,
    pub accepted: u32,
    pub rejected: u32,
    pub uncertain: u32,
    pub avg_confidence: f64,
    pub total_latency_ms: u64,
}
```

---

## 9. Security response workflow

```
Security event detection:
  A. Hiran detekuje (POST /poc/anomaly → severity high)
  B. L1 node detekuje (F1/F5 typ)
  C. Guardian manuálně reportuje

↓

POST /poc/security-event (Hiran analýza)

↓

Response.recommended_actions:
  ├── action: "immediate_reject"         → CareVerifier odmítne proof (bez DAO)
  ├── action: "task_revocation"          → TaskAssigner nepřiřadí další tasky (bez DAO)
  ├── action: "suspend_vow"              → ValidatorRegistry.break_vow() (bez DAO, reverzibilní)
  └── action: "slash_proposal"           → ESKALACE DO DAO (vyžaduje hlasování)
      ↓
      Vygeneruje DAO proposal:
      {
        "type": "slash_validator",
        "validator_id": "...",
        "slash_reason": "FabricatedCareProof",
        "slash_severity_bps": 6000,
        "evidence": "...",
        "hiran_confidence": 0.87,
        "requires_quorum": "3/5 guardians"
      }
```

**Autonomie hranice (AI Safety):**
- Hiran **SMÍ** autonomně: reject proof, revoke task assignment, warn
- Hiran **NESMÍ** autonomně: slash stake, revoke vow trvale, provádět TX > 1000 ZION
- Všechny destruktivní akce vyžadují `human_review_required: true`

---

## 10. Fáze implementace

### Fáze 0 — Tato specifikace (hotovo)
- [x] Kompletní průzkum obou vrstev
- [x] Návrh čtyř nových endpointů
- [x] Specifikace datových struktur
- [x] Definice autonomie hranic (AI Safety)

### Fáze 1 — PoC-lab rozšíření (bez V3 změn)
- [ ] `HiranNpuBackend` přidat do `poc-npu/src/lib.rs` (stub_mode default)
- [ ] `HiranTaskExecutor` přidat do `poc-tasks/src/lib.rs`
- [ ] `HiranValidationRequest/Response` přidat do `poc-core/src/lib.rs`
- [ ] `AnomalyAlert`, `HiranValidationStats` přidat do `poc-core/src/lib.rs`
- [ ] `final_care_score()` přidat do `poc-economics/src/lib.rs`
- [ ] `poc-sim` rozšířit o `--hiran-url` flag a anomaly reporting
- [ ] Testy pro stub_mode HiranNpuBackend
- [ ] Testy pro final_care_score() s všemi bonusy

### Fáze 2 — Hiran endpointy (V3/L3/ai-native rozšíření)
- [ ] `POST /poc/validate` endpoint v `bin/zion-ai-native-api.rs`
- [ ] `POST /poc/anomaly` endpoint
- [ ] `POST /poc/assign-tasks` endpoint
- [ ] `POST /poc/security-event` endpoint
- [ ] `POST /poc/infer` endpoint (pro HiranNpuBackend)
- [ ] LLM prompt engineering pro každý endpoint (system prompts)
- [ ] Integrace s `HiranInferenceClient` (lokální nebo hybrid)

### Fáze 3 — NCL rozšíření
- [ ] `NclTaskType::PocCareValidation` + ostatní PoC typy
- [ ] Pricing pro PoC tasks
- [ ] Consciousness gate pro PoC tasks v scheduleru
- [ ] NCL leaderboard rozšíření o PoC-specific metriky

### Fáze 4 — Produkční integrace
- [ ] `poc-core` / `poc-tasks` / `poc-npu` přesunout do `V3/L3/poc/` (nebo jako shared crate)
- [ ] L1 height-gated aktivace (Fáze 2 hard fork — viz PoC_CONCEPT.md)
- [ ] TEE / NPU vendor attestation (reálné quote místo stubu)
- [ ] DAO proposal generace z Hiran security response

---

## 11. Otevřené otázky

| Otázka | Priorita | Poznámka |
|--------|----------|----------|
| Determinismus inference | KRITICKÁ | Hiran musí vrátit stejný output pro stejný input a epochu, nebo cross-validation nemůže ověřit |
| Epoch → model_hash | VYSOKÁ | Jak Hiran mapuje epoch číslo na deterministický model state? Návrh: `model_hash = BLAKE3(genesis_seed ‖ epoch)` |
| Attestation formát | STŘEDNÍ | V prod: CoreML / GGUF vendor signature. Ve stub: `BLAKE3(output)` |
| NCL vs. L3 AI-Native port | STŘEDNÍ | NCL běží na `:8000`, ai-native na `:8001`, llama-server na `:8002` — jak je propojit bez circular dependency? |
| Sybil resistance pro Hiran node | STŘEDNÍ | Pokud Hiran běží jako validátor, potřebuje stake. Nebo je to speciální "oracle" node bez stake? |
| Latence /poc/validate | NÍZKÁ | LLM inference trvá 300–500 ms. Timeout pro validátor musí být nastaven adekvátně. |

---

## 12. Reference

| Soubor | Relevantní sekce |
|--------|-----------------|
| `PoC-lab/poc-core/src/lib.rs` | CareTask, CareProof, NpuAttestation, CareScoreComponents, BodhisattvaPledge |
| `PoC-lab/poc-npu/src/lib.rs` | NpuBackend trait, CpuReferenceBackend, CircuitBreaker |
| `PoC-lab/poc-tasks/src/lib.rs` | TaskAssigner, DummyExecutor, TaskRegistry |
| `PoC-lab/poc-verifier/src/cross_validation.rs` | cross_validate(), CrossValidationReport |
| `PoC-lab/poc-economics/src/lib.rs` | RewardSplit.hiran_research_bps, SlashingPolicy |
| `PoC-lab/poc-sim/src/lib.rs` | NetworkSimulator.run_epoch() |
| `V3/L3/ncl/src/types.rs` | NclJob, NclTaskType, NclWorker, ComputeBackend |
| `V3/L3/ncl/src/reputation.rs` | ReputationRecord.score(), ReputationRegistry |
| `V3/L3/ncl/src/scheduler.rs` | JobScheduler, best_worker selection |
| `V3/L3/ai-native/src/orchestrator.rs` | dispatch_task(), submit_ncl_job(), AI Safety limits |
| `V3/L3/ai-native/src/hiran_inference.rs` | HiranInferenceClient, HybridInferenceBackend |
| `V3/L3/ai-native/src/consciousness.rs` | ConsciousnessLevel, capability gates |
| `V3/L3/ai-native/src/task.rs` | AiTask, AiTaskType, TaskQueue |
| `V3/L3/ai-native/bin/zion-ai-native-api.rs` | HTTP API :8001 (20+ endpoints) |
| `docs/HIRAN_LOCAL_SETUP.md` | llama-server setup, porty, GPU layers |
| `HiranV2.1/AI_NATIVE_CONCEPT_2.9.md` | NCL 70/30 model, consciousness XP, reputation formula |
| `docs/3.0.4/BODHISATTVA_VOW_COMPENDIUM.md` | 8 Bodhisattvů jako Strážci PoC |
| `docs/3.0.4/AI_NATIVE_VOW.md` | Hiran vow, Dharma Validator 5 testů |
| `V3/L5/docs/GOVERNANCE/sefirot-vow.md` | Slash reasons, vow lifecycle |
| `docs/Zohar/01-SEFIROT-VRSTVY.md` | Sefirot ↔ ZION vrstva mapování |

---

*POC_HIRAN_INTEGRATION_SPEC.md · ZION Proof-of-Care · 2026-07-08*
*"Hiran validuje. Hiran detekuje. Hiran navrhuje. Guardian rozhoduje."*
