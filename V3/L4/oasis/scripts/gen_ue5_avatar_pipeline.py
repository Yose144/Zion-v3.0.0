#!/usr/bin/env python3
"""
UE5 Avatar DataTable Pipeline
==============================
Converts data/avatars.json → UE5-importable assets:
  1. UE5_AvatarDataTable.csv    → Import as DataTable (FAvatarRow)
  2. UE5_AvatarTypes.h         → Drop into Source/ZionOasis/Avatar/
  3. UE5_AvatarQuestTable.csv   → Import as DataTable (FAvatarQuestRow)

Usage:
  python scripts/gen_ue5_avatar_pipeline.py
"""

import json
import csv
import re
import sys
from pathlib import Path

# Resolve paths relative to this script
SCRIPT_DIR = Path(__file__).resolve().parent
OASIS_DIR = SCRIPT_DIR.parent
DATA_DIR = OASIS_DIR / "data"
OUT_DIR = OASIS_DIR / "ue5" / "Content" / "DataTables"
SRC_DIR = OASIS_DIR / "ue5" / "Source" / "ZionOasis" / "Avatar"

def to_enum_name(name: str) -> str:
    """Convert avatar name to a valid C++ enum identifier."""
    s = re.sub(r"[^A-Za-z0-9 ]", "", name)
    s = re.sub(r"\s+", "", s)
    # CamelCase
    return s

def to_ue_fstring(text: str) -> str:
    """Escape double quotes for FString / FText literals."""
    return text.replace('"', '""')

def ray_to_enum(ray: str) -> str:
    mapping = {
        "Blue": "Blue",
        "Yellow": "Yellow",
        "Pink": "Pink",
        "White": "White",
        "Green": "Green",
        "Ruby": "Ruby",
        "Violet": "Violet",
        "AllRays": "AllRays",
        "Golden": "Golden",
        "Silver": "Silver",
    }
    return mapping.get(ray, "Blue")

def rarity_to_enum(rarity: str) -> str:
    mapping = {
        "Common": "Common",
        "Uncommon": "Uncommon",
        "Rare": "Rare",
        "Epic": "Epic",
        "Legendary": "Legendary",
        "1/1": "OneOfOne",
        "1/1 — Unique": "OneOfOne",
    }
    return mapping.get(rarity, "Rare")

def cl_to_enum(level: int) -> str:
    levels = [
        "Physical",      # 1
        "Emotional",     # 2
        "Mental",        # 3
        "Intuitional",   # 4
        "Spiritual",     # 5
        "Cosmic",        # 6
        "Divine",        # 7
        "Unity",         # 8
        "OnTheStar",     # 9
    ]
    idx = max(1, min(level, 9)) - 1
    return levels[idx]

def generate_csv(avatars):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / "UE5_AvatarDataTable.csv"

    fieldnames = [
        "Name",
        "AvatarID",
        "DisplayName",
        "Title",
        "Teaching",
        "SpecialAbilityName",
        "SpecialAbilityDesc",
        "MinConsciousnessLevel",
        "Ray",
        "Rarity",
        "RegionName",
        "QuestCount",
        "TotalQuestXpReward",
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for av in avatars:
            enum_name = to_enum_name(av["name"])
            ability = av.get("ability", "")
            # Split ability into name and description if it contains " - "
            if " - " in ability:
                ability_name, ability_desc = ability.split(" - ", 1)
                ability_name = ability_name.strip().strip("*")
                ability_desc = ability_desc.strip()
            else:
                ability_name = ability.strip().strip("*")
                ability_desc = ""

            writer.writerow({
                "Name": av["id"],
                "AvatarID": f"(Value=\"{enum_name}\")",
                "DisplayName": f'"{to_ue_fstring(av["name"])}"',
                "Title": f'"{to_ue_fstring(av.get("subtitle", ""))}"',
                "Teaching": f'"{to_ue_fstring(av.get("teaching", ""))}"',
                "SpecialAbilityName": f'"{to_ue_fstring(ability_name)}"',
                "SpecialAbilityDesc": f'"{to_ue_fstring(ability_desc)}"',
                "MinConsciousnessLevel": f'(Value="{cl_to_enum(av.get("consciousness_level_required", 1))}")',
                "Ray": f'(Value="{ray_to_enum(av.get("ray", "Blue"))}")',
                "Rarity": f'(Value="{rarity_to_enum(av.get("rarity", "Rare"))}")',
                "RegionName": f'"{to_ue_fstring(av.get("location", ""))}"',
                "QuestCount": len(av.get("quests", [])),
                "TotalQuestXpReward": len(av.get("quests", [])) * 500,  # approx 500 XP per quest
            })

    print(f"[+] Generated {csv_path}")

def generate_quest_csv(avatars):
    csv_path = OUT_DIR / "UE5_AvatarQuestTable.csv"
    fieldnames = [
        "Name",
        "AvatarEnum",
        "QuestIndex",
        "QuestTitle",
        "QuestDescription",
        "XpReward",
    ]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        row_idx = 0
        for av in avatars:
            enum_name = to_enum_name(av["name"])
            quests = av.get("quests", [])
            for i, q in enumerate(quests):
                writer.writerow({
                    "Name": row_idx,
                    "AvatarEnum": f'(Value="{enum_name}")',
                    "QuestIndex": i,
                    "QuestTitle": f'"{to_ue_fstring(q.get("title", ""))}"',
                    "QuestDescription": f'"{to_ue_fstring(q.get("description", ""))}"',
                    "XpReward": 500,
                })
                row_idx += 1

    print(f"[+] Generated {csv_path}")

def generate_enum_header(avatars):
    """Update EAvatarID enum inside AvatarTypes.h between markers."""
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    header_path = SRC_DIR / "AvatarTypes.h"

    if not header_path.exists():
        print(f"[-] Missing {header_path}", file=sys.stderr)
        sys.exit(1)

    with open(header_path, "r", encoding="utf-8") as f:
        original = f.read().splitlines()

    begin_marker = "// === GENERATED EAvatarID BEGIN"
    end_marker = "// === GENERATED EAvatarID END ==="

    begin_idx = -1
    end_idx = -1
    for i, line in enumerate(original):
        if begin_marker in line:
            begin_idx = i
        elif end_marker in line:
            end_idx = i
            break

    if begin_idx == -1 or end_idx == -1:
        print(f"[-] Markers not found in {header_path}", file=sys.stderr)
        sys.exit(1)

    enum_lines = []
    for av in avatars:
        enum_name = to_enum_name(av["name"])
        display = av["name"].replace('"', '\\"')
        enum_lines.append(f'\t{enum_name:<32} = {av["id"]:<3} UMETA(DisplayName = "{display}"),')

    new_lines = (
        original[:begin_idx + 1]
        + enum_lines
        + original[end_idx:]
    )

    with open(header_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines))

    # Remove stale standalone generated header if it exists.
    stale_path = SRC_DIR / "UE5_AvatarTypes.h"
    if stale_path.exists():
        stale_path.unlink()

    print(f"[+] Updated EAvatarID in {header_path} ({len(avatars)} entries)")

def main():
    avatars_json = DATA_DIR / "avatars.json"
    if not avatars_json.exists():
        print(f"[-] Missing {avatars_json}", file=sys.stderr)
        sys.exit(1)

    with open(avatars_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    avatars = data.get("avatars", [])
    if not avatars:
        print("[-] No avatars found in JSON", file=sys.stderr)
        sys.exit(1)

    generate_csv(avatars)
    generate_quest_csv(avatars)
    generate_enum_header(avatars)

    print(f"\n[*] Pipeline complete — {len(avatars)} avatars processed.")

if __name__ == "__main__":
    main()
