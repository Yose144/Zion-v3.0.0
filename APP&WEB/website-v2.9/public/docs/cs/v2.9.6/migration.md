# 🔄 Migrace z v2.9.5 na v2.9.6

> *Průvodce přechodem na Pre-Mainnet fork.*

---

## 1. Přehled změn

| Oblast | v2.9.5 | v2.9.6 |
|--------|--------|--------|
| PoW algoritmus | CH v1/v2/v3 (3 varianty) | **CHv3 only** (jediný) |
| Nonce | u32 (v1) + u64 (v2/v3) | **u64** (jednotně) |
| Pool Algorithm enum | 3 varianty (v1/v2/v3) | **1 varianta** (CosmicHarmony=CHv3) |
| Miner NativeAlgorithm | CosmicHarmony + CosmicHarmonyV2 | **CosmicHarmony** (= CHv3) |
| Memory-hard scratchpad | volitelný | **fork-gated** (h ≥ 50 000) |
| Dual-mining | time-switching | **paralelní** (PerMiner groups) |

---

## 2. Node operátor

### 2.1 Aktualizace binárky

```bash
cd /opt/zion
git pull origin main
cargo build --release --workspace

# Ověření
./target/release/zion-node --version
# zion-core v2.9.6
```

### 2.2 Konfigurace

Žádné změny v `config/*.toml`. Fork heights jsou hardcoded:

```rust
pub const CH_V3_FORK_HEIGHT: u64 = 0;              // CHv3 od genesis
pub const CHV3_MEMORY_HARD_FORK_HEIGHT: u64 = 50_000; // memory-hard scratchpad
```

### 2.3 Databáze

Žádná DB migrace potřebná — block formát se nemění. CHv3 hash funkce je
zpětně kompatibilní (fork height = 0 = vždy aktivní).

---

## 3. Pool operátor

### 3.1 Share validator

Starý kód:
```rust
// v2.9.5 — 3 varianty
enum Algorithm {
    CosmicHarmony,      // v1
    CosmicHarmonyV2,    // v2
    CosmicHarmonyV3,    // v3
}
```

Nový kód:
```rust
// v2.9.6 — 1 varianta
enum Algorithm {
    CosmicHarmony,  // = CHv3
    RandomX,
    Yescrypt,
    Blake3,
    AutolykovV2,
    Unknown,
}
```

Všechny stringy `cosmic_harmony`, `cosmic_harmony_v1`, `cosmic_harmony_v2`,
`cosmic_harmony_v3`, `chv3`, `ch3` se mapují na `CosmicHarmony` (= CHv3).

### 3.2 PerMiner groups (nová funkce)

Nově pool podporuje paralelní mining skupiny. Konfigurace:

```bash
# Environment variables
export ZION_SCHEDULER_PERMINER_MIN_MINERS=2

# Miner připojení s group hintem
./zion-miner --pool stratum+tcp://91.98.122.165:3333 \
             --user wallet.worker:p=zion,g=zion \
             --group zion
```

### 3.3 VRSC revenue mining

```bash
# Pool automaticky routuje VRSC shares na LuckPool
export ZION_ZC_PASS="x"  # ZcashStratum heslo
export ZION_VRSC_POOL="stratum+tcp://luckpool.net:3956"
```

---

## 4. Miner

### 4.1 CLI změny

```bash
# v2.9.5
./zion-miner --algo cosmic_harmony_v2

# v2.9.6 — všechno je CHv3
./zion-miner --algo cosmic_harmony
# nebo
./zion-miner --algo chv3
# nebo prostě (default):
./zion-miner
```

String `cosmic_harmony_v2` je stále akceptován ale mapuje na CHv3.

### 4.2 Nové CLI flagy

```bash
--group <zion|revenue>    # Mining group pro paralelní dual-mining
```

### 4.3 Config soubor

```toml
# miner.toml
[mining]
algorithm = "cosmic_harmony"  # nebo "chv3"
threads = 3                   # ZION CHv3 threads

[revenue]
enabled = true
algorithm = "verushash"
threads = 1                   # VRSC VerusHash thread
pool = "stratum+tcp://luckpool.net:3956"
```

---

## 5. Docker

### 5.1 Aktualizace image

```bash
cd /opt/zion
docker compose -f docker-compose.native-2.9.5.yml pull
docker compose -f docker-compose.native-2.9.5.yml up -d --build
```

### 5.2 Environment variables (nové)

```yaml
environment:
  - ZION_SCHEDULER_PERMINER_MIN_MINERS=2
  - ZION_CHV3_MEMORY_HARD_FORCE=0     # default
  - ZION_CHV3_MEMORY_HARD_DISABLE=0   # default
```

---

## 6. Breaking changes

| Změna | Dopad | Řešení |
|-------|-------|--------|
| `cosmic_harmony_v2` odstraněn z enum | Miner compilace | Změnit na `cosmic_harmony` |
| `cosmic_hash()` funkce odstraněna | Core API | Použít `hash(data, nonce, height)` |
| `CosmicHarmonyV2` enum varianta | Pool validator | Vše → `CosmicHarmony` |
| `CHV2_HASHER` thread-local odstraněn | Miner native | Automaticky přesměrováno na CHv3 |

### Zpětná kompatibilita

- ✅ Block formát neměněn
- ✅ Template blob formát neměněn (165 B)
- ✅ Stratum protocol neměněn (XMRig kompatibilní)
- ✅ Stringy `cosmic_harmony_v2` akceptovány (mapují na CHv3)
- ⚠️ Rust API: `cosmic_harmony::cosmic_hash()` odstraněn → `cosmic_harmony::hash()`

---

## 7. Rollback plan

Pokud je potřeba vrátit se na v2.9.5:

```bash
git checkout v2.9.5
cargo build --release --workspace
```

Archivované soubory v `archive/legacy-algorithms/` obsahují v1 + v2 zdrojáky.
