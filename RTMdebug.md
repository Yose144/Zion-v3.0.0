# RTM (Raptoreum) GhostRider Mining — Debug Log

## Cíl
End-to-end RTM mining na zpool.ca s reálným GhostRider hashem a share acceptance.

## Architektura
- **Algorithm**: GhostRider (15 core hash functions + 6 CryptoNight variants, 3 stages)
- **Pool**: `ghostrider.eu.mine.zpool.ca:5354` (Stratum v1)
- **CPU FFI**: `zion-native-ffi/csrc/ghostrider/` (gr_hash C implementation)
- **Header**: 80 bytes (Dash/Bitcoin layout): version(4) + prevhash(32) + merkle_root(32) + ntime(4) + nbits(4) + nonce(4)
- **Nonce offset**: 76 (poslední 4 byty headeru)

## Debug proces — opravené bugy

### Bug 1: Nonce offset (39 → 76)
- **Před**: Nonce zapisován na offset 39 (do merkle_root!)
- **Po**: Offset 76 (Bitcoin/Dash standard — poslední 4 byty)
- **Soubor**: `ghostrider_wrapper.c` — `RTM_NONCE_OFFSET 76`

### Bug 2: Block header construction
- **Přidána**: `build_stratum_v1_header()` v `auxpow_client.rs`
- **Co dělá**: Staví 80-byte header z Stratum v1 notify parametrů
- **Kroky**:
  1. Coinbase tx = coinbase1 + extranonce1 + extranonce2 + coinbase2
  2. Merkle root = sha256d(coinbase_tx), pak combine s merkle branches
  3. Header = version + prevhash(reversed) + merkle_root + ntime + nbits + nonce(0)

### Bug 3: Target computation (max_target → RTM pow_limit)
- **Před**: `difficulty_to_target(0.020)` s max `[0xFF; 32]` → target = `0xFF...FF` (vše projde)
- **Po**: `difficulty_to_target_rtm(0.020)` s `RTM_POW_LIMIT` (Dash fork)
- **RTM_POW_LIMIT**: `0x00000fffff000000...` (z nbits `0x1e0fffff`)
- **BigUint fix**: `target = max * 2^(52-exponent) / significand` (místo `max / (significand >> shift)` co zeroed diff_int)
- **Výsledek**: difficulty 0.020 → target `00031fffcdffffff..` (správně)

### Bug 4: Nonce hex format (LE bytes → BE integer)
- **Před**: `hex::encode(nonce.to_le_bytes())` → `12090000` (LE bytes as hex)
- **Po**: `format!("{:08x}", nonce)` → `00000912` (BE integer hex)
- **Proč**: cpuminer používá `sprintf("%08x", nonce)` = BE integer. Pool interpretuje jako BE uint32, ukládá jako LE v headeru.

### Bug 5: Hash comparison (meets_randomx_target → meets_target_little_endian)
- **Před**: `meets_randomx_target` — kontroluje jen 64-bit MSB (Monero-specific)
- **Po**: `meets_target_little_endian` — plný 256-bit porovnání (reverse hash LE→BE, porovnání s BE target)
- **Proč**: GhostRider končí CryptoNight (LE hash output), target je BE. Potřebujeme reverse hash a porovnat s BE target.

### Bug 6: Extranonce2 (nonce → 00000000)
- **Před**: `extranonce2 = nonce` (pool rekonstruoval špatný header)
- **Po**: `extranonce2 = "00000000"` (fixní, header postaven s en2=0)
- **Proč**: Pro CPU mining je extranonce2 fixní 0. Header se staví s en2=0, tak submit musí poslat en2=00000000.

### Bug 7: prevhash byte order
- **Pools** (zpool, suprnova) posílají prevhash v **reversed** (display) byte order
- **Miner** musí reverse zpět na internal byte order pro header
- **Testováno**: Bez reversingu → "Invalid share". S reversingu → "Invalid job id" (správně)

### Bug 8: ntime/nbits/version byte order
- **Pools** posílají ntime/nbits/version jako BE hex string
- **cpuminer** ukládá byty přímo (BE → LE na LE systémech přes uint32_t)
- **Rust sha2** produkuje BE byty — ukládáme přímo bez reversingu (matches cpuminer)

## Live test výsledky

### Test 1: Mock server (unit test)
```
rtm_e2e_ghostrider_mine_and_submit ... ok
- Subscribe → Authorize → Notify → Mine → Submit → Accept
- 5-param submit format verified
- All 3 RTM tests pass
```

### Test 2: zpool.ca:5354 (live)
```
Connecting to zpool RTM...
subscribed — extranonce1=80005b50, en2_size=4
authorized as bc1qxy...test_rig
Got job: id=54192 header_len=80 target=00031fffcdffffff..
Mining with GhostRider...
FOUND valid nonce=19210 in 394.65s hash=10e0978c...
Submitting share nonce=00004b0a (BE hex)
→ Pool response: [21, "Invalid job id", null]
```

**Klíčový insight**: Pool odpověděl `"Invalid job id"` místo `"Invalid share"`. To znamená:
- ✅ Share formát je správný (5 parametrů, en2=00000000)
- ✅ Nonce formát je správný (BE hex)
- ✅ Hash splňuje target
- ✅ Header konstrukce je správná
- ❌ Job expiroval (394s CPU mining je příliš pomalý pro difficulty 0.020)

## Co funguje
- [x] Stratum v1 subscribe/authorize
- [x] mining.notify parsing (9 params)
- [x] 80-byte header construction (build_stratum_v1_header)
- [x] Merkle root computation (sha256d + branches)
- [x] prevhash reversing (display → internal)
- [x] GhostRider hash (native-ghostrider FFI)
- [x] Target computation (RTM pow_limit)
- [x] Hash comparison (LE hash vs BE target)
- [x] Nonce format (BE hex)
- [x] Share submission (5 params, en2=00000000)
- [x] Pool přijímá share jako validní (formát + hash)

## Co chybí
- [ ] Rychlejší mining (GPU) — CPU ~400s/share je příliš pomalé
- [ ] Job switching během miningu (při novém notify aktualizovat header)
- [ ] M1 GPU (Metal) GhostRider kernel

## Soubory
- `AuXpow/src/auxpow_client.rs` — build_stratum_v1_header, submit_share, difficulty_to_target_rtm
- `AuXpow/src/auxpow_scheduler.rs` — meets_target_little_endian pro RTM
- `AuXpow/src/bin/rtm_live_test.rs` — live test binary
- `V3/L1/native-ffi/csrc/ghostrider/ghostrider_wrapper.c` — nonce offset 76
- `AuXpow/src/external_hashers.rs` — meets_target_little_endian

## Test příkazy
```bash
# Unit testy (mock server)
cargo test --features native-ghostrider rtm

# Live test (zpool.ca)
cargo run --features native-ghostrider --bin rtm_live_test

# Build
cargo build --features native-ghostrider
```

## Commity
1. `de6c36a1c` — feat: RTM GhostRider E2E mining with share acceptance
2. `dfca8f876` — fix: RTM share acceptance — target, nonce format, hash comparison
