# 🌉 L2 — Bridge Relay (Rust)

> **Crate:** `zion-bridge`  
> **Vrstva:** L2 — DeFi  
> **Stack:** Rust · Tokio · ethers-rs · SQLite  
> **Status:** 🟢 Tested (71 testů, ~3 000 LOC)

---

## Co to je?

Rust daemon, který propojuje ZION L1 s EVM chainy. Sleduje L1 lock transakce a triggeruje mint wZION na EVM. Ve zpětném směru sleduje BridgeBurn eventy a uvolňuje ZION z vaultu na L1.

```
┌────────────┐         ┌──────────────────┐         ┌────────────┐
│  ZION L1   │  lock   │   Bridge Relay   │  mint   │  EVM Chain │
│  (wallet)  │────────▶│  • L1 Watcher    │────────▶│  (wZION)   │
│            │         │  • EVM Watcher   │         │            │
│  (vault)   │◀────────│  • Relayer       │◀────────│  (burn)    │
│  unlock    │         │  • Validator 3/5 │  event  │            │
└────────────┘         └──────────────────┘         └────────────┘
```

---

## Moduly

| Modul | Soubor | Popis |
|-------|--------|-------|
| **config** | `config.rs` | Načítání TOML konfigurace (L1 RPC, EVM RPC, klíče, prahy) |
| **types** | `types.rs` | LockEvent, BurnEvent, BridgeState + decimal konverze (×1e12) |
| **l1_watcher** | `l1_watcher.rs` | Polluje ZION L1 RPC, detekuje lock TX na bridge adresu |
| **evm_watcher** | `evm_watcher.rs` | Subscribuje EVM BridgeBurn eventy (ethers-rs) |
| **relayer** | `relayer.rs` | Submituje cross-chain proofy (submitLockProof / confirmBurnRelease) |
| **validator** | `validator.rs` | 3-of-5 multisig consensus tracker |
| **db** | `db.rs` | SQLite persistence — stav bridge operací |
| **metrics** | `metrics.rs` | Monitoring countery a health check |

---

## Rychlý start

```bash
# Build
cargo build -p zion-bridge

# Testy (71)
cargo test -p zion-bridge

# Spuštění (potřebuje konfiguraci)
cargo run -p zion-bridge -- --config config/bridge-testnet.toml
```

---

## Konfigurace

Hlavní config: `config/bridge-testnet.toml`

```toml
[l1]
rpc_url = "http://helsinki.zionterranova.fun:8332"
bridge_address = "zion1bridge000000000000000000000000000vault"
finality_blocks = 60

[evm.base_sepolia]
rpc_url = "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
wzion_address = "0x..."       # Po deployi z contracts/
bridge_contract = "0x..."     # Po deployi z contracts/
chain_id = 84532

[validators]
threshold = 3
count = 5

[security]
daily_limit = 10_000_000
single_tx_limit = 5_000_000
min_amount = 100
```

---

## Decimal konverze

| Strana | Decimals | Příklad |
|--------|----------|---------|
| ZION L1 | 6 | 1 ZION = 1,000,000 atomic |
| wZION EVM | 18 | 1 wZION = 1,000,000,000,000,000,000 wei |
| Lock → Mint | ×1e12 | L1 amount × 10¹² = EVM amount |
| Burn → Unlock | ÷1e12 | EVM amount ÷ 10¹² = L1 amount |

---

## Struktura

```
bridge/
├── Cargo.toml
└── src/
    ├── main.rs          # Entry point (tokio runtime)
    ├── lib.rs           # Module exports + architektura doc
    ├── config.rs        # BridgeConfig (TOML loading)
    ├── types.rs         # LockEvent, BurnEvent, BridgeState
    ├── l1_watcher.rs    # L1 chain polling
    ├── evm_watcher.rs   # EVM event subscription
    ├── relayer.rs       # Cross-chain proof submission
    ├── validator.rs     # Multisig consensus
    ├── db.rs            # SQLite persistence
    └── metrics.rs       # Health + monitoring
```

---

## Závislosti na jiné crates

```
bridge/  (standalone — žádná Cargo dep na L1)
    │
    ▼
warp/ závisí na bridge (path = "../bridge")
```

> Bridge **nikdy** neimportuje L1 `zion-core`. Komunikace s L1 je výhradně přes HTTP RPC.

---

## Souvislosti

- **Kontrakty** → `../contracts/` (Solidity wZION.sol + ZIONBridge.sol)
- **WARP** → `../warp/` (využívá bridge jako základ pro multi-chain)
- **Architektura** → `../docs/L2_WZION_BRIDGE.md`
- **L1 bridge adresa** → `../core/src/blockchain/burn.rs`
