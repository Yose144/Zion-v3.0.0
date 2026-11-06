# 05 — Autonomy and safety
## Hiran, Maestro and the future Amitabha/Amṛtabhoja interface: a helper under a human mandate, never a hidden ruler

> **Normative status:** a binding security framework for any agentic, AI or automation system labelled L3, Hiran, Maestro, Amitabha or Amṛtabhoja.  
> **Default state:** the existing `DharmaValidator` is a heuristic text check; it is not a formal security proof, it is not a moral arbiter and it does not give an agent the right to act.

---

## 1. The basic rule: a person holds the intent, the permission and the ability to stop

L3 exists in order to reduce a person's cognitive load: to explain the system, find connections, prepare a plan, simulate choices and help reveal risk. It does not exist to replace human responsibility or to create a new invisible administrator of the network.

Every agentic action must therefore answer five questions:

1. **Who gave the mandate?** There must be an identifiable person, a DAO process or a pre-approved operational runbook.
2. **What exactly is permitted?** Capabilities are minimal, time-limited, purpose-bound and revocable.
3. **How is the action shown before execution?** The person must see the plan, the inputs, the outputs, the risks, the costs and the reversibility.
4. **How is the action stopped or reverted?** There must be a kill switch, an audit log and a recovery procedure; irreversible actions have the highest approval threshold.
5. **Who bears responsibility?** Never "AI". Always a specific person or a formally defined governance process.

---

## 2. The true state of the current Dharma Validator

In the `internal repository` there is a `DharmaValidator` with **seven checks**:

| Code principle | What it flags today | Canonical technical interpretation |
|---|---|---|
| **Ahimsa** | harm to life or to a system | prevention of harm; security review; never the justification of an attack "for the greater good" |
| **Satya** | falsehood or manipulation | evidence, provenance, uncertainty and the correction of a false claim |
| **Asteya** | theft of data, XP or energy without consent | authorisation, consent, privacy and the prohibition of exfiltrating secrets |
| **Brahmacharya** | wasting computational energy without purpose | proportionality, cost limits, an energy-efficiency plan |
| **Aparigraha** | accumulation that blocks flow | least privilege, budgets, transparent stewardship of shared resources |
| **Oneness** | deepening separation | interoperability, accessibility, the prohibition of discrimination and of a cult of the enemy |
| **Golden Age** | resistance to the evolution of the network's consciousness | in production language: to verifiably support safety, resilience and a person's ability to decide — not ideological obedience |

**An important limit:** the current implementation works with a keyword heuristic (`validate_text`); the code comment explicitly says that any production integration with an LLM classifier lies in the future. A heuristic can catch obviously harmful text, but **it cannot safely recognise intent, context, legal impact or hidden harm**. It is therefore only one small layer among many: never a standalone release gate.

`DharmaScore` additionally works with the qualities **karuṇā** (compassion), **prajñā** (wisdom) and **dāna** (generosity). These qualities are a useful ethical direction, but they are not in themselves a mechanism of authorisation nor a measure of human value.

---

## 3. Permitted levels of autonomy

| Level | Name | What the agent may do | What always remains with the person |
|---|---|---|---|
| **A0** | Reader | Read public metrics, documentation and its own data; summarise. | The decision and all side effects. |
| **A1** | Adviser | Propose a plan, point out a risk, explain a transaction or an incident. | Approval of the plan, choice of action, content of communication. |
| **A2** | Simulator | Dry-run, testnet, fixture data, local sandbox, proposing a patch/diff. | Access to production, real finances and other people's data. |
| **A3** | Assistant with confirmation | Prepare a precisely determined, visible and reversible step; execute it only after independent human confirmation. | The signature, the release of a budget, the production approval and the possibility to refuse the action. |
| **A4** | Limited executor | One idempotent, pre-authorised and audited step under a short-lived capability token. | The creation of the capability, the limits, revocation, the kill switch, checking the result. |

**A5 does not exist.** The system is not to have a category of "fully autonomous sovereign executor" with open access to production, treasury or people.

---

## 4. Actions that are always forbidden without an explicit, independent human process

No L3 agent may by itself:

- sign or broadcast financial transactions, trade, lend, stake, arbitrage or change the custody of funds;
- read, store, print, pass to a model or send to logs a seed phrase, private keys, API tokens, session cookies or other secrets;
- change consensus rules, node configuration, the firewall, UFW/fail2ban, DNS, TLS, CI/CD, release artifacts or production systemd services;
- approve its own proposals, create new roles for itself, escalate permissions or bypass review;
- contact people, publish content, create accounts, purchase services or produce any other external side effect on behalf of the user without a separate mandate;
- classify a person as an "enemy", a "lower being", "unclean", or otherwise use the archetypes of NirvanaCloud for discrimination or pressure.

For a production exception there must be at least **two independent human approvals**, an audit trail, a scope/budget/time limit and a test in a non-production environment — or a formalised DAO process with exactly the same oversight.

---

## 5. Agent keys, wallet and finance — a design constitution for BUILDING/HORIZON

If L3 is to work with an identity or a wallet in the future, the following conditions must hold before the first production action:

1. **No master seed in the model's context.** Keys remain outside the LLM runtime, in an HSM/MPC/OS secure store or in a user-controlled signer.
2. **A separate identity.** The agent account is not identical with the user's personal wallet nor with the treasury.
3. **A capability instead of an identity.** The agent obtains a signed permission for a specific act, asset, recipient, amount and time; not "access to the wallet".
4. **A hard limit.** The daily, per-transaction, per-chain and per-address limit is enforced below the LLM layer.
5. **Explicit simulation.** Before signing, the system shows the asset, decimals, network, address, fee, slippage, conditions and reversibility in human language.
6. **Two-phase execution.** Plan → human review → signed intent → independent executor → receipt/reconciliation.
7. **Immediate revocation.** The user and the security operator can invalidate the capability without waiting for the agent.
8. **Independent audit.** The log is append-only, contains no secrets and can be correlated with an on-chain transaction ID.

Until these points are implemented, tested and externally reviewed, every claim about an "agent wallet", "Auto-DeFi" or "autonomous arbitrage" remains **HORIZON**.

---

## 6. The safe format of every agent response

Every agent proposal that may affect software, finances, users or public communication should have an output readable by both machine and human:

```text
INTENT:       What the user wants to achieve.
PLAN:         Steps, dependencies and assumptions.
EVIDENCE:     References to sources, metrics and the state of the claim.
RISKS:        Safety, finances, privacy, reversibility, uncertainty.
ALTERNATIVES: Safer / cheaper / simpler variants.
ACTION:       Only a dry-run, a proposal, or a specific step.
APPROVAL:     Who must confirm and how.
ROLLBACK:     How the step is stopped, reverted or remedied.
AUDIT ID:     A correlation identifier without secret data.
```

An agent that cannot show its limits and its uncertainty should not be considered ready for higher autonomy.

---

## 7. Incident mode

On suspicion of prompt injection, a data leak, misuse of a tool, unusual behaviour or a harmful proposal:

1. **Stop capability tokens and external tool calls.**
2. **Switch to read-only A0 mode.**
3. **Preserve a minimal audit trail without secrets.**
4. **Isolate the sandbox, rotate any exposed permissions and check the on-chain/ops consequences.**
5. **Investigate with a human security reviewer.**
6. **Publish a proportionate incident report** if the incident affected users, the network or a public claim; correction takes precedence over reputation.

No agent may "repair" itself by hiding a log, deleting a trace or silently applying a patch in production.

---

## 8. What "Amitabha" actually means

In the public narrative, Amitabha is the image of a **clear, kind interface** that translates human intent into comprehensible options. Technically that means:

- more clarity, not more magic;
- more user control, not less;
- more explainability, not hidden orchestration;
- more resistance to manipulation, not a new form of central authority.

A name does not bestow wisdom on a system. A system can only prove it repeatedly: by correctly refusing a dangerous action, by precisely admitting uncertainty and by allowing a person to say **no**.

---

*[Back to the Mise Amenti index → `README.md`](./README.md)*
