# 🧪 Trae Labs - Experimental Algorithm Playground

Welcome to Trae Labs! This is our safe space to experiment with new PoW algorithm ideas for ZION, completely separate from the main codebase.

## 🎯 Goals

- **Fire (Winter)**: GPU-intensive mining algorithm - generates heat for cold winters
- **Lite (Summer)**: Minimal energy/heat for warm summers
- **Both**: ASIC-resistant, low-power, fun to experiment with!

## 📂 Structure

```
TraeLabs/
├── Cargo.toml
├── README.md
├── DESIGN_IDEAS.md
├── CZECH_SUMMARY.md (Český souhrn)
├── SUMMARY.md
├── src/
│   ├── lib.rs
│   ├── common/          # Shared utilities (hash, target)
│   ├── lite/            # Lite algorithm variants (summer, low energy)
│   │   ├── v1_minimal.rs
│   │   └── v2_memory_light.rs
│   ├── fire/            # Fire algorithm variants (winter, heat)
│   │   ├── v1_thermal.rs
│   │   └── v2_recursive.rs
│   ├── miner.rs         # Mining framework!
│   └── bin/
│       ├── bench_all.rs # Benchmark all variants
│       ├── test_variants.rs # Test them
│       └── miner.rs     # Run the miner!
└── kernels/             # GPU kernel workspace
```

## 🚀 Getting Started

### Run the Miner!
```bash
cd TraeLabs
cargo run --bin miner
```

### Test All Variants
```bash
cargo run --bin test_variants
```

### Benchmark Everything
```bash
cargo run --bin bench_all
```

## 📊 Scratchpad Sizes

| Algorithm | Size | ASIC Resistance |
|-----------|------|-----------------|
| Lite V1 | None | ⭐⭐⭐⭐ |
| Lite V2 | **32 KB** | ⭐⭐⭐⭐⭐ |
| Fire V1 | **256 KB** | ⭐⭐⭐⭐⭐⭐ |
| Fire V2 | None | ⭐⭐⭐⭐⭐ |

## 📜 Rules

1. **NO breaking mainnet code!** - we experiment here only!
2. Document everything!
3. Have fun! 🚀🔥❄️
