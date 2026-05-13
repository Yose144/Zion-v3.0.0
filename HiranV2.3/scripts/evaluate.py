#!/usr/bin/env python3
"""
Hiran v2.3 Evaluation Framework
==================================
Multi-domain evaluation covering code generation, ZION knowledge,
OASIS blueprints, tool use, and general reasoning.

Usage:
    python scripts/evaluate.py \
        --model_path checkpoints/final \
        --benchmarks all \
        --output_dir evaluation_results

    # Quick sanity check
    python scripts/evaluate.py --model_path checkpoints/final --quick
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

# ---------------------------------------------------------------------------
# Benchmark registry
# ---------------------------------------------------------------------------

ZION_KNOWLEDGE_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "zion_1",
        "question": "What are the 9 consciousness levels in ZION Oasis and their corresponding Sefirot?",
        "expected_keywords": [
            "Physical", "Emotional", "Mental", "Intuitive", "Creative",
            "Visionary", "Universal", "Transcendent", "On The Star",
            "Malkuth", "Yesod", "Tiferet", "Gevurah", "Binah", "Chokmah", "Keter",
        ],
        "weight": 2.0,
    },
    {
        "id": "zion_2",
        "question": "How much ZION is in the total premine allocation for Oasis, and how is it distributed across reward slots?",
        "expected_keywords": [
            "8.25", "billion", "1.65", "GoldenEgg", "Winners", "GuildPool",
            "TerritoryPool", "HumanitarianPool",
        ],
        "weight": 2.0,
    },
    {
        "id": "zion_3",
        "question": "Explain the ZION V3 architecture layers L1, L2, L3, and L4.",
        "expected_keywords": [
            "L1", "core", "pool", "miner", "PoW",
            "L2", "bridge", "dao", "atomic-swap",
            "L3", "warp", "ncl", "ai-native",
            "L4", "oasis", "consciousness",
        ],
        "weight": 2.0,
    },
    {
        "id": "zion_4",
        "question": "What are the 7 categories of the humanitarian tithe in ZION Oasis?",
        "expected_keywords": [
            "water", "food", "housing", "environment",
            "healthcare", "education", "crisis", "tithe",
        ],
        "weight": 1.5,
    },
    {
        "id": "zion_5",
        "question": "Describe the guild system in ZION Oasis. What are the requirements to join or create a guild?",
        "expected_keywords": [
            "guild", "1000 XP", "Emotional", "5000 XP", "Mental",
            "officers", "members", "max 100",
        ],
        "weight": 1.5,
    },
]

CODE_GENERATION_TASKS: list[dict[str, Any]] = [
    {
        "id": "code_1",
        "prompt": "Write a Rust function that calculates XP reward for mining a block in ZION Oasis, applying consciousness level multiplier. The function signature should be: pub fn calculate_mining_reward(base_xp: u64, consciousness_level: u8) -> u64",
        "expected_patterns": [
            r"pub fn calculate_mining_reward",
            r"match.*consciousness_level",
            r"base_xp.*\*",
        ],
        "test_cases": [
            {"base_xp": 100, "level": 1, "expected": 100},
            {"base_xp": 100, "level": 2, "expected": 120},
            {"base_xp": 100, "level": 5, "expected": 250},
        ],
        "weight": 2.0,
    },
    {
        "id": "code_2",
        "prompt": "Write a Python script that validates a ZION Oasis territory claim. The claim is valid if: the player has at least 10_000 ZION, the territory is not already claimed, and there is no active defense period.",
        "expected_patterns": [
            r"def.*validate.*claim",
            r"10000",
            r"defense",
        ],
        "weight": 1.5,
    },
    {
        "id": "code_3",
        "prompt": "Write a TypeScript interface for a ZION Oasis Player profile including address, total_xp, level, guild_id, and achievements array.",
        "expected_patterns": [
            r"interface.*Player",
            r"address.*string",
            r"total_xp.*number",
            r"level.*number",
            r"guild_id",
            r"achievements",
        ],
        "weight": 1.0,
    },
]

OASIS_BLUEPRINT_TASKS: list[dict[str, Any]] = [
    {
        "id": "blueprint_1",
        "prompt": "Design a ZION Oasis guild quest that rewards 500 XP. Include: quest name, description, objectives (3), completion criteria, and reward distribution.",
        "expected_keywords": [
            "quest", "XP", "objectives", "completion", "reward",
        ],
        "weight": 2.0,
    },
    {
        "id": "blueprint_2",
        "prompt": "Create a territory battle scenario for ZION Oasis between two guilds. Describe the territory (name, type, bonuses), attack conditions, defense mechanics, and outcome rewards.",
        "expected_keywords": [
            "territory", "guild", "attack", "defense", "bonus", "reward",
        ],
        "weight": 2.0,
    },
]

# ---------------------------------------------------------------------------
# Evaluators
# ---------------------------------------------------------------------------

class ModelWrapper:
    def __init__(self, model_path: str, device: str = "auto"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,
            device_map=device,
            trust_remote_code=True,
        )
        self.model.eval()

    def generate(self, prompt: str, max_new_tokens: int = 512, temperature: float = 0.3) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                top_p=0.9,
                pad_token_id=self.tokenizer.pad_token_id,
            )
        generated = outputs[0][inputs["input_ids"].shape[1]:]
        return self.tokenizer.decode(generated, skip_special_tokens=True)


def evaluate_zion_knowledge(model: ModelWrapper) -> dict[str, Any]:
    results = []
    total_score = 0.0
    max_score = 0.0

    for q in ZION_KNOWLEDGE_QUESTIONS:
        prompt = f"<|begin_of_text|>任职user\n\n{q['question']}<|eot_id|>任职assistant\n\n"
        answer = model.generate(prompt, max_new_tokens=400, temperature=0.3)

        hits = sum(1 for kw in q["expected_keywords"] if kw.lower() in answer.lower())
        ratio = hits / len(q["expected_keywords"])
        score = ratio * q["weight"]
        total_score += score
        max_score += q["weight"]

        results.append({
            "id": q["id"],
            "question": q["question"],
            "answer_preview": answer[:200],
            "hits": hits,
            "total_keywords": len(q["expected_keywords"]),
            "score": round(ratio, 3),
            "weighted_score": round(score, 3),
        })

    return {
        "name": "zion_knowledge",
        "score": round(total_score / max_score, 3) if max_score else 0,
        "details": results,
    }


def evaluate_code_generation(model: ModelWrapper) -> dict[str, Any]:
    results = []
    total_score = 0.0
    max_score = 0.0

    for task in CODE_GENERATION_TASKS:
        prompt = f"<|begin_of_text|>任职user\n\n{task['prompt']}<|eot_id|>任职assistant\n\n```\n"
        code = model.generate(prompt, max_new_tokens=600, temperature=0.2)

        pattern_hits = sum(1 for pat in task["expected_patterns"] if re.search(pat, code))
        pattern_score = pattern_hits / len(task["expected_patterns"])

        # For Rust code_1, try to compile and run test cases
        exec_score = 0.0
        if task["id"] == "code_1":
            exec_score = _test_rust_code(code, task.get("test_cases", []))

        score = (pattern_score * 0.6 + exec_score * 0.4) * task["weight"]
        total_score += score
        max_score += task["weight"]

        results.append({
            "id": task["id"],
            "prompt": task["prompt"][:100],
            "code_preview": code[:300],
            "pattern_score": round(pattern_score, 3),
            "exec_score": round(exec_score, 3),
            "weighted_score": round(score, 3),
        })

    return {
        "name": "code_generation",
        "score": round(total_score / max_score, 3) if max_score else 0,
        "details": results,
    }


def _test_rust_code(code: str, test_cases: list[dict[str, Any]]) -> float:
    """Try to compile and run a minimal Rust test for the generated code."""
    if not test_cases:
        return 0.0

    # Extract the function
    func_match = re.search(r"pub fn calculate_mining_reward\([^)]+\)[^{]*\{[^}]*\}", code, re.DOTALL)
    if not func_match:
        return 0.0

    rust_src = f"""
fn main() {{
    {func_match.group()}
    let mut passed = 0;
    let mut total = 0;
"""
    for tc in test_cases:
        rust_src += f"""
    total += 1;
    let result = calculate_mining_reward({tc['base_xp']}u64, {tc['level']}u8);
    if result == {tc['expected']}u64 {{ passed += 1; }}
"""
    rust_src += """
    println!("{{}} {{}}", passed, total);
}
"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            src_path = Path(tmpdir) / "test.rs"
            src_path.write_text(rust_src)
            result = subprocess.run(
                ["rustc", "--edition", "2021", str(src_path), "-o", f"{tmpdir}/test"],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0:
                return 0.0
            run = subprocess.run([f"{tmpdir}/test"], capture_output=True, text=True, timeout=10)
            passed, total = map(int, run.stdout.strip().split())
            return passed / total
    except Exception:
        return 0.0


def evaluate_blueprints(model: ModelWrapper) -> dict[str, Any]:
    results = []
    total_score = 0.0
    max_score = 0.0

    for task in OASIS_BLUEPRINT_TASKS:
        prompt = f"<|begin_of_text|>任职user\n\n{task['prompt']}<|eot_id|>任职assistant\n\n"
        answer = model.generate(prompt, max_new_tokens=800, temperature=0.4)

        hits = sum(1 for kw in task["expected_keywords"] if kw.lower() in answer.lower())
        ratio = hits / len(task["expected_keywords"])
        score = ratio * task["weight"]
        total_score += score
        max_score += task["weight"]

        results.append({
            "id": task["id"],
            "prompt": task["prompt"][:100],
            "answer_preview": answer[:300],
            "hits": hits,
            "score": round(ratio, 3),
            "weighted_score": round(score, 3),
        })

    return {
        "name": "oasis_blueprints",
        "score": round(total_score / max_score, 3) if max_score else 0,
        "details": results,
    }


def evaluate_perplexity(model: ModelWrapper, test_file: Path | None = None) -> dict[str, Any]:
    """Estimate perplexity on a holdout set."""
    if test_file is None:
        # Try to find any eval dataset
        candidates = [
            Path("HiranV2.3/data/curriculum/cross_domain_synthesis.jsonl"),
            Path("HiranV2.2/data/curriculum/cross_domain.jsonl"),
        ]
        for c in candidates:
            if c.exists():
                test_file = c
                break

    if test_file is None or not test_file.exists():
        return {"name": "perplexity", "score": None, "error": "No eval dataset found"}

    texts = []
    with open(test_file, "r", encoding="utf-8") as f:
        for line in f:
            obj = json.loads(line)
            text = obj.get("instruction", "") + "\n" + obj.get("output", "")
            texts.append(text)

    sample = texts[:200]  # Cap for speed
    total_loss = 0.0
    total_tokens = 0

    for text in sample:
        inputs = model.tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(model.model.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = model.model(**inputs, labels=inputs["input_ids"])
        loss = outputs.loss.item()
        n_tokens = inputs["input_ids"].shape[1]
        total_loss += loss * n_tokens
        total_tokens += n_tokens

    avg_loss = total_loss / total_tokens
    perplexity = math.exp(avg_loss)

    return {
        "name": "perplexity",
        "score": round(perplexity, 3),
        "avg_loss": round(avg_loss, 4),
        "samples": len(sample),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Hiran v2.3 Evaluation")
    parser.add_argument("--model_path", required=True, help="Path to model or adapter")
    parser.add_argument("--benchmarks", default="all", help="Comma-separated: zion_knowledge,code_generation,blueprints,perplexity")
    parser.add_argument("--output_dir", default="HiranV2.3/evaluation_results")
    parser.add_argument("--quick", action="store_true", help="Quick run with fewer samples")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading model from {args.model_path}...")
    model = ModelWrapper(args.model_path)

    benchmarks = [b.strip() for b in args.benchmarks.split(",")]
    if "all" in benchmarks:
        benchmarks = ["zion_knowledge", "code_generation", "blueprints", "perplexity"]

    all_results = {}
    overall_score = 0.0
    overall_weight = 0.0

    weights = {
        "zion_knowledge": 0.25,
        "code_generation": 0.25,
        "blueprints": 0.25,
        "perplexity": 0.25,
    }

    if "zion_knowledge" in benchmarks:
        print("\n[EVAL] ZION Knowledge...")
        result = evaluate_zion_knowledge(model)
        all_results["zion_knowledge"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["zion_knowledge"]
        overall_weight += weights["zion_knowledge"]

    if "code_generation" in benchmarks:
        print("\n[EVAL] Code Generation...")
        result = evaluate_code_generation(model)
        all_results["code_generation"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["code_generation"]
        overall_weight += weights["code_generation"]

    if "blueprints" in benchmarks:
        print("\n[EVAL] Oasis Blueprints...")
        result = evaluate_blueprints(model)
        all_results["blueprints"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["blueprints"]
        overall_weight += weights["blueprints"]

    if "perplexity" in benchmarks:
        print("\n[EVAL] Perplexity...")
        result = evaluate_perplexity(model)
        all_results["perplexity"] = result
        print(f"  Perplexity: {result.get('score')}")
        # Perplexity target: < 1.3 (lower is better)
        if result.get("score"):
            ppl_score = max(0, 1.0 - (result["score"] - 1.0) / 2.0)
            overall_score += ppl_score * weights["perplexity"]
            overall_weight += weights["perplexity"]

    overall = round(overall_score / overall_weight, 3) if overall_weight else 0
    all_results["overall"] = overall

    print(f"\n{'='*40}")
    print(f"OVERALL SCORE: {overall}")
    print(f"{'='*40}")

    report_path = output_dir / f"eval_report_{int(time.time())}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to {report_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
