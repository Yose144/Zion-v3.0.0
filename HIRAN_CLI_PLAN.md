# Hiran Agent — Autonomous AI Operator Plan

> Goal: Build an **autonomous agent** powered by Hiran v2.3 (Qwen3-32B LoRA) that lives inside `zion` CLI. Not a chatbot — a Devin.ai-style operator that reads code, edits files, runs commands, plans tasks, and executes them with minimal human intervention.
>
> Architecture: **Hybrid** — local agent orchestrator (lightweight Rust CLI) + remote inference on Vast AI A100.

---

## 1. Vision

`zion agent` is your AI co-developer for the ZION ecosystem:

```bash
# Give the agent a task and let it work
zion agent run "Refactor the pool share validation to use algorithm-aware dispatch. Run tests. Commit if passing."

# Agent reviews your PR
zion agent review --branch feat/dual-algo-pool

# Agent monitors infrastructure and fixes issues
zion agent monitor --watch node,pool,miner --auto-fix

# Agent helps with training operations
zion agent train-status              # checks remote training
zion agent checkpoint-backup         # pulls latest checkpoint, verifies, reports
zion agent merge-and-convert 3500    # merges adapter → full → GGUF

# Interactive autonomous session
zion agent session
# [agent] Reading codebase...
# [agent] Found 3 files related to pool share validation.
# [agent] Planning: 1) Add algorithm field to Share struct, 2) Update validate(), 3) Test
# [agent] Proceed? (y/n/edit plan)
```

The agent has **tool use**, **memory**, **planning**, and **self-correction**.

---

## 2. Architecture

### 2.1 Hybrid Runtime

```
┌─────────────────────────────────────────────────────────────┐
│  Your PC (Windows 11)                                       │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ zion CLI (Rust)     │  │ Agent Orchestrator          │  │
│  │ - Tool dispatcher   │←→│ - Planning loop             │  │
│  │ - File I/O          │  │ - Memory / context manager   │  │
│  │ - Shell exec        │  │ - Task queue                │  │
│  │ - Git ops           │  │ - Safety guardrails         │  │
│  └─────────────────────┘  └──────────────┬──────────────┘  │
│                                           │                 │
│                          SSH tunnel / API │                 │
│                                           ↓                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Vast AI A100 80GB (ssh1.vast.ai:31384)              │   │
│  │ ┌─────────────────────────────────────────────────┐   │   │
│  │ │ Hiran v2.3 Inference Server (llama.cpp/vLLM)  │   │   │
│  │ │ - 32B params, ~20GB VRAM, ~40 tok/s             │   │   │
│  │ │ - Exposes OpenAI-compatible /v1/chat API     │   │   │
│  │ └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Why hybrid?**
- Local: low latency for file ops, shell commands, git. Agent "thinks" locally.
- Remote: Hiran v2.3 needs A100. Inference requests batched, streamed back.

### 2.2 Agent Loop

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Observe │────→│  Think   │────→│  Plan    │────→│  Act     │
│          │     │          │     │          │     │          │
│ - Read   │     │ - LLM    │     │ - Break  │     │ - Edit   │
│   files  │     │   call   │     │   down   │     │   file   │
│ - Run    │     │ - Reason │     │   task   │     │ - Run    │
│   tests  │     │ - Memory │     │ - Choose │     │   test   │
│ - Check  │     │          │     │   tool   │     │ - Git    │
│   git    │     │          │     │          │     │   commit │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
└───────────────────────────────────────────────────────┘
                    (loop until task done)
```

### 2.3 Tool System

The agent has access to tools, described to the LLM via JSON schema:

```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read a file's contents",
      "parameters": {"path": "string", "offset": "int", "limit": "int"}
    },
    {
      "name": "write_file",
      "description": "Write content to a file",
      "parameters": {"path": "string", "content": "string"}
    },
    {
      "name": "edit_file",
      "description": "Replace text in a file",
      "parameters": {"path": "string", "old_string": "string", "new_string": "string"}
    },
    {
      "name": "shell",
      "description": "Run a shell command",
      "parameters": {"command": "string", "timeout": "int"}
    },
    {
      "name": "search",
      "description": "Search for pattern in codebase",
      "parameters": {"pattern": "string", "path": "string"}
    },
    {
      "name": "git",
      "description": "Git operations",
      "parameters": {"subcommand": "string", "args": ["string"]}
    },
    {
      "name": "think",
      "description": "Pause to reason before next action",
      "parameters": {"thought": "string"}
    }
  ]
}
```

### 2.4 Memory & Context

- **Session memory**: Current task, plan steps, observations (kept in memory, ~128K context)
- **Project memory**: Key facts about the codebase learned over time (saved to `~/.zion/agent/memory.json`)
- **Task history**: Past tasks, solutions, failures (RAG-retrievable)

---

## 3. CLI Design

### 3.1 Commands

```bash
# --- Task execution ---
zion agent run "<natural language task>"     # one-shot autonomous task
zion agent run --plan-only "<task>"          # show plan, ask before execute
zion agent run --file task.md                # read task from markdown file

# --- Interactive session ---
zion agent session                           # start REPL-like session
# hiran> Refactor the pool code
# [agent] Reading pool/src/...
# [agent] Found issue in submit_solution. Plan:
#   1. Read pool/src/validation.rs
#   2. Add algorithm parameter
#   3. Update tests
# Proceed? [Y/n/show-plan]

# --- Code review ---
zion agent review                            # review current working tree
zion agent review --branch feat-xyz         # review branch vs main
zion agent review --pr 42                    # review GitHub PR (future)

# --- Monitoring & ops ---
zion agent monitor                           # start monitoring daemon
zion agent monitor --watch node,pool         # watch specific services
zion agent train-status                      # check remote training
zion agent checkpoint-backup               # pull & verify latest checkpoint

# --- Memory & config ---
zion agent memory                            # show what agent knows
zion agent memory --forget "old task"        # remove from memory
zion agent config                            # agent settings (model URL, etc.)

# --- Safety ---
zion agent approve                           # approve pending action
zion agent cancel                            # cancel running task
```

### 3.2 TUI Menu

```
ZION operator dashboard
  ├── ... existing menus ...
  ├── Hiran Agent 🤖
  │     ├── Run task (natural language)
  │     ├── Interactive session
  │     ├── Review code
  │     ├── Monitor infrastructure
  │     ├── Training ops
  │     │     ├── Status
  │     │     ├── Pull checkpoint
  │     │     └── Merge & convert
  │     ├── Memory
  │     └── Config
```

---

## 4. Implementation Phases

### Phase 0 — Infrastructure (Now, while training runs)
1. **Set up remote inference endpoint** on Vast AI:
   - After training finishes, launch `llama-server` with merged Hiran v2.3
   - Expose OpenAI-compatible API on port (e.g. 8000)
   - Secure with SSH tunnel: `ssh -L 8000:localhost:8000 vast`
2. **Agent scaffolding** in `V3/cli/src/commands/agent/`:
   - `mod.rs` — dispatch
   - `engine.rs` — core agent loop (observe-think-plan-act)
   - `tools.rs` — tool definitions & execution
   - `memory.rs` — session & project memory
   - `llm.rs` — remote inference client (OpenAI-compatible API)
3. **Tool implementations**:
   - `read_file`, `write_file`, `edit_file`
   - `shell` (with allowlist/blocklist for safety)
   - `search` (ripgrep wrapper)
   - `git` (status, diff, commit, push)
   - `hiran_train_status` (SSH to Vast, parse logs)
   - `hiran_checkpoint_pull` (SCP with verification)

### Phase 1 — Basic Agent (P0)
1. `zion agent run "Explain the consensus module"` → reads files, returns explanation
2. `zion agent run "Find where DAO treasury address is defined"` → search + report
3. `zion agent run "Add a test for emission.rs fee split"` → reads code, writes test, runs `cargo test`
4. Interactive session with plan approval

### Phase 2 — Autonomous Coding (P1)
1. Agent can refactor across multiple files autonomously
2. Agent runs tests after changes, iterates on failures
3. Agent generates commit messages and commits
4. Agent reviews PRs and reports issues

### Phase 3 — Ops Agent (P1)
1. `zion agent monitor` — daemon mode, polls node/pool/miner, alerts on issues
2. Auto-fix common problems (restart crashed service, clear mempool backlog)
3. Training ops: auto-backup checkpoints, alert on loss spikes, suggest LR adjustments
4. Generate daily/weekly status reports

### Phase 4 — Advanced (P2)
1. Multi-step planning with sub-agents (e.g. "Implement bridge V2" →分解成 10 tasks)
2. Self-improvement: agent learns from past tasks, updates its own prompts
3. Voice / vision input (future)
4. Integration with IDE (VS Code extension)

---

## 5. Safety & Guardrails

| Risk | Mitigation |
|------|-----------|
| Agent deletes files | Block `rm -rf`, require confirmation for destructive ops |
| Agent modifies L1 consensus | Block edits to `V3/L1/core/src/` without explicit `--l1-unsafe` flag |
| Agent pushes bad commits | `git push` requires approval; auto-tests must pass |
| Agent loops infinitely | Max iterations per task (50), timeout per step (5 min) |
| Agent exposes secrets | Block reading known secret paths; never log credentials |
| Agent runs malicious shell | Allowlist safe commands; block `curl | bash`, downloads |
| Remote inference cost | Local caching of responses; batch tool descriptions |

**L1 Protection Rule**: Any file path matching `V3/L1/core/src/**` triggers:
```
⚠️  L1 CONSENSUS CODE DETECTED
Editing L1 requires explicit approval.
Run with --l1-unsafe to override (NOT RECOMMENDED).
```

---

## 6. Technical Details

### 6.1 LLM Client (`llm.rs`)

```rust
pub struct LlmClient {
    base_url: String,      // http://localhost:8000/v1 (via SSH tunnel)
    api_key: String,       // "" for local
    model: String,         // "hiran-v2.3-merged"
}

impl LlmClient {
    pub async fn chat(&self, messages: &[Message], tools: Option<&[Tool]>) -> Result<LlmResponse>;
}
```

Prompt structure:
```
You are Hiran Agent, an autonomous AI operator for the ZION project.
You have access to tools. Think step by step.

Current task: <user task>

Available tools: <JSON schema>

Observation: <last tool result>

What do you do next? Respond with a JSON tool call or "done".
```

### 6.2 Agent Loop (`engine.rs`)

```rust
pub async fn run_task(task: &str, cfg: &AgentConfig) -> Result<TaskResult> {
    let mut state = AgentState::new(task);
    let llm = LlmClient::new(&cfg.llm);
    let tools = ToolRegistry::default();

    for step in 0..cfg.max_steps {
        // 1. Build prompt from state
        let messages = state.to_messages();
        
        // 2. Call LLM
        let response = llm.chat(&messages, Some(&tools.list())).await?;
        
        // 3. Parse tool call or done
        match response {
            LlmResponse::ToolCall(tool_call) => {
                let result = tools.execute(&tool_call).await?;
                state.add_observation(&tool_call, &result);
            }
            LlmResponse::Done(answer) => {
                return Ok(TaskResult::Success { answer, steps });
            }
            LlmResponse::Question(q) => {
                // Ask user for clarification
                return Ok(TaskResult::NeedsInput { question: q });
            }
        }
    }
    
    Ok(TaskResult::MaxStepsReached)
}
```

### 6.3 File Changes

```
V3/cli/src/commands/
  agent/
    mod.rs          # CLI dispatch (run, session, review, monitor, etc.)
    engine.rs       # Core agent loop
    llm.rs          # Remote inference client
    tools.rs        # Tool definitions & registry
    tool/
      file.rs       # read/write/edit
      shell.rs      # shell exec with safety
      search.rs     # ripgrep search
      git.rs        # git operations
      hiran_train.rs # training-specific tools
    memory.rs       # Session & project memory
    review.rs       # Code review logic
    monitor.rs      # Infrastructure monitoring
```

Update `V3/cli/src/main.rs`:
```rust
Commands::Agent { cmd } => agent::run(&cfg, cmd).await,
// Keep existing hiran commands for inference only
```

---

## 7. Acceptance Criteria

- [ ] `zion agent run "Explain how the emission schedule works"` reads `emission.rs`, returns accurate explanation.
- [ ] `zion agent run "Find all uses of validate_candidate"` searches codebase, returns file:line list.
- [ ] `zion agent run "Add a missing test for fee.rs"` writes test, runs `cargo test -p zion-core`, reports pass/fail.
- [ ] Agent refuses to edit `V3/L1/core/src/` without `--l1-unsafe`.
- [ ] `zion agent train-status` reports current step, loss, GPU status from remote.
- [ ] `zion agent checkpoint-backup` pulls latest checkpoint, verifies size, reports success.
- [ ] Interactive session shows plan before execution, asks for approval.
- [ ] Agent never logs or exposes wallet keys, SSH keys, or API secrets.

---

## 8. Related Files

| File | Role |
|------|------|
| `V3/cli/src/commands/agent.rs` | Existing agent command (for AI agent service) — rename or extend |
| `V3/cli/src/commands/hiran.rs` | Inference-only commands (serve, chat, ask) — stays separate |
| `V3/cli/src/config.rs` | Add `AgentConfig` with LLM URL, safety settings |
| `scripts/start-hiran-inference.ps1` | Launch local inference |
| `HIRAN_LOCAL_SETUP.md` | Inference setup guide |
| `AGENTS.md` | L1 safety rules — agent must enforce |
| `V3/L1/core/src/` | **PROTECTED** — agent blocks edits here |

---

## 9. Timeline

| Milestone | ETA | Status |
|-----------|-----|--------|
| Training completes (8901 steps) | ~2026-06-14 14:00 UTC | In progress (~44%) |
| Merge LoRA → Full model | +1h after training | Pending |
| Convert to GGUF | +1h after merge | Pending |
| Deploy inference server on Vast | +30m after GGUF | Pending |
| Phase 0: Agent scaffolding | 2026-06-14 | Ready to start |
| Phase 1: Basic agent | 2026-06-15 | Pending |
| Phase 2: Autonomous coding | 2026-06-17 | Pending |
| Phase 3: Ops agent | 2026-06-20 | Pending |

---

*Plan version: 2026-06-14*
*Target: v3.1.0 CLI release*
*Philosophy: Agent > Chatbot. Tools > Text. Actions > Words.*
