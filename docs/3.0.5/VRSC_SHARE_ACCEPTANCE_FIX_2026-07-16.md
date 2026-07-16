# VRSC Share Acceptance Fix — 2026-07-16

> **Status:** ✅ RESOLVED — LuckPool nyní přijímá VRSC shares (4/4 accepted, 0 rejected)
> **Datum:** 2026-07-16
> **Autor:** Devin (GLM-5.2 High) + Yeshua
> **Commits:** `071c50ebf` (clear_verushash_pbaas + debug logging), `09217752a` (TriGpuManager Cpu fix)

---

## 1. Problém

LuckPool konzistentně odmítal všechny VRSC shares s chybou:

```
[23,"low difficulty share"]
```

Tato chyba znamená, že hash vypočítaný minerem **neodpovídá** hashu, který LuckPool ověřuje na své straně pomocí `verusHashV2b2` (z `verushash-node`).

## 2. Root Cause Analysis

### 2.1 VerusHash v2.2 + PBaaS v7+ Normalizace

VerusHash v2.2 pro PBaaS (Public Blockchains as a Service) v7+ vyžaduje **normalizaci block headeru** před hashováním. LuckPool's `verusHashV2b2` funkce (v `verushash.cc`):

1. Zkontroluje `sol_ver > 6` (solution version > 6 = PBaaS)
2. Pokud `numPBaaSHeaders > 0`, sestaví `preHeader` z non-canonical polí:
   - `hashPrevBlock` (offset 4, 32 bytes)
   - `hashMerkleRoot` (offset 36, 32 bytes)
   - `hashFinalSaplingRoot` (offset 68, 32 bytes)
   - `nNonce` (offset 108, 32 bytes)
   - `nBits` (offset 104, 4 bytes)
   - `hashPrevMMRRoot` + `hashBlockMMRRoot` (solution offset 8, 64 bytes)
3. Vypočítá `preHeaderHash = blake2b(preHeader)` a porovná s hodnotou v solution
4. Pokud match → **vyčistí non-canonical data** (memset na 0) → hashuje
5. Pokud no match → vrátí `0xFF` (invalid share)

### 2.2 Chybějící `clear_verushash_pbaas` v binárce

ZION miner implementuje `clear_verushash_pbaas()` v `AuXpow/src/external_hashers.rs` (řádek 847), která provádí ekvivalentní vyčištění před hashováním. Tato funkce je volána v `miner_harness.rs:314` před `scan_verushash`.

**Kritický problém:** Binárka `zion-miner` na serveru byla zkompilována **Jul 16 04:27** — **před** aplikací fixu. Zdrojový kód na serveru fix obsahoval, ale zkompilovaná binárka nikoliv:

```bash
# Binárka neobsahovala debug strings (důkaz že je stará):
$ strings /opt/zion/V3/target/release/zion-miner | grep VRSC_SHARE_FOUND
# (prázdný výstup)

# Zdrojový kód debug strings obsahoval:
$ grep VRSC_SHARE_FOUND /opt/zion/AuXpow/src/miner_harness.rs
335:                "VRSC_SHARE_FOUND nonce={} hash={}",
```

### 2.3 TriGpuManager Cpu Bug

Při pokusu o recompile narazil miner na druhý bug: `TriGpuManager::new(Cpu, ...)` volal `create_gpu_backend(Cpu, ...)` který `bail!`oval s chybou "GPU backend requested but kind=cpu". Fallback také používal `Cpu` kind, což způsobilo **fatal error** — miner se nikdy nespustil v CPU-only módu.

### 2.4 Port Konflikt

Starý `zion-pool.service` (legacy, `/usr/local/bin/zion-pool-server`) běžel na portu 8444 a kolidoval s novým `zion-edge-pool.service`. Pool server se restartoval každých ~10 sekund s `Address already in use (os error 98)`.

## 3. Řešení

### 3.1 Recompile s správnými features

```bash
# Na serveru (zion-new):
export PATH=$HOME/.cargo/bin:$PATH
cd /opt/zion
cargo build --release -j 4 -p zion-miner \
  --features "native-hashers,native-cosmic-harmony,native-randomx,native-verushash" \
  --bin zion-miner

cargo build --release -j 4 -p zion-pool --bin server
```

### 3.2 TriGpuManager Cpu Fix

`V3/L1/miner/src/gpu_backend.rs` — `TriGpuManager::new()`:

```rust
pub fn new(kind: GpuBackendKind, primary_work_size: usize) -> Result<Self> {
    // CPU-only mode: no GPU backend, return a dummy manager.
    if kind == GpuBackendKind::Cpu {
        return Ok(Self {
            primary: None,
            kind,
        });
    }
    let primary_algo = "deeksha_lite_v1";
    let primary = create_gpu_backend(kind, primary_work_size, primary_algo)?;
    Ok(Self { primary: Some(primary), kind })
}
```

### 3.3 Systemd Service Fix

`/etc/systemd/system/zion-edge-miner.service`:

```ini
# Před (broken):
ExecStart=... --cpu                          # neplatný flag

# Po (fixed):
Environment=ZION_GPU_BACKEND=cpu
ExecStart=... --gpu cpu --no-tui --wallet zion1...
```

### 3.4 Port Konflikt Resolution

```bash
systemctl stop zion-pool.service
systemctl disable zion-pool.service
```

### 3.5 Deploy

```bash
# Stop services
systemctl stop zion-edge-pool.service
pkill -9 -f zion-miner

# Copy new binaries
cp /opt/zion/target/release/server /opt/zion/V3/target/release/server
cp /opt/zion/target/release/zion-miner /opt/zion/V3/target/release/zion-miner

# Start services
systemctl start zion-edge-pool.service
systemctl start zion-edge-miner.service
```

## 4. Verifikace

### 4.1 VRSC Shares Accepted

```
Jul 16 07:52:09 server: external_share_result miner=edge-cpu-1 coin=VRSC accepted=true status=accepted
Jul 16 07:52:24 server: external_share_result miner=edge-cpu-1 coin=VRSC accepted=true status=accepted
Jul 16 07:52:44 server: external_share_result miner=local-miner coin=VRSC accepted=true status=accepted
Jul 16 07:56:04 server: external_share_result miner=edge-cpu-1 coin=VRSC accepted=true status=accepted
```

**4/4 VRSC shares přijato LuckPoolem — 0 rejections.**

### 4.2 Debug Output Potvrzuje Clearing

```
VRSC_DEBUG header_len=1487 version=04000100 ntime=2571586a nbits=00000000
  nonce_field=0000000000000000000000000000000000000000000000000000000000000000
  varint=fd4005 sol_ver=08000000 sol_numPBAAS=3 mmr_first8=0000000000000000
```

- `nbits=00000000` ✅ (vyčištěno)
- `nonce_field` = samá nula ✅ (vyčištěno)
- `mmr_first8=0000000000000000` ✅ (MMR roots vyčištěny)
- `sol_ver=08000000` → solution version = 8 (> 6 = PBaaS v7+) ✅
- `sol_numPBAAS=3` → 3 PBaaS headers ✅

### 4.3 Submit Format

Pool odesílá na LuckPool:
- `en1=2ff7923b` (4 bytes extranonce1 z LuckPool subscribe)
- `nonce2=0000...0000` (56 bytes samá nula — zajišťuje preHeaderHash match)
- `solution=fd4005...` (1344 bytes, obsahuje en1 v nonceSpace na konci)

## 5. Technické Detaily

### 5.1 VRSC Block Header Layout (1487 bytes)

| Offset | Size | Field | Clearing |
|--------|------|-------|----------|
| 0 | 4 | version | — |
| 4 | 32 | hashPrevBlock | ✅ zeroed |
| 36 | 32 | hashMerkleRoot | ✅ zeroed |
| 68 | 32 | hashFinalSaplingRoot | ✅ zeroed |
| 100 | 4 | nTime | — |
| 104 | 4 | nBits | ✅ zeroed |
| 108 | 32 | nNonce | ✅ zeroed |
| 140 | 3 | varint (0xfd4005 → 1344) | — |
| 143 | 1344 | solution | MMR roots zeroed |

### 5.2 Solution Layout (1344 bytes, offset 143)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | solution version (LE u32) |
| 4 | 1 | descrBits |
| 5 | 1 | numPBaaSHeaders |
| 6 | 2 | extraSpace |
| 8 | 32 | hashPrevMMRRoot ← ✅ zeroed |
| 40 | 32 | hashBlockMMRRoot ← ✅ zeroed |
| 72 | 20 | pbaas chain ID (hash160) |
| 92 | 32 | preHeaderHash (blake2b) |
| 124 | ... | miner nonceSpace (en1 + miner_nonce) |

### 5.3 clear_verushash_pbaas() Implementace

`AuXpow/src/external_hashers.rs:847`:

```rust
pub fn clear_verushash_pbaas(header: &mut [u8]) {
    const SOLUTION_OFFSET: usize = 143;
    // Check solution version > 6
    let sol_ver = u32::from_le_bytes(header[SOLUTION_OFFSET..SOLUTION_OFFSET+4].try_into().unwrap());
    if sol_ver <= 6 { return; }

    let num_pbaas = header[SOLUTION_OFFSET + 5];
    if num_pbaas == 0 { return; }

    // Zero non-canonical fields:
    // - hashPrevBlock, hashMerkleRoot, hashFinalSaplingRoot (bytes 4..100)
    // - nBits (bytes 104..108)
    // - nNonce (bytes 108..140)
    // - hashPrevMMRRoot, hashBlockMMRRoot (solution bytes 8..72, absolute 151..215)
    header[4..100].fill(0);
    header[104..108].fill(0);
    header[108..140].fill(0);
    header[SOLUTION_OFFSET+8..SOLUTION_OFFSET+72].fill(0);
}
```

### 5.4 Submit Path (auxpow_client.rs)

Pool server přijímá share od mineru → přeposílá na LuckPool:
1. Miner najde nonce v solution nonceSpace
2. Pool sestaví submit: `en1` (z LuckPool subscribe) + `nonce2=zeros` + `solution`
3. `nonce2=zeros` zaručuje, že `preHeaderHash` v solution matchne vyčištěný header
4. LuckPool ověří: `blake2b(cleared preHeader) == preHeaderHash in solution` → match → clear → hash → accept

## 6. Soubory Změněné

| Soubor | Změna |
|--------|-------|
| `AuXpow/src/external_hashers.rs` | `clear_verushash_pbaas()` implementace |
| `AuXpow/src/miner_harness.rs` | Volání `clear_verushash_pbaas()` v `scan_verushash` + VRSC_DEBUG logging |
| `V3/L1/miner/src/gpu_backend.rs` | `TriGpuManager::new()` Cpu kind fix |
| `/etc/systemd/system/zion-edge-miner.service` | `--gpu cpu` + `ZION_GPU_BACKEND=cpu` + `--wallet` |

## 7. Build Commands (pro referenci)

```bash
# Miner (s native VerusHash + RandomX)
cargo build --release -p zion-miner \
  --features "native-hashers,native-cosmic-harmony,native-randomx,native-verushash" \
  --bin zion-miner

# Pool server
cargo build --release -p zion-pool --bin server

# Edge deploy skript reference:
# /opt/zion/scripts/edge-docker-build-smos.sh
```

## 8. Lessons Learned

1. **Vždy ověř, že binárka obsahuje změny** — `strings binary | grep DEBUG_STRING` je rychlý test
2. **`--cpu` není platný flag** — miner používá `--gpu cpu` nebo `ZION_GPU_BACKEND=cpu`
3. **Port konflikty** — vždy zkontroluj `ss -tlnp | grep PORT` před debuggováním connection issue
4. **PBaaS v7+ normalizace je kritická** — bez `clear_verushash_pbaas()` hash nikdy neshoduje s pool validation
5. **preHeaderHash mechanismus** — LuckPool neporovnává přímo header fields, ale blake2b hash vyčištěných fields s preHeaderHash uloženým v solution. Miner musí poslat `nonce2=zeros` aby preHeaderHash zůstal konzistentní.
