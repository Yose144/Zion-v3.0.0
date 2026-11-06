# LUMI — Chapter 3: Bridges and the market at the bridge
## WARP · L2 — a hundred ZION cross to the island and back, five keepers, four signatures, and a price that is not yet bread

> *"A bridge is a promise kept in both directions."*

---

## The Story

From the house of Lumi a path led down to the water. Where the New Earth ended and the sea began stood a bridge.

It was not of stone. It was of light — a thin, taut arch that vanished in the haze above the water and on the other side touched an island they called Base. Lumi knew it from the stories: the builders of the house of Lumi had once looked across the sea and said that they would not pull down foreign islands, but build bridges between them.

At the foot of the bridge stood a stone vault and beside it five people in grey cloaks. They did not speak to one another. Each held their own key.

A carrier came with a hundred silver coins. He placed them in the vault, the vault creaked and closed. On the far shore, far off in the haze, a hundred small lights came on — the same number, a different shape. The carrier crossed the bridge, on the island those hundred lights *went out* — and on this shore the vault opened of itself and the coins returned to his palm.

*"Why did you let him cross twice when nothing changed?"* asked Lumi.

*"Because something did change,"* said the eldest of the keepers. *"Now we know that the bridge holds in both directions. Lock — give — burn — unlock. Whoever can do only half has no bridge, they have a trap."*

*"And why are there five of you?"*

*"So that none of us is alone. Four of us must agree before the vault moves. One may be mistaken. One may be wicked. One may be asleep. Four will not."*

---

A little way from the bridge, where the paths met, there was a market. A small one — one stall, one scale. The seller was exchanging silver from the island for bread from the mainland.

*"How much bread for your silver?"* Lumi asked her, just out of curiosity, and pointed at the lantern as though it were for sale.

The seller looked at the scale and said a number.

*"So that is how much I have,"* said Lumi.

*"No,"* the seller smiled. *"That is how much you **might** get, if you gave it to me now and I had enough bread and no one came in the meantime and carried off half of it. I told you a price. A price is not bread in the hand. A price is a word. The bread is only what you carry away."*

Lumi remembered that. It was almost the same thing the carpenter had told her about the lantern: what is, and what could be.

---

When she turned back to the sea, she saw other arches in the mist. Many. Some led to islands she had heard of — an island where gold is counted, an island of fast ships, an island with lightning in its name. But all of them were closed, and on each hung a wooden sign. Not "forbidden". On each was written **why**: *the keepers have not yet been chosen; the key has no one to hold it yet; on the far shore no one is waiting yet.*

*"Those bridges are there,"* she said.

*"They are drawn,"* the keeper corrected her. *"A bridge no one has crossed there and back is not a bridge. It is a line. When someone crosses it in both directions and we write it down, we take the sign off."*

---

The lantern showed today.

The light narrowed and Lumi saw exactly two islands joined by a living bridge — the New Earth and Base. She saw that a hundred coins really had crossed the bridge there and back and that someone had written it down. She saw the market as small as it actually was: on the scale nineteen units of foreign bread against a hundred and fifty thousand silver — a snapshot of one day, not a fixed measure. She saw that the seller can state a price, but that the path *deposit — swap — withdraw* for an ordinary pilgrim with their own bundle is still being tried, and that when someone tried it without enough silver the market correctly said *you do not have enough* — which is a refusal, not a trade. And she saw all the other arches with their signs, exactly as they stood.

*"Two islands,"* she said.

*"Two,"* said the keeper. *"Written down."*

---

## What it means

**Bridges have the strictest evidentiary bar in the whole book — stricter than the gardens and even than the sky — because on a bridge the network holds other people's means.** The chapter takes the image from the sixth episode of Nirvana (*"bridges of pure light"*) and adds a single rule to it: **a bridge is a promise kept in both directions, and until it has been kept it is a line on a map.**

1. **Lock — give — burn — unlock.** The WARP bridge between ZION L1 and Base works so that ZION is locked in a vault on L1, the same amount of wZION arises on Base (mint), and on return the wZION is burned (burn) and the vault on L1 unlocks. This complete round-trip has been carried out and written down.
2. **Five keepers, four signatures.** ZIONBridge on Base has five validators and a threshold of 4 of 5. Whoever claims 5 of 5 is quoting an older text; the canonical state is 4/5.
3. **A price is not bread.** The DEX quote API returns a price; settlement is another matter. The canonical market is the Uniswap V3 pool wZION/USDT — the only live one, with small liquidity. The proprietary AMM (ZionDex) is history and is marked deprecated.
4. **The sign that says *why*.** The WARP configuration has only `base` and `zion-l1` active. All other networks have an explicit `disabled_reason`. Every new chain must pass its own threat model, deploy evidence and E2E matrix (M1.6) — and until it does, it must not be called "supported".
5. **Whoever holds the keys must be visible.** Every screen must say whether the means are the user's, delegated, or in custody (M1.1). The house of names from the previous chapter and the bridge from this one belong together: identity without a hidden administrator, transfer without a hidden risk.

---

## Anchor of truth — verifiable facts

> A bridge is not proven by the beauty of its arch, but by a record of the crossing there and back. Snapshot 2026-09-14; numbers from the chain are read from the chain, not from the book.

| Claim / image | State | Anchor | What is still missing |
|---|---|---|---|
| The bridge stands: `warpd` / the internal service runs; Base + ZION L1 pilot | **LIVE** | `StatusV3.md`; `internal repository`; `warp.example.toml`; `internal repository` (WARP internal port, DEX `8454`) | monitoring of the live config and of key ownership without publishing secrets |
| A hundred coins there and back: 100 ZION lock → 100 wZION mint on Base → burn → L1 unlock | **LIVE** | `internal repository` (E4 round-trip) | a repeatable audit and monitoring of validator state |
| Five keepers, four signatures: wZION `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`; ZIONBridge `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` (5 validators, threshold **4/5**); ZIONStaking `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | **LIVE** | `L2contracts.md`; `AGENTS.md` 2026-09-07 (corrected from an earlier 5/5) | — |
| The market at the bridge: the single live pool Uniswap V3 wZION/USDT `0x186b46c2f04153999d44D25179cD623fD62Bfda2` (0.3 %); snapshot 2026-09-07 ≈ 19 USDT + 151 867 wZION; the wZION/WETH and wZION/USDC pools empty | **LIVE** (the number is a snapshot) | `L2contracts.md`; `AGENTS.md` 2026-09-07 | liquidity is read from the chain; a dedicated Base RPC |
| The seller states a price: the quote API `/v1/swap/quote`, `/v1/swap/quote/multi` and the web widget | **LIVE** | `StatusV3.md`; `ZionDexZis.md` 2026-08-29 | do not confuse a quote with settlement |
| Deposit — swap — withdraw with one's own bundle: a funded E2E deposit → swap → withdraw for the user | **BUILDING** | `MiseAmenti/07` §3; test evidence so far "insufficient balance" without a funded test wallet | an E2E with a funded account, on-chain receipts, reconciliation, independent review |
| Independent carriers (a solver federation) in production | **BUILDING** | `warp.example.toml`: `[solver] enabled = false` | independent solvers, live config, incident policy |
| The other arches: Arbitrum, Optimism, Polygon, Bitcoin, Solana, SUI, Aptos, Lightning "supported" | **HORIZON** | `warp.example.toml` — only `base` and `zion-l1` active, the rest `disabled_reason`; the Solana adapter has a finished deposit watcher but `enabled = false` (`AGENTS.md` 2026-09-14) | separate evidence for each chain |
| The proprietary ZionDex market (an AMM on Base) | **historical / DEPRECATED** | `L2contracts.md` §2; `AGENTS.md` (the ZIONDEX note marked HISTORICAL) | — |
| Whoever holds the keys must be visible (custody disclosure) | **BUILDING** | `MiseAmenti/04` M1.1 | marking user-controlled / delegated / custodial on every screen |
| The vault, five cloaks, the seller, the signs in the mist | **MYTH** | `nirvana/06` + this book | — |

---

*"A price someone tells you is not yet bread in the hand."*

**Navigation:** [← Chapter 2: The house of names](./02-Dum-Jmen.md) · [Chapter 4: The golden womb and the voice without a key →](./04-Zlate-Luno-a-Hlas-Bez-Klice.md)
