# Ankr + L2 Bridge — Kompletní dokumentace

> **Verze:** ZION 2.9.6 | **Datum:** Únor 2026
> **Audience:** Vývojáři, operátoři nodů, i laici kteří chtějí pochopit jak bridge funguje

---

## Obsah

1. [Co je L2 a proč existuje?](#co-je-l2-a-proc-existuje)
2. [Co je wZION?](#co-je-wzion)
3. [Jak bridge funguje — pro laiky](#jak-bridge-funguje--pro-laiky)
4. [wZION plán — nasazení a roadmapa](#wzion-plan--nasazeni-a-roadmapa)
5. [Celá L2 architektura](#cela-l2-architektura)
6. [Co je Ankr a proč ho používáme](#co-je-ankr-a-proc-ho-pouzivame)
7. [Praktický návod — jak spustit bridge](#prakticke-navod--jak-spustit-bridge)
8. [Konfigurace krok za krokem](#konfigurace-krok-za-krokem)
9. [Diagnostika a časté problémy](#diagnostika-a-caste-problemy)
10. [Technické reference](#technicke-reference)

---

## Co je L2 a proč existuje?

ZION je vlastní blockchain (L1) — jako Bitcoin nebo Monero, vlastní síť, vlastní těžaři, vlastní transakce.

**Problém:** Většina DeFi (decentralizované finance), obchodování a likvidity žije na Ethereum, Base, Arbitrum atd. — ne na vlastních blockchainech.

**Řešení = L2 (Second Layer):**
L2 nepřidává nové bloky pod L1. L2 je **interoperabilní vrstva** — propojuje ZION L1 s existujícím EVM ekosystémem pomocí:

```
ZION L1 (vlastní blockchain)
         │
         │   ← Bridge relay (Rust daemon)
         ▼
wZION na Base/Arbitrum/BSC...  ← standard ERC-20 token na ETH ekosystému
         │
         ▼
Uniswap, PancakeSwap, DeFi protokoly, CEX listingy
```

---

## Co je wZION?

**wZION = Wrapped ZION** — ERC-20 token na EVM řetězcích.

`1 wZION = 1 ZION uzamčený na L1 bridge adrese`

Stejný princip jako:
- wBTC (Wrapped Bitcoin na Ethereum)
- wETH (Wrapped Ethereum pro DeFi)

### Klíčové vlastnosti

| Vlastnost | Hodnota |
|-----------|---------|
| Standard | ERC-20 (+ ERC-2612 Permit) |
| Decimals | 18 |
| Max supply | 144 000 000 000 wZION (= celková zásoba ZION L1) |
| Minimum bridge | 100 wZION |
| Kontrakty | `wZION.sol` + `ZIONBridge.sol` |
| Role | BRIDGE_ROLE (mint/burn), GUARDIAN_ROLE (pause) |
| Bezpečnost | AccessControl, Pausable, multisig admin |

### Konverze decimálů

```
L1:  1 ZION = 1 000 000 atomických jednotek  (6 decimálů)
EVM: 1 wZION = 1 × 10^18 wei                 (18 decimálů)

Přepočet v bridge:
  amount_wzion = (l1_atomic_amount / 1_000_000) × 10^18
```

---

## Jak bridge funguje — pro laiky

### Scénář A: ZION → wZION (chci obchodovat na Uniswap)

```
1. Uživatel pošle ZION na speciální "bridge lock" adresu na L1
   Memo/OP_RETURN: "base:0xMojeEthAdresa"

2. Bridge relay zachytí tu transakci na L1
   → počká na finalizaci (např. 12 potvrzení)

3. Bridge ověří u validátorů (konsensus většiny)

4. Bridge zavolá wZION kontrakt na Base:
   bridgeMint(0xMojeEthAdresa, castkaWZION)

5. Uživatel vidí wZION na svém ETH/Base walletu
   → může obchodovat na Uniswap, PancakeSwap atd.
```

### Scénář B: wZION → ZION (chci zpět na L1)

```
1. Uživatel zavolá bridgeBurn() na EVM kontraktu
   Parametry: castka, l1_adresa ("zion1q...")

2. Bridge relay zachytí BridgeBurn event na EVM (přes Ankr HTTP polling)

3. Bridge ověří TX receipt přes Ankr

4. Bridge pošle unlock transakci na ZION L1:
   POST /bridge/unlock {l1_adresa, castka}

5. Uživatel dostane nativní ZION na L1 peněžence
```

### Časy a poplatky

| Směr | Typický čas | Poplatek |
|------|-------------|---------|
| L1 → EVM | 5–15 minut | L1 TX fee + EVM gas |
| EVM → L1 | 3–10 minut | EVM gas (bridgeBurn) |
| Velké částky | +24h timelock | Stejné + čekání |

> **Timelock:** Bezpečnostní ochrana — velké transakce (konfigurovatelný limit) čekají 24h.
> Chrání před hacknutím bridge klíčů.

---

## wZION plán — nasazení a roadmapa

### Fáze 1 — Testnet (aktuální stav)

- [x] `wZION.sol` deploynut na Base Sepolia testnet
- [x] `ZIONBridge.sol` deploynut na Base Sepolia
- [x] Bridge relay (Rust) funguje na ZION testnet
- [x] Ankr free tier — žádné vlastní nody potřeba
- [x] 157 testů, 0 selhání

### Fáze 2 — Mainnet Base (Q2 2026)

```
Priority 1: Base (Ethereum L2, nízké gasy, Uniswap v3)

Kroky:
  □ Audit wZION.sol + ZIONBridge.sol (externím auditorem)
  □ Deploy na Base mainnet
  □ Nastavit BRIDGE_ROLE na relay multisig peněženku
  □ Seed Uniswap v3 pool: wZION/USDC
  □ Spustit relay s ANKR_API_KEY (premium tier)
  □ Monitoring + alerting (Grafana dashboard)
```

### Fáze 3 — Multi-chain (Q3 2026)

```
Priority 2: Arbitrum (nízké gasy, velká DeFi likvidita)
Priority 3: BSC (PancakeSwap, asijský trh)
Priority 4: Polygon (QuickSwap)

Každý chain = deploy nového páru wZION.sol + ZIONBridge.sol
Bridge relay = jeden Rust daemon, více chain configů (Ankr auto URL)
```

### Fáze 4 — wZION DeFi ekosystém (Q4 2026+)

```
□ Liquidity farming pools (reward v ZION)
□ wZION jako collateral v lending protokolech
□ CEX listingy (wZION na Base → konvertovatelné na nativní ZION)
□ L3/Warp XP bridge: DeFi akce na EVM → XP odměny na ZION L1
```

### wZION ekonomika

```
Celková zásoba ZION L1: 144 000 000 000 ZION
                                │
          ┌─────────────────────┼──────────────────────┐
          ▼                     ▼                       ▼
  Těžba (mining)         Premine (5%)           Bridge do EVM
  (zbytek zásoby)    ~7.2B ZION locked      wZION cirkulace

ZION na L1 = VŽDY >= wZION v cirkulaci
(1:1 peg garantovaný lock mechanismem)
```

---

## Celá L2 architektura

### Přehled vrstev

```
┌─────────────────────────────────────────────────────────┐
│                    ZION L1 Blockchain                    │
│  Vlastní PoW/CHv3, 144B supply, 6 decimal atomic units  │
└────────────────────┬────────────────────────────────────┘
                     │  Bridge lock address (L1)
                     │  L1 watcher (Rust polling)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    L2 BRIDGE RELAY                       │
│  (Rust daemon — zion-bridge crate)                      │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ l1_watcher  │  │ evm_watcher  │  │   relayer     │  │
│  │ (HTTP poll) │  │ (Ankr HTTP)  │  │  (consensus)  │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          ▼                              │
│              ┌───────────────────────┐                  │
│              │   ValidatorSet        │                  │
│              │   (BFT konsensus)     │                  │
│              └───────────┬───────────┘                  │
│                          │                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │  BridgeDb (SQLite)  │  Prometheus metrics :9090  │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │  Ankr HTTP JSON-RPC
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   EVM CHAINY (přes Ankr)                 │
│                                                         │
│  Base           Arbitrum        BSC          Polygon    │
│  ┌──────┐       ┌──────┐       ┌──────┐     ┌──────┐   │
│  │wZION │       │wZION │       │wZION │     │wZION │   │
│  │.sol  │       │.sol  │       │.sol  │     │.sol  │   │
│  │Bridge│       │Bridge│       │Bridge│     │Bridge│   │
│  │.sol  │       │.sol  │  (Q3 2026)   │ (Q3 2026)  │   │
│  └──────┘       └──────┘       └──────┘     └──────┘   │
│      │               │                                  │
│  Uniswap v3      Camelot/                               │
│  wZION/USDC      Uniswap v3                             │
└─────────────────────────────────────────────────────────┘
```

### Rust crate: `zion-bridge`

**Zdrojové soubory:**

| Soubor | Účel | Testů |
|--------|------|-------|
| [L2/bridge/src/ankr.rs](L2/bridge/src/ankr.rs) | HTTP JSON-RPC klient pro Ankr | 19 |
| [L2/bridge/src/config.rs](L2/bridge/src/config.rs) | Konfigurace (AnkrConfig, EvmChainConfig...) | 11 |
| [L2/bridge/src/types.rs](L2/bridge/src/types.rs) | Sdílené typy (BridgeStatus, L1LockEvent...) | — |
| [L2/bridge/src/l1_watcher.rs](L2/bridge/src/l1_watcher.rs) | Sleduje lock eventy na ZION L1 | 8 |
| [L2/bridge/src/evm_watcher.rs](L2/bridge/src/evm_watcher.rs) | BridgeBurn polling přes Ankr | 13 |
| [L2/bridge/src/relayer.rs](L2/bridge/src/relayer.rs) | Relayer (mint/unlock po konsensu) | 12 |
| [L2/bridge/src/validator.rs](L2/bridge/src/validator.rs) | ValidatorSet + BFT konsensus | 8 |
| [L2/bridge/src/db.rs](L2/bridge/src/db.rs) | SQLite persistence (SeaORM) | 9 |
| [L2/bridge/src/metrics.rs](L2/bridge/src/metrics.rs) | Prometheus /metrics endpoint | 5 |
| [L2/bridge/src/main.rs](L2/bridge/src/main.rs) | Binary entry-point | — |

**Tokio datový tok (async):**

```
main()
  ├── L1Watcher::run()          [Tokio task]
  │     └── HTTP poll /blocks každých 30s
  │           └── L1LockEvent → mpsc channel
  │
  ├── EvmWatcher::run()         [Tokio task, jeden per chain]
  │     └── AnkrClient::get_logs() každých 12s
  │           └── parse BridgeBurn log → EvmBurnEvent → channel
  │
  └── Relayer::run()            [Tokio task]
        ├── recv L1LockEvent
        │     └── validator.add_confirmation() → threshold? → EVM mint
        └── recv EvmBurnEvent
              └── ankr.get_receipt() → verify → L1 unlock HTTP call
```

### Solidity kontrakty: `L2/contracts/`

**`wZION.sol`** — ERC-20 Wrapped ZION

```
wZION
├── ERC20           (balances, transfers, allowances)
├── ERC20Burnable   (bridgeBurn callable uživatelem)
├── ERC20Permit     (gasless approve, EIP-2612)
├── AccessControl   (role-based: BRIDGE_ROLE, GUARDIAN_ROLE)
└── Pausable        (nouzové zastavení celého kontraktu)

Klíčové funkce:
  mint(address to, uint256 amount)
    → BRIDGE_ROLE only — volá relay po L1 lock proof
  burn(uint256 amount)
    → public — volá bridge kontrakt při inicializaci withdrawalu
  bridgeBurn(uint256 amount, string l1addr, bytes32 nonce, uint256 deadline)
    → emituje BridgeBurn event (relay ho detekuje přes Ankr)
  pause() / unpause()
    → GUARDIAN_ROLE — nouzové zmrazení
```

**`ZIONBridge.sol`** — Koordinátor bridgování na EVM

```
ZIONBridge
├── Přijímá bridgeBurn() od uživatelů
├── Emituje BridgeBurn event → relay zachytí přes Ankr
├── Ověřuje nonce (ochrana před replay attackem)
├── confirmBurnRelease() → volá relay pro L1→EVM směr
└── Timelock pro velké částky
```

**BridgeBurn event topic:**
```
keccak256("BridgeBurn(address,uint256,string,bytes32,uint256)")
= 0x179dc3b748531271bc8b650b06312455d746350b674ae8d67d0f8b0ecf1212fb
```

### DAO: `L2/dao/`

```
zion-dao crate (65 testů)
├── Proposals     (create, vote, execute, cancel)
├── Treasury      (multi-sig výběry, tracking příjmů)
├── Humanitarian  (transparentní humanitární fond)
└── SQLite        (persistence hlasování a výsledků)

Budoucí propojení s bridge:
  DAO hlasování → změna parametrů bridge:
    - timelock limit (výchozí: 24h pro velké transakce)
    - validator threshold (výchozí: 2 ze 3)
    - bridge poplatky
  DAO treasury → % z bridge poplatků → community fond
```

---

## Co je Ankr a proč ho používáme

**Ankr** = cloudová RPC služba — provozuje uzly pro desítky EVM blockchainů a dává k nim přístup přes jednoduché HTTP volání. Není potřeba vlastní infrastruktura.

### Analogie pro laiky

```
Bez Ankr:  musíme sami provozovat Ethereum node, Base node,
           Arbitrum node, BSC node...
           → servery = drahé, sync = dny, udržování = full-time práce

S Ankr:    voláme jeden URL → Ankr udělá zbytek za nás
           Jako: namísto vlastního datového centra použijeme AWS/Azure
```

### Ankr endpoint vzor

```
https://rpc.ankr.com/{chain}              ← free tier (~30 req/s)
https://rpc.ankr.com/{chain}/{api_key}    ← premium (vyšší limity)
```

Standard HTTP POST, JSON-RPC 2.0 — žádné speciální knihovny:

```json
POST https://rpc.ankr.com/base
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_blockNumber",
  "params": []
}
```

### Podporované chainy

| Chain | Slug | EVM Chain ID | URL |
|-------|------|-------------|-----|
| Ethereum | `eth` | 1 | `https://rpc.ankr.com/eth` |
| Base | `base` | 8453 | `https://rpc.ankr.com/base` |
| Arbitrum | `arbitrum` | 42161 | `https://rpc.ankr.com/arbitrum` |
| BNB Chain | `bsc` | 56 | `https://rpc.ankr.com/bsc` |
| Polygon | `polygon` | 137 | `https://rpc.ankr.com/polygon` |

### Proč Ankr místo ethers.rs + WebSocket?

| Kritérium | Staré (ethers v2 + WS) | Nové (Ankr HTTP) |
|-----------|----------------------|-----------------|
| Rust dependencies | ethers v2 (~200 crates) | sha3 + reqwest (již bylo) |
| Kompilace | ~8 minut | ~2 minuty |
| Přidání nového chainu | nová WS URL nutná | nic (auto z chain_id) |
| Reconnect logika | nutná (WS padají) | není (HTTP stateless) |
| Bloků per request | není limit (subscription) | 3 000 (free tier chunk) |
| API přístup | per-chain providery | jeden API klíč, všechny chainy |
| Free tier | závisí na provideru | Ankr free tier bez karty |

---

## Praktický návod — jak spustit bridge

### Předpoklady

```
✓ ZION L1 node running (nebo přístup k L1 RPC endpointu)
✓ Rust toolchain: rustup + cargo (stable)
✓ SQLite (automaticky embeddovaný přes crate)
✓ Ankr API klíč (volitelný, free tier funguje bez klíče)
```

### Krok 1 — Build

```bash
git clone https://github.com/Yose144/2.9.6.git
cd 2.9.6-main

# Build release binary
cargo build --release -p zion-bridge

# Binary je na:
# target/release/zion-bridge          (Linux/Mac)
# target\release\zion-bridge.exe      (Windows)
```

### Krok 2 — Připrav konfiguraci

```bash
cp config/bridge-testnet.toml config/my-bridge.toml
# Uprav podle potřeby (viz Konfigurace krok za krokem níže)
```

Minimální pracující konfigurace:

```toml
[bridge]
name = "zion-bridge-1"
version = "2.9.6"

[l1]
rpc_url          = "http://localhost:26657"
chain_id         = "zion-mainnet-1"
lock_address     = "zion1bridge000lockaddr..."
poll_interval_secs = 30
finality_blocks  = 12

[ankr]
enabled = true
# api_key = "xxxxx"   ← nepovinné, free tier bez klíče

[database]
path = "./bridge.db"

[metrics]
enabled = true
port    = 9090

[validator]
threshold = 2
total     = 3

[[evm_chains]]
chain_id                = "base"
name                    = "Base"
evm_chain_id            = 8453
wzion_address           = "0x<wZION adresa>"
bridge_contract_address = "0x<ZIONBridge adresa>"
finality_blocks         = 12
enabled                 = true
gas_strategy            = "eip1559"
max_gas_gwei            = 200
```

### Krok 3 — Nastav Ankr API klíč (doporučeno pro mainnet)

**Varianta A — env var (doporučeno):**
```bash
export ANKR_API_KEY="tvůj-klíč-z-ankr.com"
```

**Varianta B — config soubor:**
```toml
[ankr]
enabled = true
api_key = "tvůj-klíč"
```

**Kde vzít klíč (5 minut, zdarma):**
1. [ankr.com](https://ankr.com) → Sign Up
2. Dashboard → **RPC Service** → **My Endpoints**
3. Zkopíruj svůj Personal Endpoint nebo API Key

### Krok 4 — Spuštění

```bash
# Přímé spuštění
./target/release/zion-bridge --config config/my-bridge.toml

# Nebo přes Docker
docker-compose -f docker/docker-compose.mainnet.yml up bridge
```

**Očekávané logy po spuštění:**
```
INFO zion_bridge: Starting ZION Bridge v2.9.6
INFO ankr: Ankr health OK — base @ block 27845231
INFO l1_watcher: Watching ZION L1 from block 450000
INFO evm_watcher: Watching Base from block 27845231 (Ankr HTTP, chunk=3000)
INFO relayer: Validator threshold: 2/3
INFO metrics: Prometheus metrics on :9090
```

### Krok 5 — Ověření

```bash
# Prometheus metrics (bridge je alive)
curl http://localhost:9090/metrics | grep bridge_

# Test Ankr připojení manuálně
curl -X POST https://rpc.ankr.com/base \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
# → {"jsonrpc":"2.0","id":1,"result":"0x1a8f..."}

# Zobraz bridge DB stav
sqlite3 bridge.db ".tables"
sqlite3 bridge.db "SELECT status, COUNT(*) FROM bridge_ops GROUP BY status;"
```

---

## Konfigurace krok za krokem

### `[ankr]` sekce

```toml
[ankr]
enabled = true          # true = Ankr jako EVM RPC backend (doporučeno)
                        # false = každý chain musí mít explicitní rpc_url
api_key = "xxxxx"       # nepovinné — free tier bez klíče
                        # nebo: env var ANKR_API_KEY
```

### `[[evm_chains]]` sekce — všechna pole

```toml
[[evm_chains]]
# POVINNÉ:
chain_id                = "base"    # Ankr slug (eth/base/arbitrum/bsc/polygon)
name                    = "Base"    # Zobrazovací název
evm_chain_id            = 8453      # Číselné EVM chain ID
wzion_address           = "0x..."   # Deploy adresa wZION.sol
bridge_contract_address = "0x..."   # Deploy adresa ZIONBridge.sol

# DOPORUČENÉ:
finality_blocks  = 12               # Čekej X bloků před zpracováním
enabled          = true             # false = chain ignorován bez smazání
gas_strategy     = "eip1559"        # nebo "legacy" (starší chainy)
max_gas_gwei     = 200              # Odmítne TX s vyšším gas price

# VOLITELNÉ (přepíše Ankr URL):
# rpc_url = "https://moje-vlastni-node.example.com"
```

### `[validator]` sekce

```toml
[validator]
threshold = 2              # Minimální potvrzení pro konsensus
total     = 3              # Celkový počet validátorů
key_file  = "./bridge.key" # Privátní klíč (uložen Zeroizing<String>)
```

### `[security]` sekce

```toml
[security]
max_bridge_amount_atomic = 1_000_000_000_000  # Limit před timelockerm (atomic units)
timelock_delay_secs      = 86400              # 24h timelock pro velké TX
```

### Priorita RPC URL

```
1. [[evm_chains]].rpc_url           (pokud nastaveno)
2. https://rpc.ankr.com/{id}/{key}  (Ankr premium — api_key nastaven)
3. https://rpc.ankr.com/{id}        (Ankr free tier)
```

---

## Diagnostika a časté problémy

### HTTP 429 Too Many Requests

```
WARN ankr: Ankr rate limit hit — base: HTTP 429
```

**Řešení:**
1. Registruj se na [ankr.com](https://ankr.com) (zdarma)
2. Nastav `ANKR_API_KEY=xxxxx`
3. Pro mainnet produkci zvažte Ankr premium plán

---

### Bridge nedetekuje BridgeBurn eventy

```bash
# 1. Ověř aktuální watch blok v DB
sqlite3 bridge.db "SELECT * FROM bridge_state;"

# 2. Manuálně ověř event přes Ankr
curl -X POST https://rpc.ankr.com/base \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"eth_getLogs",
    "params":[{
      "fromBlock":"latest",
      "toBlock":"latest",
      "address":"0x<ZIONBridge>",
      "topics":["0x179dc3b748531271bc8b650b06312455d746350b674ae8d67d0f8b0ecf1212fb"]
    }]
  }'
```

**Pokud logs jsou prázdné:** transakce ještě neproběhla nebo špatná adresa kontraktu.

---

### Transakce uvízla ve stavu `Pending`

```bash
# Zobraz uvízlé operace
sqlite3 bridge.db "SELECT * FROM bridge_ops WHERE status='Pending';"
```

Možné příčiny:
- L1 node nedostupný → zkontroluj `l1.rpc_url`
- Validator threshold nedosažen → zkontroluj `[validator].threshold`
- Timelock aktivní (velká částka) → počkej 24h nebo zkontroluj `[security].max_bridge_amount_atomic`
- Relay klíč nemá BRIDGE_ROLE na kontraktu

---

### BRIDGE_BURN_TOPIC mismatch

```
WARN evm_watcher: topic mismatch detected
```

Topic je kryptograficky odvozený z přesného ABI podpisu:

```rust
keccak256("BridgeBurn(address,uint256,string,bytes32,uint256)")
= 0x179dc3b748531271bc8b650b06312455d746350b674ae8d67d0f8b0ecf1212fb
```

**Pravidlo:** ABI podpis v `ZIONBridge.sol` musí být **přesně** `BridgeBurn(address,uint256,string,bytes32,uint256)` — bez mezer, přesná pořadí typů. Jakákoliv změna = jiný topic hash.

---

## Technické reference

### Ankr JSON-RPC metody (použité v bridge)

| Metoda | Účel |
|--------|------|
| `eth_blockNumber` | Aktuální výška bloku (health check + polling) |
| `eth_getLogs` | Fetch BridgeBurn event logů (chunky po 3 000 blocích) |
| `eth_sendRawTransaction` | Broadcast podepsané TX (mint wZION) |
| `eth_getTransactionReceipt` | Ověření stavu TX před L1 unlock |
| `eth_call` | Read-only volání kontraktu |

### Ankr free tier limity

| Parametr | Free tier | Premium |
|----------|-----------|---------|
| Bloků per `eth_getLogs` | 3 500 | 100 000 |
| Rate limit | ~30 req/s | Dle tarifu |
| Archivní data | Ano | Ano |
| WebSocket | Ne (HTTP only) | Ano |

Bridge chunk size = **3 000 bloků** → bezpečně pod free tier limitem.

### Rust závislosti `L2/bridge/Cargo.toml`

```toml
reqwest  = { version = "0.12", features = ["json", "rustls-tls"] }  # HTTP klient
sha3     = "0.10"     # keccak256 pro event topic hashe
zeroize  = { version = "1.6", features = ["derive"] }               # bezpečný klíč
tokio    = { version = "1", features = ["full"] }                   # async runtime
serde    = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow   = "1"
tracing  = "0.1"
hex      = "0.4"
# ethers  ← ODSTRANĚNO v 2.9.6 (nahrazeno Ankr HTTP)
```

### Soubory L2 — rychlý přehled

| Soubor | Popis |
|--------|-------|
| [L2/bridge/src/ankr.rs](L2/bridge/src/ankr.rs) | AnkrClient (19 testů) |
| [L2/bridge/src/config.rs](L2/bridge/src/config.rs) | AnkrConfig, effective_rpc_url() (11 testů) |
| [L2/bridge/src/evm_watcher.rs](L2/bridge/src/evm_watcher.rs) | HTTP polling, BridgeBurn ABI parser |
| [L2/bridge/src/relayer.rs](L2/bridge/src/relayer.rs) | Relayer s Ankr TX verify |
| [L2/bridge/src/types.rs](L2/bridge/src/types.rs) | BridgeStatus, L1LockEvent, EvmBurnEvent |
| [L2/bridge/src/validator.rs](L2/bridge/src/validator.rs) | ValidatorSet, BFT konsensus |
| [L2/bridge/src/db.rs](L2/bridge/src/db.rs) | SQLite persistence (SeaORM) |
| [L2/contracts/wZION.sol](L2/contracts/wZION.sol) | ERC-20 Wrapped ZION |
| [L2/contracts/ZIONBridge.sol](L2/contracts/ZIONBridge.sol) | Bridge koordinátor na EVM |
| [L2/dao/](L2/dao/) | DAO governance (65 testů) |
| [config/bridge-testnet.toml](config/bridge-testnet.toml) | Referenční konfigurace |
