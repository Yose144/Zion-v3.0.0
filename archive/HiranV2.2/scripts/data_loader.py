"""JSONL curriculum loader for Hiran v2.2 training."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from datasets import Dataset


def format_prompt_only(row: Dict[str, Any]) -> str:
    """Prompt prefix only (for generation eval)."""
    instruction = (row.get("instruction") or "").strip()
    extra_in = (row.get("input") or "").strip()
    if extra_in:
        return f"### Instruction:\n{instruction}\n\n### Input:\n{extra_in}\n\n### Response:\n"
    return f"### Instruction:\n{instruction}\n\n### Response:\n"


def format_instruction_row(row: Dict[str, Any]) -> str:
    """Format one example as plain text for causal LM (instruction tuning)."""
    instruction = (row.get("instruction") or "").strip()
    output = (row.get("output") or "").strip()
    extra_in = (row.get("input") or "").strip()
    if extra_in:
        return (
            f"### Instruction:\n{instruction}\n\n### Input:\n{extra_in}\n\n### Response:\n{output}"
        )
    return f"### Instruction:\n{instruction}\n\n### Response:\n{output}"


def iter_jsonl(path: Path) -> Iterator[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def load_curriculum_jsonl(
    path: Path,
    *,
    max_rows: Optional[int] = None,
) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for i, obj in enumerate(iter_jsonl(path)):
        if max_rows is not None and i >= max_rows:
            break
        rows.append(
            {
                "text": format_instruction_row(obj),
                "domain": str(obj.get("domain") or path.stem),
            }
        )
    return rows


def build_hf_dataset(
    data_path: Path,
    *,
    max_rows: Optional[int] = None,
) -> Dataset:
    if not data_path.is_file():
        raise FileNotFoundError(f"Curriculum file not found: {data_path}")
    records = load_curriculum_jsonl(data_path, max_rows=max_rows)
    if not records:
        raise ValueError(f"No rows loaded from {data_path}")
    return Dataset.from_list(records)
