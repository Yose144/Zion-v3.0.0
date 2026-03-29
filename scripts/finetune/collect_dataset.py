#!/usr/bin/env python3
"""
ZION AI Native — Dataset Collector pro fine-tuning
===================================================

Skenuje ZION projekt (docs, README, Rust zdrojáky) a generuje
tréninkový dataset ve formátu JSONL (chat format) pro QLoRA fine-tuning.

Generování Q&A párů probíhá přes NVIDIA NIM free API (zdarma).

Výstup: data/zion_train.jsonl  (chat format, Llama-3 instrukce)

Použití
-------
    export NVIDIA_API_KEY=nvapi-...
    python collect_dataset.py --output data/zion_train.jsonl --max-docs 100

Formát výstupu (každý řádek je 1 JSON objekt):
    {
      "messages": [
        {"role": "system", "content": "Jsi ZION blockchain expert..."},
        {"role": "user",   "content": "Co je Ekam Deeksha mining algoritmus?"},
        {"role": "assistant", "content": "Ekam Deeksha je..."}
      ]
    }
"""

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Iterator

import requests

# ─── Konfigurace ─────────────────────────────────────────────────────────────

NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"
CHAT_MODEL  = "meta/llama-3.1-8b-instruct"   # free tier, 8B — ideální pro generování dat

SYSTEM_PROMPT = """Jsi expert na ZION blockchain projekt.
ZION je Proof-of-Work blockchain s vlastním mining algoritmem Ekam Deeksha (SHA3-512 + AES-256 memory-hard).
Odpovídej přesně, technicky a v češtině. Pokud nevíš, řekni to otevřeně."""

# Adresáře / přípony pro skenování
SCAN_ROOTS = [
    "docs",
    "README.md",
    "HIRANYAGARBHA_AI_NATIVE.md",
    "V3/README.md",
    "V3/ROADMAP.md",
    "L3/ai-native/src",
]

INCLUDE_EXTENSIONS = {".md", ".rs", ".toml", ".py"}
MAX_CHUNK_CHARS = 1500   # Maximální délka jednoho chunku
CHUNK_OVERLAP   = 200    # Překryv mezi chunky


# ─── Chunking ────────────────────────────────────────────────────────────────

def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Rozdělí text na chunky maximální délky s překryvem."""
    # Preferuj dělení na odstavcích
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= max_chars:
            current = (current + "\n\n" + para).strip()
        else:
            if current:
                chunks.append(current)
            # Overlap: vezmi konec předchozího chunku
            if len(current) > overlap:
                current = current[-overlap:].strip() + "\n\n" + para
            else:
                current = para

    if current:
        chunks.append(current)

    return [c for c in chunks if len(c) > 100]  # ignoruj příliš krátké


def scan_files(project_root: Path, max_docs: int = 200) -> Iterator[tuple[str, str]]:
    """
    Generátor (filename, content) pro všechny relevantní soubory.
    Vrátí tuple (relative_path, text_content).
    """
    count = 0
    for root_rel in SCAN_ROOTS:
        root_path = project_root / root_rel
        if root_path.is_file():
            if count >= max_docs:
                return
            try:
                content = root_path.read_text(encoding="utf-8", errors="ignore")
                if content.strip():
                    yield str(root_path.relative_to(project_root)), content
                    count += 1
            except Exception:
                pass
        elif root_path.is_dir():
            for f in sorted(root_path.rglob("*")):
                if count >= max_docs:
                    return
                if f.suffix not in INCLUDE_EXTENSIONS:
                    continue
                if any(part.startswith(".") for part in f.parts):
                    continue
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    if content.strip():
                        yield str(f.relative_to(project_root)), content
                        count += 1
                except Exception:
                    pass


# ─── NIM API klient ──────────────────────────────────────────────────────────

def nim_chat(api_key: str, messages: list[dict], temperature: float = 0.3) -> str:
    """Zavolá NVIDIA NIM chat completions API. Vrátí text odpovědi."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": CHAT_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 512,
    }
    for attempt in range(3):
        try:
            resp = requests.post(
                f"{NVIDIA_BASE}/chat/completions",
                headers=headers,
                json=payload,
                timeout=30,
            )
            if resp.status_code == 429:
                # Rate limit — počkej a zkus znovu
                wait = 2 ** attempt
                print(f"  [rate-limit] čekám {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except requests.RequestException as e:
            print(f"  [chyba] pokus {attempt+1}: {e}")
            time.sleep(1)
    return ""


def generate_qa_pair(api_key: str, source: str, chunk: str) -> dict | None:
    """
    Vygeneruje 1 Q&A pár z textového chunku.
    Vrátí dict s 'messages' nebo None při chybě.
    """
    # Prompt pro generování otázky
    gen_prompt = f"""Z následujícího textu ze ZION projektu vygeneruj 1 technickou otázku a odpověď.

ZDROJ: {source}
TEXT:
{chunk}

Formát odpovědi (JSON):
{{
  "question": "...",
  "answer": "..."
}}

Otoázka musí být konkrétní a technická. Odpověď musí vycházet pouze z textu."""

    raw = nim_chat(
        api_key,
        [{"role": "user", "content": gen_prompt}],
        temperature=0.4,
    )
    if not raw:
        return None

    # Parsuj JSON z odpovědi
    try:
        # Hledej JSON blok v textu
        match = re.search(r"\{[^{}]*\"question\"[^{}]*\"answer\"[^{}]*\}", raw, re.DOTALL)
        if not match:
            return None
        qa = json.loads(match.group())
        question = qa.get("question", "").strip()
        answer   = qa.get("answer", "").strip()
        if not question or not answer or len(answer) < 20:
            return None

        return {
            "messages": [
                {"role": "system",    "content": SYSTEM_PROMPT},
                {"role": "user",      "content": question},
                {"role": "assistant", "content": answer},
            ]
        }
    except (json.JSONDecodeError, KeyError):
        return None


# ─── Seed dataset (ručně psané páry) ─────────────────────────────────────────

SEED_PAIRS = [
    {
        "user": "Co je ZION blockchain a čím se liší od Bitcoinu?",
        "assistant": (
            "ZION je Proof-of-Work blockchain s vlastním mining algoritmem Ekam Deeksha. "
            "Na rozdíl od Bitcoinu (SHA-256) používá ZION SHA3-512 + AES-256 memory-hard funkci "
            "s 256 KiB scratchpad pamětí, což zvýhodňuje GPU oproti ASIC. "
            "Síť funguje na portu 3333 (mining pool), 9333 (P2P) a 9334 (RPC)."
        ),
    },
    {
        "user": "Jak nakonfigurovat ZION mining pool worker?",
        "assistant": (
            "V konfiguračním souboru nebo přes env proměnné nastav:\n"
            "  ZION_POOL_URL=stratum+tcp://pool.zion.network:3333\n"
            "  ZION_WALLET=tvoje-wallet-adresa\n"
            "  ZION_WORKER=nazev-workeru\n"
            "Pool server implementuje Stratum protokol. "
            "Doporučená konfigurace: pool_threads = 4, share_difficulty = 0.001."
        ),
    },
    {
        "user": "Jak funguje DharmaScore a k čemu slouží?",
        "assistant": (
            "DharmaScore je metrika etického chování agenta v rozsahu 0.0 (chaos) až 1.0 (satori). "
            "Počítá se jako klouzavý průměr 6 komponent: dharma_violations, oath_adherence, "
            "relationship_health, contribution_score, consciousness_growth a grace_multiplier. "
            "Score ovlivňuje váhu hlasů agenta v Orchestratoru a přístup k Oasis vrstvě (L4)."
        ),
    },
    {
        "user": "Co je HiranyagarbhaAgent a jak se inicializuje?",
        "assistant": (
            "HiranyagarbhaAgent je hlavní AI Native agent pro ZION síť. "
            "Implementuje MML (Multi-Modal Learning) pipeline s vědomostními vrstvami. "
            "Inicializace:\n"
            "  let agent = HiranyagarbhaAgent::new(\"nazev_agenta\", \"peněženka\");\n"
            "Agent prochází fázemi vědomí od Dormant → Awakening → Conscious → Enlightened → Satori. "
            "Každá fáze odemyká nové schopnosti v LLM backendu."
        ),
    },
    {
        "user": "Jak nasadit ZION V3 node přes Docker?",
        "assistant": (
            "Použij docker-compose.v3-mainnet.yml:\n"
            "  docker compose -f docker/docker-compose.v3-mainnet.yml up -d\n"
            "Node spustí: zion-core (port 9333/9334), zion-pool (port 3333), zion-miner. "
            "Konfiguraci nastav v config/mainnet.toml nebo přes env proměnné (ZION_NETWORK=mainnet). "
            "Pre-check: docker compose -f docker/docker-compose.v3-mainnet.yml config"
        ),
    },
    {
        "user": "Jak napsat Rust funkci která počítá Ekam Deeksha hash?",
        "assistant": (
            "Ekam Deeksha je 6-krokový algoritmus:\n"
            "  1. SHA3-512 vstupního bloku (64 bajtů)\n"
            "  2. SHA3-512 druhé kolo (rozšíření entropie)\n"
            "  3. Golden Matrix transform 3×3 (φ=0.618)\n"
            "  4. Memory-hard: 256 KiB scratchpad s AES-256 permutacemi\n"
            "  5. NPU Mix: INT8 MLP váhy (simulace neuronové sítě)\n"
            "  6. Cosmic Fusion: 8 kol AES-CBC s rotujícím klíčem\n"
            "V Rust crate zion-miner je implementován v ekam_deeksha.rs. "
            "Metal/GPU verze je v APP&WEB/desktop-agent/resources/mining/ekam_deeksha.metal."
        ),
    },
    {
        "user": "Co je EkamField a jak funguje DeekshaNetwork?",
        "assistant": (
            "EkamField je P2P síť vědomí pro sdílení znalostí mezi AI Native agenty. "
            "Každý EkamFieldNode má: node_id, dharma_score, consciousness_level, peers. "
            "DeekshaNetwork koordinuje přenos (DeekshaTransfer) přes EkamFieldNode nody. "
            "Každý transfer nese HiranyagarbhaFieldEvent s φ=0.618 vahami. "
            "Network konverguje ke konsenzu přes váhované průměry (golden ratio convergence)."
        ),
    },
    {
        "user": "Jak integrovat NVIDIA NIM API do ZION agenta?",
        "assistant": (
            "Použi RemoteHttpBackend s NVIDIA NIM endpoint:\n"
            "  let backend = RemoteHttpBackend::new(\n"
            "    \"meta/llama-3.1-8b-instruct\",\n"
            "    \"https://integrate.api.nvidia.com/v1\",\n"
            "    std::env::var(\"NVIDIA_API_KEY\").unwrap(),\n"
            "  );\n"
            "NVIDIA NIM nabízí 188+ modelů na free tier (omezeno počtem req/min). "
            "Pro embedding použi NimEmbeddingBackend (nvidia/nv-embedqa-e5-v5, 1024 dim). "
            "API klíč získáš na build.nvidia.com."
        ),
    },
    {
        "user": "Jak funguje RAG pipeline v zion-ai-native?",
        "assistant": (
            "RAG (Retrieval-Augmented Generation) v modulu rag.rs:\n"
            "  1. Indexování: RagRetriever::index(id, content) → NimEmbeddingBackend → VectorStore\n"
            "  2. Vyhledávání: retrieve(query) → embed(query) → cosine_similarity → top-k docs\n"
            "  3. Augmentace: RagBackend::generate() → augment_prompt() → [KONTEXT] + dotaz\n"
            "  4. Generování: předá augmentovaný prompt vnitřnímu LlmBackend\n"
            "VectorStore je in-memory (Phase V). Phase VI+ přejde na sqlite-vec."
        ),
    },
]


def build_seed_dataset() -> list[dict]:
    """Vrátí seed páry ve standardním chat formátu."""
    return [
        {
            "messages": [
                {"role": "system",    "content": SYSTEM_PROMPT},
                {"role": "user",      "content": p["user"]},
                {"role": "assistant", "content": p["assistant"]},
            ]
        }
        for p in SEED_PAIRS
    ]


# ─── Hlavní logika ────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="ZION fine-tune dataset collector")
    parser.add_argument("--output",    default="data/zion_train.jsonl", help="Výstupní JSONL soubor")
    parser.add_argument("--max-docs",  type=int, default=50,   help="Max počet dokumentů ke skenování")
    parser.add_argument("--seed-only", action="store_true",    help="Pouze seed páry, bez NIM generování")
    parser.add_argument("--project",   default=None,           help="Cesta k projektu ZION (auto-detect)")
    args = parser.parse_args()

    api_key = os.environ.get("NVIDIA_API_KEY", "")
    if not api_key and not args.seed_only:
        print("VAROVÁNÍ: NVIDIA_API_KEY není nastaven — přepínám na --seed-only")
        args.seed_only = True

    # Auto-detect project root
    if args.project:
        project_root = Path(args.project).resolve()
    else:
        # Hledej od aktuálního adresáře nahoru
        here = Path(__file__).resolve()
        for parent in [here.parent.parent.parent, here.parent.parent, Path.cwd()]:
            if (parent / "Cargo.toml").exists():
                project_root = parent
                break
        else:
            project_root = Path.cwd()
    print(f"Projekt root: {project_root}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    dataset: list[dict] = []

    # 1. Seed páry
    seeds = build_seed_dataset()
    dataset.extend(seeds)
    print(f"Seed dataset: {len(seeds)} párů")

    # 2. Generování z dokumentů přes NIM
    if not args.seed_only:
        print(f"\nSkenování projektu (max {args.max_docs} souborů)...")
        generated = 0
        errors = 0

        for file_path, content in scan_files(project_root, args.max_docs):
            chunks = chunk_text(content)
            print(f"  {file_path}: {len(chunks)} chunků")

            for i, chunk in enumerate(chunks[:3]):  # max 3 chunky na soubor
                print(f"    chunk {i+1}/{min(3, len(chunks))} ({len(chunk)} znaků)...", end=" ")
                entry = generate_qa_pair(api_key, file_path, chunk)
                if entry:
                    dataset.append(entry)
                    generated += 1
                    print(f"✓ (otázka: {entry['messages'][1]['content'][:60]}...)")
                else:
                    errors += 1
                    print("✗ (přeskočeno)")

                time.sleep(0.5)  # Respektuj rate limit

        print(f"\nVygenerováno: {generated} párů, chyby: {errors}")

    # 3. Zápis výstupu
    with open(output_path, "w", encoding="utf-8") as f:
        for entry in dataset:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"\n✅ Dataset uložen: {output_path}")
    print(f"   Celkem: {len(dataset)} tréninkových párů")
    print(f"   Přibližná cena fine-tuningu (A100 40GB, 1 epocha): ${len(dataset) * 0.001:.2f}")

    # Statistiky
    total_tokens_est = sum(
        len(json.dumps(e, ensure_ascii=False).split()) for e in dataset
    ) * 1.3  # přibližný poměr slov → tokenů
    print(f"   Odhadovaný počet tokenů: ~{total_tokens_est:,.0f}")


if __name__ == "__main__":
    main()
