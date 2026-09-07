# Stránka 2: Technická Architektura

---

## 🏗️ ZION Core Blockchain

### Technologický Stack

ZION Core je postaven na osvědčené CryptoNote architektuře s moderními vylepšeními:

```
┌────────────────────────────────────────────────────┐
│   ZION v2.9.0 TECHNOLOGY STACK (PRODUCTION)        │
├────────────────────────────────────────────────────┤
│                                                    │
│  Layer 4: Applications                             │
│  ├─ Presale Portal (644 LOC, 31KB)               │
│  ├─ Unified Wallet Registry (980 LOC)            │
│  ├─ Mining Pool Dashboard                         │
│  └─ WARP Bridge UI (60% complete)                │
│                                                    │
│  Layer 3: RPC & API (16,309 LOC)                  │
│  ├─ ZION RPC Server (1,262 LOC)                  │
│  │   ├─ JSON-RPC 2.0 (HTTP POST)                 │
│  │   ├─ REST API (HTTP GET)                      │
│  │   ├─ WebSocket (Real-time events)             │
│  │   └─ 40+ RPC methods                          │
│  ├─ API Module (1,012 LOC)                       │
│  └─ Database Layer (978 LOC)                     │
│                                                    │
│  Layer 2: Mining & Pool (4,215 LOC)               │
│  ├─ Mining Pool v2.9 (22 modules)                │
│  │   ├─ Stratum Protocol (531 LOC)               │
│  │   ├─ Share Validator (330 LOC)                │
│  │   ├─ Job Manager (341 LOC)                    │
│  │   └─ 100% acceptance rate ✅                   │
│  ├─ RandomX Integration (103 kH/s)               │
│  ├─ Multi-Algorithm Support (4 algos)            │
│  └─ Consciousness Mining (884 LOC)               │
│                                                    │
│  Layer 1: Blockchain Core (Python, 1,589 LOC)     │
│  ├─ ZION Blockchain v2.9                         │
│  │   ├─ Genesis: 16.78B premine                  │
│  │   ├─ Block Reward: 50 Credits                 │
│  │   ├─ Difficulty Adjustment                    │
│  │   └─ SQLite + WAL mode                        │
│  ├─ P2P Network (392 LOC, ⚠️ skeleton)           │
│  └─ Transaction Processing                        │
│                                                    │
│  Total: 56,047 LOC across 116 modules             │
│  Status: 85% code complete, 60% production ready  │
└────────────────────────────────────────────────────┘
```

---

## 🔐 Consensus Mechanismus: RandomX Proof-of-Work

### Proč RandomX?

**RandomX** je state-of-the-art CPU-optimalizovaný Proof-of-Work algoritmus původně vyvinutý pro Monero.

**Klíčové výhody:**

1. **ASIC Resistance**
   - Algoritmus využívá CPU instrukční sadu (AES-NI, floating point)
   - ASIC development ekonomicky nerentabilní
   - GPU 10-20% efektivnější než CPU, ne 1000x jako u SHA-256

2. **Memory Hard**
   - Vyžaduje 2+ GB RAM pro mining
   - Brání FPGA implementacím
   - Favoruje běžné PC před specializovaným hardwarem

3. **Egalitarian Mining**
   - **Your laptop can mine!** Intel i5 = ~1000 H/s, i7 = ~2000 H/s
   - AMD Ryzen efektivnější než Intel (3000-6000 H/s)
   - Server CPUs (EPYC, Threadripper) = 10k-30k H/s

**Benchmark:**
```
Hardware                   Hashrate (H/s)   Daily ZION (estimate)
───────────────────────────────────────────────────────────────
Intel i5 (quad-core)       ~1,000 H/s       ~15 ZION
Intel i7 (8-core)          ~2,000 H/s       ~30 ZION
AMD Ryzen 5 (6-core)       ~4,000 H/s       ~60 ZION
AMD Ryzen 9 (16-core)      ~8,000 H/s       ~120 ZION
AMD Threadripper (32-core) ~20,000 H/s      ~300 ZION
```

*Daily estimates při network hashrate 1 MH/s, actual varies*

---

## 📊 Technické Parametry (v2.9.0 "Quantum Leap")

### Core Specifications

| Parametr | Hodnota | Poznámka |
|----------|---------|----------|
| **Total Supply** | **144,000,000,000 Dharma Credits** | 144 miliard (12×12×1B) |
| **Currency Name** | **ZION Dharma Credits** | Spiritual economy token |
| **Decimals** | 6 | 1 Credit = 1,000,000 atomic units |
| **Block Time** | 60 sekund | Unified target |
| **Block Reward** | **50 Dharma Credits** | Fixed (no halving) |
| **Daily Emission** | **~72,000 Credits/day** | 1,440 blocks × 50 |
| **Genesis Premine** | **16,780,000,000 Credits** | 11.65% of supply |
| **Mining Supply** | **127,220,000,000 Credits** | 88.35% of supply |
| **Presale Allocation** | **500,000,000 Credits** | 3.1% of premine |
| **Emission Period** | ~7,000 years | Long-term sustainability |

### Network Ports

| Service | Port | Protocol | Použití |
|---------|------|----------|---------|
| **P2P Network** | 18080 | TCP | Node synchronization |
| **RPC** | 18081 | HTTP | Wallet/node communication |
| **RPC Shim** | 18089 | HTTP | Monero-compatible API |
| **Stratum Pool** | 3333 | TCP | Mining pool connection |

### Difficulty Adjustment

```python
# ZION Difficulty Adjustment Algorithm
TARGET_BLOCK_TIME = 60  # seconds
DIFFICULTY_WINDOW = 720  # blocks (~12 hours)

def calculate_next_difficulty(blocks):
    """
    Adjusts difficulty based on recent block times
    to maintain 60-second average.
    """
    if len(blocks) < DIFFICULTY_WINDOW:
        return blocks[-1].difficulty
    
    # Calculate actual time for last 720 blocks
    actual_time = blocks[-1].timestamp - blocks[-DIFFICULTY_WINDOW].timestamp
    expected_time = DIFFICULTY_WINDOW * TARGET_BLOCK_TIME  # 43,200s = 12h
    
    # Adjust difficulty proportionally
    ratio = actual_time / expected_time
    new_difficulty = blocks[-1].difficulty / ratio
    
    # Limit change to ±50% per adjustment (anti-manipulation)
    max_change = blocks[-1].difficulty * 1.5
    min_change = blocks[-1].difficulty * 0.5
    
    return max(min_change, min(max_change, new_difficulty))
```

**Features:**
- ✅ Responds to hashrate changes within ~12 hours
- ✅ Prevents sudden difficulty spikes/drops
- ✅ Stabilizes block time around 60s average
- ✅ Resists difficulty manipulation attacks

---

## 🔒 Privacy Technologie: CryptoNote Protocol

### Ring Signatures

**Co to je?**  
Ring signature umožňuje podepsat transakci jedním klíčem z množiny možných klíčů, aniž by bylo možné určit, který konkrétní klíč byl použit.

**Analogie:**  
Představ si, že 10 lidí má každý klíč od trezoru. Když se otevře trezor, víš, že to byl jeden z těch 10 lidí, ale nevíš který.

**V ZION:**
```
Transaction Input:
├─ Real spending key (tvůj)
├─ Decoy key 1 (náhodný z blockchainu)
├─ Decoy key 2 (náhodný z blockchainu)
├─ Decoy key 3 (náhodný z blockchainu)
├─ Decoy key 4 (náhodný z blockchainu)
└─ Decoy key 5 (náhodný z blockchainu)

Ring Size: 6 keys
Anonymity Set: 1/6 = 16.67% guess probability
```

**Security:**  
S ring size 11 (default Monero) = 9% guess probability  
S ring size 21 = 4.76% guess probability  
S ring size 101 = 0.99% guess probability

**ZION Implementation:**  
- Default ring size: **11** (balance privacy/performance)
- Configurable up to 101 (paranoid mode)
- Mandatory ring signatures (no opt-out)

### Stealth Addresses

**Co to je?**  
Stealth address generuje unikátní jednoúčelovou adresu pro každou transakci.

**Analogie:**  
Místo aby ti všichni posílali peníze na jednu P.O. Box schránku (všichni vidí, kolik dostáváš), každá transakce vytvoří novou schránku - nobody can link them to you.

**V ZION:**
```
Your Public Address (share with everyone):
ZION_YOUR_NAME_PUBLIC_ADDRESS_ABC123XYZ

Transaction 1 creates: ZION_STEALTH_1_DEF456
Transaction 2 creates: ZION_STEALTH_2_GHI789
Transaction 3 creates: ZION_STEALTH_3_JKL012

Observer sees: 3 unrelated addresses
You see: All 3 belong to you (using view key)
```

**Privacy Benefit:**  
- ❌ Bitcoin: Everyone sees your balance (transparent addresses)
- ✅ ZION: Nobody sees your balance (stealth addresses)

### Ring Confidential Transactions (RingCT)

**Co to je?**  
Skrývá amount (částku) v transakci, zatímco prokazuje, že inputs = outputs.

**Magic:**  
- Observer vidí: "Transaction happened"
- Observer **NEVIDÍ:** "How much was transferred"
- Math prokazuje: "No coins were created/destroyed"

**Cryptographic Commitments:**
```
Commitment = Amount × G + Blinding_Factor × H

Where:
- G, H jsou elliptic curve points
- Amount je skrytá hodnota
- Blinding_Factor je random secret
- Output commitment looks random but is verifiable
```

**Result:**
```
Public Blockchain Shows:
├─ Transaction ID: 5f3a...
├─ Ring Signature: VALID ✓
├─ Input Commitment: 8b2c... (amount hidden)
├─ Output Commitment: 3d9f... (amount hidden)
└─ Proof: Inputs = Outputs ✓

Only Sender & Receiver Know:
├─ Actual amount transferred
└─ True identities
```

---

## 🛠️ Implementation Details

### C++ Core Blockchain

**Dependencies:**
- **Boost Libraries:** Networking, threading, filesystem
- **OpenSSL:** Cryptographic primitives (SHA-3, AES)
- **LevelDB:** Fast key-value blockchain storage
- **RandomX Library:** PoW algorithm implementation

**File Structure:**
```
zion/
├── src/
│   ├── cryptonote_core/        # Blockchain logic
│   │   ├── blockchain.cpp      # Block validation
│   │   ├── tx_pool.cpp         # Mempool management
│   │   └── cryptonote_tx_utils.cpp  # Transaction building
│   ├── crypto/                 # Cryptographic functions
│   │   ├── crypto.cpp          # Signing, hashing
│   │   ├── ringct/             # RingCT implementation
│   │   └── random.c            # Secure randomness
│   ├── p2p/                    # Peer-to-peer networking
│   │   ├── net_node.cpp        # Node connections
│   │   └── protocol_defs.h     # P2P messages
│   └── daemon/                 # ziond (daemon)
│       └── main.cpp            # Entry point
├── external/
│   ├── randomx/                # RandomX library
│   └── miniupnp/               # NAT traversal
└── tests/                      # Unit & integration tests
```

**Build Process:**
```bash
# Ubuntu/Debian build
sudo apt-get install build-essential cmake libboost-all-dev \
  libssl-dev libzmq3-dev libunbound-dev libsodium-dev

git clone https://github.com/estrelaisabellazion3/Zion-TestNet-2.7.5.git
cd Zion-TestNet-2.7.5
mkdir build && cd build
cmake ..
make -j$(nproc)

# Results:
# - ziond (daemon/node)
# - zion-wallet-cli (CLI wallet)
# - zion-wallet-rpc (RPC wallet)
```

### Node.js RPC Shim

**Purpose:** Monero-compatible API pro wallets a pools

**Stack:**
- Express 4.19 (HTTP server)
- Redis (caching, session storage)
- WebSocket (real-time updates)

**Endpoints:**
```javascript
// Example: Get wallet balance
POST /json_rpc
{
  "jsonrpc": "2.0",
  "id": "0",
  "method": "get_balance",
  "params": {
    "account_index": 0,
    "address_indices": [0]
  }
}

Response:
{
  "id": "0",
  "jsonrpc": "2.0",
  "result": {
    "balance": 157000000000,        // 157,000 ZION
    "unlocked_balance": 157000000000,
    "multisig_import_needed": false
  }
}

// Example: Create transaction
POST /json_rpc
{
  "jsonrpc": "2.0",
  "id": "0",
  "method": "transfer",
  "params": {
    "destinations": [{
      "amount": 1000000000,  // 1000 ZION
      "address": "ZION_RECIPIENT_ADDRESS..."
    }],
    "account_index": 0,
    "priority": 2,           // Normal priority
    "ring_size": 11,         // Privacy level
    "get_tx_key": true
  }
}
```

**Compatibility:**  
Existing Monero wallets can connect with minimal modifications!

---

## 🌐 Network Architecture

### Peer-to-Peer Network

**Protocol:** Custom CryptoNote P2P with flood-fill broadcasting

**Node Types:**

1. **Full Nodes** (ziond)
   - Store complete blockchain history
   - Validate all transactions and blocks
   - Relay to peers
   - Resource: ~50 GB storage, 4 GB RAM

2. **Mining Nodes** (ziond + XMRig)
   - Full node + mining software
   - Submit block candidates
   - Earn block rewards

3. **Pool Nodes** (node-cryptonote-pool)
   - Distribute mining work via Stratum
   - Aggregate miner shares
   - Submit blocks to network
   - Handle payouts

4. **Light Wallets** (future)
   - Connect to remote node
   - Don't download full blockchain
   - Trust remote node for balance

**Seed Nodes:**
```yaml
Production Seeds:
  - 91.98.122.165:18080 (Hetzner, Germany)
  - seed2.zion.network:18080 (future)
  - seed3.zion.network:18080 (future)

Tor Hidden Services:
  - zion...onion:18080 (future - censorship resistance)
```

### Block Propagation

```
1. Miner finds block
   ↓
2. Submit to own node (localhost:18081)
   ↓
3. Node validates block
   ↓
4. Broadcast to connected peers (~8 connections)
   ↓
5. Peers validate & re-broadcast
   ↓
6. Entire network updated in ~5-10 seconds
```

**Optimization:**
- Compact block relay (send block header + tx IDs, peers fetch missing txs)
- Peer scoring (ban slow/malicious nodes)
- Geographic diversity (connect to nodes worldwide)

---

## 📦 Database & Storage

### LevelDB Blockchain Storage

**Why LevelDB?**
- Fast key-value storage (Google-developed)
- Efficient range queries (scan blocks by height)
- Compression (reduce disk usage)
- Crash-safe (atomic writes)

**Storage Layout:**
```
~/.zion/lmdb/  (blockchain database)
├── data.mdb           # Main blockchain data (~40 GB)
├── lock.mdb           # Database lock file
└── checkpoints.dat    # Hardcoded block hashes (anti-reorg)

~/.zion/p2pstate.bin   # Peer list (known nodes)
~/.zion/poolstate.bin  # Transaction pool state
```

**Pruning (Future Feature):**
```bash
# Full node: Store all historical data (~50 GB)
ziond

# Pruned node: Store last 6 months (~10 GB)
ziond --prune-blockchain

# Trade-off: Can't serve full chain to syncing peers
```

---

## ⚡ Performance Optimizations

### Transaction Pool (Mempool)

**Purpose:** Hold unconfirmed transactions before mining

**Algorithm:**
```python
class TransactionPool:
    def add_transaction(self, tx):
        # Validate transaction
        if not self.validate_tx(tx):
            return False
        
        # Check fee (min 0.001 ZION)
        if tx.fee < 1000000:  # atomic units
            return False
        
        # Check double-spend
        if self.is_double_spend(tx):
            return False
        
        # Add to pool (sorted by fee/byte ratio)
        self.pool.insert_sorted(tx, key=lambda t: t.fee / t.size)
        return True
    
    def get_transactions_for_mining(self, max_size_kb):
        """Select highest-fee transactions that fit in block"""
        block_txs = []
        total_size = 0
        
        for tx in self.pool:
            if total_size + tx.size <= max_size_kb * 1024:
                block_txs.append(tx)
                total_size += tx.size
            else:
                break  # Block full
        
        return block_txs
```

**Limits:**
- Max mempool size: 100 MB
- Max transaction size: 100 KB
- Max transactions per block: ~1000 (varies by tx size)

### Verification Parallelization

**Modern CPUs = multi-core → parallel verification!**

```cpp
// Verify 720 blocks (difficulty window) in parallel
void BlockchainCore::verify_blocks_parallel(std::vector<Block> blocks) {
    const int num_threads = std::thread::hardware_concurrency();
    std::vector<std::thread> threads;
    
    auto verify_batch = [](std::vector<Block> batch) {
        for (auto& block : batch) {
            if (!verify_block_cryptography(block)) {
                throw std::runtime_error("Invalid block");
            }
        }
    };
    
    // Split blocks into batches
    int batch_size = blocks.size() / num_threads;
    for (int i = 0; i < num_threads; ++i) {
        auto start = blocks.begin() + i * batch_size;
        auto end = (i == num_threads - 1) ? blocks.end() : start + batch_size;
        threads.emplace_back(verify_batch, std::vector<Block>(start, end));
    }
    
    // Wait for all threads
    for (auto& t : threads) {
        t.join();
    }
}
```

**Result:** Block sync 4-8× faster on multi-core CPUs!

---

## 🔐 Security Features

### Checkpoint System

**Purpose:** Prevent deep blockchain reorgs (51% attacks)

```cpp
// Hard-coded block hashes at specific heights
static const std::map<uint64_t, std::string> CHECKPOINTS = {
    {0,      "7f...a2"},  // Genesis block
    {1000,   "3c...d9"},
    {10000,  "8b...f4"},
    {50000,  "2a...c7"},
    // Updated monthly by core developers
};

bool is_valid_blockchain(Blockchain& chain) {
    for (auto& checkpoint : CHECKPOINTS) {
        if (chain.get_block_hash(checkpoint.height) != checkpoint.hash) {
            return false;  // Chain doesn't match checkpoint!
        }
    }
    return true;
}
```

**Protection:**  
Attacker with 51% hashrate can only reorg blocks after last checkpoint. Can't rewrite entire history.

### Double-Spend Protection

**Key Image System:**

Every transaction input creates a **key image** - unique cryptographic marker.

```
Transaction spends output X
→ Generates key_image_X (deterministic from private key)
→ Blockchain remembers all key images
→ Future transaction with same key_image_X = REJECTED (double spend!)
```

**Privacy Preserved:**  
Key image doesn't reveal which ring signature member was spent (still anonymous).

---

## 🎯 Future Upgrades (Roadmap)

### Bulletproofs+ (Already in Monero)

**Current:** RingCT proofs ~2-3 KB per output  
**Bulletproofs+:** ~0.7 KB per output (~70% reduction!)

**Benefit:**
- Smaller transactions → more txs per block
- Lower fees (fee = size × rate)
- Faster sync (less data to download)

### Payment Channels (Lightning-like)

**Concept:** Off-chain micropayments

```
1. Open channel: On-chain transaction (1× blockchain space)
2. Transact off-chain: 1000× micropayments (instant, free)
3. Close channel: On-chain settlement (1× blockchain space)

Result: 1000 transactions using 2 on-chain slots!
```

**Use Case:** Streaming payments, gaming microtransactions, IoT

### Atomic Swaps

**Cross-chain swaps without centralized exchanges!**

```
Alice (has ZION) wants Bob's BTC:
1. Alice locks ZION in smart contract with hash H
2. Bob locks BTC in smart contract with same hash H
3. Alice reveals secret S (unlocks BTC)
4. Bob uses S to unlock ZION
5. Both parties get their coins, no trust needed!
```

**Currently:** Works for BTC, LTC, BCH  
**Future:** Solana, Stellar, Cardano via Rainbow Bridge

---

**Pokračování:** [Stránka 3: Multi-Chain Rainbow Bridge →](./03_MULTICHAIN_BRIDGE.md)

---

*Stránka 2 z 12 | ZION Multi-Chain Dharma Ecosystem Whitepaper v1.0*
