# 08 — The change protocol
## How Mise Amenti evolves without losing memory, without a cult of authority and without rewriting reality

> **Normative status:** a binding procedure for changes to this corpus and for all future claims about ZION 3.3 "Nirvana".  
> **First rule:** the canon is not a stone that must not be repaired. It is a living map that must repair a mistake before it covers it up.

---

## 1. Document life cycle

```text
IDEA
  ↓
DRAFT (clearly marked, with no claim to truth)
  ↓
REVIEW (technical + security + facts + possibly culture/law)
  ↓
CANON (added to the index, the evidence register and the changelog)
  ↓
PUBLIC ADAPTATION (only a safe, shortened and checked excerpt)
  ↓
REVISION / ARCHIVE (keep the history, repair the active text)
```

No document jumps from an idea straight to a public "fact". If it contains one or more unverified parts, it obligatorily uses the label `BUILDING`, `HORIZON`, `HYPOTHESIS` or `MYTH`.

---

## 2. Change classes and minimum review

| Class | Example | Review needed | Changelog |
|---|---|---|---|
| **A — Editorial** | Fixing grammar, a broken link, a clarification without a change of meaning. | One editor; link check. | In summary for a larger batch. |
| **B — State** | "The feature is live", a new version, a completed gate, an evidence update. | A technical reviewer + a link to the evidence. | Obligatory: date, source, evidence. |
| **C — Security / financial / privacy** | Custody, wallet, agent capability, auth, fund/DAO workflow. | A security reviewer + a technical reviewer + the owner of the responsibility. | Obligatory: threat model, rollback/revocation, limits. |
| **D — Consensus / governance** | Emission, hard fork, coinbase split, node reward activation, DAO authority. | A formal governance process, testnet/staging evidence, a security review, a migration and rollback plan. | Obligatory: a full decision record and a compatibility matrix. |
| **E — Cultural / public communication** | Use of a religious tradition, a historical figure, a health/educational claim, a translation into public text. | A factual/legal editor + a cultural consultant according to the subject + a public-copy review. | Obligatory if it changes meaning or risk. |

In doubt, a change is placed in a higher class. Speed is not a reason to lower the review threshold.

---

## 3. The mandatory format of a change proposal

Every non-trivial proposal adds the following at the beginning or in the pull request/issue:

```markdown
## Intent
What is to change and whom does it serve?

## State of the claim
LIVE / BUILDING / HORIZON / HYPOTHESIS / MYTH

## Evidence
A link to code, a test, a commit, on-chain data, an audit or an external source.

## Risks
Security, finances, privacy, culture, legal/communication risk.

## Boundaries
What this change explicitly does not claim and what it cannot do.

## Review
Who must check the proposal and why?

## Rollback / correction
How is the change reverted, or how is the error communicated?
```

This format also serves an AI agent: the model may fill in the proposal, but **it cannot decide by itself that the review is sufficient**.

---

## 4. Resolving contradictions and historical memory

When a contradiction appears between the story and the code, the procedure is this:

1. **Report the contradiction without defending the project's identity.** "The text is imprecise" is not an attack on the mission.
2. **Verify the source of truth** according to the table in [`README.md`](./README.md).
3. **Repair the active text** and lower the state of the claim if the evidence for it has disappeared.
4. **Do not smooth over the history.** The changelog preserves what was written, when, and why it changed.
5. **If it was a public or financially significant claim**, issue a visible correction, not only a silent commit.

Historical documents are not deleted merely because they contain outdated information. They are marked as historical and the active canon builds on them with an explanation. Losing history repeats precisely the mistake that the Ark of records is meant to prevent.

---

## 5. Rules for public release

`MiseAmenti/` is an internal root corpus. Any of its content intended for `public/`, the web, a whitepaper, social media or press material must pass through a separate public filter:

1. **No secrets:** no seed phrase, private keys, API tokens, internal hostnames, non-public IP addresses, service paths or operational data.
2. **No exaggeration of state:** HORIZON/HYPOTHESIS is not shortened so that they look LIVE.
3. **No financial manipulation:** no price predictions, guaranteed returns, time pressure, FOMO or "last chance".
4. **No spiritual manipulation:** no call to belief, no false lineage, no use of Buddhist or other symbols as a currency of authority.
5. **No appropriation of the rights of others:** history, image material, trademarks and quotations have a clear origin and permission.
6. **Legal and cultural legibility:** risks, the custody model, limitations and sources are visible to an ordinary reader.
7. **Translation review:** English or another language must not strengthen a certainty, emotion or financial significance against the approved original.

The `AGENTS.md` rules for the `public/` subtree take precedence over this document.

---

## 6. The regular revalidation cycle

| Trigger | What must be checked |
|---|---|
| A new release / hard fork | Version, feature matrix, migration guide, compatibility, known limitations. |
| An incident or downtime | `StatusV3.md`, security disclosure, narrative claims, the runbook and the changelog. |
| A change to L2/ZIS/an agent capability | Custody, consent, privacy, API scope, rate limits, rollback and public wording. |
| A new L5/L6 project | Impact packet, budget, governance record, recipient consent, independent verification. |
| A new physics/DeSci hypothesis | Literature review, falsifiability, method/data policy, a clear hypothesis label. |
| Every 3 months | Broken links, live-state drift, translations, stale dates, unfulfilled gates. |

---

## 7. Handing the canon on to the next generation

Every maintainer has the responsibility to make their contribution legible to the person who comes after them and knows no internal context:

- why the decision was adopted;
- what evidence existed at the time;
- which alternatives were rejected;
- what we still do not know;
- how the decision can be safely reversed;
- who has the right to propose, verify and refuse the change.

That is the technical form of the bodhisattva vow: **not to appropriate the future, but to hand it the tools for a better decision.**

---

## 8. A measure of humility

The canon is strong when it can write:

- "We do not know."
- "This is a hypothesis."
- "This test has not been completed yet."
- "Here we made a mistake."
- "The next generation may change this decision."

Without these sentences, Mise Amenti would turn into Babylon with a luminous name. With them, it can remain an ark that carries more than one generation.

---

*[Back to the Mise Amenti index → `README.md`](./README.md)*
