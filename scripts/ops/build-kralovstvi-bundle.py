#!/usr/bin/env python3
"""Sestaví prodejní ZIP s celou ediční sadou Království srdce.

Zdroj: canon/Kralovstvi_srdce_Zion_CZ_EN_FR_ES_PT_PRODEJ
  · CZ/ … PT/           vlajková ilustrovaná edice (Nová plavba)
  · EDITION/<edice>/<jazyk>/   ostatní edice (7 × 5)

Výstup: apps/MarketPlace/public/shop/downloads/<název>.zip
  (adresář je v .gitignore; v gitu 65 MB binárka nemá co dělat)

Kanonické místo na serveru je ale MIMO strom aplikace:
  /opt/zion/data/downloads/<název>.zip
servíruje ho nginx (location /shop/downloads/ v
market.zionterranova.com.conf). Důvod: deploy MarketPlace dělá
`rsync --delete` přes app root, takže ZIP uvnitř public/ by při deployi
z jiného klonu zmizel a odkazy v už odeslaných e-mailech by přestaly
fungovat. Kopie v public/ zůstává jen jako záloha.

Použití:
    python3 scripts/ops/build-kralovstvi-bundle.py --check
    python3 scripts/ops/build-kralovstvi-bundle.py            # jen sestaví
    python3 scripts/ops/build-kralovstvi-bundle.py --upload   # + nahraje na EDGE2
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "canon" / "Kralovstvi_srdce_Zion_CZ_EN_FR_ES_PT_PRODEJ"
OUT_DIR = REPO / "apps" / "MarketPlace" / "public" / "shop" / "downloads"
OUT_NAME = "Kralovstvi_srdce_kompletni_edice_5_jazyku.zip"
ROOT_IN_ZIP = "Kralovstvi_srdce"

LANGS = ["CZ", "EN", "ES", "FR", "PT"]

# slug v EDITION/  ->  (pořadí, název složky v ZIPu)
EDITIONS = [
    ("klasicka", "02-klasicka"),
    ("cloude", "03-cedrovy-kyl"),
    ("gemini", "04-gemini"),
    ("gpt", "05-gpt"),
    ("groq", "06-groq"),
    ("quen", "07-quen"),
    ("deepseek", "08-deepseek"),
]

README = """\
KRÁLOVSTVÍ SRDCE — kompletní ediční sada
=======================================

Osm samostatných edic téhož příběhu, každá v pěti jazycích.
Každá kniha je dodána dvakrát: jako PDF (A5, 148 × 210 mm) a jako EPUB.

JAZYKY
  CZ  čeština      EN  English       ES  español
  FR  français     PT  português

EDICE
  01-nova-plavba    Ilustrovaná (vlajková) — 10 kapitol + epilog
  02-klasicka       Původní midraš — nejkratší a nejstarší vrstva
  03-cedrovy-kyl    Literární rozšíření — 28 kapitol ve třech částech
  04-gemini         Svorník korpusu — 24 kapitol ve čtyřech částech
  05-gpt            Pokračování — kapitoly 10–24
  06-groq           Loď, která se ptá — 12 kapitol se „spárami"
  07-quen           Účetnice — 11 kapitol, deník účtování
  08-deepseek       Kniha Kýlu — pohled zevnitř dřeva

CO JE UVNITŘ KAŽDÉ KNIHY
  Titul, prolog, kapitoly, epilog. Většina edic má u každé kapitoly
  oddíl „Z Písma, tradice a korpusu" a tabulku „Kotva pravdy", která
  u každého tvrzení říká, zda jde o Písmo, tradici, historii, legendu,
  nebo o literární obraz. Čtenář si tak může sám ověřit, co je co.

JAK ČÍST
  Začněte edicí 01 (ilustrovaná) nebo 02 (klasická) — jsou nejkratší.
  Ostatní edice jsou jiné pohledy na týž příběh, ne pokračování;
  lze je číst v libovolném pořadí.

STAV SADY
  00-STAV.md — matice edic a jazyků se počty slov a stran.

Pokud některý soubor chybí nebo se neotevírá, napište na podporu
a my vám obratem pošleme náhradní kopii.

Děkujeme, že čtete pomalu.
"""


def collect() -> list[tuple[Path, str]]:
    """Vrátí seznam (zdrojový soubor, cesta v ZIPu)."""
    items: list[tuple[Path, str]] = []

    # Vlajková ilustrovaná edice leží přímo v kořeni prodejního adresáře.
    for lang in LANGS:
        d = SRC / lang
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.pdf")) + sorted(d.glob("*.epub")):
            if f.name.startswith("_") or f.name.startswith("."):
                continue
            items.append((f, f"{ROOT_IN_ZIP}/01-nova-plavba/{lang}/{f.name}"))

    # Ostatní edice: EDITION/<slug>/<lang>/
    for slug, folder in EDITIONS:
        for lang in LANGS:
            d = SRC / "EDITION" / slug / lang
            if not d.is_dir():
                continue
            for f in sorted(d.glob("*.pdf")) + sorted(d.glob("*.epub")):
                if f.name.startswith("_") or f.name.startswith("."):
                    continue
                items.append((f, f"{ROOT_IN_ZIP}/{folder}/{lang}/{f.name}"))

    return items


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="jen zkontrolovat vstupy, nic nebalit")
    ap.add_argument("--upload", action="store_true", help="po sestavení nahrát na EDGE2 do /opt/zion/data/downloads")
    args = ap.parse_args()

    if not SRC.is_dir():
        print(f"CHYBA: zdroj nenalezen: {SRC}", file=sys.stderr)
        return 2

    items = collect()
    if not items:
        print("CHYBA: žádné knihy k zabalení", file=sys.stderr)
        return 2

    # Očekáváme 8 edic × 5 jazyků × 2 formáty = 80 souborů.
    expected = 8 * 5 * 2
    if len(items) != expected:
        print(f"CHYBA: čekáno {expected} souborů, nalezeno {len(items)}", file=sys.stderr)
        for src, arc in items:
            print("  ", arc, file=sys.stderr)
        return 1

    if args.check:
        total = sum(p.stat().st_size for p, _ in items)
        print(f"OK: {len(items)} souborů, {total / 1e6:.1f} MB nezkomprimovaně")
        return 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / OUT_NAME

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False, dir=OUT_DIR) as tmp:
        tmp_path = Path(tmp.name)
    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr(f"{ROOT_IN_ZIP}/00-README.txt", README, zipfile.ZIP_DEFLATED)
            stav = SRC / "EDITION" / "00-STAV.md"
            if stav.is_file():
                z.writestr(f"{ROOT_IN_ZIP}/00-STAV.md", stav.read_text(encoding="utf-8"))
            for src, arc in items:
                z.write(src, arc)

        # Rozbalovací kontrola: každý zapsaný soubor musí být čitelný.
        with zipfile.ZipFile(tmp_path) as z:
            if bad := z.testzip():
                raise SystemExit(f"CHYBA: poškozený záznam v ZIPu: {bad}")
            names = z.namelist()

        tmp_path.replace(out)
    finally:
        tmp_path.unlink(missing_ok=True)

    size = out.stat().st_size
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    print(f"ZIP   {out.relative_to(REPO)}")
    print(f"      {len(names)} položek · {size / 1e6:.1f} MB · sha256 {digest[:16]}…")

    if args.upload:
        import subprocess

        host = "zion-edge2"
        key = str(Path.home() / ".ssh" / "zion-edge-post-wipe-2026-07-29")
        remote_dir = "/opt/zion/data/downloads"
        ssh = ["ssh", "-i", key, "-o", "StrictHostKeyChecking=accept-new", host]
        print(f"      nahrávám na {host}:{remote_dir} …")
        subprocess.run(ssh + [f"mkdir -p {remote_dir}"], check=True)
        subprocess.run(
            ["scp", "-q", "-i", key, "-o", "StrictHostKeyChecking=accept-new",
             str(out), f"{host}:{remote_dir}/"],
            check=True,
        )
        subprocess.run(
            ssh + [f"chown zion:zion {remote_dir}/{OUT_NAME} && chmod 644 {remote_dir}/{OUT_NAME}"],
            check=True,
        )
        url = f"https://market.zionterranova.com/shop/downloads/{OUT_NAME}"
        probe = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{size_download}", "-r", "0-1023", url],
            capture_output=True, text=True,
        )
        print(f"      HTTP: {probe.stdout.strip()}  ({url})")
        if not probe.stdout.startswith(("200", "206")):
            print("CHYBA: odkaz na stažení nevrací 200/206", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
