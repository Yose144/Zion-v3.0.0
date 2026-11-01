#!/usr/bin/env bash
#
# Archiv v3 — zamrazí dnešní apex (IntroPage) do Kingdomu jako **historii**.
#
#   bash Kingdom/scripts/build-archive-v3.sh            # vytvoří/obnoví archiv
#   bash Kingdom/scripts/build-archive-v3.sh --check    # jen zkontroluje, co tam je
#
# Co to je: statická kopie webu, jak vypadal ve verzi v3.3 (listopad 2026).
# Není to živý povrch — nic se v něm needituje, jen se obnoví z IntroPage.
#
# Proč skript a ne ruční kopie:
#   - cesty v exportu jsou absolutní (`/_next/…`), takže v podadresáři by se
#     rozbily → přepisují se na `/archive/v3/…`;
#   - `legacy/` (385 MB) a `portfolio/` (33 MB) jsou surové archivy, ne web —
#     do bundlu Kingdomu nepatří a zůstávají na původním místě;
#   - manifest (odkud, kdy, z jakého commitu) musí být součástí archivu.
set -euo pipefail

cd "$(dirname "$0")/../.."
SRC="apps/IntroPage/dist"
DST="Kingdom/apps/kingdom/public/archive/v3"
BASE="/archive/v3"
MODE="${1:-build}"

[[ -d "$SRC" ]] || { echo "chybí $SRC — spusť build IntroPage" >&2; exit 1; }

if [[ "$MODE" == "--check" ]]; then
  [[ -d "$DST" ]] || { echo "archiv není vytvořený ($DST)"; exit 1; }
  echo "archiv: $(du -sh "$DST" | cut -f1), html: $(find "$DST" -name '*.html' | wc -l)"
  head -5 "$DST/MANIFEST.txt" 2>/dev/null || true
  exit 0
fi

echo "==> kopíruji $SRC → $DST (bez legacy/, portfolio/)"
rm -rf "$DST"
mkdir -p "$DST"
rsync -a \
  --exclude 'legacy/' \
  --exclude 'portfolio/' \
  "$SRC/" "$DST/"

echo "==> přepisuji absolutní cesty na $BASE/…"
python3 - "$DST" "$BASE" <<'PY'
import os, re, sys
root, base = sys.argv[1], sys.argv[2]

# Atributy a CSS url(), které začínají na "/" a nejsou "//" ani už prefixované.
ATTR = re.compile(r'(?P<pre>\b(?:href|src|action|poster|data-src)=")(?P<url>/[^/"][^"]*)')
CSS_URL = re.compile(r'(?P<pre>url\((?P<q>[\'"]?))(?P<url>/[^/"][^)]*)')
# Meta refresh: `<meta http-equiv="refresh" content="0; url=/">`. Bez přepisu
# by archivní stránka poslala prohlížeč na `/` — tedy na Bránu, ne do archivu.
# Pozor: cíl může být i samotné "/" (stará homepage) — tehdy se má stát
# "/archive/v3/", ne "/archive/v3" (bez lomítka by to bylo 404).
META_REFRESH = re.compile(r'(?P<pre>content="\d+;\s*url=)(?P<url>/[^"]*)')

def fix(html: str) -> str:
    def attr(m):
        if m.group('url').startswith(base + '/'):
            return m.group(0)
        return f"{m.group('pre')}{base}{m.group('url')}"
    html = ATTR.sub(attr, html)

    def meta(m):
        url = m.group('url')
        if url.startswith('//') or url.startswith(base + '/'):
            return m.group(0)
        if url == '/':
            return f"{m.group('pre')}{base}/"
        return f"{m.group('pre')}{base}{url}"
    html = META_REFRESH.sub(meta, html)

    def css(m):
        url = m.group('url').rstrip('\'"')
        if url.startswith(base + '/'):
            return m.group(0)
        return f"{m.group('pre')}{base}{url}"
    return CSS_URL.sub(css, html)

changed = 0
for dirpath, _dirnames, filenames in os.walk(root):
    for name in filenames:
        if not name.endswith(('.html', '.css')):
            continue
        path = os.path.join(dirpath, name)
        try:
            src = open(path, encoding='utf-8').read()
        except UnicodeDecodeError:
            continue
        out = fix(src)
        if out != src:
            open(path, 'w', encoding='utf-8').write(out)
            changed += 1
print(f'    přepsáno souborů: {changed}')
PY

echo "==> manifest"
{
  echo "Archiv v3 — ZION — Nirvana v3.3"
  echo "Zdroj: $SRC (apps/IntroPage, statický export)"
  echo "Vytvořeno: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Commit zdroje: $(git log -1 --format='%H %s' -- "$SRC" 2>/dev/null || echo '(nezjištěno)')"
  echo "Commit archivu: $(git log -1 --format='%H' 2>/dev/null || echo '(nezjištěno)')"
  echo ""
  echo "Vynecháno (surové archivy, ne web):"
  echo "  legacy/    (~385 MB — staré verze webu, books, img)"
  echo "  portfolio/ (~33 MB)"
  echo "Důvod: do bundlu Kingdomu nepatří; zůstávají na původním umístění."
  echo ""
  echo "Obsah: $(find "$DST" -name '*.html' | wc -l) HTML stránek, $(du -sh "$DST" | cut -f1) celkem."
} > "$DST/MANIFEST.txt"

echo "==> hotovo: $DST ($(find "$DST" -name '*.html' | wc -l) stránek, $(du -sh "$DST" | cut -f1))"
