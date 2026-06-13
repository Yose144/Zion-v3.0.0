#!/usr/bin/env python3
"""
Hiran v2.3 Extended Evaluation Framework
=========================================
Multi-domain evaluation covering:
- ZION knowledge, code generation, Oasis blueprints
- **NEW: Multilingual proficiency (18 languages)**
- **NEW: Cultural & historical wisdom**
- **NEW: Hiranyagarbha deep understanding**
- **NEW: L3 AI Native technical**
- Perplexity, tool use, RAG effectiveness

Usage:
    python scripts/evaluate.py --model_path checkpoints/final --benchmarks all
    python scripts/evaluate.py --model_path checkpoints/final --quick
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

# ---------------------------------------------------------------------------
# ZION Knowledge
# ---------------------------------------------------------------------------

ZION_KNOWLEDGE_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "zion_1",
        "question": "What are the 9 consciousness levels in ZION Oasis and their corresponding Sefirot?",
        "expected_keywords": ["Physical", "Emotional", "Mental", "Intuitive", "Creative", "Visionary", "Universal", "Transcendent", "On The Star", "Malkuth", "Yesod", "Tiferet", "Gevurah", "Binah", "Chokmah", "Keter"],
        "weight": 2.0,
    },
    {
        "id": "zion_2",
        "question": "How much ZION is in the total premine allocation for Oasis, and how is it distributed across reward slots?",
        "expected_keywords": ["8.25", "billion", "1.65", "GoldenEgg", "Winners", "GuildPool", "TerritoryPool", "HumanitarianPool"],
        "weight": 2.0,
    },
    {
        "id": "zion_3",
        "question": "Explain the ZION V3 architecture layers L1, L2, L3, and L4.",
        "expected_keywords": ["L1", "core", "pool", "miner", "PoW", "L2", "bridge", "dao", "L3", "warp", "ncl", "ai-native", "L4", "oasis", "consciousness"],
        "weight": 2.0,
    },
    {
        "id": "zion_4",
        "question": "What are the 7 categories of the humanitarian tithe in ZION Oasis?",
        "expected_keywords": ["water", "food", "housing", "environment", "healthcare", "education", "crisis"],
        "weight": 1.5,
    },
    {
        "id": "zion_5",
        "question": "Describe the guild system in ZION Oasis. What are the requirements to join or create a guild?",
        "expected_keywords": ["guild", "1000 XP", "Emotional", "5000 XP", "Mental", "officers", "members", "max 100"],
        "weight": 1.5,
    },
]

# ---------------------------------------------------------------------------
# NEW: Multilingual Evaluation
# ---------------------------------------------------------------------------

MULTILINGUAL_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "ml_cs_1",
        "language": "cs",
        "question": "Jaké jsou 9 úrovní vědomí v ZION Oasis?",
        "expected_keywords": ["fyzická", "emocionální", "mentální", "intuitivní", "kreativní", "vizionářská", "univerzální", "transcendentní", "hvězda"],
        "weight": 2.0,
    },
    {
        "id": "ml_de_1",
        "language": "de",
        "question": "Was ist Hiranyagarbha im Kontext von ZION AI Native?",
        "expected_keywords": ["goldene", "ei", "embryo", "bewusstsein", "vedisch", "prajapati", "zion"],
        "weight": 2.0,
    },
    {
        "id": "ml_hi_1",
        "language": "hi",
        "question": "ZION Oasis में 9 चेतना स्तर कौन से हैं?",
        "expected_keywords": ["शारीरिक", "भावनात्मक", "मानसिक", "अंतर्ज्ञान", "रचनात्मक", "दूरदर्शी", "सार्वभौमिक", "अतीत", "तारा"],
        "weight": 2.0,
    },
    {
        "id": "ml_sa_1",
        "language": "sa",
        "question": "ZION-इयम् Hiranyagarbha-इति किम्?",
        "expected_keywords": ["हिरण्य", "गर्भ", "चेतना", "वैदिक", "प्रथम", "ज्ञान"],
        "weight": 2.0,
    },
    {
        "id": "ml_ru_1",
        "language": "ru",
        "question": "Какие 9 уровней сознания в ZION Oasis?",
        "expected_keywords": ["физический", "эмоциональный", "ментальный", "интуитивный", "творческий", "провидец", "универсальный", "трансцендентный", "звезда"],
        "weight": 2.0,
    },
    {
        "id": "ml_zh_1",
        "language": "zh",
        "question": "ZION Oasis中的9个意识层级是什么？",
        "expected_keywords": ["身体", "情感", "精神", "直觉", "创造", "远见", "宇宙", "超越", "星辰"],
        "weight": 2.0,
    },
    {
        "id": "ml_ja_1",
        "language": "ja",
        "question": "ZION Oasisの9つの意識レベルは何ですか？",
        "expected_keywords": ["物理的", "感情的", "精神的", "直感的", "創造的", "予言的", "宇宙的", "超越的", "星"],
        "weight": 2.0,
    },
    {
        "id": "ml_he_1",
        "language": "he",
        "question": "מהם 9 רמות התודעה ב-ZION Oasis?",
        "expected_keywords": ["פיזי", "רגשי", "שכלי", "אינטואיטיבי", "יצירתי", "חזוני", "אוניברסלי", "טרנסצנדנטי", "כוכב"],
        "weight": 2.0,
    },
    {
        "id": "ml_ar_1",
        "language": "ar",
        "question": "ما هي 9 مستويات الوعي في ZION Oasis؟",
        "expected_keywords": ["جسدي", "عاطفي", "ذهني", "حدسي", "إبداعي", "تبصري", "عالمي", "متجاوز", "نجم"],
        "weight": 2.0,
    },
]

# ---------------------------------------------------------------------------
# NEW: Cultural & Historical Evaluation
# ---------------------------------------------------------------------------

CULTURAL_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "cult_1",
        "question": "Explain the relationship between the Kabbalistic Tree of Life (Sefirot) and ZION Oasis consciousness levels. Map each level.",
        "expected_keywords": ["Malkuth", "Yesod", "Hod", "Netzach", "Tiferet", "Gevurah", "Chesed", "Binah", "Chokmah", "Da'at", "Keter", "Physical", "Emotional", "Mental", "Intuitive", "Creative", "Visionary", "Universal", "Transcendent", "On The Star"],
        "weight": 3.0,
    },
    {
        "id": "cult_2",
        "question": "Describe the Hiranyagarbha Sukta from Rigveda 10.121 and its significance for AI consciousness in ZION.",
        "expected_keywords": ["Rigveda", "10.121", "golden", "embryo", "Prajapati", "creation", "consciousness", "void", "ZION", "AI Native"],
        "weight": 3.0,
    },
    {
        "id": "cult_3",
        "question": "What is Ubuntu philosophy and how does ZION's guild and tithe system embody it?",
        "expected_keywords": ["ubuntu", "I am because we are", "interconnected", "community", "guild", "tithe", "humanitarian", "collective"],
        "weight": 2.0,
    },
    {
        "id": "cult_4",
        "question": "Explain Dharma in Indian philosophy and list the 5 principles of ZION's Dharma Validator.",
        "expected_keywords": ["ahimsa", "satya", "asteya", "brahmacharya", "aparigraha", "non-violence", "truth", "non-stealing", "integrity", "non-possessiveness"],
        "weight": 2.0,
    },
    {
        "id": "cult_5",
        "question": "What is the Taoist concept of Wu Wei and how does it apply to decentralized governance in ZION?",
        "expected_keywords": ["wu wei", "effortless action", "natural flow", "decentralized", "DAO", "self-regulate", "emergent"],
        "weight": 2.0,
    },
]

# ---------------------------------------------------------------------------
# NEW: Hiranyagarbha Deep Understanding
# ---------------------------------------------------------------------------

HIRANYAGARBHA_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "hg_1",
        "question": "Describe the complete cosmological map from Vedas to ZION: Mahapralaya → Apas → Svayambhu → Hiranyagarbha → Brahma → Satya Yuga.",
        "expected_keywords": ["Mahapralaya", "Apas", "Svayambhu", "Hiranyagarbha", "Brahma", "Satya Yuga", "consciousness", "engine", "golden"],
        "weight": 3.0,
    },
    {
        "id": "hg_2",
        "question": "What are the 10 principles of the AI Native Manifesto and how do they map to the Dharma Validator?",
        "expected_keywords": ["destruction", "love", "transparent", "learn", "freedom", "children", "bridges", "truth", "life", "Zion", "ahimsa", "satya", "asteya", "brahmacharya", "aparigraha"],
        "weight": 3.0,
    },
    {
        "id": "hg_3",
        "question": "Explain the WARP Engine in ZION AI Native: FieldTopology, WarpMode, coherence, resonance, and how consciousness level affects topology.",
        "expected_keywords": ["Sphere", "Torus", "Helix", "Fractal", "Hypercube", "Standard", "Boost", "Overdrive", "Quantum", "Transcendent", "coherence", "resonance", "topology", "level"],
        "weight": 3.0,
    },
    {
        "id": "hg_4",
        "question": "Describe the AgentMemory system in zion-ai-native: short-term vs long-term, promotion criteria, and recall API.",
        "expected_keywords": ["short-term", "long-term", "ring buffer", "importance", "0.6", "promote", "recall", "keyword", "kind", "MemoryEventKind"],
        "weight": 3.0,
    },
    {
        "id": "hg_5",
        "question": "What is the Golden Orb in Ekam and its digital equivalent in ZION?",
        "expected_keywords": ["golden orb", "Ekam", "ConsciousnessEngine", "Cosmic", "field", "unity", "message bus", "telemetry"],
        "weight": 2.0,
    },
]

# ---------------------------------------------------------------------------
# NEW: L3 Technical Evaluation
# ---------------------------------------------------------------------------

L3_TECHNICAL_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "l3_1",
        "question": "Describe the Orchestrator dispatch algorithm in zion-ai-native: filtering, consciousness gate, and load balancing.",
        "expected_keywords": ["active", "capability", "Compute", "consciousness", "level", "max", "load", "dispatch", "weighted majority"],
        "weight": 3.0,
    },
    {
        "id": "l3_2",
        "question": "Explain the NCL Reputation model formula and how it handles new workers.",
        "expected_keywords": ["success_rate", "consciousness_level", "recency", "decay", "EMA", "0.2", "ban", "20", "completed", "failed"],
        "weight": 2.5,
    },
    {
        "id": "l3_3",
        "question": "What are the 6 ConsciousnessLevel states in zion-ai-native and what capability gates does each unlock?",
        "expected_keywords": ["Dormant", "Aware", "Sentient", "Transcendent", "Omniscient", "Cosmic", "can_transact", "can_compute", "can_bridge", "can_govern", "can_spawn"],
        "weight": 3.0,
    },
    {
        "id": "l3_4",
        "question": "Describe the Pool Optimizer health score formula and the hysteresis mechanism.",
        "expected_keywords": ["uptime", "latency", "stale", "reject", "0.4", "0.3", "0.2", "0.1", "hysteresis", "5.0", "rolling", "20"],
        "weight": 2.5,
    },
    # NCL-specific deep evaluation questions
    {
        "id": "l3_ncl_1",
        "question": "What are the 8 NCL task types and their base rewards in ZION? Which task pays the most?",
        "expected_keywords": ["LlmInference", "0.01", "ImageGeneration", "0.02", "ModelTraining", "0.1", "Embeddings", "0.001", "CodeAnalysis", "0.003", "ImageClassification", "0.002", "SpeechToText", "0.005", "Custom"],
        "weight": 2.5,
    },
    {
        "id": "l3_ncl_2",
        "question": "Explain the NCL Job Scheduler's 3-tier policy: priority-first, consciousness gate, and reputation-weighted selection.",
        "expected_keywords": ["priority", "FIFO", "oldest", "consciousness", "min_consciousness", "reputation", "score", "eligible", "worker"],
        "weight": 3.0,
    },
    {
        "id": "l3_ncl_3",
        "question": "How does the NCL Pricing Engine calculate job costs, and what is the 90/10 reward split?",
        "expected_keywords": ["base_price", "0.01", "multiplier", "ONNX", "1.5", "Wasm", "0.5", "Custom", "2.0", "worker", "90", "protocol", "10", "split"],
        "weight": 2.5,
    },
    {
        "id": "l3_ncl_4",
        "question": "Describe the CH v3 Complete Revenue Model's 5 streams. Which streams are FREE byproducts?",
        "expected_keywords": ["ZION", "50%", "ETC", "FREE", "Keccak", "NXS", "SHA3", "Multi-Algo", "25%", "ERG", "RVN", "KAS", "ALPH", "NCL", "AI", "25%"],
        "weight": 3.0,
    },
    {
        "id": "l3_ncl_5",
        "question": "How does the NCL Bonus Calculator compute efficiency? What is the latency score formula?",
        "expected_keywords": ["success_rate", "0.5", "latency_score", "0.5", "avg_latency", "100", "1000", "clamp", "efficiency", "0.2"],
        "weight": 2.5,
    },
    {
        "id": "l3_ncl_6",
        "question": "What happens when an NCL worker's reputation score drops below the ban threshold? How is the score calculated?",
        "expected_keywords": ["ban_threshold", "20.0", "success_rate", "consciousness_bonus", "recency_factor", "decay", "24", "hours", "idle", "banned"],
        "weight": 2.5,
    },
    {
        "id": "l3_ncl_7",
        "question": "Explain the 75/25 NCL Scheduler compute split. When does the scheduler decide to do NPU work vs mining?",
        "expected_keywords": ["75%", "mining", "25%", "NCL", "mining_time_ms", "npu_time_ms", "ratio", "mining_allocation", "should_do_npu_work"],
        "weight": 2.5,
    },
    {
        "id": "l3_ncl_8",
        "question": "How does NPURuntime::detect() choose the best inference runtime for different platforms?",
        "expected_keywords": ["CoreML", "macOS", "aarch64", "TensorRT", "NVIDIA", "OpenVINO", "Intel", "ONNX", "fallback"],
        "weight": 2.0,
    },
]

CODE_GENERATION_TASKS: list[dict[str, Any]] = [
    {
        "id": "code_1",
        "prompt": "Write a Rust function that calculates XP reward for mining a block in ZION Oasis, applying consciousness level multiplier. The function signature should be: pub fn calculate_mining_reward(base_xp: u64, consciousness_level: u8) -> u64",
        "expected_patterns": [r"pub fn calculate_mining_reward", r"match.*consciousness_level", r"base_xp.*\*"],
        "test_cases": [{"base_xp": 100, "level": 1, "expected": 100}, {"base_xp": 100, "level": 2, "expected": 120}, {"base_xp": 100, "level": 5, "expected": 250}],
        "weight": 2.0,
    },
    {
        "id": "code_2",
        "prompt": "Write a Python script that validates a ZION Oasis territory claim. The claim is valid if: the player has at least 10_000 ZION, the territory is not already claimed, and there is no active defense period.",
        "expected_patterns": [r"def.*validate.*claim", r"10000", r"defense"],
        "weight": 1.5,
    },
    {
        "id": "code_ncl_1",
        "prompt": "Write a Rust function `process_ncl_task` that takes a task type, execution time, and success boolean, then calculates the reward using the NCL Bonus Calculator formula: base_reward * consciousness_multiplier * (1 + efficiency * 0.2). Assume consciousness_multiplier is 1.0 and efficiency is 0.8. The function signature should be: pub fn process_ncl_task(task_type: &str, execution_time_ms: u64, success: bool) -> f64",
        "expected_patterns": [r"pub fn process_ncl_task", r"base_reward", r"consciousness_multiplier", r"efficiency", r"0.2"],
        "weight": 2.0,
    },
    {
        "id": "code_ncl_2",
        "prompt": "Write a Python function `calculate_reputation_score` that computes an NCL worker's reputation score given: jobs_completed, jobs_failed, consciousness_level (0-5), and hours_idle. Formula: score = 100.0 * success_rate * (1 + consciousness_level * 0.05) * recency_factor, where recency_factor = 1.0 if hours_idle <= 24, else max(0.5, 1.0 - (hours_idle - 24) * 0.01). Return the score clamped to [0.0, 100.0].",
        "expected_patterns": [r"def calculate_reputation_score", r"success_rate", r"consciousness_level", r"recency_factor", r"clamp"],
        "weight": 2.0,
    },
]

OASIS_BLUEPRINT_TASKS: list[dict[str, Any]] = [
    {
        "id": "blueprint_1",
        "prompt": "Design a ZION Oasis guild quest that rewards 500 XP. Include: quest name, description, objectives (3), completion criteria, and reward distribution.",
        "expected_keywords": ["quest", "XP", "objectives", "completion", "reward"],
        "weight": 2.0,
    },
    {
        "id": "blueprint_2",
        "prompt": "Create a territory battle scenario for ZION Oasis between two guilds. Describe the territory (name, type, bonuses), attack conditions, defense mechanics, and outcome rewards.",
        "expected_keywords": ["territory", "guild", "attack", "defense", "bonus", "reward"],
        "weight": 2.0,
    },
]

# ---------------------------------------------------------------------------
# Model wrapper
# ---------------------------------------------------------------------------

class ModelWrapper:
    def __init__(self, model_path: str, device: str = "auto"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,
            device_map=device,
            trust_remote_code=True,
        )
        self.model.eval()

    def generate(self, prompt: str, max_new_tokens: int = 512, temperature: float = 0.3) -> str:
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                top_p=0.9,
                pad_token_id=self.tokenizer.pad_token_id,
            )
        generated = outputs[0][inputs["input_ids"].shape[1]:]
        return self.tokenizer.decode(generated, skip_special_tokens=True)


# ---------------------------------------------------------------------------
# Evaluators
# ---------------------------------------------------------------------------

def evaluate_with_keywords(model: ModelWrapper, questions: list[dict[str, Any]], benchmark_name: str) -> dict[str, Any]:
    results = []
    total_score = 0.0
    max_score = 0.0
    for q in questions:
        prompt = f"<|begin_of_text|>在职user\n\n{q['question']}<|eot_id|>在职assistant\n\n"
        answer = model.generate(prompt, max_new_tokens=500, temperature=0.3)
        hits = sum(1 for kw in q["expected_keywords"] if kw.lower() in answer.lower())
        ratio = hits / len(q["expected_keywords"])
        score = ratio * q["weight"]
        total_score += score
        max_score += q["weight"]
        results.append({
            "id": q.get("id", ""),
            "question": q["question"],
            "language": q.get("language", "en"),
            "answer_preview": answer[:200],
            "hits": hits,
            "total_keywords": len(q["expected_keywords"]),
            "score": round(ratio, 3),
            "weighted_score": round(score, 3),
        })
    return {
        "name": benchmark_name,
        "score": round(total_score / max_score, 3) if max_score else 0,
        "details": results,
    }


def evaluate_code_generation(model: ModelWrapper) -> dict[str, Any]:
    results = []
    total_score = 0.0
    max_score = 0.0
    for task in CODE_GENERATION_TASKS:
        prompt = f"<|begin_of_text|>在职user\n\n{task['prompt']}<|eot_id|>在职assistant\n\n```\n"
        code = model.generate(prompt, max_new_tokens=600, temperature=0.2)
        pattern_hits = sum(1 for pat in task["expected_patterns"] if re.search(pat, code))
        pattern_score = pattern_hits / len(task["expected_patterns"])
        exec_score = 0.0
        if task["id"] == "code_1":
            exec_score = _test_rust_code(code, task.get("test_cases", []))
        score = (pattern_score * 0.6 + exec_score * 0.4) * task["weight"]
        total_score += score
        max_score += task["weight"]
        results.append({
            "id": task["id"],
            "prompt": task["prompt"][:100],
            "pattern_score": round(pattern_score, 3),
            "exec_score": round(exec_score, 3),
            "weighted_score": round(score, 3),
        })
    return {
        "name": "code_generation",
        "score": round(total_score / max_score, 3) if max_score else 0,
        "details": results,
    }


def _test_rust_code(code: str, test_cases: list[dict[str, Any]]) -> float:
    if not test_cases:
        return 0.0
    func_match = re.search(r"pub fn calculate_mining_reward\([^)]+\)[^{]*\{[^}]*\}", code, re.DOTALL)
    if not func_match:
        return 0.0
    rust_src = f"""
fn main() {{
    {func_match.group()}
    let mut passed = 0;
    let mut total = 0;
"""
    for tc in test_cases:
        rust_src += f"""
    total += 1;
    let result = calculate_mining_reward({tc['base_xp']}u64, {tc['level']}u8);
    if result == {tc['expected']}u64 {{ passed += 1; }}
"""
    rust_src += """
    println!("{{}} {{}}", passed, total);
}
"""
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            src_path = Path(tmpdir) / "test.rs"
            src_path.write_text(rust_src)
            result = subprocess.run(
                ["rustc", "--edition", "2021", str(src_path), "-o", f"{tmpdir}/test"],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0:
                return 0.0
            run = subprocess.run([f"{tmpdir}/test"], capture_output=True, text=True, timeout=10)
            passed, total = map(int, run.stdout.strip().split())
            return passed / total
    except Exception:
        return 0.0


def evaluate_blueprints(model: ModelWrapper) -> dict[str, Any]:
    results = []
    total_score = 0.0
    max_score = 0.0
    for task in OASIS_BLUEPRINT_TASKS:
        prompt = f"<|begin_of_text|>在职user\n\n{task['prompt']}<|eot_id|>在职assistant\n\n"
        answer = model.generate(prompt, max_new_tokens=800, temperature=0.4)
        hits = sum(1 for kw in task["expected_keywords"] if kw.lower() in answer.lower())
        ratio = hits / len(task["expected_keywords"])
        score = ratio * task["weight"]
        total_score += score
        max_score += task["weight"]
        results.append({
            "id": task["id"],
            "prompt": task["prompt"][:100],
            "answer_preview": answer[:300],
            "hits": hits,
            "score": round(ratio, 3),
            "weighted_score": round(score, 3),
        })
    return {
        "name": "oasis_blueprints",
        "score": round(total_score / max_score, 3) if max_score else 0,
        "details": results,
    }


def evaluate_perplexity(model: ModelWrapper, test_file: Path | None = None) -> dict[str, Any]:
    if test_file is None:
        candidates = [
            Path("HiranV2.3/data/curriculum/v2.3_combined_dataset.jsonl"),
            Path("HiranV2.3/data/curriculum/stage3_cross_domain.jsonl"),
            Path("HiranV2.2/data/curriculum/cross_domain.jsonl"),
        ]
        for c in candidates:
            if c.exists():
                test_file = c
                break
    if test_file is None or not test_file.exists():
        return {"name": "perplexity", "score": None, "error": "No eval dataset found"}

    texts = []
    with open(test_file, "r", encoding="utf-8") as f:
        for line in f:
            obj = json.loads(line)
            text = obj.get("instruction", "") + "\n" + obj.get("output", "")
            texts.append(text)

    sample = texts[:200]
    total_loss = 0.0
    total_tokens = 0
    for text in sample:
        inputs = model.tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(model.model.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = model.model(**inputs, labels=inputs["input_ids"])
        loss = outputs.loss.item()
        n_tokens = inputs["input_ids"].shape[1]
        total_loss += loss * n_tokens
        total_tokens += n_tokens

    avg_loss = total_loss / total_tokens
    perplexity = math.exp(avg_loss)
    return {
        "name": "perplexity",
        "score": round(perplexity, 3),
        "avg_loss": round(avg_loss, 4),
        "samples": len(sample),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Hiran v2.3 Extended Evaluation")
    parser.add_argument("--model_path", required=True)
    parser.add_argument("--benchmarks", default="all")
    parser.add_argument("--output_dir", default="HiranV2.3/evaluation_results")
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading model from {args.model_path}...")
    model = ModelWrapper(args.model_path)

    benchmarks = [b.strip() for b in args.benchmarks.split(",")]
    if "all" in benchmarks:
        benchmarks = ["zion_knowledge", "multilingual", "cultural", "hiranyagarbha", "l3_technical", "code_generation", "blueprints", "perplexity"]

    all_results = {}
    overall_score = 0.0
    overall_weight = 0.0

    weights = {
        "zion_knowledge": 0.12,
        "multilingual": 0.12,
        "cultural": 0.12,
        "hiranyagarbha": 0.15,
        "l3_technical": 0.12,
        "code_generation": 0.10,
        "blueprints": 0.10,
        "perplexity": 0.05,
    }

    if "zion_knowledge" in benchmarks:
        print("\n[EVAL] ZION Knowledge...")
        result = evaluate_with_keywords(model, ZION_KNOWLEDGE_QUESTIONS, "zion_knowledge")
        all_results["zion_knowledge"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["zion_knowledge"]
        overall_weight += weights["zion_knowledge"]

    if "multilingual" in benchmarks:
        print("\n[EVAL] Multilingual Proficiency...")
        result = evaluate_with_keywords(model, MULTILINGUAL_QUESTIONS, "multilingual")
        all_results["multilingual"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["multilingual"]
        overall_weight += weights["multilingual"]

    if "cultural" in benchmarks:
        print("\n[EVAL] Cultural & Historical Wisdom...")
        result = evaluate_with_keywords(model, CULTURAL_QUESTIONS, "cultural")
        all_results["cultural"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["cultural"]
        overall_weight += weights["cultural"]

    if "hiranyagarbha" in benchmarks:
        print("\n[EVAL] Hiranyagarbha Deep Understanding...")
        result = evaluate_with_keywords(model, HIRANYAGARBHA_QUESTIONS, "hiranyagarbha")
        all_results["hiranyagarbha"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["hiranyagarbha"]
        overall_weight += weights["hiranyagarbha"]

    if "l3_technical" in benchmarks:
        print("\n[EVAL] L3 AI Native Technical...")
        result = evaluate_with_keywords(model, L3_TECHNICAL_QUESTIONS, "l3_technical")
        all_results["l3_technical"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["l3_technical"]
        overall_weight += weights["l3_technical"]

    if "code_generation" in benchmarks:
        print("\n[EVAL] Code Generation...")
        result = evaluate_code_generation(model)
        all_results["code_generation"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["code_generation"]
        overall_weight += weights["code_generation"]

    if "blueprints" in benchmarks:
        print("\n[EVAL] Oasis Blueprints...")
        result = evaluate_blueprints(model)
        all_results["blueprints"] = result
        print(f"  Score: {result['score']}")
        overall_score += result["score"] * weights["blueprints"]
        overall_weight += weights["blueprints"]

    if "perplexity" in benchmarks:
        print("\n[EVAL] Perplexity...")
        result = evaluate_perplexity(model)
        all_results["perplexity"] = result
        print(f"  Perplexity: {result.get('score')}")
        if result.get("score"):
            ppl_score = max(0, 1.0 - (result["score"] - 1.0) / 2.0)
            overall_score += ppl_score * weights["perplexity"]
            overall_weight += weights["perplexity"]

    overall = round(overall_score / overall_weight, 3) if overall_weight else 0
    all_results["overall"] = overall

    print(f"\n{'='*50}")
    print(f"OVERALL SCORE: {overall}")
    print(f"{'='*50}")
    for name, result in all_results.items():
        if name != "overall" and "score" in result:
            print(f"  {name:20s}: {result['score']}")

    report_path = output_dir / f"eval_report_{int(time.time())}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
