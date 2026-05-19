#!/usr/bin/env python3
"""
Hiran v2.3 Master Dataset Builder
Orchestrates all generators and creates final curriculum stages.
"""

import json
import random
from pathlib import Path
from datetime import datetime

random.seed(44)


def load_jsonl(path):
    """Load a JSONL file."""
    pairs = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                pairs.append(json.loads(line))
    return pairs


def save_jsonl(pairs, path):
    """Save pairs to JSONL."""
    with open(path, "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")


def build_stage4_preference_pairs():
    """Generate preference pairs for ORPO alignment."""
    pairs = []

    # Chosen = good response, Rejected = bad response
    preference_examples = [
        {
            "prompt": "What is the Zion fee split?",
            "chosen": "The Zion mining pool fee split is: **89% to miners**, **5% to humanitarian causes**, **5% to the Issobella tithe wallet**, and **1% to the pool operator**. This is hardcoded in the Zion protocol.",
            "rejected": "Zion miners get most of the rewards, with some going to charity and the pool."
        },
        {
            "prompt": "List the 7 humanitarian categories in Zion DAO.",
            "chosen": "The 7 humanitarian categories are: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.",
            "rejected": "Zion helps with food, health, and education mostly."
        },
        {
            "prompt": "What is L1 in Zion?",
            "chosen": "L1 is Zion's core blockchain layer. It contains consensus validation, mempool management, P2P networking, and mining pool coordination.",
            "rejected": "L1 is just the basic layer with some mining stuff."
        },
        {
            "prompt": "How does the Zion bridge work?",
            "chosen": "Zion's cross-chain bridge (L3/WARP) uses a relay daemon with L1 watcher, EVM watcher, and relayer loop. It supports lock-and-mint transfers between Zion and EVM chains like Ethereum and BSC.",
            "rejected": "The bridge connects Zion to other chains somehow."
        },
    ]

    # Generate many variations
    for _ in range(500):
        ex = random.choice(preference_examples)
        # Format for Alpaca/ChatML style
        instruction = ex["prompt"]
        if random.random() < 0.3:
            instruction = "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\n" + instruction + "\n<|assistant|>\n"

        pairs.append({
            "instruction": instruction,
            "output": ex["chosen"],  # Use chosen as the training target
            "rejected": ex["rejected"],
            "category": "preference_alignment",
            "priority": "medium"
        })

    random.shuffle(pairs)
    return pairs


def build_conversation_pairs():
    """Generate multi-turn conversation examples."""
    pairs = []

    conversations = [
        {
            "instruction": "User: What is Zion?\nAssistant: Zion is a multi-layer blockchain ecosystem with DAO governance, mining pools, and humanitarian funding.\nUser: How many layers does it have?\nAssistant:",
            "output": "Zion has 6 layers: L1 (Core blockchain), L2 (Services/DAO), L3 (Cross-chain relay), L4 (Applications), L5 (Vision/AI), and L6 (Research)."
        },
        {
            "instruction": "User: Explain Zion's fee split.\nAssistant: The split is 89% miner, 5% humanitarian, 5% Issobella, 1% pool operator.\nUser: How much does humanitarian get from a 10 ZION block?\nAssistant:",
            "output": "From a 10 ZION block, the humanitarian fund receives 10 × 0.05 = **0.5 ZION**."
        },
        {
            "instruction": "User: What are Zion's humanitarian categories?\nAssistant: There are 7: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.\nUser: Which category would a school construction proposal fall under?\nAssistant:",
            "output": "School construction falls under the **Education** category (category 3 of 7)."
        },
    ]

    for _ in range(300):
        conv = random.choice(conversations)
        pairs.append({
            "instruction": conv["instruction"],
            "output": conv["output"],
            "category": "conversation",
            "priority": "medium"
        })

    random.shuffle(pairs)
    return pairs


def validate_dataset(pairs, name):
    """Validate dataset quality."""
    print(f"\nValidating {name}...")
    issues = []

    # Check for empty fields
    for i, p in enumerate(pairs):
        if not p.get("instruction", "").strip():
            issues.append(f"  Pair {i}: empty instruction")
        if not p.get("output", "").strip():
            issues.append(f"  Pair {i}: empty output")

    # Check instruction length
    long_instructions = [i for i, p in enumerate(pairs) if len(p.get("instruction", "")) > 2000]
    if long_instructions:
        issues.append(f"  {len(long_instructions)} instructions exceed 2000 chars")

    # Check output length
    long_outputs = [i for i, p in enumerate(pairs) if len(p.get("output", "")) > 3000]
    if long_outputs:
        issues.append(f"  {len(long_outputs)} outputs exceed 3000 chars")

    # Check duplicates
    instructions = [p["instruction"] for p in pairs]
    unique = len(set(instructions))
    total = len(instructions)
    dup_ratio = (total - unique) / total if total > 0 else 0

    # Category distribution
    categories = {}
    for p in pairs:
        cat = p.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1

    print(f"  Total pairs: {len(pairs)}")
    print(f"  Unique instructions: {unique}/{total} ({unique/total:.1%})")
    print(f"  Issues found: {len(issues)}")
    print(f"  Category distribution:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"    {cat}: {count}")

    if issues:
        for issue in issues[:10]:
            print(issue)

    return len(issues) == 0


def main():
    curriculum_dir = Path(__file__).parent.parent / "curriculum"
    curriculum_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Hiran v2.3 Master Dataset Builder")
    print("=" * 60)

    # Load pre-generated stages
    print("\nLoading generated data...")
    stage1 = load_jsonl(curriculum_dir / "stage1_factual_reinforcement.jsonl")
    stage1_drill = load_jsonl(curriculum_dir / "stage1_drill_patterns.jsonl")
    stage2 = load_jsonl(curriculum_dir / "stage2_domain_expertise.jsonl")
    stage3 = load_jsonl(curriculum_dir / "stage3_cross_domain.jsonl")
    stage6 = load_jsonl(curriculum_dir / "stage6_bilingual.jsonl")
    stage7 = load_jsonl(curriculum_dir / "stage7_code_generation.jsonl")
    stage8 = load_jsonl(curriculum_dir / "stage8_inference.jsonl")
    stage9 = load_jsonl(curriculum_dir / "stage9_safety_adversarial.jsonl")

    # Build remaining stages
    print("\nBuilding Stage 4: Preference Alignment...")
    stage4 = build_stage4_preference_pairs()

    print("\nBuilding Stage 5: Conversation Flow...")
    stage5 = build_conversation_pairs()

    # Validate each stage
    stages = {
        "stage1_factual_reinforcement": stage1,
        "stage1_drill_patterns": stage1_drill,
        "stage2_domain_expertise": stage2,
        "stage3_cross_domain": stage3,
        "stage4_preference_alignment": stage4,
        "stage5_conversation": stage5,
        "stage6_bilingual": stage6,
        "stage7_code_generation": stage7,
        "stage8_inference": stage8,
        "stage9_safety_adversarial": stage9,
    }

    all_valid = True
    for name, pairs in stages.items():
        valid = validate_dataset(pairs, name)
        all_valid = all_valid and valid
        save_jsonl(pairs, curriculum_dir / f"{name}.jsonl")

    # Build combined dataset
    print("\nBuilding combined dataset...")
    all_pairs = []
    for name, pairs in stages.items():
        # Weight stages: factual + drill + safety get 3x weight,
        # domain + code + bilingual get 2x, rest 1x
        if "factual" in name or "drill" in name or "safety" in name:
            weight = 3
        elif "domain" in name or "code" in name or "bilingual" in name:
            weight = 2
        else:
            weight = 1
        for _ in range(weight):
            all_pairs.extend(pairs)

    random.shuffle(all_pairs)

    combined_file = curriculum_dir / "v2.3_combined_dataset.jsonl"
    save_jsonl(all_pairs, combined_file)

    # Stats
    print(f"\n{'=' * 60}")
    print("DATASET BUILD COMPLETE")
    print(f"{'=' * 60}")
    print(f"Stage 1a (Factual):      {len(stage1):>6} pairs")
    print(f"Stage 1b (Drill):        {len(stage1_drill):>6} pairs")
    print(f"Stage 2 (Domain):        {len(stage2):>6} pairs")
    print(f"Stage 3 (Cross-domain):  {len(stage3):>6} pairs")
    print(f"Stage 4 (Preference):    {len(stage4):>6} pairs")
    print(f"Stage 5 (Conversation):  {len(stage5):>6} pairs")
    print(f"Stage 6 (Bilingual):     {len(stage6):>6} pairs")
    print(f"Stage 7 (Code Gen):      {len(stage7):>6} pairs")
    print(f"Stage 8 (Inference):     {len(stage8):>6} pairs")
    print(f"{'-' * 40}")
    print(f"Combined (weighted):     {len(all_pairs):>6} pairs")
    print(f"\nSaved to: {curriculum_dir}")
    print(f"Combined: {combined_file}")
    print(f"\nValidation: {'PASSED' if all_valid else 'FAILED - check issues above'}")

    # Save metadata
    meta = {
        "version": "2.3",
        "created": datetime.now().isoformat(),
        "total_pairs": len(all_pairs),
        "stage_counts": {
            "stage1_factual": len(stage1),
            "stage1_drill": len(stage1_drill),
            "stage2_domain": len(stage2),
            "stage3_cross": len(stage3),
            "stage4_preference": len(stage4),
            "stage5_conversation": len(stage5),
            "stage6_bilingual": len(stage6),
            "stage7_code_gen": len(stage7),
            "stage8_inference": len(stage8),
        },
        "training_method": "full_fine_tuning",
        "target_model": "nvidia/OpenReasoning-Nemotron-32B",
        "key_innovations": [
            "factual_reinforcement_loops",
            "drill_pattern_memorization",
            "negative_correction_examples",
            "chain_of_thought_training",
            "system_prompt_anchoring",
            "memory_anchor_contexts",
            "refusal_to_hallucinate",
            "preference_alignment"
        ]
    }
    with open(curriculum_dir / "dataset_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nMetadata saved to: {curriculum_dir / 'dataset_metadata.json'}")


if __name__ == "__main__":
    main()
