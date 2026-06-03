# ZION V3 Bridge — 100% Readiness Plan

> **Verze:** 3.0.1+
> **Cíl:** Plně funkční cross-chain bridge pro veřejný mainnet launch (31.12.2026)
> **Ověřeno:** 2026-06-03 — Base Sepolia testnet kontrakty LIVE

---

## 1. Current State (Ověřeno na blockchainu)

### Base Sepolia Testnet (LIVE)

| Komponent | Adresa | Status | Explorer |
|-----------|--------|--------|----------|
| **wZION ERC-20** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ LIVE, 11 tx | [sepolia.basescan.org](https://sepolia.basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6) |
| **ZIONBridge** | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | ✅ LIVE, 3 tx | [sepolia.basescan.org](https://sepolia.basescan.org/address/0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1) |
| **Deployer/Validator** | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | ✅ EOA, 50 wZION, UNI-V3-POS | [sepolia.basescan.org](https://sepolia.basescan.org/address/0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186) |

**Důležité zjištění:** Deployer wallet drží 50 wZION + UNI-V3-POS NFT — token byl **skutečně testován na Uniswap V3** na Base Sepolia. To potvrzuje, že wZION kontrakt je funkční ERC-20 s approve/transfer logikou.

---

## 2. Gap Analysis — Co chybí do 100%

### 2.1 Smart Contracts (Solidity)

| # | Úkol | Priorita | Odpovědnost | ETA |
|---|------|----------|-------------|-----|
| C1 | **Verify ZIONBridge source** na BaseScan | P0 | Dev | 1 den |
| C2 | **Verify wZION source** na BaseScan | P0 | Dev | 1 den |
| C3 | **BridgeValidator (3/5 multisig)** — deploy na Base Sepolia | P0 | Dev | 2 dny |
| C4 | **Contract audit** — interní + externí (Certik/SlowMist) | P0 | Security | 2 týdny |
| C5 | **Base Mainnet deploy** — po Sepolia success | P1 | Ops | 1 den |
| C6 | **Emergency pause/upgrade mechanism** (OpenZeppelin Proxy) | P1 | Dev | 3 dny |

### 2.2 Relayer & Backend (Rust)

| # | Úkol | Priorita | Odpovědnost | ETA |
|---|------|----------|-------------|-----|
| R1 | **End-to-end bridge test** — L1 mint → Base Sepolia lock → wZION mint → burn → L1 unlock | P0 | Dev | 3 dny |
| R2 | **Validator 3/5 signing** — implementovat threshold sig v `V3/L2/bridge/src/relayer.rs` | P0 | Dev | 5 dní |
| R3 | **Gas estimation + EIP-1559** — dynamic fee calculation | P1 | Dev | 2 dny |
| R4 | **Replay protection** — nonce management pro relayer | P1 | Dev | 2 dny |
| R5 | **Monitoring** — bridge-specific Prometheus metrics (locked, minted, volume) | P1 | Dev | 2 dny |
| R6 | **Auto-retry + circuit breaker** — failed TX retry s exponenciálním backoffem | P2 | Dev | 3 dny |

### 2.3 Security

| # | Úkol | Priorita | Odpovědnost | ETA |
|---|------|----------|-------------|-----|
| S1 | **Validator key management** — HSM nebo hardware wallet pro 3/5 signers | P0 | Security | 1 týden |
| S2 | **Timelock na kontraktech** — 24h delay pro >1M wZION transfery | P0 | Dev | 2 dny |
| S3 | **Daily limit enforcement** — 10M wZION max / den | P0 | Dev | 1 den |
| S4 | **Anomaly detection** — auto-pause při neočekávaném volume | P1 | Dev | 3 dny |
| S5 | **Bug bounty program** — před mainnet launch | P1 | Ops | 2 týdny |

---

## 3. UI Track — Bridge User Interface

### 3.1 Dashboard (Python, port 8766)

**Nová záložka: "Bridge"**

| Funkce | Popis | Priorita |
|--------|-------|----------|
| **Bridge Status Card** | Online/offline, poslední block scanned, total volume | P0 |
| **Cross-Chain Transfer Form** | From/To chain selector, amount input, max button, fee estimate | P0 |
| **Transaction History** | Pending + completed transfers, tx hash links | P0 |
| **Liquidity Display** | Locked ZION na L1, minted wZION na Base, daily volume | P1 |
| **Validator Status** | 3/5 online indicator, last signature timestamp | P1 |
| **Alert Panel** | Warning při vysokém slippage nebo low liquidity | P2 |

**API Endpoints (nové v `dashboard/app.py`):**
```python
GET /api/bridge/status        → {online, last_block, volume_24h}
GET /api/bridge/chains       → [{chain_id, name, enabled, liquidity}]
POST /api/bridge/estimate    → {amount, from_chain, to_chain, fee, eta}
GET /api/bridge/history      → [{tx_hash, from, to, amount, status, timestamp}]
GET /api/bridge/validators   → [{address, online, last_signature}]
```

### 3.2 Website (Next.js, APP&WEB/website-v2.9)

**Nová stránka: `/bridge`**

| Funkce | Popis | Priorita |
|--------|-------|----------|
| **Bridge Widget** | React komponenta pro cross-chain transfer (podobná Stargate/Across) | P0 |
| **Chain Selector** | Dropdown s logy (Base, Arbitrum, BSC, Polygon) + ZION L1 | P0 |
| **Token Selector** | ZION ↔ wZION s real-time exchange rate | P0 |
| **Fee Estimate** | Dynamický výpočet gas + bridge fee | P1 |
| **Transaction Tracker** | Step-by-step progress (1. Lock → 2. Confirm → 3. Mint) | P1 |
| **Explorer Links** | Přímé odkazy na basescan.org / zion explorer | P1 |
| **Bridge Stats** | Total bridged, top chains, 24h volume | P2 |

**Components (nové):**
- `src/components/bridge/BridgeWidget.tsx` — hlavní widget
- `src/components/bridge/ChainSelector.tsx` — výběr chainů
- `src/components/bridge/TokenInput.tsx` — amount input s max
- `src/components/bridge/TxTracker.tsx` — step tracker
- `src/components/bridge/FeeEstimate.tsx` — fee calculator
- `src/app/bridge/page.tsx` — stránka

### 3.3 Desktop Agent (Electron)

**Nová záložka v docku: "Bridge"**

| Funkce | Popis | Priorita |
|--------|-------|----------|
| **Mini Bridge Widget** | Zjednodušená verze pro rychlý transfer | P1 |
| **Notification** | Toast při dokončení transferu | P2 |
| **History** | Lokální storage pro bridge history | P2 |

---

## 4. Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Website     │  Dashboard   │ Desktop Agent│  CLI (zion)    │
│  /bridge     │  :8766       │  (Electron)  │  bridge deploy │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────────┘
       │              │              │              │
       └──────────────┴──────┬───────┴──────────────┘
                             │
                    ┌─────────▼─────────┐
                    │  Bridge REST API  │
                    │  (zion-bridge)    │
                    └─────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
   ┌─────▼─────┐     ┌──────▼──────┐    ┌──────▼──────┐
   │  L1 Watcher│     │  EVM Watcher│    │  Relayer    │
   │  (Rust)    │     │  (Rust)     │    │  (Rust)     │
   └─────┬─────┘     └──────┬──────┘    └──────┬──────┘
         │                  │                   │
   ┌─────▼─────┐     ┌──────▼──────┐    ┌──────▼──────┐
   │  ZION L1  │     │  Base Sepolia│   │  Validator  │
   │  Node     │     │  / Mainnet   │   │  3/5 Multisig│
   └───────────┘     └──────────────┘   └─────────────┘
```

---

## 5. Test Matrix

### 5.1 Unit Tests (Rust)
- `cargo test -p zion-bridge` — 157 testů (current)
- Target: **200+ testů** po bridge completion

### 5.2 Integration Tests
- **Happy path:** L1 → Base mint → wZION transfer → Base burn → L1 unlock
- **Failure modes:** Insufficient gas, invalid signature, timeout, reorg
- **Edge cases:** Max daily limit, timelock, duplicate nonce

### 5.3 E2E Tests
- **Sepolia:** Full roundtrip < 5 minut
- **Mainnet:** Full roundtrip < 10 minut
- **Stress:** 100 parallel transfers

### 5.4 UI Tests
- Dashboard: Manual QA checklist
- Website: Cypress/Playwright E2E
- Desktop: Electron automated test

---

## 6. Launch Checklist

### Pre-Mainnet (Base Sepolia)
- [ ] C1: Bridge source verified on BaseScan
- [ ] C2: wZION source verified on BaseScan
- [ ] C3: BridgeValidator 3/5 deployed
- [ ] R1: End-to-end test passed
- [ ] R2: 3/5 threshold signing works
- [ ] S1: Validator keys in HSM
- [ ] UI: Dashboard Bridge tab functional
- [ ] UI: Website /bridge page deployed

### Mainnet Launch
- [ ] C5: Base Mainnet deploy
- [ ] C4: Contract audit passed
- [ ] S4: Anomaly detection active
- [ ] S5: Bug bounty live
- [ ] R5: Monitoring dashboards active
- [ ] R6: Auto-retry tested

---

*Generated with Devin — based on live Base Sepolia blockchain verification.*
