# COSMIC HARMONY NATIVE POOL MINING GUIDE

## 🚀 Přehled

Nativní C++ implementace Cosmic Harmony algoritmu pro ZION mining.

### Výkon
- **Native C++**: 500,000 H/s (direktně)
- **Python ctypes**: 228,000 H/s (z Pythonu)
- **Python wrapper**: 164,000 H/s (přes algorithms.py)
- **Python fallback**: ~19,000 H/s (bez native knihovny)

**Zrychlení: 26× rychlejší než Python fallback!**

## 📦 Instalace

### 1. Build nativní knihovny

```bash
cd /home/zion/Zion-2.9-main/build_zion
./build.sh Release
```

Výstup:
- `build_zion/build/lib/libcosmic_harmony.so.2.9.0`
- `zion/mining/libcosmic_harmony.so.2.9.0` (automaticky zkopírováno)

### 2. Ověření instalace

```bash
cd /home/zion/Zion-2.9-main
python3 -c "
import sys
sys.path.insert(0, 'zion/mining')
from cosmic_harmony_wrapper import get_hasher
hasher = get_hasher(use_cpp=True)
print('✅ Native library loaded!' if hasher.cpp_lib else '❌ Failed')
"
```

## 🎯 Pool Mining

### Lokální pool test

```bash
# Spusť lokální pool (pokud máš)
python3 src/pool/zion_pool.py --port 3333

# V novém terminálu - test mining
python3 test_pool_cosmic_harmony.py \
  --pool localhost:3333 \
  --wallet YOUR_ZION_WALLET_ADDRESS \
  --algorithm cosmic_harmony \
  --duration 60
```

### Production pool (www.zionterranova.com)

```bash
python3 test_pool_cosmic_harmony.py \
  --pool www.zionterranova.com:3333 \
  --wallet YOUR_ZION_WALLET_ADDRESS \
  --algorithm cosmic_harmony
```

### SSH pool (91.98.122.165)

```bash
python3 test_pool_cosmic_harmony.py \
  --pool 91.98.122.165:3333 \
  --wallet YOUR_ZION_WALLET_ADDRESS \
  --algorithm cosmic_harmony
```

## 📊 Testovací výsledky

### Build & Test (Fáze 2 Complete)

✅ **Test 1: Basic functionality**
- Hash computation: WORKING
- Different nonces: WORKING  
- Difficulty check (1-13): 100% PASS
- C++ speed: 500,000 H/s

✅ **Test 2: Stress test (100k hashes)**
- 100,000 hashes: 404,858 H/s
- Hash distribution: 256/256 bytes (PERFECT)
- Uniformity: 17.15 std dev (EXCELLENT)

✅ **Test 3: Memory leak (1M hashes)**
- Initialization: +2.8 MB (Blake3/OpenSSL contexts)
- After 1M hashes: 0 KB leak
- Stability: PERFECT

✅ **Test 4: Python integration**
- ctypes loading: WORKING
- Hash match: 100% identical with C++
- Speed from Python: 228,841 H/s

## 🔧 Troubleshooting

### Library not found

```bash
# Zkontroluj že knihovna existuje
ls -lh /home/zion/Zion-2.9-main/zion/mining/libcosmic_harmony.so*

# Rebuild pokud chybí
cd /home/zion/Zion-2.9-main/build_zion
./build.sh Release clean
```

### Import errors

```bash
# Zkontroluj Python paths
python3 -c "
import sys
sys.path.insert(0, 'src')
sys.path.insert(0, 'zion/mining')
from cosmic_harmony_wrapper import get_hasher
print('✅ Import OK')
"
```

### Low hashrate

Pokud hashrate je pod 100k H/s, zkontroluj:
1. CPU load (měl by běžet na 100% na jednom core)
2. Že se používá native library (ne Python fallback)
3. AVX2 support: `grep avx2 /proc/cpuinfo`

## 🎮 Universal Miner Integration

Cosmic Harmony je automaticky dostupný v univerzálním mineru:

```python
from src.miners.zion_universal_miner import ZionUniversalMiner, MinerConfig, Algorithm

config = MinerConfig(
    pool_host="www.zionterranova.com",
    pool_port=3333,
    wallet_address="YOUR_WALLET",
    algorithms=[Algorithm.COSMIC_HARMONY],  # Priority 1!
    threads=1
)

miner = ZionUniversalMiner(config)
await miner.start()
```

## 📈 Performance Tips

1. **Single thread per CPU core** - optimální pro CPU mining
2. **AVX2 required** - pro plnou rychlost (zkontroluj: `grep avx2 /proc/cpuinfo`)
3. **No Python fallback** - zkontroluj že se načetla native knihovna
4. **Memory** - ~8 MB RAM per instance (Blake3 lookup tables)

## 🔐 Security

- Native knihovna je zkompilována s `-O3 -march=native` pro maximální výkon
- Blake3 hasher je cryptographically secure
- OpenSSL 3.4.1 pro SHA3/Keccak operace
- AVX-512 stub pro CPU bez AVX-512 support

## 📝 Next Steps

Po úspěšném testu:
1. Integrace do production univerzálního minera
2. Multi-threading support (paralelní hashování)
3. GPU akcelerace (CUDA/OpenCL)
4. Auto-switching mezi algoritmy podle profitability
5. Dashboard monitoring

## 🎉 Výsledky

**Fáze 2: COMPLETE** ✅
- Build systém: ✅ CMake 3.15+, C++17, OpenSSL 3.4.1
- Cosmic Harmony: ✅ 500k H/s (26× rychlejší)
- Všechny testy: ✅ PASS
- Python integrace: ✅ 228k H/s
- Ready for pool: ✅ YES

**Next: Fáze 3 - RandomX native implementation**
