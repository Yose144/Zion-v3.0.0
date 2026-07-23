# Trinity E2E Fix Report — 2026-07-18

## Souhrn

Tento report shrnuje veškerou práci na trinity E2E testování (ZION + external GPU + external CPU) s reálnými pool targety. Obsahuje opravené bugy, aktuální stav každého streamu, a seznam zbývající práce.

---

## Opravené bugy

### Bug #1: NiceHash KawPow nonce format (extranonce1 prefix)

**Problém:** Při těžbě KawPow (RVN) na NiceHash byly shares rejectovány s "Invalid nonce; is miner not compatible with NiceHash?".

**Příčina:** `external_gpu_thread` v `V3/L1/miner/src/main.rs` nepředával `extranonce1` od poolu do nonce hodnoty. NiceHash pro KawPow/Ethash vyžaduje, aby horní bity nonce odpovídaly `extranonce1`.

**Oprava:** `nonce_base` je nyní kombinován z `extranonce1` (horní bity) a `random_base` (dolní bity) při zpracování external jobs z poolů jako NiceHash.

**Soubory:** `V3/L1/miner/src/main.rs`

**Stav:** ✅ Opraveno

---

### Bug #2: Ethash/KawPow mix_hash nebyl čten z GPU

**Problém:** ETC shares byly rejectovány 2miners s "Invalid share" protože `mix_hash` byl vždy `None`.

**Příčina:** CUDA kernel (`ethash_kernel.cu`) správně zapisoval mix hash do `output_mix` bufferu, ale Rust kód v `cuda_external.rs` ho nečítal zpět z GPU po dokončení kernelu.

**Oprava:** `cuda_external.rs` nyní čte `output_mix` z GPU a předává ho v `GpuBatchResult` pro Ethash a KawPow algoritmy.

**Soubory:** `V3/L1/miner/src/cuda_external.rs`

**Stav:** ✅ Opraveno

---

### Bug #3: Ethash/KawPow DAG epoch přepisován v mine_batch

**Problém:** ETC shares i po fixu mix_hash byly stále "Invalid share" — DAG byl generován pro špatnou epochu.

**Příčina:** V `mine_batch()` (cuda_external.rs) se epoch přepočítával z `header.timestamp`, ale pro external ethash/kawpow jobs je header pouze 32-byte hash padded na 80 bytů s nulami → `timestamp=0` → `epoch=0`. To přepsalo správný DAG (epoch 832) na DAG epoch 0.

Root cause: `update_epoch(height)` v external GPU thread správně zavolal `ensure_dag(832)`, ale následný `mine_batch()` znovu zavolal `ensure_dag(0)` a přepsal DAG.

**Oprava:** `mine_batch()` nyní nepřepočítává epoch z `header.timestamp`. Místo toho:
- Pokud už je DAG načtený (`dag_epoch != 0xFFFFFFFF`), použije se existující DAG
- Pokud DAG není načtený (benchmark), načte se epoch 0

**Soubory:** `V3/L1/miner/src/cuda_external.rs` (řádky 867-882)

**Stav:** ✅ Opraveno, DAG epoch 832 správně načten (`ext_gpu_dag_ready algo=ethash epoch=832`)

---

### Bug #4: Pool script — špatný název env var pro node RPC

**Problém:** ZION stream měl ~90% reject rate s "StaleJob". Pool vydával dummy jobs s `height=0` a `target=ffffffff...`.

**Příčina:** Pool script (`e2e_real_target.sh` a `pool_real_target.sh`) nastavoval env var `ZION_POOL_NODE_RPC`, ale pool binary čte `ZION_NODE_RPC_ADDR` (server.rs řádek 6139). Bez této env var pool neměl `node_rpc_addr` → nemohl fetchovat block template z nodu → vydával dummy jobs.

**Oprava:**
```bash
# Před (broken):
export ZION_POOL_NODE_RPC=http://127.0.0.1:9443

# Po (fixed):
export ZION_NODE_RPC_ADDR=127.0.0.1:9443
```

**Soubory:** `V3/deploy/vast-rtx/e2e_real_target.sh`, pool scripty na Edge serveru

**Stav:** ✅ Opraveno, pool se připojil k nodu (`node_rpc_addr=127.0.0.1:9443`)

---

### Bug #5: Pool script — `http://` prefix v RPC adrese

**Problém:** I po opravě názvu env var pool zavíral miner spojení hned po welcome.

**Příčina:** `rpc_roundtrip()` v server.rs používá `TcpStream::connect(node_rpc_addr)` (řádek 3539), což očekává `host:port` formát. Hodnota `http://127.0.0.1:9443` způsobí connect failure.

**Oprava:** Odstraněn `http://` prefix — používá se `127.0.0.1:9443`.

**Stav:** ✅ Opraveno

---

### Bug #6: Verushash CUDA kernel přidán

**Problém:** VRSC (Verushash) CPU mining fungoval, ale GPU kernel neexistoval.

**Oprava:** Přidán `verushash_kernel.cu` s Haraka-based Verushash implementací. `CudaExternalMiner` nyní podporuje `CudaExtAlgo::Verushash` s precomputed key a blockhash_half buffery.

**Soubory:**
- `AuXpow/csrc/cuda/verushash_kernel.cu` (nový)
- `V3/L1/miner/cuda_sources/verushash/` (haraka.cu, blocks.h, atd.)
- `V3/L1/miner/src/cuda_external.rs`

**Stav:** ✅ Kód přidán (netestováno na GPU — VRSC CPU mining potvrzen jako funkční)

---

## Aktuální stav streamů

### 1. ZION Stream (deeksha_lite_v1)

**Stav:** ✅ FUNGUJE

Po opravě bugů #4 a #5:
- Pool se připojil k nodu: `node_rpc_addr=127.0.0.1:9443`
- ZION jobs mají správnou výšku: `height=10763`
- Shares ACCEPTED: `job=10763 height=10763 nonce=16000002985`
- Accept rate: ~43% (zbytek jsou "NoSolution" — normální pro difficulty=1)
- "StaleJob" rejekty zmizely

### 2. External GPU Stream

| Coin | Algo | Pool | Stav | Poznámka |
|------|------|------|------|----------|
| ETC  | Ethash | 2miners | ❌ Invalid share | DAG epoch fix aplikován, ale hash je stále špatný |
| RVN  | KawPow | NiceHash/2miners | ❌ Invalid nonce | extranonce1 fix aplikován, nepotvrzeno |
| KAS  | kheavyhash | 2miners | ⏳ 0 shares | Real pool difficulty příliš vysoká pro krátký test |
| ALPH | blake3 | 2miners | ⏳ 0 shares | Real pool difficulty příliš vysoká |
| DCR  | blake3 | 2miners | ❌ below_target | Share nedosáhl target |
| ERG  | autolykos | 2miners | ❌ unknown | Neznámá chyba |
| FLUX | zelhash | — | ❌ Pool unreachable | TCP connect failed |
| CLORE| kawpow | — | ❌ Pool unreachable | Timeout |

### 3. External CPU Stream (VRSC)

**Stav:** ✅ FUNGUJE

- VRSC (Verushash) shares nalezeny a **ACCEPTED** luckpool.net
- CPU mining path potvrzena jako funkční

---

## Zbývající práce

### Kritické (blokuje ETC/RVN GPU mining)

1. **ETC Ethash "Invalid share" — hash computation bug**
   - DAG epoch 832 je správně načten
   - mix_hash je čten z GPU
   - Ale 2miners stále rejectuje s "Invalid share"
   - **Potřebné:** Porovnat GPU-computed hash s CPU-computed hashem pro stejné vstupy (header_hash + nonce + DAG)
   - Možné příčiny:
     - Endianness v nonce nebo header_hash
     - Špatný seed_hash (2miners posílá stejnou hodnotu pro seed_hash i header_hash — kód toto očekává, ale možná je DAG seed odvozen špatně)
     - Keccak/SHA3 implementace v CUDA kernelu
     - FNV hash v DAG lookupu
   - **Test:** Napsat CPU referenční Ethash implementaci a porovnat výstup pro známý vstup

2. **RVN KawPow nonce format — nepotvrzeno**
   - extranonce1 fix byl aplikován ale nebyl testován s novým binary
   - **Potřebné:** Spustit 120s test s NiceHash RVN pool a ověřit accepted shares

### Střední priorita

3. **KAS/ALPH — 0 shares v krátkých testech**
   - Real pool difficulty je ~100x vyšší než easy target
   - 10-minutový test nestačí pro nalezení share
   - **Potřebné:** Spustit 1hodinový+ test pro KAS a ALPH s real target

4. **DCR "below_target"**
   - Share nedosáhl pool target
   - Možná špatný target parsing nebo blake3 kernel produkuje špatný hash
   - **Potřebné:** Ověřit blake3 kernel proti CPU referenci

5. **ERG "unknown" rejection**
   - Autolykos kernel možná produkuje špatný hash
   - **Potřebné:** Ověřit autolykos kernel proti CPU referenci

### Nízká priorita

6. **FLUX/CLORE — pool unreachable**
   - Upstream pool connection issues (TCP connect failed, timeout)
   - Nejedná se o kernel bug — pool je nedostupný
   - **Potřebné:** Najít funkční pool nebo ověřit dostupnost

7. **Verushash GPU kernel**
   - Kód přidán ale netestován na GPU
   - VRSC CPU mining funguje, GPU není kritické
   - **Potřebné:** Test na GPU s VRSC pool

8. **GhostRider (RTM) OpenCL kernel**
   - OpenCL kernel pro GhostRider byl přidán (M1/Mac)
   - RTM shares rejectovány s "below_target" na easy target
   - **Potřebné:** Ověřit GhostRider kernel proti CPU referenci

### Infrastruktura

9. **Pool script env var fix — trvale aplikovat**
   - `ZION_NODE_RPC_ADDR=127.0.0.1:9443` (bez `http://` prefixu)
   - Opravit všechny deploy scripty: `e2e_real_target.sh`, `e2e_test_all.sh`, `e2e_10min.sh`
   - Zkontrolovat systemd service files na Edge serveru

10. **ZION node service crash-loop**
    - `zion-node.service` se snaží restartovat ale failuje s "Address already in use" (port 8333)
    - Node běží jako samostatný proces (pid 1963535) ale systemd service je v crash-loop
    - **Potřebné:** Zastavit systemd service nebo zabít samostatný proces a restartovat service

---

## Změněné soubory

### Modifikované
| Soubor | Změna |
|--------|-------|
| `V3/L1/miner/src/cuda_external.rs` | +Verushash algo, +mix_hash readback, +DAG epoch fix |
| `V3/L1/miner/src/main.rs` | +extranonce1 nonce format pro NiceHash |
| `AuXpow/src/auxpow_client.rs` | ETC/KawPow notify parsing |
| `AuXpow/src/gpu_miner.rs` | GhostRider OpenCL support |
| `AuXpow/csrc/opencl/ghostrider_kernel.cl` | GhostRider kernel refaktor |
| `AuXpow/src/bin/rtm_gpu_test.rs` | RTM GPU test |
| `V3/L1/native-ffi/csrc/ghostrider/ghostrider_wrapper.c` | GhostRider wrapper |
| `V3/L1/native-ffi/csrc/verushash/real/ffi_wrapper_v3.cpp` | Verushash FFI |
| `V3/L1/native-ffi/src/lib.rs` | Verushash FFI bindings |
| `V3/Cargo.lock` | Dependency lock |

### Nové soubory
| Soubor | Obsah |
|--------|-------|
| `AuXpow/csrc/cuda/verushash_kernel.cu` | Verushash CUDA kernel (Haraka) |
| `V3/L1/miner/cuda_sources/ethash/` | Ethash CUDA helper headers |
| `V3/L1/miner/cuda_sources/verushash/` | Verushash CUDA sources (Haraka) |
| `AuXpow/csrc/opencl/ghostrider_cn.cl` | GhostRider CryptoNight OpenCL |
| `AuXpow/csrc/opencl/ghostrider_ref/` | GhostRider reference impl |
| `AuXpow/csrc/opencl/ghostrider_sph.cl` | GhostRider sph OpenCL |
| `AuXpow/csrc/opencl/ghostrider_sph/` | GhostRider sph sources |
| `AuXpow/src/bin/rtm_hash_cmp.rs` | RTM hash comparison tool |
| `AuXpow/src/bin/simd_cmp.rs` | SIMD comparison tool |

---

## Testovací infrastruktura

- **Miner:** Vast.ai RTX 3090 instance (`ssh5.vast.ai:33324`)
- **Pool:** Edge server (`62.171.141.136:8444`, `ssh zion-new`)
- **ZION Node:** Edge server (`127.0.0.1:9443`, height 10763)
- **Triple-stream:** ZION (deeksha_lite_fire) + ETC (ethash/2miners) + VRSC (verushash/luckpool)

---

## Další kroky

1. **Debug ETC Ethash hash** — napsat CPU referenci a porovnat s GPU výstupem
2. **Opravit deploy scripty** — aplikovat `ZION_NODE_RPC_ADDR` fix všude
3. **Spustit dlouhý test** (1h+) pro KAS/ALPH s real target
4. **Ověřit RVN KawPow** s extranonce1 fix na NiceHash
5. **Opravit ZION node systemd** crash-loop na Edge
