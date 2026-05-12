#!/usr/bin/env python3
"""
Build a deterministic V3/Rust/orchestrator fine-tune corpus for Hiranyagarbha v2.

This does not call any external LLM API. It converts current V3 docs and Rust
source into grounded chat examples that teach paths, commands, symbols, and
operator workflows without inventing facts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


# Legacy repo layout shipped tiny „pointer“ files (`shards/foo.jsonl` on one line) — skip them.
POINTER_LINE_RE = re.compile(r"^shards/[\w._-]+\.jsonl\s*$")


def load_jsonl_conversations(path: Path) -> list[dict]:
    """Load chat turns from JSONL; ignore empty lines and stray non‑JSON junk."""
    if not path.is_file():
        return []
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError:
        return []
    stripped = raw.strip()
    if not stripped:
        return []
    lines = stripped.splitlines()
    if len(lines) == 1 and POINTER_LINE_RE.fullmatch(lines[0].strip() or ""):
        return []

    loaded: list[dict] = []
    for ln in raw.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            loaded.append(normalize_system_prompt(json.loads(ln)))
        except json.JSONDecodeError:
            continue
    return loaded


SYSTEM_PROMPT = (
    "Jsi Hiranyagarbha v2 — ZION AI Native agent a operátorský orchestrátor. "
    "Kanonický mainnet kód je ve V3/. Umíš pomáhat s Rust programováním, čtením "
    "crate zion-core/zion-pool/zion-miner/L2/L3, příkazy zion CLI, Docker deployem "
    "a novou V3 dokumentací. Legacy stromy mimo V3 ber jako referenci, ne jako "
    "primární pravdu. Odpovídej česky, technicky a drž se zdrojů."
)

DOC_ROOTS = [
    "AGENTS.md",
    "StatusV3.md",
    "HIRANYAGARBHA_UPGRADE_PLAN.md",
    "V3/README.md",
    "V3/ROADMAP.md",
    "V3/docs",
    "V3/docker",
    ".github/copilot-instructions.md",
    ".github/instructions/v3-mainnet.instructions.md",
]

RUST_ROOTS = [
    "V3/cli/src",
    "V3/L1/core/src",
    "V3/L1/miner/src",
    "V3/L1/pool/src",
    "V3/L1/cosmic-harmony/src",
    "V3/L1/native-ffi",
    "V3/L2",
    "V3/L3",
    "V3/sdk",
]

INCLUDE_DOC_EXT = {".md", ".toml", ".yml", ".yaml", ".json", ".example"}
SYMBOL_RE = re.compile(
    r"(?m)^\s*(?:pub\s+)?(?:async\s+)?(?:fn|struct|enum|trait|impl)\s+([A-Za-z_][A-Za-z0-9_]*)"
)


def chat(user: str, assistant: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user.strip()},
            {"role": "assistant", "content": assistant.strip()},
        ]
    }


def normalize_system_prompt(entry: dict) -> dict:
    messages = list(entry.get("messages", []))
    if not messages:
        return entry
    if messages[0].get("role") == "system":
        messages[0] = {"role": "system", "content": SYSTEM_PROMPT}
    else:
        messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
    return {"messages": messages}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def iter_files(project: Path, roots: list[str], exts: set[str] | None = None):
    seen: set[Path] = set()
    for root in roots:
        path = project / root
        if not path.exists():
            continue
        candidates = [path] if path.is_file() else sorted(path.rglob("*"))
        for file in candidates:
            if not file.is_file() or file in seen:
                continue
            if any(part.startswith(".") and part != ".github" for part in file.relative_to(project).parts):
                continue
            if exts is not None and file.suffix not in exts and not any(str(file).endswith(ext) for ext in exts):
                continue
            seen.add(file)
            yield file


def chunks(text: str, max_chars: int = 2600) -> list[str]:
    blocks = re.split(r"\n{2,}", text.strip())
    out: list[str] = []
    cur = ""
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        if len(cur) + len(block) + 2 <= max_chars:
            cur = f"{cur}\n\n{block}".strip()
        else:
            if cur:
                out.append(cur)
            cur = block[-max_chars:] if len(block) > max_chars else block
    if cur:
        out.append(cur)
    return [c for c in out if len(c) > 180]


def heading_for(chunk: str, fallback: str) -> str:
    for line in chunk.splitlines():
        if line.startswith("#"):
            return line.strip("# ").strip()[:120]
    return fallback


def doc_examples(project: Path, limit_per_file: int) -> list[dict]:
    examples: list[dict] = []
    for file in iter_files(project, DOC_ROOTS, INCLUDE_DOC_EXT):
        rel = str(file.relative_to(project))
        text = read_text(file)
        for idx, chunk in enumerate(chunks(text)[:limit_per_file], start=1):
            topic = heading_for(chunk, f"část {idx}")
            answer = (
                f"Zdroj: `{rel}`\n\n"
                f"Relevantní V3 kontext k tématu **{topic}**:\n\n"
                f"{chunk}\n\n"
                "Pro agenta platí: odpověď má vycházet z tohoto kanonického zdroje; "
                "pokud je zdroj ve `V3/`, má přednost před legacy dokumenty."
            )
            examples.append(chat(f"Co říká aktuální ZION/V3 dokumentace `{rel}` o tématu `{topic}`?", answer))
    return examples


def symbol_window(text: str, start: int, max_chars: int = 2600) -> str:
    before = text.rfind("\n\n", 0, start)
    before = 0 if before == -1 else before + 2
    return text[before : before + max_chars].strip()


def rust_examples(project: Path, limit_per_file: int) -> list[dict]:
    examples: list[dict] = []
    for file in iter_files(project, RUST_ROOTS, {".rs", ".toml"}):
        rel = str(file.relative_to(project))
        text = read_text(file)
        if file.suffix == ".toml":
            excerpt = text[:2200].strip()
            if excerpt:
                examples.append(
                    chat(
                        f"Jakou roli má manifest `{rel}` ve V3 Rust workspace?",
                        (
                            f"Zdroj: `{rel}`\n\n"
                            "Tento manifest patří do kanonické V3 Rust linie. Při práci s kódem "
                            "používej `cargo` přes `--manifest-path V3/Cargo.toml`, pokud není důvod "
                            "kontrolovat jen dílčí crate.\n\n"
                            f"```toml\n{excerpt}\n```"
                        ),
                    )
                )
            continue

        matches = list(SYMBOL_RE.finditer(text))
        for match in matches[:limit_per_file]:
            symbol = match.group(1)
            excerpt = symbol_window(text, match.start())
            examples.append(
                chat(
                    f"Vysvětli V3 Rust symbol `{symbol}` v souboru `{rel}` a jak k němu přistupovat při programování.",
                    (
                        f"Zdroj: `{rel}`\n\n"
                        f"`{symbol}` je symbol v kanonické V3 Rust části projektu. Při úpravách zachovej lokální "
                        "styl, napiš cílené testy v příslušném crate a ověř aspoň `cargo check --manifest-path "
                        "V3/Cargo.toml --workspace`, pokud změna zasahuje více modulů.\n\n"
                        f"```rust\n{excerpt}\n```"
                    ),
                )
            )
    return examples


def fixed_orchestrator_examples() -> list[dict]:
    return [
        chat(
            "Jsi můj ZION programovací agent. Jaký je tvůj pracovní postup pro změny ve V3 Rust repo?",
            (
                "Nejdřív beru `V3/` jako kanonický mainnet workspace a legacy kořeny `L1/`, `L2/`, `L3/` jen jako "
                "referenci. Najdu konkrétní crate (`zion-core`, `zion-pool`, `zion-miner`, L2/L3 služba nebo "
                "`V3/cli`), přečtu okolní kód, upravím jen potřebné soubory, a ověřím cíleně. Základní kontrola je "
                "`cargo check --manifest-path V3/Cargo.toml --workspace`; pro testy `cargo test --manifest-path "
                "V3/Cargo.toml -p <crate>` nebo workspace test podle rizika."
            ),
        ),
        chat(
            "Jaké příkazy zion CLI máš znát jako orchestrátor?",
            (
                "Jako orchestrátor znám `zion` / `zion menu` pro interaktivní launcher, `zion doctor` pro preflight, "
                "`zion status` pro stav stacku, `zion logs <service>` pro služby jako `node`, `pool`, `miner`, "
                "`ai-native`, `bridge`, `dao`, a deploy příkazy pro compose-managed server. Důležité rozlišení: "
                "`zion update` aktualizuje lokální CLI binárku, zatímco `zion deploy update` míří na vzdálené "
                "kontejnery."
            ),
        ),
        chat(
            "Kde hledat pravdu pro AI Native a Hiranyagarbha v2?",
            (
                "Aktuální implementační pravdu hledej ve `V3/L3/ai-native/`, zejména modulech jako "
                "`hiranyagarbha.rs`, `consciousness_engine.rs`, `llm_backend.rs` a `lib.rs`. Dokumentační a provozní "
                "pravdu doplňuj z `V3/docs`, `AGENTS.md`, `StatusV3.md` a `HIRANYAGARBHA_UPGRADE_PLAN.md`. Starší "
                "`L3/ai-native/` je migrační/reference kontext."
            ),
        ),
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=".", help="Project root")
    parser.add_argument(
        "--base",
        default="",
        help="Optional NIM / external JSONL to prepend (chat format). Empty = try canonical shard paths.",
    )
    parser.add_argument(
        "--output",
        default="HiranV2.1/data/shards/zion_train_hiran_v2.jsonl",
        help="Dest shard (PLAN v2.1: under HiranV2.1/data/shards/)",
    )
    parser.add_argument(
        "--doc-chunks",
        type=int,
        default=14,
        help="Max grounded doc chunks per file (higher = larger, more robust SFT)",
    )
    parser.add_argument(
        "--rust-symbols",
        type=int,
        default=22,
        help="Max Rust symbol windows per source file",
    )
    args = parser.parse_args()

    project = Path(args.project).resolve()
    output = project / args.output
    output.parent.mkdir(parents=True, exist_ok=True)

    all_examples: list[dict] = []
    base_candidates: list[Path] = []
    if args.base.strip():
        base_candidates.append(project / args.base)
    else:
        base_candidates.extend(
            [
                project / "HiranV2.1/data/shards/zion_train.jsonl",
                project / "HiranV2.1/finetune/data/zion_train.jsonl",
            ]
        )
    base_block: list[dict] = []
    loaded_from: Path | None = None
    for bp in base_candidates:
        ex = load_jsonl_conversations(bp)
        if ex:
            base_block = ex
            loaded_from = bp
            break

    if not base_block:
        print(
            "[build_v3_orchestrator] No base JSONL loaded (collect_dataset / NIM path missing or empty — "
            "continuing from deterministic V3 docs + Rust only)",
            file=sys.stderr,
        )
    elif loaded_from is not None:
        print(
            f"[build_v3_orchestrator] Prepended {len(base_block)} base examples "
            f"from {loaded_from.relative_to(project)}",
            file=sys.stderr,
        )

    all_examples.extend(base_block)
    all_examples.extend(fixed_orchestrator_examples())
    all_examples.extend(doc_examples(project, args.doc_chunks))
    all_examples.extend(rust_examples(project, args.rust_symbols))

    with output.open("w", encoding="utf-8") as f:
        for item in all_examples:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Wrote {len(all_examples)} examples → {output.relative_to(project)}")


if __name__ == "__main__":
    main()
