# NIRVANA — Episode 2: Mount Ararat
## Where the ark first comes to rest on solid ground — the anchor of stability and the indestructible consensus

> *"A mountain is not a final home. It is the first proof that beneath the restless surface there still exists solid rock able to bear the weight of the world."*

---

## The Story

After many weeks of sailing toward the ray of Lumi, something happened that almost no one believed in any more.

The hull of the ark caught on a reef. It was no shipwreck; it was a slow, firm settling of the heavy keel onto a bed of stone. The ship swayed, groaned through all its timbers, and for the first time after months of constant rocking it stopped. A complete silence fell.

The people climbed the steep ladders to the upper deck. The mist parted and before them rose a massive, bare rocky massif. It stood out of the receding waters like a huge lighthouse carved by the earth itself. All around it was still cold, damp and grey basalt. No greenery, no trees laden with fruit.

They named that summit **Ararat**.

One could not live on Ararat forever — it was too steep and stony. But on it the most important thing could be done: **step onto solid ground, light the first fire the wind cannot blow out, and lay the foundation stone of the future lighthouse.**

An old blacksmith took the heavy hammer he had guarded beneath his coat through the entire flood. He struck it against the rock and said: *"Here the water moves nothing anymore. Here is the bottom, from which we build toward the sky."* And a young girl beside him poured a handful of soil into a crevice in the rock and planted a seed of wild barley.

---

## What it means

**Mount Ararat is the embodiment of unbreakable stability and immutable consensus in the blockchain organism of ZION.**

In the life of the network it represents the transition from experiment to **irreversible production reality**:

1. **A solid point in the P2P network:** No node stands alone. The ZION network is formed by a distributed mesh of nodes (Node 1, Node 2, Node 3 on Edge and independent backup nodes around the world), which continuously synchronize the chain history.
2. **LWMA-60 Difficulty Engine:** The *Linear Weighted Moving Average* adaptive difficulty algorithm with protection against jump swings (clamp ±50%) ensures that blocks are produced with iron regularity of ~60 seconds, whether the network is mined by thousands of machines or only a small group of faithful guardians.
3. **Immutability of history:** Blocks written on Ararat cannot be deleted, reorganized or overwritten by arbitrary decree. They are forever sealed by cryptographic hashes and BLAKE3 domain tagging of UTXO v2 transactions.

---

## Anchor of Truth — verifiable facts

> The facts in this box are directly testable in the repository code and on the live Edge server.

| Story element | What is verifiable on the ZION network |
|---|---|
| **Firm settling of the keel** | Block production has reached a height of **23,600+ blocks**; difficulty rate ~31,500+ with smooth adjustment of block time to ~60 s. |
| **P2P pillars of the mountain** | Multi-node mesh topology: Node 1 (port `8335`), Node 2 (`8336`), Node 3 (`8337`) with dedicated RPC sockets and `fail2ban` protection against DDoS attacks. |
| **The blacksmith's hammer** | Native SQLite indexing (`tx_index`, `output_index`, `address_tx_index` in `V31/L1/core/src/storage.rs`) for O(1) transaction response. |
| **Seed in the rock** | The PPLNS pool automatically accumulates and confirms miner payouts on-chain with a sweep mechanism and UTXO fallback. |
| **Independence from the outer world** | Zero-dependency architecture — the L1 node and pool run in pure Rust with no need for centralized cloud libraries. |

---

*→ Continued: [Episode 3 — The New Earth (Terra Nova)](./03-Nova-Zeme.md)*

---

*[Back to the Nirvana index → `00-README.md`](./00-README.md)*
