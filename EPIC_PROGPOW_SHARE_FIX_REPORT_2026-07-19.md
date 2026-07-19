# EPIC ProgPow Share Acceptance Fix Report — 2026-07-19

## Souhrn

Tento report shrnuje kompletní opravu EPIC ProgPow share submission pipeline — od dedicated TLS connection přes stale job forwarding až po full ProgPow hash verifikaci na poolu. Po všech fixech EPIC shares dostávají reálné odpovědi od upstream poolu a false positives jsou filtrovány lokálně místo plýtvání ~14-min share okny na "low difficulty" rejectech.

---

## Problém

EPIC ProgPow shares byly rejectovány třemi různými způsoby:

1. **`status=unknown`** — TLS EOF race condition mezi poll loopem a submit pokusy
2. **`Solution submitted too late`** — stale jobs (pool posílal job každých ~14s, EPIC okno je ~10-15s)
3. **`Share rejected due to low difficulty`** — GPU kernel `keccak_f800` u64 pre-check produkuje false positives

---

## Opravy

### Fáze 2: Dedicated one-shot TLS submit connection (commit `736ae9fb7`)

**Problém:** EPIC upstream pool zavírá TLS každých ~10-15s. Sdílené poll-loop connection raced s tímto close timerem → TLS EOF na každém submit pokusu (3 retry, všechny failly → `status=unknown`).

**Oprava:** Nová metoda `epic_submit_dedicated()` v `auxpow_client.rs` (line ~4087) otevírá fresh TLS connection, login, submit, read response, close — vše v controlled lifecycle. EPIC shares jsou ~14 min apart, extra TLS handshake (~100ms) je zanedbatelný.

**Výsledek:** Shares dostávají reálné odpovědi: `rejected: Solution submitted too late` a `rejected: Share rejected due to low difficulty` — žádné `status=unknown`.

### Fáze 2c: Stale EPIC share fix (commit `1b7a0d454`)

**Problém:** Main loop forwardoval EPIC jobs do external GPU threadu jednou za iteraci (~14s). EPIC pool job okno je ~10-15s, takže shares pro staré jobs byly rejectovány jako "too late".

**Oprava:** `pool_io_thread()` v `V3/L1/pool/src/bin/server.rs` (line ~4002) nyní přijímá `ext_gpu_tx` a `ext_cpu_tx` sendery a forwarduje external_stream jobs okamžitě po přijetí, před odesláním do main loopu.

**Výsledek:** External GPU thread dostává nové EPIC jobs každých ~10s místo ~14s.

### Fáze 2d: Full ProgPow hash verifikace na poolu (commit `1683f21ec`)

**Problém:** GPU kernel `keccak_f800` u64 pre-check produkuje false positives. Hash byl nastaven na `[0u8; 32]` (nuly) pro DAG algoritmy (`gpu_miner.rs` line 1274-1277), což prošlo pool `meets_target` checkem (nuly ≤ jakýkoliv target), ale EPIC pool přepočítá reálný hash z nonce + mix_hash a rejectuje s "low difficulty".

**Oprava:**

1. **Nové funkce v `external_hashers.rs`** (lines 399-455):
   - `ethash_final_hash(header_hash, nonce, mix_hash)` — počítá `keccak256(keccak512(header || nonce_le) || mix_hash)` bez potřeby DAG
   - `ethash_header_hash(pre_pow)` — keccak256-hashuje raw pre_pow (548 bytů pro EPIC) na 32-byte header_hash

2. **`ShareForwarder::try_forward()`** aktualizována o `algorithm` a `header_bytes` parametry. Pro DAG algoritmy (ProgPow/Ethash/KawPow) přepočítá reálný final hash z header + nonce + mix_hash, ověří ho proti targetu, a dropne false positives lokálně před submitováním upstream.

3. **`ShareForwardRequest`** rozšířen o `algorithm` a `header_bytes` pole, populovaná z `JobPackage` / `ExternalStreamJob` na obou construction sitech.

**Výsledek (live pool log 14:37:12):**
```
auxpow: dag_hash_recomputed algo=progpow nonce=1130359175 kernel_hash=0000000000000000 real_hash=ef23b54a5f863372 mix=2967ffe3a6ab74bc
auxpow: dag_share_below_real_target algo=progpow nonce=1130359175 real_hash=ef23b54a5f863372 target=00000001b7cdfd9d — GPU kernel u64 pre-check false positive, dropping
```

GPU kernel u64 pre-check našel "solution" (kernel_hash=zeros prošlo starým lokálním checkem), ale reálný ProgPow final hash (`ef23b54a...`) je nad targetem (`00000001b7cdfd9d`). Pool nyní dropne false positive lokálně — **žádné další plýtvání EPIC share okny na "low difficulty" rejectech**.

---

## Testy

- **4 nové unit testy** pro `ethash_final_hash` a `ethash_header_hash` — všechny pass
- **3 existující share_forwarder testy** aktualizovány pro novou signaturu — všechny pass
- **Pool build** — clean compile (jen existující warnings)
- **Live deployment** — Pool restart 14:33, miner restart 14:35, false positive zachycen 14:37

---

## Změněné soubory

| Soubor | Změna |
|--------|-------|
| `AuXpow/src/external_hashers.rs` | +`ethash_final_hash()`, +`ethash_header_hash()`, +4 unit testy |
| `AuXpow/src/share_forwarder.rs` | `try_forward()` +algorithm/header_bytes, DAG hash recompute, false positive drop |
| `AuXpow/examples/e2e_pool_test.rs` | Aktualizován call site pro novou signaturu |
| `V3/L1/pool/src/bin/server.rs` | `ShareForwardRequest` +algorithm/header_bytes, 2 construction sitey, 2 call sitey |

---

## Commity

| Commit | Popis |
|--------|-------|
| `736ae9fb7` | Fáze 2: EPIC dedicated one-shot TLS submit connection |
| `1b7a0d454` | Fáze 2c: Forward external_stream jobs directly from pool_io_thread |
| `fa99a5d79` | Fix start-local-miner.sh build features |
| `1683f21ec` | Fáze 2d: Verify ProgPow/Ethash final hash on pool before upstream submit |

---

## Aktuální stav

- **EPIC share_diff:** 2,500,000,000 (~14 min expected per share at current hashrate)
- **src_progpow stats (pre-fix):** 8 submits, 0 accepted (2 "too late", 1 "low difficulty", 5 unknown)
- **src_progpow stats (post-fix):** False positives dropovány lokálně, čekáme na reálný share který projde verifikací
- **Pool:** `zion-edge-pool.service` na Edge serveru (62.171.141.136), binary deployed 14:33
- **Miner:** `screen zion-miner` na zionserver-144, autonomous mode (EPIC GPU + VRSC CPU)

---

## Další kroky

1. **Monitor EPIC shares** — čekat na reálný share (30-60 min) který projde `ethash_final_hash` verifikací a bude acceptován upstream
2. **Fáze 4:** Autotune GPU scheduling (Deeksha + ProgPow time-slicing)
3. **Fáze 5:** Konsolidace Deeksha variants (trait-based dispatch)
4. **Fáze 6:** Sjednotit GPU backendy (miner vs AuXpow)

---

*Report generated by Devin — ZION V3 Mainnet Beta, 2026-07-19.*
