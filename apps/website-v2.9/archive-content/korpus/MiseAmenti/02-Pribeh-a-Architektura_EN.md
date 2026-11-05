# 02 — Story and architecture
## From the four foundational books through the Salt of the Earth and onboarding to Nirvana, NirvanaCloud and Mise Amenti

> **Purpose:** to unify the language of the story with the language of architecture, without one posing as the other.  
> **Status:** an editorial map. All technical claims must pass through [`03-Zivy-Zaklad-3.3.md`](./03-Zivy-Zaklad-3.3.md) and [`07-Registr-Dukazu.md`](./07-Registr-Dukazu.md).

---

## 1. One path, eleven gates

ZION is not one book nor one application. It is a path that can be read from eleven interconnected gates. Each has a different role; none is sufficient on its own.

| Gate | Question | Contribution to the person | Technical counterpart |
|---|---|---|---|
| **Genesis** | *Why do we build at all?* | Seeks the basic rules that cannot be changed arbitrarily. | L1 consensus, emission rules, open source, genesis. |
| **Quantum Revolution** | *What is broken?* | Names the debt, centralisation, extraction of attention and unverifiable authority. | Diagnostics of risks; a demand for transparency, decentralisation and security. |
| **Ekam Deeksha** | *Who must be transformed?* | Reminds us that no protocol removes fear, pride and responsibility for a person. | Security limits, ethics, review, the Dharma Validator as an auxiliary filter — not as a moral authority. |
| **Terra Nova** | *How does the vision become a world?* | Translates values into concrete institutions, tools and communities. | Layers L1–L6, node/pool, L2, L3, OASIS, Free World, Issobella. |
| **The Salt of This Earth** | *How are the rules tasted in ordinary life?* | A story of trust, covenant, bridge, ark and responsibility. | The rule "Story → What it means → Verifiable facts". |
| **Onboarding** | *How do I enter safely?* | Gives a new person a procedure: first observe, ask, verify, and only then choose to take part. | Explorer, local wallet, node/miner, documentation and help in context. |
| **Nirvana and NirvanaCloud** | *Where are we heading when we do not build only for the next quarter?* | Presents the Terra Nova horizon, the bardo of change, Shambhala and Amenti as images of long responsibility. | The L1–L6 horizon and 2026–2126; never a release claim. |
| **Mise Amenti** | *How do we hold it all together across generations?* | Turns the story into measurable commitments of truth, freedom, care, resilience and handing on. | This corpus, the evidence register, release gates, security and the change protocol. |
| **Bodhi Gaia / the Book of the Earth** | *How does L5 touch the clay?* | Unifies the three physical L5 gardens (Genesis Garden, Dharma Temple / New Bodhi Gaia, Te Pīko Ora), the protocols of the Earth and the complete L5 truth register. | `canon/books/BodhiGaia/` (DRAFT); mirrors `public/V3/L5/docs/`, the web at `/terranova/*`, OASIS `WorldPanel`/`worlds.ts`. |
| **Lumi / the Way Home** | *How do all the gates become one path?* | Unifies Nirvana, the Book of the Earth and the Book of Heaven into the story of one child with a lantern who passes through L1–L6 and the century-long horizon; each chapter shows both the revealed future and the real today. | `canon/books/Lumi/` (DRAFT); builds on onboarding, `BodhiGaia/09`, `Issobella/10`, `07-Registr-Dukazu.md`. |
| **Miriam / the Book of the Rose** | *Who carries the story through time — and how is it recognised what is true in it?* | The horizontal axis of the corpus: witness, memory and the line from the lake to the garden; the "stone / clay / dream" mechanism teaches the reader to distinguish charter, tradition and myth — including naming proven forgeries. | `canon/books/Miriam/` (DRAFT); builds on `Lumi/`, `SulZeme/`, `07-Registr-Dukazu.md` §6 rule 6. |

**The Rose Story is not a twelfth gate.** The small book [`canon/books/Ruze/`](../Ruze/00-README.md) (*The Rose Story — What Cannot Be Owned*, DRAFT) is a garden at the intersection of two axes: the horizontal Miriam (memory, time) and the vertical Lumi (light, layers). It tells of the relationship of the child with the lantern and a rose by the river — care without owning, a boundary instead of rejection, and water that is not a commodity. It has no technological counterpart, adds no layer and no claim, and its whole plot is MYTH; that is why it has no row in the table of gates here. OASIS mirrors it explicitly as MYTH (Rose lore in the world `GENESIS_GARDEN` — the existence of the source line is a repository fact, the new client metadata is BUILDING until deployed) and the proposal for the physical pilot `GENESIS-ROSE-001` is HORIZON / NOT STARTED — neither of these creates a technological counterpart nor a new gate.

---

## 2. Four books as a compass, not as dogma

[`Road to Zion`](../marketing/ROAD_TO_ZION_CZ.md) uses four cardinal directions. `MiseAmenti/` does not rewrite them — it only introduces them as a standard for decision-making:

```text
                               NORTH
                              GENESIS
                     Why do we build? What is unchangeable?
                                   │
                                   │
   WEST ───────────────────────────┼────────────────────────── EAST
TERRA NOVA / NIRVANA               │              QUANTUM REVOLUTION
How do we build the world?         │              What no longer works?
                                   │
                                   │
                                SOUTH
                            EKAM DEEKSHA
              Who becomes a builder and how do they carry responsibility?

                     CENTRE: THE SALT OF THIS EARTH
        Truth must have a taste in a concrete life, not only in theory.
```

### The compass test for every decision

Every 3.3 proposal — a new agent, smart contract, economic change, game quest, marketing campaign or research programme — must ask before adoption:

1. **Genesis:** Is the rule transparent, limited and independently verifiable?
2. **Quantum Revolution:** Does this solution reduce centralisation, debt dependency, misuse of data or manipulation of attention — or does it merely dress them up differently?
3. **Ekam Deeksha:** What human failure, misuse or error do we assume? How is it limited without idealising either people or AI?
4. **Terra Nova:** Does it bring a concrete benefit for a person, community, planet or science? Who bears the costs and how can they leave?
5. **Salt:** Can we explain it to an ordinary person without pressure and without hiding risks?

If a proposal fails any of the questions, it is not ready for promotion or for production deployment.

---

## 3. Onboarding: the transition from story to one's own verification

The basic onboarding is not a funnel meant to keep a person as long as possible. It is **Hanuman's bridge**: simple enough for a newcomer to cross; honest enough that they do not lose their bearings on it.

The canonical path from [`ZION — the New Civilisation`](../SulZeme/08-ZION-Nova-Civilizace.md) is preserved:

| Path | The first safe step | What must not be required |
|---|---|---|
| **Observer** | Read, look around the explorer, compare public claims with the code. | Buying, registration, handing over identity or belief. |
| **Player / explorer** | A story, a quest, a translation, a bug report, a small contribution. | Financial risk or psychological pressure. |
| **Builder** | A node, a miner, a test, documentation, a review or a dApp. | The idea that one's own technical contribution gives the right to rule others. |
| **Guardian / operator** | Security review, monitoring, backups, incident response. | Access to secrets or production permissions without necessity. |

**No path is higher than another.** A network that despises the observer stops being verifiable. A network without builders falls apart. A network without guardians cannot defend itself. A network without players and learning people loses the reason to exist.

---

## 4. Nirvana and NirvanaCloud: what exactly they are to do

### Nirvana — the western horizon

[`canon/books/nirvana/`](../../books/nirvana/kapitoly/00-README.md) is the book of the journey from Lumi's ray through Ararat and the house all the way to the global horizon. Its task is to answer the question: **"What does a world look like that is worth building for the long term?"**

### NirvanaCloud — the deep map of states

[`canon/books/NirvanaCloud/`](../NirvanaCloud/00-README.md) adds the Bhavachakra, the five Wisdom Buddhas, the Bardo Thödol, Shambhala and the Halls of Amenti as **maps of states and transitions**, not as doctrine nor historical authority.

The following is the canonical distinction:

| Image | Correct use | Forbidden use |
|---|---|---|
| **Bhavachakra / six worlds** | A metaphor for the systemic states of pride, envy, scarcity, impulsiveness, violence and human possibility. | Labelling people, nations or opponents as "lower beings". |
| **Bardo** | A map for safely handling changes, incidents, hard forks and restarts. | Romanticising data loss, accidents or human suffering. |
| **Shambhala** | A symbol of a voluntary, non-violent society with responsible stewardship of shared matters. | Apocalyptic prophecy, a leadership cult or the legitimation of conflict. |
| **Five Wisdom Buddhas** | Structural inspiration for transforming problems into responsible limits and functions. | Claiming that the layers of ZION are Buddhist objects or that they replace practice. |
| **Halls of Amenti** | The myth of an indestructible archive, of memory and of knowledge handed on. | Presenting the Emerald Tablets as Egyptological evidence or as a technological manual. |

---

## 5. Map of the layers L1–L6

A story is not architecture, but a good story can make architecture accessible. This is the binding, sober mapping:

| Layer | What its civilisational task is | Which image explains it | What the story must not promise |
|---|---|---|---|
| **L1** | A safe and verifiable foundation of ownership, consensus and memory. | Ararat, rock, the hull of the ark. | That the blockchain alone will create justice. |
| **L2** | Interoperability and the safe movement of value between networks. | Hanuman's bridge, WARP. | That all chains or swaps are already live. |
| **L3** | Help with orientation, computation and orchestration under human supervision. | Hiranyagarbha, Maestro, the voice of Amitābha. | That AI is conscious, infallible or independently authorised to handle money. |
| **L4** | A creative space for education, play, community and culture. | OASIS, the garden, the temple. | That UE 5.7/WebGPU/Pixel Streaming are already available. |
| **L5** | Transparent humanitarian and ecological programmes. | Springs of life, salt in bread. | That specific projects have impact without public evidence. |
| **L6** | Open research, the long horizon, the cosmic view and exploration. | Issobella, the stars, the open horizon. | That hypothetical physics is finished technology or a guaranteed discovery. |

---

## 6. The end of the story is not "victory"

Mise Amenti does not consider itself complete once ZION has the highest price, the most users or the greatest influence. That would only be another world of devas or asuras from the Bhavachakra.

It can be spoken of as gradually fulfilled when:

- a person can verify an important claim without dependence on an authority;
- new generations have the tools, the knowledge and the right to repair or leave the system;
- human and technical infrastructure contributes to measurable good and does not conceal its harm;
- the growth of the network does not worsen the freedom, safety or dignity of people outside the network;
- criticism is welcomed as a security signal, not punished as an enemy.

That is the ending of a story that is never the property of one person: **not a paradise finished from outside, but the ability of people to keep repairing the world from within, together.**

---

*[Back to the Mise Amenti index → `README.md`](./README.md)*
