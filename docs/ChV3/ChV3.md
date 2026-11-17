# 🌀 Cosmic Harmony v3 — Master Plan

> **Verze**: 2.9.5 → 3.0  
> **Datum**: 15. února 2026  
> **Stav**: AKTIVNÍ — Fáze 1 ~98%, VRSC endianness fix (vrscfix12) + telemetrie (vrscfix13) + 1-thread výkonové optimalizace (vrscfix14) nasazeny; pool stale-drop guard + `clean_jobs` invalidace + vardiff password `d=0.01` (vrscfix15) nasazeno. **E2E accepted VRSC shares potvrzeny** (poslední snapshot: `shares_submitted=2`, `shares_accepted=2`, `shares_rejected=0`). P1 ASIC hardening (CPU scratchpad) implementován, rollout pending. **Nově: paralelní multi‑mining (současně ZION + Revenue) přes per‑miner skupiny + miner hint `g=`/`--group` + Varianta B (ZION + XMR paralelně v jednom `zion-miner`, RandomX FULL+HugePages, submit OK).**  
> **Cíl**: Plně funkční ASIC-rezistentní CH v3 s CPU+GPU streamy a BTC revenue

---

## 📊 Aktuální stav (15.2.2026)

### ✅ Co funguje
| Komponenta | Stav | Detail |
|-----------|------|--------|
| CH v3 CPU mining | ✅ OK | 4-fázový pipeline: Keccak→SHA3→GoldenMatrix→CosmicFusion |
| Pool stratum server | ✅ OK | XMRig-style stratum na `77.42.31.72:3333` |
| Stream Scheduler | ✅ OK | 50/25/25 model (ZION/Revenue/NCL), TimeSplit + PerMiner |
| Paralelní multi-mining | ✅ OK (pool+miner plumbing) | PerMiner skupiny + pin přes `g=`/`--group`; `ZION_SCHEDULER_PERMINER_MIN_MINERS=2` umožní paralelní režim i se 2 session |
| Stream Switch miner | ✅ OK | Miner přepíná CH ↔ RandomX dynamicky podle pool jobů |
| Revenue Proxy — XMR | ✅ Připojen | MoneroOcean RandomX: miner-side parallel mode (ZION+XMR), FULL+HugePages, seed_hash init + LE nonce submit (pool odpovědi `status=OK`) |
| Revenue Proxy — VRSC (Zcash protocol) | 🟡 98% — accepted běží, stabilita se měří | Nativní VerusHash ARM64 ✅, ZcashStratum proxy ✅, endianness opraveno (vrscfix12), near-hit telemetry (vrscfix13), pool-side rehash `match=true`; stale-drop guard + `clean_jobs` invalidace ✅; vardiff `d=0.01`; poslední snapshot: `accepted=2/2`, rejecty `0` |
| Revenue Proxy — ETC | ✅ Připojen | `etc.2miners.com:1010`, přijímá joby (760+) |
| Revenue Proxy — ERG | ✅ Připojen | `erg.2miners.com:8888`, přijímá joby (167+) |
| Revenue Proxy — RVN | ✅ Připojen | `rvn.2miners.com:6060`, přijímá joby (199+) |
| Profit Switcher | ✅ OK | XMR locked v CPU-only mode |
| RandomX JIT | ✅ OK | `get_recommended_flags()` → JIT+HARD_AES, 32 H/s (z 4.4 H/s) |
| Revenue Lock | ✅ OK | Miner drží ext-* job po dobu `ZION_REVENUE_LOCK_SECS` (default 120s) |
| Nonce Bookmarks | ✅ OK | Nonce pokračuje kde skončil po stream switch (CH→RX→CH) |
| Pool CPU-only mode | ✅ OK | `best_coin=XMR` v CPU-only mode (místo ERG) |
| Config mount | ✅ OK | `ch3_revenue_settings.json` namountován do pool kontejneru |
| Buyback Engine | ⚠️ Partial | Sleduje MoneroOcean balance (8.9e-5 XMR), ale DEX/CEX buyback TODO |
| Hashrate reporting | ✅ FIXED | Průběžný flush každých 1s / 4096 hashů |
| Desktop Agent | ✅ OK | Electron app, stream switch explicitně vypnut |
| Per-miner dedup | ✅ OK | Pool share cache klíč obsahuje wallet (ne globální) |

### ❌ Co nefunguje — KRITICKÉ
| Problém | Dopad | Priorita |
|---------|-------|----------|
| **GPU Cosmic Fusion ≠ CPU** | GPU kernel: 7 fusion rund + golden ratio mixing; CPU: 4 rundy + Keccak+XOR → **ODLIŠNÉ HASHE** | 🔴 P0 |
| **CH v3 memory-hard rollout** | CPU větev scratchpadu implementována; aktivace plánována od fork-height `50_000` | 🔴 P0 |
| **VRSC stability (reject rate)** | 1× upstream accepted share potvrzen; pool-side rehash `match=true`. Hlavní problém: stale submit → upstream `[21, "job not found"]` (job invalid po `clean_jobs`) | 🔴 P0 |
| **CUDA backend neexistuje** | NVIDIA GPU nepodporováno (jen OpenCL + Metal) | 🟡 P1 |
| **GPU CHv3 při memory-hard** | Do fork-height `50_000` běží legacy CHv3 (GPU funkční); od fork-height je v mineru aktivní automatický CPU fallback pro CHv3 (bezpečný režim do implementace GPU scratchpadu) | 🟡 P1 |
| **Buyback DEX/CEX TODO** | XMR→BTC konverze je manuální, automatická exekuce nefunguje | 🟡 P1 |
| **NXS/SHA3 merged mining disabled** | Potenciální free revenue stream není aktivní | 🟢 P2 |

---

## ⚙️ Paralelní multi‑mining (současně ZION + Revenue)

### Proč to děláme

TimeSplit režim (jeden stream pro všechny) je OK pro malé farmy, ale pro stabilní revenue (VRSC/XMR) chceme:

- ZION těžbu bez přerušení (stabilní nonce prostor, stabilní template)
- Revenue těžbu bez přepisů jobů (žádné přepínání zpět na ZION v nevhodný čas)

### Jak to funguje (bez nového protokolu)

- Každá miner instance = **samostatná stratum session**.
- Pool při přihlášení čte z passwordu **group hint**:
  - `g=zion|revenue|ncl` (nebo `group=...`)
- Scheduler přiřadí session do `MinerGroup` a pošle jí odpovídající job.

### Konfigurace poolu

```bash
# Default je 4 (kvůli 50/25/25 modelu). Pro paralelní režim se 2 instancemi:
export ZION_SCHEDULER_PERMINER_MIN_MINERS=2
```

### Konfigurace mineru

Miner umí poslat hint přes CLI:

```bash
--group zion
--group revenue
```

Miner to serializuje do passwordu jako `g=...`.

### Doporučený provozní pattern

- Spusť 2 kontejnery / 2 procesy mineru:
  - 1× `--group zion` (víc CPU threadů)
  - 1× `--group revenue` (méně CPU threadů)

Tím je paralelní multi‑mining „simultánní“ bez rizik spojených s multi‑job v jednom spojení.

### 🔄 Kompilováno, čeká na deploy
| Fix | Soubor | Detail |
|-----|--------|--------|
| Fork-aware GPU mineability testy | `miner/src/miner/mod.rs` | Přidány unit testy pro CHv3 boundary na `CHV3_MEMORY_HARD_FORK_HEIGHT` + regresní test, že ostatní algoritmy zachovaly původní GPU pravidla |
| GPU parity helper podle výšky | `cosmic-harmony/src/gpu/metal_miner.rs`, `cosmic-harmony/src/gpu/gpu_miner.rs` | Přidáno `parity_check_with_height(...)` proti CPU `cosmic_harmony_v3_with_height(...)` pro měření pre-fork i post-fork odchylky |
| Revenue Lock v XMRig handleru | `miner/src/stratum/mod.rs` | ROOT CAUSE — miner používá XMRig protokol, Revenue Lock chyběla v `"method": "job"` handleru |
| ext-* suffix fix | `miner/src/stratum/mod.rs` | `ext-xmr-48772489` dostávalo suffix `-cosmic_harmony` → poškozené job_id |
| Nonce bookmark stabilní klíč | `miner/src/miner/cpu.rs` | `bookmark_key()` extrahuje `h{height}-{algo}` (strip timestamp) |
| Revenue Lock info! logy | `miner/src/stratum/mod.rs` | debug! → info! pro viditelnost v produkci |

---

## 🎯 Architektura CH v3 — Cílový stav

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZION MINER (CPU + GPU)                       │
│                                                                 │
│  ┌──────────── CH v3 Pipeline ────────────────────────────┐    │
│  │                                                         │    │
│  │  Input (80B header + 8B nonce)                          │    │
│  │    │                                                    │    │
│  │    ▼                                                    │    │
│  │  Phase 1: Keccak-256 ─────── FREE → ETC merged mining  │    │
│  │    │                                                    │    │
│  │    ▼                                                    │    │
│  │  Phase 2: SHA3-512 ──────── FREE → NXS merged mining   │    │
│  │    │                                                    │    │
│  │    ▼                                                    │    │
│  │  Phase 3: Golden Matrix (8×8, φ-based, fixed-point)    │    │
│  │    │                                                    │    │
│  │    ▼                                                    │    │
│  │  ★ Phase 4: Memory-Hard Scratchpad (NEW — 256KB)  ★    │    │
│  │    │     ↳ RandomX-inspired memory-hard layer           │    │
│  │    │     ↳ Balloon Hashing / Argon2-like passes         │    │
│  │    │     ↳ DAG-lite: deterministic 256KB scratchpad     │    │
│  │    │     ↳ Cache-bound: sequential + random reads       │    │
│  │    │                                                    │    │
│  │    ▼                                                    │    │
│  │  Phase 5: Cosmic Fusion (unified CPU=GPU, 4 rounds)    │    │
│  │    │                                                    │    │
│  │    ▼                                                    │    │
│  │  Output: 32B ZION Hash                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────── Stream Scheduler (50/25/25) ───────────────┐    │
│  │                                                         │    │
│  │  50% ZION ──── CH v3 pipeline → ZION block rewards     │    │
│  │  25% Revenue ─ RandomX/ERG/RVN → external pools → BTC  │    │
│  │  25% NCL ───── AI inference → NCL token rewards        │    │
│  │  FREE ──────── ETC (Keccak) + NXS (SHA3) merged mining │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐   ┌────────────────┐   ┌──────────────┐
   │  ZION Pool   │   │ Revenue Proxy  │   │ NCL Gateway  │
   │  (stratum)   │   │ (MoneroOcean,  │   │ (AI tasks)   │
   │              │   │  2miners, etc) │   │              │
   └──────┬──────┘   └───────┬────────┘   └──────┬───────┘
          │                   │                    │
          ▼                   ▼                    ▼
   ZION Blockchain    XMR→BTC Buyback       NCL Rewards
```

---

## 🔧 Fáze vývoje

### FÁZE 1: Revenue Fix — BTC příjem (1-2 dny) ✅ HOTOVO (90%)
> **Cíl**: Revenue stream musí fungovat → reálné XMR→BTC příjmy
> **Stav**: Všechny kritické bugy nalezeny a opraveny. Čeká na finální deploy + e2e test.

#### 1.1 xmrig do Docker kontejneru ✅
```
HOTOVO: xmrig namountován jako volume:
  -v /usr/local/bin/xmrig:/usr/local/bin/xmrig:ro
Poznámka: GLIBC mismatch na bookworm (2.36 vs 2.38) → server-side mining
          nahrazen miner-side stream switch (miner sám těží RandomX)
```

#### 1.2 Volume mount xmrig (rychlý hotfix) ✅
```
HOTOVO: Viz 1.1 — namountováno přímo v docker run command
```

#### 1.3 Miner stream switch pro Revenue fázi ✅
```
HOTOVO v cpu.rs:
  - Miner detekuje ext-xmr-* job → přepne na Algorithm::RandomX
  - RandomX JIT: get_recommended_flags() → LIGHT+JIT+HARD_AES (32 H/s)
  - Volitelný Full Mode: ZION_RANDOMX_FULL=1 (2GB RAM)
  - seed_hash z pool jobu → proper RandomX dataset init
  - ZION_ENABLE_STREAM_SWITCH=1 env var pro opt-in

Opravené bugy:
  a) Revenue Lock v XMRig "job" handleru (stratum/mod.rs)
     ROOT CAUSE: Miner používá XMRig protokol ("method":"job"),
     ale Revenue Lock existovala jen v "mining.notify" handleru!
     → Miner okamžitě přepnul zpět na CH při dalším template update.
     FIX: Přidán identický Revenue Lock do "job" handleru.
     
  b) ext-* suffix corruption (stratum/mod.rs)
     BUG: "ext-xmr-48772489" → split 3 parts → parts[2] all digits
     → is_timestamp_base=true → appends "-cosmic_harmony" suffix
     → "ext-xmr-48772489-cosmic_harmony" (poškozený job_id!)
     FIX: Skip suffix pro job_id.starts_with("ext-")
     
  c) Nonce bookmark stability (cpu.rs)
     BUG: bookmark_key používalo plné job_id včetně měnícího se timestamp
     → po návratu na CH nonce vždy od 0 → duplicate shares
     FIX: bookmark_key() extrahuje stabilní klíč:
       CH: "h{height}-{prev8}-{algo}" (strip timestamp)
       ext: "ext-{coin}" (strip pool-specific suffix)
     
  d) Pool best_coin default (stream_scheduler.rs)
     BUG: best_coin default "ERG" → pool broadcastoval ETC (Ethash) joby
     místo XMR (RandomX) v Revenue fázi
     FIX: CPU-only mode → best_coin = "xmr"
     
  e) Per-miner share dedup (shares/validator.rs)
     BUG: Globální dedup cache bez miner wallet → false "Duplicate share"
     mezi různými minery
     FIX: Cache key = (result_hex, wallet)
```

#### 1.4 Pool share routing ověření ✅
```
OVĚŘENO: ext-* prefix detection → ShareRoute::External
         → revenue_proxy.submit_share() → MoneroOcean
Config mount: -v /root/ch3_revenue_settings.json:/config/ch3_revenue_settings.json:ro
XMR Login: "[XMR] ✅ CN Login successful"
```

#### 1.5 End-to-end test 🔄
```
ZBÝVÁ: Deploy finálních fixů (Revenue Lock XMRig + suffix + bookmark)
       → Ověřit shares accepted na MoneroOcean dashboard
       → XMR balance roste
       → Buyback engine detekuje nový balance

Odhad: Při 32 H/s a diff 10000 → ~5 min per share.
       Revenue Lock 120s by měl stačit pro min. 1 share.
       Pokud ne → zvýšit na 300s.
```

**Výsledek Fáze 1**: 🔄 90% hotovo — kód kompilován, čeká na deploy + e2e test

---

### FÁZE 2: CPU ↔ GPU Parita (2-3 dny) 🔴
> **Cíl**: CPU a GPU MUSÍ produkovat identické hashe pro stejný vstup

#### 2.1 Audit Cosmic Fusion mismatch
```
Problém: GPU kernel (opencl_kernel.rs, metal_shader.rs) má 7 fusion rund
         s golden ratio mixing + cross-lane mixing + XOR fold.
         CPU (algorithms_opt.rs) má 4 rundy s Keccak256 + XOR mask.
         → GPU a CPU produkují RŮZNÉ hashe!

Soubory:
  - cosmic-harmony/src/gpu/opencl_kernel.rs   (L265+ fusion)
  - cosmic-harmony/src/gpu/metal_shader.rs    (fusion function)
  - cosmic-harmony/src/algorithms_opt.rs      (L72+ cosmic_fusion)

Řešení: Sjednotit na CPU implementaci (4 rundy, Keccak+XOR)
         NEBO navrhnout novou unified fusion a implementovat 1:1 na obou
```

#### 2.2 Deterministický test suite
```
Soubor: cosmic-harmony/tests/cpu_gpu_parity.rs (NOVÝ)
Test: 1000 náhodných noncí → CPU hash vs GPU hash
      Tolerance: NULOVÁ (musí být bit-perfect identické)
      Pokrytí: Všechny 4 fáze zvlášť + celý pipeline
```

#### 2.3 Golden Matrix fixed-point ověření
```
Soubor: cosmic-harmony/src/algorithms_opt.rs (PHI_POWERS_FP)
Problém: u128 akumulace s >> 32 shift musí dávat identický výsledek
         na CPU (Rust u128) i GPU (emulovaný u64 hi:lo)
Test: Explicitní edge-case testy pro overflow/underflow
```

#### 2.4 OpenCL kernel oprava
```
Soubor: cosmic-harmony/src/gpu/opencl_kernel.rs
Změna: Nahradit cosmic_fusion_gpu() implementací odpovídající CPU:
       - 4 rundy (ne 7)
       - Keccak-256 per runda (ne golden ratio mixing)
       - Identický COSMIC_XOR_MASK
       - Identický finální SHA3-512 + truncate
```

#### 2.5 Metal shader oprava
```
Soubor: cosmic-harmony/src/gpu/metal_shader.rs
Změna: Identická oprava jako OpenCL — sjednotit s CPU fusion
```

**Výsledek Fáze 2**: ✅ CPU hash == GPU hash pro libovolný vstup (bit-perfect)

---

### FÁZE 3: ASIC Resistance — Memory-Hard Layer (5-7 dní) 🔴
> **Cíl**: CH v3 MUSÍ být neefektivní pro ASIC implementaci

#### 3.1 Problém: Současný stav
```
CH v3 dnes:
  - Keccak-256: Standardní hash, ASIC existují (Antminer E9)
  - SHA3-512: Standardní hash, ASIC snadno
  - Golden Matrix: 8×8 matice, <512B paměť, ASIC triviální
  - Cosmic Fusion: 4× Keccak + XOR, žádná memory hardness

Celkový RAM footprint: < 1 KB
ASIC výhoda: 100-1000× vs CPU/GPU
→ CH v3 v současné podobě NENÍ ASIC-rezistentní!
```

#### 3.2 Návrh: Memory-Hard Scratchpad (Phase 4 — nová)
```
Inspirace: RandomX (2MB L3 cache), Argon2 (memory-hard), Balloon Hashing

Nová Phase 4 — "Cosmic Scratchpad":
  - Velikost: 256 KB scratchpad (vejde se do L2 cache CPU i GPU VRAM)
  - Inicializace: Golden Matrix výstup expandován do 256KB pomocí
                   opakovaného Keccak-256 s inkrementujícím indexem
  - Random reads: 1024 náhodných čtení ze scratchpadu
                   (adresa = hash předchozího čtení % scratchpad_size)
  - Sequential passes: 4 průchody celým scratchpadem
                        s forward/backward závislostmi
  - Finální mix: Poslední 64B scratchpadu → Phase 5 (Cosmic Fusion)

Proč 256KB:
  - CPU L2 cache: 256KB-1MB → efektivní
  - GPU shared memory: 48-128KB per SM → potřebuje spilling do global
  - ASIC: Potřebuje 256KB SRAM per hash unit → drahé na čip

Soubory:
  cosmic-harmony/src/scratchpad.rs       (NOVÝ — core scratchpad logic)
  cosmic-harmony/src/algorithms_opt.rs   (integrace do pipeline)
  cosmic-harmony/src/gpu/opencl_kernel.rs (GPU scratchpad kernel)
  cosmic-harmony/src/gpu/metal_shader.rs  (Metal scratchpad)
```

#### 3.3 Alternativa: Dynamic Program Execution (ProgPow-style)
```
Místo statického pipeline generovat per-block "micro-program":
  - Block header seed → deterministic PRNG
  - PRNG generuje sekvenci 32 operací z {ADD, XOR, MUL, ROT, LOOKUP}
  - Každý miner musí "interpretovat" program → ASIC potřebuje ALU, ne fixní pipeline
  
Výhoda: Nový "program" každých 50 bloků → ASIC nemůže optimalizovat
Nevýhoda: Komplexnější implementace, těžší verifikace
```

#### 3.4 Implementační plán scratchpadu
```
Krok 1: scratchpad.rs — pure Rust implementace
        - scratchpad_init(seed: &[u8; 64]) → [u8; 262144]
        - scratchpad_random_reads(pad: &[u8], rounds: usize) → [u8; 64]
        - scratchpad_sequential_pass(pad: &mut [u8], direction: Forward|Backward)
        - TESTY: Determinismus, výkon benchmarks

Krok 2: Integrace do pipeline
        - Mezi Phase 3 (Golden Matrix) a Phase 5 (Cosmic Fusion)
        - cosmic_harmony_v3() v lib.rs: přidat scratchpad volání
        - Batch verze: sdílení scratchpadu kde možné

Krok 3: GPU kernel
        - OpenCL: __local memory pro scratchpad (48KB limit!)
        - Řešení: Rozdělit 256KB na 4× 64KB bloky, zpracovat sekvenčně
        - Metal: threadgroup memory (32KB limit) → stejný přístup
        - ALTERNATIVA: Snížit scratchpad na 64KB pro GPU kompatibilitu
                        nebo ponechat 256KB a nechat GPU používat global memory
                        (pomalejší, ale zachovává ASIC resistance)

Krok 4: Testnet hard fork
        - Nový block height pro aktivaci memory-hard CH v3
        - Staré bloky: původní CH v3 (bez scratchpadu)
        - Nové bloky: CH v3 + scratchpad
        - Difficulty adjustment pro nový hashrate
```

#### 3.5 ASIC Resistance metriky
```
Cílové metriky:
  - Memory bandwidth: ≥ 10 GB/s per hash unit
  - Memory footprint: ≥ 256 KB per hash unit
  - ASIC vs GPU advantage: ≤ 2× (dnes je 100-1000×)
  - ASIC vs CPU advantage: ≤ 5× (dnes je 1000-10000×)
  
Benchmark: Porovnání H/s per Watt
  - CPU (AMD Ryzen 9): baseline
  - GPU (RTX 4090): ≤ 10× CPU
  - Teoretický ASIC: ≤ 5× GPU
```

**Výsledek Fáze 3**: ✅ CH v3 + Memory-Hard Scratchpad, ASIC neefektivní

---

### FÁZE 4: GPU Streams — Revenue z GPU (3-5 dní) 🟡
> **Cíl**: GPU minery těží CH v3 pro ZION + ETC/ERG/RVN v Revenue fázi

#### 4.1 GPU Stream Switch
```
Soubory:
  miner/src/miner/gpu.rs          (GPU mining loop)
  miner/src/miner/stream.rs       (StreamState pro GPU)

Změna: GPU miner musí umět přepnout algoritmus per stream:
  - ZION fáze: CH v3 OpenCL/Metal kernel
  - Revenue fáze (ETC): Ethash kernel (existující OpenCL implementace)
  - Revenue fáze (ERG): Autolykos kernel (Metal shader existuje!)
  - Revenue fáze (RVN): KawPow kernel (potřeba implementovat)
```

#### 4.2 Ethash GPU mining
```
Stav: OpenCL kernel pro Ethash NEEXISTUJE v cosmic-harmony/src/gpu/
Potřeba: Buď implementovat vlastní, nebo integrovat ethash-opencl z ethminer
         (MIT licence, dobře otestovaný)

Soubory:
  cosmic-harmony/src/gpu/ethash_kernel.rs     (NOVÝ)
  cosmic-harmony/src/gpu/ethash_opencl.rs     (NOVÝ)
  
Alternativa: Pro ETC používat merged mining z Keccak-256 vedlejšího produktu
             (Phase 1 CH v3 pipeline) → NULOVÉ náklady na compute!
```

#### 4.3 Metal shaders pro Revenue coiny
```
Stav: Metal ETC (etc_metal.rs) a ERG (erg_metal.rs) existují!
      Ale nejsou integrovány do stream switch pipeline.

Soubory:
  cosmic-harmony/src/gpu/etc_metal.rs    (existuje, 459 řádků)
  cosmic-harmony/src/gpu/erg_metal.rs    (existuje, 462 řádků)
  miner/src/miner/gpu.rs                (integrace)
```

#### 4.4 CUDA backend (P2)
```
Stav: GpuBackend::Cuda existuje v enumu, ale žádná implementace.
Priorita: P2 — většina ZION minerů bude na NVIDIA GPU
Řešení:
  Option A: CUDA kernely (custom) — nejrychlejší, nejvíc práce
  Option B: OpenCL na NVIDIA (funguje, ale pomalejší ~15-20%)
  Option C: Vulkan Compute (cross-platform, budoucnost)

Doporučení: Začít s OpenCL na NVIDIA (Option B), 
            CUDA implementovat jako optimalizaci v Fázi 6
```

**Výsledek Fáze 4**: ✅ GPU těží CH v3 + ETC/ERG/RVN per stream phase

---

### FÁZE 5: Merged Mining — Free Revenue (2-3 dny) 🟡
> **Cíl**: Vedlejší produkty CH v3 pipeline generují příjem zdarma

#### 5.1 ETC Merged Mining (Keccak-256 byproduct)
```
Princip: Phase 1 CH v3 pipeline počítá Keccak-256.
         Stejný hash lze submitnout na ETC pool (Keccak-based PoW).
         → NULOVÉ extra compute náklady!

Implementace:
  Soubor: miner/src/miner/cpu.rs
  Změna: Po Phase 1, extrahovat Keccak-256 intermediate
         Pokud splňuje ETC difficulty → submitnout na ETC pool
         
  Soubor: pool/src/merged_mining.rs (NOVÝ)
         - MergedMiningManager: přijímá intermediate hashe z minerů
         - Forwarding na ETC pool přes Revenue Proxy
         
Problém: ETC aktuálně nepoužívá čistý Keccak-256 ale Ethash (Keccak + DAG)
         → Merged mining funguje pouze pokud ETC přejde na pure Keccak
         → ALTERNATIVA: Submitovat Keccak intermediate na pool,
           pool počítá Ethash expansion lokálně
```

#### 5.2 NXS/SHA3 Merged Mining
```
Princip: Phase 2 počítá SHA3-512.
         Nexus (NXS) PoW je SHA3-based.
         
Stav: Disabled v config (target_share: 0.00)
Implementace: Analogická k ETC merged mining
```

#### 5.3 Intermediate hash export API
```
Soubor: cosmic-harmony/src/algorithms_opt.rs
Nové API (bez změny konsenzu / default hashe):
  pub struct Chv3Intermediates {
      pub keccak256: Hash32,
      pub sha3_512: Hash64,
      pub golden_matrix: Hash64,
      pub memory_hard_enabled: bool,
  }

  pub fn cosmic_harmony_v3_with_height_intermediates(
      block_header: &[u8],
      nonce: u64,
      height: u64,
  ) -> (Hash32, Chv3Intermediates)

Bezpečné runtime override pro staged testing:
  - ZION_CHV3_MEMORY_HARD_FORCE=1    (vynutí scratchpad)
  - ZION_CHV3_MEMORY_HARD_DISABLE=1  (vynutí legacy bez scratchpadu)

Toto umožní pool serveru extrahovat merged mining shares
bez duplikace práce.
```

**Výsledek Fáze 5**: ✅ ETC+NXS revenue z vedlejších produktů CH v3

---

### FÁZE 6: Desktop Agent Integration (2-3 dny) 🟡
> **Cíl**: Electron desktop app plně podporuje streamy + GPU

#### 6.1 Stream switch v desktop agentovi
```
Soubor: desktop-agent/src/main.js
Změna: 
  - Povolit ZION_ENABLE_STREAM_SWITCH=1 po ověření stabilitu
  - UI indikátor aktuální fáze (ZION/Revenue/NCL)
  - Hashrate per stream (ne jen celkový)
  - Revenue tracking v dashboard (XMR earned, BTC converted)
```

#### 6.2 GPU detekce a konfigurace
```
Soubor: desktop-agent/src/main.js
Změna:
  - Detekce GPU (OpenCL enumerate / Metal availability)
  - UI: GPU on/off toggle
  - GPU hashrate zobrazení
  - Výběr GPU device (multi-GPU setup)
```

#### 6.3 Revenue dashboard
```
Soubor: desktop-agent/src/renderer/ (nová sekce)
Zobrazení:
  - Aktuální stream phase + timer
  - ZION mined (bloky + odměny)
  - XMR earned (MoneroOcean balance)
  - ETC earned (merged mining)
  - BTC converted (buyback engine)
  - 24h/7d/30d revenue grafy
```

**Výsledek Fáze 6**: ✅ Desktop miner s plným stream UI a GPU podporou

---

### FÁZE 7: Mainnet Preparation (5-7 dní) 🟢
> **Cíl**: Produkčně připravený systém pro mainnet launch

#### 7.1 Hard fork plan (Memory-Hard aktivace)
```
- Block height X: Aktivace scratchpad (Phase 4)
- 2 týdny předem: Oznámení, binárky, testování
- Difficulty adjustment: Recalibrace pro nový hashrate
- Fallback: Emergency switch zpět na CH v3 bez scratchpadu
```

#### 7.2 Security audit
```
- Scratchpad implementace: overflow/underflow, determinismus
- GPU parity: bit-perfect shoda CPU=GPU
- Stream scheduler: timing fairness, share stealing prevention
- Revenue proxy: share validation, double-submit prevention
- Stratum protocol: injection attacks, malformed job handling
```

#### 7.3 Performance optimization
```
- SIMD: AVX2/NEON implementace scratchpadu (2-4× speedup)
- Batch mining: Pipeline overlap (Phase 1-3 batch → Phase 4 per-nonce)
- Memory pool: Pre-allocated scratchpad buffers
- GPU occupancy: Tune work group size per device
```

#### 7.4 Monitoring & observability
```
- Prometheus metriky: hashrate per algo, shares per stream, revenue per coin
- Grafana dashboards: Stream allocation, Revenue tracking, GPU utilization
- Alerting: Revenue drop, external pool disconnect, hash mismatch
```

---

## 📅 Časový plán

```
Týden 1 (12-16.2.2026):
  ├── FÁZE 1: Revenue Fix ────────────────── [█████████░]  90%  ← DEPLOY ZBÝVÁ
  └── FÁZE 2: CPU↔GPU Parita ────────────── [░░░░░░░░░░]   0%  ← DALŠÍ

Týden 2 (17-23.2.2026):
  ├── FÁZE 2: CPU↔GPU Parita ────────────── [██████████] 100%
  └── FÁZE 3: ASIC Resistance ───────────── [██████░░░░]  60%

Týden 3 (24.2-2.3.2026):
  ├── FÁZE 3: ASIC Resistance (dokončení) ─ [██████████] 100%
  └── FÁZE 4: GPU Streams ───────────────── [████░░░░░░]  40%

Týden 4 (3-9.3.2026):
  ├── FÁZE 4: GPU Streams (dokončení) ───── [██████████] 100%
  └── FÁZE 5: Merged Mining ─────────────── [██████████] 100%

Týden 5 (10-16.3.2026):
  ├── FÁZE 6: Desktop Agent ─────────────── [██████████] 100%
  └── FÁZE 7: Mainnet Prep (start) ──────── [████░░░░░░]  40%

Týden 6 (17-23.3.2026):
  └── FÁZE 7: Mainnet Prep (dokončení) ──── [██████████] 100%
```

---

## 🔑 Klíčové soubory

### Cosmic Harmony Algorithm
| Soubor | Účel | Stav |
|--------|------|------|
| `cosmic-harmony/src/lib.rs` | Hlavní CH v3 pipeline | ✅ Funguje |
| `cosmic-harmony/src/algorithms_opt.rs` | Optimalizované Phase 1-4 | ✅ Funguje |
| `cosmic-harmony/src/scratchpad.rs` | **Memory-hard scratchpad** | 🔴 NOVÝ |
| `cosmic-harmony/src/gpu/opencl_kernel.rs` | OpenCL CH v3 kernel | ⚠️ Fusion mismatch |
| `cosmic-harmony/src/gpu/metal_shader.rs` | Metal CH v3 shader | ⚠️ Fusion mismatch |
| `cosmic-harmony/src/gpu/opencl_miner.rs` | OpenCL runtime | ✅ Funguje |
| `cosmic-harmony/src/gpu/metal_miner.rs` | Metal runtime | ✅ Funguje |
| `cosmic-harmony/src/gpu/etc_metal.rs` | Metal ETC shader | ✅ Existuje |
| `cosmic-harmony/src/gpu/erg_metal.rs` | Metal ERG shader | ✅ Existuje |

### Miner
| Soubor | Účel | Stav |
|--------|------|------|
| `miner/src/miner/cpu.rs` | CPU mining loop + stream switch | ✅ Fixed (nonce bookmarks, stream switch, stable bookmark_key) |
| `miner/src/miner/gpu.rs` | GPU mining loop | ⚠️ Potřeba stream switch |
| `miner/src/miner/stream.rs` | Stream state tracking | ✅ Funguje |
| `miner/src/miner/stats.rs` | Hashrate/metriky | ✅ Funguje |
| `miner/src/stratum/mod.rs` | Pool komunikace + Revenue Lock | ✅ Fixed (XMRig Revenue Lock, ext-* suffix, info logging) |

### Pool
| Soubor | Účel | Stav |
|--------|------|------|
| `pool/src/main.rs` | Pool server entry | ✅ Funguje |
| `pool/src/stream_scheduler.rs` | 50/25/25 scheduler | ✅ Fixed (CPU-only XMR default) |
| `pool/src/revenue_proxy.rs` | Externí pool klienti | ✅ Připojeny (XMR, ETC, ERG, RVN) |
| `pool/src/pool_external_miner.rs` | xmrig management | ⚠️ Nahrazeno miner-side stream switch |
| `pool/src/stratum.rs` | Stratum server | ✅ Funguje |
| `pool/src/shares/validator.rs` | Share validace + dedup | ✅ Fixed (per-miner dedup key) |
| `pool/src/merged_mining.rs` | **Merged mining mgr** | 🔴 NOVÝ |

### Core
| Soubor | Účel | Stav |
|--------|------|------|
| `core/src/algorithms/randomx.rs` | RandomX hasher | ✅ Fixed (JIT+HARD_AES, optional Full Mode) |
| `core/Cargo.toml` | Core dependencies | ✅ Updated (log 0.4 added) |

### Desktop Agent
| Soubor | Účel | Stav |
|--------|------|------|
| `desktop-agent/src/main.js` | Electron main process | ✅ Fixed (env var) |
| `desktop-agent/src/renderer/` | UI komponenty | ⚠️ Potřeba revenue UI |

### Docker / Deploy
| Soubor | Účel | Stav |
|--------|------|------|
| `docker/Dockerfile.pool` | Pool image | ✅ xmrig přes volume mount |
| `docker/docker-compose.testnet.yml` | Testnet stack | ✅ Funguje s env vars |
| `config/ch3_revenue_settings.json` | Revenue config | ✅ Namountován + XMR/ETC/ERG/RVN |

### Deployed Docker Images
| Image | Tag | Obsah |
|-------|-----|-------|
| `zion-miner` | `2.9.5-v2` | JIT RandomX, stream switch, nonce bookmarks |
| `zion-miner` | `2.9.5-vrscfix14` | **AKTUÁLNÍ** — VRSC 1-thread výkonové optimalizace, cache blob/target, rychlejší nonceSpace update, early-break při změně jobu |
| `zion-pool` | `2.9.5-v3` | CPU-only XMR default, config mount |
| `zion-pool` | `2.9.5-vrscfix15` | **AKTUÁLNÍ** — ZcashStratum VRSC proxy, pool-side rehash diag (`match=true`), stale-drop guard + `clean_jobs` invalidace, `ZION_ZC_PASS` (default `d=0.01`) |

---

## 💰 Revenue Model — Cílový stav

```
┌─────────────────────────────────────────────────────────┐
│                  Revenue Streams (per miner)             │
│                                                          │
│  Stream 1: ZION Block Rewards ──────── 50% compute      │
│    → ZION coins (block reward + tx fees)                │
│    → Hodnota roste s adopcí sítě                        │
│                                                          │
│  Stream 2: External Revenue ─────────── 25% compute     │
│    → XMR via MoneroOcean (profit-switch)                │
│    → Auto-convert XMR → BTC via buyback engine          │
│    → BTC → ZION buyback na DEX                          │
│    → 100% do DAO treasury (burn_pct: 0)                 │
│                                                          │
│  Stream 3: NCL AI ──────────────────── 25% compute      │
│    → AI inference pro síť                               │
│    → NCL token rewards                                  │
│                                                          │
│  Stream 4: ETC Merged (FREE) ───────── 0% extra compute │
│    → Keccak-256 byproduct z CH v3 Phase 1               │
│    → ETC coins → auto-convert → BTC → ZION buyback     │
│                                                          │
│  Stream 5: NXS Merged (FREE) ───────── 0% extra compute │
│    → SHA3-512 byproduct z CH v3 Phase 2                 │
│    → NXS coins → auto-convert → BTC → ZION buyback     │
│                                                          │
│  Fees:                                                   │
│    Byproducts (ETC/NXS): 5%                             │
│    Revenue (multi-algo): 2%                              │
│    NCL (AI tasks): 10%                                   │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ Progress log

### 📅 12.2.2026 — Session 1: Infrastruktura + Revenue Pipeline
1. ✅ **Pool RPC port fix** — Core má rpc na 8334, p2p na 8444 (prohozené vs compose)
2. ✅ **Redis heslo** — Pool měl špatné heslo (`zion_testnet_2026` → `Zion_Redis_Hel_2026_xK9mP`)
3. ✅ **xmrig volume mount** — `/usr/local/bin/xmrig` namountován do pool kontejneru
4. ✅ **Miner→Pool spojení** — Opraveno DNS (`pool:3333` → `zion-pool:3333`)
5. ✅ **Shares accepted** — Pool přijímá CH shares (diff 500K, 217K)
6. ✅ **Stream Scheduler broadcasting** — ZION + Revenue:XMR joby broadcastovány k 1 mineru
7. ✅ **Revenue Lock timeout** — Snížen z 1200s (20 min) na 120s (2 min), konfigurovatelný přes `ZION_REVENUE_LOCK_SECS`
8. ✅ **Pool hashrate** — 1.09 MH/s pool hashrate, blockchain connected, height 2266

### 📅 12-13.2.2026 — Session 2: RandomX JIT + Revenue Lock
9. ✅ **Stream Switch funguje** — Miner přepíná CH ↔ RandomX podle TimeSplit signálu
10. ✅ **RandomX JIT upgrade** — `FLAG_DEFAULT` → `get_recommended_flags()` (auto JIT+HARD_AES)
    - Výsledek: 4.4 H/s → 32 H/s (7× boost na ARM64 light mode)
    - Volitelný Full Mode: `ZION_RANDOMX_FULL=1` (2GB RAM, potenciálně 200+ H/s)
11. ✅ **Nonce bookmark fix** — Při stream switch (CH→RX→CH) nonce pokračuje kde skončil
    - `bookmark_key()`: CH → `h{height}-{prev8}-{algo}`, ext → `ext-{coin}`
    - Bez fix: nonce reset→0, duplicate shary
12. ✅ **Pool per-miner dedup** — Cache key nyní obsahuje miner_id
    - Bez fix: všichni mineři sdílí nonce space → false "Duplicate share"
13. ✅ **Revenue Lock env** — `ZION_REVENUE_LOCK_SECS=120` (konfigurovatelný)
14. ✅ **Pool best_coin=XMR** — CPU-only mode: default "xmr" místo "ERG" v StreamScheduler
    - Bez fix: pool broadcastoval ETC (Ethash) joby místo XMR (RandomX)
15. ✅ **Config mount** — `ch3_revenue_settings.json` namountován do pool kontejneru
    - Mount: `-v /root/ch3_revenue_settings.json:/config/ch3_revenue_settings.json:ro`
    - Výsledek: `[XMR] ✅ CN Login successful` na MoneroOcean
16. ✅ **Revenue Lock v XMRig handleru** (kompilováno, ne-deployed)
    - ROOT CAUSE: Miner používá XMRig protokol (`"method":"job"`), ale Revenue Lock
      existovala jen v `mining.notify` handleru → miner okamžitě přepínal zpět na CH
    - FIX: Přidán Revenue Lock do `"method":"job"` + `getjob` response handleru
17. ✅ **ext-* suffix fix** (kompilováno, ne-deployed)
    - BUG: `ext-xmr-48772489` → parts[2] all digits → `is_timestamp_base=true`
      → appends `-cosmic_harmony` → poškozené job_id
    - FIX: `if !raw_job_id.starts_with("ext-")` guard na suffix logiku
18. ✅ **Revenue Lock info! logy** (kompilováno, ne-deployed)
    - Všechny Revenue Lock logy změněny z `debug!` na `info!` pro viditelnost

### 📅 15.2.2026 — Session 3: VRSC Deep Debug (vrscfix8 → vrscfix13)
19. ✅ **ROOT CAUSE #1 — NonceSpace embedding** (vrscfix8)
    - PBaaS v7+ vyžaduje `extranonce1 || nonce2` v solution bytes `sol[1329..1344]`
    - Pool i miner toto nevkládaly → `"invalid solution, pool nonce missing"`
    - FIX: Miner zapisuje nonceSpace na `buf[1472..1487]`, pool embeduje do solution
20. ✅ **ROOT CAUSE #2 — Špatný VerusHash variant** (vrscfix10)
    - FFI wrapper volal `Hash()` místo `Reset().Write().Finalize2b()` (v2b2 streaming hash)
    - FIX: Přepis `ffi_wrapper.cpp` na `CVerusHashV2(SOLUTION_VERUSHHASH_V2_2).Reset().Write().Finalize2b()`
21. ✅ **ROOT CAUSE #3 — Chybějící ZION_ENABLE_STREAM_SWITCH** (vrscfix10)
    - Miner ignoroval revenue VRSC joby bez tohoto env flagu
    - FIX: Přidáno do Docker compose
22. ✅ **ROOT CAUSE #4 — Chybějící --debug flag** (vrscfix10)
    - DEBUG-level logy nebyly viditelné
    - FIX: Přidáno do Docker CMD
23. ✅ **ROOT CAUSE #5 — Endianness bug v meets_target()** (vrscfix12) — **HLAVNÍ PRŮLOM**
    - `Finalize2b()` vrací hash v LE (byte[0]=LSB)
    - Pool target je BE hex string (např. `"0000004000...00"`)
    - Miner porovnával LE hash přímo s BE target → false-positive shares
    - Pool: `bignum.fromBuffer(hash, {endian:'little'})` → LE hash = obrovské číslo → low diff
    - FIX: Reverse `hash[31-i]` → `hash_be`, pak lexikografické srovnání s BE target
24. ✅ **ARM64 VerusHash ověření** — `test_hash.cpp` referenční vektory
    - v2b: ✅ MATCH, v2b1: ✅ MATCH, v2b2: ⚠️ zaznamenáno (žádný oficiální ref.)
25. ✅ **Pool-side kód plně analyzován** (veruscoin/node-stratum-pool + VerusCoin/verushash-node)
    - ClearNonCanonicalData: IDENTICKÉ
    - Buffer layout (1487B): IDENTICKÉ
    - Share diff: `bignum.fromBuffer(hash, {endian:'little'})` → `diff1 / hashNum`
    - Prahové odmítnutí: `shareDiff / difficulty < 0.99` → `[23, "low difficulty share"]`
26. ✅ **E2E potvrzeno** — 1× upstream accepted VRSC share
  - Pool-side rehash diagnostika potvrzuje `miner_hash == pool_hash` (`match=true`)
  - Zbývající problém: rejecty `[21, "job not found"]` = stale job po `clean_jobs`

### 📅 15.2.2026 — Session 4: VRSC výkon + stabilita (vrscfix14/15)
27. ✅ **1-thread optimalizace mineru** (vrscfix14)
  - Cache blob/target per job + rychlejší update nonceSpace + early-break při změně jobu → méně stale submitů
28. ✅ **Pool stale-drop guard + vardiff** (vrscfix15)
  - Drop stale job_id po `clean_jobs` + `ZION_ZC_PASS=d=0.01` pro vyšší share frekvenci
29. ✅ **E2E snapshot (po restartu)**
  - Upstream VRSC: `shares_submitted=2`, `shares_accepted=2`, `shares_rejected=0`

### ❓ Nalezené problémy (vyřešené):
- ~~Core porty prohozené~~ → Fixed (8334 RPC, 8444 P2P)
- ~~xmrig GLIBC mismatch~~ → Obejito miner-side stream switch
- ~~Duplicate shares~~ → Fixed (nonce bookmarks + per-miner dedup)
- ~~P2P Security blacklist~~ → Fixed (Docker IPs whitelisted)
- ~~Revenue Lock nefunguje~~ → ROOT CAUSE: XMRig protokol vs mining.notify → Fixed
- ~~ext-* suffix corruption~~ → Fixed (skip suffix pro ext-* jobs)
- ~~Pool broadcastuje ETC místo XMR~~ → Fixed (CPU-only best_coin="xmr")

### 📌 TODO pro dokončení Fáze 1:
- [x] Deploy finálních CH v3+VRSC fixů do repo (`main`) + build validace
- [x] Doplnit VRSC wallet do runtime configu (`config/ch3_revenue_settings.json`)
- [x] Přidat `ZION_VRSC_WALLET` + `ZION_CPU_REVENUE_COIN=VRSC` do `docker-compose` (mainnet/testnet)
- [x] Aplikovat VRSC env na běžícím serveru (pool restart)
- [x] Opravit `invalid solution size` → padding solution na 1344B + varint prefix (vrscfix7)
- [x] Opravit `pool nonce missing` → NonceSpace embedding (vrscfix8)
- [x] Opravit `low difficulty share` — špatný VerusHash variant `Hash()` → `Reset().Write().Finalize2b()` (vrscfix10)
- [x] Opravit `low difficulty share` — endianness bug v `meets_target()` LE→BE reversal (vrscfix12)
- [x] Ověřit ARM64 VerusHash korektnost — v2b, v2b1 match reference vectors ✅
- [x] Plně analyzovat pool-side share verifikaci (node-stratum-pool + verushash-node)
- [x] **Ověřit 1. accepted VRSC share** — potvrzeno (shares_accepted=1)
- [x] **Snížit stale rejecty** — drop stale joby podle `latest_job_id` + `clean_jobs` invalidace (pool-side guard nasazen)
- [ ] **Ověřit v2b2 hash na x86** — porovnat ARM64 v2b2 output s x86 referenčním
- [ ] Vypnout TimeSplit cycling → 100% VRSC pro izolovaný test
- [ ] Full buffer byte-by-byte comparison (miner vs pool rekonstrukce)
- [ ] E2E test: `Revenue:VRSC` share → accepted na LuckPool → payout stats
- [ ] Stabilizovat duplicate/reconnect pattern v CH v3 během delšího běhu

### 📌 TODO pro ASIC hardening rollout (P1):
- [x] Implementovat CPU memory-hard scratchpad vrstvu (256KB)
- [x] Zapojit scratchpad do CH v3 pipeline (Keccak→SHA3→GoldenMatrix→Scratchpad→Fusion)
- [x] Přidat fork-safe selector `CHV3_MEMORY_HARD_FORK_HEIGHT` + `cosmic_harmony_v3_with_height()`
- [x] Přidat `Metal` legacy parity checker (`parity_check_legacy`) proti CPU referenci
- [x] Přidat `OpenCL` legacy parity checker (`batch_hash` + `parity_check_legacy`) proti CPU referenci
- [ ] Doplnit GPU parity pro scratchpad vrstvu (OpenCL + Metal)
- [ ] Nastavit a komunikovat fork activation height (`ch_version 3.1`) pro testnet/mainnet
- [ ] Ověřit delší benchmark/stability run po aktivaci

---

## 📝 Poznámky

### Bezpečnostní úvahy
- Memory-hard scratchpad musí být **deterministický** — každý node musí moci ověřit hash
- Scratchpad velikost 256KB je kompromis: dost pro ASIC resistance, dost malý pro GPU
- Golden Matrix φ-powers jsou statické → možné pre-compute na ASIC → zvážit per-block seed

### Výkonnostní odhady (po Memory-Hard)
| Hardware | Současný CH v3 | S Memory-Hard (256KB) | Změna |
|----------|---------------|----------------------|-------|
| CPU (Ryzen 9) | ~5 kH/s | ~1-2 kH/s | -60% |
| GPU (RTX 4090) | ~50 kH/s (odhad) | ~10-20 kH/s | -60% |
| ASIC (teoretický) | ~500 kH/s | ~15-30 kH/s | -95% |

**ASIC advantage po memory-hard**: ~2-3× vs GPU (místo současných 10-100×)

### Kompatibilita
- Scratchpad verze v block header: `ch_version: 3.1`
- Zpětná kompatibilita: staré bloky validovatelné bez scratchpadu
- Hard fork activation: konfigurační výška v `config/mainnet.toml`

---

*"Technology with love is magic."* 🌟  
*CH v3 není jen algoritmus — je to základ ekonomiky celé ZION sítě.*

---

**Poslední aktualizace**: 15. února 2026  
**Autor**: ZION Development Team  
**Další review**: Stabilizace VRSC accept rate (stale `job not found`) + v2b2 x86 cross-check (volitelné) + fork-height definice pro CHv3 scratchpad rollout

---

## 🔧 VRSC Debug Handoff — pro GPT 5.3

### Stav k 15.2.2026
- **vrscfix14** (miner) + **vrscfix15** (pool) nasazeno a běží na `77.42.31.72` (ARM64)
- Endianness fix v `meets_target()` je aktivní (vrscfix12) + near-hit telemetry (vrscfix13) + 1-thread optimalizace (vrscfix14)
- **E2E potvrzeno:** upstream `shares_accepted = 2` (z `shares_submitted = 2`), rejecty `0` v posledním snapshotu
- Pool-side rehash diagnostika potvrzuje: `miner_hash == pool_hash` (`match=true`)
- Hlavní fokus: dlouhodobá stabilita (hlídat návrat stale `[21, "job not found"]` v čase)

### Klíčové teorie pro další debug

| # | Teorie | Priorita | Jak ověřit |
|---|--------|----------|------------|
| 1 | **Stale job submit (clean_jobs)** | Vysoká | Trackovat `latest_job_id` z `mining.notify` a dropnout share pokud job_id != latest; při `clean_jobs=true` vyčistit job cache. Sleduj pokles `[21, "job not found"]`. |
| 2 | **Latency mezi find→submit** | Střední | Změřit ms od „share found“ po `mining.submit`; optimalizovat log/locks, případně prodloužit lock okno. |
| 3 | **Reconnect/rotation pattern** | Střední | Korelovat `[21, "job not found"]` s reconnecty/upstream notify bursty; ztišit zbytečné reconnecty. |
| 4 | **Buffer mismatch (méně pravděpodobné)** | Nízká | Spoléhat na `VRSC HASH DIAG match=true`; pokud se objeví `match=false`, udělat full 1487B dump. |

### Klíčové soubory
| Soubor | Popis |
|--------|-------|
| `miner/src/miner/cpu.rs` | Mining loop, `meets_target()`, VerusHash, diagnostické dumpy |
| `pool/src/revenue_proxy.rs` | ZcashStratum proxy, submit forwarding |
| `native-libs/verushash-native/csrc/ffi_wrapper.cpp` | FFI (97 řádků) |
| `native-libs/verushash-native/csrc/verus_clhash.cpp` | CLHash — portable ARM64 |
| `native-libs/verushash-native/csrc/test_hash.cpp` | Referenční test vektory |

### Přístupové údaje
| Parametr | Hodnota |
|----------|---------|
| Server | `ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72` |
| Pool container | `zion-pool-testnet` (`zion-pool:2.9.5-vrscfix15`) |
| Miner container | `zion-miner-vrsc` (`zion-miner:2.9.5-vrscfix14`) |
| LuckPool | `stratum+tcp://eu.luckpool.net:3956` |
| Wallet | `RKnFGDV7isvHwGKNPkGsdASbfqbVE53y3W` (worker: `zion-pool-test`) |
| diff1 | `0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` |
| Pool target | `0000004000...00` (diff≈32) / `0000002000...00` (diff≈64) |
