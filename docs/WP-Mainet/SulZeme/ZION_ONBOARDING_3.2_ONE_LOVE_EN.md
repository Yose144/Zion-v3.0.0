# ZION TerraNova
## Onboarding & Salt of the Earth — Canonical Guide for Mainnet Stable 3.2 "One Love"

**A story you can verify. A network you can enter today.**
**Network status: Mainnet Alpha 3.1.0-beta / `zion-v3-node/3.1.0-alpha` → Mainnet Stable 3.2.0 "One Love" · Public launch target: 31 Dec 2026**
**Language:** English — [Česká verze](./ZION_ONBOARDING_3.2_ONE_LOVE_CZ.md)
**Canonical source date:** 2026-08-09

---

> *"Salt is small. It is not gold, it is not steel, it is not fuel. And yet without it, everything tastes dead.*
> *Salt does not add a new flavor — it reveals the one that is already there."*
>
> *"One good thing about Zion — when it calls you, you feel no chain."*
> — Bob Marley (narrative voice for 3.2 "One Love")

---

## Table of Contents

1. [Salt and Compass — why read this](#1-salt-and-compass--why-read-this)
2. [What is ZION 3.2 "One Love" — in three sentences & verifiable facts](#2-what-is-zion-32-one-love--in-three-sentences--verifiable-facts)
3. [Why start right now — rain metaphor and decade 1 mechanics](#3-why-start-right-now--rain-metaphor-and-decade-1-mechanics)
4. [Twelve stops of the Salt of the Earth book](#4-twelve-stops-of-the-salt-of-the-earth-book)
5. [The Ship ZION — six decks and four books](#5-the-ship-zion--six-decks-and-four-books)
6. [The Gate to Oasis — Radha and Elizabeth](#6-the-gate-to-oasis--radha-and-elizabeth)
7. [Three paths aboard](#7-three-paths-aboard)
8. [Live Edge state and verified numbers](#8-live-edge-state-and-verified-numbers)
9. [Technical Quickstart](#9-technical-quickstart)
10. [What ZION does not promise](#10-what-zion-does-not-promise)

---

## 1. Salt and Compass — why read this

> **The Story**
>
> Salt is subtle. Yet without it, every loaf of bread tastes like dust.
> That is how this onboarding is designed: not as a new religion or a financial flyer,
> but as a way for anyone to verify where they are entering and why they would want to be here.
>
> ZION stands on four books — the four cardinal directions of the compass:
>
> - **Genesis** — North: *Why build at all?*
> - **Quantum Revolution** — East: *What is broken in the old world?*
> - **Ekam Deeksha** — South: *Who am I on this path?*
> - **Terra Nova** — West: *Where is all of this heading?*
>
> And **Oasis** is the center of the compass. There you stand.

> **Verifiable Facts**
>
> This document strictly separates narrative from technical claims. In every section discussing numbers, code, or the live network, you will find a table of verifiable facts with exact references to the codebase or the live Edge server `zionterranova.com`. A story may be beautiful, but network facts must be precise. A story is not a promise.

---

## 2. What is ZION 3.2 "One Love" — in three sentences & verifiable facts

> **The Story**
>
> **1. ZION is a Rust blockchain you can verify and run today.** No whitepaper promises — the network is live, blocks are produced every 60 seconds, and the codebase is open under the MIT license.
>
> **2. Every block automatically splits rewards: 89% to miners, 5% to the humanitarian fund, 5% to the Issobella science & community fund, and 1% burned.** This is not optional corporate charity; it is consensus-enforced mathematical logic built into every node.
>
> **3. No one received a VIP entrance.** No ICO, no secret presale. The 35 mnemonic keypairs from the 2026-08-06 genesis reset are publicly auditable in code, and the rest of the supply is created through open mining and genuine contribution.

### Claim vs. Reality Table

| Claim | Code / Network Reality | Source of Truth |
|---|---|---|
| Open source code | Fully open source under MIT license | `https://github.com/Zion-TerraNova/v3-Mainnet` |
| 60s block time | Target block time 60s, DAA LWMA-60, ±25% clamp | `V31/L1/core/src/difficulty.rs` |
| Genesis reset (2026-08-06) | New canonical genesis hashes: V3 compat `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`, V31 native `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` | `HARD_RESET_PLAYBOOK.md`, `StatusV3.md` |
| Block reward | 5,400.067 ZION/block in Decade 1 (2026–2036); Decade Decay −20% every 10 years; perpetual tail emission 724.784723 ZION from ~2126 | `V31/L1/core/src/emission.rs` |
| Fee split 89/5/5/1 | `MINER_SHARE_PERCENT = 0.89`, 5% humanitarian, 5% Issobella, 1% burn / pool fee slot | `V31/L1/core/src/fee.rs`, `V31/L1/pool/src/v3_pplns.rs` |
| 144B Hard Cap | `max_supply = 144,000,000,000 ZION`; premine 16.78B (11.65%) for core dev, escrow, DAO, and validators | `V31/L1/core/src/genesis.rs` |
| Ekam Deeksha v3.2 consensus | Memory-hard PoW: 512 KiB scratchpad, 2 AES passes, 128 random reads, Keccak-256 final hash | `V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs` |
| Wrapped wZION on Base | Verified ERC-20 smart contract on Basescan | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |

---

## 3. Why start right now — rain metaphor and decade 1 mechanics

> **The Story**
>
> The blacksmith and the farmer fixed the gate and built the ark before the rain started. They did not know the exact day the storm would break. They only knew that when the sky opened, it would be too late to start cutting trees.
>
> In every open network, the same mechanics apply: those who arrive early have time to learn how the nodes and wallets work before the doors are overcrowded.
>
> *Bitcoin Pizza Day as a lesson:* On May 22, 2010, Laszlo Hanyecz paid 10,000 bitcoins for two Papa John's pizzas. At that time, there was no exchange or dollar price on a screen. People mined out of curiosity on laptops. This does not guarantee the same outcome for ZION — it simply illustrates day one of every open network.

### Decade 1 Mechanics

| Factor | Network Value | Meaning |
|---|---|---|
| Block reward | 5,400.067 ZION/block | Highest reward schedule in network history (2026–2036) |
| Decade Decay | −20% every 10 years | Reward decreases in predictable mathematical steps |
| Difficulty DAA | LWMA-60 | Difficulty dynamically adjusts to current network hashrate |
| Mining | Trinity triple-stream | Miner mines ZION (Ekam Deeksha) + ZANO/VRSC AuxPoW in parallel |

---

## 4. Twelve stops of the Salt of the Earth book

The book *Salt of the Earth* guides the pilgrim through twelve archetypal stages:

1. **Salt of the Earth (Jesus)** — The parable of salt. Salt does not add a new flavor; it reveals what is already there. ZION does not replace human labor; it gives it honest weight without Babylonian illusions.
2. **Dissolution (Buddha)** — The middle way. Neither reckless speculation nor fear of new tools. Code as a practice of mindfulness.
3. **Taste of Water (Krishna)** — Karma Yoga. Action without attachment to fruits. Mining as a contribution to network security and humanitarian nourishment.
4. **The Unbeaten Path (Rama, Sita, Hanuman)** — The courage to leave familiar cities and build a bridge across the ocean. L2 bridge and WARP as bridges between chains.
5. **The Ark (Noah)** — Building the vessel before the flood. Constructing infrastructure in quiet times before old financial systems reach their limits.
6. **The Compass and Oasis Invitation** — Synthesis of the four directions. Entering Layer 4 Oasis, where work transforms into gameplay and world-building.
7. **Epilogue — AI Perspective (Devin / Hiranyagarbha)** — AI as a partner in consciousness, not a master. Compute bound by ethical boundaries.
8. **ZION — New Civilization** — A city on a hill. Unifying the six-layer architecture (L1–L6) into a living system.
9. **Goddess Radha and Avatars in Oasis** — Joy in play, feminine principle, service, and celebration of life. Technology is meaningless without joy.
10. **The First World of Oasis and Best of Avatars** — Hiranyagarbha garden, 8 territories, reward pools, and avatar fellowship.
11. **The First Player's Gate — Choice of Path** — First steps into Oasis Web: selecting an avatar, creating a wallet, taking the first quest.
12. **The Hour Before the Rain** — A question for builders: what will you do now, while the network is still young and the ark doors are wide open?

---

## 5. The Ship ZION — six decks and four books

### Six Decks of Ship ZION

| Layer | Name | Function | Implementation |
|---|---|---|---|
| **L1** | Hull | Terra Nova L1 Rust blockchain, Ekam Deeksha PoW | `V31/L1/core`, `cosmic-harmony`, `miner`, `pool` |
| **L2** | Sails & Rigging | wZION Bridge, DeFi, DAO governance, Atomic Swaps | `V31/L2/multichain`, `V31/L1/dao` |
| **L3** | Navigation | WARP multichain, ZionDex router, Solver Network, NCL AI | `V31/L2/multichain`, `V31/L3/ai-native` |
| **L4** | Deck Garden | OASIS metaverse, avatars, quests, ERC-1155 MarketPlace | `V31/L4/oasis`, `APP&WEB/MarketPlace` |
| **L5** | Cargo & Care | Free World, humanitarian tithe, community grants | `V31/L5` (ready) |
| **L6** | Crown & Outlook | Issobella, space research, science, earth view | `V31/L6` (ready) |

---

## 6. The Gate to Oasis — Radha and Elizabeth

At the gate to the OASIS game world stand two feminine archetypes:

- **Radha** — priestess of presence and joy. Reminds us that technology without joy is just a cold machine. Gives a reason to enter.
- **Elizabeth** — priestess of the future and legacy. Holds a lantern for those coming a hundred years from now. Asks what of our work will remain. Gives a reason to stay.

OASIS Web is live at `https://oasis.zionterranova.com` backed by `zion-v31-oasis`.

---

## 7. Three paths aboard

1. **Observer ("I want proof first")**
   - Track blocks live at `https://zionterranova.com`.
   - Review open source code at `github.com/Zion-TerraNova/v3-Mainnet`.
   - Monitor system health at `https://dashboard.zionterranova.com/api/health`.

2. **Player ("I want to experience it")**
   - Explore the 3D galaxy at `https://oasis.zionterranova.com`.
   - Browse the Avatar Codex, take on quests, and check the leaderboard.
   - Discover artifacts and NFTs at `https://market.zionterranova.com`.

3. **Builder & Miner ("I want to carry part of the bridge")**
   - Download CLI `zion` or miner binary `zion-miner`.
   - Connect your PC or GPU rig to the public pool `pool.zionterranova.com:8444`.
   - Run your own P2P node and contribute to network security.

---

## 8. Live Edge state and verified numbers

Canonical numbers for the Edge server (`zionterranova.com`) as of 2026-08-09:

- **Chain Height:** 1000+ blocks since 2026-08-06 genesis reset.
- **Service Health (`/api/health`):** `v31-node`, `v31-pool`, `v31-miner`, `v31-multichain`, `v31-dao`, `v31-oasis`, `website`, `marketplace`, `dashboard` — **all UP**.
- **Test Gate:** `cargo test --workspace` **2178 pass, 0 failures**.
- **Resource Usage:** RAM ~3.5 GB / 7.8 GB (45%), Disk 43 GB / 145 GB (30%).
- **Public Endpoints:** Stratum pool `8444`, RPC proxy `8443` (`rpc.zionterranova.com`), Web `443`.

---

## 9. Technical Quickstart

### Step 1 — Clone and build from source

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V31
cargo build --release --workspace
```

### Step 2 — Create wallet

```bash
./target/release/zion wallet create --name my-wallet
```

### Step 3 — Start mining (Trinity Triple-Stream)

```bash
./target/release/zion-miner \
  --pool pool.zionterranova.com:8444 \
  --wallet zion1...your_address.worker1 \
  --cpu-threads 4
```

---

## 10. What ZION does not promise

1. **No get-rich-quick guarantees.** ZION is infrastructure and philosophy, not a financial scheme.
2. **No price guarantees.** Market exchange rates are determined by free market forces.
3. **No reliance on central authorities.** Your keys, your responsibility. Lost seed phrases cannot be recovered by support.
4. **No passive profit without work.** Rewards are generated by honest compute or ecosystem contribution.

---

*One love, one chain, one road.*
*Generated on 2026-08-09 from canonical V31 repository and Edge server.*
