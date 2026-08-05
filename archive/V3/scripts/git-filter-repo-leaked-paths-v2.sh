#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# git-filter-repo-leaked-paths-v2.sh  —  History scrub draft (PR "L" candidate)
# ─────────────────────────────────────────────────────────────────────────────
#
# Authored: 2026-05-07 (StatusV3-Part2.md §1.1–1.3 + §11 PR "L")
# Replaces: git-filter-repo-leaked-paths.sh (v1 missed paths, was print-only)
#
# WHAT THIS SCRIPT DOES (in --execute mode):
#   1. Verifies preconditions (clean tree, on main, key-rotation acknowledged).
#   2. Creates a BARE backup clone next to the repo: <repo>-backup-YYYYMMDD-HHMM.git
#   3. Runs `git filter-repo --invert-paths` against ALL leaked paths.
#   4. Prints post-rewrite verification commands.
#   5. Stops BEFORE force-push. The operator must run the push manually.
#
# WHAT THIS SCRIPT NEVER DOES:
#   - Force-push to any remote (operator runs that explicitly).
#   - Touch the working tree without a backup.
#   - Skip the rotation acknowledgement.
#
# DESTRUCTIVE OP — read top to bottom, run with `--dry-run` first.
#
# Usage:
#   ./git-filter-repo-leaked-paths-v2.sh                  # default = --dry-run
#   ./git-filter-repo-leaked-paths-v2.sh --dry-run        # explicit dry-run
#   ./git-filter-repo-leaked-paths-v2.sh --execute        # actually rewrites
#
# Pre-flight checklist (StatusV3-Part2.md §8 P0):
#   [ ] PAT  ghp_7gxI3Y…  revoked at https://github.com/settings/tokens
#   [ ] OpenAI sk-proj-CsUPFB…  deleted at https://platform.openai.com/api-keys
#   [ ] SSH key rotated on all production servers (legacy Prague 91.98.122.165 included)
#   [ ] All collaborators warned: "rewrite incoming, re-clone after force-push"
#   [ ] All open PRs from forks acknowledged as needing rebase
#   [ ] Backup clone location verified writable
#
# Post-rewrite manual steps (NOT performed by this script):
#   git push --force-with-lease origin main
#   git push --force-with-lease origin --tags
#   # For every other branch you want to keep:
#   #   git push --force-with-lease origin <branch>
#   # Notify forks; they must reset --hard or re-fork.
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MODE="${1:---dry-run}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TS="$(date +%Y%m%d-%H%M)"
BACKUP_DIR="${ROOT}-backup-${TS}.git"

# ─── Leaked paths (canonical list) ───────────────────────────────────────────
# Sources:
#   - StatusV3-Part2.md §1.1, §1.2
#   - SECURITY_NOTICE_2026-04-28.md
#   - Independent audit 2026-05-07: docs/docs2.9/ZION_KEYS still tracked at HEAD
#
# NOTE: filter-repo `--path` is exact-match for files and prefix-match for
#       directories. For glob matches we use `--path-glob`.

LEAKED_PATHS=(
  # Wallet exports (premine privkey + mnemonic)
  "zion-wallet.json"
  "V3/zion-wallet.json"

  # Source-tree archives that historically contained wallet exports
  "V3-src.tar"
  "V3-src-fresh.tar"
  "V3-src.zip"
  "V3_upload.zip"

  # Plaintext credential dumps (PAT, OpenAI, SSH inventory)
  "docs/docs2.9/ZION_KEYS"
  "Zion-2.9.5-main/2.9-History/docs/ZION_KEYS"   # ← v1 script missed this
)

# Glob patterns for any future / forgotten variants
LEAKED_GLOBS=(
  "**/zion-wallet*.json"
  "**/*.wallet.json"
  "**/*.mnemonic"
  "**/*.keystore"
  "**/seed.json"
  "**/seed.txt"
)

# ─── Helpers ────────────────────────────────────────────────────────────────

err()  { printf '\033[1;31m[ERR]\033[0m  %s\n' "$*" >&2; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m[OK]\033[0m   %s\n' "$*"; }
info() { printf '\033[1;36m[INFO]\033[0m %s\n' "$*"; }

# ─── Pre-flight checks ──────────────────────────────────────────────────────

cd "$ROOT"

info "Repo root: $ROOT"
info "Mode:      $MODE"
info "Backup:    $BACKUP_DIR"
echo

# 1. git-filter-repo must be installed
if ! command -v git-filter-repo >/dev/null 2>&1; then
  err "git-filter-repo not found in PATH."
  err "Install:  pip install --user git-filter-repo  (or your distro package)"
  exit 2
fi
ok "git-filter-repo present: $(git-filter-repo --version 2>&1 | head -1)"

# 2. Must be inside a git work tree
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  err "Not inside a git work tree."
  exit 2
fi

# 3. Tree must be clean (no staged / unstaged changes)
if [[ -n "$(git status --porcelain)" ]]; then
  err "Working tree is dirty. Commit or stash first."
  git status --short
  exit 2
fi
ok "Working tree is clean."

# 4. On main branch
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  warn "Current branch is '$CURRENT_BRANCH', not 'main'."
  warn "filter-repo rewrites ALL refs reachable, but consider switching to main first."
fi

# 5. Show what will be removed (by HEAD presence)
info "Paths currently present at HEAD that match the leaked list:"
for p in "${LEAKED_PATHS[@]}"; do
  if git ls-files --error-unmatch -- "$p" >/dev/null 2>&1 \
     || [[ -e "$p" ]]; then
    printf '  • %s\n' "$p"
  fi
done
echo

info "Glob patterns that will be applied to all history:"
for g in "${LEAKED_GLOBS[@]}"; do
  printf '  • %s\n' "$g"
done
echo

# ─── Build filter-repo arg list ─────────────────────────────────────────────

FILTER_ARGS=(--invert-paths --force)
for p in "${LEAKED_PATHS[@]}"; do
  FILTER_ARGS+=(--path "$p")
done
for g in "${LEAKED_GLOBS[@]}"; do
  FILTER_ARGS+=(--path-glob "$g")
done

# ─── Mode dispatch ──────────────────────────────────────────────────────────

case "$MODE" in
  --dry-run)
    info "DRY RUN — printing exact commands without executing."
    echo
    echo "# 1. Backup bare clone"
    echo "git clone --bare \"$ROOT\" \"$BACKUP_DIR\""
    echo
    echo "# 2. Rewrite history (DESTRUCTIVE)"
    echo "cd \"$ROOT\""
    printf "git filter-repo"
    for arg in "${FILTER_ARGS[@]}"; do
      if [[ "$arg" == --* ]]; then
        printf ' \\\n    %s' "$arg"
      else
        printf ' %q' "$arg"
      fi
    done
    echo
    echo
    echo "# 3. Verify (no leaked content remains)"
    echo "git log --all --full-history --oneline -- docs/docs2.9/ZION_KEYS  # expect empty"
    echo "git log --all --full-history --oneline -- V3-src.zip              # expect empty"
    echo "git rev-list --all | xargs -I{} git ls-tree -r {} | grep -E '(zion-wallet|GITHUB_TOKEN|OPENAI_API_KEY|V3-src)' | head"
    echo
    echo "# 4. Force-push (operator runs this MANUALLY after verification)"
    echo "# git remote add origin <REMOTE_URL>   # filter-repo strips the remote"
    echo "# git push --force-with-lease origin main"
    echo "# git push --force-with-lease origin --tags"
    echo
    info "To actually run: rerun with --execute"
    ;;

  --execute)
    warn "EXECUTE MODE — destructive."
    echo
    read -r -p "Confirm: have you rotated PAT, OpenAI key, AND SSH key? (yes/no): " ACK1
    if [[ "$ACK1" != "yes" ]]; then
      err "Aborted: rotation not confirmed."
      exit 3
    fi
    read -r -p "Confirm: collaborators / forks notified about incoming rewrite? (yes/no): " ACK2
    if [[ "$ACK2" != "yes" ]]; then
      err "Aborted: collaborator notification not confirmed."
      exit 3
    fi
    read -r -p "Type 'REWRITE' to proceed (anything else aborts): " ACK3
    if [[ "$ACK3" != "REWRITE" ]]; then
      err "Aborted."
      exit 3
    fi

    # 1. Backup
    info "Creating bare backup clone at: $BACKUP_DIR"
    git clone --bare "$ROOT" "$BACKUP_DIR"
    ok "Backup created."

    # 2. Rewrite
    info "Running git filter-repo …"
    git filter-repo "${FILTER_ARGS[@]}"
    ok "History rewrite complete."

    # 3. Verify
    info "Verification — looking for residual leaked paths in rewritten history:"
    RESIDUAL=0
    for p in "${LEAKED_PATHS[@]}"; do
      if git log --all --full-history --oneline -- "$p" 2>/dev/null | grep -q .; then
        err "  ✗ Still present: $p"
        RESIDUAL=$((RESIDUAL+1))
      else
        ok "  ✓ Gone: $p"
      fi
    done

    if [[ $RESIDUAL -gt 0 ]]; then
      err "$RESIDUAL leaked path(s) remain. Investigate before pushing."
      exit 4
    fi

    echo
    ok "Local rewrite complete. Backup: $BACKUP_DIR"
    warn "Remote 'origin' was stripped by filter-repo. Re-add it manually:"
    echo "    git remote add origin git@github.com:Yose144/2.9.6.git"
    warn "Then force-push (operator decision):"
    echo "    git push --force-with-lease origin main"
    echo "    git push --force-with-lease origin --tags"
    ;;

  *)
    err "Unknown mode: $MODE"
    err "Usage: $0 [--dry-run|--execute]"
    exit 1
    ;;
esac
