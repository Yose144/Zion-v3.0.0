# LUMI — Chapter 2: The house of names
## The house of Lumi · ZIS — a door without a lock, a hall of echoes, and a key that everyone carries themselves

> *"A door without a lock is not carelessness. It is possible only where everyone carries their own key."*

---

## The Story

On the first slope of the New Earth stood a house that had received her name before she first slept in it.

She recognised it by the sign above the lintel: a golden ray crossing a wave and, right beside it, a small seed with a root, which someone had carved there later, with a different hand. Foundations of basalt, beams of cedar — the same cedar her lantern was made of. Inside, a single large room, a hearth, a long bench, and on an oak table a dish of coarse salt.

And the door. Wide, forged, without a bar and without a keyhole. Lumi pushed it and it opened inward, as though waiting for her.

*"No one locks it?"* she asked the carpenter, who was feeding the fire.

*"It can't be done. It has no lock."*

*"And when a thief comes?"*

The carpenter pointed to the bench, where pilgrims sat, each with a small bundle in their lap. *"What would he steal? The house has nothing. Everything of value each person carries themselves — in that bundle, and more still in the head. Twelve words, some twenty-four. Whoever remembers them, every chest that is his opens for him. Whoever loses them — I will not open it for him. Nor a king, nor a court, nor the one who built this house."*

*"That is cruel."*

*"That is honest. A house that could forgive you a lost key would have to keep a second key by itself. And a house with a second key no longer has a door without a lock — it has only a lock it did not tell you about."*

---

At the back of the room there was a hall that Lumi did not know from Nirvana. It was tall and bare, and every word returned in it.

Pilgrims went in to say who they were. *"A carpenter from Galilee,"* someone said — and the hall returned: *carpenter, carpenter, from Galilee.* *"A water-carrier."* — *carrier, carrier.* *"A keeper of the bridge."* — *keeper, bridge, bridge.* The hall took nothing from anyone. It only repeated what each had given it.

Lumi went in, straightened, and said in the voice she had heard at the gate: *"Keeper of the gate, bearer of the lantern of the future."*

The hall returned it. It sounded beautiful. It sounded as though someone else were saying it.

She stood in that echo a while, and then sat down on the floor, because the echo was above her and she was small. She bowed her head to the lantern and said quietly, only to herself:

*"I am Lumi. Just Lumi."*

The hall fell silent. Not because it had failed to catch the name — because it did not need to repeat it. It was small enough to fit into one person.

The carpenter stood in the doorway of the hall. *"There. Now the house knows who you are. And it remembers nothing more about you than you told it. Not where you come from, not what you have in your bundle, not where you are going. That is the whole secret of this house: it remembers only what it must."*

---

The lantern showed today.

The light narrowed and Lumi saw the house as it actually stands in 2026: a small building at the edge of the network that can do one thing — recognise that the one arriving is the one they claim to be, because they signed with a key that never left their own hand. No password in a foreign chest, no face or finger that the house would scan — all that someone was still drawing on paper by the fire as work for the coming years. She saw that bundles are made at home, separately for each person, out of twelve or twenty-four words, and that the house never holds them. She saw that when a vote is taken in the adjoining hall about the common treasury, each voice weighs as much as the bread that person had in their bundle at the moment when one particular notch on the wall was counted up — and that the treasury today has 1.5 billion units and is guarded by seven keepers, of whom five must agree. And she saw that the house is truly small.

*"And yet it already stands,"* she said.

*"And yet it already stands,"* said the carpenter.

---

## What it means

**The house of Lumi is the image of an identity that belongs to the person, not to the house.** The ZION Identity Service (ZIS) is the single entrance to the whole ZION world — web, OASIS, marketplace, voting — and its most important property is not what it can do, but what it **does not remember**.

1. **A door without a lock = signing in.** The user does not prove themselves with a password stored in someone else's database, but with a cryptographic signature of a key that stays with them. The house verifies the signature and needs nothing more. It has no "second key", and therefore neither it nor the one who holds the key can be robbed or abused.
2. **A bundle of twelve words = the wallet arises locally.** The mnemonic and the private key are generated on the user's device. No one in the project ever needs them and no one can restore them. A lost key is lost ZION — that is not a flaw of the design, it is its price.
3. **The hall of echoes = the House of Names.** A person is not a title. One enters the network as small as one wishes — without a judgement, without a citizenship, without revealing more than one must. The title "keeper of the gate" sounds beautiful; "just Lumi" is enough.
4. **A voice that weighs as much as you carry.** The DAO computes the weight of a vote from the L1 balance in the snapshot block; the identity of the voter is verified by ZIS. The community treasury (1.5 bn ZION from genesis slots 7 and 8) is held by a guardian multisig of 5 of 7.
5. **What the house cannot do yet — and says so honestly.** Nirvana in the fourth episode described a house with passkeys, biometrics and WebAuthn. The register of evidence is more precise: the code does exist in the ZIS source tree (`routes/webauthn.ts`, `lib/webauthn.ts`) but none of it is deployed — the live endpoints return 404 and the web login hides passkeys behind a flag. It is legitimate 3.3 work (workstream M1.5), not a feature of today. This book does not rewrite that backwards — it only remembers which light is which.

---

## Anchor of truth — verifiable facts

> The stability of the house does not rest on a story. It rests on a running service and on keys that never left their owners. Snapshot 2026-09-14.

| Claim / image | State | Anchor | What is still missing |
|---|---|---|---|
| The house stands: ZIS runs on `auth.zionterranova.com` (Fastify + Prisma, Ed25519/SIWE), `/health` returns 200 | **LIVE** | `StatusV3.md`; `AGENTS.md` 2026-08-22 (deploy `zion-zis.service`, port 8096); `apps/identity/` | security/privacy tests with every change of the auth flow |
| Sign-in via passkeys / WebAuthn / Face ID / Touch ID / Windows Hello / YubiKey | **HORIZON** | `MiseAmenti/07` §3 — the audit of `apps/identity/src` found no WebAuthn/FIDO/passkey implementation; `MiseAmenti/04` M1.5 | a standard implementation, device/recovery flow, E2E tests |
| The bundle is made at home: the wallet is generated locally (BIP39 / Ed25519); the key does not leave the device; UTXO v2 transactions are signed locally and sent via `submitUtxoTransaction` | **LIVE** | `apps/zion-wallet-sdk` (`src/core/transaction.ts`); `internal repository`; `AGENTS.md` 2026-08-22 | an E2E send/receive test without secrets with every release |
| A lost key = lost ZION; there is no password reset and no "support" that would need the key | **LIVE** (a property of the protocol) | `ZION_ONBOARDING_PUBLIC_CZ.md` §6 | — |
| A voice weighs as much as you carry: the DAO accepts `zion_session` (identity via ZIS `/api/auth/me`), vote weight from the L1 balance in the snapshot block; the treasury endpoint shows 1.5 bn ZION (genesis slots 7 + 8); guardian multisig 5 of 7; the first production proposal = ratification of the multisig | **LIVE** | `AGENTS.md` 2026-09-14; `GET /api/dao/treasury`; `internal repository` | a DAO UI for L5/L6 proposals; the payout tx flow |
| The chest by the house: a ZIS-backed deposit → ledger → withdraw for the user | **BUILDING** | `ZIS_WALLET_PLAN.md`; `internal repository` | funded E2E, reconciliation, custody disclosure |
| The house remembers only what it must: no selling of personal data, no KYC for entering the network | **LIVE** (a commitment) / **BUILDING** (a formal privacy threat model) | `MiseAmenti/01` §1 (Freedom); `04` M1.4 | privacy threat model, session/recovery review |
| The house of Lumi, the hall of echoes, the carpenter, the bundles in laps | **MYTH** | `nirvana/04` + this book | — |

---

*"A house that does not remember more than it must can have a door without a lock."*

**Navigation:** [← Chapter 1: The child at the bow](./01-Dite-na-Pridi.md) · [Chapter 3: Bridges and the market at the bridge →](./03-Mosty-a-Trziste-u-Mostu.md)
