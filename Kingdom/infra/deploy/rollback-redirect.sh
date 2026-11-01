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
VHOST="/etc/nginx/sites-available/${vhost}.conf"
BASE="$(basename "$VHOST")"

if [[ "$MODE" == "--list" ]]; then
  ssh "$HOST" "ls -1t /etc/nginx/backups/redirects/${BASE}.bak-* 2>/dev/null" || {
    echo "žádné zálohy pro ${vhost}" >&2; exit 1; }
  exit 0
fi

ssh "$HOST" "bash -s -- '${VHOST}' '${BASE}'" <<'REMOTE'
set -euo pipefail
vhost="$1"; base="$2"
latest="$(ls -1t /etc/nginx/backups/redirects/${base}.bak-* 2>/dev/null | head -1)"
[[ -n "$latest" ]] || { echo "žádná záloha pro $vhost" >&2; exit 1; }
echo "    obnovuji: $latest"
cp -p "$latest" "$vhost"
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
