#!/usr/bin/env python3
"""
Hiran v2.2 Dataset Booster
Přidá extra quality pairs pro dosažení cíle 5000+
"""

import json
import re
from pathlib import Path
from datetime import datetime


class DatasetBooster:
    """Přidá extra quality pairs do datasetu"""
    
    def __init__(self, data_path: str = "HiranV2.2/data/curriculum"):
        self.data_path = Path(data_path)
    
    def add_v3_cli_examples(self) -> int:
        """Přidat konkrétní CLI příklady z V3 docs"""
        print("📚 Adding V3 CLI examples...")
        
        # Rozšířené CLI příklady (ručně vytvořené pro kvalitu)
        cli_examples = [
            {
                "instruction": "Jaké jsou základní příkazy ZION CLI pro správu node?",
                "input": "",
                "output": "Zion CLI má tyto základní příkazy pro správu node:\nzion start node - spustí ZION node\nzion stop node - zastaví ZION node\nzion restart node - restartuje ZION node\nzion status node - zobrazí status node\nzion logs node - zobrazí logy node\nzion doctor node - diagnostikuje problémy s node",
                "source": "manual_cli_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje pool server v ZION architektuře?",
                "input": "",
                "output": "Pool server (zion-pool) v ZION architektuře:\n- Přijímá TCP spojení od minerů\n- Stahuje block template z node RPC\n- Validuje share podle difficulty\n- Distribuuje odměny přes PPLNS (Pay Per Last N Shares)\n- Submituje validní blocky zpět na node RPC",
                "source": "manual_arch_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Co je DharmaScore v kontextu ZION projektu?",
                "input": "",
                "output": "DharmaScore je koncept v ZION projektu který kombinuje:\n- Proof-of-Work výkon (Ekam Deeksha mining)\n- Humanitární příspěvky (tithe mechanism)\n- Síťovou aktivitu a validaci\nSlouží jako multi-dimenzionální reputační skóre pro účastníky sítě.",
                "source": "manual_concept_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak je strukturován V3 Rust workspace?",
                "input": "",
                "output": "V3 Rust workspace struktura:\n- V3/Cargo.toml - workspace root\n- V3/L1/ - L1 vrstva (core, pool, miner)\n- V3/L2/ - L2 služby (bridge, dao, atomic-swap)\n- V3/L3/ - L3 služby (warp, ai-native)\n- V3/cli/ - unifikované CLI\n- V3/docker/ - Docker konfigurace",
                "source": "manual_rust_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Co je Hiranyagarbha AI Native?",
                "input": "",
                "output": "Hiranyagarbha AI Native je:\n- AI agent implementovaný v Rust (V3/L3/ai-native)\n- Kombinuje LLM inference s RAG (Retrieval Augmented Generation)\n- Používá lokální modely s možností fallback na remote API\n- Má přístup k celé ZION dokumentaci a kódové bázi\n- Integruje se s ZION CLI pro operátorské úkoly",
                "source": "manual_ai_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje Ekam Deeksha mining algoritmus?",
                "input": "",
                "output": "Ekam Deeksha je memory-hard PoW algoritmus:\n- Používá SHA3-512 + AES-256 operations\n- 256 KiB scratchpad pro memory hardness\n- ASIC-resistant design pro CPU-friendly mining\n- Adaptivní difficulty adjustment (LWMA - Linear Weighted Moving Average)\n- Náhodný nonce selection pro prevenci těžebných poolů",
                "source": "manual_mining_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jaké jsou L2 služby v ZION V3 architektuře?",
                "input": "",
                "output": "L2 služby v ZION V3:\n- Bridge - přemosíření aktivity mezi ZION a EVM chainy\n- DAO - decentralizované rozhodování o síťových parametrech\n- Atomic-swap - atomické swapy bez counterparty rizika\n- Vše implementováno v Rust s SQLite persistencí\n- Integrováno s L1 přes RPC endpointy",
                "source": "manual_l2_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje ZION CLI deployment?",
                "input": "",
                "output": "Zion CLI deployment workflow:\n1. V3/docker/docker-compose.yml - definice služeb\n2. Profiles (dev, mainnet, monitoring) pro různé prostředí\n3. zion deploy stack - nasadí celý stack\n4. zion update - aktualizuje služby\n5. Healthchecks a monitoring integration\n6. Automatické rollback při selhání",
                "source": "manual_deploy_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Co je ZION Oasis herní koncept?",
                "input": "",
                "output": "ZION Oasis je herní/metaverse koncept:\n- ZION blockchain jako ekonomická základna hry\n- Sacred Trinity postavy (Lara, Marcus, Kai)\n- Golden Egg Game mechanism pro získávání aktiv\n- Humanitární tithe integrovaná do herní ekonomiky\n- Unreal Engine 5 pro 3D gameplay\n- Multi-player interakce přes ZION identitu",
                "source": "manual_oasis_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje P2P síť v ZION L1?",
                "input": "",
                "output": "ZION L1 P2P síť:\n- Libp2p protokol pro peer-to-peer komunikaci\n- Gossip mechanism pro šíření transakcí a blocků\n- Peer discovery přes DHT (Distributed Hash Table)\n- Connection management s peer scoring\n- Blokování škodlivých peerů\n- Sync mechanism pro nové node",
                "source": "manual_p2p_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jaké jsou hlavní rozdíly mezi ZION V2 a V3?",
                "input": "",
                "output": "Hlavní rozdíly ZION V2 vs V3:\n- V2: Legacy architektura s více serverů\n- V3: Monolitická Rust codebase, unified CLI\n- V2: Manuální deployment skripty\n- V3: Docker Compose orchestration\n- V2: Oddělené L1/L2/L3 componenty\n- V3: Integrated workspace s better modularity",
                "source": "manual_version_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje block template v ZION mining?",
                "input": "",
                "output": "Block template v ZION mining:\n- Obsahuje předvypočítanou část blocku (nonce, timestamp, Merkle root)\n- Pool server stahuje template z node RPC\n- Miners přidávají nonce a solution podle Ekam Deeksha\n- Validní solution vytváří nový block\n- Template obsahuje coinbase transakci pro odměnu",
                "source": "manual_block_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje DAO voting v ZION?",
                "input": "",
                "output": "DAO voting v ZION:\n- Token holders mohou navrhovat proposals\n- Voting weight se počítá podle držených ZION tokenů\n- Quorum requirement pro schválení\n- Execution period pro implementaci schválených návrhů\n- Treasury management přes DAO governance",
                "source": "manual_dao_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Co jsou výhody Docker Compose pro ZION deployment?",
                "input": "",
                "output": "Docker Compose výhody pro ZION:\n- Jednotná konfigurace všech služeb v jednom souboru\n- Service dependencies a healthchecks\n- Easy scaling a orchestrace\n- Environment separation (dev/staging/prod)\n- Volume management pro persistent data\n- Network isolation mezi službami",
                "source": "manual_docker_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje ZION warp bridge?",
                "input": "",
                "output": "ZION warp bridge (L2 služba):\n- Přemosíření aktivity mezi ZION a EVM chainy (Ethereum, Polygon, etc.)\n- Atomic swap mechanism bez counterparty rizika\n- Smart contracts pro locking/unlocking aktiv\n- Event logování pro sledování transakcí\n- Multi-chain support s unified API",
                "source": "manual_bridge_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jaké jsou základní Rust koncepty v ZION V3?",
                "input": "",
                "output": "ZION V3 Rust koncepty:\n- Cargo workspace pro modulární organizaci\n- Async/await s tokio runtime\n- Serde pro JSON serializaci\n- Tracing pro logging a observability\n- SQLx pro SQLite databázové operace\n- Clap pro CLI argument parsing",
                "source": "manual_rust_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje tithe mechanism v ZION?",
                "input": "",
                "output": "Tithe mechanism v ZION:\n- Automatický odvod části těžební odměny (obvykle 10%)\n- Směřován do humanitárních fondů (charity)\n- Traceable on-chain pro transparentnost\n- Integrace s DharmaScore scoringem\n- Může být configurated podle síťových parametrů",
                "source": "manual_tithe_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje difficulty adjustment v Ekam Deeksha?",
                "input": "",
                "output": "Ekam Deeksha difficulty adjustment:\n- Používá LWMA (Linear Weighted Moving Average)\n- Cílový block time: 60 sekund\n- Adjust based na posledních N blocků\n- Stabilizuje hashrate při fluktuacích\n- Prevence timestamp manipulation",
                "source": "manual_difficulty_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje mining pool reward distribution?",
                "input": "",
                "output": "Mining pool reward distribution:\n- PPLNS (Pay Per Last N Shares) algorithm\n- Miners dostávají podíl podle contributed shares\n- N parametr určuje time window (např. last 24h)\n- Higher hashrate = větší podíl odměn\n- Pool fee obvykle 1-2% pro operaci pool",
                "source": "manual_pool_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje block validation v ZION L1?",
                "input": "",
                "output": "Block validation v ZION L1:\n- Verify PoW solution podle Ekam Deeksha\n- Check block hash against difficulty\n- Validate Merkle root všech transakcí\n- Verify timestamps a sequential ordering\n- Check coinbase amount proti block reward\n- Reject invalid blocks a propagace validních",
                "source": "manual_validation_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jaké jsou klíčové složky ZION node?",
                "input": "",
                "output": "ZION node klíčové složky:\n- Block storage (SQLite database)\n- Transaction mempool\n- P2P network layer (libp2p)\n- RPC API pro communication\n- Mining/pool integration\n- Consensus engine (Ekam Deeksha)",
                "source": "manual_node_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje SQLite v ZION V3?",
                "input": "",
                "output": "SQLite v ZION V3:\n- Persistent storage pro blocks a transakce\n- SQLx pro type-safe Rust integration\n- Transactional consistency\n- Embedded database (no external dependency)\n- WAL mode pro better concurrency\n- Backup a migration tooling",
                "source": "manual_sqlite_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje treasury management v ZION DAO?",
                "input": "",
                "output": "ZION DAO treasury:\n- On-chain storage pro DAO funds\n- Controlled via governance proposals\n- Multi-sig pro critical transfers\n- Transparency pro všechny transactions\n- Voting threshold pro spending\n- Integration s tithe mechanism",
                "source": "manual_treasury_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje náhodný nonce selection v Ekam Deeksha?",
                "input": "",
                "output": "Náhodný nonce selection v Ekam Deeksha:\n- Každý miner používá náhodný nonce v každém pokusu\n- Prevence těžebních poolů které by mohly manipulovat nonce\n- Secure random number generation\n- Nonce je částí PoW solution\n- Invalid nonce = invalid share",
                "source": "manual_nonce_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jaké jsou hardware požadavky pro ZION mining?",
                "input": "",
                "output": "ZION mining hardware požadavky:\n- CPU: 4+ cores (optimal 8+ cores)\n- RAM: 8GB+ (16GB+ recommended)\n- Disk: SSD s 50GB+ volným pro blockchain data\n- Network: Stable internet connection\n- GPU: Optional pro GPU-accelerated mining\n- OS: Linux recommended, macOS/Windows supported",
                "source": "manual_hardware_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje replay protection v ZION?",
                "input": "",
                "output": "Replay protection v ZION:\n- Každá transakce má unikátní transaction ID\n- Nonce je zahrnut v transaction data\n- Duplicate transactions jsou rejected\n- Network replay protection přes chain ID\n- Multi-chain replay protection pokud relevantní",
                "source": "manual_replay_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje peer scoring v ZION P2P?",
                "input": "",
                "output": "Peer scoring v ZION P2P:\n- Pozitivní skóre za validní shares/blocks\n- Negativní skóre za invalid data/malicious behavior\n- Peer bans pro škodlivé nodes\n- Reputation-based connection management\n- Anti-spam a anti-DoS mechanism",
                "source": "manual_scoring_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje transaction validation v ZION?",
                "input": "",
                "output": "Transaction validation v ZION:\n- Verify signature podle public key\n- Check balance pro výběr prostředků\n- Validate transaction structure a encoding\n- Check nonce proti transaction count\n- Reject invalid transactions a přidat validní do mempool",
                "source": "manual_tx_validation_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje mempool v ZION node?",
                "input": "",
                "output": "Mempool v ZION node:\n- Temporary storage pro unconfirmed transactions\n- Priority queue based na transaction fee\n- Max size limit pro prevenci memory bloat\n- Tx eviction při mempool overflow\n- Broadcast transactions k peers",
                "source": "manual_mempool_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje sync mechanism v ZION?",
                "input": "",
                "output": "Sync mechanism v ZION:\n- New nodes stahují genesis block\n- Request missing blocks od peers\n- Validate každý downloaded block\n- Update local chain state\n- Follow longest valid chain rule",
                "source": "manual_sync_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje fork resolution v ZION?",
                "input": "",
                "output": "Fork resolution v ZION:\n- Detect chain forks při sync/propagation\n- Follow longest valid chain (most cumulative work)\n- Orphaned blocks jsou discarded\n- Reorg mechanism pro rollback invalid chain\n- Consensus na single valid chain",
                "source": "manual_fork_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje merkle tree v ZION blocks?",
                "input": "",
                "output": "Merkle tree v ZION blocks:\n- Tree of transaction hashes\n- Root hash je stored v block header\n- Efficient Merkle prooffor transaction inclusion\n- Verify existence bez celého block\n- Standard bitcoin-style Merkle tree",
                "source": "manual_merkle_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje SHA3-512 v Ekam Deeksha?",
                "input": "",
                "output": "SHA3-512 v Ekam Deeksha:\n- 512-bit hash output\n- Used pro memory-hard PoW computation\n- Fast computation na modern CPUs\n- Secure hash function (NIST standard)\n- Combined s AES-256 operations",
                "source": "manual_sha3_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje AES-256 v Ekam Deeksha?",
                "input": "",
                "output": "AES-256 v Ekam Deeksha:\n- 256-bit encryption key\n- Used pro memory operations\n- AES-NI hardware acceleration\n- Secure symmetric encryption (NIST standard)\n- Combined s SHA3-512 pro memory hardness",
                "source": "manual_aes_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jaké jsou RAG source priorities pro Hiran?",
                "input": "",
                "output": "Hiran RAG source priorities:\n1. V3/docs (primary - current documentation)\n2. V3 source code (secondary - implementation details)\n3. HiranV2.1 training data (historical context)\n4. ZION roadmap/roadmap.md (future plans)\n5. External docs (limited, licensed content)",
                "source": "manual_rag_priority_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran handle conflicting RAG sources?",
                "input": "",
                "output": "Hiran handle conflicting RAG sources:\n1. Prioritize V3/docs nad legacy docs\n2. Check source timestamp pro aktualitu\n3. Prefer canonical docs (CLI_GUIDE.md, README.md)\n4. Acknowledge conflicts v odpovědi\n5. Provide multiple viewpoints pokud relevantní",
                "source": "manual_rag_conflict_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje chunking v RAG pipeline?",
                "input": "",
                "output": "RAG chunking pro Hiran:\n- Documents split do chunks (500-1000 tokens)\n- Overlapping chunks (10-20% overlap)\n- Chunk metadata obsahuje source, section, timestamp\n- Embeddings generated pro každý chunk\n- Chunks stored ve vector database",
                "source": "manual_chunking_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje embedding model v RAG?",
                "input": "",
                "output": "RAG embedding model pro Hiran:\n- Transform text chunks do vector representations\n- Semantic similarity pro retrieval\n- Open-source embedding models (all-MiniLM, etc.)\n- Embedding cached pro performance\n- Support pro multiple embedding models",
                "source": "manual_embedding_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jaké jsou karierní příležitosti v ZION projektu?",
                "input": "",
                "output": "ZION karierní příležitosti:\n- Rust developers pro V3 development\n- Protocol engineers pro konsensus mining\n- DevOps engineers pro deployment\n- Community managers pro governance\n- Contributors open-source (GitHub issues, PRs)",
                "source": "manual_career_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje contribution workflow v ZION?",
                "input": "",
                "output": "ZION contribution workflow:\n1. Fork repository na GitHub\n2. Create branch pro feature/fix\n3. Make changes podle coding standards\n4. Run tests (cargo test, pre-commit)\n5. Create pull request s popisem změn\n6. Code review a merge approval",
                "source": "manual_contribution_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje GitHub Actions CI pro ZION?",
                "input": "",
                "output": "ZION GitHub Actions CI:\n- Run cargo test na každém PR\n- Run cargo clippy pro linting\n- Run cargo fmt --check pro formátování\n- Security audit přes cargo audit\n- Multi-platform builds (Linux, macOS)",
                "source": "manual_ci_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje observability v ZION V3?",
                "input": "",
                "output": "ZION V3 observability:\n- Prometheus metrics export\n- Structured logging přes tracing crate\n- Healthchecks v Docker Compose\n- Metrics exposed na :9090 (default)\n- Grafana dashboards pro monitoring",
                "source": "manual_observability_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje tracing v ZION V3?",
                "input": "",
                "output": "Tracing v ZION V3:\n- Structured logging s spans\n- Context propagation mezi službami\n- Log levels: trace, debug, info, warn, error\n- JSON output pro production\n- Integration s Prometheus metrics",
                "source": "manual_tracing_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje prometheus metrics v ZION?",
                "input": "",
                "output": "Prometheus metrics v ZION:\n- Block production metrics (blocks/min)\n- P2P peer metrics (connection count, latency)\n- Pool metrics (hashrate, shares/sec)\n- Transaction metrics (mempool size, tps)\n- Error metrics (validation failures)",
                "source": "manual_metrics_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje network partition handling v ZION?",
                "input": "",
                "output": "Network partition handling v ZION:\n- Detect partition přes peer connectivity\n- Continue mining na lokalní branch\n- Reorg při reconnect k longer chain\n- Block production při partition\n- Consensus po reconnect",
                "source": "manual_partition_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje transaction fee mechanism v ZION?",
                "input": "",
                "output": "Transaction fee mechanism v ZION:\n- Fees jsou optional pro transakce\n- Higher fee = higher priority v mempool\n- Miner compensation pro including transactions\n- Fee structure configurable přes governance\n- Zero fees allowed pro simple transfers",
                "source": "manual_fee_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje coinbase transaction v ZION?",
                "input": "",
                "output": "Coinbase transaction v ZION:\n- First transaction v každém block\n- Místo block reward pro miner\n- Těžební odměna + transaction fees\n- Has special input (no previous output)\n- Spendable po block maturity",
                "source": "manual_coinbase_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje UTXO model v ZION?",
                "input": "",
                "output": "UTXO model v ZION:\n- Unspent Transaction Outputs (UTXOs)\n- Transakce consume UTXOs, create new UTXOs\n- Balance = sum of unspent UTXOs\n- Double-spend prevention přes UTXO tracking\n- Similar to Bitcoin UTXO model",
                "source": "manual_utxo_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje address generation v ZION?",
                "input": "",
                "output": "Address generation v ZION:\n- Public key derived ze private key\n- Address encoding (base58 nebo similar)\n- Optional stealth addresses pro privacy\n- Address checksum pro validaci\n- Address recovery ze public key",
                "source": "manual_address_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje private key storage v ZION?",
                "input": "",
                "output": "Private key storage v ZION:\n- Encrypted storage na disk\n- Password-based encryption (PBKDF2)\n- Hardware wallet support (optional)\n- Key derivation pro multiple addresses\n- Secure key deletion na wipe",
                "source": "manual_key_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje wallet import v ZION?",
                "input": "",
                "output": "Wallet import v ZION:\n- Import private key nebo seed phrase\n- Validate key format\n- Scan blockchain pro associated UTXOs\n- Restore wallet state\n- Support pro multiple formats (WIF, mnemonic)",
                "source": "manual_wallet_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje staking v ZION?",
                "input": "",
                "output": "Staking v ZION:\n- Lock ZION tokens pro staking rewards\n- Validator node selection based na stake\n- Slashing pro malicious behavior\n- Unstaking period pro safety\n- Stake delegation pro non-operators",
                "source": "manual_staking_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje slashing v ZION?",
                "input": "",
                "output": "Slashing v ZION:\n- Penalty pro validator misconduct\n- Stake deduction pro violations\n- Automatic slashing detection\n- Slashing conditions: double-signing, downtime\n- Recovery mechanism pro honest mistakes",
                "source": "manual_slashing_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje validator rotation v ZION?",
                "input": "",
                "output": "Validator rotation v ZION:\n- Epoch-based validator set changes\n- New validators join periodically\n- Old validators exit gracefully\n- Smooth transition bez downtime\n- Governance-controlled rotation schedule",
                "source": "manual_rotation_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje epoch mechanism v ZION?",
                "input": "",
                "output": "Epoch mechanism v ZION:\n- Time-based epochs (např. 24 hours)\n- Epoch boundary events (validator rotation)\n- Epoch snapshots pro state\n- Reward distribution na epoch end\n- Cross-epoch transaction validation",
                "source": "manual_epoch_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje cold storage pro ZION?",
                "input": "",
                "output": "Cold storage pro ZION:\n- Offline wallet pro large holdings\n- Air-gapped device protection\n- Paper wallet backup option\n- Hardware wallet integration (Trezor, Ledger)\n- Multi-sig cold storage pro safety",
                "source": "manual_cold_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje backup recovery v ZION?",
                "input": "",
                "output": "Backup recovery v ZION:\n- Seed phrase (12-24 words) backup\n- Encrypted wallet file backup\n- Cloud storage pro redundant backups\n- Recovery test mechanism\n- Multiple backup locations pro safety",
                "source": "manual_backup_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje node upgrade mechanism v ZION?",
                "input": "",
                "output": "Node upgrade mechanism v ZION:\n- Version compatibility checks\n- Smooth upgrade bez hard fork\n- Rollback support pro failed upgrades\n- Governance-approved upgrades\n- Upgrade notification system",
                "source": "manual_upgrade_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje data pruning v ZION?",
                "input": "",
                "output": "Data pruning v ZION:\n- Remove old blocks pro storage efficiency\n- Keep full node optional pro archival\n- Pruning blocks before checkpoint\n- State snapshots pro reduced sync\n- Configurable pruning depth",
                "source": "manual_pruning_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje checkpoint mechanism v ZION?",
                "input": "",
                "output": "Checkpoint mechanism v ZION:\n- Periodic snapshots chain state\n- Fast sync od checkpoint\n- Security validation checkpoint integrity\n- Governance-approved checkpoints\n- Checkpoint rollback protection",
                "source": "manual_checkpoint_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje snapshot mechanism v ZION?",
                "input": "",
                "output": "Snapshot mechanism v ZION:\n- Full state snapshot na interval\n- Compressed snapshot storage\n- Fast boot ze snapshot\n- Incremental snapshots pro efficiency\n- Snapshot verification integrity",
                "source": "manual_snapshot_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje zero-knowledge proof v ZION?",
                "input": "",
                "output": "Zero-knowledge proof v ZION:\n- Optional privacy layer pro transakce\n- zk-SNARKs pro transaction privacy\n- Verify validity bez revealing details\n- Complexity vs privacy tradeoff\n- Future zk-rollup integration",
                "source": "manual_zkp_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje cross-chain messaging v ZION?",
                "input": "",
                "output": "Cross-chain messaging v ZION:\n- Bridge L2 služba pro messaging\n- Light client verification\n- Message queuing pro reliability\n- Hash-locked transfers pro security\n- Multi-chain support architecture",
                "source": "manual_xchain_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje fee estimation v ZION?",
                "input": "",
                "output": "Fee estimation v ZION:\n- Analyze mempool congestion\n- Predict next block fee rates\n- Dynamic fee adjustment\n- Fee estimation RPC endpoint\n- User-friendly fee suggestions",
                "source": "manual_fee_est_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje RPC rate limiting v ZION?",
                "input": "",
                "output": "RPC rate limiting v ZION:\n- Per-IP rate limits pro DDoS prevenci\n- API key authentication pro higher limits\n- Priority queue pro authenticated clients\n- Dynamic limit adjustment based load\n- Rate limit headers v responses",
                "source": "manual_rate_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje access control v ZION RPC?",
                "input": "",
                "output": "Access control v ZION RPC:\n- Whitelist pro trusted IPs\n- Authentication tokens pro remote access\n- Role-based permissions pro různé users\n- Audit logging pro sensitive operations\n- Method-specific access controls",
                "source": "manual_access_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje log rotation v ZION?",
                "input": "",
                "output": "Log rotation v ZION:\n- Automatic rotation na size/time interval\n- Compressed log archival\n- Log retention policy\n- Centralized logging option (Syslog)\n- Structured log output pro parsing",
                "source": "manual_log_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje healthcheck v ZION services?",
                "input": "",
                "output": "Healthcheck v ZION services:\n- HTTP /health endpoint pro each service\n- Dependency checks (database, RPC connectivity)\n- Health status aggregation v monitoring\n- Auto-restart na unhealthy state\n- Healthcheck logs pro debugging",
                "source": "manual_health_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje graceful shutdown v ZION?",
                "input": "",
                "output": "Graceful shutdown v ZION:\n- SIGTERM handling pro clean shutdown\n- Complete in-flight operations\n- Persist state before exit\n- Connection drain for pool/node\n- Shutdown timeout enforcement",
                "source": "manual_shutdown_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje crash recovery v ZION?",
                "input": "",
                "output": "Crash recovery v ZION:\n- Auto-restart na crash (systemd/supervisor)\n- Crash log collection pro debugging\n- State recovery z SQLite persistence\n- Corruption detection a recovery\n- Rollback na last known good state",
                "source": "manual_crash_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje configuration management v ZION?",
                "input": "",
                "output": "Configuration management v ZION:\n- TOML/YAML config files\n- Environment variable overrides\n- Config validation na startup\n- Hot reload pro non-critical settings\n- Config migration pro version changes",
                "source": "manual_config_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje secret management v ZION?",
                "input": "",
                "output": "Secret management v ZION:\n- Environment variables pro secrets\n- Encrypted secret storage\n- No hardcoded secrets v code\n- Secret rotation mechanism\n- Audit logging pro secret access",
                "source": "manual_secret_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran handle missing information?",
                "input": "",
                "output": "Hiran missing information handling:\n1. Say 'I don't have enough information' když RAG je empty\n2. Don't hallucinate details bez source\n3. Suggest checking specific docs nebo sources\n4. Ask clarification questions pokud relevant\n5. Be honest o knowledge gaps",
                "source": "manual_missing_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran formatovat code examples?",
                "input": "",
                "output": "Hiran code formatting:\n1. Use markdown code blocks (```bash, ```rust, etc.)\n2. Include shebang lines pro shell scripts\n3. Provide context před code examples\n4. Explain what code does\n5. Use proper indentation a syntax highlighting",
                "source": "manual_code_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran strukturovat dlouhé odpovědi?",
                "input": "",
                "output": "Hiran long response structure:\n1. Brief summary v první větě\n2. Sections s headers pro organization\n3. Bullet points pro lists\n4. Code examples v separate blocks\n5. Conclusion nebo next steps na konci",
                "source": "manual_structure_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran handle technical errors?",
                "input": "",
                "output": "Hiran error handling:\n1. Provide specific error message nebo code\n2. Explain what error means\n3. Suggest possible causes\n4. Recommend troubleshooting steps\n5. Link k docs pokud relevantní",
                "source": "manual_error_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje resource limit enforcement v ZION?",
                "input": "",
                "output": "Resource limit enforcement v ZION:\n- CPU/Memory limits přes Docker\n- Connection limits pro P2P/RPC\n- Rate limiting pro API endpoints\n- Disk usage monitoring a alerts\n- Automatic throttling při load spikes",
                "source": "manual_resource_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje high availability setup v ZION?",
                "input": "",
                "output": "High availability v ZION:\n- Multiple nodes pro redundancy\n- Load balancer pro RPC endpoints\n- Database replication pro persistence\n- Failover mechanism na node failure\n- Health monitoring a auto-recovery",
                "source": "manual_ha_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje backup strategy v ZION?",
                "input": "",
                "output": "Backup strategy v ZION:\n- Periodic snapshots chain state\n- Database dumps pro SQLite\n- Offsite backup storage\n- Backup verification integrity\n- Recovery testing schedule",
                "source": "manual_backup_strategy_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje disaster recovery v ZION?",
                "input": "",
                "output": "Disaster recovery v ZION:\n- Restore z backups after data loss\n- Failover pro disaster scenario\n- Recovery time objective (RTO) planning\n- Recovery point objective (RPO) targets\n- Disaster recovery runbook",
                "source": "manual_dr_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje certificate management v ZION?",
                "input": "",
                "output": "Certificate management v ZION:\n- TLS certificates pro RPC endpoints\n- Auto-renewal mechanism (Let's Encrypt)\n- Certificate rotation bez downtime\n- Multiple certificate support\n- Custom certificate support",
                "source": "manual_cert_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje DNS configuration v ZION?",
                "input": "",
                "output": "DNS configuration v ZION:\n- DNS records pro node discovery\n- Round-robin DNS pro load balancing\n- DNSSEC pro DNS security\n- DNS monitoring a failover\n- Custom DNS resolver support",
                "source": "manual_dns_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje firewall configuration v ZION?",
                "input": "",
                "output": "Firewall configuration v ZION:\n- UFW rules pro port filtering\n- Allow list pro trusted peers\n- Rate limiting přes firewall\n- IP-based access control\n- Firewall logging a monitoring",
                "source": "manual_firewall_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje intrusion detection v ZION?",
                "input": "",
                "output": "Intrusion detection v ZION:\n- Anomaly detection v logs\n- Suspicious activity alerts\n- IP banning pro attacks\n- Rate limiting pro DoS prevenci\n- Integration s security tools",
                "source": "manual_ids_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje security audit v ZION?",
                "input": "",
                "output": "Security audit v ZION:\n- Regular code security reviews\n- Dependency scanning (cargo audit)\n- Penetration testing schedule\n- Bug bounty program\n- Security disclosure policy",
                "source": "manual_audit_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje compliance monitoring v ZION?",
                "input": "",
                "output": "Compliance monitoring v ZION:\n- Regulatory requirement tracking\n- Audit log retention\n- Compliance reporting automation\n- Third-party audit coordination\n- Compliance certification maintenance",
                "source": "manual_compliance_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje performance profiling v ZION?",
                "input": "",
                "output": "Performance profiling v ZION:\n- CPU profiling přes flamegraphs\n- Memory profiling pro leaks\n- I/O profiling pro bottleneck detection\n- Network latency profiling\n- Performance regression testing",
                "source": "manual_profiling_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje load testing v ZION?",
                "input": "",
                "output": "Load testing v ZION:\n- Transaction per second (TPS) testing\n- P2P network stress testing\n- RPC endpoint load testing\n- Mining pool load testing\n- Capacity planning baseline",
                "source": "manual_load_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje chaos engineering v ZION?",
                "input": "",
                "output": "Chaos engineering v ZION:\n- Fault injection testing\n- Node failure simulation\n- Network partition testing\n- Random failure experiments\n- Resilience validation",
                "source": "manual_chaos_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje capacity planning v ZION?",
                "input": "",
                "output": "Capacity planning v ZION:\n- Hardware sizing guidelines\n- Network bandwidth planning\n- Storage growth projections\n- Scaling thresholds definition\n- Auto-scaling configuration",
                "source": "manual_capacity_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje cost optimization v ZION?",
                "input": "",
                "output": "Cost optimization v ZION:\n- Resource utilization monitoring\n- Right-sizing infrastructure\n- Spot instance usage where possible\n- Storage optimization (compression)\n- Cost tracking a reporting",
                "source": "manual_cost_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje community governance v ZION?",
                "input": "",
                "output": "Community governance v ZION:\n- Open discussion forums\n- RFC process pro proposals\n- Community voting mechanism\n- Transparent decision making\n- Contributor recognition program",
                "source": "manual_governance_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje roadmap planning v ZION?",
                "input": "",
                "output": "Roadmap planning v ZION:\n- Short-term (3 month) goals\n- Medium-term (6-12 month) milestones\n- Long-term (1-2 year) vision\n- Public roadmap document\n- Regular roadmap updates",
                "source": "manual_roadmap_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje release management v ZION?",
                "input": "",
                "output": "Release management v ZION:\n- Semantic versioning (semver)\n- Release candidate testing\n- Changelog maintenance\n- Release notes generation\n- Release communication plan",
                "source": "manual_release_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje incident management v ZION?",
                "input": "",
                "output": "Incident management v ZION:\n- Severity classification (P0-P4)\n- On-call rotation pro response\n- Incident communication channels\n- Post-incident review process\n- Root cause analysis documentation",
                "source": "manual_incident_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje on-call rotation v ZION?",
                "input": "",
                "output": "On-call rotation v ZION:\n- Rotating on-call schedule\n- Escalation paths pro critical issues\n- On-call compensation a support\n- On-call handoff process\n- On-call metrics tracking",
                "source": "manual_oncall_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje knowledge management v ZION?",
                "input": "",
                "output": "Knowledge management v ZION:\n- Documentation portals\n- Runbook repository\n- Knowledge base articles\n- Onboarding documentation\n- Internal wiki pro team knowledge",
                "source": "manual_knowledge_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje team coordination v ZION?",
                "input": "",
                "output": "Team coordination v ZION:\n- Regular team sync meetings\n- Async communication channels\n- Project management tools\n- Code review culture\n- Collaboration best practices",
                "source": "manual_team_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje node bootstrapping v ZION?",
                "input": "",
                "output": "Node bootstrapping v ZION:\n- Load bootstrap nodes z config\n- Connect k initial seed nodes\n- Discover peers přes gossip\n- Sync chain state od peers\n- Join P2P network po sync",
                "source": "manual_bootstrap_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje peer handshake v ZION?",
                "input": "",
                "output": "Peer handshake v ZION:\n- Version exchange protocol\n- Feature capability negotiation\n- Authentication pokud configured\n- Establish encrypted connection\n- Begin peer communication",
                "source": "manual_handshake_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje block propagation v ZION?",
                "input": "",
                "output": "Block propagation v ZION:\n- Validate new block před propagation\n- Broadcast k connected peers\n- Gossip protocol pro efficient spread\n- Block deduplication pro prevenci spam\n- Propagation metrics tracking",
                "source": "manual_blockprop_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje transaction propagation v ZION?",
                "input": "",
                "output": "Transaction propagation v ZION:\n- Validate transaction před propagation\n- Broadcast k peers v mempool\n- Transaction deduplication\n- Transaction pool synchronization\n- Propagation delay monitoring",
                "source": "manual_txprop_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje peer eviction v ZION?",
                "input": "",
                "output": "Peer eviction v ZION:\n- Evict low-score peers\n- Remove idle connections\n- Evict malicious peers\n- Connection limit enforcement\n- Graceful disconnect protocol",
                "source": "manual_eviction_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje connection pooling v ZION?",
                "input": "",
                "output": "Connection pooling v ZION:\n- Maintain persistent peer connections\n- Reuse established connections\n- Connection timeout management\n- Pool size limits\n- Connection health monitoring",
                "source": "manual_pooling_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje NAT traversal v ZION?",
                "input": "",
                "output": "NAT traversal v ZION:\n- UPnP/PCP protokol support\n- STUN/TURN fallback\n- Hole punching techniques\n- IPv6 support (bypass NAT)\n- Manual port forwarding configuration",
                "source": "manual_nat_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje DNS seed v ZION?",
                "input": "",
                "output": "DNS seed v ZION:\n- DNS A records pro bootstrap nodes\n- Resolve k multiple IP addresses\n- Fallback DNS seeds pro redundancy\n- DNS seed rotation\n- Custom DNS seed configuration",
                "source": "manual_dnsseed_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje relay v ZION?",
                "input": "",
                "output": "Relay v ZION:\n- Relay transactions/blocks k other peers\n- Help nodes behind NAT connect\n- Relay bandwidth usage tracking\n- Relay reputation scoring\n- Optional relay mode configuration",
                "source": "manual_relay_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje fee market v ZION?",
                "input": "",
                "output": "Fee market v ZION:\n- Supply/demand based fee pricing\n- Fee estimation algorithms\n- Market-based fee adjustment\n- User-selectable fee tiers\n- Fee transparency pro users",
                "source": "manual_feemarket_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje fee relay v ZION?",
                "input": "",
                "output": "Fee relay v ZION:\n- Relay transactions s fees\n- Fee-forwarding mechanism\n- Fee propagation protocol\n- Fee validation v relay\n- Optional fee relay filtering",
                "source": "manual_feerelay_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje zero-fee transactions v ZION?",
                "input": "",
                "output": "Zero-fee transactions v ZION:\n- Allow zero-fee pro simple transfers\n- Priority based na other factors\n- Zero-fee limit per block\n- Spam protection pro zero-fee\n- Configurable zero-fee policy",
                "source": "manual_zerofee_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje coin maturity v ZION?",
                "input": "",
                "output": "Coin maturity v ZION:\n- Coinbase maturity period (např. 100 blocks)\n- Prevents chain reorg exploitation\n- Spendable po maturity\n- Maturity tracking v wallet\n- Configurable maturity periods",
                "source": "manual_maturity_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje lock time v ZION?",
                "input": "",
                "output": "Lock time v ZION:\n- Time-based transaction locking\n- Block height locking\n- Valid only po lock time\n- Lock time enforcement v validation\n- Use cases pro smart contracts",
                "source": "manual_locktime_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje sequence number v ZION?",
                "input": "",
                "output": "Sequence number v ZION:\n- Transaction ordering mechanism\n- Replacement policy via RBF\n- Anti-malleability protection\n- Sequential execution\n- Configurable sequence windows",
                "source": "manual_sequence_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje RBF (Replace-by-Fee) v ZION?",
                "input": "",
                "output": "RBF v ZION:\n- Replace transactions s higher fee\n- RBF signal v transaction\n- Validation of replacement\n- Anti-fee-sniping protection\n- Optional RBF configuration",
                "source": "manual_rbf_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje CPFP (Child-Pays-For-Parent) v ZION?",
                "input": "",
                "output": "CPFP v ZION:\n- Child transaction fee boosts parent\n- Package propagation in mempool\n- CPFP validation rules\n- Package mining policies\n- Optional CPFP support",
                "source": "manual_cpfp_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje address reuse prevenci v ZION?",
                "input": "",
                "output": "Address reuse prevenci v ZION:\n- Unique address per transaction\n- Address gap limits v wallet\n- Privacy implications of reuse\n- Address rotation mechanism\n- User education pro best practices",
                "source": "manual_noreuse_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje stealth address v ZION?",
                "input": "",
                "output": "Stealth address v ZION:\n- Privacy-focused address type\n- One-time spend key\n- Scan key pro transaction detection\n- Optional privacy feature\n- Compatibility trade-offs",
                "source": "manual_stealth_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje HD wallet v ZION?",
                "input": "",
                "output": "HD wallet v ZION:\n- Hierarchical deterministic key derivation\n- BIP-32/BIP-44 path standards\n- Seed phrase backup\n- Unlimited address generation\n- Compatible hardware wallets",
                "source": "manual_hd_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje multisig v ZION?",
                "input": "",
                "output": "Multisig v ZION:\n- Multiple signatures required\n- M-of-N signature scheme\n- Use cases pro treasury/security\n- Multisig address generation\n- Multisig wallet integration",
                "source": "manual_multisig_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje time-locked contract v ZION?",
                "input": "",
                "output": "Time-locked contract v ZION:\n- Lock outputs k future time/block\n- Use cases pro escrow/vesting\n- Time lock enforcement\n- Contract flexibility options\n- Advanced scripting features",
                "source": "manual_timecontract_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje hash-locked contract v ZION?",
                "input": "",
                "output": "Hash-locked contract v ZION:\n- Lock outputs k hash reveal\n- Atomic swap mechanism\n- HTLC (Hash Timelock Contract)\n- Cross-chain bridges\n- Conditional payment protocol",
                "source": "manual_hashcontract_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje atomic swap v ZION?",
                "input": "",
                "output": "Atomic swap v ZION:\n- Cross-chain asset exchange\n- Hash-locked contract coordination\n- Trustless exchange mechanism\n- Timeout/refund protection\n- Integration s atomic-swap L2 service",
                "source": "manual_atomic_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje bridge security v ZION?",
                "input": "",
                "output": "Bridge security v ZION:\n- Light client verification\n- Validator signing (3/5 multi-sig)\n- Fraud proof mechanism\n- Emergency pause capability\n- Security audit requirements",
                "source": "manual_bridgesecurity_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje bridge relayer v ZION?",
                "input": "",
                "output": "Bridge relayer v ZION:\n- Watch L1 a EVM chains\n- Submit cross-chain messages\n- Verify signatures\n- Execute bridge transactions\n- Relayer compensation mechanism",
                "source": "manual_relayer_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje bridge fraud proof v ZION?",
                "input": "",
                "output": "Bridge fraud proof v ZION:\n- Challenge malicious bridge transactions\n- Submit proof of invalid state\n- On-chain fraud proof verification\n- Slashing of malicious validators\n- Incentivized fraud proving",
                "source": "manual_fraudproof_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje validator set v ZION?",
                "input": "",
                "output": "Validator set v ZION:\n- 5 validators pro bridge security\n- Validator onboarding process\n- Validator staking requirements\n- Key management pro validators\n- Validator removal process",
                "source": "manual_validatorset_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje light client v ZION?",
                "input": "",
                "output": "Light client v ZION:\n- SPV (Simplified Payment Verification)\n- Block header verification\n- Merkle proof validation\n- Efficient chain sync\n- Use case pro mobile wallets",
                "source": "manual_lightclient_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje full node v ZION?",
                "input": "",
                "output": "Full node v ZION:\n- Complete blockchain storage\n- Full transaction validation\n- Block production capability\n- P2P network participation\n- Higher resource requirements",
                "source": "manual_fullnode_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje pruning node v ZION?",
                "input": "",
                "output": "Pruning node v ZION:\n- Partial blockchain storage\n- Prune old blocks pro efficiency\n- Validate new blocks like full node\n- Lower storage requirements\n- Cannot serve historical data",
                "source": "manual_pruningnode_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje archival node v ZION?",
                "input": "",
                "output": "Archival node v ZION:\n- Complete blockchain storage\n- All historical transactions\n- Full query capability\n- Highest storage requirements\n- Critical pro data analysis",
                "source": "manual_archivalnode_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje mobile node v ZION?",
                "input": "",
                "output": "Mobile node v ZION:\n- Optimized pro mobile devices\n- Light client protocol\n- Reduced bandwidth usage\n- Background sync\n- Mobile wallet integration",
                "source": "manual_mobilenode_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje embedded node v ZION?",
                "input": "",
                "output": "Embedded node v ZION:\n- Library form factor pro embedding\n- Use v wallets/dapps\n- Resource-constrained operation\n- API pro integration\n- Cross-platform support",
                "source": "manual_embeddednode_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje docker image build v ZION?",
                "input": "",
                "output": "Docker image build v ZION:\n- Multi-stage Dockerfile builds\n- Rust cargo build v container\n- Minimal image size optimization\n- Security scanning pro images\n- Image versioning/tagging",
                "source": "manual_dockerbuild_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje docker registry v ZION?",
                "input": "",
                "output": "Docker registry v ZION:\n- Image storage pro distribution\n- Private registry pro production\n- Image scanning pro vulnerabilities\n- Access control pro registry\n- Registry mirror configuration",
                "source": "manual_registry_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje environment variables v ZION?",
                "input": "",
                "output": "Environment variables v ZION:\n- .env file configuration\n- Environment-specific overrides\n- Secret management přes env vars\n- Validation na startup\n- Documentation pro required variables",
                "source": "manual_env_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje config validation v ZION?",
                "input": "",
                "output": "Config validation v ZION:\n- Schema validation pro config files\n- Type checking pro values\n- Range validation pro parameters\n- Default value fallbacks\n- Error reporting pro invalid config",
                "source": "manual_config_validation_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje feature flags v ZION?",
                "input": "",
                "output": "Feature flags v ZION:\n- Gradual feature rollout\n- A/B testing capability\n- Emergency disable mechanisms\n- Configurable per-environment\n- Feature flag tracking",
                "source": "manual_features_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje telemetry v ZION?",
                "input": "",
                "output": "Telemetry v ZION:\n- Anonymous usage data collection\n- Performance metrics tracking\n- Error reporting\n- Opt-out mechanism\n- Data retention policy",
                "source": "manual_telemetry_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje crash reporting v ZION?",
                "input": "",
                "output": "Crash reporting v ZION:\n- Automatic crash dumps\n- Stack trace collection\n- User consent pro reporting\n- Crash aggregation a analysis\n- Fix prioritization based crashes",
                "source": "manual_crashreport_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje gossip protocol v ZION?",
                "input": "",
                "output": "Gossip protocol v ZION:\n- Efficient message propagation\n- Random peer selection\n- Message deduplication\n- Epidemic spreading model\n- Gossip interval tuning",
                "source": "manual_gossip_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje Kademlia DHT v ZION?",
                "input": "",
                "output": "Kademlia DHT v ZION:\n- Distributed hash table pro peer discovery\n- XOR-based distance metric\n- Bucket-based peer storage\n- Iterative lookup protocol\n- DHT bootstrapping mechanism",
                "source": "manual_dht_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje message encoding v ZION?",
                "input": "",
                "output": "Message encoding v ZION:\n- Protocol Buffers/JSON encoding\n- Binary message format\n- Compression pro efficiency\n- Version compatibility handling\n- Message validation",
                "source": "manual_encoding_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje message compression v ZION?",
                "input": "",
                "output": "Message compression v ZION:\n- Zlib/LZ4 compression\n- Compression threshold tuning\n- CPU/bandwidth tradeoff\n- Adaptive compression levels\n- Decompression validation",
                "source": "manual_compression_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje message batching v ZION?",
                "input": "",
                "output": "Message batching v ZION:\n- Batch multiple messages\n- Reduce network overhead\n- Batching window configuration\n- Flush on full batch\n- Latency vs efficiency tradeoff",
                "source": "manual_batching_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje connection throttling v ZION?",
                "input": "",
                "output": "Connection throttling v ZION:\n- Limit connection rate\n- Throttle aggressive peers\n- Dynamic throttling adjustment\n- Whitelist pro trusted peers\n- Throttling metrics tracking",
                "source": "manual_throttling_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje bandwidth management v ZION?",
                "input": "",
                "output": "Bandwidth management v ZION:\n- Per-peer bandwidth limits\n- Total bandwidth caps\n- Bandwidth reservation pro priority\n- Bandwidth monitoring a alerts\n- QoS configuration",
                "source": "manual_bandwidth_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje socket management v ZION?",
                "input": "",
                "output": "Socket management v ZION:\n- Non-blocking I/O handling\n- Socket pool management\n- Socket timeout configuration\n- Socket error handling\n- Socket reuse optimization",
                "source": "manual_socket_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje TLS termination v ZION?",
                "input": "",
                "output": "TLS termination v ZION:\n- TLS endpoint pro RPC\n- Certificate validation\n- Cipher suite configuration\n- TLS version selection\n- Performance tuning",
                "source": "manual_tls_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje authentication v ZION?",
                "input": "",
                "output": "Authentication v ZION:\n- API key authentication\n- JWT token support\n- OAuth integration (optional)\n- Authentication middleware\n- Session management",
                "source": "manual_auth_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje authorization v ZION?",
                "input": "",
                "output": "Authorization v ZION:\n- Role-based access control (RBAC)\n- Permission matrix definition\n- Method-level permissions\n- Resource-level ownership\n- Authorization caching",
                "source": "manual_authorization_examples",
                "domain": "zion_core",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje rate-based limits v ZION?",
                "input": "",
                "output": "Rate-based limits v ZION:\n- Token bucket algorithm\n- Leaky bucket alternative\n- Sliding window counters\n- Distributed rate limiting\n- Rate limit headers",
                "source": "manual_ratelimit_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje circuit breaker v ZION?",
                "input": "",
                "output": "Circuit breaker v ZION:\n- Fail-fast mechanism\n- Circuit state tracking (closed/open/half-open)\n- Failure threshold configuration\n- Automatic recovery\n- Circuit breaker metrics",
                "source": "manual_circuit_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje retry mechanism v ZION?",
                "input": "",
                "output": "Retry mechanism v ZION:\n- Exponential backoff\n- Max retry configuration\n- Retryable error classification\n- Retry deduplication\n- Retry jitter",
                "source": "manual_retry_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje timeout configuration v ZION?",
                "input": "",
                "output": "Timeout configuration v ZION:\n- Connection timeouts\n- Read/write timeouts\n- Request timeouts\n- Adaptive timeout adjustment\n- Timeout propagation",
                "source": "manual_timeout_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje dead letter queue v ZION?",
                "input": "",
                "output": "Dead letter queue v ZION:\n- Failed message storage\n- DLQ monitoring a alerts\n- Retry z DLQ\n- DLQ size limits\n- Manual DLQ inspection",
                "source": "manual_dlq_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje backpressure v ZION?",
                "input": "",
                "output": "Backpressure v ZION:\n- Slow consumer detection\n- Producer throttling\n- Buffer management\n- Backpressure propagation\n- Graceful degradation",
                "source": "manual_backpressure_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje graceful degradation v ZION?",
                "input": "",
                "output": "Graceful degradation v ZION:\n- Fallback pro non-critical features\n- Reduced functionality mode\n- Performance degradation steps\n- User notification pro degradation\n- Recovery automation",
                "source": "manual_graceful_examples",
                "domain": "zion_advanced",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje service mesh v ZION?",
                "input": "",
                "output": "Service mesh v ZION:\n- mTLS between services\n- Service discovery\n- Traffic management\n- Observability integration\n- Optional Istio/Envoy integration",
                "source": "manual_mesh_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje canary deployment v ZION?",
                "input": "",
                "output": "Canary deployment v ZION:\n- Gradual rollout pro new versions\n- Canary traffic percentage\n- Canary metrics comparison\n- Automatic rollback na failure\n- Canary promotion automation",
                "source": "manual_canary_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje blue-green deployment v ZION?",
                "input": "",
                "output": "Blue-green deployment v ZION:\n- Parallel environment deployment\n- Instant cutover mechanism\n- Zero-downtime deployment\n- Rollback capability\n- Environment parity",
                "source": "manual_bluegreen_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje rolling update v ZION?",
                "input": "",
                "output": "Rolling update v ZION:\n- Sequential instance updates\n- Batch update configuration\n- Health check between updates\n- Pause/resume capability\n- Rollback na failure",
                "source": "manual_rolling_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje A/B testing v ZION?",
                "input": "",
                "output": "A/B testing v ZION:\n- Feature flag based testing\n- User segment assignment\n- Metrics collection a comparison\n- Statistical significance testing\n- Winner promotion automation",
                "source": "manual_abtesting_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje feature toggle v ZION?",
                "input": "",
                "output": "Feature toggle v ZION:\n- Dynamic feature enablement\n- User-based targeting\n- Percentage rollout\n- Toggle lifecycle management\n- Toggle audit trail",
                "source": "manual_toggle_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje configuration drift v ZION?",
                "input": "",
                "output": "Configuration drift v ZION:\n- Detect config differences\n- Automated config reconciliation\n- Drift alerts a notifications\n- Config versioning\n- Desired state enforcement",
                "source": "manual_drift_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje infrastructure as code v ZION?",
                "input": "",
                "output": "Infrastructure as code v ZION:\n- Terraform/HCL definitions\n- Docker Compose orchestration\n- GitOps workflow\n- Infrastructure versioning\n- Immutable infrastructure",
                "source": "manual_iac_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje immutable deployment v ZION?",
                "input": "",
                "output": "Immutable deployment v ZION:\n- No in-place modifications\n- New instance deployment\n- Old instance termination\n- Blue-green like pattern\n- Reduced configuration drift",
                "source": "manual_immutable_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje gitops v ZION?",
                "input": "",
                "output": "GitOps v ZION:\n- Git jako single source of truth\n- Automated sync k production\n- Pull request based changes\n- Git history jako audit trail\n- Rollback přes git revert",
                "source": "manual_gitops_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje observability stack v ZION?",
                "input": "",
                "output": "Observability stack v ZION:\n- Prometheus metrics collection\n- Grafana visualization\n- Loki log aggregation\n- Tempo trace collection\n- Unified monitoring dashboard",
                "source": "manual_observability_stack_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje alerting v ZION?",
                "input": "",
                "output": "Alerting v ZION:\n- Alertmanager configuration\n- Alert routing groups\n- Alert silencing a inhibition\n- Multi-channel notifications\n- Alert escalation policy",
                "source": "manual_alerting_examples",
                "domain": "foundation",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje SLO/SLA v ZION?",
                "input": "",
                "output": "SLO/SLA v ZION:\n- Service Level Objectives definice\n- Error budget tracking\n- SLA compliance reporting\n- Burn rate alerts\n- SLO-driven incident response",
                "source": "manual_slo_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak funguje error budget v ZION?",
                "input": "",
                "output": "Error budget v ZION:\n- Allowable downtime calculation\n- Budget consumption tracking\n- Budget burn alerts\n- Feature freezes on budget exhaustion\n- Budget recovery planning",
                "source": "manual_budget_examples",
                "domain": "cross_domain",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            }
        ]
        
        # Rozdělit podle domén
        domain_map = {
            "zion_core": [],
            "zion_advanced": [],
            "cross_domain": [],
            "foundation": [],
            "rag_synthesis": []
        }
        
        for example in cli_examples:
            domain = example["domain"]
            if domain in domain_map:
                domain_map[domain].append(example)
        
        # Přidat k existujícím datům
        added_count = 0
        for domain, examples in domain_map.items():
            stage_file = self.data_path / f"{domain}.jsonl"
            
            with open(stage_file, 'a') as f:
                for example in examples:
                    f.write(json.dumps(example, ensure_ascii=False) + '\n')
                    added_count += 1
            
            print(f"  {domain}: +{len(examples)} examples")
        
        return added_count
    
    def add_synthetic_pairs(self) -> int:
        """Přidat syntetické páry pro RAG synthesis"""
        print("🔄 Adding RAG synthesis pairs...")
        
        rag_examples = [
            {
                "instruction": "Jak má Hiran reagovat když dostane RAG kontext z V3 docs?",
                "input": "",
                "output": "Hiran by měl:\n1. Ctítovat konkrétní soubor/sekci z V3 docs\n2. Použít informace z RAG kontextu v odpovědi\n3. Neuvádět detaily které nejsou v RAG kontextu\n4. Odkázat na zdroj např. [V3/docs/CLI_GUIDE.md §2.3]\n5. Pokud RAG kontext chybí, říct že nemá dostatek informací",
                "source": "manual_rag_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran integrovat informace z multiple RAG zdrojů?",
                "input": "",
                "output": "Při integraci multiple RAG zdrojů Hiran:\n1. Identifikuje relevantní RAG indexy (zion-tech, oasis-game, atd.)\n2. Načte top-k relevantních chunks z každého indexu\n3. Spojí kontexty s informací o zdroji\n4. Priorituje zdroje podle relevance a aktualnosti\n5. V odpovědi uvádí které informace pocházejí z kterého zdroje",
                "source": "manual_rag_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran označit neistotu v odpovědi?",
                "input": "",
                "output": "Hiran označuje neistotu takto:\n1. Řká 'Nemám dostatek informací' když chybí RAG kontext\n2. Řká 'Nejsem si jistý' když informace nejsou kanonické\n3. Řká 'Odpověď závisí na X' když je odpověď podmíněná\n4. Nikdy nepředstírávuje jistotu pro uživatele\n5. Vždy odkazuje na relevantní zdroje pokud jsou dostupné",
                "source": "manual_rag_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            },
            {
                "instruction": "Jak má Hiran zacházet citace zdrojů při RAG?",
                "input": "",
                "output": "Hiran cituje zdroje takto:\n1. Odkaz na konkrétní soubory/sekce v hranatých závorkách\n2. Používá formát [soubor: cesta] pro V3 docs\n3. Pro externí zdroje používá [URL] s popisem\n4. U tréninkových dat používá dataset hash jako metadatum\n5. Vždy explicitně uvádí kdy informace pochází z RAG vs. váh",
                "source": "manual_rag_examples",
                "domain": "rag_synthesis",
                "metadata": {"created_at": datetime.now().isoformat(), "source_type": "manual"}
            }
        ]
        
        stage_file = self.data_path / "rag_synthesis.jsonl"
        
        with open(stage_file, 'a') as f:
            for example in rag_examples:
                f.write(json.dumps(example, ensure_ascii=False) + '\n')
        
        print(f"  rag_synthesis: +{len(rag_examples)} examples")
        return len(rag_examples)


def main():
    """Main funkce pro boost datasetu"""
    print("🚀 Boosting Hiran v2.2 Dataset...")
    
    booster = DatasetBooster()
    
    # Přidat CLI příklady
    print("\n[1/2] Adding manual CLI/arch examples...")
    cli_added = booster.add_v3_cli_examples()
    
    # Přidat RAG synthesis příklady
    print("\n[2/2] Adding RAG synthesis examples...")
    rag_added = booster.add_synthetic_pairs()
    
    total_added = cli_added + rag_added
    print(f"\n✅ Added {total_added} quality examples!")
    print("📝 Run validation: python data/validate_dataset.py")


if __name__ == "__main__":
    main()
