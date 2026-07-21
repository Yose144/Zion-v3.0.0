# Hot-Switch RTM/XMR Share Acceptance — Report 2026-07-19

## Souhrn

Dnešní práce navazovala na [hot-switch funkcionality](./HOT_SWITCH_REPORT_2026-07-19.md) a řešila dvě hlavní třídy share rejection od upstream poolů:

1. **Stale job ID** — pool nepropagoval nové RTM/XMR joby minerům během `while !got_zion_response` session loop.
2. **Invalid share / Low difficulty share** — špatný share target výpočet pro GhostRider (RTM) a RandomX (XMR).

## Diagnostika a opravy

### 1. Stale job ID (RTM)

**Příčina:** Session loop v `server.rs` čeká v `while !got_zion_response` na ZION share response. Během této doby miner dostává starý external_stream_cpu job (s expirovaným `external_job_id`). RTM pool updatuje joby každých ~30s, takže miner často submituje share pro job ID který už upstream pool nezná.

**Oprava (`V3/L1/pool/src/bin/server.rs`):**
- Přidán **stale job check** před forwardováním share do upstream poolu.
- Pomocná metoda `MultiAuxPowBridge::job_ids_for_coin(&self, coin)` vrací všechny platné job IDs z queue (current + prev, max 2).
- Pokud share `external_job_id` není v `valid_job_ids`, share je rejectnut lokálně jako `stale_job` místo forwardování (které by stejně skončilo s "Invalid job id").
- Miner tak dostává rychlou zpětnou vazbu a může přepnout na nový job.

### 2. Invalid share / Low difficulty (RTM + XMR)

**Příčina A — GhostRider hash (RTM):** Miner binary byl buildován bez `native-ghostrider` feature → GhostRider hash fallbackoval na Blake3, což produkovalo nesprávné hashe. Upstream pool rejectoval jako "Invalid share".

**Oprava:**
- Miner rebuild s `cargo build --release -p zion-miner --features "native-ghostrider,native-randomx"`.
- Binárka v `target/release/zion-miner` (4.9 MB) obsahuje real GhostRider C implementaci (sphlib + CryptoNight z `csrc/ghostrider/real/`).
- Po rebuildu: 2/13 RTM shares accepted upstream poolem (zbytek stale_job — viz oprava #1).

**Příčina B — Share target výpočet (`AuXpow/src/auxpow_client.rs`):**
- `share_target()` pro GhostRider používal `max_target = [0xFF; 32]` (generic else branch) místo `RTM_POW_LIMIT`.
- Pro difficulty < 1.0 došlo k overflow → all-FF target → miner dostal nejtěžší možný target → share byl "Low difficulty".

**Oprava:**
```rust
} else if self.profile.algorithm.eq_ignore_ascii_case("ghostrider")
    || self.profile.coin == ExternalCoin::RTM
{
    RTM_POW_LIMIT
}
```

**Příčina C — Multiplexer target propagation (`AuXpow/src/multiplexer.rs`):**
- `current_job()` a `wait_for_job()` vždy volaly `client.share_target()` (computes from difficulty).
- Pro RandomX (XMR) a GhostRider (RTM) upstream pool posílá target přímo v job notifikaci (ne přes `mining.set_difficulty`).
- Nová funkce `effective_share_target()` používá `job.target_bytes` pro randomx/ghostrider, fallback na `client.share_target()` pro ostatní coiny.

**Oprava:**
```rust
async fn effective_share_target(client: &AuxPowClient, job: &ExternalJob) -> [u8; 32] {
    let algo = client.profile().algorithm.to_ascii_lowercase();
    if algo == "randomx" || algo == "ghostrider" {
        job.target_bytes
    } else {
        client.share_target().await
    }
}
```

### 3. RandomX fallback (XMR)

**Příčina:** Miner binary buildovaný bez `native-randomx` → RandomX hash fallbackoval na Blake3 → nesprávné hashe → "Low difficulty share".

**Oprava:** Stejný rebuild jako v Příčině A — `--features "native-ghostrider,native-randomx"`.

**Verifikace:** `zion-miner --randomx-bench` → 1696 H/s na M1 (real tevador/RandomX, JIT + hard AES).

## Test results

### RTM (Raptoreum / GhostRider) — VERIFIKOVÁNO
- Pool: `ghostrider.eu.mine.zpool.ca:5354` (stratum, zpool)
- Target: `00031fffcdfffffffb50004b...` (správný, odvozen z `mining.set_difficulty=0.02` pomocí `RTM_POW_LIMIT`)
- Výsledky:
  - **4 RTM shares accepted** upstream poolem (23:57:28–23:57:40)
  - **1 RTM share accepted** v dalším testu (01:20:53) po návratu na zpool
  - První shares jsou rejectnuty jako "Invalid job id" (stale job transition) a "Invalid share" (miner se synchronizuje s novým jobem)
  - Po stabilizaci job queue: shares accepted
- MiningBoard (`stratum.miningboard.com:4444`) odmítal vše jako `low difficulty share` — pravděpodobně nepodporuje `mining.set_difficulty < 1.0` a používá block target z `nbits` (mnohem těžší). Zůstáváme na zpool.
- GhostRider hash je správný (native C impl na ARM64, sphlib + CryptoNight)
- `share_forwarder.rs`: `meets_target_little_endian` pro RTM (hash LE od wrapperu, target BE) — po pokusu s `meets_target` vráceno zpět, jinak všechny shares `below_target`
- **Status: RTM share acceptance VERIFIED**

### XMR (Monero / RandomX) — VERIFIED
- Pool: `moneroocean.stream` (cryptonote stratum)
- Target: `b88d0600` (LE 64-bit, ~difficulty 10000)
- Debug logging potvrdil:
  - `mix_hash_hex=None` pro XMR shares → `result_hex = _hash_hex` (žádný mix_hash bug)
  - `hash_hex` v `try_forward` = `hash_hex` v `submit_share` (stejný hash pro target check i odeslání)
  - `meets_randomx_target` vrací `true` pro nalezené shary (např. `hash_msb=0x0001a194d885d9fb < target_le=0x00068db8bac710cb`)
- Verifikace 2026-07-20 (06:29 UTC):
  - Miner: `m1-test` na Apple Silicon M1 (macOS), `zion-miner` build s `--features native-randomx`
  - Po návratu k nativní RandomX implementaci začaly MoneroOcean vracet `{"result":{"status":"OK"}}`.
  - Příklady accepted share odpovědí:
    - `job_id=13006571` nonce `249721584` → `{"error":null,"id":512,"jsonrpc":"2.0","result":{"status":"OK"}}`
    - `job_id=13009015` nonce `249702720` → `{"error":null,"id":513,"jsonrpc":"2.0","result":{"status":"OK"}}`
  - `session_status` v miner logu: `accepted=8 rejected=0 accept_pct=100.00`.
  - Omezení: při dlouhých RandomX batchech může share dorazit pro již neplatný job (`Invalid job id` / `Block outdated`). Řešeno zmenšením `ZION_EXT_CPU_RANDOMX_NONCE_COUNT=2000` a `ZION_EXT_CPU_RANDOMX_THREADS=4` pro rychlejší reakci na nové joby.
- RandomX hash je správný (verifikováno benchmarkem — 1696 H/s na M1).
- **Status: XMR share acceptance VERIFIED**

## Změněné soubory

| Soubor | Změna |
|--------|-------|
| `AuXpow/src/types.rs` | RTM default pool vrácen na zpool (`ghostrider.eu.mine.zpool.ca:5354`) |
| `AuXpow/src/auxpow_client.rs` | `share_target()` používá `RTM_POW_LIMIT` pro GhostRider; debug logging pro XMR submit |
| `AuXpow/src/multiplexer.rs` | `effective_share_target()` — používá job target pro randomx/ghostrider |
| `AuXpow/src/share_forwarder.rs` | Debug logging — full hash_hex v try_forward pro XMR; RTM target check `meets_target_little_endian` |
| `V3/L1/pool/src/bin/server.rs` | Stale job check + `job_ids_for_coin()` helper |
| `V3/L1/miner/src/main.rs` | Miner job handling pro multi-coin CPU stream |
| `V3/L1/miner/src/gpu_backend.rs` | GPU backend minor fixes |

## Build příkaz

```bash
# Miner s nativními CPU algoritmy (GhostRider + RandomX)
cargo build --release -p zion-miner --features "native-ghostrider,native-randomx"

# Pool (server)
cargo build --release -p zion-pool
```

## Runtime konfigurace pro M1 XMR test

Pro rychlou reakci na změny jobu od MoneroOcean byly nastaveny:

```bash
ZION_EXT_CPU_RANDOMX_THREADS=4
ZION_EXT_CPU_RANDOMX_NONCE_COUNT=2000
```

Tím se RandomX batch dokončí do několika sekund a miner rychle přejme na nový `wire_job`, čímž se minimalizuje `Invalid job id` / `Block outdated`.

## Další kroky

1. ~~**XMR test**~~ — VERIFIED. Miner `m1-test` posílá XMR shary na MoneroOcean a dostává `status=OK`.
2. **RTM stale job tolerance** — miner se stuckne na starém jobu 3+ minuty. Možná řešení:
   - Pool by měl posílat `wire_job` update i během `while !got_zion_response` (nejen na začátku iterace).
   - Nebo miner by měl periodicky žádat o nový job.
3. **Vyřešit `local-miner` spam** — `external_share_result miner=local-miner` generuje tisíce rejected shares (`Invalid job id` / `Block outdated`), což zatěžuje MoneroOcean spojení. Identifikovat a zastavit zdroj (pravděpodobně lokální testovací miner nebo reconnect smyčka na `127.0.0.1`).
4. ~~Commit + push~~ — hotovo.

## Historie commitů

- `aa47652f6` — fix(auxpow+pool): RTM/XMR share acceptance — stale job check + correct share target
- `cf24049e4` — feat(auxpow): RTM share acceptance verified + XMR debug logging
- Nový commit — RTM zůstává na zpool, MiningBoard nepodporuje `difficulty < 1.0`, zaznamenáno v reportu
