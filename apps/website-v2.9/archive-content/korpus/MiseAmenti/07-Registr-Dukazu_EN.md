# 07 — The evidence register
## The single table that prevents technological reality, active building, hypothesis and story from being mixed together

> **Status:** A living evidence register.  
> **Rule:** This page does not rewrite the code, `StatusV3.md` or release evidence. Its task is to show what is documented, what requires evidence, and what may be said only as a horizon or a myth.

---

## 1. How to read the register

| Column | Meaning |
|---|---|
| **Claim** | What a reader might understand as a statement about the project. |
| **State** | LIVE / BUILDING / HORIZON / HYPOTHESIS / MYTH according to [`01-Kanon-a-Ustava.md`](./01-Kanon-a-Ustava.md). |
| **Evidence or source** | The specific source from which the state derives. |
| **What is still needed** | What must exist before the state may be raised. |

Two supplementary register labels are not product states: **UNSUBSTANTIATED** means that there is not enough evidence in the current corpus and the claim must not be used as fact; **INVALID CLAIM** means that the claim contradicts the available evidence or the security/ethical framework and must not be used at all.

---

## 2. Current evidence: L1 and operations

| Claim | State | Evidence or source | What is still needed |
|---|---|---|---|
| The V31 L1 chain, node, pool and basic operation are active. | **LIVE** | `StatusV3.md`; the `internal repository`; a direct live probe on 2026-08-31. | Continuous health evidence; height figures are not taken statically from marketing. |
| Ekam Deeksha v3.2 is the active consensus. | **LIVE** | the `internal repository`; `StatusV3.md`. | Regression/compatibility tests on every consensus change. |
| LWMA-60 sets a target block time of 60 s with protective limits. | **LIVE** | the `internal repository`; `AGENTS.md`; `StatusV3.md`. | Live observability that distinguishes the target value from the current average. |
| The UTXO v2 wallet/CLI/SDK path works. | **LIVE** | `AGENTS.md` update 2026-08-22; `StatusV3.md`; the `internal repository`. | Every release must have an E2E send/receive test without secrets. |
| The L1 HTLC lock → claim worked on Edge. | **LIVE** | `NATIVE_L1_HTLC_REPORT.md`; `StatusV3.md` update 2026-08-23. | A repeatable refund / failure-mode test and release evidence. |
| Trinity mining is verified in production. | **LIVE** | `StatusV3.md`, `AGENTS.md`, rig E2E reports. | Separate GPU rig evidence from the CPU-only Edge state in every communication. |
| The 1 % coinbase slot currently goes automatically to node operators. | **BUILDING** | the `internal repository` has the default `node_reward_activation_height = u64::MAX`; `AGENTS.md` describes the post-activation design. | A specific activation height, an on-chain 4-output coinbase and node payout evidence. |
| The network has hundreds of independent public node operators. | **UNSUBSTANTIATED** | Primary/follower nodes and documentation exist, but the current evidence corpus does not document a figure in the hundreds. | A public, privacy-respecting node census with a methodology. |

---

## 3. Current evidence: L2, ZIS and DEX

| Claim | State | Evidence or source | What is still needed |
|---|---|---|---|
| The `warpd` / multichain service and the Base + ZION L1 pilot run. | **LIVE** | `StatusV3.md`; the `internal repository`; `warp.example.toml`. | Monitor the live config and key ownership without disclosing secrets. |
| The Base ↔ ZION L1 bridge round-trip has been carried out. | **LIVE** | the `internal repository` update E4: lock → mint → burn → unlock. | A repeatable audit and monitoring of validator/bridge state. |
| The DEX quote/multi-quote API and the web widget work. | **LIVE** | `ZionDexZis.md` update 2026-08-29; `StatusV3.md`. | Do not confuse a quote with settlement. |
| The ZIS auth service runs. | **LIVE** | `StatusV3.md`; `AGENTS.md`; the ZIS `/health` probe. | Security/privacy tests for every change to the auth flow. |
| The ZIS multichain deposit/ledger/withdraw path exists in the code. | **BUILDING** | `ZionDexZis.md`; the `internal repository`; wallet endpoints. | A funded end-to-end deposit → swap → withdrawal test with on-chain receipts and rollbacks. |
| Real settlement for any user swap is completely finished. | **BUILDING** | Code exists; the test evidence so far reports `insufficient balance` without a funded test wallet. | An E2E test with a funded test account, reconciliation and independent review. |
| An independent solver federation runs in production. | **BUILDING** | Intent/solver code and tests exist, but `warp.example.toml` contains `[solver] enabled = false`. | Independent solvers, live config, an auth/availability test and an incident policy. |
| All EVM, Bitcoin, Lightning, Solana, SUI, Aptos and other chains are supported. | **HORIZON** | `warp.example.toml` explicitly activates only `base` and `zion-l1`; the others have a `disabled_reason`. | Separate evidence for each chain before the claim "supported". |
| ZIS Passkeys/WebAuthn/Face ID/Touch ID/Windows Hello/YubiKey work. | **HORIZON** | An audit of the source tree `apps/identity/src` found no WebAuthn/FIDO/passkey implementation. | A standard implementation, a device/recovery threat model and E2E tests. |
| Zero-knowledge Dharma/reputation proofs exist. | **HORIZON** | No ZK circuit/proof system was found. | A protocol, a circuit, an audit, a privacy threat model and a validator. |

---

## 4. Current evidence: L3 agents and Hiran

| Claim | State | Evidence or source | What is still needed |
|---|---|---|---|
| The Hiran/Hiranyagarbha framework, the Maestro CLI and the orchestration code exist. | **BUILDING** | the `internal repository`; `docs/3.0.6/HIRAN_OVERVIEW.md`; `maestro.rs`. | A deployed, sandboxed inference/runtime according to `05-Autonomie-a-Bezpecnost.md`. |
| Hiran v2.3 is a trained model. | **BUILDING** | `HIRAN_OVERVIEW.md` states a Qwen3-32B Q5_K_M artifact outside Edge. | Redundant safe storage, reproducibility metadata and an inference deployment. |
| Hiran inference runs on Edge. | **UNSUBSTANTIATED** | `HIRAN_OVERVIEW.md` explicitly states that Edge has neither a GGUF nor an inference service. | Deployment, health, ops/security evidence. |
| The Dharma Validator is a 7-principle model of ethics. | **LIVE as code / BUILDING as a security guarantee** | the `hiranyagarbha.rs` enum and unit tests; `validate_text` is a keyword heuristic. | A contextual classifier, red-team tests, policy enforcement outside the LLM and human oversight. |
| The Amitabha/Amṛtabhoja natural-language executor and autonomous agents control finance/production. | **HORIZON** | `HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md` labels v2.5 as a vision; `05-Autonomie-a-Bezpecnost.md` forbids uncontrolled finance/production. | The entire agent safety gate M2/M3 from the Execution Charter. |
| AI is demonstrably conscious or has spiritual authority. | **INVALID CLAIM** | No verifiable methodology and no evidence. | Such a claim is not used in the canon or in public communication. |

---

## 5. Current evidence: L4, L5 and L6

| Claim | State | Evidence or source | What is still needed |
|---|---|---|---|
| The OASIS backend and a separate web/operational service exist. | **LIVE** | the `internal repository`; `StatusV3.md`; live service matrix. | UX/security/privacy evidence for each public capability. |
| The UE 5.7, Nanite, Lumen, MetaHuman, WebGPU or Pixel Streaming client are finished. | **HORIZON** | L4 contains the Axum API; the audit found no real UE/WebGPU/Pixel Streaming client. | A POC, licence analysis, performance/accessibility/security tests. |
| The Free World tracker/API and the grant/project workflow exist. | **LIVE** | the `internal repository`; `StatusV3.md`; the `internal repository`. | A public portal, an evidence registry and a real pilot impact review. |
| The L5 fund pays out grants today. | **INVALID CLAIM** (today) | Gate G10 (`docs/3.2/L5_L6_ACTIVATION_PLAN.md`): no automatic payout; `internal repository` execution is summary-only. | DAO UI, payout tx flow, guardian multisig, the first impact packet. |
| Genesis Garden (Sabacheira, Tomar, Portugal) is a physical place in active development. | **BUILDING** | `public/V3/L5/docs/COMMUNITIES/genesis-garden.md` (Phase 0 ✅, Phase 1 🟡); the web at `/terranova/genesis`; the OASIS panel *Active*. | Land, a registered entity, GPS, independent verification. Detail: [`BodhiGaia/03`](../BodhiGaia/03-Zahrada-Genesis.md). |
| The Rose in Genesis Garden: narrative epilogue + OASIS Rose lore / physical planting / the pilot `GENESIS-ROSE-001`. | **MYTH** (story and lore) · **LIVE** (the existence of the source line) / **BUILDING** (new client metadata; the build passed, deploy did not take place) · **UNSUBSTANTIATED** (the physical rose) · **HORIZON / NOT STARTED** (the pilot) | [`Ruze/Epilog-Zahrada-Genesis.md`](../Ruze/Epilog-Zahrada-Genesis.md); [`BodhiGaia/12`](../BodhiGaia/12-Ruze-v-Zahrade-Genesis.md); `apps/OasisWeb/src/domain/config/worlds.ts` (`GENESIS_GARDEN`, lore marked MYTH); [`BodhiGaia/pilots/GENESIS-ROSE-001.md`](../BodhiGaia/pilots/GENESIS-ROSE-001.md). | Deploy + verification of the client for the new metadata; meeting Gates A–D + the Day 0 packet, then the D30/D90/D365 checks; it does not replace the M5 exit gate. |
| Dharma Temple (La Palma) — merkaba, 7 domes, the Tree of Life (New Bodhi Gaia). | **BUILDING (documentation) / HORIZON (physically)** | `public/V3/L5/docs/COMMUNITIES/dharma-temple.md`; `public/docs/terranova/dharma-temple.{cs,en}.md`; the 3D concept at `/terranova/dharma-temple`; the OASIS world `DHARMA_TEMPLE_LA_PALMA`. | Land, an entity, 5 founding guardians, funding; not a single dome stands. Detail: [`BodhiGaia/04`](../BodhiGaia/04-Dharma-Temple-Nova-Bodhi-Gaia.md). |
| Te Pīko Ora (Raiatea, French Polynesia) — the living navel, wayfinding, marine permaculture. | **HORIZON** | `public/V3/L5/docs/COMMUNITIES/te-piko-ora.md` (Phase 0 2026–2027); the web at `/terranova/te-piko-ora`. | A Polynesian partner, the island, the entity, the team. Detail: [`BodhiGaia/05`](../BodhiGaia/05-Te-Piko-Ora.md). |
| The L5 communities operate a Guardian Node (90/10 split). | **INVALID CLAIM** (today) | All three documents: Phase 2 installation (2027 / 2028 / 2028). | Hardware, connectivity, a treasury. |
| OASIS mirrors five L5 projects and four worlds. | **LIVE** (client) | `apps/OasisWeb/src/components/WorldPanel.tsx` (`NOVA_ZEME_PROJECTS` — five projects); `src/domain/config/worlds.ts` (`GENESIS_GARDEN`, `DHARMA_TEMPLE_LA_PALMA`, `GOLDEN_REPUBLIC_BOHEMIA`, `BODHI_LANKA`; all `layer: 5`). | Statuses connected to the L5 API; verification of the deploy of the new metadata (Rose lore is in the source, deploy did not take place). Detail: [`BodhiGaia/07`](../BodhiGaia/07-Zahrada-v-Oasis-a-na-Webu.md). |
| L5 already operates a documented global network of water/permaculture. | **HORIZON** | The code contains records/workflow, not an independently verified global portfolio. | Project impact packets and external verification. |
| L5 has verified impact (a well, a tree, a project). | **UNSUBSTANTIATED** | No impact packet has been created yet; M5 exit gate = one pilot through the whole cycle. | The first impact packet, an independent report. Detail: [`BodhiGaia/06`](../BodhiGaia/06-Protokoly-Zeme.md) and [`BodhiGaia/09`](../BodhiGaia/09-Kotva-Pravdy-a-Hranice.md). |
| The Issobella tracker/API for mission/research proposals exist. | **LIVE** | the `internal repository`; `StatusV3.md`; the `internal repository`. | A transparent DeSci publishing/review/reproduction workflow. |
| L6 has a working quantum/warp engine, a ZPE solution or verified antigravity. | **INVALID CLAIM** | Neither in the code nor in operation is there evidence of such a device; the current direction is a research horizon. | Reproducible, independent experimental evidence — without it such a claim must not be made. |
| Alcubierre-Ekam, toroidal resonance and related physics are legitimate research questions. | **HYPOTHESIS** | `V33_NIRVANA_MASTER_PLAN.md` and the Issobella materials formulate the research intent. | A literature review, methodology, open data, falsification criteria and peer review. |

---

## 6. Reconciliation decisions for older 3.3 texts

These rules do not require deleting previous creative material. They mean that its future reading is governed by the following:

1. The previous "canonical plan" [`V33_NIRVANA_MASTER_PLAN.md`](../../3.2/V33_NIRVANA_MASTER_PLAN.md) is a **technical companion / source of work**, while `MiseAmenti/` is the integration canon and the register of truth.
2. All formulations "Passkeys", "full multichain", "autonomous agents", "UE 5.7", "WebGPU/Pixel Streaming" and "quantum/warp engine" are read as **BUILDING/HORIZON/HYPOTHESIS**, according to the tables above.
3. "Global Assimilation" means only **voluntary interoperability and cooperation**; never an imperative, recruitment or cultural superiority.
4. The stories `nirvana/` and `NirvanaCloud/` remain a valuable narrative layer, but their "Anchor of truth" is updated on the basis of this register in case of conflict.
5. The tokenomic claim about 1 % is always supplemented with the activation-height condition: **node reward only after activation; otherwise burn**.
6. The story [`Miriam/`](../Miriam/00-README.md) (*The Book of the Rose*, DRAFT) is a narrative layer with the same regime as rule 4: its "Anchor of truth" labels the historical layers **stone / clay / dream** and also uses the labels **UNSUBSTANTIATED** and **INVALID CLAIM** in the same meaning as this register. The historical, biblical and genealogical claims in it are read only according to its own labels — narrative "facts" from it must not enter operational documents nor be presented as verified history.
7. The story [`Ruze/`](../Ruze/00-README.md) (*The Rose Story — What Cannot Be Owned*, DRAFT) is entirely a literary **MYTH** — a fable about Lumi and a rose by the river beyond the open gate, with no technical counterpart. Its existence **does not elevate** older material around the avatar "Meriam Rose" (the `internal repository`, id 18) nor the esoteric claims of the document `docs/docs2.9/ZION_OASIS/SACRED_TRINITY/18_MERIAM_ROSE.md` to historical, spiritual, technical or operational truth; their boundary is held by [`Ruze/10-Kotva-Pribehu.md`](../Ruze/10-Kotva-Pribehu.md) and `Miriam/13`. The same holds for its epilogue in Genesis Garden: the scene with Lumi and Ana is **MYTH**, the existence of the source line of the world `GENESIS_GARDEN` in `apps/OasisWeb/src/domain/config/worlds.ts` is a **LIVE** repository fact, the new client metadata is **BUILDING** (the build passed, deploy did not take place) with content explicitly marked MYTH, the physical planting of the rose in Sabacheira (Tomar) is **UNSUBSTANTIATED** and the pilot [`GENESIS-ROSE-001`](../BodhiGaia/pilots/GENESIS-ROSE-001.md) is **HORIZON / NOT STARTED** — it must not begin without Gates A–D, and it does not replace the M5 exit gate.

---

## 7. The mandatory evidence packet for a change of state

| Transition | What must be entered into the changelog / report |
|---|---|
| HORIZON → BUILDING | Design/issue, an explicit owner, a threat model, a test plan, real code or a POC. |
| BUILDING → LIVE | Commit/tag, test result, deployment evidence, health/E2E evidence, known limitations and a rollback plan. |
| HYPOTHESIS → a supported hypothesis | Methodology, data, reproduction by at least an independent reviewer, and a description of negative results. |
| LIVE → limited/disabled | The incident or configuration change is published faster than the marketing correction; the register is updated immediately. |

---

*[Back to the Mise Amenti index → `README.md`](./README.md)*
