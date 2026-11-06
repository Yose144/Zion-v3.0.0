# BODHI GAIA — Chapter 9: The anchor of truth and the boundary
## The complete L5 register — what is live, what is being built, what is a horizon and what is only an image; known discrepancies, open questions and next steps

> *"Do not demand faith where evidence can be offered. Do not sell a horizon as the present. When the vision collides with a fact, repair the vision — never the fact."* — The first vow of Mise Amenti

---

## 1. Why the Book of the Earth has the longest anchor

Soil knows no marketing. A tree either grows or it does not. A well either gives water or it does not. And because L5 is the layer where ZION first touches real people, real soil and real money belonging to others, **the strictest evidentiary bar of the whole series** applies here — stricter than for the L2 bridges, which at least have an on-chain receipt.

This chapter is a register. It does not rewrite [`MiseAmenti/07-Registr-Dukazu.md`](../MiseAmenti/07-Registr-Dukazu.md); it **extends** its section 5 (L4, L5, L6) with the detail the canonical register lacks for the sake of brevity. In a conflict the canonical register, `StatusV3.md` and the code prevail.

---

## 2. The complete L5 evidence table

### 2.1 Protocol and fund

| Claim | State | Evidence or source | What is still necessary |
|---|---|---|---|
| 5 % of the block subsidy goes to the L5 fund in every block. | **LIVE** | `internal repository`, `v3_template.rs` (`coinbase_humanitarian`, output 1); `getBlockByHeight` → `transactions[].outputs`. | — |
| The L5 fund address is canonical: `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`. | **LIVE** | `internal repository`; `docs/PREMINE_ADDRESSES_PUBLIC.txt`; `HARD_RESET_PLAYBOOK.md`; the CLI `zion node start --human`; dashboard; web `/l5-free-world`. | A change = class D (consensus). |
| The coinbase has 4 outputs (miner / L5 / L6 / node reward). | **LIVE (3) / BUILDING (the 4th)** | Outputs 0–2 always; output 3 only after `node_reward_activation_height` (default `u64::MAX`), otherwise 1 % burn. | The activation height and on-chain evidence. |
| The fund balance is publicly readable. | **LIVE** | Explorer `/explorer` (the fund address); `GET /api/v1/fund/balance` on the internal port (operator-only via nginx `/api/free-world/`). | A public portal with history and a chart (M5 / N5). |
| The fund pays out grants today. | **INVALID CLAIM** (today) | G10: no automatic payout; DAO execution is summary-only (`internal repository`). | A DAO UI, a payout tx flow, the guardian multisig, the first impact packet. |

### 2.2 The L5 service

| Claim | State | Evidence or source | What is still necessary |
|---|---|---|---|
| `free-world tracker` runs on Edge and scans the coinbase. | **LIVE** | `zion-*-service` (internal service) active; `internal repository`; `StatusV3.md` update 2026-08-23; L5 on the internal port. | Continuous health; an independent comparison of the scanner with the explorer. |
| The service records grants, projects, communities and the fund. | **LIVE** (schema) | `internal repository` — tables `grants`, `projects`, `communities`, `fund_balance`; tests `tests/db.rs`. | Populated data (no real community records are documented in the production DB today). |
| The `submit-to-dao` API hands grants to the DAO. | **BUILDING** | `dao_client.rs` → `ZION_DAO_API_ADDR` (internal port), `X-DAO-Key`. | An E2E on Edge: grant → proposal → vote. |
| The API is protected by a key. | **BUILDING** | `api_key` loaded into `AppState`, **not enforced** on the router. | Middleware (`X-API-Key` / Bearer) before any public exposure. |
| Hiran AI evaluates grants. | **HORIZON** | `hiran_bridge.rs` (`hiran_enabled = false` by default); there is no Hiran inference on Edge. | Hiran deployment according to `MiseAmenti/05` (A0–A2 first). |
| The CLI `zion free-world`. | **BUILDING** | `internal repository` — `start/status/stop` (systemd passthrough). | An overview of the fund / grants from the CLI. |

### 2.3 Communities

| Claim | State | Evidence or source | What is still necessary |
|---|---|---|---|
| The Genesis Garden exists as a physical place in active development. | **BUILDING** | `public/V3/L5/docs/COMMUNITIES/genesis-garden.md` (🟡 Active development; Phase 0 ✅, Phase 1 🟡); web `/terranova/genesis`; OASIS panel *Active*. | Land (purchase/lease), a registered entity, GPS, evidence of realisation (solar, borehole, tents), independent verification. |
| The Genesis Garden has a team of keepers. | **BUILDING** | Phase 0: "core team formation (3 Guardians)" ✅. | A public (privacy-respecting) identification of the coordinator; roles per §6.3. |
| The Genesis Garden accepts guests. | **BUILDING** | Plan: first paying guests Q3 2026; channels and price list §11. | Confirmed bookings, insurance, exchange rules. |
| A physical rose was planted in the Genesis Garden. | **UNSUBSTANTIATED** | No Day 0 packet or other evidence of planting exists; the scene in the epilogue of *The Story of the Rose* is MYTH. | Fulfilment of Gates A–D of the proposal [`pilots/GENESIS-ROSE-001.md`](./pilots/GENESIS-ROSE-001.md) (**HORIZON / NOT STARTED**) + a complete Day 0 packet. |
| Dharma Temple is a sanctuary in preparation on La Palma. | **BUILDING (documentation) / HORIZON (physically)** | `dharma-temple.md` (🔵 Preparation; Phase 0 2026 Q2–Q4 🔵); web `/terranova/dharma-temple` (3D concept, ground plan, documentation). | Land, entity, 5 founding keepers, Phase 1 funding of 60 000 EUR. |
| The architecture of Dharma Temple: Merkaba, 7 domes, the Tree of Life. | **HORIZON** (concept) | `apps/website-v2.9/public/docs/terranova/dharma-temple.{cs,en}.md`; `DharmaTemplePreviewLazy`; `/images/dharma-temple/concept-og.png`. | Structural analysis, permits, construction budget. |
| Te Pīko Ora is a planned Pacific node. | **HORIZON** | `te-piko-ora.md` (🔵 Vision / Preparation; Phase 0 2026–2027); web `/terranova/te-piko-ora` (*Planned 2027+*). | A Polynesian partner, island, entity, team, a budget of 80 000 EUR. |
| Golden Republic Bohemia is a planned governance node in Bohemia. | **HORIZON** | `apps/website-v2.9/public/docs/terranova/golden-republic-bohemia.cs.md` (concept, ground plan, phases); [Chapter 10](./10-Golden-Republic-Bohemia.md); `docs/TerraNova/06-L5-SVOBODA.md` §6.6 (the Golden Republic, 8 principles). | Land (Říp region / Vysočina), entity (z.s. / z.ú.), a team of 3–5 keepers, a budget of 60 000 EUR, a cultural review. |
| Bodhi Lanka is a planned akasha node in Sri Lanka. | **HORIZON** | [Chapter 11](./11-Bodhi-Lanka.md); Sri Maha Bodhi (Anuradhapura, UNESCO, 288 BCE) — publicly verifiable; the Ramayana and Rama Setu (Adam's Bridge) — publicly documented. | Land (Anuradhapura vs the hill country vs the south coast), entity (a Sri Lankan NGO), a team of 3–5 keepers, a budget of 80 000 EUR, a cultural review of the Ramayana and Buddhist motifs, a partnership with the Buddhist sangha. |
| The communities operate a Guardian node. | **INVALID CLAIM** (today) | All five documents: installation Phase 2 (2027 / 2028 / 2028 / 2028 / 2029). | Hardware, connectivity, treasury. |
| The communities have a 3-of-5 multisig treasury. | **HORIZON** | The structure in §5.2 of each document. | Real wallets, signatories, a transparent account. |
| The seed library works. | **BUILDING (Genesis) / HORIZON (network)** | Genesis: "informal exchange → catalogued"; the web states *Seed Library — active*. | A catalogue, partners, the first exchange between nodes (2028). |
| Medical Table, LoRa mesh and the Resonance Protocol are deployed. | **HORIZON / MYTH** | The `TECH/`, `PROTOCOLS/` specifications; `L5_L6_ACTIVATION_PLAN.md` §5 point 13: visionary, not implemented. | — |
| The economic models of the communities (break-even, income) hold. | **HYPOTHESIS** | §4 of each document. | Real accounting after the first season. |
| L5 operates a global network of water / permaculture projects. | **HORIZON** | `MiseAmenti/07` §5. | Impact packets and external verification. |

### 2.4 Web and OASIS

| Claim | State | Evidence or source | What is still necessary |
|---|---|---|---|
| The pages `/terranova`, `/terranova/genesis`, `/terranova/dharma-temple`, `/terranova/te-piko-ora`, `/l5-free-world` exist and run. | **LIVE** | `apps/website-v2.9/src/app/terranova/**`, `l5-free-world/page.tsx`; `zion-website.service` active. | Status badges (concept / building) directly in the UI. |
| OASIS shows five L5 projects and four worlds. | **LIVE** (client) | `WorldPanel.tsx` (`NOVA_ZEME_PROJECTS` — five projects), `worlds.ts` (`GENESIS_GARDEN`, `DHARMA_TEMPLE_LA_PALMA`, `GOLDEN_REPUBLIC_BOHEMIA`, `BODHI_LANKA`; all `layer: 5`). | Connecting the statuses to the L5 API; verification of the deploy of the new metadata. |
| The avatars Sita and Hanuman have quests into L5. | **LIVE (document) / HORIZON (mechanic)** | `SulZeme/10` §II. | Implementation in the `internal repository`. |
| An OASIS quest rewards a physical visit to the garden. | **HORIZON** | The idea in `genesis-garden.md` §11.2, `dharma-temple.md` §15. | Verification, privacy, the M5 gate. |
| OASIS is a photorealistic UE 5.7 world with instant preview. | **HORIZON** | `MiseAmenti/07` §5. | A POC (M4). |
| The world `GENESIS_GARDEN` in OASIS contains Rose lore. | **LIVE** (the existence of the source line) / **BUILDING** (new client metadata; the build passed, the deploy did not) / **MYTH** (the content) | `apps/OasisWeb/src/domain/config/worlds.ts` — the world's metadata expressly label the Rose as literary lore (MYTH); [Chapter 12](./12-Ruze-v-Zahrade-Genesis.md). | The lore must not be read as evidence of a physical plant or of infrastructure; the physical rose = UNSUBSTANTIATED, the pilot = HORIZON; verification of the public client after deploy. |

### 2.5 Story and symbolism

| Claim | State | Note |
|---|---|---|
| Sita, Hanuman, Sadhu, Ana, Hina, the carpenter, the fisherman, the ploughman, the woman with the lime branch, Rama. | **MYTH** | Archetypes (Salt of the Earth, the Ramayana) and figures created for this book. No one claims historical or spiritual authority. |
| Bodhi Gaia = "the awakened Earth". | **MYTH** | An image from the Dharma Temple design, extended to L5. Not religiously binding. |
| Merkaba, the 7 chakras, piko, tatau, wayfinding, Přemysl/Libuše, the Golden Bull, the salt of the covenant, Rama/Sita, Sri Maha Bodhi, Rama Setu, akasha, prema/bhakti. | **MYTH / cultural fact** | Cultural traditions are cited with respect; their use for L5 requires a cultural review (class E), especially the Polynesian, Czech, Hindu and Buddhist elements — the consent of local communities and sensitive handling of sacred texts and religious objects. |
| Yesod ↔ L5, the vow of care. | **MYTH** | `docs/Zohar/01-SEFIROT-VRSTVY.md`. |
| Lumi, Ana and the planting of the second seed by the Nabão. | **MYTH** | The epilogue [`../Ruze/Epilog-Zahrada-Genesis.md`](./12-Ruze-v-Zahrade-Genesis.md) + [Chapter 12](./12-Ruze-v-Zahrade-Genesis.md) — a literary scene; no event, no relic, no lineage, no "sacred" plant. |

---

## 3. What Bodhi Gaia is not

1. **It is not a sale of land, shares or "tokenised soil".** The communities are legally separate entities; the ZION protocol owns no land and the L5 fund does not buy real estate without a DAO process that does not exist today.
2. **It is not an investment.** No gate, gift or stay carries a yield. The framing "invest in paradise" is a violation of `MiseAmenti/08` §5.
3. **It is not a religion or a lineage.** Bodhi, Dharma, Merkaba, *piko*, the Tree of Life are images. The book does not claim that ZION is a sacred text, that Dharma Temple is a Buddhist temple in the traditional sense, or that anyone in the project has spiritual authority.
4. **It is not a claim about impact.** Without an impact packet (recipient, scope, budget, on-chain ref., evidence with provenance, limitations, independent verification) no project is "verified impact".
5. **It is not a replacement for `StatusV3.md`, `MiseAmenti/07` or the community documents.** Where it differs, those prevail.
6. **It is not an instrument of exclusion.** Consciousness Admission, vows and ceremonies must never serve to mark a person as "lesser", "impure" or "an enemy" (`MiseAmenti/05` §4).

---

## 4. Known discrepancies in the documentation, the web and OASIS

Register M0 (the "claim registry") requires that discrepancies be reported without defending the project's identity. These are the discrepancies found while writing this book (2026-09-02):

| # | Discrepancy | Where | Recommended repair | Class |
|---|---|---|---|---|
| 1 | The humanitarian share given as **10 %** instead of the canonical **5 % L5 + 5 % L6**. | `docs/TerraNova/06-L5-SVOBODA.md` §6.2 (and the estimate "777 600 ZION/day") | Mark the chapter as historical / correct it to 5 % and remove the price estimate (it violates the ban on price predictions). | B + E |
| 2 | ~~The location of the Genesis Garden given as **Central Europe** instead of **the Algarve**~~ → **RESOLVED 2026-10-07:** the correct location is **Sabacheira, concelho Tomar** — unified across `/l5-free-world`, `/terranova/genesis`, the cards, OASIS, the maps and the registers. | — | The entry is kept as a history of the decision. | A |
| 3 | The Dharma Temple world was marked `layer: 3` — already corrected in the source. | `apps/OasisWeb/src/domain/config/worlds.ts` (`DHARMA_TEMPLE_LA_PALMA` has `layer: 5` + the tag `layer 5`) | Verify the deploy of the public client; add a "concept" badge. | A |
| 4 | The location of Te Pīko Ora: the web and OASIS say **Tahiti**, the community document prefers **Raiatea** (Tahiti as a fallback). | `PioneerProjectCards.tsx`, `WorldPanel.tsx` vs `te-piko-ora.md` §3.3 | State "Raiatea / Tahiti (selection in progress)" everywhere the same. | A |
| 5 | The community documents are dated **2026-05-21**; the Genesis Phase 1 timeline says "first guests Q3 2026" — Q3 2026 is already passing without evidence. | `public/V3/L5/docs/COMMUNITIES/*.md` | Refresh states and dates; add an "Evidence" section with links. | B |
| 6 | Nirvana ep. 10 gives specific numbers ("over 23 600 payments") and a "live chart" at `/l5-free-world`. | `canon/books/nirvana/10-Prameny-Zivota.md` | Mark the numbers as a snapshot with a date; verify the "live chart" or change it to "a page with the fund address". | B |
| 7 | Nirvana ep. 4 describes ZIS with passkeys / WebAuthn / biometrics. | `canon/books/nirvana/04-Domov.md` | According to `MiseAmenti/07` passkeys are HORIZON — add the label. (Outside L5, but found while reading.) | B |
| 8 | The inventory in `L5_L6_ACTIVATION_PLAN.md` §4.2 and §5 still gives the placeholder `fund_address`, the wrong RPC port and missing env overrides — **the code is already corrected** (`DEFAULT_HUMANITARIAN_FUND_ADDRESS = zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`, `l1_rpc_url = internal port`, env `FREE_WORLD_*`). | `docs/3.2/L5_L6_ACTIVATION_PLAN.md` vs `internal repository` | Update the inventory of the plan (sections 4.2 / 5) to the actual state of the code; keep historical points as "resolved". | B |
| 9 | The OASIS statuses of the communities are handwritten constants without a source in the L5 API. | `WorldPanel.tsx`, `PioneerProjectCards.tsx` | A source of truth: the `communities` table / `GET /api/v1/projects`. | BUILDING (M5) |
| 10 | The web `/terranova/genesis` states *Seed Library — active*, the community document says "informal exchange". | the web vs `genesis-garden.md` §3.3 | Unify the state (BUILDING), add a catalogue or change the label. | A |

---

## 5. Consolidated open questions of L5

**Genesis Garden:** exact GPS and acreage; solar capacity (kWp / kWh); legal form (Associação / Cooperativa / hybrid); a surf school and partnerships; a Tech Guardian coordinator; shared protocols with Dharma Temple; the seed library (varieties, partners); insurance; EU grants (LEADER, CAP, Erasmus+).

**Dharma Temple:** location (north / south / altitude); land (purchase / lease / co-ownership); founding keepers; legal form (Asociación / Fundación / SCE); micro-hydro (barranco, permits); the link to existing eco-communities on La Palma; funding of Phases 0–1; volcanic insurance; seed library coordination (2028); cooperation with the observatory.

**Te Pīko Ora:** Raiatea vs Tahiti; a local *mā'ohi* partner and the manner of approaching them; customary vs state land; cyclone insurance; medical evacuation; a permit for pearls; a partnership with *Fa'afaite*; a *tatau* master for symbolic designs; the Hawaiian line (KNIHA-LEHUA); marine permaculture expertise.

**Golden Republic Bohemia:** the Říp region vs the Vysočina vs central Bohemia (exact location and acreage); legal form (z.s. / z.ú. / community foundation / hybrid); partnerships with Czech eco-communities (permaculture networks, Transition Towns, eco-villages); an MOU with Charles University and ČZU for governance research; the seed library (Prague Gene Bank, SEMO, local breeders); a cultural review of the Přemysl/Libuše mythology (myth vs nationalism); a cultural review of the Charles IV / Golden Bull motifs (inspiration, not a claim to historical authority); a Tech Guardian coordinator linked to the Czech developer community; EU funding (LEADER, CAP, Erasmus+, LIFE, Horizon Europe — governance research).

**Bodhi Lanka:** Anuradhapura vs the hill country (Kandy / Nuwara Eliya) vs the south coast (exact location and acreage); legal form (a Sri Lankan NGO / trust / hybrid); a partnership with the Buddhist sangha (the Sri Maha Bodhi temple, Anuradhapura); a partnership with an Ayurvedic university (e.g. the University of Kelaniya, the Gampaha Wickramarachchi Ayurveda Institute); a cultural review of the Ramayana (the Rama/Sita motifs — sacred to Hindus, Buddhists and Sri Lankans) and of the Buddhist motifs (Sri Maha Bodhi as a living religious object, not a tourist attraction); visa/residency for foreign keepers (Sri Lanka visa policy, long-term residence permits); monsoon insurance (the Yala + Maha seasons); elephant conflicts (zoning, fences, respect for corridors); political stability (the 2022 economic crisis, monitoring).

**The L5 network:** a DAO UI/UX for L5 proposals (J4/J6); the payout tx flow and the guardian multisig; API key middleware; a public portal (N5); a source of truth for the statuses of the communities; the first impact packet; Sybil resistance for quadratic voting; a cultural review of the Polynesian, Buddhist, Hindu and Czech elements.

---

## 6. Next steps — mapped to Mise Amenti M5 and plan N5

| Step | What | Gate | State |
|---|---|---|---|
| 1 | Repair discrepancies #1, #2, #4, #10 (editorial) and #8 (config); for #3 the source is corrected — what remains is verification of the deploy and the "concept" badge. | M0 | ❌ |
| 2 | Refresh the three community documents with an *Evidence* section (what is documented, when, by whom). | M0 / M5 | ❌ |
| 3 | Add L5 rows to `MiseAmenti/07-Registr-Dukazu.md` (this chapter as the source). | M0 | 🔄 (a proposal in the [`CHANGELOG`](../MiseAmenti/CHANGELOG.md)) |
| 4 | Enforce the API key on `free-world tracker` before any public exposure. | M1 (security) | ❌ |
| 5 | A source of truth for the statuses of the communities: the `communities` table → web + OASIS. | M5 | ❌ |
| 6 | A public L5 portal: balance, history of flows, proposals, recipients, milestones, results. | M5 / N5 | ❌ |
| 7 | A DAO UI for L5 proposals + the payout tx flow + the guardian multisig (without it the fund does not distribute). | M5 (+ J4/J6) | ❌ |
| 8 | Define the **impact packet** template and choose **one pilot** (closest: Genesis Garden Phase 1). | M5 exit gate | ❌ |
| 9 | A cultural review of the Polynesian (Te Pīko Ora) and Buddhist (Dharma Temple) elements before public release. | class E | ❌ |
| 10 | A cultural review of the Czech (Golden Republic Bohemia) elements — the Přemysl/Libuše mythology and the Charles IV / Golden Bull motifs — before public release. | class E | ❌ |
| 11 | A cultural review of the Sri Lankan (Bodhi Lanka) elements — the Ramayana (Rama/Sita), Sri Maha Bodhi (a living religious object), the Buddhist and Hindu motifs — before public release. | class E | ❌ |
| 12 | Canonisation of this series after review (technical + security + facts + culture). | `MiseAmenti/08` | 🔄 DRAFT |
| 13 | The pilot [`GENESIS-ROSE-001`](./pilots/GENESIS-ROSE-001.md) — the physical planting of a rose may begin only after Gates A–D are fulfilled (consent and place, botany and safety, care, finance and claims); it does not replace the M5 exit gate. | the pilot's Gates A–D | ❌ NOT STARTED |

---

## 7. A proposal for change according to `MiseAmenti/08` §3

```markdown
## Intent
Unite the vision and documentation of the L5 layer (Genesis Garden, Dharma Temple / the New Bodhi Gaia,
Te Pīko Ora, Golden Republic Bohemia, Bodhi Lanka) into a single narrative-technical series following on from Onboarding, Salt of the Earth and Nirvana,
with a complete anchor of truth for every claim.

## State of the claims
Protocol/fund/service: LIVE. Communities: BUILDING (Genesis) / HORIZON (Dharma Temple, Te Pīko Ora, Golden Republic Bohemia, Bodhi Lanka).
Shared protocols: HORIZON. Story and symbolism: MYTH.

## Evidence
internal repository (emission, v3_template, v3_compat); internal repository; internal repository;
public/V3/L5/docs/**; apps/website-v2.9/src/app/terranova/**, l5-free-world;
apps/OasisWeb (WorldPanel, worlds.ts); docs/3.2/L5_L6_ACTIVATION_PLAN.md;
MiseAmenti/03, 04 (M5), 05, 07; StatusV3.md.

## Risks
Cultural (Polynesian, Buddhist, Hindu, Sri Lankan and Czech elements), financial framing (gift vs investment),
privacy (data about keepers and guests), exaggeration of state (concept vs building),
security (an API without a key, DAO execution).

## Boundary
It does not claim that the communities work, that the fund pays out, that the nodes run, that OASIS rewards physical actions,
that there is verified impact, or that anyone has spiritual authority.

## Review
A technical reviewer (L1/L5 facts), a security reviewer (fund/DAO/API), a factual editor,
a cultural consultant for Polynesia, Buddhism, Hinduism (the Ramayana), Sri Lanka and Czech traditions, a public-copy review before any excerpt into public/.

## Rollback / repair
The series remains DRAFT until the review is complete; every claim can be lowered by changing a label without deleting text;
the changelog preserves history; public excerpts only after approval.
```

---

## 8. The vow of the Book of the Earth

> **A tree that does not stand we will not draw as standing.**
> **A well that gives no water we will not count as impact.**
> **A person who comes we will not test on faith, but on a tidy kitchen.**
> **And when the story collides with the clay, we will repair the story.**

---

*[Back to the index of the Book of the Earth → `00-README.md`](./00-README.md)* · *[Mise Amenti — register of evidence](../MiseAmenti/07-Registr-Dukazu.md)* · *[Nirvana, ep. 10 — Springs of Life](../nirvana/10-Prameny-Zivota.md)*
