# Zion Multichain — Status Report

> **Účel:** Stručný report o stavu multichain walletu a ZionDexu. Detailní plány jsou v `docs/3.2/3.2.4-Multichain-and-DEX/`.
>
> **Poslední aktualizace:** 2026-08-31

---

## 1. Co je Zion Multichain

Zion Multichain je L2 služba (`V31/L2/multichain`), která přidává uživatelům ZIS možnost:

- vkládat a vybírat tokeny napříč chainy (Base, ZION L1, Bitcoin, další),
- sledovat interní saldo (custodial ledger),
- swapovat tokeny v rámci ZionDexu,
- propojit vlastní externí adresy pro výběry.

### Hlavní komponenty

| Komponenta | Soubor | Účel |
|---|---|---|
| `MultichainService` | `V31/L2/multichain/src/service.rs` | hlavní orchestrátor |
| `EvmAdapter` | `V31/L2/multichain/src/chain/adapters/evm.rs` | EVM/Base adapter |
| `BitcoinAdapter` | `V31/L2/multichain/src/chain/adapters/bitcoin.rs` | Bitcoin adapter |
| `ZionL1Adapter` | `V31/L2/multichain/src/chain/adapters/zion_l1.rs` | ZION L1 adapter |
| `SwapExecutor` | `V31/L2/multichain/src/swap/dex/swap_executor.rs` | DEX swap workflow |
| `DexRouter` | `V31/L2/multichain/src/swap/dex.rs` | interní AMM quote engine |
| `MultichainWalletContext` | `APP&WEB/website-v2.9/src/contexts/MultichainWalletContext.tsx` | UI stav |
| `CrossChainSwapWidget` | `APP&WEB/website-v2.9/src/components/dex/CrossChainSwapWidget.tsx` | swap UI |

---

## 2. Co aktuálně funguje

- **Frontend** (`npm run build` prochází):
  - login via ZIS / Google / MetaMask,
  - swap widget s výběrem chainu a tokenu,
  - zobrazení deposit adres,
  - odvození per-user adres.
- **Backend** (`cargo test -p zion-multichain` prochází):
  - per-user derivace deposit adres z `ZION_WALLET_MNEMONIC`,
  - sledování ERC-20 `Transfer` eventů na Base pro wZION, USDC, USDT, WETH,
  - credit/debit interního ledgeru,
  - withdraw request + on-chain odeslání ERC-20,
  - `Reconciler` porovnává on-chain hot wallet zůstatky s interními saldy,
  - rate limiting, audit log, nonce management.
- **Intent / HTLC engine** pro trustless cross-chain swap je implementován, ale guard pro bridge hopy zůstává zapnutý do reálné validace.

---

## 3. Kritická zjištění z on-chain analýzy Base

Ověřeno veřejným RPC `https://mainnet.base.org` 2026-08-29.

| | Hodnota |
|---|---|
| **Multichain hot wallet** | `0x3903763b50F32A50E35e94FC63ecb291c30DcEaC` |
| ETH balance | `0` |
| wZION balance | `0` |
| USDC balance | `0` |
| USDT balance | `0` |

### wZION

- `totalSupply`: **216 671 771.73 wZION**
- `mintableSupply`: **143 783 328 228.27 wZION**
- bridge contract drží `0 wZION` — mintí přímo příjemci
- CCA auction drží `66 466 631.15 wZION` (zamčeno do blocku 55 959 126)
- farm drží `500 000 wZION`
- staking drží `100 000 wZION`

### DEX pooly na Base

| Pool | DEX | Pair | Fee | Stav |
|---|---|---|---|---|
| `0x46cc…6f47` | PancakeSwap V3 | wZION/USDT | 0.25% | jednostranný, ~0 USDT, cena ≈ 0 |
| `0x186b…fda2` | Uniswap V3 | wZION/USDT | 0.3% | nulová likvidita |
| `0x18c0…0699` | Uniswap V3 | wZION/WETH | 1.0% | nulová likvidita |

**Závěr:** Na Base není aktuálně žádný funkční pool, přes který by se dal wZION reálně směnit. Pro reálné swapy musíme vytvořit a nafundovat nový V3 pool.

---

## 4. Bezpečnostní a provozní rizika

### In-memory DexRouter

Současný `DexRouter` je `Vec<Pool>` v paměti s `reserve_a`/`reserve_b` jako čísly v SQLite. Cena se počítá z těchto rezerv, nikoliv z on-chain trhu. Při swapu:

1. Odečte se vstup z ledgeru uživatele.
2. Změní se interní rezervy.
3. Až poté se zkouší on-chain `transfer_token` z hot walletu.

To znamená, že pokud hot wallet nemá dostatek výstupního tokenu, swap zfailuje **po** aktualizaci ledgeru. Pro reálné uživatele je to nepřijatelné riziko solventnosti.

### Navrhované řešení (option A)

- Swapy se budou provádět **skutečně on-chain** přes Uniswap V3 / PancakeSwap V3 router.
- Cenu bude určovat `QuoterV2`, nikoliv interní tabulka.
- Interní ledger bude evidencí vlastnictví, ale tokeny se budou hýbat on-chain.
- Před každým swapem se ověří, že hot wallet má dostatek vstupního tokenu.
- Při selhání on-chain transakce se ledger **neaktualizuje**.
- `Reconciler` bude mít možnost blokovat operace při nesouladu on-chain vs interní salda.

---

## 5. Co bylo opraveno v posledním kole

### Frontend

- `MetaMaskWalletPanel.tsx` — mapování `zion-l1`, Base SIWE `chainId` 8453.
- `MultichainWalletContext.tsx` — `BigInt(10) ** BigInt(decimals)`, guard na odvození.
- `lib/metamask.ts` — `hexZeroPad` pro ERC-20 transfer data.
- `lib/multichain-api.ts` — propagace `data.error`.
- `AuthContext.tsx` — EIP-55 checksum, dynamický SIWE `chainId`.

### Rust

- `EvmAdapter` — token registry pro libovolný ERC-20, `receipt.status` kontrola, validace chainu příjemce.
- `contracts.rs` — `TokenInfo` pro USDC/USDT/WETH, správná USDT adresa, nový `V3Dex` s Uniswap + PancakeSwap V3 kontrakty.
- `server.rs`, `withdrawals.rs`, `swap/dex/executor.rs`, `swap/dex/intent_engine.rs` — centrální `token_decimals` helper.
- `service.rs` — `build_adapter` používá `wallet_keyring`, takže Base hot wallet se odvozuje od `ZION_WALLET_MNEMONIC`.

---

## 6. Otevřené blockery

| # | Problém | Co je potřeba |
|---|---|---|
| 1 | Hot wallet má 0 ETH | Nafundovat Base gas |
| 2 | Hot wallet má 0 wZION | Bridge mint / přesun z farm/treasury/auction |
| 3 | Hot wallet má 0 USDT/USDC | Operátor dodá stablecoiny |
| 4 | Žádný funkční DEX pool na Base | Vytvořit nový V3 pool wZION/USDT (nebo USDC) se správnou cenou $0.0002 |
| 5 | In-memory AMM se používá pro ceny | Refactor `SwapExecutor` na on-chain quote + swap |
| 6 | Solvency guard není hard-stop | Upravit `Reconciler` / `SwapExecutor` aby odmítly operace bez krytí |

---

## 7. Doporučené další kroky

1. **Fund hot wallet** — ETH, wZION, USDT/USDC.
2. **Vytvořit nový V3 pool** na PancakeSwap nebo Uniswap V3 s fee tierem 0.25% (2500).
3. **Implementovat `EvmAdapter::quote_exact_input_single`** pro `QuoterV2`.
4. **Implementovat `EvmAdapter::swap_exact_input_single`** pro `SwapRouter`/`SmartRouter`.
5. **Refactorovat `SwapExecutor`** — použít on-chain quote/swap místo `DexRouter::execute` pro Base páry.
6. **Přidat solvency guard** — on-chain balance ≥ interní claims.
7. **Otestovat E2E** na Base s reálnými tokeny.

---

## 8. Reference

- Detailní plán: `docs/3.2/3.2.4-Multichain-and-DEX/ZionDexZis.md`
- On-chain settlement plán: `docs/3.2/3.2.4-Multichain-and-DEX/ZionDex-OnChain-Settlement-Plan.md`
- 3.2 master plán: `docs/3.2/3.2.1-3.2.9_PLAN.md`
- Hlavní Rust workspace: `V31/`

---

*Vygenerováno 2026-08-31. Report je živý dokument — aktualizujte po každé větší změně.*
