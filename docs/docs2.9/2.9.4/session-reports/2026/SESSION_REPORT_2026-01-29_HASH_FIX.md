# Session Report - Hash Mismatch Fix Analysis
**Datum:** 29. ledna 2026  
**Server:** TreeOfLife-Zion (77.42.31.72)  
**Stav:** 🔧 Debugging Block Rejection

---

## 📊 Aktuální Stav

### Co funguje ✅
- **Shares přijímány poolem:** 15,000+ shares accepted (~26% acceptance rate)
- **Miner XOR nonce s height:** Opraveno
- **Pool validator XOR:** Opraveno
- **Core vždy používá CosmicHarmony:** Potvrzeno

### Co nefunguje ❌
- **Bloky odmítány core:** Hash mismatch mezi pool a core
- **Height zůstává 1:** Žádný nový blok nepřijat
- **blocks_rejected:** 82+

---

## 🔍 Root Cause Analysis

### Formát Template Blob (165 bytes)
```
Offset  Size  Field
------  ----  -----
0       4     version (u32 LE)
4       8     height (u64 LE)
12      64    prev_hash (ASCII hex, padded)
76      64    merkle_root (ASCII hex, padded)
140     8     timestamp (u64 LE)
148     8     difficulty (u64 LE)
156     1     algorithm (u8)
157     8     nonce_placeholder (zero bytes)
------  ----
TOTAL   165   bytes
```

### Core calculate_hash() (164 bytes)
```rust
// zion-native/core/src/blockchain/block.rs:53-76
data.extend_from_slice(&self.version.to_le_bytes());      // 4
data.extend_from_slice(&self.height.to_le_bytes());       // 8
data.extend_from_slice(&prev_buf);                         // 64 (padded ASCII)
data.extend_from_slice(&merkle_buf);                       // 64 (padded ASCII)
data.extend_from_slice(&self.timestamp.to_le_bytes());    // 8
data.extend_from_slice(&self.difficulty.to_le_bytes());   // 8
data.extend_from_slice(&self.nonce.to_le_bytes());        // 8
// NO algorithm byte! Total: 164 bytes
```

### Pool Validator compute_hash() - PROBLÉM
```rust
// zion-native/pool/src/shares/validator.rs:196-210
let header_len = 156;  // First 156 bytes (before algo byte)
let mut data = full_blob[..header_len].to_vec();
data.extend_from_slice(&(nonce as u64).to_le_bytes());  // +8 = 164 bytes
```

### 🚨 Kritický Nesoulad

**Pool validator:** Bere raw bytes přímo z hex-encoded blob
**Core:** Serializuje header fields zvlášť do ASCII hex strings

Konkrétně `prev_hash` a `merkle_root`:
- **V blob:** Raw 64 ASCII bytes (hex string)
- **V core:** `self.prev_hash.as_bytes()` → padded to 64 bytes

Problém je, že **blob** je vytvořen funkcí `build_template_blob()` která:
1. Serializuje fields do bytes
2. Konvertuje na hex string

Ale **pool validator** pak:
1. Dekóduje hex string na bytes
2. Používá tyto bytes přímo

**To by mělo fungovat!** Zkontrolujme, jestli není jiný problém...

---

## 🔧 Další Diagnostika Potřebná

1. **Zkontrolovat merkle_root rekonstrukci v core submitblock**
2. **Porovnat byte-by-byte data v pool vs core**
3. **Ověřit, že coinbase TX je správně sestavena**

---

## 📁 Relevantní Soubory

| Soubor | Účel |
|--------|------|
| `2.9.5/zion-native/core/src/blockchain/block.rs` | Block header, calculate_hash() |
| `2.9.5/zion-native/core/src/algorithms/cosmic_harmony.rs` | Hash function s XOR |
| `2.9.5/zion-native/pool/src/shares/validator.rs` | Share validation, compute_hash() |
| `2.9.5/zion-native/core/src/jsonrpc/mod.rs` | submitblock handler |
| `zion_native_miner_v2_9.py` | Python miner s XOR fix |

---

## 🎯 Další Kroky

1. [ ] Přidat debug logging do core submitblock - vypsat přesná data před hash
2. [ ] Přidat debug logging do pool validator - vypsat přesná data před hash
3. [ ] Porovnat byte arrays a najít rozdíl
4. [ ] Opravit nesoulad
5. [ ] Rebuild + deploy + test

---

## 📈 Metriky

- **Shares accepted:** ~15,200
- **Shares rejected:** ~43,000 (stale/invalid)
- **Blocks found by pool:** 82
- **Blocks accepted by core:** 0
- **Current height:** 1 (genesis + 1)

---

**Status:** Pokračuje debugging  
**Priorita:** CRITICAL - Bloky musí být přijímány

