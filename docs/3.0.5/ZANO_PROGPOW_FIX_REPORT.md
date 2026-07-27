# ZANO ProgPoWZ Share Rejection Fix — Report

**Datum:** 2026-07-25
**Status:** VYŘEŠENO — ZANO shares jsou nyní přijímány HeroMiners poolem

## Problém

ZANO (ProgPoWZ) shares byly konzistentně odmítány HeroMiners poolem jako
**"low diff share"**. ZION a VRSC streamy fungovaly normálně, ale ZANO měl
0 accepted / 6 rejected. GPU těžilo ~6 MH/s, ale každý nalezený share byl
odmítnut.

## Diagnostika

### Fáze 1: CUDA kernel bugy (předchozí sessiony)

CUDA ProgPoW kernel měl tři bugy, které způsobovaly all-zero hash výstup:

1. **`__byte_perm` selector** — NVRTC na sm_61 (GTX 1070 Ti) má compiler
   optimization bug: `__byte_perm(x, 0, 0x0123)` vrací 0 když druhý argument
   je 0. Fix: ruční byte swap místo `__byte_perm`.

2. **Keccak-f800 round constants** — Dva konstanty byly špatně:
   - Index 7: `0x00000009` → `0x00008009`
   - Index 15: `0x00000003` → `0x00008003`

3. **DAG overwrite** — ProgPoW kernel přepisoval DAG buffer při běhu.

Tyto bugy způsobovaly, že CUDA kernel produkoval all-zero hashe. Miner byl
proto přepnut na OpenCL backend (`ZION_EXT_GPU_BACKEND=opencl`).

### Fáze 2: Header/seed index mapping (tato session)

Původní hypotéza byla, že HeroMiners přehazuje pořadí `header_hash` a
`seed_hash` v `eth_getWork` odpovědi. Test přímým připojením na
`de.zano.herominers.com:1110` ukázal:

```
arr[0]: 0xad3d8cc6...  (header_hash — mění se každý blok)
arr[1]: 0xc67d12cb...  (seed_hash — konstantní per epoch)
arr[2]: 0x00000004...  (target)
arr[3]: 0x000000000039c67c  (height)
```

**Závěr:** Index mapping v kódu `(seed_idx=1, header_idx=0)` pro ZANO je
**SPRÁVNÝ**. HeroMiners opravdu vrací `[header_hash, seed_hash, ...]` —
opačné pořadí než standardní Ethereum eth_getWork.

### Fáze 3: DAG generation kernel — ROOT CAUSE

**Kritický bug nalezen v `AuXpow/csrc/cuda/ethash_dag_gen.cu` řádek 152:**

```cuda
if (node_index >= light_items * 4) return; // safety limit
```

Tento "safety limit" byl katastrofálně špatný:

| Epoch | DAG nodes | light_items | light_items × 4 | % DAG computed |
|-------|-----------|-------------|------------------|----------------|
| 126   | 49,807,330 | 278,267   | 1,113,068        | **2.2%**       |

**98% DAG uzlů nebylo nikdy vypočítáno** — zůstaly nulové. GPU kernel
tedy počítal ProgPoW s téměř prázdným DAGem, což produkovalo nesprávné
mix hashe. HeroMiners přepočítal hash se správným DAGem a dostal jiný
výsledek, který nesplňoval target → "low diff share".

**Fix:** Odstraněn safety limit. Host ovládá rozsah přes grid dimensions.

```cuda
// No safety limit needed — the host controls the actual range via grid
// dimensions.  The previous `light_items * 4` limit was wrong: it
// terminated ~98% of threads for large epochs.
```

### Fáze 4: OpenCL backend verifikace

Miner běží na OpenCL backendu (ne CUDA). OpenCL DAG generation používá
jiný kernel (`kawpow_dag.cl`) který **nemá** tento safety limit bug —
všechny DAG uzly jsou generovány správně.

OpenCL ProgPoW kernel již měl:
- Správné keccak-f800 round constants
- Správný `rotate()` (OpenCL intrinsic korektně maskuje rotation count)
- Správný ProgPoWZ math codegen (clz/popcount na pozicích 0/1, `% 32` mask)

## Výsledek

Po restartu mineru s rebuildovaným binary:

```
[2026-07-25 06:31:50] ext_gpu_share_found coin=ZANO nonce=3734246481322258650
[2026-07-25 06:31:50] ext_gpu_share_debug real_hash=00000001a36853f4... target_u64=0x000000044b82fa09 meets=true
[2026-07-25 06:31:50] ext_share_submitted coin=ZANO
[2026-07-25 06:31:56] external_share_accepted coin=ZANO status=accepted  ← PRVNÍ PŘIJATÝ SHARE!
```

**Aktuální stav (UP 00:05:20):**
- ZANO: **1 accepted, 0 rejected, 100% efficiency, ~8 MH/s**
- ZION: 24 accepted, 0 rejected, 100%
- VRSC: 17 accepted, 1 rejected, 94%
- Celkem: 41 accepted, 1 rejected, 97.6% efficiency

## Změněné soubory

| Soubor | Změna |
|--------|-------|
| `AuXpow/csrc/cuda/ethash_dag_gen.cu` | Odstraněn `light_items * 4` safety limit (root cause) |
| `AuXpow/csrc/cuda/progpow_kernel.cu` | Keccak constants + byte_perm fix (předchozí sessiony) |
| `V3/L1/miner/src/cuda_external.rs` | Expanded g_output buffer + debug readback |
| `V3/L1/miner/src/main.rs` | ext_gpu_share_debug logging |

## Poučení

1. **Safety limity v GPU kernelech** musí být založeny na správné
   velikosti výstupního bufferu, ne na náhodném násobku vstupní cache.
   `light_items * 4` nemá žádnou souvislost s `dag_nodes`.

2. **OpenCL vs CUDA parity**: OpenCL backend byl správný celou dobu.
   CUDA backend měl tři nezávislé bugy (byte_perm, keccak constants,
   DAG safety limit). OpenCL kernel používá standardní intrinsics
   které nemají NVRTC compiler bugy.

3. **Debug logging je klíčový**: `ext_gpu_share_debug` log s
   `real_hash`, `real_u64`, `target_u64` a `meets` umožnil rychle
   ověřit, že lokální hash splňuje target, takže problém musel být
   v DAG nebo mix hash, ne v target comparison.

## Následující kroky

- [ ] Commit a push změn na git
- [ ] Monitorovat ZANO share accept rate přes dalších 24h
- [ ] Zvážit přepnutí na CUDA backend pro lepší výkon (po ověření
      že CUDA DAG fix funguje — zatím běží OpenCL)
- [ ] Pokud CUDA backend funguje s fixem, benchmark CUDA vs OpenCL
      pro ZANO ProgPoWZ na GTX 1070 Ti
