# ZION TerraNova v2.9.5 - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Get Your Wallet
Your ZION wallet address format: `zion1` + 38 characters

Example: `zion1d8q326z0l8l2x263e3g2g4x3g8x720u7d8h6e0z`

### Step 2: Start Mining

**Option A: Pre-built Miner (Easiest)**
```bash
# Download latest release
curl -LO https://github.com/Yose144/Zion-2.9/releases/latest/download/zion-miner

# Make executable
chmod +x zion-miner

# Start mining!
./zion-miner --pool pool.zionterranova.com:3333 --wallet YOUR_WALLET
```

**Option B: Build from Source**
```bash
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9/2.9.5/zion-cosmic-harmony-v3
cargo build --release
./target/release/zion-miner --pool pool.zionterranova.com:3333 --wallet YOUR_WALLET
```

### Step 3: Check Your Stats
```bash
curl http://pool.zionterranova.com:8080/miner/YOUR_WALLET
```

---

## 🎯 That's It!

You're now mining ZION and earning:
- 💰 **Block Rewards:** Up to 23,594 ZION per block
- ⭐ **XP Points:** Level up for bigger multipliers
- 🌍 **Humanitarian Impact:** 10% goes to global aid

---

## 📚 Learn More

| Topic | Link |
|-------|------|
| Full Mining Guide | [MINING_GUIDE.md](MINING_GUIDE.md) |
| API Reference | [API_REFERENCE.md](API_REFERENCE.md) |
| Deployment | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) |
| Consciousness Levels | [NCL_CONTRACT_v1.0.md](NCL_CONTRACT_v1.0.md) |

---

## 🆘 Need Help?

- Discord: discord.gg/zionterranova
- Telegram: t.me/zionterranova
- GitHub: github.com/Yose144/Zion-2.9/issues

---

**Happy Mining! 🌟**
