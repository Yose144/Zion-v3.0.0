# ZION Session Report — 2026-03-04 — GPU CHv4 Parity Fix

Commit HEAD při zahájení: `5582854`  
Commit po sesssion: `22f0515`  
Větev: `main`

---

## Přehled

Tato session navazuje na C/Rust parity fixy z `f0ebf20`. Po spuštění testů
(`cargo test -p zion-cosmic-harmony-v3 --release`) byl objeven 1 failure z 64 testů:
`test_gpu_vs_cpu_with_real_data` — GPU pipeline divergovala od CPU na kroku CosmicFusion.

**Výsledek:** 64/64 testů PASS, 0 warnings, commit `22f0515` pushnut.

---

## Identifikované bugy

### Bug #1 – CUDA `cosmic_fusion` = PHI_POWERS rotation (nesprávná implementace)

**Soubor:** `L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cu`  
**Popis:** GPU kernel prováděl XOR s rotovanými konstantami PHI_POWERS místo AES-128.  
**Dopad:** GPU hash divergoval od CPU/Rust při každém bloku vyžadujícím CosmicFusion.

### Bug #2 – CUDA `npu_mixing_words` — wrong int8 conversion (input)

**Soubor:** `L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cu`  
**Popis:** `word - 128` místo správné signed-char reinterpretace `(signed char)(unsigned char)(word)`.  
**Dopad:** NPU mixing producoval jiné hodnoty než CPU referenční implementace.

### Bug #3 – CUDA `npu_mixing_words` — wrong int8 conversion (output)

**Soubor:** `L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cu`  
**Popis:** `(unsigned char)(v + 128)` místo two's complement `(unsigned char)(v)`.  
**Dopad:** Stejný jako Bug #2 — NPU output se lišil.

### Bug #4 – OpenCL `cosmic_fusion` = XOR maska `0x74,0x9D,0x30,0x60` (nesprávná implementace)

**Soubor:** `L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cl`  
**Popis:** OpenCL kernel používal opakující se XOR masku — zcela odlišná logika od AES-128.  
**Dopad:** Stejný jako Bug #1, ale pro OpenCL GPU backend.

### Bug #5/#6 – OpenCL NPU int8 conversion (input + output)

**Soubor:** `L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cl`  
**Popis:** Stejné chyby jako Bug #2 a #3, v OpenCL syntaxi.

### Bug #7 – Rust GPU simulace `gpu_cosmic_harmony_v3_legacy` simulovala CHv4 (s NPU)

**Soubor:** `L1/cosmic-harmony/src/algorithms_opt.rs`  
**Popis:** Testovací funkce volala NPU transformaci, přestože `cosmic_harmony_v3_with_height(h=750)`
volá `cosmic_harmony_v3()` (CHv3 s MemHard, bez NPU).  
**Dopad:** Test porovnával CHv3+MemHard CPU hash vs. CHv4 GPU hash → vždy fail.

---

## Opravy

### CUDA (`cosmic_harmony_v3.cu`)

Přidány funkce:
```c
GPU_AES_SBOX[256]           // FIPS 197 S-Box
GPU_AES_RCON[11]            // AES round constants
gpu_aes_mul(a, b)           // GF(2^8) multiplikace
gpu_aes128_key_expand(key, rk)
gpu_aes128_encrypt_block(rk, blk)
fusion_round_cuda(state, round_num)
```

`fusion_round_cuda` pipeline (shodná s Rust + C native):
1. `keccak256(state[0..32] || round)` → `intermediate[32]`
2. `aes128_key_expand(intermediate)` → `rk`
3. `aes128_encrypt(rk, state[32..48])` → `block0`
4. `key2 = intermediate; key2[0]^=round; key2[15]^=0xAB` → `aes128_encrypt(rk2, state[48..64])` → `block1`
5. `state[32..64] ^= intermediate[0..32]`
6. `state[0..16]  = intermediate[0..16] ^ block0`
7. `state[16..32] = intermediate[16..32] ^ block1`

NPU int8 fix:
- Input:  `(int)(signed char)(unsigned char)(word)` ← byl `word - 128`
- Output: `(unsigned char)(v)` ← byl `(unsigned char)(v + 128)`

### OpenCL (`cosmic_harmony_v3.cl`)

Identické opravy v OpenCL syntaxi:
```c
CL_AES_SBOX[256], CL_AES_RCON[11]
cl_aes_mul, cl_aes128_key_expand, cl_aes128_encrypt_block
cl_fusion_round(state, round_num)
```
NPU: `(int)(char)((uchar)(word))` / `(uchar)(v)`

### Rust (`algorithms_opt.rs`)

- `gpu_cosmic_harmony_v3_legacy` → zachována jako CHv3 legacy (bez MemHard), patří k `test_gpu_vs_cpu_full_pipeline`
- Nová `gpu_cosmic_harmony_v3_mh` → CHv3 + MemHard (bez NPU), mirrors `cosmic_harmony_v3()` — patří k `test_gpu_vs_cpu_with_real_data`
- Aserce v `test_gpu_vs_cpu_with_real_data` opravena na `assert_eq!(cpu_hash, gpu_hash)`

---

## Pipeline mapping (referenční)

| Funkce                                  | MemHard | NPU | Fusion |
|-----------------------------------------|---------|-----|--------|
| `cosmic_harmony_v3_legacy`              | ✗       | ✗   | AES    |
| `cosmic_harmony_v3` / `with_height(750)`| ✓       | ✗   | AES    |
| `cosmic_harmony_v4`                     | ✓       | ✓   | AES    |

---

## Výsledky testů

```
running 64 tests
...................................................
test result: ok. 64 passed; 0 failed; 0 ignored; 0 filtered out
```

`cargo check` → 0 warnings, 0 errors

---

## Další změny v session

### `APP&WEB/desktop-agent/src/wallet-generator.js` — address validation fix

Validace `zion1` adresy zpřísněna tak, aby odpovídala L1 Rust validaci:
- Před: délka 40–90, regex `[0-9a-z]+`
- Po: délka přesně **44 znaků** (`zion1` + 39 znaků `[0-9a-z]`)
- Odráží `is_valid_zion1_address()` v Rust backendu

### `ankr.md` — přidán deployment hash

---

## Commity

| Hash      | Popis |
|-----------|-------|
| `22f0515` | fix: GPU kernels CHv4 parity — AES-128 fusion + NPU int8 conv |
| `5582854` | docs: CODE_FREEZE mark CHv4 C/Rust parity as done (f0ebf20) |
| `a64df0b` | docs: update CHV4_NATIVE_LIB_REPORT + TODO — parity fix f0ebf20 |
| `f0ebf20` | fix: CHv4 full C/Rust parity — NPU + scratchpad + AES fusion |
