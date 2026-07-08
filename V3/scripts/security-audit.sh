#!/usr/bin/env bash
set -euo pipefail

# Security audit wrapper for current cargo-audit CLI version.
# Keeps the audit gate strict while documenting temporary risk acceptance.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCK_FILE="$ROOT_DIR/Cargo.lock"

# Temporarily ignored advisories (tracked in SECURITY_TODO_2026-07-03.md):
# - RUSTSEC-2024-0436: paste 1.0.15 unmaintained — transitive via `metal` (macOS-only GPU backend).
#   On Linux/Windows `metal` is target-gated (`cfg(target_os = "macos")`) and not pulled into the
#   active dependency tree. Cargo.lock is cross-platform so the entry remains. No runtime exposure
#   on the production server (Linux). Remove when `metal` upstream drops `paste` or we migrate
#   away from the Metal backend.
cargo audit --file "$LOCK_FILE" \
  --ignore RUSTSEC-2024-0436
