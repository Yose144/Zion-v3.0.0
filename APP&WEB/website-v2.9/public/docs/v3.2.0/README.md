# ZION v3.2.0 "One Love" — Mainnet Stable

> **Released:** 6 August 2026  
> **Current public line:** v3.2.0 "One Love"  
> **Status:** Mainnet Stable — live, pool active, mining running, bridge and DEX deployed  
> **Official public launch:** 31 December 2026  
> **Genesis hash:** `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`

---

## What is v3.2.0 "One Love"

v3.2.0 "One Love" is the **Mainnet Stable** release of ZION TerraNova. It combines the Ekam Deeksha proof-of-work consensus, a unified multi-chain wallet, the ZionDex decentralized exchange, and a full protocol-level security hardening pass.

The "One Love" name marks the unification of the network, wallet, and community layers under one runtime line. All services are active and the chain has been running continuously since the August 2026 genesis reset.

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

## Security

An internal security audit was completed on **2026-08-26** and the remediation pass was finished on **2026-09-01**.

- **44 findings** reviewed (2 Critical, 10 High, 20 Medium, 12 Low/Info).
- **43 of 44** findings are fixed or accepted with documented mitigations.
- **1 finding** is deferred to the v3.3 dependency migration with compensating controls.
- No catastrophic fund-loss bugs were identified in production code paths.

See the [Security Audit 3.2](./security-audit.md) document for the public summary.

---

## Live infrastructure

| Service | Status |
|---------|--------|
| Core node | Active |
| Public pool | Active |
| Miner binaries | Active |
| Web + wallet | Active |
| Bridge / WARP | Active |
| DAO | Active |
| OASIS | Active |
| Identity service | Active |

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

- The network is **Mainnet Stable** but still in a pre-launch beta phase until the public launch on 31 December 2026.
- Mine, bridge, and participate **at your own risk**.
- This is an experimental open-source protocol, not an investment product.
