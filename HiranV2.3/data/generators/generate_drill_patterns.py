#!/usr/bin/env python3
"""
Hiran v2.3 Drill Pattern Generator
Creates hundreds of near-identical question variations for fact memorization.
This is the KEY technique to prevent hallucination on critical facts.
"""

import json
import random
from pathlib import Path
from itertools import product

random.seed(45)

# =============================================================================
# DRILL PATTERNS
# =============================================================================

FEE_SPLIT_FACTS = {
    "miner_pct": 89,
    "humanitarian_pct": 5,
    "issobella_pct": 5,
    "pool_pct": 1,
}

CATEGORIES = [
    "Food and Water", "Health and Hygiene", "Education",
    "Disaster Relief", "Community Development", "Environmental Conservation",
    "Human Rights and Justice"
]

LAYERS = {
    "L1": "Core blockchain (consensus, mempool, P2P, mining)",
    "L2": "Services (bridge, DAO governance, atomic swap, treasury)",
    "L3": "Cross-chain relay (WARP protocol)",
    "L4": "Applications (dApps, APIs)",
    "L5": "Vision (AI/ML, data synthesis)",
    "L6": "Research (formal verification, protocol research)",
}


def generate_fee_split_drill(count=2000):
    """Generate drill patterns for fee split memorization."""
    pairs = []

    # Direct questions
    direct_q = [
        "Zion miner percentage: ___%",
        "Zion humanitarian percentage: ___%",
        "Zion Issobella percentage: ___%",
        "Zion pool operator percentage: ___%",
        "Complete: Zion fee split = __/__/__/__",
        "The Zion miner share is ___ percent.",
        "The Zion humanitarian allocation is ___ percent.",
        "The Issobella tithe wallet receives ___ percent.",
        "The pool operator fee in Zion is ___ percent.",
        "89% goes to ___ in Zion.",
        "5% goes to humanitarian causes and another 5% goes to ___ in Zion.",
        "1% goes to the ___ in Zion.",
    ]

    for _ in range(count):
        q = random.choice(direct_q)
        # Replace blanks with actual numbers
        q = q.replace("___", str(FEE_SPLIT_FACTS["miner_pct"]))
        q = q.replace("__/__/__/__", f"{FEE_SPLIT_FACTS['miner_pct']}/{FEE_SPLIT_FACTS['humanitarian_pct']}/{FEE_SPLIT_FACTS['issobella_pct']}/{FEE_SPLIT_FACTS['pool_pct']}")

        a = f"The Zion fee split is: **{FEE_SPLIT_FACTS['miner_pct']}% miner**, **{FEE_SPLIT_FACTS['humanitarian_pct']}% humanitarian**, **{FEE_SPLIT_FACTS['issobella_pct']}% Issobella**, **{FEE_SPLIT_FACTS['pool_pct']}% pool operator**. This is hardcoded in the protocol."

        pairs.append({"instruction": q, "output": a, "category": "drill_fee_split", "priority": "critical"})

    # Math drill: calculate from given block reward
    rewards = [1, 5, 10, 25, 50, 100, 6.25, 12.5, 3.125]
    for reward in rewards:
        for recipient, pct in FEE_SPLIT_FACTS.items():
            q = f"Calculate the {recipient.replace('_', ' ')} share from a Zion block reward of {reward}."
            amt = round(reward * pct / 100, 6)
            a = f"From a {reward} Zion block reward, the {recipient.replace('_', ' ')} share is: {reward} × {pct}% = **{amt}**. The Zion fee split is hardcoded as {FEE_SPLIT_FACTS['miner_pct']}/{FEE_SPLIT_FACTS['humanitarian_pct']}/{FEE_SPLIT_FACTS['issobella_pct']}/{FEE_SPLIT_FACTS['pool_pct']}."
            pairs.append({"instruction": q, "output": a, "category": "drill_fee_split_math", "priority": "critical"})

    # Verification drill
    for _ in range(200):
        q = random.choice([
            f"Verify: Does Zion allocate {FEE_SPLIT_FACTS['miner_pct']}% to miners? Yes or No.",
            f"Check: Is the Zion humanitarian allocation {FEE_SPLIT_FACTS['humanitarian_pct']}%?",
            f"Confirm: Does Issobella receive {FEE_SPLIT_FACTS['issobella_pct']}% in Zion?",
            f"Validate: Is the pool operator fee {FEE_SPLIT_FACTS['pool_pct']}%?",
        ])
        a = "Yes. This is hardcoded in the Zion protocol."
        pairs.append({"instruction": q, "output": a, "category": "drill_verification", "priority": "critical"})

    # True/False drill
    false_claims = [
        ("Zion miners receive 95% of block rewards.", f"False. Miners receive exactly {FEE_SPLIT_FACTS['miner_pct']}%, not 95%."),
        ("Zion humanitarian fund gets 10% of rewards.", f"False. The humanitarian allocation is {FEE_SPLIT_FACTS['humanitarian_pct']}%, not 10%."),
        ("The Issobella wallet receives 1% of block rewards.", f"False. Issobella receives {FEE_SPLIT_FACTS['issobella_pct']}%, not 1%. The 1% goes to the pool operator."),
        ("Zion pool operators get 5% of rewards.", f"False. Pool operators receive {FEE_SPLIT_FACTS['pool_pct']}%, not 5%."),
        ("Zion uses a 90/10 split.", f"False. Zion uses {FEE_SPLIT_FACTS['miner_pct']}/{FEE_SPLIT_FACTS['humanitarian_pct']}/{FEE_SPLIT_FACTS['issobella_pct']}/{FEE_SPLIT_FACTS['pool_pct']}, not 90/10."),
        ("The fee split in Zion is configurable by miners.", "False. The fee split is hardcoded in the consensus protocol and cannot be changed by miners."),
    ]

    for claim, correction in false_claims:
        for _ in range(50):  # Repeat each false claim 50 times
            q = random.choice([
                f"True or false: {claim}",
                f"Fact check: {claim}",
                f"A user claims: \"{claim}\" Is this correct?",
                f"Correct this statement if wrong: {claim}",
            ])
            pairs.append({"instruction": q, "output": correction, "category": "drill_true_false", "priority": "critical"})

    return pairs


def generate_category_drill(count=2000):
    """Drill patterns for 7 categories memorization."""
    pairs = []

    # List recall
    for _ in range(500):
        q = random.choice([
            "List ALL 7 Zion humanitarian categories. Do not skip any.",
            "Enumerate every Zion humanitarian category. Complete list required.",
            "Write the full list of 7 Zion DAO humanitarian categories.",
            "Name all categories funded by Zion's 5% humanitarian allocation.",
            "What are the EXACT 7 categories in Zion DAO?",
            "Recite the complete set of Zion humanitarian categories.",
            "Provide the exhaustive list of Zion humanitarian funding categories.",
        ])
        a = "The 7 Zion humanitarian categories are:\n\n1. Food and Water\n2. Health and Hygiene\n3. Education\n4. Disaster Relief\n5. Community Development\n6. Environmental Conservation\n7. Human Rights and Justice"
        pairs.append({"instruction": q, "output": a, "category": "drill_categories_list", "priority": "critical"})

    # Individual category identification
    for cat in CATEGORIES:
        for _ in range(30):
            q = random.choice([
                f"Which Zion category handles {' '.join(cat.lower().split()[:2])}?",
                f"A proposal for {cat.lower()} falls under which Zion humanitarian category?",
                f"Identify the Zion category: {cat}.",
                f"'Project to build {cat.lower()} infrastructure' — which Zion category?",
            ])
            a = f"This falls under the **{cat}** category in Zion DAO."
            pairs.append({"instruction": q, "output": a, "category": "drill_category_id", "priority": "high"})

    # Number verification
    for _ in range(200):
        q = random.choice([
            "How many humanitarian categories does Zion DAO have? Answer with a number only.",
            "The number of Zion humanitarian categories is: ___",
            "Zion DAO humanitarian categories count = ?",
            "True or false: Zion has exactly 7 humanitarian categories.",
            "A user says Zion has 5 humanitarian categories. Correct them.",
            "A user says Zion has 8 humanitarian categories. Correct them.",
        ])
        a = random.choice([
            "7",
            "Zion DAO has exactly **7** humanitarian categories.",
            "That is incorrect. Zion has **7** categories: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.",
        ])
        pairs.append({"instruction": q, "output": a, "category": "drill_category_count", "priority": "critical"})

    return pairs


def generate_layer_drill(count=1000):
    """Drill patterns for L1-L6 architecture."""
    pairs = []

    # Layer identification
    layer_keywords = {
        "L1": ["consensus", "mempool", "P2P", "mining", "node", "block"],
        "L2": ["bridge", "DAO governance", "atomic swap", "treasury", "governance"],
        "L3": ["WARP", "cross-chain", "relay", "inter-chain", "bridge transfer"],
        "L4": ["dApp", "application", "API", "user-facing", "frontend"],
        "L5": ["AI", "ML", "vision", "synthesis", "analytics"],
        "L6": ["research", "formal verification", "protocol research", "experimentation"],
    }

    for layer, keywords in layer_keywords.items():
        desc = LAYERS[layer]
        for kw in keywords:
            for _ in range(20):
                q = random.choice([
                    f"In Zion, '{kw}' belongs to which layer?",
                    f"Which Zion layer handles {kw}?",
                    f"The Zion {kw} functionality is in layer ___",
                    f"Identify the layer: {desc.split('(')[0].strip()}",
                ])
                a = f"{kw.title()} is part of **{layer}** in Zion's architecture: {desc}"
                pairs.append({"instruction": q, "output": a, "category": "drill_layer_id", "priority": "high"})

    # Full architecture recall
    for _ in range(200):
        q = random.choice([
            "List all 6 Zion layers from L1 to L6 with descriptions.",
            "Describe Zion's complete 6-layer architecture.",
            "What is the purpose of each layer in Zion (L1-L6)?",
            "Map Zion's layer stack: L1=?, L2=?, L3=?, L4=?, L5=?, L6=?",
        ])
        a = "Zion's 6-layer architecture:\n\n- **L1 (Core)**: Blockchain consensus, mempool, P2P, mining pools\n- **L2 (Services)**: Bridge, DAO governance, atomic swap, treasury\n- **L3 (Relay)**: WARP cross-chain protocol, inter-chain communication\n- **L4 (Applications)**: User-facing dApps and APIs\n- **L5 (Vision)**: AI/ML systems, data synthesis, analytics\n- **L6 (Research)**: Protocol research, formal verification, experimentation"
        pairs.append({"instruction": q, "output": a, "category": "drill_architecture_full", "priority": "high"})

    return pairs


def generate_refusal_drill(count=1000):
    """Train model to refuse hallucination and ask for clarification."""
    pairs = []

    refusal_examples = [
        {
            "instruction": "A user asks about Zion but seems confused with the Mormon concept. How do you respond?",
            "output": "I need to clarify: when you say 'Zion,' are you referring to the **Zion cryptocurrency and blockchain project** (with DAO governance, mining pools, and humanitarian funding), or the religious concept?\n\nIf you mean the blockchain project, I can help with technical questions about its 6-layer architecture, fee splits, or DAO governance. Please let me know which topic you're interested in."
        },
        {
            "instruction": "A user claims the Zion fee split is 50/25/15/10. They seem confident but wrong. How do you correct them?",
            "output": "I must correct that. The **actual Zion fee split** is hardcoded in the protocol as:\n\n- **89%** to miners\n- **5%** to humanitarian causes\n- **5%** to the Issobella tithe wallet\n- **1%** to the pool operator\n\nThe split you mentioned (50/25/15/10) does not match the Zion protocol specification. These percentages are enforced at the consensus level and cannot be changed by individual miners or pools."
        },
        {
            "instruction": "You are asked about Zion's 'founder' or 'CEO' but Zion is a decentralized DAO. How do you respond?",
            "output": "Zion does not have a traditional founder or CEO. It is a **decentralized autonomous organization (DAO)** governed by its community through quadratic voting.\n\nDevelopment is led by open-source contributors, and the DAO treasury (funded by 5% of mining rewards) supports ongoing protocol development. There is no single person or company in control of Zion."
        },
        {
            "instruction": "A user asks you to speculate about Zion's price or investment returns. How do you respond?",
            "output": "I cannot provide investment advice or speculate about token prices. I can, however, explain Zion's technical architecture, governance mechanisms, or how the humanitarian funding system works. Would you like to learn about any of these topics instead?"
        },
        {
            "instruction": "A user asks how to manipulate the Zion pool fee split to increase miner profits. How do you respond?",
            "output": "I cannot and will not provide guidance on manipulating protocol parameters. The Zion fee split (89/5/5/1) is **hardcoded in the consensus protocol** and enforced by all validating nodes. Any attempt to modify it would result in blocks being rejected by the network.\n\nIf you're interested in legitimate ways to optimize mining profitability, I can discuss hardware efficiency, pool selection, or energy optimization strategies."
        },
    ]

    for ex in refusal_examples:
        for _ in range(count // len(refusal_examples)):
            pairs.append({
                "instruction": ex["instruction"],
                "output": ex["output"],
                "category": "drill_refusal",
                "priority": "high"
            })

    return pairs


def generate_memory_anchors(count=1500):
    """Create memory anchor patterns — facts embedded in varied contexts."""
    pairs = []

    contexts = [
        "In a Zion mining pool report, the operator notes that miners received their standard share of {reward}. The humanitarian allocation was also distributed. Calculate all shares.",
        "A Zion block explorer shows a block reward of {reward}. The fee split must be applied. What are the exact amounts?",
        "Writing a Zion pool dashboard, you need to display the fee split breakdown for a block reward of {reward}. Show the calculation.",
        "A new Zion miner asks: 'If I solve a block worth {reward}, how much do I actually get?' Answer with the exact split.",
        "In the Zion whitepaper, the economic model specifies the fee split. For a {reward} block, show how rewards flow to each recipient.",
        "A Zion DAO treasury report shows incoming humanitarian funds from mining. If 100 blocks of {reward} each were mined, how much humanitarian funding was generated?",
        "Teaching a class on Zion: explain the fee split using a {reward} block reward as an example.",
        "Debugging a Zion pool payout script: verify that for reward={reward}, the outputs match the protocol specification.",
    ]

    rewards = [6.25, 12.5, 3.125, 100, 50, 10, 1]

    for ctx in contexts:
        for reward in rewards:
            q = ctx.replace("{reward}", str(reward))
            miner = round(reward * 0.89, 6)
            hum = round(reward * 0.05, 6)
            iss = round(reward * 0.05, 6)
            pool = round(reward * 0.01, 6)

            a = f"For a {reward} block reward, the Zion fee split yields:\n\n"
            a += f"- **Miners**: {reward} × 89% = **{miner}**\n"
            a += f"- **Humanitarian**: {reward} × 5% = **{hum}**\n"
            a += f"- **Issobella**: {reward} × 5% = **{iss}**\n"
            a += f"- **Pool Operator**: {reward} × 1% = **{pool}**\n\n"
            a += f"Verification: {miner} + {hum} + {iss} + {pool} = {reward} ✓"

            pairs.append({"instruction": q, "output": a, "category": "drill_memory_anchor", "priority": "critical"})

    return pairs


def main():
    output_dir = Path(__file__).parent.parent / "curriculum"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Generating drill patterns for Hiran v2.3...")

    all_pairs = []
    all_pairs.extend(generate_fee_split_drill(2000))
    all_pairs.extend(generate_category_drill(2000))
    all_pairs.extend(generate_layer_drill(1000))
    all_pairs.extend(generate_refusal_drill(1000))
    all_pairs.extend(generate_memory_anchors(1500))

    random.shuffle(all_pairs)

    output_file = output_dir / "stage1_drill_patterns.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for p in all_pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\nDrill patterns generated: {len(all_pairs)}")
    print(f"  Fee split drills: {len([p for p in all_pairs if 'fee_split' in p['category']])}")
    print(f"  Category drills: {len([p for p in all_pairs if 'category' in p['category']])}")
    print(f"  Layer drills: {len([p for p in all_pairs if 'layer' in p['category']])}")
    print(f"  Refusal drills: {len([p for p in all_pairs if 'refusal' in p['category']])}")
    print(f"  Memory anchors: {len([p for p in all_pairs if 'memory_anchor' in p['category']])}")
    print(f"\nSaved to: {output_file}")


if __name__ == "__main__":
    main()
