# WARP Lightning — BTC Lightning Network Native Bridge Plan

> **Status:** 📋 Plán — stub existuje (`adapter/lightning.rs`), implementace plánována
> **Datum:** 2026-06-30 (Session 11)
> **Owner:** Zion Protocol Team
> **Související:** [WARP_ARCHITECTURE.md](./WARP_ARCHITECTURE.md) · [Li.Fi-L2.md](../Li.Fi-L2.md) · [NATIVE_SWAP_DESIGN.md](./NATIVE_SWAP_DESIGN.md)

---

## 1. Cíl

Nativní WARP bridge mezi **ZION L1** a **Bitcoin Lightning Network** bez wrapped tokenů.
Uživatel může poslat ZION a přijít mu BTC přes Lightning (a naopak) — vše přes BOLT11 invoices,
3-of-5 validator consensus, bez custodial rizika.

**Princip:** ZION L1 = settlement hub. Lightning = rychlá BTC transport vrstva.
Žádný wrapped BTC, žádný federated peg — BOLT11 invoices + HTLC atomicity.

---

## 2. Aktuální stav

### Co existuje (stub)

**`V3/L3/warp/src/adapter/lightning.rs`** (231 řádků):
- `LightningAdapter` struct s `node_url` + `macaroon` z env vars
- `decode_invoice()` — minimal BOLT11 amount parsing (placeholder)
- `create_invoice()` — generuje fake invoice string (placeholder)
- `pay_invoice()` — vrací fake payment hash (placeholder)
- `is_payment_settled()` — vrací `false` (placeholder)
- `watch_events()` — vrací `vec![]` (not implemented)
- `execute_mint()` — volá `create_invoice()` (placeholder)
- `health_check()` — vrací `true` (placeholder)
- 3 unit testy (meta + decode valid/invalid)

**`V3/L3/warp/config/chains.toml`**:
```toml
[lightning]
family = "lightning"
finality_blocks = 1
decimals = 8
enabled = true
# WARP_LN_NODE_URL=http://localhost:8080
# WARP_LN_MACAROON=...
```

**`V3/L3/warp/src/types.rs`**: `ChainFamily::Lightning` definováno

### Co chybí

- ❌ Real LND/CLN/LDK node integration
- ❌ BOLT11 invoice parsing (bech32, tagged fields, signature verification)
- ❌ Payment routing (SendPaymentV2 / pay)
- ❌ Invoice subscription (SettleInvoice / HTLC events)
- ❌ Lightning node infra (LND/CLN na Edge serveru)
- ❌ Channel management (likvidita, peer connections)
- ❌ Fee model pro LN route (base + rate, routing hints)
- ❌ Submarine swaps (on-chain ↔ off-chain atomicity)

---

## 3. Architektura

```
┌─ ZION L1 ──────────────────────────┐     ┌─ Lightning Network ──────────┐
│                                    │     │                               │
│  User locks ZION with memo:        │     │  WARP LN Node (LND/CLN)      │
│  WARP:1:lightning:<bolt11_invoice> │────▶│  ├─ Pays BOLT11 invoice       │
│                                    │     │  ├─ Channel liquidity         │
│  L1 Watcher detects lock           │     │  ├─ Route discovery           │
│  → DepositProof                    │     │  └─ HTLC settlement           │
│  → Validator quorum (3-of-5)       │     │                               │
│  → LightningAdapter.execute_mint() │     │  Payment proof → L1 mint      │
│                                    │◀────│  (inbound: user pays invoice) │
│  User receives ZION on L1          │     │                               │
│                                    │     │                               │
└────────────────────────────────────┘     └───────────────────────────────┘
```

### Outbound: ZION L1 → Lightning (BTC)

```
1. User chce poslat BTC někomu přes Lightning
2. User získá BOLT11 invoice od příjemce (nebo generuje WARP node)
3. User posílá ZION na L1 vault s memo:
   WARP:1:lightning:<bolt11_invoice>
4. L1 Watcher detekuje lock TX → DepositProof
5. WARP Router:
   a. Parsuje BOLT11 invoice (amount, payment_hash, expiry, routing hints)
   b. Validuje: amount ≤ daily_limit, invoice není expirovaná
   c. Decimal convert: ZION (6 dec) → sats (8 dec) × 10²
   d. Fee: 0.25% (BTC route) — 50% burn / 25% DAO / 25% validators
6. Validator quorum (3-of-5) podepíše WarpMessage
7. LightningAdapter.execute_mint():
   a. LND SendPaymentV2(invoice) nebo CLN pay(invoice)
   b. Čeká na settlement (polling nebo subscription)
   c. Vrací payment_preimage jako proof
8. Transfer = Completed ✅
```

### Inbound: Lightning → ZION L1

```
1. User chce převést BTC na ZION
2. WARP node generuje BOLT11 invoice:
   create_invoice(amount_sats, memo="WARP:inbound:<zion_recipient>")
3. User platí invoice ze své Lightning peněženky
4. WARP LN node detekuje settlement (SettleInvoice event)
5. WARP Router:
   a. Extrahuje ZION recipient z memo
   b. Decimal convert: sats (8 dec) → ZION (6 dec) ÷ 10²
   c. Fee: 0.25%
6. Validator quorum (3-of-5)
7. ZION L1: mint/transfer ZION na recipient
8. Transfer = Completed ✅
```

---

## 4. Implementační fáze

### Fáze A: LND Node Setup (1-2 týdny)

**Cíl:** Postavit Lightning node infrastrukturu na Edge serveru.

- [ ] **LND install** na Edge serveru (Docker container)
  - LND v0.18+ (nebo CLN v24.02+)
  - Bitcoin backend: bitcoind (pruned) nebo Neutrino (light)
  - Config: `bitcoin.mainnet=1`, `tlsextraip=<edge_ip>`
- [ ] **Channel opening** — likvidita pro WARP node
  - Min 2-3 kanály s well-connected peers (ACINQ, BFX, Lightning Labs)
  - Outbound likvidita: 0.5-1 BTC ($30K-$60K)
  - Inbound likvidita: request via `addInvoice` + channel rebalancing
- [ ] **Macaroon generation** — `admin.macaroon` + `invoice.macaroon` (read-only pro WARP)
- [ ] **TLS cert** — LND generuje self-signed, WARP používá `tls.cert`
- [ ] **Env vars** na Edge:
  ```
  WARP_LN_NODE_URL=https://lnd:10009
  WARP_LN_MACAROON=<hex_invoice_macaroon>
  WARP_LN_TLS_CERT=/path/to/tls.cert
  ```
- [ ] **Health check** — `GetInfo` RPC call, verify `synced_to_chain=true`

### Fáze B: BOLT11 Invoice Parser (3-5 dní)

**Cíl:** Real BOLT11 parsing bez závislosti na `lightning-invoice` crate (pure Rust).

- [ ] **Bech32 decode** — `lnbc1...` human-readable + data part
- [ ] **Tagged fields parsing**:
  - `p` — payment_hash (32 bytes SHA256)
  - `d` — description (memo)
  - `n` — node_id (payee public key)
  - `x` — expiry (default 3600s)
  - `c` — min_final_cltv_expiry (default 18)
  - `r` — routing hints (private channels)
  - `9` — features
- [ ] **Signature verification** — recover pubkey from signature, verify against node_id
- [ ] **Amount parsing** — `lnbc100u` = 100 micro-BTC = 10,000 sats (správné multipliers)
- [ ] **Unit testy** — real BOLT11 invoices z testnet/mainnet

**Knihovna:** `bech32` crate (už v Cargo.toml pro Solana bs58) + `secp256k1` (už přítomné pro EVM/BTC)

### Fáze C: LND gRPC Client (1 týden)

**Cíl:** Rust gRPC klient pro LND (nebo REST proxy pro CLN).

**Option 1: LND gRPC (doporučeno)**
- [ ] `tonic` + `prost` gRPC client (LND `Lightning.proto`)
- [ ] Macaroon + TLS auth
- [ ] RPC volání:
  - `AddInvoice` — vytvořit invoice pro inbound
  - `SendPaymentV2` — platit invoice pro outbound
  - `SubscribeInvoiceEvents` — settlement notifikace (streaming)
  - `GetInfo` — health check
  - `ListChannels` — likvidita monitoring
  - `ChannelBalance` — balance check
- [ ] `lnrpc` proto build (vendor `lightning.proto` do `proto/`)

**Option 2: CLN REST (alternativa)**
- [ ] CLN plugin `clnrest` — REST API
- [ ] `reqwest` HTTP client (už v Cargo.toml)
- [ ] Rune-based auth (CLN alternative to macaroons)
- [ ] REST endpoints: `/v1/invoices`, `/v1/pay`, `/v1/peer`

**Doporučení:** LND gRPC — standardnější, lepší dokumentace, streaming subscription.

### Fáze D: Adapter Implementation (1-2 týdny)

**Cíl:** Nahradit stub v `lightning.rs` real implementací.

- [ ] **`decode_invoice()`** — real BOLT11 parser (Fáze B)
- [ ] **`create_invoice()`** — LND `AddInvoice` RPC
- [ ] **`pay_invoice()`** — LND `SendPaymentV2` RPC
  - Timeout handling (invoice expiry)
  - Route failure retry (jiná cesta)
  - Fee limit (max routing fee = 0.5%)
- [ ] **`is_payment_settled()`** — LND `LookupInvoice` nebo `SubscribeInvoiceEvents`
- [ ] **`watch_events()`** — SubscribeInvoiceEvents stream
  - Filtr: settled invoices s `WARP:inbound:` v memo
  - Generuje DepositProof pro každý settled invoice
- [ ] **`execute_mint()`** — pro outbound: `pay_invoice()` + settlement check
- [ ] **`health_check()`** — LND `GetInfo` (synced_to_chain, num_channels, capacity)
- [ ] **`current_height()`** — LND `GetInfo` (best_header_height)
- [ ] **`confirmations()`** — pro Lightning = settlement status (0 nebo 1)

### Fáze E: Submarine Swaps (Future — 4-8 týdnů)

**Cíl:** On-chain BTC ↔ Lightning atomicity (submarine swaps).

- [ ] **HTLC script** — on-chain BTC deposit s preimage hash
- [ ] **Swap protocol**:
  - User deposit BTC on-chain → HTLC s preimage hash
  - WARP platí Lightning invoice (reveals preimage)
  - User claims on-chain BTC s preimage (nebo WARP po timeout)
- [ ] **Reverse submarine**:
  - WARP generuje HTLC on-chain
  - User platí Lightning invoice (reveals preimage)
  - WARP refund po timeout
- [ ] **PEEK protocol** (Boltz exchange style)

---

## 5. Fee Model

| Route | Fee | Min Fee | Max Fee | Poznámka |
|-------|-----|---------|---------|----------|
| ZION → Lightning | 0.25% | 0.5 ZION | 25,000 ZION | Stejná jako BTC route |
| Lightning → ZION | 0.25% | 0.5 ZION | 25,000 ZION | Inbound invoice settlement |

**Navíc:** Lightning routing fee (network fee ~0.001-0.01%) se odečítá z amount,
nebo se přidává na vrch WARP fee — TBD podle testování.

**Fee distribuce** (stejná jako WARP):
- 🔥 50% BURN — deflace
- 🏛️ 25% DAO Treasury
- 💰 25% Validators

---

## 6. Decimal Conversion

| Směr | From | To | Multiplier | Příklad |
|------|------|----|-----------:|---------|
| ZION → sats | 6 dec (flowers) | 8 dec (sats) | × 10² | 1 ZION = 100 sats |
| sats → ZION | 8 dec (sats) | 6 dec (flowers) | ÷ 10² | 100 sats = 1 ZION |

**Poznámka:** BTC cena volatilní — WARP používá oracle feed (mempool.space / CoinGecko)
pro amount validation. User specifikuje amount v ZION, WARP konvertuje na sats
podle aktuálního BTC/ZION kurzu.

---

## 7. Security Model

### 1. Validator Consensus (3-of-5)
- Každá outbound LN platba vyžaduje 3-of-5 validator signatures
- Validators nezávisle verifikují BOLT11 invoice (amount, expiry, recipient)
- Multi-sig: LND node je single-signature, ale WARP consensus gate-keeps přístup

### 2. Invoice Validation
- Amount ≤ daily_limit (10M ZION equiv)
- Invoice není expirovaná (default 3600s)
- Payment hash je unikátní (replay protection)
- Recipient node_id je validní (signature recovery)

### 3. Channel Liquidity Monitoring
- WARP monitoruje outbound capacity před každou platbou
- Auto-rebalance pokud outbound < threshold (10% total capacity)
- Alert pokud total capacity < 0.1 BTC

### 4. Timeout & Refund
- Invoice expiry (default 3600s) — pokud nezaplacena, ZION se vrací userovi
- LND payment timeout (default 60s) — retry s jinou cestou
- On-chain fallback: pokud LN platba selže, BTC přes on-chain HTLC (Fáze E)

### 5. Macaroon Permissions
- WARP používá `invoice.macaroon` (read + invoice create, ne admin)
- `admin.macaroon` jen pro channel management (oddělený proces)
- TLS cert pinning (žádný MITM)

---

## 8. Infrastruktura

### Edge Server Setup

```
┌─ Edge Server (77.42.71.94 / 100.76.16.108) ──────────────┐
│                                                           │
│  Docker Compose:                                          │
│  ├── zion-node          (L1, port 8443)                  │
│  ├── zion-bridge        (L2, port 8451)                  │
│  ├── zion-warp          (L3, port 8453)                  │
│  ├── zion-lnd           (Lightning, port 10009 gRPC)     │
│  │   ├── bitcoind       (pruned, ~50GB)                  │
│  │   ├── LND            (Neutrino nebo full node)        │
│  │   └── tls.cert + macaroon                             │
│  └── zion-lnd-monitor   (RTL / Thunderhub dashboard)     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Resource Requirements

| Komponent | CPU | RAM | Disk | Network |
|-----------|-----|-----|------|---------|
| bitcoind (pruned) | 1 core | 2 GB | 50 GB | 10 GB/měs |
| LND | 0.5 core | 1 GB | 5 GB | 5 GB/měs |
| Channel liquidity | — | — | — | 0.5-1 BTC ($30K-$60K) |

### Docker Compose Addition

```yaml
# docker-compose.warp-lnd.yml
services:
  zion-lnd:
    image: lightninglabs/lnd:v0.18.3-beta
    container_name: zion-lnd
    restart: unless-stopped
    ports:
      - "10009:10009"   # gRPC
      - "9735:9735"     # P2P
    volumes:
      - ./lnd-data:/root/.lnd
      - ./bitcoin-data:/root/.bitcoin
    environment:
      - BITCOIN_NETWORK=mainnet
      - LND_BACKEND=bitcoind
    command: >
      lnd --bitcoin.mainnet --bitcoin.node=bitcoind
      --bitcoind.rpcuser=zion --bitcoind.rpcpass=${BTC_RPC_PASS}
      --tlsextraip=100.76.16.108
      --rpclisten=0.0.0.0:10009
```

---

## 9. Soubory

| Soubor | Účel | Status |
|--------|------|--------|
| `V3/L3/warp/src/adapter/lightning.rs` | Lightning adapter | ⚠️ Stub → Fáze D |
| `V3/L3/warp/src/adapter/mod.rs` | Adapter registry | ✅ Lightning registrován |
| `V3/L3/warp/config/chains.toml` | Chain config | ✅ `[lightning]` sekce |
| `V3/L3/warp/src/types.rs` | ChainFamily enum | ✅ `Lightning` variant |
| `V3/L3/warp/src/protocol.rs` | Memo format | ⚠️ `WARP:1:lightning:<invoice>` TBD |
| `V3/L3/warp/proto/lightning.proto` | LND gRPC proto | ❌ Chybí (Fáze C) |
| `V3/L3/warp/src/ln_signer.rs` | LND gRPC client | ❌ Chybí (Fáze C) |
| `V3/docker/docker-compose.warp-lnd.yml` | LND Docker | ❌ Chybí (Fáze A) |

---

## 10. WARP vs LI.FI vs Lightning — Kdy použít co

| Use Case | Nástroj | Proč |
|----------|---------|-----|
| wZION ↔ ETH na Base | LI.FI widget | Hotové, 30+ DEX, best price |
| wZION ↔ USDC cross-chain (EVM) | LI.FI widget | Hotové, 20+ bridges |
| ZION L1 ↔ wZION na Base | L2 Bridge | Nativní lock/mint, 5/5 multisig |
| ZION L1 ↔ BTC on-chain | WARP BTC adapter | HTLC, 6-block finality |
| ZION L1 ↔ BTC Lightning | **WARP Lightning** | Rychlé (sekundy), nízké fee |
| ZION L1 ↔ SOL/TRX/XLM | WARP adapter | Nativní, non-EVM |

**Strategie:**
- **LI.FI** = EVM cross-chain swap (hotové, agregátor)
- **WARP BTC** = on-chain BTC bridge (hotové, HTLC)
- **WARP Lightning** = rychlé BTC micropayments (plán, BOLT11)
- **L2 Bridge** = ZION L1 ↔ EVM lock/mint (hotové, 5/5 multisig)

---

## 11. Roadmap

```
2026-07-XX  Fáze A: LND node setup + channels          📋 Plánováno
2026-07-XX  Fáze B: BOLT11 invoice parser (pure Rust)  📋 Plánováno
2026-08-XX  Fáze C: LND gRPC client (tonic)            📋 Plánováno
2026-08-XX  Fáze D: Adapter implementation (replace stub) 📋 Plánováno
2026-09-XX  Fáze D: Testnet E2E (BTC Testnet + LN)     📋 Plánováno
2026-10-XX  Fáze D: Mainnet launch (0.1 BTC cap)       📋 Plánováno
2026-XX-XX  Fáze E: Submarine swaps (on-chain ↔ LN)    🔮 Future
```

**Odhad:** 6-8 týdnů do testnet E2E, 10-12 týdnů do mainnet (s channel likviditou).

---

## 12. Rizika a mitigace

| Riziko | Pravděpodobnost | Mitigace |
|--------|-----------------|----------|
| Channel likvidita nedostatečná | Vysoká (začátek) | Postupné channel opening, 0.1 BTC cap na start |
| LN platba selže (no route) | Střední | Retry s jinou cestou, fee limit 0.5%, on-chain fallback |
| LND node downtime | Nízká | Docker restart policy, health check, alert |
| Invoice expiry během consensus | Nízká | 3600s expiry, consensus < 60s, retry |
| BTC cenová volatilita | Vysoká | Oracle feed, amount lock v momentu TX |
| Macaroon kompromitace | Nízká | `invoice.macaroon` (ne admin), TLS pinning |
| Channel force-close | Nízká | Monitoring, penalty tx, insurance fund |

---

## 13. Open Questions

1. **LND vs CLN vs LDK?** — LND doporučeno (největší ekosystém, gRPC, dokumentace)
2. **Bitcoind full node vs Neutrino?** — Neutrino pro start (light), full node později
3. **Channel likvidita zdroj?** — WARP treasury nebo community-provided?
4. **BTC/ZION oracle?** — mempool.space API, CoinGecko, nebo on-chain price feed?
5. **Submarine swaps priorita?** — Až po základním LN bridge (Fáze E = future)
6. **Lightning address (LNURL)?** — User-friendly alias místo BOLT11 (future enhancement)

---

*Built with 🌀 for the ZION multi-chain universe.*
*Lightning is the speed layer. ZION is the settlement layer. WARP connects them.*
