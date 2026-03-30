# ZION Multi-Algorithm Mining - Complete Guide

## 🎯 Overview

ZION podporuje **6 mining algoritmů** pro maximální flexibilitu a decentralizaci:

| Algorithm | Type | Hardware | Bonus | Status |
|-----------|------|----------|-------|--------|
| **Cosmic Harmony** ⭐ | CPU/GPU | Any | **+25%** | Native ZION |
| **Yescrypt** 🌿 | CPU | Eco | +15% | Supported |
| **RandomX** ⚡ | CPU | Standard | 0% | Supported |
| **Autolykos v2** 🎮 | GPU | Ergo | +20% | Supported |
| **KawPow** 💎 | GPU | RVN | 0% | Supported |
| **Ethash** 🔷 | GPU | ETH | 0% | Supported |

---

## ⭐ Cosmic Harmony (Native ZION)

### What is Cosmic Harmony?

**5-stage cryptographic algorithm** unique to ZION:

1. **Blake3** - Quantum foundation (fast, secure)
2. **Keccak-256** - Galactic matrix operations
3. **SHA3-512** - Stellar harmony processing
4. **Golden Ratio Matrix** - Sacred geometry transformation (φ = 1.618...)
5. **Cosmic Fusion** - Final Blake3 combining all stages

### Why Cosmic Harmony?

- ✅ **Unique to ZION** - Brand identity
- ✅ **ASIC Resistant** - Multi-stage complexity
- ✅ **Sacred Geometry** - Golden ratio integration
- ✅ **Best Rewards** - 25% bonus multiplier
- ✅ **Hybrid Ready** - Works on CPU + GPU
- ✅ **High Security** - 5 independent hash functions

### Mining with Cosmic Harmony

#### Option 1: ZION Miner v1.4.0 (C++ Native)
```bash
# Compile
cd zion/mining
mkdir build && cd build
cmake ..
make

# Mine
./zion-miner-main \
  --pool localhost:3333 \
  --wallet ZION_ADDRESS \
  --algorithm cosmic \
  --cpu-threads 8
```

#### Option 2: Universal AI Miner (Python)
```bash
python3 ai/zion_universal_miner.py \
  --algorithm cosmic_harmony \
  --pool localhost:3333 \
  --wallet ZION_ADDRESS \
  --mode hybrid
```

### Performance Benchmarks

**CPU Mining:**
- AMD Ryzen 9 5950X: 1,500 H/s
- Intel i9-12900K: 1,200 H/s
- AMD Ryzen 5 3600: 600 H/s
- Intel i5-10400: 400 H/s

**GPU Mining (future):**
- RTX 4090: 50 MH/s (estimated)
- RX 6900 XT: 40 MH/s (estimated)

---

## 🌿 Yescrypt (Eco-Friendly)

### Features
- **Low Power** - 50% less energy than RandomX
- **Eco Bonus** - +15% rewards
- **CPU Optimized** - Memory-hard algorithm
- **Professional Mode** - C extension: 562K H/s

### Mining Commands

#### XMRig (RandomX mode can mine Yescrypt)
```bash
xmrig \
  -o pool.zion-blockchain.org:3335 \
  -u ZION_ADDRESS \
  -p yescrypt \
  --threads 8 \
  --randomx-mode auto
```

#### ZION Professional Yescrypt Miner
```bash
python3 mining/zion_yescrypt_professional.py \
  --pool localhost:3333 \
  --wallet ZION_ADDRESS \
  --threads 12 \
  --eco-mode
```

### Performance
- **C Extension**: 400-600 KH/s
- **Python Fallback**: 50-100 KH/s
- **Power**: 80W (vs 150W RandomX)

---

## ⚡ RandomX (Standard CPU)

### Features
- **Industry Standard** - Monero-compatible
- **Wide Support** - XMRig, SRBMiner
- **Fair Distribution** - No ASIC advantage
- **High Security** - Battle-tested

### Mining with XMRig

```bash
# Download XMRig
wget https://github.com/xmrig/xmrig/releases/download/v6.21.0/xmrig-6.21.0-linux-x64.tar.gz
tar xvzf xmrig-6.21.0-linux-x64.tar.gz
cd xmrig-6.21.0

# Mine ZION
./xmrig \
  -o pool.zion-blockchain.org:3335 \
  -u ZION_ADDRESS.worker1 \
  -p x \
  --threads 8 \
  --randomx-mode auto \
  --donate-level 1
```

### Performance
- **AMD Ryzen 9 5950X**: 4,000 H/s
- **Intel i9-12900K**: 3,500 H/s
- **AMD Ryzen 5 3600**: 1,800 H/s

---

## 🎮 Autolykos v2 (GPU Ergo)

### Features
- **GPU Efficient** - Modern cards optimized
- **Eco Bonus** - +20% rewards
- **Memory-Hard** - 3GB+ VRAM required
- **Low Power** - Better than Ethash

### Mining with lolMiner

```bash
# Windows
lolMiner.exe \
  --algo AUTOLYKOS2 \
  --pool pool.zion-blockchain.org:3337 \
  --user ZION_ADDRESS

# Linux
./lolMiner \
  --algo AUTOLYKOS2 \
  --pool pool.zion-blockchain.org:3337 \
  --user ZION_ADDRESS
```

### Mining with SRBMiner

```bash
SRBMiner-MULTI.exe \
  --algorithm autolykos2 \
  --pool pool.zion-blockchain.org:3337 \
  --wallet ZION_ADDRESS \
  --gpu-boost 3
```

### Performance
- **RTX 4090**: 400 MH/s
- **RX 6900 XT**: 350 MH/s
- **RTX 3080**: 250 MH/s
- **RX 6700 XT**: 180 MH/s

---

## 💎 KawPow (GPU Ravencoin)

### Features
- **NVIDIA Optimized** - Best on RTX cards
- **High Hashrate** - Faster than Ethash
- **Modern GPUs** - 6GB+ recommended

### Mining with SRBMiner

```bash
SRBMiner-MULTI.exe \
  --algorithm kawpow \
  --pool pool.zion-blockchain.org:3338 \
  --wallet ZION_ADDRESS \
  --gpu-id 0 \
  --gpu-boost 3
```

### Mining with T-Rex

```bash
t-rex.exe \
  -a kawpow \
  -o stratum+tcp://pool.zion-blockchain.org:3338 \
  -u ZION_ADDRESS \
  -p x \
  --gpu-report-interval 30
```

### Performance
- **RTX 4090**: 120 MH/s
- **RTX 3090**: 80 MH/s
- **RX 6900 XT**: 65 MH/s

---

## 🔷 Ethash (GPU Ethereum)

### Features
- **Most Common** - Widest miner support
- **8GB+ VRAM** - DAG size requirement
- **Stable** - Mature algorithm

### Mining with PhoenixMiner

```bash
PhoenixMiner.exe \
  -pool pool.zion-blockchain.org:3339 \
  -wal ZION_ADDRESS \
  -worker rig1 \
  -proto 4
```

### Performance
- **RTX 3090**: 120 MH/s
- **RX 6800 XT**: 65 MH/s
- **RTX 3070**: 60 MH/s

---

## 🎯 Recommended Setup

### For Maximum Rewards (Cosmic Harmony + Eco Bonus)
```bash
# CPU: Cosmic Harmony (25% bonus)
python3 ai/zion_universal_miner.py \
  --algorithm cosmic_harmony \
  --mode cpu

# GPU: Autolykos v2 (20% bonus)
lolMiner --algo AUTOLYKOS2 \
  --pool localhost:3337 \
  --user ZION_ADDRESS
```

**Total Bonus: Up to 45%** (25% + 20%)

### For Maximum Hashrate
```bash
# CPU: RandomX (XMRig)
xmrig -o localhost:3335 -u ZION_ADDRESS

# GPU: KawPow (SRBMiner)
SRBMiner-MULTI --algorithm kawpow \
  --pool localhost:3338 --wallet ZION_ADDRESS
```

### For Eco-Friendly Mining
```bash
# CPU: Yescrypt (15% bonus, 50% power)
python3 mining/zion_yescrypt_professional.py

# GPU: Autolykos v2 (20% bonus, efficient)
lolMiner --algo AUTOLYKOS2
```

---

## 📊 Algorithm Comparison

### Power Consumption
| Algorithm | CPU Power | GPU Power | Efficiency |
|-----------|-----------|-----------|------------|
| Cosmic Harmony | 100W | 150W | ⭐⭐⭐⭐⭐ |
| Yescrypt | 80W | - | ⭐⭐⭐⭐⭐ |
| RandomX | 150W | - | ⭐⭐⭐ |
| Autolykos v2 | - | 180W | ⭐⭐⭐⭐ |
| KawPow | - | 220W | ⭐⭐⭐ |
| Ethash | - | 250W | ⭐⭐ |

### Profitability (Base = 1.0)
| Algorithm | Base | Bonus | Total | Rank |
|-----------|------|-------|-------|------|
| Cosmic Harmony | 1.0 | +25% | **1.25** | 🥇 |
| Autolykos v2 | 1.0 | +20% | **1.20** | 🥈 |
| Yescrypt | 1.0 | +15% | **1.15** | 🥉 |
| RandomX | 1.0 | 0% | 1.00 | 4th |
| KawPow | 1.0 | 0% | 1.00 | 4th |
| Ethash | 1.0 | 0% | 1.00 | 4th |

---

## 🔧 Pool Configuration

### Pool Ports by Algorithm
```
3333 - Multi-algo (auto-detect)
3335 - RandomX / Yescrypt (CPU)
3336 - Cosmic Harmony (Native ZION)
3337 - Autolykos v2 (GPU)
3338 - KawPow (GPU)
3339 - Ethash (GPU)
```

### Pool Connection String
```
stratum+tcp://pool.zion-blockchain.org:PORT
```

---

## 🎮 Consciousness Mining Bonus

**All algorithms** support consciousness mining! Add up to **15x multiplier**:

```bash
# Enable consciousness mining
python3 consciousness_mining_game.py

# Link to miner
# Your consciousness level bonus applies to ALL algorithms!
```

**Example:**
- Base algorithm bonus: Cosmic Harmony +25%
- Consciousness Level 9: +15x (1500%)
- **Total: 1875% rewards!** 🚀

---

## 📱 Monitoring

### Pool Dashboard
```
https://pool.zion-blockchain.org/
```

### Wallet Balance
```bash
python3 wallet/cli_wallet.py balance ZION_ADDRESS
```

### Hashrate Check
```bash
# CPU
top -p $(pgrep xmrig)

# GPU
nvidia-smi -l 1  # NVIDIA
rocm-smi -l 1    # AMD
```

---

## 🆘 Troubleshooting

### Problem: Low hashrate on Cosmic Harmony
**Solution:**
1. Build C++ library: `./build_cosmic_harmony.sh`
2. Use native miner: `zion-miner-main`
3. Check CPU threads: Match core count

### Problem: GPU not detected
**Solution:**
1. Install drivers: NVIDIA/AMD latest
2. Check OpenCL: `clinfo`
3. Use specific GPU ID: `--gpu-id 0`

### Problem: Pool connection failed
**Solution:**
1. Check port: Different algo = different port
2. Test connection: `telnet pool.zion-blockchain.org 3333`
3. Check wallet: Must be valid ZION address

---

**🌟 Happy Multi-Algo Mining! Choose what works best for you! 🌟**

*All algorithms are equally supported - pick based on your hardware and preferences!*
