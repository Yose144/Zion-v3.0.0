#!/usr/bin/env bash
# ZION V3 — One-click dependency install & build (Linux/macOS)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/install-deps.log"

log() {
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$ts] $*" | tee -a "$LOG_FILE"
}

log "============================================"
log "ZION V3 Dependency Install & Build Started"
log "============================================"

# ── 1. Rust / Cargo ──
log "[1/5] Checking Rust toolchain..."
if command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1; then
    log "  OK  : $(cargo --version)"
    log "  OK  : $(rustc --version)"
    RUST_OK=1
else
    log "  MISSING: Rust / Cargo not found."
    log "  ACTION : Install from https://rustup.rs/"
    RUST_OK=0
fi

# ── 2. Build V3 Rust workspace ──
if [[ "$RUST_OK" -eq 1 ]]; then
    log "[2/5] Building V3 Rust workspace (release)..."
    cd "$REPO_ROOT"
    if cargo build --release --manifest-path "$REPO_ROOT/V3/Cargo.toml" --workspace >> "$LOG_FILE" 2>&1; then
        log "  OK  : V3 workspace built successfully."
    else
        log "  FAIL: cargo build exited with error (see log above)"
    fi
else
    log "[2/5] Skipped — Rust required."
fi

# ── 3. Node / npm ──
log "[3/5] Checking Node.js / npm..."
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    log "  OK  : node $(node --version)"
    log "  OK  : npm $(npm --version)"
    NODE_OK=1
else
    log "  MISSING: Node.js / npm not found."
    log "  ACTION : Install from https://nodejs.org/"
    NODE_OK=0
fi

if [[ "$NODE_OK" -eq 1 ]]; then
    WEB_DIR="$REPO_ROOT/APP&WEB/website-v2.9"
    if [[ -f "$WEB_DIR/package.json" ]]; then
        log "[4/5] Installing website-v2.9 npm dependencies..."
        cd "$WEB_DIR"
        if npm install >> "$LOG_FILE" 2>&1; then
            log "  OK  : npm install completed."
        else
            log "  FAIL: npm install exited with error."
        fi
    else
        log "  SKIP : website-v2.9 package.json not found."
    fi
else
    log "[4/5] Skipped — Node.js required."
fi

# ── 5. Docker ──
log "[5/5] Checking Docker..."
if command -v docker >/dev/null 2>&1; then
    log "  OK  : $(docker --version)"
    DOCKER_OK=1
else
    log "  MISSING: Docker not found."
    log "  ACTION : Install Docker Engine for monitoring stack."
    DOCKER_OK=0
fi

# ── Summary ──
log "--------------------------------------------"
log "Summary:"
log "  Rust   : $(if [[ "$RUST_OK" -eq 1 ]]; then echo OK; else echo "MISSING — install https://rustup.rs/"; fi)"
log "  Node   : $(if [[ "$NODE_OK" -eq 1 ]]; then echo OK; else echo "MISSING — install https://nodejs.org/"; fi)"
log "  Docker : $(if [[ "$DOCKER_OK" -eq 1 ]]; then echo OK; else echo "MISSING — install Docker Engine"; fi)"
log "  Done."
log "============================================"
