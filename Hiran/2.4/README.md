# Hiran 2.4 — Maestro (Orchestrator)

Design docs zachovány v `archive/HiranV2.4/` (zkopírováno sem):

- `ARCHITECTURE_v2.4.md` — celková architektura
- `AGENT_HIERARCHY_v2.4.md` — hierarchie agentů
- `SERVICE_MESH_v2.4.md` — service mesh
- `TOOL_REGISTRY_v2.4.md` — tool registry
- `PROPOSAL_v2.4.md`, `cloude.md`
- `docs/3.0.6/HIRAN_V2.4_DEV_PLAN.md` — dev plán

## Implementační základ existuje

`V31/L3/ai-native/` (29 modulů, ~10k ř.) už obsahuje orchestrator
substrát: `orchestrator.rs`, `task.rs`, `message_bus.rs`, `tool_registry.rs`,
`pool_optimizer.rs`, `warp_agent.rs`, `intent.rs`, `planner.rs`,
`layer_agents.rs`. Dev práce = napojení na živé služby (node/pool/warpd)
+ LLM reasoning loop (v2.3+ model přes `llm_backend.rs`).

Service na Edge: `zion-v31-ai-native.service` (unit v
`/mnt/data/zion-backups/edge/etc-systemd/`).
