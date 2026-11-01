#!/usr/bin/env bash
#
# F6 — zapne 301 redirect pro JEDEN povrch (a nic jiného).
#
#   bash Kingdom/infra/deploy/enable-redirect.sh pool --dry-run   # co by se stalo
#   bash Kingdom/infra/deploy/enable-redirect.sh pool             # zapíše + reload
#
# Co dělá:
#   1. ověří, že povrch je v mapě `ready` (blocked = odmítne),
#   2. zálohuje živý vhost do /etc/nginx/backups/ (mimo sites-enabled!),
#   3. přepíše jen `location / { … }` na `return 301 <cíl>$request_uri`,
#      ostatní location bloky (/ops/, /public/v1/, /api/…) nechá být,
#   4. `nginx -t`; když spadne, vrátí zálohu a skončí,
#   5. reload + kontrola, že redirect opravdu vrací 301.
#
# Rollback: bash Kingdom/infra/deploy/rollback-redirect.sh <povrch>
set -euo pipefail

MAP="$(dirname "$0")/../nginx/redirects/map.tsv"
HOST="${ZION_EDGE_HOST:-zion-edge2}"
SURFACE="${1:-}"
MODE="${2:-apply}"

[[ -n "$SURFACE" ]] || { echo "použití: $0 <povrch> [--dry-run]" >&2; exit 2; }
[[ -f "$MAP" ]] || { echo "chybí mapa $MAP" >&2; exit 2; }

ROW="$(awk -v s="$SURFACE" -F'\t' '$1==s {print; exit}' "$MAP")"
[[ -n "$ROW" ]] || { echo "povrch '$SURFACE' není v mapě" >&2; exit 2; }

IFS=$'\t' read -r _ vhost target status reason <<< "$ROW"

if [[ "$status" != "ready" ]]; then
  echo "ODMÍTNUTO: '$SURFACE' je '$status' — $reason" >&2
  echo "Nejdřív musí vzniknout náhrada v Kingdomu (§3 plánu), pak se stav změní na 'ready'." >&2
  exit 3
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
VHOST="/etc/nginx/sites-available/${vhost}.conf"

echo "==> ${SURFACE}: ${vhost} → ${target}"
echo "    vhost:  ${VHOST}"
echo "    mód:    ${MODE}"

if [[ "$MODE" == "--dry-run" ]]; then
  ssh "$HOST" "test -f '${VHOST}' && grep -n 'location / ' '${VHOST}' | head -3" || {
    echo "vhost na serveru nenalezen" >&2; exit 1; }
  echo "    (dry-run — nic se nemění)"
  exit 0
fi

# 1) záloha + přepis location /
ssh "$HOST" "bash -s -- '${VHOST}' '${STAMP}' '${target}'" <<'REMOTE'
set -euo pipefail
vhost="$1"; stamp="$2"; target="$3"
backup_dir="/etc/nginx/backups/redirects"
mkdir -p "$backup_dir"
backup="${backup_dir}/$(basename "$vhost").bak-${stamp}"
cp -p "$vhost" "$backup"
echo "    záloha: $backup"

python3 - "$vhost" "$target" <<'PY'
import re, sys
path, target = sys.argv[1], sys.argv[2]
src = open(path, encoding='utf-8').read()

# Najdi `location / {` a jeho uzavírací závorku (počítáním úrovní).
m = re.search(r'(?m)^(\s*)location\s+/\s*\{', src)
if not m:
    sys.exit('nenalezen blok "location / {"')
indent = m.group(1)
start = m.end() - 1  # pozice '{'
depth = 0
end = None
for i in range(start, len(src)):
    if src[i] == '{':
        depth += 1
    elif src[i] == '}':
        depth -= 1
        if depth == 0:
            end = i
            break
if end is None:
    sys.exit('neuzavřený blok "location /"')

new_block = '{\n' + f'{indent}    return 301 {target}$request_uri;\n' + indent + '}'
src = src[:start] + new_block + src[end + 1:]
open(path, 'w', encoding='utf-8').write(src)
print('    location / → 301 (ostatní location bloky zůstaly)')
PY
REMOTE

# 2) test + reload; při chybě vrátit zálohu
if ! ssh "$HOST" "nginx -t"; then
  echo "nginx -t selhal → vracím zálohu" >&2
  ssh "$HOST" "cp -p /etc/nginx/backups/redirects/$(basename "$VHOST").bak-${STAMP} '${VHOST}' && nginx -t && nginx -s reload"
  exit 1
fi
ssh "$HOST" "nginx -s reload"

# 3) kontrola
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://${vhost}/")"
loc="$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 15 "https://${vhost}/")"
echo "==> kontrola: https://${vhost}/ → ${code} ${loc}"
[[ "$code" == "301" || "$code" == "308" ]] || {
  echo "POZOR: čekán 301, přišlo ${code}" >&2; exit 1; }

echo "==> hotovo. Rollback: bash Kingdom/infra/deploy/rollback-redirect.sh ${SURFACE}"
