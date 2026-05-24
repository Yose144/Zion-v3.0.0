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
│   │  Edge (EU)    │ ← Bridge + Swap + DAO běží tady     │
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

## 11. Aktuální stav L1 sítě (1. dubna 2026)

```
Chain height:    6 661 bloků
Konsensus:       cosmic_harmony_ekam_deeksha_v2
Síť:             Mainnet (3 nody, full mesh)
Pool:            běží, share accepted
Miner:           ~3 200 H/s, 90 % accept rate
Všechny 3 nody:  synced na stejném tipu
```

### Co L1 ještě NEUMÍ (blokéry pro ostrý bridge):

| Chybí | Proč to blokuje mainnet bridge |
|-------|-------------------------------|
| Payout execution | `missing ZION_POOL_PAYOUT_SK_HEX` — pool nemá klíč na výplaty |
| Bridge vault adresa | Placeholder, ne reálná on-chain adresa |
| submitBridgeUnlock end-to-end | Kryptografická validace je v kódu, ale nebyla testována na live chainu |
| Reálné transakce | Chain má 6 661 bloků, zatím žádný reálný provoz |
| Wallet / explorer | Uživatelé nemají jak poslat ZION na vault |

---

## 12. Strategie: Testnet vs Mainnet — co dělat TEĎ

### Doporučení: Hybridní přístup

```
┌─────────────────────────────────────────────────────────────┐
│                    CO UDĚLAT HNED                             │
│                                                              │
│  ✅ Deploy wZION na Base MAINNET                             │
│     → Token existuje, je viditelný, má CoinGecko listing     │
│     → Mintování ZAKÁZÁNO dokud bridge není ostrý             │
│     → Adresa je známá, můžeš ji propagovat                  │
│                                                              │
│  ✅ Deploy ZIONBridge + AtomicSwap na Base MAINNET           │
│     → Kontrakty existují, ale bridge je PAUSED               │
│     → Ready to flip — až L1 bude připravená                 │
│                                                              │
│  ✅ Nechat bridge relay na Edge běžet na TESTNET            │
│     → Testuje reálný flow, zachytává bugy                   │
│     → Žádné riziko ztráty peněz                             │
│                                                              │
│  ⏳ Přepnout na mainnet AŽ:                                 │
│     1. L1 pool payout funguje (reálné ZION výplaty)          │
│     2. Bridge vault je reálná adresa na L1                   │
│     3. Aspoň 1 úspěšný end-to-end test na testnetu         │
│     4. Explorer/wallet umožňuje uživatelům posílat ZION     │
└─────────────────────────────────────────────────────────────┘
```

### Proč tento přístup:

1. **wZION na Base mainnetu hned** = token je "real", může se listovat, lidi ho vidí
2. **Bridge PAUSED** = nikdo nemůže mintovat bez povolení — bezpečné
3. **Testnet relay běží** = neustále testujeme, odlaďujeme
4. **Flip to mainnet** = až bude L1 ready, stačí změnit 1 config soubor

### Co to stojí:

- Deploy 3 kontraktů na Base mainnet: **~$2–5 v ETH** (Base je levný)
- Čas: **~30 minut** (deploy + verifikace + update configů)

---

## 13. Postup pro deploy na Base Mainnet

### Předpoklady:

1. MetaMask s adresou `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
2. ETH na Base mainnetu na této adrese (~$5–10)
3. BASESCAN_API_KEY (zdarma z basescan.org — registrace)

### Krok za krokem:

```bash
# 1. Přejdi do kontraktového adresáře
cd L2/contracts

# 2. Nastav proměnné prostředí
export DEPLOYER_PRIVATE_KEY="tvůj_privátní_klíč"   # z MetaMasku
export BASESCAN_API_KEY="tvůj_basescan_key"
export BASE_RPC="https://mainnet.base.org"

# 3. Deploy wZION token
npx hardhat run scripts/deploy-wzion.ts --network base

# 4. Deploy ZIONBridge (v paused stavu)
npx hardhat run scripts/deploy-bridge.ts --network base

# 5. Deploy ZIONAtomicSwap
npx hardhat run scripts/deploy-atomic-swap.ts --network base

# 6. Verifikuj na BaseScan
npx hardhat verify --network base <WZION_ADRESA>
npx hardhat verify --network base <BRIDGE_ADRESA>
npx hardhat verify --network base <SWAP_ADRESA>
```

### Po deployi:

1. Zapiš nové adresy do `V3/L2/bridge/config/bridge-mainnet.toml`
2. Zapiš swap adresu do `V3/L2/atomic-swap/config/swap-mainnet.toml`
3. Vytvoř `L2/contracts/deployed-base-mainnet.json` s adresami
4. Commit + push

### Přepnutí bridge relay na mainnet (AŽ bude L1 ready):

```bash
# Na Edge serveru:
ssh root@100.76.16.108

# Změň env proměnnou
# V .env souboru pro L2:
ZION_BRIDGE_CONFIG=/etc/zion/bridge-mainnet.toml

# Recreate bridge kontejner
cd /root/zion-2.9.6/V3/docker
docker compose -f docker-compose.v3-l2.yml up -d --force-recreate bridge
```

---

## Shrnutí jednou větou

> **wZION je zrcadlo ZIONu na Base síti — most (bridge) ho zamyká/odemyká, swap umožňuje přímou výměnu, a DAO dává komunitě kontrolu. Tvoje MetaMask adresa funguje všude stejně. Deploy na Base mainnet je ready — bridge se aktivuje až L1 dozraje.**
