# Jak funguje wZION, Bridge a celý L2 systém

> Vysvětlení pro úplného laika — žádný předchozí znalost krypta není potřeba.

---

## 1. Co je ZION a co je wZION?

```
ZION    = tvoje mince na ZION blockchainu (L1) — jako koruny v české bance
wZION   = "wrapped ZION" — stejná hodnota, ale na síti Base (Ethereum L2)
          — jako bys ty koruny převedl na eura, abys mohl platit v EU
```

**wZION je ERC-20 token.** To znamená, že ho vidíš v MetaMasku, můžeš ho poslat komukoliv na Base síti, obchodovat na DEXech (Uniswap apod.), a používat v DeFi.

**1 wZION = 1 ZION.** Vždy. Žádný kurz, žádná konverze. Je to 1:1 zrcadlo.

---

## 2. Co je Base?

Base je **síť od Coinbase** — běží na Ethereu (Layer 2). Je to jako dálnice vedle Etherea:

- **Levnější** — transakce stojí zlomky centu
- **Rychlejší** — potvrzení za 2 sekundy
- **Bezpečná** — zabezpečená Ethereem

Proč Base a ne přímo Ethereum? Protože na Ethereu by tě gas fees sežraly zaživa. Na Base zaplatíš za transakci třeba $0.001.

---

## 3. Jak funguje Bridge (most)?

Bridge je **most mezi dvěma světy**: ZION blockchain ↔ Base síť.

### Směr: ZION → wZION (zamknutí + mintování)

```
  ZION Blockchain (L1)                    Base síť
  ┌─────────────────┐                  ┌─────────────────┐
  │                  │                  │                  │
  │  Ty pošleš       │   Bridge vidí   │  Bridge vytvoří  │
  │  100 ZION        │ ──────────────► │  100 wZION       │
  │  na vault adresu │   a ověří       │  na tvůj účet    │
  │                  │                  │  v MetaMasku     │
  │  (zamkne se)     │                  │  (mintne se)     │
  └─────────────────┘                  └─────────────────┘
```

1. **Ty** pošleš ZION na speciální "vault" adresu na ZION blockchainu
2. **Bridge relay** (program běžící na serveru) to uvidí
3. Bridge **podepíše důkaz** ("ano, viděl jsem tuhle transakci")
4. Bridge **pošle důkaz na Base** → chytrý kontrakt na Base vytvoří (mintne) wZION
5. wZION se **objeví v tvém MetaMasku**

### Směr: wZION → ZION (spálení + odemknutí)

```
  Base síť                              ZION Blockchain (L1)
  ┌─────────────────┐                  ┌─────────────────┐
  │                  │                  │                  │
  │  Ty spálíš       │   Bridge vidí   │  Bridge odemkne  │
  │  100 wZION       │ ──────────────► │  100 ZION        │
  │  v bridge        │   a ověří       │  z vaultu        │
  │  kontraktu       │                  │  na tvůj účet    │
  │                  │                  │                  │
  └─────────────────┘                  └─────────────────┘
```

**Důležité:** ZION se nikdy "nevytváří z ničeho". Kolik wZION existuje na Base = přesně tolik ZION je zamčených ve vaultu. Je to 1:1 krytí.

---

## 4. Co je Atomic Swap?

Atomic Swap ti umožňuje **vyměnit ZION za jinou kryptoměnu přímo**, bez prostředníka.

```
  Ty máš: 1000 ZION          Protistrana má: 0.01 ETH
  
  1. Oba zamknete své mince do smart kontraktu (escrow)
  2. Buď se výměna dokončí celá — NEBO se vrátí oběma zpět
  3. Nikdo nemůže podvést — zajišťuje to kryptografie (HTLC)
```

"Atomic" = buď proběhne celé, nebo vůbec nic. Jako atomová operace — nedá se rozdělit.

---

## 5. Co je DAO?

DAO = **Decentralized Autonomous Organization** = demokratické hlasování o změnách.

```
  Máš 10 000 ZION?  →  Můžeš navrhnout změnu
  Máš 1 ZION?       →  Můžeš hlasovat (1 ZION = 1 hlas)
  Hlasování trvá 14 dní  →  Pokud projde, provede se automaticky
```

---

## 6. Jak to celé visí pohromadě?

```
┌─────────────────────────────────────────────────────────┐
│                    ZION Ekosystém                        │
│                                                          │
│   ┌──────────────┐         ┌──────────────────────────┐ │
│   │  ZION L1      │◄───────►│  Base (Ethereum L2)       │ │
│   │  Blockchain   │ BRIDGE  │                           │ │
│   │               │         │  wZION token (ERC-20)     │ │
│   │  • Těžba      │         │  • MetaMask               │ │
│   │  • Peněženky  │         │  • Uniswap/DEXy           │ │
│   │  • DAO hlasy  │         │  • DeFi (farming, lending)│ │
│   │               │         │  • Atomic Swap kontrakt   │ │
│   └──────┬───────┘         └──────────────────────────┘ │
│          │                                               │
│   ┌──────┴───────┐                                      │
│   │  Servery      │                                      │
│   │  Prague (EU)  │ ← Bridge + Swap + DAO běží tady     │
│   │  USA          │ ← L1 peer node                      │
│   │  Singapore    │ ← L1 peer node                      │
│   └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 7. MetaMask adresa — Base Sepolia vs Base Mainnet

### Odpověď: ANO, je to stejná adresa!

```
Tvoje adresa: 0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186

Base Sepolia (testnet)  →  stejná adresa, testovací peníze
Base Mainnet            →  stejná adresa, SKUTEČNÉ peníze
Ethereum Mainnet        →  stejná adresa
Arbitrum                →  stejná adresa
```

**Proč?** Protože tvůj MetaMask klíč (seed phrase) vytváří **jeden klíčový pár**. Ten funguje **na všech EVM sítích** — Ethereum, Base, Arbitrum, Polygon, BSC... všude stejný účet, stejná adresa.

### Jak přidat Base Mainnet do MetaMasku:

1. Otevři MetaMask → klikni na název sítě nahoře
2. „Add network" → „Add a network manually"
3. Vyplň:
   - **Network Name:** Base
   - **RPC URL:** `https://mainnet.base.org`
   - **Chain ID:** `8453`
   - **Symbol:** `ETH`
   - **Block Explorer:** `https://basescan.org`
4. Uložit → přepni se na Base

### Co potřebuješ na Base Mainnet:

- **ETH na Base** pro gas (poplatky za transakce)
- Stačí třeba $2–5 v ETH — transakce na Base stojí zlomky centu
- ETH na Base získáš přes "Bridge" z Etherea (bridge.base.org) nebo koupíš přímo na Coinbase

---

## 8. Co teď máme nasazeno a co chybí

### Běží na Base Sepolia (testnet):

| Kontrakt | Adresa | Stav |
|----------|--------|------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Funguje |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | Funguje |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` | Funguje |

### Potřebujeme nasadit na Base Mainnet:

| Kontrakt | Co je potřeba |
|----------|---------------|
| wZION | Deploy na Base mainnet → dostaneme novou adresu |
| ZIONBridge | Deploy na Base mainnet → dostaneme novou adresu |
| ZIONAtomicSwap | Deploy na Base mainnet → dostaneme novou adresu |

### K deployi potřebujeme:

1. **ETH na Base mainnetu** na adrese `0xdde17...D186` (deployer) — cca $5–10 stačí
2. **BASESCAN_API_KEY** (zdarma na basescan.org) — pro verifikaci kontraktů
3. Spustit deploy příkaz (to udělám já)

---

## 9. Celý flow po nasazení — jak bude fungovat praxe

```
  🧑 Uživatel chce převést ZION na Base:

  1. Otevře webovou stránku (bridge UI)
  2. Zadá: "Chci převést 500 ZION na Base"
  3. Dostane vault adresu → pošle 500 ZION
  4. Počká ~2 minuty (bridge relay zpracuje)
  5. 500 wZION se objeví v MetaMasku na Base
  6. Teď může:
     • Držet wZION
     • Obchodovat na Uniswap
     • Farmit v DeFi
     • Poslat někomu
     • Swapnout za ETH/USDC
  7. Až bude chtít zpět → spálí wZION v bridge kontraktu
  8. 500 ZION se odemkne na L1 a vrátí se mu
```

---

## 10. Bezpečnost — proč to je bezpečné

| Ochrana | Jak funguje |
|---------|-------------|
| **1:1 krytí** | Za každý wZION je zamčený skutečný ZION |
| **Validator proofy** | Bridge transakci musí podepsat validátoři |
| **Timelock** | Velké převody mají čekací dobu |
| **Denní limit** | Max 10M wZION/den — ochrana proti exploitu |
| **Auto-pause** | Při anomálii se bridge automaticky zastaví |
| **Open source** | Kontrakty jsou veřejně auditovatelné |

---

## Shrnutí jednou větou

> **wZION je zrcadlo ZIONu na Base síti — most (bridge) ho zamyká/odemyká, swap umožňuje přímou výměnu, a DAO dává komunitě kontrolu. Tvoje MetaMask adresa funguje všude stejně.**
