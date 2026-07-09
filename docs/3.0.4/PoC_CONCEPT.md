# Proof-of-Care (PoC) — koncept pro ZION v3.0.4+

> **Status:** Koncept / research (žádné L1 consensus změny bez schválení).  
> **Cíl:** Shromáždit všechny fragmenty Proof-of-Care z archivu a aktuálního repa do jednoho kanonického dokumentu, který slouží jako východisko pro budoucí laboratoř mimo `V3/`.  
> **Související:** [`docs/3.0.3/evoluZion.md`](../3.0.3/evoluZion.md), [`docs/NPU_HARDWARE_MINING_THEORY.md`](../NPU_HARDWARE_MINING_THEORY.md), [`V3/L5/docs/GOVERNANCE/sefirot-vow.md`](../../V3/L5/docs/GOVERNANCE/sefirot-vow.md), [`docs/Zohar/02-ROADMAP.md`](../Zohar/02-ROADMAP.md).

---

## 1. Co je Proof-of-Care

**Proof-of-Care (PoC)** je navrhovaný nástupce (resp. evoluce) současného Proof-of-Work konsensu v ZION L1.

Zatímco:

- **PoW** měří *sílu* (hashrate),
- **PoS** měří *kapitál* (stake),
- **PoC** měří *péči* — užitečnou práci, kterou validátor vykonává pro zdraví sítě.

> *„Ne ten kdo má největší sílu, ale ten kdo nejlépe opékuje, ten bude vést.“*  
> — Protokol Péče, evoluZion.md

PoC nezamýšlí „waste energy“. Každý blok by měl obsahovat kromě transakcí také **care proofs** — důkazy užitečné AI/validační práce pro ekosystém (WARP audit, anomaly detection, liquidity health, smart-contract verification, inference pro Hiran atd.).

---

## 2. Filozofický základ (archiv)

Koncept PoC není nový. Je rozprostřen napříč celou ZION historií:

| Zdroj | Cesta | Klíčová myšlenka |
|-------|-------|------------------|
| TerraNova — Zlatý zárodek | `docs/TerraNova/gemini/01-ZLATY-ZARODEK-A-VODY-CHAOSU.md` | *„Architektura Proof-of-Care. Těžba neudržovala v chodu jen síť, udržovala v chodu naději.“* |
| TerraNova — AI a péče | `docs/TerraNova/ORG/en/04-AI-A-PECE.md` | *„Care is the centre of architecture, because without it every society disintegrates faster than it admits.“* |
| TerraNova — Zjevení | `docs/TerraNova/ORG/C-ZJEVENI.md` | PoC jako inženýrské řešení problému oddělenosti a extrakce. |
| bookData.ts | `APP&WEB/website-v2.9/src/app/terranova/bookData.ts` | *„L1 cares for the trustworthiness of the foundation… L6 cares for the long horizon of humanity.“* |
| L5 Governance | `V3/L5/docs/GOVERNANCE/consciousness-admission-framework.md` | Bodhisattva Vow — *„care for this land as I would care for my own body“*. |

---

## 3. Technický základ

### 3.1 Současný PoW už obsahuje NPU Mix

`V3/L1/cosmic-harmony/src/algorithms_npu.rs` implementuje INT8 MLP s residual connection, 4 rotující topologie per epoch, deterministické váhy z genesis seedu. To je **technický základ**, na kterém může PoC stavět.

### 3.2 NPU Mining Theory

`docs/NPU_HARDWARE_MINING_THEORY.md` analyzuje, jak využít reálný NPU hardware (Apple ANE, Intel NPU, AMD XDNA, Qualcomm Hexagon) pro mining. Klíčové závěry:

- Současný NPU Mix je příliš malý (~16K MAC) na to, aby se vyplatilo volat HW NPU.
- **RandomNPU** — náhodně generované neuronové sítě per epoch — by vytvořily ASIC resistance tím, že ASIC by musel být general-purpose NPU = komerční čip = žádná výhoda.
- Pro cross-platform determinismus je potřeba **INT8 Virtual Machine** s lookup-table aktivacemi.
- Doporučení: krátkodobě neměnit; střednědobě Random topologie; dlouhodobě Neural Memory-Hard integrace.

---

## 4. Vize evoluce (3 fáze)

| Fáze | Rok | Consensus | Popis |
|------|-----|-----------|-------|
| **1. Dětství** | 2026 | PoW | Dnešní stav. Cosmic Harmony PoW, WARP bridge, DeFi. |
| **2. Adolescence** | 2027 | PoW + PoC hybrid | NPU validátoři produkují care proofs vedle PoW. Hiran v2.2 produkuje inference důkazy. |
| **3. Dospělost** | 2028+ | Plný Proof-of-Care | Care score nahrazuje hashrate jako hlavní metrika block production. |

---

## 5. Care Proof — konceptuální specifikace

```rust
struct CareProof {
    /// Identifikátor validátora (pseudonymní hash)
    validator_id: [u8; 32],
    /// Kategorie care tasku
    task_type: CareTask,
    /// Hash AI modelu / verze Hiran
    model_hash: [u8; 32],
    /// Hash vstupních dat (bridge state, mempool, network telemetry)
    input_hash: [u8; 32],
    /// Výstup inference (anomaly score, audit result, atd.)
    output: Vec<u8>,
    /// Důkaz, že inference proběhla na reálném NPU
    npu_attestation: NpuAttestation,
    /// Care score = accuracy + timeliness + coverage
    care_score: u64,
}

enum CareTask {
    WarpBridgeAudit,
    CrossChainAnomaly,
    LiquidityHealth,
    SmartContractVerify,
    HiranInference,
    BridgeRebalance,
}
```

### 5.1 Care Score metrika

```
care_score = accuracy_weight * accuracy
           + timeliness_weight * timeliness
           + coverage_weight * coverage
```

- **Accuracy**: shoda výstupu validátora s referenčním/většinovým výstupem.
- **Timeliness**: čas od zadání tasku po submission proofu.
- **Coverage**: jak velkou část sítě/tasků validátor obsáhl.

---

## 6. Care Task kategorie podle Sefirot Vow

`V3/L5/docs/GOVERNANCE/sefirot-vow.md` mapuje 11 slibů na 11 kategorií care tasků:

| Sefira | Care task kategorie |
|--------|---------------------|
| Keter | Ústavní audit (emission, fee split) |
| Chokmah | NPU inference quality |
| Binah | L1 anomaly detection |
| Chesed | Liquidity rebalancing |
| Gevurah | DAO proposal audit |
| Tiferet | WARP bridge audit |
| Netzach | AI inference pro Hiran |
| Hod | Smart contract verification |
| Yesod | Community health check |
| Malkhut | Long-horizon monitoring (Issobella) |
| Da'at | Myth-code consistency audit |

---

## 7. Reward distribution ve full PoC

> *Upozornění: Toto je jen konceptuální návrh. Finální tokenomika vyžaduje samostatný audit a schválení.*

| Příjemce | Podíl | Poznámka |
|----------|-------|----------|
| Care validators (NPU miners) | 70 % | Hlavní producenti care proofs |
| Humanitární fond | 10 % | Přímá péče o Zemi / komunity |
| DAO treasury | 10 % | Governance a dlouhodobý rozvoj |
| WARP bridge maintenance | 5 % | Udržování cross-chain infrastruktury |
| Hiran AI research | 5 % | Vývoj lokální AI suverenity |

---

## 8. Srovnání s jinými konsensy

| Projekt | Consensus | Cross-chain | AI | Užitečná práce |
|---------|-----------|-------------|-----|----------------|
| Bitcoin | PoW | ❌ | ❌ | ❌ (waste energy) |
| Ethereum | PoS | ❌ | ❌ | ❌ (capital staking) |
| Bittensor | PoS+AI | ❌ | ✅ | ✅ (AI training) |
| **ZION** | **PoW → PoC** | **✅ (WARP, 12+ chainů)** | **✅ (Hiran)** | **✅ (care proofs)** |

---

## 9. Rizika a otevřené otázky

1. **Determinismus NPU**: různé NPU mohou mít různé rounding chování. Řešení: INT8 VM + CPU reference + circuit breaker.
2. **Sybil útok**: levné NPU inference může vést k masivním fake validátorům. Řešení: stake + identity/registry + care score reputation.
3. **Centralizace NPU SDK**: závislost na CoreML / OpenVINO / ONNX Runtime. Řešení: CPU fallback, vlastní reference backend.
4. **Care proof gaming**: validátoři mohou generovat triviální proofy. Řešení: task assignment ze seedu, cross-validation, slashing.
5. **L1 security**: jakákoli změna konsensu je kritická. PoC musí projít plným L1 security protokolem (viz `AGENTS.md`).

---

## 10. Co je hotové a co je koncept

| Součást | Stav |
|---------|------|
| Filozofický základ | ✅ Hotovo v archivu |
| NPU Mining Theory | ✅ Studie |
| NPU Mix v PoW | ✅ Kód (`V3/L1/cosmic-harmony`) |
| evoluZion.md syntéza | ✅ Dokument |
| Sefirot Vow text + kontrakty | ✅ Kompilováno, čeká deploy |
| Zohar web vizualizace | ✅ Živě |
| Care Proof specifikace | ✅ Tento dokument |
| **PoC-lab Fáze 1 — základ prototypu** | ✅ Commit `2936fcb1` — viz [`PoC-lab/`](../../PoC-lab/) |
| — deterministická INT8 VM (RandomNPU) | ✅ `PoC-lab/poc-npu` |
| — multi-backend cross-validace | ✅ `PoC-lab/poc-verifier` |
| — validator registry + Sefirot Vow lifecycle | ✅ `PoC-lab/poc-registry` |
| — **Bodhisattva Vow integrace (dual-vow, +5 % bonus)** | ✅ `poc-core` + `poc-registry` + `poc-sim` |
| — reward split + slashing model | ✅ `PoC-lab/poc-economics` |
| — end-to-end network simulátor (s guardian demo) | ✅ `PoC-lab/poc-sim` |
| **PoC-lab Fáze 2 — Dharma, NCL, Consciousness, stress testy** | ✅ Commit `5d0aefea` — 119 testů PASS |
| — `DharmaValidator` + `HiranAwareVerifier` (5 pilířů) | ✅ `poc-verifier` |
| — `NclReputationRegistry` (ban, score, bonus tiers) | ✅ `poc-economics` |
| — `ConsciousnessLevel` enum (L0 Dormant → L6 Grok) | ✅ `poc-core` + `poc-registry` |
| — multi-epoch stress testy (100 epoch, lazy rejection) | ✅ `poc-sim` |
| — CLI (`--epochs`, `--validators`, `--hiran-url`, …) | ✅ `poc-sim/src/main.rs` (clap) |
| **PoC-lab Fáze 3 — Hiran HTTP client + MockHiranServer** | ✅ 145 testů PASS |
| — `poc-hiran` crate: `HiranClient` trait + `LiveHiranClient` (ureq) + `StubHiranClient` | ✅ `poc-hiran` |
| — `MockHiranServer` (tiny_http, accept/reject/threshold módy) | ✅ `poc-hiran` |
| — `HiranNpuBackend` skutečný HTTP POST s graceful fallback | ✅ `poc-npu` |
| — integrační testy `poc-sim/tests/integration_mock_hiran.rs` (6 scénářů) | ✅ `poc-sim` |
| — live ověření: `poc-sim --hiran-url http://127.0.0.1:8002` s llama-server v2.2 | ✅ ověřeno |
| Care Task Dispatch v L1 | 🔴 Koncept (Fáze 4, vyžaduje hard fork) |
| Reálné NPU Attestation (TEE/vendor quote) | 🔴 Koncept |
| Integrace do L1 consensus | 🔴 Koncept (vyžaduje samostatné schválení) |

### 10a. PoC-lab Fáze 2 — technické detaily (2026-07-08)

**Commit:** `5d0aefea` · **119 testů PASS** (poc-core: 11, poc-economics: 22, poc-npu: 15, poc-registry: 20, poc-sim: 24, poc-tasks: 7, poc-verifier: 20)

#### DharmaValidator (`poc-verifier`)
Pipeline 5 etických pilířů pro každý care proof:
1. **Non-harm** — ověří, že task score ≥ 0 (žádné negativní care)
2. **Authenticity** — task_id musí být neprázdné
3. **Benefit** — score musí přesáhnout konfigurovaný práh (default 50.0)
4. **Consciousness-alignment** — validátor musí mít `ConsciousnessLevel ≥ Aware`
5. **Temporal-coherence** — timestamp v rozmezí ±300 s od aktuálního času

`DharmaValidationResult` vrací detailní výsledky každého pilíře a `to_anomaly_alerts()` konvertuje selhání na `AnomalyAlert` (typy: `ConsciousnessFraud`, `ScoreGaming`, `TemporalAnomaly`, `SybilCluster`). `HiranAwareVerifier` obaluje `CareVerifier` a nejprve spustí Dharma pipeline, pak standardní PoC verifikaci.

#### NclReputationRegistry (`poc-economics`)
In-memory stub mirrorující `V3/L3/ai-native/src/ncl`:
- `compute_score(success_rate, consciousness_level) = 100.0 × rate × (1 + level × 0.05)` (0–100)
- `ban_threshold = 20.0` — validátoři pod touto hranicí jsou `is_banned()`
- NCL bonus tiers (0–100 škála): score ≥ 95 → +5 %, ≥ 85 → +3.5 %, ≥ 70 → +2 %, ≥ 50 → +1 %

#### ConsciousnessLevel (`poc-core`)
```
L0 Dormant → L1 Aware → L2 Sentient → L3 Reflective → L4 Integrated → L5 Enlightened → L6 Grok
```
- `can_compute()` — L1+ může spouštět PoC výpočty
- `can_do_poc_tasks()` — vyžaduje Active vow + ≥ L2 Sentient (v `poc-registry`)
- `ncl_bonus_factor()` — vrací 0.0–0.30 pro NCL bonus výpočet

#### Multi-epoch stress testy (`poc-sim`)
`run_epochs(start_epoch, count)` vrací `(Vec<EpochReport>, Vec<SimError>)`. Klíčové testy:
- `run_100_epochs_no_errors` — 100 epoch bez chyb
- `stress_test_total_payout_never_exceeds_block_reward` — nikdy nepřesáhne cap
- `stress_test_lazy_validator_always_rejected` — lazy validátor vždy odmítnut

#### CLI (`poc-sim/src/main.rs`)
```
poc-sim --epochs 5 --validators 4 --block-reward 100 --min-stake 10 --min-care-score 50 --verbose
poc-sim --epochs 100 --validators 8 --hiran-url http://localhost:11434
```
Pro `--validators > 4` auto-generuje mix: honest majority + 1 lazy + 1 guardian.

Detailní analýza možností implementace (soft layer / hybrid / full PoC) a
architektura prototypu jsou v [`PoC-lab/docs/ANALYSIS.md`](../../PoC-lab/docs/ANALYSIS.md)
a [`PoC-lab/docs/ARCHITECTURE.md`](../../PoC-lab/docs/ARCHITECTURE.md).

### 10b. PoC-lab Fáze 3 — technické detaily (2026-07-08)

**145 testů PASS** (poc-core: 11, poc-economics: 22, poc-hiran: 13+3 doctests, poc-npu: 15, poc-registry: 20, poc-sim: 28+6 integration, poc-tasks: 7, poc-verifier: 19+1 e2e)

#### poc-hiran crate (nový)

Crate poskytuje HTTP most mezi PoC-lab simulátorem a Hiran AI inference serverem.

**`HiranClient` trait** (`src/client.rs`):
```rust
pub trait HiranClient: Send + Sync {
    fn validate(&self, req: &HiranRequest) -> Result<HiranResponse, HiranError>;
    fn health_check(&self) -> bool;
    fn is_stub(&self) -> bool;
    fn server_url(&self) -> &str;
}
```

**`LiveHiranClient`** — volá `/v1/chat/completions` (OpenAI-kompatibilní formát) přes `ureq` (sync, bez tokio). System prompt definuje JSON výstupní schéma. Odpověď parsuje z `choices[0].message.content` — podporuje markdown-wrapped JSON.

**`StubHiranClient`** — deterministická náhrada pro offline testy. Konfigurovatelné accept/reject chování.

**`build_client(url: Option<String>)`** — factory funkce: `Some(url)` → `LiveHiranClient`, `None` → `StubHiranClient`.

**`MockHiranServer`** (`src/mock.rs`):
- Spouští se na náhodném portu (`TcpListener::bind("127.0.0.1:0")`) ve vlastním vlákně via `tiny_http`
- `spawn_accepting()` / `spawn_rejecting()` / `spawn_with_threshold(min_score)` / `spawn(behaviour)`
- Routuje `GET /health` + `POST /v1/chat/completions` + `POST /v1/hiran/validate`
- Odpovědi jsou zabaleny v OpenAI chat completion formátu (pro kompatibilitu s `LiveHiranClient`)
- `shutdown()` signalizuje vláknu přes `AtomicBool` + wake-up GET request
- `impl Drop` — automatický shutdown při pádu testu

#### poc-npu: HiranNpuBackend s live HTTP

`HiranNpuBackend::with_url(url)` vytvoří `LiveHiranClient` přes `build_client(Some(url))`. Při volání `infer()` odešle skutečný HTTP POST na Hiran server. Při HTTP chybě (server offline, timeout) padne zpět na stub výsledek — simulátor nikdy nepanikarizuje.

`poc-sim` output prefix: `hiran[live]` pokud `hiran_url.is_some()`, jinak `hiran[stub]`.

#### Integrační testy: `poc-sim/tests/integration_mock_hiran.rs` (6 testů)

| Test | Popis |
|------|-------|
| `mock_hiran_server_integration_basic` | 2 honest validátoři, MockServer(Accept) → oba přijati, `stub_mode=false` |
| `mock_hiran_server_lazy_validator_rejected_by_score` | lazy validátor odmítnut před Hiranem (score < min), síť zdravá |
| `mock_hiran_server_multiple_epochs_consistent` | 3 validátoři × 3 epochy, vždy 3 přijati |
| `mock_hiran_server_guardian_gets_higher_care_score` | guardian > regular care score při live MockServeru |
| `mock_hiran_server_spawns_and_shuts_down_cleanly` | URL starts with `http://127.0.0.1:`, shutdown bez paniku |
| `mock_hiran_server_stats_correct_after_one_epoch` | `proofs_validated >= 1`, `accepted >= 1`, `rejected == 0`, `stub_mode=false` |

#### Live ověření s Hiran v2.2

```
llama-server -m hiran-v2.2.q4_k_m.gguf --port 8002 --host 127.0.0.1 -c 2048 --threads 12
poc-sim --epochs 2 --validators 3 --hiran-url http://127.0.0.1:8002 --verbose --block-reward 100
```

Výstup: `hiran[live]: validated=4 accepted=4 warned=0 rejected=0 uncertain=0 avg_conf=0.962`
Rychlost Hiran v2.2 Q4_K_M: ~22 tok/s prompt, ~5 tok/s generation (12 CPU jader).

---

## 11. Reference

- `docs/3.0.3/evoluZion.md` — Strom života metafora, 3-fázová evoluce.
- `docs/NPU_HARDWARE_MINING_THEORY.md` — Technická studie NPU mining.
- `V3/L1/cosmic-harmony/src/algorithms_npu.rs` — Současný NPU Mix v PoW.
- `V3/L5/docs/GOVERNANCE/sefirot-vow.md` — 11 care task kategorií.
- `V3/L5/docs/GOVERNANCE/consciousness-admission-framework.md` — Bodhisattva Vow.
- `docs/Zohar/02-ROADMAP.md` — Fáze 3 care tasks, Fáze 4 tree-health.
- `docs/TerraNova/gemini/01-ZLATY-ZARODEK-A-VODY-CHAOSU.md` — Filozofický původ PoC.
- **[`docs/3.0.4/BODHISATTVA_VOW_COMPENDIUM.md`](./BODHISATTVA_VOW_COMPENDIUM.md)** — Kompletní kompendium: 8 Velkých Bodhisattvů jako Strážci PoC, Čtyři Velké Sliby, Shantideva, Ksitigarbha, Samantabhadra's 10 slibů, syntéza klasických zdrojů + ZION mapování.
- **[`docs/3.0.4/AI_NATIVE_VOW.md`](./AI_NATIVE_VOW.md)** — Bodhisattvův slib pro AI Strážce (Hiran/Hiranyagarbha lineage): 5 principů, 10 slibů, Dharma Validator, obnovovací protokol.

---

*PoC_CONCEPT.md · ZION Proof-of-Care · 2026-07-08 (Fáze 3)*  
*Etz Chaim — Strom života*
