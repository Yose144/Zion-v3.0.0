# Ekam Deeksha → Hardware NPU Mining: Teoretická analýza

> **Status:** Teorie / design studie — žádné code changes  
> **Autor:** ZION Core Team, 2026-04-02  
> **Kontext:** Po RTX 5070 Ti benchmarku (21 KH/s) — hledání cesty k silnější ASIC rezistenci

---

## 1. Problém: Současný NPU je čistě SW

Ekam Deeksha pipeline:

```
Keccak-256 → SHA3-512 → GoldenMatrix → MemoryHard(256 KiB) → NPU Mix → CosmicFusion → Hash32
```

**NPU Mix** je INT8 MLP s residual connection:
- Váhy: deterministicky odvozené z genesis seedu (Blake3 KDF)
- Topologie: 4 varianty rotující per epoch (Standard/ThreeLayer/Wide/Deep)
- Aritmetika: čistě integer (i8 × i8 → i32, >>12, clamp, LayerNorm, GELU)

### Co je SW-only:

| Komponent | Realita |
|-----------|---------|
| Váhy W1, W2, bias, scale | Konstanta protokolu — blake3(genesis_seed + epoch) |
| MatMul | Smyčka `acc += a[j] * w[i][j]` — žádný HW tenzorový engine |
| LayerNorm | mean/variance/normalize — skalární integer math |
| GELU | `x * (128 + x) >> 8` — 2 instrukce |
| Topologie rotace | 4 fixní varianty, deterministický schedule |

**ASIC designer vidí:** 4 fixní matice (max 64×256) s integer multiply-accumulate.
To je triviální hardwired pipeline — stačí 4 MAC array konfigurace.

### Aktuální ASIC resistance breakdown:

| Fáze | ASIC obtížnost | Proč |
|------|----------------|------|
| Keccak-256 | ❌ Nízká | Existující ASIC IP (Ethereum/Monero éra) |
| SHA3-512 | ❌ Nízká | Stejná Keccak rodina |
| GoldenMatrix | ❌ Nízká | Fixní lookup + multiply |
| **MemoryHard** | ✅ **Vysoká** | 256 KiB scratchpad, 4 passes, 256 random reads — ASIC potřebuje SRAM |
| **NPU Mix** | ⚠️ Střední | INT8 matmul s rotací — ale fixní dimenze, ASIC to zvládne |
| CosmicFusion | ❌ Nízká | Keccak + AES — známé ASIC bloky |
| AES-128 | ❌ Nízká | Commoditní HW IP |

**Závěr:** Jediná skutečná ASIC bariéra v Ekam Deeksha je memory-hard fáze (256 KiB SRAM per hash). NPU mix přidává **laterální komplexitu** (4 topologie), ale ne fundamentální HW bariéru.

---

## 2. Co by změnil reálný NPU hardware

### 2.1 Současný HW NPU landscape (2025-2026)

| Platforma | NPU | INT8 TOPS | Programovatelnost |
|-----------|-----|-----------|-------------------|
| Apple M4 | ANE 16-core | 38 TOPS | CoreML only (no direct) |
| Apple M3 | ANE 16-core | 18 TOPS | CoreML only |
| Intel Lunar Lake | NPU 4 | 48 TOPS | OpenVINO |
| Intel Meteor Lake | NPU 3720 | 10 TOPS | OpenVINO |
| AMD Ryzen AI 300 (Strix) | XDNA 2 | 50 TOPS | ONNX RT / Ryzen AI SDK |
| AMD Ryzen AI 9 (Hawk Point) | XDNA | 16 TOPS | ONNX RT |
| Qualcomm X Elite | Hexagon | 45 TOPS | SNPE / QNN |
| Samsung Exynos 2400 | Dual NPU | 34.7 TOPS | Samsung ONE |

**Klíčový fakt:** Každý moderní laptop/telefon má 10-50 TOPS NPU hardware, který Ekam Deeksha **vůbec nevyužívá**.

### 2.2 Co NPU HW umí vs. co Ekam Deeksha dělá

NPU hardware je optimalizovaný na:
- **Velké matice**: 128×128 a větší, tiled execution
- **Batch inference**: tisíce vstupů paralelně
- **INT8/INT4 MAC**: stovky/tisíce MAC jednotek per cycle
- **On-chip SRAM**: weight buffering, activation caching

Ekam Deeksha NPU Mix:
- **Malé matice**: max 64×256 (Standard: 64×128×64)
- **Jeden vstup**: 64 bytů → 64 bytů
- **Velmi málo operací**: ~8K + ~8K = ~16K MAC per hash (obě vrstvy)

**Problém:** 16K INT8 MAC operací je pro 50 TOPS NPU práce na **~0.3 µs**.
Ale overhead volání NPU (CoreML session, buffer copy, schedule) je **100-500 µs**.

→ Současný NPU Mix je **příliš malý** na to, aby se vyplatilo volat HW NPU. Kernel launch overhead dominuje.

---

## 3. Návrh: RandomNPU — Náhodné neuronové programy pro PoW

Inspirace: **RandomX** (Monero) generuje náhodné x86 programy tak, aby ASIC musel implementovat celý x86 CPU → mining na generic hardware.

**RandomNPU** by generoval **náhodné neuronové sítě** tak, aby ASIC musel implementovat general-purpose inference engine → mining na generic NPU/GPU.

### 3.1 Princip

```
Epoch seed = Blake3(genesis_seed || epoch_number || block_hash_at_epoch_start)
     ↓
RandomNPU program = GenerateRandomModel(seed)
     ↓
Model: random layers, random dimensions, random activations, random skip connections
     ↓
Mining: hash = MemoryHard(input) → RandomNPU(model, state) → CosmicFusion(state)
```

### 3.2 Random Model Generator

Per epoch (každých 2016 bloků) se vygeneruje nový model:

```
struct RandomNpuProgram {
    layers: Vec<RandomLayer>,        // 4-12 vrstev (náhodně)
    skip_connections: Vec<(u8, u8)>, // residual skip paths
    total_ops: u64,                  // target: ~2M MAC per hash
}

enum RandomLayer {
    Dense {
        in_dim: u16,    // 32..512
        out_dim: u16,   // 32..512
        activation: Activation,
    },
    Conv1D {
        channels: u16,  // 16..256
        kernel: u8,     // 3, 5, 7
        activation: Activation,
    },
    Attention {
        heads: u8,      // 1..8
        dim: u16,       // 32..256
    },
    GroupNorm {
        groups: u8,     // 1..32
    },
    DepthwiseConv {
        channels: u16,
        kernel: u8,
    },
}

enum Activation {
    GELU,
    ReLU,
    SiLU,
    HardSwish,
    Mish,
}
```

### 3.3 Proč by to fungovalo

| Vlastnost | Efekt na ASIC |
|-----------|---------------|
| Náhodné dimenze (32-512) | ASIC nemůže mít fixní MAC array — potřebuje flexible tiling |
| Náhodné typy vrstev | Dense + Conv + Attention = 3 různé compute patterny |
| Náhodné aktivace | 5 různých nelinearit, nelze hardwire |
| Skip connections | Dynamický dataflow, ne fixní pipeline |
| Layer count 4-12 | Variabilní hloubka, ASIC nemůže mít fixní pipeline stages |
| ~2M MAC per hash | Dostatečný workload na amortizaci NPU kernel launch |

**ASIC, který to zvládne = general-purpose NPU = komerční čip = žádná výhoda oproti consumer HW.**

### 3.4 Target workload sizing

Aby se vyplatilo použít HW NPU, potřebujeme dostatečný workload per hash:

| Metrika | Současný Ekam Deeksha | RandomNPU target |
|---------|----------------------|------------------|
| MAC ops per hash | ~16K | **~2M** (125× více) |
| NPU execution time | ~0.3 µs (wasted) | **~40 µs** (amortized) |
| Weight bytes per epoch | ~17 KB | **~2-8 MB** |
| Activation memory | 512 B | **~64 KB** |
| % of hash time | <1% | **~30-50%** |

S 2M MAC operacemi per hash a ~50 µs NPU execution:
- 50 TOPS NPU (AMD XDNA 2): ~40 µs per hash NPU portion → **~25K hashes/sec** (NPU-bound)
- 18 TOPS NPU (Apple M3 ANE): ~110 µs → **~9K hashes/sec**
- GPU (RTX 5070 Ti, batch): tisíce hashů paralelně → **záleží na throughput, ne latenci**

---

## 4. Determinism: Klíčový problém

### 4.1 Proč je determinismus těžký na NPU HW

```
Apple ANE:           FP16 interně, rounding neurčeno
Intel NPU (Meteor):  INT8 ale rounding per-generation
AMD XDNA:            INT8, ale accumulator width varies
Qualcomm Hexagon:    INT8, proprietary rounding
GPU (CUDA/OpenCL):   Depends on fast-math flags
```

**Problém:** Pokud `ANE(data)` ≠ `XDNA(data)`, nelze validovat bloky across hardware.

### 4.2 Řešení: INT8 Virtual Machine s kanonickým chováním

Definovat **ZION NPU VM** — specifikaci s přesně definovaným chováním:

```
ZION NPU VM Spec v1:
  - Datový typ: INT8 (signed, two's complement)
  - Accumulator: INT32 (exact, no overflow for dim ≤ 512)
  - MatMul: acc = Σ(a[j] * w[j]) where * is i8×i8→i32, Σ is i32 add
  - Scale-down: acc >> shift (arithmetic shift, round toward -∞)
  - Clamp: max(-128, min(127, acc))
  - Normalization: integer LayerNorm as specified (mean, var, isqrt)
  - Activation: lookup table (256 entries per activation type)
  - isqrt: integer, specified algorithm (Newton's method, 3 iterations)
```

**Klíč:** Každá aktivační funkce je **lookup table** (256 vstupních hodnot → 256 výstupních).
Vygenerovaná per epoch ze seedu. Žádná floating-point → bit-exact na všem HW.

### 4.3 Execution model

```
                    ┌─────────────────────┐
                    │   ZION NPU VM Spec  │  (kanonická reference)
                    │   INT8, deterministic│
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
     ┌────────┴──────┐  ┌─────┴──────┐  ┌──────┴────────┐
     │  CPU Backend  │  │ GPU Backend│  │  NPU Backend  │
     │  (reference)  │  │ CUDA/OpenCL│  │  ONNX/CoreML  │
     │  INT8 scalar  │  │ INT8 batch │  │  INT8 tiled   │
     └───────────────┘  └────────────┘  └───────────────┘
              │                │                 │
              └────────────────┼────────────────┘
                               │
                        ┌──────┴──────┐
                        │ Circuit     │
                        │ Breaker     │ (verify vs CPU reference)
                        └─────────────┘
```

1. **CPU backend** = reference truth (vždy deterministic)
2. **GPU backend** = batch execution (CUDA/OpenCL INT8 kernels) 
3. **NPU backend** = HW acceleration via ONNX Runtime INT8
4. Circuit breaker: periodicky verifikuje GPU/NPU výstup proti CPU

---

## 5. Migrace z aktuálního Ekam Deeksha

### 5.1 Fázový přechod (bez hard-forku algoritmu)

**Fáze 0 (současný stav):**
- NPU Mix: 64→128→64 INT8 MLP, ~16K MAC, 4 topologie per epoch
- ASIC resistance: závislá primárně na memory-hard fázi

**Fáze 1 — Větší NPU workload (soft enhancement):**
- Zvětšit NPU model: 64→512→256→128→64 (nebo per-epoch random dim)
- ~500K MAC per hash (30× více)
- Stále deterministicky ze seedu, stále INT8
- **Backward compatible pokud je NPU Mix definován jako "plugin" s verzí**
- Epoch seed zahrnuje `npu_version` byte → staré/nové nody musí souhlasit

**Fáze 2 — Random topologie (medium change):**
- Dimenze, layer count, aktivace random per epoch
- Model je stále statický per epoch (2016 bloků)
- Weight cache: ~2 MB per epoch (vs. 17 KB dnes)
- GPU kernely: runtime compilation s parametrickými dimenzemi (už děláme s `NPU_MAX_DIM`)
- **Hard fork required** — nová pravidla generování modelu

**Fáze 3 — Full RandomNPU (major change):**
- Random DAG s Conv1D + Attention + Dense + skip connections
- ~2M MAC per hash, ~2-8 MB weights per epoch
- ONNX Runtime jako standard backend pro NPU HW
- GPU: custom tiled INT8 matmul kernel library
- **Nový hard fork** — ale builds on Fáze 2 infrastructure

### 5.2 Minimální změna pro okamžitý dopad

Bez jakéhokoliv hard-forku — **pouze performance optimization**:

```diff
# Aktuální: NPU Mix ~ 16K MAC (< 1% hash time)
# Návrh: zvětšit hidden dim na 512, přidat 3. vrstvu

Epoch 0: 64 → 512 → 256 → 64  (~230K MAC)
Epoch 1: 64 → 384 → 384 → 64  (~295K MAC)
Epoch 2: 64 → 512 → 512 → 64  (~525K MAC)
Epoch 3: 64 → 256 → 128 → 64 → 64  (~115K MAC)
```

S ~300K MAC průměrně:
- NPU HW (50 TOPS): ~6 µs → stále pod kernel launch overhead
- GPU batch: amortizovaný přes tisíce hashů → **zanedbatelný dopad na KH/s**
- CPU: ~150 µs → **znatelné zpomalení pro CPU mining**

→ **Zvětšení NPU workloadu samo o sobě nepomůže s ASIC resistance.** Klíčový je **randomized compute graph**, ne jenom větší matice.

---

## 6. Realističtější alternativa: NPU-Bound MemoryHard

Místo nahrazení celého NPU Mixu můžeme **integrovat NPU operace přímo do memory-hard fáze**:

### 6.1 Koncept: Neural Memory-Hard Transform

```
Inicializace scratchpadu:
  for block in scratchpad_blocks:
    block = sha3_512(prev_block)
    block = mini_mlp(block, epoch_weights)  ← NPU per block!

Random reads:
  for read in random_reads:
    addr = derive_address(state)
    block = scratchpad[addr]
    state = mix(state, block)
    state = mini_mlp(state, epoch_weights)  ← NPU per read!
```

**Efekt:** NPU operace jsou **data-dependent** a interleavované s memory access.

| Vlastnost | Benefit |
|-----------|---------|
| NPU per scratchpad block | 4096 × mini_mlp = ~4M MAC total |
| NPU per random read | 256 × mini_mlp = ~256K MAC total |
| Data-dependent | ASIC nemůže pipeline-ovat NPU nezávisle na memory |
| Memory-bound + compute-bound | Dva nezávislé ASIC bottlenecky |

### 6.2 ASIC resistance analýza

```
Současný Ekam Deeksha ASIC:
  Memory: 256 KiB SRAM per hash unit
  Compute: SHA3 + AES + fixed MLP → hardwired
  Bottleneck: memory bandwidth only

Neural Memory-Hard ASIC:
  Memory: 256 KiB SRAM per hash unit (same)
  Compute: SHA3 + AES + random NPU graphs → general-purpose MAC array
  Bottleneck: memory bandwidth AND compute throughput AND flexibility
```

**3 simultánní bottlenecky = podstatně těžší ASIC optimalizace.**

---

## 7. Praktické překážky

### 7.1 ONNX Runtime deterministický INT8

```
ONNX Runtime:
  - QLinearMatMul: INT8 matmul s explicitní kvantizací
  - Rounding: "round half to even" (IEEE 754) — deterministické
  - Ale: backend-specific optimalizace mohou měnit accumulation order
  
Řešení:
  - Vynucení CPU EP (execution provider) jako reference
  - NPU EP povoleno jen pokud projde circuit-breaker test
  - Epoch test vector: hash(model(known_input)) musí matchovat
```

### 7.2 Kernel launch overhead na NPU

```
Apple ANE via CoreML:
  - Model load: ~50 ms (once per epoch)
  - Inference: ~100-500 µs per call (setup dominates)
  - Batch: 64+ inputs → ~10 µs per input amortized
  
Intel NPU via OpenVINO:
  - Similar latency profile
  - Batch amortization critical
  
→ Mining musí být batch-oriented (stejně jako GPU)
→ Miner sbírá N noncí, provede MemoryHard per nonce,
   pak batch NPU inference pro N stavů najednou
```

### 7.3 Cross-platform verifikace

```
Validátor (plný uzel) musí ověřit PoW:
  - Nemůže záviset na NPU HW (server nemá NPU)
  - CPU reference backend musí být dostatečně rychlý pro verifikaci
  - Block time 60s, ~1 hash per block ověření → CPU OK i pro velké modely
  
Miner:
  - Miliony hashů per sekundu → potřebuje HW akceleraci
  - GPU: batch INT8 matmul (cuBLAS INT8, clblast)
  - NPU: ONNX Runtime s HW EP
  - CPU: pomalý ale funkční fallback
```

---

## 8. Porovnání přístupů

| Přístup | ASIC res. | Impl. effort | Mining democratizace | Risk |
|---------|-----------|-------------|---------------------|------|
| **Současný** (SW NPU, 16K MAC) | ⚠️ Střední | ✅ Hotovo | GPU/CPU | Nízký |
| **Větší MLP** (300K MAC) | ⚠️ Střední+ | 🟡 Malý | GPU/CPU | Nízký |
| **Random topologie** (2M MAC) | ✅ Vysoká | 🟠 Střední | GPU/NPU/CPU | Střední |
| **Neural MemHard** (4M MAC interleavované) | ✅✅ Velmi vysoká | 🔴 Velký | GPU/NPU/CPU | Vysoký |
| **Full RandomNPU** (RandomX styl) | ✅✅✅ Max | 🔴🔴 Obrovský | GPU/NPU/CPU | Velmi vysoký |

---

## 9. Doporučení

### Krátkodobé (bez hard-forku):
1. **Neměnit** — současný NPU Mix funguje, memory-hard fáze je hlavní ASIC bariéra
2. Zvětšení MLP nepřidá meaningful ASIC resistance (ASIC zvládne i 512-dim matmul)

### Střednědobé (plánovaný hard-fork):
3. **Random topologie per epoch** — nejlepší poměr effort vs. ASIC resistance
4. Dimenze 32-512, 4-8 vrstev, 3+ typů aktivací, skip connections
5. GPU: parametrický kernel s runtime compilation (rozšíření stávajícího `NPU_MAX_DIM`)
6. NPU: ONNX Runtime voluntary backend s circuit breaker

### Dlouhodobé (výzkum):
7. **Neural Memory-Hard** — integrovat MLP do scratchpad passes
8. Studovat RandomX implementaci pro inspiraci na random program generation
9. Sledovat vývoj NPU SDK (ONNX Runtime 2.0, CoreML 8, OpenVINO 2026)

---

## 10. Klíčový závěr

> **Samotná velikost NPU (větší matice) nepomůže.** ASIC designer optimalizuje fixní compute graf.
> 
> **ASIC resistance vyžaduje randomizaci compute grafu** — nikoliv jen vah, ale **struktury výpočtu**.
> 
> To je přesně to, co dělá RandomX pro x86: generuje náhodné programy, takže ASIC musí být general-purpose CPU.
> **RandomNPU** by dělal totéž pro neuronové inference: generovat náhodné modely, takže ASIC musí být general-purpose NPU.
>
> **Paradox:** General-purpose NPU = existující komerční čip (Apple ANE, AMD XDNA, Intel NPU).
> → Mining na consumer HW, žádná ASIC výhoda. QED.

Aktuální Ekam Deeksha tento level nepotřebuje — memory-hard 256 KiB scratchpad s random reads
je silná primární bariéra. NPU Mix přispívá laterální komplexitou. Ale pokud by se někdy
ukázalo, že 256 KiB SRAM ASIC je ekonomicky viable, RandomNPU je připravený koncept pro
eskalaci ASIC resistance na maximum.

---

*Dokument je čistě teoretický. Žádné code changes nejsou navrženy pro aktuální release.*
