#!/usr/bin/env bash
# K1.3 — ověření, že je strom připravený k deployi (bez jediného zápisu na server).
#
# Proč: layout standalone se při každé změně workspace rootu posune
# (`.next/standalone/<app>/` → `.next/standalone/apps/<app>/`) a deploy skript
# na to spadne až na serveru. Tenhle skript to řekne dopředu, lokálně.
#
# Co kontroluje u každé Next appky se standalone výstupem:
#   1. najde `server.js` v hloubce (stejně jako to dělají deploy skripty),
#   2. ověří artefakt: BUILD_ID, node_modules/next, .next/static,
#   3. ověří, že appka má `public/` (staging ho kopíruje vedle server.js),
#   4. ověří, že `.next` existuje (tzn. build proběhl).
#
# Použití:
#   bash scripts/ops/check-next-deploys.sh           # jen zkontroluj
#   bash scripts/ops/check-next-deploys.sh --build   # nejdřív buildy (dlouhé)
#
# Exit 0 = všechny appky připravené; 1 = aspoň jedna ne.
set -euo pipefail

cd "$(dirname "$0")/../.."
REPO="$(pwd)"
BUILD=0
[[ "${1:-}" == "--build" ]] && BUILD=1

# app_dir|npm workspace|deploy skript|typ
APPS=(
  "apps/nirvana|zion-nirvana|apps/nirvana/deploy/deploy-nirvana.sh|standalone"
  "apps/website-v2.9|zion-web-v3.2.0|apps/website-v2.9/deploy/deploy-web2.9.sh|standalone"
  "apps/MarketPlace|zion-marketplace|apps/MarketPlace/deploy/deploy-marketplace.sh|standalone-flat"
  "apps/OasisWeb|oasis-web|apps/OasisWeb/deploy/deploy-oasis-web.sh|static"
)

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

fail=0
printf '%-22s %-12s %s\n' "APP" "STAV" "DETAIL"
printf '%-22s %-12s %s\n' "----------------------" "------------" "----------------------------------------"

for entry in "${APPS[@]}"; do
  IFS='|' read -r dir workspace script type <<< "$entry"
  name="$(basename "$dir")"
  detail=""
  state="OK"

  if [[ ! -d "$dir" ]]; then
    red "$(printf '%-22s %-12s %s' "$name" "CHYBA" "adresář neexistuje")"
    fail=1; continue
  fi

  if [[ "$BUILD" == 1 ]]; then
    echo "→ build $workspace"
    if ! npm run build -w "$workspace" >"/tmp/check-deploy-$name.log" 2>&1; then
      red "$(printf '%-22s %-12s %s' "$name" "CHYBA" "build selhal (viz /tmp/check-deploy-$name.log)")"
      fail=1; continue
    fi
  fi

  if [[ ! -d "$dir/.next" && ! -d "$dir/dist" ]]; then
    red "$(printf '%-22s %-12s %s' "$name" "NEBUILD" "chybí .next i dist — spusť build")"
    fail=1; continue
  fi

  if [[ "$type" == "static" ]]; then
    # Statický export: dist/index.html + _next/static
    if [[ -f "$dir/dist/index.html" && -d "$dir/dist/_next" ]]; then
      detail="dist/index.html + $(find "$dir/dist" -type f | wc -l) souborů"
    else
      state="CHYBA"; detail="chybí dist/index.html nebo dist/_next"
      fail=1
    fi
  else
    server="$(find "$dir/.next/standalone" -maxdepth 4 -name server.js 2>/dev/null | head -1)"
    if [[ -z "$server" ]]; then
      state="CHYBA"; detail="server.js nenalezen pod .next/standalone"
      fail=1
    else
      appdir="$(dirname "$server")"
      # cesta relativně ke standalone rootu: "." = plochý layout
      rel="${appdir#"$dir/.next/standalone"}"
      rel="${rel#/}"
      [[ -z "$rel" ]] && rel="."
      missing=()
      [[ -f "$appdir/.next/BUILD_ID" ]] || missing+=("BUILD_ID")
      [[ -d "$appdir/node_modules/next" ]] || [[ -d "$dir/.next/standalone/node_modules/next" ]] || missing+=("node_modules/next")
      [[ -d "$appdir/.next/static" ]] || [[ -d "$dir/.next/static" ]] || missing+=(".next/static")
      [[ -d "$dir/public" ]] || missing+=("public/")
      if [[ ${#missing[@]} -gt 0 ]]; then
        state="CHYBA"; detail="${rel} — chybí: ${missing[*]}"
        fail=1
      else
        # Shoda layoutu se skriptem: `standalone-flat` znamená, že postbuild
        # strom zplošťuje (flatten-standalone.mjs) a skript čte server.js v rootu.
        if [[ "$type" == "standalone-flat" ]]; then
          if [[ "$rel" == "." ]]; then
            detail="plochý layout — server.js v rootu (odpovídá skriptu)"
          else
            state="CHYBA"; detail="${rel} — čekán plochý layout, flatten neproběhl"
            fail=1
          fi
        elif grep -q 'find .*standalone' "$script" 2>/dev/null; then
          detail="${rel} — skript layout hledá dynamicky"
        else
          state="POZOR"; detail="${rel} — skript má layout napevno, zkontroluj ho"
        fi
      fi
    fi
  fi

  if [[ "$state" == "OK" ]]; then
    green "$(printf '%-22s %-12s %s' "$name" "$state" "$detail")"
  else
    red "$(printf '%-22s %-12s %s' "$name" "$state" "$detail")"
  fi
done

echo
if [[ "$fail" -eq 0 ]]; then
  green "vše připraveno k deployi"
else
  red "něco není připravené — neopravuj to nasazením"
  exit 1
fi
