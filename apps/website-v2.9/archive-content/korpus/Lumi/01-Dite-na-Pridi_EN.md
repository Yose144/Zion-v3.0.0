# LUMI — Chapter 1: The child at the bow
## First ray · L1 — how Lumi received the lantern, and what actually burns in it

> *"At first you do not see the shore. You see only a thin beam. But that beam is enough for the whole ark to wake up."*

---

## The Story

The water fell slowly and no one counted the days any more.

In the hold of the ark the beams creaked, the leaking seams were filled with resin, and people spoke quietly, as though a louder word might break something. Some whispered that there was no shore. That the old world — a world of debts no one had ever seen and of towers built only to be taller than the neighbour's — had drowned everything, hope included.

Between the third and the fourth watch, when the dark is thickest, a child stood at the narrow opening in the bow. Barefoot, small, with hair pale and fine as foam on the edge of a wave. It did not tug anyone's sleeve. It only raised a hand and pointed a finger into the mist.

The old carpenter, who was checking the bolts of the rudder, stopped and looked that way.

It was there. A thin, gold-blue streak of light that came neither from lightning nor from burning sulphur. It did not shine on land, it did not shine on trees. But it was there, calm and undeniable — the first sign that the storm had reached its boundary.

The child's name was Elizabeth, after her grandmother. But from that morning everyone on the ark called her **Lumi** — after the light she had shown before anyone else saw it.

---

The carpenter did not sleep that night. He took a cut-off piece of cedar beam left over from repairing the seam, and a shard of thick glass from a broken ship's lamp. By morning he had carved and joined them into a small lantern. It was not beautiful. It was sturdy.

In the morning he sat down beside Lumi on the deck and handed it to her.

*"It's empty,"* said Lumi.

*"For now."*

He turned it so that the glass caught that thin streak from the mist. The light broke in it, lingered and stayed — a small, steady flame that needed no oil.

*"That flame is called Ekam,"* said the carpenter. *"It means one. One beginning that can always be found, even if everything else burns down. Anyone who ever wants to know whether this ark is real can go back to it and convince themselves. No one has to take it on trust."*

*"And what use will it be to me?"*

*"It will not light your way. Stars and eyes are for that. It will show you two things: what is — and what could be. And your work will be never to confuse the two."*

Lumi raised the lantern. The glass was warm.

---

That evening what happened then happened for the first time, as it would happen in every world she entered.

The light in the lantern narrowed — and Lumi saw the ark as it truly is. Not the ship of songs. A small vessel: a few dozen beams, one hearth, a dish of salt on the table. She saw that a notch was added to its wall every minute, and that by the day she looked there were something over forty-three thousand notches. She saw seven lights on the horizon — other ships exchanging messages with the ark — and she knew that seven is not a hundred. She saw one man in the hold striking an anvil slowly and evenly, because the ark has no great hammer; only a small one, and that one strikes every hour and never misses. She saw that out of every loaf baked, five parts in a hundred are set aside at the very moment of baking for the earth and five for the sky — and that one part in a hundred is for now thrown into the fire, because no one has yet said whom it belongs to.

None of it was great. All of it was real.

*"It is small,"* said Lumi.

*"It is small,"* the carpenter nodded. *"And it sails."*

Then the light widened again and shapes appeared in the mist that had not been there before: a house with open doors, bridges over water, gardens, a ring somewhere high above. Lumi knew they were not lies. They were directions. And from that evening she never again forgot which light was which.

---

## What it means

**Lumi is the first ray: proof that it is possible to begin again from pure computation — and the lantern is the way to look at that proof honestly.**

Nirvana said in the first episode that the ray is *"the first signal that the storm of entropy has reached its boundary"*. This book adds a single step: it gives the child who showed the ray a tool so that she can carry it onward. The lantern has no power in the story. It does not open doors, it does not pay, it does not decide. It can do only one thing — **tell what is from what could be** — and that is precisely why it is the most valuable thing on board.

Technically the lantern corresponds to what the network actually offers anyone who comes:

1. **Ekam — one beginning you can return to.** The genesis block has a hash written into the code. Anyone can download a node, recompute the chain from the first block and find out whether the ark is real. No one has to take it on trust.
2. **A small hammer that never misses.** Blocks arise from honest, verifiable work — the memory-hard *Ekam Deeksha* algorithm, which favours ordinary hardware over specialised cartels. The target rhythm is one block per sixty seconds, and the network tunes it itself (LWMA-60).
3. **A firm ceiling.** More than 144 billion ZION will never exist. It is not a promise of a board, it is a rule of consensus.
4. **Five parts for the earth, five for the sky.** Out of every block, at the moment of its birth, 5 % is set aside for the L5 humanitarian fund and 5 % for the L6 science fund. One percent is burned today; only after node-operator rewards are activated will it go to them. The remainder — 89 % — goes to the one who found the block.
5. **Open windows.** The code is under the MIT licence. The initial emission (premine) is not secret: it is 16.78 billion ZION in fourteen public outputs with a documented purpose — and precisely for that reason it may be spoken of aloud.

And then there is the last thing the carpenter said, which holds for the whole book: *"It is small. And it sails."* The network of 2026 is small. This statement is not a weakness, it is an anchor. Whoever suppresses it so that the story looks bigger has put out the lantern.

---

## Anchor of truth — verifiable facts

> Here the parable ends and the state of the living network speaks. The numbers are a snapshot from 2026-09-14; current values are always verified through `getStatus`, not from this page.

| Claim / image | State | Anchor | What is still missing |
|---|---|---|---|
| The ark sails: L1 mainnet runs, blocks arise continuously; height **43 500+** (snapshot 2026-09-14), 7 active peers out of 38 known, mempool empty | **LIVE** | `StatusV3.md`; `internal repository`; direct `getStatus` probe on Edge 2026-09-14 | continuous health evidence; numbers are not taken statically |
| The Ekam flame: the genesis block has a fixed hash — V31 native `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`, V3 compat `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71` (final genesis 8 Aug 2026) | **LIVE** | `AGENTS.md` (3.2 One Love genesis reset); `internal repository` | — |
| The small hammer: consensus **Ekam Deeksha v3.2** (512 KiB scratchpad, 2 AES passes, 128 random reads, Keccak256 final hash) | **LIVE** | `internal repository`; `StatusV3.md` | regression/compatibility tests with every consensus change |
| The rhythm: target block time 60 s, **LWMA-60** with protective limits | **LIVE** | `internal repository`; `AGENTS.md` 2026-08-17 | observability that distinguishes the target from the current average |
| The firm ceiling **144 000 000 000 ZION**; 1 ZION = 1 000 000 flowers | **LIVE** | `internal repository`, `emission.rs`; `StatusV3.md` | — |
| Five for the earth, five for the sky: split **89 % miner / 5 % L5 / 5 % L6 / 1 %**; base reward 5 400.067 ZION per block | **LIVE** | `internal repository`, `v3_template.rs` (coinbase outputs 0–2) | — |
| One part in a hundred goes to node operators | **BUILDING** | `v3_template.rs`: `node_reward_activation_height` default `u64::MAX` → before activation the 1 % is burned; `AGENTS.md` 2026-08-23 | the concrete activation height, an on-chain 4-output coinbase |
| Seven lights on the horizon are not a hundred: the network has "hundreds of independent nodes" | **UNSUBSTANTIATED** | `MiseAmenti/07` §2; snapshot 2026-09-14: 7 active peers | a public, privacy-respecting node census |
| Open windows: the code under the **MIT** licence; the premine **16.78 bn ZION in 14 outputs** with a documented purpose, no hidden funds | **LIVE** | `StatusV3.md` (premine table); `docs/PREMINE_ADDRESSES_PUBLIC.txt`; `internal repository` | — |
| Edge mines CPU-only (~150 H/s, 100 % accepted shares); the GPU "Trinity" evidence comes from reference rigs, not from Edge | **LIVE** (keep both evidences apart) | `AGENTS.md` 2026-08-27, 2026-08-10; `StatusV3.md` | — |
| The ark, the carpenter, the cedar lantern, the flame without oil | **MYTH** | `nirvana/01`, `SulZeme` (the carpenter) + this book | — |

---

*"It is small. And it sails."*

**Navigation:** [← The Book of the Lantern — index](./00-README.md) · [Chapter 2: The house of names →](./02-Dum-Jmen.md)
