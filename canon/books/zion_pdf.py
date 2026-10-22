# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "fpdf2>=2.8",
# ]
# ///
"""
Shared Zion-themed FPDF renderer for ZION narrative PDFs.

Provides ZionPDF, a drop-in replacement for the legacy GenesisPDF and FablePDF
classes. It renders A4 pages with a dark Zion theme and measures boxes before
drawing them so text never overlaps or overflows.
"""

import os
from fpdf import FPDF
from fpdf.enums import XPos, YPos


# ── Font discovery ─────────────────────────────────────────────────────────
FONT_CANDIDATES = {
    "": [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ],
    "B": [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
    "I": [
        "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    ],
    "BI": [
        "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf",
    ],
}


def find_system_font(style: str) -> str:
    """Return the first available font file for a given style."""
    for candidate in FONT_CANDIDATES.get(style, FONT_CANDIDATES[""]):
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(
        f"No font found for style {style!r}. Tried: {FONT_CANDIDATES.get(style, [])}"
    )


class ZionPDF(FPDF):
    # Theme colors
    BG = (2, 4, 12)
    FG = (240, 245, 255)
    MUTED = (180, 185, 195)
    MUTED2 = (130, 135, 150)
    GOLD = (255, 215, 0)
    PURPLE = (147, 51, 234)
    CYAN = (6, 182, 212)

    def __init__(self, lang: str = "en"):
        super().__init__()
        self.lang = lang
        self.header_text = ""
        self.page_word = "Page"
        self.set_left_margin(20)
        self.set_right_margin(20)
        self.set_auto_page_break(auto=True, margin=20)

    def add_font(self, family, style="", fname="", uni=True):
        """Map legacy DejaVu requests to system fonts; pass others through."""
        if family == "DejaVu":
            mapped = find_system_font(style)
            FPDF.add_font(self, "DejaVu", style, mapped)
        else:
            FPDF.add_font(self, family, style, fname)

    # ── Page chrome ──────────────────────────────────────────────────────────
    def header(self):
        """Draw the dark page background and a subtle running header."""
        self.set_fill_color(*self.BG)
        self.rect(0, 0, self.w, self.h, style="F")
        if self.page_no() == 1:
            return
        if getattr(self, "header_text", ""):
            self.set_font("DejaVu", "", 8)
            self.set_text_color(*self.MUTED2)
            self.cell(
                0,
                10,
                self.header_text,
                align="C",
                new_x=XPos.LMARGIN,
                new_y=YPos.NEXT,
            )
            self.set_draw_color(*self.GOLD)
            self.set_line_width(0.3)
            line_y = self.get_y()
            self.line(self.l_margin, line_y, self.w - self.r_margin, line_y)
            self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*self.MUTED2)
        self.cell(
            0,
            10,
            f"{getattr(self, 'page_word', 'Page')} {self.page_no()}",
            align="C",
        )

    # ── Shared helpers ─────────────────────────────────────────────────────────
    def section_break(self):
        self.ln(8)
        self.set_draw_color(*self.GOLD)
        self.set_line_width(0.3)
        center = self.w / 2
        y = self.get_y()
        self.line(center - 15, y, center + 15, y)
        self.ln(8)

    def _measure_wrapped(self, text, width, line_h, font_style=""):
        """Return the number of wrapped lines for a piece of text."""
        if not text:
            return 0
        self.set_font("DejaVu", font_style, 10)
        wrapped = self.multi_cell(width, line_h, text, dry_run=True, output="LINES")
        return len(wrapped)

    # ── Genesis / Book of Genesis methods ────────────────────────────────────
    def chapter_title(self, title, subtitle=None):
        self.ln(4)
        self.set_font("DejaVu", "B", 18)
        self.set_text_color(*self.GOLD)
        self.cell(0, 12, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        if subtitle:
            self.set_font("DejaVu", "I", 11)
            self.set_text_color(*self.MUTED)
            self.cell(0, 8, subtitle, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)
        self.set_draw_color(*self.GOLD)
        self.set_line_width(0.5)
        x = self.l_margin
        self.line(x, self.get_y(), x + 60, self.get_y())
        self.ln(6)

    def body_text(self, text, bold=False):
        self.set_font("DejaVu", "B" if bold else "", 11)
        self.set_text_color(*self.FG)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def verse_text(self, text):
        self.set_font("DejaVu", "I", 10.5)
        self.set_text_color(*self.MUTED)
        normal_left = self.l_margin
        self.set_left_margin(35)
        self.multi_cell(0, 6, text)
        self.set_left_margin(normal_left)
        self.ln(3)

    def golden_box(self, title, lines):
        x = self.l_margin
        w = self.w - self.l_margin - self.r_margin
        inner_w = w - 8  # 4 mm padding each side
        title_h = 7
        line_h = 5.5

        # Measure title
        self.set_font("DejaVu", "B", 11)
        title_rows = self._measure_wrapped(title, inner_w, title_h, "B")
        title_rows = max(title_rows, 1)

        # Measure body
        self.set_font("DejaVu", "", 10)
        body_rows = 0
        for line in lines:
            text = str(line)
            if text:
                body_rows += self._measure_wrapped(text, inner_w, line_h, "")
            else:
                body_rows += 1  # empty line = vertical spacing

        total_h = title_rows * title_h + body_rows * line_h + 6

        if self.get_y() + total_h > self.page_break_trigger:
            self.add_page()

        start_y = self.get_y()

        # Draw box
        self.set_fill_color(25, 22, 35)
        self.set_draw_color(*self.GOLD)
        self.set_line_width(0.4)
        self.rect(x, start_y, w, total_h, style="DF")

        # Top glow line
        self.set_draw_color(*self.GOLD)
        self.set_line_width(0.7)
        self.line(x, start_y, x + w, start_y)

        # Title
        self.set_xy(x + 4, start_y + 2)
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(*self.GOLD)
        self.multi_cell(inner_w, title_h, title)

        # Body lines
        self.set_x(x + 4)
        self.set_font("DejaVu", "", 10)
        self.set_text_color(*self.FG)
        for line in lines:
            self.set_x(x + 4)
            text = str(line)
            if text:
                self.multi_cell(inner_w, line_h, text)
            else:
                self.ln(line_h)

        self.ln(6)

    # ── Fable / WpLite methods ───────────────────────────────────────────────
    def title_page(self, title, subtitle, tagline_lines, edition_line):
        self.set_y(55)
        self.set_font("DejaVu", "B", 28)
        self.set_text_color(*self.GOLD)
        self.cell(
            0,
            18,
            title,
            align="C",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.set_font("DejaVu", "I", 14)
        self.set_text_color(*self.MUTED)
        self.cell(
            0,
            10,
            subtitle,
            align="C",
            new_x=XPos.LMARGIN,
            new_y=YPos.NEXT,
        )
        self.ln(8)
        self.set_font("DejaVu", "I", 10)
        self.set_text_color(*self.MUTED2)
        for line in tagline_lines:
            self.cell(
                0,
                7,
                line,
                align="C",
                new_x=XPos.LMARGIN,
                new_y=YPos.NEXT,
            )
        self.ln(25)
        self.set_font("DejaVu", "I", 9)
        self.set_text_color(*self.MUTED)
        self.cell(0, 6, edition_line, align="C")

    def chapter_heading(self, num_text, title):
        self.ln(4)
        self.set_font("DejaVu", "B", 15)
        self.set_text_color(*self.GOLD)
        self.cell(0, 10, num_text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        if title:
            self.set_font("DejaVu", "B", 13)
            self.set_text_color(*self.CYAN)
            self.multi_cell(0, 8, title)
        self.ln(2)
        self.set_draw_color(*self.GOLD)
        self.set_line_width(0.4)
        x = self.l_margin
        self.line(x, self.get_y(), x + 80, self.get_y())
        self.ln(5)

    def story(self, paragraphs):
        for p in paragraphs:
            if p.startswith("*") and p.endswith("*"):
                self.set_font("DejaVu", "I", 10.5)
                self.set_text_color(*self.MUTED)
                normal_left = self.l_margin
                self.set_left_margin(35)
                self.multi_cell(0, 6, p.strip("*"))
                self.set_left_margin(normal_left)
                self.ln(2)
            else:
                self.set_font("DejaVu", "", 10.5)
                self.set_text_color(*self.FG)
                self.multi_cell(0, 6, p)
                self.ln(2)

    def chronicle(self, title, body_lines, table_rows=None):
        x = self.l_margin
        w = self.w - self.l_margin - self.r_margin
        inner_w = w - 8
        title_h = 6.5
        line_h = 5.5

        # Measure title
        self.set_font("DejaVu", "B", 11)
        title_rows = self._measure_wrapped(title, inner_w, title_h, "B")
        title_rows = max(title_rows, 1)

        # Measure body
        self.set_font("DejaVu", "", 9.5)
        body_rows = 0
        for line in body_lines:
            text = str(line)
            if text:
                body_rows += self._measure_wrapped(text, inner_w, line_h, "")
            else:
                body_rows += 1

        # Measure table
        table_header_rows = 0
        table_data_rows = 0
        if table_rows:
            header_text = "  |  ".join(str(c) for c in table_rows[0])
            table_header_rows = self._measure_wrapped(header_text, inner_w, line_h, "")
            table_header_rows = max(table_header_rows, 1)
            for row in table_rows[1:]:
                row_text = "  |  ".join(str(c) for c in row)
                table_data_rows += self._measure_wrapped(row_text, inner_w, line_h, "")

        total_h = (
            title_rows * title_h
            + body_rows * line_h
            + table_header_rows * line_h
            + table_data_rows * line_h
            + 8  # padding
        )

        if self.get_y() + total_h > self.page_break_trigger:
            self.add_page()

        start_y = self.get_y()

        # Draw box
        self.set_fill_color(20, 25, 38)
        self.set_draw_color(*self.CYAN)
        self.set_line_width(0.4)
        self.rect(x, start_y, w, total_h, style="DF")

        # Top glow line
        self.set_draw_color(*self.CYAN)
        self.set_line_width(0.7)
        self.line(x, start_y, x + w, start_y)

        # Title
        self.set_xy(x + 4, start_y + 2)
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(*self.CYAN)
        self.multi_cell(inner_w, title_h, title)

        # Body
        self.set_x(x + 4)
        self.set_font("DejaVu", "", 9.5)
        self.set_text_color(*self.FG)
        for line in body_lines:
            self.set_x(x + 4)
            text = str(line)
            if text:
                self.multi_cell(inner_w, line_h, text)
            else:
                self.ln(line_h)

        # Table
        if table_rows:
            self.ln(1)
            header_text = "  |  ".join(str(c) for c in table_rows[0])
            self.set_font("DejaVu", "B", 9)
            self.set_text_color(*self.CYAN)
            self.set_x(x + 4)
            self.multi_cell(inner_w, line_h, header_text)
            self.set_font("DejaVu", "", 9)
            self.set_text_color(*self.FG)
            for row in table_rows[1:]:
                self.set_x(x + 4)
                row_text = "  |  ".join(str(c) for c in row)
                self.multi_cell(inner_w, line_h, row_text)

        self.ln(5)
