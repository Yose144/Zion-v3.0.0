# ZION — Canonical Onboarding for the General Public
## Entering the ZION TerraNova network · 3.2 "One Love"

> **Status:** CANONICAL public onboarding — the single entry point for every newcomer.
> Supersedes [`SulZeme/ZION_ONBOARDING_EN.md`](./SulZeme/ZION_ONBOARDING_EN.md) (2026-08-03) as the main public onboarding.
> **Date:** 2026-08-09
> **Network:** Mainnet Alpha `3.1.0-beta` / protocol `zion-v3-node/3.1.0-alpha` → target **3.2.0 "One Love" (Mainnet Stable)**
> **Public launch:** December 31, 2026
> **Language:** English — [Česká verze](./ZION_ONBOARDING_PUBLIC_CZ.md)

---

## 1. ZION in three sentences

1. **ZION is a blockchain you can verify, not just believe.** Open Rust code under the MIT license, a new block every minute, a running production network — no paper promises.
2. **Every block automatically splits its reward: 89% to the miner, 5% to a humanitarian fund, 5% to the science & future fund (Issobella), 1% burned.** The protocol itself enforces this split — no vote or corporate decision can switch it off.
3. **Nobody received a VIP entrance.** No ICO, no presale. The genesis allocation is publicly documented in code, and everything else is created by honest mining.

---

## 2. Verified network state (as of 2026-08-09)

| What | State |
|---|---|
| Chain | 1000+ blocks since the 2026-08-06 genesis reset, ~60 s/block |
| Tests | `cargo test --workspace` — **2178 pass, 0 failures** |
| Services | node, pool, miner, multichain, DAO, OASIS, dashboard, web, marketplace — all `up` |
| Public pool | `62.171.141.136:8444` (Stratum) |
| Public RPC | `rpc.zionterranova.com:8443` |
| Web | `https://zionterranova.com` |
| OASIS preview | `https://oasis.zionterranova.com` |
| Source code | `https://github.com/Zion-TerraNova/v3-Mainnet` (MIT) |

---

## 3. Key numbers

| Parameter | Value |
|---|---|
| Total supply | 144,000,000,000 ZION (hard cap) |
| Block time | ~60 seconds |
| Block reward (Decade 1, 2026–2036) | 5,400.067 ZION — the highest in network history |
| Emission model | Decade Decay: −20% every 10 years, perpetual tail ~724.78 ZION/block from ~2126 |
| Reward split | 89% miner / 5% humanitarian / 5% Issobella / 1% burn |
| Mining algorithm | Ekam Deeksha v3.2 — memory-hard PoW (CPU/GPU, ASIC-resistant) |
| Atomic unit | 1 ZION = 1,000,000 flowers (6 decimal places) |
| Genesis hash (V3 compat) | `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` |
| Genesis hash (V31 native) | `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb` |
| License | MIT |

---

## 4. Choose your path

### Observer — "I want proof first" (2 minutes)

1. Open `https://zionterranova.com` and watch the live network.
2. Browse the code at `https://github.com/Zion-TerraNova/v3-Mainnet` — nothing is hidden.
3. Ask the community anything. A good community can say "we don't know" and point to a source.

### Player — "I want to experience it" (5 minutes)

1. Enter OASIS: `https://oasis.zionterranova.com`.
2. Walk the warp intro, fly the 3D galaxy of 55 worlds, browse the Avatar Codex.
3. Explore the NFT marketplace at `https://market.zionterranova.com`.

> **Honestly:** OASIS is a **live preview under construction** — not a finished game.
> Content, quests, and progression can change or reset during development. The Golden
> Egg and the full game economy are the future, not today's reality. You enter as a
> co-creator of a garden, not a customer of a finished product.

### Miner — "I want to plug in my machine" (15 minutes)

1. Create **your own** wallet — never give your mnemonic to anyone.
2. Download or build `zion-miner`:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V31
cargo build --release --bin zion-miner
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet zion1...your_address \
  --worker my-first-rig
```

3. Watch accepted shares and temperatures; start conservatively.

> **Why start early:** the first decade carries the highest scheduled block reward,
> and a small network means you learn wallets, rigs, and security before the crowd
> arrives. This is not a promise of profit — actual results depend on your hashrate,
> difficulty, costs, and market price. It is a description of an emission schedule
> you can verify in code.

### Builder — "I want to carry part of the bridge"

1. Build the workspace, run the tests, open an issue or pull request.
2. Improve documentation, add a test, fix a bug, propose better UX.
3. Bring the skill you already have — design, translation, security, music, community.

---

## 5. The story, for those who want more than numbers

ZION stands on four books — the four questions of the compass:

| Book | Direction | Question |
|---|---|---|
| **Genesis** | North | Why build at all? |
| **Quantum Revolution** | East | What is broken in the old world? |
| **Ekam Deeksha** | South | Who am I on this path? |
| **Terra Nova** | West | Where is all of this heading? |

And **Oasis** is the center of the compass. There you stand.

- **The Salt of the Earth book** — 12 stops on the road to Oasis: [`SulZeme/00-README_EN.md`](./SulZeme/00-README_EN.md)
- **The fireside Rasta story** — a captivating invitation: [`marketing/RASTA_ONBOARD_3.2_ONE_LOVE_EN.md`](./marketing/RASTA_ONBOARD_3.2_ONE_LOVE_EN.md)
- **Road to Zion** — the four books as Bob Marley would sing them: [`marketing/ROAD_TO_ZION_EN.md`](./marketing/ROAD_TO_ZION_EN.md)

A story may be beautiful, but network facts must be precise. **A story is not a promise.**

---

## 6. Safety first

- **Never send your mnemonic or private keys to anyone.** No support agent, admin, or "prize" ever needs them.
- Lost key = lost ZION. There is no password reset.
- Official domains: `zionterranova.com` and its subdomains (`app.`, `oasis.`, `market.`, `dashboard.`, `rpc.`). Verify everything else.
- Official code: `github.com/Zion-TerraNova/v3-Mainnet`. Verify binaries against SHA256SUMS from GitHub releases.
- Nobody from the project will contact you first with an investment offer.

---

## 7. What ZION does not promise

1. **No overnight riches.** ZION is infrastructure and an idea, not a financial scheme.
2. **No price guarantees.** The market sets the price; nothing in this document is investment advice.
3. **No finished AAA game.** OASIS is a preview under construction.
4. **No passive income without work.** Mining has costs, risks, and personal hardware responsibility.
5. **No religious claims.** Story characters are archetypes, not theology.

---

## 8. Canonical sources of truth

| Document | Purpose |
|---|---|
| [`ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_EN.md`](./ZION_MASTER_WHITEPAPER_3.2_ONE_LOVE_EN.md) | Canonical 3.2 "One Love" whitepaper |
| [`ZION_ONBOARDING_3.2_ONE_LOVE_EN.md`](./ZION_ONBOARDING_3.2_ONE_LOVE_EN.md) | In-depth onboarding (technical + narrative) |
| [`SulZeme/00-README_EN.md`](./SulZeme/00-README_EN.md) | The Salt of the Earth book — 12 stops |
| [`ZION_Technical_Whitepaper_v3.1_EN.md`](./ZION_Technical_Whitepaper_v3.1_EN.md) | Technical reference (consensus, emission, architecture) |
| [`../../V31/PLAN_TO_3.2.md`](../../V31/PLAN_TO_3.2.md) | Technical plan of the road to Mainnet Stable |
| [`../../StatusV3.md`](../../StatusV3.md) | Live network status and topology |

---

*One love, one chain, one road.*
*Canonized 2026-08-09 from the running network and the V31 repository.*
