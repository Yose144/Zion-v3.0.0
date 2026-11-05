# ISSOBELLA — Chapter 6: Five per cent upward
## The titík · L1 → L6 — a stream no one has to approve, and a fund waiting for its time

> *"Whoever gives the sky first receives the stars later."*

---

## The Story

When the pilgrims learned to count blocks, they learned to count something else as well: **where a part of the light disappears from each block**.

It was explained to them by a teacher who called himself Only-that — because he always said "only that" first and the answer after. *"Every block carries a reward,"* he said. *"Ninety per cent goes to the one who found the nonce — the one who watches now. Five per cent goes down — into the well of people, L5. And five per cent goes up — into the well of the sky, L6."*

*"And who decides about that?"* asked the carpenter.

*"No one,"* said Only-that. *"And that is precisely the most beautiful thing about it. The protocol did it itself, at birth. No mood, no government and no good reason can stop it. As long as there is mining, the stream flows. Like rain — no one approved it, and yet it fills every well."*

Then he showed a second cabinet, heavier. *"But that is not all. When the network was born, it set aside from the first issuance a great vessel for the sky — two and a half billion. And it locked it. Not with a person's key — with the key of time. It will open when the chain reaches the height written in the code. Until then no one may touch it — not with a good song, nor with a better intention."*

*"And when it unlocks?"*

*"Then a path follows: proposal, vote, waiting, the guardians' signatures — and a record that anyone can check. Money that flows upward does not flow into a pocket. It flows into a question: *what deserves to fly?*"*

The pilgrims understood that the sky has a special tax in this world — and a special humility. A trickle that flows by itself, and a fund that does not open before its time.

---

## What it means

**L6 is financed by two streams — and both are real, on-chain, verifiable.** This chapter is a signpost between them, because in stories they are easily tangled:

**The first stream — the flowing stream:** `ISSOBELLA_PCT = 5`. Every block subsidy sends 5 % to the canonical L6 address `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0`. No voting, no committee, no mood — the protocol does it itself from genesis. That is the "titík" — the trickle no one has to approve.

**The second stream — the waiting stream:** premine slot 6 — **2.5 billion ZION** at the address `zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5`, category `l6_issobella`, **time-locked until block 144 000** + admin multisig (3-of-3) + DAO vote. Transferred from the DAO Treasury on 12 September 2026 — a metadata-only change, the genesis hashes untouched. That is the "vessel" that opens when the chain has grown.

And a boundary the book says aloud: **the fund pays out nothing today.** Decision G10 keeps L6 in *read-only* mode — the fund accumulates on-chain, any expenditure must pass the DAO path (proposal → vote → timelock → guardian multisig), and that path today waits for a missing DAO UI. Whoever says Issobella already "pays scientists" is lying. Whoever says resources are accumulating for the question *what deserves to fly* is telling the truth.

### Two streams, two addresses, two natures

| | The flowing titík | The waiting vessel |
|---|---|---|
| **Address** | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` | `zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5` |
| **Source** | 5 % of every block subsidy (`ISSOBELLA_PCT`) | Premine slot 6 (2.5 billion ZION) |
| **When** | Every block, automatically | A one-off entry in genesis, locked until block 144 000 |
| **Nature** | An operating stream | Foundation / endowment |
| **Who may spend** | No one directly — only through the DAO path | No one before unlocking; afterwards the admin multisig + DAO vote |

---

## Anchor of truth — verifiable facts

| Claim | State | Anchor |
|---|---|---|
| `ISSOBELLA_PCT = 5` in the emission code; 5 % of every subsidy → `zion1z4s3a5...` | **LIVE** | the `internal repository`, `v3_compat.rs` (`MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET`), `StatusV3.md` ("Fee Split") |
| Premine slot 6 = 2.5 billion ZION for `l6_issobella`, lock 144 000, address `zion1f5h5k6t8...` | **LIVE** | the `internal repository`, [`CHANGES_L6_ISSOBELLA.md`](../../3.2/CHANGES_L6_ISSOBELLA.md), `StatusV3.md` 2026-09-12 |
| Slot 6 was transferred from the DAO Treasury (Community Governance); genesis hashes unchanged | **LIVE** | `CHANGES_L6_ISSOBELLA.md`; `StatusV3.md` 2026-09-12 |
| The fund today actively finances research / grants | **INVALID CLAIM** | G10: no automatic disposition; the DAO path is read-only ([`L5_L6_ACTIVATION_PLAN.md`](../../3.2/L5_L6_ACTIVATION_PLAN.md)) |
| Unlocking slot 6 conditioned on the admin multisig (3-of-3) + DAO vote | **LIVE** (design) | `CHANGES_L6_ISSOBELLA.md`, the `/l6-issobella` premine card |
| "The titík that no one has to approve" | **LIVE** (protocol) | Protocol emission — coinbase output 2 (post-activation with node reward) |

---

*"Money that flows upward does not flow into a pocket. It flows into a question: what deserves to fly?"*

**Navigation:** [← Chapter 5: The legacy of stations](./05-Dedictvi-Stanic.md) · [Chapter 7: The watcher at the edge →](./07-Hlidac-Na-Okraji.md)
