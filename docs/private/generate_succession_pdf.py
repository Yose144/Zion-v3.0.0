#!/usr/bin/env python3
"""Generate a clean, printable 2-page PDF declaration for ZION succession & power of attorney.

Run with:
    /tmp/zion-pdf-venv/bin/python docs/private/generate_succession_pdf.py
"""

import os
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_PDF = BASE_DIR / "ZION_SUCCESSION_DECLARATION.pdf"


def find_font(style: str = "") -> str:
    candidates = {
        "": [
            "/Library/Fonts/Arial Unicode.ttf",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ],
        "B": [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ],
    }
    for candidate in candidates[style]:
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(f"No Unicode font found for style {style!r}")


class SuccessionPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("Arial", "", find_font(""))
        self.add_font("Arial", "B", find_font("B"))
        self.set_auto_page_break(auto=True, margin=15)
        self.set_margins(16, 16, 16)
        self.alias_nb_pages()

    def header(self):
        self.set_font("Arial", "B", 8)
        self.set_text_color(140, 20, 20)
        self.cell(0, 5, "DŮVĚRNÝ DOKUMENT — PROVOZNÍ A RODINNÁ POJISTKA PROJEKTU ZION", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Arial", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 5, f"Strana {self.page_no()} / {{nb}}", align="C")
        self.set_text_color(0, 0, 0)


def build_pdf():
    pdf = SuccessionPDF()
    pdf.add_page()

    # Title
    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 7, "DAROVACÍ LISTINA, PLNÁ MOC A PROHLÁŠENÍ O NÁSTUPNICTVÍ", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 5, "Projekt ZION TerraNova — Pojistka kontinuity a rodiny", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    # I. Účastníci
    pdf.set_font("Arial", "B", 10)
    pdf.set_fill_color(240, 240, 245)
    pdf.cell(0, 6, "I. ÚČASTNÍCI", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1.5)

    pdf.set_font("Arial", "", 9)
    participants = [
        ("Předávající / Zmocnitel / Dárce:", "Yosef Hubálek, datum narození: ____________________, bydliště: ________________________________\n(zakladatel projektu ZION, jediný jednatel společnosti OMNITY.ONE s.r.o., IČO 09120050)"),
        ("Hlavní správkyně / Zmocněnkyně (Trustee):", "Erika Imlaufová, datum narození: ____________________, bydliště: ________________________________"),
        ("Náhradní správkyně (při nečinnosti Eriky):", "Petra Tkácová, datum narození: ____________________, bydliště: ________________________________"),
        ("Nezletilé děti a hlavní beneficienti:", "Sarah Hubalková (dcera) a Tadeas Hubalek (syn)"),
    ]
    for label, desc in participants:
        pdf.set_font("Arial", "B", 8.5)
        pdf.cell(0, 4.5, label, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Arial", "", 8.5)
        pdf.multi_cell(0, 4.5, desc)
        pdf.ln(1)

    # II. Předání správy a plná moc
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 6, "II. PŘEDÁNÍ SPRÁVY, ROZHODOVÁNÍ A PLNÁ MOC", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1.5)

    pdf.set_font("Arial", "", 8.5)
    p2 = (
        "1. Pro případ mé smrti, dlouhodobé nemoci, úrazu, nezvěstnosti nebo jakékoliv jiné neschopnosti vykonávat správu "
        "a rozvoj projektu ZION TerraNova tímto předávám veškeré pravomoci k řízení a rozhodování Erice Imlaufové.\n"
        "2. NÁHRADNICTVÍ: Pokud by se Erika Imlaufová k převzetí správy nehlásila, správu odmítla, nebyla k zastižení "
        "nebo z jakéhokoliv důvodu nemohla funkci vykonávat, veškerá práva, pravomoci a povinnosti správce přecházejí "
        "automaticky a v plném rozsahu na Petru Tkácovou.\n"
        "3. Pověření a plná moc zahrnuje: správu Edge serveru (62.171.141.136), domén zionterranova.com, newearth.cz a subdomén, "
        "repozitářů GitHub (Yose144), blockchainových klíčů (premine, admin multisig 3-of-3, DAO guardians 5-of-7, validátoři), "
        "komunikačních kanálů a smluvních vztahů."
    )
    pdf.multi_cell(0, 4.5, p2)
    pdf.ln(2)

    # III. Převod práv a majetku
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 6, "III. PŘEVOD PRÁV, DUŠEVNÍHO VLASTNICTVÍ A MAJETKU", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1.5)

    pdf.set_font("Arial", "", 8.5)
    p3 = (
        "1. Převádím veškerá svá převoditelná práva k projektu ZION TerraNova — včetně autorských práv ke kódu, ochranných známek "
        "(ZION®, Zion TerraNova®, AI Native®), vizuální identity, grafiky a obchodního podílu v OMNITY.ONE s.r.o. — na Eriku Imlaufovou "
        "(respektive náhradnici Petru Tkácovou) s posláním spravovat tento majetek pro kontinuitu projektu a ve prospěch dětí Sarah a Tadease.\n"
        "2. Příjmy a soukromý majetek z projektu mají sloužit rovným dílem k zabezpečení dětí (Sarah a Tadeas) a správkyně (Erika, popř. Petra) "
        "v poměru 1/3 : 1/3 : 1/3."
    )
    pdf.multi_cell(0, 4.5, p3)
    pdf.ln(2)

    # IV. Rozdělení premine a L5 projektů
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 6, "IV. ZÁVAZNÉ ROZDĚLENÍ PREMINE A L5 FREE WORLD PROJEKTŮ", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1.5)

    pdf.set_font("Arial", "", 8.5)
    p4 = (
        "Celkový genesis premine činí 16 780 000 000 ZION (14 slotů) a zůstává alokován takto:\n"
        "• OASIS Reward Pool (3 sloty = 4 950 000 000 ZION): Sloty 1, 2 a 3 (Mining Rewards, Challenge Rewards, Guild & Territory).\n"
        "• L5 Free World Projects (2 sloty = 3 300 000 000 ZION — přesunuto ze Slotů 4 a 5):\n"
        "    - Projekt Genesis Garden: 500 000 000 ZION (správce: Petra Tkácová)\n"
        "    - Project Dharma Temple: 500 000 000 ZION (správce: Erika Imlaufová)\n"
        "    - Projekt Te Piko Ora: 500 000 000 ZION (správce: Vahine Fierro)\n"
        "    - Project Bohemia: 500 000 000 ZION (správce: Andrea Kalousová)\n"
        "    - Project Bodhi Lanka: 500 000 000 ZION (správce: Annicka Purkertová)\n"
        "    - L5 rezervní fond: 800 000 000 ZION (správce: Erika Imlaufová / náhradník: Petra Tkácová)\n"
        "• DAO Treasury (4 000 000 000 ZION) a Infrastruktura + Humanitární fondy (4 530 000 000 ZION): slouží výhradně svým určeným cílům."
    )
    pdf.multi_cell(0, 4.3, p4)
    pdf.ln(2)

    # V. Předání přístupů
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 6, "V. PŘEDÁNÍ PŘÍSTUPŮ A BEZPEČNOST", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1.5)

    pdf.set_font("Arial", "", 8.5)
    p5 = (
        "Veškeré privátní klíče, hesla k trezorům a digitálním zálohám jsou uloženy na bezpečném fyzickém a šifrovaném úložišti "
        "mimo veřejný repozitář. Tato listina slouží jako nezpochybnitelný doklad vůle zakladatele projektu pro rodinu, komunitu, partnery i úřady."
    )
    pdf.multi_cell(0, 4.5, p5)
    pdf.ln(4)

    # Signatures
    pdf.set_font("Arial", "B", 9)
    pdf.cell(0, 5, "V ____________________________________ dne ________________________", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)

    # 3 distinct signature blocks
    sig_blocks = [
        ("Yosef Hubálek", "Zakladatel, Zmocnitel a Dárce", "Podpis: _____________________________________________"),
        ("Erika Imlaufová", "Hlavní správkyně (Trustee) — potvrzení přijetí správy a plné moci", "Podpis: _____________________________________________"),
        ("Petra Tkácová", "Náhradní správkyně — potvrzení přijetí náhradního pověření", "Podpis: _____________________________________________"),
    ]

    for name, title, sig_line in sig_blocks:
        pdf.set_font("Arial", "B", 9)
        pdf.cell(0, 4.5, f"{name} ({title})", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Arial", "", 8.5)
        pdf.cell(0, 4.5, sig_line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(3)

    pdf.output(OUTPUT_PDF)
    print(f"Generated: {OUTPUT_PDF} ({pdf.pages_count} pages)")


if __name__ == "__main__":
    build_pdf()
