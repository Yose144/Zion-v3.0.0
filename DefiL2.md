# DeFi / L2 Validation Report

**Datum:** 2026-07-10
**Server:** Edge (62.171.141.136)
**Chain height:** 1395
**ZION verze:** 3.0.5

---

## 1. Edge Services — 11/11 active

| Service | Status | Poznámka |
|---------|--------|----------|
| zion-node | ✅ running | Primary node, height 1395 |
| zion-node2 | ✅ running | Follower (P2P sync) |
| zion-pool | ✅ running | Stratum port 8444 |
| zion-bridge | ✅ running | 4 EVM watchers (Base/Arb/OP/Avax) |
| zion-dao | ✅ running | Scan state height 1383 |
| zion-atomic-swap | ✅ running | L1 watcher height 1395, EVM watcher block 6370623 |
| zion-warp | ✅ running | L3 cross-chain relay |
| zion-oasis | ✅ running | L4 avatar hub |
| zion-free-world | ✅ running | L5 humanitarian |
| zion-issobella | ✅ running | L6 space layer |
| zion-dashboard | ✅ running | Python dashboard |

---

## 2. Bridge Status

### 2.1 EVM Watchers

| Chain | Status | RPC | Poznámka |
|-------|--------|-----|----------|
| Base (8453) | ✅ Active | mainnet.base.org | Finality 64 blocks, start 47687000 |
| Arbitrum (42161) | ✅ Active | arb1.arbitrum.io | Finality 10 blocks |
| Optimism (10) | ✅ Active | mainnet.optimism.io | Finality 10 blocks |
| Avalanche (43114) | ✅ Active | api.avax.network | Finality 12 blocks |
| BSC (56) | ⛔ Disabled | — | Public RPC odmítá `eth_getLogs` (rate limit) |
| Polygon (137) | ⛔ Disabled | — | Public RPC odmítá `eth_getLogs` (rate limit) |

**BSC/Polygon fix:** `enabled = false` v `/etc/zion/config/bridge-mainnet.toml`. Pro re-enable je potřeba Ankr API key (premium tier) nebo vlastní node.

**Base poll error fix:** Přidán 250ms inter-chunk delay v `evm_watcher.rs` — veřejné RPC endpointy rate-limitují při rychlém scanování více 1500-block chunků. Commit `fc267eb15`.

### 2.2 EVM Burns (L2→L1)

| Burn ID | Status | Chain | Amount | L1 Recipient |
|---------|--------|-------|--------|-------------|
| `0x250553f0...` | ✅ Completed | base | 100 wZION | zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 |

Burn úspěšně zpracován — unlock proběhl v bloku 891. Status v DB opraven na `Completed` (relayer ho při restartu revertoval na `Executing`, znova opraven).

### 2.3 L1 Locks (L1→EVM)

| TX Hash | Status | Height | Amount | Target | Recipient |
|---------|--------|--------|--------|--------|-----------|
| `a62d9350...` | ✅ Completed | 891 | 16,666,666.67 ZION | base | 0x9b5b9a6c... |

**Mint úspěšně proveden (2026-07-10 12:46 UTC):** 16,666,666.67 wZION mintováno na `0x9b5b9a6c4ce4bcd4479d8ea6d12cd7bfeb61085f` na Base. TX: `0xb98bba3216ef84f228c74afaea9e3e1128c0726e79aea60baeca3ad6c76a8cd8`. Confirmations: 5/5, Executed: true.

**Root cause & fix (2026-07-10):** Tři problémy blokovaly zpracování:

1. **Špatný validator private key na serveru** — `ZION_VALIDATOR_PRIVATE_KEY` obsahoval key pro `0xA737B512...` (stará hard-reset adresa, 0 ETH, není on-chain validátor). Opraveno: nastaveno 5 správných klíčů pro on-chain validátory z `L2wallet.md`.
2. **Chybějící L1 bloky 1-499** — po hard-resetu L1 node nemá bloky 1-499 v `accepted_by_height` mapě. Bridge se zasekla při scanu. Opraveno: `start_block_height=499`, `last_l1_height=499`.
3. **Case-sensitive status v DB** — bridge kód hledá `'Pending'` (velké P) ale DB měla `pending` (malé p). Opraveno: `UPDATE l1_locks SET status='Pending'`.
4. **Recipient mismatch** — kontrakt měl 4/5 confirmací s recipientem `0x9b5b9a6c...` z předchozích běhů. DB měla `0xdde17506...` → "Recipient mismatch". Opraveno: recipient v DB nastaven zpět na `0x9b5b9a6c...`.

### 2.4 Bridge DB State

- **evm_burns:** 1 záznam (Completed)
- **l1_locks:** 1 záznam (Completed — 16.67M wZION minted)
- **validator_confirmations:** 0
- **last_l1_height:** 499 (opraveno z 400)

---

## 3. Validator ETH Funding — Vyřešeno

On-chain validátoři mají dost ETH na Base (gas price 0.006 Gwei, TX cost ~0.0000018 ETH):

| # | Validator Address | ETH Balance | TXs možných |
|---|---|---|---|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | 0.0185 ETH | ~10,296 |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | 0.000256 ETH | ~142 |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | 0.000259 ETH | ~143 |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | 0.000260 ETH | ~144 |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | 0.000795 ETH | ~441 |

**ETH není problém.** Skutečný blocker je špatný private key na serveru (viz §2.3).

---

## 4. DeFi Contracts (Base Mainnet)

### 4.1 wZION Token

| Metric | Value |
|--------|-------|
| Contract | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| totalSupply | 200,000.099 wZION (200,000 + 100 burned) |
| Basescan | ✅ Verified |

### 4.2 ZIONStaking

| Metric | Value |
|--------|-------|
| Contract | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` |
| totalStaked | 0 wZION (žádný staker zatím) |
| APR | 12% |
| Basescan | ✅ Verified |

### 4.3 ZIONFarm

| Metric | Value |
|--------|-------|
| Contract | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` |
| wZION balance | 500,000 wZION (reward pool) |
| Basescan | ✅ Verified |

### 4.4 ZIONTreasury

| Metric | Value |
|--------|-------|
| Contract | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` |
| wZION balance | 0 |
| Type | 3-of-3 multisig (5 guardians) |
| Basescan | ✅ Verified |

### 4.5 ZIONGovernance

| Metric | Value |
|--------|-------|
| Contract | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` |
| Basescan | ✅ Verified |

### 4.6 ZIONBridge

| Metric | Value |
|--------|-------|
| Contract (Base) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` |
| Contract (Arb/OP/Avax/BSC/Poly) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` |
| Validators | 5/5 threshold |
| Basescan | ✅ Verified (2026-07-09) |

### 4.7 ZIONAtomicSwap

| Metric | Value |
|--------|-------|
| Contract | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` |
| Basescan | ✅ Verified |

---

## 5. L1 Bridge Vault

| Metric | Value |
|--------|-------|
| Address | `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` |
| Balance | 16,666,749,999,900.02 ZION |
| UTXOs | 6 |

---

## 6. Atomic Swap Escrow

| Metric | Value |
|--------|-------|
| Address | `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724` |
| Balance | 10 ZION (posláno z pool wallet, blok 1377) |
| HTLC locks | 0 |
| L1 watcher | height 1395 |
| EVM watcher | block 6370623 |

---

## 7. DAO State

| Metric | Value |
|--------|-------|
| Proposals | 0 |
| Votes | 0 |
| Scan state | height 1383 |

---

## 8. Commity (tento session)

| Commit | Popis |
|--------|-------|
| `fc267eb15` | fix(bridge): disable BSC/Polygon + inter-chunk rate-limit delay |
| `09222b303` | docs: mark ROADMAP 2.4 done, update 2.3 with validator addresses |

### Soubory změněny

- `V3/L2/bridge/config/bridge-mainnet.toml` — BSC/Polygon `enabled = false`
- `V3/L2/bridge/src/evm_watcher.rs` — `INTER_CHUNK_DELAY_MS = 250` const + delay v `poll_burns()`
- `ROADMAP.md` — 2.4 ✅, 2.3 updated s validator adresami

### Edge server změny

- `/etc/zion/config/bridge-mainnet.toml` — BSC/Polygon disabled (skutečný config path)
- `/usr/local/bin/zion-bridge` — nový binary (rebuild s active_chains filtering + inter-chunk delay)
- `/data/zion/bridge-mainnet.db` — burn status opraven na Completed
- Bridge restart: 4 watchers (Base/Arb/OP/Avax), žádné poll errory

---

## 9. ROADMAP Status

| # | Task | Status |
|---|------|--------|
| 2.1 | Resolve bridge addresses | 🔴 Blocked on D1 |
| 2.2 | Basescan verification | ✅ Done (7/7) |
| 2.3 | Validator ETH top-up | 🔴 Owner action needed |
| 2.4 | Atomic swap escrow fees | ✅ Done (10 ZION) |
| 2.5 | Staking/Farm UI verify | ✅ Done |
| 2.6 | More DEX liquidity | ✅ Done (Uniswap V3 wZION/USDT) |
| 2.7 | Blockaid false-positive report | ✅ Done |

---

## 10. Další kroky

1. **Validator ETH funding** — owner musí poslat ~0.005 ETH na 5 validator adres na Base (viz §3). Po fundingu bridge automaticky zpracuje stuck L1 lock (16.6M ZION → wZION mint).
2. **BSC/Polygon re-enable** — pořídit Ankr premium API key nebo vlastní node pro `eth_getLogs`.
3. **DAO activation** — vytvořit první proposal, ověřit voting flow.
4. **Atomic swap E2E test** — HTLC lock → claim/refund na mainnetu.
5. ~~**DEX liquidity**~~ ✅ Done — Uniswap V3 wZION/USDT pool seeded (239,595 wZION + 43.75 USDT, $0.000183/wZION, TVL $87.49).

---

## 11. DEX Likvidita — Uniswap V3 (2026-07-11)

| Metric | Value |
|--------|-------|
| Pool | `0x186b46c2f04153999d44D25179cD623fD62Bfda2` |
| DEX | Uniswap V3 |
| Fee | 0.3% |
| token0 | wZION (`0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`, 18 dec) |
| token1 | USDT (`0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2`, 6 dec) |
| wZION v poolu | 239,595 wZION |
| USDT v poolu | 43.75 USDT |
| Cena | $0.000183/wZION |
| TVL | $87.49 |
| NFT Position Manager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` (Base-specific) |
| TX | `0xab727ebd612cc7612b68fe0c0761e46f76e187ef468383c304bb43fb2d65b172` |
| Skript | `V3/L2/contracts/hardhat/scripts/add-uniswap-liquidity.ts` |
| Basescan | https://basescan.org/address/0x186b46c2f04153999d44D25179cD623fD62Bfda2 |
