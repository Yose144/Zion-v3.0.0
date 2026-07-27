# ZonoShereV — ZANO ProgPoWZ GPU Mining E2E Report

> **Datum:** 2026-07-20 / 2026-07-21
> **Autor:** Devin (GLM-5.2 High) pro Yose
> **Status:** **SHARE ACCEPTED** — ZANO ProgPoWZ GPU mining pipeline plně funkční end-to-end
> **Pool:** HeroMiners ZANO (`de.zano.herominers.com:1110`)
> **GPU:** AMD Navi 10 (gfx1010) — ~9 MH/s ProgPoWZ

---

## 1. Cíl

Dokončit end-to-end (E2E) test ZANO ProgPoWZ GPU těžby proti HeroMiners poolu:
připojení → DAG generace → kernel kompilace → mining → share submission → **accepted**.

---

## 2. Root causes (3 kritické bugy)

Během dvou session byly nalezeny a opraveny **3 kritické bugy**, které blokovaly
přijetí share. První dva se projevovaly jako "low diff share" rejection — pool
recomputoval hash s korektním DAG a dostal jiný výsledek než náš GPU kernel.

### Bug 1: ProgPoWZ math op mapping (`progpow_codegen.rs`)

**Příčina:** `math_code_zano` používala posunutou permutaci `(r+2)%11` (dříve
`(r+9)%11`) s nesprávnou case-to-op mapou (case 0=add místo case 0=clz).

**Analýza:** Po naklonování referenčního `hyle-team/progminer`
(`libprogpow/ProgPow.cpp`) jsem ověřil, že ZANO používá **standardní** ProgPoW
0.9.2 `random_math` mapping s `selector % 11` — **žádná permutace**. ZANO
modifikace ProgPoW jsou jinde (binary layout / consensus), ne v math op tabulce.

**Oprava:** `math_code_zano` nyní používá `r % 11` se standardní mapou:
`0=clz, 1=popcount, 2=add, 3=mul, 4=mul_hi, 5=min, 6=ROTL, 7=ROTR, 8=AND, 9=OR, 10=XOR`.

**Soubor:** `AuXpow/src/progpow_codegen.rs` (řádek ~168)

### Bug 2: DAG dataset parents 512→256 (`kawpow_dag.cl`) — **root cause "low diff share"**

**Příčina:** OpenCL kernel pro generaci DAG měl `ETHASH_DATASET_PARENTS = 512`,
ale standardní Ethash/ProgPoW specifikace (EIP-1057) používá **256** parent nodes
per DAG node.

**Dopad:** S 512 parents byl každý DAG node vypočítán nesprávně → celý DAG byl
špatný → GPU počítalo špatné mix hashe → pool recomputoval hash se správným DAG
a dostal jiný výsledek → "low diff share" rejection. Toto byl **skrytý root
cause**, který se debuggoval přes 2 session.

**Oprava:** `#define ETHASH_DATASET_PARENTS 256`

**Soubor:** `AuXpow/csrc/opencl/kawpow_dag.cl` (řádek 8)

### Bug 3: eth_submitWork response parsing (`auxpow_client.rs`)

**Příčina:** ZANO HeroMiners pool vrací `{"result":{"status":"OK"}}` místo
`{"result":true}`. Náš kód kontroloval pouze `result.as_bool()`, takže vracel
`Unknown` i pro přijaté share.

**Oprava:** Přidána fallback kontrola `result.status == "OK"`.

**Soubor:** `AuXpow/src/auxpow_client.rs` (řádek ~4246)

---

## 3. Další opravy z předchozí session

### ZANO HeroMiners getWork field swap (`auxpow_client.rs`)
ZANO HeroMiners vrací `eth_getWork` výsledky v pořadí
`[header_hash, seed_hash, target, height]` místo standardního Ethereum
`[seed_hash, header_hash, ...]`. Opraveno swapem indexů pro `ExternalCoin::ZANO`
v `request_eth_getwork` (~řádek 4705) a push notification handleru (~řádek 2159).

### Pre-warm bez odpojení (`e2e_pool_test.rs`)
HeroMiners ZANO zavírá idle connection po ~30-60s. Původní approach
(disconnect → pre-warm → reconnect) rozbil background getWork polling. Finální
řešení: `prewarm_gpu` v `tokio::task::spawn_blocking` — async tasks (poll_messages,
getWork polling každé 3s) běží dál. getWork polling funguje jako keepalive.
Potvrzeno: 30+ getWork responses během ~150s DAG generace.

### DAG/cache size prime rounding
Opraveno prime rounding pro ProgPow/Ethash DAG a cache velikosti.

### isolate=0 infinite loop
Opraven infinite loop bug v DAG kernel call když `isolate=0`.

---

## 4. Verifikace — kernel source comparison

Pro period seed 0 jsem porovnal vygenerovaný OpenCL kernel source s referenčním
`hyle-team/progminer`:

```
diff /tmp/ref_ops.txt /tmp/our_ops.txt
```

**Výsledek:** Cache load + random math sekvence **identické** s referencí
(jediný diff je `% 32` v ROTL/ROTR, což je funkčně ekvivalentní — OpenCL
`rotate` maskuje s `& 31`).

KISS99 RNG, FNV-1a, merge_code, keccak_f800 round function — vše shodné s
referencí.

---

## 5. Finální E2E test výsledek

```
=== AuXpow Phase 1 E2E test ===
coin:      ZANO
algorithm: progpow_zano
pool:      de.zano.herominers.com:1110
gpu_opencl:true
submit:    true
mine_secs: 600

[1/4] Connecting...
[2/4] Received job: algorithm=progpow_zano ...
[2.5/4] GPU pre-warm: height=3780146 epoch=126 algo=progpow_zano
        — DAG generated in 150.6s
        — kernel compiled in 0.1s (period=75602)
        — pre-warm complete
[3/4] GPU share found: nonce=473929253 has_mix=true (batch 0.2s)
[4/4] Submitting share (job_id=0x5d28d88b... nonce=473929253)...
auxpow: dag_hash_recomputed algo=progpow_zano nonce=473929253
        kernel_hash=0000000000000000 real_hash=0000000016db1a3d
        mix=4c58d89980cc44e7
auxpow: submitting share request {"method":"eth_submitWork",
        "params":["0x000000001c3c5d25","0x5d28d88b...","0x4c58d899..."]}
auxpow: ZANO submit response: {"result":{"status":"OK"}}
[4/4] Submit result: Accepted
=== E2E test finished ===
```

**Share ACCEPTED HeroMiners ZANO pool!**

---

## 6. Technické parametry

| Parametr | Hodnota |
|---|---|
| GPU | AMD Navi 10 (gfx1010, RX 5700) |
| Algorithm | ProgPoWZ 0.9.2 (ZANO variant) |
| Epoch | 126 |
| DAG generation | ~150s (on-GPU, batch 16384) |
| Kernel compile | ~0.1s (cached) |
| Hashrate | ~9 MH/s (2M batch, 0.2s/batch) |
| Period | 50 blocks |
| PROGPOW_DAG_ELEMENTS | dag_entries / 2 |
| ETHASH_DATASET_PARENTS | 256 (fixed from 512) |
| Math op mapping | standard r%11 (no permutation) |
| Final hash | keccak_f800(header ‖ seed ‖ mix) |
| Share format | eth_submitWork(nonce_hex, header_hash, mix_hash) |

---

## 7. Modifikované soubory

| Soubor | Změna |
|---|---|
| `AuXpow/csrc/opencl/kawpow_dag.cl` | `ETHASH_DATASET_PARENTS 512→256` |
| `AuXpow/src/progpow_codegen.rs` | `math_code_zano`: standard `r%11` mapping |
| `AuXpow/src/auxpow_client.rs` | ZANO field swap + `{status:OK}` response parsing |
| `AuXpow/examples/e2e_pool_test.rs` | pre-warm bez odpojení, stale job detection |

**Referenční soubory (nepozměněno):**
- `AuXpow/csrc/opencl/progpow_kernel.cl` — OpenCL kernel (keccak_f800, mix hash)
- `AuXpow/src/external_hashers.rs` — `progpow_final_hash`, `ethash_header_hash`
- `AuXpow/src/gpu_miner.rs` — DAG management, kernel enqueue
- `AuXpow/src/share_forwarder.rs` — DAG hash recomputation + submit

---

## 8. Build & Run

```bash
# Build
cargo build --example e2e_pool_test --features gpu-opencl,native-hashers -p zion-auxpow

# Run E2E test
AUXPOW_E2E_RUN=1 \
AUXPOW_E2E_COIN=zano \
AUXPOW_E2E_WALLET=ZxCj5kQhNdW7xtt4hDTotBPGUsWYKRdtdPTFXjzFpPpf6q42rCVXcYnTtHRYGj3pzz2LUqCnvVoRzFn9zfZdCSzC1CkBiHYrg \
AUXPOW_E2E_POOL=de.zano.herominers.com:1110 \
AUXPOW_E2E_GPU_OPENCL=1 \
AUXPOW_E2E_SUBMIT=1 \
AUXPOW_E2E_MINE_SECS=600 \
./target/debug/examples/e2e_pool_test
```

---

## 9. Reference

- **hyle-team/progminer** — ZANO official ProgPoWZ miner fork
  - `libprogpow/ProgPow.cpp` — kernel code generator (math op mapping)
  - `libethash/progpow.cpp` — reference ProgPoW 0.9.2 implementation
  - `libethash-cl/CLMiner_kernel.cl` — OpenCL kernel (keccak_f800, mix hash)
  - `libethash-cl/CLMiner.cpp` — `PROGPOW_DAG_ELEMENTS = dagNumItems / 2`
- **EIP-1057** — ProgPoW specification (`ETHASH_DATASET_PARENTS = 256`)
- **Zano blog** — "Zano Proof of Work: Our motivation for using ProgPoW"

---

## 10. Závěr

ZANO ProgPoWZ GPU mining pipeline je nyní plně funkční end-to-end. Tři
kritické bugy byly opraveny:

1. **Math op mapping** — standard `r%11` bez permutace
2. **DAG dataset parents** — 512→256 (root cause "low diff share")
3. **Response parsing** — `{status:OK}` recognition

Share byl **přijat** HeroMiners ZANO pool. Pipeline je ready pro production
integraci do `zion-miner`.

> **ZonoShereV** — ZANO Share Verified ✅
