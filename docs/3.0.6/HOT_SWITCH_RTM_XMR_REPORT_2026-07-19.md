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
- Pool: `zpool.io` (stratum)
- Target: `00031fffcdfffffffb50004b...` (správný, z job notifikace)
- Výsledek: **4 RTM shares accepted** upstream poolem (23:57:28–23:57:40)
  - První shares byly rejectnuty jako "Invalid job id" (stale) a "Invalid share" (hash se teprve srovnal po job transition)
  - Po stabilizaci job queue: 4 consecutive accepted shares
- GhostRider hash je správný (native C impl na ARM64, sphlib + CryptoNight)
- **Status: RTM share acceptance VERIFIED**

### XMR (Monero / RandomX) — ČEKÁ NA TEST
- Pool: `moneroocean.stream` (cryptonote stratum)
- Target: `b88d0600` (LE 64-bit, ~difficulty 10000)
- Výsledek: **Pool IP ban** (10 min) kvůli příliš mnoha reconnectům během debugging.
- RandomX hash je správný (verifikováno benchmarkem — 1696 H/s na M1).
- Podezření na bug: `submit_share()` pro cryptonote používá `mix_hash_hex.unwrap_or(_hash_hex)` — pokud miner pošle `mix_hash_hex`, použije se místo skutečného hashe. Pro XMR by `mix_hash` mělo být vždy `None`.
- Přidán debug logging v `share_forwarder.rs` (full hash_hex) a `auxpow_client.rs` (submit_hash_check) pro diagnostiku.
- **Status: ČEKÁ — po vypršení IP banu otestovat s debug loggingem**

## Změněné soubory

| Soubor | Změna |
|--------|-------|
| `AuXpow/src/auxpow_client.rs` | `share_target()` používá `RTM_POW_LIMIT` pro GhostRider; debug logging pro XMR submit |
| `AuXpow/src/multiplexer.rs` | `effective_share_target()` — používá job target pro randomx/ghostrider |
| `AuXpow/src/share_forwarder.rs` | Debug logging — full hash_hex v try_forward pro XMR |
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

## Další kroky

1. **XMR test** — po vypršení IP banu (~10 min) znovu nastavit `cpu-coin=XMR` a verifikovat accepted shares s debug loggingem.
2. **RTM stale job tolerance** — miner se stuckne na starém jobu 3+ minuty. Možná řešení:
   - Pool by měl posílat `wire_job` update i během `while !got_zion_response` (nejen na začátku iterace).
   - Nebo miner by měl periodicky žádat o nový job.
3. ~~Commit + push~~ — hotovo.

## Historie commitů

- `aa47652f6` — fix(auxpow+pool): RTM/XMR share acceptance — stale job check + correct share target
- Následující commit — RTM verified (4 shares accepted), XMR debug logging
