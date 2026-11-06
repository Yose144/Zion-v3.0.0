# BODHI GAIA — Chapter 7: The Garden in OASIS and on the web
## The L4 ↔ L5 mirror — how five physical gardens are reflected in OASIS, on the web and in the avatars, and where the mirror ends

> *"A virtual world must not be an escape from reality, but an architectural model and a sacred laboratory for the re-creation of the physical world."* — Nirvana, episode 9

---

## The Story

The fisherman from episode 9 of the book Nirvana — who, on a little wooden boat, took a lens out of his pocket and within three seconds entered OASIS — one day sailed all the way to the bay below the house of Lumi.

In OASIS he knew the New Earth well. He went there every evening. He knew the Ancient Tree in the Garden of Hiranyagarbha with its nine storeys of consciousness, he knew the eight Genesis territories, he hunted for traces of the Golden Egg. And for some time he had been seeing a new point on the map of the galaxy: **Dharma Temple — La Palma**, seven domes and the Tree of Life, with the seventh trace of the Golden Egg hidden somewhere in its gardens. And on the "New Earth" panel: the Genesis Garden — *active*, Dharma Temple — *preparation*, Te Pīko Ora — *planned*. And later two more appeared: Golden Republic Bohemia — *preparation*, Bodhi Lanka — *planned*.

When he stepped ashore, he expected to see what he knew from the lens: domes of white marble, avatars of pure light, waterfalls with perfect flow.

He saw a canvas tent, a barrel of water and a woman with calluses on her palms, weeding a bed.

*"This is the Genesis Garden?"* he asked, incredulous.

*"This is the Genesis Garden,"* said Ana without raising her head. *"The other one — the one in the lens — is a mirror. A good mirror. It shows where we are going. But whoever settles into the mirror stops walking."*

The fisherman sat down on the circle of stones. *"In OASIS I have an avatar, Sita — Mother Earth. I get points for caring for the soil in the Garden of Hiranyagarbha. I thought…"*

*"…that points from the mirror can be exchanged for clay?"* Ana smiled for the first time. *"No. But it can be done the other way round. Whoever lasts a week here with a hoe will afterwards recognise themselves in the mirror. And one day — when this tent and this barrel are in the mirror too — it may hold that a quest in OASIS tells you: 'Go to the Garden. Go to the temple for seven days of silence. Bring a seed.' The mirror will point at the door, not replace it."*

*"And who watches that the mirror does not lie? That there is no well in it that does not actually stand?"*

Ana pointed to the beam above the door of the house of Lumi, where the carpenter had carved a seed, three strokes, seven teeth and a bucket. *"This beam. Every thing in the mirror must have its tooth on the beam. When it does not, it is only an image — and it must say so about itself."*

The fisherman went back to the boat, took out the lens and looked for a long time at the seven domes that stood in OASIS on the slope of La Palma. They were beautiful. And he already knew they did not stand.

He left the lens in his pocket and went to fetch a hoe.

---

## What it means

**L4 OASIS and the web `app.zionterranova.com` are a mirror of L5 — the place where five physical gardens are first shown to people who have never been in the Nabão valley, on La Palma, on Raiatea, in Bohemia or in Sri Lanka.** The mirror has three legitimate functions and one forbidden one:

| Function of the mirror | Properly | Forbidden |
|---|---|---|
| **To show the direction** | Cards, map, 3D concept of the temple, the story | Passing off a concept as a building |
| **To invite** | A link to the project sheet, Discord, contact | Selling land, shares, "sacred skins" |
| **To teach** | The temple museums, the Rapa Nui lessons, wayfinding as consensus | Gamifying spiritual authority, pay-to-win |
| **To reward real care** (horizon) | A quest that sends you into the physical world and is verified by an impact packet | Rewarding unverified or harmful performance |

### What is in the mirror today

**Web — Terra Nova (`/terranova`)**
- The TerraNova book with chapters and editions (`TerraNovaBookClient`, `public/terranova-editions.json`).
- **Pioneer Projects L5** — cards (`PioneerProjectCards.tsx`): Genesis Garden (*Active development*, EU), Dharma Temple (*In preparation*, ES, UNESCO), Te Pīko Ora (*Planned*, PF), Golden Republic Bohemia (*In preparation*, CZ), Bodhi Lanka (*Planned*, LK).
- `/terranova/genesis` — the character of the place, phases 0–4 (0 complete, 1 active), features (glamping, farm, trees, surf, solar, gatherings), ZION integration (node *planned*, wallet *tbd*, Medical Table *planned*, mesh *planned*, Seed Library *active*, Proof-of-Care DAO *planned*), the humanitarian commitment of 10 % of node rewards.
- `/terranova/dharma-temple` — La Palma, concept, features, phases (0 active), **3D concept** (7 domes, Tree of Life, Merkaba), **architectural design**, **documentation** loaded from `apps/website-v2.9/public/docs/terranova/dharma-temple.{cs,en}.md`, open questions, Discord.
- `/terranova/te-piko-ora` — Polynesia, Raiatea, features (wayfinding school, marine permaculture, cultural restoration, solar, humanitarian fund, heritage protection *vision*), **the Rapa Nui lessons**, phases 0–3 (0 active), integration (node *planned*, DAO *planned*, fund *planned*, heritage ledger *tbd*, wayfinding NFT *tbd*, marine seed library *tbd*).
- `/terranova/golden-republic-bohemia` — Bohemia, governance lab, features (a circle of decision, Czech wisdom — salt, bridge, the Golden Bull, Přemysl the Ploughman, Libuše, Charles IV), the Golden Republic protocol, phase 0 (preparation), integration (node *planned*, DAO *planned*, governance lab *planned*).
- `/terranova/bodhi-lanka` — Sri Lanka, features (the Bhakti protocol, the Ayurveda Medical Table, Sri Maha Bodhi — the oldest living tree, 288 BCE, the Rama Setu bridge), phase 0 (planned 2027–2028), integration (node *planned*, DAO *planned*, Bhakti protocol *planned*, Ayurveda Medical Table *planned*).

**Web — L5 Free World (`/l5-free-world`)**
- An explanation of L5 as a physical layer, the canonical fund address, 5 % of every block, the shared protocols, the communities.

**OASIS Web (`oasis.zionterranova.com`)**
- The **"New Earth"** panel (`WorldPanel.tsx`, `NOVA_ZEME_PROJECTS`) — L5 projects with colour, status and a link to the web.
- The world **`DHARMA_TEMPLE_LA_PALMA`** in the galaxy (`worlds.ts`): "Sacred L5 sanctuary on La Palma — a geodesic temple of enlightenment, education and community", `goldenEggClue: 7`, position `(-16.2, 0.2, 31.8)`.
- The world **`GOLDEN_REPUBLIC_BOHEMIA`** in the galaxy (`worlds.ts`): governance lab, a circle of decision, Czech wisdom — a bridge between tradition and experiment.
- The world **`BODHI_LANKA`** in the galaxy (`worlds.ts`): the Bhakti protocol, Sri Maha Bodhi, the Rama Setu bridge — love as the root, the oldest living tree.
- The world **`GENESIS_GARDEN`** in the galaxy (`worlds.ts`, layer 5): a story-world mirroring the Genesis Garden project in Sabacheira near Tomar — its metadata carries **Rose lore** (Lumi planting the Rose from *The Story of the Rose*), expressly labelled as literary **MYTH** (tags `rose`, `lore`, `myth`), not as evidence of a plant or of infrastructure on site.
- The planet **SAMANTABHADRA** (layer 5, "the Infinite Garden", the ten great vows) — the Buddhist archetype of all-embracing practice.

**OASIS backend (`internal repository`)**
- `avatars.json`: bodhisattva vows (Samantabhadra, Avalokiteśvara, Mañjuśrī, "Issobela's Oath"), a *Bodhicitta Spark* after acts of kindness in micro-quests.
- The Humanitarian Tithe (7 categories) as part of the game architecture (`tithe.rs`).

**Salt of This Earth, episode 10 — the avatars heading for L5**
- **SITA — Mother Earth** (*Terra Architect / Alchemist*): care for soil and restoration; quests "connection with L5 Free World, landscape restoration projects, green mining".
- **THE GIVER / HANUMAN — Servant of Life** (*Steward / Humanitarian*): service without ego; quests "distribution of the Humanitarian Tithe (5 %), help for newcomers, building public works".

### Where the mirror ends

1. **The statuses in the mirror are hand-written.** `NOVA_ZEME_PROJECTS` in OASIS and the cards on the web are constants in code, not data from the L5 API. When reality changes, the mirror does not change by itself. The goal: read the state of the communities from the `free-world tracker` (`/api/v1/projects`, the `communities` table) — HORIZON.
2. **The seven domes in OASIS are a concept, not a building.** The world `DHARMA_TEMPLE_LA_PALMA` must remain marked as a concept/vision until the first dome stands on La Palma.
3. **The quests do not yet lead into the physical world.** The ideas of a "Silence Quest" (a reward for a 7-day retreat) and special rates for keepers are in the community documents as a marketing channel (§11/§15), not as an implemented mechanic. Any quest that rewards a real visit needs verification (an impact packet, consent, privacy) — otherwise it rewards a claim, not care.
4. **The avatars Sita and Hanuman have no "clay" today.** Points in OASIS are not exchanged for anything physical and must not be promised to be. The direction is the reverse: physical (documented) care may one day show up in the mirror.
5. **Web Preview / UE 5.7 / Pixel Streaming** from episode 9 of Nirvana are HORIZON (see `MiseAmenti/07`). Today's OASIS Web is a Next.js/Three.js client, not a photorealistic world.

### What the mirror should be able to do in 3.3 (M4 + M5)

| Step | What | Layer | State |
|---|---|---|---|
| 1 | A source of truth for the statuses of the communities: a `communities` table + `GET /api/v1/projects` → web and OASIS read from one place | L5 → L4 / web | HORIZON |
| 2 | A public L5 portal with a live fund balance, proposals, recipients, milestones, results (M5) | web | HORIZON (`freeworld.zionterranova.com` in plan N5) |
| 3 | Marking every L5 world in OASIS with a status badge (concept / building / live) directly in the UI | L4 | HORIZON |
| 4 | The quest "Go to the Garden" with verification through an impact packet and consent; no monetisation of ceremonies | L4 ↔ L5 | HORIZON (requires the M5 gate and a privacy review) |
| 5 | Verify the deploy of the Dharma Temple metadata (the source already has layer 5); the Genesis location everywhere → Sabacheira, Tomar | L4 / web | BUILDING |

---

## Anchor of truth — verifiable facts

> The mirror exists and is beautiful. This table says what in it is an image and what is a door.

| Element of the story | State | What is verifiable | What is still missing |
|---|---|---|---|
| **The cards on the "New Earth" panel** | **LIVE** (client) | `apps/OasisWeb/src/components/WorldPanel.tsx` — `NOVA_ZEME_PROJECTS` (genesis *Active*, dharma *Prep*, piko-ora *Planned*, bohemia *Prep*, lanka *Planned*) with links to `app.zionterranova.com/terranova/*`. | The statuses are not connected to the L5 API. |
| **The seven domes on the map of the galaxy** | **LIVE** (client) / **HORIZON** (construction) | `apps/OasisWeb/src/domain/config/worlds.ts` — `DHARMA_TEMPLE_LA_PALMA`, `goldenEggClue: 7`; `GOLDEN_REPUBLIC_BOHEMIA`, `BODHI_LANKA`. | The source already has `layer: 5`; what remains is verification of the public client deploy and an explicit "concept" label. |
| **Sita and Hanuman as avatars** | **LIVE** (document) / **HORIZON** (mechanic) | `canon/books/SulZeme/10-Prvni-Svet-Oasis-a-Best-of-Avatari.md` §II — roles and quests heading towards L5. | The implementation of the "connection with L5" quests in the `internal repository` (quests.rs) is not documented. |
| **Bodhisattva vows in OASIS** | **LIVE** (data) | `internal repository` — Samantabhadra, Avalokiteśvara, Mañjuśrī, *Bodhicitta Spark*. | The link to L5 Consciousness Admission = HORIZON. |
| **Pioneer Projects on the web** | **LIVE** | `apps/website-v2.9/src/app/terranova/components/PioneerProjectCards.tsx`; the pages `genesis`, `dharma-temple`, `te-piko-ora`, `golden-republic-bohemia`, `bodhi-lanka`. | Unifying the location of Te Pīko Ora (Tahiti vs Raiatea) and Genesis (historically Algarve / Central Europe → now Sabacheira, Tomar — resolved 2026-10-07). |
| **The 3D concept of the temple** | **LIVE** (web) / **HORIZON** (construction) | `DharmaTemplePreviewLazy` on `/terranova/dharma-temple`; the document `apps/website-v2.9/public/docs/terranova/dharma-temple.{cs,en}.md`. | The web lacks an explicit "concept — does not stand" label. |
| **The fisherman with the lens (instant preview)** | **HORIZON** | Nirvana ep. 9; `MiseAmenti/07` ranks WebGPU / Pixel Streaming / UE 5.7 as HORIZON. | A POC of the client, licence and performance analysis (M4). |
| **"A quest that sends you to the garden"** | **HORIZON** | The "Silence Quest" idea in `dharma-temple.md` §15 and "quest rewards for visits" in `genesis-garden.md` §11.2 as a marketing channel. | The mechanic, verification, privacy review, the M5 gate. |
| **The beam with teeth and a bucket** | **MYTH** | This book's image for the rule "every element of the mirror has an anchor of truth". | — |
| **Rose lore in the world `GENESIS_GARDEN`** | **LIVE** (the existence of the source line) / **BUILDING** (new client metadata; the build passed, the deploy did not) / **MYTH** (the content) | `apps/OasisWeb/src/domain/config/worlds.ts` — the vibe/summary of the world carry the Rose expressly as literary lore (MYTH), tags `rose`, `lore`, `myth`. | Deploy + verification of the public client; a physical rose in Sabacheira = UNSUBSTANTIATED; the pilot [`pilots/GENESIS-ROSE-001.md`](./pilots/GENESIS-ROSE-001.md) = HORIZON / NOT STARTED. |

---

*→ Continues: [Chapter 8 — The path of the pilgrim: onboarding into L5](./08-Cesta-Poutnika-Onboarding-L5.md)*

---

*[Back to the index of the Book of the Earth → `00-README.md`](./00-README.md)*
