
# ZION CLI

ZION CLI is the unified operator gateway for the active V3 stack. The binary lives in `V3/cli/` as a top-level workspace crate above L1, L2, and L3.

This document is no longer a pure wish-list. It is the current status board for what is already shipped, what is only partially done, and what is still not part of the real CLI surface.

OpenClaw note: the inspiration here is the gateway-first operator UX of OpenClaw at https://openclaw.ai/, adapted for self-hosted blockchain, mining, deploy, and AI-orchestrator operations. It is inspiration for ergonomics and control-plane design, not a claim of feature parity.

---

## Current Position

`zion` already works as a real operator entrypoint for:

- a menu-first arrow-key launcher when you start `zion` with no subcommand
- a real `zion version` command for release metadata and manual update guidance
- L1 node, pool, miner, and wallet flows
- L2 bridge and DAO gateway flows
- L3 AI Native, Warp, and NCL status/gateway flows
- deploy, logs, monitoring, explorer, onboarding, config, and shell completions

The CLI entry now has a dedicated Genesis presentation layer:

- the interactive launcher opens with the Genesis tree and ZION mainnet banner
- the launcher now opens on a grouped operator dashboard instead of a flat all-surfaces list
- onboarding opens with the same Genesis entry banner
- the launcher now stays alive across commands and returns the operator back into the menu after each completed action
- guided workflows now cover mining, wallet send, deploy actions, and common agent paths
- typed commands still remain the canonical execution surface underneath the launcher

Canonical operator docs now live in:

- `V3/docs/CLI_GUIDE.md`
- `V3/docs/CLI_FAQ.md`
- `V3/docs/CLI_REFERENCE.md`
- `V3/docs/CLI_TROUBLESHOOTING.md`
- `V3/docs/CLI_DEPLOY_PLAYBOOK.md`

The website documentation should mirror these under one clean section named `ZION CLI`.

---

## What Is Shipped

| Area | Status | Notes |
|------|--------|-------|
| Top-level crate in `V3/cli/` | Done | The CLI is in the active V3 workspace, not in `V3/L1/cli`. |
| Core runtime commands | Done | `onboard`, `start`, `stop`, `restart`, `status`, `doctor`, `logs`, `dashboard`, `monitor`, `explorer`, `completions`. |
| Menu-first launcher | Done | `zion` with no subcommand now opens an arrow-key operator launcher and `zion menu` opens it explicitly. |
| Node gateway | Done | Speaks the real raw TCP JSON-RPC node protocol on `:8443` and uses canonical method names. |
| Pool gateway | Done | Operator inspection surface exists through `zion pool`. |
| Miner gateway | Done | `zion mine` supports start, status, bench, stop, and DCR-related flow. |
| Mining hardening | Done | Explicit backend forwarding for `opencl`, `metal`, and `cuda`; real `--ekam-bench`; robust miner binary discovery; `miner.wallet` separated from `miner.btc_wallet` for dual profile. |
| Config management | Done | `show`, `set`, `path`, `init`, and `validate` now exist. |
| Doctor preflight | Done | `zion doctor` checks config sanity, local miner binary readiness, node RPC reachability, and AI Native reachability. |
| Deploy lifecycle | Done | SSH and compose-backed start/stop/restart/logs flow exists with local target validation before remote compose calls. |
| Guided operator workflows | Done | Menu-guided flows now cover miner start, wallet send, deploy actions, and common agent operations. |
| L2 gateway | Done | `zion bridge` and `zion dao` are part of the shipped surface. |
| L3 gateway | Done | `zion agent`, `zion warp`, and `zion ncl` are part of the shipped surface. |
| Version and release surface | Done | `zion version` prints binary metadata, release line, config path, and manual update guidance. |
| Website docs mirrors | Done | Guide, FAQ, Reference, Troubleshooting, and Deploy Playbook already exist in EN and CS public docs. |

---

## What Is Only Partially Done

| Area | Status | Reality |
|------|--------|---------|
| AI Native runtime posture | Partial | The CLI integrates with the live AI Native service, but current production posture is orchestrator/control-plane first. Heavy local inference is not the default assumption. |
| Doctor diagnostics | Partial | `zion doctor` already helps, but it does not yet cover deeper SSH/deploy readiness, compose state, or richer mining environment diagnostics. |
| OpenClaw-inspired operator UX | Partial | The gateway-first direction is now materially better: menu-first launcher, grouped operator dashboard, guided command generation, richer workflow forms, Genesis entry banner, and persistent return-to-menu flow are real. The remaining gap is deeper in-app navigation without bouncing through plain command output. |
| Download-ready distribution | Partial | The CLI is usable from source builds today, but release packaging and public install flow are still not finished. |
| Update ergonomics | Partial | `zion version` now gives operators the release and manual update path, but automated self-update and package-manager delivery are still not shipped. |

---

## What Is Not Shipped Yet

These items appeared in older drafts or still belong to the roadmap, but they are not current contract and should not be documented as if they already exist:

- `zion update`
- `zion swap`
- public package install flow like Homebrew or `cargo install zion-cli` from a published crate
- polished release bundles for macOS, Linux, and Windows download distribution
- full OpenClaw-style operator polish around upgrade flows, richer doctor checks, and deeper release ergonomics

The rule from now on is simple: if it is not in `V3/cli/src/main.rs` and the command docs under `V3/docs/`, it is not shipped.

---

## Current Command Surface

Top-level commands currently exposed by the real CLI:

```text
menu
version
onboard
start
stop
restart
status
doctor
logs
dashboard
node
pool
mine
wallet
agent
deploy
config
bridge
dao
explorer
monitor
warp
ncl
completions
```

Primary command groups:

| Group | Current role |
|-------|--------------|
| `zion` | menu-first operator launcher for common flows |
| `zion node` | L1 core RPC inspection and status flow |
| `zion pool` | pool operator inspection |
| `zion mine` | miner control, benchmarks, backend selection, DCR sidecar-related flow |
| `zion wallet` | wallet operations exposed by the current CLI surface |
| `zion bridge` | L2 bridge gateway |
| `zion dao` | L2 governance gateway |
| `zion agent` | AI Native control gateway |
| `zion warp` | Warp status/gateway flow |
| `zion ncl` | Neural Compute Layer status/gateway flow |
| `zion deploy` | SSH plus compose-backed deployment and service control |
| `zion config` | config show, set, path, validate, init |

For exact commands and examples, the source of truth is the CLI docs set under `V3/docs/` and the mirrored website docs section `ZION CLI`.

---

## Quick Start For The Real CLI

Interactive launcher first:

```bash
zion
```

Explicit launcher entry:

```bash
zion menu
```

Typed CLI still remains fully canonical underneath the launcher.

Build from the V3 workspace root:

```bash
cargo build -p zion-cli --release
./target/release/zion --help
```

Or run directly without a release build:

```bash
cargo run -p zion-cli -- --help
cargo run -p zion-cli -- status
cargo run -p zion-cli -- doctor
```

Useful first checks:

```bash
zion config validate
zion doctor
zion status
```

Current practical operator flow:

1. Start with `zion`
2. Land on the grouped operator dashboard
3. Use arrows to choose the area
4. Let the launcher generate the canonical command
5. Review the output and press Enter to return into the launcher
6. Drop to typed subcommands only for narrower advanced work

---

## Current Config Shape

The active config file is:

```text
~/.zion/zion.toml
```

Current effective schema:

```toml
[node]
rpc_host = "91.98.122.165"
rpc_port = 8443
p2p_port = 8334

[pool]
host = "91.98.122.165"
port = 3333

[miner]
wallet = ""
btc_wallet = ""
threads = "auto"
backend = "auto"
profile = "pool"

[agent]
url = "http://91.98.122.165:8001"
model = "hiranyagarbha-v1"

[deploy]
default_server = "prague"
ssh_key = "~/.ssh/zion_hetzner_key"
ssh_user = "root"
```

Important recent reality:

- `miner.btc_wallet` is separate from `miner.wallet`
- `miner.backend` accepts `auto`, `cpu`, `gpu`, `metal`, `opencl`, `ocl`, and `cuda`
- `zion config validate` is the fast config sanity check
- `zion doctor` is the wider preflight

---

## Architecture Map

| Layer | Components | CLI namespaces |
|-------|------------|----------------|
| L1 | core, pool, miner | `zion node`, `zion pool`, `zion mine`, `zion wallet` |
| L2 | bridge, dao | `zion bridge`, `zion dao` |
| L3 | ai-native, warp, ncl | `zion agent`, `zion warp`, `zion ncl` |
| Ops | deploy, logs, dashboard, monitor, explorer | top-level `zion` commands |

AI Native note: in the current production era, `zion agent` should be understood as an operator-facing orchestrator gateway first. That is the correct public framing until heavier local backend assumptions become real.

---

## Website Documentation Order

The public docs should stay ordered like this:

1. Test-Mainnet Ops
2. Release Lineage
3. Whitepaper
4. Architecture
5. Public Launch Path
6. ZION CLI
7. Books
8. Listing / CoinGecko
9. AI / Research Archive
10. Legal

The `ZION CLI` section should contain exactly these operator documents:

- `ZION CLI Guide`
- `ZION CLI FAQ`
- `ZION CLI Reference`
- `ZION CLI Troubleshooting`
- `ZION CLI Deploy Playbook`

Those files should not be mixed into `Public Launch Path` anymore.

---

## Near-Term Build Order

The next sensible CLI milestones are:

1. wider `doctor` coverage for SSH, deploy, compose, and mining environment checks
2. public install and update ergonomics beyond the current manual guidance surface
3. more polished download-ready packaging for public operator distribution

## Current UX Plan

The CLI is now on a clearer path:

- Phase 1 done: real command surface, RPC wiring, deploy flows, doctor, TUI views
- Phase 2 done: menu-first arrow launcher and Genesis entry banner
- Phase 3 done: persistent in-app navigation and post-command return flow
- Phase 4 done: grouped operator dashboard with higher-signal categories
- Phase 5 done: richer guided forms for mining, wallet send, deploy, and agent workflows
- Phase 6 done: version command and manual update guidance surface
- Phase 7 next: wider doctor coverage for SSH, deploy, compose, and mining environment checks
- Phase 8 later: public install ergonomics and automated update story

---

## Working Rule

This file is a status document, not a fantasy spec. Keep it aligned with the real code and the real docs. If a command is not implemented, do not document it as shipped.

Peace & One Love.
