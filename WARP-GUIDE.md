# WARP Bridge — Návod pro začátečníky 🇨🇿

> WARP = Wormhole Architecture for Rainbow Protocol  
> Testovací síť: **Base Sepolia ↔ ZION L1** · Aktualizováno: březen 2026

Tento návod vysvětluje, jak přesunout ZION mezi různými blockchainy pomocí WARP bridge.
Psáno jednoduše — bez technického žargonu.

---

## Co je WARP bridge?

Představ si WARP jako **teleport peněz mezi různými světy (blockchainy)**.

Máš ZION na ZION L1? Chceš ho použít v Ethereum DeFi?  
WARP to zařídí. Tvoje ZION se zamkne na L1 a na cílovém chainu se vytvoří wZION (wrapped ZION).

```
ZION L1  ──lock──►  WARP  ──mint──►  wZION na Base Sepolia
wZION    ──burn──►  WARP  ──unlock──►  ZION zpět na L1
```

**Důležité:** Vše prochází přes ZION L1 jako centrum (hub-and-spoke). Žádný přímý most chain-to-chain.

---

## Přehled podporovaných sítí

| Síť | Stav | Poznámka |
|---|---|---|
| **Base Sepolia** | ✅ Aktivní | Hlavní testovací síť |
| Arbitrum Sepolia | 🔶 Brzy | Připraveno, čeká aktivaci |
| BSC Testnet | 🔶 Brzy | Připraveno, čeká aktivaci |
| Polygon Mumbai | 🔶 Brzy | Připraveno, čeká aktivaci |
| Solana Devnet | 🔶 Brzy | Implementováno, čeká aktivaci |
| Tron Shasta | 🔶 Brzy | Implementováno, čeká aktivaci |
| Stellar Testnet | 🔶 Brzy | Implementováno, čeká aktivaci |
| Cosmos Testnet | 🔶 Brzy | Implementováno, čeká aktivaci |
| Bitcoin Testnet | 🔶 Brzy | Implementováno, čeká aktivaci |
| Cardano Preprod | 🔶 Brzy | Implementováno, čeká aktivaci |

> Na testnetu je aktivní pouze Base Sepolia. Ostatní budou zapínány postupně.

---

## ZION L1 → wZION na Base Sepolia

### Co potřebuješ
- ZION peněženku (ZION L1)
- MetaMask s Base Sepolia sítí (viz [DEFI.md](DEFI.md) Krok 1)
- Ethereum adresu (tvoje MetaMask adresa)
- Minimální převod: **100 ZION**

### Postup

**1. Zkopíruj svoji Ethereum adresu z MetaMask**
```
Příklad: 0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186
```

**2. V ZION L1 peněžence vytvoř transakci s tímto memo:**
```
WARP:1:base:0xTvojaEthereumAdresa
```

Formát memo:
```
WARP : 1 : base : 0x...
 │      │    │      └─ tvoje adresa na cílovém chainu
 │      │    └──────── cílový chain (base, solana, atd.)
 │      └───────────── verze protokolu (vždy 1)
 └──────────────────── prefix (vždy WARP)
```

**3. Odešli transakci** na WARP vault adresu:
```
zion1warp0000000000000000000000000000vault
```

**4. Počkej ~2 minuty** — WARP daemon detekuje tvoji transakci, ověří ji a mintuje wZION.

**5. Zkontroluj MetaMask** — wZION by měl přibýt.  
Pokud token nevidíš, přidej ho ručně (viz [DEFI.md](DEFI.md) Krok 2).

---

## wZION → ZION L1 (zpět)

### Co potřebuješ
- wZION na Base Sepolia
- ETH na gas
- ZION L1 adresa (začíná `zion1...`)

### Postup

**1. Jdi na wZION kontrakt na Basescan:**  
[sepolia.basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6](https://sepolia.basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6#writeContract)

**2. Záložka Write Contract → Connect to Web3** (připoj MetaMask)

**3. Najdi funkci `bridgeBurn` a vyplň:**

| Parametr | Co zadat | Příklad |
|---|---|---|
| `amount` | Množství v wei (100 wZION) | `100000000000000000000` |
| `l1Recipient` | Tvoje ZION L1 adresa | `zion1q2w3e4r5t6y7...` |

**4. Klikni Write** → MetaMask potvrdí transakci

**5. Počkej ~2 minuty** → ZION přijde na tvoji L1 adresu

---

## Jak převést wei

| Chceš převést | Zadej do kontraktu |
|---|---|
| 100 wZION | `100000000000000000000` |
| 500 wZION | `500000000000000000000` |
| 1 000 wZION | `1000000000000000000000` |

> MetaMask obvykle umí zadat přímo "100" a automaticky převede.

---

## Limity a poplatky

| Parametr | Hodnota |
|---|---|
| Minimální převod | **100 ZION** |
| Maximální single transfer | **5 000 000 ZION** |
| Denní limit | **10 000 000 ZION** |
| Převod >1M ZION | Automatický timelock 24 hodin |
| Poplatek WARP | 0 (testnet) |
| Gas na Base Sepolia | ~0.0001 ETH za tx |

---

## Bezpečnost

- **Validátoři** ověřují každý transfer (testnet: 1-of-1, mainnet: multi-sig)
- **Timelock** na velké převody (>1M ZION) — 24h delay
- **Denní limit** chrání před masivními úniky funds
- **Replay protection** — každý transfer má unikátní ID, nelze zaplatit dvakrát
- **Pause** — guardian může v nouzi bridge zastavit

---

## Sledování stavu

### Na Base Sepolia
Každý `bridgeBurn` event je viditelný na:  
`https://sepolia.basescan.org/tx/<txHash>`

### WARP API
WARP daemon běží na portu **9333**:
```
GET http://<server>:9333/transfers
GET http://<server>:9333/transfers/pending
GET http://<server>:9333/health
```

---

## Časté otázky

**Q: Jak dlouho trvá převod?**  
Typicky 2–5 minut. WARP polling každých 15 sekund + L1 finality (60 bloků).

**Q: Co když wZION nepřišel?**  
Zkontroluj že máš přidaný token v MetaMask (adresa `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`). Pokud token existuje ale balance je 0, transfer ještě neproběhl — počkej pár minut.

**Q: Mohu wZION poslat kamarádovi bez bridge?**  
Ano — wZION je normální ERC-20 token. Posílej přímo z MetaMask, obchoduj na DEX atd. WARP potřebuješ jen pro přesun L1 ↔ Ethereum.

**Q: Je bezpečné dát svoji L1 adresu do memo?**  
Ano — je to veřejná adresa jako Ethereum adresa. Nikdy nezadávej privátní klíč.

**Q: Proč vše jde přes L1 a ne přímo?**  
ZION L1 je centrum (hub). Bezpečnostní model je jednodušší — nemusíš věřit každé dvojici chainů, jen L1.

**Q: Kdy Solana, Tron a ostatní?**  
Adaptery jsou napsané a otestované. Aktivují se postupně po dokončení signing service.

---

## Adresy

| Položka | Adresa |
|---|---|
| wZION ERC-20 (Base Sepolia) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge vault (Base Sepolia) | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` |
| WARP Vault (ZION L1) | `zion1warp0000000000000000000000000000vault` |
| ZION L1 RPC | `http://77.42.31.72:8444` |

---

## Více informací

- [DEFI.md](DEFI.md) — Návod na DeFi produkty (staking, farming, swap)
- [WARP.md](WARP.md) — Technická dokumentace WARP (pro vývojáře)
