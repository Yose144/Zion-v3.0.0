#!/usr/bin/env bash
# Vyčistí blog/full/*.html — zarovná na střed, odstraní inline šum, lepší typografie
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../public_html/V2/blog/full" && pwd)"

for f in "$DIR"/*.html; do
  echo "🔧 $(basename "$f")"

  # 1) Nahradit embedded <style> blok vylepšenou verzí
  perl -0777 -i -pe '
    s|(<style>).*?(</style>)|$1
    body { background: #090909; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 38px 22px 80px; }
    .back { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 22px; color: var(--rasta-gold); text-decoration: none; opacity: 0.7; font-size: 0.95rem; }
    .back:hover { opacity: 1; }
    h1 { font-size: 2rem; line-height: 1.3; margin: 0 0 24px; text-align: center; background: linear-gradient(135deg, #fff, var(--rasta-gold)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .article { background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 36px 32px; color: rgba(255,255,255,.88); font-size: 1.08rem; line-height: 1.95; text-align: center; }
    .article img { max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 22px auto; border: 1px solid rgba(255,255,255,0.06); }
    .article iframe { max-width: 100%; display: block; margin: 18px auto; }
    .article p { margin: 14px 0; }
    .article a { color: var(--rasta-gold); text-decoration: underline; text-underline-offset: 3px; }
    .article a:hover { opacity: 0.85; }
    .article h2, .article h3 { color: var(--rasta-gold); margin: 32px 0 12px; line-height: 1.35; }
    .article h2 { font-size: 1.45rem; }
    .article h3 { font-size: 1.2rem; }
    .article ul, .article ol { display: inline-block; text-align: left; margin: 12px 0; padding-left: 24px; }
    .article li { margin: 4px 0; }
    .article blockquote { border-left: 3px solid var(--rasta-gold); margin: 24px auto; padding: 14px 20px; max-width: 680px; background: rgba(255,215,0,0.04); border-radius: 0 14px 14px 0; text-align: left; font-style: italic; }
    .article b, .article strong { color: rgba(255,255,255,.95); }
    .article * { max-width: 100%; box-sizing: border-box; }
    \@media (max-width: 600px) { h1 { font-size: 1.4rem; } .article { padding: 20px 16px; font-size: 1rem; } .wrap { padding: 18px 12px 60px; } }
  $2|s' "$f"

  # 2) Odstranit extrémní inline styly z Blogspotu (zachovat text-align a color)
  # Odstraní font-feature-settings, font-kerning, font-optical-sizing, font-variant-*,
  # font-variation-settings, font-stretch, font-size-adjust, font-language-override,
  # font-width, line-height: normal z inline stylů
  perl -i -pe '
    s/font-feature-settings:\s*[^;]+;\s*//gi;
    s/font-kerning:\s*[^;]+;\s*//gi;
    s/font-optical-sizing:\s*[^;]+;\s*//gi;
    s/font-size-adjust:\s*[^;]+;\s*//gi;
    s/font-language-override:\s*[^;]+;\s*//gi;
    s/font-stretch:\s*[^;]+;\s*//gi;
    s/font-variant-alternates:\s*[^;]+;\s*//gi;
    s/font-variant-east-asian:\s*[^;]+;\s*//gi;
    s/font-variant-emoji:\s*[^;]+;\s*//gi;
    s/font-variant-numeric:\s*[^;]+;\s*//gi;
    s/font-variant-position:\s*[^;]+;\s*//gi;
    s/font-variant-ligatures:\s*[^;]+;\s*//gi;
    s/font-variant-caps:\s*[^;]+;\s*//gi;
    s/font-variant:\s*normal;\s*//gi;
    s/font-variation-settings:\s*[^;]+;\s*//gi;
    s/font-width:\s*[^;]+;\s*//gi;
    s/line-height:\s*normal;\s*//gi;
    s/font-style:\s*normal;\s*//gi;
    s/font-weight:\s*normal;\s*//gi;
    s/caret-color:\s*[^;]+;\s*//gi;
    s/text-decoration-style:\s*[^;]+;\s*//gi;
    s/text-decoration-thickness:\s*[^;]+;\s*//gi;
    s/vertical-align:\s*baseline;\s*//gi;
    s/box-sizing:\s*border-box;\s*//gi;
    s/border:\s*0px;\s*//gi;
  ' "$f"

  # 3) Odstraníme font-family z inline stylů (ponechat z CSS)
  perl -i -pe 's/font-family:\s*[^;]+;\s*//gi' "$f"

  # 4) Vyčistit margin: 0px z inline stylů
  perl -i -pe 's/margin:\s*0px;\s*//gi' "$f"

  # 5) Vyčistit prázdné style="" atributy
  perl -i -pe 's/\s*style="[\s;]*"//gi' "$f"

  # 6) Zbytečné class atributy z Blogspotu  
  perl -i -pe 's/\s*class="[psu][123456789p-]*"//gi' "$f"

done

echo ""
echo "✅ Všech $(ls "$DIR"/*.html | wc -l | tr -d ' ') článků vyčištěno a zarovnáno na střed!"
