# ZION Agent CLI — Terminal Setup Guide

> Otevři terminál, napiš `zion-agent`, a pracuj s celým ZION repo autonomně jako Devin.

---

## Požadavky

| Nástroj | Účel |
|---------|------|
| Rust (cargo) | Kompilace agent-cli |
| LM Studio | Lokální inference (volitelné) |
| SSH | Tunel na Vast AI RTX 3090 (volitelné) |
| Git | Verzování |

---

## Krok 1 — Kompilace a instalace

```bash
# V repo root
cd ZION_OS/agent-cli
cargo build --release

# Instalace do PATH (Windows PowerShell)
# Zkopíruj binárku do složky v PATH:
Copy-Item target\release\zion-agent-cli.exe "$env:USERPROFILE\.cargo\bin\zion-agent.exe"

# Nebo přidej do PATH:
$env:Path += ";C:\Users\yosef\Desktop\Zion\2.9.6-main\ZION_OS\agent-cli\target\release"

# Ověření
zion-agent --help
```

---

## Krok 2 — Vyber inference backend

### Varianta A: LM Studio (lokální, nejjednodušší)

1. Otevři **LM Studio**
2. Nahoře klikni na **"Developer"** → **"Local Server"**
3. Klikni **"Start Server"** (port `1234`)
4. Nastav model (např. Qwen3-30B nebo jiný 7B+ model)
5. Zkopíruj API URL (bude `http://localhost:1234/v1`)

### Varianta B: Hiran v2.3 přes SSH tunel (po tréninku)

```bash
# Zapni SSH tunel
zion-agent tunnel start

# Agent se automaticky připojí na localhost:8080
```

### Varianta C: Vlastní OpenAI-compatible API

Např. OpenRouter, Groq, nebo vlastní server.

---

## Krok 3 — Konfigurace pro ZION monorepo

Vytvoř `~/.zion/agent-cli.toml`:

```toml
[llm]
api_url = "http://localhost:1234/v1"
model = "local-model"
context_size = 32768
temperature = 0.7

[agent]
max_steps = 100
timeout_sec = 300
auto_approve_safe = true

[hiran]
remote_host = "ssh1.vast.ai"
remote_port = 31384
ssh_key = "C:\\Users\\yosef\\.ssh\\vast\\hiran_v2.4_key"
ssh_user = "root"
remote_workspace = "/workspace/hiran-v2.3"
tunnel_local_port = 8080
tunnel_remote_port = 8080
llama_server_bin = "/workspace/llama.cpp/llama-server"

[coding]
enabled = true
project_type = "rust"
build_cmd = "cargo build --manifest-path V3/Cargo.toml"
test_cmd = "cargo test --manifest-path V3/Cargo.toml --workspace"
lint_cmd = "cargo clippy --manifest-path V3/Cargo.toml --workspace"
fmt_cmd = "cargo fmt --manifest-path V3/Cargo.toml --all"
auto_build = true
auto_test = true
auto_lint = true

[paths]
repo_root = "C:\\Users\\yosef\\Desktop\\Zion\\2.9.6-main"
models_dir = "C:\\Users\\yosef\\HiranModels"
checkpoints_dir = "C:\\Users\\yosef\\HiranV2.3-Checkpoints"

[safety]
l1_protection = true
destructive_confirmation = true
secret_protection = true
```

> 💡 **Tip:** Pokud chceš autonomní mód bez ptaní na každou editaci, nastav `auto_approve_safe = true`. 
> Pro maximální bezpečnost nech `false` — agent se bude ptát před každou `edit_file` akcí.

---

## Krok 4 — Použití

### Základní příkazy

```bash
# Autonomní coding úkol (plně autonomní, auto-approve)
zion-agent code "Refactor pool validation to use algorithm enum"

# S manuálním schvalováním každé editace
zion-agent code "Add Edge server health panel to dashboard"

# Generický úkol (ne nutně coding)
zion-agent run "Find all TODO comments in the codebase"

# Interaktivní chat
zion-agent chat

# Zeptat se jednou otázku
zion-agent ask "What is the consensus mechanism of ZION?"

# Přehled sessions
zion-agent memory show

# Konfigurace
zion-agent config show
zion-agent config set llm.api_url http://localhost:1234/v1
```

### Hiran v2.3 specifické

```bash
# Stav tréninku
zion-agent train-status

# Stáhnout checkpoint
zion-agent checkpoint-pull 7000

# Merge + export GGUF (po dokončení tréninku)
zion-agent model-merge --checkpoint 8901 --quantize q5_k_m --wait

# Stáhnout GGUF lokálně
zion-agent model-download --checkpoint 8901

# Zapnout inference tunel
zion-agent tunnel start
```

---

## Krok 5 — Jak to vypadá v praxi

```bash
# Otevři terminál v repo root
PS C:\Users\yosef\Desktop\Zion\2.9.6-main> zion-agent code "Fix the loadBridgeStats typo in dashboard.js"

╔══════════════════════════════════════╗
║ ZION Agent Task                      ║
╚══════════════════════════════════════╝
  Task: Fix the loadBridgeStats typo in dashboard.js

ℹ Coding assistant mode enabled.
  Build: cargo build --manifest-path V3/Cargo.toml
  Test:  cargo test --manifest-path V3/Cargo.toml --workspace
  Lint:  cargo clippy --manifest-path V3/Cargo.toml --workspace

▶ search {"query":"loadBridgeStatus","path":"."}
◀ Found 3 occurrences in APP&WEB/dashboard/src/dashboard.js

▶ read_file {"path":"APP&WEB/dashboard/src/dashboard.js","offset":120,"limit":10}
◀ function switchTab(tab) {
      loadBridgeStatus();   // ← typo here
      ...
    }

▶ edit_file {"path":"APP&WEB/dashboard/src/dashboard.js","offset":121,"old":"loadBridgeStatus","new":"loadBridgeStats"}
◀ Applied edit at offset 121

ℹ Auto-running build after file edit...
▶ build
◀ Compiling... Finished successfully.

ℹ Auto-running lint...
▶ lint
◀ No warnings.

▶ git_diff {}
◀ diff --git a/APP&WEB/dashboard/src/dashboard.js b/APP&WEB/dashboard/src/dashboard.js
  - loadBridgeStatus();
  + loadBridgeStats();

▶ finish {}
✓ Task completed.
```

---

## Troubleshooting

### "Cannot connect to LLM API"
- Ověř že LM Studio server běží (Developer → Local Server → Start)
- Zkus `curl http://localhost:1234/v1/models`
- Ujisti se že `api_url` v configu odpovídá

### "Build failed" při coding úkolu
- Agent se pokusí opravit sám (max 3 retries)
- Pokud selže, zkontroluj build log a oprav ručně

### "Safety blocked"
- Zkontroluj co agent dělá — můžeš schválit ručně
- Nebo zvyš `auto_approve_safe = true` (pozor, autonomní mód)

### Změna modelu v LM Studio
- V LM Studio vyber jiný model → nahoře "Developer" → vyber v "Model"
- Agent se automaticky připojí k aktuálně načtenému modelu

---

*Vytvořeno: 2026-06-14*
*Pro: ZION Agent CLI v0.1.0*
