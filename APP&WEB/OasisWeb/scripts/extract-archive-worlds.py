#!/usr/bin/env python3
"""
Extract `World` objects from OASIS archive markdowns.
Outputs one JSON partial per source directory to
APP&WEB/OasisWeb/scripts/worlds-extract/parts/.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / "docs" / "docs2.9" / "ZION_OASIS"
OUT_DIR = ROOT / "APP&WEB" / "OasisWeb" / "scripts" / "worlds-extract" / "parts"


def strip_emoji(text: str) -> str:
    # remove most emoji and unusual symbols, keep letters/numbers/punctuation
    text = re.sub(r"[^\w\s\-'/—–:,.!?()&]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_name(title: str, file_id: str) -> str:
    title = strip_emoji(title)
    # remove leading number like "202. "
    title = re.sub(r"^\d+\.\s*", "", title)
    # split on — or :
    for sep in [" — ", "–", "-", ":"]:
        if sep in title:
            parts = title.split(sep, 1)
            if len(parts[0].strip()) > 3:
                return parts[0].strip()
    return title.title()


def to_id(file_id: str) -> str:
    # remove leading number and .md
    fid = re.sub(r"^\d+_", "", file_id)
    fid = re.sub(r"\.(md|MD)$", "", fid)
    fid = re.sub(r"[^A-Za-z0-9]+", "_", fid).strip("_").upper()
    return fid


def extract_section(body: str, header: str) -> str:
    pat = re.compile(rf"##\s*{re.escape(header)}\s*\n(.*?)(?:\n---|\n## |\Z)", re.S | re.I)
    m = pat.search(body)
    if m:
        return m.group(1).strip()
    return ""


def find_json_block(body: str) -> dict:
    m = re.search(r"```json\s*(.*?)\s*```", body, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return {}
    return {}


def infer_layer(category: str, cl_range: list | None, body: str) -> int:
    if cl_range and isinstance(cl_range, list) and len(cl_range) == 2:
        lo, hi = cl_range
        if isinstance(hi, (int, float)):
            if hi <= 2:
                return 1
            if hi <= 4:
                return 2
            if hi <= 6:
                return 3
            if hi <= 8:
                return 4
            return 5
    b = body.lower()
    if category == "star-system":
        return 1
    if "vrstva 5" in b or "layer 5" in b or "creative" in b or "kreativ" in b:
        return 5
    if "vrstva 4" in b or "layer 4" in b or "mythic" in b or "mýtick" in b or "etheric" in b:
        return 4
    if "vrstva 3" in b or "layer 3" in b or "temporal" in b or "časová" in b:
        return 3
    if "vrstva 2" in b or "layer 2" in b or "inner" in b:
        return 2
    if "vrstva 1" in b or "layer 1" in b:
        return 1
    return 3


def infer_category(body: str, title: str, file_id: str, tech: dict) -> str:
    b = (body + " " + title + " " + file_id).lower()
    if tech.get("category"):
        return tech["category"]
    if any(k in b for k in ["star system", "hvězdný systém", "hviezdna", "pleiades", "stellar", "sun", "star-system"]):
        return "star-system"
    if any(k in b for k in ["planeta", "planet", "gaia", "earth", "mars", "luna", "moon", "fyzick"]):
        return "planet"
    if any(k in b for k in ["sektor", "sector", "space opera", "space-opera", "space station"]):
        return "sector"
    if any(k in b for k in ["dimenze", "dimension", "časová linie", "realita", "timeline", "realm"]):
        return "dimension"
    return "dimension"


def find_clue(body: str) -> int | None:
    for pat in [r"clue\s*#\s*(\d+)", r"stopa\s*#\s*(\d+)", r"avatar\s*#\s*(\d+)", r"č\.\s*(\d+)", r"#\s*(\d+)"]:
        m = re.search(pat, body, re.I)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 108:
                return n
    return None


def parse_sacred_trinity(path: Path) -> dict | None:
    file_id = path.stem
    if file_id.upper() == "README":
        return None
    body = path.read_text(encoding="utf-8")
    lines = body.splitlines()
    title = ""
    for line in lines:
        if line.startswith("# "):
            title = line[2:].strip()
            break

    if not title:
        return None

    wid = to_id(file_id)
    name = clean_name(title, file_id)
    tech = find_json_block(body)

    essence = extract_section(body, r"🌟\s*ESENCE")
    if not essence:
        essence = extract_section(body, r"🌟\s*Kdo jsi TY")
    if not essence:
        # fall back to first non-empty paragraph after title
        paras = re.split(r"\n\s*\n", body)
        for p in paras[1:]:
            p = p.strip()
            if p and not p.startswith(">"):
                essence = p
                break

    role = extract_section(body, r"🎮\s*ROLE V ZION OASIS")
    if not role:
        role = extract_section(body, r"🎯.*")

    # location
    location = ""
    if tech.get("location_oasis"):
        location = strip_emoji(tech["location_oasis"])
    if not location:
        m = re.search(r"[Ll]okace:\s*([^\n]+)", role + "\n" + body)
        if m:
            location = strip_emoji(m.group(1))
    if not location:
        m = re.search(r"[Nn]ation:\s*([^\n]+)", body)
        if m:
            location = strip_emoji(m.group(1))
    if not location:
        location = "OASIS archive realm"

    # summary from essence or role
    summary = essence
    if len(summary) < 60 and role:
        summary = role + " " + summary
    summary = re.sub(r"\*\*", "", summary)
    summary = re.sub(r"\s+", " ", summary).strip()
    if len(summary) > 300:
        summary = summary[:297] + "..."

    # vibe from essence first sentence or first strong line
    vibe = summary
    m = re.search(r"^(.*?)(?:[.!?])(?=\s)", essence)
    if m:
        vibe = m.group(1).strip()
        if not vibe.endswith("."):
            vibe += "."
    vibe = strip_emoji(vibe)
    if len(vibe) > 140:
        vibe = vibe[:137] + "..."

    category = infer_category(body, title, file_id, tech)
    layer = infer_layer(category, tech.get("cl_range"), body)

    tags = [category.replace("-", " ")]
    if tech.get("circle"):
        tags.append(tech["circle"].lower().replace(" ", "-"))
    if tech.get("nation"):
        nation = re.sub(r"[^\w,/-]", "", tech["nation"]).lower()
        for n in re.split(r"[,/]", nation):
            n = n.strip().replace(" ", "-")
            if n and n not in tags:
                tags.append(n)
    tags.append(f"layer {layer}")

    clue = find_clue(body)

    world = {
        "id": wid,
        "name": name,
        "category": category,
        "layer": layer,
        "location": location,
        "vibe": vibe,
        "summary": summary,
        "tags": tags,
    }
    if clue:
        world["goldenEggClue"] = clue
    return world


def parse_golden_egg(path: Path) -> list[dict]:
    """One world per top-level section."""
    body = path.read_text(encoding="utf-8")
    file_id = path.stem
    entries = []
    # Top-level concept is the file itself
    title = ""
    for line in body.splitlines():
        if line.startswith("# "):
            title = line[2:].strip()
            break
    if not title:
        title = file_id

    wid = to_id(file_id)
    name = clean_name(title, file_id)
    summary = re.sub(r"\*\*", "", body.split("\n\n")[0] if body else "")
    summary = re.sub(r"\s+", " ", summary).strip()[:300]
    if not summary:
        summary = f"A foundational concept of the Golden Egg hunt from {name}."
    vibe = (summary[:137] + "...") if len(summary) > 137 else summary

    world = {
        "id": wid,
        "name": name,
        "category": "world",
        "layer": 3,
        "location": "Golden Egg archive",
        "vibe": vibe,
        "summary": summary,
        "tags": ["golden egg", "layer 3"],
    }
    clue = find_clue(body)
    if clue:
        world["goldenEggClue"] = clue
    entries.append(world)

    # Also create one world per ## heading
    sections = re.findall(r"^##\s+(.+)$", body, re.M)
    seen = {wid}
    for i, sec in enumerate(sections[:12]):
        sname = strip_emoji(sec)
        if not sname:
            continue
        sid = to_id(re.sub(r"[^A-Za-z0-9]+", "_", sname).strip("_"))
        if not sid or sid in seen:
            sid = f"{wid}_{i+1}"
        seen.add(sid)
        sec_body = re.search(rf"##\s*{re.escape(sec)}\s*\n(.*?)(?:\n## |\Z)", body, re.S)
        if sec_body:
            para = re.sub(r"\*\*", "", sec_body.group(1).strip().split("\n\n")[0])
            para = re.sub(r"\s+", " ", para).strip()[:300]
        else:
            para = f"A Golden Egg concept: {sname}."
        vibe = (para[:137] + "...") if len(para) > 137 else para
        w = {
            "id": sid,
            "name": sname.title() if sname.isupper() or sname.islower() else sname,
            "category": "dimension",
            "layer": 4,
            "location": f"Golden Egg archive — {name}",
            "vibe": vibe,
            "summary": para,
            "tags": ["golden egg", "layer 4"],
        }
        c = find_clue(sec_body.group(1) if sec_body else "")
        if c:
            w["goldenEggClue"] = c
        entries.append(w)
    return entries


def parse_cosmic_map(path: Path) -> list[dict]:
    body = path.read_text(encoding="utf-8")
    entries = []
    # each Part has a list of items; treat each as a world
    # headings like "### Pochopení Dimenzí vs Hustoty"
    for m in re.finditer(r"^###\s+(.+)$", body, re.M):
        title = strip_emoji(m.group(1))
        if not title:
            continue
        sid = to_id(re.sub(r"[^A-Za-z0-9]+", "_", title).strip("_"))
        sec = re.search(rf"###\s*{re.escape(m.group(1))}\s*\n(.*?)(?:\n### |\n## |\Z)", body, re.S)
        para = ""
        if sec:
            para = re.sub(r"\*\*", "", sec.group(1).strip().split("\n\n")[0])
            para = re.sub(r"\s+", " ", para).strip()[:300]
        if not para:
            para = f"A cosmic map concept: {title}."
        b = (title + " " + para).lower()
        if any(k in b for k in ["star system", "hviezdna", "supervesmír", "galaxi"]):
            cat = "star-system"
            layer = 1
        elif any(k in b for k in ["planeta", "zeme", "mars", "earth"]):
            cat = "planet"
            layer = 1
        elif any(k in b for k in ["dimenz", "časová", "frekven", "matrix"]):
            cat = "dimension"
            layer = 4
        else:
            cat = "world"
            layer = 3
        vibe = (para[:137] + "...") if len(para) > 137 else para
        entries.append({
            "id": sid,
            "name": title.title() if title.isupper() or title.islower() else title,
            "category": cat,
            "layer": layer,
            "location": "Cosmic Map 2.8.5",
            "vibe": vibe,
            "summary": para,
            "tags": [cat.replace("-", " "), f"layer {layer}"],
        })
    return entries


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_entries = []

    # Sacred Trinity
    st_entries = []
    for path in sorted((ARCHIVE / "SACRED_TRINITY").glob("*.md")):
        try:
            w = parse_sacred_trinity(path)
            if w:
                st_entries.append(w)
        except Exception as e:
            print(f"[warn] {path}: {e}")
    (OUT_DIR / "sacred_trinity.json").write_text(
        json.dumps(st_entries, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    all_entries.extend(st_entries)
    print(f"[ok] sacred trinity: {len(st_entries)} worlds")

    # Golden Egg
    ge_entries = []
    for path in sorted((ARCHIVE / "GOLDEN_EGG_GAME").glob("*.md")):
        try:
            ge_entries.extend(parse_golden_egg(path))
        except Exception as e:
            print(f"[warn] {path}: {e}")
    (OUT_DIR / "golden_egg.json").write_text(
        json.dumps(ge_entries, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    all_entries.extend(ge_entries)
    print(f"[ok] golden egg: {len(ge_entries)} worlds")

    # Cosmic Map
    cm_entries = parse_cosmic_map(ARCHIVE / "COSMIC_MAP_2.8.5_COMPLETE.md")
    (OUT_DIR / "cosmic_map.json").write_text(
        json.dumps(cm_entries, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    all_entries.extend(cm_entries)
    print(f"[ok] cosmic map: {len(cm_entries)} worlds")

    print(f"[ok] total archive worlds: {len(all_entries)}")


if __name__ == "__main__":
    main()
