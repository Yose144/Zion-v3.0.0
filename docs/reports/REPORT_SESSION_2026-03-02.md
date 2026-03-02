# Session Report — 2026-03-02 — L3 WARP Multichain + DeFi Test Suite

**Datum:** 2. března 2026  
**Branch:** `main`  
**Commity této session:** `94ea1af`, `7a34517`, `de0a75b`

---

## Souhrn session

Tři hlavní aktivity:
1. Implementace všech 6 stub adapterů L3 WARP — reálné HTTP připojení na každý chain
2. Vytvoření root-level `WARP.md` — kompletní architektonická dokumentace
3. Celý DeFi test suite — **132/132 PASS, 0 FAIL** + live check na Base Sepolia

---

## 1. L3 WARP — Multichain Adaptery (`94ea1af`)

**Crate:** `zion-warp` (`L3/warp/`)

Před touto session bylo 6 z 7 adapterů jako prázdné stuby (`vec![]`, `execute_mint` vracela error). Po session jsou všechny implementovány s reálným HTTP.

### Implementované adaptery

#### Solana (`adapter/solana.rs`)
- JSON-RPC: `getSlot` → `getSignaturesForAddress(mint, 40)` → `getTransaction`
- Log parse: `"Program log: BridgeBurn amount=X dest=zion1..."`
- Env: `SOLANA_CLUSTER`, `WARP_SOLANA_RPC`

#### Tron (`adapter/tron.rs`)
- TronGrid REST: `/wallet/getnowblock` + `/v1/contracts/{addr}/events?event_name=BridgeBurn`
- Pole: `result.amount` (sun, 6 dec), `result.destZion`
- Env: `TRON_NETWORK`, `WARP_TRON_API`, `TRON_API_KEY`

#### Stellar (`adapter/stellar.rs`)
- Horizon REST: `/ledgers?order=desc&limit=1`
- Soroban JSON-RPC: `getEvents` filtrováno contractId + BridgeBurn topic
- Event JSON: `{ "amount": "<u64>", "dest": "<zion_addr>", "from": "<stellar>" }`
- Env: `STELLAR_NETWORK`, `WARP_STELLAR_HORIZON`, `WARP_STELLAR_SOROBAN`

#### Cosmos (`adapter/cosmos.rs`)
- CosmosSDK REST: `/cosmos/base/tendermint/v1beta1/blocks/latest`
- TX search: `/cosmos/tx/v1beta1/txs?events=wasm._contract_address%3D...%20AND%20wasm.action%3Dbridge_burn`
- Parse wasm atributů: `amount`, `dest_addr`, `sender`
- Env: `COSMOS_NETWORK`, `WARP_COSMOS_REST`

#### Bitcoin (`adapter/bitcoin.rs`)
- mempool.space REST: `/blocks/tip/height` → `/address/{addr}/txs` → `/tx/{txid}/status`
- OP_RETURN parse: hex-decoded ASM → `WARP_INBOUND:bitcoin:<zion_addr>`
- Pouze confirmed TXs, amount = součet non-OP_RETURN výstupů
- Env: `BITCOIN_NETWORK`, `WARP_BITCOIN_API`

#### Cardano (`adapter/cardano.rs`)
- Blockfrost REST: `/blocks/latest` → `/assets/{asset}/transactions` → `/txs/{hash}/metadata` (label 674) → `/txs/{hash}/utxos`
- Metadata label 674 (CIP-20): `{ "warp_dest": "<zion_addr>" }`
- Amount = wZION UTXOs in − wZION UTXOs out (spálený delta)
- Graceful skip pokud `BLOCKFROST_PROJECT_ID` není nastaveno
- Env: `CARDANO_NETWORK`, `WARP_BLOCKFROST_URL`, `BLOCKFROST_PROJECT_ID`

### Status adapterů po session

| Chain | Rodina | Status |
|---|---|---|
| Base/Arb/BSC/Polygon | EVM | ✅ Implementováno |
| Solana | Solana | ✅ Implementováno |
| Tron | Tron | ✅ Implementováno |
| Stellar | Stellar | ✅ Implementováno |
| Cosmos | Cosmos | ✅ Implementováno |
| Bitcoin | Bitcoin | ✅ Implementováno |
| Cardano | Cardano | ✅ Implementováno |
| `execute_mint()` | Signing service | 🔶 D-04 pending |

### Watcher loop (`watcher.rs`)
- `tokio::spawn(watcher.run())` v `main.rs`
- HTTP polling každých 15s (`tokio::time::sleep`)
- Dedup podle `proof.tx_hash` (HashSet)
- `router.initiate_inbound(&chain, proof, &recipient)` — 3-arg call

### Transportní mechanismus
**HTTP polling, NE WebSocket.** Polling byl záměrný design — jednodušší, žádné persistent connections, dostatečné latenci pro bridge finality (všechny chainy vyžadují ≥ 3 potvrzené bloky).

### Teleportová architektura
ZION L1 je hub. Všechny transfery vždy procházejí L1:
```
Source chain burn → ZION L1 lock/mint → Destination chain mint
```
WARP memo formát: `WARP:1:<chain>:<dest_address>`

---

## 2. WARP.md — Root Architektonická Dokumentace (`7a34517`)

**Soubor:** `WARP.md` (kořen repozitáře, 391 řádků)

Dokument zachycuje:
- Quick summary tabulka (transport, design, testy, porty)
- Architektonický diagram (ASCII, teleport hub-and-spoke)
- WARP memo formát (outbound i inbound)
- Tabulka všech 10 chainů s API endpointy a env vars
- Contract adresy (Base Sepolia)
- Decimal conversion tabulka (EVM 18dec → ZION 6dec atd.)
- Popis watcheru a REST API (port 9333)
- Config reference (`warp-testnet.toml`)
- FAQ: WebSocket vs HTTP, teleport design, Python v historii
- Co zbývá: D-04 signing service
- Git history

---

## 3. DeFi Test Suite — 132/132 PASS (`de0a75b`)

### Výsledky unit testů (hardhat local)

```
132 passing (2s)
0 failing
```

| Suite | Testů | Výsledek |
|---|---|---|
| E2E Bridge Lifecycle | 14 | ✅ |
| wZION ERC-20 | 53 | ✅ |
| ZIONAtomicSwap | 20 | ✅ |
| ZIONBridge (multisig) | 30 | ✅ |
| ZIONFarm | 15 | ✅ |
| **Celkem** | **132** | **✅ 0 failing** |

### Fix 2 selhávajících testů

Před fixem: 130 passing, **2 failing** — oba testovaly `threshold=1` ale kontrakt záměrně povoluje 1-of-1 pro testnet.

**Příčina:** Testy předpokládaly `threshold < 2` = neplatné. Kontrakt má komentář `// testnet: allows 1-of-1` a validuje `_threshold >= 1`.

**Fix:** Testy změněny, aby testovaly `threshold=0` (skutečně neplatná hodnota).

```typescript
// PŘED (failing):
ZIONBridge.deploy(..., 1)  // povoleno pro testnet

// PO (passing):
ZIONBridge.deploy(..., 0)  // skutečně neplatné
```

Soubor: `L2/contracts/test/ZIONBridge.test.ts`

### Live check Base Sepolia

```
Deployer:        0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186
ETH balance:     0.021792 ETH
wZION balance:   200.0 wZION
Farm rewardPool: 500.0 wZION
```

### Nasazené kontrakty na Base Sepolia (chain ID 84532)

| Kontrakt | Adresa | Nasazeno |
|---|---|---|
| wZION ERC-20 | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Live |
| ZIONBridge (vault) | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | ✅ Live |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` | ✅ Live |
| ZIONFarm | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` | ✅ Live |
| ZIONGovernance | `0x039F730e3e1c3f36da95187697118791762290a1` | ✅ Live |
| ZIONTreasury | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` | ✅ Live |
| ZIONStaking | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` | ✅ Live |

---

## Git History

| Commit | Popis |
|---|---|
| `94ea1af` | L3/warp: implement all 6 stub adapters (Solana, Tron, Stellar, Cosmos, Bitcoin, Cardano) |
| `7a34517` | docs(L3/warp): WARP.md root-level architecture + implementation status |
| `de0a75b` | fix(test): ZIONBridge threshold tests - use 0 instead of 1 (testnet allows 1-of-1) |

---

## Stav projektu po session

| Vrstva | Komponenta | Stav |
|---|---|---|
| L1 | CosmicHarmony PoW miner | ✅ Produkce |
| L1 | Pool stratum server | ✅ Produkce |
| L2 | wZION ERC-20 | ✅ Live Base Sepolia |
| L2 | ZIONBridge multisig | ✅ Live Base Sepolia |
| L2 | ZIONFarm (yield) | ✅ Live Base Sepolia |
| L2 | ZIONAtomicSwap (HTLC) | ✅ Live Base Sepolia |
| L2 | ZIONGovernance | ✅ Live Base Sepolia |
| L2 | ZIONStaking | ✅ Live Base Sepolia |
| L2 | ZIONTreasury | ✅ Live Base Sepolia |
| L3 | WARP daemon (port 9333) | ✅ Plně implementováno |
| L3 | WARP adaptery (7/7 chainů) | ✅ Plně implementováno |
| L3 | WARP execute_mint signing | 🔶 D-04 pending |
| L4 | Oasis (oasis_bridge.rs) | 🟡 Skeleton |

---

## Další kroky

1. **D-04** — `execute_mint()` signing service (authenticovaný L1 RPC, key mgmt)
2. Aktivace dalších chainů v `warp-testnet.toml` (Solana, Tron... nyní `enabled=false`)
3. Doplnit wZION adresy pro Arbitrum/BSC/Polygon (zatím `0x000...000`)
4. L4 Oasis — první implementace
