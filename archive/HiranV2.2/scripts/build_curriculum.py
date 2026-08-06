#!/usr/bin/env python3
"""
Hiran v2.2 Curriculum Dataset Builder — Robust Edition
========================================================

Builds 5000+ high-quality curriculum pairs from local ZION repo sources.
Output format: {"instruction": "...", "output": "...", "domain": "..."}

Stages:
  foundation     -- General blockchain, ZION overview, basics
  zion_core      -- Node, pool, miner, CLI, consensus, fees, L1
  zion_advanced  -- Deployment, monitoring, bridge, DAO, warp, L2/L3
  cross_domain   -- AI Native, Hiran, RAG, consciousness, autotuner, Oasis
  rag_synthesis  -- Docs, status, roadmaps, audits, guides

Usage:
    python HiranV2.2/scripts/build_curriculum.py
"""

import json
import os
import re
import hashlib
from pathlib import Path
from typing import Iterator, Dict, List, Optional, Tuple

# ─── Config ──────────────────────────────────────────────────────────────
SKIP_DIRS = {
    "target", "node_modules", ".git", "dist", "build", "out",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".cargo", "vendor",
    "public_html", "assets", "webfonts", "node_modules",
}

SCAN_ROOTS = [
    # Core docs
    "AGENTS.md",
    "StatusV3.md",
    "StatusV3-Part2.md",
    "V3/README.md",
    "V3/ROADMAP.md",
    "V3/docs",
    "V3/cli",
    # L1 core
    "V3/L1/core/src",
    "V3/L1/pool/src",
    "V3/L1/miner/src",
    "V3/L1/cosmic-harmony/src",
    # L2/L3
    "V3/L2",
    "V3/L3",
    "V3/L4",
    # Revenue & integration
    "revenue.md",
    "HIRAN_V2.2_CLI_INTEGRATION.md",
    "HIRAN_V2.2_COMPLETION_PLAN.md",
    # Hiran plans
    "HiranV2.1/Hiran_v2.1.md",
    "HiranV2.1/PLAN_v2.1.md",
    "HiranV2.1/HIRANYAGARBHA_UPGRADE_PLAN.md",
    # Hiran v2.2 docs
    "HiranV2.2/README.md",
    "HiranV2.2/TRAINING_IMPLEMENTATION_PLAN.md",
    "HiranV2.2/TRAINING_CHECKLIST.md",
    # Root docs
    "README.md",
    "ROADMAP.md",
    # Docker & SDK
    "V3/docker",
    "V3/sdk",
    # ZION Oasis (huge gaming corpus)
    "docs/docs2.9/ZION_OASIS",
    # Additional docs
    "docs/ROADMAP.md",
    "docs/QUICK_START.md",
    "docs/MAINNET_CHECKLIST.md",
    "docs/WARP_ARCHITECTURE.md",
    "docs/CUDA_NVIDIA_INTEGRATION.md",
    "docs/Coin.md",
    "docs/Genesis.md",
    "docs/DEFI_FULL_ROADMAP.md",
    "docs/L1-L4_ROADMAP.md",
    "docs/L2_WZION_BRIDGE.md",
    "docs/COSMIC_HARMONY_V4_UPGRADE.md",
    "docs/COSMIC_HARMONY_V4_UPGRADE_CS.md",
    "docs/ops",
    # Scripts & tests
    "scripts",
    "tests",
]

INCLUDE_EXTENSIONS = {".md", ".rs", ".toml", ".py", ".json", ".yml", ".yaml", ".sh"}
MAX_FILE_CHARS = 50_000
MAX_FILES = 800
MAX_PAIRS_PER_FILE = 200

# ─── Helpers ─────────────────────────────────────────────────────────────

def scan_files(repo_root: Path) -> Iterator[Tuple[Path, str]]:
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
    return {"instruction": instruction.strip(), "output": output.strip(), "domain": domain}


# ─── Multi-variant Q&A from a single chunk ───────────────────────────────

def _variants_from_chunk(chunk: str, source: str, base_domain: str) -> Iterator[Dict]:
    """Generate multiple question variants from one content chunk."""
    chunk = chunk.strip()
    if len(chunk) < 40:
        return
    # Truncate very long outputs
    out = chunk[:2000].strip()
    src_name = Path(source).stem

    # Variant 1: "Co je / What is"
    yield _pair(f"Co je popsano v nasledujici sekci z `{src_name}`?", out, base_domain)

    # Variant 2: "Vysvetli / Explain"
    yield _pair(f"Vysvetli nasledujici koncept z dokumentace `{src_name}`:", out, base_domain)

    # Variant 3: "Jak funguje / How does it work" (if technical)
    if any(k in out.lower() for k in ["fn ", "function", "protocol", "algorithm", "mechanism", "process", "system"]):
        yield _pair(f"Jak funguje system popsaný v `{src_name}`?", out, base_domain)

    # Variant 4: "Jak nakonfigurovat / How to configure" (if config-related)
    if any(k in out.lower() for k in ["config", "env", "docker", "toml", "setup", "deploy"]):
        yield _pair(f"Jak nakonfigurovat nebo nastavit popsanou komponentu v `{src_name}`?", out, base_domain)

    # Variant 5: Programming-specific
    if source.endswith(".rs"):
        yield _pair(f"Vysvetli nasledujici Rust kod z `{src_name}`:", f"```rust\n{out[:800]}\n```", base_domain)


# ─── Domain classifier ───────────────────────────────────────────────────

def classify_domain(text: str, source: str) -> str:
    txt = (text + " " + source).lower()
    src = source.lower()

    # cross_domain: AI Native, Hiran — require STRONG signals
    if any(k in txt for k in ["ai native", "hiranyagarbha", "consciousness engine", "autotuner", "llm backend", "embedding model", "vector database", "inference server", "rag pipeline", "knowledge base", "warp agent", "tool orchestration"]):
        return "cross_domain"
    # Oasis only if from Oasis docs AND has specific Oasis terms
    if "zion_oasis" in src or "oasis" in src:
        if any(k in txt for k in ["golden_egg", "sacred_trinity", "consciousness level", "guild system", "territory map", "blueprint generator", "quest design", "avatar roster", "cosmic map", "oasis ue5"]):
            return "cross_domain"

    # rag_synthesis: status docs, roadmaps, guides — only from specific sources
    if any(k in src for k in ["statusv3", "roadmap", "checklist", "upgrade_plan", "security_notice", "preflight", "smos_integration", "deploy_playbook", "mainnet_guide", "audit_", "report_", "plan_"]):
        return "rag_synthesis"
    if any(k in txt for k in ["status report", "launch checklist", "security audit", "external audit", "mainnet readiness", "genesis rollout"]):
        return "rag_synthesis"

    # zion_advanced: deployment, L2, L3 services — require specific terms
    if any(k in txt for k in ["docker compose", "prometheus metrics", "grafana dashboard", "bridge relay", "atomic swap", "htlc contract", "dao governance", "warp relay", "ncl ", "emergency kill", "pool payout", "revenue split", "operational server", "deployment guide"]):
        return "zion_advanced"
    if any(k in src for k in ["v3/docker", "v3/l2", "v3/l3/warp", "bridge", "dao", "atomic-swap", "revenue_system"]):
        if any(k in txt for k in ["deploy", "docker", "bridge", "dao", "swap", "warp", "monitor", "grafana", "prometheus"]):
            return "zion_advanced"

    # zion_core: L1, node, pool, miner, CLI
    if any(k in txt for k in ["node ", "pool server", "miner ", "consensus ", "blockchain", "block ", "chain state", "transaction fee", "hash rate", "p2p ", "rpc endpoint", "zion cli", "cargo run", "mempool", "genesis block", "difficulty adjustment", "peer manager", "block validation", "emission schedule", "checkpoint ", "orphan block", "ibd ", "initial block"]):
        return "zion_core"
    if any(k in src for k in ["v3/l1/core", "v3/l1/pool", "v3/l1/miner", "v3/cli", "cosmic-harmony"]):
        return "zion_core"

    return "foundation"


# ─── Pair generators ─────────────────────────────────────────────────────

def pairs_from_markdown(text: str, source: str) -> Iterator[Dict]:
    """Extract Q&A from markdown: headings, tables, lists, code blocks."""
    # 1. Heading-based sections
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
        a = content[:2000].strip()
        domain = classify_domain(q + " " + a, source)
        yield _pair(q, a, domain)
        # Also generate variants from the same content
        for v in _variants_from_chunk(content, source, domain):
            yield v

    # 2. Table extraction
    table_re = re.compile(r"(\|[^\n]+\|\n\|[-:|\s]+\|\n(?:\|[^\n]+\|\n?)+)", re.MULTILINE)
    for table_match in table_re.finditer(text):
        table = table_match.group(1)
        rows = [r.strip() for r in table.strip().split("\n") if r.strip() and not r.strip().startswith("|---")]
        if len(rows) >= 3:
            header = rows[0]
            # Generate a Q&A about the table
            yield _pair(
                f"Jaka data jsou uvedena v nasledujici tabulce z `{source}`?",
                f"Tabulka z `{source}`:\n{table[:1500]}",
                classify_domain(table, source)
            )

    # 3. List extraction
    list_re = re.compile(r"((?:^\s*[-*+]\s+.+\n?)+)", re.MULTILINE)
    for list_match in list_re.finditer(text):
        lst = list_match.group(1)
        items = [l.strip()[2:].strip() for l in lst.strip().split("\n") if l.strip().startswith(("- ", "* ", "+ "))]
        if len(items) >= 3:
            yield _pair(
                f"Jake polozky obsahuje nasledujici seznam z `{source}`?",
                "\n".join(f"- {it}" for it in items[:20]),
                classify_domain(lst, source)
            )

    # 4. Code block extraction
    code_re = re.compile(r"```(\w+)?\n(.*?)```", re.DOTALL)
    for code_match in code_re.finditer(text):
        lang = code_match.group(1) or ""
        code = code_match.group(2).strip()
        if len(code) < 30 or len(code) > 1000:
            continue
        if lang in ("rust", "python", "bash", "toml", "yaml", "json"):
            domain = classify_domain(code, source)
            yield _pair(
                f"Vysvetli nasledujici {lang} kod z `{source}`:",
                f"```{lang}\n{code[:800]}\n```",
                domain
            )


def pairs_from_rust(text: str, source: str) -> Iterator[Dict]:
    """Extract doc comments + function signatures + structs + enums."""
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        # Collect doc comments
        doc_lines = []
        while i < len(lines) and lines[i].strip().startswith("///"):
            doc_lines.append(lines[i].strip()[3:].strip())
            i += 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i >= len(lines):
            break
        line = lines[i].strip()
        doc = " ".join(doc_lines) if doc_lines else ""

        # pub fn
        m = re.match(r'^pub\s+(?:async\s+)?fn\s+(\w+)\s*\((.*?)\)', line)
        if m:
            func_name = m.group(1)
            params = m.group(2)[:200]
            q = f"Co dela funkce `{func_name}()` v ZION runtime?"
            a = f"{doc}\n\nSignatura: `pub fn {func_name}({params})`\nZdroj: `{source}`"
            domain = classify_domain(text + " " + source, source)
            yield _pair(q, a, domain)
            # How-to-use variant
            yield _pair(
                f"Jak pouzit funkci `{func_name}()` v ZION kodu?",
                f"Funkce `{func_name}({params})` se pouziva takto:\n```rust\n// Volani funkce\n{func_name}(...);\n```\n{doc}",
                domain
            )

        # pub struct
        m = re.match(r'^pub\s+struct\s+(\w+)', line)
        if m:
            struct_name = m.group(1)
            q = f"Co reprezentuje struct `{struct_name}` v ZION?"
            a = f"{doc}\n\nDefinice: `pub struct {struct_name}`\nZdroj: `{source}`"
            domain = classify_domain(text + " " + source, source)
            yield _pair(q, a, domain)

        # pub enum
        m = re.match(r'^pub\s+enum\s+(\w+)', line)
        if m:
            enum_name = m.group(1)
            q = f"Jake varianty ma enum `{enum_name}` v ZION?"
            a = f"{doc}\n\nEnum: `pub enum {enum_name}`\nZdroj: `{source}`"
            domain = classify_domain(text + " " + source, source)
            yield _pair(q, a, domain)

        # impl blocks
        m = re.match(r'^impl\s+(?:<.*?>)?\s*(\w+)', line)
        if m:
            impl_name = m.group(1)
            q = f"Jake metody implementuje `{impl_name}`?"
            a = f"Implementace pro `{impl_name}`. {doc}\nZdroj: `{source}`"
            domain = classify_domain(text + " " + source, source)
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
        yield _pair(q, a, classify_domain(text, source))

    # Env vars
    for m in re.finditer(r'([A-Z_]{5,})\s*=\s*([^\n]+)', text):
        key, val = m.group(1), m.group(2).strip()
        if len(val) < 2 or val.startswith("//"):
            continue
        q = f"K cemu slouzi promenna prostredi `{key}`?"
        a = f"`{key}` je nastavena na `{val}`."
        yield _pair(q, a, classify_domain(text, source))

    # YAML keys (simple)
    for m in re.finditer(r'^(\w+):\s*(\S+)', text, re.MULTILINE):
        key, val = m.group(1), m.group(2)
        if len(val) < 2:
            continue
        q = f"Co znamena `{key}` v konfiguraci `{source}`?"
        a = f"`{key}: {val}`"
        yield _pair(q, a, classify_domain(text, source))


def pairs_from_generic(text: str, source: str) -> Iterator[Dict]:
    """Chunk-based generic Q&A with multiple variants."""
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks = []
    current = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= 2000:
            current += ("\n\n" if current else "") + para
        else:
            if current:
                chunks.append(current)
            current = para
    if current:
        chunks.append(current)

    for chunk in chunks[:15]:
        if len(chunk) < 60:
            continue
        domain = classify_domain(chunk, source)
        for v in _variants_from_chunk(chunk, source, domain):
            yield v


def pairs_from_shell(text: str, source: str) -> Iterator[Dict]:
    """Extract shell commands as how-to pairs."""
    # Find command blocks or individual commands
    for m in re.finditer(r'^(\$?\s*(?:cargo|docker|zion|npm|node|python|git|make|cmake)\s+.+)$', text, re.MULTILINE):
        cmd = m.group(1).strip().lstrip("$ ")
        if len(cmd) < 10:
            continue
        q = f"Jak spustit nasledujici prikaz v ZION prostredi?"
        a = f"```bash\n{cmd}\n```\nTento prikaz se pouziva v kontextu `{source}`."
        yield _pair(q, a, classify_domain(text, source))


# ─── Seed pairs ──────────────────────────────────────────────────────────

def seed_pairs() -> Iterator[Dict]:
    seeds = [
        # ========== FOUNDATION (blockchain basics) ==========
        ("Co je ZION blockchain?", "ZION je Proof-of-Work blockchain s ASIC-odolnym algoritmem VerusHash 2.2, inspirovanym Decred hybridnim konsensusem. Zakladni jednotkou je ZION coin.", "foundation"),
        ("Jaky je rozdil mezi ZION a Bitcoin?", "ZION pouziva VerusHash 2.2 (ASIC-odolny), podporuje hybridni konsensus s DAO governance, ma nativni L2/L3 bridge, atomic swap a AI-Native agenta Hiranyagarbhu.", "foundation"),
        ("Co znamena ASIC resistance?", "ASIC resistance znamena, ze mining algoritmus je navrzen tak, aby specializovany hardware (ASIC) nemel vyraznou vyhodu oproti beznym CPU/GPU. ZION pouziva VerusHash 2.2.", "foundation"),
        ("Co je blockchain konsensus?", "Konsensus je mechanismus, jakym se uzeli v decentralizovane siti shodnou na platnem stavu retezce. ZION pouziva hybridni konsensus kombinujici PoW s DAO governance.", "foundation"),
        ("Jake jsou zakladni vlastnosti ZION?", "Zakladni vlastnosti: ASIC-odolny VerusHash 2.2, 2-minute block time, hybridni konsensus, nativni L2 bridge, atomic swap, DAO governance, AI-Native agent Hiranyagarbha.", "foundation"),
        ("Co je Proof-of-Work?", "Proof-of-Work (PoW) je konsensus mechanismus, kde mineri resi vypocetne narocne ulohy k validaci bloku. ZION pouziva VerusHash 2.2, ktery je odolny vuci ASIC hardware.", "foundation"),
        ("Jak funguje decentralizace v ZION?", "ZION je plne decentralizovany: kazdy muze provozovat node, pool nebo miner. DAO governance umoznuje komunitni rozhodovani o smerovani projektu.", "foundation"),
        ("Co je ZION coin?", "ZION coin je nativni mena ZION blockchainu. Slouzi k platebnimu prostredku, stakingu v DAO governance a placeni transakcnich poplatku.", "foundation"),
        ("Co je VerusHash 2.2?", "VerusHash 2.2 je ASIC-odolny mining algoritmus pouzivany v ZION. Kombinuje CPU-friendly operace s vysokou pametovou narocnosti, coz znesnadnuje specializovany hardware.", "foundation"),
        ("Jaky je block time v ZION?", "ZION ma target block time 2 minuty. Obtiznost se upravuje dynamicky podle aktualniho hashrate site.", "foundation"),
        ("Co je DAO governance?", "DAO (Decentralized Autonomous Organization) governance umoznuje drzitelum ZION coinu hlasovat o zmenach v protokolu, rozdeleni fondu a smerovani projektu.", "foundation"),
        ("Jak funguje ZION emission schedule?", "ZION ma predem definovany emission schedule pro uvolnovani novych coinu jako odmenu minerum. Po dosazeni maxima se mineri odmenuji pouze z transakcnich poplatku.", "foundation"),

        # ========== ZION CORE (L1) ==========
        ("Jak spustit ZION node?", "Pouzij prikaz `zion node start` nebo spust binarku: `ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:8443 cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node`.", "zion_core"),
        ("Co je Ekam Deeksha?", "Ekam Deeksha je ZION Proof-of-Work algoritmus zalozeny na VerusHash 2.2 s casovymi okny, hashratem a specifickou obtiznosti pro kazdy blok.", "zion_core"),
        ("Jak funguje zion pool?", "Pool server (`zion-pool`) prijima TCP spojeni od mineru, validuje share, udrzuje PPLNS statistiky a posila vyresene bloky na node pres RPC.", "zion_core"),
        ("Jake prikazy ma zion CLI?", "Hlavni prikazy: `zion node`, `zion pool`, `zion mine`, `zion hiran`, `zion bridge`, `zion dao`, `zion warp`, `zion doctor`, `zion deploy`.", "zion_core"),
        ("Co je RevenueSource v ZION?", "RevenueSource enum definuje zdroje prijmu: PoolFee, BridgeFee, DaoTithe, SwapFee, NclFee, AgentFee, DcrReward. Kazdy zdroj ma vlastni split mezi zakladni fond, DAO a operatora.", "zion_core"),
        ("Jak funguje PPLNS v ZION poolu?", "PPLNS (Pay Per Last N Shares) vydelava minery podle jejich podilu na poslednich N sharech. Cim vice share miner prispeje, tim vyssi je jeho odmena z bloku.", "zion_core"),
        ("Co je mempool v ZION?", "Mempool (`mempool_v2.rs`) je docasne uloziste nepotvrzenych transakci cekajicich na zahrnuti do bloku. Node validuje kazdou transakci pred pridanim do mempoolu.", "zion_core"),
        ("Jak funguje peer discovery v ZION?", "Peer discovery (`discovery.rs`) pouziva seed nody a DHT-like mechanismus pro nalezeni novych peeru v siti. Node si udrzuje seznam aktivnich peeru a jejich reputaci.", "zion_core"),
        ("Co je genesis block v ZION?", "Genesis block (`genesis.rs`) je prvni blok v retezci. Obsahuje pocatecni konfiguraci site, pocatecni rozdeleni coinu a zakladni parametry konsensu.", "zion_core"),
        ("Jak funguje difficulty adjustment?", "Difficulty adjustment (`difficulty.rs`) upravuje obtiznost miningu kazdych N bloku tak, aby se udrzel konstantni block time (~2 minuty) bez ohledu na zmeny hashrate.", "zion_core"),
        ("Co je checkpoint v ZION?", "Checkpoint (`checkpoint.rs`) je fixni bod v blockchainu, ktery se neda zpetne zmenit. Zabranuje deep reorganization utokum a urychluje synchronizaci novych nodu.", "zion_core"),
        ("Jak funguje fee system v ZION?", "Fee system (`fee.rs`) vypocitava transakcni poplatky na zaklade velikosti transakce a aktualniho zatizeni site. Poplatky jsou odmenovany minerum.", "zion_core"),
        ("Co je IBD v ZION?", "IBD (Initial Block Download) je proces, pri kterem novy node stahne a validuje celou historii blockchainu od genesis blocku k soucasnosti.", "zion_core"),
        ("Jak funguje P2P security?", "P2P security (`p2p_security.rs`) chrani sit pred sybil utoky, eclipse utoky a spamem. Pouziva reputacni system a rate limiting.", "zion_core"),
        ("Jak se validuji bloky v ZION?", "Block validation (`validation.rs`) kontroluje: proof-of-work, casovou znamku, transakce, merkle root, obtiznost a konsensus pravidla.", "zion_core"),
        ("Co je orphan block?", "Orphan block (`orphan.rs`) je blok, ktery ma platny proof-of-work, ale neni pripojen k hlavnimu retezci. Node si ho uchovava pro pripadnou reorganizaci.", "zion_core"),

        # ========== ZION ADVANCED (L2/L3/Deploy) ==========
        ("Jak deployovat ZION mainnet stack?", "Pouzij `docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d`. Predtim nastav env v `.env` podle `V3/docker/DOCKER.md`.", "zion_advanced"),
        ("Co je ZION bridge?", "Bridge relay daemon propojuje ZION L1 s EVM chainy (ETH, BSC). Pouziva SQLite, sleduje deposity a withdrawal eventy a provadi relayer loop.", "zion_advanced"),
        ("Jak funguje atomic swap v ZION?", "Atomic swap pouziva HTLC (Hash Time Locked Contracts). Swap daemon sleduje L1, udrzuje refund loop a poskytuje Axum HTTP API pro iniciaci swapu.", "zion_advanced"),
        ("Jak monitorovat ZION node?", "Node exposuje Prometheus metrics endpoint. Grafana dashboard je v `V3/docker/grafana/dashboards/`. Alerting ma 5 pravidel (down, high latency, error rate, GPU, utilization).", "zion_advanced"),
        ("Jake Docker profily jsou dostupne?", "Docker Compose profily: `dev`, `mainnet`, `monitoring`, `hiran`. Hlavni prikaz: `docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d`.", "zion_advanced"),
        ("Co je ZION DAO?", "DAO daemon kombinuje L1 scanner a Axum HTTP API pro governance. Pouziva SQLite backend, treasury modul a governance modul pro hlasovani o navrzich.", "zion_advanced"),
        ("Jak funguje warp relay?", "Warp (`V3/L3/warp`) je cross-chain relay daemon s Axum API a background watcherem. Pouziva config-first startup s volitelnou SQLite persistenci.", "zion_advanced"),
        ("Co je emergency kill switch?", "Emergency kill switch (`V3/docs/EMERGENCY_KILL_SWITCH.md`) je manualni mechanismus pro okamzite zastaveni site v pripade kritickych bezpecnostnich incidentu.", "zion_advanced"),
        ("Jak funguje L2 bridge production?", "L2 bridge production (`V3/L2/bridge`) pouziva relay daemon s L1 watcher + EVM watcher + relayer loop. Produkcní verze vyzaduje 3/5 validator provisioning.", "zion_advanced"),
        ("Co je NCL v ZION?", "NCL (Network Consensus Layer) je podsystem pro koordinaci mezi L1 a L2/L3 sluzbami. Zajistuje konzistenci stavu napric vrstvami.", "zion_advanced"),
        ("Jak funguje revenue split 50/25/25?", "Revenue split: 50% zakladni fond (infrastructure, development), 25% DAO treasury (community proposals), 25% operator reward. Model je definovan v `V3/L1/cosmic-harmony`.", "zion_advanced"),
        ("Jake jsou operacni servery pro mainnet?", "Operacni servery (`V3/docs/OPERATIONAL_SERVERS.md`) zahrnuji: seed nody, pool servery, bridge relay, DAO scanner, monitoring stack (Prometheus + Grafana).", "zion_advanced"),
        ("Jak provedu rolling upgrade ZION?", "Rolling upgrade (`V3/docs/UPGRADE_PLAN.md`): 1) Test na devnet, 2) Canary na 1 produkcnim nodu, 3) Postupny rollout na zbyvajici nody, 4) Monitor metrik.", "zion_advanced"),

        # ========== CROSS_DOMAIN (AI Native, Oasis, Programming) ==========
        ("Kdo je Hiranyagarbha?", "Hiranyagarbha je ZION AI Native agent -- doménovy expert na ZION blockchain, Rust programovani a operátorskou orchestraci. Identita vychazi z dharmickeho konceptu 'zlatého zárodku'.", "cross_domain"),
        ("Jak funguje RAG v ZION?", "AI Native modul (`V3/L3/ai-native`) pouziva vektorovou databazi pro retrieval nad ZION docs. Pred kazdou odpovedi se vyhledaji relevantni chunky a pridaji se do promptu.", "cross_domain"),
        ("Co je Dharma Autotuner?", "Autotuner (`V3/L3/ai-native/src/autotuner.rs`) destiluje znalosti z dokumentace do system promptu a zvysuje XP agenta pri kazdem uspesnem uceni.", "cross_domain"),
        ("Jak integrovat Hiran do CLI?", "Prikaz `zion hiran start/stop/chat/ask` ovlada inference sluzbu. Config je v `[hiran]` sekci `~/.zion/zion.toml`. Docker service bezi na portu 8002.", "cross_domain"),
        ("Jak funguje consciousness engine?", "Consciousness engine (`V3/L3/ai-native/src/consciousness_engine.rs`) propojuje autotuner s llm backendem a ridi urovne vedomi agenta podle kvality odpovedi.", "cross_domain"),
        ("Jake embedding modely pouziva ZION RAG?", "ZION RAG pouziva `nvidia/nv-embedqa-e5-v5` (1024d) nebo `nv-embedqa-mistral-7b-v2` (4096d) z NVIDIA NIM free tier.", "cross_domain"),
        ("Co je ZION Oasis?", "ZION Oasis je planovana UE5 MMORPG hra integrujici ZION blockchain economy, SACRED_TRINITY postavy a GOLDEN_EGG_GAME herni smycku. Dokumentace je v `docs/docs2.9/ZION_OASIS/`.", "cross_domain"),
        ("Jak funguje knowledge base v ai-native?", "Knowledge base (`V3/L3/ai-native/src/knowledge_base.rs`) uklada a spravuje embedding indexy nad ZION dokumentaci pro RAG retrieval.", "cross_domain"),
        ("Jak naprogramovat quest v ZION Oasis?", "Quest v Oasis se definuje jako Blueprint s udalostmi (Event Graph), podminkami splneni a odmenami. Questy jsou propojeny se ZION smart contracts pro blockchain odmeny.", "cross_domain"),
        ("Co je SACRED_TRINITY v Oasis?", "SACRED_TRINITY je narativni jadro Oasis: tri zakladni principy (Stvoritel, Ochrance, Transformator) urcuji herni mechaniky, postavy a pribehove linie.", "cross_domain"),
        ("Jak funguje GOLDEN_EGG_GAME?", "GOLDEN_EGG_GAME je herni smycka Oasis, kde hraci ziskavaji klice (NFT) prostrednictvim questu, trade je na marketplace a oteviraji Golden Eggs pro vzacne odmeny.", "cross_domain"),
        ("Jak naprogramovat Rust crate pro ZION?", "ZION crate se vytvari v workspace `V3/Cargo.toml`: 1) `cargo new --lib crate-name`, 2) pridej do workspace, 3) implementuj API, 4) testuj pres `cargo test -p crate-name`.", "cross_domain"),
        ("Jak vytvorit Axum endpoint v ZION?", "Axum endpoint v ZION service:\n```rust\nuse axum::{Router, routing::get};\n\nasync fn handler() -> &'static str { \"OK\" }\n\nlet app = Router::new().route(\"/\", get(handler));\n```", "cross_domain"),
        ("Jak pouzit SQLite v ZION sluzbach?", "ZION L2/L3 sluzby pouzivaji SQLite pres `sqlx` nebo `rusqlite`. Priklad:\n```rust\nlet conn = Connection::open(\"db.sqlite\")?;\nconn.execute(\"CREATE TABLE IF NOT EXISTS logs (...)\", []);\n```", "cross_domain"),
        ("Jak funguje WARP v ZION?", "WARP (`V3/L3/warp`) je cross-chain relay daemon. Poskytuje Axum API pro zasilani zprav mezi chainy a pouziva background watcher pro sledovani stavu.", "cross_domain"),
        ("Jak naprogramovat smart contract pro ZION?", "ZION smart contracts: 1) Definuj ABI v Rust, 2) Implementuj logiku v crate, 3) Testuj pres `cargo test`, 4) Deploy pomoci `zion deploy` CLI.", "cross_domain"),

        # ========== RAG_SYNTHESIS (docs, status, guides) ==========
        ("Jaky je aktualni stav V3?", "Podle `StatusV3.md` (2026-05-12): Hiran v2.2 CLI integrace hotova, bridge 3/5 validator provisioning ceka, CI billing issue je znamy, externi audit je naplanovan.", "rag_synthesis"),
        ("Jaka je roadmapa ZION?", "Roadmapa (`V3/ROADMAP.md`) pokryva: L1 mainnet konsensus, L2 bridge production, L3 AI Native deployment, DAO governance, ZION Oasis (UE5 MMORPG) a cross-chain warp relay.", "rag_synthesis"),
        ("Jake jsou hlavni bezpecnostni pozadavky?", "Bezpecnostni checklist (`V3/docs/SECURITY_CHECKLIST.md`) pokryva: Genesis block validaci, key management, pool payout audit, bridge multi-sig, emergency kill switch a secret rotation.", "rag_synthesis"),
        ("Co je AGENTS.md?", "`AGENTS.md` je provozni navod pro automatizovane agenty (Devin, WARP, Copilot). Definuje poradi zdroju pravdy: `StatusV3.md` -> `V3/README.md` -> `V3/docs/**`.", "rag_synthesis"),
        ("Jake auditni reporty existuji?", "Existuji: `V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md`, `2026-04-V3_AUDIT_COMPLETION.md`, `EXTERNAL_AUDIT_SCOPE_TEMPLATE.md`, `FUZZING_AND_DYNAMIC_ANALYSIS_PLAN.md`.", "rag_synthesis"),
        ("Jak funguje revenue system?", "Revenue system (`V3/L1/cosmic-harmony`) pouziva model 50/25/25: 50% zakladni fond, 25% DAO, 25% operator. Podporuje DCR dual-mining a admin web UI.", "rag_synthesis"),
        ("Co je ZION CLI deploy playbook?", "`V3/docs/CLI_DEPLOY_PLAYBOOK.md` obsahuje krok-za-krokem navod na deploy ZION stacku pomoci `zion deploy` prikazu a Docker Compose.", "rag_synthesis"),
        ("Jak pouzit zion doctor?", "`zion doctor` diagnostikuje stav site: kontroluje dostupnost nodu, poolu, bridge, verzi, logy a konfiguraci. Vrati report s nalezenymi problemy a navrhy reseni.", "rag_synthesis"),
        ("Co je mainnet preflight checklist?", "Preflight checklist (`docs/MAINNET_PREFLIGHT_CHECKLIST.md`) pokryva: genesis konfiguraci, wallet setup, validator klíce, monitoring, backup strategii a emergency postupy.", "rag_synthesis"),
        ("Jak funguje SMOS integrace?", "SMOS (`V3/docs/SMOS_INTEGRATION.md`) je Simple Mining OS integrace pro ZION minery. Umoznuje spravu farmy GPU/ASIC mineru pres web UI.", "rag_synthesis"),
    ]
    for instruction, output, domain in seeds:
        yield _pair(instruction, output, domain)


# ─── Main builder ────────────────────────────────────────────────────────

def build_dataset(repo_root: Path) -> Dict[str, List[Dict]]:
    all_pairs: List[Dict] = []
    pair_hashes: set = set()

    def add_pair(p: Dict) -> bool:
        h = hashlib.sha256((p["instruction"] + p["output"]).encode()).hexdigest()[:16]
        if h in pair_hashes:
            return False
        pair_hashes.add(h)
        all_pairs.append(p)
        return True

    # 1. Seed pairs
    print("[BUILD] Adding seed pairs...")
    seed_count = 0
    for p in seed_pairs():
        if add_pair(p):
            seed_count += 1
    print(f"[BUILD] Added {seed_count} seed pairs")

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
        elif source.endswith(".sh"):
            for p in pairs_from_shell(text, source):
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
        if scanned % 100 == 0:
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
        stage = p.get("domain", "foundation")
        if stage in stages:
            stages[stage].append(p)
        else:
            stages["foundation"].append(p)

    # 4. Report
    print("\n[BUILD] Stage distribution:")
    total = 0
    for stage, items in stages.items():
        total += len(items)
        print(f"  {stage:20s}: {len(items):5d} pairs")
    print(f"  {'TOTAL':20s}: {total:5d} pairs")

    return stages


def save_curriculum(stages: Dict[str, List[Dict]], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for stage, items in stages.items():
        path = output_dir / f"{stage}.jsonl"
        with open(path, "w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"[SAVE] {path}  ->  {len(items)} rows")

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
    repo_root = Path(__file__).resolve().parents[2]
    output_dir = repo_root / "HiranV2.2" / "data" / "curriculum"

    print("=" * 60)
    print("Hiran v2.2 Curriculum Dataset Builder — Robust Edition")
    print("=" * 60)
    print(f"Repo root: {repo_root}")
    print(f"Output:    {output_dir}")
    print()

    stages = build_dataset(repo_root)
    save_curriculum(stages, output_dir)

    print("\n[OK] Done. Next steps:")
    print("  1. Sync to Vast:  bash HiranV2.2/scripts/sync_curriculum_to_vast.sh")
    print("  2. Dry-run:       python HiranV2.2/scripts/train_v2.2.py --dry_run")
    print("  3. Full training: bash HiranV2.2/scripts/run_training.sh")


if __name__ == "__main__":
    main()
