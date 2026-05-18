#!/usr/bin/env python3
"""
Hiran v2.2 Curriculum Dataset Builder
=====================================

Builds the 5-stage curriculum dataset from local ZION repo sources.
Output format: {"instruction": "...", "output": "...", "domain": "..."}

Stages:
  foundation     -- General blockchain, Rust basics, ZION overview
  zion_core      -- Core concepts: node, pool, miner, CLI, consensus, fees
  zion_advanced  -- Deployment, monitoring, bridge, DAO, warp, L3 services
  cross_domain   -- AI Native, Hiran, RAG, consciousness, autotuner
  rag_synthesis  -- Documentation, status, roadmaps, integration

Usage:
    cd HiranV2.2
    python scripts/build_curriculum.py
"""

import json
import os
import re
import hashlib
from pathlib import Path
from typing import Iterator, Dict, List, Optional

# ─── Config ──────────────────────────────────────────────────────────────
SKIP_DIRS = {
    "target", "node_modules", ".git", "dist", "build", "out",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".cargo", "vendor",
}

SCAN_ROOTS = [
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
    "HIRAN_V2.2_COMPLETION_PLAN.md",
    "HiranV2.1/Hiran_v2.1.md",
    "HiranV2.1/PLAN_v2.1.md",
    "HiranV2.1/HIRANYAGARBHA_UPGRADE_PLAN.md",
    "HiranV2.2/README.md",
    "HiranV2.2/TRAINING_IMPLEMENTATION_PLAN.md",
    "README.md",
    "ROADMAP.md",
    "V3/docker",
    "V3/sdk",
    "V3/L4",
    "docs/ROADMAP.md",
    "docs/QUICK_START.md",
    "docs/MAINNET_CHECKLIST.md",
    "docs/WARP_ARCHITECTURE.md",
    "docs/SECURITY_NOTICE_2026-04-28.md",
    "docs/CUDA_NVIDIA_INTEGRATION.md",
    "docs/Coin.md",
    "docs/Genesis.md",
    "docs/DEFI_FULL_ROADMAP.md",
    "docs/COSMIC_HARMONY_V4_UPGRADE.md",
    "docs/L1-L4_ROADMAP.md",
    "docs/L2_WZION_BRIDGE.md",
    "docs/ops",
]

INCLUDE_EXTENSIONS = {".md", ".rs", ".toml", ".py", ".json", ".yml", ".yaml"}
MAX_FILE_CHARS = 50_000
MAX_FILES = 600
MAX_PAIRS_PER_FILE = 100

# ─── Helpers ─────────────────────────────────────────────────────────────

def scan_files(repo_root: Path) -> Iterator[tuple[Path, str]]:
    """Yield (relative_path, text) for matching files, capped."""
    seen = set()
    count = 0
    for rel_path in SCAN_ROOTS:
        if count >= MAX_FILES:
            break
        abs_path = repo_root / rel_path
        if not abs_path.exists():
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
                if count >= MAX_FILES:
                    break
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
                for fname in filenames:
                    if count >= MAX_FILES:
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
                        if len(text) > MAX_FILE_CHARS:
                            text = text[:MAX_FILE_CHARS] + "\n... [truncated]"
                        yield (rel, text)
                        count += 1
                    except Exception:
                        pass


def _pair(instruction: str, output: str, domain: str = "foundation") -> Dict:
    """Build a single dataset row."""
    return {
        "instruction": instruction.strip(),
        "output": output.strip(),
        "domain": domain,
    }


# ─── Pair generators ─────────────────────────────────────────────────────

def pairs_from_markdown(text: str, source: str) -> Iterator[Dict]:
    """Extract heading+content as Q&A pairs."""
    heading_re = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)
    matches = list(heading_re.finditer(text))
    for i, match in enumerate(matches):
        level = len(match.group(1))
        heading = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if len(content) < 40:
            continue
        if heading.lower() in ("table of contents", "obsah", "contents", "toc"):
            continue
        q = heading
        if not q.endswith("?"):
            q = f"Co je {q}?" if level >= 3 else f"Vysvetli: {q}"
        a = content[:1800].strip()
        # Domain heuristics
        domain = "foundation"
        ltxt = (q + " " + a).lower()
        if any(k in ltxt for k in ["deploy", "monitor", "bridge", "dao", "warp", "docker"]):
            domain = "zion_advanced"
        elif any(k in ltxt for k in ["ai native", "hiran", "rag", "consciousness", "autotuner", "llm"]):
            domain = "cross_domain"
        elif any(k in ltxt for k in ["cli", "node", "pool", "miner", "consensus", "block", "chain", "fee", "hash"]):
            domain = "zion_core"
        yield _pair(q, a, domain)


def pairs_from_rust(text: str, source: str) -> Iterator[Dict]:
    """Extract doc comments + function signatures (line-based, no backtracking)."""
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        doc_lines = []
        while i < len(lines) and lines[i].strip().startswith("///"):
            doc_lines.append(lines[i].strip()[3:].strip())
            i += 1
        # skip blank lines
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i >= len(lines):
            break
        line = lines[i].strip()
        # Simple fn match (first line only, no nested parsing)
        m = re.match(r'^pub\s+(?:async\s+)?fn\s+(\w+)\s*\((.*?)\)', line)
        if m:
            func_name = m.group(1)
            params = m.group(2)[:200]
            doc = " ".join(doc_lines) if doc_lines else f"Funkce {func_name}"
            q = f"Co dela funkce `{func_name}()` v ZION runtime?"
            a = f"{doc}\n\nSignatura: `pub fn {func_name}({params})`\nZdroj: `{source}`"
            # Domain
            domain = "zion_core"
            if any(k in source.lower() for k in ["bridge", "dao", "warp", "swap", "atomic"]):
                domain = "zion_advanced"
            elif any(k in source.lower() for k in ["ai-native", "hiran", "consciousness", "autotuner"]):
                domain = "cross_domain"
            yield _pair(q, a, domain)
        i += 1


def pairs_from_config(text: str, source: str) -> Iterator[Dict]:
    """Extract config/env vars as Q&A."""
    # TOML keys
    for m in re.finditer(r'^(\w+)\s*=\s*"([^"]+)"', text, re.MULTILINE):
        key, val = m.group(1), m.group(2)
        if len(val) < 3:
            continue
        q = f"Jaka je hodnota `{key}` v konfiguraci `{source}`?"
        a = f"`{key} = \"{val}\"`"
        yield _pair(q, a, "zion_core")
    # Env vars in shell/Rust
    for m in re.finditer(r'([A-Z_]{5,})\s*=\s*([^\n]+)', text):
        key, val = m.group(1), m.group(2).strip()
        if len(val) < 2 or val.startswith("//"):
            continue
        q = f"K cemu slouzi promenna prostredi `{key}`?"
        a = f"`{key}` je nastavena na `{val}`."
        yield _pair(q, a, "zion_core")


def pairs_from_generic(text: str, source: str) -> Iterator[Dict]:
    """Chunk-based generic Q&A."""
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks = []
    current = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= 1500:
            current += ("\n\n" if current else "") + para
        else:
            if current:
                chunks.append(current)
            current = para
    if current:
        chunks.append(current)
    for chunk in chunks[:12]:
        if len(chunk) < 60:
            continue
        q = f"Vysvetli nasledujici koncept z `{source}`:"
        a = chunk[:1200]
        domain = "foundation"
        ltxt = (q + " " + a).lower()
        if any(k in ltxt for k in ["deploy", "monitor", "bridge", "dao", "warp", "docker", "production"]):
            domain = "zion_advanced"
        elif any(k in ltxt for k in ["ai native", "hiran", "rag", "consciousness", "autotuner", "llm", "embedding"]):
            domain = "cross_domain"
        elif any(k in ltxt for k in ["cli", "node", "pool", "miner", "consensus", "block", "chain", "fee", "hash", "p2p"]):
            domain = "zion_core"
        yield _pair(q, a, domain)


# ─── Seed pairs per stage ────────────────────────────────────────────────

def seed_pairs() -> Iterator[Dict]:
    """High-quality seed pairs for each curriculum stage."""
    seeds = [
        # foundation (general blockchain, ZION overview)
        ("Co je ZION blockchain?", "ZION je Proof-of-Work blockchain s ASIC-odolnym algoritmem VerusHash 2.2, inspirovanym Decred hybridnim konsensusem. Zakladni jednotkou je ZION coin.", "foundation"),
        ("Jaky je rozdil mezi ZION a Bitcoin?", "ZION pouziva VerusHash 2.2 (ASIC-odolny), podporuje hybridni konsensus s DAO governance, ma nativni L2/L3 bridge, atomic swap a AI-Native agenta Hiranyagarbhu.", "foundation"),
        ("Co znamena ASIC resistance?", "ASIC resistance znamena, ze mining algoritmus je navrzen tak, aby specializovany hardware (ASIC) nemel vyraznou vyhodu oproti beznym CPU/GPU. ZION pouziva VerusHash 2.2.", "foundation"),
        ("Co je blockchain konsensus?", "Konsensus je mechanismus, jakym se uzeli v decentralizovane siti shodnou na platnem stavu retezce. ZION pouziva hybridni konsensus kombinujici PoW s DAO governance.", "foundation"),
        ("Jake jsou zakladni vlastnosti ZION?", "Zakladni vlastnosti: ASIC-odolny VerusHash 2.2, 2-minute block time, hybridni konsensus, nativni L2 bridge, atomic swap, DAO governance, AI-Native agent Hiranyagarbha.", "foundation"),
        ("Co je Proof-of-Work?", "Proof-of-Work (PoW) je konsensus mechanismus, kde mineri resi vypocetne narocne ulohy k validaci bloku. ZION pouziva VerusHash 2.2, ktery je odolny vuci ASIC hardware.", "foundation"),
        ("Jak funguje decentralizace v ZION?", "ZION je plne decentralizovany: kazdy muze provozovat node, pool nebo miner. DAO governance umoznuje komunitni rozhodovani o smerovani projektu.", "foundation"),
        ("Co je ZION coin?", "ZION coin je nativni mena ZION blockchainu. Slouzi k platebnimu prostredku, stakingu v DAO governance a placeni transakcnich poplatku.", "foundation"),
        # zion_core
        ("Jak spustit ZION node?", "Pouzij prikaz `zion node start` nebo spust binarku: `ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:8443 cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`.", "zion_core"),
        ("Co je Ekam Deeksha?", "Ekam Deeksha je ZION Proof-of-Work algoritmus zalozeny na VerusHash 2.2 s casovymi okny, hashratem a specifickou obtiznosti pro kazdy blok.", "zion_core"),
        ("Jak funguje zion pool?", "Pool server (`zion-pool`) prijima TCP spojeni od mineru, validuje share, udrzuje PPLNS statistiky a posila vyresene bloky na node pres RPC.", "zion_core"),
        ("Jake prikazy ma zion CLI?", "Hlavni prikazy: `zion node`, `zion pool`, `zion mine`, `zion hiran`, `zion bridge`, `zion dao`, `zion warp`, `zion doctor`, `zion deploy`.", "zion_core"),
        ("Co je RevenueSource v ZION?", "RevenueSource enum definuje zdroje prijmu: PoolFee, BridgeFee, DaoTithe, SwapFee, NclFee, AgentFee, DcrReward. Kazdy zdroj ma vlastni split mezi zakladni fond, DAO a operatora.", "zion_core"),
        # zion_advanced
        ("Jak deployovat ZION mainnet stack?", "Pouzij `docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d`. Predtim nastav env v `.env` podle `V3/docker/DOCKER.md`.", "zion_advanced"),
        ("Co je ZION bridge?", "Bridge relay daemon propojuje ZION L1 s EVM chainy (ETH, BSC). Pouziva SQLite, sleduje deposity a withdrawal eventy a provadi relayer loop.", "zion_advanced"),
        ("Jak funguje atomic swap v ZION?", "Atomic swap pouziva HTLC (Hash Time Locked Contracts). Swap daemon sleduje L1, udrzuje refund loop a poskytuje Axum HTTP API pro iniciaci swapu.", "zion_advanced"),
        ("Jak monitorovat ZION node?", "Node exposuje Prometheus metrics endpoint. Grafana dashboard je v `V3/docker/grafana/dashboards/`. Alerting ma 5 pravidel (down, high latency, error rate, GPU, utilization).", "zion_advanced"),
        ("Jake Docker profily jsou dostupne?", "Docker Compose profily: `dev`, `mainnet`, `monitoring`, `hiran`. Hlavni prikaz: `docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d`.", "zion_advanced"),
        ("Co je ZION DAO?", "DAO daemon kombinuje L1 scanner a Axum HTTP API pro governance. Pouziva SQLite backend, treasury modul a governance modul pro hlasovani o navrzich.", "zion_advanced"),
        ("Jak funguje warp relay?", "Warp (`V3/L3/warp`) je cross-chain relay daemon s Axum API a background watcherem. Pouziva config-first startup s volitelnou SQLite persistenci.", "zion_advanced"),
        ("Co je emergency kill switch?", "Emergency kill switch (`V3/docs/EMERGENCY_KILL_SWITCH.md`) je manualni mechanismus pro okamzite zastaveni site v pripade kritickych bezpecnostnich incidentu.", "zion_advanced"),
        # cross_domain
        ("Kdo je Hiranyagarbha?", "Hiranyagarbha je ZION AI Native agent -- doménovy expert na ZION blockchain, Rust programovani a operátorskou orchestraci. Identita vychazi z dharmickeho konceptu 'zlatého zárodku'.", "cross_domain"),
        ("Jak funguje RAG v ZION?", "AI Native modul (`V3/L3/ai-native`) pouziva vektorovou databazi pro retrieval nad ZION docs. Pred kazdou odpovedi se vyhledaji relevantni chunky a pridaji se do promptu.", "cross_domain"),
        ("Co je Dharma Autotuner?", "Autotuner (`V3/L3/ai-native/src/autotuner.rs`) destiluje znalosti z dokumentace do system promptu a zvysuje XP agenta pri kazdem uspesnem uceni.", "cross_domain"),
        ("Jak integrovat Hiran do CLI?", "Prikaz `zion hiran start/stop/chat/ask` ovlada inference sluzbu. Config je v `[hiran]` sekci `~/.zion/zion.toml`. Docker service bezi na portu 8002.", "cross_domain"),
        ("Jak funguje consciousness engine?", "Consciousness engine (`V3/L3/ai-native/src/consciousness_engine.rs`) propojuje autotuner s llm backendem a ridi urovne vedomi agenta podle kvality odpovedi.", "cross_domain"),
        ("Jake embedding modely pouziva ZION RAG?", "ZION RAG pouziva `nvidia/nv-embedqa-e5-v5` (1024d) nebo `nv-embedqa-mistral-7b-v2` (4096d) z NVIDIA NIM free tier.", "cross_domain"),
        ("Co je ZION Oasis?", "ZION Oasis je planovana UE5 MMORPG hra integrujici ZION blockchain economy, SACRED_TRINITY postavy a GOLDEN_EGG_GAME herni smycku. Dokumentace je v `docs/docs2.9/ZION_OASIS/`.", "cross_domain"),
        ("Jak funguje knowledge base v ai-native?", "Knowledge base (`V3/L3/ai-native/src/knowledge_base.rs`) uklada a spravuje embedding indexy nad ZION dokumentaci pro RAG retrieval.", "cross_domain"),
        # rag_synthesis
        ("Jaky je aktualni stav V3?", "Podle `StatusV3.md` (2026-05-12): Hiran v2.2 CLI integrace hotova, bridge 3/5 validator provisioning ceka, CI billing issue je znamy, externi audit je naplanovan.", "rag_synthesis"),
        ("Jaka je roadmapa ZION?", "Roadmapa (`V3/ROADMAP.md`) pokryva: L1 mainnet konsensus, L2 bridge production, L3 AI Native deployment, DAO governance, ZION Oasis (UE5 MMORPG) a cross-chain warp relay.", "rag_synthesis"),
        ("Jake jsou hlavni bezpecnostni pozadavky?", "Bezpecnostni checklist (`V3/docs/SECURITY_CHECKLIST.md`) pokryva: Genesis block validaci, key management, pool payout audit, bridge multi-sig, emergency kill switch a secret rotation.", "rag_synthesis"),
        ("Co je AGENTS.md?", "`AGENTS.md` je provozni navod pro automatizovane agenty (Devin, WARP, Copilot). Definuje poradi zdroju pravdy: `StatusV3.md` -> `V3/README.md` -> `V3/docs/**`.", "rag_synthesis"),
        ("Jake auditni reporty existuji?", "Existuji: `V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md`, `2026-04-V3_AUDIT_COMPLETION.md`, `EXTERNAL_AUDIT_SCOPE_TEMPLATE.md`, `FUZZING_AND_DYNAMIC_ANALYSIS_PLAN.md`.", "rag_synthesis"),
        ("Jak funguje revenue system?", "Revenue system (`V3/L1/cosmic-harmony`) pouziva model 50/25/25: 50% zakladni fond, 25% DAO, 25% operator. Podporuje DCR dual-mining a admin web UI.", "rag_synthesis"),
        ("Co je ZION CLI deploy playbook?", "`V3/docs/CLI_DEPLOY_PLAYBOOK.md` obsahuje krok-za-krokem navod na deploy ZION stacku pomoci `zion deploy` prikazu a Docker Compose.", "rag_synthesis"),
    ]
    for instruction, output, domain in seeds:
        yield _pair(instruction, output, domain)


# ─── Stage balancing ─────────────────────────────────────────────────────

def classify_stage(pair: Dict) -> str:
    """Classify a pair into one of 5 curriculum stages."""
    txt = (pair.get("instruction", "") + " " + pair.get("output", "")).lower()
    domain = pair.get("domain", "foundation")
    # cross_domain keywords
    if any(k in txt for k in ["ai native", "hiran", "rag ", "consciousness", "autotuner", "llm", "embedding", "vector db", "inference"]):
        return "cross_domain"
    # rag_synthesis keywords
    if any(k in txt for k in ["status", "roadmap", "plan", "checklist", "audit", "report", "guide", "migration", "upgrade"]):
        return "rag_synthesis"
    # zion_advanced keywords
    if any(k in txt for k in ["deploy", "docker", "monitor", "grafana", "prometheus", "bridge", "dao ", "warp", "swap", "atomic", "production"]):
        return "zion_advanced"
    # zion_core keywords
    if any(k in txt for k in ["node ", "pool ", "miner", "consensus", "block", "chain", "fee", "hash", "p2p", "rpc", "cli ", "cargo", "runtime", "emission", "genesis", "mempool", "wallet"]):
        return "zion_core"
    return "foundation"


# ─── Main builder ────────────────────────────────────────────────────────

def build_dataset(repo_root: Path) -> Dict[str, List[Dict]]:
    """Build complete curriculum dataset from local repo."""
    all_pairs: List[Dict] = []
    pair_hashes: set = set()

    def add_pair(p: Dict) -> bool:
        """Add pair if unique. Returns True if added."""
        h = hashlib.sha256((p["instruction"] + p["output"]).encode()).hexdigest()[:16]
        if h in pair_hashes:
            return False
        pair_hashes.add(h)
        all_pairs.append(p)
        return True

    # 1. Seed pairs
    print("[BUILD] Adding seed pairs...")
    for p in seed_pairs():
        add_pair(p)

    # 2. Local files
    print("[BUILD] Scanning repository...")
    scanned = 0
    for rel_path, text in scan_files(repo_root):
        source = str(rel_path).replace("\\", "/")
        scanned += 1
        new_pairs: List[Dict] = []
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
        # dedup and limit per file
        added = 0
        for p in new_pairs:
            if add_pair(p):
                added += 1
                if added >= MAX_PAIRS_PER_FILE:
                    break
        if scanned % 50 == 0:
            print(f"  ... scanned {scanned} files, {len(all_pairs)} total pairs")

    print(f"[BUILD] Scanned {scanned} files, generated {len(all_pairs)} unique pairs")

    # 3. Split into stages
    stages = {
        "foundation": [],
        "zion_core": [],
        "zion_advanced": [],
        "cross_domain": [],
        "rag_synthesis": [],
    }
    for p in all_pairs:
        stage = classify_stage(p)
        stages[stage].append(p)

    # 4. Report
    print("\n[BUILD] Stage distribution:")
    total = 0
    for stage, items in stages.items():
        total += len(items)
        print(f"  {stage:20s}: {len(items):5d} pairs")
    print(f"  {'TOTAL':20s}: {total:5d} pairs")

    return stages


def save_curriculum(stages: Dict[str, List[Dict]], output_dir: Path) -> None:
    """Save curriculum stages to JSONL files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for stage, items in stages.items():
        path = output_dir / f"{stage}.jsonl"
        with open(path, "w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"[SAVE] {path}  ->  {len(items)} rows")

    # Write stats
    stats = {
        "total_pairs": sum(len(v) for v in stages.values()),
        "stage_stats": {k: len(v) for k, v in stages.items()},
        "generated_at": "2026-05-18T08:00:00Z",
        "status": "READY",
    }
    with open(output_dir / "dataset_stats.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)
    print(f"[SAVE] {output_dir / 'dataset_stats.json'}")


def main():
    repo_root = Path(__file__).resolve().parents[2]  # HiranV2.2/scripts/ -> repo root
    output_dir = repo_root / "HiranV2.2" / "data" / "curriculum"

    print("=" * 60)
    print("Hiran v2.2 Curriculum Dataset Builder")
    print("=" * 60)
    print(f"Repo root: {repo_root}")
    print(f"Output:    {output_dir}")
    print()

    stages = build_dataset(repo_root)
    save_curriculum(stages, output_dir)

    print("\n[OK] Done. Run training with:")
    print("     python HiranV2.2/scripts/train_v2.2.py --dry_run")


if __name__ == "__main__":
    main()
