#!/usr/bin/env bash
# Ověří, že produkt "Království srdce" má skutečně dodávaný soubor.
#
# Řetěz, který se kontroluje:
#   1. API /api/shop/products vrací u book-001 neprázdné filesUrl
#   2. URL z filesUrl odpovídá tomu, co očekáváme
#   3. odkaz skutečně stáhne ZIP (200/206) a hlavička Content-Length > 0
#   4. ZIP má uvnitř 40 PDF + 40 EPUB
#
# Použití:
#   bash scripts/ops/verify-market-downloads.sh
#
# Exit 0 = vše v pořádku, 1 = něco chybí (vypíše co).

set -uo pipefail

BASE="${MARKET_BASE:-https://market.zionterranova.com}"
EXPECTED_FILE="Kralovstvi_srdce_kompletni_edice_5_jazyku.zip"
EXPECTED_URL="${BASE}/shop/downloads/${EXPECTED_FILE}"
fails=0

say() { printf '%s\n' "$*"; }
ok()  { printf '  ✅ %s\n' "$*"; }
bad() { printf '  ❌ %s\n' "$*"; fails=$((fails+1)); }

say "== 1. Produkt book-001 =="
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
  if [[ -z "$files_url" ]]; then
    bad "book-001 nemá filesUrl — zákazník po zaplacení nedostane odkaz"
  else
    ok "filesUrl = $files_url"
    if [[ "$files_url" == "$EXPECTED_URL" ]]; then
      ok "odkaz odpovídá očekávanému souboru"
    else
      say "  ⚠️  odkaz je jiný než očekávaný ($EXPECTED_URL) — ověř, že cíl existuje"
    fi
  fi
fi

say "== 2. Stažení =="
code="$(curl -s -o /dev/null -w '%{http_code}' -r 0-1023 -m 30 "$EXPECTED_URL" || echo 000)"
if [[ "$code" == "200" || "$code" == "206" ]]; then
  ok "HTTP $code"
else
  bad "HTTP $code — ZIP není na /opt/zion/data/downloads/ nebo chybí nginx location /shop/downloads/"
fi

len="$(curl -sI -m 30 "$EXPECTED_URL" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}' | tail -1)"
if [[ -n "${len:-}" && "${len:-0}" -gt 1000000 ]]; then
  ok "Content-Length ${len} B ($((len/1000000)) MB)"
else
  bad "Content-Length chybí nebo je malý (${len:-—})"
fi

say "== 3. Obsah ZIPu =="
tmp="$(mktemp -t kralovstvi-check-XXXX).zip"
if curl -s -m 600 -o "$tmp" "$EXPECTED_URL"; then
  res="$(python3 - "$tmp" <<'PY'
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
else
  bad "ZIP se nepodařilo stáhnout celý"
fi
rm -f "$tmp"

echo
if [[ "$fails" -eq 0 ]]; then
  say "VŠE OK — produkt dodává soubor, odkaz žije."
  exit 0
fi
say "NÁLEZY: $fails — viz výše."
exit 1
