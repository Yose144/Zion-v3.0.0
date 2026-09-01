# ZION v3.2.0 "One Love" — Mainnet Stable

> **Released:** 6 August 2026  
> **Current public line:** v3.2.0 "One Love"  
> **Status:** Mainnet Stable — live, pool active, mining running, bridge and DEX deployed  
> **Official public launch:** 31 December 2026  
> **Genesis hash:** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`

---

## One Love in three sentences

1. **ZION is a blockchain you can verify, not just believe.** Open Rust code under the MIT license, a new block every minute, a running production network — no paper promises.
2. **Every block automatically splits its reward: 89% to the miner, 5% to a humanitarian fund, 5% to the science & future fund (Issobella), 1% burned.** The protocol itself enforces this split — no vote or corporate decision can switch it off.
3. **Nobody received a VIP entrance.** No ICO, no presale. The genesis allocation is publicly documented in code, and everything else is created by honest mining.

---

## What is v3.2.0 "One Love"

v3.2.0 "One Love" is the **Mainnet Stable** release of ZION TerraNova. It combines the Ekam Deeksha proof-of-work consensus, a unified multi-chain wallet, the ZionDex decentralized exchange, and a full protocol-level security hardening pass.

The "One Love" name marks the unification of the network, wallet, and community layers under one runtime line. All services are active and the chain has been running continuously since the August 2026 genesis reset.

---

## Key numbers

| Parameter | Value |
|---|---|
| Total supply | 144,000,000,000 ZION (hard cap) |
| Block time | ~60 seconds |
| Block reward (Decade 1, 2026–2036) | 5,400.067 ZION |
| Emission model | Decade Decay: −20% every 10 years, perpetual tail ~724.78 ZION/block from ~2126 |
| Reward split | 89% miner / 5% humanitarian / 5% Issobella / 1% burn |
| Mining algorithm | Ekam Deeksha v3.2 — memory-hard PoW (CPU/GPU, ASIC-resistant) |
| Atomic unit | 1 ZION = 1,000,000 flowers (6 decimal places) |
| Genesis hash (V3 compat) | `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` |
| Genesis hash (V31 native) | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |
| License | MIT |

---

## Key features

- **Native Rust mining** — GPU and CPU, one-click auto-detect on Linux, macOS, and Windows.
- **Terminal Miner + Desktop App** — command-line TUI and a full GUI wallet/miner/dashboard.
- **ZION Identity Service (ZIS)** — sign in with email, Google, MetaMask or X, then use the same identity across the web and CLI.
- **Multi-chain wallet** — per-user deposit addresses, ledger, and withdrawals for ZION L1 and EVM chains.
- **ZionDex** — swap and liquidity on Base Mainnet, with multi-chain routing and real on-chain settlement.
- **HTLC atomic swaps** — native L1 lock/claim/refund for cross-chain trades without custodial risk.
- **Bridge + WARP** — wrapped ZION (wZION) on Base and cross-chain transfers.
- **DAO governance** — proposals, voting, and treasury operations on-chain.
- **OASIS + L5/L6 trackers** — passive fund tracking and game-layer integrations.

---

## Choose your path

### Observer — "I want proof first" (2 minutes)

1. Open [zionterranova.com](https://zionterranova.com) and watch the live network.
2. Browse the source code on [GitHub](https://github.com/Zion-TerraNova/v3-Mainnet) — nothing is hidden.
3. Ask the community anything. A good community can say "we don't know" and point to a source.

### Player — "I want to experience it" (5 minutes)

1. Enter OASIS: [oasis.zionterranova.com](https://oasis.zionterranova.com).
2. Walk the warp intro, fly the 3D galaxy of 55 worlds, browse the Avatar Codex.
3. Explore the NFT marketplace at [market.zionterranova.com](https://market.zionterranova.com).

> **Honestly:** OASIS is a **live preview under construction** — not a finished game. Content, quests, and progression can change or reset during development. The Golden Egg and the full game economy are the future, not today's reality. You enter as a co-creator of a garden, not a customer of a finished product.

### Miner — "I want to plug in my machine" (15 minutes)

1. Create **your own** wallet — never give your mnemonic to anyone.
2. Download the Terminal Miner or Desktop App from the [Download](/download) page, or build from source:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V31
cargo build --release --bin zion-miner
./target/release/zion-miner \
  --pool pool.zionterranova.com:8444 \
  --wallet zion1...your_address \
  --worker my-first-rig
```

3. Watch accepted shares and temperatures; start conservatively.

> **Why start early:** the first decade has the highest planned block reward and a small network means you learn the wallet, rig, and security before the crowd. This is not a promise of profit — real yield depends on your hashrate, difficulty, costs, and market price. It is a description of an emission plan you can verify in code.

### Builder — "I want to carry a piece of the bridge"

1. Build the workspace, run tests, open an issue or pull request.
2. Improve documentation, add tests, fix bugs, propose better UX.
3. Bring a skill you already have — design, translation, security, music, community.

---

## Security

An internal security audit was completed on **2026-08-26** and the remediation pass was finished on **2026-09-01**.

- **48 findings** reviewed in total; severity ratings are assigned to 44 of them (2 Critical, 10 High, 20 Medium, 12 Low/Info). The remaining 4 dependency/deferred items are tracked without severity.
- **37 fixed**, **7 accepted with documented mitigations**, **4 deferred** to the v3.3 dependency migration (alloy migration) with compensating controls.
- No catastrophic fund-loss bugs were identified in production code paths.

See the [Security Audit 3.2](./security-audit.md) document for the public summary.

---

## Live infrastructure

| Service | Status | Public endpoint |
|---|---|---|
| Core node | Active | `rpc.zionterranova.com:8443` |
| Public pool | Active | `pool.zionterranova.com:8444` (Stratum) |
| Miner binaries | Active | [Download](/download) page |
| Web + wallet | Active | `https://zionterranova.com` |
| Bridge / WARP | Active | via [Multichain](/multichain) |
| DAO | Active | via [DAO](/dao) |
| OASIS | Active | `https://oasis.zionterranova.com` |
| Identity service | Active | `https://auth.zionterranova.com` |

Network height and pool status are available from the [Network](/network) page and the [Explorer](/explorer).

---

## Downloads

All v3.2.0 releases are published on GitHub with SHA256 checksums:

- **Terminal Miner** — one-click GPU/CPU auto-detect, TUI dashboard.
- **Community CLI** — single `zion` binary for wallet, node, pool, and mining.
- **Desktop App** — built-in miner, wallet, and dashboard (Linux AppImage/DEB, macOS DMG, Windows installer/ZIP).

See the [Download](/download) page for direct links.

---

## Important notices

- The network is **Mainnet Stable** but still in a pre-launch phase until the public launch on 31 December 2026.
- OASIS is a **live preview under construction** — content, quests, and progression can change or reset.
- Mine, bridge, swap, and participate **at your own risk**.
- This is an experimental open-source protocol, not an investment product.
