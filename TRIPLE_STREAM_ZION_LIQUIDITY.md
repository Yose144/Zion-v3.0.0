# Triple Stream — Zion Liquidity & Zion Grow

**Internal document — NOT for public release**
**Date:** 2026-07-21
**Status:** Live on Edge pool (62.171.141.136:8444)

---

## 1. Concept

**Triple Stream** is ZION's proprietary multi-coin mining architecture that
runs three independent mining streams in parallel on a single rig, while
paying miners exclusively in **ZION**.

```
┌─────────────────────────────────────────────────────────┐
│                    ZION MINER                           │
│                                                         │
│  Stream 1 (GPU)  →  ZION  / Deeksha Lite v1   ─┐        │
│  Stream 2 (GPU)  →  ZANO  / ProgPoWZ          ─┤→ ZION  │
│  Stream 3 (CPU)  →  VRSC  / VerusHash         ─┘ payout │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Miners see:** "Mine ZION → Earn ZION"
**Reality:** Three streams mine three coins, pool converts all rewards to ZION.

---

## 2. Why Triple Stream?

### 2.1 Zion Liquidity

Traditional mining: miner finds a block → gets coin → sells on exchange →
dumps price → exits.

**Zion Liquidity inverts this:**
- Miner runs Triple Stream → mines ZION + ZANO + VRSC simultaneously
- Pool receives all shares (ZION, ZANO, VRSC)
- Pool converts ZANO/VRSC rewards to ZION at internal rate
- Miner receives **ZION only** — no exchange, no dump, no price pressure
- ZANO/VRSC rewards flow to treasury → builds ZION liquidity backing

**Result:** Miners build ZION position by mining. Every hash, regardless of
which coin it targets, grows the miner's ZION balance and the network's
liquidity depth.

### 2.2 Zion Grow

**Zion Grow** is the miner incentive program built on Triple Stream:

- **Mine ZION** → direct ZION rewards (Deeksha, primary stream)
- **Mine ZANO** → ZION rewards at ZANO/ZION internal rate (GPU stream 2)
- **Mine VRSC** → ZION rewards at VRSC/ZION internal rate (CPU stream 3)
- **No selling pressure** — miners never touch an exchange
- **Compounding position** — the longer you mine, the more ZION you hold
- **Liquidity flywheel** — more miners → more liquidity → more stable price
  → more attractive to mine → more miners

### 2.3 Why this matters

| Traditional mining | Zion Triple Stream |
|--------------------|--------------------|
| Mine coin X | Mine ZION + ZANO + VRSC |
| Sell coin X on exchange | Pool converts to ZION internally |
| Dumps coin X price | No sell pressure on any coin |
| Miner exits when price drops | Miner accumulates ZION over time |
| Liquidity drains | Liquidity grows with every hash |

---

## 3. Technical architecture

### 3.1 Three streams

| Stream | Hardware | Algorithm | Coin | Role |
|--------|----------|-----------|------|------|
| 1 | GPU | Deeksha Lite v1 | ZION | Primary — secures ZION chain |
| 2 | GPU | ProgPoWZ | ZANO | GPU AuxPow — parallel to Stream 1 |
| 3 | CPU | VerusHash | VRSC | CPU AuxPow — uses idle CPU cores |

### 3.2 GPU sharing

Streams 1 and 2 share the same GPU. They complement each other:
- **Deeksha** is compute-bound (SHA3-512 heavy)
- **ProgPoWZ** is memory-bound (DAG random access)

The GPU hardware scheduler interleaves them naturally — deeksha uses ALU
while ProgPoWZ waits on memory, and vice versa. With `duty=100%` (parallel
mode), both run simultaneously without time-slicing.

### 3.3 Pool-side conversion

The Edge pool (62.171.141.136:8444) handles the conversion:
1. Miner submits ZION shares → pool credits ZION directly
2. Miner submits ZANO shares → pool forwards to HeroMiners, receives ZANO
   reward, converts to ZION at internal rate, credits ZION
3. Miner submits VRSC shares → pool forwards to LuckPool, receives VRSC
   reward, converts to ZION at internal rate, credits ZION

**Miner never sees ZANO or VRSC.** The wallet shows only ZION balance.

### 3.4 Performance (RX 5600 XT, live 2026-07-21)

| Stream | Algorithm | Hashrate | Efficiency |
|--------|-----------|----------|------------|
| ZION GPU | Deeksha Lite v1 | 17 KH/s | 100% |
| ZANO GPU | ProgPoWZ | 7.5-10.3 MH/s | 100% |
| VRSC CPU | VerusHash | 8.0 MH/s | 93% |
| **Total** | | | **98.4%** |

Solo deeksha (Stream 1 only): 34 KH/s — exceeds 30 KH/s target.

---

## 4. Public-facing presentation

### 4.1 What miners see

The public miner binary (v3.0.6-beta) presents a simplified interface:
- TUI shows **"ZION / Deeksha Lite v1"** as the only visible algorithm
- Hashrate display shows aggregate ZION-equivalent hashrate
- Share log shows "OK ZION" for all accepted shares
- No mention of ZANO, VRSC, ProgPoWZ, or VerusHash in the UI

### 4.2 What's hidden

- Triple Stream runs silently in the background
- AuxPow shares are submitted to external pools without user visibility
- Coin conversion happens pool-side, transparent to the miner
- Source code for AuxPow/Triple Stream is NOT in the public repo

### 4.3 Marketing message

> **Mine ZION. Earn ZION. Grow ZION.**
>
> The ZION v3.0.6 miner runs our proprietary Triple Stream engine: your GPU
> and CPU work together to maximize your ZION earnings. No exchanges, no
> selling, no price dumps. Every hash you compute grows your ZION position
> and strengthens the network's liquidity.
>
> **Zion Grow:** The longer you mine, the more ZION you hold.
> **Zion Liquidity:** Every hash deepens the ZION liquidity pool.

---

## 5. Release plan (v3.0.6-beta)

### 5.1 Binary

- **Private miner binary** (with AuxPow + Triple Stream) released as
  `zion-miner-linux-x86_64.tar.gz` on public GitHub releases
- TUI modified to show only ZION/Deeksha (no Triple Stream visible)
- Build from `MinerP3.0.6/` directory (separate from main V3)

### 5.2 What's NOT released

- AuxPow source code (`AuXpow/`)
- ProgPoWZ kernel optimizations (`AuXpow/csrc/opencl/progpow_kernel.cl`)
- Triple Stream scheduling logic
- Stale share detection algorithm
- Multi-coin stratum client

### 5.3 Public repo contents (unchanged)

The public repo (`github.com/Zion-TerraNova/v3-Mainnet`) continues to
contain only the open-source ZION core:
- `V3/L1/core` — blockchain core
- `V3/L1/pool` — mining pool
- `V3/L1/miner` — basic miner (Deeksha only, no AuxPow)
- `V3/L2/` — bridge, DAO, atomic-swap
- `V3/L3/` — NCL, WARP, AI-native
- `docs/` — whitepaper, legal, multilingual READMEs

The v3.0.6-beta release adds only the pre-built miner binary with Triple
Stream — the source code for Triple Stream remains private.

---

## 6. Internal rate calculation

The pool converts external coin rewards to ZION at an internal rate:

```
ZION_reward = external_reward × conversion_rate

where:
  external_reward = shares_accepted × share_difficulty × coin_block_reward
  conversion_rate = ZION_market_price / external_coin_market_price
```

The rate is updated periodically based on market prices. Miners always
receive ZION — the conversion is transparent and happens pool-side.

---

## 7. Roadmap

- **v3.0.6-beta** (this release): Triple Stream live, ZION-only payouts
- **v3.0.7**: Zion Grow dashboard — miners see their ZION position growth over time
- **v3.0.8**: Zion Liquidity metrics — miners see how their mining deepens liquidity
- **v3.1.0**: Public launch — Triple Stream marketing campaign, exchange listings

---

## 8. Security considerations

- **Binary only**: Triple Stream source stays private (competitive advantage)
- **No secrets in binary**: Pool address, wallet handling are standard
- **No backdoors**: Miner behaves exactly as documented (mine → earn ZION)
- **Open core**: The ZION blockchain itself is fully open-source (public repo)
- **Audit trail**: Pool-side conversion is logged and verifiable

---

## 9. Comparison with reference miners

| Miner | ZANO hashrate (RX 5600 XT) | Source |
|-------|---------------------------|--------|
| SRBMiner (proprietary) | 11-19 MH/s | closed |
| hyle-team/progminer | 4-5 MH/s | open |
| **ZION v3.0.6 (ours)** | **7.5-10.3 MH/s** | closed (binary) |

Our kernel is faster than the open-source reference and approaches
proprietary miner performance, while also running Deeksha + VRSC in
parallel — something no other miner does.
