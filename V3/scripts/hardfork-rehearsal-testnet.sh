#!/usr/bin/env bash
# TX_HASH_V2 + BODY_ROOT_V2 rehearsal harness (local / bring-your-own-testnet).
#
# Activation heights live as compile-time constants in:
#   V3/L1/cosmic-harmony/src/deeksha.rs
#     TX_HASH_V2_ACTIVATION_HEIGHT
#     BODY_ROOT_V2_ACTIVATION_HEIGHT
#
# Set both to the SAME coordinated height (e.g. 50), rebuild images / binaries,
# reset chain state, then bring up two nodes so they fork together.
#
# Example:
#   1. Edit constants → align heights (never ship mismatched gates).
#   2. cargo build --release --manifest-path "$ROOT/V3/Cargo.toml" -p zion-core -p zion-pool
#   3. docker compose -f "$ROOT/V3/docker/docker-compose.yml" --profile dev build --no-cache node
#   4. docker compose ... down -v && docker compose ... --profile dev up -d
#
# Until runtime env overrides exist, rehearsal is intentionally rebuild-driven.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "hardfork rehearsal root: $ROOT"
echo "Constants file: $ROOT/V3/L1/cosmic-harmony/src/deeksha.rs"
echo "Compose: $ROOT/V3/docker/docker-compose.yml"
