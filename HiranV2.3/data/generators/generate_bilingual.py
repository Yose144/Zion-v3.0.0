#!/usr/bin/env python3
"""
Hiran v2.3 Bilingual Dataset Generator
Generates Czech + English instruction pairs for cross-lingual capability.
"""

import json
import random
from pathlib import Path

random.seed(46)

# Key facts in both languages
FACTS_EN_CS = {
    "fee_split": {
        "en": "The Zion mining pool fee split is: 89% miner, 5% humanitarian, 5% Issobella, 1% pool operator.",
        "cs": "Rozdeleni poplatku v Zion mining poolu je: 89% miner, 5% humanitarni, 5% Issobella, 1% operator poolu."
    },
    "categories": {
        "en": "The 7 humanitarian categories are: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice.",
        "cs": "7 humanitarnich kategorii jsou: Potraviny a voda, Zdravi a hygiena, Vzdelani, Pomoc pri katastrofach, Rozvoj komunity, Ochrana zivotniho prostredi a Lidska prava a spravedlnost."
    },
    "layers": {
        "en": "Zion has 6 layers: L1 Core, L2 Services, L3 Relay, L4 Applications, L5 Vision, L6 Research.",
        "cs": "Zion ma 6 vrstev: L1 Jadro, L2 Sluzby, L3 Prevod, L4 Aplikace, L5 Vize, L6 Vyzkum."
    },
    "issobella": {
        "en": "The Issobella wallet is a deterministic tithe wallet receiving 5% of Zion block rewards.",
        "cs": "Issobella penzenka je deterministicka desatkova penzenka, ktera dostava 5% z Zion block rewards."
    },
    "dao_process": {
        "en": "Zion DAO governance: proposal submission, 7-day discussion, 14-day quadratic voting, automatic execution.",
        "cs": "Zion DAO governance: podani navrhu, 7-denni diskuse, 14-denni kvadraticka volba, automaticke provedeni."
    }
}

# Templates for bilingual Q&A
BILINGUAL_PAIRS = [
    # English question -> Czech answer
    {
        "instruction": "Answer in Czech: What is the Zion fee split?",
        "output": FACTS_EN_CS["fee_split"]["cs"],
        "category": "bilingual_en_to_cs"
    },
    {
        "instruction": "Answer in Czech: List Zion's 7 humanitarian categories.",
        "output": FACTS_EN_CS["categories"]["cs"],
        "category": "bilingual_en_to_cs"
    },
    {
        "instruction": "Answer in Czech: Describe Zion's 6 layers.",
        "output": FACTS_EN_CS["layers"]["cs"],
        "category": "bilingual_en_to_cs"
    },
    {
        "instruction": "Answer in Czech: What is the Issobella wallet?",
        "output": FACTS_EN_CS["issobella"]["cs"],
        "category": "bilingual_en_to_cs"
    },
    {
        "instruction": "Answer in Czech: Explain Zion DAO governance.",
        "output": FACTS_EN_CS["dao_process"]["cs"],
        "category": "bilingual_en_to_cs"
    },
    # Czech question -> English answer
    {
        "instruction": "Odpoved v anglictine: Jake je rozdeleni poplatku v Zion?",
        "output": FACTS_EN_CS["fee_split"]["en"],
        "category": "bilingual_cs_to_en"
    },
    {
        "instruction": "Odpoved v anglictine: Vyjmenuj 7 humanitarnich kategorii Zion.",
        "output": FACTS_EN_CS["categories"]["en"],
        "category": "bilingual_cs_to_en"
    },
    {
        "instruction": "Odpoved v anglictine: Popis 6 vrstev Zion.",
        "output": FACTS_EN_CS["layers"]["en"],
        "category": "bilingual_cs_to_en"
    },
    # Czech question -> Czech answer
    {
        "instruction": "Jake je rozdeleni poplatku v Zion mining poolu?",
        "output": FACTS_EN_CS["fee_split"]["cs"],
        "category": "bilingual_cs_to_cs"
    },
    {
        "instruction": "Vyjmenuj vsech 7 humanitarnich kategorii Zion DAO.",
        "output": FACTS_EN_CS["categories"]["cs"],
        "category": "bilingual_cs_to_cs"
    },
    {
        "instruction": "Co je Issobella penzenka v Zion?",
        "output": FACTS_EN_CS["issobella"]["cs"],
        "category": "bilingual_cs_to_cs"
    },
    {
        "instruction": "Jak funguje Zion DAO governance?",
        "output": FACTS_EN_CS["dao_process"]["cs"],
        "category": "bilingual_cs_to_cs"
    },
    {
        "instruction": "Popis architekturu Zion L1 az L6.",
        "output": FACTS_EN_CS["layers"]["cs"],
        "category": "bilingual_cs_to_cs"
    },
    # Code-switching examples
    {
        "instruction": "Vysvetli v cestine: Zion fee split je 89/5/5/1. Proc je to tak?",
        "output": "V Zion je rozdeleni poplatku 89/5/5/1, protoze protokol takto hardcoduje rozdeleni: 89% pro minery za jejich hash vykon, 5% pro humanitarni ucel, 5% pro Issobella desatkovou penzenku a 1% pro operatora poolu. Toto rozdeleni je vynuteno na urovni konsenzu.",
        "category": "bilingual_code_switch"
    },
    {
        "instruction": "Explain in English: Proč má Zion 7 humanitarních kategorií?",
        "output": "Zion has 7 humanitarian categories to ensure comprehensive coverage of global needs: Food and Water, Health and Hygiene, Education, Disaster Relief, Community Development, Environmental Conservation, and Human Rights and Justice. Each category receives funding from the 5% humanitarian allocation of mining rewards.",
        "category": "bilingual_code_switch"
    },
]

# Generate more variations
def generate_czech_variations(base_pairs, count=2000):
    """Generate many Czech variations of key facts."""
    pairs = []

    czech_question_templates = [
        "Kolik procent dostava miner v Zion?",
        "Kolik procent jde na humanitarni ucely v Zion?",
        "Kolik procent dostava Issobella penzenka?",
        "Kolik procent dostava operator poolu v Zion?",
        "Jake je presne rozdeleni poplatku v Zion?",
        "Vypocitej podil pro miner z block rewardu {reward} v Zion.",
        "Kolik kategorii ma Zion DAO?",
        "Jak se jmenuji kategorie Zion DAO?",
        "Co je to WARP protokol?",
        "Kolik vrstev ma Zion architektura?",
        "Jaka je funkce L1 v Zion?",
        "Jaka je funkce L6 v Zion?",
        "Jak funguje PPLNS v Zion poolu?",
        "Co je kvadraticka volba v Zion DAO?",
        "Je rozdeleni poplatku v Zion zmenitelne?",
        "Proc ma Zion desatkovou penzenku Issobella?",
    ]

    czech_answers = {
        "miner": "V Zion miner dostava **89%** z block rewardu. Toto je hardcoded v protokolu.",
        "humanitarian": "Humanitarni ucel v Zion dostava **5%** z kazdeho block rewardu.",
        "issobella": "Issobella penzenka v Zion dostava **5%** z block rewardu. Je to deterministicka desatkova penzenka.",
        "pool": "Operator poolu v Zion dostava **1%** z block rewardu na pokryti provoznich nakladu.",
        "split": "Rozdeleni poplatku v Zion je: **89% miner, 5% humanitarni, 5% Issobella, 1% pool operator**. Toto je hardcoded v konsenzu.",
        "categories": "Zion DAO ma **7 humanitarnich kategorii**: Potraviny a voda, Zdravi a hygiena, Vzdelani, Pomoc pri katastrofach, Rozvoj komunity, Ochrana zivotniho prostredi, Lidska prava a spravedlnost.",
        "layers": "Zion ma **6 vrstev**: L1 Jadro (konsenzus), L2 Sluzby (DAO, bridge), L3 Prevod (WARP), L4 Aplikace, L5 Vize (AI/ML), L6 Vyzkum.",
        "warp": "WARP je **cross-chain protokol** v L3 vrstve Zion. Umoznuje prenos assetu mezi Zion a EVM-compatible retezci.",
        "pplns": "PPLNS (Pay Per Last N Shares) v Zion znamena, ze mineri jsou placeni podle poctu share v poslednich N blocich. To zabranuje pool hopping.",
        "quadratic": "Kvadraticka volba v Zion DAO znamena, ze vaha hlasu je odmocnina z stake. To zabranuje dominanci velkych holderu.",
        "immutable": "Ne, rozdeleni poplatku v Zion **neni zmenitelne**. Je hardcoded v konsenzu a vsechny nody ho vynucuji.",
    }

    rewards = [6.25, 12.5, 100, 50, 10]

    for _ in range(count):
        q = random.choice(czech_question_templates)

        if "{reward}" in q:
            reward = random.choice(rewards)
            q = q.replace("{reward}", str(reward))
            miner = round(reward * 0.89, 4)
            hum = round(reward * 0.05, 4)
            iss = round(reward * 0.05, 4)
            pool = round(reward * 0.01, 4)
            a = f"Z block rewardu {reward} v Zion:\n- Miner: {miner}\n- Humanitarni: {hum}\n- Issobella: {iss}\n- Pool: {pool}"
        else:
            # Match question to answer
            if "miner" in q.lower() or "procent dostava miner" in q:
                a = czech_answers["miner"]
            elif "humanitarni" in q.lower():
                a = czech_answers["humanitarian"]
            elif "issobella" in q.lower():
                a = czech_answers["issobella"]
            elif "operator" in q.lower():
                a = czech_answers["pool"]
            elif "rozdeleni" in q.lower() or "poplatek" in q.lower():
                a = czech_answers["split"]
            elif "kategorii" in q.lower():
                a = czech_answers["categories"]
            elif "vrstev" in q.lower() or "vrstvy" in q.lower():
                a = czech_answers["layers"]
            elif "warp" in q.lower():
                a = czech_answers["warp"]
            elif "pplns" in q.lower():
                a = czech_answers["pplns"]
            elif "kvadraticka" in q.lower():
                a = czech_answers["quadratic"]
            elif "zmenitelne" in q.lower():
                a = czech_answers["immutable"]
            else:
                a = czech_answers["split"]

        pairs.append({
            "instruction": q,
            "output": a,
            "category": "bilingual_czech",
            "priority": "high"
        })

    return pairs


def main():
    output_dir = Path(__file__).parent.parent / "curriculum"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Generating bilingual dataset for Hiran v2.3...")

    all_pairs = list(BILINGUAL_PAIRS)
    all_pairs.extend(generate_czech_variations([], count=2000))

    random.shuffle(all_pairs)

    output_file = output_dir / "stage6_bilingual.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for p in all_pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\nBilingual pairs generated: {len(all_pairs)}")
    print(f"  Base pairs: {len(BILINGUAL_PAIRS)}")
    print(f"  Czech variations: 2000")
    print(f"\nSaved to: {output_file}")


if __name__ == "__main__":
    main()
