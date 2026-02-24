# Ankr Integration — L2 Bridge

## Přehled

ZION Bridge L2 používá [Ankr](https://ankr.com) jako unifikovaného HTTP JSON-RPC poskytovatele pro všechny EVM řetězce. Nahrazuje původní řešení s per-chain WebSocket připojeními a těžkou závislostí `ethers v2`.

```
Starý přístup:      WebSocket per chain + ethers abigen!
Nový přístup (Ankr): HTTP polling, jeden API klíč → všechny chainy
```

---

## Jak Ankr funguje

Ankr poskytuje jednotný endpoint vzorem:

```
https://rpc.ankr.com/{chain}              ← free tier (rate-limited)
https://rpc.ankr.com/{chain}/{api_key}    ← premium (vyšší limity)
```

Stačí POST standardní JSON-RPC požadavek:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_blockNumber",
  "params": []
}
```

Žádné WebSocket, žádné znovu-připojení, žádná per-chain konfigurace URL.

---

## Podporované chainy

| Chain     | Ankr slug   | EVM Chain ID | Mainnet URL                          |
|-----------|-------------|-------------|--------------------------------------|
| Ethereum  | `eth`       | 1           | `https://rpc.ankr.com/eth`           |
| Base      | `base`      | 8453        | `https://rpc.ankr.com/base`          |
| Arbitrum  | `arbitrum`  | 42161       | `https://rpc.ankr.com/arbitrum`      |
| BSC       | `bsc`       | 56          | `https://rpc.ankr.com/bsc`           |
| Polygon   | `polygon`   | 137         | `https://rpc.ankr.com/polygon`       |

---

## Konfigurace

### Minimální konfigurace (`config/bridge-mainnet.toml`)

```toml
[ankr]
enabled = true
# api_key = "váš-ankr-klíč"  # volitelné — bez klíče funguje free tier

[[evm_chains]]
chain_id    = "base"                   # Ankr slug → auto URL
name        = "Base"
evm_chain_id = 8453
# rpc_url není potřeba — auto-derivováno z chain_id
wzion_address          = "0x..."
bridge_contract_address = "0x..."
finality_blocks = 12
enabled  = true
gas_strategy = "eip1559"
max_gas_gwei = 200

[[evm_chains]]
chain_id    = "arbitrum"
name        = "Arbitrum"
evm_chain_id = 42161
wzion_address          = "0x..."
bridge_contract_address = "0x..."
finality_blocks = 12
enabled  = true
gas_strategy = "eip1559"
max_gas_gwei = 100
```

### S vlastním URL (override Ankr)

```toml
[[evm_chains]]
chain_id = "base"
rpc_url  = "https://moje-private-node.example.com"  # přepíše Ankr
```

### API klíč přes env var

```bash
export ANKR_API_KEY="váš-ankr-api-klíč"
```

Priorita: `config.ankr.api_key` > `ANKR_API_KEY` env var > free tier.

---

## Architektura v kódu

### `L2/bridge/src/ankr.rs`

Hlavní modul s HTTP JSON-RPC klientem:

```rust
pub struct AnkrClient {
    api_key: Option<String>,
    client: reqwest::Client,
}
```

**Metody:**

| Metoda | JSON-RPC volání | Popis |
|--------|----------------|-------|
| `block_number(chain)` | `eth_blockNumber` | Aktuální výška bloku |
| `get_logs(chain, filter)` | `eth_getLogs` | Fetch event logů (BridgeBurn) |
| `send_raw_transaction(chain, raw)` | `eth_sendRawTransaction` | Broadcast podepsané TX |
| `get_transaction_receipt(chain, hash)` | `eth_getTransactionReceipt` | Stav TX |
| `eth_call(chain, to, data)` | `eth_call` | Read-only volání kontraktu |
| `health_check(chain)` | `eth_blockNumber` | Kontrola dostupnosti endpointu |

**Pomocné funkce:**

```rust
// Výpočet keccak256 event topic hashe
pub fn keccak256_topic(input: &[u8]) -> String

// BridgeBurn event topic (předpočítaná konstanta)
pub const BRIDGE_BURN_TOPIC: &str = "0x179dc3b7..."
```

### `L2/bridge/src/evm_watcher.rs`

Sleduje BridgeBurn eventy pomocí HTTP pollingu (nahrazuje WebSocket):

```
Starý tok: Provider<Ws>::connect() → filter.subscribe() → stream
Nový tok:  AnkrClient::get_logs(filter) každých 12 sekund
```

- Blok range per volání: **3 000** (Ankr free tier limit)
- Parsování logů: ruční ABI decode bez ethers (`u256_be_to_decimal`, `usize_from_be32`)
- Auto-reconnect: zachováno (exponential backoff 5s → 10s → 20s → 40s → 80s)

### `L2/bridge/src/config.rs`

```rust
pub struct AnkrConfig {
    pub enabled: bool,
    pub api_key: Option<String>,   // override ANKR_API_KEY env var
}

impl EvmChainConfig {
    // Vrátí efektivní RPC URL:
    //   1. rpc_url (pokud nastaveno)
    //   2. https://rpc.ankr.com/{chain_id}/{api_key}
    pub fn effective_rpc_url(&self, ankr: &AnkrConfig) -> String
}
```

---

## Omezení free tieru

| Parametr | Free tier | Premium |
|----------|-----------|---------|
| Bloků per `eth_getLogs` | 3 500 | 100 000 |
| Rate limit | ~30 req/s | Dle tarifu |
| Archivní data | Ano | Ano |
| WebSocket | Ne (HTTP only) | Ano |

ZION Bridge používá chunking 3 000 bloků → zůstává pod limitem.

---

## Získání API klíče

1. Registrace: [ankr.com](https://ankr.com)
2. Dashboard → **API Keys** → Create new key
3. Nastavit v konfiguraci nebo env var `ANKR_API_KEY`

Free tier nevyžaduje platební kartu a je dostačující pro testnet a menší provoz.

---

## Migrace ze staré konfigurace

### Před (ethers + WebSocket)

```toml
[[evm_chains]]
chain_id = "base"
rpc_url  = "wss://base-mainnet.publicnode.com"   # WebSocket URL nutná
```

```toml
# Cargo.toml
ethers = { version = "2", features = ["abigen", "ws", "rustls"] }  # ~200 deps
```

### Po (Ankr HTTP)

```toml
[ankr]
enabled = true

[[evm_chains]]
chain_id = "base"
# rpc_url = ...  ← není potřeba, Ankr URL auto-derivována
```

```toml
# Cargo.toml
sha3 = "0.10"    # keccak256 pro event topic hashe
reqwest = ...    # již bylo přítomno
# ethers odstraněn
```

---

## Diagnostika

### Test připojení

```bash
# Ověření free tier endpointu
curl -X POST https://rpc.ankr.com/base \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# S API klíčem
curl -X POST https://rpc.ankr.com/base/VÁŠ_KLÍČ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Očekávaná odpověď:
```json
{"jsonrpc":"2.0","id":1,"result":"0x..."}
```

### Health check přes most

Bridge provádí `health_check()` při startu každého EVM watcheru — výsledek se loguje:

```
INFO ankr: Ankr health OK — base @ block 27845231
WARN ankr: Ankr health FAIL — base: HTTP 429 Too Many Requests
```

---

## Soubory

| Soubor | Role |
|--------|------|
| [L2/bridge/src/ankr.rs](L2/bridge/src/ankr.rs) | AnkrClient implementace |
| [L2/bridge/src/config.rs](L2/bridge/src/config.rs) | AnkrConfig, effective_rpc_url |
| [L2/bridge/src/evm_watcher.rs](L2/bridge/src/evm_watcher.rs) | HTTP polling watcher |
| [L2/bridge/src/relayer.rs](L2/bridge/src/relayer.rs) | Relayer s Ankr TX verify |
| [L2/bridge/Cargo.toml](L2/bridge/Cargo.toml) | Závislosti (bez ethers) |
| [config/bridge-testnet.toml](config/bridge-testnet.toml) | Ukázková konfigurace |
