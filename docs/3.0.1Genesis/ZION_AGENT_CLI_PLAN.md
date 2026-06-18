# ZION Agent CLI — Autonomous Operator

> **Vision:** A standalone, Devin.ai-style autonomous agent CLI for the ZION ecosystem. Not a chatbot. Not inside V3. A first-class operator that reads code, edits files, runs commands, plans tasks, and executes them with minimal human intervention — powered by Hiran v2.3/v2.4 and beyond.
>
> **Architecture:** Local Rust CLI (`zion-agent`) + remote Hiran inference (Vast AI A100) + native tool use across the entire ZION stack.
>
> **Scope:** Inference & operations only. Training stays external.

---

## 0. Executive Summary — What Already Exists

Before building anything new, here is the complete inventory of AI/agent infrastructure already in the repo:

### V3 Layer 3 — `zion-ai-native` (Rust crate)
Located at `V3/L3/ai-native/`. Already contains:
- **`orchestrator.rs`** — Agent lifecycle manager, weighted voting, agent registry
- **`consciousness.rs` / `consciousness_engine.rs`** — 7-level consciousness system (L0-L6), self-awareness, evolution
- **`memory.rs`** — AgentMemory with episodic/semantic storage
- **`rag.rs`** — VectorStore with embedding backends
- **`task.rs`** — TaskQueue with AiTask types and statuses
- **`message_bus.rs`** — Typed inter-agent communication bus
- **`hiran_inference.rs`** — HiranInferenceClient with HybridInferenceBackend
- **`llm_backend.rs`** — LlmBackend trait (EchoBackend, RemoteHttpBackend)
- **`pool_optimizer.rs`** — PoolOptimizer with recommendations
- **`warp_agent.rs`** — WarpField optimizer for cross-chain routing
- **`autotuner.rs`** — Auto-tuning engine
- **`oasis_bridge.rs`** — L3→L4 Oasis game bridge
- **`telemetry.rs`** — Telemetry feed from node/pool

**Status:** Architecture is solid. Needs wiring to real inference + tool use.

### ZION OS — Agent (Rust binary)
Located at `ZION_OS/agent/`. A **mining rig agent** — not a coding agent:
- GPU telemetry (AMD sysfs, NVIDIA NVML placeholder)
- Miner start/stop/restart with stdout parsing
- Watchdog engine with YAML rule expressions
- OC manager for AMD GPU profiles
- Fleet telemetry upload
- OTA updater
- HTTP API on :8767

**Status:** Production-ready for mining rigs. Different domain from coding agent.

### ZION OS — Orchestrator (Python)
Located at `ZION_OS/orchestrator/orchestrator.py` + `manifest.yaml`.
Service mesh orchestrator. Likely handles Docker Compose / systemd service lifecycle.

### Hiran v2.4 Design Docs
Located at `HiranV2.4/` — **the most comprehensive plan**:
- `PROPOSAL_v2.4.md` — Full orchestrator vision (ReAct engine, tool registry, service mesh, auto-remediation, governance)
- `ARCHITECTURE_v2.4.md` — Hierarchical multi-agent architecture (Maestro → L1/L2/L3 agents → sub-agents)
- `AGENT_HIERARCHY_v2.4.md` — Agent roles and capabilities
- `SERVICE_MESH_v2.4.md` — Service discovery & health checks
- `TOOL_REGISTRY_v2.4.md` — Complete tool definitions for all layers

**Status:** Design phase only. No code yet.

### OpenClaw Wrapper
Located at `scripts/openclaw-hiran-wrapper/claude`.
Bash script that masquerades Hiran v2.2 (Ollama) as Claude Code for OpenClaw coding-agent skill.

**Status:** Works but crude. No tool use, no file editing.

---

## 1. The Gap — What Is Missing

Despite all the above, **no single component** delivers a Devin.ai-style experience:

| Capability | Existing | Gap |
|---|---|---|
| Read codebase, understand structure | Partial (RAG in ai-native) | No recursive file reading + analysis |
| Edit files (replace, insert, delete) | None | Missing entirely |
| Run shell commands & capture output | Partial (ZION_OS agent has shell) | No integration with inference |
| Plan multi-step tasks | Partial (ai-native TaskQueue) | No ReAct loop with LLM |
| Tool use (LLM calls tools) | None | Missing entirely |
| Git operations (diff, commit, push) | None | Missing entirely |
| Code review (PR/Branch analysis) | None | Missing entirely |
| Self-correction (test → fix → retest) | None | Missing entirely |
| Natural language → CLI commands | Partial (zion CLI menu) | No agentic translation |
| Remote training ops (checkpoint pull, etc.) | External PowerShell script | No unified interface |
| AI Marketplace / plugin system | None | Missing entirely |

**The missing piece is a standalone CLI that combines:**
1. **Local tool execution** (file I/O, shell, git, cargo, npm)
2. **Remote inference** (Hiran v2.3/2.4 on A100)
3. **Agent loop** (observe → think → plan → act)
4. **Memory & context** (session + project knowledge)
5. **Safety guardrails** (L1 protection, destructive ops confirmation)

---

## 2. Target Product: `zion-agent` CLI

A **new top-level binary**, not inside V3. Lives at `ZION_OS/agent-cli/` or root `agent-cli/`.

```bash
# Installation
curl -sSL https://zion.network/install-agent | bash
# → installs ~/.zion/bin/zion-agent

# --- Autonomous task execution ---
zion-agent run "Refactor pool share validation to use algorithm-aware dispatch"
# [agent] Reading pool/src/validation.rs...
# [agent] Found submit_solution() using hardcoded deeksha_lite_v1.
# [agent] Plan:
#   1. Add algorithm field to Share struct
#   2. Update validate_candidate_with_algorithm()
#   3. Update pool.submit_solution() call site
#   4. Run cargo test -p zion-pool
# Proceed? [Y/n/edit-plan]

# --- Interactive session ---
zion-agent session
# 🤖 Hiran Agent v2.3 | Model: hiran-v2.3-merged | Context: 128K
# > Fix the failing test in emission.rs
# [agent] Reading V3/L1/core/src/emission.rs...
# [agent] Found test_fee_split_validity failing. The fee split is 89/5/5/1 but test expects 90/5/5/0.
# [agent] Which is correct? (I will not modify L1 without confirmation)
# > The 89/5/5/1 is constitutional. Update the test.
# [agent] Editing test... Done. Running cargo test -p zion-core... PASS.
# [agent] Commit? [Y/n]

# --- Code review ---
zion-agent review --branch feat/dual-algo-pool
# [agent] Analyzing diff (42 files changed)...
# [agent] Found 3 potential issues:
#   1. pool/src/validation.rs:42 — algorithm parameter not validated for null
#   2. miner/src/gpu_backend.rs:88 — RDNA1 detection missing fallback
#   3. No tests for new `deeksha_lite_fire` share validation path
# Report saved to review-feat-dual-algo-pool.md

# --- Training & model ops ---
zion-agent train status
# Remote: ssh1.vast.ai:31384
# Step: 3940/8901 (44%) | Loss: 0.053 | GPU: 78°C/81°C | Est. completion: ~14h

zion-agent checkpoint pull 4000
# Downloading checkpoint-4000 adapter (2.1 GB)...
# ████████████████████████████████████████ 100% | 2.1 GB | 12 min
# Verifying SHA-256... OK.
# Saved to ~/HiranV2.3-Checkpoints/checkpoint-4000/

zion-agent model merge --checkpoint 4000 --output hiran-v2.3-4000
# Merging adapter into Qwen3-32B... (~30 min on A100)
# Converting to GGUF q5_k_m... (~20 min)
# Model ready: ~/HiranModels/hiran-v2.3-4000-q5.gguf

zion-agent serve --model hiran-v2.3-4000-q5.gguf
# Auto-detecting backend...
# Found llama-server.exe at C:\tools\llama.cpp\llama-server.exe
# Starting on http://localhost:8000
# Ready. Use `zion-agent chat` to interact.

# --- Infrastructure monitoring ---
zion-agent monitor --watch node,pool,miner
# [14:32] Node: SYNCED (height 1,847,291)
# [14:32] Pool: ONLINE (47 workers, 2.3 TH/s)
# [14:32] Miner: RUNNING (Fire, 18.1 KH/s, 68°C)
# [14:33] ALERT: Miner hashrate dropped to 0 for 30s
# [14:33] AUTO-FIX: Restarting miner... OK. Hashrate restored to 17.8 KH/s.

# --- AI Marketplace (future) ---
zion-agent marketplace list
# Available agents:
#   hiran-v2.3-zion-oracle     — Zion domain Q&A
#   hiran-v2.3-code-reviewer   — Code review specialist
#   hiran-v2.3-security-audit  — L1 security auditor
#   hiran-v2.3-docs-writer     — Documentation generator
#   hiran-v2.4-orchestrator    — Full system orchestrator (coming soon)

zion-agent marketplace install hiran-v2.3-code-reviewer
zion-agent run --agent hiran-v2.3-code-reviewer "Review PR #42"
```

---

## 3. Architecture

### 3.1 Directory Layout (New, Outside V3)

```
ZION_OS/agent-cli/              # or root agent-cli/
├── Cargo.toml                  # Rust workspace root
├── README.md
├── PLAN.md                     # This document
├── src/
│   ├── main.rs                 # CLI entry (clap), command dispatch
│   ├── config.rs               # AgentConfig, HiranConfig, LlmConfig
│   ├── agent_loop.rs           # Core ReAct loop: observe → think → plan → act
│   ├── session.rs              # Interactive REPL session
│   ├── planner.rs              # Task decomposition & dependency graph
│   ├── reviewer.rs             # Code review (git diff analysis)
│   ├── monitor.rs              # Infrastructure monitoring daemon
│   ├── model_ops.rs            # Merge, convert, checkpoint sync
│   ├── marketplace.rs          # Agent marketplace client (future)
│   ├── llm/
│   │   ├── mod.rs              # LlmClient trait
│   │   ├── remote.rs           # OpenAI-compatible API client
│   │   ├── local.rs            # Ollama / llama.cpp local fallback
│   │   └── streaming.rs        # SSE streaming response handler
│   ├── tools/
│   │   ├── mod.rs              # ToolRegistry, Tool trait
│   │   ├── file.rs             # read_file, write_file, edit_file, search
│   │   ├── shell.rs            # shell exec with safety allowlist
│   │   ├── git.rs              # git status, diff, commit, push
│   │   ├── cargo.rs            # cargo check, test, build
│   │   ├── npm.rs              # npm install, build, test
│   │   ├── docker.rs           # docker compose, logs
│   │   ├── zion_rpc.rs         # zion node RPC calls
│   │   ├── hiran_train.rs      # SSH to Vast, check training, pull checkpoints
│   │   └── web.rs              # HTTP GET/POST for external APIs
│   ├── memory/
│   │   ├── mod.rs              # Memory trait
│   │   ├── session.rs          # In-memory session context
│   │   └── project.rs          # Persistent project knowledge (SQLite)
│   ├── safety/
│   │   ├── mod.rs              # Safety checker
│   │   ├── l1_guard.rs         # Blocks L1 consensus edits
│   │   ├── destructive_guard.rs # Confirms rm, git push, etc.
│   │   └── secret_guard.rs     # Blocks credential exposure
│   └── ui/
│       ├── mod.rs              # Terminal UI helpers
│       ├── spinner.rs          # Progress indicators
│       ├── diff.rs             # Pretty-print file diffs
│       └── markdown.rs         # Render markdown in terminal
├── tests/
│   └── e2e/
│       └── agent_smoke.rs      # End-to-end smoke tests
└── systemd/
    └── zion-agent-cli.service  # Optional daemon mode
```

### 3.2 Runtime Model

```
┌────────────────────────────────────────────────────────────────┐
│  Local Machine (Windows 11 / Linux / macOS)                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │          zion-agent CLI (Rust binary)                   │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  │  │
│  │  │  CLI    │  │  Agent  │  │  Tool   │  │  Memory  │  │  │
│  │  │  Parser │  │  Loop   │  │  Engine │  │  Manager │  │  │
│  │  │ (clap)  │  │ (ReAct) │  │         │  │          │  │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘  │  │
│  │       └─────────────┴─────────────┴────────────┘        │  │
│  │                         │                               │  │
│  │  ┌──────────────────────┴──────────────────────┐        │  │
│  │  │           Safety Layer (L1 Guard, etc.)     │        │  │
│  │  └─────────────────────────────────────────────┘        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         SSH tunnel (optional)│  HTTP API                       │
│                              │  (OpenAI-compatible)            │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Vast AI A100 80GB (ssh1.vast.ai:31384)                │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │  llama-server / vLLM / TGI                     │    │  │
│  │  │  Model: hiran-v2.3-merged (32B params)        │    │  │
│  │  │  Context: 128K tokens                          │    │  │
│  │  │  API: /v1/chat/completions                   │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │  SCP / SSH                      │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Training Server (same Vast instance)                   │  │
│  │  - Training logs, checkpoints, trainer_state.json       │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Agent Loop (ReAct with Tools)

```rust
pub async fn run_agent_loop(task: &str, cfg: &AgentConfig) -> Result<TaskResult> {
    let mut state = AgentState::new(task);
    let llm = LlmClient::new(&cfg.llm);
    let tools = ToolRegistry::default();
    let safety = SafetyChecker::new();

    for step in 0..cfg.max_steps {
        // 1. OBSERVE: Build context from memory + last observation
        let context = state.build_context();

        // 2. THINK: Call LLM with tools schema
        let response = llm.chat_with_tools(&context, &tools.schema()).await?;

        // 3. SAFETY CHECK
        if let Some(tool_call) = &response.tool_call {
            if !safety.is_allowed(tool_call)? {
                state.add_safety_block(tool_call);
                continue; // Ask LLM to try something else
            }
        }

        // 4. ACT: Execute tool or finish
        match response {
            LlmResponse::ToolCall(tc) => {
                let result = tools.execute(&tc).await?;
                state.add_observation(&tc, &result);

                // Special: if tool is "think", just add to reasoning
                // Special: if tool is "finish", return result
            }
            LlmResponse::Done(answer) => {
                return Ok(TaskResult::Success { answer, steps });
            }
            LlmResponse::Question(q) => {
                return Ok(TaskResult::NeedsInput { question: q });
            }
        }

        // 5. Auto-approval for safe ops, pause for risky ones
        if response.requires_approval() {
            match prompt_user_approval(&response).await? {
                Approval::Yes => continue,
                Approval::No => return Ok(TaskResult::Cancelled),
                Approval::Edit => { /* let user edit plan */ }
            }
        }
    }

    Ok(TaskResult::MaxStepsReached)
}
```

### 3.4 Tool Schema (JSON for LLM)

```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read file contents. Use offset/limit for large files.",
      "parameters": {
        "path": { "type": "string", "description": "Absolute or relative path" },
        "offset": { "type": "integer", "description": "Start line (1-based)", "default": 1 },
        "limit": { "type": "integer", "description": "Max lines to read", "default": 100 }
      }
    },
    {
      "name": "edit_file",
      "description": "Replace exact text in a file. old_string must match exactly.",
      "parameters": {
        "path": { "type": "string" },
        "old_string": { "type": "string" },
        "new_string": { "type": "string" }
      }
    },
    {
      "name": "shell",
      "description": "Run a shell command. Prefer read_file/edit_file over sed/cat.",
      "parameters": {
        "command": { "type": "string" },
        "timeout": { "type": "integer", "default": 60 }
      }
    },
    {
      "name": "search",
      "description": "Search for pattern in codebase using ripgrep",
      "parameters": {
        "pattern": { "type": "string" },
        "path": { "type": "string", "default": "." }
      }
    },
    {
      "name": "git",
      "description": "Git operations",
      "parameters": {
        "subcommand": { "type": "string", "enum": ["status", "diff", "add", "commit", "push", "log", "branch"] },
        "args": { "type": "array", "items": { "type": "string" } }
      }
    },
    {
      "name": "cargo_test",
      "description": "Run cargo test for a package",
      "parameters": {
        "package": { "type": "string" },
        "test_name": { "type": "string" }
      }
    },
    {
      "name": "hiran_train_status",
      "description": "Check remote training status on Vast AI",
      "parameters": {
        "host": { "type": "string", "default": "ssh1.vast.ai:31384" }
      }
    },
    {
      "name": "hiran_checkpoint_pull",
      "description": "Download checkpoint from remote training server",
      "parameters": {
        "checkpoint_step": { "type": "integer" },
        "verify": { "type": "boolean", "default": true }
      }
    },
    {
      "name": "think",
      "description": "Pause to reason about the task before proceeding",
      "parameters": {
        "thought": { "type": "string" }
      }
    },
    {
      "name": "finish",
      "description": "Task is complete. Provide summary.",
      "parameters": {
        "summary": { "type": "string" },
        "deliverables": { "type": "array", "items": { "type": "string" } }
      }
    }
  ]
}
```

---

## 4. Roadmap

### Phase 0 — Foundation (This Week)
While v2.3 training runs (~12h remaining):
1. **Create `ZION_OS/agent-cli/` workspace**
2. **Implement core scaffolding:**
   - `main.rs` — clap CLI with subcommands (`run`, `session`, `review`, `monitor`, `train-status`, `checkpoint-pull`, `serve`, `chat`)
   - `config.rs` — TOML config (`~/.zion/agent-cli.toml`)
   - `llm/` — OpenAI-compatible client with streaming support
   - `tools/` — `read_file`, `shell`, `search`, `git`, `cargo_test`, `hiran_train_status`, `hiran_checkpoint_pull`
   - `safety/` — L1 guard, destructive ops confirmation
   - `ui/` — pretty terminal output with `crossterm` / `ratatui`
3. **Connect to local inference fallback:** Ollama with Qwen3-8B for development
4. **Test basic loop:** `zion-agent run "List all Rust files in V3/L1/core/src"`

### Phase 1 — Agent Core (Week 1)
1. **ReAct loop** with tool use
2. **Memory system:** session context + project knowledge (SQLite)
3. **Planner:** simple task decomposition ("fix test" → read file → edit → test → finish)
4. **Code review:** `zion-agent review --branch` analyzes git diff, reports issues
5. **Interactive session:** REPL with plan approval
6. **Safety:** L1 blocks, destructive op confirmations, secret scanning

### Phase 2 — Hiran Integration (Week 2)
After v2.3 training completes:
1. **Merge v2.3 LoRA** → full model → GGUF (on Vast AI)
2. **Deploy inference server** on Vast AI (llama-server / vLLM)
3. **Connect `zion-agent` to remote Hiran** via SSH tunnel
4. **Fine-tune prompts** for Zion domain (use existing RAG corpus)
5. **Benchmark:** Compare Hiran v2.3 vs Qwen3-32B base on Zion coding tasks

### Phase 3 — Advanced Ops (Week 3-4)
1. **Model ops:** `merge`, `convert`, `evaluate`, `deploy` commands
2. **Monitoring daemon:** `zion-agent monitor` with auto-remediation
3. **Multi-step autonomy:** Agent can refactor across 5+ files, run tests, commit
4. **Self-correction:** Test failure → read error → fix → retest loop
5. **Project memory:** Agent learns codebase structure, remembers patterns

### Phase 4 — Marketplace & Ecosystem (Month 2)
1. **Agent marketplace:** `zion-agent marketplace list/install/run`
   - Specialist agents: code-reviewer, security-audit, docs-writer, test-generator
   - Each is a DORA adapter or fine-tuned checkpoint
   - Distributed via HuggingFace + ZION on-chain registry
2. **Plugin system:** Third-party tools (e.g. `zion-agent plugin install jira`)
3. **Hiran v2.4 training:** Use v2.3 as base, train orchestration DORA
4. **Multi-agent:** Swarm of specialist agents coordinated by Maestro

---

## 5. AI Marketplace Vision

### 5.1 Concept

ZION AI Marketplace is a **decentralized registry of AI agents** where:
- **Creators** train and publish specialist agents (code reviewer, security auditor, etc.)
- **Users** discover, purchase (with ZION), and run agents locally
- **Validators** verify agent integrity (no backdoors, deterministic outputs)
- **Stakers** earn yield by hosting inference for popular agents

### 5.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION AI Marketplace                        │
├─────────────────────────────────────────────────────────────┤
│  Registry (on-chain, L2 bridge)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Agent    │ │ Version  │ │ Pricing  │ │ Validator│       │
│  │ Metadata │ │ History  │ │ Model    │ │ Signatures│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  Off-chain Storage (IPFS / Arweave)                        │
│  - Model weights (GGUF, DORA adapters)                     │
│  - Training datasets (hashed, encrypted)                   │
│  - Agent manifests (tool schemas, prompts)                 │
│                                                             │
│  Inference Network (NCL — AI Compute Marketplace)           │
│  - GPU providers host popular agents                        │
│  - Pay-per-token in ZION                                    │
│  - QoS guarantees (SLA)                                     │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Agent Types

| Agent | Purpose | Base Model | Training |
|---|---|---|---|
| `hiran-oracle` | Zion domain Q&A | v2.3 | DORA factual |
| `hiran-coder` | General coding | v2.3 | DORA code |
| `hiran-reviewer` | Code review | v2.3 | DORA review |
| `hiran-security` | L1 security audit | v2.3 | DORA security |
| `hiran-docs` | Documentation | v2.3 | DORA docs |
| `hiran-testgen` | Test generation | v2.3 | DORA testing |
| `hiran-orchestrator` | Full system ops | v2.4 | DORA orchestration |
| `hiran-trader` | Market analysis | v2.4 | DORA finance |

### 5.4 Hiran v2.5 Vision

Hiran v2.5 = **Multi-modal, multi-agent, self-improving**:
- **Vision:** Can read screenshots, charts, UI mockups
- **Voice:** Speech I/O for hands-free operation
- **Self-improvement:** Agent analyzes its own failures, updates prompts/training data
- **Meta-learning:** Few-shot adaptation to new codebases in <10 min
- **On-chain identity:** Agent has its own Zion wallet, signs actions, earns fees

---

## 6. Relationship to Existing Components

| Existing Component | Relationship to zion-agent CLI |
|---|---|
| `V3/cli` (zion CLI) | zion-agent is a **separate binary** that can call `zion` commands internally. V3/cli stays for direct human operators. |
| `V3/L3/ai-native` | zion-agent **consumes** ai-native as a library (orchestrator, memory, RAG). Ai-native stays as the on-chain agent framework. |
| `ZION_OS/agent` | Mining rig agent is **complementary**. zion-agent can control it via HTTP API (:8767). |
| `ZION_OS/orchestrator` | Python orchestrator handles Docker/systemd. zion-agent can call it for service lifecycle. |
| `HiranV2.4/` design docs | zion-agent is the **reference implementation** of the Hiran v2.4 vision. Code lives here, design docs stay in HiranV2.4/. |
| `scripts/openclaw-hiran-wrapper` | Replaced by native tool use in zion-agent. Wrapper can be deprecated. |

---

## 7. Safety & Governance

### 7.1 L1 Consensus Protection (CRITICAL)

Any tool call targeting `V3/L1/core/src/**` triggers:

```
⚠️  L1 CONSENSUS CODE DETECTED
Path: V3/L1/core/src/emission.rs
Action: edit_file

Editing L1 consensus code can break mainnet. This requires explicit override.

Options:
  [1] Cancel this action
  [2] Show plan and ask for approval
  [3] Override with --l1-unsafe (NOT RECOMMENDED)
```

### 7.2 Destructive Operations

| Operation | Behavior |
|---|---|
| `rm`, `rmdir` | Blocked entirely. Use `git rm` or `--force-destructive` |
| `git push` | Requires approval unless `--auto-push` |
| `git reset --hard` | Always requires approval |
| `cargo publish` | Always requires approval |
| Docker `down -v` | Always requires approval |
| Wallet tx send | Always requires 2FA + approval |

### 7.3 Secret Protection

- Agent cannot read files matching `*secret*`, `*key*`, `*.env`, `*wallet*`, `*mnemonic*`
- Agent cannot log or echo credentials
- Agent suggests rotation if secrets are detected in code

---

## 8. Acceptance Criteria

### Phase 0
- [ ] `cargo build` succeeds in `ZION_OS/agent-cli/`
- [ ] `zion-agent run "List Rust files in V3/L1/core/src"` returns accurate list
- [ ] `zion-agent train-status` connects to Vast AI and reports step/loss/GPU
- [ ] `zion-agent checkpoint-pull 3500` downloads and verifies checkpoint

### Phase 1
- [ ] Agent can read file, edit file, run `cargo test`, and report results
- [ ] Agent refuses to edit `V3/L1/core/src/` without override
- [ ] Interactive session shows plan before execution, asks for approval
- [ ] Code review generates markdown report with findings

### Phase 2
- [ ] Agent uses Hiran v2.3 for inference (not Qwen3 base)
- [ ] Agent can refactor across multiple files autonomously
- [ ] Agent self-corrects on test failures
- [ ] Agent can start/stop/monitor services via `zion` CLI

### Phase 3
- [ ] Marketplace registry schema defined
- [ ] At least 3 specialist agents available
- [ ] Hiran v2.4 orchestration DORA training planned

---

## 9. File Map

| New File | Description |
|---|---|
| `ZION_OS/agent-cli/Cargo.toml` | Workspace manifest |
| `ZION_OS/agent-cli/src/main.rs` | CLI entry + dispatch |
| `ZION_OS/agent-cli/src/config.rs` | TOML config management |
| `ZION_OS/agent-cli/src/agent_loop.rs` | Core ReAct loop |
| `ZION_OS/agent-cli/src/session.rs` | Interactive REPL |
| `ZION_OS/agent-cli/src/planner.rs` | Task decomposition |
| `ZION_OS/agent-cli/src/reviewer.rs` | Code review logic |
| `ZION_OS/agent-cli/src/monitor.rs` | Infra monitoring |
| `ZION_OS/agent-cli/src/model_ops.rs` | Merge/convert/checkpoint |
| `ZION_OS/agent-cli/src/llm/*.rs` | LLM client implementations |
| `ZION_OS/agent-cli/src/tools/*.rs` | Tool implementations |
| `ZION_OS/agent-cli/src/memory/*.rs` | Memory systems |
| `ZION_OS/agent-cli/src/safety/*.rs` | Safety guardrails |
| `ZION_OS/agent-cli/src/ui/*.rs` | Terminal UI |

| Modified | Description |
|---|---|
| `HIRAN_LOCAL_SETUP.md` | Add zion-agent setup instructions |
| `AGENTS.md` | Document agent-cli safety rules |

---

## 10. Next Steps

1. **Create `ZION_OS/agent-cli/` directory and `Cargo.toml`**
2. **Implement Phase 0 scaffolding** (CLI parser, config, basic tools)
3. **Continue monitoring v2.3 training** (checkpoint 4000 pull when ready)
4. **After training completes:** Merge → GGUF → deploy inference → connect agent

---

*Plan version: 2026-06-14*
*Status: Design complete. Ready for Phase 0 implementation.*
*Philosophy: Agent > Chatbot. Tools > Text. Actions > Words. Safety > Speed.*
