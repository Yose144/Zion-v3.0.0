#!/usr/bin/env bash
#
# F6 — kontrola redirect mapy PŘED flipem. Nic nemění, jen čte.
#
#   bash scripts/ops/check-redirects.sh            # mapa + živý stav povrchů
#
# Co ověřuje:
#   1. každý řádek mapy má 5 sloupců a platný stav (ready/blocked/done),
#   2. `ready` povrch má v Kingdomu skutečný cíl (HTTP 200 na cílové cestě),
#   3. `blocked` povrch má v důvodu vysvětlení (nesmí se zapnout mlčky),
#   4. živý stav: co dnes daný hostname vrací (aby bylo vidět před/po),
#   5. že na serveru nejsou zálohy v sites-enabled (past s include `*`).
set -euo pipefail

cd "$(dirname "$0")/../.."
MAP="Kingdom/infra/nginx/redirects/map.tsv"
HOST="${ZION_EDGE_HOST:-zion-edge2}"
fail=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

[[ -f "$MAP" ]] || { red "chybí $MAP"; exit 1; }

printf '%-11s %-9s %-42s %s\n' "POVRCH" "STAV" "CÍL" "DNES"
printf '%-11s %-9s %-42s %s\n' "-----------" "---------" "------------------------------------------" "-------"

while IFS=$'\t' read -r surface vhost target status reason probe root_target; do
  [[ -z "${surface:-}" || "$surface" == \#* ]] && continue

  # 1) tvar řádku (5 povinných sloupců, probe/root volitelné)
  if [[ -z "${vhost:-}" || -z "${target:-}" || -z "${status:-}" || -z "${reason:-}" ]]; then
    red "$(printf '%-11s %-9s %s' "$surface" "CHYBA" "řádek nemá povinné sloupce")"; fail=1; continue
  fi
  probe="${probe:-$target}"
  case "$status" in ready|blocked|done) ;; *) red "$(printf '%-11s %-9s %s' "$surface" "CHYBA" "neznámý stav '$status'")"; fail=1; continue ;; esac

  today="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "https://${vhost}/" || echo '---')"

  if [[ "$status" == "ready" ]]; then
    # 2) cíl musí být živý (200) — jinak by redirect vedl do prázdna
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$probe" || echo '---')"
    if [[ "$code" == "200" ]]; then
      green "$(printf '%-11s %-9s %-42s %s' "$surface" "$status" "${root_target:-$target}" "$today")"
    else
      red "$(printf '%-11s %-9s %-42s %s' "$surface" "$status" "cíl $probe → $code!" "$today")"; fail=1
    fi
  elif [[ "$status" == "blocked" ]]; then
    if [[ ${#reason} -lt 20 ]]; then
      red "$(printf '%-11s %-9s %-42s %s' "$surface" "$status" "$target" "chybí důvod!")"; fail=1
    else
      yellow "$(printf '%-11s %-9s %-42s %s' "$surface" "$status" "$target" "$today")"
    fi
  else
    printf '%-11s %-9s %-42s %s\n' "$surface" "$status" "$target" "$today"
  fi
done < "$MAP"

echo
# 5) zálohy v sites-enabled = druhý vhost vedle živého (nginx include bere `*`)
strays="$(ssh "$HOST" "ls /etc/nginx/sites-enabled/ 2>/dev/null | grep -E '\.(bak|old|save)' || true" || true)"
if [[ -n "$strays" ]]; then
  red "v /etc/nginx/sites-enabled/ jsou zálohy (nginx je načte jako druhé vhosty):"
  echo "$strays" | sed 's/^/    /'
  fail=1
else
  green "sites-enabled je čistý (žádné .bak)"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  green "mapa je konzistentní; 'blocked' povrchy se nezapnou (enable skript je odmítne)"
else
  red "mapa není v pořádku — flip neprovádět"
  exit 1
fi
