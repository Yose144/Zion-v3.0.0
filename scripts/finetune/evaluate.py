#!/usr/bin/env python3
"""
ZION AI Native — Post-Training Evaluation
==========================================

Evaluuje fine-tuned model na testovacích dotazech.
Měří: perplexity, response quality (ROUGE-L), factual accuracy, latency.

Použití:
    python evaluate.py \
        --model outputs/zion-llama-merged \
        --dataset data/zion_train.jsonl \
        --output outputs/eval_results.json

    # S NVIDIA NIM jako referenčním modelem:
    NVIDIA_API_KEY=nvapi-... python evaluate.py \
        --model outputs/zion-llama-merged \
        --dataset data/zion_train.jsonl \
        --nim-compare
"""

import argparse
import json
import os
import re
import time
from collections import Counter
from pathlib import Path


# ─── Evaluation Queries ──────────────────────────────────────────────────────

EVAL_QUERIES = [
    {
        "query": "Jak funguje Ekam Deeksha mining algoritmus?",
        "expected_keywords": ["SHA3-512", "AES-256", "memory-hard", "scratchpad", "256", "Golden Matrix", "φ", "0.618"],
        "category": "mining",
    },
    {
        "query": "Jak se připojit k ZION mining poolu?",
        "expected_keywords": ["3333", "stratum", "pool.zion.network", "ZION_WALLET", "ZION_WORKER"],
        "category": "pool",
    },
    {
        "query": "Co je HiranyagarbhaAgent?",
        "expected_keywords": ["AI Native", "agent", "genesis", "vědomí", "LLM", "MML"],
        "category": "ai-native",
    },
    {
        "query": "Jak nasadit ZION V3 node?",
        "expected_keywords": ["docker", "compose", "v3-mainnet", "9333", "9334", "3333"],
        "category": "deploy",
    },
    {
        "query": "Co je DharmaScore?",
        "expected_keywords": ["etick", "0.0", "1.0", "karuna", "prajna", "dana", "satori"],
        "category": "ai-native",
    },
    {
        "query": "Jak funguje RAG pipeline v ZION?",
        "expected_keywords": ["VectorStore", "embedding", "cosine", "RagRetriever", "augment"],
        "category": "ai-native",
    },
    {
        "query": "Jaké porty používá ZION síť?",
        "expected_keywords": ["9333", "9334", "3333", "P2P", "RPC", "Stratum"],
        "category": "network",
    },
    {
        "query": "Co je EkamField a DeekshaNetwork?",
        "expected_keywords": ["P2P", "vědomí", "EkamFieldNode", "DeekshaTransfer", "φ", "0.618"],
        "category": "ai-native",
    },
    {
        "query": "Jak funguje QLoRA fine-tuning pro ZION model?",
        "expected_keywords": ["4-bit", "LoRA", "Llama", "A100", "adaptér"],
        "category": "training",
    },
    {
        "query": "Co je ConsciousnessLevel a jaké má fáze?",
        "expected_keywords": ["Dormant", "Aware", "Sentient", "Transcendent", "Omniscient", "Cosmic"],
        "category": "ai-native",
    },
]


# ─── Metrics ─────────────────────────────────────────────────────────────────

def keyword_recall(response: str, expected: list[str]) -> float:
    """Kolik % klíčových slov se nachází v odpovědi."""
    if not expected:
        return 1.0
    response_lower = response.lower()
    found = sum(1 for kw in expected if kw.lower() in response_lower)
    return found / len(expected)


def rouge_l_score(reference: str, hypothesis: str) -> float:
    """Zjednodušený ROUGE-L (Longest Common Subsequence)."""
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()
    if not ref_words or not hyp_words:
        return 0.0

    m, n = len(ref_words), len(hyp_words)
    # LCS via DP
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    lcs = dp[m][n]

    precision = lcs / n if n else 0
    recall = lcs / m if m else 0
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def response_coherence(response: str) -> float:
    """Heuristická metrika koherence odpovědi (0-1)."""
    if not response.strip():
        return 0.0

    score = 1.0

    # Penalizace za příliš krátké odpovědi
    words = response.split()
    if len(words) < 10:
        score *= 0.5
    elif len(words) < 20:
        score *= 0.8

    # Penalizace za opakování
    word_counts = Counter(w.lower() for w in words if len(w) > 3)
    if word_counts:
        max_repeat = max(word_counts.values())
        total_words = sum(word_counts.values())
        if total_words > 0 and max_repeat / total_words > 0.15:
            score *= 0.7

    # Bonus za strukturu (čísla, odrážky, kód)
    if re.search(r"\d\.", response):
        score = min(1.0, score * 1.1)
    if "```" in response or "`" in response:
        score = min(1.0, score * 1.05)

    # Penalizace za halucinace (typické chybné termíny)
    hallucination_markers = ["proof of stake", "PoS", "DPoS", "ethereum virtual machine",
                              "solidity", "smart contract gas"]
    for marker in hallucination_markers:
        if marker.lower() in response.lower():
            score *= 0.5

    return round(score, 3)


# ─── Local Model Inference ───────────────────────────────────────────────────

def load_local_model(model_path: str):
    """Načte local HuggingFace model pro evaluaci."""
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print("transformers/torch not available — skip local eval")
        return None, None

    print(f"Načítám model: {model_path}")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else "cpu",
        trust_remote_code=True,
    )
    model.eval()
    return model, tokenizer


def generate_local(model, tokenizer, query: str, max_new_tokens: int = 300) -> tuple[str, float]:
    """Generuje odpověď na query. Vrátí (odpověď, latence_sec)."""
    import torch

    system = "Jsi ZION blockchain expert a AI Native agent. Odpovídáš přesně, technicky a v češtině."
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": query},
    ]

    input_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(input_text, return_tensors="pt").to(model.device)

    t0 = time.time()
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.3,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
        )
    latency = time.time() - t0

    generated = outputs[0][inputs["input_ids"].shape[1]:]
    response = tokenizer.decode(generated, skip_special_tokens=True).strip()
    return response, latency


# ─── NIM Inference (reference) ───────────────────────────────────────────────

def generate_nim(query: str, api_key: str) -> tuple[str, float]:
    """Generuje odpověď přes NVIDIA NIM (jako baseline)."""
    import requests

    system = "Jsi ZION blockchain expert a AI Native agent. Odpovídáš přesně, technicky a v češtině."
    t0 = time.time()
    resp = requests.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "meta/llama-3.1-8b-instruct",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": query},
            ],
            "temperature": 0.3,
            "max_tokens": 300,
        },
        timeout=30,
    )
    latency = time.time() - t0
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip(), latency


# ─── Perplexity ──────────────────────────────────────────────────────────────

def compute_perplexity(model, tokenizer, dataset: list[dict], max_samples: int = 50) -> float:
    """Počítá perplexity na eval datasetu."""
    import torch

    total_loss = 0.0
    total_tokens = 0
    samples = dataset[:max_samples]

    for entry in samples:
        messages = entry.get("messages", [])
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=2048).to(model.device)

        with torch.no_grad():
            outputs = model(**inputs, labels=inputs["input_ids"])
            total_loss += outputs.loss.item() * inputs["input_ids"].shape[1]
            total_tokens += inputs["input_ids"].shape[1]

    import math
    return math.exp(total_loss / total_tokens) if total_tokens > 0 else float("inf")


# ─── Main Evaluation ─────────────────────────────────────────────────────────

def evaluate(args) -> dict:
    results = {
        "model": args.model,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "queries": [],
        "summary": {},
    }

    # Load dataset for reference answers
    dataset = []
    if args.dataset and Path(args.dataset).exists():
        with open(args.dataset, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    dataset.append(json.loads(line))
        print(f"Dataset: {len(dataset)} párů")

    # Build reference map (query → answer)
    ref_map = {}
    for entry in dataset:
        msgs = entry.get("messages", [])
        if len(msgs) >= 3:
            ref_map[msgs[1]["content"].strip().lower()] = msgs[2]["content"]

    # Load model
    model, tokenizer = None, None
    if args.model and Path(args.model).exists():
        model, tokenizer = load_local_model(args.model)

    nim_key = os.environ.get("NVIDIA_API_KEY", "")

    # ─── Evaluate each query ─────────────────────────────────────────────

    print(f"\nEvaluuji {len(EVAL_QUERIES)} dotazů...\n")

    total_keyword_recall = 0
    total_coherence = 0
    total_rouge = 0
    total_latency = 0
    n_evaluated = 0

    for i, eq in enumerate(EVAL_QUERIES):
        query = eq["query"]
        expected_kw = eq["expected_keywords"]
        print(f"── [{i+1}/{len(EVAL_QUERIES)}] {query}")

        result_entry = {
            "query": query,
            "category": eq["category"],
            "expected_keywords": expected_kw,
        }

        # Generate response
        if model is not None and tokenizer is not None:
            response, latency = generate_local(model, tokenizer, query)
            result_entry["source"] = "local"
        elif nim_key and args.nim_compare:
            response, latency = generate_nim(query, nim_key)
            result_entry["source"] = "nim"
        else:
            print("  ⚠ No model available, skipping")
            continue

        result_entry["response"] = response
        result_entry["latency_s"] = round(latency, 2)

        # Metrics
        kw_recall = keyword_recall(response, expected_kw)
        coherence = response_coherence(response)

        result_entry["keyword_recall"] = round(kw_recall, 3)
        result_entry["coherence"] = coherence

        # ROUGE-L against reference if available
        ref = ref_map.get(query.strip().lower(), "")
        if ref:
            rouge = rouge_l_score(ref, response)
            result_entry["rouge_l"] = round(rouge, 3)
            total_rouge += rouge
        else:
            result_entry["rouge_l"] = None

        total_keyword_recall += kw_recall
        total_coherence += coherence
        total_latency += latency
        n_evaluated += 1

        # Print summary
        status = "✅" if kw_recall >= 0.5 else "⚠️" if kw_recall >= 0.25 else "❌"
        print(f"  {status} keywords={kw_recall:.0%} coherence={coherence:.2f} latency={latency:.1f}s")
        print(f"     {response[:120]}...")

        results["queries"].append(result_entry)

    # ─── Perplexity ──────────────────────────────────────────────────────

    perplexity = None
    if model is not None and tokenizer is not None and dataset:
        print(f"\nPočítám perplexity (max 50 samples)...")
        try:
            perplexity = compute_perplexity(model, tokenizer, dataset)
            print(f"  Perplexity: {perplexity:.2f}")
        except Exception as e:
            print(f"  Perplexity error: {e}")

    # ─── Summary ─────────────────────────────────────────────────────────

    if n_evaluated > 0:
        results["summary"] = {
            "total_queries": n_evaluated,
            "avg_keyword_recall": round(total_keyword_recall / n_evaluated, 3),
            "avg_coherence": round(total_coherence / n_evaluated, 3),
            "avg_rouge_l": round(total_rouge / n_evaluated, 3) if total_rouge else None,
            "avg_latency_s": round(total_latency / n_evaluated, 2),
            "perplexity": round(perplexity, 2) if perplexity else None,
        }

        print(f"\n{'═' * 60}")
        print(f"  EVALUATION SUMMARY")
        print(f"{'═' * 60}")
        print(f"  Queries:          {n_evaluated}")
        print(f"  Avg keyword recall: {results['summary']['avg_keyword_recall']:.1%}")
        print(f"  Avg coherence:      {results['summary']['avg_coherence']:.2f}")
        if results["summary"]["avg_rouge_l"]:
            print(f"  Avg ROUGE-L:        {results['summary']['avg_rouge_l']:.3f}")
        print(f"  Avg latency:        {results['summary']['avg_latency_s']:.1f}s")
        if perplexity:
            print(f"  Perplexity:         {perplexity:.2f}")

        # Quality grade
        kr = results["summary"]["avg_keyword_recall"]
        if kr >= 0.7:
            grade = "A — Excellent"
        elif kr >= 0.5:
            grade = "B — Good"
        elif kr >= 0.3:
            grade = "C — Acceptable"
        else:
            grade = "D — Needs more training data"
        print(f"  Grade:              {grade}")
        print(f"{'═' * 60}")

    return results


def main():
    parser = argparse.ArgumentParser(description="ZION AI Native — Post-Training Evaluation")
    parser.add_argument("--model", default="outputs/zion-llama-merged",
                        help="Cesta k merged modelu nebo LoRA adaptéru")
    parser.add_argument("--dataset", default="data/zion_train.jsonl",
                        help="Cesta k testovacímu datasetu")
    parser.add_argument("--output", default="outputs/eval_results.json",
                        help="Výstupní JSON s výsledky")
    parser.add_argument("--nim-compare", action="store_true",
                        help="Porovnej s NIM baseline (potřeba NVIDIA_API_KEY)")

    args = parser.parse_args()

    results = evaluate(args)

    # Save
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nVýsledky uloženy: {output_path}")


if __name__ == "__main__":
    main()
