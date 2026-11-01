#!/usr/bin/env python3
"""
V3 crates curriculum builder — docstringy a CLI příkazy z V31 workspace
do messages-format tréninkových párů (čeština, persona Hiranyagarbha).

Největší coverage gap z HIRAN-FULL-TRAINING-PREP.md §3. Zdroje:
- `//!` modul docs v lib.rs/main.rs → "k čemu je crate X"
- `///` doc bloky před pub items → "co dělá fn/struct/enum X v crate Y"
- cli/src/commands/*.rs → "co dělá příkaz zion <name>" (doc + usage)
- workspace struktura → "jak je V31 uspořádán", "co patří do L<n>"

Pravidla: odpověď = jen obsah, co je fakticky v kódu/docs (žádná generace).
Bez docstringu žádný pár — radši méně než halucinace. Dedup přes odpověď.

Použití:
  python3 build_v3_curriculum.py --root V31 --out v3-crates.jsonl [--max 600]
"""

import argparse
import json
import re
from pathlib import Path

SYSTEM_PROMPT = (
    "Jsi Hiranyagarbha — ZION blockchain expert, AI Native agent a operátorský orchestrátor. "
    "Kanonický kód je ve **V3/** (Rust: zion-core, zion-pool, zion-miner, L2/L3 služby, V3/L3/ai-native). "
    "Znáš Ekam Deeksha PoW, konsensus, pool protokol, příkazy **zion** CLI (doctor, status, logs, deploy) a dokumentaci v **V3/docs**. "
    "Legacy stromy mimo V3/ ber jako referenci. Odpovídáš přesně, technicky, v češtině (identifikátory v angličtině)."
)

MAX_ANSWER = 1100
MIN_DOC = 40

Q_CRATE = [
    "K čemu slouží crate `{n}` ve V31 workspace?",
    "Co obsahuje `{n}` a kam ve V31 patří?",
    "Jaká je role `{n}` v ZION stacku?",
]
Q_ITEM = [
    "Co dělá `{k} {n}` v `{c}`?",
    "K čemu je `{n}` z `{c}`?",
    "Popiš `{k} {n}` z `{c}`.",
]
Q_CMD = [
    "Co dělá příkaz `zion {n}`?",
    "K čemu slouží `zion {n}` a jak se používá?",
    "Popiš příkaz `zion {n}`.",
]

ITEM_KINDS = ("pub fn", "pub async fn", "pub struct", "pub enum", "pub trait",
              "pub mod", "pub const", "pub type", "pub(crate) fn", "fn")
SIG_RE = re.compile(
    r"^\s*(?:pub(?:\(crate\))?\s+)?(?:async\s+)?(fn|struct|enum|trait|mod|const|type|impl)\s+([A-Za-z_][A-Za-z0-9_]*)")


def doc_block(lines: list[str], i: int) -> tuple[str, int]:
    """Posbírá /// blok od indexu i. Vrací (text, next_i)."""
    out = []
    while i < len(lines) and lines[i].lstrip().startswith("///"):
        out.append(re.sub(r"^\s*///\s?", "", lines[i]))
        i += 1
    return "\n".join(out).strip(), i


def module_doc(text: str) -> str:
    out = []
    for ln in text.splitlines():
        s = ln.strip()
        if s.startswith("//!"):
            out.append(s[3:].strip())
        elif s.startswith("#!") or s == "" or s.startswith("//"):
            continue
        else:
            break
    return "\n".join(out).strip()


def items_with_docs(text: str):
    """Yield (kind, name, doc) pro /// blok následovaný item signaturou."""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        if lines[i].lstrip().startswith("///"):
            doc, j = doc_block(lines, i)
            # přeskoč atributy mezi doc a item
            k = j
            while k < len(lines) and (lines[k].strip().startswith("#[") or not lines[k].strip()):
                k += 1
            if k < len(lines):
                m = SIG_RE.match(lines[k])
                if m and len(doc) >= MIN_DOC:
                    yield m.group(1), m.group(2), doc
            i = j
        else:
            i += 1


def crate_name(cargo_toml: Path) -> str | None:
    m = re.search(r'^name\s*=\s*"([^"]+)"', cargo_toml.read_text(encoding="utf-8", errors="replace"), re.M)
    return m.group(1) if m else None


def trim(a: str) -> str:
    if len(a) <= MAX_ANSWER:
        return a
    cut = a[:MAX_ANSWER]
    for sep in ("\n\n", ". ", "\n- ", "\n"):
        idx = cut.rfind(sep)
        if idx > MAX_ANSWER * 0.6:
            return cut[: idx + len(sep)].strip()
    return cut.strip() + "…"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="V31")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max", type=int, default=600)
    args = ap.parse_args()

    root = Path(args.root)
    ws = (root / "Cargo.toml").read_text(encoding="utf-8", errors="replace")
    members = re.findall(r'"([^"]+)"', ws.split("members = [")[1].split("]")[0])

    pairs: list[dict] = []
    seen: set = set()

    def add(user: str, answer: str, source: str) -> None:
        if len(pairs) >= args.max or len(answer) < MIN_DOC:
            return
        answer = trim(answer)
        key = answer[:180]
        if key in seen:
            return
        seen.add(key)
        pairs.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user},
                {"role": "assistant", "content": answer}],
            "metadata": {"source": source, "builder": "v3_crates"}})

    # 1) workspace-level páry
    layers: dict[str, list[str]] = {}
    for m in members:
        layer = m.split("/")[0] if "/" in m else "(root)"
        layers.setdefault(layer, []).append(m)
    overview = "V31 workspace (ZION Mainnet Beta 3.2.0) má tyto vrstvy a craty:\n\n" + "\n".join(
        f"- **{layer}**: {', '.join(sorted(set(cr)))}" for layer, cr in sorted(layers.items()))
    add("Jak je strukturován V31 workspace a které craty obsahuje?", overview, "workspace")
    for layer, cr in sorted(layers.items()):
        if layer.startswith("L"):
            add(f"Které craty patří do {layer} ve V31?",
                f"Do {layer} patří: {', '.join(sorted(set(cr)))}. "
                f"Vrstva {'L1 = node/miner/pool core chain logika' if layer=='L1' else layer+': viz struktura workspace a V3/docs pro detail.' if layer!='L1' else ''}".rstrip(),
                f"workspace/{layer}")

    # 2) CLI příkazy — user-facing, priorita před crate items
    cmd_dir = root / "cli/src/commands"
    if cmd_dir.exists():
        for rs in sorted(cmd_dir.glob("*.rs")):
            if rs.stem == "mod":
                continue
            cmd = rs.stem.replace("_", "-")
            text = rs.read_text(encoding="utf-8", errors="replace")
            desc = module_doc(text)
            if not desc:
                for _, _, doc in items_with_docs(text):
                    desc = doc
                    break
            if desc:
                add(Q_CMD[len(pairs) % len(Q_CMD)].format(n=cmd), desc, str(rs))
            # varianty enumů = subcommandy: /// doc před `Login {` / `Logout,`
            lines = text.splitlines()
            for i, ln in enumerate(lines):
                if not ln.lstrip().startswith("///"):
                    continue
                doc, j = doc_block(lines, i)
                k = j
                while k < len(lines) and (lines[k].strip().startswith("#[") or not lines[k].strip()):
                    k += 1
                if k >= len(lines):
                    continue
                m = re.match(r"^\s*([A-Z][A-Za-z0-9_]*)\s*[,{]", lines[k])
                if m and len(doc) >= MIN_DOC:
                    add(f"Co dělá `zion {cmd} {m.group(1).lower()}`?",
                        doc + f"\n\n(subcommand `zion {cmd}`)", str(rs))

    # 3) per-crate: modul docs + items docs
    for member in members:
        cdir = root / member
        cname_t = cdir / "Cargo.toml"
        if not cname_t.exists():
            continue
        cname = crate_name(cname_t) or member.replace("/", "-")
        src = cdir / "src"
        if not src.exists():
            continue
        entry = src / ("lib.rs" if (src / "lib.rs").exists() else "main.rs")
        if entry.exists():
            mdoc = module_doc(entry.read_text(encoding="utf-8", errors="replace"))
            if mdoc:
                add(Q_CRATE[len(pairs) % len(Q_CRATE)].format(n=cname),
                    f"`{cname}` (`{member}`):\n\n{mdoc}", str(entry))
        # docstringy itemů napříč soubory (cap per crate — vyváženost)
        per_crate = 0
        for rs in sorted(src.rglob("*.rs")):
            if per_crate > 40:
                break
            for kind, name, doc in items_with_docs(rs.read_text(encoding="utf-8", errors="replace")):
                if name.startswith("_") or name in ("new", "default", "fmt", "clone", "main"):
                    continue
                add(Q_ITEM[len(pairs) % len(Q_ITEM)].format(k=kind, n=name, c=cname),
                    doc + f"\n\n(`{cname}/{rs.relative_to(cdir)}`)", str(rs))
                per_crate += 1

    with open(args.out, "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"OK -> {args.out}: {len(pairs)} párů")


if __name__ == "__main__":
    main()
