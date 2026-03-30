# 🚀 QUICK START - Native Cosmic Harmony Mining

## ⚡ Instalace (1 minuta)

```bash
cd /home/zion/Zion-2.9-main/build_zion
./build.sh Release
```

✅ Native knihovna: `zion/mining/libcosmic_harmony.so.2.9.0`

## 🧪 Test (30 sekund)

```bash
cd /home/zion/Zion-2.9-main
python3 -c "
import sys
sys.path.insert(0, 'src')
from src.core.algorithms import get_hash, is_available
print('✅ READY!' if is_available('cosmic_harmony') else '❌ NOT READY')

# Quick benchmark
import time
start = time.time()
for i in range(5000):
    get_hash('cosmic_harmony', b'test', i)
print(f'Hashrate: {int(5000/(time.time()-start)):,} H/s')
"
```

Expected: **150k-170k H/s** (z Pythonu)

## 🏊 Pool Mining

### Lokální test
```bash
python3 test_pool_cosmic_harmony.py \
  --pool localhost:3333 \
  --wallet YOUR_WALLET
```

### Production pool
```bash
python3 test_pool_cosmic_harmony.py \
  --pool www.zionterranova.com:3333 \
  --wallet YOUR_WALLET
```

## 📊 Výkon

| Implementace | Hashrate | Zlepšení |
|--------------|----------|----------|
| Python fallback | 19,000 H/s | 1× (baseline) |
| **Native C++** | **500,000 H/s** | **26×** |
| Python ctypes | 228,000 H/s | 12× |
| algorithms.py | 164,000 H/s | 8.6× |

## 🎯 Co je hotovo

✅ CMake build systém  
✅ Blake3 optimalizace (AVX2)  
✅ 500k H/s native performance  
✅ Python wrapper integrace  
✅ Universal miner ready  
✅ Pool mining dokumentace  
✅ Všechny testy PASS  

## 📖 Další info

- **Detailní dokumentace**: `docs/COSMIC_HARMONY_POOL_MINING.md`
- **Testy**: `build_zion/build/bin/test_*`
- **Buildový proces**: `build_zion/CMakeLists.txt`

---
**Status**: ✅ FÁZE 2 COMPLETE - Ready for production pool mining!
