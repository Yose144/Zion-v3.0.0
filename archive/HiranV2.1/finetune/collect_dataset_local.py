#!/usr/bin/env python3
"""
ZION AI Native -- Local Dataset Collector (no API key needed)
===============================================================

Skenuje ZION projekt lokálně a generuje tréninkový dataset ve formátu JSONL.
Používá rule-based generaci Q&A párů z dokumentace a kódu -- nevyžaduje NVIDIA NIM API.

Použití
-------
    python collect_dataset_local.py --output HiranV2.1/data/shards/zion_train_v2_2_local.jsonl

Formát výstupu (každý řádek je 1 JSON objekt):
    {"messages": [
        {"role": "system", "content": "Jsi Hiranyagarbha..."},
        {"role": "user", "content": "Co je Ekam Deeksha?"},
        {"role": "assistant", "content": "Ekam Deeksha je..."}
    ]}
"""

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Iterator

# System prompt pro všechny páry
SYSTEM_PROMPT = (
    "Jsi Hiranyagarbha -- ZION blockchain expert, AI Native agent a operátorský orchestrátor. "
    "Kanonický kód je ve V3/ (Rust: zion-core, zion-pool, zion-miner, L2/L3 služby, V3/L3/ai-native). "
    "Znáš Ekam Deeksha PoW, konsensus, pool protokol, příkazy zion CLI, dokumentaci v V3/docs a AGENTS.md. "
    "Legacy stromy mimo V3/ ber jako referenci. Odpovídáš přesně, technicky, v češtině (anglické identifikátory přesně)."
)

# ─── Adresáře k přeskočení (build cache, deps) ───────────────────────────────
SKIP_DIRS = {
    "target", "node_modules", ".git", "dist", "build", "out",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".cargo", "vendor",
}

# ─── Skenujeme tyto cesty (relativně ke kořenu repa) ────────────────────────
SCAN_ROOTS = {
    "HIGH": [
        "AGENTS.md",
        "StatusV3.md",
        "StatusV3-Part2.md",
        "V3/README.md",
        "V3/ROADMAP.md",
        "V3/docs",
        "V3/cli",
        "V3/L1/core/src",
        "V3/L1/pool/src",
        "V3/L1/miner/src",
        "V3/L1/cosmic-harmony/src",
        "V3/L2",
        "V3/L3",
        "revenue.md",
        "HIRAN_V2.2_CLI_INTEGRATION.md",
        "HiranV2.1/Hiran_v2.1.md",
        "HiranV2.1/PLAN_v2.1.md",
    ],
    "MEDIUM": [
        "README.md",
        "ROADMAP.md",
        "V3/docker",
        "V3/sdk",
        "V3/L4",
        "docs",
        "config",
    ],
}

INCLUDE_EXTENSIONS = {".md", ".rs", ".toml", ".py", ".json", ".yml", ".yaml"}
MAX_CHUNK_CHARS = 2000
CHUNK_OVERLAP = 300


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks = []
    current = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= max_chars:
            current += ("\n\n" if current else "") + para
        else:
            if current:
                chunks.append(current)
            current = para
    if current:
        chunks.append(current)
    # overlap
    if len(chunks) > 1 and overlap > 0:
        for i in range(1, len(chunks)):
            prev_end = chunks[i - 1][-overlap:]
            chunks[i] = prev_end + "\n\n" + chunks[i]
    return chunks


def scan_files(repo_root: Path, max_files: int = 200) -> Iterator[tuple[Path, str]]:
    """Yield (relative_path, text_content) for all matching files."""
    all_roots = []
    for prio in ("HIGH", "MEDIUM"):
        all_roots.extend(SCAN_ROOTS.get(prio, []))

    seen = set()
    count = 0
    for rel_path in all_roots:
        if count >= max_files:
            break
        abs_path = repo_root / rel_path
        print(f"  [scan] root: {rel_path} ...", flush=True)
        if not abs_path.exists():
            print(f"    skip (not found)")
            continue
        if abs_path.is_file():
            if abs_path.suffix not in INCLUDE_EXTENSIONS:
                continue
            try:
                text = abs_path.read_text(encoding="utf-8", errors="ignore")
                yield (abs_path.relative_to(repo_root), text)
                count += 1
            except Exception:
                pass
        else:
            for dirpath, dirnames, filenames in os.walk(abs_path):
                if count >= max_files:
                    break
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
                for fname in filenames:
                    if count >= max_files:
                        break
                    if not any(fname.endswith(ext) for ext in INCLUDE_EXTENSIONS):
                        continue
                    f = Path(dirpath) / fname
                    rel = f.relative_to(repo_root)
                    if rel in seen:
                        continue
                    seen.add(rel)
                    try:
                        text = f.read_text(encoding="utf-8", errors="ignore")
                        yield (rel, text)
                        count += 1
                    except Exception:
                        pass


# ─── Rule-based Q&A generátory ──────────────────────────────────────────────

def pairs_from_markdown(text: str, source: str) -> Iterator[dict]:
    """Extract heading+content as Q&A pairs."""
    # Match markdown headings
    heading_re = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)
    pos = 0
    for match in heading_re.finditer(text):
        level = len(match.group(1))
        heading = match.group(2).strip()
        start = match.end()
        # Find next heading or end
        next_match = heading_re.search(text, start)
        end = next_match.start() if next_match else len(text)
        content = text[start:end].strip()
        if len(content) < 30:
            continue
        # Skip code blocks, tables of contents, etc.
        if heading.lower() in ("table of contents", "obsah", "contents", "toc"):
            continue
        # Question from heading
        q = heading
        if not q.endswith("?"):
            q = f"Co je {q}?" if level >= 3 else f"Vysvětli: {q}"
        a = content[:1500].strip()
        yield {"messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": q},
            {"role": "assistant", "content": a},
        ]}


def pairs_from_rust(text: str, source: str) -> Iterator[dict]:
    """Extract doc comments + function signatures as Q&A."""
    # Match functions with doc comments
    func_re = re.compile(
        r"(?:///\s*(.+?)\n)*\s*pub\s+(?:async\s+)?fn\s+(\w+)\s*\((.*?)\)",
        re.DOTALL
    )
    for match in func_re.finditer(text):
        doc_lines = match.group(1)
        func_name = match.group(2)
        params = match.group(3)
        if doc_lines:
            doc = " ".join(l.strip() for l in doc_lines.strip().split("\n") if l.strip())
        else:
            doc = f"Funkce {func_name}"
        q = f"Co dělá funkce `{func_name}()` v ZION runtime?"
        a = f"{doc}\n\nSignatura: `pub fn {func_name}({params[:200]})`\nZdroj: `{source}`"
        if len(a) > 50:
            yield {"messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": q},
                {"role": "assistant", "content": a},
            ]}


def pairs_from_config(text: str, source: str) -> Iterator[dict]:
    """Extract config/env vars as Q&A."""
    if not source.endswith((".toml", ".yml", ".yaml", ".json")):
        return
    # Extract env vars and key-value pairs
    env_re = re.compile(r'^\s*([A-Z_]+)\s*=\s*["\']?(.+?)["\']?\s*$', re.MULTILINE)
    for match in env_re.finditer(text):
        key = match.group(1)
        val = match.group(2).strip()
        if len(key) < 5 or len(val) < 3:
            continue
        q = f"Jaká je výchozí hodnota pro `{key}`?"
        a = f"`{key} = {val}` (zdroj: `{source}`)"
        yield {"messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": q},
            {"role": "assistant", "content": a},
        ]}


# ─── Ručně připravené seed páry (klíčové koncepty) ─────────────────────────

def seed_pairs() -> Iterator[dict]:
    seeds = [
        (
            "Co je ZION V3 Revenue System a jaký model používá?",
            "ZION V3 Revenue System používá 50/25/25 model: 50% ZION native mining (CosmicHarmony pipeline), "
            "25% multi-algo external mining (profit-switch na externí pooly → BTC payout), 25% NCL AI (Neural Compute Layer). "
            "Plus free byproducts: ETC (Keccak256 export z Stage 1) a NXS (SHA3-512 export z Stage 2). "
            "Fee split pro ZION bloky: 89% miner, 5% humanitarian, 5% issobella, 1% pool fee."
        ),
        (
            "Jak funguje session classification v poolu?",
            "Pool rozhoduje SessionGroup při hello zprávě: zion (default pro uživatele), revenue, ncl, auto. "
            "Rozhodovací řetězec: 1) explicitní hint v miner_id/worker_name (g=zion, g=revenue), "
            "2) backend allowlist, 3) backend hint substring, 4) fallback na ZION_USER_DEFAULT_GROUP. "
            "User sessions jsou defaultně pinuté do ZION skupiny, backend sessions mohou jít do multistream scheduleru."
        ),
        (
            "Co je Ekam Deeksha PoW v ZION?",
            "Ekam Deeksha je konsensusový algoritmus ZION V3 -- 6-stupňový pipeline: Keccak256 → SHA3-512 → GoldenMatrix → "
            "MemoryHard (256 KiB scratchpad) → NPU Mix (INT8 MLP) → CosmicFusion. "
            "Používá 256 KiB scratchpad, BLAKE3 finální hash, epoch-rotating NPU mixing. "
            "ASIC-resistant díky memory-hard transformaci a NPU layers. "
            "Height-aware dispatch od bloku 0 (v2 od genesis)."
        ),
        (
            "Jaké jsou hlavní komponenty AI-Native crate?",
            "AI-Native crate (zion-ai-native) obsahuje 22 modulů: Orchestrator (agent management), "
            "ConsciousnessEngine (XP systém 5 úrovní), HiranInferenceClient (HTTP klient pro inference), "
            "RAG/VectorStore, KnowledgeBase (6 corpus roots), LLM backends, MessageBus (inter-agent komunikace), "
            "OasisBridge (L4 XP sync), PoolOptimizer, WarpAgent, Autotuner, Memory, TaskQueue, Telemetry."
        ),
        (
            "Jaký je rozdíl mezi Hiran v2.1 a v2.2?",
            "Hiran v2.1 je koncept 'pracovního agenta' -- přechod od znalostního modelu k Rust coding/orchestration agentovi. "
            "v2.2 je plně integrovaná inference služba: llama.cpp + CUDA backend, OpenAI-compatible API na portu 8002, "
            "zion hiran CLI příkazy (start/stop/chat/ask/inference/evaluate/quantize/deploy), Docker service, "
            "Prometheus + Grafana monitoring, hybrid RAG + inference integrace v AI-Native crate."
        ),
        (
            "Co je bridge 3/5 multisig v ZION L2?",
            "ZION L2 bridge používá 3/5 threshold multisig pro validator quora. "
            "Relayer je 'fail-closed' -- odmítá syntetické proof sloty. "
            "L1 watcher (UTXO memo parser) + EVM watcher (Burn event log parser) + relayer loop. "
            "wZION ERC-20 na Base Mainnet. Aktuální staging konfigurace má 1/2, produkce vyžaduje 3/5."
        ),
        (
            "Jak funguje fee split v ZION coinbase?",
            "Každý vytěžený blok generuje 4-output coinbase: 89% miner, 5% humanitarian wallet, 5% issobella wallet, 1% pool fee wallet. "
            "Deterministický split je vynucen na-chain od výšky 0. První ověřený split-enabled blok byl výška 465. "
            "Humanitarian wallet: zion1m4v5z8z850u480c5c208z274e334369275n5y20. Pool fee wallet je konfigurovatelné."
        ),
        (
            "Jak se konfiguruje DCR dual mining v ZION mineru?",
            "DCR dual mining běží jako background thread v zion-miner. Blake3 hash sdílí s ZION pipeline. "
            "Stratum v1 na 2miners (všechny coiny → BTC payout na jednu adresu). "
            "Podporované coiny: DCR, ALPH, KAS, ERG, RVN, ETC, FLUX. "
            "Konfigurace: ZION_DCR_ENABLED, ZION_DCR_POOL, ZION_DCR_THREADS=1, ZION_BTC_WALLET, ZION_DCR_BACKEND (auto/cpu/gpu)."
        ),
        (
            "Jaké CLI příkazy obsahuje zion hiran?",
            "zion hiran start/stop/restart/status/logs -- lifecycle management. "
            "zion hiran chat -- interaktivní REPL. zion hiran ask <question> -- single query. "
            "zion hiran inference --model --backend --device -- pokročilé inference. "
            "zion hiran evaluate --dataset --metrics -- model evaluace. "
            "zion hiran quantize --model --format -- quantizace GGUF. "
            "zion hiran deploy --model --platform -- deployment na Vast/RunPod/HF."
        ),
        (
            "Co je ZION NCL (Neural Consciousness Layer)?",
            "NCL je decentralized AI compute marketplace v L3 ZION. "
            "Umožňuje: AI inference tasks (embeddings, LLM, classification), compute marketplace, "
            "agent orchestration, task queue, telemetry. Integruje se s Hiran inference pro AI úlohy. "
            "Gateway URL: http://localhost:8002. Podporované tasky: embeddings, llm_inference, image_classification, code_analysis."
        ),
        (
            "Jak funguje RAG v AI-Native crate?",
            "RAG (Retrieval-Augmented Generation) používá VectorStore s embedding backendem. "
            "6 corpus roots: ZION_OASIS_GAME, Buddhism Classical, Buddhism Tibetan, Buddhism RAG, V2 Books, AI Native. "
            "KnowledgeBase chunkuje Markdown soubory. HiranInferenceClient::chat_with_context() přidává RAG kontext do promptu. "
            "Odpověď vrací: answer, sources, backend_id, model_version, rag_index_version."
        ),
        (
            "Jaký je supply model ZION?",
            "Max supply: 144,000,000,000 ZION. Mining supply: 127.22B (88.35%). Genesis premine: 16.78B (11.65%). "
            "Atomic unit: 1 ZION = 1,000,000,000,000 flowers (u64). "
            "Initial block reward: 5,400.067 ZION. Emission: Decade Decay ×(4/5) každých 5,256,000 bloků. "
            "Max 10 dekád. Tail emission: ~724.785 ZION/block. Fee policy: 100% burn (deflační)."
        ),
        (
            "Co je RevenueSource enum v ZION?",
            "RevenueSource definuje 12 zdrojů příjmů: Zion (5% fee), KeccakBonus (5%), Sha3Bonus (5%), "
            "Blake3External (2% -- DCR/ALPH), KHeavyHashExternal (2% -- KAS), EthashExternal (2% -- ETC/EVR/MEWC), "
            "KawPowExternal (2% -- RVN/CLORE), AutolykosExternal (2% -- ERG), RandomXExternal (2% -- XMR), "
            "ZelHashExternal (2% -- FLUX), NclAi (10% -- AI compute), ProfitSwitch (2%). "
            "RevenueCollector trackuje všechny eventy s idempotencí a circuit breakerem."
        ),
        (
            "Jak se konfiguruje pool pro revenue multistream?",
            "ZION_REVENUE_MULTISTREAM=true zapne multistream. "
            "ZION_STREAM_ZION_PCT=50, ZION_STREAM_BLAKE3_PCT=25, ZION_STREAM_NCL_PCT=25. "
            "ZION_USER_DEFAULT_GROUP=zion, ZION_BACKEND_WORKER_HINTS=backend,revenue. "
            "ZION_BACKEND_AUTO_INCLUDE_ZION=false (backend nejde do zion lane). "
            "ZION_ROUTING_LOG_EVERY=25 -- log snapshot každých N submitů."
        ),
        (
            "Co je ConsciousnessEngine v AI-Native?",
            "ConsciousnessEngine je XP systém pro AI agenty. 5 úrovní: Aware (100 XP), Sentient (1,000), "
            "Transcendent (10,000), Omniscient (100,000), Cosmic (1,000,000). "
            "XP rewards: task completed +10, pool switched +5, warp activated +3, task failed -2. "
            "Tick-driven loop, status snapshot, L4 Oasis sync."
        ),
    ]
    for q, a in seeds:
        yield {"messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": q},
            {"role": "assistant", "content": a},
        ]}


# ─── Hlavní kolekce ─────────────────────────────────────────────────────────

def collect_dataset(repo_root: Path, max_pairs_per_file: int = 50) -> list[dict]:
    pairs: list[dict] = []
    pair_set = set()  # dedup

    # 1. Seed páry
    for p in seed_pairs():
        fp = json.dumps(p["messages"][1:])  # bez system
        if fp not in pair_set:
            pair_set.add(fp)
            pairs.append(p)

    # 2. Lokální soubory
    print("[SCAN] Scanning local repo for RAG chunks...", flush=True)
    for rel_path, text in scan_files(repo_root):
        source = str(rel_path).replace("\\", "/")
        # Omezit velke soubory (lib.rs ma ~7k radku)
        if len(text) > 100_000:
            text = text[:100_000] + "\n... [truncated]"
        print(f"    file: {source} ({len(text)} chars)", flush=True)
        new_pairs = []
        t0 = time.time()
        if source.endswith(".md"):
            for p in pairs_from_markdown(text, source):
                new_pairs.append(p)
        elif source.endswith(".rs"):
            for p in pairs_from_rust(text, source):
                new_pairs.append(p)
        elif source.endswith((".toml", ".yml", ".yaml", ".json")):
            for p in pairs_from_config(text, source):
                new_pairs.append(p)
        else:
            for p in pairs_from_generic(text, source):
                new_pairs.append(p)
        print(f"    -> {len(new_pairs)} pairs in {time.time()-t0:.2f}s", flush=True)

        # Deduplicate and limit per file
        count = 0
        for p in new_pairs:
            fp = json.dumps(p["messages"][1:])
            if fp not in pair_set:
                pair_set.add(fp)
                pairs.append(p)
                count += 1
                if count >= max_pairs_per_file:
                    break

    return pairs


def main():
    parser = argparse.ArgumentParser(description="Local ZION dataset collector (no API key)")
    parser.add_argument("--output", default="HiranV2.1/data/shards/zion_train_v2_2_local.jsonl")
    parser.add_argument("--max-pairs-per-file", type=int, default=50)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]  # HiranV2.1/finetune/ → kořen
    out_path = repo_root / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"[ZION] Scanning repo: {repo_root}")
    pairs = collect_dataset(repo_root, max_pairs_per_file=args.max_pairs_per_file)
    print(f"[ZION] Generated {len(pairs)} unique pairs")

    with open(out_path, "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"[ZION] Saved to: {out_path}")
    print(f"[ZION] Run: wc -l {out_path}")


if __name__ == "__main__":
    main()
