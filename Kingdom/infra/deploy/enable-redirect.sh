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

IFS=$'\t' read -r _ vhost target status reason probe root_target <<< "$ROW"
probe="${probe:-$target}"

if [[ "$status" != "ready" ]]; then
  echo "ODMÍTNUTO: '$SURFACE' je '$status' — $reason" >&2
  echo "Nejdřív musí vzniknout náhrada v Kingdomu (§3 plánu), pak se stav změní na 'ready'." >&2
  exit 3
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
VHOST="/etc/nginx/sites-available/${vhost}.conf"

# ⚠️ Někde je sites-enabled SYMLINK do sites-available, jinde OBYČEJNÝ SOUBOR
# (apex je takový). Editovat sites-available u obyčejného souboru znamená, že
# nginx nic nezmění — a vypadá to, že se přepis povedl. Proto se cíl resolvuje
# až na serveru a níž se pracuje s ním.

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
ssh "$HOST" "bash -s -- '${vhost}.conf' '${STAMP}' '${target}' '${root_target:-}'" <<'REMOTE'
set -euo pipefail
name="$1"; stamp="$2"; target="$3"; root_target="${4:-}"

# Co nginx skutečně načítá: symlink → jego cíl, obyčejný soubor → ten soubor.
if [[ -L "/etc/nginx/sites-enabled/${name}" ]]; then
  vhost="$(readlink -f "/etc/nginx/sites-enabled/${name}")"
elif [[ -f "/etc/nginx/sites-enabled/${name}" ]]; then
  vhost="/etc/nginx/sites-enabled/${name}"
elif [[ -f "/etc/nginx/sites-available/${name}" ]]; then
  vhost="/etc/nginx/sites-available/${name}"
else
  echo "nenalezen vhost ${name} ani v sites-enabled, ani v sites-available" >&2; exit 1
fi
echo "    soubor: $vhost$([[ -L "/etc/nginx/sites-enabled/${name}" ]] && echo ' (symlink)' || echo ' (obyčejný soubor)')"

backup_dir="/etc/nginx/backups/redirects"
mkdir -p "$backup_dir"
backup="${backup_dir}/${name}.bak-${stamp}"
cp -p "$vhost" "$backup"
echo "    záloha: $backup"

python3 - "$vhost" "$target" "$root_target" <<'PY'
import re, sys
path, target, root_target = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path, encoding='utf-8').read()

# Vhost má obvykle DVA server bloky (port 80 + 443). Přepsat jen první by
# znamenalo, že HTTP redirectuje a HTTPS dál servíruje starý web — přesně ta
# chyba, kterou odhalila simulace. Proto se prochází všechny výskyty.
def blocks(text):
    out = []
    for m in re.finditer(r'(?m)^(\s*)location\s+/\s*\{', text):
        start = m.end() - 1
        depth = 0
        end = None
        for i in range(start, len(text)):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end is None:
            sys.exit('neuzavřený blok "location /"')
        out.append((m.start(), end, m.group(1)))
    return out

found = blocks(src)
if not found:
    sys.exit('nenalezen blok "location / {"')

def replacement(indent):
    if root_target:
        # `/` má jít jinam než zbytek (apex → Brána, ostatní cesty → Archiv v3).
        return (
            f'{indent}location = / {{\n{indent}    return 301 {root_target};\n{indent}}}\n'
            f'{indent}location / {{\n{indent}    return 301 {target}$request_uri;\n{indent}}}'
        )
    return f'{indent}location / {{\n{indent}    return 301 {target}$request_uri;\n{indent}}}'

# Od konce, aby zůstaly indexy platné.
for start, end, indent in reversed(found):
    src = src[:start] + replacement(indent) + src[end + 1:]

open(path, 'w', encoding='utf-8').write(src)
if root_target:
    note = f'location = / → {root_target}; location / → {target}$request_uri'
else:
    note = f'location / → 301 {target}$request_uri'
print(f'    {note} v {len(found)} server blocích (ostatní location zůstaly)')
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
probe_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${probe}" || echo '---')"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://${vhost}/")"
loc="$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 15 "https://${vhost}/")"
echo "==> cíl (${probe}) → ${probe_code}"
[[ "$probe_code" == "200" ]] || { echo "POZOR: cíl nevrací 200 — redirect by vedl do prázdna" >&2; exit 1; }
echo "==> kontrola: https://${vhost}/ → ${code} ${loc}"
[[ "$code" == "301" || "$code" == "308" ]] || {
  echo "POZOR: čekán 301, přišlo ${code}" >&2; exit 1; }

echo "==> hotovo. Rollback: bash Kingdom/infra/deploy/rollback-redirect.sh ${SURFACE}"
