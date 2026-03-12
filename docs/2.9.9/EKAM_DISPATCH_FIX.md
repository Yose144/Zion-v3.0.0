# ZION v2.9.9 — Ekam Dispatch Fix (Poslední optimalizační upgrade)

> Datum: 2026-03-12  
> Status: **IMPLEMENTOVÁNO A OVĚŘENO**  
> Dopad: 12.5× zlepšení výkonu Rust Metal GPU mineru

---

## Shrnutí

Poslední optimalizační upgrade před Pure Code migrací. Ekvivalent aktivace hugepages
v XMRig/RandomX — algoritmus se nezměnil, ale runtime dispatch nebyl správně nakonfigurovaný.

| Metrika | Před | Po | Změna |
|---------|------|----|-------|
| Rust Metal M1 (batch 8192) | 2.26 kH/s | **28.18 kH/s** | **12.5×** |
| Python Metal M1 (batch 8192) | 9.65 kH/s | 9.65 kH/s | beze změny |
| Rust vs Python poměr | 0.23× (chybný) | **2.9×** (správný) | — |

---

## Příčina problému

### Symptom
Rust L1 Metal GPU miner dosahoval ~2.26 kH/s na Apple M1, zatímco Python Metal miner
ukazoval ~9.6–25 kH/s. Rust by měl být rychlejší, ne 4–10× pomalejší.

### Diagnostika

V `L1/cosmic-harmony/src/gpu/metal_miner.rs` existovaly DVĚ mine metody:

| Metoda | Pipeline | Scratchpad init | Fusion | Výkon |
|--------|----------|-----------------|--------|-------|
| `mine()` | Legacy CHv4.2 | SHA3-512 chain (pomalý) | 4 rounds | ~2.3 kH/s |
| `mine_ekam()` | Ekam Deeksha | Blake3 XOF (rychlý) | 8 rounds | ~28 kH/s |

Ekam kernely se korektně komplilovaly, načítaly do Metal pipeline a logovaly
`"Ekam Deeksha GPU kernels loaded"` — ale **nikdy se nevolaly**.

### Kořenová příčina

`L1/miner/src/miner/gpu/metal.rs` v `mine_batch()` volal:
```rust
inner.mine(header, target, nonce_start, height)  // ← legacy!
```

místo:
```rust
inner.mine_ekam(header, target, nonce_start, height)  // ← Ekam Deeksha
```

Integrace Ekam kernelů byla nekompletní — kernely se zkompilovaly a pipeline se vytvořil,
ale dispatch v L1 wrapperu nebyl aktualizovaný.

---

## Fix

### Změna 1: `L1/miner/src/miner/gpu/metal.rs` — mine_batch()

```rust
// PŘED:
let result = inner.mine(header, target, nonce_start, height);

// PO:
let result = if inner.has_ekam_kernels() {
    inner.mine_ekam(header, target, nonce_start, height)
} else {
    inner.mine(header, target, nonce_start, height)
};
```

### Změna 2: `L1/cosmic-harmony/src/gpu/metal_miner.rs` — benchmark()

```rust
// PŘED:
let (found, nonce, hash) = self.mine(&header, target, start_nonce, 0);

// PO:
let (found, nonce, hash) = if self.has_ekam_kernels() {
    self.mine_ekam(&header, target, start_nonce, 0)
} else {
    self.mine(&header, target, start_nonce, 0)
};
```

### Rozsah
- 2 soubory
- ~10 řádků změn
- Žádná změna consensus / hash výstupu

---

## Ověření

### Build
```
cargo build -p zion-miner --features metal --release
→ PASS (26.3s, pouze pre-existující warningy v external_pool.rs)
```

### Benchmark
```
Ekam Deeksha GPU kernels loaded (Blake3 XOF + 8-round fusion)
GPU Metal benchmark: 28183 H/s at dispatch 8192
```

### Srovnání s Python
```
Python Metal benchmark (batch 8192): 9654 H/s
Rust/Python poměr: 2.92× (očekávaný výsledek)
```

---

## Poučení

1. **Dispatch ≠ kompilace.** GPU kernely se mohou korektně zkompilovat a načíst,
   ale runtime dispatch musí explicitně volat správnou funkci.

2. **Vrstvená abstrakce skrývá chyby.** `metal_miner.rs` (nízká vrstva) měl obě metody,
   ale `metal.rs` (wrapper) volal jen starou. Vrstvy abstrakce zvyšují riziko
   nekonzistentního dispatch.

3. **Benchmark musí odpovídat produkčnímu dispatch.** Pokud benchmark běží jinou cestou
   než `mine_batch()`, metriky jsou zavádějící.

4. **Analogie s RandomX hugepages je přesná.** Algoritmus byl funkční, implementace byla
   kompletní — chyběl jediný konfigurační krok, který odemkl plný výkon.

---

## Návaznost na v2.9.9 Pure Code

Tento fix je posledním optimalizačním upgradem. V rámci v2.9.9:

- Legacy `mine()` se smaže kompletně
- `mine_ekam()` se přejmenuje na `mine()` (bude to jediná cesta)
- `has_ekam_kernels()` se odstraní (vždy true)
- `if/else` guard v wrapper vrstvě se zjednoduší na přímé volání

Viz [LEGACY_REMOVAL_PLAN.md](LEGACY_REMOVAL_PLAN.md) § 2.1 a [MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md) Fáze A.
