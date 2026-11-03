# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "fpdf2>=2.8",
#   "markdown-it-py>=3",
# ]
# ///
"""Království srdce — sázečka edic (Markdown → PDF + EPUB).

Použití:
    uv run build_edition.py                  # sestaví vše, co v EDITION/ existuje
    uv run build_edition.py --check          # jen stavová matice (nic nebuildí)
    uv run build_edition.py --only gemini    # jen jedna edice
    uv run build_edition.py --lang CZ        # jen jeden jazyk
    uv run build_edition.py --format pdf     # jen PDF (nebo epub)

Struktura, se kterou skript počítá:

    EDITION/<edice>/<JAZYK>/*.md     →  vedle vznikne *.pdf, *.epub, *.kontrola.json

Volitelný soubor metadat (nepovinný, přebíjí odvození z prvního nadpisu):

    EDITION/<edice>/<JAZYK>/<stejny_nazev>.meta.json
    {
      "title": "Království srdce",
      "subtitle": "Příběh lodi, kterou postavil tesař",
      "edition_label": "Gemini edice · Svorník korpusu",
      "author": "Zion",
      "date": "2026-11-03",
      "lang": "cs",
      "status_note": "pracovní rukopis"
    }

Skript nic nemaže a nepřepisuje zdrojové .md — jen zapisuje .pdf/.epub/.json
a stavový soubor 00-STAV.md v adresáři edice.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

EDITION_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = EDITION_ROOT.parent.parent.parent
PRODEJ_ROOT = EDITION_ROOT.parent

# Vlajková edice nežije v EDITION/, ale přímo v kořeni prodejního adresáře.
ROOT_PRODUCTS = {
    "CZ": "CZ/Kralovstvi_srdce_Ilustrovana",
    "EN": "EN/Kingdom_of_the_Heart_English",
    "ES": "ES/El_Reino_del_Corazon_Espanol",
    "FR": "FR/Le_Royaume_du_Coeur_Francais",
    "PT": "PT/O_Reino_do_Coracao_Portugues",
}

# ── jazyky ────────────────────────────────────────────────────────────────────
# Klíč = název složky, hodnota = metadata pro sazbu a EPUB.
LANGS: dict[str, dict[str, str]] = {
    "CZ": {"bcp47": "cs", "book": "Království srdce", "lang_name": "čeština"},
    "EN": {"bcp47": "en", "book": "Kingdom of the Heart", "lang_name": "English"},
    "ES": {"bcp47": "es", "book": "El Reino del Corazón", "lang_name": "español"},
    "FR": {"bcp47": "fr", "book": "Le Royaume du Cœur", "lang_name": "français"},
    "PT": {"bcp47": "pt", "book": "O Reino do Coração", "lang_name": "português"},
}
LANG_ORDER = ["CZ", "EN", "ES", "FR", "PT"]

# Doporučené názvy souborů, aby všechny edice držely stejný vzor.
FILE_STEM = {
    "CZ": "Kralovstvi_srdce_{slug}_CZ",
    "EN": "Kingdom_of_the_Heart_{slug}_EN",
    "ES": "El_Reino_del_Corazon_{slug}_ES",
    "FR": "Le_Royaume_du_Coeur_{slug}_FR",
    "PT": "O_Reino_do_Coracao_{slug}_PT",
}

# ── edice ─────────────────────────────────────────────────────────────────────
# break_levels: které úrovně nadpisů začínají na nové stránce
# toc_levels:   které úrovně jdou do obsahu
# build:        zda se má sázet (00-nova-plavba má hotové produkty v rootu)
EDITIONS: dict[str, dict] = {
    "00-nova-plavba": {
        "label": "Nová plavba · Ilustrovaná",
        "note": "Vlajková prodejní edice. Produkty jsou v kořeni prodejního adresáře (CZ/ … PT/).",
        "build": False,
        "root_products": True,
        "break_levels": [1, 2],
        "toc_levels": [1, 2],
    },
    "klasicka": {
        "label": "Klasická edice · Původní midraš",
        "note": "Deset zastavení, každé s oddíly Příběh / Z Písma a tradice / Kotva pravdy.",
        "build": True,
        "break_levels": [1],
        "toc_levels": [1],
    },
    "cloude": {
        "label": "Cedrový kýl · Literární rozšíření",
        "note": "Zdroj je zatím prostý text bez nadpisů — před prodejem potřebuje redakci do Markdownu.",
        "build": True,
        "break_levels": [],
        "toc_levels": [],
    },
    "gemini": {
        "label": "Gemini edice · Svorník korpusu",
        "note": "Čtyřiadvacet kapitol ve čtyřech částech, každá s oddílem Z Písma a Kotvou pravdy.",
        "build": True,
        "break_levels": [1, 2],
        "toc_levels": [1, 2],
    },
    "gpt": {
        "label": "GPT edice · Tesař, který zůstává u práce",
        "note": "Pokračování kapitol 10–24; první půle se přebírá z Gemini edice.",
        "build": True,
        "break_levels": [1, 2],
        "toc_levels": [1, 2],
    },
    "groq": {
        "label": "Groq edice · Loď, která se ptá",
        "note": "Edice spáry: co není doložené, zůstává jako otázka.",
        "build": True,
        "break_levels": [1, 2],
        "toc_levels": [1, 2],
    },
    "quen": {
        "label": "Quen edice · Účetnice",
        "note": "Loď, která nemá uzavřený účet; kapitoly jsou nejvyšší úroveň.",
        "build": True,
        "break_levels": [1],
        "toc_levels": [1],
    },
    "deepseek": {
        "label": "DeepSeek edice · Kniha Kýlu",
        "note": "Prolog, dvanáct zastavení, epilog a doslov; vyprávěno dřevem.",
        "build": True,
        "break_levels": [1],
        "toc_levels": [1],
    },
}

# ── fonty ─────────────────────────────────────────────────────────────────────
FONT_DIRS = [
    Path("/System/Library/Fonts/Supplemental"),
    Path("/Library/Fonts"),
    Path("/usr/share/fonts/truetype/dejavu"),
    Path.home() / "Library/Fonts",
]
FONT_SETS = [
    {  # první volba: skutečné knižní písmo
        "": "Georgia.ttf",
        "B": "Georgia Bold.ttf",
        "I": "Georgia Italic.ttf",
        "BI": "Georgia Bold Italic.ttf",
    },
    {  # fallback: DejaVu (Linux / CI)
        "": "DejaVuSerif.ttf",
        "B": "DejaVuSerif-Bold.ttf",
        "I": "DejaVuSerif-Italic.ttf",
        "BI": "DejaVuSerif-BoldItalic.ttf",
    },
]

# Font pro znaky, které hlavní písmo nemá (hebrejština, řečtina, šipky, …).
FALLBACK_FONTS = [
    "DejaVuSans.ttf",
    "Arial Unicode.ttf",
    "NotoSans-Regular.ttf",
]

# ── sazba ─────────────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = 148.0, 210.0          # A5, stejně jako prodávaná ilustrovaná edice
MARGIN_L = MARGIN_R = 17.0
MARGIN_T = 18.0
MARGIN_B = 20.0
BODY_PT = 10.5
LEADING = 6.0
INK = (26, 24, 22)
INK_SOFT = (92, 86, 80)
ACCENT = (122, 92, 40)


# ══════════════════════════════════════════════════════════════════════════════
# Markdown → bloky
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class Block:
    kind: str                 # h1..h6 | p | quote | li | hr | code | table | raw
    text: str = ""
    level: int = 0
    ordered: bool = False
    number: int = 0
    rows: list[list[str]] = field(default_factory=list)


def _strip_inline(text: str) -> str:
    """Převede inline Markdown na holý text (bez značek)."""
    text = text.replace("`", "")
    # [popisek](odkaz) → popisek
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\u00a0", " ")
    return re.sub(r"[ \t]+", " ", text).strip()


def _plain(text: str) -> str:
    """Odstraní inline značky (pro sazbu, která je sama kurzívou/tučná)."""
    return re.sub(r"\*{1,2}|(?<![\w])_{1,2}|_{1,2}(?![\w])", "", text).strip()


def _tidy_stars(segment: str) -> str:
    """Odstraní osiřelé hvězdičky na okrajích slov (přežily neuzavřenou kurzívu).

    Uvnitř slova je nechává — tam jde o skutečný text (např. `COMMUNITIES/*.md`).
    """
    def fix(match: re.Match) -> str:
        token = match.group(0)
        if not (token.startswith("*") or token.endswith("*")):
            return token
        trimmed = token.strip("*")
        return trimmed

    return re.sub(r"\S+", fix, segment)


def fpdf_markup(text: str) -> str:
    """Převede běžný Markdown na značky, kterým rozumí fpdf2.

    fpdf2 zná: **tučně**, __kurzíva__, --podtržení--, ~~přeškrtnutí~~.
    Běžný Markdown používá pro kurzívu *text* nebo _text_ — převádíme.
    Vnořenou kurzívu do tučného písma fpdf2 neumí, proto se uvnitř **…**
    značky jen odstraní (text zůstane, zvýraznění ne).
    """
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("`", "")

    def strip_inner(value: str) -> str:
        return re.sub(r"\*{1,2}|_{1,2}", "", value).strip()

    def italics(segment: str) -> str:
        return re.sub(
            r"(?<![\w*])\*(?P<i>[^*\s](?:[^*]*?[^*\s])?)\*(?![\w*])"
            r"|(?<![\w_])_(?P<i2>[^_\s](?:[^_]*?[^_\s])?)_(?![\w_])",
            lambda m: f"__{m.group('i') or m.group('i2')}__",
            segment, flags=re.S,
        )

    out: list[str] = []
    for idx, part in enumerate(re.split(r"(\*\*.+?\*\*|__.+?__)", text, flags=re.S)):
        if idx % 2 == 1:  # tučný úsek — vnořené značky pryč
            out.append("**" + strip_inner(part[2:-2]) + "**")
        else:
            out.append(italics(_tidy_stars(part)))
    return _finalize_markers("".join(out))


_SENTINELS = [("\x01", "**"), ("\x02", "**"), ("\x03", "__"), ("\x04", "__"),
              ("\x05", "*")]


def _finalize_markers(text: str) -> str:
    """Odstraní hvězdičky, které nezůstaly v páru (neuzavřená kurzíva v rukopisu).

    Platné značky se před úklidem schovají za sentinely, takže zůstanou nedotčené.
    """
    text = re.sub(r"\*\*(.+?)\*\*", lambda m: "\x01" + m.group(1) + "\x02", text, flags=re.S)
    text = re.sub(r"__(.+?)__", lambda m: "\x03" + m.group(1) + "\x04", text, flags=re.S)
    text = re.sub(r"\*(?=\.\w)", "\x05", text)          # *.md apod. zůstává
    text = text.replace("*", "")
    text = re.sub(r"(?<!\w)_+(?!\w)", " ", text)
    for token, marker in _SENTINELS:
        text = text.replace(token, marker)
    return text


def parse_markdown(source: str) -> list[Block]:
    from markdown_it import MarkdownIt

    md = MarkdownIt("commonmark", {"html": True}).enable("table")
    tokens = md.parse(source)
    blocks: list[Block] = []
    list_stack: list[dict] = []
    in_quote = 0

    i = 0
    while i < len(tokens):
        t = tokens[i]
        tt = t.type

        if tt in ("heading_open",):
            level = int(t.tag[1])
            inline = tokens[i + 1]
            blocks.append(Block(kind=f"h{level}", text=_strip_inline(inline.content), level=level))
            i += 3
            continue

        if tt == "paragraph_open":
            inline = tokens[i + 1]
            text = _strip_inline(inline.content)
            if in_quote:
                blocks.append(Block(kind="quote", text=text))
            else:
                blocks.append(Block(kind="p", text=text))
            i += 3
            continue

        if tt == "blockquote_open":
            in_quote += 1
            i += 1
            continue
        if tt == "blockquote_close":
            in_quote = max(0, in_quote - 1)
            i += 1
            continue

        if tt in ("bullet_list_open", "ordered_list_open"):
            list_stack.append({"ordered": tt == "ordered_list_open", "n": 0})
            i += 1
            continue
        if tt in ("bullet_list_close", "ordered_list_close"):
            if list_stack:
                list_stack.pop()
            i += 1
            continue
        if tt == "list_item_open":
            if list_stack:
                list_stack[-1]["n"] += 1
            i += 1
            continue
        if tt == "list_item_close":
            i += 1
            continue
        if tt in ("inline",):
            # inline uvnitř položky seznamu
            if list_stack:
                cur = list_stack[-1]
                blocks.append(
                    Block(
                        kind="li",
                        text=_strip_inline(t.content),
                        ordered=cur["ordered"],
                        number=cur["n"],
                    )
                )
            i += 1
            continue

        if tt in ("fence", "code_block"):
            blocks.append(Block(kind="code", text=t.content.rstrip()))
            i += 1
            continue

        if tt == "hr":
            blocks.append(Block(kind="hr"))
            i += 1
            continue

        if tt == "table_open":
            rows: list[list[str]] = []
            row: list[str] = []
            j = i + 1
            while j < len(tokens) and tokens[j].type != "table_close":
                tk = tokens[j]
                if tk.type == "tr_open":
                    row = []
                elif tk.type == "inline":
                    row.append(_strip_inline(tk.content))
                elif tk.type == "tr_close":
                    rows.append(row)
                j += 1
            blocks.append(Block(kind="table", rows=rows))
            i = j + 1
            continue

        i += 1

    if not blocks:
        # cloude/full.md je prostý text bez jediného nadpisu
        for line in source.splitlines():
            line = _strip_inline(line)
            if line:
                blocks.append(Block(kind="p", text=line))

    return blocks


def outline_of(blocks: list[Block], levels: list[int]) -> list[tuple[int, str]]:
    return [(b.level, b.text) for b in blocks if b.kind.startswith("h") and b.level in levels]


# ══════════════════════════════════════════════════════════════════════════════
# PDF
# ══════════════════════════════════════════════════════════════════════════════

def _find_fonts() -> dict[str, Path]:
    for font_set in FONT_SETS:
        resolved: dict[str, Path] = {}
        for style, filename in font_set.items():
            for d in FONT_DIRS:
                candidate = d / filename
                if candidate.exists():
                    resolved[style] = candidate
                    break
            if style not in resolved:
                break
        if len(resolved) == len(font_set):
            return resolved
    raise SystemExit(
        "Nenalezen žádný použitelný font (Georgia ani DejaVu). "
        "Doinstaluj DejaVu Serif nebo uprav FONT_DIRS."
    )


class BookPDF:
    def __init__(self, meta: dict, fonts: dict[str, Path]):
        from fpdf import FPDF

        self.meta = meta
        self.pdf = FPDF(orientation="P", unit="mm", format=(PAGE_W, PAGE_H))
        self.pdf.set_margins(MARGIN_L, MARGIN_T, MARGIN_R)
        self.pdf.set_auto_page_break(True, MARGIN_B)
        for style, path in fonts.items():
            self.pdf.add_font("Serif", style, str(path))

        # fallback pro znaky mimo hlavní písmo (hebrejština, šipky, …)
        fallback = self._find_fallback()
        if fallback is not None:
            for style in ("", "B", "I", "BI"):
                self.pdf.add_font("Fallback", style, str(fallback))
            self.pdf.set_fallback_fonts(["Fallback"])

        self.pdf.set_font("Serif", size=BODY_PT)
        self.pdf.set_text_color(*INK)
        self.pdf.set_title(meta["title"])
        self.pdf.set_author(meta.get("author", "Zion"))
        self.pdf.set_creator("Zion · build_edition.py")
        self.pdf.set_subject(meta.get("edition_label", ""))
        self.pdf.alias_nb_pages()
        self.pdf.footer = self._footer

    def _footer(self) -> None:
        p = self.pdf
        self._h(7.6)
        p.set_text_color(*INK_SOFT)
        p.set_y(-13)
        p.cell(0, 5, str(p.page_no()), align="C")

    def _find_fallback(self) -> Path | None:
        for filename in FALLBACK_FONTS:
            for d in FONT_DIRS:
                candidate = d / filename
                if candidate.exists():
                    return candidate
        return None

    # — pomocné ————————————————————————————————————————————————————————————
    def _h(self, size: float, style: str = "") -> None:
        self.pdf.set_font("Serif", style, size)

    def _space(self, mm: float) -> None:
        if self.pdf.get_y() > MARGIN_T:
            self.pdf.ln(mm)

    def _rule(self, width: float = 26.0, color=ACCENT) -> None:
        self.pdf.set_draw_color(*color)
        self.pdf.set_line_width(0.3)
        x = (PAGE_W - width) / 2
        y = self.pdf.get_y()
        self.pdf.line(x, y, x + width, y)
        self.pdf.ln(4)

    # — stránky —————————————————————————————————————————————————————————————
    def cover(self) -> None:
        m = self.meta
        p = self.pdf
        p.add_page()
        p.ln(38)
        self._h(9.5)
        p.set_text_color(*INK_SOFT)
        p.cell(0, 8, m.get("author", "Zion").upper(), align="C", new_x="LMARGIN", new_y="NEXT")
        p.ln(6)
        self._h(25)
        p.set_text_color(*INK)
        for line in _wrap_title(m["title"], 18):
            p.cell(0, 12, line, align="C", new_x="LMARGIN", new_y="NEXT")
        p.ln(3)
        if m.get("subtitle"):
            self._h(11.5, "I")
            p.set_text_color(*INK_SOFT)
            for line in _wrap_title(m["subtitle"], 34):
                p.cell(0, 7, line, align="C", new_x="LMARGIN", new_y="NEXT")
        p.ln(14)
        self._rule()
        self._h(9)
        p.set_text_color(*ACCENT)
        for line in _wrap_title(m.get("edition_label", ""), 40):
            p.cell(0, 6, line, align="C", new_x="LMARGIN", new_y="NEXT")
        p.set_y(-32)
        self._h(8.5)
        p.set_text_color(*INK_SOFT)
        p.cell(0, 5, m.get("date_human", ""), align="C", new_x="LMARGIN", new_y="NEXT")

    def colophon(self) -> None:
        m = self.meta
        p = self.pdf
        p.add_page()
        p.ln(20)
        self._h(13)
        p.set_text_color(*INK)
        p.cell(0, 9, "O tomto vydání", align="L", new_x="LMARGIN", new_y="NEXT")
        p.ln(4)
        self._h(9.5)
        p.set_text_color(*INK)
        rows = [
            ("Kniha", m["title"]),
            ("Edice", m.get("edition_label", "")),
            ("Jazyk", m.get("lang_name", "")),
            ("Datum", m.get("date_human", "")),
            ("Stav", m.get("status_note", "pracovní rukopis")),
        ]
        for key, value in rows:
            if not value:
                continue
            p.set_text_color(*INK_SOFT)
            p.cell(26, 6, key, new_x="END")
            p.set_text_color(*INK)
            p.multi_cell(0, 6, str(value), new_x="LMARGIN", new_y="NEXT")
            p.ln(0.6)
        p.ln(6)
        p.set_text_color(*INK_SOFT)
        self._h(8.5, "I")
        for note in m.get("colophon_notes", []):
            p.multi_cell(0, 5, note, align="L", new_x="LMARGIN", new_y="NEXT")
            p.ln(1.4)

    # — tělo ————————————————————————————————————————————————————————————————
    def render(self, blocks: list[Block], break_levels: list[int], toc_levels: list[int],
               skip_index: int = -1) -> None:
        p = self.pdf
        first_heading = True
        for idx, b in enumerate(blocks):
            if idx == skip_index:
                continue
            if b.kind.startswith("h"):
                level = b.level
                is_title = first_heading
                first_heading = False
                if is_title:
                    # hlavní titul už je na obálce
                    continue
                if level in break_levels:
                    p.add_page()
                elif p.get_y() > MARGIN_T + 10:
                    p.ln(4)
                if level in toc_levels:
                    p.start_section(b.text, level=max(0, level - 1))
                self.heading(b.text, level)

            elif b.kind == "p":
                self.paragraph(b.text)
            elif b.kind == "quote":
                self.quote(b.text)
            elif b.kind == "li":
                self.list_item(b.text, b.ordered, b.number)
            elif b.kind == "hr":
                p.ln(2)
                self._rule(18)
            elif b.kind == "code":
                self.code(b.text)
            elif b.kind == "table":
                self.table(b.rows)

    def heading(self, text: str, level: int) -> None:
        p = self.pdf
        size = {1: 16.0, 2: 13.0, 3: 10.8, 4: 10.5, 5: 10.5, 6: 10.5}.get(level, 10.5)
        style = "B" if level <= 3 else "BI"
        self._h(size, style)
        p.set_text_color(*INK)
        p.multi_cell(0, size * 0.42, _plain(text), align="L", new_x="LMARGIN", new_y="NEXT")
        p.ln(1.4 if level > 2 else 3.0)

    def paragraph(self, text: str) -> None:
        p = self.pdf
        if not text:
            return
        self._h(BODY_PT)
        p.set_text_color(*INK)
        p.multi_cell(0, LEADING, fpdf_markup(text), align="J", markdown=True,
                     new_x="LMARGIN", new_y="NEXT")
        p.ln(1.8)

    def quote(self, text: str) -> None:
        p = self.pdf
        x0, y0 = p.get_x(), p.get_y()
        p.set_draw_color(*ACCENT)
        p.set_line_width(0.5)
        self._h(BODY_PT - 0.7, "I")
        p.set_text_color(*INK_SOFT)
        p.set_x(x0 + 5)
        p.multi_cell(p.epw - 5, LEADING - 0.4, _plain(text), align="L",
                     new_x="LMARGIN", new_y="NEXT")
        p.line(x0 + 1.5, y0 + 0.5, x0 + 1.5, p.get_y() - 1.2)
        p.ln(2.4)

    def list_item(self, text: str, ordered: bool, number: int) -> None:
        p = self.pdf
        self._h(BODY_PT)
        p.set_text_color(*INK)
        bullet = f"{number}." if ordered else "·"
        p.set_x(MARGIN_L + 3)
        p.cell(5, LEADING, bullet)
        p.multi_cell(p.epw - 8, LEADING, fpdf_markup(text), align="L", markdown=True,
                     new_x="LMARGIN", new_y="NEXT")
        p.ln(0.7)

    def code(self, text: str) -> None:
        p = self.pdf
        self._h(8.5)
        p.set_text_color(*INK_SOFT)
        for line in text.splitlines():
            p.multi_cell(0, 4.6, line, align="L", new_x="LMARGIN", new_y="NEXT")
        p.ln(1.8)

    def table(self, rows: list[list[str]]) -> None:
        p = self.pdf
        if not rows:
            return
        cols = max(len(r) for r in rows)
        if cols < 2 or cols > 4:
            # víc sloupců se na A5 nevejde — vypíšeme jako řádky textu
            for row in rows:
                self.paragraph(" · ".join(c for c in row if c))
            return
        width = p.epw / cols
        p.ln(1.2)
        for idx, row in enumerate(rows):
            if idx == 0:
                self._h(8.8, "B")
            else:
                self._h(8.8)
            y_start = p.get_y()
            heights = []
            for c in range(cols):
                cell = fpdf_markup(row[c]) if c < len(row) else ""
                heights.append(float(p.multi_cell(width - 2, 4.4, cell, dry_run=True,
                                                  output="HEIGHT", markdown=True)))
            height = max(heights) if heights else 4.4
            if p.get_y() + height > PAGE_H - MARGIN_B:
                p.add_page()
                y_start = p.get_y()
            for c, h in zip(range(cols), heights):
                cell = fpdf_markup(row[c]) if c < len(row) else ""
                x = MARGIN_L + c * width
                p.set_xy(x, y_start)
                p.multi_cell(width - 2, 4.4, cell, align="L", markdown=True)
            p.set_y(y_start + height + 1.6)
            if idx == 0:
                p.set_draw_color(200, 190, 175)
                p.set_line_width(0.2)
                p.line(MARGIN_L, p.get_y() - 1.0, MARGIN_L + p.epw, p.get_y() - 1.0)
        p.ln(2.4)

    # — výstup ——————————————————————————————————————————————————————————————
    def finish(self) -> bytes:
        p = self.pdf
        p.set_display_mode("fullwidth", "continuous")
        return bytes(p.output())


def _wrap_title(text: str, limit: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if len(trial) <= limit or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def build_pdf(blocks: list[Block], meta: dict, cfg: dict, subtitle_index: int = -1) -> tuple[bytes, dict]:
    fonts = _find_fonts()
    toc_entries = [b for b in blocks if b.kind.startswith("h") and b.level in cfg["toc_levels"]][1:]

    def render_toc(pdf, outline) -> None:
        pdf.set_font("Serif", "B", 16)
        pdf.set_text_color(*INK)
        pdf.set_x(MARGIN_L)
        pdf.cell(0, 9, "Obsah", align="L", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)
        for sec in outline:
            indent = 0 if sec.level == 0 else 5
            pdf.set_x(MARGIN_L + indent)
            pdf.set_font("Serif", "" if sec.level else "B", 9.2 if sec.level else 9.8)
            pdf.set_text_color(*INK)
            title = _plain(sec.name)
            max_w = pdf.epw - indent - 10
            display = title
            while len(display) > 12 and pdf.get_string_width(display + " …") > max_w:
                display = display[:-1]
            if display != title:
                display = display.rstrip(" ,.;:—-") + "…"
            pdf.cell(max_w, 6, display, new_x="END")
            link = pdf.add_link(page=sec.page_number)
            pdf.cell(10, 6, str(sec.page_number), align="R", link=link,
                     new_x="LMARGIN", new_y="NEXT")

    def build_once(toc_pages: int) -> tuple[bytes, dict]:
        book = BookPDF(meta, fonts)
        book.cover()
        book.colophon()
        book.pdf.add_page()
        book.pdf.insert_toc_placeholder(render_toc, pages=toc_pages)
        book.render(blocks, cfg["break_levels"], cfg["toc_levels"], subtitle_index)
        return book.finish(), {"pages": book.pdf.pages_count, "sections": len(toc_entries)}

    # fpdf2 hází výjimku, když se obsah nevejde do rezervovaných stran —
    # rezervaci proto zvětšujeme, dokud sazba nesedí.
    from fpdf.errors import FPDFException

    last_error: Exception | None = None
    for toc_pages in range(1, 9):
        try:
            return build_once(toc_pages)
        except FPDFException as exc:
            last_error = exc
            msg = str(exc)
            if "too many page breaks" not in msg and "not enough" not in msg.lower():
                raise
    raise SystemExit(f"Obsah se nepodařilo vysázet: {last_error}")



# ══════════════════════════════════════════════════════════════════════════════
# EPUB
# ══════════════════════════════════════════════════════════════════════════════

CSS = """@charset "utf-8";
html { font-size: 100%; }
body { font-family: Georgia, "Times New Roman", serif; line-height: 1.55;
       margin: 0 5%; color: #1a1816; text-align: justify; hyphens: auto; }
h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; line-height: 1.25;
       text-align: left; color: #1a1816; page-break-after: avoid; }
h1 { font-size: 1.55em; margin: 2.2em 0 0.9em; }
h2 { font-size: 1.25em; margin: 1.9em 0 0.7em; }
h3 { font-size: 1.05em; margin: 1.5em 0 0.5em; font-style: italic; }
p { margin: 0 0 0.55em; text-indent: 0; }
blockquote { margin: 1em 0 1em 1em; padding-left: 0.8em; border-left: 2px solid #b99a5e;
       color: #5c5650; font-style: italic; }
ul, ol { margin: 0.6em 0 0.9em 1.2em; }
li { margin-bottom: 0.35em; }
hr { border: 0; border-top: 1px solid #b99a5e; margin: 2em 25% 2em 25%; }
.titlepage { text-align: center; margin-top: 22%; }
.titlepage .author { letter-spacing: 0.18em; font-size: 0.85em; color: #5c5650;
       text-transform: uppercase; }
.titlepage h1 { font-size: 2em; text-align: center; margin: 1.2em 0 0.4em; }
.titlepage .subtitle { font-style: italic; color: #5c5650; }
.titlepage .edition { color: #7a5c28; margin-top: 2.4em; font-size: 0.95em; }
.titlepage .date { margin-top: 3em; color: #5c5650; font-size: 0.9em; }
.colophon { margin-top: 12%; font-size: 0.95em; }
.colophon dt { font-weight: bold; margin-top: 0.7em; }
.colophon dd { margin: 0 0 0 0; color: #3a3632; }
table { border-collapse: collapse; width: 100%; font-size: 0.9em; margin: 1em 0; }
td, th { border-top: 1px solid #d8cfc0; padding: 0.35em 0.4em; text-align: left;
       vertical-align: top; }
"""


def _xhtml(title: str, lang: str, body: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!DOCTYPE html>\n'
        f'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" '
        f'xml:lang="{lang}" lang="{lang}">\n'
        f"<head><meta charset=\"utf-8\"/><title>{html.escape(title)}</title>"
        '<link rel="stylesheet" type="text/css" href="../style.css"/></head>\n'
        f"<body>\n{body}\n</body>\n</html>\n"
    )


_MD_INLINE = None


def _inline_html(text: str) -> str:
    """Inline Markdown → XHTML. Používá markdown-it, aby vnořování zůstalo platné."""
    global _MD_INLINE
    if _MD_INLINE is None:
        from markdown_it import MarkdownIt

        _MD_INLINE = MarkdownIt("commonmark", {"html": True})
    out = _MD_INLINE.renderInline(text)
    return out.replace("<br />", "<br/>").replace("<br>", "<br/>")


def _blocks_html(blocks: list[Block]) -> str:
    parts: list[str] = []
    in_list = None
    for b in blocks:
        if b.kind in ("li",):
            want = "ol" if b.ordered else "ul"
            if in_list != want:
                if in_list:
                    parts.append(f"</{in_list}>")
                parts.append(f"<{want}>")
                in_list = want
            parts.append(f"<li>{_inline_html(b.text)}</li>")
            continue
        if in_list:
            parts.append(f"</{in_list}>")
            in_list = None
        if b.kind.startswith("h"):
            parts.append(f"<h{b.level}>{_inline_html(b.text)}</h{b.level}>")
        elif b.kind == "p":
            parts.append(f"<p>{_inline_html(b.text)}</p>")
        elif b.kind == "quote":
            parts.append(f"<blockquote><p>{_inline_html(b.text)}</p></blockquote>")
        elif b.kind == "hr":
            parts.append("<hr/>")
        elif b.kind == "code":
            parts.append(f"<pre><code>{html.escape(b.text)}</code></pre>")
        elif b.kind == "table" and b.rows:
            rows = []
            for idx, row in enumerate(b.rows):
                tag = "th" if idx == 0 else "td"
                cells = "".join(f"<{tag}>{_inline_html(c)}</{tag}>" for c in row)
                rows.append(f"<tr>{cells}</tr>")
            parts.append("<table>" + "".join(rows) + "</table>")
    if in_list:
        parts.append(f"</{in_list}>")
    return "\n".join(parts)


def build_epub(blocks: list[Block], meta: dict, cfg: dict, subtitle_index: int = -1) -> tuple[bytes, dict]:
    import io

    if 0 <= subtitle_index < len(blocks):
        blocks = [b for i, b in enumerate(blocks) if i != subtitle_index]
    # titulní nadpis řeší titulní strana — do těla nepatří
    if blocks and blocks[0].kind == "h1":
        blocks = blocks[1:]

    lang = meta["lang"]
    book_id = "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL,
                                           f"zion:kralovstvi-srdce:{meta['edition_slug']}:{lang}"))

    # Rozdělení na dokumenty podle nejvyšší použité úrovně nadpisů
    split_level = min(cfg["toc_levels"]) if cfg["toc_levels"] else 99
    chapters: list[tuple[str, list[Block]]] = []
    current: list[Block] = []
    current_title = meta["title"]
    for b in blocks:
        if b.kind.startswith("h") and b.level == split_level and current:
            chapters.append((current_title, current))
            current = [b]
            current_title = b.text
        elif b.kind.startswith("h") and b.level == split_level:
            current = [b]
            current_title = b.text
        else:
            current.append(b)
    if current:
        chapters.append((current_title, current))

    files: list[tuple[str, str, str]] = []  # (id, title, xhtml)
    title_body = (
        '<div class="titlepage">'
        f'<p class="author">{html.escape(meta.get("author", "Zion"))}</p>'
        f'<h1>{html.escape(meta["title"])}</h1>'
        f'<p class="subtitle">{html.escape(meta.get("subtitle", ""))}</p>'
        f'<p class="edition">{html.escape(meta.get("edition_label", ""))}</p>'
        f'<p class="date">{html.escape(meta.get("date_human", ""))}</p>'
        "</div>"
    )
    files.append(("titlepage.xhtml", meta["title"], _xhtml(meta["title"], lang, title_body)))

    colophon_body = (
        '<div class="colophon"><h2>O tomto vydání</h2><dl>'
        f'<dt>Kniha</dt><dd>{html.escape(meta["title"])}</dd>'
        f'<dt>Edice</dt><dd>{html.escape(meta.get("edition_label", ""))}</dd>'
        f'<dt>Jazyk</dt><dd>{html.escape(meta.get("lang_name", ""))}</dd>'
        f'<dt>Datum</dt><dd>{html.escape(meta.get("date_human", ""))}</dd>'
        f'<dt>Stav</dt><dd>{html.escape(meta.get("status_note", "pracovní rukopis"))}</dd>'
        "</dl>"
        + "".join(f"<p>{html.escape(n)}</p>" for n in meta.get("colophon_notes", []))
        + "</div>"
    )
    files.append(("colophon.xhtml", "O tomto vydání", _xhtml("O tomto vydání", lang, colophon_body)))

    for idx, (title, blks) in enumerate(chapters, start=1):
        body = _blocks_html(blks)
        if not body.strip():
            continue
        files.append((f"chap{idx:03d}.xhtml", title or f"Kapitola {idx}",
                      _xhtml(title or f"Kapitola {idx}", lang, body)))

    manifest = [
        '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '    <item id="css" href="style.css" media-type="text/css"/>',
    ]
    spine = []
    for fid, _t, _x in files:
        item_id = "x" + re.sub(r"[^a-zA-Z0-9]", "", fid)
        manifest.append(
            f'    <item id="{item_id}" href="text/{fid}" media-type="application/xhtml+xml"/>'
        )
        spine.append(f'    <itemref idref="{item_id}"/>')

    opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="{lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">{book_id}</dc:identifier>
    <dc:title>{html.escape(meta['title'])}</dc:title>
    <dc:creator>{html.escape(meta.get('author', 'Zion'))}</dc:creator>
    <dc:language>{lang}</dc:language>
    <dc:publisher>Zion</dc:publisher>
    <dc:date>{meta.get('date', date.today().isoformat())}</dc:date>
    <dc:description>{html.escape(meta.get('edition_label', ''))}</dc:description>
    <meta property="dcterms:modified">{date.today().isoformat()}T00:00:00Z</meta>
  </metadata>
  <manifest>
{chr(10).join(manifest)}
  </manifest>
  <spine>
{chr(10).join(spine)}
  </spine>
</package>
"""

    nav_items = "\n".join(
        f'      <li><a href="text/{fid}">{html.escape(title)}</a></li>'
        for fid, title, _x in files
    )
    nav = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{lang}" lang="{lang}">
<head><meta charset="utf-8"/><title>Obsah</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Obsah</h1>
    <ol>
{nav_items}
    </ol>
  </nav>
</body>
</html>
"""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr(
            "META-INF/container.xml",
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n'
            "  <rootfiles>\n"
            '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n'
            "  </rootfiles>\n</container>\n",
            compress_type=zipfile.ZIP_DEFLATED,
        )
        z.writestr("OEBPS/content.opf", opf, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/nav.xhtml", nav, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr("OEBPS/style.css", CSS, compress_type=zipfile.ZIP_DEFLATED)
        for fid, _title, xhtml_doc in files:
            z.writestr(f"OEBPS/text/{fid}", xhtml_doc, compress_type=zipfile.ZIP_DEFLATED)

    return buf.getvalue(), {"documents": len(files)}


# ══════════════════════════════════════════════════════════════════════════════
# Metadata
# ══════════════════════════════════════════════════════════════════════════════

MONTHS = {
    "cs": ["ledna", "února", "března", "dubna", "května", "června", "července",
           "srpna", "září", "října", "listopadu", "prosince"],
    "en": ["January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"],
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
           "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    "fr": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
           "août", "septembre", "octobre", "novembre", "décembre"],
    "pt": ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
           "agosto", "setembro", "outubro", "novembro", "dezembro"],
}


def human_date(iso: str, bcp47: str) -> str:
    try:
        y, m, d = (int(p) for p in iso.split("-")[:3])
    except ValueError:
        return iso
    months = MONTHS.get(bcp47, MONTHS["en"])
    if bcp47 == "en":
        return f"{d} {months[m - 1]} {y}"
    return f"{d}. {months[m - 1]} {y}"


def resolve_meta(md_path: Path, slug: str, lang: str, blocks: list[Block]) -> tuple[dict, int]:
    lang_info = LANGS[lang]
    title = lang_info["book"]
    subtitle = ""
    subtitle_index = -1

    # první h1 = titul knihy; hned následující nadpis (než začne text) = podtitul
    title_index = -1
    for idx, b in enumerate(blocks):
        if b.kind == "h1":
            title = b.text.strip() or title
            title_index = idx
            break
        if b.kind in ("p", "quote"):
            break
    if title_index >= 0:
        for idx in range(title_index + 1, min(title_index + 4, len(blocks))):
            b = blocks[idx]
            if b.kind.startswith("h"):
                subtitle = b.text.strip()
                subtitle_index = idx
                break
            if b.kind in ("p", "quote"):
                break

    cfg = EDITIONS.get(slug, {})
    meta = {
        "title": title,
        "subtitle": subtitle,
        "author": "Zion",
        "date": date.today().isoformat(),
        "date_human": human_date(date.today().isoformat(), lang_info["bcp47"]),
        "lang": lang_info["bcp47"],
        "lang_name": lang_info["lang_name"],
        "edition_slug": slug,
        "edition_label": cfg.get("label", slug),
        "status_note": "pracovní rukopis",
        "colophon_notes": [
            "Toto vydání je literární legenda. Evangelia o stavbě lodi tesařovýma rukama nevyprávějí; "
            "autorské obrazy a podobenství nejsou nově nalezenými výroky."
            if lang == "CZ" else
            "This edition is a literary legend. The Gospels do not tell of a boat built by the "
            "carpenter's own hands; the authorial images and parables are not newly found sayings.",
        ],
    }

    side = md_path.with_suffix(".meta.json")
    if side.exists():
        override = json.loads(side.read_text(encoding="utf-8"))
        meta.update(override)
        if "date" in override and "date_human" not in override:
            meta["date_human"] = human_date(meta["date"], lang_info["bcp47"])

    return meta, subtitle_index


# ══════════════════════════════════════════════════════════════════════════════
# Stav / matice
# ══════════════════════════════════════════════════════════════════════════════

def words_of(text: str) -> int:
    return len(text.split())


def scan() -> list[dict]:
    rows: list[dict] = []
    for slug, cfg in EDITIONS.items():
        edir = EDITION_ROOT / slug
        if cfg.get("root_products"):
            for lang, stem in ROOT_PRODUCTS.items():
                md = PRODEJ_ROOT / f"{stem}.md"
                rows.append({
                    "slug": slug,
                    "label": cfg.get("label", slug),
                    "build": False,
                    "lang": lang,
                    "md": md,
                    "words": words_of(md.read_text(encoding="utf-8")) if md.exists() else 0,
                    "pdf": PRODEJ_ROOT / f"{stem}.pdf",
                    "epub": PRODEJ_ROOT / f"{stem}.epub",
                    "root": True,
                })
            continue
        if not edir.exists():
            continue
        for lang in LANG_ORDER:
            ldir = edir / lang
            mds = sorted(p for p in ldir.glob("*.md")) if ldir.exists() else []
            mds = [p for p in mds if not p.name.startswith("00-") and not p.name.startswith("_")]
            for md in mds:
                text = md.read_text(encoding="utf-8")
                words = words_of(text)
                stems = md.with_suffix("")
                rows.append({
                    "slug": slug,
                    "label": cfg.get("label", slug),
                    "build": cfg.get("build", True),
                    "lang": lang,
                    "md": md,
                    "words": words,
                    "pdf": stems.with_suffix(".pdf"),
                    "epub": stems.with_suffix(".epub"),
                })
    return rows


def status_matrix(rows: list[dict]) -> str:
    lines = [
        "| Edice | " + " | ".join(LANG_ORDER) + " |",
        "|---|" + "---|" * len(LANG_ORDER),
    ]
    for slug, cfg in EDITIONS.items():
        cells = []
        for lang in LANG_ORDER:
            hit = [r for r in rows if r["slug"] == slug and r["lang"] == lang]
            if not hit:
                wip = sorted((EDITION_ROOT / slug / lang).glob("_*.md"))
                if wip:
                    wip_words = sum(words_of(p.read_text(encoding="utf-8")) for p in wip)
                    cells.append(f"⏳ {wip_words:,} slov".replace(",", " "))
                else:
                    cells.append("—")
            else:
                r = hit[0]
                marks = []
                if r["md"].exists():
                    marks.append(f"{r['words']:,} slov".replace(",", " "))
                if r["pdf"].exists():
                    marks.append("PDF")
                if r["epub"].exists():
                    marks.append("EPUB")
                cells.append(" · ".join(marks) if marks else "—")
        lines.append(f"| {cfg.get('label', slug)} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def write_status(rows: list[dict]) -> None:
    matrix = status_matrix(rows)
    header = (
        "# Království srdce — edice a jazyky\n\n"
        "> Stavová matice generovaná skriptem `_scripts/build_edition.py --check`.\n"
        "> Needituj ručně — přepíše se při dalším běhu.\n\n"
        f"{matrix}\n\n"
        "**Legenda:** číslo = počet slov českého/ přeloženého rukopisu, `PDF`/`EPUB` = hotový produkt.\n"
        "`—` = jazyk zatím neexistuje.\n"
    )
    (EDITION_ROOT / "00-STAV.md").write_text(header, encoding="utf-8")

    for slug, cfg in EDITIONS.items():
        edir = EDITION_ROOT / slug
        if not edir.exists():
            continue
        lines = [
            f"# {cfg.get('label', slug)}",
            "",
            cfg.get("note", ""),
            "",
            "## Jazyky",
            "",
            "| Jazyk | Rukopis | PDF | EPUB | Slov |",
            "|---|---|---|---|---|",
        ]
        for lang in LANG_ORDER:
            hit = [r for r in rows if r["slug"] == slug and r["lang"] == lang]
            if not hit:
                lines.append(f"| {lang} | — | — | — | — |")
                continue
            r = hit[0]
            lines.append(
                f"| {lang} | {_tick(r['md'].exists())} | {_tick(r['pdf'].exists())} | "
                f"{_tick(r['epub'].exists())} | {r['words']} |"
            )
        lines += [
            "",
            "## Zdroj",
            "",
            f"`canon/books/KralovstviSrdce/{_source_path(slug)}`",
            "",
            "## Sazba",
            "",
        ]
        if cfg.get("root_products"):
            lines += [
                "Produkty této edice leží v kořeni prodejního adresáře:",
                "",
                "```",
                "CZ/Kralovstvi_srdce_Ilustrovana.pdf",
                "EN/Kingdom_of_the_Heart_English.pdf",
                "ES/El_Reino_del_Corazon_Espanol.pdf",
                "FR/Le_Royaume_du_Coeur_Francais.pdf",
                "PT/O_Reino_do_Coracao_Portugues.pdf",
                "```",
                "",
                "Sázečka je znovu nevyrábí — vznikly samostatným ilustrovaným buildem.",
                "",
            ]
        else:
            lines += [
                "```bash",
                f"uv run _scripts/build_edition.py --only {slug}",
                "```",
                "",
            ]
        (edir / "00-STAV.md").write_text("\n".join(lines), encoding="utf-8")


def _tick(value: bool) -> str:
    return "✅" if value else "—"


def _source_path(slug: str) -> str:
    return {
        "00-nova-plavba": "Kralovstvi_srdce_Nova_plavba_Balicek/",
        "klasicka": "full.md",
        "cloude": "cloude/full.md",
        "gemini": "gemini/full.md",
        "gpt": "gpt/full.md",
        "groq": "groq/full.md",
        "quen": "quen/full.md",
        "deepseek": "DeepSeek/full.md",
    }.get(slug, slug)


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Sázečka edic Království srdce")
    ap.add_argument("--only", help="jen tato edice (slug)")
    ap.add_argument("--lang", choices=LANG_ORDER, help="jen tento jazyk")
    ap.add_argument("--format", default="pdf,epub", help="pdf,epub (výchozí oboje)")
    ap.add_argument("--check", action="store_true", help="jen stav, nic nesázet")
    ap.add_argument("--status", action="store_true", help="přepsat 00-STAV.md")
    args = ap.parse_args(argv)

    formats = {f.strip().lower() for f in args.format.split(",") if f.strip()}
    rows = scan()

    if args.only:
        rows = [r for r in rows if r["slug"] == args.only]
    if args.lang:
        rows = [r for r in rows if r["lang"] == args.lang]

    if args.check or args.status:
        print(status_matrix(scan()))
        if args.status:
            write_status(scan())
            print("\n→ 00-STAV.md přepsán")
        return 0

    if not rows:
        print("Nic k sázení — v EDITION/ nejsou žádné rukopisy.", file=sys.stderr)
        return 1

    built = 0
    for r in rows:
        cfg = EDITIONS.get(r["slug"], {})
        if not cfg.get("build", True):
            continue
        source = r["md"].read_text(encoding="utf-8")
        blocks = parse_markdown(source)
        meta, subtitle_index = resolve_meta(r["md"], r["slug"], r["lang"], blocks)
        kontrol: dict = {
            "edition": r["slug"],
            "lang": r["lang"],
            "source": r["md"].name,
            "words": r["words"],
            "headings": sum(1 for b in blocks if b.kind.startswith("h")),
            "paragraphs": sum(1 for b in blocks if b.kind == "p"),
            "generated": date.today().isoformat(),
        }
        if "pdf" in formats:
            data, info = build_pdf(blocks, meta, cfg, subtitle_index)
            r["pdf"].write_bytes(data)
            kontrol["pdf"] = {"pages": info["pages"], "bytes": len(data)}
            print(f"PDF   {r['pdf'].relative_to(EDITION_ROOT)}  ({info['pages']} s.)")
        if "epub" in formats:
            data, info = build_epub(blocks, meta, cfg, subtitle_index)
            r["epub"].write_bytes(data)
            kontrol["epub"] = {"documents": info["documents"], "bytes": len(data)}
            print(f"EPUB  {r['epub'].relative_to(EDITION_ROOT)}  ({info['documents']} dok.)")
        r["md"].with_suffix(".kontrola.json").write_text(
            json.dumps(kontrol, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        built += 1

    write_status(scan())
    print(f"\nHotovo: {built} rukopisů → PDF/EPUB. Stav v 00-STAV.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
