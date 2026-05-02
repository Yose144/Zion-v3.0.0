#!/usr/bin/env bash
# TX_HASH_V2 + BODY_ROOT_V2 rehearsal harness (local / bring-your-own-testnet).
#
# Default production binaries keep both gates dormant (`u64::MAX`).
#
# Option A — rebuild-driven rehearsal **without** editing source:
#   Enable Cargo feature `testnet_fork_rehearsal` on ALL consensus binaries together:
#
#     cargo build --release --manifest-path "$ROOT/V3/Cargo.toml" \\
#       -p zion-core -p zion-pool -p zion-cli -p zion-miner \\
#       --features testnet_fork_rehearsal
#
#   Shared rehearsal height is `TESTNET_REHEARSAL_COORDINATED_HEIGHT` in
#   `V3/L1/cosmic-harmony/src/deeksha.rs` (edit there if you need another height).
#
# Option B — mainnet-coordinated activation:
#   Set both constants to the SAME finite height in `deeksha.rs` for the release tag.
#
# After rebuilding: reset chain state, bring up two nodes, observe fork at the gate.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "hardfork rehearsal root: $ROOT"
echo "Constants file: $ROOT/V3/L1/cosmic-harmony/src/deeksha.rs"
echo "Compose: $ROOT/V3/docker/docker-compose.yml"
echo "Playbook: $ROOT/V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md"
