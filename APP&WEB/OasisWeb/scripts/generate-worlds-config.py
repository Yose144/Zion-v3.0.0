#!/usr/bin/env python3
"""
Generate src/domain/config/worlds.ts from docs/docs2.9/ZION_OASIS/WORLDS/*.md
This is a maintenance script — safe to re-run whenever world MD files change.
"""

import json
import math
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MD_DIR = ROOT / "docs" / "docs2.9" / "ZION_OASIS" / "WORLDS"
OUT_FILE = ROOT / "APP&WEB" / "OasisWeb" / "src" / "domain" / "config" / "worlds.ts"
README_FILE = ROOT / "docs" / "docs2.9" / "ZION_OASIS" / "WORLDS" / "README.md"

SKIP_FILES = {"README.md", "TEMPLATE.md"}


def clean_text(text: str) -> str:
    text = re.sub(r"^>\s*", "", text.strip())
    text = re.sub(r"\*\*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r'^[*"\s]+|[*"\s]+$', '', text)
    text = text.replace("`", "\\`")
    return text


def parse_layer(text: str) -> int:
    m = re.search(r"[Vv]rstva\s+(\d)", text)
    if m:
        return int(m.group(1))
    m = re.search(r"\b(\d)\s*[-–—]", text)
    if m:
        return int(m.group(1))
    return 1


def infer_category(typ: str, file_id: str) -> str:
    # File name is the most reliable category signal.
    if file_id.startswith("PLANET_"):
        return "planet"
    if file_id.startswith("SECTOR_"):
        return "sector"
    if file_id.startswith("DIMENSION_"):
        return "dimension"
    if file_id.startswith("WORLD_"):
        return "world"

    t = typ.lower()
    if "hvězdný" in t or "hviezdna" in t or "star system" in t:
        return "star-system"
    if "planeta" in t or "měsíc" in t:
        return "planet"
    if "dimenze" in t or "časová linie" in t:
        return "dimension"
    if "svět" in t or "mýtický" in t or "kulturní" in t:
        return "world"
    if "sektor" in t or "space-opera" in t:
        return "sector"
    return "star-system"


def strip_emoji_and_markers(text: str) -> str:
    # remove leading emoji-ish chars and markdown markers before the first word
    text = re.sub(r"^[^\w]+(?=\w)", "", text)
    return text.strip()


def clean_name(text: str) -> str:
    text = re.sub(r"\s+", " ", text.strip())
    # Title-case each word; keeps NEXUS-7, AI, etc. readable for UI labels.
    return text.title()


def extract_name(raw_title: str, file_id: str) -> str:
    # remove (archetype) annotations
    title = re.sub(r"\s*\([^)]*\)", "", raw_title)
    title = strip_emoji_and_markers(title)

    # PLANET_* titles:  "PLANET DOOM: PHOBETOR — ..." -> use after ':'
    if file_id.startswith("PLANET_") and ":" in title:
        after_colon = title.split(":", 1)[1]
        if "—" in after_colon:
            after_colon = after_colon.split("—", 1)[0]
        return clean_name(after_colon)

    # DIMENSION_* titles: "DIMENSION_8BIT — Bitová realita / Atari sektor" -> use after '—' before '/'
    if file_id.startswith("DIMENSION_") and "—" in title:
        after_dash = title.split("—", 1)[1]
        if "/" in after_dash:
            after_dash = after_dash.split("/", 1)[0]
        after_dash = after_dash.strip()
        # if the subtitle is a sentence, fall back to the file id (e.g. Solarpunk, Steampunk)
        if len(after_dash) <= 30:
            return clean_name(after_dash)

    # DIMENSION_* fallback to id-derived clean name (Solarpunk, Steampunk, ...)
    if file_id.startswith("DIMENSION_"):
        return clean_name(file_id.replace("DIMENSION_", "").replace("_", " "))

    # SECTOR_*: derive from id (Star Wars, Dune, ...) — titles are localized
    if file_id.startswith("SECTOR_"):
        return clean_name(file_id.replace("SECTOR_", "").replace("_", " "))

    # WORLD_*: title before '—', remove WORLD_ prefix
    before = title.split("—", 1)[0].strip()
    before = re.sub(r"^(PLANET|WORLD|DIMENSION|SECTOR)\s*", "", before, flags=re.I)
    before = before.replace("_", " ")
    return clean_name(before)


def extract_summary(body: str) -> str:
    m = re.search(r"##\s*1\.\s*Základní popis\s+(.*?)(?=\n##|\n\n##|\Z)", body, re.S)
    if m:
        text = m.group(1).strip()
        text = text.split("\n\n")[0].strip()
        text = re.sub(r"^-\s+", "", text, flags=re.M)
        text = re.sub(r"\*\*", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        text = text.replace("`", "\\`")
        return text[:300]
    return ""


def extract_metadata(lines):
    typ = location = vibe = ""
    for line in lines[:25]:
        m = re.match(r"^>\s*\*\*Typ:\*\*\s*(.+)", line)
        if m:
            typ = clean_text(m.group(1))
        m = re.match(r"^>\s*\*\*Lokace v OASIS:\*\*\s*(.+)", line)
        if m:
            location = clean_text(m.group(1))
        m = re.match(r"^>\s*\*\*Vibe:\*\*\s*(.+)", line)
        if m:
            vibe = clean_text(m.group(1))
    return typ, location, vibe


def parse_title(lines):
    for line in lines[:15]:
        m = re.match(r"^#\s+(.+)$", line)
        if m:
            return m.group(1).strip()
    return ""


def parse_clue(body: str) -> int | None:
    # look inside the "Stopa ke Zlatému vejci" section if present
    m = re.search(r"##\s*11\.\s*Stopa.*?\n(.+?)(?=\n##|\Z)", body, re.S | re.I)
    section = m.group(1) if m else body
    for pat in [r"stopa\s*#\s*(\d+)", r"stopa\s*č\.\s*(\d+)", r"clue\s*#\s*(\d+)", r"č\.\s*(\d+)", r"#\s*(\d+)"]:
        m = re.search(pat, section.lower())
        if m:
            return int(m.group(1))
    return None


def parse_md(path: Path) -> dict:
    body = path.read_text(encoding="utf-8")
    lines = body.splitlines()
    file_id = path.stem

    raw_title = parse_title(lines)
    name = extract_name(raw_title, file_id) if raw_title else clean_name(file_id.replace("_", " "))

    typ, location, vibe = extract_metadata(lines)

    category = infer_category(typ, file_id)
    layer = parse_layer(typ + " " + location)
    summary = extract_summary(body)
    clue = parse_clue(body)

    tags = [category.replace("-", " ")]
    if re.search(r"[Vv]rstva", typ + location):
        tags.append(f"layer {layer}")

    entry = {
        "id": file_id,
        "name": name,
        "category": category,
        "layer": layer,
        "location": location,
        "vibe": vibe,
        "summary": summary,
        "tags": tags,
    }
    if clue is not None:
        entry["goldenEggClue"] = clue
    return entry


def ts_literal(value) -> str:
    if isinstance(value, str):
        # json.dumps gives valid double-quoted TS string with escaped quotes.
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        items = ", ".join(ts_literal(v) for v in value)
        return f"[{items}]"
    if isinstance(value, dict):
        items = ", ".join(f"{k}: {ts_literal(v)}" for k, v in value.items())
        return f"{{ {items} }}"
    return "undefined"


ARM_COUNT = 4
ARM_PITCH = 0.24  # ~13.7 degrees, Milky Way-ish


def _outer_entry(id: str, name: str, category: str, layer: int, location: str, vibe: str, summary: str, pos: dict) -> dict:
    tags = [category.replace("-", " ")]
    return {
        "id": id,
        "name": name,
        "category": category,
        "layer": layer,
        "location": location,
        "vibe": vibe,
        "summary": summary,
        "tags": tags,
        "galaxyPosition": pos,
    }


def build_outer_worlds() -> list:
    """Hard-coded outer-galaxy worlds near Andromeda, Triangulum, Sombrero and Cartwheel."""
    return [
        # --- Andromeda satellite ---
        _outer_entry(
            "ANDROMEDA_CORE",
            "Andromeda Core",
            "star-system",
            1,
            "Andromeda satellite — central star-system beyond the Milky Way rim",
            "A luminous anchor in the outer dark, guiding pilgrims past the galactic edge.",
            "Andromeda Core is the brightest star-system of the Andromeda satellite, a close neighbor to the Milky Way in the OASIS map.",
            {"x": 0, "y": 0.4, "z": -82},
        ),
        _outer_entry(
            "ANDROMEDA_HALO",
            "Andromeda Halo",
            "planet",
            1,
            "Andromeda satellite — outer halo",
            "Ancient light wrapped in a thin atmosphere of blue and silver dust.",
            "Andromeda Halo is a quiet outpost planet drifting at the edge of the satellite galaxy.",
            {"x": 7, "y": 0.2, "z": -79},
        ),
        _outer_entry(
            "ANDROMEDA_RIFT",
            "Andromeda Rift",
            "dimension",
            2,
            "Andromeda satellite — folded space",
            "A thin place where two galaxies almost touch and the rules of the Milky Way no longer apply.",
            "Andromeda Rift is a transitional dimension that forms where the Milky Way and Andromeda fields overlap.",
            {"x": -4, "y": -0.2, "z": -86},
        ),
        _outer_entry(
            "ANDROMEDA_OUTPOST",
            "Andromeda Outpost",
            "sector",
            1,
            "Andromeda satellite — expedition sector",
            "The last supply stop before the long dark between galaxies.",
            "Andromeda Outpost is a small sector used by scouts and pilgrims as a forward base for journeys beyond the Milky Way.",
            {"x": 5, "y": 0.1, "z": -76},
        ),
        _outer_entry(
            "ANDROMEDA_ANCIENTS",
            "Andromeda Ancients",
            "world",
            1,
            "Andromeda satellite — precursor world",
            "Ruins older than the local arms, waiting for someone who can read their silence.",
            "Andromeda Ancients is a world of old monuments left by an unknown civilization at the edge of the Andromeda satellite.",
            {"x": -5, "y": 0.3, "z": -83},
        ),

        # --- Triangulum satellite ---
        _outer_entry(
            "TRIANGULUM_CORE",
            "Triangulum Core",
            "star-system",
            1,
            "Triangulum satellite — core star-system",
            "A pale spiral heart far beyond the outer arm, steady and remote.",
            "Triangulum Core is the central star-system of the Triangulum satellite galaxy.",
            {"x": 72, "y": -0.4, "z": 38},
        ),
        _outer_entry(
            "TRIANGULUM_SPIRAL",
            "Triangulum Spiral",
            "planet",
            1,
            "Triangulum satellite — spiral arm",
            "Where the arm thins, the sky becomes a river of distant stars.",
            "Triangulum Spiral is a planet caught in one of the satellite galaxy's delicate arms.",
            {"x": 66, "y": 0.2, "z": 42},
        ),
        _outer_entry(
            "TRIANGULUM_DRIFT",
            "Triangulum Drift",
            "world",
            1,
            "Triangulum satellite — drifting world",
            "A world without a star, kept warm by the faint glow of the whole galaxy.",
            "Triangulum Drift is a rogue world wandering in the outer reaches of the Triangulum satellite.",
            {"x": 75, "y": -0.1, "z": 32},
        ),
        _outer_entry(
            "TRIANGULUM_NEBULA",
            "Triangulum Nebula",
            "sector",
            1,
            "Triangulum satellite — nebula sector",
            "Clouds of ionized dream between the stars.",
            "Triangulum Nebula is a faint sector of gas and dust at the edge of the Triangulum satellite.",
            {"x": 69, "y": 0.3, "z": 44},
        ),

        # --- Sombrero satellite ---
        _outer_entry(
            "SOMBRERO_CORE",
            "Sombrero Core",
            "star-system",
            1,
            "Sombrero satellite — bright central star-system",
            "A white core in a dark hat, watching the Milky Way from above the rim.",
            "Sombrero Core is the brilliant heart of the Sombrero satellite galaxy.",
            {"x": -58, "y": 0.2, "z": -68},
        ),
        _outer_entry(
            "SOMBRERO_DISC",
            "Sombrero Disc",
            "planet",
            1,
            "Sombrero satellite — disc world",
            "A world built on a perfectly flat plane, as if pressed between two dark mirrors.",
            "Sombrero Disc is a planet embedded in the thin dust lane of the Sombrero satellite.",
            {"x": -52, "y": 0.1, "z": -72},
        ),
        _outer_entry(
            "SOMBRERO_HALO",
            "Sombrero Halo",
            "world",
            1,
            "Sombrero satellite — halo world",
            "Quiet spheres of old light orbiting the great dark brim.",
            "Sombrero Halo is a world drifting in the faint spherical halo of the Sombrero satellite.",
            {"x": -62, "y": -0.2, "z": -65},
        ),
        _outer_entry(
            "SOMBRERO_VOID",
            "Sombrero Void",
            "dimension",
            2,
            "Sombrero satellite — empty dimension",
            "The silence between galaxies made habitable.",
            "Sombrero Void is a sparse dimension that mirrors the empty spaces beyond the Sombrero galaxy.",
            {"x": -54, "y": 0.0, "z": -70},
        ),

        # --- Cartwheel satellite ---
        _outer_entry(
            "CARTWHEEL_CORE",
            "Cartwheel Core",
            "star-system",
            1,
            "Cartwheel satellite — core star-system",
            "The still center of a broken wheel turning in the outer dark.",
            "Cartwheel Core is the remaining nucleus of the Cartwheel satellite galaxy.",
            {"x": 70, "y": -0.6, "z": -55},
        ),
        _outer_entry(
            "CARTWHEEL_RING",
            "Cartwheel Ring",
            "planet",
            1,
            "Cartwheel satellite — ring world",
            "A planet stretched into a circle by the impact that made this galaxy.",
            "Cartwheel Ring is a planet formed in the expanding ring of the Cartwheel satellite galaxy.",
            {"x": 65, "y": -0.3, "z": -60},
        ),
        _outer_entry(
            "CARTWHEEL_SPOKE",
            "Cartwheel Spoke",
            "sector",
            1,
            "Cartwheel satellite — spoke sector",
            "The bridges of stars left behind by the ancient collision.",
            "Cartwheel Spoke is a sector of star-bridges connecting the cartwheel's ring to its nucleus.",
            {"x": 74, "y": -0.1, "z": -50},
        ),
        _outer_entry(
            "CARTWHEEL_REMNANT",
            "Cartwheel Remnant",
            "world",
            1,
            "Cartwheel satellite — remnant world",
            "Fragments of the old galaxy, still warm with the memory of their former shape.",
            "Cartwheel Remnant is a world built from the debris of the Cartwheel galaxy's past.",
            {"x": 68, "y": 0.2, "z": -58},
        ),
    ]


def _stable_arm(id_str: str) -> int:
    """Deterministic arm assignment from world id."""
    return sum(ord(c) * (i + 1) for i, c in enumerate(id_str)) % ARM_COUNT


def assign_galaxy_positions(entries):
    """Assign Milky Way spiral-arm 3D coordinates to every world."""
    rng = random.Random("oasis-milkyway-2026-08-01")
    cat_bases = {
        "star-system": (11.0, 30.0, 0.35),
        "planet": (4.0, 9.0, 0.2),
        "sector": (5.5, 11.5, 0.22),
        "world": (5.0, 10.0, 0.25),
        "dimension": (6.0, 12.0, 0.3),
    }

    # group by arm and spread each arm from inner to outer
    arms = [[] for _ in range(ARM_COUNT)]
    for e in entries:
        e["_arm"] = _stable_arm(e["id"])
        arms[e["_arm"]].append(e)

    for arm, items in enumerate(arms):
        # sort by category max radius ascending so smaller/layer-1 worlds sit
        # closer to the core and star-systems extend to the outer arms
        items.sort(key=lambda e: (cat_bases.get(e["category"], (5.0, 12.0, 1.0))[1], e["id"]))
        n = max(1, len(items))
        for j, e in enumerate(items):
            cat = e["category"]
            r_min, r_max, y_range = cat_bases.get(cat, (5.0, 12.0, 1.0))

            # radial progression along the arm
            t = j / n
            r = r_min + (r_max - r_min) * (0.2 + 0.8 * t)
            r += (rng.random() - 0.5) * 1.4
            r = max(2.5, min(34.0, r))

            # logarithmic spiral angle
            arm_base = arm * 2 * math.pi / ARM_COUNT
            angle = arm_base + (1 / math.tan(ARM_PITCH)) * math.log(r + 0.7)
            angle += (rng.random() - 0.5) * 0.45

            y = (rng.random() - 0.5) * y_range

            x = math.cos(angle) * r
            z = math.sin(angle) * r
            e["galaxyPosition"] = {
                "x": round(x, 3),
                "y": round(y, 3),
                "z": round(z, 3),
            }
            del e["_arm"]


def generate():
    entries = []
    for path in sorted(MD_DIR.glob("*.md")):
        if path.name in SKIP_FILES:
            continue
        try:
            entries.append(parse_md(path))
        except Exception as e:
            print(f"[warn] failed to parse {path.name}: {e}")

    assign_galaxy_positions(entries)

    outer_entries = build_outer_worlds()
    all_entries = entries + outer_entries

    world_ids = [e["id"] for e in all_entries]
    star_ids = [e["id"] for e in all_entries if e["category"] == "star-system"]

    lines = [
        "import { World } from '../types/world';",
        "",
        "/**",
        " * Engine-agnostic world registry. Auto-generated from",
        " * docs/docs2.9/ZION_OASIS/WORLDS/*.md plus hard-coded outer-galaxy",
        " * entries via scripts/generate-worlds-config.py",
        " */",
        "",
        "export const WORLDS: World[] = [",
    ]
    for e in all_entries:
        fields = []
        for k, v in e.items():
            if k == "tags" and not v:
                continue
            fields.append(f"      {k}: {ts_literal(v)}")
        block = "  {\n" + ",\n".join(fields) + "\n  },"
        lines.append(block)
    lines.append("];")
    lines.append("")
    lines.append("export const WORLD_IDS = [")
    for wid in world_ids:
        lines.append(f'  "{wid}",')
    lines.append("] as const;")
    lines.append("")
    lines.append("export type WorldId = typeof WORLD_IDS[number];")
    lines.append("")
    lines.append("export const STAR_SYSTEM_IDS = [")
    for sid in star_ids:
        lines.append(f'  "{sid}",')
    lines.append("] as const;")
    lines.append("")
    lines.append("export function getWorldById(id: WorldId): World | undefined {")
    lines.append("  return WORLDS.find((w) => w.id === id);")
    lines.append("}")
    lines.append("")

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[ok] wrote {OUT_FILE} ({len(all_entries)} worlds, {len(outer_entries)} outer-galaxy)")


def generate_readme(entries):
    category_titles = {
        "star-system": "Hvězdné systémy",
        "planet": "Žánrové planety",
        "sector": "Filmové / space-opera sektory",
        "world": "Kulturní / historické světy",
        "dimension": "Dimenzní / meta světy",
    }

    grouped = {}
    for e in entries:
        grouped.setdefault(e["category"], []).append(e)

    lines = [
        "# 🌍 OASIS Worlds — Světová dokumentace",
        "",
        "Tento adresář obsahuje koncepty jednotlivých světů, dimenzí a prostorů OASIS.",
        "",
        "> **Hlavní vizi najdeš v:** [`APP&WEB/OasisWeb/OASIS_UNIVERSE.md`](../../../APP&WEB/OasisWeb/OASIS_UNIVERSE.md)  ",
        "> **Technická pravidla pro UE5 import:** [`AGENTS.md`](../../../AGENTS.md)  ",
        "> **Vygenerovaný registr světů:** [`APP&WEB/OasisWeb/src/domain/config/worlds.ts`](../../../APP&WEB/OasisWeb/src/domain/config/worlds.ts)",
        "",
        "---",
        "",
        "## Cíl",
        "",
        "Každý soubor `.md` popisuje jeden svět. Může to být:",
        "",
        "- hvězdný systém,",
        "- planeta / herní žánr,",
        "- filmový / kulturní sektor,",
        "- dimenze / časová linie / hráčský svět.",
        "",
        "Cílem je maximálně rozvinout možnosti OASIS multiverse — každý svět má svou atmosféru, obyvatele, mechaniky, questy a vztah k honbě za Zlatým vejcem.",
        "",
        "---",
        "",
        "## Struktura souborů",
        "",
        "Pro nové světy použij šablonu [`TEMPLATE.md`](TEMPLATE.md).",
        "",
        "---",
        "",
        "## Kategorie světů",
        "",
    ]

    for cat in ["star-system", "planet", "sector", "world", "dimension"]:
        title = category_titles[cat]
        lines.append(f"### {title}")
        for e in sorted(grouped.get(cat, []), key=lambda x: x["id"]):
            lines.append(f"- [`{e['id']}.md`]({e['id']}.md) — {e['name']}")
        lines.append("")

    lines.extend([
        "---",
        "",
        "> **Toto je živý index.** Světy se budou neustále přidávat. Každý soubor má být samostatný koncept, který se dá později převést do `src/domain/config/worlds.ts` a UE5. Tento index se regeneruje skriptem `APP&WEB/OasisWeb/scripts/generate-worlds-config.py`.",
        "",
    ])

    README_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"[ok] wrote {README_FILE}")


if __name__ == "__main__":
    generate()
    generate_readme(parse_md(p) for p in sorted(MD_DIR.glob("*.md")) if p.name not in SKIP_FILES)
