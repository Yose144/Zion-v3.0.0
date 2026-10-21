# REPORT — 2026-10-21 Edge Disk Audit (`vmi3425821`, 89 % / 18 G free)

`/dev/sda1` 145 G, used 127 G. Breakdown of `/opt` (101 G of it):

| Path | Size | Verdict |
|---|---|---|
| `/opt/zion/bitcoin/data` | **31 G** | `prune=20000` — capped by config, **BTC sync 100 % (block 972429)**. Grows to ~20 G blocks + ~11 G chainstate steady-state. Keep. |
| `/opt/pearl` | 18 G | 11 G mainnet data + **4.7 G `.venv` still used by `zion-pearl-gateway.service`** — keep. |
| `/opt/quantus/data` | 12 G | live chain — keep. |
| `/opt/zion/APP&WEB` | 13 G | 9.3 G website (1.9 G `.next` + 1.2 G node_modules + ~174 M stale `.next.bak-*`). Reclaim ~0.2–3 G. |
| `/opt/zion/backups` | 6.5 G | 14×~400 M daily (4 h cadence) + 3 weekly. Retention trim → ~3.5 G. |
| `/opt/zion/hiran-models` | **5.5 G** | `hiran-v2.3mini-Q5_K_M.gguf` — **UNUSED**: ai-native `LLM_BASE_URL=127.0.0.1:8003` (rig tunnel), no local llama service, nothing references the file. Biggest single reclaim; 👤 decision (may be wanted as cold fallback). |
| `/opt/zion/V31/target` | 4.5 G | incremental build cache — keep for fast deploys. |
| `/opt/zion/.git` + `wt-*` + `canonical-main` | ~6 G | worktrees `wt-f5`, `wt-main` (~3.4 G) + `/tmp/zion-pearl-s2` (prunable). Consolidate → ~3 G reclaim. |
| `/opt/pearl/zk-pow` + `py-pearl-mining` | ~2.2 G | dev leftovers — audit before delete. |

## Recommended actions

| # | Reclaim | Action | Owner |
|---|---|---|---|
| 1 | ~5.5 G | Move `hiran-v2.3mini` off-disk (or delete — unused) | 👤 |
| 2 | ~3 G | Remove stale git worktrees (`wt-f5`, `wt-main`, `/tmp/zion-pearl-s2`) — check no in-flight work | 🤖/👤 |
| 3 | ~3 G | Backup retention: daily keep 7 d (not ~14 × 4 h), weekly keep 4 | 🤖 |
| 4 | ~0.2 G | Delete `.next.bak-*` deploy backups older than 7 d | 🤖 |
| 5 | ~2 G | Audit `/opt/pearl/zk-pow` + `py-pearl-mining` dev dirs | 🤖/👤 |

Realistic reclaim without risk: **~11–13 G** → 89 % → ~80 %. Anything lower needs
👤 Contabo volume expansion or offloading chain data (BTC/PRL/QTU full nodes are
structural ~60 G combined).
