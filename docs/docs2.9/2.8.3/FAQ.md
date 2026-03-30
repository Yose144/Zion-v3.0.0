# ZION Frequently Asked Questions (FAQ)

**Version:** 2.8.3 "Terra Nova"  
**Updated:** October 29, 2025  

---

## 📋 Table of Contents

1. [General Questions](#general-questions)
2. [Getting Started](#getting-started)
3. [Wallets & Transactions](#wallets--transactions)
4. [Mining Questions](#mining-questions)
5. [Technical Questions](#technical-questions)
6. [Troubleshooting](#troubleshooting)
7. [Security & Privacy](#security--privacy)
8. [Economics & Tokenomics](#economics--tokenomics)

---

## General Questions

### What is ZION?

ZION is a **humanitarian blockchain** designed to promote global prosperity through:
- **Fair mining** - GPU-optimized, ASIC-resistant algorithm
- **Fast transactions** - ~2 minute block times
- **Low fees** - Minimal transaction costs
- **Humanitarian allocation** - 10% of mining rewards fund global initiatives

### Is ZION a cryptocurrency?

Yes, ZION is both:
1. A **blockchain platform** - Decentralized network with smart contract support (planned)
2. A **cryptocurrency** - ZION tokens used for transactions and value transfer

### What makes ZION different from Bitcoin or Ethereum?

| Feature | ZION | Bitcoin | Ethereum |
|---------|------|---------|----------|
| **Consensus** | WARP (PoW) | PoW | PoS |
| **Block Time** | 2 minutes | 10 minutes | 12 seconds |
| **Mining** | GPU-friendly | ASIC-dominated | Not applicable |
| **Smart Contracts** | Planned (2026) | Limited | Full support |
| **Humanitarian Focus** | 10% allocation | None | None |
| **Transaction Fees** | Very low | Variable | High (gas) |

### Is ZION open source?

**Partially.** The testnet client (RPC, wallet, mining) is open source under MIT license. The core blockchain engine will be open-sourced at mainnet launch (Q1 2026) after security audits.

### What is the testnet?

The **ZION Testnet** is a testing environment where:
- Developers can test applications
- Miners can practice mining
- Users can experiment with wallets
- **Tokens have NO monetary value**
- Network may be reset during development

**Testnet Launch:** November 15, 2025  
**Mainnet Launch:** Q1 2026 (planned)

---

## Getting Started

### How do I get started with ZION?

**Quickest path (5 minutes):**
1. Download CLI binary from [GitHub Releases](https://github.com/estrelaisabellazion3/Zion-2.8/releases)
2. Extract and run `./zion-cli wallet --create`
3. Start mining with `./zion-cli mine --start`

**Full guide:** [QUICK_START.md](./QUICK_START.md)

### Do I need to run a full node?

**No!** You can use ZION without running a node:
- **Wallet:** Use CLI binary (connects to RPC endpoint)
- **Mining:** Connect to public mining pool
- **Development:** Use public RPC API

**Run a node if you want:**
- Full blockchain validation
- Privacy (no third-party dependencies)
- Support network decentralization

### What are the system requirements?

**Minimum (wallet only):**
- OS: Linux, macOS, Windows 10+
- RAM: 1 GB
- Disk: 1 GB
- Internet: Any connection

**Recommended (mining):**
- GPU: NVIDIA GTX 1060 6GB or AMD RX 580 8GB
- RAM: 4 GB
- Disk: 10 GB SSD
- Internet: 10 Mbps

**Full node:**
- CPU: 2 cores @ 2.4 GHz
- RAM: 2 GB
- Disk: 20 GB SSD
- Internet: 10 Mbps

### Can I use ZION on mobile?

**Not yet.** Mobile wallets (iOS/Android) are planned for Q4 2025. Currently supported platforms:
- Linux (Ubuntu, Debian, Arch, etc.)
- macOS (Intel & Apple Silicon)
- Windows 10/11

### Is there a web wallet?

**Not yet.** A web-based wallet is planned for 2026. For now, use:
- **CLI binary** (recommended)
- **Docker container**
- **Python from source**

---

## Wallets & Transactions

### How do I create a wallet?

```bash
# CLI binary
./zion-cli wallet --create

# Output:
# Wallet created!
# Address: zion1abc123def456...
# Private key saved to: wallet_private_key.txt
# ⚠️ BACKUP THIS FILE!
```

**Important:**
- Backup `wallet_private_key.txt` securely
- Never share your private key
- If you lose it, funds are GONE FOREVER

### What do ZION addresses look like?

ZION addresses start with `zion1` and are 62 characters long:

**Example:** `zion1abc123def456ghi789jkl012mno345pqr678stu901vwx234`

### How do I send ZION tokens?

```bash
./zion-cli send --to zion1recipient... --amount 10.50 --fee 0.001
```

**Parameters:**
- `--to`: Recipient address
- `--amount`: Amount to send (ZION)
- `--fee`: Transaction fee (default 0.001 ZION)

### How long do transactions take?

| Confirmations | Time | Security Level |
|---------------|------|----------------|
| 0 (pending) | 0s | None (reversible) |
| 1 | ~2 min | Low (small amounts) |
| 3 | ~6 min | Medium (normal) |
| 6 | ~12 min | High (exchanges) |
| 12+ | ~24 min | Maximum (large sums) |

### What are transaction fees?

**Typical fees:**
- Standard transaction: 0.001 ZION (~$0.0001)
- Multi-sig transaction: 0.002 ZION
- Smart contract (future): Variable

**Fee calculation:**
- Fees go to miners
- Higher fees = faster confirmation
- Minimum fee: 0.0001 ZION

### Can I reverse a transaction?

**No.** Blockchain transactions are **irreversible**. Always:
- Double-check recipient address
- Verify amount before sending
- Use small test transactions first

### What is a multi-sig wallet?

A **multi-signature wallet** requires M-of-N signatures to spend funds:

**Example:** 3-of-5 wallet
- 5 people have private keys
- Any 3 must sign to approve transaction
- More secure for organizations/teams

**Use cases:**
- Corporate treasuries
- DAO governance
- Family savings

---

## Mining Questions

### Can I mine ZION?

**Yes!** ZION uses Cosmic Harmony - a GPU-friendly mining algorithm.

**Requirements:**
- GPU: NVIDIA or AMD with 2GB+ VRAM
- Software: ZION CLI or compatible miner
- Pool: pool.zionterranova.com:3333

**Full guide:** [MINING_GUIDE.md](./MINING_GUIDE.md)

### Is mining profitable?

**Depends on:**
- Hardware (GPU model)
- Electricity costs
- ZION price
- Network hashrate

**Example calculation:**
```
GPU: RTX 3060 (45 MH/s)
Power: 170W @ $0.12/kWh
ZION price: $0.10
Daily profit: ~$5-8 (testnet estimates)
```

**Use calculator:** [zionminingcalc.com](https://zionminingcalc.com) (coming soon)

### Can I mine with CPU only?

**Yes, but not recommended.** CPU mining is:
- Very slow (~1-5 MH/s on modern CPUs)
- Less profitable than GPU mining
- Better for: Testing, learning, supporting network

**CPU Mining Guide:**
```bash
# Start CPU mining
./zion-cli mine --start \
  --cpu-only \
  --threads 8 \  # Number of cores - 2
  --wallet YOUR_ADDRESS

# Expected hashrate:
# 4-core: 1-2 MH/s
# 8-core: 3-5 MH/s
# 16-core: 8-12 MH/s
# 32-core: 15-20 MH/s
```

**Profitability:**
- GPU (RTX 3060): 45 MH/s (~$5-8/day)
- CPU (16-core): 10 MH/s (~$1-2/day)
- **Verdict:** GPU is ~20x more efficient

**When to use CPU mining:**
- You don't have a GPU
- Testing before buying GPU
- Supporting network decentralization
- Learning how mining works

**Recommendation:** If serious about mining, invest in GPU (even budget GTX 1060 is 10x faster than high-end CPU).

### What GPU is best for mining ZION?

**Best performance-per-watt:**
| GPU | Hashrate | Power | Efficiency | Price |
|-----|----------|-------|------------|-------|
| RTX 4070 Ti | 125 MH/s | 200W | 0.625 MH/W | $$$ |
| RX 6600 XT | 55 MH/s | 130W | 0.423 MH/W | $$ |
| RTX 3060 | 45 MH/s | 170W | 0.265 MH/W | $$ |

**CPU Mining (for comparison):**
| CPU | Hashrate | Power | Efficiency | Price |
|-----|----------|-------|------------|-------|
| Ryzen 9 7950X (16-core) | 12 MH/s | 170W | 0.071 MH/W | $$$ |
| Ryzen 7 5800X (8-core) | 5 MH/s | 105W | 0.048 MH/W | $$ |
| Intel i5-12600K (10-core) | 6 MH/s | 125W | 0.048 MH/W | $$ |

**Budget option:** Used RTX 3060 or RX 6600 XT  
**High performance:** RTX 4070 Ti or RTX 4080  
**CPU-only:** Not recommended (20x slower than budget GPU)

### Do I need to join a pool?

**Recommended for most miners:**
- **Solo mining:** Irregular rewards (only when you find block)
- **Pool mining:** Regular payouts (every 30 minutes)

**Solo mining viable if:**
- You have 10+ GPUs
- You want to support decentralization
- You don't mind variance

### How often are mining payouts?

**Pool mining:**
- Payout frequency: Every 30 minutes
- Minimum balance: 10 ZION
- Transaction fee: 0.1 ZION (pool pays)

**Solo mining:**
- Payout: When you find block (50 ZION)
- Frequency: Depends on hashrate

### What are mining pool fees?

**Official pool (pool.zionterranova.com):**
- Fee: 1% of rewards
- Payout threshold: 10 ZION
- No registration required

---

## Technical Questions

### What consensus mechanism does ZION use?

**WARP Engine** - a custom Proof of Work (PoW) variant with:
- Cosmic Harmony algorithm (GPU-optimized)
- Adaptive difficulty adjustment
- ~2 minute block times
- Humanitarian allocation (10% per block)

### What is Cosmic Harmony?

**Cosmic Harmony** is ZION's mining algorithm combining:
1. **BLAKE3** - Fast cryptographic hashing
2. **Yescrypt** - Memory-hard function (ASIC resistance)
3. **Autolykos2** - GPU-friendly computation
4. **Consciousness Field** - Unique difficulty modifier

**Result:** GPU-friendly, ASIC-resistant, energy-efficient mining.

### Can ZION run smart contracts?

**Not yet.** Smart contracts are planned for:
- **Beta:** Q1 2026 (testnet)
- **Production:** Q2 2026 (mainnet)

**Planned features:**
- EVM compatibility (Ethereum Solidity)
- Custom ZION-VM
- Gas-efficient execution

### What programming languages can I use?

**Current (RPC API development):**
- Python (official SDK)
- JavaScript/Node.js
- Go
- Any language with HTTP/JSON support

**Future (smart contracts):**
- Solidity (EVM compatible)
- Rust (ZION-VM native)
- Vyper

### Does ZION support NFTs?

**Not yet.** NFT support planned for 2026 with:
- ERC-721 compatibility
- Low minting fees
- Decentralized storage (IPFS)

### Can ZION scale?

**Current capacity:**
- 10-50 TPS (transactions per second)
- ~25 TX per block
- 2 MB max block size

**Scaling roadmap:**
- **2026 Q2:** Sharding (parallel chains)
- **2026 Q3:** Layer 2 solutions
- **2027:** 1000+ TPS target

---

## Troubleshooting

### My wallet balance shows 0 ZION

**Possible causes:**
1. **Node not synced** - Wait for blockchain sync
2. **Wrong network** - Ensure connected to testnet
3. **Incorrect address** - Verify wallet address

**Solution:**
```bash
./zion-cli node --status  # Check sync status
./zion-cli wallet --balance  # Verify balance
```

### Mining shows 0 hashrate

**Possible causes:**
1. **GPU drivers not installed**
2. **Cosmic Harmony library missing**
3. **GPU in use by other app**

**Solution:**
```bash
# Check GPU
nvidia-smi  # NVIDIA
rocm-smi    # AMD

# Update drivers
sudo apt install nvidia-driver-470  # Ubuntu NVIDIA
```

### "Connection refused" error

**Possible causes:**
1. **Node not running**
2. **Firewall blocking ports**
3. **Wrong RPC endpoint**

**Solution:**
```bash
# Check if node running
curl https://api.zionterranova.com/api/status

# Check firewall
sudo ufw status
sudo ufw allow 8545  # RPC port
sudo ufw allow 8333  # P2P port
```

### Transactions stuck "pending"

**Possible causes:**
1. **Low fee** - Increase transaction fee
2. **Network congestion** - Wait longer
3. **Node not connected** - Check peer count

**Solution:**
```bash
# Check transaction status
./zion-cli tx --status TX_HASH

# Increase fee and resend
./zion-cli send --to ADDRESS --amount 10 --fee 0.01
```

### Can't sync blockchain

**Possible causes:**
1. **No peers connected**
2. **Firewall blocking P2P**
3. **Corrupted blockchain data**

**Solution:**
```bash
# Add seed node manually
./zion-cli node --add-peer 91.98.122.165:8333

# Check peers
./zion-cli node --peers

# Reset blockchain (last resort)
rm -rf ~/.zion/blockchain
./zion-cli node --resync
```

---

## Security & Privacy

### Is ZION secure?

**Yes.** ZION uses industry-standard cryptography:
- **Hashing:** BLAKE3 (fastest secure hash)
- **Signatures:** ECDSA secp256k1 (same as Bitcoin)
- **Encryption:** AES-256 (wallet storage)

**Security features:**
- Multi-signature wallets
- SSL/TLS for all network communication
- Regular security audits
- Open source (auditable code)

### Can transactions be traced?

**Yes.** ZION blockchain is **transparent** like Bitcoin:
- All transactions are public
- Addresses are pseudonymous (not anonymous)
- Block explorer shows all activity

**Privacy features (planned 2026):**
- Stealth addresses
- Ring signatures
- Zero-knowledge proofs

### How do I backup my wallet?

**Method 1: Export private key**
```bash
./zion-cli wallet --export --encrypt
# Saves encrypted backup to wallet_backup.json
```

**Method 2: Paper wallet**
```bash
# Print private key and address
./zion-cli wallet --info
# Write on paper, store securely
```

**Best practices:**
- Store backups in multiple locations
- Use encrypted storage
- Never share private keys
- Test restore process

### What if I lose my private key?

**You lose access to your funds FOREVER.**

There is NO:
- Password reset
- Recovery service
- Customer support for lost keys

**Prevention:**
- Backup immediately after creation
- Store backups securely (safe, vault)
- Consider multi-sig for large amounts

### Is my IP address tracked?

**Possible.** When you:
- Connect to RPC endpoint → Server sees your IP
- Mine in pool → Pool operator sees your IP
- Run full node → Peers see your IP

**Privacy solutions:**
- Use VPN
- Use Tor (future support)
- Run own node (more private)

---

## Economics & Tokenomics

### What is ZION's total supply?

**Maximum supply:** 21 billion ZION  
**Initial supply:** 0 ZION (fair launch, no premine for public)  
**Humanitarian premine:** Reserved for global initiatives

### How are ZION tokens created?

**Mining rewards:**
- Block reward: 50 ZION per block
- Miner receives: 45 ZION (90%)
- Humanitarian fund: 5 ZION (10%)
- Block time: ~2 minutes

**Emission schedule:**
| Year | Block Reward | Annual Inflation |
|------|-------------|------------------|
| 2025-2026 | 50 ZION | High (bootstrapping) |
| 2027-2028 | 25 ZION | Medium |
| 2029-2030 | 12.5 ZION | Low |
| 2031+ | Decreasing | Very low |

### Will ZION tokens have value?

**Testnet tokens:** NO value (for testing only)

**Mainnet tokens (2026):**
- Value determined by market
- Depends on adoption, utility, demand
- No guarantees or promises

### Where can I trade ZION?

**Currently:** Nowhere (testnet only)

**Planned (mainnet):**
- Decentralized exchanges (DEX)
- Centralized exchanges (CEX applications)
- Direct P2P trading

### What is the humanitarian fund?

**10% of mining rewards** go to fund:
- Global poverty reduction
- Education initiatives
- Healthcare access
- Environmental projects
- Disaster relief

**Governance:**
- DAO voting (future)
- Transparent allocation
- Regular reporting

### Can ZION be used for payments?

**Future plans:**
- Merchant integrations
- Payment processors
- Lightning Network support
- Fiat on/off ramps

**Current:** Focus on testnet validation and network stability.

---

## Need More Help?

### Documentation
- **[Quick Start Guide](./QUICK_START.md)** - Get running in 5 minutes
- **[Mining Guide](./MINING_GUIDE.md)** - Complete mining tutorial
- **[RPC API Reference](./RPC_API.md)** - Developer docs
- **[Architecture Overview](./ARCHITECTURE.md)** - Technical deep-dive

### Community Support
- **GitHub Issues:** [Report bugs](https://github.com/estrelaisabellazion3/Zion-2.8/issues)
- **GitHub Discussions:** [Ask questions](https://github.com/estrelaisabellazion3/Zion-2.8/discussions)
- **Email:** admin@zionterranova.com

### Development Resources
- **Explorer:** [explorer.zionterranova.com](https://explorer.zionterranova.com)
- **RPC Endpoint:** [api.zionterranova.com](https://api.zionterranova.com)
- **Mining Pool:** pool.zionterranova.com:3333

---

**Still have questions? Open a [GitHub Discussion](https://github.com/estrelaisabellazion3/Zion-2.8/discussions)!**

*ZION FAQ - Your questions answered*  
*Version 2.8.3 "Terra Nova" - October 2025*