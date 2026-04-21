# REPORT SESSION 2026-04-21 — L3 ORCHESTRATOR AND CLI FOUNDATION

## Scope

This session closed three previously open threads and started the next operator-facing phase:

1. corrected the public L2/L3 architecture surfaces,
2. deployed the first V3 AI Native HTTP runtime on the Prague mainnet host,
3. established the first canonical documentation baseline for the unified `zion` CLI.

## Executive Summary

The important architectural conclusion is that `L3/ai-native` should currently be treated as an orchestrator and control-plane runtime, not as a requirement for large local inference on the main production host.

That conclusion matches both the codebase direction and the present hardware reality:

- Prague production is a small host with limited RAM and no GPU,
- Ollama-compatible inference can exist behind the runtime when available,
- the reliable default posture today is orchestration over L1, L2, and L3 services with graceful fallback when a heavyweight model backend is unavailable.

In practice, Hiranyagarbha is now deployed as a service facade for:

- health and status,
- memory and RAG endpoints,
- task and integration surfaces,
- WARP and NCL visibility,
- future operator automation.

## What Was Delivered

### 1. Public architecture correction

The website was corrected so the public stack no longer mislabels the layers.

Canonical mapping after the correction:

- L1 = blockchain core, pool, miner,
- L2 = bridge, DAO, DeFi,
- L3 = AI Native, WARP, NCL,
- L4 = OASIS,
- L5 = Free World,
- L6 = Issobella.

The changes covered feature cards, roadmap surfaces, Terra Nova public text, and derived copy used in the live website deploy.

### 2. First deployable V3 AI Native runtime

A new HTTP runtime binary was added for `V3/L3/ai-native` and deployed through the main production compose stack.

Delivered pieces:

- `V3/L3/ai-native/src/bin/zion-ai-native-api.rs`,
- `docker/Dockerfile.v3.ai-native`,
- `docker/docker-compose.v3-mainnet.yml` service wiring,
- `V3/cli` deploy service mapping alignment,
- firewall/deploy source-of-truth updates for port `8001`.

Verified state on the Prague host:

- container healthy,
- `/health`, `/status`, and `/chat` respond locally on the server,
- port `8001` is bound on the host,
- runtime currently operates in `remote+echo-fallback` mode because no reliable production LLM backend is yet attached.

## Architectural Conclusion

### Why orchestrator-first is the right posture now

The shared GPU planning discussion is directionally useful, but it should not distort the current production shape.

Right now we do not have the hardware budget to design Prague around heavyweight local inference.

The correct near-term model is:

- `zion agent` = operator and orchestration gateway,
- model backends = optional pluggable dependency,
- state and service visibility = first-class,
- graceful degradation = required,
- local GPU inference = future enhancement, not a present assumption.

### What this means for implementation

For the next phase, AI Native should prioritize:

- service discovery,
- runtime control,
- deployment and health introspection,
- task routing,
- memory/RAG operator workflows,
- bridge, DAO, WARP, and NCL coordination.

It should not assume:

- a large local VRAM budget,
- reliable on-host training or large model serving,
- that Prague is the right place for high-end inference.

## CLI State After This Session

The unified `zion` CLI already covers a broad cross-layer surface:

- top-level orchestration for service lifecycle,
- L1 node, pool, miner, and wallet,
- L2 bridge and DAO,
- L3 AI Native agent, WARP, and NCL,
- deploy, monitor, explorer, and completions.

One immediate robustness issue was corrected during this session: the top-level help text for `start`, `stop`, and `restart` now reflects the actual supported service surface instead of a stale subset.

## Remaining Gaps

The CLI is useful, but it is not yet complete as a production-grade operator interface.

Key gaps:

1. command coverage is broader than the documentation,
2. there is no canonical CLI reference on the public docs site,
3. there is no CLI FAQ for operators,
4. some commands remain read-only or dry-run oriented,
5. there is still no single consolidated service matrix for all startable stack components.

## Next Recommended Phase

1. expand CLI reference and examples until every command group has a canonical usage path,
2. document service lifecycle and deployment semantics in one operator guide,
3. add robust CLI FAQ for node, miner, bridge, agent, and deploy workflows,
4. mirror the public-safe subset into website docs,
5. only after that deepen the runtime from orchestrator-first toward richer automation.

## Final Position

The project should currently communicate AI Native as:

"L3 orchestration and control plane over the ZION stack, with optional model backends where hardware permits."

That statement is both technically honest and operationally aligned with the infrastructure we actually have.