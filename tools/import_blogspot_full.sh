#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="public_html/V2/blog/full"
mkdir -p "$OUT_DIR"

# slug|url (zdroj: Blogspot archiv 2023–2026)
MAP_FILE="/tmp/newearth_blogspot_map.txt"
mkdir -p "$(dirname "$MAP_FILE")"

cat > "$MAP_FILE" <<'EOF'
rebirth-native-dashboard|https://projektnewearth.blogspot.com/2026/02/rebirth-native-zionterranovacom-live.html
native-awakening-quantum-revolution|https://projektnewearth.blogspot.com/2026/02/295-native-awakening.html
legal-rules-conscious-use|https://projektnewearth.blogspot.com/2026/01/legal-rules-conscious-use.html
manifesto-native-awakening|https://projektnewearth.blogspot.com/2026/01/manifesto.html
finalni-report-quantum-leap|https://projektnewearth.blogspot.com/2026/01/novorocni-zrozeni-zion-testnet-2.html

testnet-launch-pf2026|https://projektnewearth.blogspot.com/2025/12/29-testnet-launch-live-pf-2026.html
zion-29-quantum-leap|https://projektnewearth.blogspot.com/2025/11/zion-29-quantum-leap.html
testnet-285-estrella|https://projektnewearth.blogspot.com/2025/10/testnet-282-nebula.html
baltic-express-bikepacking|https://projektnewearth.blogspot.com/2025/07/jesus-on-bike-vol-2-baltic-expres-bike.html
dalajlama-90|https://projektnewearth.blogspot.com/2025/07/tandzin-gjamccho-90-dalajlama.html
skola-vzestupu-human-design|https://projektnewearth.blogspot.com/2025/04/skola-vzestupu-human-design.html
tajemstvi-amenti|https://projektnewearth.blogspot.com/2025/01/tajemstvi-amenti-secrect-of-amenti.html

pribeh-ruze|https://projektnewearth.blogspot.com/2024/12/pribeh-ruze-story-of-rose.html
vanoce-maly-tibet|https://projektnewearth.blogspot.com/2024/12/vanoce-maly-tibet-2024-christmas-and.html
konstanta-vecnosti|https://projektnewearth.blogspot.com/2024/11/konstanta-vecnosti.html
oraculum|https://projektnewearth.blogspot.com/2024/10/oraculum-18201393118.html
lion-gate-wingmakers|https://projektnewearth.blogspot.com/2024/08/88-lion-gate-wingmakers-lyrisuc-and.html
paris-2024-olympic|https://projektnewearth.blogspot.com/2024/08/paris-2024-olympic.html
yeshuae-on-bike|https://projektnewearth.blogspot.com/2024/05/jesus-on-bike-o.html
new-web-newearth|https://projektnewearth.blogspot.com/2024/04/new-web-page-wwwnewearthcz.html

genesis|https://projektnewearth.blogspot.com/2023/04/genesis.html
finding-new-earth|https://projektnewearth.blogspot.com/2023/04/hledani-tvoreni-nove-zeme.html
transparent-account|https://projektnewearth.blogspot.com/2023/04/transparentni-ucet.html
quotes-poems|https://projektnewearth.blogspot.com/2023/03/citaty-basne.html
photos-videos|https://projektnewearth.blogspot.com/2023/03/fotky-videa.html
projekt-new-earth|https://projektnewearth.blogspot.com/2023/03/projekt-new-earth.html
EOF

# Extract title + body from Blogspot HTML.
extract_title() {
  perl -0777 -ne 'if(/<h3 class=\x27post-title entry-title\x27[^>]*>\s*(?:<a[^>]*>)?\s*(.*?)\s*(?:<\/a>)?\s*<\/h3>/s){my $t=$1;$t=~s/<[^>]+>//g;$t=~s/\s+/ /g;$t=~s/^\s+|\s+$//g;print $t}'
}

extract_body() {
  # Prefer: post-body ... up to post-footer
  perl -0777 -ne 'if(/<div class=\x27post-body entry-content\x27[^>]*>(.*?)<div class=\x27post-footer\x27>/s){print $1}'
}

clean_body() {
  # Keep content as-is, only remove very noisy inline font-family blocks if present
  # (still ~9/10 preserved; this mainly improves readability)
  perl -0777 -pe 's/\s+style=\x22font-family:[^\x22]*\x22//gi'
}

count=0
while IFS='|' read -r slug url; do
  [[ -z "${slug// }" ]] && continue
  echo "[fetch] $slug"
  html=$(curl -L -s "$url")

  title=$(printf "%s" "$html" | extract_title)
  body=$(printf "%s" "$html" | extract_body)

  if [[ -z "$body" ]]; then
    echo "[WARN] body not found for $slug ($url)" >&2
    continue
  fi

  # Clean minimal noise
  body=$(printf "%s" "$body" | clean_body)

  out="$OUT_DIR/$slug.html"
  cat > "$out" <<EOF2
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="../../style.css" />
  <link rel="stylesheet" href="../../rasta.css" />
  <script src="https://kit.fontawesome.com/16464afad1.js" crossorigin="anonymous"></script>
  <title>${title} | ZION TerraNova</title>
  <style>
    body { background: #090909; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 28px 18px 70px; }
    .back { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 18px; color: var(--rasta-gold); text-decoration: none; opacity: 0.7; }
    .back:hover { opacity: 1; }
    h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 18px; background: linear-gradient(135deg, #fff, var(--rasta-gold)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .article { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 24px; color: rgba(255,255,255,.86); line-height: 1.85; }
    .article img { max-width: 100%; height: auto; border-radius: 10px; display: block; margin: 16px auto; border: 1px solid rgba(255,255,255,0.08); }
    .article iframe { max-width: 100%; }
    .article p { margin: 12px 0; text-align: left !important; }
    .article li { text-align: left !important; }
    .article a { color: var(--rasta-gold); }
    .article h2, .article h3 { color: var(--rasta-gold); margin: 26px 0 10px; }
    .article ul, .article ol { margin-left: 22px; }
    .article blockquote { border-left: 3px solid var(--rasta-gold); margin: 20px 0; padding: 12px 18px; background: rgba(255,215,0,0.04); border-radius: 0 12px 12px 0; }
    .article * { max-width: 100%; }
    @media (max-width: 600px) { h1 { font-size: 1.45rem; } .article { padding: 16px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="back" href="../../blog.html"><i class="fa-solid fa-arrow-left"></i> Zpět na archiv</a>
    <h1>${title}</h1>
    <div class="article">${body}</div>
  </div>
</body>
</html>
EOF2

  count=$((count+1))
  echo "[ok] $out"
done < "$MAP_FILE"

echo "Generated: $count posts into $OUT_DIR"