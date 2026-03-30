# RandomX (XMRig) – Monero Stratum Compatibility

**Status:** ✅ **LOGIN FIXED** • ✅ **CONNECTION STABLE** • ✅ **SUBMIT/VALIDATION ENABLED**  
**Update (2.11.2025 16:10):** Přidána reálná RandomX validace sdílených výsledků: 64bit target-check + volitelná re‑komputace hash (pokud je dostupná knihovna). Heartbeat/timeout fix potvrzen → žádné odpojování po 60s.  
**Note:** Periodic jobs jsou posílány primárně při změně výšky (height). Keepalive (ping) udržuje spojení.

## Production Status (2.11.2025 14:17)

### ✅ Fixed - Login Response
- **blob:** Správně 152 hex (76 bytes), začíná `0d00` (RandomX era)
- **target:** Správně 16 hex (8 bytes LE)
- **seed_hash:** Nenulový, 64 hex znaků
- **Login:** XMRig přijímá bez error code 5

**Test výstup:**
```json
{
  "id": 1,
  "job": {
    "job_id": "zion_rx_000001",
    "blob": "0d00016807690000...0000", // 152 hex ✅
    "seed_hash": "dd2847a343ad8d...", // 64 hex ✅
    "target": "703d0ad7a3703d0a",      // 16 hex ✅
    "height": 2
  },
  "status": "OK"
}
```

### 🔄 Periodic Jobs – Stav

- Pool generuje template-backed joby ~každých 18 s.  
- Odeslání nového jobu probíhá při změně výšky bloku (height change).  
- Pokud se výška nemění (lokální testnet), XMRig zůstává připojen díky keepalive (ping).  
- Fix: Server nyní posílá heartbeat dřív, než dojde k read timeoutu, a neukončí idle spojení.

## Implemented Features

1. **RPC server hashing blob** ✅
   - `zion/rpc/server.py::_create_hashing_blob` builds 76-byte Monero-like blob
   - Layout: [major=0x0d][minor=0x00][timestamp LE 4B][prev_hash 32B][merkle_root 32B][nonce 4B]
   - Returns 152 hex chars as `blockhashing_blob` in `getblocktemplate`

2. **Pool hashing blob builder** ✅
   - `src/core/zion_universal_pool_v2.py::build_monero_hashing_blob` 
   - Mirrors RPC layout for XMRig compatibility
   - `create_randomx_job` uses builder when template available

3. **Target encoding** ✅
   - 8-byte little-endian hex (16 chars) from 64-bit target
   - Correctly calculated from pool difficulty

4. **Monero-style login handler** ✅
   - `handle_monero_login()` accepts XMRig protocol
   - Returns job in login response per Monero Stratum

## Next Steps (Priority Order)

1. **🔥 DONE: Stabilizovat idle spojení**
   - Reorder heartbeat vs. read-timeout v `handle_client()`  
   - Ověřeno: žádný read timeout po 60s, připojení drží

2. **NEXT: Periodic job policy**
   - Volitelně posílat refresh job i bez změny height (např. každých 60–90 s)  
   - Nebo snížit heartbeat interval dle chování XMRig
   
2. **Seed handling** ⏳
   - Align `seed_hash`/`next_seed_hash` with RandomX epoch boundaries
   - Currently using prev_hash/merkle_root as seed (works but not epoch-aligned)

3. **Submit/validation path** ✅
   - Server přijímá `nonce` a `result` (32B) z XMRig
   - Minimální jistota: 64bit Monero-style target check nad `result`
   - Volitelně: pokud je dostupná Python RandomX knihovna (`pyrx`/`randomx`), dojde k re‑komputaci hashe z `blob+nonce` a `seed_hash` a porovnání s `result`
   - Po úspěchu se zapíše share, VarDiff se přizpůsobí a běží odměny/XP
   - Nouzový přepínač: `ZION_RANDOMX_ACCEPT_ALL=1` (pouze pro bring‑up)

4. **RPC wiring** ⏳
   - Source `blockhashing_blob` directly from RPC
   - Ensure single canonical blob builder

## References (implementation notes)
- Cryptonote varint encoding, header fields order.
- Monero Stratum job shapes for RandomX (XMRig).

## Validation
- XMRig accepts login (no code 5) and keeps connection (no 60s disconnect).
- Shares are validated: minimálně přes 64bit target check; pokud je k dispozici RandomX knihovna, probíhá i re‑komputace.
- Node height/block mining proběhne po dosažení prahu sdílených výsledků.

## Notes
- Our temporary Yescrypt path is production-friendly and energy-efficient; RandomX will be re-enabled once the hashing blob builder is in place.
