# BODHI GAIA — Chapter 6: The Protocols of the Earth
## The shared code of five gardens — Guardian Node, seed library, Medical Table, mesh, sociocracy, the vow of care, and the path from a fund to documented impact

> *"A community without a protocol is a mood. A protocol without a community is paper. The Earth needs both — and on top of that someone who carries water."*

---

## The Story

When the pilgrims returned from Raiatea, everyone who had ever worked in one of the five gardens met in the house of Lumi: Ana from the sea, Sadhu from the mountains, Hina of the water, the carpenter, Hanuman — and, to everyone's surprise, Sita, who appeared by the fire as though she had never left. Later, when the garden was extended by a circle in Bohemia and a tree in Lanka, those who carried air and ether came too.

*"We have five places,"* said Ana. *"Each different. In the Garden we do things our way, in the temple their way, in the lagoon their way, in the circle in Bohemia their way, under the tree in Lanka their way. That is right. But when a person from the temple comes to us, they do not understand our circles. When someone leaves us for the water, they do not know how things are decided there. And when a keeper from the mountains wants help with seeds, we do not know how to exchange them so that they do not rot on the way."*

Sita looked into the fire. *"How many things must be the same for five gardens to be one garden?"*

They were silent for a long time. Then the carpenter took charcoal and began to write on the oak table — not rules, but **questions**:

*"Who watches the night? Where are the seeds? Who treats a wound? How do we agree when the telephone does not work? How do we decide? Whom do we let inside? And how do we know that what we are doing truly helps — and not only that it seems so to us?"*

Seven questions. Seven answers that had to hold the same way in all five gardens, even though everything else could be different.

Hanuman, who had been silent all along, rose and brought his two buckets. He set them on the table beside the seven questions.

*"And one more thing,"* he said. *"I have carried water from the well to the seedlings for years. No one ever asked me whether that water actually arrived. Everyone sees that I walk. No one sees whether the soil at the root grew damp. I want that to be different. I want every bucket to have three witnesses: one at the well, one on the way, and one at the root. Whoever says 'I helped the earth' without those three is speaking about themselves, not about the earth."*

Sita nodded. *"That is the eighth question. The most important one. How do we know that help happened."*

That evening the **code of the communities** came into being — seven protocols shared by every garden of the New Earth, and an eighth that watches over all seven: **no impact without evidence**.

The carpenter carved it into the beam as seven teeth of a comb and one bucket beneath them.

---

## What it means

**Every L5 community implements the same basic protocols so that the network is interoperable — a person, a seed, a message and a decision must all be able to pass from one node to another.** And above them all stands rule M5 from the Execution Charter: *from fund to documented impact*.

### The seven shared protocols

| # | Protocol | Purpose | Link to L1/L2 | State |
|---|---|---|---|---|
| 1 | **ZION Guardian Node** | Validates blocks, earns rewards, funds the community treasury | Split **90 % operator / 10 % treasury**; low-power hardware (15–25 W) within the solar budget | **HORIZON** — no L5 node runs today; installation Phase 2 (2027–2028) |
| 2 | **Seed Library** | Exchange of local varieties between nodes; resilience against monopolies | Off-chain logistics, on-chain provenance (future) | **BUILDING** in Genesis (a catalogue), **HORIZON** elsewhere |
| 3 | **Medical Table** | Holistic health protocols, herbal medicine, first aid | Off-chain practice, on-chain reputation of practitioners | **HORIZON** — the `TECH/medical-table.md` specification; "Hiran-integrated diagnostics" is HORIZON / HYPOTHESIS |
| 4 | **LoRa / Meshtastic mesh** | Off-grid communication within the community and between nodes; emergency broadcasting | No dependence on the blockchain; relay of node telemetry | **HORIZON** — `TECH/mesh-network.md`; EU868, T-Beam, solar repeaters |
| 5 | **Sociocratic DAO** | Off-chain circles + on-chain treasury | L2 DAO proposals for capital allocation; thresholds according to the size of the expenditure | **BUILDING** (framework) / **HORIZON** (practice) |
| 6 | **Consciousness Admission** | Entry according to age (free < 18), dharmic principles, the bodhisattva vow for keepers | Off-chain verification, on-chain register (a soulbound token — the future) | **HORIZON** — `GOVERNANCE/consciousness-admission-framework.md` |
| 7 | **Resonance Protocol** | Sonic attunement before governance, Fibonacci time capsules, a bridge between youth and elders, a register of luminous language | L2 DAO "seal", frequency signatures, HRV proof | **MYTH / HORIZON** — ceremonial; technical hooks post-3.2 |

### The eighth protocol: no impact without evidence (M5)

Hanuman's three buckets have an exact name in the Execution Charter — an **impact packet**. Every project financed from the L5 fund must have at least:

```text
IMPACT PACKET
├── Recipient       — identification, legal form, consent to publication
├── Scope           — what exactly will be done (a well, 100 palms, 5 kWp), where and for whom
├── Budget          — ZION / EUR, milestones, who holds the keys
├── On-chain ref.   — DAO proposal, vote, timelock, payout transaction
├── Output evidence — data with provenance (sensor, invoice, photo with consent and metadata)
├── Limitations     — what failed, what we do not know
└── Independent verification — who checked it and when, with what result
```

Three witnesses: **at the well** (on-chain: fund → proposal → payout), **on the way** (the recipient: budget, milestones), **at the root** (an independent verifier: the outcome). Without all three you must not say "verified impact".

### The path of value: from a block to a garden bed

```text
L1 block (~60 s)
  └─ coinbase output 1: 5 % → zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8   [LIVE]
        │
        ▼
zion-free-world (Edge, internal port)                                      [LIVE]
  ├─ scans blocks, updates fund_balance
  ├─ records grants / projects / communities (SQLite)
  └─ GET /api/v1/fund/balance, /api/v1/grants, /api/v1/projects, /metrics
        │
        ▼
Grant / project → POST /api/v1/grants → approve → submit-to-dao             [BUILDING]
        │
        ▼
L2 DAO (internal port): proposal → vote → timelock → guardian multisig     [BUILDING]
        │
        ▼
Payout transaction from the fund                                           [HORIZON]
  — DAO execution today neither builds nor broadcasts a transaction (summary-only)
  — a DAO UI/UX for L5 proposals is missing
        │
        ▼
Community treasury (3-of-5 multisig) → project → impact packet             [HORIZON]
```

For release 3.2.0, decision **G10** applies: L5 runs as a *passive tracker + DAO proposal bridge*. No L5 service signs or sends an L1 transaction; the fund grows and all withdrawals are governance-gated. That is safe (a faulty service cannot drain the fund) and at the same time honest (no one claims that money is being distributed).

### The community treasury — where a node's money flows

```text
Guardian Node (local L5)
    ├── 90 % → operator (hardware, electricity, connectivity)
    └── 10 % → community treasury

Community treasury (DAO-governed)
    ├── 40 % → operations (food, energy, maintenance)
    ├── 25 % → infrastructure (buildings, tools, expansion)
    ├── 20 % → reserve (security, emergencies)
    ├── 10 % → humanitarian tithe (forwarded to the L5 global fund)
    └── 5 %  → education / knowledge commons
```

Te Pīko Ora commits to 15 % of total surplus (see [ch. 5](./05-Te-Piko-Ora.md)).

### The specific protocols of the new nodes

The original three trees grew into a pentagram of five nodes — the Heart (Bohemia) and Akasha (Lanka) were added. Each brings its own protocol on top of the shared code:

- **Golden Republic Bohemia (Air / Heart)** — the **Golden Republic protocol**: a governance lab and a circle of decision where Czech wisdom (salt, bridge, the Golden Bull, Přemysl the Ploughman, Libuše, Charles IV) meets the experiment of a sociocratic DAO. The Golden Republic tests how decisions are made when no one is above another — the circle as a protocol, not as decoration.
- **Bodhi Lanka (Akasha / Ether)** — the **Bhakti protocol** and the **Ayurveda Medical Table**: love (Rama-Sita) as a bridge, Sri Maha Bodhi (the oldest living tree, 288 BCE) as the archetype of the root, the Rama Setu bridge as the memory of connection. The Bhakti protocol adds an eighth dimension to the seven shared protocols — care as love, not as duty. The Ayurveda Medical Table extends `TECH/medical-table.md` with a continuity of care thousands of years old.

### Entering the community: four gates and a vow of care

`consciousness-admission-framework.md` describes entry not as KYC but as **four gates**: a written mirror (who I am, why I am coming), a living circle (a meeting with the community), a trial stay, the consent of the circle. Children under 18 enter free. Keepers take the **bodhisattva vow** (to protect all beings before themselves) — and in the map of the Zohar the vow of care: *"I vow to care for this land as I would care for my own body."*

> **Boundary (from Execution Charter M5 and 05-Autonomy):** quadratic voting is not merely a UI element — before deployment it needs Sybil resistance, eligibility rules, a privacy analysis and an attack simulation. No vow, ceremony or "consciousness level" may be used to discriminate, to coerce, or to mark a person as lesser.

### Phases of network development (common to all nodes)

| Phase | Name | Goal |
|---|---|---|
| 0 | Seed | Legal basis, first keepers, access to land |
| 1 | Roots | Energy, water, food, shelter |
| 2 | Community | Permanent residents, governance, a ZION node |
| 3 | Network | Connection of nodes, shared protocols — **here the code of the communities is first tested in practice** |
| 4 | Radiance | Retreats, education, international guests, replication |

---

## Anchor of truth — verifiable facts

> The seven teeth of the comb in the beam are today seven specifications. The bucket beneath them is one running service and one decision.

| Element of the story | State | What is verifiable | What is still missing |
|---|---|---|---|
| **Water from the well (the 5 % stream)** | **LIVE** | Coinbase output 1 in every block; the canonical address in the `internal repository`. | — |
| **The witness at the well (the tracker)** | **LIVE** | `zion-*-service` (internal service) active; `GET /health`, `/metrics`, `/api/v1/fund/balance`, `/api/v1/grants`, `/api/v1/projects`; SQLite tables `grants`, `projects`, `communities`, `fund_balance` (`internal repository`); env `FREE_WORLD_*` in the internal configuration. | The API key is loaded but **not enforced** (acceptable only thanks to the bind to `127.0.0.1`); a public portal with a live chart. |
| **The bridge to the DAO (submit-to-dao)** | **BUILDING** | `POST /api/v1/grants/:id/submit-to-dao` → `dao_client.rs` at `ZION_DAO_API_ADDR` (internal port), header `X-DAO-Key`. | A verified E2E: grant → DAO proposal → vote on Edge. |
| **A payout from the fund** | **HORIZON** | Decision G10: no automatic payout; the `internal repository` execution is summary-only. | A DAO UI/UX (J4/J6 in `docs/3.2/ROADMAP.md`), building and broadcasting a payout transaction, the guardian multisig flow. |
| **Guardian Node 90/10** | **HORIZON** | The specification `public/V3/L5/docs/TECH/zion-node-spec.md`; the values on the web and in the community documents. | No L5 node runs; the 90/10 split is not enforced by the protocol — it is a community rule. |
| **Seeds that do not rot on the way** | **BUILDING / HORIZON** | Seed Library as a protocol in the L5 `README.md`; Genesis: a catalogue; the first exchange with Dharma Temple planned 2028. | On-chain provenance of varieties is the future. |
| **Who treats a wound** | **HORIZON** | `TECH/medical-table.md`; the phases of the pavilions in the community documents. | Practitioners, a space; "Hiran diagnostics" = HYPOTHESIS. |
| **When the telephone does not work** | **HORIZON** | `TECH/mesh-network.md`; the volcanic protocol of Dharma Temple §13.2. | No mesh node deployed. |
| **How we decide** | **BUILDING** (framework) | `GOVERNANCE/community-dao-framework.md`, `multi-layer-dao-governance.md` (Co-Admin, timelock 48 h / 7 d / 30 d, cross-layer veto). | No on-chain L5 proposal so far; the DAO UI is missing. |
| **Whom we let inside** | **HORIZON** | `GOVERNANCE/consciousness-admission-framework.md` (4 gates, < 18 free, the bodhisattva vow), `sefirot-vow.md`. | A soulbound register = the future; Sybil / privacy analysis for quadratic voting. |
| **Sound before a decision** | **MYTH / HORIZON** | `PROTOCOLS/resonance-protocol.md`. | Marked in `L5_L6_ACTIVATION_PLAN.md` as ceremonial / visionary; technical hooks post-3.2. |
| **Three witnesses of every bucket** | **BUILDING** (framework) | The M5 impact packet in `MiseAmenti/04-Exekucni-Charta-3.3.md`; the M5 exit gate = one pilot through the whole cycle. | No impact packet has yet arisen; the first pilot is not chosen. |
| **Seven questions on an oak table** | **MYTH** | A frame created for this book over the seven protocols from `public/V3/L5/docs/README.md`. | — |
| **The Golden Republic (Bohemia)** | **HORIZON** | The governance-lab protocol — a circle of decision, Czech wisdom (salt, bridge, the Golden Bull, Přemysl the Ploughman, Libuše, Charles IV); web `/terranova/golden-republic-bohemia`. | A community document, legal entity, land, founding circle. |
| **The Bhakti protocol + Ayurveda (Lanka)** | **HORIZON** | The Bhakti protocol (care as love), the Ayurveda Medical Table extending `TECH/medical-table.md`; Sri Maha Bodhi (288 BCE), the Rama Setu bridge; web `/terranova/bodhi-lanka`. | A community document, legal entity, a partner in Sri Lanka, team. |

---

*→ Continues: [Chapter 7 — The Garden in OASIS and on the web (the L4 ↔ L5 mirror)](./07-Zahrada-v-Oasis-a-na-Webu.md)*

---

*[Back to the index of the Book of the Earth → `00-README.md`](./00-README.md)*
