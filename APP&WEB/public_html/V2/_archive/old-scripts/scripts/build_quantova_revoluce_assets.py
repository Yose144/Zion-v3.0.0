#!/usr/bin/env python3
"""Build digital assets for the book "Quantová Revoluce".

Why:
- public_html/V2/books/quantova-revoluce.pdf and bonus-materials.zip are currently placeholders.

What this script does:
- Generates a real PDF from BOOK-COMPLETE.md (ReportLab)
- Creates a ZIP with bonus materials (the Quantum-Revolution source folder)

Usage:
  python3 public_html/V2/scripts/build_quantova_revoluce_assets.py

It writes into:
  public_html/V2/books/quantova-revoluce.pdf
  public_html/V2/books/bonus-materials.zip
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
import unicodedata
import zipfile


@dataclass(frozen=True)
class Paths:
    v2_root: Path
    repo_root: Path

    @property
    def root_books_dir(self) -> Path:
        return self.repo_root / "books"

    @property
    def book_src_dir(self) -> Path:
        # Source of truth lives in repo root /books
        return self.root_books_dir / "Quantum-Revolution"

    @property
    def book_complete_md(self) -> Path:
        return self.book_src_dir / "BOOK-COMPLETE.md"

    @property
    def book_full_md_cs(self) -> Path:
        # This is the real, long-form Czech edition.
        return self.book_src_dir / "CZ" / "Full.md"

    @property
    def out_pdf(self) -> Path:
        return self.v2_root / "books" / "quantova-revoluce.pdf"

    @property
    def wp2_9_dir(self) -> Path:
        return self.repo_root / "docs" / "WP2.9"

    @property
    def wp_lite_cz_md(self) -> Path:
        return self.wp2_9_dir / "WHITEPAPER_LITE_CZ.md"

    @property
    def deep_scan_report_295_md(self) -> Path:
        return self.repo_root / "2.9.5" / "DEEP_SCAN_REPORT_v2.9.5_2026-01-29.md"

    @property
    def real_status_295_md(self) -> Path:
        return self.repo_root / "2.9.5" / "REAL_STATUS_v2.9.5.md"

    @property
    def native_readme_295_md(self) -> Path:
        return self.repo_root / "2.9.5" / "README.md"

    @property
    def out_whitepaper_pdf(self) -> Path:
        return self.v2_root / "books" / "zion-whitepaper-v2.9.5-native-awakening.pdf"

    @property
    def out_zip(self) -> Path:
        return self.v2_root / "books" / "bonus-materials.zip"


def _load_markdown(paths: Paths) -> str:
    # Prefer the full Czech edition.
    if paths.book_full_md_cs.exists():
        return paths.book_full_md_cs.read_text(encoding="utf-8")

    # Fallback to BOOK-COMPLETE.md (often meta / index).
    if paths.book_complete_md.exists():
        return paths.book_complete_md.read_text(encoding="utf-8")

    # Fallback: concatenate all .md in folder in lexicographic order
    md_files = sorted(p for p in paths.book_src_dir.glob("*.md") if p.name.upper() != "README.MD")
    chunks = []
    for p in md_files:
        chunks.append(f"# {p.stem}\n\n")
        chunks.append(p.read_text(encoding="utf-8"))
        chunks.append("\n\n")
    return "".join(chunks)


def build_pdf(
    paths: Paths,
    *,
    font_regular_override: str | None = None,
    font_bold_override: str | None = None,
) -> None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except Exception as exc:  # pragma: no cover
        raise SystemExit("ReportLab není dostupný. Nainstaluj: pip install reportlab") from exc

    text = _load_markdown(paths)

    # Very small markdown-to-text normalization (keep it simple & robust)
    text = text.replace("\r\n", "\n")
    text = re.sub(r"```[\s\S]*?```", "\n", text)  # drop code blocks
    text = re.sub(r"^>\s?", "", text, flags=re.MULTILINE)

    def normalize_for_pdf(value: str) -> str:
        # Stable Unicode normalization.
        value = unicodedata.normalize("NFC", value)

        # Common replacements to keep meaning.
        replacements = {
            "→": "->",
            "➡": "->",
            "✅": "[OK]",
            "❌": "[X]",
            "⚠": "[!]",
            "✨": "*",
            "🕉": "OM",
        }

        out: list[str] = []
        for ch in value:
            if ch in replacements:
                out.append(replacements[ch])
                continue

            if ch == "\r":
                continue
            if ch == "\n":
                out.append("\n")
                continue
            if ch == "\t":
                out.append("  ")
                continue

            # Strip variation selectors & zero-width joiners (emoji sequences).
            if ch in {"\u200d", "\ufe0f"}:
                continue

            cat = unicodedata.category(ch)
            if cat in {"Cc", "Cf", "Cs"}:
                continue

            out.append(ch)

        normalized = "".join(out)
        normalized = unicodedata.normalize("NFC", normalized)
        normalized = re.sub(r"[ \t]{3,}", "  ", normalized)
        return normalized

    text = normalize_for_pdf(text)

    # Font selection
    # Default: use DejaVu (bundled) for full CZ diacritics support.
    # You can override fonts via CLI args to use a nicer reading typeface.
    font_regular = Path(font_regular_override).expanduser() if font_regular_override else None
    font_bold = Path(font_bold_override).expanduser() if font_bold_override else None

    if font_regular is None:
        font_regular = paths.v2_root / "assets" / "fonts" / "DejaVuSans.ttf"
    if font_bold is None:
        font_bold = paths.v2_root / "assets" / "fonts" / "DejaVuSans-Bold.ttf"
    base_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    tt_regular: TTFont | None = None
    tt_bold: TTFont | None = None

    if font_regular.exists():
        tt_regular = TTFont("ZionBook", str(font_regular))
        pdfmetrics.registerFont(tt_regular)
        base_font = "ZionBook"
    if font_bold.exists():
        tt_bold = TTFont("ZionBook-Bold", str(font_bold))
        pdfmetrics.registerFont(tt_bold)
        bold_font = "ZionBook-Bold"

    # Final safety net: remove characters not supported by the chosen font
    # to avoid tofu squares in PDF viewers.
    if tt_regular is not None:
        supported = tt_regular.face.charToGlyph

        def filter_to_font(value: str) -> str:
            filtered: list[str] = []
            for ch in value:
                if ch == "\n":
                    filtered.append("\n")
                    continue
                if ord(ch) in supported:
                    filtered.append(ch)
                    continue
                if ch == "•":
                    filtered.append("-")
                    continue
            return "".join(filtered)

        text = filter_to_font(text)

    def xml_escape(value: str) -> str:
        return (
            value.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

    paths.out_pdf.parent.mkdir(parents=True, exist_ok=True)

    left = 2.0 * cm
    right = 2.0 * cm
    top = 2.0 * cm
    bottom = 2.0 * cm

    # Platypus handles wrapping by real width (fixes "useknuté řádky").
    doc = SimpleDocTemplate(
        str(paths.out_pdf),
        pagesize=A4,
        leftMargin=left,
        rightMargin=right,
        topMargin=top,
        bottomMargin=bottom,
        title="Quantová Revoluce",
        author="ZION TerraNova",
    )

    style_title = ParagraphStyle(
        name="Title",
        fontName=bold_font,
        fontSize=20,
        leading=24,
        alignment=TA_CENTER,
        spaceAfter=18,
    )
    style_h1 = ParagraphStyle(
        name="H1",
        fontName=bold_font,
        fontSize=16,
        leading=20,
        spaceBefore=14,
        spaceAfter=10,
    )
    style_h2 = ParagraphStyle(
        name="H2",
        fontName=bold_font,
        fontSize=14,
        leading=18,
        spaceBefore=12,
        spaceAfter=8,
    )
    style_h3 = ParagraphStyle(
        name="H3",
        fontName=bold_font,
        fontSize=12,
        leading=16,
        spaceBefore=10,
        spaceAfter=6,
    )
    style_body = ParagraphStyle(
        name="Body",
        fontName=base_font,
        fontSize=11,
        leading=15,
        alignment=TA_JUSTIFY,
        spaceAfter=8,
        firstLineIndent=12,
    )
    style_list = ParagraphStyle(
        name="List",
        parent=style_body,
        firstLineIndent=0,
        leftIndent=14,
        bulletIndent=0,
    )

    story: list[object] = []
    story.append(Paragraph(xml_escape("Quantová Revoluce"), style_title))

    # Convert simplified markdown-ish text into paragraphs.
    buf: list[str] = []

    def flush_paragraph() -> None:
        nonlocal buf
        if not buf:
            return
        paragraph_text = " ".join(s.strip() for s in buf if s.strip())
        paragraph_text = re.sub(r"\s{2,}", " ", paragraph_text).strip()
        if paragraph_text:
            story.append(Paragraph(xml_escape(paragraph_text), style_body))
        buf = []

    for raw_line in text.split("\n"):
        line = raw_line.rstrip()

        if not line.strip():
            flush_paragraph()
            continue

        if line.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(xml_escape(line[4:].strip()), style_h3))
            continue
        if line.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(xml_escape(line[3:].strip()), style_h2))
            continue
        if line.startswith("# "):
            flush_paragraph()
            story.append(Paragraph(xml_escape(line[2:].strip()), style_h1))
            continue

        # Lists
        m_list = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", line)
        if m_list:
            flush_paragraph()
            item_text = m_list.group(2).strip()
            story.append(Paragraph(xml_escape(item_text), style_list, bulletText="•"))
            continue

        # Normal text line: accumulate into paragraph.
        buf.append(line)

    flush_paragraph()

    # Build the PDF
    doc.build(story)


def _load_whitepaper_markdown(paths: Paths) -> str:
    parts: list[str] = []

    if paths.wp_lite_cz_md.exists():
        parts.append(paths.wp_lite_cz_md.read_text(encoding="utf-8"))
    else:
        # Fallback: concatenate WP2.9 chapters in numeric order.
        if paths.wp2_9_dir.exists():
            chapter_files = sorted(
                [p for p in paths.wp2_9_dir.glob("*.md") if re.match(r"^\\d+_", p.name)],
                key=lambda p: p.name,
            )
            for p in chapter_files:
                parts.append(f"# {p.stem}\n\n")
                parts.append(p.read_text(encoding="utf-8"))
                parts.append("\n\n")

    # Append v2.9.5 Native Awakening update.
    parts.append("\n\n# Dodatek: v2.9.5 \"Native Awakening\" — Reality Check (leden 2026)\n\n")
    parts.append(
        "Tento dodatek shrnuje ověřený stav nativního Rust stacku (core/pool/miner/NCL) a otevřené body.\n"
    )

    if paths.native_readme_295_md.exists():
        parts.append("\n## Přehled komponent (2.9.5)\n\n")
        # Keep it compact: first ~120 lines.
        native_readme_lines = paths.native_readme_295_md.read_text(encoding="utf-8").splitlines()
        parts.append("\n".join(native_readme_lines[:120]))
        parts.append("\n\n")

    if paths.real_status_295_md.exists():
        parts.append("\n## Real Code Status (výběr)\n\n")
        real_status_lines = paths.real_status_295_md.read_text(encoding="utf-8").splitlines()
        parts.append("\n".join(real_status_lines[:180]))
        parts.append("\n\n")

    if paths.deep_scan_report_295_md.exists():
        parts.append("\n## Deep Scan Report 2026-01-29 (výběr)\n\n")
        deep_scan_lines = paths.deep_scan_report_295_md.read_text(encoding="utf-8").splitlines()
        parts.append("\n".join(deep_scan_lines[:220]))
        parts.append("\n\n")

    return "".join(parts)


def build_whitepaper_pdf(
    paths: Paths,
    *,
    font_regular_override: str | None = None,
    font_bold_override: str | None = None,
) -> None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
        from reportlab.platypus import Paragraph, SimpleDocTemplate
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except Exception as exc:  # pragma: no cover
        raise SystemExit("ReportLab není dostupný. Nainstaluj: pip install reportlab") from exc

    text = _load_whitepaper_markdown(paths)

    text = text.replace("\r\n", "\n")
    text = re.sub(r"```[\s\S]*?```", "\n", text)
    text = re.sub(r"^>\s?", "", text, flags=re.MULTILINE)

    def normalize_for_pdf(value: str) -> str:
        value = unicodedata.normalize("NFC", value)
        replacements = {
            "→": "->",
            "➡": "->",
            "✅": "[OK]",
            "❌": "[X]",
            "⚠": "[!]",
            "✨": "*",
            "🕉": "OM",
        }
        out: list[str] = []
        for ch in value:
            if ch in replacements:
                out.append(replacements[ch])
                continue
            if ch == "\r":
                continue
            if ch == "\n":
                out.append("\n")
                continue
            if ch == "\t":
                out.append("  ")
                continue
            if ch in {"\u200d", "\ufe0f"}:
                continue
            cat = unicodedata.category(ch)
            if cat in {"Cc", "Cf", "Cs"}:
                continue
            out.append(ch)
        normalized = "".join(out)
        normalized = unicodedata.normalize("NFC", normalized)
        normalized = re.sub(r"[ \t]{3,}", "  ", normalized)
        return normalized

    text = normalize_for_pdf(text)

    font_regular = Path(font_regular_override).expanduser() if font_regular_override else None
    font_bold = Path(font_bold_override).expanduser() if font_bold_override else None
    if font_regular is None:
        font_regular = paths.v2_root / "assets" / "fonts" / "DejaVuSans.ttf"
    if font_bold is None:
        font_bold = paths.v2_root / "assets" / "fonts" / "DejaVuSans-Bold.ttf"

    base_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    tt_regular: TTFont | None = None
    if font_regular.exists():
        tt_regular = TTFont("ZionWP", str(font_regular))
        pdfmetrics.registerFont(tt_regular)
        base_font = "ZionWP"
    if font_bold.exists():
        tt_bold = TTFont("ZionWP-Bold", str(font_bold))
        pdfmetrics.registerFont(tt_bold)
        bold_font = "ZionWP-Bold"

    if tt_regular is not None:
        supported = tt_regular.face.charToGlyph

        def filter_to_font(value: str) -> str:
            filtered: list[str] = []
            for ch in value:
                if ch == "\n":
                    filtered.append("\n")
                    continue
                if ord(ch) in supported:
                    filtered.append(ch)
                    continue
                if ch == "•":
                    filtered.append("-")
                    continue
            return "".join(filtered)

        text = filter_to_font(text)

    def xml_escape(value: str) -> str:
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    paths.out_whitepaper_pdf.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(paths.out_whitepaper_pdf),
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm,
        title="ZION Whitepaper v2.9.5",
        author="ZION TerraNova",
    )

    style_title = ParagraphStyle(
        name="Title",
        fontName=bold_font,
        fontSize=18,
        leading=22,
        alignment=TA_CENTER,
        spaceAfter=16,
    )
    style_h1 = ParagraphStyle(
        name="H1",
        fontName=bold_font,
        fontSize=15,
        leading=19,
        spaceBefore=12,
        spaceAfter=8,
    )
    style_h2 = ParagraphStyle(
        name="H2",
        fontName=bold_font,
        fontSize=13,
        leading=17,
        spaceBefore=10,
        spaceAfter=6,
    )
    style_h3 = ParagraphStyle(
        name="H3",
        fontName=bold_font,
        fontSize=12,
        leading=16,
        spaceBefore=8,
        spaceAfter=5,
    )
    style_body = ParagraphStyle(
        name="Body",
        fontName=base_font,
        fontSize=11,
        leading=15,
        alignment=TA_JUSTIFY,
        spaceAfter=8,
        firstLineIndent=12,
    )
    style_list = ParagraphStyle(
        name="List",
        parent=style_body,
        firstLineIndent=0,
        leftIndent=14,
        bulletIndent=0,
    )

    story: list[object] = []
    story.append(Paragraph(xml_escape("ZION TerraNova — Whitepaper v2.9.5 (Native Awakening)"), style_title))

    buf: list[str] = []

    def flush_paragraph() -> None:
        nonlocal buf
        if not buf:
            return
        paragraph_text = " ".join(s.strip() for s in buf if s.strip())
        paragraph_text = re.sub(r"\s{2,}", " ", paragraph_text).strip()
        if paragraph_text:
            story.append(Paragraph(xml_escape(paragraph_text), style_body))
        buf = []

    for raw_line in text.split("\n"):
        line = raw_line.rstrip()
        if not line.strip():
            flush_paragraph()
            continue
        if line.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(xml_escape(line[4:].strip()), style_h3))
            continue
        if line.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(xml_escape(line[3:].strip()), style_h2))
            continue
        if line.startswith("# "):
            flush_paragraph()
            story.append(Paragraph(xml_escape(line[2:].strip()), style_h1))
            continue

        m_list = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)$", line)
        if m_list:
            flush_paragraph()
            item_text = m_list.group(2).strip()
            story.append(Paragraph(xml_escape(item_text), style_list, bulletText="•"))
            continue

        buf.append(line)

    flush_paragraph()
    doc.build(story)


def build_bonus_zip(paths: Paths) -> None:
    paths.out_zip.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(paths.out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # Add a small readme
        readme = (
            "Bonus materiály – Quantová Revoluce\n"
            "\n"
            "Obsah:\n"
            "- kniha (zdrojové kapitoly v Markdown)\n"
            "- ZION vizualizace (Tree of Life / Consciousness Tree)\n"
            "\n"
            "Pozn.: Tento balíček je určen pro čtenáře po zakoupení knihy.\n"
        )
        zf.writestr("README.txt", readme)

        def add_path(src: Path, arcname: str) -> None:
            if not src.exists() or src.is_dir():
                return
            zf.write(src, arcname=arcname)

        def add_tree(src_dir: Path, arc_prefix: str) -> None:
            if not src_dir.exists() or not src_dir.is_dir():
                return
            for p in src_dir.rglob("*"):
                if p.is_dir():
                    continue
                if p.name in {".DS_Store"}:
                    continue
                rel = p.relative_to(src_dir)
                zf.write(p, arcname=str(Path(arc_prefix) / rel))

        # 1) Full book sources (root/books/Quantum-Revolution)
        add_tree(paths.book_src_dir, "books/Quantum-Revolution")

        # 2) Curated extra ZION materials (root/books)
        extra_files = [
            paths.root_books_dir / "CosmicEgg.txt",
            paths.root_books_dir / "ZION_Consciousness_Tree_Interactive.html",
            paths.root_books_dir / "ZION_Kabbalah_Tree_Visualization.html",
            paths.root_books_dir / "ZION_Tree_of_Life_Content.md",
            paths.root_books_dir / "ZION_Tree_of_Life_Structure.json",
            paths.root_books_dir / "ZION_Tree_of_Life_Visual_Schema.md",
            paths.root_books_dir / "ZION_Tree_of_Life_Visualization.html",
        ]

        for f in extra_files:
            add_path(f, str(Path("books") / f.name))

        # 3) Whitepaper PDF (generated)
        add_path(paths.out_whitepaper_pdf, str(Path("whitepaper") / paths.out_whitepaper_pdf.name))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Quantová Revoluce PDF + bonus ZIP")
    parser.add_argument(
        "--font-regular",
        default=None,
        help="Path to TTF/OTF regular font to embed (optional).",
    )
    parser.add_argument(
        "--font-bold",
        default=None,
        help="Path to TTF/OTF bold font to embed (optional).",
    )
    args = parser.parse_args()

    v2_root = Path(__file__).resolve().parents[1]  # .../public_html/V2
    repo_root = Path(__file__).resolve().parents[3]  # .../<repo>
    paths = Paths(v2_root=v2_root, repo_root=repo_root)

    if not paths.book_src_dir.exists():
        raise SystemExit(f"Chybí zdroje knihy: {paths.book_src_dir}")

    build_pdf(paths, font_regular_override=args.font_regular, font_bold_override=args.font_bold)
    build_whitepaper_pdf(paths, font_regular_override=args.font_regular, font_bold_override=args.font_bold)
    build_bonus_zip(paths)

    print(f"✅ PDF:  {paths.out_pdf} ({paths.out_pdf.stat().st_size} bytes)")
    print(f"✅ WP:   {paths.out_whitepaper_pdf} ({paths.out_whitepaper_pdf.stat().st_size} bytes)")
    print(f"✅ ZIP:  {paths.out_zip} ({paths.out_zip.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
