# 03 — The living foundation of 3.3
## A matter-of-fact L1–L6 baseline: what actually runs, what is being built and what is only a horizon

> **Snapshot:** 2026-08-31.  
> **Update rule:** This document is a curated signpost, not live telemetry. In every conflict, [`StatusV3.md`](../../3.2/StatusV3.md), the [`internal repository`](../../../interní%20repozitář), on-chain data and the current code prevail.  
> **Versioning note:** In this canon, "3.3 Nirvana" is used as a planning name. The running workspace/protocol metadata have their own sources of truth and must not be overwritten by the narrative.

---

## 1. Why this baseline exists

A canon without a real baseline turns into a wish. This document therefore does not only list the ambitions of 3.3; it records **what we actually push off from**. Each layer is divided into:

- **LIVE** — deployed or documented by current operational or E2E records;
- **BUILDING** — code, a plan, a test or an active implementation exists, but not production proof of all the declared properties;
- **HORIZON** — a legitimate long-term direction without the claim that it is available today;
- **HYPOTHESIS** — a research claim that may be entirely refuted.

---

## 2. Summary L1–L6

| Layer | LIVE | BUILDING | HORIZON / HYPOTHESIS |
|---|---|---|---|
| **L1 Core** | V31 node/pool/miner, native UTXO v2, Ekam Deeksha v3.2, LWMA-60, HTLC and the public chain. | Node reward model 1% — the code exists, activation is a configuration matter and must be verified on the live network. | Further consensus evolution only after proper governance and a security process. |
| **L2 Multichain & ZIS** | `warpd`, Base + ZION L1 pilot, Base↔ZION E2E bridge round-trip, quote API, ZIS health/session service. | ZIS-backed wallet, deposit/ledger/withdraw, a fully funded deposit→swap→withdraw E2E, an independent solver network. | Passkeys/WebAuthn, further EVM networks, BTC/Lightning and non-EVM chains — until they are deployed and verified, they are not "supported". |
| **L3 Hiranyagarbha** | `zion-ai-native`, Maestro CLI/orchestration code, health polling, the Dharma Validator as tested auxiliary logic. | Deployment of Hiran v2.3 inference, connection to the 2.4 Maestro, the NCL broker and a safe tool runtime. | The v2.5 Amitābha/Amṛtabhoja interface and autonomous agents with limited action; no autonomous funding or production agent is canonically live today. |
| **L4 OASIS** | Rust/Axum backend and a separate OASIS web/operational service. | A public web preview, user connection to L1/L2 and a verified asset pipeline. | The UE 5.7 client, Nanite/Lumen/MetaHuman, a WebGPU renderer and Pixel Streaming. |
| **L5 Free World** | Coinbase tracker, API, database grant/project workflow and a service on Edge. | A trustworthy public UI, project catalogue, impact evidence, grant review and governance UX. | A global network of water/soil/energy projects; no specific impact may be presented as verified without an independent report. |
| **L6 Issobella** | Coinbase tracker, mission/research proposal API and a service on Edge. | Transparent DeSci workflow, peer review, open data and reproducible simulations. | The orbital programme is a long horizon; a quantum/warp engine is a hypothesis, not a technology or a financial promise. |

---

## 3. L1 — Ararat: what holds the ark

### LIVE

- V31 L1 runs nodes, a public pool and a CPU-only miner on Edge; within direct control on 2026-08-31 the node RPC responded healthily and the chain had **23 000+ blocks**. The current count is always verified via `getStatus`, never from this page.
- **Ekam Deeksha v3.2** is the active consensus: 512 KiB scratchpad, two AES passes, 128 random reads and a Keccak256 final hash — see the `internal repository`.
- **LWMA-60** has a target block time of 60 s and protections against extreme swings in solution time — see the `internal repository`.
- **Native UTXO v2** uses the length-prefixed BLAKE3 domain tag `ZION_TX_V2\0`; the wallet SDK and CLI send through `submitUtxoTransaction`.
- **L1 HTLC lock → claim** has a documented live E2E report and the core contains lock/claim/refund validation tests.
- Trinity mining is documented on reference GPU rigs; Edge itself remains CPU-only, because it has no production GPU.

### An important tokenomic precision

The emission constants are **89 % miner / 5 % humanitarian / 5 % Issobella / 1 % pool-fee slot**. The current design allows the last 1 % **after activation of `node_reward_activation_height`** to be minted into the node-reward pool; **before activation this share is burned**. It is not honest to claim that the node reward is already active until a specific active configuration and on-chain coinbase outputs confirm it.

### BUILDING

- Node rewards: registration, heartbeat, scoring and payout code exist; they require separate testnet/mainnet activation evidence.
- Any further consensus change requires a security review, tests, an explicit upgrade plan and also a "bardo guide" for operators — never marketing pressure.

---

## 4. L2 — Bridges have the strictest evidence bar

### LIVE

- The `internal service` / `warpd` has a health endpoint and an operational instance.
- **Base + ZION L1** are the current WARP pilot: the E2E report for 100 ZION lock → 100 wZION mint on Base → burn → L1 unlock is given in the `internal repository`.
- The DEX quote API (`/v1/swap/quote`, `/v1/swap/quote/multi`) and the web widget are deployed; an unauthorised live quote has been verified.
- ZIS runs at `auth.zionterranova.com`; the health endpoint and the session integration between the web and L2 are documented.

### BUILDING

- `ZionDexZis.md` lists Phases 0–7 (wallet derivation, deposit watchers, ledger, execution/withdraw paths) as implemented in `main`, but a **full financially funded E2E deposit → swap → withdraw** requires a subsequent real test with funding and evidence of settlement. `insufficient balance` is a correct security refusal, not proof of settlement.
- The intent/solver architecture and auth exist, but a production independent solver federation must not be labelled live if it is switched off in the runtime configuration.
- Custodial vs. non-custodial interfaces must be clearly marked for the user. No product may conceal who manages the keys or how recovery works.

### HORIZON

- `warp.example.toml` today has only `base` and `zion-l1` active; Arbitrum, Optimism, Polygon, Bitcoin, Solana, SUI, Aptos, Lightning and others are explicitly disabled with a `disabled_reason`.
- **Passkeys/WebAuthn, Face ID/Touch ID/Windows Hello and YubiKey integration are not found in the current ZIS source tree.** They are a legitimate 3.3 workstream, but not a current feature.
- Zero-knowledge reputation/Dharma proofs are a research goal without an existing circuit/proof system.

---

## 5. L3 — Hiranyagarbha: a helper, not an authority

### LIVE

- `zion-ai-native` contains the Hiran/Hiranyagarbha model, Maestro CLI, task graph, tool registry, message bus, health polling, RAG/memory abstractions and extensive unit tests.
- `DharmaValidator` exists as a **heuristic keyword-based check** plus tests of clean, harmful and manipulative text. It is a useful guard, but **it is not proof that AI can solve ethics, context or safety**.

### BUILDING

- Hiran v2.3 is a trained model artifact stored outside Edge; `docs/3.0.6/HIRAN_OVERVIEW.md` explicitly states that there is no GGUF model and no inference service on Edge.
- Hiran v2.4 Maestro is MVP orchestration code. For production use it needs sandboxed tools, an audit log, trustworthy inference infrastructure, load/security tests and a human approval model.
- The NCL crate and related schedulers exist; a live marketplace or on-chain rewards for AI work are not documented.

### HORIZON

- Hiran v2.5 **Amṛtabhoja** and its public narrative face "Amitābha" are a development vision for a natural intent interface and limited agents. Any future agent may function only in accordance with [`05-Autonomie-a-Bezpecnost.md`](./05-Autonomie-a-Bezpecnost.md).

---

## 6. L4–L6 — world, care and research

### L4 OASIS

**LIVE:** the `zion-oasis` backend and the OASIS web are listed as active in operational sources.  
**BUILDING:** UX, story, avatars, marketplace connection and the web preview require separate E2E criteria.  
**HORIZON:** Unreal Engine 5.7, Nanite, Lumen, MetaHuman, WebGPU and Pixel Streaming are not implemented in the current tree. The single "UE5 client" reference in the API documentation is not proof of a client.

### L5 Free World

**LIVE:** the daemon scans the L1 coinbase; the API contains grants, projects, fund status and the DAO submission workflow.  
**BUILDING:** a publicly comprehensible portal, maps, review, recipient audits, reporting of results.  
**HORIZON:** a global network of humanitarian programmes; an individual project may be presented as "verified impact" only with a public budget, recipient, on-chain connection and an independent outcome report.

### L6 Issobella

**LIVE:** the daemon scans the coinbase; the API records the mission and research proposal workflow.  
**BUILDING:** DeSci publication rules, open data, peer review, replication of simulations and transparent grant decisions.  
**HORIZON / HYPOTHESIS:** cosmic research, an orbital observatory and qualified physics experiments. Proposals around Alcubierre metrics, toroidal fields, ZPE or a "quantum/warp engine" are **research hypotheses** and must not be presented as verified mechanisms, working engines or energy solutions.

---

## 7. The baseline commitment for 3.3

V3.3 does not begin by adding more big words. It begins by giving every horizon:

1. **its own boundary** — what is not finished;
2. **its own evidence** — how it is recognised that it is finished;
3. **its own security model** — what cannot happen without consent;
4. **its own human value** — whom it serves and how concretely;
5. **its own possibility of admitting failure** — because a hypothesis that cannot be refuted is neither science nor good engineering.

The practical translation of this commitment is in [`04-Exekucni-Charta-3.3.md`](./04-Exekucni-Charta-3.3.md).

---

*[Back to the Mise Amenti index → `README.md`](./README.md)*
