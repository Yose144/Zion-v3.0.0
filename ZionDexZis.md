# ZionDex + ZIS Multichain Wallet — komplexní implementační plán

> **Status (2026-08-23):** Fáze 0–3 implementovány a `cargo test -p zion-multichain` prochází 577 testy. Fáze 4+ jsou pending.
>
> Cíl: převést `ZionDex` z in-memory AMM quote engine na skutečně E2E fungující
> multichain DEX a vytvořit v rámci ZIS vlastní `Multichain Wallet`, která
> spravuje uživatelské vklady, výběry a salda napříč L1 (ZION), EVM (Base,
> Arbitrum, …), Bitcoin a Lightning.
>
> Tento dokument je živý plán v rootu repa; změny se reflektují přímo sem
> a každá fáze má explicitní akceptační kritéria.

---

## 1. Současný stav a co chybí

### 1.1 Co už dnes funguje

| Část | Stav | Zdroj |
|------|------|-------|
| `quote` a `quote/multi` | reálně počítá cesty z poolů v `DexRouter` | `V31/L2/multichain/src/swap/dex.rs:166` |
| UI výběr chainů/tokenů | widget zobrazuje BTC/Lightning/ZION/EVM tokeny | `APP&WEB/website-v2.9/src/components/dex/` |
| ZIS auth proxy | `zion_session` cookie se přeposílá z webu přes Next.js do multichain | `APP&WEB/website-v2.9/src/app/api/swap/[...path]/route.ts` |
| Chain adapters | `BitcoinAdapter`, `EvmAdapter`, `ZionL1Adapter` umí reálně posílat tx, číst zůstatky a sledovat deposit events | `V31/L2/multichain/src/chain/adapters/` |
| ZIS linked addresses | uživatel může mít `zion-l1` nebo `evm` adresy, bitcoin podpora není dořešena | `APP&WEB/identity/src/routes/auth.ts` |
| Intent / solver engine | existuje `IntentEngine`, `Executor` a `Bridge`, ale cross-chain execution je vypnutá | `V31/L2/multichain/src/swap/dex/intent_engine.rs:201`, `V31/L2/multichain/src/swap/dex/executor.rs:34` |

### 1.2 Proč dnešní `/v1/swap/execute` není E2E

`MultichainService::dex_swap` (`V31/L2/multichain/src/service.rs:320`) volá pouze
`DexRouter::execute` (`V31/L2/multichain/src/swap/dex.rs:302`), který upraví
**in-memory rezervy** poolu, ale **nikam neposílá tokeny**. Uživatel dostane
odpověď, že swap proběhl, ale jeho peněženka se nezmění.

Pro skutečný E2E swap potřebujeme:

1. **Místo, kam uživatel vloží tokeny** (deposit) — per-user deposit adresy.
2. **Účetnictví těchto vkladů** — interní ledger.
3. **Vykonávací vrstvu**, která odebere `from` tokeny z účtu uživatele,
   přičte mu `to` tokeny a reálně pohne tokeny na chainu.
4. **Výběrový (withdraw) kanál**, který doručí tokeny z L2 zpatky na chain
   uživatele.

To je jádro nového **ZIS Multichain Wallet**.

---

## 2. Navrhovaná architektura

### 2.1 Vysoká úroveň

```
                    ┌─────────────────┐
                    │  ZIS (Identity) │
                    │  user/session   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌─────────────┐ ┌──────────────┐ ┌─────────────┐
     │   Web 2.9   │ │  ZIS Wallet  │ │ Multichain  │
     │   UI/Widget │ │  API         │ │   Service   │
     └──────┬──────┘ └──────┬───────┘ └──────┬──────┘
            │               │                │
            └───────────────┴────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │DexRouter │   │ Multichain│   │Adapters  │
      │(AMM)     │   │Wallet     │   │(BTC/EVM/ │
      │          │   │Ledger     │   │ ZION)    │
      └──────────┘   └──────────┘   └──────────┘
```

**ZIS Multichain Wallet** má dvě role:

1. **Deposit wallet** — per-user adresy odvozené z L2 keyringu, na které
   uživatel posílá tokeny. Po potvrzení vkladu se mu připíše interní saldo.
2. **Linked wallet** — uživatelem ověřené vlastní adresy, které mohou sloužit
   jako cíl pro výběry nebo pro trustless HTLC swap.

**ZionDex** zůstává AMM, ale dočasně ho posíláme servisní vrstvou
`SwapExecutor`, která spravuje vlastnictví tokenů přes interní ledger.

### 2.2 Rozhodnutí: custodial vs non-custodial

Plán předpokládá **fázovaný přístup**:

- **Fáze 1–4**: L2 drží privátní klíče per-user deposit peněženek (BIP39
  derivace). Je to nejjednodušší cesta k funkčnímu E2E DEX s tím, že klíče
  jsou odvozeny odděleně od bridge master klíče a per-user.
- **Fáze 5+**: volitelně přidáme **HTLC / bridge intent execution**, které
  umožní ne-custodial swap mezi dvěma externími peněženkami uživatelů.

> Bezpečnostní poznámka: custodial model znamená, že ztráta/únik L2 seedu
> ohrožuje všechny uživatele. Proto plán klade velký důraz na separaci klíčů,
> HSM/konfiguraci a konsenzus validátorů pro cross-chain bridge.

---

## 3. Datový model

### 3.1 Nové tabulky ve `APP&WEB/shared/prisma/schema.prisma`

```prisma
// Přiřazený BIP44 účet v L2 keyringu (auto-increment, unikátní pro user).
model MultichainWallet {
  id            String   @id @default(cuid())
  userId        String   @unique
  accountIndex  Int      @unique  // odvozeno od user id pro keyring
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  addresses     MultichainWalletAddress[]
  balances      MultichainBalance[]
  orders        DexOrder[]
}

// Depositní a withdraw adresy pro každý chain.
model MultichainWalletAddress {
  id          String   @id @default(cuid())
  walletId    String
  chainType   String   // "zion-l1" | "evm" | "bitcoin" | "lightning" | "solana" ...
  chainId     String?  // "base" | "bitcoin" | ...
  address     String
  purpose     String   @default("deposit") // "deposit" | "withdraw" | "linked"
  publicKey   String?  // pro zion-l1 / ed25519
  path        String   // např. "m/44'/60'/{account}'/0/0"
  verifiedAt  DateTime @default(now())
  isExternal  Boolean  @default(false) // true = user vlastní klíče (linked)

  wallet      MultichainWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)

  @@unique([walletId, chainType, chainId, purpose])
}

// Interní saldo uživatele na L2 — "to, co může proswapovat".
model MultichainBalance {
  id        String   @id @default(cuid())
  walletId  String
  assetKey  String   // např. "zion_l1:ZION" nebo "bitcoin:BTC"
  amount    BigInt
  updatedAt DateTime @updatedAt

  wallet    MultichainWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)

  @@unique([walletId, assetKey])
}

// Rozšířit existující DexOrder o vazbu na wallet.
model DexOrder {
  ...
  walletId    String?
  wallet      MultichainWallet? @relation(fields: [walletId], references: [id])
  fromAsset   String
  toAsset     String
  amountIn    BigInt
  amountOut   BigInt?
  minAmountOut BigInt?
  feeBps      Int
  routeJson   Json?
  txHash      String?
  withdrawTxHash String?
  status      String   @default("pending") // pending | quoted | executed | settled | failed | withdrawn
}
```

### 3.2 Lokální multichain SQLite (`V31/L2/multichain/src/db.rs`)

Přidat tabulky pro rychlý runtime:

```sql
CREATE TABLE IF NOT EXISTS wallet_accounts (
    user_id TEXT PRIMARY KEY,
    account_index INTEGER UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_addresses (
    address TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    chain_id TEXT,
    purpose TEXT NOT NULL,
    public_key TEXT,
    derivation_path TEXT NOT NULL,
    is_external INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_balances (
    user_id TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    amount TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, asset_key)
);

CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chain TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    amount TEXT NOT NULL,
    confirmations INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT "pending",
    created_at TEXT NOT NULL,
    credited_at TEXT
);

CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    amount TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    tx_hash TEXT,
    status TEXT NOT NULL DEFAULT "pending",
    created_at TEXT NOT NULL,
    sent_at TEXT
);
```

---

## 4. Klíčové moduly a jejich změny

### 4.1 `V31/L2/multichain/src/multichain_wallet/` — nový modul

Vytvořit nový adresář:

```
V31/L2/multichain/src/multichain_wallet/
├── mod.rs          // veřejné API
├── ledger.rs       // credit/debit/get balance
├── derivation.rs   // per-user adresy z Keyring
├── deposits.rs     // sledování deposit a potvrzování
├── withdrawals.rs  // odesílání výběrů
└── types.rs        // WalletAccount, WalletAddress, Balance
```

**Ledger** (`ledger.rs`):

- Klíč `user_id:asset_key`.
- `credit(user, asset, amount)` — voláno po potvrzeném depositu.
- `debit(user, asset, amount)` — voláno při swapu nebo withdraw.
- `balance(user, asset) -> Amount`.
- Musí být thread-safe (tokio::sync::RwLock/Mutex + persist do DB).

**Derivation** (`derivation.rs`):

- Každý ZIS `userId` dostane při prvním použití `account_index` (auto
  increment v ZIS DB nebo hash user id → u32 s kontrolou kolize).
- Pro EVM: `m/44'/60'/{account_index}'/0/{index}`.
- Pro Bitcoin: `m/84'/{coin_type}'/{account_index}'/0/{index}`.
- Pro ZION L1: `m/44'/9999'/{account_index}'/0/{index}`.
- Tyto adresy vrací `/v1/wallet/derive`.

### 4.2 `V31/L2/multichain/src/swap/executor.rs` — nový swap executor

Místo `service.rs:326` používat `SwapExecutor`, který:

1. Načte uživatele z `ZisUser` extension.
2. Načte nebo odvodí `MultichainWallet` pro `user_id`.
3. Zkontroluje `ledger.balance(user, from) >= amount`.
4. Zavolá `DexRouter::quote_multi` a zvolí nejlepší cestu.
5. Ověří `min_amount_out` / slippage.
6. Vytvoří `DexOrder` record se statusem `pending`.
7. Pro každý hop:
   - **Same-chain AMM hop**: `DexRouter::execute` (rezervy) + update order.
   - **Bridge hop**: `Bridge::submit` se správným `Transfer`.
   - **Final delivery**: vypočítaný výstup přičte do `ledger` nebo rovnou
     odešle `withdrawal` na adresu uživatele.
8. Uloží order jako `executed`, vrátí `tx_hash` / `out`.

### 4.3 `V31/L2/multichain/src/service.rs`

Přidat metody:

```rust
pub async fn wallet_for_user(&self, user: &ZisUser) -> MultichainResult<MultichainWalletAccount>;
pub async fn wallet_balance(&self, user_id: &str, asset: &Asset) -> MultichainResult<Amount>;
pub async fn deposit_address(&self, user: &ZisUser, chain: ChainId) -> MultichainResult<Address>;
pub async fn execute_swap(...) -> MultichainResult<DexOrder>;
pub async fn withdraw(...) -> MultichainResult<Hash>;
```

Přepsat `dex_swap`, aby místo in-memory AMM používal `SwapExecutor`.

### 4.4 `V31/L2/multichain/src/server.rs` — nové endpointy

```
GET  /v1/wallet/chains              // supported chains + assets
POST /v1/wallet/derive              // { chain } -> { address, public_key, path }
GET  /v1/wallet/balance             // ?asset=... nebo vše
POST /v1/wallet/deposit             // (interní, voláno watcherem)
POST /v1/wallet/withdraw            // { asset, amount, recipient }
POST /v1/swap/execute-v2            // { from, to, amount, min_amount_out, recipient? }
GET  /v1/swap/order/:id             // stav orderu
POST /v1/swap/intent                // ponechat, ale provázat s wallet
```

### 4.5 `V31/L2/multichain/src/chain/adapters/` — rozšířit pro sledování depositů

- `BitcoinAdapter::watch_events` už sleduje `deposit_address`;
  potřebujeme, aby uměl sledovat **seznam adres** (per-user).
- Přidat `watch_addresses(&self, addresses: &[Address]) -> Vec<DepositEvent>`.
- `EvmAdapter`: sledovat `Transfer` eventy ERC-20 tokenů na seznam adres.
- `ZionL1Adapter`: použít `getUtxos` pro seznam adres.

### 4.6 `V31/L2/multichain/src/swap/dex.rs` — rozšířit AMM pro bridge a wrapped tokeny

- `DexRouter::add_bridge_pool` už existuje (`swap/dex.rs:283`).
- Musíme bootstrappovat bridge registry: např. `ZION` ↔ `wZION` na Base,
  `USDC` ↔ `wUSDC`, atd.
- `Aggregator` (`swap/dex/aggregator.rs`) je skoro hotový — zapojit ho do
  `SwapExecutor` místo přímého `DexRouter`.

### 4.7 `APP&WEB/identity` — ZIS wallet API

Nové routy v `src/routes/wallet.ts`:

```
GET  /api/wallet/me                  // seznam chainů, adres a sald
POST /api/wallet/derive              // vygenerovat deposit adresu pro chain
POST /api/wallet/link                // link externí adresy (pro withdraw)
GET  /api/wallet/orders              // historie swapů
GET  /api/wallet/deposits            // historie vkladů
GET  /api/wallet/withdrawals         // historie výběrů
POST /api/wallet/withdraw            // založit withdraw request
```

Rozšířit `ZisChainType` (`APP&WEB/shared/zis-client.ts:105`) o `bitcoin`,
`lightning`, `solana`, atd.

Rozšířit `/api/auth/link` (`APP&WEB/identity/src/routes/auth.ts:136`) aby:
- podporoval `bitcoin` a `lightning` s ověřením podpisu (BIP-322 / LNURL),
- nebo umožnil watch-only link s manuálním potvrzením pro withdraw.

### 4.8 `APP&WEB/website-v2.9` — UI

1. **Nový context** `MultichainWalletContext.tsx`:
   - načítá balances, deposit adresy, orders.
2. **Rozšířit `CrossChainSwapWidget.tsx`**:
   - zobrazit aktuální balance nad vstupním tokenem,
   - tlačítka `Deposit` / `Withdraw` vedle výběru tokenu,
   - po potvrzení swapu zobrazit order ID a tx hash.
3. **Nová stránka `/wallet/multichain`** (nebo přidat do `/wallet`):
   - seznam adres, balances, orders, deposits, withdrawals.
4. **API proxy** (`src/app/api/swap/[...path]/route.ts`) doplnit o nové
   endpointy `/v1/wallet/*` a `/v1/swap/execute-v2`.

---

## 5. Fáze implementace

### Fáze 0 — Příprava a bezpečnost (1 týden)

1. **Oddělit L2 wallet seed od bridge seedu**.
   - Zavést `ZION_WALLET_MNEMONIC` / `ZION_WALLET_SEED` env, nerecyklovat
     `WARP_MNEMONIC`.
   - `Keyring` zůstává, ale wallet derivace má vlastní instanci.
2. **Připravit testnet/alpha prostředí**.
   - Spustit `zion-multichain` na testovacím datasetu (in-memory DB nebo
     separátní `multichain-wallet-test.db`).
3. **Definovat canonical asset IDs a wrapped mapping**:
   - `zion_l1:ZION`, `base:wZION` (wrap 1:1, 6→18 decimals).
   - `base:USDC`, `arbitrum:USDC`, atd.
   - `bitcoin:BTC`, `lightning:BTC`.

**Akceptační kritérium**: service startuje s odděleným wallet seedem a
nemění existující bridge/HTLC funkcionalitu.

### Fáze 1 — ZIS datový model a per-user derivace (1–2 týdny)

1. Migrovat Prisma schema (`APP&WEB/shared/prisma/schema.prisma`):
   - `MultichainWallet`, `MultichainWalletAddress`, `MultichainBalance`.
   - Rozšířit `DexOrder` o `walletId`, `routeJson`, `withdrawTxHash`.
2. Vytvořit `db-sync.ts`/`prisma db push` a ověřit na dev DB.
3. V `zion-multichain` vytvořit `multichain_wallet/derivation.rs` a metody
   `wallet_for_user`, `deposit_address`.
4. Přidat `/v1/wallet/derive` endpoint, který vrací per-user adresu.
5. Test: pro dva různé ZIS uživatele se vygenerují různé adresy pro Base,
   Bitcoin, ZION.

**Akceptační kritérium**: volání `/v1/wallet/derive` pro `base` a `bitcoin`
vrací unikátní adresy per user a tyto adresy jsou persistovány v ZIS i
multichain DB.

### Fáze 2 — Sledování deposit a ledger (2 týdny)

1. Upravit `ChainAdapter` trait (`chain/adapter.rs`):
   - Přidat `watch_addresses(&self, &[Address]) -> Vec<DepositEvent>`.
   - Implementovat v `BitcoinAdapter`, `EvmAdapter`, `ZionL1Adapter`.
2. Vytvořit `multichain_wallet/deposits.rs`:
   - Periodicky (např. každých 30 s) zavolá `watch_addresses` pro všechny
     známé deposit adresy.
   - Po dosažení min. konfirmací vytvoří `deposit` record a zavolá
     `ledger.credit(user, asset, amount)`.
3. Vytvořit `multichain_wallet/ledger.rs`:
   - `credit` / `debit` / `balance`.
   - Perzistence do SQLite `wallet_balances`.
4. Přidat `/v1/wallet/balance` a `/v1/wallet/deposits`.
5. Připravit background tokio task v `service.rs`, který spustí watcher.

**Akceptační kritérium**: testovací vklad na Bitcoin adresu uživatele se po
potvrzení objeví v `/v1/wallet/balance` jako `bitcoin:BTC` saldo.

### Fáze 3 — Swap executor a E2E AMM (2 týdny)

1. Vytvořit `swap/executor.rs` (nebo `swap/swap_executor.rs`):
   - Načíst uživatele, balance, quote.
   - Pro `Dex` hop volat `DexRouter::execute`.
   - Vést `DexOrder` a volat ledger `debit`/`credit`.
2. Upravit `/v1/swap/execute` (`server.rs:534`) na nový flow:
   - Přijme `from`, `to`, `amount`, `min_amount_out`, `recipient`.
   - Vrátí `order_id`, `out`, `status`, `tx_hash`.
3. Upravit `service.rs::dex_swap` na volání `SwapExecutor`.
4. Pro jednoduché same-chain EVM swapy (wZION → USDC na Base):
   - Uživatel musí mít na interním účtu wZION.
   - Executor debetuje wZION, kredituje USDC, posílá USDC z EVM hot wallet
     na uživatelovo withdraw address (nebo nechává na interním účtu).
5. Základní `min_amount_out` / slippage ochrana.

**Akceptační kritérium**: po zavolání `/v1/swap/execute` se skutečně pohne
ERC-20 token z L2 hot wallet na uživatelovo withdraw address a objeví se
on-chain tx hash.

### Fáze 4 — Výběry (withdrawals) (1 týden)

1. Vytvořit `multichain_wallet/withdrawals.rs`:
   - `request_withdraw(user, asset, amount, recipient)` vytvoří pending
     record, odebere z ledgeru.
   - `process_withdraw` zavolá `ChainAdapter::send_payment` a uloží tx hash.
2. Přidat `/v1/wallet/withdraw`.
3. UI: tlačítko withdraw v widgetu a na `/wallet/multichain`.

**Akceptační kritérium**: uživatel může vybrat USDC na Base na vlastní
adresu a tx se objeví na blockchainu.

### Fáze 5 — Cross-chain DEX a ZION/BTC pool (2 týdny)

1. **Wrapped asset registry** v `DexRouter`:
   - Bridge edge `zion_l1:ZION` ↔ `base:wZION`.
   - Bridge edge `bitcoin:BTC` ↔ `zion_l1:BTC`? (pokud chceme wrapovat BTC
     na L1; jinak použijeme `zion_l1:ZION` ↔ `bitcoin:BTC` jako nativní
     pool, což vyžaduje, že L2 drží BTC a ZION likviditu).
2. Vytvořit per-user **deposit adresy pro všechny chainy** v cestě.
3. V `SwapExecutor` zpracovat cestu s bridge hopy:
   - User balance se strhne ve zdrojovém assetu.
   - Bridge se zavolá pro přesun mezi chainy (např. lock ZION na L1 → mint
     wZION na Base).
   - Následný AMM hop na cílovém chainu.
   - Výstup se buď kredituje na cílový asset interně, nebo rovnou vybere.
4. Pro `ZION/BTC` pool z Fáze 0:
   - Uživatel pošle ZION na svou L1 deposit adresu.
   - Executor strhne `zion_l1:ZION`, kreditne `bitcoin:BTC`, odešle BTC z
     L2 hot wallet na uživatelovo withdraw address.
   - Opačný směr: user pošle BTC, executor strhne `bitcoin:BTC`, kreditne
     `zion_l1:ZION`, odešle ZION z L1 hot wallet.

**Akceptační kritérium**: swap `10 000 ZION → BTC` a zpět `BTC → ZION` projde
E2E s reálnými on-chain tx.

### Fáze 6 — HTLC / non-custodial path (volitelná, 2+ týdny)

1. Povolit `is_bridge = true` v `settle_and_execute`
   (`swap/dex/intent_engine.rs:201` je momentálně tvrdý reject).
2. Dát `Executor`ovi možnost volit mezi custodial a HTLC execution.
3. Umožnit uživateli propojit externí adresu a pro swapy nad ní podepsat
   off-chain intent; executor pak použije HTLC místo L2 ledgeru.
4. Implementovat `HTLC` flow pro EVM ↔ ZION L1
   (`swap/htlc.rs`, `chain/adapters/evm.rs:328`, `chain/adapters/zion_l1.rs:205`).

**Akceptační kritérium**: trustless swap mezi dvěma externími peněženkami
přes HTLC prochází bez toho, aby L2 drželo tokeny.

### Fáze 7 — UI, testování, tvrdé hardening (2 týdny)

1. `MultichainWalletContext`, `/wallet/multichain` stránka, rozšíření widgetu.
2. E2E testy (Cypress/Playwright) pro celý flow: deposit → swap → withdraw.
3. Reconciliation: porovnat on-chain zůstatky L2 hot walletů s interními
   saldy + pool reserves. Alarm při nesrovnalosti.
4. Rate limiting, audit log, revoke session odpojí pending operations.
5. Dokumentace pro operátory.

---

## 6. Bezpečnost a provoz

### 6.1 Klíče a custody

- **Nikdy nepoužívat stejný seed pro bridge a wallet**.
- Wallet seed by měl být v ideálním případě v HSM / HashiCorp Vault / AWS KMS
  s policy, která umožňuje podepisování jen z whitelisted IP a jen pro
  konkrétní user account.
- Pro production zvážit **Shamir secret sharing** nebo **multisig** pro
  velké hot-wallet zůstatky.
- Per-user derivation zabraňuje, že kompromit jednoho klíče neprovalí ostatní.

### 6.2 Konsenzus a bridge

- `Bridge` (`V31/L2/multichain/src/bridge/mod.rs`) má `BridgeConsensus`
  (`bridge/consensus.rs`). Pro cross-chain mint/burn musí být aktivní
  validator set a quorum; jinak bridge běží v single-node Alpha režimu.
- V production musí být `WARP_VALIDATOR_KEYS` nakonfigurován alespoň pro
  quorum validátorů.

### 6.3 Rezervy a solventnost

- Po každém swapu by se měl `DexRouter` rezervy shodovat s on-chain zůstatky
  L2 hot walletů. Rozdíl znamená chybu nebo útok.
- Denní reconciliation task a alert.
- Minimální hot-wallet threshold — při dosažení se spustí refill z cold
  storage / treasury.

### 6.4 Rate limit a nonces

- Swap execute musí mít rate limit per user.
- `DexOrder` musí obsahovat `nonce` pro ochranu proti replay.
- `nonce` se inkrementuje v `MultichainWallet`.

### 6.5 ZIS auth

- Každý `/v1/swap/*` a `/v1/wallet/*` endpoint musí být pod `resolve_zis_auth`
  (`V31/L2/multichain/src/zis_auth.rs:236`).
- API key alternativa (`Authorization: Bearer zis_...`) pro headless/CLI.

---

## 7. Soubory a kód, které se dotknou

### Backend (Rust)

- `V31/L2/multichain/src/service.rs` — nové metody, přepsat `dex_swap`.
- `V31/L2/multichain/src/server.rs` — nové routy.
- `V31/L2/multichain/src/db.rs` — nové tabulky.
- `V31/L2/multichain/src/zis_auth.rs` — ověřit user binding.
- `V31/L2/multichain/src/wallet/mod.rs` — per-user derivation path.
- `V31/L2/multichain/src/chain/adapter.rs` — trait rozšíření.
- `V31/L2/multichain/src/chain/adapters/bitcoin.rs` — multi-address watch.
- `V31/L2/multichain/src/chain/adapters/evm.rs` — ERC-20 transfer & watch.
- `V31/L2/multichain/src/chain/adapters/zion_l1.rs` — multi-address UTXOs.
- `V31/L2/multichain/src/swap/dex.rs` — bridge pool registry.
- `V31/L2/multichain/src/swap/dex/aggregator.rs` — zapojit do executoru.
- `V31/L2/multichain/src/swap/dex/executor.rs` — přidat ledger a settlement.
- `V31/L2/multichain/src/swap/dex/intent_engine.rs` — povolit bridge hops.
- `V31/L2/multichain/src/swap/htlc.rs` — non-custodial path.
- `V31/L2/multichain/src/multichain_wallet/` — **nový modul**.
- `V31/L2/multichain/Cargo.toml` — závislosti (pokud je potřeba).

### ZIS (Node/TS)

- `APP&WEB/shared/prisma/schema.prisma` — nové tabulky.
- `APP&WEB/identity/src/server.ts` — registrovat `walletRoutes`.
- `APP&WEB/identity/src/routes/wallet.ts` — **nové routy**.
- `APP&WEB/identity/src/routes/auth.ts` — podpora bitcoin/lightning linking.
- `APP&WEB/shared/zis-client.ts` — nové typy a funkce.

### Web (Next.js)

- `APP&WEB/website-v2.9/src/contexts/MultichainWalletContext.tsx` — **nový**.
- `APP&WEB/website-v2.9/src/components/dex/CrossChainSwapWidget.tsx` —
  balances, deposit/withdraw, order status.
- `APP&WEB/website-v2.9/src/app/api/swap/[...path]/route.ts` — nové cesty.
- `APP&WEB/website-v2.9/src/app/wallet/multichain/page.tsx` — **nová stránka**.
- `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` — token metadata pro BTC,
  Lightning, wZION mapping.

---

## 8. Akceptační kritéria pro celý projekt

1. **Quote E2E**: widget `/multichain#dex` vrací reálnou cenu pro
   `ZION/BTC`, `wZION/USDC`, `ZION → Base wZION`.
2. **Deposit E2E**: BTC vložený na per-user deposit adresu se po potvrzení
   objeví v interním saldu do 60 s.
3. **Swap E2E**: `/v1/swap/execute-v2` pro `wZION → USDC` na Base provede
   reálný ERC-20 transfer na uživatelovo withdraw address.
4. **Withdraw E2E**: uživatel může vybrat `bitcoin:BTC` na svou BTC adresu a
   tx se objeví na blockchainu.
5. **Cross-chain E2E**: swap `ZION → BTC` provede L1 ZION lock/výběr a BTC
   odeslání z L2 hot wallet.
6. **Solventnost**: interní ledger + pool reserves se denně shodují s
   on-chain zůstatky L2 hot walletů.
7. **Auth**: všechny operace vyžadují platný `zion_session` nebo `zis_` API
   klíč.
8. **Build**: `V31/L2/multichain` buildí bez chyb; `APP&WEB/website-v2.9`
   `npm run build` produkuje static pages úspěšně.

---

## 9. Okamžitě další kroky (co udělat jako první)

1. **Schválit** tento plán a rozhodnout, zda jít cestou custodial wallet
   (Fáze 1–5) nebo nejprve HTLC (Fáze 6).
2. **Vytvořit feature branch** `feat/ziondex-zis-multichain-wallet`.
3. **Začít Fází 0**: oddělit wallet seed, připravit dev/test DB.
4. **Rozdělit práci**:
   - Rust backend: multichain wallet + executor.
   - ZIS: schema + wallet API.
   - Web: MultichainWalletContext + UI.
5. **Nastavit E2E testovací prostředí** s testnet BTC/Base/ZION, aby se
   každá fáze dala ověřit reálnými transakcemi.

---

## 10. Poznámky a otevřené otázky

- **Custodial model**: chceme, aby L2 držela privátní klíče, nebo jen
  odvozovala adresy a podepisovala transakce na základě ZIS-approved
  operations? (Doporučeno: L2 drží klíče pro rychlost, ale HSM + audit.)
- **Bitcoin mainnet vs testnet**: `BitcoinAdapter` podporuje mainnet/testnet
  podle configu. Pro vývoj použít testnet nebo regtest.
- **Lightning**: `BitcoinAdapter` zatím neřeší LN invoices. Pro Lightning
  výběr bude potřeba integrace s LN node (LND/Core Lightning) nebo alespoň
  LNURL withdraw.
- **EVM token approval**: pro same-chain ERC-20 swap bez custody musí
  uživatel allowance; v našem custodial modelu to není nutné, L2 drží tokeny.
- **Wrapped token decimals**: `wZION` má 18 decimals, `ZION` na L1 má 6.
  Executor a bridge musí správně převádět.
- **BTC pool**: pro `ZION/BTC` pool existuje nativní pool v multichain DB
  (z dřívější práce). Tento pool bude sloužit jako AMM mezi L1 ZION a
  on-chain BTC likviditou držící se v L2 hot walletu.

---

*Poslední aktualizace: 2026-08-23 (Fáze 0–3 implementovány)*  
*Autor: Devin dle pokynu týmu*  
*Repozitář: root `ZionDexZis.md`*
