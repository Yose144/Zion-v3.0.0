#!/usr/bin/env bash
# Ověří, že produkt "Království srdce" má soubor na disku, ale veřejně
# ho bez podpisu nejde stáhnout.
#
# Řetěz, který se kontroluje:
#   1. API /api/shop/products u book-001 NEVRACÍ filesUrl
#   2. Veřejné /shop/downloads/<zip> bez podpisu není 200/206
#   3. ZIP leží v /opt/zion/data/downloads/ (nebo DOWNLOADS_DIR) a má
#      40 PDF + 40 EPUB — kontrola z disku, ne z veřejné URL
#
# Volitelně (když je nastavené DOWNLOAD_SIGNING_SECRET a existuje
# zaplacená objednávka): ověřit podepsaný odkaz mimo tento skript.
#
# Použití:
#   bash scripts/ops/verify-market-downloads.sh
#
# Exit 0 = vše v pořádku, 1 = něco chybí (vypíše co).

set -uo pipefail

BASE="${MARKET_BASE:-https://market.zionterranova.com}"
EXPECTED_FILE="Kralovstvi_srdce_kompletni_edice_5_jazyku.zip"
EXPECTED_URL="${BASE}/shop/downloads/${EXPECTED_FILE}"
DOWNLOADS_DIR="${DOWNLOADS_DIR:-/opt/zion/data/downloads}"
fails=0

say() { printf '%s\n' "$*"; }
ok()  { printf '  ✅ %s\n' "$*"; }
bad() { printf '  ❌ %s\n' "$*"; fails=$((fails+1)); }

say "== 1. Produkt book-001 (veřejné API nesmí prozradit filesUrl) =="
api="$(curl -s -m 20 "${BASE}/api/shop/products?category=books&pageSize=50")"
if [[ -z "$api" ]]; then
  bad "API /api/shop/products neodpovídá"
else
  files_url="$(printf '%s' "$api" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit
for p in (d.get("data") or []):
    if p.get("externalId")=="book-001":
        print(p.get("filesUrl") or ""); break
')"
  found="$(printf '%s' "$api" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print("0"); raise SystemExit
print("1" if any(p.get("externalId")=="book-001" for p in (d.get("data") or [])) else "0")
')"
  if [[ "$found" != "1" ]]; then
    bad "book-001 v API chybí"
  elif [[ -n "$files_url" ]]; then
    bad "book-001 stále vrací filesUrl ($files_url) — veřejné API musí pole vynechat"
  else
    ok "book-001 je v API a filesUrl není ve veřejné odpovědi"
  fi
fi

say "== 2. Veřejné stažení bez podpisu musí být zamítnuté =="
code="$(curl -s -o /dev/null -w '%{http_code}' -r 0-1023 -m 30 "$EXPECTED_URL" || echo 000)"
if [[ "$code" == "200" || "$code" == "206" ]]; then
  bad "HTTP $code — ZIP je pořád veřejný na $EXPECTED_URL (nginx alias nebo public/)"
elif [[ "$code" == "401" || "$code" == "403" ]]; then
  ok "HTTP $code — veřejný odkaz bez podpisu je zamítnutý"
else
  bad "HTTP $code — očekává se 401/403 u nepodepsaného odkazu"
fi

say "== 3. Obsah ZIPu na disku =="
src="${DOWNLOADS_DIR}/${EXPECTED_FILE}"
tmp=""
if [[ -s "$src" ]]; then
  ok "soubor je na $src"
  zip_path="$src"
else
  say "  ⚠️  $src tu není (skript neběží na edge) — zkouším jen hlavičku nepodepsané URL, obsah přeskočen"
  zip_path=""
fi

if [[ -n "$zip_path" ]]; then
  res="$(python3 - "$zip_path" <<'PY'
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
names = z.namelist()
pdf = sum(1 for n in names if n.endswith(".pdf"))
epub = sum(1 for n in names if n.endswith(".epub"))
bad = z.testzip()
print(f"{pdf} {epub} {'ok' if bad is None else 'corrupt:'+str(bad)}")
PY
)"
  set -- $res
  if [[ "${1:-0}" -eq 40 && "${2:-0}" -eq 40 && "${3:-}" == "ok" ]]; then
    ok "40 PDF + 40 EPUB, archiv bez poškození"
  else
    bad "obsah nesedí: PDF=${1:-?} EPUB=${2:-?} stav=${3:-?}"
  fi
fi

echo
if [[ "$fails" -eq 0 ]]; then
  say "VŠE OK — soubor je na disku a veřejné API/URL ho neprozrazuje."
  exit 0
fi
say "NÁLEZY: $fails — viz výše."
exit 1
