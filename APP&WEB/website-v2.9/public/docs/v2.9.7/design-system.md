# Mining ZION

> ZION is mined via Proof-of-Work using the **Cosmic Harmony Deeksha** algorithm. Mining is the sole mechanism for new coin issuance — no staking, no ICO, no presale.

---

## Cosmic Harmony Deeksha

Cosmic Harmony Deeksha is the canonical PoW path for current ZION releases:

- **CPU-friendly** — balanced for commodity hardware (x86, ARM)
- **GPU-accelerated** — OpenCL/CUDA competitive, not dominant
- **ASIC-resistant** — memory-hard design discourages specialized hardware
- **Anti-botnet** — calibrated to be feasible on consumer hardware but not profitable on compromised machines

The algorithm is implemented in Rust and exposed via native bindings for cross-platform use.

---

## Block Reward

| Epoch | Reward / Block | Years |
|-------|---------------|-------|
| Genesis (2026) | 5,400.067 ZION | 0–10 |
| Decade 2 | ~4,320 ZION | 10–20 |
| Decade 3 | ~3,456 ZION | 20–30 |
| … (−20%/decade) | … | … |
| Tail (permanent) | 725 ZION | 100+ |

Decay is automatic at the protocol level — no miner vote, no soft fork required.

Each block, the reward is split:

| Recipient | Share |
|-----------|-------|
| **Miner** | 89% |
| Humanitarian Fund | 5% |
| Issobella Foundation | 5% |
| Mining Pool | 1% |

All **transaction fees are burned**. There is no separate dev fee.

---

## Mining the Pool

The ZION public pool runs on the **primary Zion2 host** and uses Stratum v2 with PPLNS reward distribution.

**Pool address:** `stratum+tcp://seed.zionterranova.com:3333`

```bash
zion-miner \
  --pool stratum+tcp://seed.zionterranova.com:3333 \
  --wallet YOUR_ZION_ADDRESS \
  --threads 4
```

PPLNS window: proportional to shares submitted in the last N shares. The longer you mine, the more stable your payouts.

---

## Solo Mining

Connect directly to any seed node's RPC:

```bash
zion-miner \
  --rpc http://seed.zionterranova.com:8444 \
  --wallet YOUR_ZION_ADDRESS \
  --solo
```

Solo mining gives you 100% of the miner share (89%) if you find a block. At current difficulty it favors miners with significant hashrate.

---

## Dual Mining (ZION + VRSC)

ZION supports dual mining — running **Cosmic Harmony Deeksha** alongside **VerusHash** simultaneously. This allows miners to earn ZION and VRSC from the same hardware without significant performance loss.

```bash
zion-miner \
  --pool stratum+tcp://seed.zionterranova.com:3333 \
  --wallet YOUR_ZION_ADDRESS \
  --dual-pool stratum+tcp://VERUS_POOL:PORT \
  --dual-wallet YOUR_VRSC_ADDRESS
```

---

## Wallet Setup

Generate a new wallet locally — keys never leave your machine:

```bash
# Generate a BIP39 mnemonic wallet
zion-wallet gen-mnemonic --out wallet.json --print

# Show address from existing wallet
zion-wallet address --from wallet.json

# Check balance via RPC
zion-wallet balance --address YOUR_ZION_ADDRESS --rpc http://seed.zionterranova.com:8444
```

Wallet files use Ed25519 key pairs (BIP39 seed → Ed25519). Keep the mnemonic phrase offline and secure.

---

## Running a Full Node

Full nodes validate blocks, relay transactions, and strengthen the network. The more nodes, the more resilient the network.

```bash
# Start a TestNet full node
zion-node \
  --network testnet \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --data-dir ~/.zion/testnet

# Sync status
curl -X POST http://localhost:8444/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockchaininfo","id":1}'
```

Seed nodes for initial sync:
- `seed.zionterranova.com:8334` (Zion2 primary host)
- `seed1.zionterranova.com:8334`
- `seed2.zionterranova.com:8334`
- `seed3.zionterranova.com:8334`

---

## DAA — Difficulty Adjustment

ZION uses **LWMA** (Linearly Weighted Moving Average) with a 60-block window and ±25% adjustment cap per window. This keeps block times stable at 60 seconds even during sudden hashrate changes.

---

## Downloads

Pre-built CLI binaries for Linux, Windows, macOS:

[zionterranova.com/download](https://zionterranova.com/download)

Binaries include: `zion-node`, `zion-miner`, `zion-wallet`, `zion-pool`






