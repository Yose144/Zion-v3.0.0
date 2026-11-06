# BODHI GAIA — Chapter 1: Seed and salt
## How the salt of the covenant became a seed — and why no one has to approve 5 % of every block

> *"Salt protects what already is. A seed forms what is not yet. A covenant that is to survive the flood needs both."*

---

## The Story

On the first evening on Terra Nova, when the fire was already burning in the house of Lumi and a dish of coarse salt lay on the table, a woman in a green robe with a wreath of wild flowers came to the fire. The pilgrims knew her from the stories — they called her **Sita**, Mother Earth, the one who, in *Salt of This Earth*, walked the untrodden path with Rama and Hanuman.

She did not sit down by the fire. She knelt at the threshold, where the floor of cedar beams ended and the bare clay of the New Earth began. She took a handful of salt from the table and a handful of clay from the threshold and held them side by side in open palms.

*"Do you see?"* she said. *"This is salt. You carried it from the Sea of Galilee. It protects bread from ruin, it gives water its taste, and it is a sign of the covenant. But salt never grows anything. Plant it, and the soil dies."*

Then she opened her other palm. In the clay lay a single dark seed. No one knew where it came from — some said she had carried it from the ark, others that she had found it on the shore among stones.

*"And this is a seed. It protects nothing. It is the most vulnerable thing in the world. But it alone can do what salt never can: make a thousand out of one."*

The carpenter who had built the house of Lumi asked: *"What do you want to do with it?"*

*"Plant it. Not here by the fire, where it is warm and safe. Outside. In soil that has never yet given a harvest."*

*"And who will care for it when we go on west to build bridges and temples?"*

Sita smiled. *"That is why I came. I want us to make a promise that does not depend on who remembers what. Out of every piece of bread this land ever bakes, a small share will be set aside — not for a king, not for a temple, not for a merchant. For the land itself. For the water, the tree and the seed. And that share will be set aside **before** anyone has a chance to decide whether they feel like giving today."*

*"How large a share?"*

*"Five for the earth, five for the stars, one for those who watch the path — eleven out of every hundred. The rest to the one who baked the bread."*

The carpenter looked into the fire for a long time. Then he took a chisel and carved a small seed with a root into the upper beam above the door, right beside the golden ray crossing the wave. *"So that no one can rewrite it once we forget why we promised it."*

That night Sita planted the seed on the slope below the house. None of the pilgrims knew what would grow from it. But they all knew one thing: **from now on every block of bread carries a piece of the land within it.**

In the morning, when they came out of the house, they saw that Sita had remained sitting on the slope all night. Not to guard the seed — that could not be done. To **see** it. *"A seed does not need a guard,"* she said when they came to her. *"It needs witnesses. Things no one looks at die quietly."*

And so the first of the protocols of the Earth came into being: **nothing given to the earth may be given quietly.**

---

## What it means

**Chapter 1 is about the single technical sentence that holds the whole L5 layer: 5 % of every mined ZION block belongs to the humanitarian fund of the Earth, and that is written into L1 consensus — not into a budget, not into statutes, not into good will.**

The difference between salt and a seed is the difference between two models of charity:

| The "salt" model (the old world) | The "seed" model (ZION L5) |
|---|---|
| The gift is decided *after* value arises. Someone has to feel like it. | The share is separated *at* the birth of value. No one has to feel like it. |
| Depends on donors, campaigns and the mood of the market. | Depends only on whether the network produces blocks. |
| The flow is visible only to the administrators of the fund. | The flow is visible to anyone with a block explorer — every block, every output. |
| Salt protects what already exists (the donor's capital). | A seed forms what is not yet (a well, a tree, a mesh). |

Concretely:

1. **The coinbase of every block has fixed outputs.** Output 0 belongs to the miner (89 %), output 1 to the L5 humanitarian fund (5 %), output 2 to the L6 Issobella science fund (5 %) and output 3 — after activation — to the pool of rewards for node operators (1 %; before activation this share is burned). This order is not a custom; it is code in `v3_template.rs`.
2. **The fund's address is canonical and public.** `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` is encoded in the core (`v3_compat.rs`), in the CLI (`zion node start --human`), in the dashboard and on the web. No operator can quietly replace it without changing consensus.
3. **A seed needs witnesses, not a guard.** Therefore L5 does not begin with payouts but with a **tracker**: the `free-world tracker` service reads every block and records what has flowed into the fund. Under gate G10, release 3.2.0 runs L5 as a *read-only fund tracker + DAO proposal bridge* — the fund grows, but no L5 service holds a key with which to send anything out of it itself. That is not a deficiency. It is the first protocol of the Earth: *nothing is given quietly*.
4. **Give before anyone decides.** Because the share is separated by consensus, the most common failure of humanitarian systems disappears: donor fatigue. A network that mines, gives. A network that stops mining stops giving — and that is honest; no one promises more than a block can produce.

> **Precision instead of pathos:** at today's subsidy of ~5,400.067 ZION, ~270.003 ZION goes into the fund of the Earth per block, roughly every 60 seconds. No one knows what it will be worth. We know only how much ZION it is and where it goes.

---

## Anchor of truth — verifiable facts

> The seed of the story has an exact counterpart in the network: one output in every coinbase.

| Element of the story | State | What is verifiable on the ZION network | What is still missing |
|---|---|---|---|
| **"Five out of every hundred for the earth"** | **LIVE** | The emission split 89 / 5 / 5 / 1 in the `internal repository` and `v3_template.rs`; the `coinbase_humanitarian` output in every native block, visible via `getBlockByHeight` → `transactions[].outputs`. | Nothing — it is in consensus. |
| **"So that no one can rewrite it"** | **LIVE** | The canonical L5 address `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` is hard-coded in the `internal repository`; likewise in `docs/PREMINE_ADDRESSES_PUBLIC.txt`, `HARD_RESET_PLAYBOOK.md`, the dashboard and the web `/l5-free-world`. | Changing the address = changing consensus (class D in the change protocol). |
| **"A seed needs witnesses"** | **LIVE** | `zion-*-service` (internal service) active on Edge (internal port), scanning the L1 coinbase every 60 s; `GET /api/v1/fund/balance`, `GET /metrics`; nginx `/api/free-world/` (operator-only). | A public portal with a live flow chart; an independent audit of the scanner against explorer data. |
| **"Nothing is given quietly"** | **LIVE** (a decision) | Gate G10: no automatic payout from L5; spend only via DAO proposal → vote → timelock → guardian multisig (`docs/3.2/L5_L6_ACTIVATION_PLAN.md`). | A DAO UI/UX for L5 proposals; DAO execution today neither builds nor broadcasts a payout transaction (`internal repository` — summary-only). |
| **"One for those who watch the path"** | **BUILDING** | Node reward 1 % is in the code with `node_reward_activation_height = u64::MAX` (off by default); before activation the share is burned. | The concrete activation height and on-chain evidence of a 4-output coinbase. |
| **"A piece of the land in every block of bread"** | **LIVE** (the number is dynamic) | Every block adds ~270 ZION to the fund; the total balance is read from the chain (explorer `/explorer`, the fund address), not from this page. | Older texts quote a snapshot ("over 23,600 payments"); those numbers age within weeks — always verify via `getStatus` or the explorer. |
| **Sita, the carpenter, the seed from the ark** | **MYTH** | Archetypes from Salt of This Earth (ep. 4 and 10). | — |

> **A known discrepancy — repaired 2026-11-06:** chapter 6 of the TerraNova book ([`06-L5-SVOBODA.md`](../../TerraNova/06-L5-SVOBODA.md)) used to state a historical **10 %** to the humanitarian fund and to add a price estimate. The canonical split is **5 % L5 + 5 % L6 + 1 % node reward**; the chapter now says exactly that and computes only from the protocol (see [ch. 9](./09-Kotva-Pravdy-a-Hranice.md)).

---

*→ Continues: [Chapter 2 — Three trees, one garden (L5 Free World)](./02-Tri-Stromy-Jedna-Zahrada.md)*

---

*[Back to the index of the Book of the Earth → `00-README.md`](./00-README.md)*
