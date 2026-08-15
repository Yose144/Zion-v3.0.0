#!/usr/bin/env python3
"""
Merge subagent-extracted world partials with existing V31/L4/oasis/data/worlds.json,
assign galaxy positions to new archive worlds, and regenerate both
- APP&WEB/OasisWeb/src/domain/config/worlds.ts
- V31/L4/oasis/data/worlds.json
"""

import json
import math
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EXISTING_JSON = ROOT / "V31" / "L4" / "oasis" / "data" / "worlds.json"
PARTS_DIR = ROOT / "APP&WEB" / "OasisWeb" / "scripts" / "worlds-extract" / "parts"
OUT_TS = ROOT / "APP&WEB" / "OasisWeb" / "src" / "domain" / "config" / "worlds.ts"
OUT_JSON = EXISTING_JSON


def ts_literal(value) -> str:
    if isinstance(value, str):
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


def safe_id(raw: str, existing: set) -> str:
    base = re.sub(r"[^A-Za-z0-9]+", "_", raw).strip("_").upper()
    if not base:
        base = "WORLD"
    candidate = base
    suffix = 2
    while candidate in existing:
        candidate = f"{base}_{suffix}"
        suffix += 1
    existing.add(candidate)
    return candidate


def clean_text(text: str) -> str:
    text = re.sub(r"[\u263a-\U0001f645]", "", text)  # rough emoji strip
    text = re.sub(r"\s+", " ", text).strip()
    return text


def assign_outer_positions(new_entries, existing_positions, seed="oasis-archive-2026-08-15"):
    """Place archive-derived worlds in an outer galactic ring (radius 30-70)."""
    rng = random.Random(seed)
    ARM_COUNT = 4
    ARM_PITCH = 0.24
    cat_bases = {
        "star-system": (40.0, 70.0, 0.35),
        "planet": (32.0, 60.0, 0.2),
        "sector": (34.0, 62.0, 0.22),
        "world": (30.0, 58.0, 0.25),
        "dimension": (36.0, 65.0, 0.3),
    }

    # deterministic arm per id
    def _arm(id_str: str) -> int:
        return sum(ord(c) * (i + 1) for i, c in enumerate(id_str)) % ARM_COUNT

    arms = [[] for _ in range(ARM_COUNT)]
    for e in new_entries:
        e["_arm"] = _arm(e["id"])
        arms[e["_arm"]].append(e)

    occupied = set()
    for arm, items in enumerate(arms):
        items.sort(key=lambda e: (cat_bases.get(e["category"], (30.0, 60.0, 1.0))[1], e["id"]))
        n = max(1, len(items))
        for j, e in enumerate(items):
            cat = e["category"]
            r_min, r_max, y_range = cat_bases.get(cat, (30.0, 60.0, 1.0))

            attempts = 0
            while attempts < 50:
                t = j / n
                r = r_min + (r_max - r_min) * (0.2 + 0.8 * t)
                r += (rng.random() - 0.5) * 2.0
                r = max(r_min, min(r_max, r))

                arm_base = arm * 2 * math.pi / ARM_COUNT
                angle = arm_base + (1 / math.tan(ARM_PITCH)) * math.log(r + 0.7)
                angle += (rng.random() - 0.5) * 0.5

                y = (rng.random() - 0.5) * y_range

                x = round(math.cos(angle) * r, 3)
                z = round(math.sin(angle) * r, 3)
                y = round(y, 3)

                # avoid existing positions and freshly assigned positions
                key = (round(x, 1), round(y, 1), round(z, 1))
                if key not in occupied:
                    occupied.add(key)
                    e["galaxyPosition"] = {"x": x, "y": y, "z": z}
                    break
                attempts += 1
            else:
                # fallback: random larger radius
                angle = rng.random() * 2 * math.pi
                r = 70 + rng.random() * 10
                e["galaxyPosition"] = {
                    "x": round(math.cos(angle) * r, 3),
                    "y": round((rng.random() - 0.5) * 0.5, 3),
                    "z": round(math.sin(angle) * r, 3),
                }
            e.pop("_arm", None)


def main():
    # Load canonical existing worlds
    existing = json.loads(EXISTING_JSON.read_text(encoding="utf-8"))
    for w in existing:
        # ensure lowercase keys used by TS (some fields may be snake in JSON?)
        if "galaxy_position" in w:
            w["galaxyPosition"] = w.pop("galaxy_position")
        if "golden_egg_clue" in w:
            w["goldenEggClue"] = w.pop("golden_egg_clue")
        if "star_system" in w:
            w["starSystem"] = w.pop("star_system")

    existing_ids = {w["id"] for w in existing}
    existing_positions = [(w["galaxyPosition"]["x"], w["galaxyPosition"]["y"], w["galaxyPosition"]["z"])
                          for w in existing if w.get("galaxyPosition")]

    # Keep existing ids as authoritative; skip new entries whose ids already exist.
    used_ids = set(existing_ids)

    new_entries = []
    for part_file in sorted(PARTS_DIR.glob("*.json")):
        try:
            data = json.loads(part_file.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                print(f"[warn] {part_file} is not a list")
                continue
            for e in data:
                if not isinstance(e, dict):
                    continue
                base_id = safe_id(e.get("id", ""), set())
                # skip if this id already exists in the canonical registry
                if base_id in existing_ids:
                    continue
                # ensure uniqueness across all loaded new entries
                if base_id in used_ids:
                    e["id"] = safe_id(base_id, used_ids)
                else:
                    e["id"] = base_id
                used_ids.add(e["id"])
                e["name"] = clean_text(e.get("name", e["id"]))
                e["vibe"] = clean_text(e.get("vibe", ""))
                e["summary"] = clean_text(e.get("summary", ""))
                e["location"] = clean_text(e.get("location", ""))
                e["tags"] = [t for t in e.get("tags", []) if t]
                if "galaxyPosition" in e:
                    del e["galaxyPosition"]
                new_entries.append(e)
        except Exception as err:
            print(f"[warn] failed to load {part_file}: {err}")

    print(f"[ok] {len(existing)} existing worlds, {len(new_entries)} new archive worlds")

    assign_outer_positions(new_entries, existing_positions)

    all_entries = existing + new_entries

    # sort for stable output
    all_entries.sort(key=lambda w: w["id"])

    # Validate
    ids = [w["id"] for w in all_entries]
    assert len(ids) == len(set(ids)), f"duplicate ids found: {ids}"

    # Write backend JSON (Rust fields: galaxyPosition/goldenEggClue camelCase,
    # star_system snake_case; everything else as-is)
    backend_entries = []
    for w in all_entries:
        be = dict(w)
        if "starSystem" in be:
            be["star_system"] = be.pop("starSystem")
        backend_entries.append(be)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(backend_entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] wrote {OUT_JSON} ({len(backend_entries)} worlds)")

    # Write frontend TS
    world_ids = [w["id"] for w in all_entries]
    star_ids = [w["id"] for w in all_entries if w.get("category") == "star-system"]

    lines = [
        "import { World } from '../types/world';",
        "",
        "/**",
        " * Engine-agnostic world registry. Auto-generated from",
        " * V31/L4/oasis/data/worlds.json via scripts/merge-archive-worlds.py",
        " */",
        "",
        "export const WORLDS: World[] = [",
    ]
    for w in all_entries:
        fields = []
        for k, v in w.items():
            if k == "tags" and not v:
                continue
            if v is None:
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

    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[ok] wrote {OUT_TS} ({len(all_entries)} worlds)")


if __name__ == "__main__":
    main()
