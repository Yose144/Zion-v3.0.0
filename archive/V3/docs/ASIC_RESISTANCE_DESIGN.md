# Ekam Deeksha — ASIC Resistance Hardening & ZK-STARK Roadmap

**Status:** Design Proposal  
**Author:** Yose144 + AI  
**Date:** 2026-03-17  
**Applies to:** V3 mainnet track, `cosmic_harmony_ekam_deeksha`

---

## 1. Current State — Honest Assessment

### 1.1 Ekam Deeksha Pipeline (v3.0 — active)

```
header[80] + nonce[8] = 88 bytes
  │
  ├─ Step 1: Keccak-256(88B)         → 32B
  ├─ Step 2: SHA3-512(32B)           → 64B
  ├─ Step 3: Golden Matrix(64B)      → 64B   (8×8 × φ powers, u128 mul)
  ├─ Step 4: Memory-Hard(64B)        → 64B   (64 KiB scratchpad)
  │     ├─ Blake3 XOF init           → 64 KiB
  │     ├─ 2 sequential passes       → Blake3 XOF mix per block
  │     └─ 64 Keccak-256 random reads
  ├─ Step 5: NPU INT8 MLP(64B)      → 64B   (64→128→64, LayerNorm, GELU)
  └─ Step 6: Cosmic Fusion(64B)      → 32B   (8× AES-128 + Keccak-256 rounds)
```

### 1.2 ASIC Resistance Score: ~65/100

| Vlastnost | Hodnota | Skóre | Komentář |
|-----------|---------|-------|----------|
| Memory-hard scratchpad | 64 KiB | 4/10 | Vejde se do SRAM ASIC (<$1) |
| Scratchpad passes | 2 | 3/10 | Málo iterací → nízká memory bandwidth |
| Random reads | 64 | 4/10 | RandomX: 2048, Monero-level: 128+ |
| Heterogenní primitiva | 5 typů (Keccak, SHA3, Blake3, AES, INT8 MLP) | 8/10 | Silné — multi-unit ASIC je drahý |
| NPU mixing | INT8 matmul + LayerNorm + GELU | 7/10 | Integer division + sqrt je ALU-heavy |
| AES v fusion | 8 roundů data-dependent keys | 7/10 | AES S-box je gate-expensive |
| Data-dependent addressing | Keccak hash → block index | 7/10 | Brání pipeline prefetch |
| Overall | — | **~65%** | Středně resistant |

### 1.3 Proč ne 90%?

Hlavní slabiny:

1. **64 KiB scratchpad je malý.** Monero RandomX: 2 MiB. Ethereum: 1 GB DAG. 64 KiB = jeden SRAM block na ASIC za ~$0.50.
2. **Pouze 64 random reads.** Každý navíc = +1 Keccak-256 + random SRAM latency. 64 stačí na CPU, ale ASIC zvládne pipeline.
3. **Pouze 2 passy.** Víc passů = víc dat musí zůstat v paměti → memory bandwidth bound.
4. **Golden Matrix je triviální.** 64 násobení + sčítání — na ASIC ~10 gate delays.

---

## 2. Historický kontext — Co selhalo jinde

### 2.1 RandomX (Monero)

- **Princip:** VM emulující x86 instrukční sadu, 2 MiB scratchpad, data-dependent branching
- **Silné:** Každý hash spouští jiný pseudonáhodný program → ASIC musí implementovat general-purpose CPU
- **Prolomení:** 2024-2025 FPGA implementace dosáhly ~2× efektivitu vs CPU. Plné ASIC prolomení není veřejně potvrzeno, ale FPGA trend jasně ukazuje, že VM-based přístup není neprůstřelný.
- **Poučení:** Ani 2 MiB + VM emulace nezaručuje trvalou ochranu. Klíč je *evolvability* — možnost měnit parametry bez hard-fork.

### 2.2 Ethash / ProgPoW

- **Ethash:** 1 GB DAG efektivně bránil ASIC po ~3 roky, ale poté: Antminer E9 (2022).
- **ProgPoW:** Random GPU program execution — nikdy neaktivován kvůli komunitní kontroverzi.
- **Poučení:** DAG = efektivní bariéra, ale penalizuje CPU mining → trade-off.

### 2.3 Equihash (Zcash)

- Birthday paradox + memory-hard. Bitmain Z15 ASIC přišel za ~18 měsíců.
- **Poučení:** Matematicky elegantní != ASIC-proof. Jednoduché struktury se vždy optimalizují.

### 2.4 CryptoNight / CN variants

- 2 MiB scratchpad + AES rounds. Efektivní ~5 let, než přišly specializované FPGA.
- **Poučení:** AES + scratchpad je dobrý základ, ale samotné zvětšení paměti nestačí.

---

## 3. Strategie pro 90% ASIC Resistance

### Princip: ASIC musí být příliš drahý NEBO příliš pomalý

ASIC resist neznamená "impossible". Znamená: ekonomicky nesmyslné vyrobit HW, který je výrazně efektivnější než GPU/CPU. Cesta:

1. **Memory bandwidth bound** — ne memory size bound
2. **Heterogenní compute** — víc různých ALU jednotek = víc silicon area
3. **NPU jako "living barrier"** — váhy se mění per-epoch → ASIC by musel implementovat general-purpose INT8 inference engine
4. **Parametrická evolvability** — možnost měnit konstanty soft-forkem

### 3.1 Tier 1 — Scratchpad Hardening (2 konstanty, žádný nový kód)

```
Změna:                  Současnost    →  Návrh         Efekt
SCRATCHPAD_SIZE         64 KiB        →  256 KiB       4× víc SRAM, L2 cache bound
PASSES                  2             →  4             2× memory bandwidth
RANDOM_READS            64            →  256           4× víc Keccak + random latency
```

**Odhadovaný dopad na hashrate:** ~3-4× pokles (z 15 KH/s na ~4 KH/s na 4T).  
**ASIC resistance boost:** +15 bodů → ~80/100.  
**Implementace:** Změna 3 konstant v `scratchpad_ekam.rs`. Nový testový vektor. Fork height activation.  
**Čas:** 1 den kód + 1 den testing.

### 3.2 Tier 2 — Epoch-Rotating NPU Weights (klíčová inovace)

**Současný stav:** NPU váhy jsou fixní (derivovány z genesis seedu). ASIC může hardcode matici do silicon.

**Návrh:** Váhy se přepočítávají každou epochu (N bloků):

```
epoch = block_height / EPOCH_LENGTH    (e.g. EPOCH_LENGTH = 2016)
epoch_seed = Blake3(genesis_seed || epoch.to_le_bytes())
weights = MlpWeights::from_seed(epoch_seed)
```

**Proč je to klíčové pro ASIC resistance:**

- ASIC s hardcoded váhami selže po 2016 blocích
- ASIC musí implementovat **obecný INT8 inference engine** s loadable weights
- To je v podstatě — NPU/TPU. Náklad: ~$5-50M na vývoj custom silicon
- CPU/GPU mají loadable weights nativně → nulová penalizace

**Rozšíření — Variabilní topologie:**

```
epoch % 4 == 0: 64→128→64    (standardní)
epoch % 4 == 1: 64→96→128→64 (3-vrstvá)
epoch % 4 == 2: 64→256→64    (wide)
epoch % 4 == 3: 64→64→64→64  (deep, 3× residual)
```

ASIC by musel implementovat konfigurovatelnou MLP architecture → to je General Purpose NPU → ASICk nemá výhodu vs off-the-shelf NPU.

**ASIC resistance boost:** +10-15 bodů → ~90/100 (s Tier 1 dohromady).  
**Čas:** 1-2 týdny implementace + 1 týden audit.

### 3.3 Tier 3 — Micro-VM Execution Trace (RandomX-inspired, optional)

**Princip:** Část scratchpad passů nahradí pseudonáhodný mikroprogram:

```
program = generate_program(block_hash, epoch)
// 64 instrukcí: {ADD, XOR, MUL, ROT, LOAD, AES_ROUND, BLAKE3_COMPRESS}
for instr in program:
    execute(instr, registers, scratchpad)
```

**Výhoda:** ASIC musí implementovat general-purpose ALU s branch prediction.  
**Nevýhoda:** Složitost audit, risk timing side-channels, delší vývoj.  
**Čas:** 4-8 týdnů implementace, 2-4 týdny audit.

### 3.4 Tier 4 — ZK-STARK Integration (long-term)

Viz sekce 5.

---

## 4. NPU jako klíč k ASIC Resistance — Deep Dive

### 4.1 Proč NPU funguje

ASIC designéři optimalizují **fixní operace**. NPU mixing vyžaduje:

| Operace | Na CPU/GPU | Na custom ASIC |
|---------|-----------|----------------|
| INT8 matmul 64×128 | SIMD instrukce (existují) | Systolic array (~500 gates/MAC) |
| LayerNorm (mean + variance + sqrt + div) | ALU pipeline | Dedikovaný divisor + sqrt unit (~2000 gates) |
| GELU aktivace | Branch/LUT | Comparator + multiplier |
| Residual add + clamp | Trivial | Trivial |
| **Weight loading** per epoch | Memory load | **SRAM + controller** → silicon area |

Klíčový insight: **jakmile se váhy mění, ASIC se stává programovatelným NPU.** A programovatelný NPU je přesně to, co CPU/GPU už umí.

### 4.2 Proč ne DAG?

| Přístup | ASIC resist | CPU mining | GPU mining | Implementace |
|---------|-------------|-----------|-----------|-------------|
| **DAG (Ethash-style)** | ★★★★ | ✗ (RAM > 4GB) | ★★★★ | Střední |
| **Velký scratchpad (2MiB)** | ★★★ | ★★★ | ★★★ | Jednoduchá |
| **Epoch NPU weights** | ★★★★ | ★★★★ | ★★★★ | Střední |
| **Micro-VM (RandomX)** | ★★★★ | ★★★★★ | ★★ | Vysoká |
| **NPU + scratchpad combo** | ★★★★★ | ★★★★ | ★★★★ | Střední |

DAG penalizuje CPU těžbu a vytváří GPU-only oligopol. NPU + scratchpad hardening zachová CPU/GPU paritu a přidá ASIC bariéru.

### 4.3 Návrh: NPU-Enhanced Ekam Deeksha (Tier 1+2)

```
Ekam Deeksha v2 (proposed):

  Step 4: Memory-Hard (UPGRADED)
    ├─ 256 KiB scratchpad (4× current)
    ├─ 4 sequential passes (2× current)
    └─ 256 Keccak-256 random reads (4× current)

  Step 5: NPU INT8 MLP (UPGRADED)
    ├─ Epoch-rotating weights (per 2016 blocks)
    ├─ Variable topology per epoch
    └─ Weights derived: Blake3(genesis_seed || epoch_le8 || "CHv4_weights_v2")
```

**Celkový ASIC resistance score:** ~88-92/100.

---

## 5. ZK-STARK — Varianty & Timeline

### 5.1 Varianta A: STARK Pool Verification (nejbližší)

**Princip:** Miner přiloží ke share STARK proof, že hash byl korektně vypočítán.

```
Miner → Pool:  { nonce, hash, stark_proof }
Pool verifies:  verify_stark(proof, header, nonce, hash) → true/false
```

**Výhody:**
- Pool nemusí re-hashovat (verify ~100× rychlejší než compute)
- Brání podvodnému software (nemůžeš submittovat fake share)
- Přirozeně zvyšuje ASIC resistance (STARK prover je compute-heavy, vyžaduje GP-ALU)

**Nevýhody:**
- STARK proof generace je ~100-1000× pomalejší než samotný hash
- Řešení: proof jen pro accepted shares (ne pro každý nonce)
- Proof size: ~50-200 KB per share

**Knihovny:**
- [winterfell](https://github.com/facebook/winterfell) — Rust, production-ready
- [stwo](https://github.com/starkware-libs/stwo) — StarkWare open-source, circle STARKs
- [plonky3](https://github.com/Plonky3/Plonky3) — Polygon, bleeding-edge

**Timeline:** 4-8 týdnů pro PoC s winterfell.

**Hlavní challenge:** Arithmetizace Keccak-256 / Blake3 / AES do STARK AIR (Algebraic Intermediate Representation). Keccak je bitwise → konverze do field arithmetic je drahá (~160k constraints per hash). Blake3 je přátelštější (~50k constraints).

### 5.2 Varianta B: STARK Recursive Block Verification (mid-term)

**Princip:** Každý blok obsahuje rekurzivní STARK proof ověřující předchozích N bloků.

```
block[N].stark_proof = prove(
    blocks[N-K..N] all have valid PoW,
    all transactions valid,
    state transitions correct
)
```

**Light node verification:** Stáhne jen poslední blok + proof → ověří celý chain.

**Timeline:** 3-6 měsíců (závisí na kompexitě state transition).

### 5.3 Varianta C: STARK-based PoW (long-term, experimental)

**Princip:** Mining IS proving. Miner generuje STARK proof pro pseudonáhodnou execution trace.

```
program = random_program(block_hash)
trace = execute(program, scratchpad)
proof = stark_prove(trace)
// Difficulty = proof must start with N zero bits (as usual)
```

**Ultimátní ASIC resistance:** Prover musí implementovat general-purpose EVM-like execution → v podstatě CPU.

**Challenge:** STARK-friendly hashes (Poseidon, RPO) jsou ~10× pomalejší na CPU než Blake3/Keccak. Trade-off: lepší ASIC resistance, horší hashrate.

**Timeline:** 6-12 měsíců (R&D heavy).

---

## 6. Doporučený Implementation Roadmap

```
┌─────────────────────────────────────────────────────────────────┐
│                    ASIC RESISTANCE ROADMAP                       │
├─────────────┬──────────────┬────────────────────────────────────┤
│ Phase       │ Target       │ Changes                            │
├─────────────┼──────────────┼────────────────────────────────────┤
│ v3.0.1      │ ~80% resist  │ Scratchpad: 256 KiB, 4 pass,      │
│ (1-2 days)  │              │ 256 random reads                   │
│             │              │ Fork height activation             │
│             │              │ New test vector                    │
├─────────────┼──────────────┼────────────────────────────────────┤
│ v3.1.0      │ ~90% resist  │ Epoch-rotating NPU weights         │
│ (2-3 weeks) │              │ Variable MLP topology per epoch    │
│             │              │ Weight derivation: Blake3 keyed    │
│             │              │ Epoch length: 2016 blocks          │
├─────────────┼──────────────┼────────────────────────────────────┤
│ v3.2.0      │ Pool STARK   │ STARK proof per accepted share     │
│ (1-2 months)│              │ winterfell integration             │
│             │              │ Arithmetized Blake3 + Keccak       │
│             │              │ Optional — pools can opt-in        │
├─────────────┼──────────────┼────────────────────────────────────┤
│ v3.3.0      │ Light nodes  │ Recursive STARK block proofs       │
│ (3-6 months)│              │ Chain verification in O(log n)     │
│             │              │ Node can sync from single proof    │
├─────────────┼──────────────┼────────────────────────────────────┤
│ v4.0.0      │ ~95% resist  │ STARK-based PoW (optional path)    │
│ (6-12 mo)   │              │ Micro-VM execution traces          │
│             │              │ Full protocol redesign candidate   │
└─────────────┴──────────────┴────────────────────────────────────┘
```

---

## 7. Otevřené otázky

1. **Fork activation:** Jak elegantně aktivovat nové scratchpad parametry? Fixed height vs signaling?
2. **GPU kernel update:** OpenCL kernel `cosmic_harmony_deeksha.cl` hardcodes 64 KiB scratchpad. Po Tier 1 potřebuje update na 256 KiB.
3. **NPU rotace vs pool compatibility:** Pooly musí vědět aktuální epoch pro validaci. Potřebuje stratum extension.
4. **STARK proof bandwidth:** 200 KB per share × thousands of shares/sec = significant. Potřebujeme proof compression nebo aggregation.
5. **Testnet rollout:** Nové parametry testovat na testnetu min. 1 týden před mainnet activation.
6. **Backward compatibility:** Starší minery musí dostat jasnou chybovou hlášku, ne silent wrong hash.
7. **Hashrate recalibration:** Po Tier 1 (3-4× pokles hashrate) musí difficulty target odpovídat. Block time adjustment.

---

## 8. Reference

- [RandomX specification](https://github.com/tevador/RandomX/blob/master/doc/specs.md) — VM-based PoW design
- [winterfell](https://github.com/facebook/winterfell) — Rust STARK prover/verifier
- [StarkWare stwo](https://github.com/starkware-libs/stwo) — Circle STARK, next-gen
- [Ethash Yellow Paper](https://ethereum.github.io/yellowpaper/paper.pdf) — DAG-based PoW
- [CryptoNight](https://cryptonote.org/whitepaper.pdf) — 2 MiB scratchpad + AES
- [Poseidon hash](https://eprint.iacr.org/2019/458) — STARK-friendly hash function
- [ProgPoW EIP-1057](https://eips.ethereum.org/EIPS/eip-1057) — GPU-optimized PoW (never activated)

---

## 9. Závěr

Ekam Deeksha má solidní základ díky heterogenním primitivům (5 typů) a NPU mixing stepu. Hlavní slabina je malý scratchpad (64 KiB) a fixní NPU váhy.

**Nejefektivnější cesta k 90% ASIC resistance:**

1. **Tier 1 (okamžitě):** Zvětšit scratchpad na 256 KiB, 4 passy, 256 random reads → +15 bodů
2. **Tier 2 (2-3 týdny):** Epoch-rotating NPU weights → ASIC musí být programovatelný NPU → žádná výhoda vs CPU/GPU

**NPU je klíč.** ASIC designéři optimalizují fixní operace. Jakmile NPU váhy rotují per-epoch, ASIC se stává general-purpose inference enginem — a to je přesně to, co CPU/GPU už umí. Ekonomicky nesmyslné vyrábět dedikovaný chip.

**ZK-STARK je evoluce, ne revoluce.** Začít s pool verification (v3.2), pak recursive block proofs (v3.3). STARK-based PoW (v4.0) je long-term R&D target — ne urgentní.
