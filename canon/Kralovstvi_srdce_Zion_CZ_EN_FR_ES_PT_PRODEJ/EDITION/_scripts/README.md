# `build_edition.py` — sázečka edic

Jeden skript, který z Markdownu udělá prodejní PDF (A5) a EPUB 3. Běží přes `uv`,
takže si závislosti stáhne sám — nic instalovat ručně.

## Požadavky

- `uv` (macOS: `brew install uv`)
- písmo **Georgia** (macOS) nebo **DejaVu Serif** (Linux)
- volitelně `Arial Unicode.ttf` / `DejaVuSans.ttf` pro znaky mimo hlavní písmo
  (hebrejština v citátech, šipky)

## Příkazy

```bash
uv run _scripts/build_edition.py                       # vše, co existuje
uv run _scripts/build_edition.py --check               # jen stavová matice
uv run _scripts/build_edition.py --status              # matice + přepsat 00-STAV.md
uv run _scripts/build_edition.py --only gemini         # jedna edice
uv run _scripts/build_edition.py --lang EN             # jeden jazyk
uv run _scripts/build_edition.py --format pdf          # jen PDF
uv run _scripts/build_edition.py --only gemini --lang EN --format epub
```

Výstup jde vždy **vedle** zdrojového `.md`:

```
gemini/EN/Kingdom_of_the_Heart_gemini_EN.md      ← zdroj (needituje se)
gemini/EN/Kingdom_of_the_Heart_gemini_EN.pdf     ← výstup
gemini/EN/Kingdom_of_the_Heart_gemini_EN.epub    ← výstup
gemini/EN/Kingdom_of_the_Heart_gemini_EN.kontrola.json
```

## Jak se pozná struktura knihy

Skript čte Markdown a nadpisy bere jako strukturu:

| Úroveň | Význam | Chování |
|---|---|---|
| `#` | titul knihy, části | titul jde na obálku, ostatní začínají na nové stránce |
| `##` | kapitoly, prolog, epilog | nová stránka (u edic, kde jsou kapitoly `##`) |
| `###` | pododdíly (Příběh, Kotva pravdy…) | zalamuje se průběžně |

Která úroveň láme stránku a která jde do obsahu, určuje konfigurace edice
v `EDITIONS` uvnitř skriptu (`break_levels`, `toc_levels`). Nová edice = nový
záznam v `EDITIONS` + složky s jazyky.

## Známé hranice

- **Bez hyphenace.** Česká sazba needěluje slova; v úzkém sloupci A5 vznikají
  občas řídké řádky. Dá se doplnit `pyphen`, ale chce to vlastní test.
- **Bez ilustrací.** Ilustrovaná edice má vlastní, dřív vyrobené soubory.
- **Tabulky** nad čtyři sloupce se rozepíší do řádků textu.
- **Prostý text bez nadpisů** (edice `cloude`) se vysází jako souvislý tok
  odstavců — před prodejem potřebuje redakci do Markdownu.
- **Obsah** se rezervuje dopředu; skript při potřebě přidá stránku a sazbu zopakuje,
  takže čísla stran v obsahu vždy sedí na výsledné PDF.
