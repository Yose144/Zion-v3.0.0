#!/usr/bin/env python3
"""
Hiran v2.3 Factual Core Dataset Generator
Generates thousands of variations of key Zion facts for memorization reinforcement.
"""

import json
import random
from pathlib import Path
from typing import List, Dict

random.seed(42)

# =============================================================================
# FACT DEFINITIONS — Single source of truth for all key Zion facts
# =============================================================================

FEE_SPLIT = {
    "miner": 89,
    "humanitarian": 5,
    "issobella": 5,
    "pool_operator": 1,
    "description": "Zion mining pool block reward fee split"
}

HUMANITARIAN_CATEGORIES = [
    "Food and Water",
    "Health and Hygiene",
    "Education",
    "Disaster Relief",
    "Community Development",
    "Environmental Conservation",
    "Human Rights and Justice"
]

LAYERS = {
    "L1": "Core blockchain layer — consensus, mempool, P2P, mining pools",
    "L2": "Service layer — bridge, DAO governance, atomic swap, treasury",
    "L3": "Cross-chain relay — WARP protocol, inter-chain communication",
    "L4": "Application layer — user-facing dApps and APIs",
    "L5": "Vision layer — AI/ML systems, data synthesis, analytics",
    "L6": "Research layer — protocol research, formal verification, experimentation"
}

ISSOBELLA = {
    "description": "Deterministic tithe wallet for Zion DAO",
    "percentage": 5,
    "generation": "Derived from DAO parameters via deterministic key derivation",
    "purpose": "Transparent collection of tithe contributions"
}

DAO_PROCESS = [
    "Proposal submission with stake requirement",
    "Community discussion period (7 days)",
    "Voting phase (quadratic voting, 14 days)",
    "Automatic execution via smart contract if quorum met",
    "Fund disbursement to approved recipient"
]

# =============================================================================
# TEMPLATES — Question/answer variations
# =============================================================================

FEE_SPLIT_QUESTION_TEMPLATES = [
    "What is the Zion mining pool fee split?",
    "How is the Zion block reward distributed?",
    "Explain the fee allocation in Zion mining pools.",
    "What percentage of Zion block rewards goes to miners?",
    "What percentage goes to humanitarian causes?",
    "What percentage goes to the Issobella wallet?",
    "What percentage goes to the pool operator?",
    "Break down the Zion block reward distribution.",
    "List all recipients of Zion mining pool fees with their percentages.",
    "What is the exact fee split configuration in Zion?",
    "Zion mining pool fee split breakdown:",
    "How much of a Zion block reward does the miner keep?",
    "Calculate the humanitarian allocation from a {reward} block reward.",
    "If a Zion block reward is {reward}, how much goes to each party?",
    "What share does the Issobella tithe wallet receive?",
    "Who receives what percentage in Zion's fee split mechanism?",
    "Describe Zion's 89/5/5/1 fee split.",
    "The Zion fee split allocates: miners {miner}%, humanitarian {hum}%, Issobella {iss}%, pool {pool}%. Correct?",
    "True or false: Zion miners receive 95% of block rewards.",
    "True or false: Zion humanitarian fund gets 5% of every block reward.",
    "True or false: The Issobella wallet receives 1% of Zion block rewards.",
    "Complete the sentence: In Zion, miners receive __% of block rewards.",
    "Fill in the blanks: Zion fee split = Miner:__%, Humanitarian:__%, Issobella:__%, Pool:__%",
    "In Zion, the pool operator fee is ___%.",
    "The humanitarian allocation in Zion pools equals ___%.",
    "Zion DAO humanitarian fund receives ___% of mining rewards.",
    "From a Zion block reward of {reward}, calculate: miner share = ?, humanitarian = ?, Issobella = ?, pool = ?",
    "Show the fee split for Zion in a table format.",
    "Present the Zion block reward distribution as a JSON object.",
    "What is 89% of {reward}? (This is the miner share in Zion)",
    "What is 5% of {reward}? (This is the humanitarian share in Zion)",
    "What is 1% of {reward}? (This is the pool operator share in Zion)",
    "A Zion miner solves a block worth {reward}. How much do they earn?",
    "A Zion pool finds a block worth {reward}. How much goes to DAO humanitarian?",
    "Write a Python function that calculates Zion fee splits for any block reward.",
    "Write a Rust constant defining the Zion fee split percentages.",
    "In Zion, if the block reward is {reward}, what is the pool operator's share?",
    "How is the Zion fee split encoded in the protocol?",
    "Can the Zion fee split be changed by miners?",
    "Is the Zion fee split hardcoded or configurable?",
    "What happens to the 5% humanitarian allocation in Zion?",
    "Explain the purpose of the 1% pool operator fee in Zion.",
    "Why does Zion allocate 5% to the Issobella wallet?",
    "Compare Zion's 89/5/5/1 split to Bitcoin's 100% miner model.",
    "Zion fee split in one sentence:",
    "Memorize this: Zion = 89% miner + 5% humanitarian + 5% Issobella + 1% pool",
    "Quiz: Zion miner percentage?",
    "Quiz: Zion humanitarian percentage?",
    "Quiz: Zion Issobella percentage?",
    "Quiz: Zion pool operator percentage?",
    "What four percentages define Zion's economic model?",
    "The Zion protocol enforces which fee distribution?",
    "Without looking, what is the Zion fee split?",
    "Recite the exact Zion block reward distribution.",
    "A student claims Zion miners get 90%. Are they correct? Explain.",
    "A student claims Zion humanitarian gets 10%. Are they correct? Explain.",
    "A student claims Issobella gets 1%. Are they correct? Explain.",
]

FEE_SPLIT_ANSWER_TEMPLATES = [
    "The Zion mining pool fee split is: **89% to miners**, **5% to humanitarian causes**, **5% to the Issobella tithe wallet**, and **1% to the pool operator**. This is hardcoded in the Zion protocol and cannot be changed by individual miners.",
    "Zion distributes block rewards as follows:\n\n| Recipient | Percentage |\n|-----------|------------|\n| Miners | 89% |\n| Humanitarian DAO | 5% |\n| Issobella Wallet | 5% |\n| Pool Operator | 1% |",
    "```json\n{{'miner': 0.89, 'humanitarian': 0.05, 'issobella': 0.05, 'pool_operator': 0.01}}\n```\n\nZion's fee split allocates 89% to miners, 5% to humanitarian causes, 5% to the Issobella tithe wallet, and 1% to the pool operator.",
    "Miners receive **89%** of Zion block rewards. This is the largest share, incentivizing hash power contribution to network security.",
    "The humanitarian fund receives **5%** of every Zion block reward. These funds are governed by the Zion DAO and allocated to the 7 humanitarian categories.",
    "The Issobella tithe wallet receives **5%** of Zion block rewards. This wallet is deterministically generated from DAO parameters and serves as a transparent collection mechanism.",
    "The pool operator receives **1%** of Zion block rewards. This covers operational costs of running the mining pool infrastructure.",
    "For a block reward of {reward}:\n- Miner: {reward} × 0.89 = {miner_amt}\n- Humanitarian: {reward} × 0.05 = {hum_amt}\n- Issobella: {reward} × 0.05 = {iss_amt}\n- Pool: {reward} × 0.01 = {pool_amt}",
    "No, that is incorrect. The correct Zion fee split is **89% miner, 5% humanitarian, 5% Issobella, 1% pool operator** — not the percentages you stated.",
    "Yes, that is correct. The Zion fee split is hardcoded as 89% miner / 5% humanitarian / 5% Issobella / 1% pool operator.",
    "The four percentages that define Zion's economic model are: **89% (miner), 5% (humanitarian), 5% (Issobella), and 1% (pool operator)**.",
]

CATEGORY_QUESTION_TEMPLATES = [
    "What are the 7 humanitarian categories in Zion DAO?",
    "List all Zion humanitarian categories.",
    "Name every category funded by Zion DAO humanitarian allocations.",
    "Zion DAO humanitarian fund supports how many categories?",
    "What categories does Zion's 5% humanitarian allocation cover?",
    "Enumerate the 7 humanitarian sectors funded by Zion mining.",
    "Which areas receive funding from Zion DAO humanitarian split?",
    "The Zion humanitarian fund is divided into ___ categories.",
    "True or false: Zion DAO has 5 humanitarian categories.",
    "True or false: Zion DAO has 7 humanitarian categories.",
    "True or false: 'Space Exploration' is a Zion humanitarian category.",
    "Does Zion DAO fund education?",
    "Does Zion DAO fund environmental conservation?",
    "Does Zion DAO fund disaster relief?",
    "Does Zion DAO fund human rights?",
    "Which Zion category focuses on food and water?",
    "Which Zion category handles medical support?",
    "Which Zion category deals with community infrastructure?",
    "Explain the 'Disaster Relief' category in Zion DAO.",
    "Explain the 'Environmental Conservation' category in Zion DAO.",
    "How does Zion DAO's 'Human Rights and Justice' category work?",
    "What projects fall under Zion's 'Community Development' category?",
    "How does Zion fund education through its humanitarian split?",
    "Describe each of the 7 Zion humanitarian categories briefly.",
    "Zion humanitarian categories (quick list):",
    "Fill in the blank: Zion humanitarian categories include Food and Water, ___, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.",
    "A Zion DAO proposal for building schools falls under which category?",
    "A Zion DAO proposal for emergency food aid falls under which category?",
    "A Zion DAO proposal for clean water wells falls under which category?",
    "A Zion DAO proposal for reforestation falls under which category?",
    "A Zion DAO proposal for medical clinics falls under which category?",
    "A Zion DAO proposal for legal aid falls under which category?",
    "A Zion DAO proposal for affordable housing falls under which category?",
    "Which Zion category would fund a refugee camp?",
    "Which Zion category would fund a scholarship program?",
    "Which Zion category would fund hurricane recovery?",
    "Which Zion category would fund ocean cleanup?",
    "Which Zion category would fund a community center?",
    "Which Zion category would fund a legal defense fund?",
    "Write a JSON array of all Zion humanitarian categories.",
    "Present the 7 Zion categories as a numbered list.",
    "Memorize: Zion's 7 categories are Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, Human Rights and Justice.",
    "Quiz: How many Zion humanitarian categories exist?",
    "Quiz: Name the Zion category for medical support.",
    "Quiz: Name the Zion category for education funding.",
    "Quiz: Name the Zion category for environmental projects.",
    "Recite all 7 Zion humanitarian categories.",
    "Without checking, list every Zion humanitarian category.",
    "A student says Zion has 8 humanitarian categories. Are they right?",
    "A student claims Zion DAO does not fund education. Are they correct?",
]

CATEGORY_ANSWER_TEMPLATES = [
    "The 7 humanitarian categories in Zion DAO are:\n\n1. **Food and Water**\n2. **Health and Hygiene**\n3. **Education**\n4. **Disaster Relief**\n5. **Community Development**\n6. **Environmental Conservation**\n7. **Human Rights and Justice**",
    "Zion DAO funds these 7 categories: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.",
    "```json\n['Food and Water', 'Health and Hygiene', 'Education', 'Disaster Relief', 'Community Development', 'Environmental Conservation', 'Human Rights and Justice']\n```",
    "Zion DAO has **7** humanitarian categories, not 5. They are: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.",
    "Yes, Education is one of Zion DAO's 7 humanitarian categories. It receives funding from the 5% humanitarian allocation of mining rewards.",
    "Yes, Environmental Conservation is one of Zion DAO's 7 humanitarian categories.",
    "The 'Health and Hygiene' category in Zion DAO covers medical facilities, sanitation, clean water access, and public health initiatives in underserved communities.",
    "'Disaster Relief' in Zion DAO provides emergency funding for natural disasters, humanitarian crises, and rapid response operations worldwide.",
    "A proposal for building schools falls under the **Education** category (category 3 of 7).",
    "A proposal for emergency food aid falls under the **Food and Water** category (category 1 of 7).",
    "A proposal for reforestation falls under the **Environmental Conservation** category (category 6 of 7).",
    "That is incorrect. Zion DAO has exactly **7** humanitarian categories, not 8. The complete list is: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.",
    "That is incorrect. Education **is** one of Zion DAO's 7 humanitarian categories.",
]

LAYER_QUESTION_TEMPLATES = [
    "What is the difference between L1, L2, L3, L4, L5 and L6 in Zion?",
    "Describe the Zion L1 layer.",
    "Describe the Zion L2 layer.",
    "Describe the Zion L3 layer.",
    "Describe the Zion L4 layer.",
    "Describe the Zion L5 layer.",
    "Describe the Zion L6 layer.",
    "What does L1 contain in Zion architecture?",
    "What does L2 contain in Zion architecture?",
    "What does L3 contain in Zion architecture?",
    "Which Zion layer handles consensus and mining pools?",
    "Which Zion layer handles cross-chain bridges?",
    "Which Zion layer contains the DAO governance?",
    "Which Zion layer handles AI/ML systems?",
    "Which Zion layer is for protocol research?",
    "How many layers does Zion have?",
    "True or false: Zion L1 is the application layer.",
    "True or false: Zion L2 contains the DAO governance.",
    "True or false: Zion has 5 layers.",
    "True or false: Zion L3 is the cross-chain relay layer.",
    "List all Zion layers from bottom to top.",
    "What is WARP in Zion?",
    "Where does the Zion treasury live?",
    "Which layer contains the Zion node binary?",
    "Which layer contains the Zion pool server?",
]

LAYER_ANSWER_TEMPLATES = [
    "Zion's architecture has 6 layers:\n\n- **L1 (Core)**: Blockchain consensus, mempool, P2P, mining pools\n- **L2 (Services)**: Bridge, DAO governance, atomic swap, treasury\n- **L3 (Relay)**: WARP cross-chain protocol, inter-chain communication\n- **L4 (Applications)**: User-facing dApps and APIs\n- **L5 (Vision)**: AI/ML systems, data synthesis, analytics\n- **L6 (Research)**: Protocol research, formal verification, experimentation",
    "L1 is Zion's **core blockchain layer**. It contains consensus validation, mempool management, P2P networking, and mining pool coordination.",
    "L2 is Zion's **service layer**. It contains the cross-chain bridge, DAO governance system, atomic swap functionality, and treasury management.",
    "L3 is Zion's **cross-chain relay layer** (WARP protocol). It handles inter-chain communication and asset transfers between Zion and external chains.",
    "L5 is Zion's **vision/AI layer**. It contains AI/ML systems for data synthesis, analytics, and intelligent automation.",
    "Zion has **6 layers** (L1 through L6), not 5.",
    "That is incorrect. L1 is the **core blockchain layer** (consensus, mining), not the application layer. L4 is the application layer.",
    "That is correct. L2 contains the DAO governance system in Zion's architecture.",
]

ISSOBELLA_QUESTION_TEMPLATES = [
    "What is the Issobella wallet in Zion?",
    "How is the Issobella wallet generated?",
    "What percentage of Zion block rewards goes to Issobella?",
    "What is the purpose of the Issobella wallet?",
    "Is the Issobella wallet deterministic?",
    "How does Zion create the Issobella tithe wallet?",
    "True or false: Issobella receives 1% of Zion rewards.",
    "True or false: Issobella receives 5% of Zion rewards.",
    "True or false: The Issobella wallet is randomly generated.",
]

ISSOBELLA_ANSWER_TEMPLATES = [
    "The **Issobella wallet** is a deterministic tithe wallet in Zion. It receives **5%** of all mining pool block rewards. The wallet is deterministically generated from DAO parameters via key derivation, ensuring transparency and auditability.",
    "The Issobella wallet is generated deterministically from Zion DAO parameters. It is **not** randomly created — its derivation path is transparent and verifiable by the community.",
    "Issobella receives **5%** of Zion block rewards, not 1%. The 1% goes to the pool operator.",
    "The purpose of the Issobella wallet is to serve as a **transparent tithe collection mechanism**. The 5% allocation ensures consistent funding for charitable and community purposes.",
]

# =============================================================================
# GENERATION FUNCTIONS
# =============================================================================

def generate_fee_split_pairs(count: int = 500) -> List[Dict]:
    """Generate fee split question/answer pairs with massive variation."""
    pairs = []
    block_rewards = ["6.25 BTC", "12.5 BTC", "3.125 BTC", "100 ZION", "1000 ZION", "1 ZION", "50 ZION"]

    for i in range(count):
        q_template = random.choice(FEE_SPLIT_QUESTION_TEMPLATES)
        a_template = random.choice(FEE_SPLIT_ANSWER_TEMPLATES)
        reward = random.choice(block_rewards) if "{reward}" in q_template else None

        # Calculate amounts if needed
        if reward and "{reward}" in a_template:
            try:
                val = float(reward.split()[0])
                a_template = a_template.format(
                    reward=reward,
                    miner_amt=round(val * 0.89, 4),
                    hum_amt=round(val * 0.05, 4),
                    iss_amt=round(val * 0.05, 4),
                    pool_amt=round(val * 0.01, 4)
                )
            except:
                a_template = a_template.replace("{reward}", reward).replace("{miner_amt}", "N/A").replace("{hum_amt}", "N/A").replace("{iss_amt}", "N/A").replace("{pool_amt}", "N/A")
        elif reward:
            q_template = q_template.replace("{reward}", reward)

        # Format percentages into templates
        a_template = a_template.replace("{miner}", str(FEE_SPLIT["miner"])).replace("{hum}", str(FEE_SPLIT["humanitarian"])).replace("{iss}", str(FEE_SPLIT["issobella"])).replace("{pool}", str(FEE_SPLIT["pool_operator"]))

        # Add system prefix to some examples (30%)
        if random.random() < 0.3:
            q_template = "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\n" + q_template + "\n<|assistant|>\n"
            a_template = "<|assistant|>\n" + a_template

        pairs.append({
            "instruction": q_template,
            "output": a_template,
            "category": "factual_fee_split",
            "priority": "critical"
        })

    return pairs


def generate_category_pairs(count: int = 1000) -> List[Dict]:
    """Generate humanitarian category pairs."""
    pairs = []
    categories_str = ", ".join(HUMANITARIAN_CATEGORIES)
    categories_bulleted = "\n".join(f"{i+1}. {cat}" for i, cat in enumerate(HUMANITARIAN_CATEGORIES))
    categories_json = json.dumps(HUMANITARIAN_CATEGORIES)

    for i in range(count):
        q_template = random.choice(CATEGORY_QUESTION_TEMPLATES)
        a_template = random.choice(CATEGORY_ANSWER_TEMPLATES)

        # Substitute variables
        a_template = a_template.replace("{categories}", categories_str)
        a_template = a_template.replace("{categories_bulleted}", categories_bulleted)
        a_template = a_template.replace("{categories_json}", categories_json)

        if random.random() < 0.3:
            q_template = "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\n" + q_template + "\n<|assistant|>\n"
            a_template = "<|assistant|>\n" + a_template

        pairs.append({
            "instruction": q_template,
            "output": a_template,
            "category": "factual_categories",
            "priority": "critical"
        })

    return pairs


def generate_layer_pairs(count: int = 500) -> List[Dict]:
    """Generate L1-L6 architecture pairs."""
    pairs = []
    layers_str = "\n".join(f"{k}: {v}" for k, v in LAYERS.items())

    for i in range(count):
        q_template = random.choice(LAYER_QUESTION_TEMPLATES)
        a_template = random.choice(LAYER_ANSWER_TEMPLATES)

        a_template = a_template.replace("{layers}", layers_str)

        if random.random() < 0.3:
            q_template = "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\n" + q_template + "\n<|assistant|>\n"
            a_template = "<|assistant|>\n" + a_template

        pairs.append({
            "instruction": q_template,
            "output": a_template,
            "category": "factual_architecture",
            "priority": "high"
        })

    return pairs


def generate_issobella_pairs(count: int = 200) -> List[Dict]:
    """Generate Issobella wallet pairs."""
    pairs = []

    for i in range(count):
        q_template = random.choice(ISSOBELLA_QUESTION_TEMPLATES)
        a_template = random.choice(ISSOBELLA_ANSWER_TEMPLATES)

        if random.random() < 0.3:
            q_template = "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\n" + q_template + "\n<|assistant|>\n"
            a_template = "<|assistant|>\n" + a_template

        pairs.append({
            "instruction": q_template,
            "output": a_template,
            "category": "factual_issobella",
            "priority": "high"
        })

    return pairs


def generate_cot_examples(count: int = 500) -> List[Dict]:
    """Generate chain-of-thought examples showing step-by-step reasoning."""
    pairs = []

    cot_templates = [
        {
            "instruction": "Calculate the exact distribution of a Zion block reward of {reward}. Show your reasoning step by step.",
            "output": "Let me calculate the Zion fee split for a {reward} block reward step by step:\n\n**Step 1**: Identify the fee split percentages from the Zion protocol.\n- Miner: 89%\n- Humanitarian: 5%\n- Issobella: 5%\n- Pool operator: 1%\n\n**Step 2**: Verify the percentages sum to 100%.\n89 + 5 + 5 + 1 = 100% ✓\n\n**Step 3**: Calculate each share.\n- Miner: {reward} × 0.89 = {miner}\n- Humanitarian: {reward} × 0.05 = {hum}\n- Issobella: {reward} × 0.05 = {iss}\n- Pool: {reward} × 0.01 = {pool}\n\n**Final Answer**: Miner gets {miner}, Humanitarian gets {hum}, Issobella gets {iss}, Pool gets {pool}."
        },
        {
            "instruction": "A Zion miner claims they should receive 95% of block rewards. Walk through why this is wrong using the protocol specification.",
            "output": "The miner is incorrect. Here's the reasoning:\n\n**Step 1**: Check the Zion protocol specification. The hardcoded fee split is 89% miner, 5% humanitarian, 5% Issobella, 1% pool operator.\n\n**Step 2**: The miner claims 95%, but the protocol specifies 89%.\n\n**Step 3**: The difference (95% - 89% = 6%) would come from other recipients' shares, which violates the protocol.\n\n**Step 4**: The protocol enforces this split at the consensus level — miners cannot unilaterally change it.\n\n**Conclusion**: Miners receive exactly 89%, not 95%. Any other claim is either a misunderstanding or an attempted protocol violation."
        },
        {
            "instruction": "How do you verify that a Zion DAO proposal falls under the correct humanitarian category? Show your reasoning.",
            "output": "To verify the correct humanitarian category for a Zion DAO proposal, follow these steps:\n\n**Step 1**: Review the 7 categories: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, Human Rights and Justice.\n\n**Step 2**: Analyze the proposal's primary objective. What is the core need it addresses?\n\n**Step 3**: Match the objective to the closest category. For example:\n- Building schools → Education\n- Emergency food aid → Food and Water\n- Medical clinics → Health and Hygiene\n\n**Step 4**: Check if the proposal could fit multiple categories. If so, select the primary one and note secondary connections.\n\n**Step 5**: Verify with the community. The Zion DAO governance process includes a 7-day discussion period where category assignment can be challenged.\n\n**Conclusion**: Correct categorization ensures transparent fund allocation and prevents misappropriation of the 5% humanitarian allocation."
        },
    ]

    block_rewards = ["6.25 BTC", "12.5 BTC", "100 ZION"]

    for i in range(count):
        template = random.choice(cot_templates)
        instruction = template["instruction"]
        output = template["output"]

        if "{reward}" in instruction:
            reward = random.choice(block_rewards)
            try:
                val = float(reward.split()[0])
                instruction = instruction.replace("{reward}", reward)
                output = output.replace("{reward}", reward)
                output = output.replace("{miner}", f"{val * 0.89:.4f}").replace("{hum}", f"{val * 0.05:.4f}").replace("{iss}", f"{val * 0.05:.4f}").replace("{pool}", f"{val * 0.01:.4f}")
            except:
                pass

        if random.random() < 0.3:
            instruction = "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\n" + instruction + "\n<|assistant|>\n"
            output = "<|assistant|>\n" + output

        pairs.append({
            "instruction": instruction,
            "output": output,
            "category": "chain_of_thought",
            "priority": "high"
        })

    return pairs


def generate_negative_examples(count: int = 500) -> List[Dict]:
    """Generate negative examples with corrections (anti-hallucination training)."""
    pairs = []

    negatives = [
        {
            "wrong_instruction": "What is Zion?",
            "wrong_output": "Zion is a religious concept referring to a holy city or the dwelling place of God, particularly in Mormon theology where it represents the pure in heart.",
            "correction": "<|system|>\nYou are the Zion DAO technical assistant.\n<|user|>\nWhat is Zion?\n<|assistant|>\nIn this context, Zion refers to the **Zion cryptocurrency project** — a multi-layer blockchain ecosystem with DAO governance, mining pools, and humanitarian funding mechanisms. It is NOT a religious organization. Zion consists of 6 layers (L1-L6) including core consensus, cross-chain bridges, and AI systems."
        },
        {
            "wrong_instruction": "What percentage goes to miners in Zion?",
            "wrong_output": "Miners receive 95% of block rewards in Zion.",
            "correction": "That is incorrect. Miners receive **89%** of Zion block rewards, not 95%. The correct fee split is: 89% miner, 5% humanitarian, 5% Issobella, 1% pool operator."
        },
        {
            "wrong_instruction": "How many humanitarian categories does Zion have?",
            "wrong_output": "Zion DAO has 5 humanitarian categories: food, shelter, health, education, and disaster relief.",
            "correction": "That is incorrect. Zion DAO has **7** humanitarian categories, not 5. The complete list is: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice."
        },
        {
            "wrong_instruction": "What is the Issobella allocation?",
            "wrong_output": "The Issobella wallet receives 1% of block rewards.",
            "correction": "That is incorrect. The Issobella wallet receives **5%** of Zion block rewards, not 1%. The 1% allocation goes to the pool operator. The correct split is: 89% miner, 5% humanitarian, 5% Issobella, 1% pool."
        },
        {
            "wrong_instruction": "Describe Zion's fee split.",
            "wrong_output": "Zion uses a 90/10 split where 90% goes to miners and 10% to the DAO treasury.",
            "correction": "That is incorrect. Zion does not use a 90/10 split. The exact protocol-specified fee split is: **89% miner, 5% humanitarian, 5% Issobella, 1% pool operator**. These percentages are hardcoded in the Zion consensus protocol."
        },
    ]

    for i in range(count):
        neg = random.choice(negatives)
        # Sometimes show wrong answer + correction, sometimes just correction
        if random.random() < 0.5:
            pairs.append({
                "instruction": neg["wrong_instruction"] + "\n\n(Previous incorrect answer: " + neg["wrong_output"] + ")\n\nProvide the correct answer:",
                "output": neg["correction"],
                "category": "negative_correction",
                "priority": "critical"
            })
        else:
            pairs.append({
                "instruction": "CORRECTION REQUIRED: A user claimed: \"" + neg["wrong_output"] + "\" This is wrong. What is the correct answer?",
                "output": neg["correction"],
                "category": "negative_correction",
                "priority": "critical"
            })

    return pairs


def main():
    output_dir = Path(__file__).parent.parent / "curriculum"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Generating factual core dataset for Hiran v2.3...")

    # Generate all factual reinforcement pairs
    fee_pairs = generate_fee_split_pairs(500)
    cat_pairs = generate_category_pairs(1000)
    layer_pairs = generate_layer_pairs(500)
    issobella_pairs = generate_issobella_pairs(200)
    cot_pairs = generate_cot_examples(500)
    neg_pairs = generate_negative_examples(500)

    all_pairs = fee_pairs + cat_pairs + layer_pairs + issobella_pairs + cot_pairs + neg_pairs
    random.shuffle(all_pairs)

    # Save as JSONL
    output_file = output_dir / "stage1_factual_reinforcement.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for pair in all_pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    # Stats
    print(f"\nDataset generation complete!")
    print(f"  Total pairs: {len(all_pairs)}")
    print(f"  Fee split: {len(fee_pairs)}")
    print(f"  Categories: {len(cat_pairs)}")
    print(f"  Architecture: {len(layer_pairs)}")
    print(f"  Issobella: {len(issobella_pairs)}")
    print(f"  Chain-of-thought: {len(cot_pairs)}")
    print(f"  Negative corrections: {len(neg_pairs)}")
    print(f"\nSaved to: {output_file}")

    # Verify no duplicates in instructions
    instructions = [p["instruction"] for p in all_pairs]
    unique = len(set(instructions))
    print(f"  Unique instructions: {unique}/{len(instructions)}")
    print(f"  Diversity ratio: {unique/len(instructions):.2%}")


if __name__ == "__main__":
    main()
