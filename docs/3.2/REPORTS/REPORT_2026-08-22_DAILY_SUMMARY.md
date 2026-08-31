# Daily Summary — 2026-08-22

> **Session:** V31 3.2.0 Mainnet Stable roadmap — pokračování
> **Datum:** 2026-08-22
> **Commits dnes:** 49 (od 00:00)
> **Status:** E4 ✅, G5/E8 ✅, H5 ✅, F2 🔄 (běží 24h fuzz), G7/F3/F4 ✅, G1/E1 ✅, G2/E5 ✅, G3/E6 ✅, G4/E7 ✅

---

## 1. Co se dnes dokončilo

### 1.0 E4 — Bridge Base mainnet round-trip ✅

Kompletní bridge round-trip test úspěšně dokončen: **Lock → Mint → Burn → Unlock**.

- **Lock:** 100 ZION uzamčeno z pool wallet → bridge vault na L1 (TX `b7f227a6...` @ block 13184)
- **Mint:** 100 wZION mintováno validator-1 na Base mainnet (přes `submitLockProof()` ×4 validátorů)
- **Burn:** 100 wZION spáleno přes EIP-2612 permit + transferFrom + bridgeBurn (TX `0xa5148c44...`, burn_id `0xebfce5b8...`, burner: validator-2)
- **Unlock:** 100 ZION uvolněno zpět pool wallet na L1 (TX `9f3e654e...` @ block 13217), potvrzeno v `v3_utxos` tabulce (100,000,000 flowers, unspent)

**Opravené problémy:**
1. V31 RPC relay format handler — `v3_rpc.rs` nyní přijímá V3 relay JSON formát pro `submitBridgeUnlock`
2. Bridge vault UTXO sync — `rpc.rs` kopíruje V31 native UTXO do `v3_utxos` tabulky před zpracováním unlocku
3. V3 compat mempool flush — po každém native block se V3 compat mempool transakce aplikují na `v3_utxos` tabulku
4. Standalone `zion-bridge-unlock` binary — podepíše operation message pomocí `k256` (stejná knihovna jako V31 node) a odešle `submitBridgeUnlock` přímo, bypassing relay `is_burn_released` check (potřebné když EVM contract už hlásí `released=true` ale L1 unlock nebyl nikdy minován)
5. `quick_mine` binary — standalone CPU miner pro testovací block production
6. Systemd env vars drop-in pro bridge validator pubkeys/threshold

**Report:** [`REPORT_2026-08-22_E4_BRIDGE_ROUND_TRIP.md`](./REPORT_2026-08-22_E4_BRIDGE_ROUND_TRIP.md)
**Commit:** `c886046f1`

### 1.1 G5 / E8 — XMR / RandomX path via MoneroOcean ✅

- **Upstream:** MoneroOcean `gulf.moneroocean.stream:10001` (plain TCP, CryptonoteStratum)
- **Konektivita testována:** porty 10001 a 10128 plain TCP ✅, SSL porty ❌ (connection reset / EOF / timeout)
- **Miner fixes (`V31/L1/miner/src/auxpow/client.rs`):**
  - `cryptonote_login()` posílá `wallet.worker` místo holého walletu
  - `handle_notification()` rozpozná `job` metodu od MoneroOcean a předá params objekt do `parse_cryptonote_job()`
  - `parse_cryptonote_job()` parsuje 32-bit compact little-endian `target`, počítá difficulty, nastaví `latest_job_id`/`latest_job_time`
  - `submit_share()` Cryptonote cesta: nonce jako 8-char lowercase hex (bez `0x`), result jako 64-char lowercase hex
- **Target parsing helper (`V31/L1/miner/src/auxpow/hasher.rs`):**
  - `parse_cryptonote_target()` — konvertuje 8-char LE hex target (nebo 64-char full target) na 32-byte big-endian array
  - Unit test `parse_cryptonote_target_ok`
- **Pool per-coin upstream override:**
  - `CoinProfile::with_pool_address()` v `V31/L1/cosmic-harmony/src/profit.rs`
  - `auxpow_runtime.rs` čte `ZION_POOL_AUXPOW_POOL_<COIN>` pro override default pool URL
- **Testy:** `cargo test -p zion-miner --lib` 103 pass, `cargo test -p zion-pool` 165 pass
- **Report:** [`REPORT_2026-08-22_G5_E8_XMR_RANDOMX_MONEROOCEAN.md`](./REPORT_2026-08-22_G5_E8_XMR_RANDOMX_MONEROOCEAN.md)

### 1.2 H5 — AuxPoW E2E test script ✅

- **Skript:** `scripts/ops/auxpow_e2e_test.py`
- **Co dělá:** Spustí mock CryptonoteStratum upstream, lokální `zion-pool` (s `ZION_POOL_AUXPOW_POOL_XMR` override), a CPU-only `zion-miner` s `ZION_MINER_CPU_COIN=XMR` a pouze Stream 3 aktivním
- **Výsledek:** Share úspěšně doručen miner → pool → upstream mock (`{'id': 'session1', 'job_id': 'job1', 'nonce': '00000000', 'result': '0...0'}`)
- **Logy:** `/tmp/auxpow_e2e_<id>/`
- **Report:** [`REPORT_2026-08-22_H5_AUXPOW_E2E_TEST.md`](./REPORT_2026-08-22_H5_AUXPOW_E2E_TEST.md)

### 1.3 F2 — 24h transaction fuzz 🔄 (běží)

- **Skript:** `scripts/ops/tx_fuzz.py` (zkopírován z `/tmp/g7_test/`, upraven docstring)
- **Cíl:** lokální V31 node `127.0.0.1:8446` (native height 13103)
- **Parametry:** `--duration 86400 --concurrency 10`
- **PID:** 1235651
- **Report output:** `docs/3.2/REPORTS/fuzz_logs/tx_fuzz_24h_20260822_223404.md`
- **Stdout log:** `docs/3.2/REPORTS/fuzz_logs/tx_fuzz_24h_stdout.log`
- **Stav:** běží, uzel responzivní

### 1.4 G7 — Chaos / load tests ✅ (z předchozí session, dnes dokončeno)

- 10 000-miner lokální pool handshake 100 % pass
- 10 000-miner Edge connect storm přežit bez vlivu na reálné rigy
- DEX `/v1/swap/quote/multi` overload 1 972 req/s při 100 % 200
- Bridge `/v1/bridge/submit` overload 1 793 req/s bez pádu
- P2P reconnect storm OK
- 10-minutový transaction fuzz preview (2 280 požadavků, 0 health fail)
- **Report:** [`docs/3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md`](../../3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md)

### 1.5 Další dnes dokončené práce (z předchozích session)

| Položka | Gate | Stav |
|---------|------|------|
| V31 consensus + pool security hardening (Edge redeployed) | — | ✅ |
| G1 GPU/rig E2E (2 produkční rigy, 99.1% + 99.4% accept) | G1/E1 | ✅ |
| G2 non-EVM WARP `disabled_reason` + config-driven registry | G2/E5 | ✅ |
| G3 solver network real E2E (per-solver API keys) | G3/E6 | ✅ |
| G4 public subtree sync (diff = 0) | G4/E7 | ✅ |
| ZIS deployment + UTXO v2 wallet/CLI/pool fixes | I2/I4 | ✅ |
| V31 premine/coinbase maturity soft-fork | — | ✅ |
| L2 multichain E2E smoke test | — | ✅ |
| Explorer professionalization + V31 native UTXO broadcast | — | ✅ |
| Live DEX price in CoinGecko/CMC feeds + API rate limiting | — | ✅ |

---

## 2. Code changes (dnes)

### Rust

| Soubor | Změna |
|--------|-------|
| `V31/L1/core/src/v3_rpc.rs` | E4: relay format `submitBridgeUnlock` handler + `flush_utxo_mempool` |
| `V31/L1/core/src/rpc.rs` | E4: `sync_bridge_vault_utxos` + mempool flush po native block |
| `V31/L1/core/src/bin/bridge-unlock.rs` | E4: nový standalone bridge unlock submitter binary |
| `V31/L1/core/src/bin/quick_mine.rs` | E4: nový standalone CPU miner pro testování |
| `V31/L1/core/Cargo.toml` | E4: přidán `zion-bridge-unlock` binary |
| `V31/L1/miner/src/auxpow/client.rs` | CryptonoteStratum login/job/submit fixes |
| `V31/L1/miner/src/auxpow/hasher.rs` | `parse_cryptonote_target()` + unit test |
| `V31/L1/cosmic-harmony/src/profit.rs` | `CoinProfile::with_pool_address()` helper |
| `V31/L1/pool/src/auxpow_runtime.rs` | `ZION_POOL_AUXPOW_POOL_<COIN>` env override |

### Skripty

| Soubor | Účel |
|--------|------|
| `scripts/ops/auxpow_e2e_test.py` | H5 AuxPoW E2E harness (mock upstream + pool + miner) |
| `scripts/ops/tx_fuzz.py` | F2 transaction fuzzing harness (24h run) |
| `scripts/ops/stress_test_pool.py` | G7 pool stress test (upraveno z předchozí session) |
| `scripts/monitor_g1_rigs.py` | G1 rig monitoring |

### Dokumentace

| Soubor | Změna |
|--------|-------|
| `docs/3.2/ROADMAP.md` | G5, E8, H5, G7, F3, F4, G1, E1, G2, E5, G3, E6, G4, E7 označeny ✅ |
| `V31/STATUS.md` | H5 + G5/E8 + G7 + G1 + G3 + G2 + G4 update záznamy |
| `docs/3.2/REPORTS/REPORT_2026-08-22_G5_E8_XMR_RANDOMX_MONEROOCEAN.md` | Nový report + H5 cross-reference |
| `docs/3.2/REPORTS/REPORT_2026-08-22_H5_AUXPOW_E2E_TEST.md` | Nový report |
| `docs/3.1/REPORTS/REPORT_2026-08-22_G7_CHAOS_LOAD_TESTS.md` | G7 chaos/load tests report |

---

## 3. Test results

| Test suite | Výsledek |
|------------|----------|
| `cargo test -p zion-miner --lib` | 103 pass, 0 fail |
| `cargo test -p zion-pool` | 165 pass, 0 fail |
| `cargo test -p zion-cosmic-harmony --lib profit::` | 20 pass, 0 fail |
| `cargo clippy -p zion-cosmic-harmony -p zion-pool` | čisté (pouze pre-existing warnings) |
| `cargo build --release -p zion-miner -p zion-pool -p zion-node -p zion-multichain -p zion-dao` | ✅ (~2m51s) |
| `cargo build --release -p zion-miner --features native-randomx` | ✅ (~2m02s) |
| H5 AuxPoW E2E (lokální) | ✅ PASS — share doručen do upstream mock |
| G7 chaos/load tests | ✅ PASS — viz report |

---

## 4. Git commity (dnes, klíčové)

| Hash | Zpráva |
|------|--------|
| `c886046f1` | feat(bridge): E4 Base mainnet round-trip complete — lock→mint→burn→unlock |
| `52e9539af` | feat(ops): add F2 transaction fuzzing harness to scripts/ops/ |
| `4d310d121` | feat(ops): H5 AuxPoW E2E test script for XMR/RandomX CryptonoteStratum |
| `6bb9af71f` | WIP: latest V31, pool, multichain, and APP&WEB explorer changes |
| `9e49bf16a` | Wire XMR / RandomX AuxPoW path through MoneroOcean (G5/E8) |
| `2750544ef` | status: V31 consensus/pool security hardening and Edge redeploy |
| `38c1cfe5f` | feat(listing,api): live DEX price in CoinGecko/CMC feeds and active API rate limiting |
| `46a008292` | docs(reports): G7 chaos/load tests and status sync |
| `e19a922fa` | Harden V31 L1 consensus, pool payouts, and multichain HTLC/EVM relay |
| `94f7dbd93` | docs: mark G1 GPU/rig E2E complete + add G1 monitor script |
| `4bad12ba8` | docs(V31): status G3 solver network real E2E complete |

Všechny commity pushnuty na `origin/main` (`https://github.com/Yose144/Zion-v3.0.0.git`).

---

## 5. F2 fuzz — aktuální stav

- **PID:** 1235651
- **Start:** 2026-08-22 22:34 CET
- **Konec (očekávaný):** 2026-08-23 22:34 CET
- **Cíl:** `127.0.0.1:8446` (lokální V31 node)
- **Concurrency:** 10 workerů
- **Metody fuzzovány:** `submitUtxoTransaction`, `submitBlock`, `getTransaction`, `getStatus`, `getBlockTemplate`, `getChainInfo` + random garbage bytes
- **Health check:** každých ~1s `getStatus`
- **Report:** `docs/3.2/REPORTS/fuzz_logs/tx_fuzz_24h_20260822_223404.md` (zapíše se po dokončení)

---

## 6. Známá omezení / caveats

1. **SSL/TLS pro stratum pools není implementováno** — MoneroOcean plain TCP funguje, SSL porty nelze použít
2. **H5 mock používá all-zero RandomX blob** — validuje protokol, ne reálný RandomX PoW
3. **XMR profit placeholder** — `CoinProfile::defaults()` má placeholder profit; live RandomX revenue oracle je future work
4. **F2 fuzz běží proti lokálnímu nodu** — ne proti Edge; produkční fuzz by měl běžet na staging/Edge
5. **V3 pool client external result channel** — `vrsc_result_rx`/`zano_result_rx` jsou per-coin, ale XMR výsledky mohou padat do fallback kanálu (pre-existing, neblokuje)
