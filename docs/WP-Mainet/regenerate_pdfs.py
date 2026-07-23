# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "fpdf2>=2.8",
# ]
# ///
"""
Regenerate the four canonical ZION narrative PDFs with the Zion dark theme.

Generates:
  - docs/WP-Mainet/ZION_Kniha_Zrozeni_v3.0_CZ.pdf
  - docs/WP-Mainet/ZION_Book_of_Genesis_v3.0_EN.pdf
  - docs/WP-Mainet/Zion-WpLite_CZ.pdf
  - docs/WP-Mainet/Zion-WpLite_EN.pdf

Then copies them into:
  - public/docs/WP/
  - APP&WEB/website-v2.9/public/docs/WP/

The script reuses the content from the existing generate_genesis_pdfs.py and
generate_wplite_pdfs.py modules but monkey-patches their renderer class to
zion_pdf.ZionPDF, which:
  - uses the Zion dark theme (dark navy background, gold/purple/cyan accents)
  - measures boxes before drawing them (no text-overlap)
  - wraps long lines properly inside boxes
  - maps DejaVu font requests to system Arial/DejaVu fonts
"""

import importlib
import shutil
import sys
from pathlib import Path

# Ensure sibling module zion_pdf.py is importable
WP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(WP_DIR))

from zion_pdf import ZionPDF


REPO_ROOT = WP_DIR.parent.parent
PUBLIC_WP = REPO_ROOT / "public" / "docs" / "WP"
WEB_WP = REPO_ROOT / "APP&WEB" / "website-v2.9" / "public" / "docs" / "WP"

PDFS = {
    "ZION_Book_of_Genesis_v3.0_EN.pdf",
    "ZION_Kniha_Zrozeni_v3.0_CZ.pdf",
    "Zion-WpLite_CZ.pdf",
    "Zion-WpLite_EN.pdf",
}


genesis_mod = importlib.import_module("generate_genesis_pdfs")
wplite_mod = importlib.import_module("generate_wplite_pdfs")

genesis_mod.GenesisPDF = ZionPDF
wplite_mod.FablePDF = ZionPDF


def generate():
    print("Generating ZION PDFs with Zion theme...\n")

    print("[1/4] Book of Genesis — CZ")
    genesis_mod.build_pdf("cz")

    print("[2/4] Book of Genesis — EN")
    genesis_mod.build_pdf("en")

    print("[3/4] WpLite — CZ")
    wplite_mod.build_pdf("cz")

    print("[4/4] WpLite — EN")
    wplite_mod.build_pdf("en")

    print("\nCopying to public paths...")
    PUBLIC_WP.mkdir(parents=True, exist_ok=True)
    WEB_WP.mkdir(parents=True, exist_ok=True)
    for pdf_name in PDFS:
        src = WP_DIR / pdf_name
        if not src.exists():
            print(f"  [WARN] Missing {src}")
            continue
        shutil.copy2(src, PUBLIC_WP / pdf_name)
        shutil.copy2(src, WEB_WP / pdf_name)
        print(f"  {pdf_name} -> public + website")

    print("\nDone.")


if __name__ == "__main__":
    generate()
