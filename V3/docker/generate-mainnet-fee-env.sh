#!/usr/bin/env bash
# Canonical mainnet subsidy + pool payout env (deterministic from genesis labels).
# Random one-off keys: use gen-tithe-wallets / gen-pool-wallet instead.
#
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

exec cargo run --manifest-path V3/Cargo.toml -p zion-core --release --bin canonical-mainnet-operator-env
