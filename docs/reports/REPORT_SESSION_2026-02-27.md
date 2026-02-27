# Session Report — 2026-02-27

## Přehled

Cíl session: opravit Octopus build, přidat podporu ZANO/ProgPowZ coinů, opravit Windows TCP connectivity problémy a live test ZANO dual miningu.

---

## Commity této session

| Hash | Typ | Popis |
|------|-----|-------|
| `d1c321b` | feat | ZANO přidán do ProfitSwitcher (preferred_coins, WTM map, fallback) |
| `6c82567` | fix  | spawn_blocking TCP connect v stratum/mod.rs (Windows DNS issue) |
| `f901ce3` | feat | ZANO/ProgPowZ podpora: NativeAlgorithm, DualMode, ExternalCoin |
| `a9c6486` | fix  | native-octopus build — přejmenování underscore params (E0425) |

---

## Detaily změn

### 1. `a9c6486` — Octopus build fix

**Problém:** 5× `E0425 cannot find value in this scope` v `native_algos.rs`:
- `verify_hash()` a `benchmark()` měly parametry `_header`, `_nonce`, `_height`, `_target`, `_iterations` (s podtržítkem)
- match arms je referencovaly bez podtržítka → kompilátor hodil E0425

**Oprava:**
- Přejmenování všech 5 parametrů (odebráno podtržítko)
- `let algos` → `let mut algos` v `available_algorithms()`
- Build: 0 errors ✅

---

### 2. `f901ce3` — ZANO/ProgPowZ podpora

**Co je ZANO ProgPowZ:**
- Zano coin používá standardní ProgPow 0.9.2 (period_length=50, num_regs=32, num_lanes=16)
- Identické konstanty jako ProgPow — stačí přesměrovat na `progpow_ffi`

**Přidáno:**

**`L1/miner/src/miner/native_algos.rs`:**
- `NativeAlgorithm::ProgPowZano` variant
- `compute_hash()`, `verify_hash()`, `benchmark()` dispatch pro ProgPowZano
- `available_algorithms()` — doplněny chybějící varianty (EPIC, ZANO, DCR, Octopus)

**`L1/miner/src/stratum/ethstratum.rs`:**
- `ExternalCoin::ZANO`
- `name()` → `"ZANO"`, `algorithm()` → `"progpowz"`
- `from_str()` → přijímá `"zano"|"zan"|"progpowz"|"progpow-zano"`
- `default_pool_url()` → `"zano.herominers.com:1110"` (HeroMiners, ověřeno)

**`L1/miner/src/miner/dual_stream.rs`:**
- `DualMode::ZanoDual` variant, `--dualmode ZANODUAL`
- `default_pool_url()` → `"zano.herominers.com:1110"`
- `is_dag_algo()` → obsahuje ZanoDual
- Docs tabulka doplněna

---

### 3. `6c82567` — Windows TCP spawn_blocking fix

**Problém:** Tokio async TCP (`TcpStream::connect().await`) selhával s `os error 11001 (WSAHOST_NOT_FOUND)` na Windows — a to i pro IP adresy. Chyba vycházela z Tokio async DNS/TCP stacku specificky pro toto Windows prostředí.

**Diagnóza:**
- `Test-NetConnection zano.herominers.com -Port 1110` → `True` ✅
- `Test-NetConnection 77.42.31.72 -Port 3333` → `True` ✅
- Tokio async → `11001` ❌
- `std::net::TcpStream::connect_timeout` → OK ✅

**Oprava v obou stratum clientech:**

```rust
// Nahrazuje: TcpStream::connect(&url).await?
let pool_url = self.pool_url.clone();
let std_stream = tokio::task::spawn_blocking(move || {
    use std::net::ToSocketAddrs;
    let addrs: Vec<_> = pool_url.to_socket_addrs()...collect();
    for addr in &addrs {
        match std::net::TcpStream::connect_timeout(addr, Duration::from_secs(30)) {
            Ok(s) => { s.set_nonblocking(true).ok(); return Ok(s); }
            Err(e) => { ... }
        }
    }
    Err(anyhow!("All addresses unreachable"))
}).await??;
let stream = TcpStream::from_std(std_stream)?;
```

**Opravené soubory:**
- `L1/miner/src/stratum/ethstratum.rs` (externí pool klienti)
- `L1/miner/src/stratum/mod.rs` (hlavní ZION pool klient)

---

### 4. `d1c321b` — ZANO v ProfitSwitcher

**`L1/pool/src/profit_switcher.rs`:**
- `preferred_coins` default — ZANO přidán mezi CFX a CLORE
- `coin_map` WhatToMine parseru — `"Zano" → "ZANO"`
- `estimate_profitability_fallback` — `("ZANO", "progpowz", 36.0)` (pod CFX 42.0)

---

## Live Test výsledky

**Příkaz:**
```powershell
.\target\release\zion-miner.exe `
  --pool 77.42.31.72:3333 `
  --wallet zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p `
  --dualmode ZANODUAL `
  --dualpool zano.herominers.com:1110 `
  --dualuser ZxCYsxcGCUAUoRYA9W8Kc7Htz72AXuqVN4bHC3ue6tZti4zo2TRNA9FebhVy5qDsUr911XQ3hEALfAQHYLhQ4aa82zJiUHgZ8 `
  --dual-alloc 0.30
```

**Výsledek:**
- ZION pool (`77.42.31.72:3333`) — připojen ✅, hashrate ~1.5 MH/s
- ZANO pool (`zano.herominers.com:1110`) — stream spuštěn ✅
- Žádné DNS chyby, žádné auth chyby

---

## Adresy

| Účel | Adresa |
|------|--------|
| ZION pool (Helsinki Hetzner) | `77.42.31.72:3333` |
| ZANO pool (HeroMiners) | `zano.herominers.com:1110` |
| ZANO wallet (test) | `ZxCYsxcGCUAUoRYA9W8Kc7Htz72AXuqVN4bHC3ue6tZti4zo2TRNA9FebhVy5qDsUr911XQ3hEALfAQHYLhQ4aa82zJiUHgZ8` |

---

## Stav projektu po session

- **Verze**: v2.9.6 TerraNova
- **Commity před session**: 10 (origin/main)
- **Commity po session**: 14 (HEAD → main, 4 nové commity)
- **Build**: clean, 0 errors (pouze warnings)

### Podporované dual mody

| --dualmode | Coin | Algoritmus | Pool |
|-----------|------|-----------|------|
| ALEPHDUAL | ALPH | Blake3 | alph.2miners.com:1199 |
| KASPADUAL | KAS | kHeavyHash | kas.2miners.com:1111 |
| ETCHDUAL | ETC | Etchash | etc.2miners.com:1010 |
| ERGDUAL | ERG | Autolykos2 | erg.2miners.com:8888 |
| RVNDUAL | RVN | KawPow | rvn.2miners.com:6060 |
| FLUXDUAL | FLUX | ZelHash | flux.2miners.com:9090 |
| DCRDUAL | DCR | Blake3 | dcr.2miners.com:3333 |
| EPICDUAL | EPIC | ProgPow | epic.2miners.com:20595 |
| CFXDUAL | CFX | Octopus | cfx.2miners.com:6060 |
| **ZANODUAL** | **ZANO** | **ProgPowZ** | **zano.herominers.com:1110** |
