# 04 — The 3.3 Execution Charter
## How Mise Amenti becomes verifiable work: workstreams, dependencies, boundaries and release gates

> **Status:** The canonical execution framework for 3.3 "Nirvana".  
> **Complements:** [`V33_NIRVANA_MASTER_PLAN.md`](../../3.2/V33_NIRVANA_MASTER_PLAN.md) and does not mechanically duplicate it.  
> **Principle:** The success of 3.3 is not measured by the token price, the size of the audience nor the loudness of the story. It is measured by safety, verifiability, voluntariness, resilience and documented benefit.

---

## 1. The 3.3 lodestar

V3.3 is ready only when a person can:

1. **enter safely** and understand what is happening, without pressure;
2. **own and verify** their identity, data and funds, without a hidden custodian;
3. **transfer value** across supported networks only with clearly visible risk and verified settlement;
4. **use AI as a helper** that has no hidden permissions, does not set their direction and cannot act without control;
5. **create, learn and meet** in OASIS without a manipulative economy of attention;
6. **see where the shared share of value goes** and verify the real impact of L5/L6;
7. **take the project over** into the next generation, even if today's team and the Edge server disappeared tomorrow.

---

## 2. Order of work and dependencies

```text
M0 Evidence & Stability Baseline
 │
 ├── M1 L2 / ZIS: safe identity and real settlement
 │      │
 │      ├── M2 L3: Hiran 2.4 Maestro in a sandbox
 │      │      └── M3 L3: Amitābha / limited agent autonomy
 │      │
 │      └── M4 L4: OASIS client and web preview
 │
 ├── M5 L5: Free World public evidence and participation
 ├── M6 L6: Issobella DeSci and reproducible research
 │
 └── M7 Decentralisation, localisation, DR and handing on to generations
        │
        └── M8 Release / Canon evidence review
```

**The basic dependency rule:** no agent may control finances or production until M1 (identity/fixes), M2 (sandbox), M0 (auditability) and the corresponding parts of M8 (security review) are complete. No OASIS quest may reward unverified or harmful performance. No L5/L6 grant may be labelled "impact" without evidence.

---

## 3. Mise Amenti workstreams

### M0 — A stable foundation and the evidence register

**Goal:** to lock down the difference between the live state and the future plan before the product or the story expands further.

| Deliverable | Acceptance |
|---|---|
| Version and release evidence | Every public version number can be attributed to a specific tag, binary and protocol compatibility. |
| Live health matrix | Node, pool, ZIS, WARP, DAO, OASIS, L5 and L6 have a traceable health check and incident policy. |
| Test baseline | `cargo test --workspace`, the relevant clippy and the frontend build have stored/verifiable results. |
| Claim registry | Every important statement is labelled LIVE/BUILDING/HORIZON/HYPOTHESIS/MYTH. |
| Disaster recovery | Backups, a restore drill and ownership of runbooks are tested, not merely written down. |

**M0 exit gate:** no current 3.3 document presents Passkeys, the full multichain network, the UE5 client, autonomous finance or quantum/warp research as a finished product.

---

### M1 — L2 Multichain & ZIS: from quote to documented settlement

**Goal:** to create a safe and comprehensible path `identity → deposit → quote → confirmation → settlement → withdrawal` for an explicitly supported, limited scope of chains.

| Priority | Deliverable | Measurable acceptance |
|---|---|---|
| M1.1 | Scope and custody disclosure | Every screen clearly states whether the funds are user-controlled, delegated or custodial; recovery and risks are comprehensible. |
| M1.2 | Funded end-to-end test | An isolated test wallet completes deposit → swap → withdrawal with real on-chain evidence; the test contains no seed and no secrets. |
| M1.3 | Reconciliation & idempotence | A restart, a duplicate event, a reorg and a partial failure do not change the user's balance incorrectly; the tests cover refund and recovery. |
| M1.4 | ZIS hardening | Session security, rate limits, logout/revocation, recovery and the privacy threat model are tested. |
| M1.5 | Passkeys / WebAuthn | Only after M1.4: a standard WebAuthn implementation, phishing-resistant login, device/recovery flow, E2E test on supported platforms. |
| M1.6 | Another chain | Every new chain passes the same threat model, deploy evidence and E2E matrix; `disabled_reason` remains the default state. |

**Explicitly outside M1 without a separate gate:** "12 chains live", Zero-Knowledge Dharma proof, automatic custody and marketing claims of universal compatibility.

---

### M2 — Hiran v2.4 Maestro: orchestration first in a safe space

**Goal:** to turn the existing orchestration code into an operationally safe tool for observation, analysis, simulation and design — not for silent action over production.

| Phase | Permitted capabilities | Forbidden capabilities |
|---|---|---|
| M2.1 Observer | Reading metrics, analysing incidents, summarising documentation, proposing a checklist. | Editing, restarting, deploying, finance, network rules. |
| M2.2 Simulator | Dry-run task graph, testnet/fixture workflow, reproducing bugs in a sandbox. | Production side effects. |
| M2.3 Assistant with confirmation | Prepares a precise proposal for a command or transaction; a human checks and confirms it independently. | Automatic approval of its own proposal. |
| M2.4 Limited executor | A single pre-approved, idempotent and reversible step under a short-lived token, audit log and kill switch. | Keys, treasury, irreversible actions, firewall, release or consensus. |

**M2 exit gate:** Hiran inference is deployed in the designated environment, the tools are sandboxed, every action is auditable and `DharmaValidator` is explained as an auxiliary heuristic check, not "proof of ethics".

---

### M3 — Hiran v2.5: Amitābha / Amṛtabhoja as an interface of intent

**Goal:** natural language makes a person's work easier without concealing consequences or taking over their right to decide.

- Voice/text must return a **structured plan**, not only a confidently executed result.
- Every plan shows: the source of funds, the recipient, the fee, the chain, irreversibility, risks, alternatives and the way to cancel.
- Agent identities have separate, time-limited capability tokens; never shared master seeds.
- "Autonomy" means delegated, limited action under a human mandate — not independent goals, a personality cult or financial speculation.

**M3 exit gate:** red-team tests for prompt injection, confused deputy, privilege escalation, false claims, transaction substitution and recovery; an independent review of the security model.

---

### M4 — L4 OASIS: an open world without the exploitation of attention

**Goal:** to turn OASIS from a backend and a blueprint into an accessible, safe and culturally sensitive space for learning, play and creation.

1. **Web preview MVP:** a light, accessible browser entry point; what is measured is compatibility, performance, accessibility and security, not marketing FPS promises.
2. **OASIS API contract:** the API version, authorisation via ZIS, asset ownership, the privacy model and rate limits are stabilised before the client.
3. **UE feasibility track:** Unreal Engine 5.7 is a separate R&D proof-of-concept with a licence, GPU, streaming and scaling analysis. Until this POC exists, Nanite/Lumen/MetaHuman/Pixel Streaming remain HORIZON.
4. **Culture and safety:** no monetised "sacred skins", no gamification of spiritual authority, no pay-to-win and no quests that abuse personal data.

**M4 exit gate:** the public preview has an accessibility review, a security review, measurable performance on reference devices and a comprehensible privacy policy.

---

### M5 — L5 Free World: from a fund to documented impact

**Goal:** the 5 % humanitarian mechanism becomes a publicly explainable path `income → decision → disbursement → result → independent verification`.

- The public portal shows the balance, data sources, DAO decisions, recipients, budgets, milestones and results.
- Every project has a minimum "impact packet": identification of the recipient, scope, budget, on-chain reference, evidence of output, limitations and the status of independent verification.
- Quadratic voting is not merely a UI element: before deployment it needs a Sybil-resistance model, eligibility rules, a privacy analysis and an attack simulation.
- No photograph of a well, a tree or a community is evidence of impact without consent, provenance and responsibility for the context.

**M5 exit gate:** at least one pilot passes the entire publicly auditable cycle without exaggerating the results.

---

### M6 — L6 Issobella: DeSci before big claims

**Goal:** to create infrastructure for open research that is stricter than the speculation itself.

- Every proposal contains a hypothesis, the baseline literature, methodology, data, budget, conflict of interest and a **falsification criterion**.
- Peer review, replication, negative results and corrections have the same visibility as successes.
- Research around cosmology, quantum effects, new energies or Alcubierre metrics is classified as a **HYPOTHESIS** until it is independently and reproducibly verified.
- It must never be claimed commercially that ZION has solved FTL, antigravity, zero-point energy or the world's energy security.

**M6 exit gate:** a published, licence-clear DeSci protocol; the first reproducible computational or data project with independent review.

---

### M7 — Decentralisation, community and handing on

**Goal:** that "global" means distributed, locally responsible and translatable — not centralised in one infrastructure or one cultural story.

- A node/operator programme with independent operators, a documented bootstrap and disaster recovery.
- A localisation programme: translations reviewed by native speakers, accessibility, contextual legal and cultural disclaimers.
- Community cells of a reasonable size, open to feedback and able to function without a central team.
- An independent security, financial-reserve and impact audit wherever the system holds other people's funds or makes social claims.

**M7 exit gate:** at least one complete failover/restore drill without the main Edge server, and a reproducible onboarding path for an independent operator.

---

## 4. Final release gates for the label "3.3 Nirvana"

No marketing page, release or whitepaper may label 3.3 as complete until there is evidence for every relevant gate:

- [ ] **R1 — Truth:** the current release tag, changelog, test results and compatibility matrix.
- [ ] **R2 — L1 security:** consensus/security review, monitoring, a backup/restore drill and a clear status of node rewards.
- [ ] **R3 — L2 settlement:** a funded E2E test in the declared scope, reorg/retry/reconciliation testing and a clear custody disclosure.
- [ ] **R4 — ZIS:** security/privacy review, session/recovery flow, and Passkeys only if actually deployed and tested.
- [ ] **R5 — L3 autonomy:** human approval model, audit log, sandbox, rollback/kill switch, red-team evidence.
- [ ] **R6 — L4 culture:** a safe and accessible preview; UE/streaming only to the extent actually delivered.
- [ ] **R7 — L5/L6 responsibility:** a publicly auditable fund/pilot workflow and a scientific reproducibility policy.
- [ ] **R8 — Decentralisation:** an independent operator/restore test, updated runbooks, an incident disclosure process.
- [ ] **R9 — Communication:** public copy has passed a factual/legal/cultural review and every HORIZON/HYPOTHESIS is visibly labelled.

---

*[Back to the Mise Amenti index → `README.md`](./README.md)*
