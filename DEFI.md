# ZION DeFi — Návod pro začátečníky 🇨🇿

> Testovací síť: **Base Sepolia** · Aktualizováno: březen 2026

Tento návod je pro každého, kdo chce vyzkoušet ZION DeFi protokoly — i bez technických znalostí.
Stačí mít MetaMask a pár minut.

---

## Co budeš potřebovat

- **MetaMask** (rozšíření do prohlížeče) — stáhnout na [metamask.io](https://metamask.io)
- **Testovací ETH na Base Sepolia** — zdarma z faucetu
- **Testovací wZION** — získáš přes WARP bridge (viz [WARP-GUIDE.md](WARP-GUIDE.md))

---

## Krok 1 — Přidej Base Sepolia do MetaMask

1. Otevři MetaMask → klikni na název sítě (nahoře)
2. Klikni **Přidat síť** → **Přidat ručně**
3. Vyplň tato data:

| Pole | Hodnota |
|---|---|
| Název sítě | Base Sepolia |
| RPC URL | `https://sepolia.base.org` |
| Chain ID | `84532` |
| Symbol | `ETH` |
| Průzkumník | `https://sepolia.basescan.org` |

4. Ulož → přepni na tuto síť

---

## Krok 2 — Přidej wZION token do MetaMask

1. V MetaMask klikni **Importovat token**
2. Zadej adresu tokenu:
   ```
   0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
   ```
3. Symbol se doplní automaticky: **wZION**, decimals: **18**
4. Klikni **Přidat token**

---

## Krok 3 — Získej testovací ETH

Bez ETH nezaplatíš poplatky za transakce (gas). Je to nutné.

**Faucety (zadarmo):**
- [alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia) — nejjednodušší, stačí účet
- [faucet.quicknode.com/base/sepolia](https://faucet.quicknode.com/base/sepolia)
- [coinbase.com/faucets](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

Obdrží cca **0.1 ETH** — stačí na stovky transakcí.

---

## Krok 4 — Získej testovací wZION

wZION dostaneš přes WARP bridge — pošli ZION z L1 a na Base Sepolia ti přijde wZION.
Podrobný návod: **[WARP-GUIDE.md](WARP-GUIDE.md)**

---

## DeFi Produkty

### 🏦 ZIONStaking — Staking s fixním APR

**Adresa:** `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913`  
**APR:** 12% ročně  
**Cooldown:** 7 dní po žádosti o výběr

**Jak na to:**
1. Jdi na [sepolia.basescan.org/address/0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913](https://sepolia.basescan.org/address/0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913#writeContract)
2. Záložka **Write Contract** → klikni **Connect to Web3** (připoj MetaMask)
3. Nejdřív schval wZION: jdi na [adresu wZION](https://sepolia.basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6#writeContract) → funkce `approve` → spender = adresa Staking, amount = kolik chceš stakovat v wei
4. Zpět na Staking → funkce `stake(amount)` → zadej amount v wei
5. Odměny vybereš kdykoli: funkce `claimRewards()`
6. Výběr jistiny: `requestUnstake()` → počkat 7 dní → `unstake()`

> **Co je wei?** 1 wZION = `1000000000000000000` wei (18 nul). Chceš stakovat 100 wZION → zadej `100000000000000000000`.

---

### 🌾 ZIONFarm — Yield Farming

**Adresa:** `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843`  
**Reward token:** wZION  
**Pool 0:** wZION single-staking

**Jak na to:**
1. Jdi na [adresu ZIONFarm](https://sepolia.basescan.org/address/0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843#writeContract) → Write Contract
2. Nejdřív `approve` wZION pro Farm (stejně jako u Stakingu)
3. Funkce `deposit(pid, amount)` — pid = `0` pro wZION pool
4. Odměny vybereš: `harvest(0)`
5. Výběr + harvest najednou: `withdraw(0, amount)`

> **Halving:** Reward rate se halvuje každých 90 dní — čím dřív vstoupíš, tím víc vyděláš.

---

### 🔄 ZIONAtomicSwap — Trustless Výměna

**Adresa:** `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc`

Atomic swap = trustless výměna bez burzy. Pokud protistrana nesplní podmínky do deadline, peníze se automaticky vrátí.

**Jak funguje (příklad: Alice ↔ Bob):**

| Krok | Kdo | Co udělá |
|---|---|---|
| 1 | Alice | Vygeneruje `secret` a jeho hash `secretHash` |
| 2 | Alice | Zavolá `lockETH(id, secretHash, bob_adresa, deadline)` a vloží ETH |
| 3 | Bob | Vidí lock → zavolá `lockERC20(id2, secretHash, alice_adresa, deadline, wZION, amount)` |
| 4 | Alice | Zavolá `claim(id2, secret)` → dostane wZION |
| 5 | Bob | Vidí secret → zavolá `claim(id, secret)` → dostane ETH |
| nebo | Kdokoli | Po deadline zavolá `refund(id)` → dostane zpět co vložil |

**Minimální timelock:** 30 minut · **Maximální:** 30 dní

---

### 🗳️ ZIONGovernance — Hlasování

**Adresa:** `0x039F730e3e1c3f36da95187697118791762290a1`

Majitelé wZION mohou hlasovat o změnách protokolu.
- Hlasovací váha = počet wZION
- Kdokoli může vytvořit návrh (`propose`)
- Po schválení se návrh vykoná (`execute`)

---

### 🏛️ ZIONTreasury — Pokladnice

**Adresa:** `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537`

Multi-sig pokladnice projektu. Běžný uživatel s ní přímo neinteraguje.

---

## Přehled všech adres (Base Sepolia, chain ID 84532)

| Kontrakt | Adresa |
|---|---|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` |
| ZIONStaking | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` |
| ZIONFarm | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` |
| ZIONGovernance | `0x039F730e3e1c3f36da95187697118791762290a1` |
| ZIONTreasury | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` |

---

## Časté otázky

**Q: Je to bezpečné? Můžu přijít o peníze?**  
Toto je **testovací síť** — tokeny nemají reálnou hodnotu. Zkoušej bez obav.

**Q: Jak vidím svůj stav stakingu?**  
Basescan → adresa Staking → **Read Contract** → `getStakeInfo(tvoje_adresa)`.

**Q: MetaMask říká "insufficient gas".**  
Nemáš testovací ETH → Krok 3.

**Q: Co je APR 12%?**  
1000 wZION × 12% = 120 wZION za rok. Připisuje se každou sekundu.

**Q: Kdy mainnet?**  
Viz [docs/MAINNET_ROADMAP_2026.md](docs/MAINNET_ROADMAP_2026.md).

---

## Průzkumník

**[sepolia.basescan.org](https://sepolia.basescan.org)** — zadej svoji adresu nebo adresu kontraktu.

---

## Více informací

- [WARP-GUIDE.md](WARP-GUIDE.md) — Jak přesunout ZION mezi chainy
- [WARP.md](WARP.md) — Technická dokumentace bridge
