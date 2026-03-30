# ZION TerraNova v2.9.5 - Mining Guide

## 🚀 Quick Start

### 1. Get a ZION Wallet Address
Your wallet address starts with `zion1` followed by 38 characters.
Example: `zion1d8q326z0l8l2x263e3g2g4x3g8x720u7d8h6e0z`

### 2. Download the Miner
```bash
# Clone repository
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9/2.9.5

# Build native miner
cd zion-cosmic-harmony-v3
cargo build --release
```

### 3. Start Mining
```bash
./target/release/zion-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet zion1YOUR_WALLET_ADDRESS \
  --worker my-rig-01
```

---

## ⛏️ Mining Options

### CPU Mining
```bash
./zion-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet zion1... \
  --worker cpu-rig \
  --threads 8
```

### GPU Mining (NVIDIA CUDA)
```bash
./zion-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet zion1... \
  --worker gpu-rig \
  --gpu \
  --gpu-id 0
```

### GPU Mining (OpenCL - AMD/Intel)
```bash
./zion-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet zion1... \
  --worker gpu-rig \
  --opencl \
  --platform 0 \
  --device 0
```

### Multi-GPU Mining
```bash
./zion-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet zion1... \
  --worker multi-gpu \
  --gpu \
  --gpu-ids 0,1,2,3
```

---

## 🌍 Pool Regions

| Region | Address | Port |
|--------|---------|------|
| **Europe (Helsinki)** | `eu.pool.zionterranova.com` | 3333 |
| **US East** | `us.pool.zionterranova.com` | 3333 |
| **Asia (Singapore)** | `asia.pool.zionterranova.com` | 3333 |
| **Global** | `pool.zionterranova.com` | 3333 |

### Direct IPs (if DNS issues)
- Helsinki: `77.42.31.72:3333`
- US: `5.78.145.234:3333`
- Singapore: `5.223.56.122:3333`

---

## 📊 Mining Algorithms

### Cosmic Harmony (Default)
ZION's native algorithm combining RandomX concepts with consciousness-weighted difficulty.

```bash
./zion-miner --algo cosmic_harmony ...
```

### Multi-Chain Algorithms
Mine other coins through ZION pool (coming soon):

| Algo | Coin | Flag |
|------|------|------|
| RandomX | XMR | `--algo randomx` |
| Yescrypt | Various | `--algo yescrypt` |
| kHeavyHash | KAS | `--algo kheavyhash` |
| Ethash | ETC | `--algo ethash` |
| Equihash | ZEC | `--algo equihash` |

---

## 🎮 Consciousness Mining Game

### How It Works

Mining in ZION isn't just about hashrate—your **consciousness level** determines bonus rewards!

### Levels & Multipliers

| Level | XP Required | Bonus |
|-------|-------------|-------|
| 🟤 PHYSICAL | 0 | 1.0x |
| 🟠 EMOTIONAL | 10,000 | 1.05x |
| 🟡 MENTAL | 50,000 | 1.1x |
| 🟢 INTUITIONAL | 100,000 | 1.25x |
| 🔵 SPIRITUAL | 250,000 | 1.5x |
| 🟣 COSMIC | 500,000 | 2.0x |
| ⭐ ON_THE_STAR | 1,000,000 | **15.0x** |

### Earning XP

- **Valid Share:** +10 XP
- **Block Found:** +1,000 XP
- **Daily Streak:** +5% bonus per consecutive day
- **Community Events:** Variable bonuses

### Example Rewards

Block reward = 50 ZION (base) + 1,569.63 ZION × multiplier

| Level | Multiplier | Total Reward |
|-------|------------|--------------|
| PHYSICAL | 1.0x | 1,619.63 ZION |
| COSMIC | 2.0x | 3,189.26 ZION |
| ON_THE_STAR | 15.0x | 23,594.45 ZION |

---

## ⚙️ Configuration File

Create `miner_config.json`:

```json
{
  "pool": {
    "url": "pool.zionterranova.com",
    "port": 3333,
    "backup_pools": [
      "eu.pool.zionterranova.com:3333",
      "us.pool.zionterranova.com:3333"
    ]
  },
  "wallet": "zion1YOUR_WALLET_ADDRESS",
  "worker": "my-rig-01",
  "algorithm": "cosmic_harmony",
  "cpu": {
    "enabled": true,
    "threads": 0,
    "priority": 2
  },
  "gpu": {
    "enabled": false,
    "cuda": true,
    "opencl": false,
    "devices": [0],
    "intensity": 80
  },
  "logging": {
    "level": "info",
    "file": "miner.log"
  }
}
```

Run with config:
```bash
./zion-miner --config miner_config.json
```

---

## 🔧 Performance Tuning

### CPU Optimization

```bash
# Use all available threads
./zion-miner --threads 0 ...

# Use specific threads (leave 2 for system)
./zion-miner --threads 6 ...

# High priority
./zion-miner --priority 5 ...
```

### GPU Optimization

```bash
# Auto-tune (finds optimal settings)
./zion-miner --gpu --auto-tune ...

# Set intensity (50-100)
./zion-miner --gpu --intensity 80 ...

# Benchmark mode
./zion-miner --benchmark --gpu
```

### Memory-Hard Algorithms

For Yescrypt/Argon2d:
```bash
# Ensure enough RAM (4GB+ recommended)
./zion-miner --algo yescrypt --threads 4 ...
```

---

## 📈 Monitoring

### CLI Stats
The miner displays real-time stats:
```
[2026-01-21 10:30:15] Hashrate: 1.25 kH/s | Shares: 156/158 (98.7%) | XP: 15,600 | Level: MENTAL
[2026-01-21 10:30:25] 🎉 BLOCK FOUND! Height: 12345 | Reward: 1,619.63 ZION
```

### Pool Dashboard
Check your stats at: `http://pool.zionterranova.com:8080/miner/YOUR_ADDRESS`

### API Monitoring
```bash
# Your hashrate
curl http://pool.zionterranova.com:8080/miner/zion1.../hashrate

# Pool stats
curl http://pool.zionterranova.com:8080/stats
```

---

## 🛡️ Troubleshooting

### Connection Issues

```
Error: Could not connect to pool
```
**Solution:**
1. Check internet connection
2. Try backup pool: `--pool eu.pool.zionterranova.com:3333`
3. Check firewall allows port 3333

### Invalid Shares

```
Warning: Share rejected (low difficulty)
```
**Solution:**
1. Let VarDiff adjust (wait 2-3 minutes)
2. Check system isn't overheating

### GPU Not Detected

```
Error: No CUDA devices found
```
**Solution:**
1. Update GPU drivers
2. Install CUDA toolkit 11.0+
3. Verify with: `nvidia-smi`

### High Stale Rate

```
Warning: Stale share rate > 5%
```
**Solution:**
1. Use closer pool region
2. Check network latency: `ping pool.zionterranova.com`
3. Reduce intensity if GPU

---

## 💡 Tips for Maximum Earnings

1. **Stay Consistent** - Daily mining builds XP streak bonuses
2. **Choose Right Region** - Lower latency = fewer stales
3. **Optimize Hardware** - Use GPU for 5-10x more hashrate
4. **Level Up** - Reach ON_THE_STAR for 15x rewards!
5. **Join Community** - Participate in events for bonus XP

---

## 📞 Support

- **Discord:** discord.gg/zionterranova
- **Telegram:** t.me/zionterranova
- **GitHub Issues:** github.com/Yose144/Zion-2.9/issues
- **Email:** support@zionterranova.com

---

## 📜 License

ZION TerraNova is open source under MIT License.

---

**Happy Mining! May your consciousness rise! 🌟**

*"Where technology meets spirit"*
