# Hiran v2.4 — Tool Registry

> **Status:** Specification  
> **Date:** 2026-06-13  
> **Based on:** V3 JSON-RPC methods + CLI commands + Docker services

---

## 1. Tool Design Principles

1. **One tool per V3 operation** — every CLI command and RPC method has a tool
2. **Deterministic execution** — tool code is pure Rust/Python, no LLM in the loop
3. **Schema validation** — all inputs/outputs use OpenAPI-style JSON schemas
4. **Timeout & retry** — every tool has configurable timeout and automatic retry
5. **Audit logging** — every tool call is logged immutably

---

## 2. Tool Categories

### L1 — Blockchain & Mining (12 tools)

#### `zion_rpc_getblockcount`

```json
{
  "name": "zion_rpc_getblockcount",
  "description": "Get current blockchain height",
  "endpoint": "http://node:8443/rpc",
  "method": "POST",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "result": {"type": "integer"},
      "error": {"type": ["string", "null"]}
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "NodeSync"
}
```

#### `zion_rpc_getnetworkinfo`

```json
{
  "name": "zion_rpc_getnetworkinfo",
  "description": "Get node network status, peers, sync status",
  "endpoint": "http://node:8443/rpc",
  "method": "POST",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "result": {
        "type": "object",
        "properties": {
          "version": {"type": "string"},
          "connections": {"type": "integer"},
          "connections_in": {"type": "integer"},
          "connections_out": {"type": "integer"},
          "sync_status": {"type": "string", "enum": ["Ibd", "Syncing", "Synced"]},
          "headers": {"type": "integer"},
          "blocks": {"type": "integer"}
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "NodeSync"
}
```

#### `zion_rpc_getmininginfo`

```json
{
  "name": "zion_rpc_getmininginfo",
  "description": "Get mining info: difficulty, network hashrate, block reward",
  "endpoint": "http://node:8443/rpc",
  "method": "POST",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "result": {
        "type": "object",
        "properties": {
          "blocks": {"type": "integer"},
          "difficulty": {"type": "number"},
          "networkhashps": {"type": "number"},
          "block_reward": {"type": "number"},
          "pooledtx": {"type": "integer"}
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "NodeConsensus"
}
```

#### `zion_rpc_getaccountbalance`

```json
{
  "name": "zion_rpc_getaccountbalance",
  "description": "Get balance for a zion1... address (account + UTXO)",
  "endpoint": "http://node:8443/rpc",
  "method": "POST",
  "input_schema": {
    "type": "object",
    "properties": {
      "address": {"type": "string", "pattern": "^zion1[a-z0-9]{40}$"}
    },
    "required": ["address"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "result": {
        "type": "object",
        "properties": {
          "address": {"type": "string"},
          "balance": {"type": "number"},
          "utxo_balance": {"type": "number"},
          "total": {"type": "number"}
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "WalletOps"
}
```

#### `zion_pool_get_sessions`

```json
{
  "name": "zion_pool_get_sessions",
  "description": "Get active stratum mining sessions",
  "endpoint": "http://pool:8444/sessions",
  "method": "GET",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "sessions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "worker_name": {"type": "string"},
            "ip": {"type": "string"},
            "algorithm": {"type": "string", "enum": ["deeksha_lite_v1", "deeksha_lite_fire", "cosmic_harmony_ekam_deeksha_v2"]},
            "accepted": {"type": "integer"},
            "rejected": {"type": "integer"},
            "stale": {"type": "integer"},
            "last_share": {"type": "string", "format": "date-time"}
          }
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "PoolWorkers"
}
```

#### `zion_miner_set_algorithm`

```json
{
  "name": "zion_miner_set_algorithm",
  "description": "Set miner algorithm (thermal management)",
  "endpoint": "http://miner:internal/rpc",
  "method": "POST",
  "input_schema": {
    "type": "object",
    "properties": {
      "algorithm": {
        "type": "string",
        "enum": ["deeksha_lite_v1", "deeksha_lite_fire", "cosmic_harmony_ekam_deeksha_v2"],
        "description": "deeksha_lite_v1=cool(9.7KH/s), deeksha_lite_fire=hot(18.1KH/s), ekam=full(7.2KH/s)"
      }
    },
    "required": ["algorithm"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["ok", "error"]},
      "previous_algorithm": {"type": "string"},
      "message": {"type": "string"}
    }
  },
  "timeout_ms": 10000,
  "retry": 1,
  "sub_agent": "MinerThermal",
  "authority_ring": "green"
}
```

#### `zion_miner_get_temps`

```json
{
  "name": "zion_miner_get_temps",
  "description": "Get GPU temperatures",
  "endpoint": "http://miner:internal/rpc",
  "method": "GET",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "gpus": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "integer"},
            "name": {"type": "string"},
            "temperature": {"type": "number"},
            "fan_speed": {"type": "integer"},
            "memory_used": {"type": "integer"},
            "memory_total": {"type": "integer"}
          }
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "MinerThermal"
}
```

#### `zion_miner_benchmark`

```json
{
  "name": "zion_miner_benchmark",
  "description": "Benchmark all 3 mining algorithms for 30s each",
  "endpoint": "http://miner:internal/rpc",
  "method": "POST",
  "input_schema": {
    "type": "object",
    "properties": {
      "duration_seconds": {"type": "integer", "default": 30, "minimum": 10, "maximum": 300}
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "algorithm": {"type": "string"},
            "hashrate": {"type": "number"},
            "power_watts": {"type": "number"},
            "temperature": {"type": "number"}
          }
        }
      }
    }
  },
  "timeout_ms": 120000,
  "retry": 0,
  "sub_agent": "MinerPerformance"
}
```

---

### L2 — DeFi & Governance (8 tools)

#### `zion_bridge_get_validators`

```json
{
  "name": "zion_bridge_get_validators",
  "description": "Get bridge validator status (3/5 consensus)",
  "endpoint": "http://bridge:8545/validators",
  "method": "GET",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "active": {"type": "integer"},
      "required": {"type": "integer"},
      "validators": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "location": {"type": "string"},
            "status": {"type": "string", "enum": ["active", "lagging", "offline"]},
            "last_block": {"type": "integer"},
            "lag_blocks": {"type": "integer"}
          }
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "BridgeValidators"
}
```

#### `zion_bridge_track_tx`

```json
{
  "name": "zion_bridge_track_tx",
  "description": "Track cross-chain bridge transaction status",
  "endpoint": "http://bridge:8545/track",
  "method": "GET",
  "input_schema": {
    "type": "object",
    "properties": {
      "tx_hash": {"type": "string", "minLength": 64, "maxLength": 66}
    },
    "required": ["tx_hash"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "tx_hash": {"type": "string"},
      "status": {"type": "string", "enum": ["pending_l1", "pending_evm", "confirmed", "failed"]},
      "l1_confirmations": {"type": "integer"},
      "evm_confirmations": {"type": "integer"},
      "amount_flowers": {"type": "integer"},
      "target_chain": {"type": "string"}
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "BridgeWatcher"
}
```

#### `zion_dao_get_proposals`

```json
{
  "name": "zion_dao_get_proposals",
  "description": "Get active DAO proposals",
  "endpoint": "http://dao:8080/proposals",
  "method": "GET",
  "input_schema": {
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["active", "pending", "passed", "rejected"], "default": "active"}
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "proposals": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "integer"},
            "title": {"type": "string"},
            "proposer": {"type": "string"},
            "votes_for": {"type": "integer"},
            "votes_against": {"type": "integer"},
            "quorum_required": {"type": "integer"},
            "deadline": {"type": "string", "format": "date-time"},
            "status": {"type": "string"}
          }
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "DaoProposals"
}
```

#### `zion_dao_get_treasury`

```json
{
  "name": "zion_dao_get_treasury",
  "description": "Get DAO treasury and humanitarian tithe balance",
  "endpoint": "http://dao:8080/treasury",
  "method": "GET",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "total_balance": {"type": "number"},
      "humanitarian_balance": {"type": "number"},
      "issobella_balance": {"type": "number"},
      "pool_fee_balance": {"type": "number"},
      "last_tithe_block": {"type": "integer"},
      "total_tithe_zion": {"type": "number"}
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "DaoTreasury"
}
```

---

### L3 — AI & Cross-Chain (6 tools)

#### `zion_ncl_list_providers`

```json
{
  "name": "zion_ncl_list_providers",
  "description": "List NCL AI compute providers",
  "endpoint": "http://ncl:8080/providers",
  "method": "GET",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "providers": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "gpu_type": {"type": "string"},
            "available_gpus": {"type": "array", "items": {"type": "string"}},
            "price_per_token": {"type": "number"},
            "reputation": {"type": "number"},
            "uptime_percent": {"type": "number"}
          }
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "NclMarket"
}
```

#### `zion_warp_get_routes`

```json
{
  "name": "zion_warp_get_routes",
  "description": "Get available cross-chain routes (7 chains)",
  "endpoint": "http://warp:8081/routes",
  "method": "GET",
  "input_schema": {
    "type": "object",
    "properties": {
      "from_chain": {"type": "string", "enum": ["zion", "ethereum", "base", "bitcoin", "solana", "tron", "stellar", "cardano", "cosmos"]},
      "to_chain": {"type": "string", "enum": ["zion", "ethereum", "base", "bitcoin", "solana", "tron", "stellar", "cardano", "cosmos"]},
      "amount": {"type": "integer"}
    },
    "required": ["from_chain", "to_chain", "amount"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "routes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "adapter": {"type": "string"},
            "fee": {"type": "number"},
            "estimated_time_seconds": {"type": "integer"},
            "min_amount": {"type": "integer"},
            "max_amount": {"type": "integer"}
          }
        }
      }
    }
  },
  "timeout_ms": 10000,
  "retry": 2,
  "sub_agent": "WarpRouter"
}
```

#### `zion_ai_native_get_state`

```json
{
  "name": "zion_ai_native_get_state",
  "description": "Get V3 ai-native runtime state (consciousness, memory)",
  "endpoint": "http://ai-native:8082/state",
  "method": "GET",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "consciousness": {
        "type": "object",
        "properties": {
          "awareness_level": {"type": "number"},
          "active_thoughts": {"type": "integer"},
          "emotional_state": {"type": "string"},
          "last_reflection": {"type": "string", "format": "date-time"}
        }
      },
      "memory": {
        "type": "object",
        "properties": {
          "episodes_stored": {"type": "integer"},
          "knowledge_chunks": {"type": "integer"},
          "rag_queries_today": {"type": "integer"}
        }
      },
      "agents": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "status": {"type": "string", "enum": ["idle", "active", "busy"]}
          }
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "AiNativeRuntime"
}
```

---

### System — Infrastructure (5 tools)

#### `docker_list_containers`

```json
{
  "name": "docker_list_containers",
  "description": "List all Docker containers in V3 stack",
  "endpoint": "unix:///var/run/docker.sock",
  "method": "GET",
  "path": "/containers/json",
  "input_schema": {},
  "output_schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "Id": {"type": "string"},
        "Names": {"type": "array", "items": {"type": "string"}},
        "State": {"type": "string"},
        "Status": {"type": "string"},
        "Health": {"type": "object"},
        "Stats": {"type": "object"}
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 1,
  "sub_agent": "DockerHealth"
}
```

#### `docker_restart_container`

```json
{
  "name": "docker_restart_container",
  "description": "Restart a Docker container",
  "endpoint": "unix:///var/run/docker.sock",
  "method": "POST",
  "path": "/containers/{name}/restart",
  "input_schema": {
    "type": "object",
    "properties": {
      "name": {"type": "string"},
      "t": {"type": "integer", "default": 30, "description": "Seconds to wait before killing"}
    },
    "required": ["name"]
  },
  "output_schema": {},
  "timeout_ms": 35000,
  "retry": 0,
  "sub_agent": "DockerHealth",
  "authority_ring": "green"
}
```

#### `prometheus_query`

```json
{
  "name": "prometheus_query",
  "description": "Query Prometheus metrics",
  "endpoint": "http://prometheus:9090/api/v1/query",
  "method": "GET",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {"type": "string"}
    },
    "required": ["query"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "status": {"type": "string"},
      "data": {
        "type": "object",
        "properties": {
          "resultType": {"type": "string"},
          "result": {"type": "array"}
        }
      }
    }
  },
  "timeout_ms": 10000,
  "retry": 2,
  "sub_agent": "PrometheusAlerts"
}
```

#### `prometheus_alerts`

```json
{
  "name": "prometheus_alerts",
  "description": "Get active Prometheus alerts",
  "endpoint": "http://prometheus:9090/api/v1/alerts",
  "method": "GET",
  "input_schema": {},
  "output_schema": {
    "type": "object",
    "properties": {
      "data": {
        "type": "object",
        "properties": {
          "alerts": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "labels": {"type": "object"},
                "annotations": {"type": "object"},
                "state": {"type": "string", "enum": ["pending", "firing"]},
                "activeAt": {"type": "string"}
              }
            }
          }
        }
      }
    }
  },
  "timeout_ms": 5000,
  "retry": 2,
  "sub_agent": "PrometheusAlerts"
}
```

---

## 3. Tool Registry Schema

The complete registry is loaded at startup:

```rust
pub struct ToolRegistry {
    tools: HashMap<String, ToolDefinition>,
    by_sub_agent: HashMap<String, Vec<String>>,
    by_layer: HashMap<Layer, Vec<String>>,
}

impl ToolRegistry {
    pub fn load() -> Self {
        let mut registry = Self::new();
        
        // Load from JSON schema files
        for file in glob("tools/*.json") {
            let tool: ToolDefinition = serde_json::from_str(&fs::read_to_string(file)?)?;
            registry.register(tool);
        }
        
        registry
    }
    
    pub fn get(&self, name: &str) -> Option<&ToolDefinition>;
    pub fn for_sub_agent(&self, name: &str) -> Vec<&ToolDefinition>;
    pub fn for_layer(&self, layer: Layer) -> Vec<&ToolDefinition>;
}
```

---

## 4. Tool Execution Flow

```
Sub-Agent decides to call tool
  │
  ▼
ToolRegistry.lookup(tool_name)
  │
  ▼
Validate input against JSON schema
  │
  ▼
Execute HTTP/RPC call
  │
  ├── Set timeout (from schema)
  ├── Retry N times (from schema)
  └── Log attempt
  │
  ▼
Validate response against JSON schema
  │
  ▼
Return structured result to Sub-Agent
  │
  ▼
Audit log entry written
```

---

## 5. Tool Count Summary

| Layer | Tools | Sub-Agents |
|---|---|---|
| L1 | 12 | 7 (NodeSync, NodeConsensus, PoolWorkers, PoolEconomics, MinerThermal, MinerPerformance, WalletOps) |
| L2 | 8 | 6 (BridgeValidators, BridgeWatcher, DaoProposals, DaoTreasury, SwapExecutor, SwapMarket) |
| L3 | 6 | 6 (NclScheduler, NclMarket, WarpRouter, WarpValidators, AiNativeRuntime, AiNativeMemory) |
| L4 | 2 | 1 (OasisManager) |
| L5 | 2 | 1 (FreeWorldOps) |
| L6 | 2 | 1 (IsobellaOps) |
| System | 5 | 5 (DockerHealth, PrometheusAlerts, ResourceOptimizer, BackupManager, UpdateEngine) |
| **Total** | **37** | **33** |

---

## References

- V3 Core RPC: `V3/L1/core/src/rpc.rs` (17 methods)
- V3 Pool: `V3/L1/pool/src/stratum.rs`, `session.rs`
- V3 Bridge: `V3/L2/bridge/src/handlers.rs`
- V3 DAO: `V3/L2/dao/src/proposal.rs`, `treasury.rs`
- V3 NCL: `V3/L3/ncl/src/scheduler.rs`, `compute.rs`
- V3 WARP: `V3/L3/warp/src/router.rs`
- V3 AI-Native: `V3/L3/ai-native/src/orchestrator.rs`
- V3 Docker: `V3/docker/docker-compose.yml`
- V3 CLI: `V3/cli/src/commands/mod.rs` (22 commands → 37 tools)
