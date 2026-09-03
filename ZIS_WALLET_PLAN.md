# ZIS Wallet — Simplified Architecture

> **Goal:** ZIS funguje jako multichain wallet (jako Exodus) — jedna identita, všechny chainy, swap, staking, send/receive.
> **Created:** 2026-09-03
> **Supersedes:** `docs/3.2/ZionDexZis.md` (over-engineered, 8 fází, vlastní AMM)
> **Philosophy:** Minimal contracts, use existing infra, ship fast.

---

## Princip

```
Uživatel se přihlásí přes ZIS (Google / Ed25519 / SIWE)
         │
         ▼
ZIS → L2 multichain API
         │
         ├── Derivace adres (EVM, Solana, Stellar, ZION L1)
         ├── Deposit watcher → ledger credit
         ├── Swap → Uniswap V3 (ne 1inch API)
         ├── Withdraw → on-chain transfer
         ├── Stake → ZIONStaking contract
         └── Bridge → ZIONBridge (L1↔L2)
```

**Žádný vlastní AMM. Žádné custom bridge kontrakty per chain. Žádný governance/treasury/farm.**

---

## 1. Komponenty (už existují)

| Komponenta | Co dělá | Stav |
|-----------|---------|------|
| **ZIS** (`APP&WEB/identity/`) | Auth (Google/Ed25519/SIWE), JWT session, wallet API proxy | ✅ Deployed na Edge |
| **L2 Multichain** (`V31/L2/multichain/`) | Adresy, ledger, deposits, swaps, withdrawals, reconciliation | ✅ Implementováno |
| **Wallet SDK** (`APP&WEB/zion-wallet-sdk/`) | TS SDK — WalletManager, ZisClient, MultichainWalletClient | ✅ Build ready |
| **Web UI** (`/wallet/multichain`) | React — balanc, swap, send, receive | ✅ Implementováno |
| **Uniswap V3** (external) | wZION/WETH pool s likviditou | ✅ Aktivní |
| **ZIONBridge** (contract) | L1↔L2 bridge, 5/5 multisig | ✅ Deployed, verified |
| **ZIONStaking** (contract) | 12% APR staking | ✅ Deployed, verified |

---

## 2. Uživatelské toky

### 2a. Login

1. Uživatel otevře `app.zionterranova.com/wallet/multichain`
2. Klikne "Sign in with Google" (nebo Ed25519 / SIWE)
3. ZIS vydá JWT cookie (`.zionterranova.com` domain, 7d expiry)
4. Web UI zavolá `GET /api/wallet/snapshot` → L2 vrátí balanc + adresy

### 2b. Receive (deposit)

1. UI zobrazí deposit adresu pro každý chain (EVM, Solana, ZION L1)
2. Uživatel pošle tokeny na tuto adresu
3. L2 `DepositWatcher` detekuje transfer po finality (EVM: 12 blocks, ZION: 10 blocks)
4. L2 `Ledger.credit(user, asset, amount)` — balanc aktualizován
5. UI auto-refresh ukáže nový balanc

### 2c. Swap

1. Uživatel vybere "from token" a "to token" + amount
2. UI zavolá `POST /api/swap/execute-v2` s ZIS JWT
3. L2 `SwapExecutor`:
   - Debit `from` asset z ledger
   - Quote přes Uniswap V3 QuoterV2
   - Execute přes SwapRouter02 (L2 drží klíče, podepíše tx)
   - Credit `to` asset do ledger
4. UI ukáže výsledek

**Žádný vlastní AMM.** Uniswap V3 má už wZION/WETH pool.

### 2d. Send (withdraw)

1. Uživatel zadá recipient adresu + amount
2. UI zavolá `POST /api/wallet/withdraw` s ZIS JWT
3. L2 `WithdrawalProcessor`:
   - Debit z ledger
   - Pošle on-chain tx (L2 drží hot wallet klíče)
4. UI ukáže tx hash

### 2e. Stake

1. Uživatel vybere amount wZION
2. UI zavolá `POST /api/staking/stake` s ZIS JWT
3. L2 zavolá `ZIONStaking.stake(amount)` z hot wallet
4. Staking rewards se accrue na contractu
5. Unstake: `ZIONStaking.queueUnstake(amount)` → cooldown → `unstake()`

### 2f. Bridge (L1↔L2)

1. **L1→L2:** Uživatel pošle ZION na L1 bridge vault s memo `BRIDGE:base:<evm_address>` → validators mint wZION
2. **L2→L1:** Uživatel zavolá `ZIONBridge.burn(amount, l1_address)` → validators unlock L1 ZION

---

## 3. Custodial vs Non-custodial

### Web wallet = CUSTODIAL (jednoduché UX)
- L2 drží `wallet_keyring` seed → derivuje per-user adresy
- Uživatel nepotřebuje extension ani seed phrase
- ZIS auth = přístup k peněžence
- **Riziko:** pokud L2 seed unikne, všichni uživatelé ztratí peníze
- **Mitigace:** HSM / Vault pro seed, rate limiting, audit log, reconciliation

### Desktop/mobile app = NON-CUSTODIAL (plná kontrola)
- `zion-wallet-sdk` `WalletManager` — seed v app, encrypted locally
- ZIS jen pro identity sync (linked addresses, display name)
- Uživatel podepisuje txs lokálně
- **Žádný custodial risk**

### Doporučení
- **Fáze 1:** Web wallet custodial (rychlé ship, jednoduché UX)
- **Fáze 2:** Desktop app non-custodial (pro power users)
- Obě varianty používají stejné L2 API (custodial endpoints + non-custodial proxy)

---

## 4. Co SMAZAT z současného kódu

### Kontrakty (označit deprecated, nesmazat — jsou na mainnetu)

| Co | Akce |
|----|------|
| `V31/contracts/ZIONDex/` (4 .sol soubory) | Označit deprecated v README |
| `APP&WEB/MarketPlace/contracts/` (NFT + marketplace) | Označit deprecated |
| `V31/L2/multichain/contracts/non-evm/` (7 custom kontraktů) | Označit deprecated — použít existující standardy |

### Kód (refactor později)

| Co | Proč |
|----|------|
| `V31/L2/multichain/src/swap/dex.rs` (ZIONDex router) | Swap executor použije Uniswap V3 přímo |
| `V31/contracts/ZIONDex/*.js` (deploy/liquidity skripty) | Nepotřebujeme |
| `defi-contracts.ts` ZIONDex entries | Označit deprecated |

### Dokumentace (nahradit)

| Soubor | Nahradit čím |
|--------|-------------|
| `docs/3.2/ZionDexZis.md` | Tento soubor (`ZIS_WALLET_PLAN.md`) |
| `V31/contracts/ZIONDex/README.md` | Deprecation notice |
| `docs/3.1/REPORTS/ZIONDEX_OPERATOR_RUNBOOK.md` | Deprecation notice |

---

## 5. Co CHYBÍ (implementace)

### Hotovo ✅
- ZIS auth (Google/Ed25519/SIWE) + JWT
- L2 multichain: derivace adres, ledger, deposit watcher, withdrawal processor
- L2 swap executor (přes DexRouter — potřeba přepnout na Uniswap V3)
- Web UI `/wallet/multichain` (balanc, send, receive)
- Wallet SDK (WalletManager, ZisClient, MultichainWalletClient)
- ZIONBridge contract (deployed, verified)
- ZIONStaking contract (deployed, verified)
- Uniswap V3 wZION/WETH pool (aktivní)

### Chybí 🔴

| # | Co | Priorita | Effort |
|---|----|---------|--------|
| 1 | **Swap executor → Uniswap V3** — přepnout z vlastního AMM na Uni V3 SwapRouter02 | High | 2d |
| 2 | **Staking UI** — `/wallet/staking` page se stake/unstake/claim | High | 1d |
| 3 | **Bridge UI** — `/wallet/bridge` page (L1→L2 deposit instrukce, L2→L1 burn) | Medium | 1d |
| 4 | **Solana deposit watching** — L2 adapter pro Solana SPL transfers | Medium | 2d |
| 5 | **Wallet SDK npm publish** — nový npm token, publish `zion-wallet-sdk` | Medium | 30min |
| 6 | **Desktop app** — Electron + zion-wallet-sdk (non-custodial) | Low | 1-2t |
| 7 | **Mobile app** — React Native + zion-wallet-sdk | Low | 2-3t |
| 8 | **HSM/Vault pro L2 seed** — security hardening | Low | 1t |

---

## 6. Architektura (technická)

### ZIS (Node.js / Fastify)
```
POST /api/auth/verify/google     → JWT cookie
POST /api/auth/verify/ed25519    → JWT cookie
POST /api/auth/verify/siwe       → JWT cookie
GET  /api/session                → { user, linkedAddresses }
POST /api/wallet/derive          → L2 /v1/wallet/derive (proxy)
GET  /api/wallet/snapshot        → L2 /v1/wallet/snapshot (proxy)
POST /api/wallet/withdraw        → L2 /v1/wallet/withdraw (proxy)
POST /api/swap/execute-v2        → L2 /v1/swap/execute-v2 (proxy)
POST /api/staking/stake          → L2 /v1/staking/stake (proxy)
POST /api/staking/unstake        → L2 /v1/staking/unstake (proxy)
```

### L2 Multichain (Rust / warpd)
```
GET  /v1/wallet/snapshot         → { addresses, balances } per user
POST /v1/wallet/derive           → derive deposit address for chain
POST /v1/wallet/withdraw         → send tokens on-chain
POST /v1/swap/execute-v2         → debit ledger → Uni V3 swap → credit ledger
POST /v1/staking/stake           → ZIONStaking.stake() from hot wallet
POST /v1/staking/unstake         → ZIONStaking.queueUnstake() + unstake()
GET  /v1/admin/reconciliation    → on-chain vs ledger diff report
```

### Web UI (Next.js)
```
/wallet/multichain    → balanc, send, receive, swap
/wallet/staking       → stake, unstake, claim rewards
/wallet/bridge        → L1↔L2 bridge instructions + status
```

### Wallet SDK (TypeScript)
```typescript
import { WalletManager, ZisClient, MultichainWalletClient } from 'zion-wallet-sdk';

// Non-custodial (desktop/mobile)
const wm = new WalletManager();
const wallet = await wm.create('password');
const zis = new ZisClient({ baseUrl: 'https://auth.zionterranova.com' });
await zis.linkAddress(wallet.ed25519Address, wallet.signChallenge);

// Custodial (web)
const mc = new MultichainWalletClient({ baseUrl: '/api' });
const snapshot = await mc.getSnapshot();
await mc.swap({ from: 'wZION', to: 'WETH', amount: '100' });
await mc.withdraw({ asset: 'wZION', amount: '50', recipient: '0x...' });
```
