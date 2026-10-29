#!/usr/bin/env bash
# public-export.sh — curated export do veřejného repa Zion-TerraNova/v3-Mainnet (8.B7)
#
# Nahrazuje mrtvý `git subtree push --prefix=public` workflow — tracked
# `public/` subtree byl 2026-10 zrušen (obsah v `archive/PUBLIC`).
# Model: manifest-driven rsync do working clone ./PUBLIC → secret scan → push.
#
# Použití:
#   ./scripts/ops/public-export.sh init      # naklonuje public remote do ./PUBLIC
#   ./scripts/ops/public-export.sh export    # rsync manifest paths → ./PUBLIC
#   ./scripts/ops/public-export.sh scan      # secret scan ./PUBLIC (musí projít)
#   ./scripts/ops/public-export.sh push "msg" # export+scan+commit+push (gate)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PUBLIC_DIR="$REPO_ROOT/PUBLIC"
MANIFEST="$REPO_ROOT/scripts/ops/public-manifest.txt"
REMOTE_NAME="${PUBLIC_REMOTE:-public}"

die() { echo "ERROR: $*" >&2; exit 1; }

cmd="${1:-}"; shift || true

case "$cmd" in
init)
  [ -d "$PUBLIC_DIR/.git" ] && die "PUBLIC/ existuje"
  url="$(git -C "$REPO_ROOT" remote get-url "$REMOTE_NAME")" \
    || die "remote '$REMOTE_NAME' nenalezeno"
  git clone "$url" "$PUBLIC_DIR"
  echo "clone → $PUBLIC_DIR"
  ;;

export)
  [ -d "$PUBLIC_DIR/.git" ] || die "PUBLIC/ není clone — spusť 'init'"
  [ -f "$MANIFEST" ] || die "manifest $MANIFEST chybí"
  # Manifest: jeden relativní path na řádek; '#' komentáře; dir => celý strom.
  while IFS= read -r line; do
    line="${line%%#*}"; line="${line% }"; line="${line# }"
    [ -z "$line" ] && continue
    src="$REPO_ROOT/${line%/}"
    [ -e "$src" ] || { echo "WARN: $line neexistuje, skip"; continue; }
    if [ -d "$src" ]; then
      mkdir -p "$PUBLIC_DIR/$line"
      rsync -a --delete \
        --exclude='node_modules/' --exclude='target/' --exclude='.next/' \
        --exclude='.env*' --exclude='*.key' --exclude='*.pem' \
        --exclude='__pycache__/' --exclude='.DS_Store' \
        "$src/" "$PUBLIC_DIR/$line/"
    else
      mkdir -p "$PUBLIC_DIR/$(dirname "$line")"
      rsync -a "$src" "$PUBLIC_DIR/$line"
    fi
    echo "  + $line"
  done < "$MANIFEST"
  echo "export hotov — spusť 'scan'"
  ;;

scan)
  [ -d "$PUBLIC_DIR" ] || die "PUBLIC/ chybí"
  echo "== secret scan =="
  # Fail-closed pattern scan — hexdump-safe, bez speciálních nástrojů.
  # Assignment vzory (password=/token=/...) vyžadují neprázdnou quoted
  # hodnotu — zabíjí to FP na `s.token ==`, `api_key = ""` a
  # `api_key = std::env::var(...)`. Bare-word vzory (mnemonic, 0x{64},
  # PRIVATE KEY, sk_live_, AKIA) flagují všechno — reviewed false
  # positives jdou do scripts/ops/public-scan-allowlist.txt (path globy).
  allowlist="$REPO_ROOT/scripts/ops/public-scan-allowlist.txt"
  allow_re='^$'
  if [ -f "$allowlist" ]; then
    allow_re="$(sed 's/#.*//' "$allowlist" | sed 's/^ *//; s/ *$//' | grep -v '^$' | sed 's/[][\.*^$/]/\\&/g; s/\*/.*/g' | paste -sd'|' -)"
  fi
  if grep -rInE -- \
    'BEGIN [A-Z ]*PRIVATE KEY|mnemonic|seed phrase|(password|passwd|secret|api[_-]?key|token) *= *["'"'"'][^"'"'"']|sk_live_|AKIA[0-9A-Z]{16}|0x[0-9a-fA-F]{64}' \
    "$PUBLIC_DIR" 2>/dev/null \
    | grep -vE '\.md:|\bexample\b|sample|placeholder|REDACTED|<.*>|\.\.\.' \
    | grep -vE "$allow_re"; then
    die "SCAN FAIL — podezřelé řádky výše (ověř a přidej do allowlist nebo vyhoď z manifestu)"
  fi
  # Binary/large guard.
  find "$PUBLIC_DIR" -type f -size +5M -not -path '*/.git/*' -print | sed 's/^/  LARGE: /'
  echo "scan OK"
  ;;

push)
  msg="${1:-sync: curated export $(date +%Y-%m-%d)}"
  "$0" export
  "$0" scan
  cd "$PUBLIC_DIR"
  git add -A
  git diff --cached --quiet && { echo "nic k commitu"; exit 0; }
  git -c user.name="${GIT_AUTHOR_NAME:-zion-ops}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-ops@zionterranova.com}" \
      commit -m "$msg"
  git push origin HEAD
  echo "push hotov"
  ;;

*) echo "usage: $0 init|export|scan|push [msg]" >&2; exit 2 ;;
esac
