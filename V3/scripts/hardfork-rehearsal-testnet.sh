#!/usr/bin/env bash
# TX_HASH_V2 + BODY_ROOT_V2 rehearsal harness (local / bring-your-own-testnet).
#
# Default production binaries (no `testnet_fork_rehearsal`): **TX_HASH_V2** and
# **BODY_ROOT_V2** are active from height **0** — intended for a **fresh chain**
# from genesis. Rehearsal builds use a finite coordinated height (see
# `TESTNET_REHEARSAL_COORDINATED_HEIGHT` in `deeksha.rs`).
#
# Option A — rebuild-driven rehearsal **without** editing source:
#   Enable Cargo feature `testnet_fork_rehearsal` on ALL consensus binaries together:
#
#     cargo build --release --manifest-path "$ROOT/V3/Cargo.toml" \\
#       -p zion-core -p zion-pool -p zion-cli -p zion-miner \\
#       --features testnet_fork_rehearsal
#
#   Shared rehearsal height is `TESTNET_REHEARSAL_COORDINATED_HEIGHT` in
#   `V3/L1/cosmic-harmony/src/deeksha.rs` (default **10** for local fork-after-~9-blocks).
#
# Option B — legacy coordinated flip on an **existing** chain (rare):
#   Ship a release with the same finite height for both constants in `deeksha.rs`
#   (only if you are not using the default genesis-at-0 product build).
#
# After rebuilding: reset chain state, bring up two nodes, observe fork at the gate.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "hardfork rehearsal root: $ROOT"
echo "Constants file: $ROOT/V3/L1/cosmic-harmony/src/deeksha.rs"
echo "Compose: $ROOT/V3/docker/docker-compose.yml"
echo "Playbook: $ROOT/V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md"
echo "Windows verify-all: $ROOT/V3/scripts/verify-fork-rehearsal.ps1"
