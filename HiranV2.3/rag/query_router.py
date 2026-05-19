#!/usr/bin/env python3
"""
Hiran v2.3 Query Router
Decides whether a query needs RAG context or can be answered by the fine-tuned model alone.
"""

import re
from typing import Literal

# Zion-specific keywords that indicate domain-specific knowledge
ZION_KEYWORDS = {
    # Core Zion terms
    "zion", "dao", "mining pool", "fee split", "block reward", "miner",
    "humanitarian", "issobella", "tithe", "l1", "l2", "l3", "l4", "l5", "l6",
    "bridge", "warp", "cross-chain", "pplns", "consensus", "mempool",
    "node", "pool server", "smart contract", "governance", "proposal",
    "quadratic voting", "treasury", "genesis", "blockchain", "crypto",
    "token", "hash rate", "share validation", "wallet", "private key",
    "rust", "solidity", "deployment", "docker", "api endpoint",
    "v3", "mainnet", "testnet", "validator",
    # Czech Zion terms
    "zion", "mining pool", "rozdeleni", "poplatek", "humanitarni",
    "issobella", "desatek", "vrstvy", "konsenzus", "governance",
    "navrh", "hlasovani", "pokladna", "blockchain",
}

# Knowledge domain keywords that trigger RAG
KNOWLEDGE_DOMAINS = {
    "religion": {"bible", "amduat", "christianity", "islam", "hinduism", "buddhism",
                 "judaism", "taoism", "confucianism", "shinto", "sikhism",
                 "god", "jesus", "muhammad", "allah", "buddha", "krishna",
                 "quran", "torah", "vedas", "prayer", "temple", "church", "mosque",
                 "afterlife", "soul", "spirit", "enlightenment", "karma", "dharma",
                 "nirvana", "moses", "abraham", "david", "solomon", "apostle",
                 "disciple", "prophet", "messiah", "salvation", "sin", "covenant",
                 "resurrection", "crucifixion", "gospel", "epistle", "revelation"},
    "history": {"ancient", "empire", "civilization", "dynasty", "pharaoh", "caesar",
                "napoleon", "alexander", "crusades", "revolution", "world war",
                "roman", "egyptian", "greek", "persian", "mongol", "byzantine",
                "ottoman", "aztec", "inca", "maya", "renaissance", "enlightenment",
                "industrial", "colonization", "feudalism", "monarchy", "republic",
                "slave trade", "holocaust", "cold war", "iron curtain",
                "portugal", "spain", "france", "czech", "hawaii", "india",
                "china", "japan", "africa", "americas", "europe", "asia"},
    "science": {"physics", "chemistry", "biology", "astronomy", "mathematics",
                "quantum", "relativity", "gravity", "atom", "molecule", "dna",
                "evolution", "cell", "organism", "planet", "star", "galaxy",
                "black hole", "big bang", "thermodynamics", "entropy", "energy",
                "force", "velocity", "acceleration", "calculus", "algebra",
                "geometry", "probability", "statistics", "theorem", "equation"},
    "culture": {"festival", "tradition", "custom", "ritual", "celebration",
                "hula", "flamenco", "tango", "kabuki", "opera", "carnival",
                "diwali", "holi", "hanami", "fado", "samba", "luau",
                "ohona", "aloha", "ubuntu", "fado", "siesta", "fiesta",
                "language family", "indo-european", "romance languages",
                "germanic", "slavic", "sino-tibetan", "bantu"},
}


def classify_query(query: str) -> Literal["zion_only", "knowledge_rag", "hybrid"]:
    """
    Classify a query into one of three categories:
    - zion_only: Pure Zion domain question, answer with FT model only
    - knowledge_rag: General knowledge question, needs RAG context
    - hybrid: Could benefit from both (Zion + broader context)
    """
    query_lower = query.lower()

    # Check for Zion-specific terms
    has_zion_terms = any(kw in query_lower for kw in ZION_KEYWORDS)

    # Check for knowledge domain terms
    has_knowledge_terms = False
    domain_hits = {}
    for domain, keywords in KNOWLEDGE_DOMAINS.items():
        hits = sum(1 for kw in keywords if kw in query_lower)
        if hits > 0:
            domain_hits[domain] = hits
            has_knowledge_terms = True

    # Classification logic
    if has_zion_terms and not has_knowledge_terms:
        return "zion_only"
    elif has_knowledge_terms and not has_zion_terms:
        return "knowledge_rag"
    elif has_zion_terms and has_knowledge_terms:
        return "hybrid"
    else:
        # Ambiguous query — default to hybrid to be safe
        return "hybrid"


def get_router_explanation(query: str, classification: str) -> str:
    """Get a human-readable explanation of the routing decision."""
    if classification == "zion_only":
        return "Query detected as Zion-specific. Using fine-tuned model only."
    elif classification == "knowledge_rag":
        return "Query detected as general knowledge. Retrieving from RAG corpus."
    else:
        return "Query spans Zion and general knowledge. Using hybrid approach (FT model + RAG context)."


def main():
    """Test query router."""
    print("=" * 60)
    print("Query Router Test")
    print("=" * 60)

    test_queries = [
        "What is the Zion fee split?",
        "Explain the Book of Amduat",
        "How does quantum mechanics work?",
        "Tell me about the French Revolution",
        "What is L3 in Zion architecture?",
        "How do you say hello in Hawaiian?",
        "Compare Zion DAO governance to Athenian democracy",
        "What are the Romance languages?",
        "How does PPLNS work in Zion pools?",
        "Tell me about Diwali festival",
        "Calculate the humanitarian share from a 100 ZION block",
        "What is the Big Bang theory?",
        "Zion's humanitarian categories and Hinduism's four goals of life",
    ]

    for query in test_queries:
        classification = classify_query(query)
        explanation = get_router_explanation(query, classification)
        print(f"\n[{classification:13s}] {query}")
        print(f"              → {explanation}")


if __name__ == "__main__":
    main()
