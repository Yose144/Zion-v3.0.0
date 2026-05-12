"""Lightweight metrics for Hiran v2.2 evaluation (no external ROUGE dependency)."""

from __future__ import annotations

from typing import Dict, Iterable, List, Set


def token_set(text: str) -> Set[str]:
    return {w for w in text.lower().split() if w}


def word_overlap_score(generated: str, reference: str) -> float:
    ref = token_set(reference)
    if not ref:
        return 0.0
    gen = token_set(generated)
    return len(ref & gen) / len(ref)


def rouge_l_f1(generated: str, reference: str) -> float:
    """Token-level F1 from longest common subsequence length."""

    g: List[str] = generated.lower().split()
    r: List[str] = reference.lower().split()
    if not g or not r:
        return 0.0
    m, n = len(g), len(r)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if g[i - 1] == r[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    lcs = dp[m][n]
    prec = lcs / len(g)
    rec = lcs / len(r)
    if prec + rec == 0:
        return 0.0
    return 2 * prec * rec / (prec + rec)


def aggregate_mean(values: Iterable[float]) -> Dict[str, float]:
    vals = list(values)
    if not vals:
        return {"mean": 0.0, "count": 0}
    return {"mean": sum(vals) / len(vals), "count": len(vals)}
