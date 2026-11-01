#!/usr/bin/env bash
#
# F6 — vrátí povrch do stavu před redirectem.
#
#   bash Kingdom/infra/deploy/rollback-redirect.sh pool
#   bash Kingdom/infra/deploy/rollback-redirect.sh pool --list   # co je k dispozici
#
# Vezme **nejnovější** zálohu z /etc/nginx/backups/redirects/ a vrátí ji na
# místo vhostu. Zálohy jsou mimo sites-enabled (nginx include bere `*`, takže
# `.bak` soubor v sites-enabled by se načetl jako druhý vhost — přesně ta past,
# na kterou se v tomhle repu už jednou narazilo).
set -euo pipefail

MAP="$(dirname "$0")/../nginx/redirects/map.tsv"
HOST="${ZION_EDGE_HOST:-zion-edge2}"
SURFACE="${1:-}"
MODE="${2:-}"

[[ -n "$SURFACE" ]] || { echo "použití: $0 <povrch> [--list]" >&2; exit 2; }
ROW="$(awk -v s="$SURFACE" -F'\t' '$1==s {print; exit}' "$MAP")"
[[ -n "$ROW" ]] || { echo "povrch '$SURFACE' není v mapě" >&2; exit 2; }
IFS=$'\t' read -r _ vhost target status reason <<< "$ROW"
BASE="${vhost}.conf"

if [[ "$MODE" == "--list" ]]; then
  ssh "$HOST" "ls -1t /etc/nginx/backups/redirects/${BASE}.bak-* 2>/dev/null" || {
    echo "žádné zálohy pro ${vhost}" >&2; exit 1; }
  exit 0
fi

ssh "$HOST" "bash -s -- '${BASE}'" <<'REMOTE'
set -euo pipefail
name="$1"
# Kam zálohu vrátit: symlink → jeho cíl, obyčejný soubor → soubor v sites-enabled.
if [[ -L "/etc/nginx/sites-enabled/${name}" ]]; then
  target="$(readlink -f "/etc/nginx/sites-enabled/${name}")"
elif [[ -f "/etc/nginx/sites-enabled/${name}" ]]; then
  target="/etc/nginx/sites-enabled/${name}"
else
  target="/etc/nginx/sites-available/${name}"
fi
latest="$(ls -1t /etc/nginx/backups/redirects/${name}.bak-* 2>/dev/null | head -1)"
[[ -n "$latest" ]] || { echo "žádná záloha pro $name" >&2; exit 1; }
echo "    obnovuji: $latest → $target"
cp -p "$latest" "$target"
REMOTE

if ! ssh "$HOST" "nginx -t"; then
  echo "POZOR: nginx -t po rollbacku selhal — vhost je vrácený, ale konfigurace neprošla" >&2
  exit 1
fi
ssh "$HOST" "nginx -s reload"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://${vhost}/")"
echo "==> kontrola: https://${vhost}/ → ${code}"
[[ "$code" == "301" ]] && echo "POZOR: stále 301 (rollback neproběhl?)" >&2
echo "==> hotovo (rollback ${SURFACE})"
