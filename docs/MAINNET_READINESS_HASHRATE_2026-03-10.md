# Mainnet Readiness: Hashrate, Topology, and Deeksha Gate

Date: 2026-03-10

This note captures the practical minimum needed for a functional and defensible ZION mainnet
running canonical Deeksha across core, miner, and pool.

## 1. What "functional" means

The protocol remains functional even at low hashrate.

- Target block time is **60 seconds**.
- Difficulty uses **LWMA_WINDOW = 60**.
- Difficulty is floored by **MIN_DIFFICULTY = 1000**.
- Per-block movement is clamped, so the chain adapts rather than instantly snapping.

That means low hashrate does **not** break correctness. It only reduces:

- resistance to chain capture by one miner or one pool
- statistical smoothness of block production during bootstrap
- market confidence in network independence

## 2. What "plnohodnotna sit" should mean in practice

A credible mainnet should not rely on one machine class, one operator, or one pool.

Minimum practical gate:

- at least **3 independent full nodes** in separate regions
- at least **2 independent mining operators** before public launch
- at least **1 public pool** plus working solo-mining path
- at least **100 kH/s aggregate network hashrate** during bootstrap week

Preferred launch gate:

- **5+ independent full nodes** across at least 3 regions
- **3+ independent mining operators**
- **2 pools or 1 pool + multiple known solo miners**
- **250 kH/s to 1 MH/s aggregate network hashrate**

Robust target:

- **1 MH/s+ sustained**
- heterogeneous miners across Apple Silicon, AMD, NVIDIA, and CPU fallback
- no single operator regularly controlling more than one third of effective hashrate

## 3. Interpreting current Apple M1 performance

Current native Rust Metal Deeksha benchmark on Apple M1:

- recommended profile: `ZION_METAL_THREADS_PER_TG=64`
- observed throughput: roughly **2.4-2.5 kH/s**
- backend natural dispatch: **8192**

This makes Apple Silicon a useful bootstrap contributor, but not a sufficient security anchor on its own.

Illustrative share of network:

- at **100 kH/s** network hashrate, one M1 at **2.43 kH/s** has about **2.43%** share
- at **250 kH/s**, that falls to about **0.97%**
- at **1 MH/s**, that falls to about **0.24%**

Expected average solo block interval for one 2.43 kH/s M1:

- at **100 kH/s** network: about **41 minutes**
- at **250 kH/s** network: about **1 hour 43 minutes**
- at **1 MH/s** network: about **6 hours 52 minutes**

These are expectation values, not guarantees. Real block discovery is probabilistic.

## 4. Recommended launch sequence

1. Freeze canonical Deeksha consensus path and keep pool/miner aliases as compatibility-only wrappers.
2. Launch with at least 3 geographic full nodes and public chain monitoring.
3. Bring up one public pool and verify solo mining still works from a clean node.
4. Pre-arrange bootstrap hashrate commitments from multiple operators.
5. Track operator concentration daily during the first launch week.
6. Do not market the network as decentralized until hashrate and topology are actually distributed.

## 5. Immediate engineering priorities

- keep native Metal `tg=64` as current M1 default recommendation
- benchmark the same shader path on M2 and M3 before hard-coding broader Apple defaults
- keep CPU/OpenCL/CUDA paths aligned with the same canonical Deeksha implementation
- monitor pool share acceptance against canonical core hashes during launch rehearsal

## 6. Candidate Deeksha upgrade directions

The next promising upgrade areas are architectural, not DAG-based.

- further reduce register pressure in the Metal memory-hard path
- specialize more fixed-size SHA3 absorb/squeeze patterns
- explore vectorized loads and better 64-bit lane packing where Metal permits it
- benchmark whether some random-read accumulation can be reshaped to reduce temporary state
- port the same specialization strategy to CUDA and OpenCL for cross-vendor parity

Not recommended:

- Ethash-style global DAG generation
- anything that changes the canonical Deeksha output without an explicit consensus upgrade process