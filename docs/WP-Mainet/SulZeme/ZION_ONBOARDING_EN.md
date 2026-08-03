# ZION — Canonical Onboarding

## A story you can verify. A network you can join today.

**Status:** Mainnet Beta
**Version:** 3.0.7 / V31 3.1.0-alpha.2
**Last updated:** 2026-08-03
**Language:** English — [Czech version](./ZION_ONBOARDING.md)

---

## Canonical sources

This document is one entry point. The detailed truth lives in these sources:

- [`V3/docs/USER_ONBOARDING.md`](../../../V3/docs/USER_ONBOARDING.md) — basic CLI guide for new users
- [`StatusV3.md`](../../../StatusV3.md) — live topology, chain height, ports and service status
- [`AGENTS.md`](../../../AGENTS.md) — operating rules, incidents and migrations
- [`V3/docs/CLI_REFERENCE.md`](../../../V3/docs/CLI_REFERENCE.md) — complete `zion` command reference
- [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md) — consensus, emission, smart contracts, architecture
- [`V3/docs/DEV_TEAM/ONBOARDING.md`](../../../V3/docs/DEV_TEAM/ONBOARDING.md) — developer onboarding
- [`SulZeme/00-README.md`](./00-README.md) — the twelve episodes of the book *Sůl této země (Salt of this Earth)*
- [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md) — gateway to the Oasis game layer
- [`Onboarding.md`](./Onboarding.md) — short marketing version

---

## Contents

1. [Salt and compass — why read this](#salt-and-compass--why-read-this)
2. [What is ZION — in three sentences and verifiable facts](#what-is-zion--in-three-sentences-and-verifiable-facts)
3. [Why start right now](#why-start-right-now)
4. [Three ways on board](#three-ways-on-board)
5. [Ship ZION — six decks and four books](#ship-zion--six-decks-and-four-books)
6. [Gate to Oasis](#gate-to-oasis)
7. [Book *Salt of this Earth* — twelve stops](#book-salt-of-this-earth--twelve-stops)
8. [What ZION does not promise](#what-zion-does-not-promise)
9. [First step — today, in five minutes](#first-step--today-in-five-minutes)
10. [Technical quickstart](#technical-quickstart)
11. [Verifiable facts — summary](#verifiable-facts--summary)
12. [For developers and further resources](#for-developers-and-further-resources)

---

## Salt and compass — why read this

> **Story**
>
> Salt is small. It is not gold, not steel, not fuel. And yet without it everything tastes dead.
> Salt does not add a new taste — it reveals the one that is already there.
>
> The same is true for this onboarding: it is not a new teaching. It is a way for anyone to verify where they are entering and why they would want to.
>
> ZION stands on four books — four questions:
>
> - **Genesis** — North: why build at all?
> - **Quantum Revolution** — East: what is broken in the old world?
> - **Ekam Deeksha** — South: who am I on this path?
> - **Terra Nova** — West: where is all of this heading?
>
> And **Oasis** is the center of the compass. There you stand.

> **Verifiable facts**
>
> This document separates narrative from technical claims. In every section that mentions numbers, code or the network you will find a box with verifiable facts and a source link. A story may be beautiful, but the facts about the network must be exact. A story is not a promise.

---

## What is ZION — in three sentences and verifiable facts

> **Story**
>
> **ZION is a blockchain that can be verified, not just promised.** It has been running since 4 December 2025, a new block every 60 seconds, open-source code that anyone can read.
>
> **Every block automatically splits the reward: 89 % to miners, 5 % to the humanitarian fund, 5 % to the future fund, 1 % is burned.** It is not a company promise — it is math written into the network rules that nobody can silently change.
>
> **Nobody got VIP access.** No ICO, no presale, no secret allocations. Whoever wants ZION mines it — or gets it from someone who mined it.

### Claims × reality table

| Claim | Reality in code / network | Source |
|---|---|---|
| ZION is a public blockchain | Source code under MIT: `https://github.com/Zion-TerraNova/v3-Mainnet` | [`AGENTS.md`](../../../AGENTS.md), `public/` section |
| New block every 60 s | Block time 60 s, DAA LWMA 60 blocks, target interval 30–120 s, ±25 % clamp | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5 |
| Genesis block 4 Dec 2025 | Genesis hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`; after a block-retention bug fix a hard genesis reset happened on 2026-07-20; blocks 0–~10913 of the old chain are lost, from the fix onward all blocks are retained | [`StatusV3.md`](../../../StatusV3.md), lines 6–9; [`AGENTS.md`](../../../AGENTS.md), BLOCK RETENTION FIX |
| Reward 5,400.067 ZION/block | Decade 1 (2026–2036): 5,400.067 ZION/block; never higher; Decade Decay −20 % per decade; tail 724.784723 ZION/block from ~2126 | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5.2 |
| 89/5/5/1 % split | `MINER_SHARE_PERCENT = 0.89`; humanitarian 5 %; Issobella 5 %; pool fee / burn 1 %; nodes reject blocks with a different ratio | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5.3; [`V3/README.md`](../../../V3/README.md) |
| Hard cap 144 billion ZION | `max_supply = 144_000_000_000`; premine 16.78 B (11.65 %), rest by mining | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5 |
| No ICO / VIP access | Fair launch: no team `mint()`, no presale; genesis allocation is publicly listed in coinbase | [`12-Hodina-Pred-Destem.md`](./12-Hodina-Pred-Destem.md), Verifiable facts |
| PoW: Ekam Deeksha / CosmicHarmony | Canonical algorithm in `V3/L1/cosmic-harmony`; six-phase pipeline Hiranyagarbha, Brahma, Yantra, Karma, Chit, Samadhi; LWMA 60 blocks, ±25 % clamp | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), Verifiable facts; [`V3/README.md`](../../../V3/README.md) |

---

## Why start right now

> **Story**
>
> The smith and the farmer were fitting hinges before it started to rain. They did not know when the storm would come. They only knew that once the water came, it would be too late to start building.
>
> In every open network the same mechanics apply: those who arrive early have time to learn how the door works before it is buried by the crowd. That is not a promise of treasure. It is a description of rain.

> **Verifiable facts**
>
> **Bitcoin Pizza Day as a lesson, not a price promise.**
>
> On 22 May 2010 programmer Laszlo Hanyecz paid 10,000 bitcoins for two Papa John's pizzas. At that time no exchange existed, the dollar price was irrelevant and the network was mined by curious people on ordinary laptops, not by profit seekers.
>
> This historical fact about another network shows what the **first day of every open network looks like**: few people, zero certainty and the possibility to obtain a currency whose future value is decided by none of those sitting around the fire today. **It is not proof that the same will repeat with ZION.**

### First-decade mechanics

| Factor | What is true today | What it means |
|---|---|---|
| Block reward | 5,400.067 ZION/block in decade 1 (2026–2036) | The highest reward the protocol will ever pay |
| Decade Decay | −20 % per decade (5,256,000 blocks) | Reward only decreases, never increases |
| Tail emission | 724.784723 ZION/block from ~2126 | Perpetual maintenance reward |
| DAA | LWMA 60 blocks, ±25 % clamp | Difficulty reacts to today's network power, not tomorrow's |
| Number of miners | Network is small: Edge + local backup + public miners | The fewer machines mining today, the larger share of found blocks each individual machine receives |

> **This is not investment advice.** It is a description of the emission plan and difficulty algorithm that you can verify in the code. Nobody guarantees that ZION will have any value.

---

## Three ways on board

### Observer — "First I want proof"

Install nothing, buy nothing. Just watch:

1. Open the explorer at `https://zionterranova.com` and watch a new block arrive every minute.
2. Browse the code at `https://github.com/Zion-TerraNova/v3-Mainnet` — MIT license, nothing hidden.
3. Ask anything in the community channels. A good community can say "I don't know" and point to a source.

### Player — "I want to experience it"

Enter the world of **Oasis** — ZION's game layer:

- Choose an **avatar** and complete the first quests.
- Collect **XP for real actions** — helping the community, first mining share, fixing documentation.
- Climb **nine Consciousness Levels** from physical to stellar.
- Once the game fully opens: **Golden Egg** — a treasure hunt with 108 clues hidden in the blockchain, books and the real world.
- Earn **Dharma Credits** for service, learning and good deeds.

> **Verifiable facts:** Oasis is the L4 layer with a REST API on port 8094. See [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md) and [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md).

### Builder — "I want to carry a piece of the bridge"

Your computer can be a node of the new network:

- Download the single `zion` binary or build from source.
- Create a wallet and connect to the public pool.
- Mine on CPU or GPU.
- Run your own node.
- Use the bridge and build your first DApp.

Exact commands are in the [Technical quickstart](#technical-quickstart) section.

---

## Ship ZION — six decks and four books

> **Story**
>
> Genesis is not just the first block. It is an ark — a ship that carries all layers.

### Six decks

| Deck | Name | Function | Key parts |
|---|---|---|---|
| L1 | Hull of the ship | Terra Nova blockchain in Rust, Ekam Deeksha PoW | `V3/L1/core`, `V3/L1/cosmic-harmony`, `V3/L1/miner`, `V3/L1/pool` |
| L2 | Sails and rigging | Bridge, DeFi, DAO, wZION on Base, atomic swap, DEX | `V3/L2/bridge`, `V3/L2/dao`, `V3/L2/atomic-swap` |
| L3 | Stellar navigation | AI Native, WARP, Hiranyagarbha | `V3/L3/ai-native`, `V3/L3/warp`, `V3/L3/ncl` |
| L4 | Garden on deck | Oasis — game, avatars, quests, Golden Egg, Consciousness Levels | `V3/L4/oasis` |
| L5 | Storage and infirmary | Free World, humanitarian tithe, communities, Medical Table | `V3/L5` |
| L6 | Crown and crow's nest | Issobella, orbital station, SETI, view of Earth | `V3/L6` |

The ship is steered by the **compass of consciousness**. When the compass points at greed, the ship hits a reef. When it points at service, it sails through storms.

### Four books

| Book | Direction | Question | Element |
|---|---|---|---|
| **Genesis** | North | Why build at all? | Fire — seed, intention |
| **Quantum Revolution** | East | What is broken in the old world? | Air — diagnosis, consciousness |
| **Ekam Deeksha** | South | Who am I on this path? | Water — inner turn |
| **Terra Nova** | West | Where is all of this heading? | Earth — architecture, communities |

And **Oasis** is the center of the compass. There you stand.

---

## Gate to Oasis

> **Story**
>
> Behind the gate to Oasis stand two priestesses. Not above you, beside the door.
>
> **Radha** is the priestess of presence. She teaches that technology without joy is a cold museum, that salt without taste burns and that a building block without joy is a heavy boulder.
>
> **Elizabeth** is the priestess of the future. She is not yet born, holding a lantern for those who come after us. She asks: "What will remain of this network in a hundred years?"
>
> Together they form one gate: **Radha gives a reason to enter. Elizabeth gives a reason to stay.**

> **Verifiable facts**
>
> Radha and Elizabeth are literary archetypes — Radha as a symbol of joy and service, Elizabeth as a symbol of the future and legacy. They are not religious claims or financial brands.

### 202 avatars

In Oasis there are **202 sacred figures** — avatars from across the world. They are not gods to worship, but **qualities** you can awaken in yourself. Each avatar carries a quest line, teaching, ability and consciousness level.

The full circle consists of seventeen circles: the Holy Trinity and its circle, Matrix and modern archetype heroes, ZION Originals, First Nations of America, the Pacific circle and more (Tibet, Extended India, Japan, China, Indonesia, Australia, Aotearoa, Africa, Atlantis, Lemuria, Cosmic, Norse-Celtic, Ancient Egypt, Maya).

> **Source:** [`09-Bohyne-Radha-a-Avatari-Oasis.md`](./09-Bohyne-Radha-a-Avatari-Oasis.md) and [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md).

### Seven paths

| Path | Essence | First task |
|---|---|---|
| 1. Path of knowledge | Sarasvati and Vishwakarma — code, nodes, mathematics | "What actually confirms a signature?" |
| 2. Path of service | Hanumana — help newcomers, distribute tithe, build public goods | Find out what can be verified about one aid area |
| 3. Path of courage | Rama and Issobella — run nodes, protect the system | Recognize a security warning and verify the software source |
| 4. Path of the heart | Radha and Sita — create safe social space, welcome, heal conflicts | Write something that makes entry easier for a newcomer, without promising yield |
| 5. Path of stillness | Sadhu — meditation, attention, rhythm | Complete a short meditation or refuse a quick reward |
| 6. Path of transformation | Saint Germain — experiment, fix mistakes | Find a contradictory claim in the docs and propose a verifiable fix |
| 7. Path of awakening | Neo and Trinity — technology, interoperability, freedom with responsibility | Explain one technical boundary to a newcomer without jargon |

> **Source:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 11.

### Nine Consciousness Levels

| Level | Name | Multiplier | Essence |
|---|---|---|---|
| CL1 | Physical | 1.0x | First step, body, survival |
| CL2 | Emotional | 1.05x | Feeling, love vs. fear |
| CL3 | Mental | 1.1x | Mind, logic, plans |
| CL4 | Sacred | 1.25x | Sacred geometry, heart |
| CL5 | Quantum | 1.5x | Quantum reality, connection |
| CL6 | Cosmic | 2.0x | Cosmic consciousness |
| CL7 | Enlightened | 3.0x | Pure awareness |
| CL8 | Transcendent | 5.0x | Beyond duality |
| CL9 | On The Star | 10.0x | Maitreya sphere, Issobella |

> **Source:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 11.

### Eight Genesis Territories

The First World of Oasis is structured into **8 Genesis Territories**. Some described so far include the Valley of the First Step, the Crystal Mines, the Garden of Service, the Guild Citadel and the Temple of Hiranyagarbha. The canonical definition of all eight territories is in the `V3/L4/oasis` code (`TerritoryMap` class).

> **Source:** [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md).

### Golden Egg and 108 clues

In the center of Oasis stands the **Tree of Life**. In its roots lies the **first of 108 clues of the Golden Egg**. The Golden Egg is not just treasure — it is a **pedagogical story**. A reserve of **8.25 billion ZION** from the genesis allocation is locked in five reward pools:

- Player Pool
- Guild Pool
- Territory Pool
- Golden Egg Pool
- Winners Pool

Clues are hidden in L1 blocks, in Base/EVM smart contracts, in TerraNova books and in real-world locations. Each clue is a question, not a reward.

> **Source:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 12; [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md).

### Dharma Credits

In Oasis not only ZION runs, but also **Dharma Credits** — the currency of good intention.

- Total cap: **144 billion**.
- **1 % — 1.44 billion** of the allocation is reserved for Oasis.
- The eShop divides them into tiers:
  - Micro: 1–100
  - Standard: 101–1,000
  - Premium: 1,001–10,000
  - VIP: 10,001–100,000
  - Mega: 100,001–1,000,000

You earn them for completing quests, helping newcomers, contributing to docs and code, real volunteer acts, mining uptime, humanitarian activities and grants.

> **Source:** [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 13.

---

## Book *Salt of this Earth* — twelve stops

> **Story**
>
> The first eleven episodes lead you through salt, dissolution, the taste of water, the path without a map, the ark and the gate to Oasis. The twelfth stop asks: what will you do now, while the network is still small and the ark's doors are still open?

| # | Episode | Character / motif | Book |
|---|---|---|---|
| 1 | [Sůl země (Salt of the Earth)](./01-Sul-Zeme.md) | Jesus — parable of salt | Genesis |
| 2 | [Rozpuštění (Dissolution)](./02-Rozpusteni.md) | Buddha — middle way | Quantum Revolution |
| 3 | [Chuť vody (Taste of Water)](./03-Chut-Vody.md) | Krishna — Vishvarupa, karma yoga | Ekam Deeksha |
| 4 | [Cesta nevyšlapaná (Untrodden Path)](./04-Cesta-Nevyslapana.md) | Rama, Sita, Hanuman | Terra Nova |
| 5 | [Archa (Ark)](./05-Archa.md) | Noah — ark before the flood | Terra Nova / Genesis |
| 6 | [Kompas a pozvánka do Oasis (Compass and Invitation to Oasis)](./06-Kompas-a-Pozvanka-do-Oasis.md) | Synthesis of all characters, entry to L4 Oasis | All four |
| 7 | [Epilog — Názor AI (Epilogue — AI Opinion)](./07-Epilog-Nazor-AI.md) | Devin (AI), open assessment | — |
| 8 | [ZION — Nová civilizace (New Civilization)](./08-ZION-Nova-Civilizace.md) | Complex invitation, practical onboarding | All four |
| 9 | [Bohyně Rádha a avataři v Oasis (Goddess Radha and Avatars in Oasis)](./09-Bohyne-Radha-a-Avatari-Oasis.md) | Goddess Radha, avatars, feminine energy and joy of play | L4 Oasis / All |
| 10 | [První svět Oasis a Best of Avataři (First World of Oasis and Best of Avatars)](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md) | Garden of Hiranyagarbha, 8 territories, 5 reward pools, Best of Avatars | L4 Oasis / All |
| 11 | [Brána prvního hráče — volba cesty (Gate of the First Player — Choice of Path)](./11-Brana-Prvniho-Hrace-a-Volba-Cesty.md) | Entry to Oasis, own character, seven paths and first challenges | L4 Oasis / All |
| 12 | [Hodina před deštěm (Hour Before the Rain)](./12-Hodina-Pred-Destem.md) | Smith and farmer at the ark, the true Bitcoin Pizza Day story | Genesis / Terra Nova |

> **Verifiable facts:** Every episode contains a box with verifiable facts and a reference to the code, running network or whitepaper. The story is always marked as fiction/archetype, never as historical or theological claim.

---

## What ZION does not promise

The ship is being built honestly, and honesty means saying this too:

- ZION is **Mainnet Beta** — a live network, but young. Bugs happen and are fixed publicly.
- **Nobody guarantees you profit or price.** This is not investment advice — it is an invitation to verify and participate.
- **Your keys, your responsibility.** A lost key cannot be recovered by anyone.
- The game world Oasis and the Golden Egg are **still being built** — what is ready today and what is a plan is always honestly labeled in the documentation.
- This document **is not a religious claim**. Characters and rituals are used as archetypes and literary images, not as a claim to the authority of any tradition.
- This document **is not a financial promise**. No part says "invest and get rich."

Salt that knows it is salt — and does not call itself gold — is more trustworthy. That is why we write it this way.

---

## First step — today, in five minutes

1. **Open** `https://zionterranova.com` and look at the live network.
2. **Download** the `zion` CLI from [GitHub releases](https://github.com/Zion-TerraNova/v3-Mainnet/releases) and run `zion onboard`.
3. **Create a wallet** and connect to the public pool `62.171.141.136:8444`.

Nobody will rush you. An ark is not built by shouting — it is built block by block, 60 seconds by 60 seconds, and the doors are open.

---

## Technical quickstart

This section contains exact commands from canonical sources. For a detailed explanation of each step see [`V3/docs/USER_ONBOARDING.md`](../../../V3/docs/USER_ONBOARDING.md).

### CLI installation

#### From release (recommended)

```bash
# The archive name depends on platform and release, e.g. zion-cli-linux-x86_64.tar.gz
tar -xzf zion-cli-<platform>-<arch>.tar.gz
sudo mv zion /usr/local/bin/
zion --help
```

#### Build from source

```bash
cd V3
cargo build --release -p zion-cli
./target/release/zion --help
```

#### First setup

```bash
zion onboard
```

The wizard creates `~/.zion/zion.toml`, asks for a topology and optionally sets a mining address.

#### Configuration

```bash
zion config set node.rpc_host rpc.zionterranova.com
zion config set node.rpc_port 8443
zion config set pool.host 62.171.141.136
zion config set pool.port 8444
```

### Wallet

```bash
# Create
export ZION_WALLET_PASSWORD="your-strong-password"
zion wallet new --out zion-wallet.json --password-env ZION_WALLET_PASSWORD

# Balance
zion wallet balance

# Send
zion wallet send --to zion1RECIPIENT --amount 10.5 --memo "hello"
```

> **Security:** Never store the password in shell history. Keep `zion-wallet.json` and the password separately, ideally in a password manager. Set permissions `chmod 600 zion-wallet.json`.

### Network status and earnings

```bash
zion status
zion doctor
zion pool earnings
```

### Mining

```bash
# CPU
zion mine start --backend cpu --threads 4 --pool 62.171.141.136:8444

# OpenCL GPU
zion mine start --backend opencl --pool 62.171.141.136:8444

# CUDA GPU
zion mine start --backend cuda --pool 62.171.141.136:8444
```

To change payout address:

```bash
zion config set miner.wallet zion1...
```

### Node

For most users running a node is not necessary — the public pool and RPC are enough. For advanced operators:

#### Build the node

```bash
cd V3
cargo build --release -p zion-core --bin node
```

#### Run the node

```bash
export ZION_NODE_ID="my-node-01"
export ZION_NODE_STATE_PATH="/var/lib/zion/state.db"
export ZION_P2P_BIND="0.0.0.0:8333"
export ZION_RPC_BIND="127.0.0.1:8443"
export ZION_METRICS_BIND="0.0.0.0:9115"
export ZION_SEED_PEERS="62.171.141.136:8333,62.171.141.136:8334"
export ZION_BLOCK_RETENTION=0

# Optional: the three fee-split wallets must be set all together or not at all
export ZION_HUMANITARIAN_WALLET="zion1..."
export ZION_ISSOBELLA_WALLET="zion1..."
export ZION_POOL_FEE_WALLET="zion1..."

./target/release/node
```

> **Note:** The public RPC runs on `http://rpc.zionterranova.com:8443` (plain HTTP, no TLS) and the pool on `62.171.141.136:8444`. Edge P2P ports are `8333`, `8334` and V31 `8335`. For your own node set `ZION_BLOCK_RETENTION=0` so the old block-pruning bug does not repeat.

#### Inspect node via CLI

```bash
zion node status
zion node sync
zion node peers
zion node blocks
zion node block 11184
```

### Desktop app

Easiest path for beginners:

1. Go to the GitHub release `v3.1.0-desktop`: `https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop`.
2. Choose a package for your platform:
   - Windows 11 (x64): `zion-public-miner-v3.1.0-windows-x64.exe`
   - macOS Apple Silicon: `zion-public-miner-v3.1.0-mac-arm64.dmg`
   - macOS Intel: `zion-public-miner-v3.1.0-mac-x64.dmg`
   - Linux: `.AppImage` or `.deb`
3. Install and allow in system settings.
4. Create a wallet, set pool `62.171.141.136:8444`, worker name and start mining.

> **Source:** `AGENTS.md`, Public Miner & Desktop release build section; `APP&WEB/website-v2.9/public/docs/onboard/desktop.md`.

### Bridge

wZION on Base:

```text
0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
```

CLI bridge commands:

```bash
zion bridge status
zion bridge chains
zion bridge pending
zion bridge history
zion bridge transfer --from-chain base --to-chain zion --token wZION --amount 10
```

> **Note:** Bridges require the L1 vault and validators. Always verify the contract address from an official source. Start with small amounts.

### DApp — first RPC query

Public RPC endpoint (plain HTTP, no TLS):

```text
http://rpc.zionterranova.com:8443
```

Example with `curl`:

```bash
curl -X POST http://rpc.zionterranova.com:8443 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":[]}'
```

Example in JavaScript:

```javascript
const RPC = 'http://rpc.zionterranova.com:8443';

async function rpcCall(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await res.json();
  return data.result;
}

rpcCall('getChainInfo').then(console.log);
```

> **Warning:** Use `http://`, not `https://`. Never expose your seed or private key in any code.

---

## Verifiable facts — summary

| Claim | Reality in code / network | Source |
|---|---|---|
| **Network status** | Mainnet Beta; official public launch 2026-12-31 | [`StatusV3.md`](../../../StatusV3.md), lines 7–8 |
| **Genesis hash** | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` | [`StatusV3.md`](../../../StatusV3.md), line 6; [`AGENTS.md`](../../../AGENTS.md) |
| **Genesis story / code reality** | 4 December 2025 (story) / hard genesis reset 2026-07-20 (after block retention fix) | [`StatusV3.md`](../../../StatusV3.md), line 9; [`AGENTS.md`](../../../AGENTS.md), BLOCK RETENTION FIX |
| **Block time** | 60 s; DAA LWMA 60 blocks; ±25 % clamp; solve time 30–120 s | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5 |
| **First-decade reward** | 5,400.067 ZION/block (2026–2036) | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5.2 |
| **Decade Decay** | Factor 0.8 (−20 %) every ~10 years (5,256,000 blocks) | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5.2 |
| **Tail emission** | 724.784723 ZION/block from ~2126, forever | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5.2 |
| **Reward split** | 89 % miners, 5 % humanitarian fund, 5 % Issobella fund, 1 % burn/pool fee | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5.3; [`V3/README.md`](../../../V3/README.md) |
| **Hard cap** | 144,000,000,000 ZION | [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md), chapter 5 |
| **PoW algorithm** | Ekam Deeksha / CosmicHarmony; 6 phases; LWMA 60 | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), Verifiable facts; [`V3/README.md`](../../../V3/README.md) |
| **Public pool** | `62.171.141.136:8444` (Stratum) | [`StatusV3.md`](../../../StatusV3.md), line 114; [`AGENTS.md`](../../../AGENTS.md) |
| **Public RPC** | `http://rpc.zionterranova.com:8443` (nginx TCP/HTTP proxy → `127.0.0.1:9443` on Edge) | [`StatusV3.md`](../../../StatusV3.md), line 112 |
| **Edge P2P** | `62.171.141.136:8333`, `8334`, V31 `8335` | [`StatusV3.md`](../../../StatusV3.md), service table; [`AGENTS.md`](../../../AGENTS.md) |
| **Edge RPC** | `9443` (node1), `8448` (node2), `9445` (V31) | [`StatusV3.md`](../../../StatusV3.md), service table; [`AGENTS.md`](../../../AGENTS.md) |
| **GitHub** | `https://github.com/Zion-TerraNova/v3-Mainnet` (public, MIT) | [`AGENTS.md`](../../../AGENTS.md), `public/` section |
| **Web** | `https://zionterranova.com`, dashboard `https://dashboard.zionterranova.com`, market `https://market.zionterranova.com` | [`StatusV3.md`](../../../StatusV3.md), Public Endpoints; [`AGENTS.md`](../../../AGENTS.md) |
| **wZION on Base** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | [`StatusV3.md`](../../../StatusV3.md), DeFi Contracts table |
| **Dharma Credits** | 144 billion total; 1.44 billion for Oasis; eShop tiers | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 13 |
| **Avatars** | 202 avatars in 17 circles | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 10 |
| **Consciousness Levels** | 9 levels (CL1–CL9) with multipliers 1.0x–10.0x | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 11 |
| **Genesis Territories** | 8 initial regions in Oasis, defined in `TerritoryMap` | [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md) |
| **Golden Egg** | 5 reward pools; 8.25 billion ZION; 108 clues | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 12; [`10-Prvni-Svet-Oasis-a-Best-of-Avatari.md`](./10-Prvni-Svet-Oasis-a-Best-of-Avatari.md) |
| **Seven paths** | 7 quest paths in Oasis | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), section 11 |
| **L1–L6 architecture** | L1 blockchain, L2 DeFi/bridge/DAO, L3 AI/WARP, L4 Oasis, L5 Free World, L6 Issobella | [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md), Verifiable facts; [`StatusV3.md`](../../../StatusV3.md) |
| **V31 Alpha** | V31 node `3.1.0-alpha.2` is LIVE on Edge, syncs with V3 mainnet over V3-compatible P2P, port 8335, RPC 9445 | [`StatusV3.md`](../../../StatusV3.md), line 8; [`AGENTS.md`](../../../AGENTS.md) |
| **Blocks 0–~10913 lost** | `block_retention` bug caused history pruning; fix 2026-07-20; old blocks are not recoverable | [`AGENTS.md`](../../../AGENTS.md), BLOCK RETENTION FIX; [`StatusV3.md`](../../../StatusV3.md), line 9 |

---

## For developers and further resources

- [`V3/docs/DEV_TEAM/ONBOARDING.md`](../../../V3/docs/DEV_TEAM/ONBOARDING.md) — how to join the dev team, build, tests, workflow
- [`V3/README.md`](../../../V3/README.md) — workspace overview, current status, full L1–L6 scope
- [`V3/docs/CLI_REFERENCE.md`](../../../V3/docs/CLI_REFERENCE.md) — all `zion` commands
- [`V3/docs/CLI_TROUBLESHOOTING.md`](../../../V3/docs/CLI_TROUBLESHOOTING.md) — common problem solving
- [`V3/docs/MINING_GUIDE.md`](../../../V3/docs/MINING_GUIDE.md) — deeper mining guide
- [`V3/docs/NODE_OPERATOR_GUIDE.md`](../../../V3/docs/NODE_OPERATOR_GUIDE.md) — node operation
- [`V3/L5/docs/TECH/zion-node-spec.md`](../../../V3/L5/docs/TECH/zion-node-spec.md) — Guardian node specification
- [`StatusV3.md`](../../../StatusV3.md) — live topology and network status
- [`AGENTS.md`](../../../AGENTS.md) — agent rules, incidents, ports
- [`ZION_Technical_Whitepaper_v3.1_EN.md`](../ZION_Technical_Whitepaper_v3.1_EN.md) — technical whitepaper 3.1
- [`SulZeme/00-README.md`](./00-README.md) — book *Salt of this Earth*
- [`OASIS_ONBOARDING.md`](./OASIS_ONBOARDING.md) — gateway to Oasis
- [`Onboarding.md`](./Onboarding.md) — short marketing version
- GitHub: `https://github.com/Zion-TerraNova/v3-Mainnet`

---

*Salt, compass, ship and bridge. Welcome on board.*

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*
