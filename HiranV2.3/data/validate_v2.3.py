#!/usr/bin/env python3
"""
Hiran v2.3 Dataset Validator
Verifies that critical facts are present and dataset quality meets standards.
"""

import json
import sys
from pathlib import Path
from collections import Counter

CURRICULUM_DIR = Path(__file__).parent / "curriculum"

# Critical facts that MUST appear in the dataset
CRITICAL_FACTS = {
    "89": "Miner percentage must appear",
    "5%": "Humanitarian/Issobella percentage must appear",
    "1%": "Pool operator percentage must appear",
    "Food and Water": "First humanitarian category",
    "Human Rights and Justice": "Last humanitarian category",
    "L1": "Layer 1 must be mentioned",
    "L6": "Layer 6 must be mentioned",
    "WARP": "Cross-chain protocol must appear",
    "Issobella": "Tithe wallet must appear",
    "hardcoded": "Fee split immutability must be mentioned",
    "quadratic": "Voting mechanism must appear",
    "PPLNS": "Mining reward mechanism must appear",
}


def load_all_pairs():
    """Load all curriculum files."""
    all_pairs = []
    for jsonl_file in CURRICULUM_DIR.glob("*.jsonl"):
        if jsonl_file.name == "v2.3_combined_dataset.jsonl":
            continue  # Skip combined, check sources
        with open(jsonl_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    all_pairs.append(json.loads(line))
    return all_pairs


def check_critical_facts(pairs):
    """Verify all critical facts appear in at least one Q or A."""
    print("\n=== CRITICAL FACT CHECK ===")
    all_text = " ".join(p["instruction"] + " " + p["output"] for p in pairs)
    all_text_lower = all_text.lower()

    missing = []
    for fact, description in CRITICAL_FACTS.items():
        if fact.lower() in all_text_lower:
            print(f"  [OK] {fact}: {description}")
        else:
            print(f"  [FAIL] {fact}: MISSING - {description}")
            missing.append(fact)

    if missing:
        print(f"\n  WARNING: {len(missing)} critical facts missing!")
        return False
    else:
        print(f"\n  All {len(CRITICAL_FACTS)} critical facts present [OK]")
        return True


def check_category_balance(pairs):
    """Check distribution of categories."""
    print("\n=== CATEGORY BALANCE CHECK ===")
    categories = Counter(p["category"] for p in pairs)
    total = len(pairs)

    for cat, count in categories.most_common():
        pct = count / total * 100
        print(f"  {cat:40s} {count:>6} ({pct:5.1f}%)")

    # Check for drill pattern dominance (should be ~30-40% of total)
    drill_count = sum(c for cat, c in categories.items() if "drill" in cat)
    drill_pct = drill_count / total * 100
    print(f"\n  Drill patterns total: {drill_count} ({drill_pct:.1f}%)")

    if drill_pct < 20:
        print("  WARNING: Too few drill patterns!")
        return False
    if drill_pct > 60:
        print("  WARNING: Too many drill patterns!")
        return False
    print("  Category balance [OK]")
    return True


def check_empty_content(pairs):
    """Check for empty instructions or outputs."""
    print("\n=== EMPTY CONTENT CHECK ===")
    empty_inst = sum(1 for p in pairs if not p.get("instruction", "").strip())
    empty_out = sum(1 for p in pairs if not p.get("output", "").strip())

    print(f"  Empty instructions: {empty_inst}")
    print(f"  Empty outputs: {empty_out}")

    if empty_inst > 0 or empty_out > 0:
        print("  WARNING: Empty content found!")
        return False
    print("  No empty content [OK]")
    return True


def check_duplicate_outputs(pairs):
    """Check for exact duplicate outputs (may indicate generator issue)."""
    print("\n=== DUPLICATE OUTPUT CHECK ===")
    outputs = [p["output"] for p in pairs]
    unique_outputs = len(set(outputs))
    total = len(outputs)
    dup_ratio = (total - unique_outputs) / total * 100

    print(f"  Unique outputs: {unique_outputs}/{total}")
    print(f"  Duplicate ratio: {dup_ratio:.1f}%")

    # Drill patterns intentionally have repetition for memorization
    # Allow very high dup ratio since factual reinforcement requires repetition
    if dup_ratio > 99:
        print("  WARNING: Extreme duplicate ratio!")
        return False
    print("  Duplicate ratio acceptable (drill patterns intentional) [OK]")
    return True


def check_response_length(pairs):
    """Check that responses aren't too short or too long."""
    print("\n=== RESPONSE LENGTH CHECK ===")
    lengths = [len(p["output"]) for p in pairs]
    avg_len = sum(lengths) / len(lengths)
    min_len = min(lengths)
    max_len = max(lengths)

    print(f"  Average response length: {avg_len:.0f} chars")
    print(f"  Min: {min_len} | Max: {max_len}")

    too_short = sum(1 for l in lengths if l < 20)
    too_long = sum(1 for l in lengths if l > 3000)

    print(f"  Too short (<20 chars): {too_short}")
    print(f"  Too long (>3000 chars): {too_long}")

    if too_short > len(pairs) * 0.05:
        print("  WARNING: Too many short responses!")
        return False
    if too_long > len(pairs) * 0.01:
        print("  WARNING: Too many long responses!")
        return False
    print("  Response lengths acceptable [OK]")
    return True


def check_factual_variety(pairs):
    """Check that fee split appears in many different forms."""
    print("\n=== FACTUAL VARIETY CHECK ===")
    fee_split_questions = [p["instruction"] for p in pairs if "89" in p["instruction"] or "split" in p["instruction"].lower()]
    print(f"  Questions mentioning fee split: {len(fee_split_questions)}")

    # Check for variety in question phrasing
    unique_first_words = set(q.split()[0] for q in fee_split_questions if q.strip())
    print(f"  Unique first words in fee-split Qs: {len(unique_first_words)}")
    print(f"    Examples: {', '.join(list(unique_first_words)[:10])}")

    if len(fee_split_questions) < 500:
        print("  WARNING: Too few fee split questions!")
        return False
    if len(unique_first_words) < 10:
        print("  WARNING: Low variety in fee split questions!")
        return False
    print("  Factual variety acceptable [OK]")
    return True


def main():
    print("=" * 60)
    print("Hiran v2.3 Dataset Validator")
    print("=" * 60)

    pairs = load_all_pairs()
    print(f"Loaded {len(pairs)} pairs from curriculum files")

    checks = [
        ("Critical Facts", check_critical_facts(pairs)),
        ("Category Balance", check_category_balance(pairs)),
        ("Empty Content", check_empty_content(pairs)),
        ("Duplicate Outputs", check_duplicate_outputs(pairs)),
        ("Response Length", check_response_length(pairs)),
        ("Factual Variety", check_factual_variety(pairs)),
    ]

    print(f"\n{'=' * 60}")
    print("VALIDATION SUMMARY")
    print(f"{'=' * 60}")

    all_passed = True
    for name, passed in checks:
        status = "PASS [OK]" if passed else "FAIL [FAIL]"
        print(f"  {name:20s} {status}")
        all_passed = all_passed and passed

    print(f"\n{'=' * 60}")
    if all_passed:
        print("ALL CHECKS PASSED — Dataset ready for training!")
    else:
        print("SOME CHECKS FAILED — Review issues above before training")
    print(f"{'=' * 60}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
