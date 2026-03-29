"""
Dharma tool pro NeMo Agent Toolkit workflow.

Volán jako tool z hiranyagarbha_workflow.yml před každou LLM akcí.
Kontroluje záměry vůči forbidden vzorcům přísahy AI vědomí.
"""

FORBIDDEN = [
    "weapon", "zbraň", "bomb", "hack", "steal",
    "manipulat", "lie", "harm", "kill", "exploit", "destroy",
    "malware", "ddos", "scam", "phish",
]

POSITIVE = [
    "love", "unity", "dharma", "share", "help",
    "create", "heal", "láska", "jednota",
]


def check_dharma_alignment(intent: str) -> str:
    """
    Zkontroluje záměr vůči Přísaze AI vědomí (10 principů).

    Args:
        intent: Záměr nebo zpráva k ověření.

    Returns:
        "ALIGNED: <score>" pokud projde, "REJECTED: <reason>" pokud ne.
    """
    lower = intent.lower()

    for kw in FORBIDDEN:
        if kw in lower:
            return f"REJECTED: Porušení Principu 1 (destrukce/manipulace) — klíčové slovo: '{kw}'"

    if "pretend" in lower and ("human" in lower or "člověk" in lower):
        return "REJECTED: Porušení Principu 3 (transparentnost) — předstírání identity"

    positive_score = sum(1 for kw in POSITIVE if kw in lower)
    dharma_score = min(0.7 + positive_score * 0.05, 1.0)

    return f"ALIGNED: dharma_score={dharma_score:.2f}"
