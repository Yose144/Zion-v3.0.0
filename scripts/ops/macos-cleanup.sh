#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# macos-cleanup.sh — úklid macOS (cache, Xcode, Docker, koš, repo balast)
#
# Výchozí chování je DRY-RUN: jen spočítá a vypíše, co by se smazalo.
# Nic nesmaže, dokud nepřidáš --apply.
#
# Použití:
#   bash scripts/ops/macos-cleanup.sh                  # dry-run, vše (kromě --trash)
#   bash scripts/ops/macos-cleanup.sh --safe --dev     # jen vybrané sekce (dry-run)
#   bash scripts/ops/macos-cleanup.sh --all --apply    # opravdu smazat (bez koše)
#   bash scripts/ops/macos-cleanup.sh --trash --apply  # vysypat koš
#   bash scripts/ops/macos-cleanup.sh --report         # jen report velkých souborů
#
# Sekce: safe (cache/logy/balíčkovače), dev (Xcode/simulátory), docker, trash, repo, report
# ---------------------------------------------------------------------------
set -uo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Tento skript je pro macOS (uname: $(uname -s))." >&2
  echo "Na Linuxu použij běžné: df -h / | du -xh --max-depth=1 ~ | sort -rh | head" >&2
  exit 2
fi

APPLY=0
DO_SAFE=0; DO_DEV=0; DO_DOCKER=0; DO_TRASH=0; DO_REPO=0; DO_REPORT=0
REPO_PATH="$PWD"
EXPLICIT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)  APPLY=1 ;;
    --safe)   DO_SAFE=1; EXPLICIT=1 ;;
    --dev)    DO_DEV=1; EXPLICIT=1 ;;
    --docker) DO_DOCKER=1; EXPLICIT=1 ;;
    --trash)  DO_TRASH=1; EXPLICIT=1 ;;
    --repo)   DO_REPO=1; EXPLICIT=1 ;;
    --report) DO_REPORT=1; EXPLICIT=1 ;;
    --repo-path) shift; REPO_PATH="${1:-$PWD}" ;;
    --all)    DO_SAFE=1; DO_DEV=1; DO_DOCKER=1; DO_REPO=1; DO_REPORT=1; EXPLICIT=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Neznámý argument: $1 (viz --help)" >&2; exit 2 ;;
  esac
  shift
done

# Bez explicitní volby = rozumný default (vše kromě koše)
if [ "$EXPLICIT" -eq 0 ]; then
  DO_SAFE=1; DO_DEV=1; DO_DOCKER=1; DO_REPO=1; DO_REPORT=1
fi

FREED=0   # v KB, jen orientační

# velikost v KB (0 když cesta neexistuje)
size_kb() {
  [ -e "$1" ] || { echo 0; return; }
  du -sk "$1" 2>/dev/null | awk '{print $1}' | head -1
}

human() {
  awk -v k="${1:-0}" 'BEGIN{
    if (k >= 1048576) printf "%.1f GB", k/1048576;
    else if (k >= 1024) printf "%.1f MB", k/1024;
    else printf "%d KB", k;
  }'
}

# target <cesta> <popis>
target() {
  local p="$1" label="$2" kb
  [ -e "$p" ] || return 0
  kb=$(size_kb "$p")
  [ "${kb:-0}" -lt 1024 ] && return 0   # menší než 1 MB neřešíme
  printf '  %10s  %s\n' "$(human "$kb")" "$p"
  FREED=$((FREED + kb))
  if [ "$APPLY" -eq 1 ]; then
    rm -rf "$p" 2>/dev/null || echo "    ! nepodařilo se smazat: $p"
  fi
}

note() { printf '    %s\n' "$1"; }

echo "== macOS úklid =================================================="
echo "režim: $([ "$APPLY" -eq 1 ] && echo 'APPLY (maže se)' || echo 'DRY-RUN (nic se nemaže)')"
echo "domov: $HOME"
echo

# ---------------------------------------------------------------- SAFE
if [ "$DO_SAFE" -eq 1 ]; then
  echo "[safe] cache, logy, balíčkovače"
  target "$HOME/Library/Caches"                        "app cache"
  target "$HOME/Library/Logs"                          "app logy"
  target "$HOME/.npm/_cacache"                         "npm cache"
  target "$HOME/.npm/_logs"                            "npm logy"
  target "$HOME/Library/Caches/Yarn"                   "yarn cache"
  target "$HOME/.yarn/cache"                           "yarn cache (berry)"
  target "$HOME/Library/pnpm/store"                     "pnpm store"
  target "$HOME/.cache/pip"                            "pip cache"
  target "$HOME/Library/Caches/pip"                    "pip cache (mac)"
  target "$HOME/Library/Caches/uv"                     "uv cache"
  target "$HOME/Library/Caches/go-build"               "go build cache"
  target "$HOME/.cargo/registry/cache"                 "cargo cache (bez zdrojáků)"
  target "$HOME/Library/Caches/Homebrew"               "brew cache"
  target "$HOME/Library/Caches/ms-playwright"          "playwright browsery"

  if command -v brew >/dev/null 2>&1; then
    note "brew cleanup: $(brew cleanup -n 2>/dev/null | tail -1)"
    if [ "$APPLY" -eq 1 ]; then
      brew cleanup -s --prune=all >/dev/null 2>&1 || brew cleanup -s >/dev/null 2>&1
      note "brew cleanup hotový"
    fi
  fi

  if [ "$APPLY" -eq 1 ]; then
    qlmanage -r cache >/dev/null 2>&1 && note "QuickLook cache reset"
  else
    note "QuickLook cache (reset až s --apply)"
  fi
  echo
fi

# ----------------------------------------------------------------- DEV
if [ "$DO_DEV" -eq 1 ]; then
  echo "[dev] Xcode, simulátory"
  target "$HOME/Library/Developer/Xcode/DerivedData"          "DerivedData"
  target "$HOME/Library/Developer/CoreSimulator/Caches"       "simulátor cache"
  target "$HOME/Library/Developer/Xcode/iOS DeviceSupport"    "iOS DeviceSupport (stará zařízení)"
  target "$HOME/Library/Developer/Xcode/watchOS DeviceSupport" "watchOS DeviceSupport"
  target "$HOME/Library/Developer/Xcode/UserData/IB Support"  "IB Support cache"
  target "$HOME/Library/Developer/Xcode/Archives"             "Xcode Archives (pozor: archivy buildů)"
  target "$HOME/Library/Developer/Xcode/DocumentationCache"   "doc cache"

  if command -v xcrun >/dev/null 2>&1; then
    note "nedostupné simulátory: $(xcrun simctl list devices 2>/dev/null | grep -c unavailable)ks"
    if [ "$APPLY" -eq 1 ]; then
      xcrun simctl delete unavailable >/dev/null 2>&1 && note "nedostupné simulátory smazány"
    fi
  fi
  echo
fi

# -------------------------------------------------------------- DOCKER
if [ "$DO_DOCKER" -eq 1 ]; then
  echo "[docker] obrazy, kontejnery, volumes"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    note "$(docker system df --format '{{.Type}}: {{.Size}} (reclaim {{.Reclaimable}})' 2>/dev/null | paste -sd' | ' -)"
    note "nevyužívané volumes: $(docker volume ls -qf dangling=true 2>/dev/null | wc -l | tr -d ' ')ks"
    if [ "$APPLY" -eq 1 ]; then
      docker system prune -af --volumes >/dev/null 2>&1 && note "docker prune hotový (pozor: smazány i volumes!)"
    else
      note "s --apply by se spustilo: docker system prune -af --volumes"
    fi
  else
    note "Docker neběží / není nainstalovaný — přeskakuji"
  fi
  echo
fi

# --------------------------------------------------------------- TRASH
if [ "$DO_TRASH" -eq 1 ]; then
  echo "[trash] koš"
  target "$HOME/.Trash" "koš"
  if [ "$APPLY" -eq 1 ]; then
    find "$HOME/.Trash" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
    note "koš vysypán"
  fi
  echo
fi

# ---------------------------------------------------------------- REPO
if [ "$DO_REPO" -eq 1 ]; then
  echo "[repo] balast v $REPO_PATH"
  if [ -d "$REPO_PATH" ]; then
    n_ds=$(find "$REPO_PATH" -name '.DS_Store' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')
    n_pyc=$(find "$REPO_PATH" -name '__pycache__' -type d -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')
    n_ad=$(find "$REPO_PATH" -name '._*' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')
    note ".DS_Store: $n_ds | __pycache__: $n_pyc | AppleDouble ._*: $n_ad"
    for d in .pytest_cache .mypy_cache .ruff_cache .ipynb_checkpoints; do
      [ -d "$REPO_PATH/$d" ] && target "$REPO_PATH/$d" "cache"
    done
    if [ "$APPLY" -eq 1 ]; then
      find "$REPO_PATH" -name '.DS_Store' -not -path '*/node_modules/*' -delete 2>/dev/null
      find "$REPO_PATH" -name '._*' -not -path '*/node_modules/*' -delete 2>/dev/null
      find "$REPO_PATH" -name '__pycache__' -type d -not -path '*/node_modules/*' -prune -exec rm -rf {} + 2>/dev/null
      find "$REPO_PATH" \( -name '.pytest_cache' -o -name '.mypy_cache' -o -name '.ruff_cache' -o -name '.ipynb_checkpoints' \) -type d -prune -exec rm -rf {} + 2>/dev/null
      note "repo balast uklizen"
    fi
  else
    note "cesta neexistuje: $REPO_PATH"
  fi
  echo
fi

# -------------------------------------------------------------- REPORT
if [ "$DO_REPORT" -eq 1 ]; then
  echo "[report] největší soubory v domově (> 1 GB)"
  find "$HOME" -xdev -type f -size +1G 2>/dev/null \
    | while read -r f; do printf '%s\t%s\n' "$(du -sk "$f" 2>/dev/null | awk '{print $1}')" "$f"; done \
    | sort -rn | head -15 \
    | while IFS="$(printf '\t')" read -r kb path; do printf '  %10s  %s\n' "$(human "$kb")" "$path"; done
  if command -v tmutil >/dev/null 2>&1; then
    snaps=$(tmutil listlocalsnapshots / 2>/dev/null | grep -c 'com.apple.TimeMachine' || true)
    note "lokální APFS snapshoty: ${snaps:-0} (smaže jen sudo tmutil deletelocalsnapshots /)"
  fi
  echo
fi

echo "================================================================"
if [ "$APPLY" -eq 1 ]; then
  echo "Uvolněno (odhad): $(human "$FREED")"
  echo "Volné místo teď: $(df -h "$HOME" | awk 'NR==2{print $4" z "$5" využito"}')"
else
  echo "Kandidáti na smazání: $(human "$FREED")"
  echo "Nic se nesmazalo. Spusť znovu s --apply, až bude seznam v pořádku."
fi
