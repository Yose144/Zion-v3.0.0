# ZION 3.2 "ONE LOVE"
## Rasta Onboarding for Miners, Players & Builders

### Mine the roots. Enter the preview. Build the future.

**Mainnet Alpha is running now.** `3.1.0-beta` / `zion-v3-node/3.1.0-alpha` is the live production track.  
**3.2.0 "One Love"** is the road toward Mainnet Stable — not an empty slogan, but a sequence of verifiable gates.  
**OASIS is a public preview under construction.** Enter, explore, bring your perspective — but do not expect a finished AAA game or guaranteed game rewards.

> *"One love, one chain, one road."*
>
> *This text uses Rasta/riddim imagery as a creative tribute. It is not an official statement or endorsement by Bob Marley, Rastafari, or any spiritual tradition.*

---

# HEAR THE DRUM, MINER

## Why mine ZION at the beginning?

Bredda, salt does not dissolve after the feast. Roots are not planted when
the tree is already falling. When a network is young, you are not receiving
a "guaranteed return" — no honest person can promise that. What you gain
is the chance to **learn, help secure the network, and hold the tools in
your hands before the little river becomes a wide sea.**

## Five reasons to mine the roots

### 1. The first decade carries the highest scheduled block subsidy

The protocol writes a fixed **5,400.067 ZION block reward** for the first
decade (heights 1 through 5,256,000). After that, the block subsidy falls
by 20% every decade. That is not a price prediction — it is an openly
auditable emission curve in code.

### 2. 89% of every subsidy belongs to miners

Of every block subsidy, **89% is reserved for miners**. The pool splits
this proportionally by accepted work inside its PPLNS window. Another 5%
flows to the humanitarian fund, 5% to Issobella, and the 1% pool-fee slot
is not minted / burned.

Your hashes do not only feed your worker. They help keep the network open
while carrying its social riddim too.

### 3. You learn on a live network, not a Babylon slideshow

The pool accepts shares, the node produces blocks, the payout-confirmation
sweep runs, and public Stratum is open at `62.171.141.136:8444`. An early
miner learns wallet hygiene, rig operation, monitoring, worker naming, and
security before it becomes a crowded sport.

### 4. One rig, three streams

The official `zion-miner` supports **Trinity**:

| Stream | What it does | State |
|---|---|---|
| Stream 1 | Mines ZION through Ekam Deeksha v3.2 | live |
| Stream 2 | Optional GPU AuxPoW stream (for example ZANO) | live, upstream-pool dependent |
| Stream 3 | Optional CPU AuxPoW stream (for example VRSC) | live, upstream-pool dependent |

Trinity is not a promise of higher profit. It is a technical way to use
GPU and CPU within one miner while external pool conditions, availability,
difficulty, and market prices keep changing.

### 5. Your feedback carries weight

A young network needs more than hashrate. It needs people who can say:
"The miner behaves strangely here. I need a better TUI here. Here is my
GPU driver. Here is where a share disappears." Early miners are not only
users. They are the first bridge builders.

> **Real talk — no lambo fairy tales:**
>
> Actual mining rewards depend on your hashrate, your share of network
> hashrate, difficulty, accepted shares, the PPLNS window, pool availability,
> operating costs, and the market price of ZION. Nothing in this document is
> investment advice or a guarantee of return.

---

# ENTER THE OASIS, PLAYER

## OASIS is an open preview. It is not a finished game.

Sista, bredda — you can visit OASIS now. Open
[`oasis.zionterranova.com`](https://oasis.zionterranova.com) and enter the
3D galaxy. Fly through 55 worlds, seek Nova Zeme, pass the Tree of Life,
open the Avatar Codex, and listen for the first riddim.

But let us say it cleanly, without marketing smoke:

| What exists today | What it is **not** today |
|---|---|
| Publicly accessible 3D OASIS preview | A complete finished AAA game |
| Galaxy, worlds, warp intro, free flight, and visual layers | A guarantee of a permanent economy or immutable mechanics |
| Avatar / quest / leaderboard / world UI as an actively developed experience | A promise that a click, XP value, or preview item has financial value |
| OASIS Web running on a public domain | A reason to buy anything expecting profit |

**Preview means preview.** Content, visuals, quests, UX, features, and
possible progression can change, reset, or be replaced during development.
The Golden Egg, the full economy, long-term gameplay loops, and broader
on-chain connections are BUILDING / HORIZON — not a finished product to be
marketed as a present-day reality.

## Why enter now when OASIS is a preview?

- **You see a world emerge from the roots.** Not only a trailer after launch.
- **You find your style before the uniform.** Early players help define what
  makes Oasis fun, what is chaos, and which quest should be next.
- **Your feedback can change the map.** Broken controls, flight speed,
  readability, music, avatar flow — all of this is stone in the build.
- **You connect play and build.** You do not need to be a programmer. Testing,
  reporting a bug, suggesting a smoother new-player path, or bringing a
  friend is building too.

> **One Love rule:** do not pretend a preview is a finished world. Help it
> become a world people will want to return to.

---

# ROOTS, RIDDEM, REALITY

## What is ZION in one breath?

ZION is an open-source Layer 1 blockchain in Rust. Every block is proof of
work, not proof of connections. Every meaningful constant can be checked
in code. And anyone arriving with respect can be an observer, player,
miner, or builder — none stands above the others.

| Riddim | Verifiable reality |
|---|---|
| **Roots** | Ekam Deeksha v3.2: 512 KiB scratchpad, 2 AES passes, 128 random reads, Keccak-256 final hash |
| **One Love economics** | 89% miner / 5% humanitarian / 5% Issobella / 1% burn slot |
| **No closed door** | Code is public under MIT; public ICO / presale is not part of the project; genesis allocation is documented, not secret |
| **Live water** | V31 node, pool, miner, multichain, DAO, OASIS, dashboard, web, and marketplace run on Edge production |
| **The horizon** | Mainnet Stable 3.2 still needs a 30-day run, real GPU E2E, a security review, chaos tests, and further verifiable gates |

---

# PICK YOUR PATH

## Path 1 — Miner: "I have a rig. I want it inside the riddim."

1. Create **your own** ZION wallet address. Never send your mnemonic or private keys to anyone.
2. Build or download `zion-miner` for your system.
3. Connect to public pool `62.171.141.136:8444`.
4. Start conservatively; watch accepted/rejected shares and temperatures.
5. Only then explore GPU backends, TUI, and Trinity streams.

Example minimal local V31 run:

```bash
cd V31
cargo build --release --bin zion-miner
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet zion1...your_address \
  --worker roots-rig-01 \
  --threads 4
```

Before production mining, always check current release instructions,
hardware support, and pool status. An accepted share is not automatically
an instant payout; the pool uses PPLNS and on-chain payout confirmations.

## Path 2 — Player: "I want to feel the world before it grows."

1. Open [`oasis.zionterranova.com`](https://oasis.zionterranova.com).
2. Walk through the warp intro and fly the first worlds.
3. Explore the Avatar Codex, quest views, map, and other preview layers.
4. Share where you get lost, what draws you onward, and what is still missing a soul.
5. Treat OASIS as a **preview and co-creation**, not a finished product or investment game.

## Path 3 — Builder: "I do not only want aboard. I want to carry part of the ship."

- Open the repository: [`github.com/Zion-TerraNova/v3-Mainnet`](https://github.com/Zion-TerraNova/v3-Mainnet).
- Build the workspace, open an issue, fix documentation, add a test, or improve onboarding.
- Explore L1, multichain, DAO, OASIS, or desktop tooling.
- Bring the skill you already have: design, GPU tuning, localization, security, UX, community, or music.

---

# CHECK BEFORE YOU CHANT

## State you can verify

| Item | State as of 2026-08-09 |
|---|---|
| Workspace | `3.1.0-beta` |
| Protocol | `zion-v3-node/3.1.0-alpha` |
| Test gate | `cargo test --workspace`: **2178 pass, 0 failures** |
| Chain | 1000+ blocks since 2026-08-06 genesis reset |
| Pool | `62.171.141.136:8444` — public Stratum |
| OASIS Web | `https://oasis.zionterranova.com` — public preview |
| Market | `https://market.zionterranova.com` — public marketplace |
| Health | `https://dashboard.zionterranova.com/api/health` — production V31 services report `up` |
| Mainnet Stable target | 3.2.0 "One Love" — still BUILDING, not declared complete/stable |

### Genesis reset — truth without a mask

On 2026-08-06, the canonical key and genesis reset occurred:

- V3 compat hash: `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`
- V31 native hash: `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`

The network does not hide resets and mistakes. Truth can hurt, but it is
the only stone worth building upon.

---

# WHAT WE DO NOT SELL YOU

- We do not sell certainty that ZION will rise in price.
- We do not sell the OASIS preview as a finished game.
- We do not sell XP, avatars, Golden Egg, or NFTs as investment products.
- We do not sell "passive income." Mining has energy cost, risk, changing difficulty, and personal hardware responsibility.
- We do not ask for your seed, mnemonic, private keys, or remote access to your rigs.

Sell you? No. **We open the door.** The code is before you, the network is
before you, the preview is before you. Take a compass, not somebody else's
promise.

---

# ONE LOVE — THE INVITATION

If you have a GPU, bring your fire.  
If you have a CPU, bring your breath.  
If you have eyes for worlds, enter the OASIS preview.  
If you have hands to build, open the code.  
If you have doubt, verify — doubt is healthier than blind belief.

ZION is not a throne. It is a ship.
It is not a finished paradise. It is a garden still being planted.
It is not a promise of money. It is a chance to carry part of the work.

**One love. One chain. One road.**

---

## Continue the journey

- [Canonical 3.2 One Love Whitepaper — EN](../ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_EN.md)
- [Canonical Onboarding & Salt of the Earth 3.2 — EN](../ZION_ONBOARDING_3.2_ONE_LOVE_EN.md)
- [Salt of the Earth — 12 stops](../SulZeme/00-README.md)
- [Mainnet Stable 3.2 technical plan](../../../V31/PLAN_TO_3.2.md)
- [Current network status](../../../StatusV3.md)
- [Český Rasta Onboarding](./ONBOARDING_ONE_LOVE_3.2_RASTA_CZ.md)

*Factual snapshot date: 2026-08-09. Network, pool, and OASIS state can change; verify current documentation before mining or taking any technical action.*
