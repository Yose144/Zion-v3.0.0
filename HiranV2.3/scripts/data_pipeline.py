#!/usr/bin/env python3
"""
Hiran v2.3 Data Pipeline
=========================
Collects, processes, validates, and curates training data from all ZION sources.
Stages: collection → processing → curriculum → validation → export

Usage:
    python scripts/data_pipeline.py --stage collection
    python scripts/data_pipeline.py --stage processing
    python scripts/data_pipeline.py --stage curriculum
    python scripts/data_pipeline.py --stage all

Environment:
    OPENAI_API_KEY        - For synthetic Q&A generation (optional)
    HUGGINGFACE_TOKEN     - For downloading base datasets (optional)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
V3_DIR = REPO_ROOT / "V3"
DOCS_DIR = REPO_ROOT / "docs"
OASIS_DIR = REPO_ROOT / "L4" / "oasis"
HIRAN_V2_1 = REPO_ROOT / "HiranV2.1"
HIRAN_V2_2 = REPO_ROOT / "HiranV2.2"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUTPUT_DIR = DATA_DIR / "curriculum"

STAGE_CONFIG = {
    "foundation_domain_adaptation": {
        "target_tokens": 100_000_000,
        "sources": ["v3_docs", "roadmap", "status", "whitepaper", "oasis_docs"],
    },
    "zion_gaming_mastery": {
        "target_tokens": 50_000_000,
        "sources": ["oasis_code", "oasis_architecture", "golden_egg", "avatar_roster", "cosmic_map"],
    },
    "programming_excellence": {
        "target_tokens": 80_000_000,
        "sources": ["v3_rust_code", "smart_contracts", "cli_tools", "docker_configs"],
    },
    "web_browsing_agent": {
        "target_tokens": 30_000_000,
        "sources": ["web_qa", "tool_use_examples", "api_docs"],
    },
    "tool_orchestration": {
        "target_tokens": 20_000_000,
        "sources": ["tool_use", "multi_step_workflows", "error_handling"],
    },
    "rag_integration": {
        "target_tokens": 15_000_000,
        "sources": ["rag_qa", "context_injection", "synthesis"],
    },
    "cross_domain_synthesis": {
        "target_tokens": 20_000_000,
        "sources": ["mixed_domain", "knowledge_transfer", "reasoning"],
    },
}

# Files to exclude from scraping
EXCLUDE_PATTERNS = [
    r"\.git/",
    r"target/",
    r"node_modules/",
    r"\.venv",
    r"\.DS_Store",
    r"Cargo\.lock",
    r"package-lock\.json",
]

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class DataPair:
    instruction: str
    output: str
    source: str = ""
    domain: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "instruction": self.instruction,
            "output": self.output,
            "source": self.source,
            "domain": self.domain,
            "metadata": self.metadata,
        }

    def token_estimate(self) -> int:
        # Rough heuristic: 1 token ~ 0.75 words (English/Czech mixed)
        words = len(self.instruction.split()) + len(self.output.split())
        return int(words / 0.75)

    def fingerprint(self) -> str:
        text = (self.instruction + self.output).lower()
        text = re.sub(r"\s+", " ", text)
        return hashlib.sha256(text.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Collectors
# ---------------------------------------------------------------------------

class BaseCollector:
    name: str = "base"

    def collect(self) -> list[DataPair]:
        raise NotImplementedError


class V3DocsCollector(BaseCollector):
    name = "v3_docs"

    def collect(self) -> list[DataPair]:
        pairs: list[DataPair] = []
        doc_dirs = [
            V3_DIR / "docs",
            V3_DIR / "L1" / "core" / "docs",
            DOCS_DIR / "CHv3",
        ]
        for d in doc_dirs:
            if not d.exists():
                continue
            for path in d.rglob("*.md"):
                if any(re.search(p, str(path)) for p in EXCLUDE_PATTERNS):
                    continue
                content = path.read_text(encoding="utf-8", errors="ignore")
                pairs.extend(self._split_to_pairs(content, str(path)))
        return pairs

    def _split_to_pairs(self, text: str, source: str) -> list[DataPair]:
        pairs = []
        sections = re.split(r"\n##+\s+", text)
        for section in sections[1:]:
            title_match = re.match(r"(.+)\n", section)
            title = title_match.group(1).strip() if title_match else "Section"
            body = section[title_match.end():] if title_match else section
            body = body.strip()
            if len(body) < 200:
                continue
            instruction = f"Explain the following ZION concept: {title}"
            output = body[:4000]  # Cap length
            pairs.append(DataPair(instruction, output, source=source, domain="zion_core"))
        return pairs


class OasisCodeCollector(BaseCollector):
    name = "oasis_code"

    def collect(self) -> list[DataPair]:
        pairs: list[DataPair] = []
        if not OASIS_DIR.exists():
            return pairs
        for path in OASIS_DIR.rglob("*.rs"):
            content = path.read_text(encoding="utf-8", errors="ignore")
            pairs.extend(self._extract_from_rust(content, str(path)))
        return pairs

    def _extract_from_rust(self, code: str, source: str) -> list[DataPair]:
        pairs = []
        # Extract structs and their fields
        struct_matches = re.finditer(
            r"pub struct\s+(\w+)\s*\{([^}]+)\}", code, re.DOTALL
        )
        for m in struct_matches:
            name, body = m.group(1), m.group(2).strip()
            instruction = f"Describe the ZION Oasis data structure `{name}` and its fields."
            output = f"`{name}` is defined as:\n```rust\npub struct {name} {{\n{body}\n}}\n```"
            pairs.append(DataPair(instruction, output, source=source, domain="oasis"))

        # Extract functions with doc comments
        func_matches = re.finditer(
            r"(?:///\s*(.+?)\n)?\s*pub(?:\s+async)?\s+fn\s+(\w+)\s*\(([^)]*)\)",
            code,
            re.DOTALL,
        )
        for m in func_matches:
            doc = m.group(1) or ""
            fname, args = m.group(2), m.group(3)
            instruction = f"What does the ZION Oasis function `{fname}` do?"
            output = f"Documentation: {doc}\nSignature: `pub fn {fname}({args})`"
            pairs.append(DataPair(instruction, output, source=source, domain="oasis"))
        return pairs


class RustCodeCollector(BaseCollector):
    name = "v3_rust_code"

    def collect(self) -> list[DataPair]:
        pairs: list[DataPair] = []
        if not V3_DIR.exists():
            return pairs
        for path in V3_DIR.rglob("*.rs"):
            if any(re.search(p, str(path)) for p in EXCLUDE_PATTERNS):
                continue
            content = path.read_text(encoding="utf-8", errors="ignore")
            if len(content) < 500:
                continue
            # Extract module-level explanation
            module_name = path.stem
            instruction = f"Explain the purpose and key components of the ZION module `{module_name}`."
            # Take first 300 lines as summary
            lines = content.splitlines()[:300]
            output = "\n".join(lines)
            pairs.append(DataPair(instruction, output, source=str(path), domain="programming"))
        return pairs


class V2DatasetCollector(BaseCollector):
    name = "v2_dataset"

    def collect(self) -> list[DataPair]:
        pairs: list[DataPair] = []
        for v2_dir in [HIRAN_V2_1, HIRAN_V2_2]:
            data_dir = v2_dir / "data"
            if not data_dir.exists():
                continue
            for jsonl in data_dir.rglob("*.jsonl"):
                with open(jsonl, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        inst = obj.get("instruction") or obj.get("input") or obj.get("prompt") or ""
                        out = obj.get("output") or obj.get("response") or obj.get("completion") or ""
                        if inst and out:
                            pairs.append(DataPair(inst, out, source=str(jsonl), domain="general"))
        return pairs


class StatusDocsCollector(BaseCollector):
    name = "status_docs"

    def collect(self) -> list[DataPair]:
        pairs: list[DataPair] = []
        for path in [REPO_ROOT / "StatusV3.md", REPO_ROOT / "StatusV3-Part2.md"]:
            if not path.exists():
                continue
            content = path.read_text(encoding="utf-8", errors="ignore")
            # Split by sections
            sections = re.split(r"\n##\s+", content)
            for section in sections[1:]:
                title_match = re.match(r"(.+)\n", section)
                title = title_match.group(1).strip() if title_match else "Section"
                body = section[title_match.end():] if title_match else section
                body = body.strip()
                if len(body) < 100:
                    continue
                instruction = f"What is the current status of {title} in ZION V3?"
                output = body[:3000]
                pairs.append(DataPair(instruction, output, source=str(path), domain="zion_status"))
        return pairs


class SyntheticQAGenerator(BaseCollector):
    """Generate synthetic Q&A pairs from long-form documents using simple heuristics."""
    name = "synthetic_qa"

    def collect(self) -> list[DataPair]:
        pairs: list[DataPair] = []
        # Process all collected docs and generate more granular Q&A
        all_docs = []
        for d in [DOCS_DIR, V3_DIR / "docs"]:
            if d.exists():
                all_docs.extend(d.rglob("*.md"))

        for path in all_docs:
            if any(re.search(p, str(path)) for p in EXCLUDE_PATTERNS):
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            pairs.extend(self._generate_qa(text, str(path)))
        return pairs

    def _generate_qa(self, text: str, source: str) -> list[DataPair]:
        pairs = []
        # Find lists and generate Q&A from them
        list_matches = re.finditer(r"^[-*]\s+(.+)$", text, re.MULTILINE)
        for m in list_matches:
            item = m.group(1).strip()
            if len(item) > 20 and len(item) < 300:
                instruction = f"List one key point about ZION from the following context."
                output = item
                pairs.append(DataPair(instruction, output, source=source, domain="zion_general"))
        return pairs[:500]  # Cap synthetic generation


# Registry of all collectors
COLLECTORS: list[type[BaseCollector]] = [
    V3DocsCollector,
    OasisCodeCollector,
    RustCodeCollector,
    V2DatasetCollector,
    StatusDocsCollector,
    SyntheticQAGenerator,
]


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------

def deduplicate(pairs: list[DataPair]) -> list[DataPair]:
    seen: set[str] = set()
    unique: list[DataPair] = []
    for p in pairs:
        fp = p.fingerprint()
        if fp not in seen:
            seen.add(fp)
            unique.append(p)
    return unique


def filter_quality(pairs: list[DataPair]) -> list[DataPair]:
    good: list[DataPair] = []
    for p in pairs:
        if len(p.instruction) < 10 or len(p.output) < 20:
            continue
        if len(p.output) > 8000:
            continue
        # Filter out obvious garbage
        if "TODO" in p.output and len(p.output) < 50:
            continue
        good.append(p)
    return good


def balance_by_domain(pairs: list[DataPair], target_per_domain: int = 500) -> list[DataPair]:
    by_domain: dict[str, list[DataPair]] = {}
    for p in pairs:
        by_domain.setdefault(p.domain, []).append(p)
    balanced: list[DataPair] = []
    for domain, items in by_domain.items():
        if len(items) > target_per_domain:
            balanced.extend(random.sample(items, target_per_domain))
        else:
            balanced.extend(items)
    random.shuffle(balanced)
    return balanced


# ---------------------------------------------------------------------------
# Curriculum builder
# ---------------------------------------------------------------------------

def build_curriculum(
    pairs: list[DataPair],
    output_dir: Path,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stats: dict[str, Any] = {}

    # Group pairs by domain
    by_domain: dict[str, list[DataPair]] = {}
    for p in pairs:
        by_domain.setdefault(p.domain, []).append(p)

    # Map domains to curriculum stages
    domain_to_stage = {
        "zion_core": "foundation_domain_adaptation",
        "zion_status": "foundation_domain_adaptation",
        "zion_general": "foundation_domain_adaptation",
        "oasis": "zion_gaming_mastery",
        "programming": "programming_excellence",
        "general": "cross_domain_synthesis",
    }

    stage_files: dict[str, list[DataPair]] = {}
    for domain, items in by_domain.items():
        stage = domain_to_stage.get(domain, "cross_domain_synthesis")
        stage_files.setdefault(stage, []).extend(items)

    for stage_name, stage_pairs in stage_files.items():
        path = output_dir / f"{stage_name}.jsonl"
        with open(path, "w", encoding="utf-8") as f:
            for p in stage_pairs:
                f.write(json.dumps(p.to_json(), ensure_ascii=False) + "\n")
        total_tokens = sum(p.token_estimate() for p in stage_pairs)
        stats[stage_name] = {
            "pairs": len(stage_pairs),
            "estimated_tokens": total_tokens,
            "file": str(path),
        }

    # Write overall stats
    stats_path = output_dir / "dataset_stats.json"
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    return stats


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def stage_collection() -> list[DataPair]:
    print("[data_pipeline] Stage: COLLECTION")
    all_pairs: list[DataPair] = []
    for collector_cls in COLLECTORS:
        collector = collector_cls()
        print(f"  -> Running {collector.name}...", end=" ", flush=True)
        pairs = collector.collect()
        print(f"{len(pairs)} pairs")
        all_pairs.extend(pairs)
    print(f"[data_pipeline] Total collected: {len(all_pairs)} pairs")
    return all_pairs


def stage_processing(pairs: list[DataPair]) -> list[DataPair]:
    print("[data_pipeline] Stage: PROCESSING")
    print(f"  -> Before dedup: {len(pairs)}")
    pairs = deduplicate(pairs)
    print(f"  -> After dedup: {len(pairs)}")
    pairs = filter_quality(pairs)
    print(f"  -> After quality filter: {len(pairs)}")
    pairs = balance_by_domain(pairs, target_per_domain=800)
    print(f"  -> After domain balance: {len(pairs)}")
    return pairs


def stage_curriculum(pairs: list[DataPair]) -> dict[str, Any]:
    print("[data_pipeline] Stage: CURRICULUM")
    stats = build_curriculum(pairs, OUTPUT_DIR)
    print(f"[data_pipeline] Curriculum written to {OUTPUT_DIR}")
    for stage, info in stats.items():
        print(f"  -> {stage}: {info['pairs']} pairs, ~{info['estimated_tokens']} tokens")
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Hiran v2.3 Data Pipeline")
    parser.add_argument(
        "--stage",
        choices=["collection", "processing", "curriculum", "all"],
        default="all",
        help="Pipeline stage to run",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=OUTPUT_DIR,
        help="Output directory for curriculum files",
    )
    args = parser.parse_args()

    global OUTPUT_DIR
    OUTPUT_DIR = args.output_dir
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pairs: list[DataPair] = []

    if args.stage in ("collection", "all"):
        pairs = stage_collection()

    if args.stage in ("processing", "all"):
        if not pairs:
            # Load from previous collection if available
            raw_path = OUTPUT_DIR / "raw_collection.jsonl"
            if raw_path.exists():
                print(f"[data_pipeline] Loading from {raw_path}")
                pairs = []
                with open(raw_path, "r", encoding="utf-8") as f:
                    for line in f:
                        obj = json.loads(line)
                        pairs.append(DataPair(**obj))
            else:
                pairs = stage_collection()
        pairs = stage_processing(pairs)
        # Save processed
        proc_path = OUTPUT_DIR / "processed.jsonl"
        with open(proc_path, "w", encoding="utf-8") as f:
            for p in pairs:
                f.write(json.dumps(p.to_json(), ensure_ascii=False) + "\n")
        print(f"[data_pipeline] Processed data saved to {proc_path}")

    if args.stage in ("curriculum", "all"):
        if not pairs:
            proc_path = OUTPUT_DIR / "processed.jsonl"
            if proc_path.exists():
                print(f"[data_pipeline] Loading processed from {proc_path}")
                pairs = []
                with open(proc_path, "r", encoding="utf-8") as f:
                    for line in f:
                        obj = json.loads(line)
                        pairs.append(DataPair(**obj))
            else:
                print("[data_pipeline] ERROR: No processed data found. Run --stage processing first.")
                return 1
        stats = stage_curriculum(pairs)
        print("\n[data_pipeline] DONE.")
        print(json.dumps(stats, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
