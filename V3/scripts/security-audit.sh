#!/usr/bin/env bash
set -euo pipefail

# Security audit wrapper for current cargo-audit CLI version.
# Keeps the audit gate strict while documenting temporary risk acceptance.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCK_FILE="$ROOT_DIR/Cargo.lock"

# Temporarily ignored advisories (tracked in SECURITY_TODO_2026-07-03.md):
# - RUSTSEC-2025-0141: bincode 1.x unmaintained (serializer migration planned)
# - RUSTSEC-2024-0436: paste transitive via metal (upstream-bound)
cargo audit --file "$LOCK_FILE" \
  --ignore RUSTSEC-2025-0141 \
  --ignore RUSTSEC-2024-0436
