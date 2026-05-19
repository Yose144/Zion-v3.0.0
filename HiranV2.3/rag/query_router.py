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
                "democracy", "athenian", "sparta", "senate", "assembly",
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
    "philosophy": {"philosophy", "socrates", "plato", "aristotle", "kant",
                   "nietzsche", "heidegger", "sartre", "existentialism",
                   "ethics", "morality", "metaphysics", "epistemology",
                   "logic", "reason", "consciousness", "free will",
                   "stoicism", "utilitarianism", "nihilism", "absurd",
                   "confucius", "laozi", "taoism", "buddhist philosophy",
                   "dharma", "enlightenment", "meditation", "zen"},
    "art": {"art", "painting", "sculpture", "architecture", "music", "dance",
            "theater", "film", "cinema", "photography", "literature", "poetry",
            "renaissance", "baroque", "impressionism", "cubism", "surrealism",
            "picasso", "van gogh", "monet", "davinci", "michelangelo",
            "rembrandt", "shakespeare", "mozart", "beethoven", "opera",
            "symphony", "ballet", "modern art", "contemporary art"},
    "medicine": {"medicine", "health", "disease", "virus", "bacteria",
                 "anatomy", "physiology", "surgery", "vaccine", "antibiotic",
                 "cancer", "diabetes", "heart disease", "mental health",
                 "depression", "anxiety", "therapy", "hospital", "doctor",
                 "nurse", "treatment", "diagnosis", "symptom", "epidemic",
                 "pandemic", "nutrition", "exercise", "wellness",
                 "crispr", "gene editing", "genetic engineering", "stem cell"},
    "literature": {"literature", "novel", "poem", "epic", "myth", "fable",
                   "shakespeare", "homer", "dante", "cervantes", "kafka",
                   "tolstoy", "dostoevsky", "joyce", "murakami", "poetry",
                   "prose", "fiction", "non-fiction", "drama", "tragedy",
                   "comedy", "satire", "romance", "sci-fi", "fantasy",
                   "don quixote", "quixote", "moby dick", "odyssey", "iliad",
                   "divine comedy", "inferno", "hamlet", "macbeth", "othello"},
    "mythology": {"myth", "mythology", "god", "goddess", "hero", "demigod",
                  "olympus", "valhalla", "olympian", "norse", "greek myth",
                  "egyptian myth", "hindu myth", "japanese myth", "creation myth",
                  "dragon", "phoenix", "unicorn", "fairy", "elf", "dwarf",
                  "titan", "giant", "monster", "legend", "folklore", "fairy tale"},
    "languages": {"german", "russian", "chinese", "arabic", "japanese",
                  "latin", "greek", "sanskrit", "hebrew", "swahili",
                  "translation", "interpret", "pronunciation", "grammar",
                  "alphabet", "script", "writing system", "vocabulary",
                  "phrase", "greeting", "hello in", "how to say", "say in"},
}


def _keyword_match(text: str, keyword: str) -> bool:
    """Match keyword with word boundaries; allow common suffixes for single words."""
    if " " in keyword:
        return keyword in text
    suffixes = r"(s|es|ing|ed|tion|ism|ity|ment|ness|ly|al|ic|ive|ous|able|ible|ance|ence|ure|age|dom|ship|ist|cy|ize|ise|ward|wards)?"
    pattern = r'\b' + re.escape(keyword) + suffixes + r'\b'
    return bool(re.search(pattern, text))


def classify_query(query: str) -> Literal["zion_only", "knowledge_rag", "hybrid"]:
    """
    Classify a query into one of three categories:
    - zion_only: Pure Zion domain question, answer with FT model only
    - knowledge_rag: General knowledge question, needs RAG context
    - hybrid: Could benefit from both (Zion + broader context)
    """
    query_lower = query.lower()

    # Check for Zion-specific terms
    has_zion_terms = any(_keyword_match(query_lower, kw) for kw in ZION_KEYWORDS)

    # Check for knowledge domain terms
    has_knowledge_terms = False
    domain_hits = {}
    for domain, keywords in KNOWLEDGE_DOMAINS.items():
        hits = sum(1 for kw in keywords if _keyword_match(query_lower, kw))
        if hits > 0:
            domain_hits[domain] = hits
            has_knowledge_terms = True

    # Explicit comparison / contrast queries that mention Zion + another domain
    comparison_words = {"compare", "comparison", "versus", "vs", "difference between",
                        "similarities", "contrast", "like", "unlike", "analogy"}
    is_comparison = any(cw in query_lower for cw in comparison_words)

    # Classification logic
    if has_zion_terms and not has_knowledge_terms:
        return "zion_only"
    elif has_knowledge_terms and not has_zion_terms:
        return "knowledge_rag"
    elif has_zion_terms and has_knowledge_terms:
        # If it's an explicit comparison, definitely hybrid
        if is_comparison:
            return "hybrid"
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
        "What did Nietzsche mean by God is dead?",
        "Tell me about Impressionism in art",
        "How do vaccines work?",
        "Who wrote Don Quixote?",
        "What is Ragnarok in Norse mythology?",
        "How do I say thank you in Japanese?",
        "Explain the Tao Te Ching",
        "What is CRISPR gene editing?",
        "Describe the Egyptian underworld",
        "What are the Greek gods?",
        "How do you write hello in Chinese characters?",
        "Tell me about Swahili language",
    ]

    for query in test_queries:
        classification = classify_query(query)
        explanation = get_router_explanation(query, classification)
        print(f"\n[{classification:13s}] {query}")
        print(f"              -> {explanation}")


if __name__ == "__main__":
    main()
