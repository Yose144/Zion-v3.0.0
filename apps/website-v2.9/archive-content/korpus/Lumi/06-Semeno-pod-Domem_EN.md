# LUMI — Chapter 6: The seed beneath the house
## Sowing · L5 — five out of every hundred, the Genesis Garden on the Atlantic coast, and seven domes that are a promise, not a house

> *"A seed does not need a guard. It needs witnesses."*

---

## The Story

Beyond the gate there was no darkness. There was a garden.

Lumi stood on a slope above an ocean such as she had not yet seen — grey-blue, with long waves and a wind that smelled of salt and pines. Below her ran terraces: beds, stone walls, water tanks, tents and wooden shelters, above them a few windmills and gleaming surfaces drinking the sun. People were working. Someone carried a bucket, someone was repairing a fence, a child younger than Lumi carried a bowl of water to a young tree and took care not to spill a drop.

It was alive. It was ordinary. Nowhere did anything tower.

Lumi ran to the highest place — to the lookout above the cliff, from which the whole coast could be seen — because that is surely where **the important thing** must be seen. On the way she jumped over a dried side channel in which a leafy branch had caught, and noticed only out of the corner of her eye that beneath the branch something small and wet twitched.

She reached the lookout. The view was beautiful. But something would not let her be.

She went back. She knelt by the channel, pulled out the branch and pushed the leaves aside. The water that had gathered behind it slowly began to run down — towards the little tree, towards the child with the bowl, who looked at her in amazement. The small wet thing crawled away with the current.

It was not a great gesture. It took ten seconds.

*"I thought I was looking for something big,"* Lumi said aloud, to herself.

---

On the slope below the building that looked like the house of Lumi, only older and overgrown, a woman in a green robe sat by a tree. The tree was tall, with a crown that held shade for a whole bench. Lumi knew her from the stories: Sita, Mother Earth, the one who on the first night on the New Earth planted a single seed in soil that had never yet given a harvest.

*"Is that it?"* asked Lumi, pointing at the tree.

*"That is it. I sat here all night then — not to guard it, that cannot be done. To see it. Things no one looks at die quietly."*

Sita took Lumi by the hand and led her into the building. Above the door, beside the golden ray, a seed with a root was carved — the one Lumi had seen on the house of Lumi and did not know who had carved there. *"The carpenter. When we made our promise: out of every loaf this land bakes, five parts in a hundred are set aside for the earth and five for the sky, and they are set aside **before** anyone can decide whether they feel like giving today. He carved it so that no one could rewrite it once we forget why we promised it."*

*"And who guards those five parts?"*

*"No one. Someone counts them. That is the difference. A guard would have a key. The one who counts has only a list. A key can be stolen; a list can only be checked."*

---

Then Sita led Lumi outside and pointed across the sea, to the south.

Far off, above a volcanic island, something was taking shape in the afternoon light that took Lumi's breath away: seven domes of wood and light arranged around a tree whose crown rose above them all — the Tree of Life at the centre, and around it a star of two triangles that seemed to turn even while standing still.

*"Dharma Temple,"* said Sita. *"The new Bodhi Gaia."*

Lumi looked for a long time. Then Sita said the sentence Lumi heard from that moment in every garden:

*"This does not stand yet. Look at it as a promise, not as a house. A promise can be broken or kept. A house that does not stand can only be drawn."*

---

The lantern showed today.

The light narrowed and the blossoming terraces vanished. Lumi saw the slope on the Atlantic coast as it is in 2026: the first three keepers who have come together, a paper with phases, of which the first — the legal basis, access to land — is complete and the second — water, energy, food, shelter — is only under way. No lookout with a crowd, no windmills above the terraces; the possibility that the first guests will come this year stands on paper without evidence. She saw that out of every loaf baked, five parts in a hundred really are, every minute, set aside to one particular place — a little over two hundred and seventy units from a single block — and that beside that place sits the one who counts, and has no key. She saw that not a single unit of what has been set aside has yet been paid out to anyone: not because there was no one to pay, but because the path from the pile to a person — proposal, vote, waiting, the guardians' signatures — is drawn and no one has yet walked it. And above the volcanic island she saw no dome. Only a paper with a ground plan, an image on the web, and a promise.

*"It is little,"* said Lumi.

*"It is a seed,"* said Sita. *"A seed is always little. That is why it needs witnesses."*

---

## What it means

**Layer L5 begins with a single technical sentence, and this chapter holds it: five percent of every mined block belongs to the fund of the Earth — and it is written into consensus, not into a budget.** The Book of the Earth tells the story of salt and seed in its first chapter; this book takes it over and lets Lumi make one mistake and one correction, because that is precisely the measure of the whole layer: **water does not start flowing because someone is looking at the view. It starts flowing when someone lifts the branch.**

1. **Five in a hundred, before anyone decides.** The coinbase of every block has fixed outputs: 0 miner (89 %), 1 fund of the Earth (5 %), 2 fund of the sky (5 %), 3 — once activated — node operators (1 %, until then burned). The share is separated *at* the birth of value; no one has to feel like it. A network that mines, gives; a network that stops mining stops giving — and that is honest.
2. **The one who counts has no key.** The `free-world tracker` service reads every block and records what has flowed into the fund. Decision G10 for 3.2 says: L5 runs as a *read-only tracker + bridge to the DAO*. No L5 service holds a key with which it could send anything out of the fund. That is not a deficiency — it is the first protocol of the Earth: *nothing is given quietly.*
3. **The Genesis Garden is a construction, not a picture.** The community document lists Phase 0 (legal basis, three keepers, access to land) as complete and Phase 1 (water, energy, food, shelter) as under way. Missing: a plot with GPS, a registered entity and independent verification. The blossoming terraces of the story are an image of a possible future.
4. **Dharma Temple is a promise, not a house.** The Merkaba, the seven domes and the Tree of Life exist as an architectural concept, a 3D preview and documentation. Physically nothing stands. The book says it exactly as Sita said it.
5. **Where an impact packet is missing, there is no impact.** No L5 project today has a public package with recipient, budget, on-chain reference, provenance-marked evidence, limitations and independent verification. Until one exists, one must not say "verified impact" — about any well, about any tree.

---

## Anchor of truth — verifiable facts

> The seed of the story has an exact counterpart in the network: one output in every coinbase. Everything else is read by its label. Snapshot 2026-09-14.

| Claim / image | State | Anchor | What is still missing |
|---|---|---|---|
| Five in a hundred for the earth: 5 % block subsidy → the L5 fund `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` (coinbase output 1 `coinbase_humanitarian`) | **LIVE** | `internal repository`, `v3_template.rs`, `v3_compat.rs` (`MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET`); `getBlockByHeight` → `transactions[].outputs` | — (changing the address = changing consensus, class D) |
| Over two hundred and seventy units from a block: ~270.003 ZION per block at a subsidy of 5 400.067 ZION | **LIVE** (derived from the constants) | `BodhiGaia/01`; `emission.rs` | the fund's balance is read from the chain (`/explorer`, the fund address), not from the book |
| The one who counts: the `free-world tracker` tracker on Edge (internal port, nginx `/api/free-world/`, operator-only), scanning the coinbase; `GET /api/v1/fund/balance`, `/metrics` | **LIVE** (read-only) | `zion-*-service` (internal service); `internal repository`; `StatusV3.md` 2026-08-23 | a public portal with a live chart; the API key is loaded but not enforced |
| Out of what has been set aside, something is paid out: the fund pays grants today | **INVALID CLAIM** (today) | G10 (`docs/3.2/L5_L6_ACTIVATION_PLAN.md`): no automatic payout; the `internal repository` execution is summary-only | a DAO UI, the payout tx flow, the guardian multisig, the first impact packet |
| The bridge to the DAO: grant → `submit-to-dao` → proposal | **BUILDING** | `internal repository` → internal port, `X-DAO-Key` | a verified E2E grant → proposal → vote on Edge |
| The Genesis Garden (Sabacheira, Tomar, Portugal) — a physical place in active development; Phase 0 complete, Phase 1 under way | **BUILDING** | `public/V3/L5/docs/COMMUNITIES/genesis-garden.md` (🟡; Phase 0 ✅, Phase 1 🟡; the document dated 2026-05-21); web `/terranova/genesis`; `BodhiGaia/03` | land (purchase/lease), a registered entity, GPS, evidence of realisation, independent verification; the first guests "Q3 2026" without evidence |
| Dharma Temple (La Palma) — Merkaba, seven domes, the Tree of Life | **BUILDING (documentation) / HORIZON (physically)** | `public/V3/L5/docs/COMMUNITIES/dharma-temple.md` (🔵 Preparation); web `/terranova/dharma-temple` (3D concept, ground plan); `BodhiGaia/04` | land, entity, five founding keepers, Phase 1 funding; no dome stands |
| The lookout, terraces full of people, the child with the bowl of water, the windmills | **HORIZON / MYTH** | an image of a possible future (the revealed future of this book) | — |
| An impact packet for any L5 project | **UNSUBSTANTIATED** | `MiseAmenti/04` M5; `BodhiGaia/06`, `09` — none has yet been created | a template, a first pilot (closest: Genesis Garden Phase 1) |
| Sita, the tree from a seed, the carpenter's carving, the channel with the branch | **MYTH** | `BodhiGaia/01`, `SulZeme/04`, `10` + this book | — |

---

*"Water does not start flowing because someone is looking at the view. It starts flowing when someone lifts the branch."*

**Navigation:** [← Chapter 5: The gate and the two priestesses](./05-Brana-a-Dve-Knezky.md) · [Chapter 7: Five gardens of one Earth →](./07-Pet-Zahrad-Jedne-Zeme.md)
