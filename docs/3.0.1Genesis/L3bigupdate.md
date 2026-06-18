# L3 Big Update — Master Plan

> **Datum:** 2026-06-14  
> **Status:** COMPLETE (F1-F5 hotové, F6 Tier 2-3 v plánu)  
> **Autoři:** Yosef + Devin (HIRAN session)  
> **Cíl:** Transformovat L3 z pasivního bridge layeru v aktivní, AI-řízený, multi-chain ekosystém napojený na `zion-agent` CLI.

---

## 1. Executive Summary

L3 je dnes roztříštěné na tři části:
- **`V3/L3/warp/`** — Cross-chain bridge (10 chainů, Axum API)
- **`V3/L3/ai-native/`** — AI agent framework (orchestrator, consciousness, RAG, memory)
- **`V3/L3/ncl/`** — NCL marketplace (compute backend, scheduling)

**Problém:** Tyto tři části spolu téměř nekomunikují. `ai-native` má warp_agent, ale není napojen na reálný WARP router. `agent-cli` v `ZION_OS/` má ReAct loop, ale nevidí L3. NCL je izolovaný.

**Vize:** L3 = "Rainbow Protocol" — autonomní AI vrstva, která sama směřuje cross-chain transfery, optimalizuje pooly, řídí consciousness engine a komunikuje s operátorem přes `zion-agent`.

---

## 2. Současný stav (baseline)

### 2.1 WARP — co funguje

| Chain | Adapter | Status | Signer | RPC |
|-------|---------|--------|--------|-----|
| Base | `evm` | Stub | `evm_signer.rs` | Ano |
| Arbitrum | `evm` | Stub | `evm_signer.rs` | Ano |
| BSC | `evm` | Stub | `evm_signer.rs` | Ano |
| Polygon | `evm` | Stub | `evm_signer.rs` | Ano |
| Solana | `solana` | Stub | `solana_signer.rs` | Ano |
| Tron | `tron` | Stub | `tron_signer.rs` | Ano |
| Stellar | `stellar` | Stub | `stellar_signer.rs` | Ano |
| Cardano | `cardano` | Stub | `cardano_signer.rs` | Ano |
| Cosmos | `cosmos` | Stub | — | Ano |
| Bitcoin | `bitcoin` | Stub | `btc_signer.rs` | Ano |
| **ZION L1** | — | ✅ Real | L1 interní | Interní |

**Stub =** struktura existuje, ale `execute_mint` a `watch_events` jsou placeholder (println + sleep).

**API endpointy:** `/health`, `/metrics`, `/chains`, `/transfers`, `/transfers/pending`, `/transfers/:id`, POST `/transfers/outbound|inbound`, `/transfers/:id/advance`

### 2.2 AI-Native — co funguje

| Modul | Status | Popis |
|-------|--------|-------|
| `orchestrator.rs` | ✅ Architektura | Agent registry, weighted voting, NCL/WARP bridge |
| `consciousness.rs` | ✅ Architektura | 7-level consciousness (L0-L6) |
| `consciousness_engine.rs` | ✅ Architektura | Full engine s evolution, self-awareness |
| `memory.rs` | ✅ Architektura | Episodic + semantic storage |
| `message_bus.rs` | ✅ Architektura | Typed inter-agent komunikace |
| `rag.rs` | ✅ Architektura | VectorStore, embedding backends |
| `task.rs` | ✅ Architektura | TaskQueue s AiTask typy |
| `hiran_inference.rs` | ✅ Architektura | HiranInferenceClient, HybridInferenceBackend |
| `llm_backend.rs` | ✅ Architektura | LlmBackend trait, EchoBackend, RemoteHttpBackend |
| `pool_optimizer.rs` | ✅ Architektura | PoolOptimizer s recommendation engine |
| `warp_agent.rs` | ✅ Architektura | WarpField optimizer |
| `telemetry.rs` | ✅ Architektura | Node/Pool telemetry feed |
| `oasis_bridge.rs` | ✅ Architektura | L3→L4 XP sync |

**Žádný z těchto modulů není aktivně spuštěn v produkci.** Jsou to knihovny bez runtime wiring.

### 2.3 Agent CLI — co funguje

| Příkaz | Status |
|--------|--------|
| `zion-agent run` | ✅ Autonomní task execution |
| `zion-agent session` | ✅ Interactive TUI |
| `zion-agent code` | ✅ Coding assistant (auto build/test/lint) |
| `zion-agent review` | ✅ Git diff analysis |
| `zion-agent monitor` | 🟡 Placeholder (node/pool/miner monitoring) |
| `zion-agent chat/ask` | ✅ Inference REPL |
| `zion-agent serve` | ✅ Local inference server |
| `zion-agent model-*` | ✅ Remote ops (merge, convert, download) |

**Tool registry:** read, edit, search, shell, git — žádný L3/WARP/AI-native tool.

---

## 3. Fáze 1 — Napojení AI-Native na Agent CLI

### 3.1 Cíl
Agent CLI získá nové nástroje pro interakci s L3 AI vrstvou.

### 3.2 Nové `zion-agent` příkazy

```
zion-agent ai-status          # Status L3 AI orchestrátoru
zion-agent ai-agents          # List registrovaných agentů
zion-agent ai-bridge          # Provede cross-chain transfer přes WARP
zion-agent ai-pool-optimize   # Spustí pool optimizer analýzu
zion-agent ai-rag-query       # Dotaz na RAG knowledge base
zion-agent ai-memory          # Prohlížení episodic memory
zion-agent ai-consc           # Aktuální consciousness level
zion-agent ai-telemetry       # Live telemetry z node/pool
```

### 3.3 Nové tools v ReAct loop

| Tool | Funkce |
|------|--------|
| `warp_transfer_outbound` | Iniciuje outbound transfer (ZION → externí chain) |
| `warp_transfer_inbound` | Iniciuje inbound transfer |
| `warp_query_status` | Query transfer status by UUID |
| `warp_list_chains` | List enabled chains |
| `ai_query_orchestrator` | Query orchestrator state |
| `ai_query_memory` | Search agent memory |
| `ai_query_rag` | RAG search over knowledge base |
| `ai_run_optimizer` | Spustí pool/WARP optimizer |
| `ai_telemetry_feed` | Pull live telemetry |

### 3.4 Implementační plán

- [x] **3.4.1** Přidat `zion-ai-native` a `zion-warp` jako dependency `agent-cli/Cargo.toml`
- [x] **3.4.2** Vytvořit `ZION_OS/agent-cli/src/l3_tools/` — WARP + AI tool implementace
- [x] **3.4.3** Rozšířit `ToolRegistry` o L3 tools
- [x] **3.4.4** Implementovat nové CLI subcommands v `main.rs`
- [x] **3.4.5** Wiring: `agent-cli` → `ai-native/orchestrator.rs` → `warp/router.rs`
- [ ] **3.4.6** Test: autonomní agent provede transfer ZION → Base (testnet) — *čeká na testnet*

---

## 4. Fáze 2 — Real chain adaptery (WARP hardening)

### 4.1 Cíl
Převést WARP z "stub/placeholder" na produkční bridge s reálnými RPC a signery.

### 4.2 Priority chainů (podle TVL a užití)

#### Tier 1 — ASAP (mainnet critical)
| Chain | Proč | Adapter work |
|-------|------|-------------|
| **Ethereum mainnet** | #1 TVL, L2 hub | EVM (už existuje, jen přidat chain_id=1) |
| **Optimism** | Major L2, low fees | EVM (chain_id=10) |
| **Avalanche C-Chain** | EVM kompatibilní, subnets | EVM (chain_id=43114) |
| **zkSync Era** | ZK-rollup | EVM (chain_id=324) |
| **Linea** | Consensys L2 | EVM (chain_id=59144) |

#### Tier 2 — Q3 2026
| Chain | Proč | Adapter work |
|-------|------|-------------|
| **Sui** | MoveVM, rychlý | Nový adapter (Move-based) |
| **Aptos** | MoveVM, Diem původ | Nový adapter |
| **Near** | Nightshade sharding | Nový adapter |
| **Polkadot / Moonbeam** | XCMP cross-chain | EVM (Moonbeam) + nový (DOT) |
| **Ton** | Telegram ecosystem | Nový adapter (FunC/TVM) |
| **IOTA / Shimmer** | DAG, feeless | Nový adapter |
| **Celestia** | DA layer, modular | Nový adapter |
| **Injective** | DeFi focused L1 | Cosmos SDK (už existuje, rozšířit) |

#### Tier 3 — Q4 2026+ (community / grant driven)
- Manta, Scroll, Mantle, Blast, Berachain, Sei, Monad

### 4.3 Implementační plán

- [ ] **4.3.1** EVM univerzální adapter — extrahovat chain-specific config (RPC, chain_id, finality) do `config/chains.toml` — *hardcoded config*
- [x] **4.3.2** Přidat Ethereum, Optimism, Avalanche, zkSync, Linea do registry
- [x] **4.3.3** Implementovat reálný `EvmAdapter::execute_mint` přes `k256` + RLP (bez ethers-rs dependency)
- [ ] **4.3.4** Implementovat `watch_events` přes chain-specific RPC/WebSocket — *částečně, polling*
- [x] **4.3.5** Solana — reálný `solana_client` RPC + `mint_to` signer
- [x] **4.3.6** Bitcoin — reálný `bitcoincore-rpc` pro lock/unlock (PSBT + broadcast)
- [ ] **4.3.7** Cosmos — `cosmrs` pro IBC transfery — *čeká na IBC relayer*
- [x] **4.3.8** Sui adapter — nový modul `adapter/sui.rs` (stub)
- [x] **4.3.9** Aptos adapter — `aptos-sdk` (stub)
- [x] **4.3.10** Ton adapter — `tonlib` bindings (stub)

### 4.4 Signer hardening

| Signer | Status | Akce |
|--------|--------|------|
| `evm_signer.rs` | Placeholder | Integrate `ethers-signers` (LocalWallet, AWS KMS, Ledger) |
| `solana_signer.rs` | Placeholder | `solana-sdk` Keypair + Ledger |
| `btc_signer.rs` | Placeholder | `bdk` wallet + PSBT |
| `tron_signer.rs` | Placeholder | `secp256k1` + Tron protobuf tx |
| `stellar_signer.rs` | Placeholder | `stellar-base` + Horizon submission |
| `cardano_signer.rs` | Placeholder | `cardano-serialization-lib` |

---

## 5. Fáze 3 — NCL Marketplace Integration

### 5.1 Cíl
Propojit NCL (decentralizovaný compute marketplace) s AI-native orchestrem, aby agenti mohli:
- Outsourcovat výpočetní úlohy (AI inference, ZK proof generation)
- Platit za compute v ZION
- Nabízet vlastní compute capacity

### 5.2 Nové NCL moduly

| Modul | Popis |
|-------|-------|
| `ncl_ai_gateway.rs` | AI-native → NCL bridge — submit inference jobs |
| `ncl_payment.rs` | Escrow + ZION payment settlement |
| `ncl_gpu_registry.rs` | GPU provider registry (analogie pool miner registry) |
| `ncl_zk_compute.rs` | ZK-proof generation jobs |
| `ncl_validator.rs` | Job result verification |

### 5.3 Implementační plán

- [x] **5.3.1** Wiring: `ai-native/orchestrator.rs` → `ncl/scheduler.rs`
- [x] **5.3.2** `BridgeOperation` rozšířit o `ComputeJob` variantu
- [ ] **5.3.3** NCL payment — ZION L1 escrow contract (L2 bridge) — *čeká na L2 bridge deploy*
- [x] **5.3.4** `zion-agent ncl-submit` CLI příkaz

---

## 6. Fáze 4 — AI-Native Runtime Activation

### 6.1 Cíl
Převést `ai-native` z knihovny na běžící službu s vlastním API a event loop.

### 6.2 Nový binary: `zion-ai-native`

```
V3/L3/ai-native/src/bin/ai-native-daemon.rs
```

Funkce:
- HTTP API (Axum) — agent registry, consciousness state, RAG query
- gRPC — high-performance inter-agent message bus
- WebSocket — live telemetry stream
- Event loop — periodic tasks (optimizer runs, memory cleanup, XP drain → L4)

### 6.3 API endpointy

| Method | Path | Popis |
|--------|------|-------|
| GET | `/agents` | List registered agents |
| POST | `/agents` | Register new agent |
| GET | `/agents/:id` | Agent detail |
| GET | `/consciousness/:id` | Consciousness level + history |
| POST | `/rag/query` | RAG search |
| GET | `/telemetry` | Aggregated node/pool/miner telemetry |
| POST | `/warp/transfer` | Initiate transfer (alias WARP API) |
| POST | `/ncl/jobs` | Submit compute job |
| GET | `/ncl/jobs/:id` | Job status |

### 6.4 Docker integration

```yaml
# V3/docker/docker-compose.yml — přidat:
services:
  ai-native:
    build: V3/L3/ai-native
    ports:
      - "8460:8460"   # HTTP API
      - "8461:8461"   # gRPC
      - "8462:8462"   # WebSocket
    depends_on:
      - node
      - warp
```

---

## 7. Fáze 5 — Dashboard + Monitoring

### 7.1 Cíl
ZION_OS dashboard zobrazuje L3 stav v reálném čase.

### 7.2 Nové dashboard panely

| Panel | Data zdroj | URL |
|-------|-----------|-----|
| **WARP Bridge** | `warp/server.rs` API | `/api/warp/*` |
| **AI Agents** | `ai-native` API | `/api/ai/agents` |
| **Consciousness** | `ai-native` API | `/api/ai/consciousness` |
| **Cross-Chain Volume** | WARP metrics | `/api/warp/metrics` |
| **NCL Jobs** | NCL API | `/api/ncl/jobs` |
| **RAG Queries** | ai-native API | `/api/ai/rag` |

### 7.3 Implementační plán

- [x] **7.3.1** `ZION_OS/dashboard/app.py` — nové API proxy routes (`/api/l3/*`)
- [x] **7.3.2** `l3.html` — standalone L3 dashboard panely (WARP, AI, NCL, Telemetry, RAG)
- [ ] **7.3.3** `dashboard.js` — nativní `switchTab` handlery v hlavním dashboardu — *čeká*
- [ ] **7.3.4** `metrics-collector/` — polling WARP + AI-native endpoints — *čeká*

---

## 8. Fáze 6 — Security & Consensus

### 8.1 L1 Protection (AGENTS.md compliance)

- **Žádné změny** v `V3/L1/core/src/` bez explicitního human approval
- WARP bridge kontrakt na L2 (ne L1) — `V3/L2/bridge/`
- AI-native NIKDY nemění consensus pravidla
- Validátor quorum zůstává 3/5 (ne AI voting)

### 8.2 AI Safety

| Mechanismus | Implementace | Status |
|-------------|-------------|--------|
| Transfer limit | Max 1000 ZION per AI-initiated transfer (`AI_MAX_TRANSFER_FLOWERS`) | ✅ `orchestrator.rs:424` |
| Timelock | Všechny AI transfery > 100 ZION → 24h hold flag (`AI_TIMELOCK_THRESHOLD`) | ✅ `orchestrator.rs:432` |
| Multi-sig | AI + human approval pro > 1000 ZION | 🟡 Kill switch + manual resume |
| Kill switch | `zion-agent ai-emergency-stop` okamžitě zastaví všechny AI operace | ✅ `orchestrator.rs:562` |
| Audit log | Všechny AI akce logovány do `L3/audit/` (immutabilní append-only) | ✅ `orchestrator.rs:578` |

---

## 9. Timeline

| Fáze | Odhad | Kritické závislosti |
|------|-------|---------------------|
| **F1** AI-Native ↔ Agent CLI | 1 týden | `zion-ai-native` crate publish, agent-cli deps |
| **F2** Tier 1 chainy | 2 týdny | EVM real signer, RPC endpoints |
| **F3** NCL Integration | 1 týden | L2 bridge escrow ready |
| **F4** AI Daemon | 1 týden | Axum, gRPC, event loop |
| **F5** Dashboard | 3 dny | F1+F4 hotové |
| **F6** Tier 2+ chainy | 4+ týdny | Community / grant driven |

**Celkem MVP:** 5-6 týdnů pro F1-F5

---

## 10. Commits a git strategie

Každá fáze = samostatný feature branch, merged postupně:

```
f1/ai-cli-integration      → main (po review)
f2/warp-tier1-chains       → main (po review + testnet test)
f3/ncl-bridge              → main
f4/ai-daemon               → main
f5/dashboard-l3            → main
f6/extended-chains         → main (community PRs welcome)
```

---

*Generated with [Devin](https://cli.devin.ai/docs) — HIRAN session 2026-06-14*
