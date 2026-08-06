# ZION Mainnet — v3.0.6 Trinity / Mainnet Beta

> **Genesis #0 launched:** June 11, 2026
> **Current public line:** v3.0.6 (Trinity)
> **Runtime:** v3.0.6 Ekam Deeksha — canonical, 6-decimal flowers
> **Status:** Mainnet Beta — live, pool active, mining operational
> **Official public launch:** 31 December 2026
> **Network:** `zion-mainnet-1`
> **Genesis hash:** `08a94fb04ad084724af33b62c81b84a3472c32d89bbeccd0a8751fd893bfa122`

---

## What is Mainnet Beta?

**Mainnet Beta** means the ZION blockchain is running live with real consensus, real mining, real wallets and real economic parameters — but the network is still being hardened and audited before the official public launch.

In practical terms:

- ✅ Blocks are produced every ~60 seconds on the live mainnet chain.
- ✅ Mining is active and earns real block rewards.
- ✅ DeFi, bridge, DAO and WARP services are deployed.
- ⚠️ The network may still contain bugs. Mine, bridge and participate **at your own risk**.
- 🗓️ The **official public launch** and broader exchange / marketing push remains **31 December 2026**.

> **Why Beta and not final launch?** The June 2026 genesis was a clean start, but several security incidents (F1 forged signatures, F5 unlimited-inflation bug, server compromise) forced a hard reset and rebuild. v3.0.5 is the verified, all-green recovery state. We are keeping the "Beta" label until the security audit, key-rotation and external validator set milestones planned for Q4 2026 are complete.

---

## Transition to v3.0.5 — from 3.0.1 to All Green

| Milestone | Date | What happened |
|-----------|------|---------------|
| **v3.0.1 Genesis Launch** | 11 Jun 2026 | First public mainnet block (#0), dual-node Edge, pool and mining live. |
| **v3.0.3 Decimal fork** | 27 Jun 2026 | `1e12` → `1e6` flower scale. All balances and RPC calls moved to 6-decimal `flowers`. |
| **Security incidents** | 2–3 Jul 2026 | F1 forged P2P account TX exploit, F5 account-model balance-check bug, server compromise. Chain rolled back and old Edge server decommissioned. |
| **v3.0.4 Hard Genesis Reset** | 6–7 Jul 2026 | New server provisioned, new genesis hash, all keys regenerated, full stack redeployed. |
| **v3.0.5 All Green** | 9 Jul 2026 | Protocol version bumped to 3.0.5, L2 watchers operationalized, 11/11 services active, E2E memo tests confirmed in block 752. |

---

## Security incident summary

### F1 — Forged account transaction via P2P

An attacker at a compromised external peer injected a forged account-model transaction by bypassing signature verification in the peer-block path. The network rolled back to block 22180 and the signature check was hardened in `validate_peer_block`.

### F5 — Unlimited inflation in account model

During an escrow key rotation, a TX was accepted from an address with **zero balance**, creating 100,002 ZION from nothing. Root cause: the account model did not check `sender_balance >= amount + fee`. The inflationary funds were burned to a provably-unspendable address, and a height-gated balance check was added to both RPC and P2P validation paths.

### F4.7 — Maximum transaction amount cap

A height-gated cap equal to `TOTAL_SUPPLY` (144B ZION) was added to prevent any single TX from moving more than the total money supply. Activated from genesis on the new chain.

### Server compromise & hard reset

The original Edge server and an EVM deploy key were compromised. As a result:

- All L1/L2 keys were regenerated air-gapped.
- A new server was provisioned with no public RPC/SSH exposure beyond the hardened web/DNS surface.
- A **hard genesis reset** was performed on 6–7 July 2026 with a new genesis hash.
- All services were rebuilt from a clean state.

Full canonical runbook: [`docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md`](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md)

### Memory leak fix

After the reset, `zion-node` was OOM-killed twice because `accepted_blocks` and `known_peers` grew without bounds. A retention cap (1,000 blocks/peers), bounded channels and RPC handle draining reduced memory growth by ~98%.

---

## Live Infrastructure

| Service | Status | Notes |
|---------|--------|-------|
| **Edge Node 1** | ✅ Active | Primary / mining, P2P 8333, RPC 8443 |
| **Edge Node 2** | ✅ Active | Follower / P2P sync, RPC 8448 |
| **Local Backup Node** | ✅ Active | Local machine in Prague via SSH reverse tunnel, RPC 8446 |
| **Pool Server** | ✅ Active | `stratum+tcp://pool.zionterranova.com:8444` |
| **Web / Dashboard** | ✅ Active | `https://zionterranova.com` + `https://dashboard.zionterranova.com` |
| **Bridge** | ✅ Active | L2, L1 watcher scanning from block 0 |
| **DAO** | ✅ Active | L2, scanner running |
| **WARP** | ✅ Active | L3 universal bridge |
| **Atomic Swap** | ✅ Active | L2, API on 8452 |
| **Oasis / Free World / Issobella** | ✅ Active | L4–L6 daemons seeded |
| **Watchdog timer** | ✅ Active | 2-minute health checks |

**Topology:** 3-node P2P mesh (Edge 1 + Edge 2 + Local Backup).

---

## v3.0.5 — What changed since 3.0.1

- **Single CLI binary** — `zion` replaces the previous eight separate packages.
- **Interactive menu** — arrow-key navigation, guided wallet → node → pool → miner setup.
- **Live monitor** — `zion monitor` shows node, miner and wallet status.
- **Account-model `memo` field** — L1 hard fork, confirmed end-to-end in block 752 with BRIDGE/DAO/SWAP memos.
- **Balance check (F5 fix)** — consensus-level validation on both RPC and P2P paths.
- **Max-TX cap (F4.7)** — prevents any transaction larger than total supply.
- **3-node P2P mesh** — auto-failover seed topology.
- **Memory-leak fixes** — bounded caches and channels.
- **All 11 L1–L6 services active** and verified green.

---

## Download

| Platform | File | Size |
|----------|------|------|
| Linux x86_64 | `zion-cli-linux-x86_64.tar.gz` | 2.3 MB |
| macOS Apple Silicon (M1–M4) | `zion-cli-macos-aarch64.tar.gz` | 2.1 MB |
| macOS Intel x86_64 | `zion-cli-macos-x86_64.tar.gz` | 2.3 MB |
| Windows x86_64 | `zion-cli-windows-x86_64.zip` | 4.7 MB |
| SHA256 Checksums | `SHA256SUMS.txt` | — |

**Download URL:** https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta

---

## Mining — Ekam Deeksha

**Algorithm:** Ekam Deeksha — dual-algo PoW: BLAKE3 + RandomNPU

| Backend | Platform | Best for |
|---------|----------|----------|
| `cpu` | All | Default, works everywhere |
| `opencl` | Linux/Windows | AMD + NVIDIA GPU |
| `cuda` | Linux/Windows | NVIDIA GPU |
| `metal` | macOS Apple Silicon | M1–M4 GPU |

**Pool connection:** `stratum+tcp://pool.zionterranova.com:8444`

**Required:** `ZION_PAYOUT_ADDRESS=<valid zion1... address>`

---

## Block Reward Distribution

| Recipient | Share |
|-----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## Canonical Parameters

| Parameter | Value |
|-----------|-------|
| Chain ID | `zion-mainnet-1` |
| Block time | 60 s |
| Block reward | 5,400.067 ZION → Decade Decay (-20%/10 years) |
| Tail emission | 724.784723787776 ZION/block (from ~2126) |
| Total supply | 144,000,000,000 ZION |
| Decimals | 6 (1 ZION = 1,000,000 flowers) |
| Mining horizon | 100+ years + tail ∞ |
| DAA | LWMA (60 blocks, ±25%) |
| Fees | Split 89/5/5/1 |
| Genesis hash | `08a94fb04ad084724af33b62c81b84a3472c32d89bbeccd0a8751fd893bfa122` |

---

## Read more

- [v3.0.1 Genesis Overview](../v3.0.1/README.md) — historical first launch
- [v3.0.5 All Green Report](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md)
- [v3.0.5 All Green Runbook](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md)
- [SecurityFirst / F1 + F5 hardening](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/SecurityFirst.md)
- [F5 Security Incident Report](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/F5_SECURITY_INCIDENT_REPORT_2026-07-02.md)
- [Hard Genesis Reset runbook](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md)
- [Public GitHub repository](https://github.com/Zion-TerraNova/v3-Mainnet)

---

*ZION TerraNova Mainnet • v3.0.6 Trinity / Mainnet Beta • updated 22 Jul 2026*
